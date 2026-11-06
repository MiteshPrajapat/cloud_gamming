import React, { useState, useCallback } from 'react';

interface ActionButtonsProps {
  onButtonAction: (button: string, state: 'down' | 'up') => void;
  scale?: number;
  haptics?: boolean;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onButtonAction,
  scale = 1.0,
  haptics = true,
}) => {
  const [activeButtons, setActiveButtons] = useState<Record<string, boolean>>({});

  const triggerHaptic = useCallback(() => {
    if (haptics && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(12);
      } catch {
        // ignore
      }
    }
  }, [haptics]);

  const handlePointerDown = (btn: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setActiveButtons((prev) => ({ ...prev, [btn]: true }));
    triggerHaptic();
    onButtonAction(btn, 'down');
  };

  const handlePointerUp = (btn: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if ((e.target as HTMLElement).hasPointerCapture?.(e.pointerId)) {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    }
    setActiveButtons((prev) => ({ ...prev, [btn]: false }));
    onButtonAction(btn, 'up');
  };

  const btnSize = 50 * scale;
  const containerSize = 150 * scale;

  const renderButton = (
    label: string,
    colorClasses: string,
    activeClasses: string,
    top?: string,
    left?: string,
    bottom?: string,
    right?: string
  ) => {
    const isPressed = activeButtons[label];
    return (
      <button
        style={{
          width: `${btnSize}px`,
          height: `${btnSize}px`,
          top,
          left,
          bottom,
          right,
          touchAction: 'none',
        }}
        onPointerDown={(e) => handlePointerDown(label, e)}
        onPointerUp={(e) => handlePointerUp(label, e)}
        onPointerCancel={(e) => handlePointerUp(label, e)}
        className={`absolute rounded-full font-bold text-lg select-none backdrop-blur-md border shadow-lg transition-transform touch-none flex items-center justify-center ${colorClasses} ${
          isPressed ? `scale-90 ${activeClasses}` : 'scale-100 hover:brightness-110'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-col items-center select-none" style={{ touchAction: 'none' }}>
      {/* Shoulder bumper buttons L1 / R1 */}
      <div className="flex gap-4 mb-2">
        <button
          style={{ width: `${60 * scale}px`, height: `${32 * scale}px`, touchAction: 'none' }}
          onPointerDown={(e) => handlePointerDown('L1', e)}
          onPointerUp={(e) => handlePointerUp('L1', e)}
          onPointerCancel={(e) => handlePointerUp('L1', e)}
          className={`rounded-lg bg-slate-900/80 border border-white/20 text-xs font-semibold text-slate-300 shadow backdrop-blur-md flex items-center justify-center touch-none ${
            activeButtons['L1'] ? 'bg-cyan-500/70 border-cyan-400 text-white' : ''
          }`}
        >
          L1
        </button>
        <button
          style={{ width: `${60 * scale}px`, height: `${32 * scale}px`, touchAction: 'none' }}
          onPointerDown={(e) => handlePointerDown('R1', e)}
          onPointerUp={(e) => handlePointerUp('R1', e)}
          onPointerCancel={(e) => handlePointerUp('R1', e)}
          className={`rounded-lg bg-slate-900/80 border border-white/20 text-xs font-semibold text-slate-300 shadow backdrop-blur-md flex items-center justify-center touch-none ${
            activeButtons['R1'] ? 'bg-cyan-500/70 border-cyan-400 text-white' : ''
          }`}
        >
          R1
        </button>
      </div>

      {/* Diamond Layout: Y (Top), X (Left), B (Right), A (Bottom) */}
      <div
        style={{
          width: `${containerSize}px`,
          height: `${containerSize}px`,
          touchAction: 'none',
        }}
        className="relative flex items-center justify-center"
      >
        {/* Y (Yellow / Gold) - Top */}
        {renderButton(
          'Y',
          'bg-amber-500/30 border-amber-400/50 text-amber-300',
          'bg-amber-500/80 border-amber-300 text-white shadow-amber-500/50',
          '0px',
          `calc(50% - ${btnSize / 2}px)`
        )}

        {/* X (Blue) - Left */}
        {renderButton(
          'X',
          'bg-blue-500/30 border-blue-400/50 text-blue-300',
          'bg-blue-500/80 border-blue-300 text-white shadow-blue-500/50',
          `calc(50% - ${btnSize / 2}px)`,
          '0px'
        )}

        {/* B (Red) - Right */}
        {renderButton(
          'B',
          'bg-rose-500/30 border-rose-400/50 text-rose-300',
          'bg-rose-500/80 border-rose-300 text-white shadow-rose-500/50',
          `calc(50% - ${btnSize / 2}px)`,
          undefined,
          undefined,
          '0px'
        )}

        {/* A (Green) - Bottom */}
        {renderButton(
          'A',
          'bg-emerald-500/30 border-emerald-400/50 text-emerald-300',
          'bg-emerald-500/80 border-emerald-300 text-white shadow-emerald-500/50',
          undefined,
          `calc(50% - ${btnSize / 2}px)`,
          '0px'
        )}
      </div>
    </div>
  );
};
