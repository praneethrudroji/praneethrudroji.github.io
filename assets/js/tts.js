/**
 * Free text-to-speech "Listen to this post" player.
 * Uses the browser's built-in Web Speech API (speechSynthesis) - no external
 * service, no API key. Injected on post pages only (see _includes/metadata-hook.html).
 *
 * Voice quality is whatever the OS/browser ships: Edge exposes Microsoft
 * "Natural" neural voices, Chrome has Google network voices, macOS/iOS have
 * "Enhanced"/"Premium" Siri voices. We rank those highest and let the reader
 * override via a dropdown (persisted in localStorage).
 *
 * The paragraph being read is highlighted as a reading cursor; while the
 * player is active, clicking any paragraph jumps playback to it.
 */
(function () {
  'use strict';

  if (!('speechSynthesis' in window)) return;
  if (!location.pathname.startsWith('/posts/')) return;

  var content = document.querySelector('article .content');
  if (!content) return;

  var synth = window.speechSynthesis;
  var VOICE_KEY = 'tts-voice';
  var RATE_KEY = 'tts-rate';
  var SCROLL_KEY = 'tts-autoscroll';
  var BAR_COUNT = 28;
  var BLOCK_SEL = 'h1, h2, h3, h4, p, li, blockquote, dt, dd';
  var SKIP_SEL =
    'pre, .highlight, script, style, table, figure, img, iframe, audio, video, .mermaid, .katex, .katex-display, nav';

  var segments = []; /* [{el, text}] block elements in reading order */
  var chunks = []; /* [{text, seg}] utterance-sized pieces */
  var segFirstChunk = []; /* segment index -> first chunk index */
  var chunkIdx = 0;
  var playing = false;
  var paused = false;
  var volume = 1;
  /* Capped at 1.75x - browser voices clip syllables and pitch-warp beyond
     that, so higher multipliers sound broken rather than fast. */
  var RATES = [0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75];
  var rate = snapRate(parseFloat(localStorage.getItem(RATE_KEY)) || 1);
  var currentUtterance = null;

  /* Snap any value (including ones saved by older versions, e.g. 2) to the
     nearest supported rate. */
  function snapRate(r) {
    return RATES.reduce(function (best, cand) {
      return Math.abs(cand - r) < Math.abs(best - r) ? cand : best;
    });
  }

  /* ---------- text extraction ---------- */

  /* One segment per block element, taking only its own prose (nested blocks
     become their own segments; code/tables/figures are skipped entirely). */
  function buildSegments() {
    var title = document.querySelector('article h1');
    if (title && title.textContent.trim()) {
      segments.push({ el: title, text: title.textContent.trim() + '.' });
    }
    content.querySelectorAll(BLOCK_SEL).forEach(function (el) {
      if (el.closest(SKIP_SEL)) return;
      var clone = el.cloneNode(true);
      clone.querySelectorAll(BLOCK_SEL + ', ' + SKIP_SEL).forEach(function (c) {
        c.remove();
      });
      var text = clone.innerText.replace(/\s+/g, ' ').trim();
      if (!text) return;
      el.dataset.ttsSeg = segments.length;
      segments.push({ el: el, text: text });
    });
  }

  /* Chrome silently stops long single utterances, so split each segment at
     sentence boundaries into short pieces - the pauses stay natural. */
  function buildChunks() {
    segments.forEach(function (seg, si) {
      segFirstChunk[si] = chunks.length;
      var sentences = seg.text.match(/[^.!?]+[.!?]+[\s]*|[^.!?]+$/g) || [seg.text];
      var buf = '';
      sentences.forEach(function (s) {
        if (buf.length + s.length > 200 && buf) {
          chunks.push({ text: buf, seg: si });
          buf = s;
        } else {
          buf += s;
        }
      });
      if (buf.trim()) chunks.push({ text: buf, seg: si });
    });
  }

  /* ---------- voices ---------- */

  function matchingVoices() {
    var lang = (document.documentElement.lang || 'en').split('-')[0].toLowerCase();
    var real = synth.getVoices().filter(function (v) {
      return v.lang.toLowerCase().indexOf(lang) === 0 && !NOVELTY_RE.test(v.name);
    });
    /* Prefer the major en-US/en-GB voices; regional ones (en-ZA "Tessa",
       en-IN, en-AU...) only appear if nothing better exists. */
    var major = real.filter(function (v) {
      return /^en[-_](us|gb)/i.test(v.lang);
    });
    return major.length ? major : real;
  }

  /* macOS ships joke/character voices that browsers list alongside real
     ones - keep the dropdown to standard speech voices only. */
  var NOVELTY_RE =
    /^(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|kathy|ralph|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;

  /* Higher score = more natural-sounding, based on known voice families. */
  function voiceScore(v) {
    var s = 0;
    if (/uk english female/i.test(v.name)) s += 9; /* preferred default */
    if (/natural/i.test(v.name)) s += 8; /* Edge neural voices */
    if (/premium|enhanced/i.test(v.name)) s += 6; /* Apple high-quality voices */
    if (/google/i.test(v.name)) s += 4; /* Chrome network voices */
    if (!v.localService) s += 1;
    if (v.default) s += 1;
    return s;
  }

  function pickVoice() {
    var saved = localStorage.getItem(VOICE_KEY);
    var voices = matchingVoices();
    if (saved) {
      var chosen = voices.filter(function (v) {
        return v.name === saved;
      })[0];
      if (chosen) return chosen;
    }
    return (
      voices.sort(function (a, b) {
        return voiceScore(b) - voiceScore(a);
      })[0] ||
      synth.getVoices()[0] ||
      null
    );
  }

  /* ---------- playback ---------- */

  function hardCancel() {
    currentUtterance = null;
    synth.resume(); /* cancel() while paused can wedge Chrome's engine */
    synth.cancel();
  }

  function speakChunk() {
    if (chunkIdx >= chunks.length) {
      stop();
      return;
    }
    var u = new SpeechSynthesisUtterance(chunks[chunkIdx].text);
    var voice = pickVoice();
    if (voice) u.voice = voice;
    u.rate = rate;
    u.volume = volume;
    u.onend = function () {
      /* cancel() also fires end/error on the dead utterance - ignore those */
      if (u !== currentUtterance || !playing) return;
      chunkIdx += 1;
      updateCursor();
      speakChunk();
    };
    u.onerror = function () {
      if (u !== currentUtterance) return;
      stop();
    };
    currentUtterance = u;
    updateCursor();
    synth.speak(u);
  }

  function play() {
    if (paused) {
      synth.resume();
      paused = false;
      setUi('playing');
      return;
    }
    if (playing) {
      synth.pause();
      paused = true;
      setUi('paused');
      return;
    }
    chunkIdx = 0;
    playing = true;
    paused = false;
    setUi('playing');
    speakChunk();
  }

  function stop() {
    playing = false;
    paused = false;
    chunkIdx = 0;
    hardCancel();
    setUi('idle');
    updateCursor();
  }

  function jumpTo(idx) {
    hardCancel();
    chunkIdx = idx;
    playing = true;
    paused = false;
    setUi('playing');
    speakChunk();
  }

  function restartCurrentChunk() {
    if (playing && !paused) jumpTo(chunkIdx);
  }

  /* ---------- reading cursor ---------- */

  var readingEl = null;

  function updateCursor() {
    var el = null;
    if (playing && chunkIdx < chunks.length) {
      el = segments[chunks[chunkIdx].seg].el;
    }
    if (el === readingEl) {
      updateProgress();
      return;
    }
    if (readingEl) readingEl.classList.remove('tts-reading');
    readingEl = el;
    if (el) {
      el.classList.add('tts-reading');
      if (autoScroll) {
        var r = el.getBoundingClientRect();
        if (r.top < 80 || r.bottom > window.innerHeight - 80) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
    updateProgress();
  }

  function onContentClick(e) {
    if (!playing && !paused) return;
    if (e.target.closest('a')) return; /* let links behave normally */
    var block = e.target.closest('[data-tts-seg]');
    if (!block || !content.contains(block)) return;
    jumpTo(segFirstChunk[parseInt(block.dataset.ttsSeg, 10)]);
  }

  /* ---------- UI ---------- */

  var card, playBtn, playIcon, restartBtn, bars, pctLabel, rateSel, voiceSel, volSlider, scrollBtn;
  var autoScroll = localStorage.getItem(SCROLL_KEY) !== '0';

  var CSS =
    '#tts-player{background:var(--card-bg);box-shadow:var(--card-shadow);' +
    'border:1px solid var(--btn-border-color,rgba(128,128,128,.25));border-radius:.75rem;' +
    'padding:.6rem .9rem;margin:.75rem 0 1.75rem;display:flex;flex-direction:column;gap:.5rem}' +
    '#tts-player .tts-row{display:flex;align-items:center;gap:.75rem;min-width:0}' +
    '#tts-player button{border:0;background:none;padding:0;color:var(--text-muted-color,gray);cursor:pointer}' +
    '#tts-player .tts-play{flex:none;width:2.75rem;height:2.75rem;border-radius:50%;' +
    'background:var(--link-color);color:#fff;font-size:1rem;display:flex;align-items:center;justify-content:center}' +
    '#tts-player .tts-play:hover{filter:brightness(1.1)}' +
    '#tts-player .tts-restart{flex:none;font-size:1rem;width:2rem;height:2rem}' +
    '#tts-player .tts-restart:hover{color:var(--link-color)}' +
    '#tts-player .tts-wave{flex:1;display:flex;align-items:center;justify-content:space-between;' +
    'gap:3px;height:2.25rem;min-width:0;overflow:hidden}' +
    '#tts-player .tts-wave span{flex:none;width:4px;border-radius:2px;' +
    'background:var(--btn-border-color,rgba(128,128,128,.35));height:30%;transition:background .2s}' +
    '#tts-player .tts-wave span.on{background:var(--link-color)}' +
    '#tts-player.playing .tts-wave span{animation:tts-wave 1.1s ease-in-out infinite alternate}' +
    '@keyframes tts-wave{from{transform:scaleY(.55)}to{transform:scaleY(1.4)}}' +
    '@media (prefers-reduced-motion: reduce){#tts-player.playing .tts-wave span{animation:none}}' +
    '#tts-player .tts-pct{flex:none;font-size:.8rem;color:var(--text-muted-color,gray);min-width:2.5rem;text-align:right}' +
    '#tts-player select{border:1px solid var(--btn-border-color,rgba(128,128,128,.25));' +
    'background:transparent;color:var(--text-muted-color,gray);border-radius:2rem;' +
    'font-size:.8rem;padding:.2rem .6rem;max-width:100%}' +
    '#tts-player .tts-voice{flex:1;min-width:0;text-overflow:ellipsis}' +
    '#tts-player select:focus{outline:none;border-color:var(--link-color)}' +
    '#tts-player input[type=range]{flex:none;width:90px;accent-color:var(--link-color)}' +
    '#tts-player .tts-vol-icon{flex:none;font-size:.85rem;color:var(--text-muted-color,gray)}' +
    '#tts-player .tts-scroll{flex:none;font-size:.9rem;width:1.75rem;height:1.75rem;border-radius:50%;' +
    'border:1px solid var(--btn-border-color,rgba(128,128,128,.25))}' +
    '#tts-player .tts-scroll.active{color:var(--link-color);border-color:var(--link-color)}' +
    '.tts-reading{background:rgba(100,149,237,.16);border-radius:.3rem;transition:background .3s}' +
    '.tts-active [data-tts-seg]{cursor:pointer}' +
    '.tts-active [data-tts-seg]:hover{background:rgba(100,149,237,.08);border-radius:.3rem}' +
    '@supports (background:color-mix(in srgb,red 10%,transparent)){' +
    '.tts-reading{background:color-mix(in srgb,var(--link-color) 16%,transparent)}' +
    '.tts-active [data-tts-seg]:hover{background:color-mix(in srgb,var(--link-color) 8%,transparent)}}';

  function setUi(state) {
    playIcon.className = state === 'playing' ? 'fas fa-pause' : 'fas fa-play';
    playBtn.setAttribute(
      'aria-label',
      state === 'playing' ? 'Pause' : state === 'paused' ? 'Resume' : 'Listen to this post'
    );
    card.classList.toggle('playing', state === 'playing');
    content.classList.toggle('tts-active', state !== 'idle');
  }

  function updateProgress() {
    var frac = playing ? chunkIdx / chunks.length : 0;
    bars.forEach(function (b, i) {
      b.classList.toggle('on', playing && i / bars.length <= frac);
    });
    pctLabel.textContent = playing ? Math.round(frac * 100) + '%' : '';
  }

  function populateVoices() {
    var voices = matchingVoices()
      .sort(function (a, b) {
        return voiceScore(b) - voiceScore(a);
      })
      .slice(0, 6);
    if (!voices.length) return;
    var selected = pickVoice();
    voiceSel.innerHTML = '';
    voices.forEach(function (v) {
      var opt = document.createElement('option');
      opt.value = v.name;
      /* "Microsoft Aria Online (Natural) - English (United States)" -> "Aria (Natural)" */
      opt.textContent = v.name
        .replace(/^(Microsoft|Google|Apple)\s+/i, '')
        .replace(/\s+-\s+.*$/, '')
        .replace(/\s+Online/i, '');
      if (selected && v.name === selected.name) opt.selected = true;
      voiceSel.appendChild(opt);
    });
    voiceSel.hidden = voices.length < 2;
  }

  function buildUi() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    card = document.createElement('div');
    card.id = 'tts-player';
    card.setAttribute('role', 'region');
    card.setAttribute('aria-label', 'Listen to this post');
    card.innerHTML =
      '<div class="tts-row">' +
      '<button type="button" class="tts-restart" aria-label="Restart from beginning">' +
      '<i class="fas fa-rotate-left" aria-hidden="true"></i></button>' +
      '<button type="button" class="tts-play" aria-label="Listen to this post">' +
      '<i class="fas fa-play" aria-hidden="true"></i></button>' +
      '<div class="tts-wave" aria-hidden="true"></div>' +
      '<span class="tts-pct" aria-hidden="true"></span>' +
      '</div>' +
      '<div class="tts-row">' +
      '<select class="tts-rate" aria-label="Reading speed"></select>' +
      '<select class="tts-voice" aria-label="Voice" hidden></select>' +
      '<button type="button" class="tts-scroll" title="Auto-scroll to the line being read" ' +
      'aria-label="Toggle auto-scroll to the line being read" aria-pressed="false">' +
      '<i class="fas fa-arrows-down-to-line" aria-hidden="true"></i></button>' +
      '<i class="fas fa-volume-high tts-vol-icon" aria-hidden="true"></i>' +
      '<input type="range" min="0" max="1" step="0.1" value="1" aria-label="Volume">' +
      '</div>';

    playBtn = card.querySelector('.tts-play');
    playIcon = playBtn.querySelector('i');
    restartBtn = card.querySelector('.tts-restart');
    pctLabel = card.querySelector('.tts-pct');
    rateSel = card.querySelector('.tts-rate');
    voiceSel = card.querySelector('.tts-voice');
    volSlider = card.querySelector('input[type=range]');
    scrollBtn = card.querySelector('.tts-scroll');
    scrollBtn.classList.toggle('active', autoScroll);
    scrollBtn.setAttribute('aria-pressed', String(autoScroll));

    RATES.forEach(function (r) {
      var opt = document.createElement('option');
      opt.value = r;
      opt.textContent = r + 'x';
      if (r === rate) opt.selected = true;
      rateSel.appendChild(opt);
    });

    playBtn.addEventListener('click', play);
    restartBtn.addEventListener('click', function () {
      if (playing || paused) jumpTo(0);
    });
    rateSel.addEventListener('change', function () {
      rate = parseFloat(rateSel.value);
      localStorage.setItem(RATE_KEY, rateSel.value);
      restartCurrentChunk();
    });
    voiceSel.addEventListener('change', function () {
      localStorage.setItem(VOICE_KEY, voiceSel.value);
      restartCurrentChunk();
    });
    scrollBtn.addEventListener('click', function () {
      autoScroll = !autoScroll;
      localStorage.setItem(SCROLL_KEY, autoScroll ? '1' : '0');
      scrollBtn.classList.toggle('active', autoScroll);
      scrollBtn.setAttribute('aria-pressed', String(autoScroll));
      /* jump to the read point right away when turned on mid-listen */
      if (autoScroll && readingEl) {
        readingEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    volSlider.addEventListener('change', function () {
      volume = parseFloat(volSlider.value);
      restartCurrentChunk();
    });
    content.addEventListener('click', onContentClick);

    content.parentNode.insertBefore(card, content);
    buildBars();
  }

  /* Bar count is derived from the rendered width so the waveform always
     fills the row (4px bar + ~3px gap per step). */
  function buildBars() {
    var wave = card.querySelector('.tts-wave');
    wave.innerHTML = '';
    var count = Math.max(20, Math.min(80, Math.floor(wave.clientWidth / 7))) || BAR_COUNT;
    bars = [];
    for (var i = 0; i < count; i++) {
      var b = document.createElement('span');
      /* pseudo-random but stable bar heights for a waveform look */
      b.style.height = 22 + Math.abs(Math.sin(i * 2.7) * 58) + '%';
      b.style.animationDelay = (i % 7) * -0.16 + 's';
      wave.appendChild(b);
      bars.push(b);
    }
    updateProgress();
  }

  /* ---------- init ---------- */

  buildSegments();
  buildChunks();
  if (!chunks.length) return;

  buildUi();
  populateVoices();
  if (typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', populateVoices);
  }
  window.addEventListener('beforeunload', function () {
    synth.cancel();
  });
})();
