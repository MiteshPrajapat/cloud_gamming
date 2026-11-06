#!/usr/bin/env bash

# Environment variables for CPU LLVMpipe software rendering on AWS C7i
export DISPLAY=:99
export LIBGL_ALWAYS_SOFTWARE=1
export GALLIUM_DRIVER=llvmpipe
export MESA_GL_VERSION_OVERRIDE=3.3
export MESA_GLSL_VERSION_OVERRIDE=330
export SDL_VIDEODRIVER=x11

echo "Starting Headless Virtual Display Stack on $DISPLAY..."

# 1. Kill any existing instances
pkill -f "Xvfb :99" || true
pkill -f "x11vnc.*:99" || true
pkill -f "websockify.*6080" || true

# 2. Start Xvfb (1280x720 24-bit with GLX)
echo "Starting Xvfb..."
Xvfb :99 -screen 0 1280x720x24 -ac +extension GLX +extension RENDER -noreset > /dev/null 2>&1 &
sleep 1

# 3. Start Openbox Window Manager
echo "Starting Openbox WM..."
openbox --sm-disable > /dev/null 2>&1 &
sleep 0.5

# 4. Start x11vnc
echo "Starting x11vnc on port 5900..."
x11vnc -display :99 -forever -shared -rfbport 5900 -nopw -noxdamage -repeat -wait 50 -defer 50 > /dev/null 2>&1 &
sleep 0.5

# 5. Start websockify proxy for noVNC
echo "Starting websockify on port 6080..."
websockify --web /usr/share/novnc 6080 localhost:5900 > /dev/null 2>&1 &
sleep 0.5

# 6. Start FastAPI Backend & Web Dashboard
echo "Starting FastAPI Server on port 8000..."
source venv/bin/activate
python backend/run.py

