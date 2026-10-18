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
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;

// Připojení k SQL databázi (Supabase) přes proměnnou DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Inicializace databázové tabulky při startu
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('💾 SQL databázová tabulka "orders" je připravená.');
  } catch (err) {
    console.error('Chyba při inicializaci SQL databáze:', err.message);
  }
}

initDatabase();

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

// Načtení účtenek z databáze
async function readOrdersFromDb() {
  try {
    const result = await pool.query('SELECT data FROM orders ORDER BY created_at DESC');
    return result.rows.map(row => row.data);
  } catch (err) {
    console.error('Chyba při čtení z databáze:', err.message);
    return [];
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
    const orders = await readOrdersFromDb();
    res.write(`data: ${JSON.stringify(orders)}\n\n`);

    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // 2. GET /api/orders – Načtení všech účtenek ze serveru
  if (pathname === '/api/orders' && req.method === 'GET') {
    const orders = await readOrdersFromDb();
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

      if (Array.isArray(body)) {
        for (const order of body) {
          if (order && order.id) {
            await pool.query(
              `INSERT INTO orders (id, data) VALUES ($1, $2)
               ON CONFLICT (id) DO UPDATE SET data = $2`,
              [String(order.id), JSON.stringify(order)]
            );
          }
        }
      } else if (Array.isArray(body.orders)) {
        for (const order of body.orders) {
          if (order && order.id) {
            await pool.query(
              `INSERT INTO orders (id, data) VALUES ($1, $2)
               ON CONFLICT (id) DO UPDATE SET data = $2`,
              [String(order.id), JSON.stringify(order)]
            );
          }
        }
      } else if (body && body.id) {
        await pool.query(
          `INSERT INTO orders (id, data) VALUES ($1, $2)
           ON CONFLICT (id) DO UPDATE SET data = $2`,
          [String(body.id), JSON.stringify(body)]
        );
      }

      const orders = await readOrdersFromDb();
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
    const orderId = String(Number(idStr) || idStr);
    try {
      const updatedFields = await readJsonBody(req);
      const orders = await readOrdersFromDb();
      const existingOrder = orders.find(o => String(o.id) === orderId);

      if (existingOrder) {
        const mergedOrder = { ...existingOrder, ...updatedFields };
        await pool.query(
          `UPDATE orders SET data = $1 WHERE id = $2`,
          [JSON.stringify(mergedOrder), orderId]
        );

        const updatedOrders = await readOrdersFromDb();
        broadcastOrders(updatedOrders);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, order: mergedOrder }));
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
    const orderId = String(Number(idStr) || idStr);
    try {
      await pool.query('DELETE FROM orders WHERE id = $1', [orderId]);
      const orders = await readOrdersFromDb();
      broadcastOrders(orders);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(orders)); // pošleme aktuální pole účtenek
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }
// zmena

// 6. DELETE /api/orders – Vynulování celé historie účtenek (nová směna)
  if (pathname === '/api/orders' && req.method === 'DELETE') {
    try {
      await pool.query('DELETE FROM orders');
      broadcastOrders([]);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify([])); // Vracíme prázdné pole, aby frontend hned pochopil, že je prázdno
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
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
  console.log(' 💾 Databáze:             Supabase (PostgreSQL)');
  console.log('========================================================');
  console.log(' Pro ukončení stiskni Ctrl + C\n');
});