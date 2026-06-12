// Mock of the chrome.* APIs so popup.html can render outside the extension,
// used only to generate Chrome Web Store screenshots. Never shipped.
(function () {
  'use strict';

  var EMPTY = location.search.indexOf('empty') !== -1;

  var now = Date.now();
  var in2h = now + 2 * 60 * 60 * 1000;
  var in5h = now + 5 * 60 * 60 * 1000;
  var tomorrow = (function () {
    var d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.getTime();
  })();

  var TABS = EMPTY ? {} : {
    ts_tab_demo1: { id: 'tab_demo1', url: 'https://mail.google.com/mail/u/0/', title: 'Inbox (3) — Gmail', wakeAt: in2h, snoozeType: 'daily', status: 'pending', savedAt: now },
    ts_tab_demo2: { id: 'tab_demo2', url: 'https://github.com/notifications', title: 'Notifications — GitHub', wakeAt: in2h, snoozeType: 'today', status: 'pending', savedAt: now, label: 'work' },
    ts_tab_demo3: { id: 'tab_demo3', url: 'https://medium.com/deep-work-guide', title: 'How to focus deeply in a distracted world', wakeAt: in5h, snoozeType: 'today', status: 'pending', savedAt: now, label: 'reading' },
    ts_tab_demo4: { id: 'tab_demo4', url: 'https://www.youtube.com/watch?v=demo', title: 'The Future of Web Browsers — Conference Talk', wakeAt: tomorrow, snoozeType: 'week', status: 'pending', savedAt: now },
    ts_tab_demo5: { id: 'tab_demo5', url: 'https://doc.rust-lang.org/book/', title: 'The Rust Programming Language — Book', wakeAt: null, snoozeType: 'someday', status: 'pending', savedAt: now, label: 'learn' },
  };

  var LOCAL = Object.assign({
    ts_labels: ['work', 'reading', 'learn'],
    ts_label_colors: { work: 0, reading: 1, learn: 2 },
    ts_daily_order: ['tab_demo1'],
  }, TABS);

  var SYNC = {
    settings: { language: 'en', todayTime: '18:00', weekDay: 5, weekTime: '09:00', dailyTime: '08:00', undoSecs: 8 },
  };

  var CURRENT_TAB = {
    id: 1, active: true,
    url: 'https://www.theverge.com/tech-review',
    title: 'The 10 best productivity tools of 2026 — The Verge',
    favIconUrl: 'https://www.google.com/s2/favicons?sz=32&domain=https://www.theverge.com',
  };

  var OTHER_TABS = EMPTY ? [] : [
    { id: 2, active: false, url: 'https://news.ycombinator.com', title: 'Hacker News' },
    { id: 3, active: false, url: 'https://www.figma.com/files', title: 'Figma — Files' },
    { id: 4, active: false, url: 'https://en.wikipedia.org/wiki/Stoicism', title: 'Stoicism — Wikipedia' },
  ];

  function makeArea(store) {
    return {
      get: function (keys) {
        var out = {};
        if (keys === null || keys === undefined) {
          Object.keys(store).forEach(function (k) { out[k] = store[k]; });
        } else if (typeof keys === 'string') {
          if (store[keys] !== undefined) out[keys] = store[keys];
        } else if (Array.isArray(keys)) {
          keys.forEach(function (k) { if (store[k] !== undefined) out[k] = store[k]; });
        }
        return Promise.resolve(out);
      },
      set: function (obj) { Object.assign(store, obj); return Promise.resolve(); },
      remove: function (keys) {
        (Array.isArray(keys) ? keys : [keys]).forEach(function (k) { delete store[k]; });
        return Promise.resolve();
      },
    };
  }

  window.chrome = {
    storage: { local: makeArea(LOCAL), sync: makeArea(SYNC) },
    tabs: {
      query: function (q) {
        if (q && q.active) return Promise.resolve([CURRENT_TAB]);
        return Promise.resolve([CURRENT_TAB].concat(OTHER_TABS));
      },
      create: function () { return Promise.resolve({}); },
      remove: function () { return Promise.resolve(); },
    },
    alarms: {
      create: function () {},
      clear: function () { return Promise.resolve(true); },
    },
    runtime: {
      getURL: function (p) { return '../' + p; },
    },
  };
})();
