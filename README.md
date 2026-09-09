# DJ Mixes Studio

A two-deck, in-browser DJ mixer for playing and blending music at live events — built on the Web Audio API. No installs, no accounts, no uploads.

## Features

- Two independent decks (A / B), each with play/pause, cue-to-start, a seekable progress bar, volume, and a tempo slider
- Equal-power crossfader to blend between decks, with quick "Cut to A / Center / Cut to B" buttons, plus a master volume
- Live level-meter visualizer per deck (Canvas + AnalyserNode)
- A track library: drag-and-drop or browse for local audio files, then load any track into either deck

Everything runs client-side. Audio files are read from local `File` objects via object URLs and never leave the browser tab — nothing is uploaded or stored anywhere.

## Running it

Open `index.html` directly in a browser, or serve the folder:

```bash
node serve.js
```

then visit `http://localhost:8643`.

## Notes

- Playback requires one user click (browser autoplay policy) — press Play to start audio.
- The tempo slider changes pitch slightly along with speed (like a real turntable), since it's a simple playback-rate control rather than full time-stretching.
- Nothing persists between page loads — reload clears loaded tracks, so load them fresh before an event.
- Only play music you have the rights to play.
