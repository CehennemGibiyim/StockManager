/* StockManager yardım merkezi: resimli kılavuzlar, sesli rehber turu ve sürüm notları. */
(function () {
  'use strict';

  const REPO = 'https://github.com/CehennemGibiyim/StockManager';
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  let guides = [];
  let version = null;
  let activeGuide = null;
  let activeStep = 0;
  let tour = null;
  let tourIndex = 0;
  let tourPlaying = false;
  let tourVoice = true;
  let tourTimer = 0;
  let tourToken = 0;
  let muted = false;

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
    }
  }

  function icon(name) {
    return `<i data-lucide="${esc(name)}"></i>`;
  }

  function switchView(view) {
    if (!view) return;
    const button = $(`.nav-item[data-view="${view}"]`) || $(`[data-view="${view}"]`);
    if (button) button.click();
  }

  function openHelpView() {
    switchView('help');
  }

  /* ---------- Sürüm bilgisi ---------- */
  async function loadVersion() {
    try {
      const response = await fetch('./version.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('version');
      version = await response.json();
    } catch (error) {
      version = { version: '1.0.0', notes: [], installer: null };
    }
    applyVersion();
  }

  function applyVersion() {
    if (!version) return;
    const label = `v${version.version}`;
    $$('#appVersion, #footerVersion, #releaseVersion').forEach((node) => {
      node.textContent = label;
    });
    const list = $('#versionNotesList');
    if (list && Array.isArray(version.notes) && version.notes.length) {
      list.innerHTML = version.notes.map((note) => `<li>${esc(note)}</li>`).join('');
    }
    const download = $('#downloadInstaller');
    if (download) {
      const url = version.installer && version.installer.url
        ? version.installer.url
        : `${REPO}/releases/latest`;
      download.href = url;
    }
    const hint = $('#releaseHint');
    if (hint && version.releasedAt) {
      hint.textContent = `Sürüm ${label} · ${version.releasedAt} · Kurulum paketi GitHub Releases sayfasından indirilir. Verileriniz bilgisayarınızda kalır.`;
    }
  }

  /* ---------- Resimli kılavuzlar ---------- */
  async function loadGuides() {
    const grid = $('#helpGuideGrid');
    try {
      const response = await fetch('./help/guides.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error('guides');
      const payload = await response.json();
      guides = Array.isArray(payload.guides) ? payload.guides : [];
      tour = Array.isArray(payload.tour) ? payload.tour : [];
    } catch (error) {
      guides = [];
      tour = [];
    }
    if (!grid) return;
    if (!guides.length) {
      grid.innerHTML = '<p class="help-empty">Kılavuzlar yüklenemedi. Sayfayı yenileyip tekrar deneyin.</p>';
      return;
    }
    grid.innerHTML = guides.map((guide) => `
      <article class="help-guide-card" data-guide="${esc(guide.id)}" tabindex="0" role="button" aria-label="${esc(guide.title)} kılavuzunu aç">
        <div class="help-guide-thumb">
          <img src="${esc(guide.image)}" alt="${esc(guide.title)} ekran görüntüsü" loading="lazy">
          <span class="guide-count">${icon('image')}${guide.steps.length} adım</span>
        </div>
        <div class="help-guide-body">
          <span class="help-guide-tag">${esc(guide.tag)}</span>
          <h3>${esc(guide.title)}</h3>
          <p>${esc(guide.summary)}</p>
          <div class="help-guide-actions"><span>${icon('book-open')}Kılavuzu aç</span>${icon('arrow-up-right')}</div>
        </div>
      </article>`).join('');
    refreshIcons();
    $$('[data-guide]', grid).forEach((card) => {
      const open = () => openGuide(card.dataset.guide);
      card.addEventListener('click', open);
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      });
    });
    updateTourDuration();
  }

  function updateTourDuration() {
    const label = $('.tour-duration span');
    if (label && tour.length) label.textContent = `~90 saniye · ${tour.length} adım`;
  }

  function openGuide(id) {
    const guide = guides.find((item) => item.id === id);
    const backdrop = $('#guideModalBackdrop');
    if (!guide || !backdrop) return;
    activeGuide = guide;
    activeStep = 0;
    $('#guideModalTitle').textContent = guide.title;
    const image = $('#guideModalImage');
    image.src = guide.image;
    image.alt = `${guide.title} ekran görüntüsü`;
    $('#guideMarkers').innerHTML = guide.steps.map((step, index) => `
      <button class="guide-marker" type="button" style="left:${Number(step.x)}%;top:${Number(step.y)}%" data-step="${index}" aria-label="${index + 1}. adım">${index + 1}</button>`).join('');
    $('#guideStepList').innerHTML = guide.steps.map((step, index) => `
      <li data-step="${index}"><span class="guide-step-index">${index + 1}</span><div><strong>${esc(step.title)}</strong><p>${esc(step.text)}</p></div></li>`).join('');
    $$('#guideMarkers [data-step], #guideStepList [data-step]').forEach((node) => {
      node.addEventListener('click', () => setGuideStep(Number(node.dataset.step)));
    });
    backdrop.hidden = false;
    document.body.classList.add('modal-open');
    setGuideStep(0);
    refreshIcons();
  }

  function setGuideStep(index) {
    if (!activeGuide) return;
    activeStep = Math.max(0, Math.min(index, activeGuide.steps.length - 1));
    $$('#guideMarkers .guide-marker').forEach((marker) => marker.classList.toggle('active', Number(marker.dataset.step) === activeStep));
    $$('#guideStepList li').forEach((item) => {
      const active = Number(item.dataset.step) === activeStep;
      item.classList.toggle('active', active);
      if (active) item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  function closeGuide() {
    const backdrop = $('#guideModalBackdrop');
    if (backdrop) backdrop.hidden = true;
    if (!document.body.classList.contains('tour-running')) document.body.classList.remove('modal-open');
    activeGuide = null;
  }

  /* ---------- Sesli rehber turu ---------- */
  function speak(text, token) {
    if (!tourVoice || muted || !('speechSynthesis' in window)) return 0;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'tr-TR';
      utterance.rate = 0.98;
      utterance.pitch = 1;
      const voices = window.speechSynthesis.getVoices();
      const turkish = voices.find((voice) => /^tr([-_]|$)/i.test(voice.lang));
      if (turkish) utterance.voice = turkish;
      utterance.onend = () => {
        if (token === tourToken && tourPlaying && !muted) advanceTour(1, true);
      };
      utterance.onerror = () => { /* zamanlayıcı yedek olarak ilerletir */ };
      window.speechSynthesis.speak(utterance);
      return 1;
    } catch (error) {
      return 0;
    }
    return 0;
  }

  function clearTourTimer() {
    if (tourTimer) {
      window.clearTimeout(tourTimer);
      tourTimer = 0;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  function showTourStep(index) {
    if (!tour || !tour.length) return;
    tourIndex = Math.max(0, Math.min(index, tour.length - 1));
    const step = tour[tourIndex];
    clearTourTimer();
    tourToken += 1;
    const token = tourToken;

    const overlay = $('#tourOverlay');
    if (!overlay) return;
    overlay.hidden = false;
    document.body.classList.add('tour-running', 'modal-open');

    $('#tourStepTitle').textContent = step.title;
    $('#tourStepText').textContent = step.text;
    $('#tourStepCount').textContent = `${tourIndex + 1} / ${tour.length}`;
    $('#tourProgressBar').style.width = `${((tourIndex + 1) / tour.length) * 100}%`;

    switchView(step.view);
    window.setTimeout(() => {
      if (token !== tourToken) return;
      const target = step.target ? $(step.target) : null;
      positionTour(target);
      refreshIcons();
      if (tourPlaying) {
        const spoken = muted ? 0 : speak(`${step.title}. ${step.text}`, token);
        const estimate = Math.max(6000, Math.min(15000, step.text.length * 62));
        tourTimer = window.setTimeout(() => {
          if (token === tourToken && tourPlaying) advanceTour(1, true);
        }, spoken ? estimate + 6000 : estimate);
      }
    }, 340);
  }

  function positionTour(target) {
    const overlay = $('#tourOverlay');
    const spotlight = $('#tourSpotlight');
    const tooltip = $('#tourTooltip');
    if (!overlay || !spotlight || !tooltip) return;
    if (!target) {
      overlay.classList.add('tour-empty-target');
      spotlight.style.width = '0px';
      spotlight.style.height = '0px';
      spotlight.style.left = '50%';
      spotlight.style.top = '50%';
      return;
    }
    overlay.classList.remove('tour-empty-target');
    try {
      target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    } catch (error) {
      target.scrollIntoView();
    }
    window.setTimeout(() => {
      const rect = target.getBoundingClientRect();
      const pad = 7;
      const width = Math.max(rect.width + pad * 2, 44);
      const height = Math.max(rect.height + pad * 2, 44);
      const left = Math.max(6, Math.min(window.innerWidth - width - 6, rect.left - pad));
      const top = Math.max(6, Math.min(window.innerHeight - height - 6, rect.top - pad));
      spotlight.style.left = `${left}px`;
      spotlight.style.top = `${top}px`;
      spotlight.style.width = `${width}px`;
      spotlight.style.height = `${height}px`;

      const tipWidth = Math.min(390, window.innerWidth - 32);
      const tipHeight = tooltip.offsetHeight || 240;
      let tipLeft = left + width / 2 - tipWidth / 2;
      tipLeft = Math.max(16, Math.min(window.innerWidth - tipWidth - 16, tipLeft));
      let tipTop = top + height + 16;
      if (tipTop + tipHeight > window.innerHeight - 16) tipTop = Math.max(16, top - tipHeight - 16);
      tooltip.style.left = `${tipLeft}px`;
      tooltip.style.top = `${tipTop}px`;
    }, 380);
  }

  function startTour(fromIndex) {
    if (!tour || !tour.length) return;
    tourVoice = true;
    muted = false;
    updateVoiceButtons();
    tourPlaying = true;
    const overlay = $('#tourOverlay');
    if (overlay) overlay.classList.remove('tour-paused');
    const button = $('#tourPlayPause');
    if (button) button.innerHTML = icon('pause');
    showTourStep(typeof fromIndex === 'number' ? fromIndex : 0);
  }

  function advanceTour(delta, auto) {
    if (!tour || !tourPlaying) return;
    const next = tourIndex + delta;
    if (next < 0) return showTourStep(0);
    if (next >= tour.length) {
      if (!auto) return;
      stopTour(true);
      openHelpView();
      return;
    }
    showTourStep(next);
  }

  function stopTour(finished) {
    tourPlaying = false;
    tourToken += 1;
    clearTourTimer();
    const overlay = $('#tourOverlay');
    if (overlay) overlay.hidden = true;
    document.body.classList.remove('tour-running', 'modal-open');
    const button = $('#tourPlayPause');
    if (button) button.innerHTML = icon('play');
    if (finished) {
      tourIndex = 0;
    }
  }

  function togglePlay() {
    if (tourPlaying) {
      tourPlaying = false;
      clearTourTimer();
      const overlay = $('#tourOverlay');
      if (overlay) overlay.classList.add('tour-paused');
      const button = $('#tourPlayPause');
      if (button) button.innerHTML = icon('play');
    } else {
      tourPlaying = true;
      const overlay = $('#tourOverlay');
      if (overlay) overlay.classList.remove('tour-paused');
      const button = $('#tourPlayPause');
      if (button) button.innerHTML = icon('pause');
      showTourStep(tourIndex);
    }
  }

  function updateVoiceButtons() {
    const buttons = ['#tourVoiceToggle'];
    buttons.forEach((selector) => {
      const button = $(selector);
      if (!button) return;
      button.innerHTML = icon(tourVoice ? 'volume-2' : 'volume-x');
      button.setAttribute('aria-label', tourVoice ? 'Sesi kapat' : 'Sesi aç');
      button.classList.toggle('is-muted', !tourVoice);
    });
    const start = $('#startTour');
    if (start) {
      start.innerHTML = `${icon('play')}<span>Rehberi başlat</span>`;
      if (window.lucide) refreshIcons();
    }
  }

  function hashTarget() {
    const hash = window.location.hash.replace('#', '');
    if (!hash) return;
    const [view, targetId] = hash.split('/');
    switchView(view);
    if (targetId) window.setTimeout(() => {
      const target = document.getElementById(targetId);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 420);
  }

  function bind() {
    $$('[data-guide-open]').forEach((node) => node.addEventListener('click', () => openGuide(node.dataset.guideOpen)));
    const closeButton = $('#guideModalClose');
    if (closeButton) closeButton.addEventListener('click', closeGuide);
    const guideBackdrop = $('#guideModalBackdrop');
    if (guideBackdrop) guideBackdrop.addEventListener('click', (event) => {
      if (event.target === guideBackdrop) closeGuide();
    });

    const start = $('#startTour');
    if (start) start.addEventListener('click', () => startTour(0));
    const sidebarStart = $('#sidebarTourStart');
    if (sidebarStart) sidebarStart.addEventListener('click', () => startTour(0));
    const heroPlay = $('.tour-play');
    if (heroPlay) {
      heroPlay.addEventListener('click', () => startTour(0));
      heroPlay.setAttribute('role', 'button');
      heroPlay.setAttribute('tabindex', '0');
      heroPlay.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') startTour(0);
      });
    }
    const voicePreview = $('#tourVoicePreview');
    if (voicePreview) voicePreview.addEventListener('click', () => {
      const message = 'Merhaba. StockManager sesli rehberi hazır. Rehberi başlat düğmesine basarak paneli birlikte keşfedelim.';
      if ('speechSynthesis' in window) {
        const previous = tourVoice;
        tourVoice = true;
        muted = false;
        speak(message, -1);
        tourVoice = previous;
      }
    });
    const voiceToggle = $('#tourVoiceToggle');
    if (voiceToggle) voiceToggle.addEventListener('click', () => {
      tourVoice = !tourVoice;
      muted = !tourVoice;
      if (!tourVoice) clearTourTimer();
      updateVoiceButtons();
      if (tourVoice && tourPlaying) showTourStep(tourIndex);
    });
    const playPause = $('#tourPlayPause');
    if (playPause) playPause.addEventListener('click', togglePlay);
    const prev = $('#tourPrev');
    if (prev) prev.addEventListener('click', () => advanceTour(-1));
    const next = $('#tourNext');
    if (next) next.addEventListener('click', () => advanceTour(1));
    const close = $('#tourClose');
    if (close) close.addEventListener('click', () => stopTour(false));

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (!$('#guideModalBackdrop').hidden) closeGuide();
        else if (!$('#tourOverlay').hidden) stopTour(false);
      }
      if (!$('#tourOverlay').hidden) {
        if (event.key === 'ArrowRight') advanceTour(1);
        if (event.key === 'ArrowLeft') advanceTour(-1);
        if (event.key === ' ') {
          event.preventDefault();
          togglePlay();
        }
      }
      if (!$('#guideModalBackdrop').hidden) {
        if (event.key === 'ArrowRight') setGuideStep(activeStep + 1);
        if (event.key === 'ArrowLeft') setGuideStep(activeStep - 1);
      }
    });

    window.addEventListener('resize', () => {
      if (!$('#tourOverlay').hidden && tour && tour[tourIndex]) positionTour(tour[tourIndex].target ? $(tour[tourIndex].target) : null);
    });

    if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = () => {};
    hashTarget();
  }

  async function boot() {
    bind();
    await Promise.all([loadVersion(), loadGuides()]);
    updateVoiceButtons();
    refreshIcons();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.stockHelp = { openGuide, startTour, stopTour, get guides() { return guides; } };
})();
