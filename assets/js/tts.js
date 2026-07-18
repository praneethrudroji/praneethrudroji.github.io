/**
 * Free text-to-speech "Listen to this post" player.
 * Uses the browser's built-in Web Speech API (speechSynthesis) - no external
 * service, no API key. Injected on post pages only (see _includes/metadata-hook.html).
 *
 * Voice quality is whatever the OS/browser ships: Edge exposes Microsoft
 * "Natural" neural voices, Chrome has Google network voices, macOS/iOS have
 * "Enhanced"/"Premium" Siri voices. We rank those highest and let the reader
 * override via a dropdown (persisted in localStorage).
 */
(function () {
  'use strict';

  if (!('speechSynthesis' in window)) return;
  if (!location.pathname.startsWith('/posts/')) return;

  var content = document.querySelector('article .content');
  if (!content) return;

  var synth = window.speechSynthesis;
  var VOICE_KEY = 'tts-voice';
  var RATES = [1, 1.25, 1.5, 0.75];
  var rateIdx = 0;
  var chunks = [];
  var chunkIdx = 0;
  var playing = false;
  var paused = false;
  var currentUtterance = null;

  /* Extract readable prose: skip code blocks, tables, figures, embeds. */
  function extractText() {
    var clone = content.cloneNode(true);
    var skip = clone.querySelectorAll(
      'pre, .highlight, script, style, table, figure, img, iframe, audio, video, .mermaid, .katex, .katex-display, nav'
    );
    skip.forEach(function (el) {
      el.remove();
    });
    var title = document.querySelector('article h1');
    var text = (title ? title.textContent + '. ' : '') + clone.innerText;
    return text.replace(/\s+/g, ' ').trim();
  }

  /* Split into sentence-boundary chunks. Chrome silently stops long single
     utterances, so keep each one short; breaking only at sentence ends keeps
     the pauses sounding natural. */
  function buildChunks(text) {
    var sentences = text.match(/[^.!?]+[.!?]+[\s]*|[^.!?]+$/g) || [text];
    var out = [];
    var buf = '';
    sentences.forEach(function (s) {
      if (buf.length + s.length > 200 && buf) {
        out.push(buf);
        buf = s;
      } else {
        buf += s;
      }
    });
    if (buf.trim()) out.push(buf);
    return out;
  }

  function pageLang() {
    return (document.documentElement.lang || 'en').split('-')[0].toLowerCase();
  }

  function matchingVoices() {
    var lang = pageLang();
    return synth.getVoices().filter(function (v) {
      return v.lang.toLowerCase().indexOf(lang) === 0;
    });
  }

  /* Higher score = more natural-sounding, based on known voice families. */
  function voiceScore(v) {
    var s = 0;
    if (/natural/i.test(v.name)) s += 8; /* Edge neural voices */
    if (/premium|enhanced/i.test(v.name)) s += 6; /* Apple high-quality voices */
    if (/google/i.test(v.name)) s += 4; /* Chrome network voices */
    if (!v.localService) s += 1; /* network voices usually sound better */
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

  function speakChunk() {
    if (chunkIdx >= chunks.length) {
      stop();
      return;
    }
    var u = new SpeechSynthesisUtterance(chunks[chunkIdx]);
    var voice = pickVoice();
    if (voice) u.voice = voice;
    u.rate = RATES[rateIdx];
    u.onend = function () {
      /* cancel() also fires end/error on the dead utterance - ignore those */
      if (u !== currentUtterance || !playing) return;
      chunkIdx += 1;
      speakChunk();
    };
    u.onerror = function () {
      if (u !== currentUtterance) return;
      stop();
    };
    currentUtterance = u;
    synth.speak(u);
  }

  function restartCurrentChunk() {
    currentUtterance = null;
    synth.cancel();
    speakChunk();
  }

  var playBtn, stopBtn, rateBtn, voiceSel, playIcon, playLabel;

  function setPlayUi(state) {
    playIcon.className = state === 'playing' ? 'fas fa-pause' : 'fas fa-play';
    playLabel.textContent =
      state === 'playing' ? ' Pause' : state === 'paused' ? ' Resume' : ' Listen';
    stopBtn.hidden = state === 'idle';
  }

  function play() {
    if (paused) {
      synth.resume();
      paused = false;
      setPlayUi('playing');
      return;
    }
    if (playing) {
      synth.pause();
      paused = true;
      setPlayUi('paused');
      return;
    }
    chunks = buildChunks(extractText());
    chunkIdx = 0;
    playing = true;
    paused = false;
    setPlayUi('playing');
    speakChunk();
  }

  function stop() {
    playing = false;
    paused = false;
    currentUtterance = null;
    synth.resume(); /* cancel() while paused can wedge Chrome's engine */
    synth.cancel();
    setPlayUi('idle');
  }

  function cycleRate() {
    rateIdx = (rateIdx + 1) % RATES.length;
    rateBtn.textContent = RATES[rateIdx] + 'x';
    if (playing && !paused) restartCurrentChunk();
  }

  function populateVoices() {
    var voices = matchingVoices().sort(function (a, b) {
      return voiceScore(b) - voiceScore(a);
    });
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

  function onVoiceChange() {
    localStorage.setItem(VOICE_KEY, voiceSel.value);
    if (playing && !paused) restartCurrentChunk();
  }

  function buildUi() {
    var wrap = document.createElement('div');
    wrap.id = 'tts-player';
    wrap.className = 'd-flex align-items-center flex-wrap gap-2 mb-4';

    playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'btn btn-sm btn-outline-primary';
    playBtn.setAttribute('aria-label', 'Listen to this post');
    playIcon = document.createElement('i');
    playIcon.className = 'fas fa-play';
    playIcon.setAttribute('aria-hidden', 'true');
    playLabel = document.createElement('span');
    playLabel.textContent = ' Listen';
    playBtn.appendChild(playIcon);
    playBtn.appendChild(playLabel);
    playBtn.addEventListener('click', play);

    stopBtn = document.createElement('button');
    stopBtn.type = 'button';
    stopBtn.className = 'btn btn-sm btn-outline-secondary';
    stopBtn.setAttribute('aria-label', 'Stop listening');
    stopBtn.innerHTML = '<i class="fas fa-stop" aria-hidden="true"></i>';
    stopBtn.hidden = true;
    stopBtn.addEventListener('click', stop);

    rateBtn = document.createElement('button');
    rateBtn.type = 'button';
    rateBtn.className = 'btn btn-sm btn-outline-secondary';
    rateBtn.setAttribute('aria-label', 'Change reading speed');
    rateBtn.textContent = RATES[rateIdx] + 'x';
    rateBtn.addEventListener('click', cycleRate);

    voiceSel = document.createElement('select');
    voiceSel.className = 'form-select form-select-sm w-auto';
    voiceSel.setAttribute('aria-label', 'Choose a voice');
    voiceSel.hidden = true;
    voiceSel.addEventListener('change', onVoiceChange);

    wrap.appendChild(playBtn);
    wrap.appendChild(stopBtn);
    wrap.appendChild(rateBtn);
    wrap.appendChild(voiceSel);
    content.parentNode.insertBefore(wrap, content);
  }

  buildUi();

  /* Voice lists load asynchronously in most browsers. */
  populateVoices();
  if (typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', populateVoices);
  }

  window.addEventListener('beforeunload', function () {
    synth.cancel();
  });
})();
