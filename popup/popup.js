const ALARM_PREFIX = 'snooze_';
const STORAGE_PREFIX = 'ts_';

var _settings = DEFAULT_SETTINGS;

// ─── Storage helpers ──────────────────────────────────────────────────────────

async function getAllTabs() {
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

async function saveTab(tabData) {
  await chrome.storage.local.set({ [STORAGE_PREFIX + tabData.id]: tabData });
}

async function updateTab(id, changes) {
  const key = STORAGE_PREFIX + id;
  const data = await chrome.storage.local.get(key);
  if (!data[key]) return;
  await chrome.storage.local.set({ [key]: Object.assign({}, data[key], changes) });
}

async function deleteTabFromStorage(id) {
  await chrome.storage.local.remove(STORAGE_PREFIX + id);
}

async function getDailyOrder() {
  const data = await chrome.storage.local.get('ts_daily_order');
  return data.ts_daily_order || [];
}

async function saveDailyOrder(order) {
  await chrome.storage.local.set({ ts_daily_order: order });
}

// ─── Labels ───────────────────────────────────────────────────────────────────

var _filterLabel = null;

var LABEL_COLORS = [
  { bg: 'rgba(80,250,123,0.15)',  border: '#50fa7b', text: '#50fa7b' },
  { bg: 'rgba(189,147,249,0.15)', border: '#bd93f9', text: '#bd93f9' },
  { bg: 'rgba(255,184,108,0.15)', border: '#ffb86c', text: '#ffb86c' },
  { bg: 'rgba(255,121,198,0.15)', border: '#ff79c6', text: '#ff79c6' },
  { bg: 'rgba(139,233,253,0.15)', border: '#8be9fd', text: '#8be9fd' },
  { bg: 'rgba(255,85,85,0.15)',   border: '#ff5555', text: '#ff5555' },
];

function labelColor(label) {
  var key = (label || '').trim().toLowerCase();
  var h = 0;
  for (var i = 0; i < key.length; i++) { h = ((h << 5) - h) + key.charCodeAt(i); h |= 0; }
  return LABEL_COLORS[Math.abs(h) % LABEL_COLORS.length];
}

async function getKnownLabels() {
  const data = await chrome.storage.local.get('ts_labels');
  return data.ts_labels || [];
}

async function addKnownLabel(label) {
  if (!label) return;
  const labels = await getKnownLabels();
  const fresh = [label, ...labels.filter(function(l) { return l !== label; })].slice(0, 20);
  await chrome.storage.local.set({ ts_labels: fresh });
}

async function setTabLabel(id, label) {
  const normalized = label ? label.trim() : null;
  await updateTab(id, { label: normalized || null });
  if (normalized) await addKnownLabel(normalized);
  renderLists();
}

function setLabelFilter(label) {
  _filterLabel = (_filterLabel === label) ? null : label;
  renderLists();
}

function openLabelEditor(tab, li) {
  if (li.querySelector('.label-edit-wrap')) return;

  const wrap = document.createElement('div');
  wrap.className = 'label-edit-wrap';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'label-input';
  input.value = tab.label || '';
  input.placeholder = t('labelPlaceholder');
  input.maxLength = 24;
  wrap.appendChild(input);
  li.appendChild(wrap);
  input.focus();
  input.select();

  getKnownLabels().then(function(labels) {
    const opts = labels.filter(function(l) { return l !== tab.label; }).slice(0, 6);
    if (!opts.length) return;
    const sugg = document.createElement('div');
    sugg.className = 'label-suggestions';
    opts.forEach(function(l) {
      const btn = document.createElement('button');
      btn.className = 'label-sugg-item';
      btn.textContent = l;
      const col = labelColor(l);
      btn.style.borderColor = col.border;
      btn.style.color = col.text;
      btn.addEventListener('mousedown', function(e) {
        e.preventDefault();
        input.value = l;
        save();
      });
      sugg.appendChild(btn);
    });
    wrap.appendChild(sugg);
  });

  function save() {
    const val = input.value.trim();
    wrap.remove();
    setTabLabel(tab.id, val || null);
  }

  function cancel() { wrap.remove(); }

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter')  { e.preventDefault(); save(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });
  input.addEventListener('blur', function() { setTimeout(cancel, 200); });
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

function parseTime(str) {
  const parts = (str || '18:00').split(':');
  return { h: parseInt(parts[0]) || 0, m: parseInt(parts[1]) || 0 };
}

function endOfToday() {
  const { h, m } = parseTime(_settings.todayTime);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d.getTime() <= Date.now()) d.setTime(Date.now() + 2 * 60 * 60 * 1000);
  return d.getTime();
}

function endOfWeek() {
  const { h, m } = parseTime(_settings.weekTime);
  const d = new Date();
  let daysUntil = (_settings.weekDay - d.getDay() + 7) % 7;
  if (daysUntil === 0) daysUntil = 7;
  d.setDate(d.getDate() + daysUntil);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

function nextDailyTime() {
  const { h, m } = parseTime(_settings.dailyTime || '08:00');
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

function snoozeTime(type) {
  if (type === 'today') return endOfToday();
  if (type === 'week') return endOfWeek();
  if (type === 'daily') return nextDailyTime();
  return null;
}

function formatTime(ts) {
  if (!ts) return t('someday');
  const d = new Date(ts);
  const now = new Date();
  const diffMs = ts - Date.now();

  if (diffMs < 0) return t('overdue');
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const diffDays = Math.ceil(diffMs / 86400000);
  if (diffDays === 1) return t('tomorrow');
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function isToday(ts) {
  if (!ts) return false;
  return new Date(ts).toDateString() === new Date().toDateString();
}

function isThisWeek(ts) {
  if (!ts) return false;
  const d = new Date(ts);
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return d >= start && d < end && !isToday(ts);
}

function categoryFor(tab) {
  if (tab.snoozeType === 'daily') return 'daily';
  if (!tab.wakeAt) return 'someday';
  if (isToday(tab.wakeAt) || tab.wakeAt < Date.now()) return 'today';
  if (isThisWeek(tab.wakeAt)) return 'week';
  return 'someday';
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function faviconUrl(url) {
  try {
    const origin = new URL(url).origin;
    return 'https://www.google.com/s2/favicons?sz=32&domain=' + origin;
  } catch { return null; }
}

function faviconEl(url) {
  const span = document.createElement('span');
  span.className = 'item-favicon';
  const src = faviconUrl(url);
  if (src) {
    const img = document.createElement('img');
    img.src = src;
    img.onerror = function() { span.textContent = '🔗'; };
    span.appendChild(img);
  } else {
    span.textContent = '🔗';
  }
  return span;
}

function getToast() {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  return toast;
}

function showToast(msg) {
  const toast = getToast();
  clearInterval(toast._interval);
  clearTimeout(toast._timer);
  toast.innerHTML = '<span class="toast-msg">' + msg + '</span>';
  toast.classList.add('show');
  toast._timer = setTimeout(function() { toast.classList.remove('show'); }, 2500);
}


var _dragSrcId = null;

function makeDailyListDraggable(list) {
  Array.from(list.children).forEach(function(item) {
    item.draggable = true;

    item.addEventListener('dragstart', function(e) {
      _dragSrcId = item.dataset.id;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(function() { item.classList.add('dragging'); }, 0);
    });

    item.addEventListener('dragend', function() {
      item.classList.remove('dragging');
      list.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(function(el) {
        el.classList.remove('drag-over-top', 'drag-over-bottom');
      });
    });

    item.addEventListener('dragover', function(e) {
      e.preventDefault();
      if (item.dataset.id === _dragSrcId) return;
      list.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(function(el) {
        el.classList.remove('drag-over-top', 'drag-over-bottom');
      });
      const rect = item.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        item.classList.add('drag-over-top');
      } else {
        item.classList.add('drag-over-bottom');
      }
    });

    item.addEventListener('drop', async function(e) {
      e.preventDefault();
      if (!_dragSrcId || _dragSrcId === item.dataset.id) return;
      const srcEl = list.querySelector('[data-id="' + _dragSrcId + '"]');
      if (!srcEl) return;
      if (item.classList.contains('drag-over-top')) {
        list.insertBefore(srcEl, item);
      } else {
        list.insertBefore(srcEl, item.nextSibling);
      }
      item.classList.remove('drag-over-top', 'drag-over-bottom');
      const newOrder = Array.from(list.children).map(function(el) { return el.dataset.id; });
      await saveDailyOrder(newOrder);
      _dragSrcId = null;
    });
  });
}

// ─── Mascot mood ──────────────────────────────────────────────────────────────

function updateMascotMood(pendingCount, overdueCount) {
  if (!window.setMascotMood) return;
  var mood;
  if (overdueCount > 0) mood = 'bug';
  else if (pendingCount === 0) mood = 'shipped';
  else if (pendingCount >= 15) mood = '2am';
  else if (pendingCount >= 6) mood = 'coffee';
  else mood = 'neutral';
  window.setMascotMood(mood);
}

// ─── Postpone & reschedule ────────────────────────────────────────────────────

async function rescheduleTab(id, newSnoozeType) {
  const wakeAt = snoozeTime(newSnoozeType);
  await updateTab(id, { snoozeType: newSnoozeType, wakeAt: wakeAt || null });
  chrome.alarms.clear(ALARM_PREFIX + id);
  if (wakeAt) chrome.alarms.create(ALARM_PREFIX + id, { when: wakeAt });
  renderLists();
}

async function shiftTabTime(id, deltaMs) {
  const key = STORAGE_PREFIX + id;
  const data = await chrome.storage.local.get(key);
  const tab = data[key];
  if (!tab) return;
  const base = (tab.wakeAt && tab.wakeAt > Date.now()) ? tab.wakeAt : Date.now();
  const newWakeAt = base + deltaMs;
  await updateTab(id, { wakeAt: newWakeAt });
  chrome.alarms.clear(ALARM_PREFIX + id);
  chrome.alarms.create(ALARM_PREFIX + id, { when: newWakeAt });
  renderLists();
  showToast('⏰ ' + formatTime(newWakeAt));
}

function closeAllMenus(li) {
  li.querySelectorAll('.postpone-menu, .label-edit-wrap').forEach(function(el) { el.remove(); });
}

function openPostponeMenu(tab, li) {
  const existing = li.querySelector('.postpone-menu:not(.time-menu)');
  if (existing) { existing.remove(); return; }
  closeAllMenus(li);
  const menu = document.createElement('div');
  menu.className = 'postpone-menu';
  [
    { type: 'today',   icon: '☀️', label: t('today') },
    { type: 'week',    icon: '📅', label: t('thisWeek') },
    { type: 'someday', icon: '🌙', label: t('someday') },
    { type: 'daily',   icon: '🔁', label: t('addToDaily') },
  ].forEach(function(opt) {
    if (opt.type === tab.snoozeType) return;
    const btn = document.createElement('button');
    btn.className = 'postpone-option';
    btn.innerHTML = '<span>' + opt.icon + '</span><span>' + opt.label + '</span>';
    btn.addEventListener('mousedown', function(e) {
      e.preventDefault();
      menu.remove();
      rescheduleTab(tab.id, opt.type);
    });
    menu.appendChild(btn);
  });
  li.appendChild(menu);
  function closeOnOutside(e) {
    if (!li.contains(e.target)) { if (menu.parentNode) menu.remove(); document.removeEventListener('click', closeOnOutside); }
  }
  setTimeout(function() { document.addEventListener('click', closeOnOutside); }, 0);
}

function openTimeMenu(tab, li) {
  if (li.querySelector('.time-menu')) { li.querySelector('.time-menu').remove(); return; }
  closeAllMenus(li);
  const menu = document.createElement('div');
  menu.className = 'postpone-menu time-menu';
  [
    { label: '+1h', delta: 1 * 60 * 60 * 1000 },
    { label: '+3h', delta: 3 * 60 * 60 * 1000 },
    { label: '+1d', delta: 24 * 60 * 60 * 1000 },
    { label: '+3d', delta: 3 * 24 * 60 * 60 * 1000 },
    { label: '+1w', delta: 7 * 24 * 60 * 60 * 1000 },
  ].forEach(function(s) {
    const btn = document.createElement('button');
    btn.className = 'time-shift-btn';
    btn.textContent = s.label;
    btn.addEventListener('mousedown', function(e) {
      e.preventDefault();
      menu.remove();
      shiftTabTime(tab.id, s.delta);
    });
    menu.appendChild(btn);
  });
  li.appendChild(menu);
  function closeOnOutside(e) {
    if (!li.contains(e.target)) { if (menu.parentNode) menu.remove(); document.removeEventListener('click', closeOnOutside); }
  }
  setTimeout(function() { document.addEventListener('click', closeOnOutside); }, 0);
}

function iconSVG(path) {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>';
}

// ─── Tab item renderer ────────────────────────────────────────────────────────

function renderTabItem(tab, opts) {
  opts = opts || {};
  const li = document.createElement('li');
  li.className = 'tab-item';
  if (tab.wakeAt && tab.wakeAt < Date.now()) li.classList.add('item-overdue');
  li.dataset.id = tab.id;

  const info = document.createElement('div');
  info.className = 'item-info';

  const title = document.createElement('div');
  title.className = 'item-title';
  title.textContent = tab.title || tab.url;

  const meta = document.createElement('div');
  meta.className = 'item-meta';

  if (opts.archived) {
    const badge = document.createElement('span');
    badge.className = 'item-status-badge badge-' + tab.status;
    badge.textContent = t(tab.status === 'read' ? 'read' : 'deleted');
    meta.appendChild(badge);
  } else {
    if (tab.wakeAt && tab.snoozeType !== 'daily') {
      const timeSpan = document.createElement('span');
      timeSpan.className = 'clickable-time';
      timeSpan.textContent = formatTime(tab.wakeAt);
      timeSpan.title = t('clickToReschedule');
      timeSpan.addEventListener('click', function(e) {
        e.stopPropagation();
        openTimeMenu(tab, li);
      });
      meta.appendChild(timeSpan);
    } else {
      meta.appendChild(document.createTextNode(formatTime(tab.wakeAt)));
    }
    if (tab.label) {
      const chip = document.createElement('span');
      chip.className = 'label-chip';
      chip.textContent = tab.label;
      const col = labelColor(tab.label);
      chip.style.background = col.bg;
      chip.style.borderColor = col.border;
      chip.style.color = col.text;
      chip.addEventListener('click', function(e) {
        e.stopPropagation();
        setLabelFilter(tab.label);
      });
      meta.appendChild(chip);
    }
  }

  info.appendChild(title);
  info.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'item-actions';

  if (!opts.archived) {
    const openBtn = document.createElement('button');
    openBtn.className = 'action-btn open';
    openBtn.title = t('openTab');
    openBtn.innerHTML = iconSVG('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>');
    openBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (tab.snoozeType === 'daily') {
        chrome.tabs.create({ url: tab.url });
        rescheduleDaily(tab.id);
      } else {
        openAndArchive(tab.id, tab.url);
      }
    });
    actions.appendChild(openBtn);

    const moveBtn = document.createElement('button');
    moveBtn.className = 'action-btn move';
    moveBtn.title = t('moveCategory');
    moveBtn.innerHTML = iconSVG('<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>');
    moveBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      openPostponeMenu(tab, li);
    });
    actions.appendChild(moveBtn);

    if (tab.snoozeType !== 'daily') {
      const doneBtn = document.createElement('button');
      doneBtn.className = 'action-btn done';
      doneBtn.title = t('markRead');
      doneBtn.innerHTML = iconSVG('<polyline points="20 6 9 17 4 12"/>');
      doneBtn.addEventListener('click', function(e) { e.stopPropagation(); archiveTab(tab.id, 'read'); });
      actions.appendChild(doneBtn);
    }

    const tagBtn = document.createElement('button');
    tagBtn.className = 'action-btn tag';
    tagBtn.title = t('addLabel');
    tagBtn.innerHTML = iconSVG('<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>');
    tagBtn.addEventListener('click', function(e) { e.stopPropagation(); openLabelEditor(tab, li); });
    actions.appendChild(tagBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'action-btn delete';
    delBtn.title = t('remove');
    delBtn.innerHTML = iconSVG('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>');
    delBtn.addEventListener('click', function(e) { e.stopPropagation(); archiveTab(tab.id, 'deleted'); });
    actions.appendChild(delBtn);
  } else {
    const purgeBtn = document.createElement('button');
    purgeBtn.className = 'action-btn delete';
    purgeBtn.title = t('remove');
    purgeBtn.innerHTML = iconSVG('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>');
    purgeBtn.addEventListener('click', function(e) { e.stopPropagation(); purgeTab(tab.id, li); });
    actions.appendChild(purgeBtn);
  }

  if (opts.draggable) {
    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.textContent = '⠿';
    li.appendChild(handle);
  }
  li.appendChild(faviconEl(tab.url));
  li.appendChild(info);
  li.appendChild(actions);

  li.addEventListener('click', function() {
    if (opts.archived) return;
    if (tab.snoozeType === 'daily') {
      chrome.tabs.create({ url: tab.url });
      rescheduleDaily(tab.id);
    } else {
      openAndArchive(tab.id, tab.url);
    }
  });

  return li;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

async function openAndArchive(id, url) {
  await archiveTab(id, 'read');
  chrome.tabs.create({ url });
}

const ARCHIVE_LIMIT = 35;

async function archiveTab(id, status) {
  await updateTab(id, { status, archivedAt: Date.now() });
  chrome.alarms.clear(ALARM_PREFIX + id);
  await pruneArchive();
  showToast(status === 'read' ? t('markedRead') : t('removed'));
  renderLists();
}

async function pruneArchive() {
  const all = await getAllTabs();
  const archived = Object.values(all)
    .filter(function(t) { return t.status !== 'pending'; })
    .sort(function(a, b) { return (a.archivedAt || 0) - (b.archivedAt || 0); });

  if (archived.length <= ARCHIVE_LIMIT) return;
  const toDelete = archived.slice(0, archived.length - ARCHIVE_LIMIT);
  for (const t of toDelete) {
    await deleteTabFromStorage(t.id);
  }
}

async function rescheduleDaily(id) {
  const wakeAt = nextDailyTime();
  await updateTab(id, { wakeAt });
  chrome.alarms.create(ALARM_PREFIX + id, { when: wakeAt });
  renderLists();
}

async function purgeTab(id, liEl) {
  await deleteTabFromStorage(id);
  liEl.remove();
  if (!document.getElementById('list-archive').children.length) {
    document.getElementById('archive-empty').classList.remove('hidden');
  }
}

// ─── Snooze current tab ───────────────────────────────────────────────────────

async function saveCurrent(snoozeType) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab) return;

  const wakeAt = snoozeTime(snoozeType);
  const id = 'tab_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

  await saveTab({ id, url: tab.url, title: tab.title, wakeAt, snoozeType, status: 'pending', savedAt: Date.now() });
  if (wakeAt) chrome.alarms.create(ALARM_PREFIX + id, { when: wakeAt });

  const label = snoozeType === 'today' ? t('today')
    : snoozeType === 'week' ? t('thisWeek')
    : snoozeType === 'daily' ? t('addToDaily')
    : t('someday');

  if (snoozeType !== 'daily') {
    chrome.tabs.remove(tab.id);
  } else {
    renderLists();
    showToast(label + ' ✓');
  }
}

// ─── Snooze all other open tabs ───────────────────────────────────────────────

async function snoozeAllTabs(snoozeType) {
  const allOpen = await chrome.tabs.query({ currentWindow: true });
  const cur = allOpen.find(function(tab) { return tab.active; }) || null;
  const targets = allOpen.filter(function(tab) {
    return tab.id !== (cur && cur.id) &&
      tab.url &&
      !tab.url.startsWith('chrome://') &&
      !tab.url.startsWith('chrome-extension://') &&
      !tab.url.startsWith('about:') &&
      !tab.url.startsWith('moz-extension://');
  });

  if (!targets.length) return;

  const wakeAt = snoozeTime(snoozeType);
  const savedIds = [];
  const browserTabIds = [];

  for (let i = 0; i < targets.length; i++) {
    const tab = targets[i];
    const id = 'tab_' + (Date.now() + i) + '_' + Math.random().toString(36).slice(2, 7);
    await saveTab({ id, url: tab.url, title: tab.title, wakeAt, snoozeType, status: 'pending', savedAt: Date.now() });
    if (wakeAt) chrome.alarms.create(ALARM_PREFIX + id, { when: wakeAt });
    savedIds.push(id);
    browserTabIds.push(tab.id);
  }

  chrome.tabs.remove(browserTabIds);
  document.getElementById('all-tabs-section').classList.add('hidden');
  renderLists();
  showToast(t('tabsSaved').replace('{n}', targets.length));
}


// ─── Render ───────────────────────────────────────────────────────────────────

async function renderLists() {
  const tabs = await getAllTabs();
  const dailyOrder = await getDailyOrder();
  let pending = Object.values(tabs).filter(function(tab) { return tab.status === 'pending'; });

  const _overdueForMood = pending.filter(function(tab) { return tab.wakeAt && tab.wakeAt < Date.now() && tab.snoozeType !== 'daily'; }).length;
  updateMascotMood(pending.length, _overdueForMood);

  // Label filter
  const filterBar = document.getElementById('label-filter-bar');
  if (_filterLabel) {
    pending = pending.filter(function(tab) { return tab.label === _filterLabel; });
    filterBar.classList.remove('hidden');
    const chip = filterBar.querySelector('.filter-chip');
    const col = labelColor(_filterLabel);
    chip.textContent = _filterLabel;
    chip.style.background = col.bg;
    chip.style.borderColor = col.border;
    chip.style.color = col.text;
  } else {
    filterBar.classList.add('hidden');
  }
  const groups = { daily: [], today: [], week: [], someday: [] };

  pending.forEach(function(tab) { groups[categoryFor(tab)].push(tab); });

  Object.keys(groups).forEach(function(key) {
    const items = groups[key];
    const group = document.getElementById('group-' + key);
    const list = document.getElementById('list-' + key);
    const count = document.getElementById('count-' + key);

    list.innerHTML = '';
    if (!items.length) { group.classList.add('hidden'); return; }

    group.classList.remove('hidden');
    count.textContent = items.length;

    if (key === 'daily') {
      items.sort(function(a, b) {
        const ia = dailyOrder.indexOf(a.id);
        const ib = dailyOrder.indexOf(b.id);
        if (ia === -1 && ib === -1) return 0;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
      items.forEach(function(tab) { list.appendChild(renderTabItem(tab, { draggable: true })); });
      makeDailyListDraggable(list);
    } else {
      items.sort(function(a, b) { return (a.wakeAt || Infinity) - (b.wakeAt || Infinity); });
      items.forEach(function(tab) { list.appendChild(renderTabItem(tab)); });
    }
  });

  document.getElementById('empty-state').classList.toggle('hidden', pending.length > 0);
}

async function renderArchive() {
  const tabs = await getAllTabs();
  const archived = Object.values(tabs)
    .filter(function(tab) { return tab.status !== 'pending'; })
    .sort(function(a, b) { return (b.archivedAt || 0) - (a.archivedAt || 0); });

  const list = document.getElementById('list-archive');
  list.innerHTML = '';
  document.getElementById('archive-empty').classList.toggle('hidden', archived.length > 0);
  archived.forEach(function(tab) { list.appendChild(renderTabItem(tab, { archived: true })); });
}

// ─── Migration ────────────────────────────────────────────────────────────────

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

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  await migrateStorage();
  _settings = await loadSettings();
  setLang(resolveLanguage(_settings));
  applyI18n();

  // Snooze button time previews
  document.getElementById('time-today').textContent =
    new Date(endOfToday()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  document.getElementById('time-week').textContent =
    LOCALES[getLang()].daysShort[_settings.weekDay];
  document.getElementById('time-daily').textContent =
    new Date(nextDailyTime()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Current tab info
  const allOpen = await chrome.tabs.query({ currentWindow: true });
  const currentTab = allOpen.find(function(tab) { return tab.active; }) || null;

  if (currentTab) {
    document.getElementById('current-title').textContent = currentTab.title || currentTab.url;
    const favSpan = document.getElementById('current-favicon');
    const src = currentTab.favIconUrl || faviconUrl(currentTab.url);
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.onerror = function() { favSpan.textContent = '🔗'; };
      img.style.cssText = 'width:16px;height:16px;border-radius:3px';
      favSpan.appendChild(img);
    }
  }

  // Other open tabs section
  const otherTabs = allOpen.filter(function(tab) {
    return tab.id !== (currentTab && currentTab.id) &&
      tab.url &&
      !tab.url.startsWith('chrome://') &&
      !tab.url.startsWith('chrome-extension://') &&
      !tab.url.startsWith('about:') &&
      !tab.url.startsWith('moz-extension://');
  });

  if (otherTabs.length > 0) {
    const section = document.getElementById('all-tabs-section');
    section.classList.remove('hidden');
    document.getElementById('all-tabs-label').textContent =
      t('otherTabs').replace('{n}', otherTabs.length);

    document.querySelectorAll('.snooze-all-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { snoozeAllTabs(btn.dataset.snooze); });
    });
  }

  // Snooze current tab buttons
  document.querySelectorAll('.snooze-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { saveCurrent(btn.dataset.snooze); });
  });

  // Archive toggle
  const archiveView = document.getElementById('archive-view');
  const mainContent = document.getElementById('tabs-list');
  const saveSection = document.getElementById('save-section');
  const allTabsSection = document.getElementById('all-tabs-section');

  document.getElementById('btn-archive-view').addEventListener('click', function() {
    archiveView.classList.remove('hidden');
    mainContent.classList.add('hidden');
    saveSection.classList.add('hidden');
    allTabsSection.classList.add('hidden');
    renderArchive();
  });

  document.getElementById('btn-back').addEventListener('click', function() {
    archiveView.classList.add('hidden');
    mainContent.classList.remove('hidden');
    saveSection.classList.remove('hidden');
    if (otherTabs.length > 0) allTabsSection.classList.remove('hidden');
  });

  document.getElementById('btn-settings').addEventListener('click', function() {
    chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
  });

  document.getElementById('label-filter-clear').addEventListener('click', function() {
    _filterLabel = null;
    renderLists();
  });

  await renderLists();
}

document.addEventListener('DOMContentLoaded', init);
