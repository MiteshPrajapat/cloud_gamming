import { useState, useEffect } from 'react';
import type { Game, GamingSession, ServerStatus } from './types';
import { api } from './services/api';
import { Navbar } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { GameViewport } from './gaming/GameViewport';
import { AdminGameModal } from './components/AdminGameModal';
import { AlertCircle, RefreshCw } from 'lucide-react';

export function App() {
  const [games, setGames] = useState<Game[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);

  const [activeSession, setActiveSession] = useState<GamingSession | null>(null);
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [launchingGameId, setLaunchingGameId] = useState<string | null>(null);

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial games and server status
  const loadData = async () => {
    try {
      setIsLoading(true);
      const [gamesData, catsData, statusData, runningSession] = await Promise.all([
        api.getGames(),
        api.getCategories(),
        api.getServerStatus().catch(() => null),
        api.getActiveSession().catch(() => null),
      ]);

      setGames(gamesData);
      setCategories(catsData);
      if (statusData) setServerStatus(statusData);

      if (runningSession && runningSession.status === 'running') {
        const found = gamesData.find((g) => g.id === runningSession.game_id);
        if (found) {
          setActiveSession(runningSession);
          setActiveGame(found);
        }
      }
    } catch (err: any) {
      console.error('Failed to load cloud gaming data:', err);
      setErrorMessage('Could not connect to the cloud gaming backend. Ensure the server is running.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Poll server metrics & active game updates
    const interval = setInterval(async () => {
      try {
        const [status, gamesList] = await Promise.all([
          api.getServerStatus().catch(() => null),
          api.getGames().catch(() => null),
        ]);
        if (status) setServerStatus(status);
        if (gamesList) setGames(gamesList);
      } catch {
        // ignore background poll errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Launch a game session
  const handlePlayGame = async (game: Game) => {
    setErrorMessage(null);
    setLaunchingGameId(game.id);

    try {
      const session = await api.launchGame(game.id, {
        resolution: '1280x720',
        framerate: 30,
        control_profile: game.default_profile,
      });

      setActiveGame(game);
      setActiveSession(session);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start game session on AWS EC2');
    } finally {
      setLaunchingGameId(null);
    }
  };

  // Exit game session
  const handleExitSession = async () => {
    if (!activeSession) return;
    try {
      await api.stopSession(activeSession.session_id);
    } catch (err) {
      console.error('Error stopping session:', err);
    } finally {
      setActiveSession(null);
      setActiveGame(null);
      // Refresh status after stopping
      try {
        const status = await api.getServerStatus();
        setServerStatus(status);
      } catch {}
    }
  };

  // Handle game added via Admin
  const handleGameAdded = (newGame: Game) => {
    setGames((prev) => [newGame, ...prev]);
    if (!categories.includes(newGame.category)) {
      setCategories((prev) => [...prev, newGame.category]);
    }
  };

  // Handle game deleted
  const handleDeleteGame = async (gameId: string) => {
    if (!window.confirm('Are you sure you want to delete this game?')) return;
    try {
      await api.deleteGame(gameId);
      setGames((prev) => prev.filter((g) => g.id !== gameId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete game');
    }
  };

  // If in active gameplay mode
  if (activeSession && activeGame) {
    return (
      <GameViewport
        session={activeSession}
        game={activeGame}
        onExit={handleExitSession}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gaming-950 font-sans selection:bg-cyan-500 selection:text-black">
      {/* Navbar */}
      <Navbar
        serverStatus={serverStatus}
        onOpenAdmin={() => setIsAdminOpen(true)}
        activeSessionGameName={activeSession ? activeGame?.name : null}
        onResumeSession={() => {
          // already set
        }}
      />

      {/* Global Error Alert Banner */}
      {errorMessage && (
        <div className="max-w-7xl mx-auto px-4 lg:px-8 mt-4">
          <div className="p-4 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-slate-400 hover:text-white font-bold ml-4"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="py-32 flex flex-col items-center justify-center text-slate-400 space-y-3">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-sm">Connecting to AWS EC2 Cloud Gaming Platform...</p>
        </div>
      ) : (
        <DashboardPage
          games={games}
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onPlayGame={handlePlayGame}
          onDeleteGame={handleDeleteGame}
          launchingGameId={launchingGameId}
        />
      )}

      {/* Admin Game Management Modal */}
      <AdminGameModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        onGameAdded={handleGameAdded}
        onPlayGame={handlePlayGame}
      />
    </div>
  );
}

export default App;
