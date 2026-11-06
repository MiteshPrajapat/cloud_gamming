import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Maximize, Minimize, Settings, LogOut, RotateCw } from 'lucide-react';
import { VirtualJoystick } from './VirtualJoystick';
import { DPad } from './DPad';
import { ActionButtons } from './ActionButtons';
import { ControllerSettings } from './ControllerSettings';
import type { ControllerConfig, ControlProfile, Orientation } from '../types';

interface MobileControllerProps {
  onJoystickMove: (direction: string) => void;
  onDPadAction: (direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT', state: 'down' | 'up') => void;
  onButtonAction: (button: string, state: 'down' | 'up') => void;
  onProfileChange: (profile: ControlProfile) => void;
  onExitGame: () => void;
  recommendedOrientation?: Orientation;
  defaultProfile?: ControlProfile;
}

const DEFAULT_CONFIG: ControllerConfig = {
  opacity: 0.75,
  scale: 1.0,
  haptics: true,
  dpadMode: 'both',
  swapSides: false,
  profile: 'wasd',
};

export const MobileController: React.FC<MobileControllerProps> = ({
  onJoystickMove,
  onDPadAction,
  onButtonAction,
  onProfileChange,
  onExitGame,
  recommendedOrientation = 'landscape',
  defaultProfile = 'wasd',
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [dismissRotatePrompt, setDismissRotatePrompt] = useState(false);

  const [config, setConfig] = useState<ControllerConfig>(() => {
    try {
      const saved = localStorage.getItem('cloudgaming_controller_config');
      if (saved) return { ...DEFAULT_CONFIG, ...JSON.parse(saved), profile: defaultProfile };
    } catch {
      // fallback
    }
    return { ...DEFAULT_CONFIG, profile: defaultProfile };
  });

  // Track orientation
  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const handleUpdateConfig = (updated: Partial<ControllerConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updated };
      try {
        localStorage.setItem('cloudgaming_controller_config', JSON.stringify(next));
      } catch {
        // ignore
      }
      if (updated.profile && updated.profile !== prev.profile) {
        onProfileChange(updated.profile);
      }
      return next;
    });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const showOrientationWarning =
    recommendedOrientation === 'landscape' && isPortrait && !dismissRotatePrompt;

  return (
    <>
      {/* Floating Toggle Pill when controller is hidden */}
      {!isVisible && (
        <button
          onClick={() => setIsVisible(true)}
          className="fixed bottom-4 right-4 z-40 p-3 rounded-full bg-cyan-500/80 text-slate-950 shadow-xl backdrop-blur-md flex items-center gap-1.5 text-xs font-semibold"
        >
          <Eye className="w-5 h-5" />
          Show Controls
        </button>
      )}

      {/* Landscape Orientation Recommendation Banner */}
      {showOrientationWarning && (
        <div
          onClick={() => setDismissRotatePrompt(true)}
          className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-amber-500/90 text-slate-950 font-medium text-xs flex items-center gap-2 shadow-lg backdrop-blur-md cursor-pointer animate-pulse"
        >
          <RotateCw className="w-4 h-4 animate-spin" />
          <span>Rotate device to landscape for full screen gaming</span>
          <span className="opacity-70 text-[10px] ml-1">(Tap to dismiss)</span>
        </div>
      )}

      {/* Controller Overlay */}
      {isVisible && (
        <div
          style={{ opacity: config.opacity, touchAction: 'none' }}
          className="fixed inset-0 pointer-events-none z-30 flex flex-col justify-between p-3 select-none"
        >
          {/* Top Control Bar */}
          <div className="flex items-center justify-between w-full pointer-events-auto">
            {/* System / Game actions */}
            <div className="flex items-center gap-2">
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  onButtonAction('SELECT', 'down');
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  onButtonAction('SELECT', 'up');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-white/20 text-xs font-medium text-slate-300 active:bg-cyan-500/60 active:border-cyan-400 active:text-white backdrop-blur-md shadow touch-none"
              >
                SELECT
              </button>
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  onButtonAction('START', 'down');
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  onButtonAction('START', 'up');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-white/20 text-xs font-medium text-slate-300 active:bg-cyan-500/60 active:border-cyan-400 active:text-white backdrop-blur-md shadow touch-none"
              >
                START
              </button>
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  onButtonAction('PAUSE', 'down');
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  onButtonAction('PAUSE', 'up');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-white/20 text-xs font-medium text-slate-300 active:bg-cyan-500/60 active:border-cyan-400 active:text-white backdrop-blur-md shadow touch-none"
              >
                PAUSE
              </button>
            </div>

            {/* Quick Utility Tools */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsVisible(false)}
                className="p-2 rounded-lg bg-slate-900/80 border border-white/20 text-slate-300 hover:text-white active:bg-slate-800 backdrop-blur-md shadow"
                title="Hide Controls"
              >
                <EyeOff className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-lg bg-slate-900/80 border border-white/20 text-slate-300 hover:text-white active:bg-slate-800 backdrop-blur-md shadow"
                title="Controller Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-lg bg-slate-900/80 border border-white/20 text-slate-300 hover:text-white active:bg-slate-800 backdrop-blur-md shadow"
                title="Fullscreen"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
              <button
                onClick={onExitGame}
                className="px-2.5 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 border border-rose-500/50 text-white font-medium text-xs flex items-center gap-1 backdrop-blur-md shadow"
                title="Exit Game"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Exit</span>
              </button>
            </div>
          </div>

          {/* Bottom Controls Area (Left: DPad / Joystick, Right: Actions) */}
          <div className="flex items-end justify-between w-full pb-2 px-1 pointer-events-auto">
            {/* Left Control (Joystick and/or DPad) */}
            <div className="flex items-center gap-3">
              {(config.dpadMode === 'joystick' || config.dpadMode === 'both') && (
                <VirtualJoystick
                  onDirectionChange={onJoystickMove}
                  scale={config.scale}
                  haptics={config.haptics}
                />
              )}
              {(config.dpadMode === 'dpad' || config.dpadMode === 'both') && (
                <DPad
                  onDirection={onDPadAction}
                  scale={config.scale}
                  haptics={config.haptics}
                />
              )}
            </div>

            {/* Right Control (Action Buttons: A, B, X, Y, L1, R1) */}
            <ActionButtons
              onButtonAction={onButtonAction}
              scale={config.scale}
              haptics={config.haptics}
            />
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <ControllerSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        config={config}
        onChange={handleUpdateConfig}
      />
    </>
  );
};
