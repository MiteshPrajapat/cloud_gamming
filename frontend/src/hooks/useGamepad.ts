import { useEffect, useRef } from 'react';

interface GamepadButtonMap {
  [index: number]: string;
}

// Standard Gamepad API mapping (Xbox / DualShock / Standard layout)
const STANDARD_BUTTONS: GamepadButtonMap = {
  0: 'A',      // Bottom button (A / Cross)
  1: 'B',      // Right button (B / Circle)
  2: 'X',      // Left button (X / Square)
  3: 'Y',      // Top button (Y / Triangle)
  4: 'L1',     // Left bumper
  5: 'R1',     // Right bumper
  6: 'L2',     // Left trigger
  7: 'R2',     // Right trigger
  8: 'SELECT', // Select / Back / Share
  9: 'START',  // Start / Options
  12: 'UP',    // D-pad Up
  13: 'DOWN',  // D-pad Down
  14: 'LEFT',  // D-pad Left
  15: 'RIGHT', // D-pad Right
};

interface UseGamepadProps {
  onButtonAction: (button: string, state: 'down' | 'up') => void;
  onJoystickMove: (direction: string) => void;
  enabled?: boolean;
}

export function useGamepad({ onButtonAction, onJoystickMove, enabled = true }: UseGamepadProps) {
  const prevButtonsRef = useRef<Record<string, boolean>>({});
  const prevDirectionRef = useRef<string>('CENTER');
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const pollGamepad = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = gamepads[0] || gamepads[1] || gamepads[2] || gamepads[3];

      if (gp && gp.connected) {
        // 1. Check Buttons
        gp.buttons.forEach((btn, idx) => {
          const btnName = STANDARD_BUTTONS[idx];
          if (!btnName) return;

          const isPressed = btn.pressed || btn.value > 0.5;
          const wasPressed = prevButtonsRef.current[btnName] || false;

          if (isPressed && !wasPressed) {
            prevButtonsRef.current[btnName] = true;
            onButtonAction(btnName, 'down');
          } else if (!isPressed && wasPressed) {
            prevButtonsRef.current[btnName] = false;
            onButtonAction(btnName, 'up');
          }
        });

        // 2. Check Left Analog Stick (Axes 0 = X, 1 = Y)
        const axisX = gp.axes[0] || 0;
        const axisY = gp.axes[1] || 0;
        const deadzone = 0.25;

        let newDir = 'CENTER';
        const isUp = axisY < -deadzone;
        const isDown = axisY > deadzone;
        const isLeft = axisX < -deadzone;
        const isRight = axisX > deadzone;

        if (isUp && isRight) newDir = 'UP_RIGHT';
        else if (isUp && isLeft) newDir = 'UP_LEFT';
        else if (isDown && isRight) newDir = 'DOWN_RIGHT';
        else if (isDown && isLeft) newDir = 'DOWN_LEFT';
        else if (isUp) newDir = 'UP';
        else if (isDown) newDir = 'DOWN';
        else if (isLeft) newDir = 'LEFT';
        else if (isRight) newDir = 'RIGHT';

        if (newDir !== prevDirectionRef.current) {
          prevDirectionRef.current = newDir;
          onJoystickMove(newDir);
        }
      }

      animFrameRef.current = requestAnimationFrame(pollGamepad);
    };

    animFrameRef.current = requestAnimationFrame(pollGamepad);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [onButtonAction, onJoystickMove, enabled]);
}

