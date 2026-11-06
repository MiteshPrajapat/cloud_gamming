import type { Game, GamingSession, ServerStatus } from '../types';

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
    if (!res.ok) throw new Error('Failed to upload archive');
  }
};
