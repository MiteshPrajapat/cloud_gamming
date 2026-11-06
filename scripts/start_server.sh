#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$DIR"

echo "=== Initializing Personal Cloud Gaming Platform on AWS EC2 C7i ==="

# Export software rendering flags and binary path
export PATH="/usr/games:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"
export DISPLAY=:99
export LIBGL_ALWAYS_SOFTWARE=1
export GALLIUM_DRIVER=llvmpipe
export MESA_GL_VERSION_OVERRIDE=3.3
export MESA_GLSL_VERSION_OVERRIDE=330
export SDL_VIDEODRIVER=x11

# Clean up any previous display instances
echo "Cleaning up any stale processes..."
pkill -f "Xvfb :99" || true
pkill -f "openbox" || true
pkill -f "x11vnc.*:99" || true
pkill -f "websockify.*6080" || true
sleep 1

# 1. Start Xvfb (Virtual Framebuffer on :99)
echo "Starting Xvfb on display :99 (1280x720)..."
Xvfb :99 -screen 0 1280x720x24 -ac +extension GLX +extension RENDER -noreset > /dev/null 2>&1 &
sleep 1

# 2. Start Openbox Window Manager
echo "Starting Openbox window manager..."
openbox --sm-disable > /dev/null 2>&1 &
sleep 0.5

# 3. Start x11vnc Server
echo "Starting x11vnc server on port 5900..."
x11vnc -display :99 -forever -shared -rfbport 5900 -nopw -noxdamage -repeat -wait 50 -defer 50 > /dev/null 2>&1 &
sleep 0.5

# 4. Start Websockify noVNC Proxy
echo "Starting websockify on port 6080..."
websockify --web /usr/share/novnc 6080 localhost:5900 > /dev/null 2>&1 &
sleep 0.5

# 5. Start FastAPI Backend & Web Dashboard
echo "Starting Cloud Gaming FastAPI application on port 8000..."
exec "$DIR/venv/bin/uvicorn" backend.app.main:app --host 0.0.0.0 --port 8000
