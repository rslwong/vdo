const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const https = require('https');
const path = require('path');
const os = require('os');
const selfsigned = require('selfsigned');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

// rooms: Map<roomId, Map<role, WebSocket>>
const rooms = new Map();

let serverIP = 'localhost';
let HTTPS_PORT = 3443;

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

      if (currentRole === 'sender') {
        const receiveUrl = `https://${serverIP}:${HTTPS_PORT}/receive.html?room=${currentRoom}`;
        console.log(`[${currentRoom}] Receiver link → ${receiveUrl}`);
      }

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
  if (process.env.HOST_IP) return process.env.HOST_IP;
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'YOUR_IP';
}

async function main() {
  const HTTP_PORT = process.env.PORT || 3000;
  HTTPS_PORT = process.env.HTTPS_PORT || 3443;

  // HTTP — for localhost (desktop)
  const httpServer = http.createServer(app);
  const httpWss = new WebSocketServer({ server: httpServer });
  httpWss.on('connection', handleConnection);
  await new Promise(r => httpServer.listen(HTTP_PORT, r));

  // HTTPS — required for camera access on mobile (non-localhost)
  // selfsigned v5 is async
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'localhost' }], { days: 365 });
  const httpsServer = https.createServer({ key: pems.private, cert: pems.cert }, app);
  const httpsWss = new WebSocketServer({ server: httpsServer });
  httpsWss.on('connection', handleConnection);
  await new Promise(r => httpsServer.listen(HTTPS_PORT, r));

  serverIP = getLocalIP();
  const sendUrl = `https://${serverIP}:${HTTPS_PORT}/send.html`;

  console.log(`\nHTTP  (laptop)     → http://localhost:${HTTP_PORT}/send.html`);
  console.log(`HTTPS (smartphone) → ${sendUrl}`);
  console.log(`\n⚠  On your phone: accept the "Not Secure" warning to proceed (self-signed cert)\n`);
  console.log('Scan to open on your smartphone:\n');
  qrcode.generate(sendUrl, { small: true });

  function shutdown() {
    console.log('\nShutting down…');
    httpWss.close();
    httpsWss.close();
    httpServer.close(() => httpsServer.close(() => process.exit(0)));
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Interactive 'q' keypress — only when running in a real terminal
  if (process.stdin.isTTY) {
    const readline = require('readline');
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.on('keypress', (str, key) => {
      if (key.name === 'q' || (key.ctrl && key.name === 'c')) shutdown();
    });
    console.log('Press q to quit\n');
  }
}

main();
