/**
 * server.js
 * Lokální server pro Školní Bufet POS bez nutnosti externích knihoven (zero-dependencies).
 *
 * Zajišťuje:
 * 1. Sdílení a ukládání účtenek na serveru (soubor data/orders.json).
 * 2. Real-time synchronizaci mezi všemi zařízeními (mobily, tablety, PC) přes Server-Sent Events (SSE).
 * 3. REST API pro načítání, ukládání, úpravy, storno a mazání účtenek.
 * 4. Servírování statických souborů (HTML, CSS, JS, ikony).
 * 5. Autentizace: shared employee/admin password + JWT token v localStorage.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;

// Načtení .env souboru (bez externí knihovny)
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.slice(0, eqIndex).trim();
          const value = trimmed.slice(eqIndex + 1).trim();
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
  }
}
loadEnv();

// Generování/načtení JWT secret
function getOrCreateJwtSecret() {
  const envPath = path.join(__dirname, '.env');
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  const secret = crypto.randomBytes(32).toString('base64');
  const envLine = `\nJWT_SECRET=${secret}\n`;
  fs.appendFileSync(envPath, envLine);
  process.env.JWT_SECRET = secret;
  console.log('🔐 Vygenerován nový JWT_SECRET do .env');
  return secret;
}
const JWT_SECRET = getOrCreateJwtSecret();

// Hashování hesel (PBKDF2 - bez externích závislostí)
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha512';

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(password, storedHash) {
  const [saltHex, hashHex] = storedHash.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  return crypto.timingSafeEqual(Buffer.from(hashHex, 'hex'), hash);
}

// Inicializace/načtení hesel z .env
function initPasswords() {
  const envPath = path.join(__dirname, '.env');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }

  // Employee password
  let employeeHash = null;
  const empMatch = envContent.match(/^EMPLOYEE_PASSWORD_HASH=(.+)$/m);
  if (empMatch) {
    employeeHash = empMatch[1].trim();
  } else if (process.env.EMPLOYEE_PASSWORD) {
    employeeHash = hashPassword(process.env.EMPLOYEE_PASSWORD);
    fs.appendFileSync(envPath, `\nEMPLOYEE_PASSWORD_HASH=${employeeHash}\n`);
    console.log('🔐 Uložen hash zaměstnaneckého hesla do .env');
  }

  // Admin password
  let adminHash = null;
  const adminMatch = envContent.match(/^ADMIN_PASSWORD_HASH=(.+)$/m);
  if (adminMatch) {
    adminHash = adminMatch[1].trim();
  } else if (process.env.ADMIN_PASSWORD) {
    adminHash = hashPassword(process.env.ADMIN_PASSWORD);
    fs.appendFileSync(envPath, `\nADMIN_PASSWORD_HASH=${adminHash}\n`);
    console.log('🔐 Uložen hash admin hesla do .env');
  }

  // Výchozí hesla pokud nejsou nastavené
  if (!employeeHash) {
    const defaultEmp = 'bufet2024';
    employeeHash = hashPassword(defaultEmp);
    fs.appendFileSync(envPath, `\nEMPLOYEE_PASSWORD_HASH=${employeeHash}\n`);
    console.log(`⚠️  Výchozí heslo zaměstnance: ${defaultEmp} (změň v .env)`);
  }
  if (!adminHash) {
    const defaultAdmin = 'admin2024';
    adminHash = hashPassword(defaultAdmin);
    fs.appendFileSync(envPath, `\nADMIN_PASSWORD_HASH=${adminHash}\n`);
    console.log(`⚠️  Výchozí heslo admina: ${defaultAdmin} (změň v .env)`);
  }

  return { employeeHash, adminHash };
}

const { employeeHash: EMPLOYEE_PASSWORD_HASH, adminHash: ADMIN_PASSWORD_HASH } = initPasswords();

// ==========================================
// JWT FUNKCE (bez externích závislostí)
// ==========================================

function base64URLEncode(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64URLDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4;
  if (pad) str += '='.repeat(4 - pad);
  return Buffer.from(str, 'base64');
}

function createJWT(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64URLEncode(Buffer.from(JSON.stringify(header)));
  const encodedPayload = base64URLEncode(Buffer.from(JSON.stringify(payload)));

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();

  const encodedSignature = base64URLEncode(signature);
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

function verifyJWT(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Neplatný formát tokenu');

  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  // Ověření podpisu
  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();

  const providedSignature = base64URLDecode(encodedSignature);
  if (!crypto.timingSafeEqual(expectedSignature, providedSignature)) {
    throw new Error('Neplatný podpis tokenu');
  }

  const payload = JSON.parse(base64URLDecode(encodedPayload).toString('utf-8'));

  // Kontrola expirace
  if (payload.exp && Date.now() >= payload.exp * 1000) {
    throw new Error('Token vypršel');
  }

  return payload;
}

// Extrakce tokenu z Authorization header
function getTokenFromReq(req) {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

// Middleware: ověření JWT
function authenticate(req) {
  const token = getTokenFromReq(req);
  if (!token) return null;
  try {
    return verifyJWT(token);
  } catch {
    return null;
  }
}

// Middleware: vyžaduje admin roli
function requireAdmin(user) {
  return user && user.role === 'admin';
}

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
  // AUTH ENDPOINTY
  // ==========================================

  // POST /api/auth/login – Přihlášení s heslem
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const password = body.password?.trim();

      if (!password) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Heslo je povinné' }));
        return;
      }

      let role = null;
      if (verifyPassword(password, EMPLOYEE_PASSWORD_HASH)) {
        role = 'employee';
      } else if (verifyPassword(password, ADMIN_PASSWORD_HASH)) {
        role = 'admin';
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Neplatné heslo' }));
        return;
      }

      // Vytvoření JWT tokenu (expirace 30 dní)
      const payload = {
        role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
      };
      const token = createJWT(payload);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ token, role }));
      return;
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
  }

  // GET /api/auth/me – Ověření tokenu a vrácení role
  if (pathname === '/api/auth/me' && req.method === 'GET') {
    const user = authenticate(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Neplatný nebo chybějící token' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ role: user.role }));
    return;
  }

  // ==========================================
  // API ENDPOINTY PRO SDÍLENÍ ÚČTENEK
  // ==========================================

  // 1. Real-time stream změn účtenek přes Server-Sent Events (SSE) - vyžaduje přihlášení
  if (pathname === '/api/orders/events' && req.method === 'GET') {
    // Pro SSE token je v query parametru (EventSource nepodporuje headers)
    const token = parsedUrl.searchParams.get('token');
    let user = null;
    if (token) {
      try {
        user = verifyJWT(token);
      } catch {}
    }
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'text/event-stream; charset=utf-8' });
      res.end('data: {"error":"Neautorizováno"}\n\n');
      return;
    }

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

  // 2. GET /api/orders – Načtení všech účtenek ze serveru (vyžaduje přihlášení)
  if (pathname === '/api/orders' && req.method === 'GET') {
    const user = authenticate(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Neautorizováno' }));
      return;
    }
    const orders = await readOrdersFromDb();
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    res.end(JSON.stringify(orders));
    return;
  }

  // 3. POST /api/orders – Uložení účtenek (celé pole nebo přidání nové účtenky) - vyžaduje přihlášení
  if (pathname === '/api/orders' && req.method === 'POST') {
    const user = authenticate(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Neautorizováno' }));
      return;
    }
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

  // 4. PUT /api/orders/:id – Úprava existující účtenky (např. storno nebo změna položek) - vyžaduje přihlášení
  if (pathname.startsWith('/api/orders/') && req.method === 'PUT') {
    const user = authenticate(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Neautorizováno' }));
      return;
    }
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

  // 5. DELETE /api/orders/:id – Trvalé smazání konkrétní účtenky (vyžaduje admin)
  if (pathname.startsWith('/api/orders/') && req.method === 'DELETE') {
    const user = authenticate(req);
    if (!user || !requireAdmin(user)) {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Pouze pro administrátory' }));
      return;
    }
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

// 6. DELETE /api/orders – Vynulování celé historie účtenek (nová směna) - vyžaduje admin
  if (pathname === '/api/orders' && req.method === 'DELETE') {
    const user = authenticate(req);
    if (!user || !requireAdmin(user)) {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Pouze pro administrátory' }));
      return;
    }
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