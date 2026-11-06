import React, { useState, useCallback } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface DPadProps {
  onDirection: (direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT', state: 'down' | 'up') => void;
  scale?: number;
  haptics?: boolean;
}

export const DPad: React.FC<DPadProps> = ({ onDirection, scale = 1.0, haptics = true }) => {
  const [activeDirections, setActiveDirections] = useState<Record<string, boolean>>({});

  const triggerHaptic = useCallback(() => {
    if (haptics && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(12);
      } catch {
        // ignore
      }
    }
  }, [haptics]);

  const handlePointerDown = (dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setActiveDirections((prev) => ({ ...prev, [dir]: true }));
    triggerHaptic();
    onDirection(dir, 'down');
  };

  const handlePointerUp = (dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if ((e.target as HTMLElement).hasPointerCapture?.(e.pointerId)) {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    }
    setActiveDirections((prev) => ({ ...prev, [dir]: false }));
    onDirection(dir, 'up');
  };

  const btnBaseClass =
    'absolute flex items-center justify-center bg-slate-900/70 border border-white/20 active:bg-cyan-500/50 active:border-cyan-400 select-none shadow-md backdrop-blur-md transition-all touch-none';

  const w = 46 * scale;
  const h = 46 * scale;
  const total = 140 * scale;

  return (
    <div
      style={{ width: `${total}px`, height: `${total}px`, touchAction: 'none' }}
      className="relative flex items-center justify-center select-none"
    >
      {/* Center cross hub */}
      <div
        style={{ width: `${w}px`, height: `${h}px` }}
        className="bg-slate-950/80 border border-white/10 rounded-sm pointer-events-none"
      />

      {/* Up Button */}
      <button
        style={{
          width: `${w}px`,
          height: `${h}px`,
          top: 0,
          left: `calc(50% - ${w / 2}px)`,
        }}
        onPointerDown={(e) => handlePointerDown('UP', e)}
        onPointerUp={(e) => handlePointerUp('UP', e)}
        onPointerCancel={(e) => handlePointerUp('UP', e)}
        className={`${btnBaseClass} rounded-t-xl ${
          activeDirections['UP'] ? 'bg-cyan-500/60 border-cyan-400 scale-95' : ''
        }`}
      >
        <ChevronUp className="w-6 h-6 text-slate-200" />
      </button>

      {/* Down Button */}
      <button
        style={{
          width: `${w}px`,
          height: `${h}px`,
          bottom: 0,
          left: `calc(50% - ${w / 2}px)`,
        }}
        onPointerDown={(e) => handlePointerDown('DOWN', e)}
        onPointerUp={(e) => handlePointerUp('DOWN', e)}
        onPointerCancel={(e) => handlePointerUp('DOWN', e)}
        className={`${btnBaseClass} rounded-b-xl ${
          activeDirections['DOWN'] ? 'bg-cyan-500/60 border-cyan-400 scale-95' : ''
        }`}
      >
        <ChevronDown className="w-6 h-6 text-slate-200" />
      </button>

      {/* Left Button */}
      <button
        style={{
          width: `${w}px`,
          height: `${h}px`,
          left: 0,
          top: `calc(50% - ${h / 2}px)`,
        }}
        onPointerDown={(e) => handlePointerDown('LEFT', e)}
        onPointerUp={(e) => handlePointerUp('LEFT', e)}
        onPointerCancel={(e) => handlePointerUp('LEFT', e)}
        className={`${btnBaseClass} rounded-l-xl ${
          activeDirections['LEFT'] ? 'bg-cyan-500/60 border-cyan-400 scale-95' : ''
        }`}
      >
        <ChevronLeft className="w-6 h-6 text-slate-200" />
      </button>

      {/* Right Button */}
      <button
        style={{
          width: `${w}px`,
          height: `${h}px`,
          right: 0,
          top: `calc(50% - ${h / 2}px)`,
        }}
        onPointerDown={(e) => handlePointerDown('RIGHT', e)}
        onPointerUp={(e) => handlePointerUp('RIGHT', e)}
        onPointerCancel={(e) => handlePointerUp('RIGHT', e)}
        className={`${btnBaseClass} rounded-r-xl ${
          activeDirections['RIGHT'] ? 'bg-cyan-500/60 border-cyan-400 scale-95' : ''
        }`}
      >
        <ChevronRight className="w-6 h-6 text-slate-200" />
      </button>
    </div>
  );
};
