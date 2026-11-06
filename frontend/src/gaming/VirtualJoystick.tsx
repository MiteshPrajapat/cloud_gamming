import React, { useRef, useState, useCallback } from 'react';

interface VirtualJoystickProps {
  onDirectionChange: (direction: string) => void;
  scale?: number;
  haptics?: boolean;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({
  onDirectionChange,
  scale = 1.0,
  haptics = true,
}) => {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const activePointerId = useRef<number | null>(null);
  const currentDirection = useRef<string>('CENTER');

  const maxRadius = 45 * scale;

  const triggerHaptic = useCallback(() => {
    if (haptics && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(10);
      } catch {
        // ignore
      }
    }
  }, [haptics]);

  const calculateDirection = (dx: number, dy: number): string => {
    const distance = Math.hypot(dx, dy);
    const deadzone = 12 * scale;
    if (distance < deadzone) return 'CENTER';

    // Angle in degrees [0, 360) where 0 is Right, 90 is Down, etc.
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle < 0) angle += 360;

    // 8 directional sectors (45 degrees each)
    // Right: [337.5, 360) or [0, 22.5)
    // Down-Right: [22.5, 67.5)
    // Down: [67.5, 112.5)
    // Down-Left: [112.5, 157.5)
    // Left: [157.5, 202.5)
    // Up-Left: [202.5, 247.5)
    // Up: [247.5, 292.5)
    // Up-Right: [292.5, 337.5)
    if (angle >= 337.5 || angle < 22.5) return 'RIGHT';
    if (angle >= 22.5 && angle < 67.5) return 'DOWN_RIGHT';
    if (angle >= 67.5 && angle < 112.5) return 'DOWN';
    if (angle >= 112.5 && angle < 157.5) return 'DOWN_LEFT';
    if (angle >= 157.5 && angle < 202.5) return 'LEFT';
    if (angle >= 202.5 && angle < 247.5) return 'UP_LEFT';
    if (angle >= 247.5 && angle < 292.5) return 'UP';
    return 'UP_RIGHT';
  };

  const updateKnob = (clientX: number, clientY: number) => {
    if (!baseRef.current) return;
    const rect = baseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.hypot(dx, dy);

    let clampedX = dx;
    let clampedY = dy;
    if (distance > maxRadius) {
      clampedX = (dx / distance) * maxRadius;
      clampedY = (dy / distance) * maxRadius;
    }

    setKnobPos({ x: clampedX, y: clampedY });

    const newDir = calculateDirection(clampedX, clampedY);
    if (newDir !== currentDirection.current) {
      currentDirection.current = newDir;
      onDirectionChange(newDir);
      if (newDir !== 'CENTER') triggerHaptic();
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    activePointerId.current = e.pointerId;
    if (baseRef.current) {
      baseRef.current.setPointerCapture(e.pointerId);
    }
    setIsActive(true);
    triggerHaptic();
    updateKnob(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isActive || activePointerId.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    updateKnob(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    if (baseRef.current && baseRef.current.hasPointerCapture(e.pointerId)) {
      baseRef.current.releasePointerCapture(e.pointerId);
    }
    activePointerId.current = null;
    setIsActive(false);
    setKnobPos({ x: 0, y: 0 });
    if (currentDirection.current !== 'CENTER') {
      currentDirection.current = 'CENTER';
      onDirectionChange('CENTER');
    }
  };

  const sizePx = 130 * scale;
  const knobSizePx = 54 * scale;

  return (
    <div
      ref={baseRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        width: `${sizePx}px`,
        height: `${sizePx}px`,
        touchAction: 'none',
      }}
      className={`relative rounded-full border-2 border-white/20 bg-slate-900/60 backdrop-blur-md flex items-center justify-center transition-colors select-none shadow-xl ${
        isActive ? 'border-cyan-400/80 bg-slate-900/80' : ''
      }`}
    >
      {/* Inner guide cross */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
        <div className="w-[1px] h-full bg-white/40" />
        <div className="h-[1px] w-full bg-white/40 absolute" />
      </div>

      {/* Floating Thumb Stick Knob */}
      <div
        style={{
          width: `${knobSizePx}px`,
          height: `${knobSizePx}px`,
          transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
          touchAction: 'none',
        }}
        className={`rounded-full border-2 border-cyan-400 bg-gradient-to-br from-cyan-500/80 to-blue-600/80 shadow-lg pointer-events-none transition-transform duration-75 flex items-center justify-center ${
          isActive ? 'scale-110 shadow-cyan-500/50' : 'scale-100'
        }`}
      >
        <div className="w-3 h-3 rounded-full bg-white/90 shadow-sm" />
      </div>
    </div>
  );
};
