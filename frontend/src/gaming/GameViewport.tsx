import React, { useState, useEffect, useRef } from 'react';
import {
  Wifi,
  Clock,
  Gauge,
  Maximize,
  Minimize,
  LogOut,
  Gamepad2
} from 'lucide-react';
import type { GamingSession, Game } from '../types';
import { useInputForwarder } from '../hooks/useInputForwarder';
import { useDeviceDetect } from '../hooks/useDeviceDetect';
import { MobileController } from './MobileController';

interface GameViewportProps {
  session: GamingSession;
  game: Game;
  onExit: () => void;
}

export const GameViewport: React.FC<GameViewportProps> = ({ session, game, onExit }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDesktopVirtualController, setShowDesktopVirtualController] = useState(false);
  const [duration, setDuration] = useState(0);

  const { isMobile, isTablet, isTouchDevice } = useDeviceDetect();
  const showMobileControls = isMobile || isTablet || showDesktopVirtualController;

  const {
    isConnected,
    latencyMs,
    sendKeyDown,
    sendKeyUp,
    sendGamepadButton,
    sendJoystickDirection,
    sendDPad,
    sendMouseMove,
    sendMouseDown,
    sendMouseUp,
    sendMouseScroll,
    setControlProfile,
    resetKeys,
  } = useInputForwarder({ sessionId: session.session_id, enabled: true });

  // Session duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Fullscreen handler
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Desktop Keyboard Event Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent browser default actions for gaming keys (Arrows, Space, Tab)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab'].includes(e.key)) {
        e.preventDefault();
      }
      sendKeyDown(e.key);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      sendKeyUp(e.key);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      resetKeys();
    };
  }, [sendKeyDown, sendKeyUp, resetKeys]);

  // Desktop Mouse Event Forwarding
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isTouchDevice) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const normX = (e.clientX - rect.left) / rect.width;
    const normY = (e.clientY - rect.top) / rect.height;
    sendMouseMove(normX, normY);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isTouchDevice) return;
    const btnMap: Record<number, 'left' | 'middle' | 'right'> = {
      0: 'left',
      1: 'middle',
      2: 'right',
    };
    sendMouseDown(btnMap[e.button] || 'left');
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isTouchDevice) return;
    const btnMap: Record<number, 'left' | 'middle' | 'right'> = {
      0: 'left',
      1: 'middle',
      2: 'right',
    };
    sendMouseUp(btnMap[e.button] || 'left');
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (isTouchDevice) return;
    sendMouseScroll(e.deltaY);
  };

  // Prevent right-click context menu inside the game viewport
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  // Latency color
  const getLatencyColor = (ms: number | null) => {
    if (ms === null) return 'text-slate-400';
    if (ms < 40) return 'text-emerald-400';
    if (ms < 90) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen bg-black overflow-hidden flex flex-col items-center justify-center select-none gameplay-active"
      onContextMenu={handleContextMenu}
    >
      {/* Top HUD Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2.5 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-auto">
        {/* Game Title & Status Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <h1 className="font-semibold text-sm text-white tracking-wide truncate max-w-[140px] sm:max-w-xs">
              {game.name}
            </h1>
          </div>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-800/50">
            AWS EC2 C7i
          </span>
        </div>

        {/* Performance & Latency Telemetry */}
        <div className="flex items-center gap-4 text-xs font-mono">
          {/* Latency */}
          <div className="flex items-center gap-1.5" title="Network Ping">
            <Wifi className={`w-3.5 h-3.5 ${getLatencyColor(latencyMs)}`} />
            <span className={getLatencyColor(latencyMs)}>
              {latencyMs !== null ? `${latencyMs}ms` : '-- ms'}
            </span>
          </div>

          {/* Framerate */}
          <div className="hidden md:flex items-center gap-1 text-slate-300" title="Target FPS">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span>{session.framerate} FPS</span>
          </div>

          {/* Session Duration */}
          <div className="flex items-center gap-1 text-slate-300" title="Session Duration">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatDuration(duration)}</span>
          </div>

          {/* Toggle On-screen controller on Desktop */}
          {!isMobile && (
            <button
              onClick={() => setShowDesktopVirtualController((prev) => !prev)}
              className={`p-1.5 rounded-md border text-xs transition-colors ${
                showDesktopVirtualController
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                  : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title="Toggle On-screen Virtual Controller"
            >
              <Gamepad2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-md bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white"
            title="Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </button>

          {/* Exit Session Button */}
          <button
            onClick={onExit}
            className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-sans font-semibold flex items-center gap-1 shadow-sm transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit</span>
          </button>
        </div>
      </div>

      {/* Central Game Streaming Viewport */}
      <div
        className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        {/*
          Streaming Canvas / Frame:
          Connects to noVNC Websockify proxy at session.stream_url.
          Renders scaled desktop display (1280x720) optimized for CPU LLVMpipe rendering.
        */}
        <iframe
          ref={iframeRef}
          src={session.stream_url}
          title={game.name}
          className="w-full h-full border-0 pointer-events-auto"
          style={{
            maxWidth: '100vw',
            maxHeight: '100vh',
            objectFit: 'contain',
          }}
          allow="autoplay; fullscreen"
        />

        {/* Fallback Simulation Notice if stream is waiting or in dev mode */}
        {!isConnected && (
          <div className="absolute bottom-6 left-6 z-10 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-xs text-slate-300 flex items-center gap-2 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Connecting to cloud game stream...
          </div>
        )}
      </div>

      {/* Mobile Virtual Gaming Touch Controller Overlay */}
      {showMobileControls && (
        <MobileController
          onJoystickMove={sendJoystickDirection}
          onDPadAction={sendDPad}
          onButtonAction={sendGamepadButton}
          onProfileChange={setControlProfile}
          onExitGame={onExit}
          recommendedOrientation={game.recommended_orientation}
          defaultProfile={game.default_profile}
        />
      )}
    </div>
  );
};
