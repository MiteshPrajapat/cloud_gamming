import React, { useState, useMemo } from 'react';
import { Search, Sparkles, Play, Server, Cpu, HardDrive } from 'lucide-react';
import type { Game } from '../types';
import { GameCard } from '../components/GameCard';

interface DashboardPageProps {
  games: Game[];
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onPlayGame: (game: Game) => void;
  onDeleteGame?: (gameId: string) => void;
  launchingGameId: string | null;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  games,
  categories,
  selectedCategory,
  onSelectCategory,
  onPlayGame,
  onDeleteGame,
  launchingGameId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Featured game for the hero banner
  const featuredGame = useMemo(() => {
    return games.find((g) => g.featured) || games[0] || null;
  }, [games]);

  // Filtered games
  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const matchesSearch =
        game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        game.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat =
        selectedCategory === 'All' || game.category.toLowerCase() === selectedCategory.toLowerCase();
      return matchesSearch && matchesCat;
    });
  }, [games, searchQuery, selectedCategory]);

  return (
    <div className="min-h-screen bg-gaming-950 text-slate-100 pb-16">
      {/* Hero Featured Game Banner */}
      {featuredGame && (
        <section className="relative w-full h-[380px] sm:h-[450px] overflow-hidden">
          {/* Background image & gradient blends */}
          <div className="absolute inset-0">
            <img
              src={featuredGame.thumbnail}
              alt={featuredGame.name}
              className="w-full h-full object-cover object-center filter brightness-50"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gaming-950 via-gaming-950/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-gaming-950 via-gaming-950/80 to-transparent" />
          </div>

          {/* Hero Content */}
          <div className="relative max-w-7xl mx-auto h-full px-4 lg:px-8 flex flex-col justify-end pb-10">
            <div className="max-w-xl space-y-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 flex items-center gap-1.5 shadow-sm">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Featured Cloud Title
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-900/80 text-slate-300 border border-slate-700">
                  {featuredGame.category}
                </span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white drop-shadow-md">
                {featuredGame.name}
              </h1>

              <p className="text-sm sm:text-base text-slate-300 line-clamp-2 leading-relaxed drop-shadow">
                {featuredGame.description}
              </p>

              <div className="pt-2 flex items-center gap-4">
                <button
                  onClick={() => onPlayGame(featuredGame)}
                  disabled={launchingGameId === featuredGame.id}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-xl shadow-cyan-500/25 transition-all transform hover:-translate-y-0.5"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>
                    {launchingGameId === featuredGame.id ? 'Starting Session...' : 'Instant Play'}
                  </span>
                </button>
                <span className="text-xs font-mono text-slate-400">
                  {featuredGame.size_mb} MB • No Local Install
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main Library Section */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 mt-6">
        {/* Search & Genre Tabs Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          {/* Categories */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => onSelectCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                    : 'bg-gaming-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-gaming-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        {/* Games Grid */}
        {filteredGames.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 mt-6">
            {filteredGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                onPlay={onPlayGame}
                onDelete={onDeleteGame}
                isLoading={launchingGameId === game.id}
              />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center">
            <p className="text-slate-400 text-sm">No games matched your search criteria.</p>
          </div>
        )}

        {/* AWS EC2 Infrastructure Footer Spec */}
        <div className="mt-16 p-6 rounded-2xl bg-gaming-900/60 border border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-cyan-950/60 border border-cyan-800/60 text-cyan-400">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">AWS EC2 C7i Infrastructure</h3>
              <p className="text-xs text-slate-400">
                Optimized for 4 vCPU / 8 GB RAM with LLVMpipe CPU Software Rendering
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-400 font-mono">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>4 vCPU (Intel Xeon 4th Gen)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-purple-400" />
              <span>8 GB DDR5 Memory</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
