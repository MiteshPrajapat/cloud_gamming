#!/usr/bin/env bash
set -e

echo "=========================================================="
echo " Personal Cloud Gaming Platform - AWS EC2 Setup Script    "
echo " Target Instance: AWS EC2 C7i Large (4 vCPU / 8 GB RAM)   "
echo "=========================================================="

sudo apt-get update
sudo apt-get install -y --no-install-recommends \
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
    pulseaudio \
    pulseaudio-utils \
    libgl1-mesa-dri \
    libgl1-mesa-glx \
    mesa-utils \
    curl \
    git \
    unzip \
    wine64

# Install Node.js 20 LTS for building frontend
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Setup Python Virtual Environment
echo "Setting up Python virtual environment..."
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt

# Install frontend and build SPA
echo "Building React frontend..."
cd frontend
npm install
npm run build
cd ..

echo "Setting permissions..."
chmod +x scripts/*.sh

echo "=========================================================="
echo " Setup complete! Next steps:                              "
echo " 1. Run bash scripts/install_games.sh to install games    "
echo " 2. Run bash scripts/start_services.sh to start server    "
echo "=========================================================="

