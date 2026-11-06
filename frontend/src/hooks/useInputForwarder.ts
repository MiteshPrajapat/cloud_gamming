import { useEffect, useRef, useState, useCallback } from 'react';

export interface UseInputForwarderOptions {
  sessionId?: string;
  enabled?: boolean;
}

export function useInputForwarder({ sessionId, enabled = true }: UseInputForwarderOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const pingIntervalRef = useRef<any>(null);

  // Send message helper
  const send = useCallback((payload: Record<string, any>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(payload));
      } catch (err) {
        console.error('Failed to send input via WebSocket', err);
      }
    }
  }, []);

  const sendKeyDown = useCallback((key: string) => {
    send({ type: 'keydown', key });
  }, [send]);

  const sendKeyUp = useCallback((key: string) => {
    send({ type: 'keyup', key });
  }, [send]);

  const sendGamepadButton = useCallback((button: string, state: 'down' | 'up' = 'down') => {
    send({ type: 'gamepad_button', button, state });
  }, [send]);

  const sendJoystickDirection = useCallback((direction: string) => {
    send({ type: 'joystick', direction });
  }, [send]);

  const sendDPad = useCallback((direction: string, state: 'down' | 'up' = 'down') => {
    send({ type: 'dpad', direction, state });
  }, [send]);

  const sendMouseMove = useCallback((x: number, y: number) => {
    send({ type: 'mousemove', x, y });
  }, [send]);

  const sendMouseDown = useCallback((button: 'left' | 'middle' | 'right' = 'left') => {
    send({ type: 'mousedown', button });
  }, [send]);

  const sendMouseUp = useCallback((button: 'left' | 'middle' | 'right' = 'left') => {
    send({ type: 'mouseup', button });
  }, [send]);

  const sendMouseScroll = useCallback((deltaY: number) => {
    send({ type: 'mousescroll', delta_y: deltaY });
  }, [send]);

  const setControlProfile = useCallback((name: string) => {
    send({ type: 'profile', name });
  }, [send]);

  const resetKeys = useCallback(() => {
    send({ type: 'reset_keys' });
  }, [send]);

  // Establish WebSocket connection
  useEffect(() => {
    if (!sessionId || !enabled) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/session/${sessionId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);

      // Start ping loop for real-time network latency calculation
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping', client_time: performance.now() }));
        }
      }, 1500);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'pong' && data.client_time) {
          const rtt = Math.round(performance.now() - data.client_time);
          setLatencyMs(rtt);
        }
      } catch {
        // ignore non-json
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };

    ws.onerror = (err) => {
      console.warn('WebSocket connection error:', err);
    };

    // Prevent stuck keys when window loses focus or user navigates away
    const handleBlur = () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'reset_keys' }));
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('beforeunload', handleBlur);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('beforeunload', handleBlur);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'reset_keys' }));
        ws.close();
      }
    };
  }, [sessionId, enabled]);

  return {
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
  };
}
