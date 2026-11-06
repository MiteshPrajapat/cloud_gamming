import React from 'react';
import { X, Sliders, Vibrate, Move, LayoutGrid } from 'lucide-react';
import type { ControllerConfig, ControlProfile } from '../types';

interface ControllerSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  config: ControllerConfig;
  onChange: (updated: Partial<ControllerConfig>) => void;
}

export const ControllerSettings: React.FC<ControllerSettingsProps> = ({
  isOpen,
  onClose,
  config,
  onChange,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-gaming-900 border border-slate-700/80 p-5 shadow-2xl text-white">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold text-base">Controller Preferences</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4 text-sm">
          {/* Opacity */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-slate-300">Opacity</span>
              <span className="text-cyan-400 font-mono">{Math.round(config.opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="1.0"
              step="0.05"
              value={config.opacity}
              onChange={(e) => onChange({ opacity: parseFloat(e.target.value) })}
              className="w-full accent-cyan-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
          </div>

          {/* Scale */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-slate-300">Size / Scale</span>
              <span className="text-cyan-400 font-mono">{Math.round(config.scale * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.3"
              step="0.05"
              value={config.scale}
              onChange={(e) => onChange({ scale: parseFloat(e.target.value) })}
              className="w-full accent-cyan-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
          </div>

          {/* Left Control Mode */}
          <div>
            <label className="text-slate-300 mb-1 flex items-center gap-1.5">
              <Move className="w-4 h-4 text-slate-400" />
              Directional Control
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['joystick', 'dpad', 'both'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onChange({ dpadMode: mode })}
                  className={`py-1.5 px-2 rounded-lg border text-xs capitalize ${
                    config.dpadMode === mode
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-medium'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Control Profile */}
          <div>
            <label className="text-slate-300 mb-1 flex items-center gap-1.5">
              <LayoutGrid className="w-4 h-4 text-slate-400" />
              Control Mapping Profile
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['wasd', 'arrows', 'action'] as ControlProfile[]).map((prof) => (
                <button
                  key={prof}
                  onClick={() => onChange({ profile: prof })}
                  className={`py-1.5 px-2 rounded-lg border text-xs uppercase ${
                    config.profile === prof
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-medium'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400'
                  }`}
                >
                  {prof}
                </button>
              ))}
            </div>
          </div>

          {/* Haptics */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-slate-300 flex items-center gap-2">
              <Vibrate className="w-4 h-4 text-slate-400" />
              Vibration Haptics
            </span>
            <button
              onClick={() => onChange({ haptics: !config.haptics })}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                config.haptics ? 'bg-cyan-500 justify-end' : 'bg-slate-700 justify-start'
              }`}
            >
              <div className="bg-white w-4 h-4 rounded-full shadow-md" />
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-2 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition-colors"
        >
          Save & Return
        </button>
      </div>
    </div>
  );
};
