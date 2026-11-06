import React from 'react';
import { Play, Gamepad, Keyboard, Smartphone, Trash2, Sparkles, RefreshCw } from 'lucide-react';
import type { Game } from '../types';

interface GameCardProps {
  game: Game;
  onPlay: (game: Game) => void;
  onDelete?: (gameId: string) => void;
  isLoading?: boolean;
}

export const GameCard: React.FC<GameCardProps> = ({
  game,
  onPlay,
  onDelete,
  isLoading = false,
}) => {
  const isInstalling =
    game.is_installed === false ||
    game.installation_status === 'downloading' ||
    game.installation_status === 'extracting' ||
    game.status === 'downloading';

  return (
    <div className="group relative rounded-2xl bg-gaming-900 border border-slate-800 hover:border-cyan-500/50 transition-all duration-300 flex flex-col overflow-hidden hover:shadow-xl hover:shadow-cyan-500/10">
      {/* Thumbnail Banner */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-950">
        <img
          src={game.thumbnail}
          alt={game.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gaming-900 via-transparent to-black/30" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold tracking-wide bg-gaming-950/80 backdrop-blur-md border border-white/10 text-cyan-400">
            {game.category}
          </span>
          <div className="flex items-center gap-1.5">
            {isInstalling ? (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-cyan-500/90 text-slate-950 flex items-center gap-1 animate-pulse shadow">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                Installing
              </span>
            ) : (
              <>
                {game.featured && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-500/90 text-slate-950 flex items-center gap-1 shadow">
                    <Sparkles className="w-2.5 h-2.5" />
                    Featured
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase bg-slate-900/80 text-slate-300 border border-slate-700/60 backdrop-blur-md">
                  {game.game_type === 'windows' ? 'Wine (Win)' : 'Linux Native'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Floating Quick Play Overlay Button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
          {isInstalling ? (
            <button
              disabled
              className="px-5 py-2.5 rounded-xl bg-slate-800 text-cyan-300 font-bold text-xs flex items-center gap-2 border border-cyan-500/30"
            >
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              <span>INSTALLING ON EC2...</span>
            </button>
          ) : (
            <button
              onClick={() => onPlay(game)}
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/30 transform scale-95 group-hover:scale-100 transition-transform cursor-pointer"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>PLAY NOW</span>
            </button>
          )}
        </div>
      </div>

      {/* Content Info */}
      <div className="p-4 flex flex-col flex-1 justify-between">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="font-bold text-base text-white group-hover:text-cyan-300 transition-colors truncate">
              {game.name}
            </h3>
            <span className="text-[11px] font-mono text-slate-400 shrink-0">
              {game.size_mb ? `${game.size_mb} MB` : 'Cloud'}
            </span>
          </div>
          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">
            {game.description}
          </p>
        </div>

        {/* Footer Meta & Controls */}
        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
          {/* Supported Controls icons */}
          <div className="flex items-center gap-2 text-slate-400">
            <span title="Touch & Mobile Virtual Joystick">
              <Smartphone className="w-4 h-4 text-cyan-400" />
            </span>
            <span title="Gamepad Compatible">
              <Gamepad className="w-4 h-4 hover:text-slate-200" />
            </span>
            <span title="Keyboard & Mouse">
              <Keyboard className="w-4 h-4 hover:text-slate-200" />
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(game.id);
                }}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                title="Remove game"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {isInstalling ? (
              <span className="px-3 py-1.5 rounded-xl bg-slate-800 text-cyan-400 text-xs font-semibold flex items-center gap-1.5 border border-cyan-500/20">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Installing...</span>
              </span>
            ) : (
              <button
                onClick={() => onPlay(game)}
                disabled={isLoading}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-200 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Play</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
