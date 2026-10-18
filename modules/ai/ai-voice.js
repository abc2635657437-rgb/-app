// Travel desk voice — speech in, speech out.
//
// Everything happens in the browser: the app does not ship audio to the server
// and needs no speech key. Feature detection is explicit, because the Web Speech
// APIs differ between Chrome, Edge, Safari and in-app browsers: when recognition
// is missing the desk stays a keyboard desk instead of breaking.
(function () {
  var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  var synth = window.speechSynthesis;

  function sttSupported() { return Boolean(Recognition); }
  function ttsSupported() { return Boolean(synth && window.SpeechSynthesisUtterance); }

  // Readable text for the ear: markdown furniture and table rows are noise when
  // spoken, so they are removed rather than read out as symbols.
  function plain(text) {
    return String(text == null ? '' : text)
      .replace(/```[\s\S]*?```/g, ' ')
      .split('\n')
      .filter(function (line) { return !/^\s*\|/.test(line); })
      .map(function (line) { return line.replace(/^#{1,6}\s*/, '').replace(/^\s*[-*]\s+/, ''); })
      .join('\n')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*_`>]/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\s*\n\s*/g, '。')
      .replace(/。{2,}/g, '。')
      .trim();
  }

  var active = null;

  function stopListening() {
    if (!active) return;
    var current = active;
    active = null;
    try { current.abort ? current.abort() : current.stop(); } catch (_) { /* already closed */ }
  }

  function listen(options) {
    options = options || {};
    if (!Recognition) {
      if (options.onError) options.onError('unsupported');
      return false;
    }
    stopListening();
    var recognition;
    try { recognition = new Recognition(); }
    catch (_) {
      if (options.onError) options.onError('unsupported');
      return false;
    }
    recognition.lang = options.lang || 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    var finalText = '';
    recognition.onresult = function (event) {
      var interim = '';
      for (var i = event.resultIndex; i < event.results.length; i += 1) {
        var result = event.results[i];
        var text = result[0] ? result[0].transcript : '';
        if (result.isFinal) finalText += text;
        else interim += text;
      }
      if (options.onInterim) options.onInterim((finalText + interim).trim(), Boolean(interim));
    };
    recognition.onerror = function (event) {
      active = null;
      if (options.onError) options.onError(event && event.error ? event.error : 'error');
    };
    recognition.onend = function () {
      active = null;
      if (options.onEnd) options.onEnd(finalText.trim());
    };

    try { recognition.start(); }
    catch (_) {
      if (options.onError) options.onError('start-failed');
      return false;
    }
    active = recognition;
    return true;
  }

  var spoken = 0;

  function stopSpeaking() {
    if (!ttsSupported()) return;
    try { synth.cancel(); } catch (_) { /* nothing queued */ }
    spoken = 0;
  }

  function speaking() {
    if (!ttsSupported()) return false;
    try { return synth.speaking || synth.pending; } catch (_) { return false; }
  }

  // Long answers are queued sentence by sentence: some mobile engines truncate a
  // single long utterance, and short chunks also make "stop" feel immediate.
  function speak(text, lang) {
    if (!ttsSupported()) return false;
    var clean = plain(text);
    if (!clean) return false;
    stopSpeaking();
    var chunks = clean.match(/[^。！？!?.;；]{1,80}[。！？!?.;；]?/g) || [clean];
    chunks.forEach(function (chunk) {
      var piece = chunk.trim();
      if (!piece) return;
      var utterance = new window.SpeechSynthesisUtterance(piece);
      utterance.lang = lang || 'zh-CN';
      utterance.rate = 1;
      utterance.pitch = 1;
      synth.speak(utterance);
      spoken += 1;
    });
    return true;
  }

  window.TravelWorldVoice = {
    sttSupported: sttSupported,
    ttsSupported: ttsSupported,
    listen: listen,
    stopListening: stopListening,
    speak: speak,
    stopSpeaking: stopSpeaking,
    speaking: speaking,
    plain: plain
  };
}());
