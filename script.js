/* The Archive. It only wants to be read. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  const started = new Date();
  const fmtTime = d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fmtDate = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const fill = s => s.replaceAll('{start}', fmtTime(started)).replaceAll('{date}', fmtDate(started));
  const dur = secs => {
    secs = Math.round(secs);
    const m = Math.floor(secs / 60), s = secs % 60;
    if (m < 1) return `${s} second${s === 1 ? '' : 's'}`;
    return `${m} minute${m === 1 ? '' : 's'} and ${s} second${s === 1 ? '' : 's'}`;
  };

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

  /* ---------- state ---------- */
  const S = {
    age: 0, dark: 0, ended: false, seenSecond: false, hidden: false,
    typingDone: false, heMoved: false, viewers: 1,
  };
  // what the reader does. none of it leaves this page.
  const R = {
    section: {},          // seconds spent per section heading
    photo: 0,             // seconds looking at the second photograph
    backs: 0,             // times scrolled back up to check
    found: new Set(),     // hidden lines selected
    awayCount: 0, awaySecs: 0, awayStart: 0,
  };

  function paint(age, dark) {
    for (const k of Object.keys(P.clean)) {
      const v = dark > 0 ? mix(P.aged[k], P.dark[k], dark) : mix(P.clean[k], P.aged[k], age);
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
      M[id] = document.getElementById(id).getBoundingClientRect().top + window.scrollY;
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
    // the first photograph: once you have seen the reprint, he is in the original too
    const g1 = $('#ghost-1');
    if (S.seenSecond && !g1.classList.contains('revealed') && offscreen(g1)) g1.classList.add('revealed');
    // after he is told to leave the photographs, he leaves them
    if (phases.has('gone')) {
      for (const g of [$('#ghost-1'), $('#ghost-2')]) {
        if (!g.classList.contains('gone') && offscreen(g)) g.classList.add('gone');
      }
    }
  }

  /* ---------- favicon ---------- */
  const eyeIcon = "data:image/svg+xml," + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'><path d='M4 30 Q30 6 56 30 Q30 54 4 30Z' fill='#0c0a09' stroke='#8e3a2e' stroke-width='3'/><circle cx='30' cy='30' r='9' fill='#8e3a2e'/><circle cx='30' cy='30' r='4' fill='#000'/></svg>");
  let eyeSet = false;

  /* ---------- titles ---------- */
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

  /* ---------- scroll direction: noticing when you go back to check ---------- */
  let lastY = window.scrollY, upTravel = 0, countedThisClimb = false;
  function trackDirection() {
    const y = window.scrollY, dy = y - lastY;
    lastY = y;
    if (dy < 0) {
      upTravel -= dy;
      if (upTravel > 500 && !countedThisClimb && S.age > 0.2) { R.backs++; countedThisClimb = true; }
    } else if (dy > 0) {
      upTravel = 0; countedThisClimb = false;
    }
  }

  const deep = $('.deep');
  function update() {
    S.age = seg('m-age-a', 'm-age-b');
    S.dark = seg('m-dark-a', 'm-dark-b');
    paint(S.age, S.dark);
    trackDirection();

    if (S.dark > 0.25) phases.add('mid');
    if (!S.ended && probe() > M['m-end']) {
      S.ended = true;
      phases.add('after');
      $('#footer-final').textContent = 'Thank you for reading. You may scroll back up now. Everything is where you left it.';
    }
    runSwaps();

    if (S.dark > 0.5 && !eyeSet) { $('#favicon').href = eyeIcon; eyeSet = true; }
    if (!reduceMotion) deep.classList.toggle('breathing', S.dark > 0.97);

    baseTitle = titleFor();
    if (!S.hidden) document.title = baseTitle;
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; update(); });
  }, { passive: true });
  window.addEventListener('resize', () => { measure(); update(); });
  window.addEventListener('load', () => { measure(); update(); });
  // images change the page height as they arrive
  $$('img').forEach(img => img.addEventListener('load', () => { measure(); update(); }));
  measure(); update();

  // if a collage photograph is missing, show the crew instead of a broken image
  function collageFallback() {
    const box = $('#ib-photo .collage');
    if (!box) return;
    box.outerHTML = '<div class="photo-stack"><img src="img/crew.jpg" alt="A B-17 bomber crew, England, 1943" width="960" height="707"></div>';
    const cap = $('#ib-caption');
    if (cap.hasAttribute('data-swap')) cap.textContent = 'A B-17 Flying Fortress crew of the 385th Bombardment Group, England, 1943';
  }
  $$('.collage img').forEach(img => {
    if (img.complete && img.naturalWidth === 0) collageFallback();
    else img.addEventListener('error', collageFallback, { once: true });
  });

  /* ---------- slow reveals ---------- */
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const t = e.target;
      if (t.id === 'fig-company-2') {
        setTimeout(() => $('#ghost-2').classList.add('seen'), 1500); // he takes his time
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

  /* ---------- watching: where you linger ---------- */
  const heads = $$('.content h2, .content h3');
  const photo2 = $('#fig-company-2');
  let lastActivity = Date.now();
  setInterval(() => {
    if (document.hidden) return;
    if (Date.now() - lastActivity > 60000) return; // gone to make tea; doesn't count
    const y = window.innerHeight * 0.45;
    let cur = null;
    for (const h of heads) { if (h.getBoundingClientRect().top < y) cur = h; else break; }
    if (cur) {
      const name = cur.firstChild.textContent.trim();
      if (name !== 'The reader') R.section[name] = (R.section[name] || 0) + 0.5;
    }
    const r = photo2.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.8 && r.bottom > window.innerHeight * 0.2) R.photo += 0.5;
  }, 500);

  // hidden lines found by selecting them
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    $$('.ghost').forEach((g, i) => { if (sel.containsNode(g, true)) R.found.add(i); });
  });

  /* ---------- the clock and the record ---------- */
  function partOfDay(h) {
    if (h < 5) return 'It is very late where you are. The house is quiet. That is when it is easiest for them to read along with you.';
    if (h < 12) return 'It is morning where you are. Where we are, it is always mourning.';
    if (h < 17) return 'It is afternoon where you are. There is still daylight. Do not waste it here.';
    if (h < 21) return 'It is evening where you are. Soon it will be dark enough.';
    return 'It is night where you are. You should have stopped reading a while ago. You did not. None of us did.';
  }
  $('#tod').textContent = partOfDay(started.getHours());

  const note = t => `<span class="note">${t}</span>`;
  const ghostTotal = $$('.ghost').length;
  function record() {
    const secs = (Date.now() - started) / 1000;
    $('#d-no').textContent = (reg + 1).toLocaleString('en-US') + ' (provisional)';
    $('#d-time').textContent = dur(secs);

    const top = Object.entries(R.section).sort((a, b) => b[1] - a[1])[0];
    $('#d-linger').innerHTML = top
      ? `“${top[0]}”, ${dur(top[1])}` + note('That is where they noticed you.')
      : 'Nowhere. You read quickly.' + note('The quick ones are the easiest to keep.');

    const p = Math.round(R.photo);
    $('#d-photo').innerHTML = p < 3
      ? 'Barely.' + note('You did not count them. He counted you.')
      : `${dur(p)}` + note('He looked back for exactly as long.');

    $('#d-back').innerHTML = R.backs === 0
      ? 'Never.' + note('You trusted the page.')
      : `${R.backs} time${R.backs === 1 ? '' : 's'}` + note('You were checking whether things had changed. Some of them had.');

    const f = R.found.size;
    $('#d-found').innerHTML = f === 0
      ? `0 of ${ghostTotal}` + note('They were written in the colour of the page. Select the empty spaces.')
      : `${f} of ${ghostTotal}` + note('You went looking. That is how it starts.');

    const away = R.awaySecs + (R.awayStart ? (Date.now() - R.awayStart) / 1000 : 0);
    $('#d-away').innerHTML = R.awayCount === 0
      ? 'Never.' + note('Good. Keep it that way.')
      : `${R.awayCount} time${R.awayCount === 1 ? '' : 's'}, ${dur(away)} in total` + note('Nothing here stopped while you were gone.');
  }

  function tick() {
    const now = new Date();
    $('#now-time').textContent = fmtTime(now);
    $('#elapsed').textContent = dur((now - started) / 1000);
    if (S.dark > 0.8) record();
  }
  tick(); setInterval(tick, 1000);

  /* ---------- someone else is reading ---------- */
  let viewersSince = null;
  setInterval(() => {
    if (S.viewers === 2) return;
    const v = $('#viewers');
    const r = v.getBoundingClientRect();
    if (!(r.top > 0 && r.bottom < window.innerHeight)) { viewersSince = null; return; }
    viewersSince = viewersSince || Date.now();
    if (Date.now() - viewersSince > 8000) {
      S.viewers = 2;
      v.classList.add('fading');
      setTimeout(() => {
        v.textContent = '2 people are reading this article right now.';
        v.classList.remove('fading');
        startOtherCursor();
      }, 2600);
    }
  }, 500);

  /* ---------- the other reader's cursor: it follows yours, a little late ---------- */
  const trail = [];
  const other = $('#other-cursor');
  let otherOn = false;
  window.addEventListener('mousemove', e => {
    trail.push({ t: performance.now(), x: e.clientX, y: e.clientY });
    if (trail.length > 400) trail.shift();
  }, { passive: true });
  function startOtherCursor() {
    if (!finePointer || otherOn) return;
    otherOn = true;
    const lag = 1600;
    (function follow() {
      const now = performance.now();
      let p = null;
      for (let i = trail.length - 1; i >= 0; i--) { if (trail[i].t <= now - lag) { p = trail[i]; break; } }
      if (p) {
        // it never quite lands on yours. it stops just below and to the left, like someone leaning in
        other.style.transform = `translate(${p.x - 26}px, ${p.y + 30}px)`;
      }
      other.classList.toggle('on', !!p && S.dark > 0.85 && !document.hidden);
      requestAnimationFrame(follow);
    })();
  }

  /* ---------- the live edit ---------- */
  const typed = $('#typed');
  let typingStarted = false, editSeen = null;
  function scriptLines() {
    const p = Math.round(R.photo);
    const lines = [
      'i’ve been reading along with you since the photograph.',
      p >= 3 ? `you looked at him for ${p} seconds. he liked that.`
             : 'you didn’t look at him for very long. he noticed.',
      R.backs > 0 ? `you scrolled back to check ${R.backs === 1 ? 'once' : R.backs + ' times'}. you were right to.`
                  : 'you never scrolled back to check. you should have.',
      'he isn’t in the photograph anymore.',
      '',
      'it’s alright. he only moves when you look away from the screen.',
      '',
      'so don’t.',
    ];
    return lines;
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function typeOut() {
    typingStarted = true;
    const lines = scriptLines();
    let text = '';
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      if (li > 0) { text += '\n'; typed.textContent = text; }
      if (line === '') { await sleep(2600); continue; }
      for (let i = 0; i < line.length; i++) {
        // occasionally a wrong key, noticed, deleted
        if (Math.random() < 0.035 && /[a-z]/.test(line[i])) {
          text += 'qwertyuiopasdfghjklzxcvbnm'[Math.floor(Math.random() * 26)];
          typed.textContent = text;
          await sleep(180 + Math.random() * 200);
          text = text.slice(0, -1);
          typed.textContent = text;
          await sleep(140);
        }
        text += line[i];
        typed.textContent = text;
        const c = line[i];
        await sleep(c === '.' || c === ',' ? 420 + Math.random() * 400 : 55 + Math.random() * 120);
      }
      if (li === 3) phases.add('gone'); // the photographs empty when you are not looking
      await sleep(1300 + Math.random() * 900);
    }
    S.typingDone = true;
  }
  setInterval(() => {
    if (typingStarted) return;
    const r = $('#live-edit').getBoundingClientRect();
    const visible = r.top < window.innerHeight * 0.85 && r.bottom > 0;
    if (!visible) { editSeen = null; return; }
    editSeen = editSeen || Date.now();
    if (Date.now() - editSeen > 1800) typeOut();
  }, 300);

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
  let wi = 0, idleTimer = null, forced = null;
  function say(text, ms) {
    whisper.textContent = text;
    whisper.classList.add('on');
    clearTimeout(forced); forced = null;
    if (ms) forced = setTimeout(() => { whisper.classList.remove('on'); forced = null; }, ms);
  }
  function resetIdle() {
    lastActivity = Date.now();
    if (!forced) whisper.classList.remove('on');
    clearTimeout(idleTimer);
    if (S.dark < 0.6) return;
    idleTimer = setTimeout(() => say(lines[wi++ % lines.length]), 9000);
  }
  ['scroll', 'mousemove', 'keydown', 'touchstart', 'wheel'].forEach(ev =>
    window.addEventListener(ev, resetIdle, { passive: true }));

  /* ---------- looking away ---------- */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      S.hidden = true;
      if (S.dark > 0.5) {
        R.awayCount++; R.awayStart = Date.now();
        document.title = S.typingDone ? 'you looked away' : S.ended ? 'we kept your place' : 'we’ll wait';
      }
    } else {
      S.hidden = false;
      if (R.awayStart) { R.awaySecs += (Date.now() - R.awayStart) / 1000; R.awayStart = 0; }
      document.title = baseTitle;
      if (S.typingDone && !S.heMoved) {
        S.heMoved = true;
        // nothing jumps. it is just a sentence, fading in, and it stays a while.
        setTimeout(() => say('he moved.', 9000), 1200);
        phases.add('after'); // and the top of the page is ready for you, whenever you go back
      }
    }
  });

  /* ---------- search ---------- */
  const search = $('#search'), suggest = $('#suggest');
  const normal = ['World War II', 'World War II casualties', 'World War II in Europe', 'World War II timeline', 'World War I', 'Women in World War II'];
  const odd = ['why is the page getting darker', 'is someone else reading this page', 'how to stop reading', 'the seventh man in the photograph', 'the reader', 'what happens if you scroll back up'];
  function showSuggest() {
    const q = search.value.trim().toLowerCase();
    let items = normal.filter(s => s.toLowerCase().startsWith(q)).slice(0, 4).map(t => ({ t, odd: false }));
    if (phases.has('mid')) {
      const n = S.dark > 0.9 ? 4 : 2;
      items = items.slice(0, 5 - n).concat(odd.filter(s => s.startsWith(q) || !q || Math.random() < 0.5).slice(0, n).map(t => ({ t, odd: true })));
    }
    if (!items.length) { suggest.hidden = true; return; }
    suggest.innerHTML = items.map(i => `<li class="${i.odd ? 'odd' : ''}">${i.t}</li>`).join('');
    suggest.hidden = false;
  }
  search.addEventListener('focus', showSuggest);
  search.addEventListener('input', showSuggest);
  search.addEventListener('blur', () => setTimeout(() => (suggest.hidden = true), 150));

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
