#!/usr/bin/env bash
set -e

echo "Installing lightweight Linux games optimized for CPU LLVMpipe rendering..."

sudo apt-get update
sudo apt-get install -y \
    supertux2 \
    opentyrian \
    chocolate-doom \
    freedoom \
    frozen-bubble \
    extreme-tux-racer

echo "Installed games:"
which supertux2 || true
which opentyrian || true
which chocolate-doom || true
which frozen-bubble || true
which etr || true

echo "All games successfully installed and ready for cloud play."
