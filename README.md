# Personal Cloud Gaming Platform 🎮☁️

A high-performance, lightweight Cloud Gaming Web Application engineered to run on **AWS EC2 C7i Large** (4 vCPU, 8 GB RAM, Ubuntu Linux, No Dedicated GPU). Allows users to play lightweight PC games remotely in any mobile or desktop web browser without local game installation.

---

## 🌟 Key Features

- **CPU-Optimized Software Rendering**: Tuned specifically for AWS EC2 instances without dedicated GPUs using Mesa **LLVMpipe** (multi-threaded SIMD AVX-512 vectorization) and lightweight **Openbox** display manager.
- **Mobile Touch Gaming Controls**:
  - Full multi-touch virtual controller overlay for Android phones, tablets, and iPhones.
  - 8-Way Virtual Analog Joystick with responsive thumb knob and deadzones.
  - 4-Way D-Pad (Up, Down, Left, Right).
  - Diamond Action Buttons (A, B, X, Y) + Shoulder Bumpers (L1, R1).
  - Multi-touch capable: hold run while tapping jump without dropping keys.
  - Haptic feedback vibration on button touches.
  - Controller customization: Opacity slider, Scale slider, and multiple mapping profiles (WASD, Arrows, Action).
  - Landscape auto-recommendation banner for mobile displays.
- **Desktop Keyboard & Mouse Controls**:
  - Full keyboard event forwarding (`WASD`, arrow keys, Space, Enter, Escape, Shift, Ctrl, etc.).
  - Mouse movement, mouse button clicks (left, middle, right), and scroll wheel forwarding.
  - Fullscreen mode support.
  - On-screen controller toggle for laptops and touchscreen PCs.
- **Zero-Stuck-Keys Guarantee**: Active key tracking automatically releases all pressed keys when the user disconnects, closes the tab, or exits the game.
- **Dynamic Game Library**:
  - Dynamic game catalog loaded from the backend (not hardcoded).
  - Search and genre filtering (Platformer, Action, Arcade, Retro, Racing, Puzzle).
  - Web Admin modal to register new games, configure launch arguments, and upload game archives.
- **Real-Time Telemetry & Health Monitoring**:
  - Live network ping (RTT) in milliseconds.
  - Session duration counter.
  - Real-time CPU and RAM monitoring on the AWS EC2 C7i server.

---

## 🏗️ Supported Games Out-of-the-Box

1. **SuperTux 2** (Linux Native, 2D Platformer)
2. **OpenTyrian** (Linux Native, 2D Vertical Space Shoot'em-up)
3. **Chocolate Doom** (Linux Native, Classic 1993 3D Action FPS)
4. **Extreme Tux Racer** (Linux Native, 3D Downhill Racer)
5. **Frozen Bubble** (Linux Native, 2D Puzzle Arcade)
6. **Cave Story (NXEngine)** (Linux Native / Retro RPG)
7. **2048 Cloud Edition** (Python / X11 Lightweight Canvas Game)
8. **Wine Lightweight Games** (Windows 3D Pinball and compatible lightweight executables)

---

## 🚀 Quick Start on AWS EC2 C7i

### Prerequisites: AWS Security Group Setup
In your AWS EC2 Console, ensure your Security Group allows inbound traffic for:
- **Port 8000 (TCP)**: Web Dashboard & FastAPI Backend
- **Port 6080 (TCP)**: noVNC Websockify Stream
- **Port 22 (SSH)**: For remote server administration

---

### Method A: Docker Deployment (Recommended)

1. Clone or upload the repository to your EC2 instance:
   ```bash
   git clone <repo-url> cloudGaming
   cd cloudGaming
   ```

2. Start the entire cloud gaming stack with Docker Compose:
   ```bash
   docker compose up -d --build
   ```

3. Open your browser and navigate to:
   ```
   http://<YOUR-EC2-PUBLIC-IP>:8000
   ```

---

### Method B: Native Ubuntu Server Setup

1. Run the automated installer:
   ```bash
   chmod +x scripts/*.sh
   bash scripts/install_aws_ec2.sh
   ```

2. Install lightweight games:
   ```bash
   bash scripts/install_games.sh
   ```

3. Start the cloud gaming services:
   ```bash
   bash scripts/start_services.sh
   ```

---

## 📱 Mobile Controls Guide

When accessing the platform on Android or iOS:
1. Select any game from the library and tap **Play**.
2. Rotate your phone to **Landscape** mode for the optimal viewport.
3. Use the left **Virtual Joystick** or **D-Pad** for direction.
4. Use the right **A, B, X, Y** buttons for jump, sprint, shoot, and actions.
5. Tap the **Settings icon** on the top bar to adjust:
   - **Opacity**: 20% to 100% transparency.
   - **Scale**: Resize the buttons and joystick to fit your thumbs.
   - **Profile**: Switch between `WASD`, `Arrows`, or `Action` modes.
   - **Haptics**: Toggle tactile vibration feedback.

---

## 🛠️ Adding New Games

You can add any lightweight game through the Web UI:
1. Click **+ Add Game** on the top navigation bar.
2. Enter the Game Title, Category, and Executable Path (e.g. `/usr/games/supertux2` or `python3 -m mygame`).
3. (Optional) Upload a `.zip` archive containing the game assets.
4. Click **Add Game**. It appears immediately in the library with zero server restarts required.

---

## 🧪 Local Testing & Verification

Run the test suite to verify endpoints and session lifecycle:

```bash
# Verify backend and system health
python -c "from backend.app.main import app; from fastapi.testclient import TestClient; client = TestClient(app); print(client.get('/api/server/status').json())"

# Verify build of React frontend
cd frontend
npm run build
```

---

## 🛡️ License
MIT License. Open source and built for personal cloud gaming.

