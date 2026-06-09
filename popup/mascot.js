(function () {
  'use strict';

  var MOOD_KEYS = ['neutral', '2am', 'bug', 'shipped', 'coffee'];

  var MOODS = {
    neutral: {
      label: 'neutral',
      mouthD: 'M104 112 Q130 120 156 112',
      pupilColor: '#50fa7b',
      eyeRy: 9,
      code: [
        { t: 'const snooze = (tabs) => {', c: '#f8f8f2' },
        { t: '  tabs.forEach(tab =>',      c: '#8be9fd' },
        { t: '    tab.sleep(tomorrow)',     c: '#50fa7b' },
        { t: '  )',                         c: '#f8f8f2' },
        { t: '// ✓ 47 tabs sleeping',      c: '#6272a4' },
      ],
    },
    '2am': {
      label: '2am mode',
      mouthD: 'M104 113 Q130 116 156 113',
      pupilColor: '#bd93f9',
      eyeRy: 4,
      code: [
        { t: '// why am I awake',          c: '#6272a4' },
        { t: 'const sleep = undefined',    c: '#ff79c6' },
        { t: 'while (true) { // help',     c: '#ffb86c' },
        { t: '  stare(ceiling)',           c: '#8be9fd' },
        { t: '// zzz... maybe later',      c: '#6272a4' },
      ],
    },
    bug: {
      label: 'bug found',
      mouthD: 'M104 116 Q130 110 156 116',
      pupilColor: '#ff5555',
      eyeRy: 9,
      code: [
        { t: 'TypeError: undefined',       c: '#ff5555' },
        { t: '  at snooze.js:3:7',         c: '#6272a4' },
        { t: '  at Array.forEach',         c: '#6272a4' },
        { t: '// it worked yesterday',     c: '#6272a4' },
        { t: '// not crying u r',          c: '#bd93f9' },
      ],
    },
    shipped: {
      label: 'shipped! 🚀',
      mouthD: 'M98 108 Q130 126 162 108',
      pupilColor: '#50fa7b',
      eyeRy: 9,
      code: [
        { t: '✓ all tabs sleeping',        c: '#50fa7b' },
        { t: '✓ inbox: zero',              c: '#50fa7b' },
        { t: '✓ brain: clear',             c: '#50fa7b' },
        { t: '// mood: shipped',           c: '#ffb86c' },
        { t: '// pushing to prod',         c: '#6272a4' },
      ],
    },
    coffee: {
      label: 'coffee low ☕',
      mouthD: 'M104 114 Q130 114 156 114',
      pupilColor: '#ffb86c',
      eyeRy: 9,
      code: [
        { t: 'WARNING: low energy',        c: '#ffb86c' },
        { t: 'const coffee = 0',           c: '#ff5555' },
        { t: '// cannot function',         c: '#6272a4' },
        { t: '// send help',               c: '#6272a4' },
        { t: '// or espresso',             c: '#bd93f9' },
      ],
    },
  };

  var _moodIdx = 0;
  var _angle = 0;
  var _blinkTimer = null;
  var _rafId = null;

  var eyeL, eyeR, pupilL, pupilR, shineL, shineR, mouthEl, codeBlock, moodLabel;

  var BASE_PL = { cx: 89, cy: 31 };
  var BASE_PR = { cx: 173, cy: 31 };
  var BASE_SL = { cx: 90, cy: 30 };
  var BASE_SR = { cx: 174, cy: 30 };

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function sa(el, k, v) { el.setAttribute(k, String(v)); }

  function buildCode(lines) {
    while (codeBlock.firstChild) codeBlock.removeChild(codeBlock.firstChild);
    lines.slice(0, 5).forEach(function (line, i) {
      var txt = document.createElementNS(SVG_NS, 'text');
      sa(txt, 'x', 40);
      sa(txt, 'y', 50 + i * 11);
      sa(txt, 'font-family', 'monospace');
      sa(txt, 'font-size', 7.5);
      sa(txt, 'fill', line.c);
      txt.textContent = line.t;
      codeBlock.appendChild(txt);
    });
  }

  function applyMood(key) {
    var m = MOODS[key];
    if (!m) return;
    sa(mouthEl, 'd', m.mouthD);
    sa(pupilL, 'fill', m.pupilColor);
    sa(pupilR, 'fill', m.pupilColor);
    sa(eyeL, 'ry', m.eyeRy);
    sa(eyeR, 'ry', m.eyeRy);
    buildCode(m.code);
    if (moodLabel) moodLabel.textContent = m.label;
  }

  function blink() {
    var m = MOODS[MOOD_KEYS[_moodIdx]];
    var target = m ? m.eyeRy : 9;
    sa(eyeL, 'ry', 0.5);
    sa(eyeR, 'ry', 0.5);
    setTimeout(function () {
      sa(eyeL, 'ry', target);
      sa(eyeR, 'ry', target);
    }, 120);
  }

  function scheduleBlink() {
    _blinkTimer = setTimeout(function () {
      blink();
      scheduleBlink();
    }, 2500 + Math.random() * 4000);
  }

  function animatePupils() {
    _angle += 0.018;
    var dx = Math.sin(_angle) * 2.2;
    var dy = Math.cos(_angle * 0.7) * 1.5;
    sa(pupilL, 'cx', BASE_PL.cx + dx);
    sa(pupilL, 'cy', BASE_PL.cy + dy);
    sa(pupilR, 'cx', BASE_PR.cx + dx);
    sa(pupilR, 'cy', BASE_PR.cy + dy);
    sa(shineL, 'cx', BASE_SL.cx + dx);
    sa(shineL, 'cy', BASE_SL.cy + dy);
    sa(shineR, 'cx', BASE_SR.cx + dx);
    sa(shineR, 'cy', BASE_SR.cy + dy);
    _rafId = requestAnimationFrame(animatePupils);
  }

  function initMascot() {
    if (!document.getElementById('mascot-svg')) return;
    eyeL      = document.getElementById('eye-l');
    eyeR      = document.getElementById('eye-r');
    pupilL    = document.getElementById('pupil-l');
    pupilR    = document.getElementById('pupil-r');
    shineL    = document.getElementById('shine-l');
    shineR    = document.getElementById('shine-r');
    mouthEl   = document.getElementById('mouth');
    codeBlock = document.getElementById('code-block');
    moodLabel = document.getElementById('mood-label');
    if (!eyeL || !mouthEl || !codeBlock) return;

    applyMood(MOOD_KEYS[_moodIdx]);

    var container = document.getElementById('mascot-container');
    if (container) {
      container.addEventListener('click', function () {
        _moodIdx = (_moodIdx + 1) % MOOD_KEYS.length;
        applyMood(MOOD_KEYS[_moodIdx]);
      });
    }

    scheduleBlink();
    animatePupils();
  }

  window.setMascotMood = function(key) {
    if (!MOODS[key]) return;
    var idx = MOOD_KEYS.indexOf(key);
    if (idx >= 0) _moodIdx = idx;
    if (eyeL) applyMood(key);
  };

  document.addEventListener('DOMContentLoaded', initMascot);
})();
