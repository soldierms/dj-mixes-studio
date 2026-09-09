// DJ Mixes Studio — a two-deck, in-browser mixer built on the Web Audio API.
// Everything runs client-side: audio files are read from local File objects
// via object URLs and never leave the browser tab.
document.addEventListener("DOMContentLoaded", function () {
  var dropZone = document.getElementById("dropZone");
  var fileInput = document.getElementById("fileInput");
  var browseBtn = document.getElementById("browseBtn");
  var libraryList = document.getElementById("libraryList");
  var libraryEmpty = document.getElementById("libraryEmpty");
  var crossfader = document.getElementById("crossfader");
  var masterVolInput = document.getElementById("masterVol");

  if (!dropZone || !window.AudioContext && !window.webkitAudioContext) return;

  var AudioContextClass = window.AudioContext || window.webkitAudioContext;
  var audioCtx = null;
  var masterGain = null;

  function ensureAudioGraph() {
    if (audioCtx) {
      if (audioCtx.state === "suspended") audioCtx.resume();
      return;
    }
    audioCtx = new AudioContextClass();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = Number(masterVolInput.value) / 100;
    masterGain.connect(audioCtx.destination);
  }

  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) seconds = 0;
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  // ---- Deck ----
  function createDeck(id) {
    var upper = id.toUpperCase();
    var deck = {
      id: id,
      audio: document.getElementById("audio" + upper),
      trackName: document.getElementById("trackName" + upper),
      curTime: document.getElementById("curTime" + upper),
      durTime: document.getElementById("durTime" + upper),
      seek: document.getElementById("seek" + upper),
      playBtn: document.getElementById("play" + upper),
      cueBtn: document.getElementById("cue" + upper),
      volInput: document.getElementById("vol" + upper),
      tempoInput: document.getElementById("tempo" + upper),
      tempoVal: document.getElementById("tempoVal" + upper),
      canvas: document.getElementById("meter" + upper),
      objectUrl: null,
      seeking: false,
      connected: false,
      gainNode: null,
      crossGain: null,
      analyser: null,
      dataArray: null,
    };

    deck.audio.addEventListener("loadedmetadata", function () {
      deck.durTime.textContent = formatTime(deck.audio.duration);
      deck.seek.disabled = false;
      deck.playBtn.disabled = false;
      deck.cueBtn.disabled = false;
    });

    deck.audio.addEventListener("timeupdate", function () {
      if (deck.seeking) return;
      deck.curTime.textContent = formatTime(deck.audio.currentTime);
      if (deck.audio.duration) {
        deck.seek.value = Math.round((deck.audio.currentTime / deck.audio.duration) * 1000);
      }
    });

    deck.audio.addEventListener("ended", function () {
      setPlayingIcon(deck, false);
    });

    deck.seek.addEventListener("input", function () {
      deck.seeking = true;
      if (deck.audio.duration) {
        deck.curTime.textContent = formatTime((deck.seek.value / 1000) * deck.audio.duration);
      }
    });
    deck.seek.addEventListener("change", function () {
      if (deck.audio.duration) {
        deck.audio.currentTime = (deck.seek.value / 1000) * deck.audio.duration;
      }
      deck.seeking = false;
    });

    deck.playBtn.addEventListener("click", function () {
      ensureAudioGraph();
      connectDeckToGraph(deck);
      if (deck.audio.paused) {
        deck.audio.play();
        setPlayingIcon(deck, true);
      } else {
        deck.audio.pause();
        setPlayingIcon(deck, false);
      }
    });

    deck.cueBtn.addEventListener("click", function () {
      deck.audio.pause();
      deck.audio.currentTime = 0;
      setPlayingIcon(deck, false);
    });

    deck.volInput.addEventListener("input", function () {
      if (deck.gainNode) deck.gainNode.gain.value = Number(deck.volInput.value) / 100;
    });

    deck.tempoInput.addEventListener("input", function () {
      var rate = Number(deck.tempoInput.value) / 100;
      deck.audio.playbackRate = rate;
      deck.tempoVal.textContent = deck.tempoInput.value + "%";
    });

    return deck;
  }

  function setPlayingIcon(deck, isPlaying) {
    var playIcon = deck.playBtn.querySelector(".icon-play");
    var pauseIcon = deck.playBtn.querySelector(".icon-pause");
    playIcon.hidden = isPlaying;
    pauseIcon.hidden = !isPlaying;
    deck.playBtn.setAttribute("aria-label", (isPlaying ? "Pause" : "Play") + " Deck " + deck.id.toUpperCase());
  }

  // Web Audio nodes are created lazily, on first play, so the AudioContext
  // is only ever built after a user gesture (required by browser autoplay
  // policy) and each <audio> element gets exactly one MediaElementSource.
  function connectDeckToGraph(deck) {
    if (deck.connected) return;
    var source = audioCtx.createMediaElementSource(deck.audio);
    deck.gainNode = audioCtx.createGain();
    deck.gainNode.gain.value = Number(deck.volInput.value) / 100;
    deck.crossGain = audioCtx.createGain();
    deck.analyser = audioCtx.createAnalyser();
    deck.analyser.fftSize = 64;
    deck.dataArray = new Uint8Array(deck.analyser.frequencyBinCount);

    source.connect(deck.gainNode);
    deck.gainNode.connect(deck.crossGain);
    deck.crossGain.connect(deck.analyser);
    deck.analyser.connect(masterGain);
    deck.connected = true;
    applyCrossfade();
  }

  function loadTrackIntoDeck(deck, file) {
    if (deck.objectUrl) URL.revokeObjectURL(deck.objectUrl);
    deck.objectUrl = URL.createObjectURL(file);
    deck.audio.pause();
    deck.audio.src = deck.objectUrl;
    deck.audio.load();
    deck.trackName.textContent = file.name;
    deck.curTime.textContent = "0:00";
    deck.durTime.textContent = "0:00";
    deck.seek.value = 0;
    setPlayingIcon(deck, false);
  }

  var deckA = createDeck("a");
  var deckB = createDeck("b");
  var decks = { a: deckA, b: deckB };

  // ---- Crossfader (equal-power curve) ----
  function applyCrossfade() {
    var x = Number(crossfader.value) / 100;
    var gainA = Math.cos(x * Math.PI * 0.5);
    var gainB = Math.sin(x * Math.PI * 0.5);
    if (deckA.crossGain) deckA.crossGain.gain.value = gainA;
    if (deckB.crossGain) deckB.crossGain.gain.value = gainB;
  }
  crossfader.addEventListener("input", applyCrossfade);

  document.querySelectorAll("[data-cross]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      crossfader.value = btn.getAttribute("data-cross");
      applyCrossfade();
    });
  });

  masterVolInput.addEventListener("input", function () {
    if (masterGain) masterGain.gain.value = Number(masterVolInput.value) / 100;
  });

  // ---- Level meters (shared animation loop) ----
  var METER_COLOR = { a: "168, 85, 247", b: "34, 211, 238" };

  function drawMeter(deck) {
    var ctx = deck.canvas.getContext("2d");
    var w = deck.canvas.width;
    var h = deck.canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (!deck.analyser) return;
    deck.analyser.getByteFrequencyData(deck.dataArray);
    var barCount = deck.dataArray.length;
    var barWidth = w / barCount;
    for (var i = 0; i < barCount; i++) {
      var value = deck.dataArray[i] / 255;
      var barHeight = value * h;
      ctx.fillStyle = "rgba(" + METER_COLOR[deck.id] + ", " + (0.45 + value * 0.55) + ")";
      ctx.fillRect(i * barWidth, h - barHeight, barWidth - 2, barHeight);
    }
  }

  function animateMeters() {
    drawMeter(deckA);
    drawMeter(deckB);
    requestAnimationFrame(animateMeters);
  }
  requestAnimationFrame(animateMeters);

  // ---- Library ----
  function addFilesToLibrary(files) {
    Array.prototype.forEach.call(files, function (file) {
      if (file.type && file.type.indexOf("audio") !== 0) return;
      libraryEmpty.style.display = "none";

      var item = document.createElement("li");
      item.className = "library-item";

      var info = document.createElement("div");
      info.className = "lib-info";
      var name = document.createElement("span");
      name.className = "lib-name";
      name.textContent = file.name;
      var dur = document.createElement("span");
      dur.className = "lib-dur";
      dur.textContent = "";
      info.appendChild(name);
      info.appendChild(dur);

      var actions = document.createElement("div");
      actions.className = "lib-actions";
      var loadA = document.createElement("button");
      loadA.type = "button";
      loadA.className = "btn-card";
      loadA.textContent = "Load A";
      loadA.addEventListener("click", function () { loadTrackIntoDeck(decks.a, file); });
      var loadB = document.createElement("button");
      loadB.type = "button";
      loadB.className = "btn-card";
      loadB.textContent = "Load B";
      loadB.addEventListener("click", function () { loadTrackIntoDeck(decks.b, file); });
      actions.appendChild(loadA);
      actions.appendChild(loadB);

      item.appendChild(info);
      item.appendChild(actions);
      libraryList.appendChild(item);

      // Read duration for display only, via a throwaway audio element.
      var probe = new Audio();
      probe.preload = "metadata";
      probe.src = URL.createObjectURL(file);
      probe.addEventListener("loadedmetadata", function () {
        dur.textContent = formatTime(probe.duration);
        URL.revokeObjectURL(probe.src);
      });
    });
  }

  browseBtn.addEventListener("click", function () { fileInput.click(); });
  dropZone.addEventListener("click", function () { fileInput.click(); });
  dropZone.addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput.click();
    }
  });
  fileInput.addEventListener("change", function () {
    addFilesToLibrary(fileInput.files);
    fileInput.value = "";
  });

  ["dragenter", "dragover"].forEach(function (evt) {
    dropZone.addEventListener(evt, function (e) {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach(function (evt) {
    dropZone.addEventListener(evt, function (e) {
      e.preventDefault();
      dropZone.classList.remove("dragover");
    });
  });
  dropZone.addEventListener("drop", function (e) {
    if (e.dataTransfer && e.dataTransfer.files) addFilesToLibrary(e.dataTransfer.files);
  });
});
