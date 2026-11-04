// @ts-nocheck
const STORAGE_KEY = 'stockmanager-data-v1';
const LEGACY_STORAGE_KEY = 'stokpilot-data-v1';
const localFallbackStorage = {
    async getItem(key) { try {
        return window.localStorage.getItem(key);
    }
    catch {
        return null;
    } },
    async setItem(key, value) { try {
        window.localStorage.setItem(key, value);
    }
    catch (error) {
        console.error(error);
    } }
};
if (!window.miniappsAI)
    window.miniappsAI = {};
if (!window.miniappsAI.storage)
    window.miniappsAI.storage = localFallbackStorage;
let localePromise = null;
function loadLocale() {
    if (window.miniappI18n && typeof window.miniappI18n.t === 'function')
        return Promise.resolve();
    if (localePromise)
        return localePromise;
    localePromise = fetch('./locales/tr.json', { cache: 'no-cache' })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error('locale'))))
        .then((dictionary) => {
        const lookup = (key) => key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), dictionary);
        window.miniappI18n = {
            t(key, values = {}) {
                const value = lookup(key);
                if (typeof value !== 'string')
                    return key;
                return value.replace(/\{(\w+)\}/g, (match, name) => (values[name] !== undefined ? values[name] : match));
            }
        };
    })
        .catch((error) => console.warn('Dil dosyası yüklenemedi', error));
    return localePromise;
}
function applyTranslations() {
    $$('[data-i18n]').forEach((element) => {
        const value = t(element.dataset.i18n);
        if (value && value !== element.dataset.i18n)
            element.textContent = value;
    });
    $$('[data-i18n-placeholder]').forEach((element) => {
        const value = t(element.dataset.i18nPlaceholder);
        if (value && value !== element.dataset.i18nPlaceholder)
            element.setAttribute('placeholder', value);
    });
}
function lucideIcon(name, size) {
    return `<i data-lucide="${name}"${size ? ` style="width:${size}px;height:${size}px"` : ''}></i>`;
}
function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
    }
}
const today = new Date();
const iso = (daysAgo = 0) => { const d = new Date(today); d.setDate(d.getDate() - daysAgo); return d.toISOString().slice(0, 10); };
const seedData = {
    settings: { currency: 'TRY', dashboardTitle: '' },
    products: [
        { id: 'p1', name: 'Kraft kahve bardağı 8 oz', sku: 'AMB-008', category: 'Ambalaj', stock: 1240, minStock: 500, unitPrice: 1.85, currency: 'TRY' },
        { id: 'p2', name: 'Karton taşıma çantası', sku: 'AMB-014', category: 'Ambalaj', stock: 86, minStock: 120, unitPrice: 4.5, currency: 'TRY' },
        { id: 'p3', name: 'Filtre kahve Colombia 1 kg', sku: 'KHV-101', category: 'Kahve', stock: 42, minStock: 20, unitPrice: 385, currency: 'TRY' },
        { id: 'p4', name: 'Vanilya şurubu 1 L', sku: 'SRP-021', category: 'Şurup', stock: 9, minStock: 12, unitPrice: 198, currency: 'TRY' },
        { id: 'p5', name: 'Bambu karıştırıcı', sku: 'AMB-031', category: 'Ambalaj', stock: 600, minStock: 250, unitPrice: .75, currency: 'TRY' },
        { id: 'p6', name: 'Yulaf sütü 1 L', sku: 'SÜT-006', category: 'Süt', stock: 0, minStock: 18, unitPrice: 72, currency: 'TRY' }
    ],
    movements: [
        { id: 'm1', productId: 'p1', type: 'in', quantity: 500, note: 'Aylık tedarik', date: iso(1) },
        { id: 'm2', productId: 'p4', type: 'out', quantity: 8, note: 'Bar kullanımı', date: iso(1) },
        { id: 'm3', productId: 'p2', type: 'out', quantity: 55, note: 'Hafta sonu satışı', date: iso(2) },
        { id: 'm4', productId: 'p3', type: 'in', quantity: 20, note: 'Yeni sevkiyat', date: iso(3) },
        { id: 'm5', productId: 'p5', type: 'out', quantity: 120, note: 'Mağaza kullanımı', date: iso(4) },
        { id: 'm6', productId: 'p1', type: 'out', quantity: 260, note: 'Günlük kullanım', date: iso(5) }
    ],
    purchases: [
        { id: 'a1', productId: 'p1', supplier: 'Anadolu Ambalaj', quantity: 500, unitPrice: 1.85, currency: 'TRY', date: iso(1), status: 'received', note: 'Aylık tedarik' },
        { id: 'a2', productId: 'p3', supplier: 'Kahve Rota', quantity: 20, unitPrice: 385, currency: 'TRY', date: iso(3), status: 'received', note: 'Yeni sevkiyat' },
        { id: 'a3', productId: 'p5', supplier: 'Doğa Paket', quantity: 400, unitPrice: .75, currency: 'TRY', date: iso(12), status: 'received', note: 'Depo stoğu' }
    ]
};
const state = { data: null, view: 'dashboard', modalType: null, editingId: null, query: '', movementQuery: '', movementFrom: '', movementTo: '', productSort: { key: 'name', direction: 'asc' } };
const CURRENCIES = { TRY: 'TRY', EUR: 'EUR', USD: 'USD' };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const t = (key, values) => window.miniappI18n?.t(key, values) || key;
const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const number = (value) => new Intl.NumberFormat('tr-TR').format(Number(value) || 0);
const money = (value, currency = 'TRY') => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: CURRENCIES[currency] || 'TRY', maximumFractionDigits: 2 }).format(Number(value) || 0);
const dateLabel = (value) => value ? new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : '—';
const product = (id) => state.data.products.find((item) => item.id === id);
const status = (item) => item.stock <= 0 ? 'out' : item.stock <= item.minStock ? 'low' : 'healthy';
const statusLabel = (value) => ({ healthy: t('status.healthy'), low: t('status.low'), out: t('status.out') }[value] || value);
const currentCurrency = () => CURRENCIES[state.data?.settings?.currency] || 'TRY';
function normalizeData(parsed) { const settings = { currency: CURRENCIES[parsed?.settings?.currency] || 'TRY', dashboardTitle: String(parsed?.settings?.dashboardTitle || '') }; const products = Array.isArray(parsed?.products) ? parsed.products.map((item) => ({ ...item, currency: CURRENCIES[item.currency] || 'TRY' })) : []; const productCurrency = new Map(products.map((item) => [item.id, item.currency])); const purchases = Array.isArray(parsed?.purchases) ? parsed.purchases.map((item) => ({ ...item, note: item.note || '', currency: CURRENCIES[item.currency] || productCurrency.get(item.productId) || 'TRY' })) : []; const movements = Array.isArray(parsed?.movements) ? parsed.movements.map(({ user, ...item }) => item) : []; return { settings, products, movements, purchases }; }
async function loadData() { try {
    let raw = await window.miniappsAI?.storage?.getItem(STORAGE_KEY);
    if (!raw)
        raw = await window.miniappsAI?.storage?.getItem(LEGACY_STORAGE_KEY);
    state.data = raw ? normalizeData(JSON.parse(raw)) : structuredClone(seedData);
    if (!raw)
        await persist();
}
catch (error) {
    console.error(error);
    state.data = normalizeData(seedData);
    showToast(t('messages.storageFallback'));
} }
async function persist() { try {
    await window.miniappsAI?.storage?.setItem(STORAGE_KEY, JSON.stringify(state.data));
}
catch (error) {
    console.error(error);
    showToast(t('messages.saveError'));
} }
function render() { renderNavigation(); renderMetrics(); renderDashboard(); renderProducts(); renderMovements(); renderPurchases(); renderSuppliers(); renderPivot(); renderStatistics(); renderBackupMeta(); populateProductOptions(); renderCurrencySelect(); refreshIcons(); }
function renderNavigation() { const dashboardTitle = state.data.settings.dashboardTitle || t('dashboard.title'); const current = { dashboard: dashboardTitle, products: t('nav.products'), movements: t('nav.movements'), purchases: t('nav.purchases'), suppliers: t('nav.suppliers'), pivot: t('nav.pivot'), reports: t('nav.reports'), backup: t('nav.backup'), statistics: t('nav.statistics'), help: t('nav.help') }[state.view]; $('#pageCrumb').textContent = current || dashboardTitle; $$('.nav-item, .help-link').forEach((button) => button.classList.toggle('active', button.dataset.view === state.view)); $$('.view').forEach((view) => { view.hidden = view.id !== `view-${state.view}`; view.classList.toggle('active', view.id === `view-${state.view}`); }); $('#productCount').textContent = state.data.products.length; }
function metricMarkup(label, value, foot, icon, color, soft) { return `<article class="metric-card" style="--metric:${color};--metric-soft:${soft}"><div class="metric-top"><span class="metric-label">${esc(label)}</span><span class="metric-icon">${lucideIcon(icon)}</span></div><div class="metric-value">${esc(value)}</div><div class="metric-foot"><strong>${esc(foot)}</strong></div></article>`; }
function renderMetrics() { const totalStock = state.data.products.reduce((sum, item) => sum + Number(item.stock || 0), 0); const stockValue = state.data.products.reduce((sum, item) => sum + Number(item.stock || 0) * Number(item.unitPrice || 0), 0); const low = state.data.products.filter((item) => status(item) === 'low').length; const out = state.data.products.filter((item) => status(item) === 'out').length; const cards = [[t('metrics.products'), number(state.data.products.length), t('metrics.productFoot'), 'package', 'var(--blue)', 'var(--blue-soft)'], [t('metrics.units'), number(totalStock), t('metrics.unitsFoot'), 'boxes', 'var(--primary)', 'var(--primary-soft)'], [t('metrics.stockValue'), money(stockValue, currentCurrency()), t('metrics.valueFoot'), 'wallet', 'var(--green)', 'var(--green-soft)'], [t('metrics.attention'), number(low + out), `${number(low)} ${t('metrics.lowFoot')}`, 'triangle-alert', 'var(--danger)', 'var(--danger-soft)']]; $('#metricGrid').innerHTML = cards.map(([label, value, foot, icon, color, soft]) => `<article class="metric-card" style="--metric:${color};--metric-soft:${soft}"><div class="metric-top"><span class="metric-label">${esc(label)}</span><span class="metric-icon">${lucideIcon(icon)}</span></div><div class="metric-value">${esc(value)}</div><div class="metric-foot"><strong>${esc(foot)}</strong>${label === t('metrics.attention') ? ` · ${esc(number(out))} ${esc(t('metrics.outFoot'))}` : ''}</div></article>`).join(''); $('#movementMetrics').innerHTML = metricMarkup(t('metrics.inbound'), number(state.data.movements.filter((m) => m.type === 'in').reduce((s, m) => s + Number(m.quantity), 0)), t('metrics.totalIn'), 'arrow-down-to-line', 'var(--green)', 'var(--green-soft)') + metricMarkup(t('metrics.outbound'), number(state.data.movements.filter((m) => m.type === 'out').reduce((s, m) => s + Number(m.quantity), 0)), t('metrics.totalOut'), 'arrow-up-from-line', 'var(--danger)', 'var(--danger-soft)') + metricMarkup(t('metrics.records'), number(state.data.movements.length), t('metrics.movementFoot'), 'arrow-left-right', 'var(--blue)', 'var(--blue-soft)'); const spend = state.data.purchases.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0); $('#purchaseMetrics').innerHTML = metricMarkup(t('metrics.purchaseCount'), number(state.data.purchases.length), t('metrics.purchaseFoot'), 'receipt-text', 'var(--blue)', 'var(--blue-soft)') + metricMarkup(t('metrics.totalSpend'), money(spend, currentCurrency()), t('metrics.totalSpendFoot'), 'wallet', 'var(--primary)', 'var(--primary-soft)') + metricMarkup(t('metrics.suppliers'), number(new Set(state.data.purchases.map((item) => item.supplier).filter(Boolean)).size), t('metrics.supplierFoot'), 'truck', 'var(--green)', 'var(--green-soft)'); }
function renderDashboard() { const title = state.data.settings.dashboardTitle || t('dashboard.title'); $('#dashboardTitle').textContent = title; $('#dashboardTitleInput').value = state.data.settings.dashboardTitle; const attention = state.data.products.filter((item) => status(item) !== 'healthy').sort((a, b) => a.stock - b.stock).slice(0, 5); $('#stockHealth').innerHTML = attention.length ? attention.map((item) => `<div class="stock-row"><div class="item-avatar">${esc(item.name.slice(0, 1))}</div><div class="item-copy"><strong>${esc(item.name)}</strong><small>${esc(item.sku)} · ${esc(item.category)}</small></div><div class="stock-value"><span class="status-pill ${status(item)}">${esc(statusLabel(status(item)))}</span><small>${number(item.stock)} / ${number(item.minStock)} ${esc(t('common.units'))}</small></div></div>`).join('') : `<div class="empty-state"><div class="empty-icon">${lucideIcon('badge-check')}</div><p>${esc(t('empty.healthyStock'))}</p></div>`; const recent = [...state.data.movements].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5); $('#recentActivity').innerHTML = recent.length ? recent.map((item) => { const p = product(item.productId); return `<div class="activity-row"><div class="activity-type ${item.type}">${item.type === 'in' ? lucideIcon('arrow-down-to-line') : lucideIcon('arrow-up-from-line')}</div><div class="item-copy"><strong>${esc(p?.name || t('common.deletedProduct'))}</strong><small>${esc(item.note || t('common.noNote'))} · ${dateLabel(item.date)}</small></div><div class="activity-quantity ${item.type}">${item.type === 'in' ? '+' : '-'}${number(item.quantity)}</div></div>`; }).join('') : `<div class="empty-state"><p>${esc(t('empty.noActivity'))}</p></div>`; const total = state.data.products.length; const low = state.data.products.filter((item) => status(item) !== 'healthy').length; $('#insightText').textContent = total ? t('dashboard.insightText', { total: number(total), low: number(low) }) : t('dashboard.insightEmpty'); }
function compareProducts(a, b) { const { key, direction } = state.productSort; const numeric = ['stock', 'minStock', 'unitPrice'].includes(key); const left = numeric ? Number(a[key] || 0) : String(a[key] || ''); const right = numeric ? Number(b[key] || 0) : String(b[key] || ''); const result = numeric ? left - right : left.localeCompare(right, 'tr-TR', { numeric: true, sensitivity: 'base' }); return (result || a.id.localeCompare(b.id)) * (direction === 'asc' ? 1 : -1); }
function renderProducts() { const query = state.query.trim().toLocaleLowerCase('tr-TR'); const filter = $('#stockFilter')?.value || 'all'; const items = state.data.products.filter((item) => { const matches = !query || `${item.name} ${item.sku} ${item.category}`.toLocaleLowerCase('tr-TR').includes(query); return matches && (filter === 'all' || status(item) === filter); }).sort(compareProducts); $('#productSummary').textContent = t('products.summary', { shown: number(items.length), total: number(state.data.products.length) }); $('#productsEmpty').hidden = items.length > 0; $('#productsTable').innerHTML = items.map((item) => `<tr><td><div class="product-cell"><div class="item-avatar">${esc(item.name.slice(0, 1))}</div><div><strong>${esc(item.name)}</strong><small>${esc(item.sku)}</small></div></div></td><td>${esc(item.sku)}</td><td>${esc(item.category)}</td><td><strong>${number(item.stock)}</strong> ${esc(t('common.units'))}</td><td>${number(item.minStock)}</td><td>${money(item.unitPrice, item.currency)}</td><td><button class="table-action" data-action="edit-product" data-id="${esc(item.id)}" aria-label="${esc(t('actions.edit'))}">${lucideIcon('pencil')}</button><button class="table-action" data-action="delete-product" data-id="${esc(item.id)}" aria-label="${esc(t('actions.delete'))}">${lucideIcon('trash-2')}</button></td></tr>`).join(''); $$('.sort-button').forEach((button) => { const active = button.dataset.sort === state.productSort.key; button.classList.toggle('active', active); button.querySelector('.sort-mark').innerHTML = active ? lucideIcon(state.productSort.direction === 'asc' ? 'arrow-up' : 'arrow-down') : lucideIcon('chevrons-up-down'); }); }
function filteredMovements() { const query = state.movementQuery.trim().toLocaleLowerCase('tr-TR'); return [...state.data.movements].filter((item) => { const p = product(item.productId); const searchable = `${p?.name || ''} ${p?.sku || ''}`.toLocaleLowerCase('tr-TR'); return (!query || searchable.includes(query)) && (!state.movementFrom || item.date >= state.movementFrom) && (!state.movementTo || item.date <= state.movementTo); }).sort((a, b) => b.date.localeCompare(a.date)); }
function renderMovements() { const rows = filteredMovements(); $('#movementSummary').textContent = t('movements.summaryFiltered', { shown: number(rows.length), total: number(state.data.movements.length) }); $('#movementsEmpty').hidden = rows.length > 0; $('#movementsTable').innerHTML = rows.map((item) => { const p = product(item.productId); return `<tr><td>${dateLabel(item.date)}</td><td><strong>${esc(p?.name || t('common.deletedProduct'))}</strong></td><td><span class="status-pill ${item.type === 'in' ? 'healthy' : 'out'}">${item.type === 'in' ? esc(t('status.inbound')) : esc(t('status.outbound'))}</span></td><td><strong>${item.type === 'in' ? '+' : '-'}${number(item.quantity)}</strong></td><td>${esc(item.note || t('common.noNote'))}</td></tr>`; }).join(''); }
function renderPurchases() { const rows = [...state.data.purchases].sort((a, b) => b.date.localeCompare(a.date)); $('#purchaseSummary').textContent = t('purchases.summary', { count: number(rows.length) }); $('#purchasesEmpty').hidden = rows.length > 0; $('#purchasesTable').innerHTML = rows.map((item) => { const p = product(item.productId); return `<tr><td>${dateLabel(item.date)}</td><td><strong>${esc(p?.name || t('common.deletedProduct'))}</strong></td><td>${esc(item.supplier)}</td><td>${number(item.quantity)}</td><td><strong>${money(item.quantity * item.unitPrice, item.currency)}</strong></td><td>${esc(item.note || t('common.noNote'))}</td><td><span class="status-pill healthy">${esc(t('status.received'))}</span></td><td><button class="table-action" data-action="edit-purchase" data-id="${esc(item.id)}" aria-label="${esc(t('actions.edit'))}">${lucideIcon('pencil')}</button><button class="table-action" data-action="delete-purchase" data-id="${esc(item.id)}" aria-label="${esc(t('actions.delete'))}">${lucideIcon('trash-2')}</button></td></tr>`; }).join(''); }
function supplierRows() { const map = new Map(); state.data.purchases.forEach((item) => { const key = item.supplier?.trim() || t('common.unknownSupplier'); const row = map.get(key) || { supplier: key, count: 0, quantity: 0, total: 0, currencies: new Set(), lastDate: '' }; row.count += 1; row.quantity += Number(item.quantity || 0); row.total += Number(item.quantity || 0) * Number(item.unitPrice || 0); row.currencies.add(item.currency || 'TRY'); if (!row.lastDate || item.date > row.lastDate)
    row.lastDate = item.date; map.set(key, row); }); return [...map.values()].sort((a, b) => b.total - a.total); }
function supplierTotalLabel(row) { return row.currencies.size === 1 ? money(row.total, [...row.currencies][0]) : `${number(row.total)} ${t('suppliers.mixedCurrency')}`; }
function renderSuppliers() { const rows = supplierRows(); $('#supplierSummary').textContent = t('suppliers.summary', { count: number(rows.length) }); $('#suppliersEmpty').hidden = rows.length > 0; $('#suppliersTable').innerHTML = rows.map((row) => `<tr><td><strong>${esc(row.supplier)}</strong></td><td>${number(row.count)}</td><td>${number(row.quantity)}</td><td><strong>${esc(supplierTotalLabel(row))}</strong></td><td>${dateLabel(row.lastDate)}</td></tr>`).join(''); $('#supplierMetrics').innerHTML = metricMarkup(t('metrics.suppliers'), number(rows.length), t('metrics.supplierFoot'), 'truck', 'var(--blue)', 'var(--blue-soft)') + metricMarkup(t('metrics.purchaseCount'), number(state.data.purchases.length), t('metrics.purchaseFoot'), 'receipt-text', 'var(--primary)', 'var(--primary-soft)') + metricMarkup(t('metrics.units'), number(state.data.purchases.reduce((sum, item) => sum + Number(item.quantity || 0), 0)), t('metrics.unitsFoot'), 'boxes', 'var(--green)', 'var(--green-soft)'); }
function renderPivot() { const group = $('#pivotGroup')?.value || 'category'; const period = $('#pivotPeriod')?.value || 'all'; const map = new Map(); const movements = period === 'month' ? state.data.movements.filter((movement) => movement.date.slice(0, 7) === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`) : state.data.movements; movements.forEach((movement) => { const p = product(movement.productId); if (!p)
    return; const key = group === 'category' ? p.category : p.name; const row = map.get(key) || { inbound: 0, outbound: 0, stock: 0 }; row[movement.type === 'in' ? 'inbound' : 'outbound'] += Number(movement.quantity); map.set(key, row); }); state.data.products.forEach((p) => { const key = group === 'category' ? p.category : p.name; const row = map.get(key) || { inbound: 0, outbound: 0, stock: 0 }; row.stock += Number(p.stock); map.set(key, row); }); $('#pivotGroupHead').textContent = group === 'category' ? t('table.category') : t('table.product'); $('#pivotTable').innerHTML = [...map.entries()].sort((a, b) => b[1].stock - a[1].stock).map(([key, row]) => `<tr><td><strong>${esc(key)}</strong></td><td class="positive">+${number(row.inbound)}</td><td class="negative">-${number(row.outbound)}</td><td>${row.inbound - row.outbound >= 0 ? '+' : ''}${number(row.inbound - row.outbound)}</td><td><strong>${number(row.stock)}</strong></td></tr>`).join(''); }
function renderStatistics() { const inbound = state.data.movements.filter((item) => item.type === 'in').reduce((sum, item) => sum + Number(item.quantity), 0); const outbound = state.data.movements.filter((item) => item.type === 'out').reduce((sum, item) => sum + Number(item.quantity), 0); const total = state.data.products.reduce((sum, item) => sum + Number(item.stock), 0); $('#statisticsMetrics').innerHTML = metricMarkup(t('metrics.inbound'), number(inbound), t('metrics.totalIn'), 'arrow-down-to-line', 'var(--green)', 'var(--green-soft)') + metricMarkup(t('metrics.outbound'), number(outbound), t('metrics.totalOut'), 'arrow-up-from-line', 'var(--danger)', 'var(--danger-soft)') + metricMarkup(t('metrics.units'), number(total), t('metrics.unitsFoot'), 'boxes', 'var(--primary)', 'var(--primary-soft)'); const periods = []; const cursor = new Date(today.getFullYear(), today.getMonth() - 5, 1); for (let i = 0; i < 6; i += 1) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    periods.push({ key, label: new Intl.DateTimeFormat('tr-TR', { month: 'short' }).format(cursor), inbound: 0, outbound: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
} state.data.movements.forEach((item) => { const period = periods.find((entry) => entry.key === item.date.slice(0, 7)); if (period)
    period[item.type === 'in' ? 'inbound' : 'outbound'] += Number(item.quantity); }); const max = Math.max(1, ...periods.flatMap((item) => [item.inbound, item.outbound])); $('#statisticsBars').innerHTML = periods.map((item) => `<div class="bar-group"><div class="bar-pair"><span class="bar inbound" style="height:${Math.max(3, item.inbound / max * 100)}%" title="${esc(t('status.inbound'))}: ${number(item.inbound)}"></span><span class="bar outbound" style="height:${Math.max(3, item.outbound / max * 100)}%" title="${esc(t('status.outbound'))}: ${number(item.outbound)}"></span></div><small>${esc(item.label)}</small></div>`).join(''); const categories = new Map(); state.data.products.forEach((item) => categories.set(item.category, (categories.get(item.category) || 0) + Number(item.stock))); const categoryRows = [...categories.entries()].sort((a, b) => b[1] - a[1]); const palette = ['#38bdf8', '#10b981', '#f59e0b', '#a78bfa', '#f43f5e', '#0ea5e9']; let current = 0; const stops = categoryRows.map(([, value], index) => { const start = total ? current / total * 100 : 0; current += value; return `${palette[index % palette.length]} ${start}% ${total ? current / total * 100 : 100}%`; }).join(', '); $('#categoryChart').style.background = categoryRows.length ? `conic-gradient(${stops})` : 'var(--surface-3)'; $('#categoryChartTotal').textContent = number(total); $('#categoryLegend').innerHTML = categoryRows.map(([label, value], index) => `<div><i style="background:${palette[index % palette.length]}"></i><span>${esc(label)}</span><strong>${number(value)}</strong></div>`).join(''); }
function renderBackupMeta() { const stamp = window.__stokpilotBackup; $('#lastBackup').textContent = stamp ? t('backup.lastBackup', { date: dateLabel(stamp) }) : t('backup.noBackup'); }
function populateProductOptions() { ['#movementProduct', '#purchaseProduct'].forEach((selector) => { const select = $(selector); if (!select)
    return; select.innerHTML = state.data.products.map((item) => `<option value="${esc(item.id)}">${esc(item.name)} — ${esc(item.sku)}</option>`).join(''); }); }
function renderCurrencySelect() { const select = $('#currencySelect'); if (select)
    select.value = currentCurrency(); }
function openModal(type, id = null) { state.modalType = type; state.editingId = id; $('#modalBackdrop').hidden = false; $('#productFields').hidden = type !== 'product'; $('#movementFields').hidden = type !== 'movement'; $('#purchaseFields').hidden = type !== 'purchase'; ['#productFields', '#movementFields', '#purchaseFields'].forEach((selector) => { const section = $(selector); section.querySelectorAll('input, select, textarea, button').forEach((field) => { field.disabled = section.id !== `${type}Fields`; }); }); const titles = { product: id ? t('modal.editProduct') : t('modal.addProduct'), movement: t('modal.addMovement'), purchase: id ? t('modal.editPurchase') : t('modal.addPurchase') }; $('#modalTitle').textContent = titles[type]; $('#modalEyebrow').textContent = id ? t('modal.editEyebrow') : t('modal.newEyebrow'); const form = $('#recordForm'); form.reset(); populateProductOptions(); const activeCurrency = $(`#${type}Fields .record-currency`); if (activeCurrency)
    activeCurrency.value = currentCurrency(); if (type === 'product' && id) {
    const item = product(id);
    if (item)
        Object.entries(item).forEach(([key, value]) => { const field = $('#productFields').querySelector(`[name="${key}"]`); if (field)
            field.value = value; });
} if (type === 'purchase' && id) {
    const item = state.data.purchases.find((entry) => entry.id === id);
    if (item) {
        $('#purchaseProduct').value = item.productId;
        $('#purchaseFields [name="supplier"]').value = item.supplier;
        $('#purchaseFields [name="quantity"]').value = item.quantity;
        $('#purchaseFields [name="unitPrice"]').value = item.unitPrice;
        $('#purchaseFields [name="currency"]').value = item.currency || currentCurrency();
        $('#purchaseFields [name="note"]').value = item.note || '';
    }
} if (type === 'movement' || type === 'purchase') {
    const quantityField = $(`#${type}Fields [name="quantity"]`);
    if (quantityField)
        quantityField.value = id ? quantityField.value : 1;
} setTimeout(() => form.querySelector('input:not([type="hidden"]), select')?.focus(), 50); }
function closeModal() { $('#modalBackdrop').hidden = true; state.modalType = null; state.editingId = null; }
async function submitForm(event) { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries()); if (state.modalType === 'product') {
    const record = { name: values.name.trim(), sku: values.sku.trim().toUpperCase(), category: values.category.trim(), stock: Number(values.stock), minStock: Number(values.minStock), unitPrice: Number(values.unitPrice), currency: CURRENCIES[values.currency] || currentCurrency() };
    if (state.editingId)
        Object.assign(product(state.editingId), record);
    else
        state.data.products.unshift({ id: `p-${Date.now()}`, ...record });
    await persist();
    closeModal();
    render();
    showToast(t('messages.productSaved'));
} if (state.modalType === 'movement') {
    const quantity = Number(values.quantity);
    const item = product(values.productId);
    if (!item || quantity < 1)
        return;
    if (values.type === 'out' && quantity > item.stock) {
        showToast(t('messages.insufficientStock'));
        return;
    }
    item.stock += values.type === 'in' ? quantity : -quantity;
    state.data.movements.unshift({ id: `m-${Date.now()}`, productId: values.productId, type: values.type, quantity, note: values.note.trim(), date: new Date().toISOString().slice(0, 10) });
    await persist();
    closeModal();
    render();
    showToast(t('messages.movementSaved'));
} if (state.modalType === 'purchase') {
    const quantity = Number(values.quantity);
    const newItem = product(values.productId);
    if (!newItem || quantity < 1)
        return;
    const unitPrice = Number(values.unitPrice);
    const note = values.note.trim();
    const currency = CURRENCIES[values.currency] || currentCurrency();
    if (state.editingId) {
        const record = state.data.purchases.find((entry) => entry.id === state.editingId);
        if (!record)
            return;
        const oldItem = product(record.productId);
        if (oldItem)
            oldItem.stock -= Number(record.quantity);
        newItem.stock += quantity;
        Object.assign(record, { productId: values.productId, supplier: values.supplier.trim(), quantity, unitPrice, currency, note });
        const linked = state.data.movements.find((entry) => entry.sourcePurchaseId === record.id);
        if (linked)
            Object.assign(linked, { productId: values.productId, quantity, note: note || t('common.purchaseNote') });
        await persist();
        closeModal();
        render();
        showToast(t('messages.purchaseUpdated'));
    }
    else {
        const id = `a-${Date.now()}`;
        newItem.stock += quantity;
        state.data.purchases.unshift({ id, productId: values.productId, supplier: values.supplier.trim(), quantity, unitPrice, currency, date: new Date().toISOString().slice(0, 10), status: 'received', note });
        state.data.movements.unshift({ id: `m-${Date.now()}`, sourcePurchaseId: id, productId: values.productId, type: 'in', quantity, note: note || t('common.purchaseNote'), date: new Date().toISOString().slice(0, 10) });
        await persist();
        closeModal();
        render();
        showToast(t('messages.purchaseSaved'));
    }
} }
function deletePurchase(id) { const record = state.data.purchases.find((item) => item.id === id); if (!record || !window.confirm(t('confirm.deletePurchase', { name: product(record.productId)?.name || t('common.deletedProduct') })))
    return; const item = product(record.productId); if (item)
    item.stock -= Number(record.quantity); state.data.purchases = state.data.purchases.filter((entry) => entry.id !== id); state.data.movements = state.data.movements.filter((entry) => entry.sourcePurchaseId !== id); persist().then(() => { render(); showToast(t('messages.purchaseDeleted')); }); }
function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(window.__toastTimer); window.__toastTimer = setTimeout(() => toast.classList.remove('show'), 2800); }
function download(filename, content, type = 'text/plain;charset=utf-8') { const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 500); }
function csv(rows) { if (!rows.length)
    return ''; const keys = Object.keys(rows[0]); const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`; return `\uFEFF${[keys.join(';'), ...rows.map((row) => keys.map((key) => quote(row[key])).join(';'))].join('\r\n')}`; }
function exportProducts() { download(`urunler-${iso()}.csv`, csv(state.data.products.map((p) => ({ Urun: p.name, StokKodu: p.sku, Kategori: p.category, PaketAdeti: p.stock, AltLimit: p.minStock, BirimFiyat: p.unitPrice, ParaBirimi: p.currency }))), 'text/csv;charset=utf-8'); showToast(t('messages.csvReady')); }
function exportMovements() { const rows = filteredMovements(); download(`hareketler-${iso()}.csv`, csv(rows.map((m) => ({ Tarih: m.date, Urun: product(m.productId)?.name || '', Islem: m.type === 'in' ? t('status.inbound') : t('status.outbound'), PaketAdeti: m.quantity, Not: m.note || '' }))), 'text/csv;charset=utf-8'); showToast(t('messages.csvReady')); }
function exportPivot() { const headers = $$('#view-pivot thead th').map((cell) => cell.textContent.trim()); const rows = $$('#pivotTable tr').map((row) => [...row.children].map((cell) => cell.textContent.trim())); if (!rows.length) {
    showToast(t('messages.nothingToPrint'));
    return;
} const records = rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || '']))); download(`pivot-${iso()}.csv`, csv(records), 'text/csv;charset=utf-8'); showToast(t('messages.csvReady')); }
function exportSuppliers() { const rows = supplierRows(); if (!rows.length) {
    showToast(t('messages.nothingToPrint'));
    return;
} download(`tedarikciler-${iso()}.csv`, csv(rows.map((row) => ({ Tedarikci: row.supplier, AlimKaydi: row.count, PaketAdeti: row.quantity, ToplamAlisveris: supplierTotalLabel(row), SonAlim: row.lastDate }))), 'text/csv;charset=utf-8'); showToast(t('messages.csvReady')); }
function exportBackup() { download(`stok-yedek-${iso()}.json`, JSON.stringify({ ...state.data, exportedAt: new Date().toISOString(), app: 'Yerel stok paneli' }, null, 2), 'application/json'); window.__stokpilotBackup = iso(); renderBackupMeta(); showToast(t('messages.backupReady')); }
function printDocument(title, headers, rows) { if (!rows.length) {
    showToast(t('messages.nothingToPrint'));
    return;
} const htmlRows = rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join(''); const printWindow = window.open('', '_blank'); if (!printWindow) {
    showToast(t('messages.popupBlocked'));
    return;
} printWindow.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4 portrait;margin:0}*{box-sizing:border-box}body{margin:0;padding:8mm;color:#18232b;font-family:Arial,sans-serif;font-size:10px}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 12px;color:#5f6d75}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #b8c1c6;padding:7px 6px;text-align:left;vertical-align:top;word-break:break-word}th{background:#e9eef0;font-size:9px;text-transform:uppercase}tr:nth-child(even){background:#f7f9fa}.meta{display:flex;justify-content:space-between;margin-bottom:12px;color:#5f6d75}@media print{body{padding:8mm}}</style></head><body><div class="meta"><span>${esc(new Date().toLocaleDateString('tr-TR'))}</span></div><h1>${esc(title)}</h1><p>${esc(t('reports.printGenerated'))}</p><table><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${htmlRows}</tbody></table><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script></body></html>`); printWindow.document.close(); }
function printMovements() { printDocument(t('reports.movementTitle'), [t('table.date'), t('table.product'), t('table.type'), t('table.quantity'), t('table.note')], filteredMovements().map((item) => [dateLabel(item.date), product(item.productId)?.name || t('common.deletedProduct'), item.type === 'in' ? t('status.inbound') : t('status.outbound'), `${item.type === 'in' ? '+' : '-'}${number(item.quantity)}`, item.note || t('common.noNote')])); }
function printPurchases() { printDocument(t('reports.purchaseTitle'), [t('table.date'), t('table.product'), t('table.supplier'), t('table.quantity'), t('table.total'), t('table.note')], [...state.data.purchases].sort((a, b) => b.date.localeCompare(a.date)).map((item) => [dateLabel(item.date), product(item.productId)?.name || t('common.deletedProduct'), item.supplier, number(item.quantity), money(item.quantity * item.unitPrice, item.currency), item.note || t('common.noNote')])); }
function printStock() { printDocument(t('reports.stockTitle'), [t('table.product'), t('table.sku'), t('table.category'), t('table.quantity'), t('table.min'), t('table.total')], state.data.products.map((item) => [item.name, item.sku, item.category, number(item.stock), number(item.minStock), money(item.stock * item.unitPrice, item.currency)])); }
function printSuppliers() { printDocument(t('reports.supplierTitle'), [t('table.supplier'), t('table.purchaseCount'), t('table.quantity'), t('table.total'), t('table.lastPurchase')], supplierRows().map((row) => [row.supplier, number(row.count), number(row.quantity), supplierTotalLabel(row), dateLabel(row.lastDate)])); }
async function importBackup(event) { const file = event.target.files?.[0]; if (!file)
    return; try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed.products) || !Array.isArray(parsed.movements) || !Array.isArray(parsed.purchases))
        throw new Error('invalid');
    state.data = normalizeData(parsed);
    await persist();
    render();
    showToast(t('messages.restoreReady'));
}
catch (error) {
    console.error(error);
    showToast(t('messages.restoreError'));
} event.target.value = ''; }
const helpDemoMap = { dashboard: ['help.demoDashboardTitle', 'help.demoDashboardText'], products: ['help.demoProductsTitle', 'help.demoProductsText'], movements: ['help.demoMovementsTitle', 'help.demoMovementsText'], purchases: ['help.demoPurchasesTitle', 'help.demoPurchasesText'], analysis: ['help.demoAnalysisTitle', 'help.demoAnalysisText'], suppliers: ['help.demoSuppliersTitle', 'help.demoSuppliersText'], backup: ['help.demoBackupTitle', 'help.demoBackupText'] };
function openHelpDemo(type) { const keys = helpDemoMap[type] || helpDemoMap.dashboard; $('#helpDemoTitle').textContent = t(keys[0]); $('#helpDemoText').textContent = t(keys[1]); $('#helpDemoVisual').className = `help-demo-visual demo-${type}`; $('#helpDemoBackdrop').hidden = false; }
function closeHelpDemo() { $('#helpDemoBackdrop').hidden = true; }
function switchView(view) { state.view = view; if (view !== 'products')
    state.query = ''; render(); if (window.innerWidth < 821)
    closeSidebar(); }
function closeSidebar() { $('#sidebar').classList.remove('open'); $('#mobileOverlay').classList.remove('visible'); }
function wireEvents() { document.addEventListener('click', async (event) => { const sortButton = event.target.closest('.sort-button'); if (sortButton) {
    if (state.productSort.key === sortButton.dataset.sort)
        state.productSort.direction = state.productSort.direction === 'asc' ? 'desc' : 'asc';
    else {
        state.productSort.key = sortButton.dataset.sort;
        state.productSort.direction = 'asc';
    }
    renderProducts();
    return;
} const demoButton = event.target.closest('.help-demo'); if (demoButton) {
    openHelpDemo(demoButton.dataset.demo);
    return;
} const viewButton = event.target.closest('[data-view]'); if (viewButton) {
    switchView(viewButton.dataset.view);
    return;
} const action = event.target.closest('[data-action]'); if (!action)
    return; if (action.dataset.action === 'edit-product')
    openModal('product', action.dataset.id); if (action.dataset.action === 'delete-product') {
    const item = product(action.dataset.id);
    if (item && window.confirm(t('confirm.deleteProduct', { name: item.name }))) {
        state.data.products = state.data.products.filter((p) => p.id !== item.id);
        await persist();
        render();
        showToast(t('messages.productDeleted'));
    }
} if (action.dataset.action === 'edit-purchase')
    openModal('purchase', action.dataset.id); if (action.dataset.action === 'delete-purchase')
    deletePurchase(action.dataset.id); }); $('#dashboardAdd').addEventListener('click', () => openModal('product')); $('#productAdd').addEventListener('click', () => openModal('product')); $('#emptyProductAdd').addEventListener('click', () => openModal('product')); $('#movementAdd').addEventListener('click', () => openModal('movement')); $('#purchaseAdd').addEventListener('click', () => openModal('purchase')); $('#dashboardTitleSave').addEventListener('click', async () => { state.data.settings.dashboardTitle = $('#dashboardTitleInput').value.trim(); await persist(); render(); showToast(t('messages.titleSaved')); }); $('#currencySelect').addEventListener('change', async (event) => { state.data.settings.currency = CURRENCIES[event.target.value] || 'TRY'; await persist(); render(); showToast(t('messages.currencySaved')); }); $('#modalClose').addEventListener('click', closeModal); $('.modal-cancel').addEventListener('click', closeModal); $('#modalBackdrop').addEventListener('click', (event) => { if (event.target.id === 'modalBackdrop')
    closeModal(); }); $('#recordForm').addEventListener('submit', submitForm); $('#helpDemoClose')?.addEventListener('click', closeHelpDemo); $('#helpDemoBackdrop')?.addEventListener('click', (event) => { if (event.target.id === 'helpDemoBackdrop')
    closeHelpDemo(); }); $('#productSearch').addEventListener('input', (event) => { state.query = event.target.value; renderProducts(); }); $('#stockFilter').addEventListener('change', renderProducts); $('#globalSearch').addEventListener('input', (event) => { state.query = event.target.value; if (event.target.value && state.view !== 'products')
    switchView('products');
else
    renderProducts(); }); $('#movementSearch').addEventListener('input', (event) => { state.movementQuery = event.target.value; renderMovements(); }); $('#movementFrom').addEventListener('change', (event) => { state.movementFrom = event.target.value; renderMovements(); }); $('#movementTo').addEventListener('change', (event) => { state.movementTo = event.target.value; renderMovements(); }); $('#movementPrint').addEventListener('click', printMovements); $('#pivotGroup').addEventListener('change', renderPivot); $('#pivotPeriod').addEventListener('change', renderPivot); $$('.export-products').forEach((button) => button.addEventListener('click', exportProducts)); $('#pivotExport').addEventListener('click', exportPivot); $('.report-stock').addEventListener('click', exportProducts); $('.report-movement').addEventListener('click', printMovements); $('.print-report').addEventListener('click', printStock); $('.report-purchases').addEventListener('click', printPurchases); $('#suppliersExport').addEventListener('click', exportSuppliers); $('.report-suppliers-csv').addEventListener('click', exportSuppliers); $('.report-suppliers-print').addEventListener('click', printSuppliers); $('.backup-export').addEventListener('click', exportBackup); $('#backupInput').addEventListener('change', importBackup); $('#menuButton').addEventListener('click', () => { $('#sidebar').classList.add('open'); $('#mobileOverlay').classList.add('visible'); }); $('#sidebarClose').addEventListener('click', closeSidebar); $('#mobileOverlay').addEventListener('click', closeSidebar); document.addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    $('#globalSearch').focus();
} if (event.key === 'Escape') {
    if (!$('#modalBackdrop').hidden)
        closeModal();
    if ($('#helpDemoBackdrop') && !$('#helpDemoBackdrop').hidden)
        closeHelpDemo();
} }); }
async function boot() {
    await loadLocale();
    await loadData();
    wireEvents();
    render();
    applyTranslations();
    refreshIcons();
    window.stockApp = { switchView, render, showToast, refreshIcons, getData: () => state.data };
    window.dispatchEvent(new CustomEvent('stockapp:ready'));
    document.addEventListener('input', () => requestAnimationFrame(refreshIcons));
    document.addEventListener('change', () => requestAnimationFrame(refreshIcons));
    document.addEventListener('click', () => setTimeout(refreshIcons, 0));
}
document.addEventListener('DOMContentLoaded', boot);
export {};
