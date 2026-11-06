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
  executable_path: string;
  launch_args: string[];
  size_mb: number;
  supported_controls: string[];
  recommended_orientation: Orientation;
  default_profile: ControlProfile;
  is_installed: boolean;
  status: string;
  featured: boolean;
  created_at?: string;
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
