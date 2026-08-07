export interface RecordingSession {
  id: string;
  user: string;
  url?: string;
  roomId?: string;
  mode: 'manual' | 'automatic' | 'followers';
  interval?: number;
  outputDir: string;
  duration?: number;
  proxy?: string;
  bitrate?: string;
  telegram: boolean;
  pid?: number;
  status: 'running' | 'stopped' | 'completed' | 'error';
  startTime: string;
  stopTime?: string;
  logs: string[];
  errorMessage?: string;
  recordedFile?: string;
}

export interface VideoFile {
  filename: string;
  path: string;
  size: number;
  sizeFormatted: string;
  createdAt: string;
  userTag: string;
  format: string;
  url: string;
  isRecording?: boolean; // true = virtual entry for in-progress recording
  sessionId?: string;    // session ID for in-progress entries
}

export interface EngineSettings {
  outputDir: string;
  ffmpegPath: string;
  proxy: string;
  bitrate: string;
  noUpdateCheck: boolean;
  cookiesJson: string;
  telegramJson: string;
}

export interface LiveStatusResult {
  username: string;
  isLive: boolean;
  roomTitle?: string;
  roomId?: string;
  viewerCount?: number;
  userAvatar?: string;
  displayName?: string;
  checkedAt: string;
  rawOutput?: string;
}

export interface SystemStats {
  activeRecordings: number;
  totalVideos: number;
  totalStorageBytes: number;
  totalStorageFormatted: string;
  pythonAvailable: boolean;
  ffmpegAvailable: boolean;
  outputDir: string;
}
