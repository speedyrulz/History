/* The Archive: sound.
   Everything here is synthesised live with the Web Audio API. No recordings.
   It starts silent. It listens to how far down you are, and fills in slowly.
   Nothing is allowed to change suddenly: every level glides over seconds. */
(() => {
  'use strict';

  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;

  const $ = s => document.querySelector(s);
  const ui = {
    box: $('#listen'), btn: $('#listen-btn'), time: $('#listen-time'),
    bar: $('#listen-bar'), mute: $('#sound-toggle'),
  };

  let ctx = null, on = false, userMuted = false;
  const st = { age: 0, dark: 0, fall: 0, ended: false, viewers: 1, moved: false, hidden: false };

  /* ---------- helpers ---------- */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const band = (v, a, b) => clamp((v - a) / (b - a));      // 0 below a, 1 above b
  function glide(param, v, tc = 1.8) { param.setTargetAtTime(v, ctx.currentTime, tc); }

  let noiseBuf = null;
  function noise() {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    src.start(0, Math.random() * 2);
    return src;
  }
  function makeImpulse(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  function filter(type, freq, q = 0.7) {
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f;
  }
  function gain(v = 0) { const g = ctx.createGain(); g.gain.value = v; return g; }

  /* ---------- graph ---------- */
  let master, dry, room, L = {};
  function build() {
    ctx = new AC();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    // master chain with a limiter, so nothing can ever get loud
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24; comp.knee.value = 12; comp.ratio.value = 8;
    comp.attack.value = 0.05; comp.release.value = 0.8;
    master = gain(0);
    master.connect(comp).connect(ctx.destination);

    dry = gain(1); dry.connect(master);
    const verb = ctx.createConvolver(); verb.buffer = makeImpulse(3.5, 2.6);
    room = gain(0.9); room.connect(verb).connect(master);

    // each layer: a gain node that feeds dry and/or the room
    const layer = (wetAmt, dryAmt = 1) => {
      const g = gain(0);
      if (dryAmt) { const d = gain(dryAmt); g.connect(d).connect(dry); }
      if (wetAmt) { const w = gain(wetAmt); g.connect(w).connect(room); }
      return g;
    };

    /* 1. tape hiss */
    L.hiss = layer(0, 1);
    noise().connect(filter('highpass', 3000)).connect(filter('lowpass', 9000)).connect(L.hiss);

    /* 2. gramophone crackle: sparse random clicks */
    L.crackle = layer(0.1, 1);
    L.crackleBus = filter('bandpass', 2500, 0.6); L.crackleBus.connect(L.crackle);

    /* 3. the record in another room */
    L.record = layer(0.6, 0.5);
    L.recTone = filter('lowpass', 2400); L.recTone.connect(filter('highpass', 280)).connect(L.record);

    /* 4. morse, buried in the static */
    L.morse = layer(0.3, 0.7);
    L.morseBus = filter('bandpass', 640, 6); L.morseBus.connect(L.morse);

    /* 5. a siren, far away */
    L.siren = layer(1, 0.08);
    const sirBus = filter('lowpass', 900); sirBus.connect(L.siren);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 1 / 14;
    const lfoAmt = gain(165); lfo.connect(lfoAmt);
    [0, 6, -5].forEach(det => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 445; o.detune.value = det;
      lfoAmt.connect(o.frequency);
      const g = gain(0.33); o.connect(g).connect(sirBus); o.start();
    });
    lfo.start();

    /* 6. drone */
    L.drone = layer(0.4, 1);
    const droneF = filter('lowpass', 170, 1.2);
    const dl = ctx.createOscillator(); dl.frequency.value = 0.05;
    const dla = gain(60); dl.connect(dla).connect(droneF.frequency); dl.start();
    droneF.connect(L.drone);
    [[55, 'sawtooth', 0.4], [55.35, 'sawtooth', 0.4], [82.4, 'sine', 0.3], [36.7, 'sine', 0.5]].forEach(([f, t, v]) => {
      const o = ctx.createOscillator(); o.type = t; o.frequency.value = f;
      const g = gain(v); o.connect(g).connect(droneF); o.start();
    });

    /* 7. heartbeat */
    L.heart = layer(0.15, 1);

    /* 8. breathing, close. and a second one */
    L.breath1 = layer(0.08, 1);
    L.breath2 = layer(0.25, 1);
    L.pan2 = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (L.pan2) { L.pan2.pan.value = -0.75; L.pan2.connect(L.breath2); }

    /* 9. ringing in the ears */
    L.tinnitus = layer(0, 1);
    const tn = ctx.createOscillator(); tn.frequency.value = 7600;
    const tn2 = ctx.createOscillator(); tn2.frequency.value = 7612;
    tn.connect(L.tinnitus); tn2.connect(L.tinnitus); tn.start(); tn2.start();

    /* 10. keys */
    L.keys = layer(0.2, 1);

    startSchedulers();

    // ?sounddebug exposes levels for testing; nothing else reads this
    if (location.search.includes('sounddebug')) {
      const an = ctx.createAnalyser(); an.fftSize = 2048; master.connect(an);
      const buf = new Float32Array(an.fftSize);
      window.__sound = {
        level() { an.getFloatTimeDomainData(buf); let p = 0, r = 0; for (const v of buf) { p = Math.max(p, Math.abs(v)); r += v * v; } return { peak: p, rms: Math.sqrt(r / buf.length) }; },
        gains() { const o = {}; for (const k in L) if (L[k].gain) o[k] = +L[k].gain.value.toFixed(4); o.master = +master.gain.value.toFixed(3); return o; },
        state: () => ctx.state,
      };
    }
  }

  /* ---------- scheduled sounds ---------- */
  const look = 0.25;          // seconds of lookahead
  let nextCrackle = 0, nextNote = 0, noteIdx = 0, nextMorse = 0, morseQueue = [], nextBeat = 0;
  let nextBreath = [0, 0];

  // an original waltz in A minor: [note, beats]
  const N = n => 440 * Math.pow(2, (n - 69) / 12);
  const melody = [
    [69, 1], [72, 1], [76, 1], [74, 2], [72, 1], [71, 1], [68, 1], [71, 1], [69, 3],
    [64, 1], [69, 1], [72, 1], [71, 2], [69, 1], [68, 1], [64, 1], [65, 1], [64, 3],
    [65, 1], [69, 1], [74, 1], [72, 2], [71, 1], [69, 1], [64, 1], [68, 1], [69, 2], [0, 1],
    [72, 1], [71, 1], [69, 1], [68, 2], [64, 1], [65, 1], [68, 1], [71, 1], [69, 3],
  ];
  const bassFor = i => [45, 50, 40, 45, 45, 40, 40, 40, 41, 45, 40, 45, 45, 40, 40, 45][Math.floor(i / 3) % 16];
  let beatCount = 0;

  function pluck(freq, t, dur, vol, detune) {
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.value = freq; o.detune.value = detune;
    const o2 = ctx.createOscillator(); o2.type = 'sine';
    o2.frequency.value = freq * 2; o2.detune.value = detune;
    const g = gain(0), g2 = gain(0.25);
    o.connect(g); o2.connect(g2).connect(g); g.connect(L.recTone);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }

  const MORSE = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..' };
  function morseSchedule(msg, t0) {
    const u = 0.075; let t = t0; const out = [];
    for (const word of msg.split(' ')) {
      for (const ch of word) {
        for (const sym of MORSE[ch]) { const d = sym === '.' ? u : 3 * u; out.push([t, d]); t += d + u; }
        t += 2 * u;
      }
      t += 4 * u;
    }
    return { tones: out, end: t };
  }
  let morseOsc = null, morseGate = null;

  function thump(t, vol, f0) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.6, t + 0.18);
    const g = gain(0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.3);
    o.connect(g).connect(L.heart); o.start(t); o.stop(t + 0.35);
  }

  function breath(t, dest, vol, period) {
    // in through the nose, out slowly
    const n = noise();
    const bp = filter('bandpass', 900, 0.8);
    const g = gain(0);
    n.connect(bp).connect(g).connect(dest);
    const inh = period * 0.38, hold = period * 0.06, exh = period * 0.48;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol * 0.8, t + inh * 0.8);
    g.gain.linearRampToValueAtTime(0.0001, t + inh);
    g.gain.setValueAtTime(0.0001, t + inh + hold);
    g.gain.linearRampToValueAtTime(vol, t + inh + hold + exh * 0.25);
    g.gain.linearRampToValueAtTime(0.0001, t + inh + hold + exh);
    bp.frequency.setValueAtTime(1300, t);
    bp.frequency.linearRampToValueAtTime(1700, t + inh);
    bp.frequency.setValueAtTime(700, t + inh + hold);
    bp.frequency.linearRampToValueAtTime(450, t + inh + hold + exh);
    n.stop(t + period);
  }

  function startSchedulers() {
    morseOsc = ctx.createOscillator(); morseOsc.frequency.value = 640;
    morseGate = gain(0); morseOsc.connect(morseGate).connect(L.morseBus); morseOsc.start();

    setInterval(() => {
      if (!on) return;
      const now = ctx.currentTime, until = now + look;

      // crackle: random dust on the record
      if (st.age > 0.15) {
        while (nextCrackle < until) {
          nextCrackle = Math.max(nextCrackle, now) + Math.random() * Math.random() * 0.6;
          const s = ctx.createBufferSource(); s.buffer = noiseBuf;
          const g = gain(0); const v = 0.3 + Math.random() * 0.7;
          g.gain.setValueAtTime(v, nextCrackle); g.gain.exponentialRampToValueAtTime(0.001, nextCrackle + 0.004 + Math.random() * 0.01);
          s.connect(g).connect(L.crackleBus); s.start(nextCrackle, Math.random()); s.stop(nextCrackle + 0.02);
        }
      } else nextCrackle = now;

      // the record: winds down as the page goes dark
      const slow = 1 - st.dark * 0.55;
      if (st.age > 0.2 && st.dark < 0.75) {
        while (nextNote < until) {
          nextNote = Math.max(nextNote, now);
          const [n, beats] = melody[noteIdx % melody.length];
          const spb = (60 / 96) / slow;
          const wow = Math.sin(nextNote * 2 * Math.PI * 0.55) * (8 + st.age * 10 + st.dark * 70);
          const det = -st.dark * 260 + wow;
          if (n) pluck(N(n), nextNote, 1.6 / slow, 0.22, det);
          if (beatCount % 3 === 0) pluck(N(bassFor(beatCount)), nextNote, 2.2 / slow, 0.12, det);
          beatCount += beats; noteIdx++;
          nextNote += beats * spb * (1 + (Math.random() - 0.5) * 0.04 * (1 + st.dark * 4));
        }
      } else nextNote = now;

      // morse: STILL HERE, over and over, under the hiss
      if (st.age > 0.35 && st.fall < 0.3) {
        if (nextMorse < until && !morseQueue.length) {
          const m = morseSchedule('STILL HERE', Math.max(nextMorse, now + 0.05));
          morseQueue = m.tones; nextMorse = m.end + 3.5;
        }
        while (morseQueue.length && morseQueue[0][0] < until) {
          const [t, d] = morseQueue.shift();
          morseGate.gain.setValueAtTime(0, t);
          morseGate.gain.linearRampToValueAtTime(1, t + 0.005);
          morseGate.gain.setValueAtTime(1, t + d);
          morseGate.gain.linearRampToValueAtTime(0, t + d + 0.005);
        }
      } else { morseQueue = []; nextMorse = now; }

      // heartbeat: slow, and a little uneven
      if (st.dark > 0.55 && st.fall < 0.6) {
        while (nextBeat < until) {
          nextBeat = Math.max(nextBeat, now);
          thump(nextBeat, 0.9, 58); thump(nextBeat + 0.24, 0.55, 52);
          nextBeat += (60 / 52) * (1 + (Math.random() - 0.5) * 0.06);
        }
      } else nextBeat = now;

      // breathing: in time with the page
      if (st.dark > 0.85 || st.ended) {
        const period = 7;
        if (nextBreath[0] < until) {
          nextBreath[0] = Math.max(nextBreath[0], now);
          breath(nextBreath[0], L.breath1, 0.9, period);
          nextBreath[0] += period;
        }
        if (st.viewers > 1 && nextBreath[1] < until) {
          nextBreath[1] = Math.max(nextBreath[1], now + 2.3);
          // not quite in time with yours
          const p = period * (0.93 + Math.random() * 0.05);
          breath(nextBreath[1], L.pan2 || L.breath2, 0.9, p);
          nextBreath[1] += p;
        }
      } else { nextBreath = [now, now]; }
    }, 90);
  }

  /* ---------- levels: the mix, as a function of where you are ---------- */
  function mix() {
    if (!ctx) return;
    const { age, dark, fall, ended } = st;
    const out = 1 - band(fall, 0.05, 0.5);        // the fall takes everything away
    const back = ended && fall < 0.05;              // returned to the top

    glide(L.hiss.gain, back ? 0.004 : (band(age, 0.05, 1) * 0.02 + dark * 0.025) * out, 3);
    glide(L.crackle.gain, back ? 0 : band(age, 0.15, 0.8) * (0.07 - dark * 0.04) * out, 3);
    glide(L.record.gain, back ? 0 : band(age, 0.2, 0.7) * (1 - band(dark, 0.45, 0.75)) * 0.12, 3);
    glide(L.recTone.frequency, 2400 - dark * 1500, 3);
    glide(L.morse.gain, back ? 0 : band(age, 0.35, 1) * 0.025 * (1 - band(dark, 0.6, 1) * 0.5) * out, 3);
    glide(L.siren.gain, back ? 0 : band(dark, 0.05, 0.45) * (1 - band(dark, 0.75, 1)) * 0.05, 4);
    glide(L.drone.gain, back ? 0 : band(dark, 0.2, 0.9) * 0.09 * out, 4);
    glide(L.heart.gain, back ? 0 : band(dark, 0.55, 1) * 0.16 * (1 - band(fall, 0.1, 0.6)), 3);

    const closeness = st.moved ? 1 : 0;
    glide(L.breath1.gain, back ? 0 : (band(dark, 0.85, 1) * 0.05 + band(fall, 0, 0.6) * 0.07), 3);
    glide(L.breath2.gain, (st.viewers > 1 ? (back ? 0.02 : 0.035 + closeness * 0.04 + band(fall, 0, 0.6) * 0.04) : 0), 4);
    if (L.pan2) glide(L.pan2.pan, st.moved ? -0.25 : -0.75, 6);
    glide(L.tinnitus.gain, back ? 0 : band(fall, 0.2, 0.8) * 0.0035, 5);
    glide(L.keys.gain, 0.06 + dark * 0.05, 1);

    glide(master.gain, on ? (st.hidden ? 0.45 : 0.9) : 0, on ? 2.5 : 0.6);
  }

  /* ---------- turning it on and off ---------- */
  function setUi() {
    if (ui.btn) {
      ui.btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      ui.btn.innerHTML = on ? '&#10074;&#10074;' : '&#9654;';
      ui.btn.setAttribute('aria-label', on ? 'Pause' : 'Play');
    }
    if (ui.mute) {
      ui.mute.hidden = !ctx;
      ui.mute.classList.toggle('muted', !on);
      ui.mute.setAttribute('aria-label', on ? 'Mute sound' : 'Unmute sound');
      ui.mute.title = on ? 'Mute' : 'Unmute';
    }
  }
  function start() {
    if (!ctx) build();
    if (ctx.state === 'suspended') ctx.resume();
    on = true; userMuted = false;
    mix(); setUi();
  }
  function stop(byUser) {
    on = false; if (byUser) userMuted = true;
    mix(); setUi();
  }
  ui.btn && ui.btn.addEventListener('click', e => { e.stopPropagation(); on ? stop(true) : start(); });
  ui.mute && ui.mute.addEventListener('click', e => { e.stopPropagation(); on ? stop(true) : start(); });

  // any first deliberate interaction also starts it. it begins silent, so there is nothing to hear yet.
  const firstTouch = e => {
    if (e.target.closest && e.target.closest('#listen-btn, #sound-toggle')) return; // they handle themselves
    if (!on && !userMuted) start();
    ['pointerdown', 'keydown'].forEach(ev => window.removeEventListener(ev, firstTouch, true));
  };
  ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, firstTouch, true));

  /* ---------- listening to the page ---------- */
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const DURATION = 23 * 60 + 41;
  document.addEventListener('archive:progress', e => {
    Object.assign(st, e.detail);
    mix();
    // the recording's position is wherever you are reading
    if (ui.time) {
      const p = clamp(e.detail.page);
      ui.time.textContent = st.ended ? `${fmt(p * DURATION)} / ––:––` : `${fmt(p * DURATION)} / ${fmt(DURATION)}`;
      ui.bar.style.width = (p * 100).toFixed(1) + '%';
    }
  });
  document.addEventListener('archive:viewers', () => { st.viewers = 2; mix(); });
  document.addEventListener('archive:moved', () => { st.moved = true; mix(); });
  document.addEventListener('archive:hidden', e => { st.hidden = e.detail; mix(); });
  document.addEventListener('archive:key', () => {
    if (!on || !ctx) return;
    const t = ctx.currentTime + 0.005;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = filter('bandpass', 1800 + Math.random() * 1600, 2.5);
    const g = gain(0);
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    s.connect(f).connect(g).connect(L.keys); s.start(t, Math.random()); s.stop(t + 0.05);
  });
})();
