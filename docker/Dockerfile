FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# AWS EC2 C7i CPU Software Rendering Flags
ENV DISPLAY=:99
ENV LIBGL_ALWAYS_SOFTWARE=1
ENV GALLIUM_DRIVER=llvmpipe
ENV MESA_GL_VERSION_OVERRIDE=3.3
ENV MESA_GLSL_VERSION_OVERRIDE=330
ENV SDL_VIDEODRIVER=x11
ENV PULSE_SERVER=127.0.0.1:4713

# Install system dependencies, virtual X11 stack, audio, and tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    python3-tk \
    xvfb \
    openbox \
    x11vnc \
    websockify \
    novnc \
    xdotool \
    xdpyinfo \
    supervisor \
    pulseaudio \
    pulseaudio-utils \
    libgl1-mesa-dri \
    libgl1-mesa-glx \
    mesa-utils \
    curl \
    wget \
    ca-certificates \
    git \
    unzip \
    wine64 \
    # Lightweight sample games
    supertux2 \
    opentyrian \
    chocolate-doom \
    freedoom \
    frozen-bubble \
    extreme-tux-racer \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js for building the React frontend
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files
COPY backend/requirements.txt ./backend/
COPY frontend/package*.json ./frontend/

# Setup Python virtualenv and install backend requirements
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r ./backend/requirements.txt

# Install frontend dependencies and build
WORKDIR /app/frontend
RUN npm install
COPY frontend/ ./
RUN npm run build

WORKDIR /app
COPY backend/ ./backend/
COPY games/ ./games/
COPY scripts/ ./scripts/
COPY docker/supervisord.conf /etc/supervisor/conf.d/cloudgaming.conf

# Prepare directories
RUN mkdir -p /app/games/samples /var/log/supervisor /root/.vnc

EXPOSE 8000 6080 5900

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/cloudgaming.conf"]
