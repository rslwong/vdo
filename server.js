const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const https = require('https');
const path = require('path');
const os = require('os');
const selfsigned = require('selfsigned');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

// rooms: Map<roomId, Map<role, WebSocket>>
const rooms = new Map();

function handleConnection(ws) {
  let currentRoom = null;
  let currentRole = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'join') {
      currentRoom = msg.room;
      currentRole = msg.role;

      if (!rooms.has(currentRoom)) rooms.set(currentRoom, new Map());
      rooms.get(currentRoom).set(currentRole, ws);

      console.log(`[${currentRoom}] ${currentRole} joined`);

      // Notify sender to start negotiation once both peers are present
      const room = rooms.get(currentRoom);
      if (room.has('sender') && room.has('receiver')) {
        const sender = room.get('sender');
        if (sender.readyState === 1) {
          sender.send(JSON.stringify({ type: 'ready' }));
        }
      }
      return;
    }

    // Relay all other messages to the other peer in the room
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    const otherRole = currentRole === 'sender' ? 'receiver' : 'sender';
    const other = room.get(otherRole);
    if (other && other.readyState === 1) {
      other.send(JSON.stringify(msg));
    }
  });

  ws.on('close', () => {
    if (!currentRoom || !rooms.has(currentRoom)) return;
    const room = rooms.get(currentRoom);
    room.delete(currentRole);
    console.log(`[${currentRoom}] ${currentRole} disconnected`);

    if (room.size === 0) {
      rooms.delete(currentRoom);
    } else {
      const [remaining] = room.values();
      if (remaining.readyState === 1) {
        remaining.send(JSON.stringify({ type: 'peer-disconnected' }));
      }
    }
  });
}

function getLocalIP() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'YOUR_IP';
}

async function main() {
  const HTTP_PORT = process.env.PORT || 3000;
  const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

  // HTTP — for localhost (desktop)
  const httpServer = http.createServer(app);
  new WebSocketServer({ server: httpServer }).on('connection', handleConnection);
  await new Promise(r => httpServer.listen(HTTP_PORT, r));

  // HTTPS — required for camera access on mobile (non-localhost)
  // selfsigned v5 is async
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'localhost' }], { days: 365 });
  const httpsServer = https.createServer({ key: pems.private, cert: pems.cert }, app);
  new WebSocketServer({ server: httpsServer }).on('connection', handleConnection);
  await new Promise(r => httpsServer.listen(HTTPS_PORT, r));

  const ip = getLocalIP();
  console.log(`\nHTTP  (laptop)     → http://localhost:${HTTP_PORT}/send.html`);
  console.log(`HTTPS (smartphone) → https://${ip}:${HTTPS_PORT}/send.html`);
  console.log(`\n⚠  On your phone: accept the "Not Secure" warning to proceed (self-signed cert)\n`);
}

main();
