'use strict';

const { app, BrowserWindow, shell, Menu } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

const webRoot = path.join(__dirname, '..', 'dist', 'web');
let server = null;
let mainWindow = null;

function createServer() {
  return new Promise((resolve, reject) => {
    const listener = http.createServer((request, response) => {
      let pathname = '/';
      try {
        pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      } catch (error) {
        response.writeHead(400).end('Bad request');
        return;
      }
      const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      let filePath = path.join(webRoot, relative);
      if (!filePath.startsWith(webRoot + path.sep) && filePath !== path.join(webRoot, 'index.html')) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        // SPA fallback: uzantısız yollar uygulama kabuğuna döner.
        filePath = path.join(webRoot, 'index.html');
      }
      fs.readFile(filePath, (error, data) => {
        if (error) {
          response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Bulunamadı');
          return;
        }
        response.writeHead(200, {
          'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-cache',
          'X-Content-Type-Options': 'nosniff'
        });
        response.end(data);
      });
    });
    listener.on('error', reject);
    listener.listen(0, '127.0.0.1', () => resolve(listener));
  });
}

function isLocal(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname);
  } catch (error) {
    return false;
  }
}

async function createWindow() {
  if (!server) {
    if (!fs.existsSync(path.join(webRoot, 'index.html'))) {
      const { dialog } = require('electron');
      dialog.showErrorBox('StockManager', 'Uygulama dosyaları bulunamadı. Lütfen kurulumu yeniden çalıştırın.');
      app.quit();
      return;
    }
    server = await createServer();
  }
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 620,
    show: false,
    backgroundColor: '#070b14',
    title: 'StockManager',
    icon: path.join(__dirname, '..', 'assets', 'brand', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  });

  Menu.setApplicationMenu(null);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isLocal(url)) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  await mainWindow.loadURL(origin + '/');
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(createWindow).catch((error) => {
    const { dialog } = require('electron');
    dialog.showErrorBox('StockManager başlatılamadı', String(error && error.message ? error.message : error));
    app.quit();
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('before-quit', () => {
    if (server) {
      server.close();
      server = null;
    }
  });
}
