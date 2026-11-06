# System Architecture: Personal Cloud Gaming Platform

This document describes the architectural design and implementation of the Personal Cloud Gaming Platform optimized specifically for **AWS EC2 C7i Large (4 vCPU, 8 GB RAM, No Dedicated GPU, Ubuntu Linux)**.

---

## 1. High-Level Architecture Overview

```
                      +---------------------------------------+
                      |          Browser Client               |
                      |   (Mobile Phone / Laptop / Tablet)    |
                      +-------------------+-------------------+
                                          |
                +-------------------------+-------------------------+
                | HTTP / REST (Port 8000)                           | WebSocket (Port 8000/6080)
                v                                                   v
+-------------------------------+                  +--------------------------------+
|       FastAPI Backend         |                  |  WebSocket Input & Stream Hub  |
| - Games Library Management    |                  | - Bidirectional Key / Touch WS |
| - Session Lifecycle (1 max)   |                  | - noVNC / Websockify RFB Proxy |
| - CPU & RAM Resource Guard    |                  | - Real-time Latency (RTT)      |
+---------------+---------------+                  +---------------+----------------+
                |                                                  |
                | subprocess with CPU env                          | xdotool keydown/up/mousemove
                v                                                  v
+-----------------------------------------------------------------------------------+
|                        AWS EC2 C7i Headless Gaming Node                           |
|                                                                                   |
|  +--------------------+    +--------------------+    +-------------------------+  |
|  |     Xvfb :99       |    |  Openbox WM        |    | x11vnc Server (5900)    |  |
|  |  (1280x720 24-bit) |    |  (~25MB RAM foot-  |    | - shared, no-damage     |  |
|  |  + GLX + RENDER    |    |   print vs 180MB+) |    | - low CPU overhead      |  |
|  +---------+----------+    +---------+----------+    +------------+------------+  |
|            ^                         ^                            ^               |
|            +-------------------------+----------------------------+               |
|                                      |                                            |
|                +---------------------+---------------------+                      |
|                |                                           |                      |
|                v                                           v                      |
|       +-------------------+                       +-------------------+           |
|       | Native Linux Game |                       | Wine 64 Subsystem |           |
|       | (SuperTux2, Doom) |                       | (Windows .exe)    |           |
|       +-------------------+                       +-------------------+           |
|                                                                                   |
|  Software Rendering Engine:                                                       |
|  - LIBGL_ALWAYS_SOFTWARE=1                                                        |
|  - GALLIUM_DRIVER=llvmpipe (Multi-threaded Intel AVX-512 CPU Rasterizer)           |
|  - MESA_GL_VERSION_OVERRIDE=3.3                                                   |
+-----------------------------------------------------------------------------------+
```

---

## 2. AWS EC2 C7i Hardware Optimization Strategy

The AWS EC2 `c7i.large` instance provides:
- **CPU**: 4 vCPU (Custom 4th Gen Intel Xeon Scalable processors, Emerald Rapids/Sapphire Rapids) with AVX-512 and AMX acceleration.
- **RAM**: 8 GB DDR5.
- **GPU**: **None (Headless)**.

### Optimizations Implemented:
1. **LLVMpipe Software Rasterization**:
   Instead of basic software emulation, Mesa's `llvmpipe` driver uses JIT code generation and multi-threaded SIMD (AVX-512 vectorization) on the 4 vCPUs to render OpenGL 3.3.
2. **Openbox Window Manager**:
   Instead of running full desktop suites (like GNOME or full XFCE which consume 200MB+ RAM and ongoing background CPU cycles), the platform uses **Openbox** (~25MB RAM, 0% idle CPU), dedicating over 95% of server resources directly to the game.
3. **Target Framerate & Resolution**:
   Locked to **1280x720 (720p) at 30 FPS**. Rendering 720p on CPU requires ~44% of the pixels of 1080p, reducing CPU rasterizer load by over 50% while preserving sharp visuals on mobile screens and laptops.
4. **Single Concurrent Session Guard**:
   To prevent CPU thrashing and ensure lag-free play, `SessionManager` restricts the server to 1 active concurrent gaming session. If a new game is launched, any zombie or previous session is automatically terminated and cleaned up.

---

## 3. Mobile Virtual Gaming Controller Pipeline

The application features a fully touch-responsive virtual gaming controller overlay:

### Multi-Touch Tracking
- Employs the `Pointer Events` API (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) with `setPointerCapture`.
- Each touch point holds a separate `pointerId`, allowing simultaneous multi-touch interactions:
  - Steering the left Virtual Joystick / D-Pad with the left thumb
  - Holding `B` (run/dash) with the right thumb
  - Tapping `A` (jump) without dropping or canceling the joystick direction

### 8-Way Virtual Joystick
- Computes polar coordinates ($r, \theta$) and deadzones.
- Dispatches 8-way directional sectors (`UP`, `DOWN`, `LEFT`, `RIGHT`, `UP_LEFT`, `UP_RIGHT`, `DOWN_LEFT`, `DOWN_RIGHT`, `CENTER`).
- Differential key dispatching: when the user sweeps from `UP` to `UP_RIGHT`, the controller retains `W` pressed and triggers `keydown` for `D`, releasing only the keys no longer active.

### Zero-Stuck-Keys Guarantee
A critical issue in cloud gaming is "stuck keys" when a player disconnects, closes their browser tab, or switches apps.
- `InputManager` maintains an active key registry `_active_keys[session_id]` on the backend.
- Whenever a WebSocket connection drops, or the user navigates away, or the session is stopped, `InputManager.release_all_keys(session_id)` is automatically fired, executing `xdotool keyup <key>` for every active key on the X11 display.

---

## 4. Input Mapping Profiles

| Button | WASD Profile (Default) | Arrows Profile (Retro) | Action Profile |
|---|---|---|---|
| **Joystick / D-Pad Up** | `w` | `Up` | `Up` |
| **Joystick / D-Pad Down** | `s` | `Down` | `Down` |
| **Joystick / D-Pad Left** | `a` | `Left` | `Left` |
| **Joystick / D-Pad Right** | `d` | `Right` | `Right` |
| **Button A** | `space` (Jump / Confirm) | `z` | `space` |
| **Button B** | `Shift_L` (Run / Dash) | `x` | `Return` |
| **Button X** | `e` (Interact / Action) | `c` | `z` |
| **Button Y** | `q` (Secondary) | `v` | `x` |
| **Button L1 / R1** | `Control_L` / `r` | `space` / `Shift_L` | `a` / `s` |
| **START** | `Return` | `Return` | `Return` |
| **SELECT** | `Tab` | `Escape` | `Tab` |
| **PAUSE** | `Escape` | `Escape` | `Escape` |

---

## 5. Security Architecture

1. **Path Traversal Protection**:
   File uploads (`/api/games/upload`) are validated against directory traversal attacks. Filenames are sanitized with `os.path.basename`, and archive extractions strictly enforce that all members resolve inside the assigned game folder.
2. **Process Sandboxing & Tree Termination**:
   Games are spawned with `os.setsid` process groups. On exit, `psutil` traverses child processes and terminates all subprocesses, preventing rogue background mining or runaway processes.
3. **Session Idle Timeout**:
   An automated background asyncio task monitors user input timestamps. If a session is idle for more than 30 minutes, it automatically terminates and frees AWS CPU and memory.

