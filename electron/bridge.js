'use strict';

/**
 * Yalnızca masaüstü (Electron) sürümünde çalışır.
 * Ana süreç bu dosyayı index.html'e enjekte eder; web sürümünde hiç yüklenmez.
 */
(function () {
  const desktop = window.stockManagerDesktop;
  if (!desktop || !desktop.isDesktop) return;

  const STORAGE_KEY = 'stockmanager-data-v1';
  const LEGACY_KEY = 'stokpilot-data-v1';
  const AUTOSAVE_MS = 5 * 60 * 1000;
  const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
  const PREF_KEY = 'stockmanager:desktop-prefs';

  let lastHash = null;
  let lastAutoSave = 0;
  let busy = false;
  let startupSaved = false;
  let closeSavedAt = 0;

  function readData() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY) || window.localStorage.getItem(LEGACY_KEY);
      if (!raw) return null;
      JSON.parse(raw);
      return raw;
    } catch (error) {
      return null;
    }
  }

  function hash(text) {
    let value = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      value ^= text.charCodeAt(index);
      value = Math.imul(value, 16777619);
    }
    return `${text.length}:${value >>> 0}`;
  }

  function prefs() {
    try {
      return JSON.parse(window.localStorage.getItem(PREF_KEY) || '{}');
    } catch (error) {
      return {};
    }
  }

  function savePrefs(patch) {
    try {
      window.localStorage.setItem(PREF_KEY, JSON.stringify({ ...prefs(), ...patch }));
    } catch (error) {
      /* tercih kaydı kritik değil */
    }
  }

  function toast(message, tone) {
    const node = document.createElement('div');
    node.textContent = message;
    node.style.cssText = [
      'position:fixed', 'left:50%', 'bottom:28px', 'transform:translateX(-50%)',
      'z-index:2147483000', 'padding:12px 18px', 'border-radius:12px',
      'font:500 13px/1.4 Inter,system-ui,sans-serif', 'max-width:min(520px,90vw)',
      'box-shadow:0 18px 40px rgba(0,0,0,.45)', 'transition:opacity .2s ease',
      `background:${tone === 'error' ? '#3b1220' : '#0f1b2d'}`,
      `color:${tone === 'error' ? '#ffb4c4' : '#d7e6ff'}`,
      'border:1px solid rgba(120,180,255,.25)', 'pointer-events:none'
    ].join(';');
    document.body.appendChild(node);
    window.setTimeout(() => {
      node.style.opacity = '0';
      window.setTimeout(() => node.remove(), 250);
    }, 3200);
  }

  async function saveStartupBackup() {
    if (startupSaved) return;
    const result = await pushBackup('startup');
    startupSaved = Boolean(result);
  }

  function saveCloseBackup() {
    // pagehide, beforeunload ve ana süreçteki flush isteği aynı kapanışta gelebilir.
    if (Date.now() - closeSavedAt < 2500) return;
    closeSavedAt = Date.now();
    pushBackup('close');
  }

  async function pushBackup(reason) {
    const data = readData();
    if (!data) return null;
    const stamp = hash(data);
    if (reason === 'auto' && stamp === lastHash) return null;
    try {
      const result = await desktop.saveBackup(data, reason);
      lastHash = stamp;
      lastAutoSave = Date.now();
      renderBackupStatus(result);
      if (reason === 'manual') toast(`Yedek kaydedildi: ${result.dir}`);
      return result;
    } catch (error) {
      if (reason === 'manual') toast(`Yedek yazılamadı: ${error.message}`, 'error');
      return null;
    }
  }

  /* ---------------- Yedekleme arayüzü ---------------- */

  let backupStatusNode = null;

  function renderBackupStatus(result) {
    if (!backupStatusNode) return;
    const when = result && result.file
      ? result.file.replace('StockManager-yedek-', '').replace('.json', '').replace('_', ' ')
      : null;
    const text = backupStatusNode.querySelector('[data-role="backup-text"]');
    const pathNode = backupStatusNode.querySelector('[data-role="backup-path"]');
    if (result) pathNode.textContent = result.dir;
    if (text) {
      text.textContent = when
        ? `Son yedek: ${when} · 7 gün saklanır, 8. güne giren dosyalar otomatik silinir.`
        : 'Otomatik yedekleme açık: kapanışta ve 5 dakikada bir kurulum klasörüne yazılır.';
    }
  }

  function buildBackupPanel() {
    const view = document.querySelector('#view-backup');
    if (!view || document.querySelector('#desktopBackupCard')) return;

    const card = document.createElement('article');
    card.className = 'panel-card';
    card.id = 'desktopBackupCard';
    card.style.marginTop = '16px';
    card.innerHTML = `
      <div class="card-heading" style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
        <div>
          <h2>Otomatik yedek (Windows)</h2>
          <p data-role="backup-text">Otomatik yedekleme açık: kapanışta ve 5 dakikada bir kurulum klasörüne yazılır.</p>
        </div>
        <span class="version-chip">7 gün</span>
      </div>
      <p class="release-hint" style="margin:8px 0 14px">Klasör: <code data-role="backup-path">—</code></p>
      <div class="release-actions" style="display:flex;flex-wrap:wrap;gap:10px">
        <button class="primary-button" type="button" data-desktop-action="backup-now">Şimdi yedekle</button>
        <button class="secondary-button" type="button" data-desktop-action="open-folder">Yedek klasörünü aç</button>
        <button class="secondary-button" type="button" data-desktop-action="restore">Yedekten geri yükle</button>
      </div>`;
    view.appendChild(card);
    backupStatusNode = card;

    card.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-desktop-action]');
      if (!button) return;
      const action = button.dataset.desktopAction;
      if (action === 'backup-now') {
        button.disabled = true;
        const result = await pushBackup('manual');
        button.disabled = false;
        if (!result) toast('Yazacak veri bulunamadı.', 'error');
        return;
      }
      if (action === 'open-folder') {
        await desktop.openBackupFolder();
        return;
      }
      if (action === 'restore') {
        await openRestoreDialog();
      }
    });
  }

  function formatSize(bytes) {
    if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes > 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} B`;
  }

  async function openRestoreDialog() {
    const { files } = await desktop.listBackups();
    if (!files.length) {
      toast('Henüz dosya yedeği yok.', 'error');
      return;
    }
    const chosen = window.prompt(
      ['Geri yüklemek için numara yazın:', ...files.slice(0, 12).map((file, index) => (
        `${index + 1}) ${file.name.replace('StockManager-yedek-', '').replace('.json', '')} · ${formatSize(file.size)}`
      ))].join('\n'),
      '1'
    );
    if (!chosen) return;
    const index = Number.parseInt(chosen, 10) - 1;
    const file = files[index];
    if (!file) {
      toast('Geçersiz seçim.', 'error');
      return;
    }
    const raw = await desktop.readBackup(file.name);
    if (!window.confirm(`Bu yedek mevcut verilerin üzerine yazacak.\n\n${file.name}\n\nDevam edilsin mi?`)) return;
    window.localStorage.setItem(STORAGE_KEY, raw);
    window.location.reload();
  }

  /* ---------------- Güncelleme arayüzü ---------------- */

  let updateButton = null;
  let updateStatus = null;
  let lastResult = null;

  function buildUpdatePanel() {
    const card = document.querySelector('#releaseCard');
    if (!card || document.querySelector('#desktopUpdateRow')) return;
    const row = document.createElement('div');
    row.id = 'desktopUpdateRow';
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:12px';
    row.innerHTML = `
      <button class="secondary-button" type="button" data-desktop-action="check-updates">Güncellemeleri denetle</button>
      <span data-role="update-status" style="font:500 12px/1.5 Inter,system-ui,sans-serif;color:#8fa4c4"></span>`;
    card.appendChild(row);
    updateButton = row.querySelector('[data-desktop-action="check-updates"]');
    updateStatus = row.querySelector('[data-role="update-status"]');

    row.addEventListener('click', (event) => {
      if (event.target.closest('[data-desktop-action="check-updates"]')) checkUpdates({ manual: true });
    });
  }

  async function checkUpdates({ manual = false } = {}) {
    if (busy) return;
    busy = true;
    if (manual && updateButton) {
      updateButton.disabled = true;
      updateStatus.textContent = 'Denetleniyor…';
    }
    try {
      const result = await desktop.checkUpdates();
      lastResult = result;
      savePrefs({ lastCheck: Date.now() });
      if (result.error) {
        if (updateStatus) updateStatus.textContent = 'Güncelleme sunucusuna ulaşılamadı.';
        if (manual) toast(result.error, 'error');
      } else if (result.updateAvailable) {
        if (updateStatus) updateStatus.textContent = `v${result.latest} hazır (kurulu v${result.current}).`;
        openUpdateDialog(result);
      } else {
        if (updateStatus) updateStatus.textContent = `En son sürümü kullanıyorsunuz (v${result.current}).`;
        if (manual) toast(`En son sürümü kullanıyorsunuz (v${result.current}).`);
      }
    } catch (error) {
      if (updateStatus) updateStatus.textContent = 'Güncelleme denetlenemedi.';
      if (manual) toast(`Güncelleme denetlenemedi: ${error.message}`, 'error');
    } finally {
      busy = false;
      if (updateButton) updateButton.disabled = false;
    }
  }

  function openUpdateDialog(result) {
    document.querySelector('#desktopUpdateDialog')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'desktopUpdateDialog';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(4,8,16,.72);padding:24px';
    const notes = (result.notes || []).slice(0, 8).map((note) => `<li style="margin:4px 0">${escapeHtml(note)}</li>`).join('');
    overlay.innerHTML = `
      <div role="dialog" aria-modal="true" style="width:min(560px,100%);background:#0b1220;border:1px solid rgba(120,180,255,.25);border-radius:18px;padding:24px;color:#dbe7ff;font:400 14px/1.6 Inter,system-ui,sans-serif;box-shadow:0 30px 80px rgba(0,0,0,.55)">
        <h2 style="margin:0 0 6px;font:600 20px/1.3 'Space Grotesk',Inter,sans-serif">Yeni sürüm hazır: v${escapeHtml(result.latest)}</h2>
        <p style="margin:0 0 12px;color:#8fa4c4">Kurulu sürüm v${escapeHtml(result.current)} · Ara sürümler atlanır, doğrudan en yeni sürüme geçilir.</p>
        ${notes ? `<ul style="margin:0 0 16px;padding-left:18px;max-height:180px;overflow:auto">${notes}</ul>` : ''}
        <div style="display:flex;flex-wrap:wrap;gap:10px">
          <button class="primary-button" type="button" data-choice="install">İndir ve kur</button>
          <button class="secondary-button" type="button" data-choice="skip">Bu sürümü atla</button>
          <button class="secondary-button" type="button" data-choice="later">Sonra</button>
        </div>
        <p data-role="progress" style="margin:12px 0 0;color:#8fa4c4;font-size:12px"></p>
      </div>`;
    document.body.appendChild(overlay);
    const progress = overlay.querySelector('[data-role="progress"]');

    overlay.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-choice]');
      if (!button) {
        if (event.target === overlay) overlay.remove();
        return;
      }
      const choice = button.dataset.choice;
      if (choice === 'later') {
        overlay.remove();
        return;
      }
      if (choice === 'skip') {
        await desktop.skipVersion(result.latest);
        if (updateStatus) updateStatus.textContent = `v${result.latest} atlandı. Daha yeni sürüm çıktığında tekrar sorulur.`;
        overlay.remove();
        toast(`v${result.latest} atlandı.`);
        return;
      }
      button.disabled = true;
      progress.textContent = 'Kurulum paketi indiriliyor…';
      const unsubscribe = typeof desktop.onUpdateProgress === 'function'
        ? desktop.onUpdateProgress(({ percent }) => {
          progress.textContent = `Kurulum paketi indiriliyor… %${Math.max(0, Math.min(100, Number(percent) || 0))}`;
        })
        : () => {};
      const outcome = await desktop.installUpdate(result.installerUrl);
      unsubscribe();
      if (outcome && outcome.ok) {
        progress.textContent = 'Kurulum başlatıldı. Uygulama kapanacak.';
      } else {
        progress.textContent = (outcome && outcome.error) || 'İndirme başarısız.';
        button.disabled = false;
        toast('Güncelleme indirilemedi.', 'error');
      }
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
  }

  /* ---------------- Otomatik geri yükleme ---------------- */

  async function restoreIfEmpty() {
    if (window.sessionStorage.getItem('sm-desktop-restored')) return;
    const existing = readData();
    if (existing) return;
    const latest = await desktop.readLatest();
    if (!latest) return;
    let parsed = null;
    try {
      parsed = JSON.parse(latest);
    } catch (error) {
      return;
    }
    if (!parsed || !Array.isArray(parsed.products)) return;
    window.sessionStorage.setItem('sm-desktop-restored', '1');
    window.localStorage.setItem(STORAGE_KEY, latest);
    window.location.reload();
  }

  /* ---------------- Olaylar ---------------- */

  function init() {
    buildBackupPanel();
    buildUpdatePanel();
    desktop.listBackups().then(({ dir, files }) => {
      renderBackupStatus(files.length ? { dir, file: files[0].name } : { dir, file: null });
    }).catch(() => {});

    // Uygulama verisi hazır olduğunda (veya geç kalırsa 4 saniye sonra) ilk yedeği al.
    window.addEventListener('stockapp:ready', saveStartupBackup, { once: true });
    window.setTimeout(saveStartupBackup, 4000);

    restoreIfEmpty().then(() => {
      const stored = prefs().lastCheck || 0;
      if (Date.now() - stored > CHECK_INTERVAL_MS) {
        window.setTimeout(() => checkUpdates({ manual: false }), 5000);
      }
    }).catch(() => {});

    window.setInterval(() => pushBackup('auto'), AUTOSAVE_MS);
    document.addEventListener('pagehide', saveCloseBackup);
    window.addEventListener('beforeunload', saveCloseBackup);
    desktop.onFlushRequest(saveCloseBackup);

    // Uygulamanın kendi "Yedek al" düğmesi: indirme yerine klasöre yaz.
    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('.backup-export');
      if (!trigger) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      pushBackup('manual');
    }, true);

    // Görünüm değişince yedek paneli yeniden kurulabilsin.
    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-view]')) window.setTimeout(buildBackupPanel, 60);
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
