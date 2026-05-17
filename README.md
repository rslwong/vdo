# VDO Share

A minimal peer-to-peer camera sharing app built on WebRTC. Stream your smartphone camera (or any device with a browser) directly to your laptop with no accounts, no cloud, and no video passing through a server.

## How it works

```
Smart Camera (browser) ──WebRTC P2P──▶ Laptop (browser)
         │                                    │
         └──────── Signaling Server ──────────┘
                (WebSocket, same machine)
```

The signaling server only brokers the initial handshake (SDP offer/answer + ICE candidates). Once the peer connection is established, video flows directly between devices.

## Requirements

- Node.js 18+
- Both devices on the same Wi-Fi network

## Setup

```bash
npm install
npm start
```

The server starts two listeners:

| Protocol | Port | Use for |
|----------|------|---------|
| HTTP | 3000 | Laptop / localhost |
| HTTPS | 3443 | Smartphone (camera access requires HTTPS on mobile) |

On startup the console prints the exact URLs to use:

```
HTTP  (laptop)     → http://localhost:3000/send.html
HTTPS (smartphone) → https://192.168.x.x:3443/send.html
```

## Usage

### Sending from your smartphone

1. Open the HTTPS URL on your phone (e.g. `https://192.168.x.x:3443/send.html`)
2. Accept the **"Not Secure"** certificate warning — this is expected for the self-signed cert
3. Allow camera access when prompted
4. Select your camera, tap **Start Camera & Wait for Receiver**
5. Copy the generated room link and send it to your laptop

### Receiving on your laptop

1. Open the room link (or go to `http://localhost:3000/receive.html` and enter the room code)
2. The stream starts automatically once both peers are connected

## Project structure

```
vdo/
├── server.js          # HTTP + HTTPS servers, WebSocket signaling
├── package.json
└── public/
    ├── send.html      # Camera sender page
    └── receive.html   # Stream viewer page (includes debug panel)
```

## Troubleshooting

**Phone camera not accessible**
Mobile browsers require HTTPS for `getUserMedia`. Always use the HTTPS URL (port 3443) on the phone, not HTTP.

**Certificate warning on phone**
The server generates a self-signed certificate at startup. Tap **Advanced → Proceed** (Chrome) or **Show Details → visit this website** (Safari) to continue.

**Black screen / no video**
The receive page has a debug panel showing Signaling / ICE / Connection / Track states. Common causes:
- `ICE: failed` — the devices can't reach each other directly; try disabling your laptop's firewall or ensure both are on the same Wi-Fi
- `Track: –` after ICE connects — refresh both pages and try again
- `▶` play button appears — click it to start playback (browser blocked autoplay)

**Devices on different networks**
The app relies on direct peer-to-peer connectivity. Across different networks (e.g. phone on cellular, laptop on Wi-Fi) you would need a TURN relay server, which is not included.

## Tech stack

- **Node.js** + **Express** — static file serving
- **ws** — WebSocket signaling server
- **selfsigned** — self-signed TLS certificate generated at startup
- **WebRTC** (browser-native) — peer-to-peer video/audio
- **STUN** — Google's public STUN servers for NAT traversal
