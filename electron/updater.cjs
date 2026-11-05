'use strict';

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { compareVersions, shouldOfferUpdate } = require('./lib.cjs');

const REPO = 'CehennemGibiyim/StockManager';
const SOURCES = [
  `https://raw.githubusercontent.com/${REPO}/main/version.json`,
  `https://github.com/${REPO}/releases/latest/download/latest.json`
];
const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;
const TIMEOUT_MS = 9000;

function fetchJson(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      timeout: TIMEOUT_MS,
      headers: { 'User-Agent': 'StockManager-Updater', 'Cache-Control': 'no-cache' }
    }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location && redirects < 5) {
        response.resume();
        resolve(fetchJson(new URL(response.headers.location, url).toString(), redirects + 1));
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
        if (body.length > 512 * 1024) request.destroy(new Error('Yanıt çok büyük.'));
      });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error('Sürüm bilgisi okunamadı.'));
        }
      });
    });
    request.on('timeout', () => request.destroy(new Error('Zaman aşımı.')));
    request.on('error', reject);
  });
}

/** GitHub'daki en güncel sürüm bilgisini getirir. */
async function fetchLatestVersion() {
  const errors = [];
  for (const url of SOURCES) {
    try {
      const data = await fetchJson(url);
      if (!data || !data.version) throw new Error('Sürüm alanı yok.');
      return {
        version: String(data.version),
        releasedAt: data.releasedAt || null,
        notes: Array.isArray(data.notes) ? data.notes.filter((note) => typeof note === 'string') : [],
        installerUrl: (data.installer && data.installer.url) || RELEASES_PAGE,
        installerFile: (data.installer && data.installer.file) || null,
        source: url
      };
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
    }
  }
  const error = new Error('Güncelleme sunucusuna ulaşılamadı.');
  error.details = errors;
  throw error;
}

/**
 * Güncelleme denetimi.
 * Ara sürümler atlanır: 1.0.0 kuruluysa doğrudan 1.4.0'a geçilir.
 */
async function checkForUpdates({ currentVersion, skippedVersion = null }) {
  const latest = await fetchLatestVersion();
  return {
    current: currentVersion,
    latest: latest.version,
    releasedAt: latest.releasedAt,
    notes: latest.notes,
    installerUrl: latest.installerUrl,
    installerFile: latest.installerFile,
    updateAvailable: shouldOfferUpdate({ latest: latest.version, current: currentVersion, skippedVersion }),
    skipped: Boolean(skippedVersion) && compareVersions(latest.version, skippedVersion) <= 0
  };
}

/** Kurulum paketini indirir; yüzde bilgisini callback ile bildirir. */
function downloadInstaller(url, destination, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'StockManager-Updater' } }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.resume();
        resolve(downloadInstaller(new URL(response.headers.location, url).toString(), destination, onProgress));
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`İndirme başarısız (HTTP ${response.statusCode}).`));
        return;
      }
      const total = Number(response.headers['content-length'] || 0);
      let received = 0;
      const file = fs.createWriteStream(destination);
      response.on('data', (chunk) => {
        received += chunk.length;
        if (total) onProgress(Math.min(100, Math.round((received / total) * 100)));
      });
      response.pipe(file);
      file.on('finish', () => file.close(() => resolve(destination)));
      file.on('error', reject);
    });
    request.on('timeout', () => request.destroy(new Error('İndirme zaman aşımına uğradı.')));
    request.on('error', reject);
  });
}

function installerPathFor(fileName) {
  const safe = String(fileName || 'StockManager-Setup.exe').replace(/[^\w.\-]/g, '');
  return path.join(require('node:os').tmpdir(), safe);
}

module.exports = {
  REPO,
  RELEASES_PAGE,
  fetchLatestVersion,
  checkForUpdates,
  downloadInstaller,
  installerPathFor
};
