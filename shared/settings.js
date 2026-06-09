var DEFAULT_SETTINGS = {
  language: 'auto',
  todayTime: '18:00',
  weekDay: 5,
  weekTime: '09:00',
  dailyTime: '08:00',
  undoSecs: 8,
};

async function loadSettings() {
  const data = await chrome.storage.sync.get('settings');
  const stored = data.settings || {};

  // Migrate old integer-hour format to HH:MM strings
  if (stored.todayHour !== undefined && stored.todayTime === undefined) {
    stored.todayTime = String(stored.todayHour).padStart(2, '0') + ':00';
  }
  if (stored.weekHour !== undefined && stored.weekTime === undefined) {
    stored.weekTime = String(stored.weekHour).padStart(2, '0') + ':00';
  }

  return Object.assign({}, DEFAULT_SETTINGS, stored);
}

function resolveLanguage(settings) {
  if (settings.language && settings.language !== 'auto') return settings.language;
  const code = ((typeof navigator !== 'undefined' ? navigator.language : null) || 'en')
    .slice(0, 2).toLowerCase();
  return ['en', 'es', 'pt'].includes(code) ? code : 'en';
}
