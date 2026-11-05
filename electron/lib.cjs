'use strict';

/**
 * Electron ana süreci ve testler için saf yardımcılar.
 * Bu dosya `electron` modülünü kullanmaz; Node ile doğrudan test edilebilir.
 */

const BACKUP_PREFIX = 'StockManager-yedek-';
const LATEST_COPY = 'latest.json';
const RETENTION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function pad(value) {
  return String(value).padStart(2, '0');
}

/** Yerel saatle YYYY-MM-DD_HH-mm-ss damgası. */
function stamp(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + '_' + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join('-');
}

function backupFileName(date = new Date()) {
  return `${BACKUP_PREFIX}${stamp(date)}.json`;
}

/** Yedek dosya adından tarihi çözer; uymayan adlar için null döner. */
function parseBackupDate(name) {
  if (typeof name !== 'string') return null;
  const match = name.match(/^StockManager-yedek-(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.json$/);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match.map(Number);
  const date = new Date(y, mo - 1, d, h, mi, s);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Saklama süresini aşan yedekleri seçer.
 * 7 günlük yedekler korunur, 8. güne giren (yaşı 7 günü aşan) dosyalar silinir.
 */
function selectExpired(names, now = new Date(), retentionDays = RETENTION_DAYS) {
  const limit = retentionDays * DAY_MS;
  const reference = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return names.filter((name) => {
    const date = parseBackupDate(name);
    if (!date) return false;
    return reference - date.getTime() > limit;
  });
}

/** "1.2.10" > "1.2.9" gibi sayısal karşılaştırma; ön ek ve etiketleri yok sayar. */
function parseVersion(value) {
  const cleaned = String(value || '').trim().replace(/^v/i, '').split(/[-+]/)[0];
  const parts = cleaned.split('.').map((part) => {
    const number = Number.parseInt(part, 10);
    return Number.isFinite(number) ? number : 0;
  });
  while (parts.length < 3) parts.push(0);
  return parts.slice(0, 3);
}

/** latest > current ise 1, eşitse 0, küçükse -1 döner. */
function compareVersions(latest, current) {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] > b[index]) return 1;
    if (a[index] < b[index]) return -1;
  }
  return 0;
}

/**
 * Güncelleme teklif edilmeli mi?
 * - En son sürüm kuruludan yeniyse (ara sürümler atlanır, doğrudan en yenisine geçilir)
 * - Kullanıcı bu sürümü atlamadıysa
 */
function shouldOfferUpdate({ latest, current, skippedVersion = null }) {
  if (!latest || !current) return false;
  if (compareVersions(latest, current) <= 0) return false;
  if (skippedVersion && compareVersions(latest, skippedVersion) <= 0) return false;
  return true;
}

module.exports = {
  BACKUP_PREFIX,
  LATEST_COPY,
  RETENTION_DAYS,
  DAY_MS,
  stamp,
  backupFileName,
  parseBackupDate,
  selectExpired,
  parseVersion,
  compareVersions,
  shouldOfferUpdate
};
