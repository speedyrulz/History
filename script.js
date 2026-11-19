/* The Archive. It only wants to be read. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const started = new Date();
  const fmtTime = d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fmtDate = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const fill = s => s.replaceAll('{start}', fmtTime(started)).replaceAll('{date}', fmtDate(started));

  /* ---------- static fills ---------- */
  $$('.fill-start').forEach(el => (el.textContent = fmtTime(started)));
  $$('.fill-date').forEach(el => (el.textContent = fmtDate(started)));
  $('#edited-time').textContent = fmtTime(started);

  /* ---------- returning readers ---------- */
  let lastVisit = null;
  try {
    lastVisit = localStorage.getItem('archive.read');
    localStorage.setItem('archive.read', started.toISOString());
  } catch (e) { /* storage unavailable: it remembers anyway */ }
  if (lastVisit) {
    $('#welcome-back').textContent = ' Welcome back.';
    $('#edited-by').textContent = 'by a reader who has been here before';
  } else {
    $('#edited-by').textContent = '';
  }

  /* ---------- palettes ---------- */
  const P = {
    clean: { bg: '#ffffff', fg: '#202122', muted: '#54595d', link: '#3366cc', border: '#a2a9b1', box: '#f8f9fa', head: '#000000', sel: '#b4d5fe' },
    aged:  { bg: '#f1e9d6', fg: '#2d271f', muted: '#6a5f50', link: '#6a5634', border: '#b6a789', box: '#e9dfc7', head: '#1f1a14', sel: '#d9c79c' },
    dark:  { bg: '#0c0a09', fg: '#b3aa9d', muted: '#6e645a', link: '#8e3a2e', border: '#2b2420', box: '#13100e', head: '#c9bfb1', sel: '#4a1410' },
  };
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => {
    const A = hex(a), B = hex(b);
    return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
  };
  const root = document.documentElement;
  function paint(age, dark) {
    for (const k of Object.keys(P.clean)) {
      const mid = mix(P.clean[k], P.aged[k], age);
      // second stage blends from the aged palette into darkness
      const v = dark > 0 ? mix(P.aged[k], P.dark[k], dark) : mid;
      root.style.setProperty('--' + k, v);
    }
    root.style.setProperty('--age', age.toFixed(3));
    root.style.setProperty('--dark', dark.toFixed(3));
    root.style.setProperty('--grain', (age * 0.08 + dark * 0.22).toFixed(3));
    // once you have been to the bottom, the light never fully comes back
    const residue = S.ended ? 0.3 : 0;
    root.style.setProperty('--vig', Math.max(residue, age * 0.15 + dark * 0.75).toFixed(3));
    root.style.colorScheme = dark > 0.5 ? 'dark' : 'light';
  }

  /* ---------- scroll geometry ---------- */
  const M = {};
  function measure() {
    for (const id of ['m-age-a', 'm-age-b', 'm-dark-a', 'm-dark-b', 'm-end']) {
      const el = document.getElementById(id);
      M[id] = el.getBoundingClientRect().top + window.scrollY;
    }
  }
  const probe = () => window.scrollY + window.innerHeight * 0.65;
  const seg = (a, b) => clamp((probe() - M[a]) / Math.max(1, M[b] - M[a]));

  const offscreen = el => {
    const r = el.getBoundingClientRect();
    return r.bottom < -20 || r.top > window.innerHeight + 20;
  };

  /* ---------- swaps: things only change when you are not looking ---------- */
  const phases = new Set();
  function runSwaps() {
    $$('[data-swap]').forEach(el => {
      if (!phases.has(el.dataset.swap) || !offscreen(el)) return;
      const tpl = el.id && document.getElementById('r-' + el.id);
      if (tpl) el.innerHTML = fill(tpl.innerHTML);
      else if (el.dataset.html != null) el.innerHTML = fill(el.dataset.html);
      if (el.dataset.cls) el.classList.add(...el.dataset.cls.split(' '));
      if (el.dataset.ph) el.setAttribute('placeholder', el.dataset.ph);
      el.removeAttribute('data-swap');
    });
  }

  /* ---------- state ---------- */
  const S = { age: 0, dark: 0, ended: false, seenSecond: false, hidden: false };
  let baseTitle = 'World War II - The Archive';

  function titleFor() {
    if (S.ended && window.scrollY < window.innerHeight) return 'The Reader - The Archive';
    if (S.ended) return 'you';
    if (S.dark > 0.92) return 'still reading?';
    if (S.dark > 0.6) return 'World';
    if (S.dark > 0.3) return 'World War';
    if (S.dark > 0) return 'World War II';
    if (S.age > 0.5) return 'World War II – The Archive';
    return 'World War II - The Archive';
  }

  function update() {
    S.age = seg('m-age-a', 'm-age-b');
    S.dark = seg('m-dark-a', 'm-dark-b');
    paint(S.age, S.dark);

    if (S.dark > 0.25) phases.add('mid');
    if (!S.ended && probe() > M['m-end']) {
      S.ended = true;
      phases.add('after');
      $('#footer-final').textContent = 'Thank you for reading. You may scroll back up now. Everything is where you left it.';
    }
    if (S.seenSecond) {
      const g1 = $('#ghost-1');
      if (g1 && !g1.classList.contains('revealed') && offscreen(g1)) g1.classList.add('revealed');
    }
    runSwaps();

    baseTitle = titleFor();
    if (!S.hidden) document.title = baseTitle;
  }

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; update(); });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { measure(); update(); });
  window.addEventListener('load', () => { measure(); update(); });
  measure(); update();

  /* ---------- slow reveals ---------- */
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const t = e.target;
      if (t.id === 'fig-company-2') {
        // he takes his time
        setTimeout(() => $('#ghost-2').classList.add('seen'), 1500);
        S.seenSecond = true;
      } else {
        t.classList.add('seen');
      }
      io.unobserve(t);
    }
  }, { threshold: 0.6 });
  io.observe($('#fig-company-2'));
  $$('.fallmsg').forEach(el => io.observe(el));

  /* ---------- the register keeps growing ---------- */
  let reg = 72413906;
  const regEls = [$('#register'), ...$$('.register-mirror')];
  (function grow() {
    reg += 1;
    const s = reg.toLocaleString('en-US');
    regEls.forEach(el => (el.textContent = s));
    setTimeout(grow, 1800 + Math.random() * 2600);
  })();

  /* ---------- the clock ---------- */
  function partOfDay(h) {
    if (h < 5) return 'It is very late where you are. The house is quiet. That is when it is easiest for them to read along with you.';
    if (h < 12) return 'It is morning where you are. Where we are, it is always mourning.';
    if (h < 17) return 'It is afternoon where you are. There is still daylight. Do not waste it here.';
    if (h < 21) return 'It is evening where you are. Soon it will be dark enough.';
    return 'It is night where you are. You should have stopped reading a while ago. You did not. None of us did.';
  }
  $('#tod').textContent = partOfDay(started.getHours());

  function tick() {
    const now = new Date();
    const secs = Math.floor((now - started) / 1000);
    const m = Math.floor(secs / 60), s = secs % 60;
    $('#now-time').textContent = fmtTime(now);
    $('#elapsed').textContent = m < 1
      ? `${s} seconds`
      : `${m} minute${m === 1 ? '' : 's'} and ${s} second${s === 1 ? '' : 's'}`;
  }
  tick(); setInterval(tick, 1000);

  /* ---------- someone else is reading ---------- */
  let viewersSince = null, viewersDone = false;
  setInterval(() => {
    if (viewersDone) return;
    const v = $('#viewers');
    const r = v.getBoundingClientRect();
    const visible = r.top > 0 && r.bottom < window.innerHeight;
    if (!visible) { viewersSince = null; return; }
    viewersSince = viewersSince || Date.now();
    if (Date.now() - viewersSince > 9000) {
      viewersDone = true;
      v.classList.add('fading');
      setTimeout(() => {
        v.textContent = '2 people are reading this article right now.';
        v.classList.remove('fading');
      }, 2600);
    }
  }, 500);

  /* ---------- when you stop moving ---------- */
  const whisper = $('#whisper');
  const lines = [
    'you stopped.',
    'we didn’t.',
    'it is easier to read you when you are still.',
    'keep going.',
    'we can wait.',
    'they are reading the same line as you.',
  ];
  let wi = 0, idleTimer = null;
  function resetIdle() {
    whisper.classList.remove('on');
    clearTimeout(idleTimer);
    if (S.dark < 0.6) return;
    idleTimer = setTimeout(() => {
      whisper.textContent = lines[wi++ % lines.length];
      whisper.classList.add('on');
    }, 9000);
  }
  ['scroll', 'mousemove', 'keydown', 'touchstart', 'wheel'].forEach(ev =>
    window.addEventListener(ev, resetIdle, { passive: true }));

  /* ---------- leaving the tab ---------- */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      S.hidden = true;
      if (S.dark > 0.5) document.title = S.ended ? 'we kept your place' : 'we’ll wait';
    } else {
      S.hidden = false;
      document.title = baseTitle;
    }
  });

  /* ---------- taking words away ---------- */
  document.addEventListener('copy', e => {
    if (S.dark < 0.5 || !e.clipboardData) return;
    const sel = String(window.getSelection());
    if (!sel.trim()) return;
    e.clipboardData.setData('text/plain', sel + '\n\n— remembered by The Archive. We remember you too.');
    e.preventDefault();
  });

  /* ---------- for the ones who look underneath ---------- */
  console.log('%cThe Archive', 'font: 20px Georgia, serif; letter-spacing: .14em');
  console.log('Interested in how this page works? So are we. We have been reading it for a long time.');
})();
