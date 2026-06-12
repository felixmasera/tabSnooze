const ALARM_PREFIX = 'snooze_';
const STORAGE_PREFIX = 'ts_';

function playNotificationSound() {
  if (typeof AudioContext === 'undefined') return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {}
}

const NOTIF_STRINGS = {
  en: { title: 'TabSnooze — Tab ready', open: 'Open tab', snooze: 'Snooze 1h' },
  es: { title: 'TabSnooze — Pestaña lista', open: 'Abrir pestaña', snooze: 'Posponer 1h' },
  pt: { title: 'TabSnooze — Aba pronta', open: 'Abrir aba', snooze: 'Adiar 1h' },
};

const MENU_STRINGS = {
  en: { parent: 'TabSnooze', today: 'Snooze for today', week: 'Snooze for this week', someday: 'Snooze for someday', daily: 'Add to daily routine' },
  es: { parent: 'TabSnooze', today: 'Guardar para hoy', week: 'Guardar para esta semana', someday: 'Guardar para algún día', daily: 'Agregar a rutina diaria' },
  pt: { parent: 'TabSnooze', today: 'Salvar para hoje', week: 'Salvar para esta semana', someday: 'Salvar para um dia', daily: 'Adicionar à rotina diária' },
};

// ─── Storage helpers (tab data → local, settings/meta → sync) ─────────────────

async function getAllStoredTabs() {
  const all = await chrome.storage.local.get(null);
  const tabs = {};
  Object.keys(all).forEach(function(key) {
    if (key.startsWith(STORAGE_PREFIX)) {
      const tab = all[key];
      if (tab && tab.id && tab.url) tabs[tab.id] = tab;
    }
  });
  return tabs;
}

async function getTabById(tabId) {
  const key = STORAGE_PREFIX + tabId;
  const data = await chrome.storage.local.get(key);
  return data[key] || null;
}

async function saveTabEntry(url, title, snoozeType) {
  const wakeAt = await computeWakeAt(snoozeType);
  const id = 'tab_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const tabData = { id, url, title: title || url, wakeAt, snoozeType, status: 'pending', savedAt: Date.now() };
  await chrome.storage.local.set({ [STORAGE_PREFIX + id]: tabData });
  if (wakeAt) chrome.alarms.create(ALARM_PREFIX + id, { when: wakeAt });
  updateBadge();
}

// ─── Migration: sync → local for tab data ────────────────────────────────────

async function migrateStorage() {
  const syncData = await chrome.storage.sync.get(null);
  const toLocal = {};
  const syncKeysToRemove = [];

  Object.keys(syncData).forEach(function(key) {
    const val = syncData[key];

    // Tab entries (have id + url fields)
    if (key.startsWith(STORAGE_PREFIX) && val && typeof val === 'object' && !Array.isArray(val) && val.id && val.url) {
      const clean = Object.assign({}, val);
      delete clean.favicon;
      toLocal[key] = clean;
      syncKeysToRemove.push(key);
    }
    // ts_daily_order and ts_labels previously in sync → move to local
    if ((key === 'ts_daily_order' || key === 'ts_labels') && val !== undefined) {
      toLocal[key] = val;
      syncKeysToRemove.push(key);
    }
    // Old snoozedTabs object format
    if (key === 'snoozedTabs' && val && typeof val === 'object' && !Array.isArray(val)) {
      Object.values(val).forEach(function(tab) {
        if (!tab || !tab.id || !tab.url) return;
        const clean = Object.assign({}, tab);
        delete clean.favicon;
        toLocal[STORAGE_PREFIX + tab.id] = clean;
      });
      syncKeysToRemove.push('snoozedTabs');
    }
  });

  if (Object.keys(toLocal).length) await chrome.storage.local.set(toLocal);
  if (syncKeysToRemove.length) await chrome.storage.sync.remove(syncKeysToRemove);
}

// ─── Settings ─────────────────────────────────────────────────────────────────

async function getSettings() {
  const data = await chrome.storage.sync.get('settings');
  return Object.assign({ todayTime: '18:00', weekDay: 5, weekTime: '09:00', dailyTime: '08:00', language: 'auto' }, data.settings || {});
}

async function getLang() {
  const s = await getSettings();
  if (s.language && s.language !== 'auto') return s.language;
  const code = (self.navigator?.language || 'en').slice(0, 2).toLowerCase();
  return ['en', 'es', 'pt'].includes(code) ? code : 'en';
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

function parseTime(str) {
  const parts = (str || '08:00').split(':');
  return { h: parseInt(parts[0]) || 0, m: parseInt(parts[1]) || 0 };
}

async function computeWakeAt(snoozeType) {
  const s = await getSettings();

  if (snoozeType === 'today') {
    const { h, m } = parseTime(s.todayTime);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    if (d.getTime() <= Date.now()) d.setTime(Date.now() + 2 * 60 * 60 * 1000);
    return d.getTime();
  }
  if (snoozeType === 'week') {
    const { h, m } = parseTime(s.weekTime);
    const d = new Date();
    let daysUntil = (s.weekDay - d.getDay() + 7) % 7;
    if (daysUntil === 0) daysUntil = 7;
    d.setDate(d.getDate() + daysUntil);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  }
  if (snoozeType === 'daily') {
    const { h, m } = parseTime(s.dailyTime);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  return null; // someday
}

async function nextDailyWakeAt() {
  const s = await getSettings();
  const { h, m } = parseTime(s.dailyTime);
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

// ─── Context menu ─────────────────────────────────────────────────────────────

async function setupContextMenus() {
  const lang = await getLang();
  const l = MENU_STRINGS[lang] || MENU_STRINGS.en;

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'ts-parent',  title: l.parent,  contexts: ['link'] });
    chrome.contextMenus.create({ id: 'ts-today',   parentId: 'ts-parent', title: l.today,   contexts: ['link'] });
    chrome.contextMenus.create({ id: 'ts-week',    parentId: 'ts-parent', title: l.week,    contexts: ['link'] });
    chrome.contextMenus.create({ id: 'ts-someday', parentId: 'ts-parent', title: l.someday, contexts: ['link'] });
    chrome.contextMenus.create({ id: 'ts-daily',   parentId: 'ts-parent', title: l.daily,   contexts: ['link'] });
  });
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  const type = info.menuItemId.replace('ts-', '');
  if (type === 'parent' || !info.linkUrl) return;
  if (!/^https?:\/\//i.test(info.linkUrl)) return;
  await saveTabEntry(info.linkUrl, info.linkText || info.linkUrl, type);
});

// ─── Alarms ───────────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith(ALARM_PREFIX)) return;

  const tabId = alarm.name.slice(ALARM_PREFIX.length);
  const tab = await getTabById(tabId);
  if (!tab || tab.status !== 'pending') return;

  playNotificationSound();

  const lang = await getLang();
  const s = NOTIF_STRINGS[lang] || NOTIF_STRINGS.en;

  // Firefox does not support notification buttons — passing them throws
  const isFirefox = typeof browser !== 'undefined';
  const notifOpts = {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    title: s.title,
    message: tab.title || tab.url,
  };
  if (!isFirefox) {
    notifOpts.buttons = [{ title: s.open }, { title: s.snooze }];
    notifOpts.requireInteraction = true;
  }
  chrome.notifications.create('notif_' + tabId, notifOpts);

  if (tabId.startsWith('test_')) {
    await chrome.storage.local.remove(STORAGE_PREFIX + tabId);
    updateBadge();
    return;
  }

  if (tab.snoozeType === 'daily') {
    const wakeAt = await nextDailyWakeAt();
    await chrome.storage.local.set({ [STORAGE_PREFIX + tabId]: Object.assign({}, tab, { wakeAt }) });
    chrome.alarms.create(ALARM_PREFIX + tabId, { when: wakeAt });
  }

  updateBadge();
});

// ─── Notifications ────────────────────────────────────────────────────────────

chrome.notifications.onButtonClicked.addListener(async (notifId, buttonIndex) => {
  if (!notifId.startsWith('notif_')) return;
  const tabId = notifId.slice('notif_'.length);
  chrome.notifications.clear(notifId);

  const tab = await getTabById(tabId);
  if (!tab) return;

  if (buttonIndex === 0) {
    chrome.tabs.create({ url: tab.url });
    if (tab.snoozeType !== 'daily') {
      await archiveTab(tabId, 'read');
    }
  } else {
    await snoozeTabById(tabId, Date.now() + 60 * 60 * 1000);
  }
});

chrome.notifications.onClicked.addListener(async (notifId) => {
  if (!notifId.startsWith('notif_')) return;
  chrome.notifications.clear(notifId);

  // Firefox has no notification buttons, so a body click opens the tab directly
  if (typeof browser !== 'undefined') {
    const tabId = notifId.slice('notif_'.length);
    const tab = await getTabById(tabId);
    if (tab) {
      chrome.tabs.create({ url: tab.url });
      if (tab.snoozeType !== 'daily') await archiveTab(tabId, 'read');
    }
    return;
  }

  try {
    const p = chrome.action.openPopup?.();
    if (p && p.catch) p.catch(function() {});
  } catch (e) {}
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function snoozeTabById(tabId, wakeAt) {
  const tab = await getTabById(tabId);
  if (!tab) return;
  await chrome.storage.local.set({ [STORAGE_PREFIX + tabId]: Object.assign({}, tab, { wakeAt }) });
  chrome.alarms.create(ALARM_PREFIX + tabId, { when: wakeAt });
  updateBadge();
}

const ARCHIVE_LIMIT = 35;

async function archiveTab(tabId, status) {
  const tab = await getTabById(tabId);
  if (!tab) return;
  await chrome.storage.local.set({ [STORAGE_PREFIX + tabId]: Object.assign({}, tab, { status, archivedAt: Date.now() }) });
  chrome.alarms.clear(ALARM_PREFIX + tabId);
  await pruneArchive();
  updateBadge();
}

async function pruneArchive() {
  const all = await getAllStoredTabs();
  const archived = Object.values(all)
    .filter(function(t) { return t.status !== 'pending'; })
    .sort(function(a, b) { return (a.archivedAt || 0) - (b.archivedAt || 0); });

  if (archived.length <= ARCHIVE_LIMIT) return;
  const toDelete = archived.slice(0, archived.length - ARCHIVE_LIMIT);
  for (const t of toDelete) {
    await chrome.storage.local.remove(STORAGE_PREFIX + t.id);
  }
}

async function updateBadge() {
  const tabs = await getAllStoredTabs();
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const count = Object.values(tabs).filter(
    (t) => t.status === 'pending' && t.wakeAt && t.wakeAt <= todayEnd.getTime()
  ).length;

  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#e74c3c' });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  await migrateStorage();
  setupContextMenus();
  updateBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  await migrateStorage();
  updateBadge();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.settings) setupContextMenus();
  if (areaName === 'local') updateBadge();
});
