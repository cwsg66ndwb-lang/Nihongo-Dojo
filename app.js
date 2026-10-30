'use strict';
/* Nihongo Dojo - offline Japanese kana, vocabulary and pronunciation trainer.
   Plain JavaScript, no build step. Progress lives in localStorage on the device. */

// ---------------------------------------------------------------- helpers
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const todayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const toKata = (s) => [...s].map((ch) => { const c = ch.codePointAt(0); return c >= 0x3041 && c <= 0x3096 ? String.fromCodePoint(c + 0x60) : ch; }).join('');
const toHira = (s) => [...s].map((ch) => { const c = ch.codePointAt(0); return c >= 0x30a1 && c <= 0x30f6 ? String.fromCodePoint(c - 0x60) : ch; }).join('');
const jp = (s, cls = '') => `<span lang="ja" class="${cls}">${esc(s)}</span>`;

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[m][n];
}

// ---------------------------------------------------------------- content model
const GROUPS = { basic: 'Basic', dakuten: 'Dakuten (゛゜)', yoon: 'Combinations' };
const KANA = [];
const ITEMS = new Map();

(function buildKana() {
  for (const script of ['h', 'k']) {
    const add = (rows, group) => rows.forEach((row, ri) => row.forEach((cell) => {
      if (!cell) return;
      const char = script === 'h' ? cell[0] : toKata(cell[0]);
      const item = { id: `${script}:${char}`, type: 'kana', script, group, row: ri, char, hira: cell[0], romaji: cell[1] };
      KANA.push(item);
      ITEMS.set(item.id, item);
    }));
    add(KANA_BASIC, 'basic');
    add(KANA_DAKUTEN, 'dakuten');
    add(KANA_YOON, 'yoon');
  }
})();

const VOCAB_ITEMS = [];
for (const [cat, list] of Object.entries(VOCAB)) {
  for (const [kana, written, romaji, en] of list) {
    // Homophones (はな = nose / flower) get the written form added to keep ids unique.
    let id = `v:${kana}`;
    if (ITEMS.has(id)) id = `v:${kana}|${written}`;
    if (ITEMS.has(id)) { console.warn('Duplicate vocab', kana); continue; }
    const item = { id, type: 'vocab', cat, kana, written: written || kana, romaji, en };
    VOCAB_ITEMS.push(item);
    ITEMS.set(id, item);
  }
}

const KANJI_ITEMS = [];
for (const [group, list] of Object.entries(KANJI)) {
  for (const [char, meaning, on, kun, ex] of list) {
    const item = {
      id: `j:${char}`, type: 'kanji', group, char, meaning,
      on: on ? on.split(' ') : [], kun: kun ? kun.split(' ') : [],
      ex: ex.map(([written, kana, romaji, en]) => ({ written, kana, romaji, en })),
    };
    KANJI_ITEMS.push(item);
    ITEMS.set(item.id, item);
  }
}
// Example words / sentences as speakable pseudo-items (not tracked in reviews).
const exampleItem = (e, id, cat) => ({ id, type: 'vocab', cat, kana: e.kana, written: e.written, romaji: e.romaji, en: e.en, pseudo: true });
const KANJI_WORDS = KANJI_ITEMS.flatMap((k) => k.ex.map((e, i) => exampleItem(e, `jx:${k.char}:${i}`, 'Kanji words')));
const GRAMMAR_SENTENCES = GRAMMAR.flatMap((g) => g.examples.map(([written, kana, romaji, en], i) => exampleItem({ written, kana, romaji, en }, `gx:${g.id}:${i}`, 'Grammar sentences')));
const PSEUDO = new Map([...KANJI_WORDS, ...GRAMMAR_SENTENCES].map((x) => [x.id, x]));
const getItem = (id) => ITEMS.get(id) || PSEUDO.get(id);

const romajiAccepts = (romaji) => [romaji, ...(ROMAJI_ALT[romaji] || [])];
const speakText = (it) => (it.type === 'kana' ? it.hira : it.type === 'kanji' ? it.ex[0].written : it.written);
const label = (it) => (it.type === 'vocab' ? it.kana : it.char);
const kanaTip = (it) => KANA_TIPS[it.char] || KANA_TIPS[it.hira] || '';

function examplesFor(it) {
  const first = it.char;
  return VOCAB_ITEMS.filter((v) => v.kana.startsWith(first) && v.kana.length > first.length && !v.kana.startsWith(first + 'ゃ') && !v.kana.startsWith(first + 'ゅ') && !v.kana.startsWith(first + 'ょ') && !v.kana.startsWith(first + 'ャ') && !v.kana.startsWith(first + 'ュ') && !v.kana.startsWith(first + 'ョ')).slice(0, 3);
}

// ---------------------------------------------------------------- state
const STORE_KEY = 'nihongo-dojo-v1';
const DEFAULT_STATE = {
  srs: {},
  settings: { voiceURI: '', rate: 0.85, newPerDay: 15, showRomaji: true },
  streak: { last: '', count: 0 },
  daily: { date: '', new: {}, answered: 0 },
  grammar: {},
};
let state = loadState();

function loadState() {
  const base = JSON.parse(JSON.stringify(DEFAULT_STATE));
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && typeof s === 'object') {
      return {
        srs: s.srs || {},
        settings: { ...base.settings, ...(s.settings || {}) },
        streak: { ...base.streak, ...(s.streak || {}) },
        daily: { ...base.daily, ...(s.daily || {}) },
        grammar: s.grammar || {},
      };
    }
  } catch (e) { console.warn('Could not read saved progress', e); }
  return base;
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { toast('Could not save progress'); }
}
function daily() {
  const t = todayStr();
  if (state.daily.date !== t) state.daily = { date: t, new: {}, answered: 0 };
  return state.daily;
}
function markActivity() {
  const t = todayStr();
  const d = daily();
  d.answered++;
  if (state.streak.last === t) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  state.streak.count = state.streak.last === todayStr(y) ? state.streak.count + 1 : 1;
  state.streak.last = t;
}
function currentStreak() {
  const y = new Date(); y.setDate(y.getDate() - 1);
  return state.streak.last === todayStr() || state.streak.last === todayStr(y) ? state.streak.count : 0;
}

// ---------------------------------------------------------------- spaced repetition
const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;
// Box 0 = new. Each box sets the wait before the card comes back.
const INTERVALS = [0, 10 * MIN, DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY, 60 * DAY, 120 * DAY, 240 * DAY];
const MAX_BOX = INTERVALS.length - 1;

const DECKS = {
  hira: { name: 'Hiragana', jp: 'ひらがな', items: () => KANA.filter((k) => k.script === 'h') },
  kata: { name: 'Katakana', jp: 'カタカナ', items: () => KANA.filter((k) => k.script === 'k') },
  kanji: { name: 'Kanji', jp: '漢字', items: () => KANJI_ITEMS },
  vocab: { name: 'Words & phrases', jp: 'ことば', items: () => VOCAB_ITEMS },
};
const deckOf = (it) => (it.type === 'vocab' ? 'vocab' : it.type === 'kanji' ? 'kanji' : it.script === 'h' ? 'hira' : 'kata');
const rec = (id) => state.srs[id];

function nextBox(r, g) {
  const b = r ? r.b : 0;
  if (g === 0) return 1;
  if (g === 1) return Math.max(1, b);
  if (g === 2) return Math.min(b + 1, MAX_BOX);
  return Math.min(b + (b === 0 ? 3 : 2), MAX_BOX);
}
function intervalFor(r, g) {
  if (g === 0) return MIN;
  const iv = INTERVALS[nextBox(r, g)];
  return g === 1 ? Math.max(5 * MIN, iv / 2) : iv;
}
function fmtInterval(ms) {
  if (ms < HOUR) return `${Math.round(ms / MIN)}m`;
  if (ms < DAY) return `${Math.round(ms / HOUR)}h`;
  if (ms < 60 * DAY) return `${Math.round(ms / DAY)}d`;
  return `${Math.round(ms / (30 * DAY))}mo`;
}
function grade(id, g) {
  const now = Date.now();
  const r = state.srs[id] || { b: 0, due: 0, c: 0, w: 0 };
  const wasNew = !r.b;
  const iv = intervalFor(r, g);
  r.b = nextBox(r, g);
  r.due = now + iv;
  if (g === 0) r.w++; else r.c++;
  state.srs[id] = r;
  if (wasNew) { const d = daily(); const k = deckOf(ITEMS.get(id)); d.new[k] = (d.new[k] || 0) + 1; }
  markActivity();
  save();
}
// Quiz answers adjust stats; a miss pulls a well-known card back for review.
function quizResult(id, ok) {
  if (!ITEMS.has(id)) { markActivity(); save(); return; }
  const r = state.srs[id] || { b: 0, due: 0, c: 0, w: 0 };
  if (ok) r.c++; else {
    r.w++;
    if (r.b > 2) r.b = 2;
    if (r.b > 0) r.due = Math.min(r.due, Date.now());
  }
  state.srs[id] = r;
  markActivity();
  save();
}
function deckCounts(key) {
  const now = Date.now();
  const items = DECKS[key].items();
  let due = 0, unseen = 0, learned = 0;
  for (const it of items) {
    const r = rec(it.id);
    if (!r || !r.b) unseen++;
    else { if (r.due <= now) due++; if (r.b >= 4) learned++; }
  }
  const newLeft = Math.min(unseen, Math.max(0, state.settings.newPerDay - (daily().new[key] || 0)));
  return { due, unseen, learned, newLeft, total: items.length };
}
function buildQueue(key) {
  const now = Date.now();
  const items = DECKS[key].items();
  const due = items.filter((it) => { const r = rec(it.id); return r && r.b && r.due <= now; })
    .sort((a, b) => rec(a.id).due - rec(b.id).due).slice(0, 150);
  const fresh = items.filter((it) => { const r = rec(it.id); return !r || !r.b; }).slice(0, deckCounts(key).newLeft);
  // Spread new cards through the reviews so the session stays varied.
  const q = [...due];
  fresh.forEach((it, i) => q.splice(Math.min(q.length, i * 3 + 1), 0, it));
  return q.map((it) => it.id);
}
function mastery(id) {
  const r = rec(id);
  if (!r || (!r.b && !r.c && !r.w)) return 'm0';
  if (r.w > r.c + 1) return 'mw';
  if (r.b >= 4) return 'm3';
  if (r.b >= 2) return 'm2';
  return 'm1';
}
function weakest(n = 10) {
  return [...ITEMS.values()]
    .map((it) => ({ it, r: rec(it.id) }))
    .filter(({ r }) => r && r.w > 0)
    .sort((a, b) => (b.r.w / (b.r.c + b.r.w)) - (a.r.w / (a.r.c + a.r.w)) || b.r.w - a.r.w)
    .slice(0, n).map(({ it }) => it);
}

// ---------------------------------------------------------------- speech (text to speech)
const Speech = {
  voices: [],
  supported: 'speechSynthesis' in window,
  init() {
    if (!this.supported) return;
    const load = () => {
      this.voices = speechSynthesis.getVoices().filter((v) => /^ja([-_]|$)/i.test(v.lang));
      document.dispatchEvent(new Event('voices-ready'));
    };
    load();
    speechSynthesis.addEventListener?.('voiceschanged', load);
  },
  voice() {
    const v = this.voices;
    return v.find((x) => x.voiceURI === state.settings.voiceURI)
      || v.find((x) => /kyoko|o-ren|otoya|hattori/i.test(x.name))
      || v.find((x) => x.localService) || v[0] || null;
  },
  speak(text, rateMul = 1) {
    if (!this.supported) { toast('Speech is not supported on this device'); return Promise.resolve(); }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    const v = this.voice();
    if (v) u.voice = v;
    u.rate = clamp(state.settings.rate * rateMul, 0.3, 1.5);
    return new Promise((resolve) => {
      const done = () => { clearTimeout(timer); resolve(); };
      const timer = setTimeout(done, 1500 + text.length * 600 / u.rate);
      u.onend = done; u.onerror = done;
      speechSynthesis.speak(u);
    });
  },
};
const say = (it, slow = false) => Speech.speak(speakText(it), slow ? 0.6 : 1);

// ---------------------------------------------------------------- router
const app = () => $('#app');
let cleanup = null;
const VIEWS = {};
// Views that live under another tab in the bottom bar.
const TAB_OF = { settings: 'home', review: 'practice', quiz: 'practice', speak: 'practice', lesson: 'grammar' };
function go(view, params = {}) {
  if (cleanup) { try { cleanup(); } catch (e) { console.warn(e); } cleanup = null; }
  closeSheet();
  if (Speech.supported) speechSynthesis.cancel();
  const v = VIEWS[view] ? view : 'home';
  const tab = TAB_OF[v] || v;
  $$('.tabbar button').forEach((b) => b.setAttribute('aria-current', b.dataset.view === tab ? 'page' : 'false'));
  const el = app();
  el.onclick = el.onchange = el.oninput = el.onsubmit = null;
  el.scrollTop = 0;
  window.scrollTo(0, 0);
  VIEWS[v](el, params);
  const h = app().querySelector('h1');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
}

// ---------------------------------------------------------------- home
VIEWS.home = (el) => {
  const streak = currentStreak();
  const d = daily();
  const weak = weakest(12);
  el.innerHTML = `
    <header class="top">
      <h1>Nihongo Dojo <span lang="ja" class="sub">日本語道場</span></h1>
      <button class="icon-btn" data-act="settings" aria-label="Settings">⚙️</button>
    </header>
    <section class="card hero">
      <div class="stat"><div class="num">${streak}</div><div class="lbl">day streak 🔥</div></div>
      <div class="stat"><div class="num">${d.answered}</div><div class="lbl">answers today</div></div>
    </section>
    <section class="card">
      <h2>Daily review</h2>
      ${Object.keys(DECKS).map((k) => {
        const c = deckCounts(k);
        const pct = Math.round((c.learned / c.total) * 100);
        return `<div class="deck-row">
          <div class="deck-info">
            <div class="deck-name">${esc(DECKS[k].name)} ${jp(DECKS[k].jp, 'muted')}</div>
            <div class="deck-meta">${c.due} due · ${c.newLeft} new · ${pct}% learned</div>
            <div class="bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
          </div>
          <button class="btn primary" data-act="review" data-deck="${k}" ${c.due + c.newLeft ? '' : 'disabled'}>${c.due + c.newLeft ? 'Start' : 'Done ✓'}</button>
        </div>`;
      }).join('')}
    </section>
    <section class="card">
      <h2>Quick practice</h2>
      <div class="grid2">
        <button class="btn" data-act="quiz" data-mode="k2r" data-script="h">あ → a<br><small>Hiragana reading</small></button>
        <button class="btn" data-act="quiz" data-mode="k2r" data-script="k">ア → a<br><small>Katakana reading</small></button>
        <button class="btn" data-act="quiz" data-mode="a2k" data-script="b">🔊 → あ<br><small>Listening</small></button>
        <button class="btn" data-act="quiz" data-mode="v2e">${jp('ことば')} → word<br><small>Vocabulary</small></button>
        <button class="btn" data-act="quiz" data-mode="j2m">${jp('日')} → day<br><small>Kanji meaning</small></button>
        <button class="btn" data-act="quiz" data-mode="jw2r">${jp('電車')} → ${jp('でんしゃ')}<br><small>Kanji reading</small></button>
      </div>
    </section>
    ${(() => {
      const next = GRAMMAR.find((g) => !state.grammar[g.id]?.passed);
      const doneN = GRAMMAR.filter((g) => state.grammar[g.id]?.passed).length;
      return `<section class="card">
        <h2>Grammar <span class="muted small">${doneN} / ${GRAMMAR.length} lessons</span></h2>
        <div class="bar" aria-hidden="true"><span style="width:${(doneN / GRAMMAR.length) * 100}%"></span></div>
        ${next ? `<button class="btn wide next-lesson" data-act="lesson" data-id="${esc(next.id)}">Next: ${esc(next.title)} ${jp(next.jp)}</button>`
          : '<p>All lessons passed. Revisit any time from the Grammar tab.</p>'}
      </section>`;
    })()}
    <section class="card">
      <h2>Needs work</h2>
      ${weak.length ? `<div class="chips">${weak.map((it) => `<button class="chip" data-act="item" data-id="${esc(it.id)}">${jp(label(it))}</button>`).join('')}</div>`
        : '<p class="muted">Nothing yet. Missed items from reviews and quizzes show up here.</p>'}
    </section>`;
  el.onclick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const a = b.dataset.act;
    if (a === 'settings') go('settings');
    else if (a === 'review') go('review', { deck: b.dataset.deck });
    else if (a === 'quiz') go('quiz', { autostart: { mode: b.dataset.mode, script: b.dataset.script || 'h', groups: ['basic'], cat: 'all', kgroup: 'all', len: 15 } });
    else if (a === 'item') openItem(ITEMS.get(b.dataset.id));
    else if (a === 'lesson') go('lesson', { id: b.dataset.id });
  };
};

// ---------------------------------------------------------------- practice hub
VIEWS.practice = (el) => {
  const due = Object.keys(DECKS).reduce((n, k) => n + deckCounts(k).due, 0);
  el.innerHTML = `
    <header class="top"><h1>Practice</h1></header>
    <button class="card hub" data-go="review">
      <span class="hub-icon" aria-hidden="true">🃏</span>
      <span><strong>Review flashcards</strong><br><span class="muted small">Spaced repetition · ${due} due now</span></span>
    </button>
    <button class="card hub" data-go="quiz">
      <span class="hub-icon" aria-hidden="true">✅</span>
      <span><strong>Quiz</strong><br><span class="muted small">Kana, kanji and word quizzes</span></span>
    </button>
    <button class="card hub" data-go="speak">
      <span class="hub-icon" aria-hidden="true">🎤</span>
      <span><strong>Speaking practice</strong><br><span class="muted small">Listen, record, compare</span></span>
    </button>`;
  el.onclick = (e) => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); };
};

// ---------------------------------------------------------------- kana chart
let kanaScript = 'h';
VIEWS.kana = (el) => {
  const render = () => {
    const sr = state.settings.showRomaji;
    const section = (group, cols) => {
      const items = KANA.filter((k) => k.script === kanaScript && k.group === group);
      const src = group === 'basic' ? KANA_BASIC : group === 'dakuten' ? KANA_DAKUTEN : KANA_YOON;
      const cells = src.flatMap((row) => row.map((cell) => {
        if (!cell) return '<div class="kcell empty" aria-hidden="true"></div>';
        const it = items.find((k) => k.hira === cell[0]);
        return `<button class="kcell ${mastery(it.id)}" data-id="${esc(it.id)}" aria-label="${esc(it.char)} ${esc(it.romaji)}">
          <span lang="ja" class="kc">${esc(it.char)}</span>${sr ? `<span class="kr">${esc(it.romaji)}</span>` : ''}</button>`;
      }));
      return `<h2>${esc(GROUPS[group])}</h2><div class="kgrid cols${cols}">${cells.join('')}</div>`;
    };
    el.innerHTML = `
      <header class="top"><h1>Kana chart</h1></header>
      <div class="seg" role="tablist">
        <button role="tab" aria-selected="${kanaScript === 'h'}" data-script="h">Hiragana ${jp('ひらがな')}</button>
        <button role="tab" aria-selected="${kanaScript === 'k'}" data-script="k">Katakana ${jp('カタカナ')}</button>
      </div>
      <div class="toolbar">
        <label class="switch"><input type="checkbox" id="romajiToggle" ${sr ? 'checked' : ''}> Show romaji</label>
        <div class="legend" aria-hidden="true"><i class="m0"></i>new <i class="m1"></i>learning <i class="m3"></i>known <i class="mw"></i>weak</div>
      </div>
      <p class="muted small">Tap a character to hear it, watch the stroke order, and practice writing.</p>
      <section class="card">${section('basic', 5)}</section>
      <section class="card">${section('dakuten', 5)}</section>
      <section class="card">${section('yoon', 3)}</section>`;
  };
  render();
  el.onclick = (e) => {
    const s = e.target.closest('[data-script]');
    if (s) { kanaScript = s.dataset.script; render(); return; }
    const c = e.target.closest('.kcell[data-id]');
    if (c) { const it = ITEMS.get(c.dataset.id); say(it); openItem(it); }
  };
  el.onchange = (e) => {
    if (e.target.id === 'romajiToggle') { state.settings.showRomaji = e.target.checked; save(); render(); }
  };
};

// ---------------------------------------------------------------- kanji
VIEWS.kanji = (el) => {
  const learned = KANJI_ITEMS.filter((k) => (rec(k.id)?.b || 0) >= 4).length;
  el.innerHTML = `
    <header class="top"><h1>Kanji <span lang="ja" class="sub">漢字</span></h1></header>
    <p class="muted small">${KANJI_ITEMS.length} beginner (JLPT N5) kanji · ${learned} learned. Tap one for readings, example words and stroke order.</p>
    <div class="row-btns">
      <button class="btn primary" data-a="review">🃏 Review kanji</button>
      <button class="btn" data-a="quiz">✅ Quiz</button>
    </div>
    <details class="card explainer">
      <summary>How kanji readings work</summary>
      <p class="small">Most kanji have two kinds of readings:</p>
      <ul class="small">
        <li><strong>On'yomi</strong> (音読み, shown in katakana) come from Chinese. They are mostly used in words made of two or more kanji: 電車 = でんしゃ.</li>
        <li><strong>Kun'yomi</strong> (訓読み, shown in hiragana) are native Japanese. They are used when a kanji stands alone or has kana after it: 車 = くるま, 食べる = たべる.</li>
      </ul>
      <p class="small">Kana in parentheses, like た(べる), is <em>okurigana</em>: the part written in hiragana after the kanji.</p>
    </details>
    ${Object.keys(KANJI).map((g) => `<section class="card"><h2>${esc(g)}</h2>
      <div class="kgrid cols5">${KANJI_ITEMS.filter((k) => k.group === g).map((k) => `
        <button class="kcell ${mastery(k.id)}" data-id="${esc(k.id)}" aria-label="${esc(k.char)}: ${esc(k.meaning)}">
          <span lang="ja" class="kc">${esc(k.char)}</span><span class="kr">${esc(k.meaning.split(/[,;]/)[0])}</span></button>`).join('')}
      </div></section>`).join('')}`;
  el.onclick = (e) => {
    const c = e.target.closest('.kcell[data-id]');
    if (c) return openItem(ITEMS.get(c.dataset.id));
    const a = e.target.closest('[data-a]');
    if (a?.dataset.a === 'review') go('review', { deck: 'kanji' });
    if (a?.dataset.a === 'quiz') go('quiz', { autostart: { mode: 'j2m', kgroup: 'all', len: 15 } });
  };
};

function readingChips(list, cls) {
  return list.length ? list.map((r) => `<button class="chip reading ${cls}" data-say="${esc(r.replace(/[()]/g, ''))}">${jp(r)}</button>`).join('') : '<span class="muted">—</span>';
}

function openKanji(k) {
  const r = rec(k.id);
  const related = VOCAB_ITEMS.filter((v) => v.written.includes(k.char) && !k.ex.some((e) => e.written === v.written)).slice(0, 4);
  openSheet(`
    <div class="detail-head">
      <div class="big" lang="ja">${esc(k.char)}</div>
      <div>
        <div class="romaji">${esc(k.meaning)}</div>
        <div class="muted">Kanji · ${esc(k.group)} · ${window.STROKES?.[k.char]?.s.length || '?'} strokes</div>
        ${r ? `<div class="muted small">Correct ${r.c} · Missed ${r.w}</div>` : ''}
      </div>
    </div>
    <div class="readings">
      <div><span class="rlabel">On'yomi</span> ${readingChips(k.on, 'on')}</div>
      <div><span class="rlabel">Kun'yomi</span> ${readingChips(k.kun, 'kun')}</div>
    </div>
    <h3>Example words</h3>
    <ul class="list">${[...k.ex.map((e, i) => getItem(`jx:${k.char}:${i}`)), ...related].map(wordRow).join('')}</ul>
    <h3>Stroke order</h3>
    <div class="stroke-row" data-anim>${strokeSvg(k.char)}</div>
    <div class="row-btns"><button class="btn" data-replay>↻ Replay strokes</button></div>
    <h3>Practice writing</h3>
    <div class="trace-row"><div class="trace-wrap">${strokeSvg(k.char, { ghost: true })}<canvas aria-label="Writing pad for ${esc(k.char)}"></canvas></div></div>
    <div class="row-btns">
      <button class="btn" data-clear>Clear</button>
      <label class="switch"><input type="checkbox" data-guide checked> Show guide</label>
    </div>`, (bd) => {
    let stop = animateStrokes($('[data-anim]', bd));
    const pad = setupTrace($('.trace-wrap', bd));
    bd._cleanup = () => stop();
    bd.addEventListener('click', (e) => {
      const s = e.target.closest('[data-say]');
      if (s) return Speech.speak(s.dataset.say, 0.8);
      if (e.target.closest('[data-replay]')) { stop(); stop = animateStrokes($('[data-anim]', bd)); return; }
      if (e.target.closest('[data-clear]')) return pad.clear();
      handleWordRowClick(e);
    });
    bd.addEventListener('change', (e) => {
      if (e.target.matches('[data-guide]')) $$('.trace-wrap svg', bd).forEach((s) => s.classList.toggle('hidden', !e.target.checked));
    });
  });
}

// ---------------------------------------------------------------- grammar
VIEWS.grammar = (el) => {
  el.innerHTML = `
    <header class="top"><h1>Grammar <span lang="ja" class="sub">ぶんぽう</span></h1></header>
    <p class="muted small">Short lessons in order. Each one ends with a quick check; pass it to mark the lesson done.</p>
    <ol class="lesson-list">${GRAMMAR.map((g, i) => {
      const s = state.grammar[g.id];
      return `<li><button class="card lesson-row" data-id="${esc(g.id)}">
        <span class="lesson-n ${s?.passed ? 'done' : ''}" aria-hidden="true">${s?.passed ? '✓' : i + 1}</span>
        <span class="lesson-txt"><strong>${esc(g.title)}</strong><br>${jp(g.jp, 'muted')}</span>
        ${s ? `<span class="muted small">${s.best}/${s.total}</span>` : ''}
      </button></li>`;
    }).join('')}</ol>`;
  el.onclick = (e) => { const b = e.target.closest('[data-id]'); if (b) go('lesson', { id: b.dataset.id }); };
};

VIEWS.lesson = (el, { id } = {}) => {
  const idx = Math.max(0, GRAMMAR.findIndex((g) => g.id === id));
  const g = GRAMMAR[idx];
  const sentences = g.examples.map((_, i) => getItem(`gx:${g.id}:${i}`));
  const checks = g.check.map((c) => ({ ...c, answer: c.opts[0], shown: shuffle(c.opts.slice()) }));
  const answers = new Array(checks.length).fill(null);
  el.innerHTML = `
    <header class="top"><button class="icon-btn" data-a="back" aria-label="All lessons">←</button>
      <h1>${esc(g.title)}</h1><span class="muted small">${idx + 1}/${GRAMMAR.length}</span></header>
    <div class="lesson-jp" lang="ja">${esc(g.jp)}</div>
    <section class="card">
      <ul class="points">${g.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      <div class="pattern"><span class="rlabel">Pattern</span><span lang="ja">${esc(g.pattern)}</span></div>
    </section>
    <section class="card">
      <h2>Examples</h2>
      <p class="muted small">Tap a sentence for details, or 🔊 to hear it.</p>
      <ul class="list">${sentences.map(wordRow).join('')}</ul>
      <div class="row-btns"><button class="btn" data-a="playall">▶ Play all</button>
        <button class="btn" data-a="speak">🎤 Practice saying these</button></div>
    </section>
    <section class="card">
      <h2>Check yourself</h2>
      ${checks.map((c, qi) => `<div class="check-q" data-q="${qi}">
        <p class="q"><span lang="ja">${esc(c.q)}</span></p>
        <div class="options small-opts">${c.shown.map((o) => `<button class="btn opt" data-q="${qi}" data-o="${esc(o)}"><span lang="ja">${esc(o)}</span></button>`).join('')}</div>
        <div class="why" aria-live="polite"></div>
      </div>`).join('')}
      <div class="feedback" id="lessonResult" aria-live="polite"></div>
    </section>
    <div class="row-btns center">
      ${idx > 0 ? `<button class="btn" data-a="prev">← ${esc(GRAMMAR[idx - 1].title)}</button>` : ''}
      ${idx < GRAMMAR.length - 1 ? `<button class="btn primary" data-a="next">${esc(GRAMMAR[idx + 1].title)} →</button>` : ''}
    </div>`;
  let playing = false;
  cleanup = () => { playing = false; };
  el.onclick = async (e) => {
    const o = e.target.closest('.opt[data-q]');
    if (o) {
      const qi = Number(o.dataset.q);
      if (answers[qi] !== null) return;
      const c = checks[qi];
      const ok = o.dataset.o === c.answer;
      answers[qi] = ok;
      const box = $(`.check-q[data-q="${qi}"]`, el);
      $$('.opt', box).forEach((b) => { b.disabled = true; if (b.dataset.o === c.answer) b.classList.add('correct'); });
      if (!ok) o.classList.add('wrong');
      $('.why', box).innerHTML = `<p class="${ok ? 'ok' : 'no'} small">${ok ? '✓' : '✗'} ${esc(c.why)}</p>`;
      if (answers.every((a) => a !== null)) {
        const score = answers.filter(Boolean).length;
        const passed = score >= Math.ceil(checks.length * 0.67);
        const prev = state.grammar[g.id];
        state.grammar[g.id] = { best: Math.max(score, prev?.best || 0), total: checks.length, passed: passed || !!prev?.passed };
        markActivity(); save();
        $('#lessonResult', el).innerHTML = passed
          ? `<div class="ok">✓ ${score}/${checks.length}. Lesson passed!</div>`
          : `<div class="no">${score}/${checks.length}. Review the points above and try again.</div><button class="btn" data-a="retry">↻ Try again</button>`;
      }
      return;
    }
    if (handleWordRowClick(e)) return;
    const b = e.target.closest('[data-a]');
    if (!b) return;
    switch (b.dataset.a) {
      case 'back': go('grammar'); break;
      case 'prev': go('lesson', { id: GRAMMAR[idx - 1].id }); break;
      case 'next': go('lesson', { id: GRAMMAR[idx + 1].id }); break;
      case 'retry': go('lesson', { id: g.id }); break;
      case 'speak': go('speak', { source: 'Grammar sentences', id: sentences[0].id }); break;
      case 'playall':
        if (playing) { playing = false; window.speechSynthesis?.cancel(); b.textContent = '▶ Play all'; break; }
        playing = true; b.textContent = '⏹ Stop';
        for (const s of sentences) {
          if (!playing) break;
          await say(s);
          await new Promise((r) => setTimeout(r, 500));
        }
        playing = false; b.textContent = '▶ Play all';
        break;
    }
  };
};

// ---------------------------------------------------------------- detail sheet
function openSheet(html, onReady) {
  closeSheet();
  const bd = document.createElement('div');
  bd.className = 'sheet-backdrop';
  bd.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Details">
    <button class="icon-btn close" data-close aria-label="Close">✕</button>${html}</div>`;
  document.body.appendChild(bd);
  document.body.classList.add('noscroll');
  const prevFocus = document.activeElement;
  bd.addEventListener('click', (e) => { if (e.target === bd || e.target.closest('[data-close]')) closeSheet(); });
  bd._onKey = (e) => { if (e.key === 'Escape') closeSheet(); };
  document.addEventListener('keydown', bd._onKey);
  bd._prevFocus = prevFocus;
  $('[data-close]', bd).focus();
  onReady?.(bd);
}
function closeSheet() {
  const bd = $('.sheet-backdrop');
  if (!bd) return;
  bd._cleanup?.();
  document.removeEventListener('keydown', bd._onKey);
  bd.remove();
  document.body.classList.remove('noscroll');
  bd._prevFocus?.focus?.();
}

function strokeSvg(ch, { ghost = false, numbers = true } = {}) {
  const d = window.STROKES?.[ch];
  if (!d) return `<div class="nostroke" lang="ja">${esc(ch)}</div>`;
  const paths = d.s.map((p, i) => `<path d="${p}" data-i="${i}"/>`).join('');
  const nums = numbers && !ghost ? d.n.map(([x, y], i) => `<text x="${x}" y="${y}">${i + 1}</text>`).join('') : '';
  return `<svg class="strokes ${ghost ? 'ghost' : ''}" viewBox="0 0 109 109" role="img" aria-label="Stroke order for ${esc(ch)}">
    <g class="grid"><line x1="54.5" y1="0" x2="54.5" y2="109"/><line x1="0" y1="54.5" x2="109" y2="54.5"/></g>
    <g class="paths">${paths}</g><g class="nums">${nums}</g></svg>`;
}
function animateStrokes(container) {
  let delay = 0;
  const anims = [];
  $$('svg.strokes:not(.ghost)', container).forEach((svg) => {
    $$('.paths path', svg).forEach((p) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = `${len}`;
      const dur = 250 + len * 9;
      if (p.animate) {
        anims.push(p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: dur, delay, fill: 'forwards', easing: 'ease-in-out' }));
      } else p.style.strokeDashoffset = '0';
      delay += dur + 180;
    });
    $$('.nums text', svg).forEach((t, i) => { t.style.opacity = '0'; });
  });
  // Reveal numbers as each stroke starts.
  let t = 0;
  const nums = $$('svg.strokes:not(.ghost) .nums text', container);
  const paths = $$('svg.strokes:not(.ghost) .paths path', container);
  const timers = paths.map((p, i) => {
    const len = p.getTotalLength();
    const at = t; t += 250 + len * 9 + 180;
    return setTimeout(() => { if (nums[i]) nums[i].style.opacity = '1'; }, at);
  });
  return () => { anims.forEach((a) => a.cancel()); timers.forEach(clearTimeout); };
}

function setupTrace(wrap) {
  const canvas = $('canvas', wrap);
  const ctx = canvas.getContext('2d');
  let drawing = false, last = null;
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(6, r.width * 0.045);
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#222';
  };
  resize();
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('pointerdown', (e) => { drawing = true; last = pos(e); canvas.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.arc(last.x, last.y, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fillStyle = ctx.strokeStyle; ctx.fill(); e.preventDefault(); });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last = p; e.preventDefault();
  });
  const end = () => { drawing = false; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  return { clear: () => ctx.clearRect(0, 0, canvas.width, canvas.height) };
}

function openItem(it) {
  if (!it) return;
  if (it.type === 'vocab') return openWord(it);
  if (it.type === 'kanji') return openKanji(it);
  const chars = [...it.char];
  const other = ITEMS.get(`${it.script === 'h' ? 'k' : 'h'}:${it.script === 'h' ? toKata(it.char) : it.hira}`);
  const tip = kanaTip(it);
  const ex = examplesFor(it);
  const r = rec(it.id);
  openSheet(`
    <div class="detail-head">
      <div class="big" lang="ja">${esc(it.char)}</div>
      <div>
        <div class="romaji">${esc(it.romaji)}</div>
        <div class="muted">${it.script === 'h' ? 'Hiragana' : 'Katakana'} · ${esc(GROUPS[it.group])}</div>
        ${other ? `<button class="link" data-other="${esc(other.id)}">${it.script === 'h' ? 'Katakana' : 'Hiragana'}: ${jp(other.char)}</button>` : ''}
        ${r ? `<div class="muted small">Correct ${r.c} · Missed ${r.w}</div>` : ''}
      </div>
    </div>
    <div class="row-btns">
      <button class="btn primary" data-play>🔊 Play</button>
      <button class="btn" data-slow>🐢 Slow</button>
    </div>
    ${tip ? `<p class="tip">💡 ${esc(tip)}</p>` : ''}
    <h3>Stroke order</h3>
    <div class="stroke-row" data-anim>${chars.map((c) => strokeSvg(c)).join('')}</div>
    <div class="row-btns"><button class="btn" data-replay>↻ Replay strokes</button></div>
    <h3>Practice writing</h3>
    <div class="trace-row">
      ${chars.map((c, i) => `<div class="trace-wrap ${i > 0 && 'ゃゅょャュョ'.includes(c) ? 'small-kana' : ''}">${strokeSvg(c, { ghost: true })}<canvas aria-label="Writing pad for ${esc(c)}"></canvas></div>`).join('')}
    </div>
    <div class="row-btns">
      <button class="btn" data-clear>Clear</button>
      <label class="switch"><input type="checkbox" data-guide checked> Show guide</label>
    </div>
    ${ex.length ? `<h3>Example words</h3><ul class="list">${ex.map((v) => wordRow(v)).join('')}</ul>` : ''}
  `, (bd) => {
    let stop = animateStrokes($('[data-anim]', bd));
    const pads = $$('.trace-wrap', bd).map(setupTrace);
    bd._cleanup = () => stop();
    bd.addEventListener('click', (e) => {
      if (e.target.closest('[data-play]')) say(it);
      else if (e.target.closest('[data-slow]')) say(it, true);
      else if (e.target.closest('[data-replay]')) { stop(); stop = animateStrokes($('[data-anim]', bd)); }
      else if (e.target.closest('[data-clear]')) pads.forEach((p) => p.clear());
      else if (e.target.closest('[data-other]')) { const o = ITEMS.get(e.target.closest('[data-other]').dataset.other); say(o); openItem(o); }
      else handleWordRowClick(e);
    });
    bd.addEventListener('change', (e) => {
      if (e.target.matches('[data-guide]')) $$('.trace-wrap svg', bd).forEach((s) => s.classList.toggle('hidden', !e.target.checked));
    });
  });
}

function openWord(v) {
  const r = rec(v.id);
  openSheet(`
    <div class="word-detail">
      ${v.written !== v.kana ? `<div class="written" lang="ja">${esc(v.written)}</div>` : ''}
      <div class="kana-lg" lang="ja">${esc(v.kana)}</div>
      <div class="romaji">${esc(v.romaji)}</div>
      <div class="en">${esc(v.en)}</div>
      <div class="muted small">${esc(v.cat)}${r ? ` · Correct ${r.c} · Missed ${r.w}` : ''}</div>
    </div>
    <div class="row-btns">
      <button class="btn primary" data-play>🔊 Play</button>
      <button class="btn" data-slow>🐢 Slow</button>
      <button class="btn" data-speak>🎤 Practice saying it</button>
    </div>
    ${(() => {
      const ks = [...new Set([...v.written])].map((c) => ITEMS.get(`j:${c}`)).filter(Boolean);
      return ks.length ? `<h3>Kanji</h3><div class="chips">${ks.map((k) => `<button class="chip" data-kana="${esc(k.id)}">${jp(k.char)} <small>${esc(k.meaning)}</small></button>`).join('')}</div>` : '';
    })()}
    ${[...v.kana].length <= 12 ? `<h3>Characters</h3>
    <div class="chips">${[...v.kana].map((c) => {
      const k = KANA.find((x) => x.char === c);
      return k ? `<button class="chip" data-kana="${esc(k.id)}">${jp(c)} <small>${esc(k.romaji)}</small></button>` : `<span class="chip">${jp(c)}</span>`;
    }).join('')}</div>` : ''}`, (bd) => {
    say(v);
    bd.addEventListener('click', (e) => {
      if (e.target.closest('[data-play]')) say(v);
      else if (e.target.closest('[data-slow]')) say(v, true);
      else if (e.target.closest('[data-speak]')) go('speak', { source: v.cat, id: v.id });
      else if (e.target.closest('[data-kana]')) { const k = ITEMS.get(e.target.closest('[data-kana]').dataset.kana); say(k); openItem(k); }
    });
  });
}

// ---------------------------------------------------------------- flashcard review
VIEWS.review = (el, { deck } = {}) => {
  if (!deck) {
    el.innerHTML = `<header class="top"><h1>Review</h1></header>
      <p class="muted">Spaced repetition: cards you know come back less often, and cards you miss come back soon.</p>
      ${Object.keys(DECKS).map((k) => {
        const c = deckCounts(k);
        return `<section class="card deck-row">
          <div class="deck-info"><div class="deck-name">${esc(DECKS[k].name)} ${jp(DECKS[k].jp, 'muted')}</div>
          <div class="deck-meta">${c.due} due · ${c.newLeft} new today · ${c.learned}/${c.total} learned</div></div>
          <button class="btn primary" data-deck="${k}" ${c.due + c.newLeft ? '' : 'disabled'}>${c.due + c.newLeft ? 'Start' : 'Done ✓'}</button>
        </section>`;
      }).join('')}
      <p class="muted small">Want more new cards per day? Change it in Settings (⚙️ on Home).</p>`;
    el.onclick = (e) => { const b = e.target.closest('[data-deck]'); if (b) go('review', { deck: b.dataset.deck }); };
    return;
  }

  const queue = buildQueue(deck);
  const total = queue.length;
  let done = 0, again = 0, revealed = false;

  const finish = () => {
    el.innerHTML = `<header class="top"><h1>Session complete</h1></header>
      <section class="card center">
        <div class="big-emoji" aria-hidden="true">🎉</div>
        <p>You reviewed <strong>${done}</strong> card${done === 1 ? '' : 's'} in ${esc(DECKS[deck].name)}${again ? `, with ${again} to repeat` : ''}.</p>
        <div class="row-btns center"><button class="btn primary" data-a="home">Home</button><button class="btn" data-a="more">Other decks</button></div>
      </section>`;
    el.onclick = (e) => { const b = e.target.closest('[data-a]'); if (b) go(b.dataset.a === 'home' ? 'home' : 'review'); };
  };

  const show = () => {
    if (!queue.length) return finish();
    revealed = false;
    const it = ITEMS.get(queue[0]);
    const r = rec(it.id);
    const isNew = !r || !r.b;
    const front = it.type === 'kana' || it.type === 'kanji'
      ? `<div class="flash-char" lang="ja">${esc(it.char)}</div>`
      : `<div class="flash-word" lang="ja">${esc(it.kana)}</div>${it.written !== it.kana ? `<div class="muted" lang="ja">${esc(it.written)}</div>` : ''}`;
    const back = it.type === 'kanji'
      ? `<div class="romaji">${esc(it.meaning)}</div>
         <div class="readings center"><div><span class="rlabel">On</span> ${it.on.length ? it.on.map((x) => jp(x)).join('、') : '—'}</div>
           <div><span class="rlabel">Kun</span> ${it.kun.length ? it.kun.map((x) => jp(x)).join('、') : '—'}</div></div>
         <div class="muted">${jp(it.ex[0].written)} ${jp(it.ex[0].kana)} = ${esc(it.ex[0].en)}</div>`
      : `<div class="romaji">${esc(it.romaji)}</div>
         ${it.type === 'vocab' ? `<div class="en">${esc(it.en)}</div>` : ''}
         ${it.type === 'kana' && kanaTip(it) ? `<p class="tip small">💡 ${esc(kanaTip(it))}</p>` : ''}`;
    el.innerHTML = `
      <header class="top"><h1>${esc(DECKS[deck].name)}</h1><button class="icon-btn" data-a="quit" aria-label="End session">✕</button></header>
      <div class="progress" aria-label="${done} of ${total} done"><span style="width:${total ? (done / total) * 100 : 0}%"></span></div>
      <div class="muted small center">${queue.length} left${isNew ? ' · <span class="badge">new</span>' : ''}</div>
      <section class="card flash" data-a="reveal" aria-live="polite">
        ${front}
        <div class="answer" hidden>${back}</div>
        <div class="row-btns center">
          <button class="btn" data-a="play" aria-label="Play">🔊</button>
          <button class="btn" data-a="slow" aria-label="Play slowly">🐢</button>
          ${it.type !== 'vocab' ? '<button class="btn" data-a="detail">✍️ Details</button>' : ''}
        </div>
      </section>
      <div class="controls">
        <button class="btn primary wide" data-a="reveal">Show answer</button>
      </div>`;
  };

  const reveal = () => {
    if (revealed || !queue.length) return;
    revealed = true;
    const it = ITEMS.get(queue[0]);
    const r = rec(it.id);
    $('.answer', el).hidden = false;
    say(it);
    $('.controls', el).innerHTML = `
      <p class="muted small center">How well did you know it?</p>
      <div class="grades">
        <button class="btn g0" data-g="0">Again<small>${fmtInterval(intervalFor(r, 0))}</small></button>
        <button class="btn g1" data-g="1">Hard<small>${fmtInterval(intervalFor(r, 1))}</small></button>
        <button class="btn g2" data-g="2">Good<small>${fmtInterval(intervalFor(r, 2))}</small></button>
        <button class="btn g3" data-g="3">Easy<small>${fmtInterval(intervalFor(r, 3))}</small></button>
      </div>`;
    $('[data-g="2"]', el).focus();
  };

  const answer = (g) => {
    const id = queue.shift();
    grade(id, g);
    done++;
    if (g === 0) { again++; queue.splice(Math.min(queue.length, 4), 0, id); }
    show();
  };

  el.onclick = (e) => {
    const g = e.target.closest('[data-g]');
    if (g) return answer(Number(g.dataset.g));
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const it = queue.length ? ITEMS.get(queue[0]) : null;
    switch (b.dataset.a) {
      case 'quit': go('review'); break;
      case 'play': e.stopPropagation(); say(it); break;
      case 'slow': e.stopPropagation(); say(it, true); break;
      case 'detail': e.stopPropagation(); openItem(it); break;
      case 'reveal': reveal(); break;
    }
  };
  const onKey = (e) => {
    if ($('.sheet-backdrop')) return;
    if (e.key === ' ' || e.key === 'Enter') { if (!revealed) { e.preventDefault(); reveal(); } }
    else if (revealed && '1234'.includes(e.key)) answer(Number(e.key) - 1);
  };
  document.addEventListener('keydown', onKey);
  cleanup = () => document.removeEventListener('keydown', onKey);
  show();
};

// ---------------------------------------------------------------- quiz
const QUIZ_MODES = {
  k2r: { name: 'Read: kana → romaji', kind: 'kana' },
  r2k: { name: 'Find: romaji → kana', kind: 'kana' },
  a2k: { name: 'Listen: sound → kana', kind: 'kana' },
  type: { name: 'Type the romaji', kind: 'kana' },
  v2e: { name: 'Words: Japanese → English', kind: 'vocab' },
  e2v: { name: 'Words: English → Japanese', kind: 'vocab' },
  a2e: { name: 'Words: listen → English', kind: 'vocab' },
  j2m: { name: 'Kanji: kanji → meaning', kind: 'kanji' },
  m2j: { name: 'Kanji: meaning → kanji', kind: 'kanji' },
  jw2r: { name: 'Kanji: word → reading', kind: 'kanji' },
};
let quizPrefs = { mode: 'k2r', script: 'h', groups: ['basic'], cat: 'all', kgroup: 'all', len: 15 };
const LENS = [10, 15, 25, 40];

VIEWS.quiz = (el, { autostart } = {}) => {
  if (autostart) { quizPrefs = { ...quizPrefs, ...autostart }; return runQuiz(el, quizPrefs); }
  const p = quizPrefs;
  const cats = Object.keys(VOCAB);
  el.innerHTML = `
    <header class="top"><h1>Quiz</h1></header>
    <form class="card form" id="quizForm">
      <fieldset><legend>Mode</legend>
        ${Object.entries(QUIZ_MODES).map(([k, m]) => `<label class="radio"><input type="radio" name="mode" value="${k}" ${p.mode === k ? 'checked' : ''}> ${esc(m.name)}</label>`).join('')}
      </fieldset>
      <fieldset class="kana-opts"><legend>Characters</legend>
        <div class="seg small">
          ${[['h', 'Hiragana'], ['k', 'Katakana'], ['b', 'Both']].map(([v, n]) => `<label><input type="radio" name="script" value="${v}" ${p.script === v ? 'checked' : ''}><span>${n}</span></label>`).join('')}
        </div>
        ${Object.entries(GROUPS).map(([g, n]) => `<label class="check"><input type="checkbox" name="groups" value="${g}" ${p.groups.includes(g) ? 'checked' : ''}> ${esc(n)}</label>`).join('')}
      </fieldset>
      <fieldset class="vocab-opts"><legend>Topic</legend>
        <select name="cat" aria-label="Topic"><option value="all">All topics</option>${cats.map((c) => `<option ${p.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      </fieldset>
      <fieldset class="kanji-opts"><legend>Kanji group</legend>
        <select name="kgroup" aria-label="Kanji group"><option value="all">All kanji</option>${Object.keys(KANJI).map((c) => `<option ${p.kgroup === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      </fieldset>
      <fieldset><legend>Questions</legend>
        <div class="seg small">${[10, 15, 25, 40].map((n) => `<label><input type="radio" name="len" value="${n}" ${(LENS.includes(p.len) ? p.len : 15) === n ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>
      </fieldset>
      <button class="btn primary wide" type="submit">Start quiz</button>
    </form>`;
  const form = $('#quizForm', el);
  const sync = () => {
    const kind = QUIZ_MODES[form.mode.value].kind;
    $('.kana-opts', el).hidden = kind !== 'kana';
    $('.vocab-opts', el).hidden = kind !== 'vocab';
    $('.kanji-opts', el).hidden = kind !== 'kanji';
  };
  form.addEventListener('change', sync);
  sync();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const groups = $$('input[name="groups"]:checked', form).map((x) => x.value);
    quizPrefs = { mode: form.mode.value, script: form.script.value, groups: groups.length ? groups : ['basic'], cat: form.cat.value, kgroup: form.kgroup.value, len: Number(form.len.value) || 15 };
    runQuiz(el, quizPrefs);
  });
};

function quizPool(p) {
  const kind = QUIZ_MODES[p.mode].kind;
  if (kind === 'vocab') return p.cat === 'all' ? VOCAB_ITEMS : VOCAB_ITEMS.filter((v) => v.cat === p.cat);
  if (kind === 'kanji') {
    const g = p.kgroup || 'all';
    const pool = g === 'all' ? KANJI_ITEMS : KANJI_ITEMS.filter((k) => k.group === g);
    // Small groups borrow from everything so there are enough answer choices.
    return pool.length >= 4 ? pool : KANJI_ITEMS;
  }
  return KANA.filter((k) => (p.script === 'b' || k.script === p.script) && p.groups.includes(k.group));
}
// Weighted pick: missed and unseen items come up more often.
function pickQuestions(pool, n) {
  const weighted = pool.map((it) => {
    const r = rec(it.id);
    const w = !r ? 1.5 : 1 + 4 * (r.w / (r.c + r.w + 1)) + (r.b < 3 ? 0.5 : 0);
    return { it, key: Math.pow(Math.random(), 1 / w) };
  }).sort((a, b) => b.key - a.key).map((x) => x.it);
  const out = weighted.slice(0, Math.min(n, pool.length));
  while (out.length < n && pool.length) out.push(pool[Math.floor(Math.random() * pool.length)]);
  return shuffle(out);
}
function distractors(it, pool, key, n = 3) {
  const seen = new Set([key(it)]);
  const out = [];
  // Prefer items from the same script/group for kana so choices look alike.
  const ranked = shuffle(pool.slice()).sort((a, b) => (b.script === it.script) - (a.script === it.script));
  for (const x of ranked) {
    const k = key(x);
    if (seen.has(k)) continue;
    seen.add(k); out.push(x);
    if (out.length >= n) break;
  }
  return out;
}

function runQuiz(el, p, fixedItems = null) {
  const pool = quizPool(p);
  if (pool.length < 4) { toast('Pick a larger set of characters'); return go('quiz'); }
  const qs = fixedItems ? shuffle(fixedItems.slice()) : pickQuestions(pool, p.len);
  const mode = p.mode;
  let i = 0, score = 0, locked = false;
  const missed = [];

  const optLabel = (x) => {
    if (mode === 'k2r') return esc(x.romaji);
    if (mode === 'r2k' || mode === 'a2k') return jp(x.char, 'opt-jp');
    if (mode === 'e2v') return jp(x.kana, 'opt-jp-sm');
    if (mode === 'j2m') return esc(x.meaning);
    if (mode === 'm2j') return jp(x.char, 'opt-jp');
    if (mode === 'jw2r') return jp(x.ex[0].kana, 'opt-jp-sm');
    return esc(x.en);
  };
  const keyFn = (x) => {
    if (mode === 'k2r' || mode === 'a2k' || mode === 'r2k' || mode === 'type') return x.romaji;
    if (mode === 'j2m' || mode === 'm2j') return x.meaning;
    if (mode === 'jw2r') return x.ex[0].kana;
    return x.en;
  };

  const finish = () => {
    const pct = Math.round((score / qs.length) * 100);
    el.innerHTML = `<header class="top"><h1>Quiz results</h1></header>
      <section class="card center">
        <div class="score">${score} / ${qs.length}</div>
        <div class="muted">${pct >= 90 ? 'Excellent' : pct >= 70 ? 'Nice work' : pct >= 50 ? 'Getting there' : 'Keep practicing'} · ${pct}%</div>
      </section>
      ${missed.length ? `<section class="card"><h2>Missed</h2><ul class="list">${[...new Set(missed)].map((id) => {
        const it = ITEMS.get(id);
        if (it.type === 'kana') return `<li><button class="row" data-id="${esc(id)}">${jp(it.char, 'row-jp')}<span class="row-main">${esc(it.romaji)}</span><span aria-hidden="true">🔊</span></button></li>`;
        if (it.type === 'kanji') return `<li><button class="row" data-id="${esc(id)}">${jp(it.char, 'row-jp')}<span class="row-main"><span class="row-romaji">${esc(it.meaning)}</span><span class="row-en">${jp(it.ex[0].written)} ${jp(it.ex[0].kana)}</span></span><span aria-hidden="true">🔊</span></button></li>`;
        return wordRow(it);
      }).join('')}</ul></section>` : ''}
      <div class="row-btns center">
        ${missed.length ? '<button class="btn primary" data-a="retry">Retry missed</button>' : ''}
        <button class="btn ${missed.length ? '' : 'primary'}" data-a="again">New quiz</button>
        <button class="btn" data-a="setup">Change settings</button>
      </div>`;
    el.onclick = (e) => {
      const r = e.target.closest('[data-id]');
      if (r) { const it = ITEMS.get(r.dataset.id); say(it); if (it.type !== 'vocab') openItem(it); return; }
      if (handleWordRowClick(e)) return;
      const b = e.target.closest('[data-a]');
      if (!b) return;
      if (b.dataset.a === 'retry') runQuiz(el, p, [...new Set(missed)].map((id) => ITEMS.get(id)));
      else if (b.dataset.a === 'again') runQuiz(el, p);
      else go('quiz');
    };
  };

  const show = () => {
    if (i >= qs.length) return finish();
    locked = false;
    const it = qs[i];
    let prompt;
    if (mode === 'k2r' || mode === 'type' || mode === 'j2m') prompt = `<div class="flash-char" lang="ja">${esc(it.char)}</div>`;
    else if (mode === 'm2j') prompt = `<div class="flash-en">${esc(it.meaning)}</div>`;
    else if (mode === 'jw2r') prompt = `<div class="flash-word" lang="ja">${esc(it.ex[0].written)}</div><div class="muted">${esc(it.ex[0].en)}</div>`;
    else if (mode === 'r2k') prompt = `<div class="flash-romaji">${esc(it.romaji)}</div>`;
    else if (mode === 'a2k' || mode === 'a2e') prompt = `<button class="btn big-play" data-a="play" aria-label="Play sound">🔊</button><div class="muted small">Tap to hear it again</div>`;
    else if (mode === 'v2e') prompt = `<div class="flash-word" lang="ja">${esc(it.kana)}</div>${it.written !== it.kana ? `<div class="muted" lang="ja">${esc(it.written)}</div>` : ''}`;
    else prompt = `<div class="flash-en">${esc(it.en)}</div>`;

    let answers;
    if (mode === 'type') {
      answers = `<form class="type-form" data-type autocomplete="off">
        <input class="type-input" name="ans" aria-label="Type the romaji" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="latin" enterkeyhint="done">
        <button class="btn primary" type="submit">Check</button></form>`;
    } else {
      const opts = shuffle([it, ...distractors(it, pool, keyFn)]);
      answers = `<div class="options ${mode === 'r2k' || mode === 'a2k' || mode === 'm2j' ? 'jp-opts' : ''}">${opts.map((o) => `<button class="btn opt" data-id="${esc(o.id)}">${optLabel(o)}</button>`).join('')}</div>`;
    }
    el.innerHTML = `
      <header class="top"><h1>${esc(QUIZ_MODES[mode].name)}</h1><button class="icon-btn" data-a="quit" aria-label="End quiz">✕</button></header>
      <div class="progress"><span style="width:${(i / qs.length) * 100}%"></span></div>
      <div class="muted small center">Question ${i + 1} of ${qs.length} · Score ${score}</div>
      <section class="card flash">${prompt}</section>
      ${answers}
      <div class="feedback" aria-live="assertive"></div>`;
    if (mode === 'a2k' || mode === 'a2e') say(it);
    if (mode === 'type') $('.type-input', el).focus();
  };

  const resolve = (ok, it, chosenEl) => {
    locked = true;
    quizResult(it.id, ok);
    if (ok) score++; else missed.push(it.id);
    const fb = $('.feedback', el);
    if (mode !== 'type') {
      $$('.opt', el).forEach((b) => { b.disabled = true; if (b.dataset.id === it.id) b.classList.add('correct'); });
      if (!ok && chosenEl) chosenEl.classList.add('wrong');
    }
    const ans = it.type === 'kana' ? `${jp(it.char)} = ${esc(it.romaji)}`
      : it.type === 'kanji' ? `${jp(it.char)} = ${esc(it.meaning)} · ${jp(it.ex[0].written)} ${jp(it.ex[0].kana)} (${esc(it.ex[0].romaji)})`
        : `${jp(it.kana)} (${esc(it.romaji)}) = ${esc(it.en)}`;
    fb.innerHTML = ok ? `<div class="ok">✓ Correct · ${ans}</div>` : `<div class="no">✗ ${ans}</div><button class="btn primary wide" data-a="next">Next</button>`;
    say(it);
    if (ok) setTimeout(() => { if (locked && qs[i] === it) { i++; show(); } }, 1100);
    else $('[data-a="next"]', el).focus();
  };

  el.onclick = (e) => {
    const b = e.target.closest('[data-a]');
    if (b) {
      if (b.dataset.a === 'quit') return go('quiz');
      if (b.dataset.a === 'play') return say(qs[i]);
      if (b.dataset.a === 'next') { i++; return show(); }
    }
    const o = e.target.closest('.opt');
    if (o && !locked) resolve(o.dataset.id === qs[i].id, qs[i], o);
  };
  el.onsubmit = (e) => {
    if (!e.target.matches('[data-type]')) return;
    e.preventDefault();
    if (locked) return;
    const v = e.target.ans.value.trim().toLowerCase().replace(/\s+/g, '');
    if (!v) return;
    const it = qs[i];
    const ok = romajiAccepts(it.romaji).includes(v);
    e.target.ans.disabled = true;
    e.target.ans.classList.add(ok ? 'correct' : 'wrong');
    resolve(ok, it);
  };
  show();
}

// ---------------------------------------------------------------- words
let wordsCat = 'Greetings';
function wordRow(v) {
  return `<li class="wrow ${[...v.kana].length > 9 ? 'long' : ''}">
    <button class="row" data-word="${esc(v.id)}">
      <span class="row-jpbox">${v.written !== v.kana ? `<span lang="ja" class="row-written">${esc(v.written)}</span>` : ''}<span lang="ja" class="row-jp">${esc(v.kana)}</span></span>
      <span class="row-main"><span class="row-romaji">${esc(v.romaji)}</span><span class="row-en">${esc(v.en)}</span></span>
    </button>
    <button class="icon-btn" data-wplay="${esc(v.id)}" aria-label="Play ${esc(v.romaji)}">🔊</button>
    <button class="icon-btn" data-wslow="${esc(v.id)}" aria-label="Play slowly">🐢</button>
  </li>`;
}
function handleWordRowClick(e) {
  const p = e.target.closest('[data-wplay]');
  if (p) { say(getItem(p.dataset.wplay)); return true; }
  const s = e.target.closest('[data-wslow]');
  if (s) { say(getItem(s.dataset.wslow), true); return true; }
  const w = e.target.closest('[data-word]');
  if (w) { openWord(getItem(w.dataset.word)); return true; }
  return false;
}
VIEWS.words = (el) => {
  let query = '';
  const renderList = () => {
    const q = query.trim().toLowerCase();
    const list = q
      ? VOCAB_ITEMS.filter((v) => v.en.toLowerCase().includes(q) || v.romaji.replace(/\s/g, '').includes(q.replace(/\s/g, '')) || v.kana.includes(q) || toHira(v.kana).includes(toHira(q)) || v.written.includes(q))
      : VOCAB_ITEMS.filter((v) => v.cat === wordsCat);
    $('#wordList', el).innerHTML = list.length ? list.map(wordRow).join('') : '<li class="muted">No matches.</li>';
  };
  el.innerHTML = `
    <header class="top"><h1>Words & phrases</h1></header>
    <input type="search" id="wordSearch" class="search" placeholder="Search English, romaji or kana" aria-label="Search words">
    <select id="cats" class="select" aria-label="Topic">${Object.keys(VOCAB).map((c) => `<option value="${esc(c)}" ${c === wordsCat ? 'selected' : ''}>${esc(c)} (${VOCAB[c].length})</option>`).join('')}</select>
    <ul class="list card" id="wordList"></ul>
    <div class="row-btns center">
      <button class="btn" data-a="quiz">Quiz this topic</button>
      <button class="btn" data-a="speak">Practice speaking</button>
    </div>`;
  renderList();
  el.oninput = (e) => { if (e.target.id === 'wordSearch') { query = e.target.value; renderList(); } };
  el.onchange = (e) => {
    if (e.target.id === 'cats') { wordsCat = e.target.value; query = ''; $('#wordSearch', el).value = ''; renderList(); }
  };
  el.onclick = (e) => {
    if (handleWordRowClick(e)) return;
    const a = e.target.closest('[data-a]');
    if (a?.dataset.a === 'quiz') go('quiz', { autostart: { mode: 'v2e', cat: wordsCat, len: 10 } });
    if (a?.dataset.a === 'speak') go('speak', { source: wordsCat });
  };
};

// ---------------------------------------------------------------- speaking practice
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let speakSource = 'Greetings';
VIEWS.speak = (el, { source, id } = {}) => {
  if (source) speakSource = source;
  const sources = ['Hiragana', 'Katakana', 'Grammar sentences', 'Kanji words', ...Object.keys(VOCAB)];
  const listFor = (s) => (s === 'Hiragana' ? KANA.filter((k) => k.script === 'h')
    : s === 'Katakana' ? KANA.filter((k) => k.script === 'k')
      : s === 'Grammar sentences' ? GRAMMAR_SENTENCES
        : s === 'Kanji words' ? KANJI_WORDS
          : VOCAB_ITEMS.filter((v) => v.cat === s));
  if (!listFor(speakSource).length) speakSource = 'Greetings';
  let list = listFor(speakSource);
  let idx = Math.max(0, id ? list.findIndex((x) => x.id === id) : 0);
  let recorder = null, stream = null, chunks = [], myUrl = null, recognizer = null;

  const stopStream = () => { stream?.getTracks().forEach((t) => t.stop()); stream = null; };
  cleanup = () => {
    try { recorder?.state === 'recording' && recorder.stop(); } catch (e) { /* ignore */ }
    try { recognizer?.abort(); } catch (e) { /* ignore */ }
    stopStream();
    if (myUrl) URL.revokeObjectURL(myUrl);
  };

  const render = () => {
    const it = list[idx];
    const isKana = it.type === 'kana';
    el.innerHTML = `
      <header class="top"><h1>Speaking practice</h1></header>
      <select id="speakSrc" class="select" aria-label="What to practice">${sources.map((s) => `<option ${s === speakSource ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
      <section class="card flash speak-card">
        <div class="muted small">${idx + 1} / ${list.length}</div>
        ${isKana ? `<div class="flash-char" lang="ja">${esc(it.char)}</div>` : `${it.written !== it.kana ? `<div class="muted" lang="ja">${esc(it.written)}</div>` : ''}<div class="flash-word" lang="ja">${esc(it.kana)}</div>`}
        <div class="romaji">${esc(it.romaji)}</div>
        ${isKana ? '' : `<div class="en">${esc(it.en)}</div>`}
      </section>
      <div class="steps">
        <div class="step"><span class="step-n">1</span><span>Listen</span>
          <button class="btn primary" data-a="play">🔊 Normal</button><button class="btn" data-a="slow">🐢 Slow</button></div>
        <div class="step"><span class="step-n">2</span><span>Say it and record</span>
          <button class="btn rec" data-a="rec" aria-pressed="false">⏺ Record</button>
          <button class="btn" data-a="mine" ${myUrl ? '' : 'disabled'}>▶ Mine</button></div>
        <div class="step"><span class="step-n">3</span><span>Compare</span>
          <button class="btn" data-a="compare" ${myUrl ? '' : 'disabled'}>🔁 Native, then mine</button></div>
        ${SR ? `<div class="step"><span class="step-n">✓</span><span>Pronunciation check</span>
          <button class="btn" data-a="check">🎤 Check me</button></div>` : ''}
      </div>
      <div class="feedback" id="srOut" aria-live="polite">${SR ? '' : '<p class="muted small">Automatic pronunciation checking is not available here. Recording and comparing still works.</p>'}</div>
      <audio id="myAudio" ${myUrl ? `src="${myUrl}"` : ''} preload="auto"></audio>
      <div class="row-btns center nav-btns">
        <button class="btn" data-a="prev" ${idx === 0 ? 'disabled' : ''}>← Previous</button>
        <button class="btn" data-a="shuffle">🔀</button>
        <button class="btn" data-a="next" ${idx >= list.length - 1 ? 'disabled' : ''}>Next →</button>
      </div>
      <p class="muted small">Tip: shadowing works well. Play the audio, then repeat it right away, copying the rhythm and pitch.</p>`;
  };

  const resetRecording = () => { if (myUrl) URL.revokeObjectURL(myUrl); myUrl = null; };

  const startRec = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { toast('Recording is not supported on this device'); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) { toast('Microphone access was blocked'); return; }
    chunks = [];
    const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported?.(t));
    recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      stopStream();
      resetRecording();
      myUrl = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType || 'audio/mp4' }));
      const a = $('#myAudio', el);
      if (a) { a.src = myUrl; }
      $('[data-a="mine"]', el)?.removeAttribute('disabled');
      $('[data-a="compare"]', el)?.removeAttribute('disabled');
      const b = $('[data-a="rec"]', el);
      if (b) { b.textContent = '⏺ Record'; b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); }
      clearTimeout(startRec._t);
    };
    recorder.start();
    const b = $('[data-a="rec"]', el);
    b.textContent = '⏹ Stop'; b.classList.add('on'); b.setAttribute('aria-pressed', 'true');
    startRec._t = setTimeout(() => recorder?.state === 'recording' && recorder.stop(), 10000);
  };
  const playMine = () => new Promise((resolve) => {
    const a = $('#myAudio', el);
    if (!a || !myUrl) return resolve();
    a.onended = resolve; a.onerror = resolve;
    a.currentTime = 0;
    a.play().catch(resolve);
  });

  const check = () => {
    const it = list[idx];
    const out = $('#srOut', el);
    try { recognizer?.abort(); } catch (e) { /* ignore */ }
    recognizer = new SR();
    recognizer.lang = 'ja-JP';
    recognizer.interimResults = false;
    recognizer.maxAlternatives = 5;
    out.innerHTML = '<p class="listening">🎤 Listening… say it now</p>';
    const btn = $('[data-a="check"]', el); btn.disabled = true;
    const norm = (s) => toHira(s.replace(/[\s。、．，！？!?.,「」〜~ー]/g, ''));
    const targets = [norm(it.type === 'kana' ? it.hira : it.kana), norm(it.written || '')].filter(Boolean);
    recognizer.onresult = (e) => {
      const alts = [...e.results[0]].map((a) => a.transcript);
      const best = alts.map((t) => {
        const n = norm(t);
        const sim = Math.max(...targets.map((x) => 1 - levenshtein(n, x) / Math.max(n.length, x.length, 1)));
        return { t, sim };
      }).sort((a, b) => b.sim - a.sim)[0];
      const ok = best.sim >= 0.999, close = best.sim >= 0.6;
      out.innerHTML = `<div class="${ok ? 'ok' : close ? 'close' : 'no'}">${ok ? '✓ Sounds right!' : close ? '≈ Close' : '✗ Not quite'} · Heard: ${jp(best.t)}</div>
        ${ok ? '' : `<p class="muted small">${it.type === 'kana' ? 'Single sounds are hard for speech recognition. Try a word that uses this character too.' : 'Listen again and pay attention to long vowels and double consonants.'}</p>`}`;
      if (ok || close) quizResult(it.id, ok);
    };
    recognizer.onerror = (e) => {
      const msg = e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'Speech recognition isn’t allowed here. On iPhone, check Settings › Screen Time and Siri & Dictation, or open the app in Safari. Recording and comparing still works.'
        : e.error === 'no-speech' ? 'I didn’t hear anything. Try again a little closer to the mic.'
          : e.error === 'network' ? 'Speech recognition needs an internet connection on this device.'
            : `Recognition stopped (${e.error}).`;
      out.innerHTML = `<p class="no">${esc(msg)}</p>`;
    };
    recognizer.onend = () => { const b = $('[data-a="check"]', el); if (b) b.disabled = false; if ($('.listening', out)) out.innerHTML = '<p class="muted">Nothing recognized. Try again.</p>'; };
    try { recognizer.start(); } catch (e) { out.innerHTML = `<p class="no">${esc(e.message)}</p>`; btn.disabled = false; }
  };

  render();
  el.onchange = (e) => {
    if (e.target.id === 'speakSrc') { speakSource = e.target.value; list = listFor(speakSource); idx = 0; resetRecording(); render(); }
  };
  el.onclick = async (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const it = list[idx];
    switch (b.dataset.a) {
      case 'play': say(it); break;
      case 'slow': say(it, true); break;
      case 'rec': if (recorder?.state === 'recording') recorder.stop(); else { window.speechSynthesis?.cancel(); startRec(); } break;
      case 'mine': playMine(); break;
      case 'compare': await say(it); await new Promise((r) => setTimeout(r, 300)); await playMine(); break;
      case 'check': window.speechSynthesis?.cancel(); check(); break;
      case 'prev': idx = Math.max(0, idx - 1); resetRecording(); render(); say(list[idx]); break;
      case 'next': idx = Math.min(list.length - 1, idx + 1); resetRecording(); render(); say(list[idx]); break;
      case 'shuffle': idx = Math.floor(Math.random() * list.length); resetRecording(); render(); say(list[idx]); break;
    }
  };
};

// ---------------------------------------------------------------- settings
VIEWS.settings = (el) => {
  const s = state.settings;
  const voiceOptions = () => Speech.voices.length
    ? Speech.voices.map((v) => `<option value="${esc(v.voiceURI)}" ${Speech.voice()?.voiceURI === v.voiceURI ? 'selected' : ''}>${esc(v.name)}${v.localService ? '' : ' (online)'}</option>`).join('')
    : '<option value="">Default Japanese voice</option>';
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  el.innerHTML = `
    <header class="top"><button class="icon-btn" data-a="back" aria-label="Back">←</button><h1>Settings</h1></header>
    <section class="card form">
      <h2>Voice</h2>
      <label>Japanese voice <select id="voiceSel" class="select">${voiceOptions()}</select></label>
      <label>Speaking speed: <strong id="rateVal">${s.rate.toFixed(2)}×</strong>
        <input type="range" id="rate" min="0.5" max="1.2" step="0.05" value="${s.rate}"></label>
      <button class="btn" data-a="test">🔊 Test: ${jp('こんにちは、よろしくおねがいします')}</button>
      <p class="muted small">On iPhone you can download better voices: Settings › Accessibility › Spoken Content › Voices › Japanese. Then reopen this app and pick it here.</p>
    </section>
    <section class="card form">
      <h2>Learning</h2>
      <label>New cards per day (per deck): <strong id="npdVal">${s.newPerDay}</strong>
        <input type="range" id="npd" min="5" max="50" step="5" value="${s.newPerDay}"></label>
      <p class="muted small">Since you've learned kana before, use Easy on cards you still know and they'll space out fast.</p>
    </section>
    <section class="card form">
      <h2>Progress</h2>
      <div class="row-btns">
        <button class="btn" data-a="export">⬇️ Back up</button>
        <label class="btn">⬆️ Restore<input type="file" id="importFile" accept="application/json,.json" hidden></label>
        <button class="btn danger" data-a="reset">Reset all</button>
      </div>
      <p class="muted small">Progress is stored only on this device. Back up now and then, especially before clearing Safari data.</p>
    </section>
    <section class="card">
      <h2>Install on iPhone</h2>
      ${isStandalone ? '<p>✓ Running as an installed app.</p>' : `<ol class="small">
        <li>Open this page in <strong>Safari</strong>.</li>
        <li>Tap the <strong>Share</strong> button.</li>
        <li>Tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li></ol>
        <p class="muted small">Once installed it works offline.</p>`}
    </section>
    <section class="card small muted">
      <h2>About</h2>
      <p>Stroke order data from <a href="https://kanjivg.tagaini.net" target="_blank" rel="noopener">KanjiVG</a> © Ulrich Apel, licensed <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a>.</p>
      <p>Pronunciation uses your device's built-in Japanese voice.</p>
    </section>`;
  const refreshVoices = () => { const sel = $('#voiceSel', el); if (sel) sel.innerHTML = voiceOptions(); };
  document.addEventListener('voices-ready', refreshVoices);
  cleanup = () => document.removeEventListener('voices-ready', refreshVoices);
  el.oninput = (e) => {
    if (e.target.id === 'rate') { s.rate = Number(e.target.value); $('#rateVal', el).textContent = `${s.rate.toFixed(2)}×`; save(); }
    if (e.target.id === 'npd') { s.newPerDay = Number(e.target.value); $('#npdVal', el).textContent = s.newPerDay; save(); }
  };
  el.onchange = async (e) => {
    if (e.target.id === 'voiceSel') { s.voiceURI = e.target.value; save(); Speech.speak('こんにちは'); }
    if (e.target.id === 'importFile' && e.target.files[0]) {
      try {
        const data = JSON.parse(await e.target.files[0].text());
        if (!data || typeof data.srs !== 'object') throw new Error('bad file');
        localStorage.setItem(STORE_KEY, JSON.stringify(data));
        state = loadState();
        toast('Progress restored');
        go('home');
      } catch (err) { toast('That file is not a Nihongo Dojo backup'); }
    }
  };
  el.onclick = async (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    if (b.dataset.a === 'back') go('home');
    if (b.dataset.a === 'test') Speech.speak('こんにちは、よろしくお願いします');
    if (b.dataset.a === 'export') {
      const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
      const name = `nihongo-dojo-backup-${todayStr()}.json`;
      const file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'Nihongo Dojo backup' }); return; } catch (err) { if (err.name === 'AbortError') return; }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
    if (b.dataset.a === 'reset' && confirm('Erase all progress on this device? This cannot be undone.')) {
      localStorage.removeItem(STORE_KEY);
      state = loadState();
      toast('Progress reset');
      go('home');
    }
  };
};

// ---------------------------------------------------------------- boot
function boot() {
  Speech.init();
  $('.tabbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (b) go(b.dataset.view);
  });
  navigator.storage?.persist?.().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW registration failed', e));
  }
  go('home');
}
boot();
