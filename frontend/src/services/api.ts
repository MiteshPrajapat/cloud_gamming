import type { Game, GamingSession, ServerStatus, DownloadJob, DownloadCreateRequest, InstallJob, StorageInfo } from '../types';

const BASE_URL = '';

export const api = {
  async getGames(category?: string, search?: string): Promise<Game[]> {
    const params = new URLSearchParams();
    if (category && category !== 'All') params.append('category', category);
    if (search) params.append('search', search);
    
    const res = await fetch(`${BASE_URL}/api/games?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to load games library');
    return res.json();
  },

  async getCategories(): Promise<string[]> {
    const res = await fetch(`${BASE_URL}/api/games/categories`);
    if (!res.ok) return ['All', 'Action', 'Arcade', 'Platformer', 'Retro', 'Racing', 'Puzzle'];
    return res.json();
  },

  async getGame(gameId: string): Promise<Game> {
    const res = await fetch(`${BASE_URL}/api/games/${gameId}`);
    if (!res.ok) throw new Error('Failed to fetch game details');
    return res.json();
  },

  async launchGame(
    gameId: string,
    options: { resolution?: string; framerate?: number; control_profile?: string } = {}
  ): Promise<GamingSession> {
    const res = await fetch(`${BASE_URL}/api/games/${gameId}/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to launch game' }));
      throw new Error(err.detail || 'Failed to launch game session');
    }
    return res.json();
  },

  async stopSession(sessionId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/sessions/${sessionId}/stop`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to stop session');
  },

  async getSession(sessionId: string): Promise<GamingSession> {
    const res = await fetch(`${BASE_URL}/api/sessions/${sessionId}`);
    if (!res.ok) throw new Error('Failed to fetch session');
    return res.json();
  },

  async getActiveSession(): Promise<GamingSession | null> {
    try {
      const res = await fetch(`${BASE_URL}/api/sessions/active`);
      if (res.status === 404) return null;
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  async getServerStatus(): Promise<ServerStatus> {
    const res = await fetch(`${BASE_URL}/api/server/status`);
    if (!res.ok) throw new Error('Failed to fetch server metrics');
    return res.json();
  },

  async createGame(game: Partial<Game>): Promise<Game> {
    const res = await fetch(`${BASE_URL}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(game),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to create game' }));
      throw new Error(err.detail || 'Failed to create game');
    }
    return res.json();
  },

  async deleteGame(gameId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/games/${gameId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete game');
  },

  async uploadGameArchive(gameId: string, file: File): Promise<void> {
    const formData = new FormData();
    formData.append('game_id', gameId);
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}/api/games/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to upload game' }));
      throw new Error(err.detail || 'Upload failed');
    }
  },

  // --- Admin Downloader & Installer APIs ---

  async downloadGame(req: DownloadCreateRequest): Promise<DownloadJob> {
    const res = await fetch(`${BASE_URL}/api/admin/games/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to start download' }));
      throw new Error(err.detail || 'Failed to initiate download on server');
    }
    return res.json();
  },

  async getDownloads(status?: string): Promise<DownloadJob[]> {
    const url = status ? `${BASE_URL}/api/admin/games/downloads?status=${status}` : `${BASE_URL}/api/admin/games/downloads`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch downloads');
    return res.json();
  },

  async getDownload(downloadId: string): Promise<DownloadJob> {
    const res = await fetch(`${BASE_URL}/api/admin/games/download/${downloadId}`);
    if (!res.ok) throw new Error('Failed to fetch download details');
    return res.json();
  },

  async cancelDownload(downloadId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/admin/games/download/${downloadId}/cancel`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to cancel download' }));
      throw new Error(err.detail || 'Cancel failed');
    }
  },

  async deleteDownload(downloadId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/admin/games/download/${downloadId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete download record');
  },

  async installGame(
    downloadId: string,
    options?: { executable_path?: string; launch_args?: string[]; cleanup_archive?: boolean }
  ): Promise<InstallJob> {
    const res = await fetch(`${BASE_URL}/api/admin/games/install/${downloadId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to install game' }));
      throw new Error(err.detail || 'Installation failed');
    }
    return res.json();
  },

  async getInstallStatus(jobId: string): Promise<InstallJob> {
    const res = await fetch(`${BASE_URL}/api/admin/games/install/${jobId}`);
    if (!res.ok) throw new Error('Failed to fetch installation status');
    return res.json();
  },

  async getStorageInfo(): Promise<StorageInfo> {
    const res = await fetch(`${BASE_URL}/api/admin/storage`);
    if (!res.ok) throw new Error('Failed to fetch storage metrics');
    return res.json();
  },

  async detectExecutables(gameId: string, platform: string = 'linux'): Promise<{ game_id: string; candidates: string[] }> {
    const res = await fetch(`${BASE_URL}/api/admin/games/detect-executables/${gameId}?platform=${platform}`);
    if (!res.ok) throw new Error('Failed to detect executables');
    return res.json();
  }
};
