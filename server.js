/**
 * server.js
 * Lokální server pro Školní Bufet POS bez nutnosti externích knihoven (zero-dependencies).
 * 
 * Zajišťuje:
 * 1. Sdílení a ukládání účtenek na serveru (soubor data/orders.json).
 * 2. Real-time synchronizaci mezi všemi zařízeními (mobily, tablety, PC) přes Server-Sent Events (SSE).
 * 3. REST API pro načítání, ukládání, úpravy, storno a mazání účtenek.
 * 4. Servírování statických souborů (HTML, CSS, JS, ikony).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

// MIME typy pro správné načítání souborů v prohlížeči
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Inicializace úložiště pro účtenky
function initStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

// Načtení účtenek ze souboru
function readOrdersFile() {
  try {
    if (!fs.existsSync(ORDERS_FILE)) return [];
    const content = fs.readFileSync(ORDERS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Chyba při čtení orders.json:', err.message);
    return [];
  }
}

// Zápis účtenek do souboru (atomický zápis přes dočasný soubor)
function writeOrdersFile(orders) {
  try {
    const tempFile = ORDERS_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(orders, null, 2), 'utf-8');
    fs.renameSync(tempFile, ORDERS_FILE);
    return true;
  } catch (err) {
    console.error('Chyba při zápisu do orders.json:', err.message);
    return false;
  }
}

// Zjištění lokální IP adresy počítače v síti Wi-Fi / LAN
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Správa připojených klientů pro reálný čas (Server-Sent Events)
const sseClients = new Set();

function broadcastOrders(orders) {
  const payload = `data: ${JSON.stringify(orders)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

// Periodický heartbeat pro udržení spojení na mobilních telefonech a tabletech
setInterval(() => {
  for (const client of sseClients) {
    try {
      client.write(': keepalive\n\n');
    } catch (err) {
      sseClients.delete(client);
    }
  }
}, 25000);

// Pomocná funkce pro bezpečné přečtení těla JSON požadavku
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Neplatný formát JSON: ' + err.message));
      }
    });
    req.on('error', reject);
  });
}

// Inicializace souborů při startu
initStorage();

const server = http.createServer(async (req, res) => {
  // CORS hlavičky pro případ komunikace z jiných domén / portů
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // ==========================================
  // API ENDPOINTY PRO SDÍLENÍ ÚČTENEK
  // ==========================================

  // 1. Real-time stream změn účtenek přes Server-Sent Events (SSE)
  if (pathname === '/api/orders/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(': connected\n\n');

    // Okamžitě odešleme aktuální stav
    const orders = readOrdersFile();
    res.write(`data: ${JSON.stringify(orders)}\n\n`);

    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // 2. GET /api/orders – Načtení všech účtenek ze serveru
  if (pathname === '/api/orders' && req.method === 'GET') {
    const orders = readOrdersFile();
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    res.end(JSON.stringify(orders));
    return;
  }

  // 3. POST /api/orders – Uložení účtenek (celé pole nebo přidání nové účtenky)
  if (pathname === '/api/orders' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      let orders = readOrdersFile();

      if (Array.isArray(body)) {
        orders = body;
      } else if (Array.isArray(body.orders)) {
        orders = body.orders;
      } else if (body && body.id) {
        // Jedna nová účtenka
        const existsIdx = orders.findIndex(o => o.id === body.id);
        if (existsIdx === -1) {
          orders.unshift(body);
        } else {
          orders[existsIdx] = body;
        }
      }

      writeOrdersFile(orders);
      broadcastOrders(orders);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, count: orders.length, orders }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 4. PUT /api/orders/:id – Úprava existující účtenky (např. storno nebo změna položek)
  if (pathname.startsWith('/api/orders/') && req.method === 'PUT') {
    const idStr = pathname.split('/api/orders/')[1];
    const orderId = Number(idStr) || idStr;
    try {
      const updatedFields = await readJsonBody(req);
      const orders = readOrdersFile();
      const idx = orders.findIndex(o => String(o.id) === String(orderId));

      if (idx !== -1) {
        orders[idx] = { ...orders[idx], ...updatedFields };
        writeOrdersFile(orders);
        broadcastOrders(orders);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, order: orders[idx] }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Účtenka nenalezena' }));
      }
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 5. DELETE /api/orders/:id – Trvalé smazání konkrétní účtenky
  if (pathname.startsWith('/api/orders/') && req.method === 'DELETE') {
    const idStr = pathname.split('/api/orders/')[1];
    const orderId = Number(idStr) || idStr;
    const orders = readOrdersFile();
    const filtered = orders.filter(o => String(o.id) !== String(orderId));

    writeOrdersFile(filtered);
    broadcastOrders(filtered);

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, count: filtered.length }));
    return;
  }

  // 6. DELETE /api/orders – Vynulování celé historie účtenek (nová směna)
  if (pathname === '/api/orders' && req.method === 'DELETE') {
    writeOrdersFile([]);
    broadcastOrders([]);

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, count: 0 }));
    return;
  }

  // Chybová odpověď pro neznámé API endpointy
  if (pathname.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'API endpoint nenalezen' }));
    return;
  }

  // ==========================================
  // STATICKÉ SOUBORY (HTML, CSS, JS, ...)
  // ==========================================
  let reqUrl = pathname;
  if (reqUrl === '/') reqUrl = '/index.html';

  const filePath = path.join(__dirname, reqUrl);

  // Ochrana proti přístupu mimo složku projektu
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Přístup odepřen');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>404: Soubor nenalezen</h1>');
      } else {
        res.writeHead(500);
        res.end(`Chyba serveru: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIpAddress();
  console.log('========================================================');
  console.log(' 🏫 Školní Bufet POS – Server úspěšně spuštěn!');
  console.log('========================================================');
  console.log(` 💻 Na tomto počítači:     http://localhost:${PORT}`);
  console.log(` 📱 Z tabletu nebo mobilu: http://${localIp}:${PORT}`);
  console.log(' 📡 Sdílení účtenek v síti: AKTIVNÍ (reálný čas SSE)');
  console.log(` 💾 Soubor databáze:       ${ORDERS_FILE}`);
  console.log('========================================================');
  console.log(' Pro ukončení stiskni Ctrl + C\n');
});
