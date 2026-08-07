import { spawn, ChildProcess, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { RecordingSession, VideoFile, EngineSettings, SystemStats, LiveStatusResult } from './types';

// Paths relative to root project
const PROJECT_ROOT = path.resolve(process.cwd(), '..');
const RECORDER_CORE_DIR = path.join(PROJECT_ROOT, 'recorder-core');
const DEFAULT_OUTPUT_DIR = path.join(PROJECT_ROOT, 'output');
const DATA_DIR = path.join(process.cwd(), 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure output and data directories exist
if (!fs.existsSync(DEFAULT_OUTPUT_DIR)) {
  fs.mkdirSync(DEFAULT_OUTPUT_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory active process registry
const activeProcesses: Map<string, ChildProcess> = new Map();

// Helper to detect python3 vs python binary
export function getPythonCommand(): string {
  if (process.platform === 'win32') {
    try {
      execSync('python --version', { stdio: 'ignore' });
      return 'python';
    } catch (e) {
      return 'py';
    }
  } else {
    try {
      execSync('python3 --version', { stdio: 'ignore' });
      return 'python3';
    } catch (e) {
      return 'python';
    }
  }
}

// Helper to format bytes to human readable format
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper to auto-remux orphaned un-converted _flv.mp4 raw stream files into clean playable .mp4
// Also rescues orphaned segment files (.{stem}_seg*.flv) left behind after a crash/force-kill
export function autoRemuxUnfinishedVideos(outputDir: string) {
  if (!fs.existsSync(outputDir)) return;
  // Do NOT perform background remuxing if any recording session is active
  if (activeProcesses.size > 0) return;
  const settings = getSettings();
  const ffmpegCmd = settings.ffmpegPath || 'ffmpeg';

  try {
    const files = fs.readdirSync(outputDir);
    const now = Date.now();

    // --- Pass 1: Rescue orphaned hidden segment files (.{stem}_seg*.flv) ---
    // These are left behind when Python is force-killed before it can concat them
    const segmentFiles = files.filter(
      (f) => f.startsWith('.') && f.includes('_seg') && f.endsWith('.flv')
    );

    // Group segments by their stem (the part before _seg####)
    const segmentGroups: Record<string, string[]> = {};
    for (const seg of segmentFiles) {
      // Pattern: .{stem}_seg0000.flv
      const match = seg.match(/^\.(.+)_seg(\d{4})\.flv$/);
      if (!match) continue;
      const stem = match[1];
      if (!segmentGroups[stem]) segmentGroups[stem] = [];
      segmentGroups[stem].push(seg);
    }

    for (const [stem, segs] of Object.entries(segmentGroups)) {
      try {
        // Only rescue segments older than 5 minutes (not from an active recording)
        const allOld = segs.every((seg) => {
          const segPath = path.join(outputDir, seg);
          try {
            return now - fs.statSync(segPath).mtimeMs > 300000;
          } catch {
            return false;
          }
        });
        if (!allOld) continue;

        // Sort by segment index
        segs.sort();
        const fullSegPaths = segs.map((s) => path.join(outputDir, s));
        const rescuedFlv = path.join(outputDir, `${stem}_flv.mp4`);

        if (segs.length === 1) {
          // Single segment — just rename
          fs.renameSync(fullSegPaths[0], rescuedFlv);
          console.log(`[SYS] Rescued single-segment recording: ${stem}_flv.mp4`);
        } else {
          // Multiple segments — concat with FFmpeg
          const concatList = path.join(outputDir, `${stem}_rescue_concat.txt`);
          const concatContent = fullSegPaths.map((p) => `file '${p}'`).join('\n');
          fs.writeFileSync(concatList, concatContent, 'utf-8');

          execSync(
            `"${ffmpegCmd}" -y -f concat -safe 0 -i "${concatList}" -c copy "${rescuedFlv}"`,
            { stdio: 'ignore', timeout: 300000 }
          );

          fs.unlinkSync(concatList);

          if (fs.existsSync(rescuedFlv) && fs.statSync(rescuedFlv).size > 0) {
            for (const seg of fullSegPaths) {
              try { fs.unlinkSync(seg); } catch {}
            }
            console.log(`[SYS] Rescued ${segs.length}-segment recording -> ${stem}_flv.mp4`);
          }
        }
      } catch (e) {
        console.error(`[SYS] Failed rescuing segments for ${stem}:`, e);
      }
    }

    // --- Pass 2: Re-read files after segment rescue, then remux _flv.mp4 -> .mp4 ---
    const updatedFiles = fs.readdirSync(outputDir);
    for (const file of updatedFiles) {
      if (file.endsWith('_flv.mp4')) {
        const fullFlvPath = path.join(outputDir, file);

        try {
          const stat = fs.statSync(fullFlvPath);
          // Skip files modified within the last 2 minutes (active or recently ended)
          if (now - stat.mtimeMs < 120000) {
            continue;
          }

          const targetMp4Name = file.replace(/_flv\.mp4$/, '.mp4');
          const targetMp4Path = path.join(outputDir, targetMp4Name);

          // Skip if already converted
          if (fs.existsSync(targetMp4Path) && fs.statSync(targetMp4Path).size > 0) {
            fs.unlinkSync(fullFlvPath);
            continue;
          }

          execSync(`"${ffmpegCmd}" -y -i "${fullFlvPath}" -c copy "${targetMp4Path}"`, {
            stdio: 'ignore',
            timeout: 300000,
          });
          if (fs.existsSync(targetMp4Path) && fs.statSync(targetMp4Path).size > 0) {
            fs.unlinkSync(fullFlvPath);
            console.log(`[SYS] Auto-remuxed orphaned file ${file} -> ${targetMp4Name}`);
          }
        } catch (e) {
          console.error(`Failed remuxing ${file}:`, e);
        }
      }
    }
  } catch (err) {
    console.error('Error auto-remuxing videos:', err);
  }
}

// Read sessions from storage
export function getSessions(): RecordingSession[] {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      const sessions: RecordingSession[] = JSON.parse(data);
      // Sync status: if session is 'running' but activeProcesses doesn't have it,
      // verify using the actual OS PID before marking it as stopped.
      // This prevents hot-reload from wiping the activeProcesses Map and wrongly
      // marking running sessions as stopped.
      return sessions.map((s) => {
        if (s.status === 'running' && !activeProcesses.has(s.id)) {
          // Check if the PID is still alive in the OS before changing status
          if (s.pid && isPidRunning(s.pid)) {
            // Process is alive but we lost track of it (e.g. after hot-reload)
            // Keep it as running — we can't stop it but at least show it correctly
            return s;
          }
          // PID is gone — session truly ended without proper cleanup
          return { ...s, status: 'stopped' as const, stopTime: s.stopTime || new Date().toISOString() };
        }
        return s;
      });
    }
  } catch (err) {
    console.error('Error reading sessions.json:', err);
  }
  return [];
}

// Save sessions to storage
export function saveSessions(sessions: RecordingSession[]) {
  try {
    // Keep last 100 sessions to avoid file bloat
    const trimmed = sessions.slice(-100);
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving sessions.json:', err);
  }
}

// Read settings
export function getSettings(): EngineSettings {
  const defaultCookiesPath = path.join(RECORDER_CORE_DIR, 'src', 'cookies.json');
  const defaultTelegramPath = path.join(RECORDER_CORE_DIR, 'src', 'telegram.json');

  let cookiesContent = '{\n  "sessionid": ""\n}';
  let telegramContent = '{\n  "bot_token": "",\n  "chat_id": ""\n}';

  if (fs.existsSync(defaultCookiesPath)) {
    cookiesContent = fs.readFileSync(defaultCookiesPath, 'utf-8');
  }
  if (fs.existsSync(defaultTelegramPath)) {
    telegramContent = fs.readFileSync(defaultTelegramPath, 'utf-8');
  }

  let customSettings: Partial<EngineSettings> = {};
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      customSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    } catch (e) {
      console.error('Failed parsing settings.json', e);
    }
  }

  return {
    outputDir: customSettings.outputDir || DEFAULT_OUTPUT_DIR,
    ffmpegPath: customSettings.ffmpegPath || 'ffmpeg',
    proxy: customSettings.proxy || '',
    bitrate: customSettings.bitrate || '',
    noUpdateCheck: customSettings.noUpdateCheck ?? true,
    cookiesJson: customSettings.cookiesJson || cookiesContent,
    telegramJson: customSettings.telegramJson || telegramContent,
  };
}

// Save settings
export function updateSettings(newSettings: Partial<EngineSettings>): EngineSettings {
  const current = getSettings();
  const updated = { ...current, ...newSettings };

  // Update cookies.json in recorder-core if provided
  if (newSettings.cookiesJson !== undefined) {
    const cookiesPath = path.join(RECORDER_CORE_DIR, 'src', 'cookies.json');
    fs.writeFileSync(cookiesPath, newSettings.cookiesJson, 'utf-8');
  }

  // Update telegram.json in recorder-core if provided
  if (newSettings.telegramJson !== undefined) {
    const telegramPath = path.join(RECORDER_CORE_DIR, 'src', 'telegram.json');
    fs.writeFileSync(telegramPath, newSettings.telegramJson, 'utf-8');
  }

  // Save settings file
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf-8');

  // Ensure custom output dir exists if specified
  if (updated.outputDir && !fs.existsSync(updated.outputDir)) {
    try {
      fs.mkdirSync(updated.outputDir, { recursive: true });
    } catch (e) {
      console.error('Failed to create output directory:', e);
    }
  }

  return updated;
}

// Start a recording process
export function startRecording(params: {
  user?: string;
  url?: string;
  roomId?: string;
  mode?: 'manual' | 'automatic' | 'followers';
  interval?: number;
  duration?: number;
  proxy?: string;
  bitrate?: string;
  telegram?: boolean;
}): RecordingSession {
  const settings = getSettings();
  const targetUser = params.user ? params.user.replace(/^@/, '') : '';
  const sessionId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const outputDir = settings.outputDir || DEFAULT_OUTPUT_DIR;

  const mainPyPath = path.join(RECORDER_CORE_DIR, 'src', 'main.py');
  const args: string[] = [mainPyPath];

  if (targetUser) {
    args.push('-user', targetUser);
  } else if (params.url) {
    args.push('-url', params.url);
  } else if (params.roomId) {
    args.push('-room_id', params.roomId);
  } else {
    throw new Error('At least one identifier (username, url, or room_id) must be specified');
  }

  const mode = params.mode || 'manual';
  args.push('-mode', mode);

  if (mode === 'automatic' && params.interval) {
    args.push('-automatic_interval', params.interval.toString());
  }

  args.push('-output', outputDir);

  if (params.duration) {
    args.push('-duration', params.duration.toString());
  }

  const proxy = params.proxy || settings.proxy;
  if (proxy) {
    args.push('-proxy', proxy);
  }

  const bitrate = params.bitrate || settings.bitrate;
  if (bitrate) {
    args.push('-bitrate', bitrate);
  }

  if (params.telegram) {
    args.push('-telegram');
  }

  if (settings.ffmpegPath) {
    args.push('-ffmpeg-path', settings.ffmpegPath);
  }

  if (settings.noUpdateCheck) {
    args.push('-no-update-check');
  }

  const pyCmd = getPythonCommand();
  const newSession: RecordingSession = {
    id: sessionId,
    user: targetUser || params.url || params.roomId || 'unknown',
    url: params.url,
    roomId: params.roomId,
    mode,
    interval: params.interval,
    outputDir,
    duration: params.duration,
    proxy,
    bitrate,
    telegram: !!params.telegram,
    status: 'running',
    startTime: new Date().toISOString(),
    logs: [`[SYS] Initializing TikTok Live Recorder (PID pending)...`, `[CMD] ${pyCmd} ${args.join(' ')}`],
  };

  try {
    const child = spawn(pyCmd, args, {
      cwd: RECORDER_CORE_DIR,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });

    newSession.pid = child.pid;
    activeProcesses.set(sessionId, child);

    child.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      newSession.logs.push(...lines);
      if (newSession.logs.length > 500) {
        newSession.logs = newSession.logs.slice(-500);
      }
      updateSessionInStorage(newSession);
    });

    child.stderr?.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      const formatted = lines.map((l: string) => `[ERR] ${l}`);
      newSession.logs.push(...formatted);
      if (newSession.logs.length > 500) {
        newSession.logs = newSession.logs.slice(-500);
      }
      updateSessionInStorage(newSession);
    });

    child.on('close', (code) => {
      activeProcesses.delete(sessionId);
      newSession.status = code === 0 ? 'completed' : 'stopped';
      newSession.stopTime = new Date().toISOString();
      newSession.logs.push(`[SYS] Process exited with code ${code}`);
      updateSessionInStorage(newSession);
      autoRemuxUnfinishedVideos(outputDir);
    });

    child.on('error', (err) => {
      activeProcesses.delete(sessionId);
      newSession.status = 'error';
      newSession.errorMessage = err.message;
      newSession.stopTime = new Date().toISOString();
      newSession.logs.push(`[SYS ERROR] Failed to start python process: ${err.message}`);
      updateSessionInStorage(newSession);
    });

    const sessions = getSessions();
    sessions.unshift(newSession);
    saveSessions(sessions);

    return newSession;
  } catch (err: any) {
    newSession.status = 'error';
    newSession.errorMessage = err.message;
    newSession.logs.push(`[SYS FATAL] ${err.message}`);
    const sessions = getSessions();
    sessions.unshift(newSession);
    saveSessions(sessions);
    throw err;
  }
}

// Update single session status in storage
function updateSessionInStorage(session: RecordingSession) {
  const sessions = getSessions();
  const index = sessions.findIndex((s) => s.id === session.id);
  if (index !== -1) {
    sessions[index] = session;
    saveSessions(sessions);
  }
}

// Helper: check if a PID is still running on Windows
function isPidRunning(pid: number): boolean {
  try {
    execSync(`tasklist /fi "PID eq ${pid}" /nh`, { stdio: 'pipe' });
    const out = execSync(`tasklist /fi "PID eq ${pid}" /nh`).toString();
    return out.includes(String(pid));
  } catch {
    return false;
  }
}

// Stop a running recording session
// On Windows: sends a graceful signal first (CTRL_C_EVENT via taskkill without /F),
// waits up to 60 seconds for Python to finish concat+convert, then force-kills if needed.
export function stopRecording(sessionId: string): boolean {
  const child = activeProcesses.get(sessionId);
  if (!child) return false;

  const sessions = getSessions();
  const session = sessions.find((s) => s.id === sessionId);
  const outputDir = session?.outputDir || DEFAULT_OUTPUT_DIR;

  // Mark session as stopping immediately so UI updates
  if (session) {
    session.status = 'stopped';
    session.stopTime = new Date().toISOString();
    session.logs.push('[SYS] Stop requested — waiting for recording to finalize...');
    saveSessions(sessions);
  }

  activeProcesses.delete(sessionId);

  // Run the actual shutdown asynchronously so the API response is not blocked
  setImmediate(async () => {
    const pid = child.pid;
    let gracefulSuccess = false;

    try {
      if (process.platform === 'win32') {
        // Send graceful signal first (no /F flag) — Python's KeyboardInterrupt handler will run
        try {
          execSync(`taskkill /pid ${pid}`, { stdio: 'ignore' });
        } catch {
          // Process may have already exited — that's fine
        }

        // Wait up to 60 seconds for the process to exit gracefully
        const deadline = Date.now() + 60000;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 1500));
          if (!isPidRunning(pid!)) {
            gracefulSuccess = true;
            break;
          }
        }

        // If still running after 60s, force kill
        if (!gracefulSuccess && pid) {
          try {
            execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
          } catch {}
          console.warn(`[SYS] Graceful shutdown timed out for PID ${pid}. Force-killed.`);
        }
      } else {
        // Linux/macOS: SIGINT triggers Python's KeyboardInterrupt cleanly
        child.kill('SIGINT');

        const deadline = Date.now() + 60000;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 1500));
          try { process.kill(pid!, 0); } catch { gracefulSuccess = true; break; }
        }

        if (!gracefulSuccess) {
          child.kill('SIGKILL');
          console.warn(`[SYS] Graceful shutdown timed out for PID ${pid}. Force-killed.`);
        }
      }
    } catch (e) {
      console.error(`[SYS] Error during graceful shutdown of PID ${pid}:`, e);
    }

    // After process is gone, update session logs and rescue any leftover segments
    try {
      const latestSessions = getSessions();
      const latestSession = latestSessions.find((s) => s.id === sessionId);
      if (latestSession) {
        latestSession.logs.push(
          gracefulSuccess
            ? '[SYS] Recording finalized gracefully. Post-processing complete.'
            : '[SYS] Session force-terminated. Attempting segment rescue...'
        );
        saveSessions(latestSessions);
      }
    } catch {}

    // Rescue any orphaned segment files
    autoRemuxUnfinishedVideos(outputDir);
  });

  return true;
}

// Check live status of a user
export async function checkLiveStatus(target: string): Promise<LiveStatusResult> {
  const cleanTarget = target.replace(/^@/, '').trim();
  const startTime = new Date().toISOString();
  const srcDir = path.join(RECORDER_CORE_DIR, 'src').replace(/\\/g, '/');

  // Create a fast script to check user status via python core
  const scriptContent = `
import sys, os, json
src_dir = r"${srcDir}"
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)

from core.tiktok_api import TikTokAPI
from utils.utils import read_cookies

clean_target = "${cleanTarget}"

try:
    cookies = read_cookies()
    tiktok = TikTokAPI(proxy=None, cookies=cookies)
    
    if clean_target.startswith("http://") or clean_target.startswith("https://"):
        user, room_id = tiktok.get_room_and_user_from_url(clean_target)
    elif clean_target.isdigit():
        room_id = clean_target
        user = tiktok.get_user_from_room_id(room_id)
    else:
        user = clean_target
        room_id = tiktok.get_room_id_from_user(user)

    is_live = tiktok.is_room_alive(room_id) if room_id else False

    print(json.dumps({
        "success": True,
        "is_live": bool(is_live),
        "room_id": str(room_id) if room_id else None,
        "username": user
    }))
except Exception as e:
    print(json.dumps({
        "success": False,
        "error": str(e),
        "is_live": False,
        "username": clean_target
    }))
`;

  const tempScriptPath = path.join(DATA_DIR, `check_${Date.now()}.py`);
  fs.writeFileSync(tempScriptPath, scriptContent, 'utf-8');

  const pyCmd = getPythonCommand();
  return new Promise((resolve) => {
    const child = spawn(pyCmd, [tempScriptPath], {
      cwd: path.join(RECORDER_CORE_DIR, 'src'),
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));

    child.on('close', () => {
      try {
        fs.unlinkSync(tempScriptPath);
      } catch (e) {}

      try {
        // Find JSON object in stdout
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          resolve({
            username: cleanTarget,
            isLive: parsed.is_live || false,
            roomId: parsed.room_id || undefined,
            checkedAt: startTime,
            rawOutput: stdout || stderr,
          });
          return;
        }
      } catch (e) {}

      resolve({
        username: cleanTarget,
        isLive: false,
        checkedAt: startTime,
        rawOutput: stdout + '\n' + stderr,
      });
    });
  });
}

// Get list of recorded video files
// Also returns virtual entries for currently active recording sessions so the
// Video Vault shows real-time progress while a stream is being captured.
export function getRecordedVideos(): VideoFile[] {
  const settings = getSettings();
  const dir = settings.outputDir || DEFAULT_OUTPUT_DIR;

  if (!fs.existsSync(dir)) {
    return [];
  }

  const validExts = ['.mp4', '.mkv', '.flv', '.ts', '.mov', '.avi'];
  const videoFiles: VideoFile[] = [];

  try {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      // Skip temp segment files (dot-prefixed or containing _seg) and concat lists
      if (file.startsWith('.') || file.includes('_seg') || file.endsWith('_concat.txt')) {
        continue;
      }
      if (validExts.includes(ext)) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        // Try extract username tag from standard output filename format: TK_username_YYYY...
        const userTagMatch = file.match(/^TK_([a-zA-Z0-9_.-]+)_/) || file.match(/^([a-zA-Z0-9_.-]+)_/);
        const userTag = userTagMatch ? `@${userTagMatch[1]}` : 'TikTok Stream';

        videoFiles.push({
          filename: file,
          path: fullPath,
          size: stat.size,
          sizeFormatted: formatBytes(stat.size),
          createdAt: stat.mtime.toISOString(),
          userTag,
          format: ext.replace('.', '').toUpperCase(),
          url: `/api/recorder/stream?file=${encodeURIComponent(file)}`,
        });
      }
    }

    // --- Virtual entries for active recording sessions ---
    // Show each running session as a "Recording in Progress" entry in the vault
    const allSessions = getSessions();
    const runningSessions = allSessions.filter((s) => s.status === 'running');

    for (const session of runningSessions) {
      const sessionDir = session.outputDir || dir;

      // Calculate total bytes captured so far:
      // Scan ALL files in the output dir and sum up anything belonging to this session.
      let capturedBytes = 0;
      try {
        const allFiles = fs.readdirSync(sessionDir, { withFileTypes: true })
          .filter((d) => d.isFile())
          .map((d) => d.name);

        const sessionUser = session.user.toLowerCase();
        for (const f of allFiles) {
          const fLower = f.toLowerCase();
          if (
            (fLower.includes(sessionUser) || fLower.startsWith('.tk_')) &&
            (f.endsWith('.flv') || f.endsWith('_flv.mp4'))
          ) {
            try {
              capturedBytes += fs.statSync(path.join(sessionDir, f)).size;
            } catch {}
          }
        }
      } catch (e) {
        console.error('[SYS] Error scanning segment files for session', session.id, e);
      }

      const virtualFilename = `LIVE_${session.user}_recording_in_progress.mp4`;

      // Avoid adding a virtual entry if a real finished output file already exists for this session
      const alreadyHasFile = videoFiles.some(
        (v) => !v.isRecording && v.filename.toLowerCase().includes(session.user.toLowerCase())
      );
      if (!alreadyHasFile) {
        videoFiles.push({
          filename: virtualFilename,
          path: '',
          size: capturedBytes,
          sizeFormatted: capturedBytes > 0 ? `${formatBytes(capturedBytes)} captured` : 'Starting...',
          createdAt: session.startTime,
          userTag: `@${session.user}`,
          format: 'LIVE',
          url: '',
          isRecording: true,
          sessionId: session.id,
        });
      }
    }

    // --- "Processing..." entries for recently-stopped sessions ---
    // When a session ends (streamer stops or manual stop), Python still needs time to run
    // FFmpeg conversion. Bridge the gap: show a "Processing video..." card until the
    // final file appears in the vault. Only show for sessions stopped within last 10 minutes.
    const TEN_MINUTES = 10 * 60 * 1000;
    const now = Date.now();
    const recentlyStoppedSessions = allSessions.filter((s) => {
      if (s.status === 'running') return false;
      if (!s.stopTime) return false;
      return now - new Date(s.stopTime).getTime() < TEN_MINUTES;
    });

    for (const session of recentlyStoppedSessions) {
      // Only show "Processing" card if no real file exists for this user yet
      const hasFile = videoFiles.some(
        (v) => !v.isRecording && v.filename.toLowerCase().includes(session.user.toLowerCase())
      );
      if (!hasFile) {
        videoFiles.push({
          filename: `PROCESSING_${session.user}_video.mp4`,
          path: '',
          size: 0,
          sizeFormatted: 'Processing...',
          createdAt: session.stopTime!,
          userTag: `@${session.user}`,
          format: 'MP4',
          url: '',
          isRecording: true,   // Reuse isRecording flag so UI shows animated card
          sessionId: session.id,
        });
      }
    }

    // Sort by date descending — virtual entries appear first since startTime is recent
    return videoFiles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.error('Error scanning video directory:', err);
    return videoFiles;
  }
}

// Delete recorded video
export function deleteVideo(filename: string): boolean {
  const settings = getSettings();
  const safeFilename = path.basename(filename);
  const filePath = path.join(settings.outputDir || DEFAULT_OUTPUT_DIR, safeFilename);

  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch (err) {
      console.error(`Failed deleting file ${filePath}:`, err);
    }
  }
  return false;
}

// System stats aggregator
export function getSystemStats(): SystemStats {
  const settings = getSettings();
  const sessions = getSessions();
  const activeRecordings = sessions.filter((s) => s.status === 'running').length;
  const videos = getRecordedVideos();

  const totalStorageBytes = videos.reduce((acc, v) => acc + v.size, 0);

  let pythonAvailable = false;
  let ffmpegAvailable = false;

  try {
    const pyCmd = getPythonCommand();
    execSync(`${pyCmd} --version`, { stdio: 'ignore' });
    pythonAvailable = true;
  } catch (e) {}

  try {
    const ffmpegCmd = settings.ffmpegPath || 'ffmpeg';
    execSync(`"${ffmpegCmd}" -version`, { stdio: 'ignore' });
    ffmpegAvailable = true;
  } catch (e) {}

  return {
    activeRecordings,
    totalVideos: videos.length,
    totalStorageBytes,
    totalStorageFormatted: formatBytes(totalStorageBytes),
    pythonAvailable,
    ffmpegAvailable,
    outputDir: settings.outputDir || DEFAULT_OUTPUT_DIR,
  };
}
