import React from 'react';
import { Gamepad2, Cpu, HardDrive, Plus } from 'lucide-react';
import type { ServerStatus } from '../types';

interface NavbarProps {
  serverStatus: ServerStatus | null;
  onOpenAdmin: () => void;
  activeSessionGameName?: string | null;
  onResumeSession?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  serverStatus,
  onOpenAdmin,
  activeSessionGameName,
  onResumeSession,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-gaming-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-purple-600 p-[1.5px] shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-gaming-950 rounded-[10px] flex items-center justify-center">
              <Gamepad2 className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-cyan-400">
                CLOUDPLAY
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-semibold">
                AWS C7i
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Headless Cloud Gaming Infrastructure
            </p>
          </div>
        </div>

        {/* Server Health Telemetry (AWS C7i Large 4 vCPU / 8 GB RAM) */}
        <div className="flex items-center gap-2 sm:gap-4">
          {serverStatus && (
            <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-mono">
              {/* CPU load */}
              <div className="flex items-center gap-1.5" title="CPU Usage (4 vCPU)">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-300">
                  CPU: <span className="text-white font-bold">{serverStatus.cpu.percent}%</span>
                </span>
              </div>

              <div className="w-[1px] h-3 bg-slate-700" />

              {/* RAM */}
              <div className="flex items-center gap-1.5" title="RAM Usage (8 GB)">
                <HardDrive className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-slate-300">
                  RAM: <span className="text-white font-bold">{serverStatus.ram.percent}%</span>
                </span>
              </div>

              <div className="w-[1px] h-3 bg-slate-700" />

              {/* Health indicator */}
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 text-[11px] uppercase">Online</span>
              </div>
            </div>
          )}

          {/* Active Session Indicator */}
          {activeSessionGameName && onResumeSession && (
            <button
              onClick={onResumeSession}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 animate-pulse"
            >
              <span className="w-2 h-2 rounded-full bg-slate-950" />
              <span>Resume: {activeSessionGameName}</span>
            </button>
          )}

          {/* Add Game Admin Button */}
          <button
            onClick={onOpenAdmin}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Add Game</span>
          </button>
        </div>
      </div>
    </header>
  );
};
