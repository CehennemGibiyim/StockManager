'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { backupFileName, LATEST_COPY, RETENTION_DAYS, parseBackupDate, selectExpired } = require('./lib.cjs');

const MAX_BACKUP_BYTES = 256 * 1024 * 1024;
let cachedDir = null;

function appRoot() {
  // Paketlenmiş uygulamada exe'nin bulunduğu klasör, geliştirmede proje kökü.
  if (process.defaultApp || !process.versions.electron) return path.join(__dirname, '..');
  return path.dirname(process.execPath);
}

function candidateDirs(userDataDir) {
  const dirs = [];
  if (process.env.STOCKMANAGER_BACKUP_DIR) dirs.push(process.env.STOCKMANAGER_BACKUP_DIR);
  dirs.push(path.join(appRoot(), 'backups'));
  dirs.push(path.join(userDataDir || appRoot(), 'backups'));
  return dirs;
}

function isWritable(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.yazma-testi-${process.pid}`);
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return true;
  } catch (error) {
    return false;
  }
}

/** Kurulum klasöründeki backups dizini; yazılamıyorsa kullanıcı verisi klasörüne düşer. */
function resolveDir(userDataDir) {
  if (cachedDir) return cachedDir;
  for (const dir of candidateDirs(userDataDir)) {
    if (isWritable(dir)) {
      cachedDir = dir;
      return dir;
    }
  }
  cachedDir = path.join(userDataDir || appRoot(), 'backups');
  fs.mkdirSync(cachedDir, { recursive: true });
  return cachedDir;
}

function listBackups(userDataDir) {
  const dir = resolveDir(userDataDir);
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch (error) {
    return { dir, files: [] };
  }
  const files = names
    .map((name) => {
      const date = parseBackupDate(name);
      if (!date) return null;
      let size = 0;
      try {
        size = fs.statSync(path.join(dir, name)).size;
      } catch (error) {
        size = 0;
      }
      return { name, date: date.toISOString(), size };
    })
    .filter(Boolean)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return { dir, files };
}

/** Süresi dolan yedekleri siler (7 günden eski = 8. güne girenler). */
function prune(userDataDir, now = new Date()) {
  const dir = resolveDir(userDataDir);
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch (error) {
    return { removed: [], kept: 0 };
  }
  const expired = selectExpired(names, now, RETENTION_DAYS);
  const removed = [];
  for (const name of expired) {
    try {
      fs.unlinkSync(path.join(dir, name));
      removed.push(name);
    } catch (error) {
      /* kilitli dosyayı sonraki temizlikte tekrar deneriz */
    }
  }
  const kept = names.filter((name) => parseBackupDate(name) && !expired.includes(name)).length;
  return { removed, kept };
}

/**
 * Yedeği diske yazar: zaman damgalı dosya + latest.json kopyası.
 * Aynı saniye içinde ikinci yedek istenirse dosya adı çakışmasın diye sayaç eklenir.
 */
function saveBackup(payload, options = {}) {
  const dir = resolveDir(options.userDataDir);
  const now = options.now instanceof Date ? options.now : new Date();
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_BACKUP_BYTES) {
    throw new Error('Yedek içeriği çok büyük.');
  }
  const base = backupFileName(now);
  let name = base;
  let counter = 1;
  while (fs.existsSync(path.join(dir, name))) {
    name = base.replace(/\.json$/, `-${counter}.json`);
    counter += 1;
  }
  const target = path.join(dir, name);
  fs.writeFileSync(target, serialized, 'utf8');
  try {
    fs.writeFileSync(path.join(dir, LATEST_COPY), serialized, 'utf8');
  } catch (error) {
    /* latest kopyası kritik değil */
  }
  const { removed } = prune(options.userDataDir, now);
  return { dir, file: name, path: target, bytes: Buffer.byteLength(serialized, 'utf8'), removed };
}

function readBackup(name, userDataDir) {
  if (typeof name !== 'string' || name.includes('/') || name.includes('\\') || name.includes('..')) {
    throw new Error('Geçersiz yedek adı.');
  }
  const dir = resolveDir(userDataDir);
  const target = path.join(dir, name);
  if (!fs.existsSync(target)) throw new Error('Yedek bulunamadı.');
  return fs.readFileSync(target, 'utf8');
}

function readLatest(userDataDir) {
  try {
    return readBackup(LATEST_COPY, userDataDir);
  } catch (error) {
    return null;
  }
}

function resetCache() {
  cachedDir = null;
}

module.exports = {
  appRoot,
  resetCache,
  resolveDir,
  listBackups,
  prune,
  saveBackup,
  readBackup,
  readLatest
};
