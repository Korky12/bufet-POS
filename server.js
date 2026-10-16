/**
 * server.js
 * Jednoduchý lokální server pro Školní Bufet POS bez nutnosti instalovat externí balíčky (zero-dependencies).
 * 
 * Spuštění:
 *   node server.js
 * 
 * Umožňuje otevřít pokladnu jak na tomto počítači, tak z tabletu nebo mobilu na stejné Wi-Fi.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3000;

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

// Zjištění lokální IP adresy počítače v síti Wi-Fi / LAN
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      // Přeskočíme interní a IPv6 adresy
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const server = http.createServer((req, res) => {
  // Bezpečné sestavení cesty k souboru
  let reqUrl = req.url.split('?')[0];
  if (reqUrl === '/') reqUrl = '/index.html';

  const filePath = path.join(__dirname, reqUrl);

  // Ochrana proti přístupu mimo složku
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
  console.log(` 💻 Na tomto počítači:    http://localhost:${PORT}`);
  console.log(` 📱 Z tabletu nebo mobilu: http://${localIp}:${PORT}`);
  console.log('========================================================');
  console.log(' Pro ukončení stiskni Ctrl + C\n');
});
