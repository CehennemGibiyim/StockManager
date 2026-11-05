'use strict';

const { app, BrowserWindow, shell, Menu, ipcMain, dialog, session } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const backupStore = require('./backup.cjs');
const updater = require('./updater.cjs');
const { RETENTION_DAYS, backupFileName } = require('./lib.cjs');

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
  '.md': 'text/markdown; charset=utf-8',
  '.exe': 'application/octet-stream'
};

const DEFAULT_PORT = 4571;
const PORT_ATTEMPTS = 12;
const BRIDGE_ROUTE = '/__desktop/bridge.js';
const webRoot = path.join(__dirname, '..', 'dist', 'web');
const bridgeFile = path.join(__dirname, 'bridge.js');
const preloadFile = path.join(__dirname, 'preload.cjs');

let server = null;
let mainWindow = null;
let activePort = DEFAULT_PORT;
let quitting = false;
let pendingInstaller = null;

app.setAppUserModelId('com.cehennemgibiyim.stockmanager');

function userDataDir() {
  return app.getPath('userData');
}

function prefsFile() {
  return path.join(userDataDir(), 'preferences.json');
}

function readPrefs() {
  try {
    return JSON.parse(fs.readFileSync(prefsFile(), 'utf8'));
  } catch (error) {
    return {};
  }
}

function writePrefs(patch) {
  try {
    fs.mkdirSync(userDataDir(), { recursive: true });
    fs.writeFileSync(prefsFile(), JSON.stringify({ ...readPrefs(), ...patch }, null, 2), 'utf8');
  } catch (error) {
    /* tercihler kritik değil */
  }
}

/**
 * Sabit port: tarayıcı deposu origin'e bağlı olduğu için port her açılışta
 * değişirse veriler kaybolur. Portu tercih dosyasında saklayıp yeniden kullanırız.
 */
function listen(listener, port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      listener.removeListener('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      listener.removeListener('error', onError);
      resolve(listener.address().port);
    };
    listener.once('error', onError);
    listener.once('listening', onListening);
    listener.listen(port, '127.0.0.1');
  });
}

function injectBridge(html) {
  const tag = `<script src="${BRIDGE_ROUTE}"></script>`;
  if (html.includes(BRIDGE_ROUTE)) return html;
  return html.replace(/<\/body>/i, `  ${tag}\n</body>`);
}

function createServer() {
  const listener = http.createServer((request, response) => {
    let pathname = '/';
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    } catch (error) {
      response.writeHead(400).end('Bad request');
      return;
    }

    if (pathname === BRIDGE_ROUTE) {
      fs.readFile(bridgeFile, (error, data) => {
        if (error) {
          response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Bulunamadı');
          return;
        }
        response.writeHead(200, {
          'Content-Type': 'text/javascript; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        });
        response.end(data);
      });
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
      const headers = {
        'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      };
      if (path.basename(filePath) === 'index.html') {
        response.writeHead(200, headers);
        response.end(injectBridge(data.toString('utf8')));
        return;
      }
      response.writeHead(200, headers);
      response.end(data);
    });
  });
  return listener;
}

async function startServer() {
  const listener = createServer();
  const preferred = Number(readPrefs().port) || DEFAULT_PORT;
  const candidates = [preferred];
  for (let step = 1; step < PORT_ATTEMPTS; step += 1) candidates.push(DEFAULT_PORT + step);
  let lastError = null;
  for (const port of candidates) {
    try {
      const bound = await listen(listener, port);
      if (Number(readPrefs().port) !== bound) writePrefs({ port: bound });
      return { listener, port: bound };
    } catch (error) {
      lastError = error;
      if (error.code !== 'EADDRINUSE') break;
    }
  }
  const fallback = await listen(listener, 0);
  return { listener, port: fallback, error: lastError };
}

function isLocal(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname);
  } catch (error) {
    return false;
  }
}

function registerIpc() {
  ipcMain.handle('desktop:info', () => ({
    version: app.getVersion(),
    port: activePort,
    backupDir: backupStore.resolveDir(userDataDir()),
    retentionDays: RETENTION_DAYS,
    platform: process.platform
  }));

  ipcMain.handle('desktop:save-backup', (_event, payload) => {
    const result = backupStore.saveBackup(payload && payload.data, {
      userDataDir: userDataDir(),
      reason: (payload && payload.reason) || 'auto'
    });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('desktop:backup-saved', {
        file: result.file,
        dir: result.dir,
        bytes: result.bytes,
        removed: result.removed.length
      });
    }
    return result;
  });

  ipcMain.handle('desktop:list-backups', () => backupStore.listBackups(userDataDir()));

  ipcMain.handle('desktop:read-backup', (_event, payload) => (
    backupStore.readBackup(payload && payload.name, userDataDir())
  ));

  ipcMain.handle('desktop:read-latest', () => backupStore.readLatest(userDataDir()));

  ipcMain.handle('desktop:open-backup-folder', async () => {
    const dir = backupStore.resolveDir(userDataDir());
    await shell.openPath(dir);
    return dir;
  });

  ipcMain.handle('desktop:check-updates', async () => {
    try {
      return await updater.checkForUpdates({
        currentVersion: app.getVersion(),
        skippedVersion: readPrefs().skippedVersion || null
      });
    } catch (error) {
      return { error: 'Güncelleme sunucusuna ulaşılamadı.', details: error.details || [] };
    }
  });

  ipcMain.handle('desktop:skip-version', (_event, payload) => {
    const version = payload && payload.version ? String(payload.version) : null;
    if (version) writePrefs({ skippedVersion: version });
    return { skippedVersion: version };
  });

  ipcMain.handle('desktop:open-releases', () => shell.openExternal(updater.RELEASES_PAGE));

  ipcMain.handle('desktop:install-update', async (_event, payload) => {
    const url = payload && payload.url;
    if (!url || !updater.isTrustedDownloadUrl(url) || !/\.exe(?:$|[?#])/i.test(String(url))) {
      return { ok: false, error: 'Kurulum paketi adresi geçersiz.' };
    }
    const fileName = path.basename(new URL(url).pathname);
    const destination = updater.installerPathFor(fileName);
    try {
      await updater.downloadInstaller(url, destination, (percent) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('desktop:update-progress', { percent });
        }
      });
      const openResult = await shell.openPath(destination);
      if (openResult) return { ok: false, error: openResult };
      writePrefs({ skippedVersion: null, installedAt: new Date().toISOString() });
      // NSIS kurulumu uygulamanın kapanmasını bekler; kurulum açıldıktan sonra çık.
      setTimeout(() => app.quit(), 1400);
      return { ok: true, path: destination };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
}

async function createWindow() {
  if (!server) {
    if (!fs.existsSync(path.join(webRoot, 'index.html'))) {
      dialog.showErrorBox('StockManager', 'Uygulama dosyaları bulunamadı. Lütfen kurulumu yeniden çalıştırın.');
      app.quit();
      return;
    }
    const started = await startServer();
    server = started.listener;
    activePort = started.port;
  }
  const origin = `http://127.0.0.1:${activePort}`;

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
      preload: preloadFile,
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

/**
 * Dosya indirmeleri (uygulamanın "Yedek al" çıktısı) kurulum klasöründeki
 * backups dizinine yazılır; 7 günden eski dosyalar temizlenir.
 */
function registerDownloadRedirect() {
  session.defaultSession.on('will-download', (event, item) => {
    const name = item.getFilename() || backupFileName();
    if (!/\.json$/i.test(name)) return;
    const dir = backupStore.resolveDir(userDataDir());
    try {
      item.setSavePath(path.join(dir, name));
    } catch (error) {
      /* varsayılan indirme davranışına bırak */
    }
    item.once('done', () => {
      try {
        backupStore.prune(userDataDir());
      } catch (error) {
        /* temizlik sonraki açılışta tekrar denenir */
      }
    });
  });
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

  app.whenReady().then(async () => {
    registerDownloadRedirect();
    registerIpc();
    try {
      backupStore.prune(userDataDir());
    } catch (error) {
      /* yoksay */
    }
    await createWindow();
  }).catch((error) => {
    dialog.showErrorBox('StockManager başlatılamadı', String(error && error.message ? error.message : error));
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', (event) => {
    if (quitting) return;
    quitting = true;
    event.preventDefault();
    const window = mainWindow;
    try {
      if (window && !window.isDestroyed()) window.webContents.send('desktop:flush-request', {});
    } catch (error) {
      /* pencere yoksa doğrudan kapat */
    }
    setTimeout(() => {
      if (server) {
        try {
          server.close();
        } catch (error) {
          /* yoksay */
        }
        server = null;
      }
      app.exit(0);
    }, 900);
  });
}
