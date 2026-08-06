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
  try {
    execSync('python3 --version', { stdio: 'ignore' });
    return 'python3';
  } catch (e) {
    try {
      execSync('python --version', { stdio: 'ignore' });
      return 'python';
    } catch (err) {
      return 'python3';
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
export function autoRemuxUnfinishedVideos(outputDir: string) {
  if (!fs.existsSync(outputDir)) return;
  // Do NOT perform background remuxing if any recording session is active
  if (activeProcesses.size > 0) return;
  const settings = getSettings();
  const ffmpegCmd = settings.ffmpegPath || 'ffmpeg';

  try {
    const files = fs.readdirSync(outputDir);
    const now = Date.now();

    for (const file of files) {
      if (file.endsWith('_flv.mp4')) {
        const fullFlvPath = path.join(outputDir, file);

        try {
          const stat = fs.statSync(fullFlvPath);
          // CRITICAL FIX: Skip files modified within the last 2 minutes (active or recently ended recording sessions)
          if (now - stat.mtimeMs < 120000) {
            continue;
          }

          const targetMp4Name = file.replace(/_flv\.mp4$/, '.mp4');
          const targetMp4Path = path.join(outputDir, targetMp4Name);

          execSync(`"${ffmpegCmd}" -y -i "${fullFlvPath}" -c copy "${targetMp4Path}"`, { stdio: 'ignore' });
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
      // Sync status with active processes
      return sessions.map((s) => {
        if (s.status === 'running' && !activeProcesses.has(s.id)) {
          return { ...s, status: 'stopped', stopTime: s.stopTime || new Date().toISOString() };
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

  const args: string[] = ['src/main.py'];

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

// Stop a running recording session
export function stopRecording(sessionId: string): boolean {
  const child = activeProcesses.get(sessionId);
  if (child) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${child.pid} /T /F`);
      } else {
        child.kill('SIGTERM');
      }
    } catch (e) {
      console.error(`Error killing process ${child.pid}:`, e);
    }
    activeProcesses.delete(sessionId);

    const sessions = getSessions();
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      session.status = 'stopped';
      session.stopTime = new Date().toISOString();
      session.logs.push('[SYS] Session forcefully stopped by user.');
      saveSessions(sessions);
      if (session.outputDir) {
        autoRemuxUnfinishedVideos(session.outputDir);
      }
    }
    return true;
  }
  return false;
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
export function getRecordedVideos(): VideoFile[] {
  const settings = getSettings();
  const dir = settings.outputDir || DEFAULT_OUTPUT_DIR;

  if (!fs.existsSync(dir)) {
    return [];
  }

  const validExts = ['.mp4', '.mkv', '.flv', '.ts', '.mov', '.avi'];
  try {
    const files = fs.readdirSync(dir);
    const videoFiles: VideoFile[] = [];

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (validExts.includes(ext)) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        // Try extract username tag from standard output filename format: username_YYYY-MM-DD...
        const userTagMatch = file.match(/^([a-zA-Z0-9_.-]+)_/);
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

    // Sort by modified date descending
    return videoFiles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.error('Error scanning video directory:', err);
    return [];
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
