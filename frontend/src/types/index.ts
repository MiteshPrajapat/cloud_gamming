export type GameType = 'linux' | 'windows' | 'browser' | 'retro';
export type ControlProfile = 'wasd' | 'arrows' | 'action' | 'mouse' | 'custom';
export type Orientation = 'landscape' | 'portrait' | 'any';

export interface Game {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  category: string;
  game_type: GameType;
  platform?: string;
  archive_type?: string;
  executable_path: string;
  installed_path?: string;
  download_url?: string;
  launch_args: string[];
  size_mb: number;
  game_size?: number;
  supported_controls: string[];
  recommended_orientation: Orientation;
  default_profile: ControlProfile;
  is_installed: boolean;
  installation_status?: string;
  download_status?: string;
  status: string;
  featured: boolean;
  created_at?: string;
  updated_at?: string;
}

export type DownloadState = 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled';

export interface DownloadCreateRequest {
  name: string;
  download_url: string;
  description?: string;
  thumbnail?: string;
  platform: 'linux' | 'windows' | 'html5';
  category: string;
  archive_type?: string;
  executable_path?: string;
  launch_args?: string[];
  supported_controls?: string[];
  checksum?: string;
  checksum_type?: 'sha256' | 'md5';
  auto_install?: boolean;
}

export interface DownloadJob {
  id: string;
  game_id: string;
  game_name: string;
  source_url: string;
  destination_path: string;
  status: DownloadState;
  progress: number;
  downloaded_bytes: number;
  total_bytes?: number;
  downloaded_mb: number;
  total_mb?: number;
  download_speed_mbps: number;
  eta_seconds?: number;
  checksum?: string;
  checksum_type?: string;
  platform: string;
  archive_type?: string;
  auto_install: boolean;
  executable_path?: string;
  launch_args: string[];
  error_message?: string;
  created_at: string;
  updated_at?: string;
}

export type InstallState = 'pending' | 'extracting' | 'configuring' | 'installed' | 'failed';

export interface InstallJob {
  id: string;
  game_id: string;
  game_name: string;
  download_id: string;
  status: InstallState;
  installation_path: string;
  executable_path?: string;
  detected_executables: string[];
  platform: string;
  launch_args: string[];
  error_message?: string;
  created_at: string;
  updated_at?: string;
}

export interface StorageInfo {
  total_gb: number;
  used_gb: number;
  free_gb: number;
  percent_used: number;
  buffer_gb: number;
  is_low_space: boolean;
  storage_path?: string;
}

export interface GamingSession {
  session_id: string;
  game_id: string;
  game_name: string;
  status: 'initializing' | 'running' | 'stopping' | 'terminated' | 'failed';
  created_at: string;
  started_at?: string;
  stream_url: string;
  ws_url: string;
  resolution: string;
  framerate: number;
  cpu_usage_percent: number;
  ram_usage_mb: number;
  duration_seconds: number;
  error_message?: string;
}

export interface ServerStatus {
  status: 'healthy' | 'degraded';
  cpu: {
    percent: number;
    cores: number;
    load_avg: number[];
    model: string;
  };
  ram: {
    total_gb: number;
    used_gb: number;
    available_gb: number;
    percent: number;
  };
  disk: {
    total_gb: number;
    used_gb: number;
    free_gb: number;
    percent: number;
  };
  cloud: {
    provider: string;
    instance: string;
    rendering_mode: string;
    gpu: string;
  };
  active_sessions: number;
}

export interface ControllerConfig {
  opacity: number; // 0.2 to 1.0
  scale: number; // 0.8 to 1.3
  haptics: boolean;
  dpadMode: 'joystick' | 'dpad' | 'both';
  swapSides: boolean;
  profile: ControlProfile;
}
