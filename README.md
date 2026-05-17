# VDO Share

A minimal peer-to-peer camera sharing app built on WebRTC. Stream your smartphone camera (or any device with a browser) directly to your laptop with no accounts, no cloud, and no video passing through a server.

## How it works

```
Smartphone (browser) ──WebRTC P2P──▶ Laptop (browser)
        │                                   │
        └────────── Signaling Server ───────┘
               (WebSocket, same machine)
```

The signaling server only brokers the initial handshake (SDP offer/answer + ICE candidates). Once the peer connection is established, video flows directly between devices.

## Requirements

- Both devices on the same Wi-Fi network
- **Node.js:** Node.js 18+
- **Docker:** Docker Engine 20+ (or Docker Desktop)

## Running with Node.js

```bash
npm install
npm start
```

## Running with Docker

### Quick start (Docker Compose)

```bash
HOST_IP=<your-machine-ip> docker compose up
```

Replace `<your-machine-ip>` with your machine's local IP address (e.g. `192.168.1.42`).
This is needed so the printed URLs and QR code point to your host rather than the container's internal IP.

To find your IP:

```bash
# macOS / Linux
ipconfig getifaddr en0   # or: hostname -I | awk '{print $1}'

# Windows
ipconfig  # look for IPv4 Address under your Wi-Fi adapter
```

### Docker CLI

```bash
docker build -t vdo-share .
docker run -p 3000:3000 -p 3443:3443 -e HOST_IP=<your-machine-ip> vdo-share
```

### Without HOST_IP

Omitting `HOST_IP` still works — the app falls back to the container's internal network interface. The server will start correctly but the printed HTTPS URL and QR code may show the wrong IP; just substitute your host machine's IP manually.

## Port reference

| Protocol | Port | Use for |
|----------|------|---------|
| HTTP | 3000 | Laptop / localhost |
| HTTPS | 3443 | Smartphone (camera requires HTTPS on mobile) |

On startup the console prints the exact URLs and a scannable QR code:

```
HTTP  (laptop)     → http://localhost:3000/send.html
HTTPS (smartphone) → https://192.168.x.x:3443/send.html
```

## Usage

### Sender (smartphone)

1. Open `https://<host-ip>:3443/send.html` on your phone
2. Accept the **"Not Secure"** certificate warning — expected for the self-signed cert
3. Allow camera and microphone access when prompted
4. Select your camera and tap **Start Camera & Wait for Receiver**
5. The room code is shown in the input — share the link with the receiver
6. Controls available during a session:
   - **Zoom** — slider from 1× to 4×; affects the stream the receiver sees
   - **Mute** — toggle microphone on/off
   - **Flip** — switch between front and back cameras (shown when multiple cameras are detected)

### Receiver (laptop or any browser)

1. Open the link shared by the sender, or go to `http://localhost:3000/receive.html` and enter the 3-digit room code
2. The stream starts automatically once both peers connect
3. **Fullscreen** — click "⛶ Fullscreen"; tap "✕ Exit Fullscreen" (visible on-screen) to return
4. **Volume** — slider appears once the stream arrives

### Reconnecting

The sender's room code is saved in the browser's local storage. If the sender closes the tab and reopens `send.html`, the same room code is pre-filled — just press Start to rejoin the same room. The receiver reconnects automatically when the new offer arrives.

## Project structure

```
vdo/
├── server.js           # HTTP + HTTPS servers, WebSocket signaling
├── package.json
├── Dockerfile
├── docker-compose.yml
└── public/
    ├── send.html       # Camera sender page
    └── receive.html    # Stream viewer page (includes debug panel)
```

## Troubleshooting

**Phone camera not accessible**
Mobile browsers require HTTPS for `getUserMedia`. Always use the HTTPS URL (port 3443) on the phone.

**Certificate warning on phone**
The server generates a self-signed certificate at startup. Tap **Advanced → Proceed** (Chrome) or **Show Details → visit this website** (Safari) to continue.

**Black screen / no video**
The receive page has a debug panel showing Signaling / ICE / Connection / Track states. Common causes:
- `ICE: failed` — devices can't reach each other; ensure both are on the same Wi-Fi and check your firewall
- `Track: –` after ICE connects — refresh both pages and try again
- `▶` play button appears — click it to start playback (browser blocked autoplay)

**Wrong URL printed when using Docker**
Pass your host machine's IP via `HOST_IP=<ip> docker compose up`. See the Docker section above.

**Devices on different networks**
The app relies on direct P2P connectivity. Across different networks (phone on cellular, laptop on Wi-Fi) you would need a TURN relay server, which is not included.

## Tech stack

- **Node.js** + **Express** — static file serving
- **ws** — WebSocket signaling server
- **selfsigned** — self-signed TLS certificate generated at startup
- **WebRTC** (browser-native) — peer-to-peer video/audio
- **STUN** — Google's public STUN servers for NAT traversal
