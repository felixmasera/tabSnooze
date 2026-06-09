function parseTime(str) {
  const parts = (str || '00:00').split(':');
  return { h: parseInt(parts[0]) || 0, m: parseInt(parts[1]) || 0 };
}

function calcWakeAt(snoozeType, s) {
  const now = Date.now();
  if (snoozeType === 'today') {
    const { h, m } = parseTime(s.todayTime);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    if (d.getTime() <= now) d.setTime(now + 2 * 60 * 60 * 1000);
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
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  return null;
}

async function rescheduleAllAlarms(newSettings) {
  const all = await chrome.storage.local.get(null);
  const updates = {};

  for (const key of Object.keys(all)) {
    if (!key.startsWith('ts_')) continue;
    const tab = all[key];
    if (!tab || !tab.id || !tab.url || tab.status !== 'pending') continue;
    if (!['today', 'week', 'daily'].includes(tab.snoozeType)) continue;

    const wakeAt = calcWakeAt(tab.snoozeType, newSettings);
    if (!wakeAt) continue;

    updates[key] = Object.assign({}, tab, { wakeAt });
    chrome.alarms.clear('snooze_' + tab.id);
    chrome.alarms.create('snooze_' + tab.id, { when: wakeAt });
  }

  if (Object.keys(updates).length) {
    await chrome.storage.local.set(updates);
  }
}

function populateDays(selectId, selectedDay) {
  const sel = document.getElementById(selectId);
  sel.innerHTML = '';
  const days = LOCALES[getLang()].days;
  days.forEach(function(name, i) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = name;
    opt.selected = i === selectedDay;
    sel.appendChild(opt);
  });
}

async function init() {
  const settings = await loadSettings();
  setLang(resolveLanguage(settings));
  applyI18n();

  document.getElementById('sel-lang').value = settings.language || 'auto';
  document.getElementById('sel-undo-secs').value = String(settings.undoSecs || 8);
  document.getElementById('inp-today-time').value = settings.todayTime || '18:00';
  document.getElementById('inp-daily-time').value = settings.dailyTime || '08:00';
  document.getElementById('inp-week-time').value = settings.weekTime || '09:00';
  populateDays('sel-week-day', settings.weekDay);

  document.getElementById('sel-lang').addEventListener('change', function() {
    const val = this.value;
    const effective = val === 'auto' ? resolveLanguage({ language: 'auto' }) : val;
    setLang(effective);
    const currentDay = parseInt(document.getElementById('sel-week-day').value);
    applyI18n();
    populateDays('sel-week-day', currentDay);
  });

  document.getElementById('btn-save').addEventListener('click', async function() {
    const newSettings = {
      language: document.getElementById('sel-lang').value,
      undoSecs: parseInt(document.getElementById('sel-undo-secs').value) || 8,
      todayTime: document.getElementById('inp-today-time').value || '18:00',
      dailyTime: document.getElementById('inp-daily-time').value || '08:00',
      weekDay: parseInt(document.getElementById('sel-week-day').value),
      weekTime: document.getElementById('inp-week-time').value || '09:00',
    };
    await chrome.storage.sync.set({ settings: newSettings });
    await rescheduleAllAlarms(newSettings);

    const msg = document.getElementById('saved-msg');
    msg.classList.remove('hidden');
    clearTimeout(msg._timer);
    msg._timer = setTimeout(function() { msg.classList.add('hidden'); }, 2500);
  });

  document.getElementById('btn-test-alarm').addEventListener('click', async function() {
    const btn = this;
    const testId = 'test_' + Date.now();
    const wakeAt = Date.now() + 10000;

    await chrome.storage.local.set({
      ['ts_' + testId]: {
        id: testId,
        url: 'https://example.com',
        title: '🧪 Test — TabSnooze works!',
        wakeAt,
        status: 'pending',
        savedAt: Date.now(),
      }
    });
    chrome.alarms.create('snooze_' + testId, { when: wakeAt });

    btn.disabled = true;
    let secs = 10;
    btn.textContent = '⏳ ' + secs + 's...';
    const interval = setInterval(function() {
      secs--;
      if (secs <= 0) {
        clearInterval(interval);
        btn.disabled = false;
        btn.textContent = t('testAlarmBtn');
      } else {
        btn.textContent = '⏳ ' + secs + 's...';
      }
    }, 1000);
  });
}

document.addEventListener('DOMContentLoaded', init);
