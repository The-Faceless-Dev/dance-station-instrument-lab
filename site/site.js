const hostOrigin = document.referrer ? new URL(document.referrer).origin : window.location.origin;

const state = {
  assets: [],
  saved: [],
  instruments: [],
  tracks: [createInstrumentTrack("Track 1", "synth.lead", "track-main")],
  activeTrackId: "track-main",
  selectedNoteIds: [],
  selectionMode: false,
  clipboard: [],
  cursorBeat: 0,
  recording: false,
  audioContext: null,
  playingNodes: [],
  timers: [],
  recordingStartedAt: 0,
  heldNotes: new Map(),
  audioBufferCache: new Map(),
  sampleBufferCache: new Map(),
  previewUrl: "",
  drag: null,
  view: {
    beatOffset: 0,
    visibleBeats: 16,
    pitchOffset: 36,
    visiblePitches: 49,
  },
};

const el = {
  status: document.querySelector("#instrumentLabState"),
  bankState: document.querySelector("#instrumentBankState"),
  renderState: document.querySelector("#instrumentRenderState"),
  label: document.querySelector("#instrumentClipLabel"),
  bpm: document.querySelector("#instrumentBpm"),
  key: document.querySelector("#instrumentKey"),
  bars: document.querySelector("#instrumentBars"),
  octave: document.querySelector("#instrumentOctave"),
  trackList: document.querySelector("#instrumentTrackList"),
  assetSelect: document.querySelector("#instrumentAssetSelect"),
  addTrack: document.querySelector("#addInstrumentTrackButton"),
  importAsset: document.querySelector("#importInstrumentAssetButton"),
  activeTrackReadout: document.querySelector("#instrumentActiveTrackReadout"),
  play: document.querySelector("#playInstrumentButton"),
  stop: document.querySelector("#stopInstrumentButton"),
  record: document.querySelector("#recordInstrumentButton"),
  deleteNote: document.querySelector("#deleteInstrumentNoteButton"),
  copyNotes: document.querySelector("#copyInstrumentNotesButton"),
  pasteNotes: document.querySelector("#pasteInstrumentNotesButton"),
  zoomOut: document.querySelector("#pianoRollZoomOutButton"),
  zoomIn: document.querySelector("#pianoRollZoomInButton"),
  fit: document.querySelector("#pianoRollFitButton"),
  viewport: document.querySelector("#pianoRollViewportReadout"),
  canvas: document.querySelector("#instrumentPianoRoll"),
  scroll: document.querySelector("#pianoRollScroll"),
  keys: document.querySelector("#instrumentPianoKeys"),
  patch: document.querySelector("#instrumentPatch"),
  volume: document.querySelector("#instrumentMasterVolume"),
  info: document.querySelector("#instrumentInfo"),
  render: document.querySelector("#renderInstrumentButton"),
  saveTrack: document.querySelector("#saveInstrumentTrackButton"),
  saveClip: document.querySelector("#saveInstrumentButton"),
  preview: document.querySelector("#instrumentPreviewAudio"),
  clipList: document.querySelector("#instrumentClipList"),
  toast: document.querySelector("#toast"),
};

function createInstrumentTrack(label, instrument, id = `track-${crypto.randomUUID()}`) {
  return {
    id,
    label,
    kind: "instrument",
    instrument,
    volume: 0.85,
    muted: false,
    playDuringRecord: true,
    notes: [],
  };
}

function createAudioTrack(asset) {
  return {
    id: `audio-${crypto.randomUUID()}`,
    label: asset.title,
    kind: "audio",
    sourceTitle: asset.title,
    audioUrl: asset.url,
    volume: 0.85,
    muted: false,
    playDuringRecord: true,
    notes: [],
  };
}

function post(type, payload = {}, transfer) {
  window.parent.postMessage({ source: "dance-station-instrument-lab", type, payload }, hostOrigin, transfer || []);
}

window.addEventListener("message", (event) => {
  if (event.origin !== hostOrigin) return;
  const message = event.data || {};
  if (message.source !== "dance-station-host") return;
  if (message.type === "instrument-lab:assets") {
    state.assets = Array.isArray(message.payload?.assets) ? message.payload.assets : [];
    renderAssetOptions();
  }
  if (message.type === "instrument-lab:saved") {
    const item = message.payload?.item;
    if (item) {
      state.saved.unshift(item);
      renderSaved();
      setPill(el.renderState, "Saved", "ok");
      showToast(`${item.title || "Instrument clip"} saved`);
    }
  }
  if (message.type === "instrument-lab:error") {
    showToast(message.payload?.message || "Host adapter error");
    setPill(el.renderState, "Error", "error");
  }
});

function setPill(node, text, tone = "neutral") {
  node.textContent = text;
  node.className = "mini-state";
  node.classList.add(tone);
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("visible");
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => el.toast.classList.remove("visible"), 3200);
}

function activeTrack() {
  return state.tracks.find((track) => track.id === state.activeTrackId) || state.tracks[0] || null;
}

function instrumentDefinition(instrumentId) {
  return state.instruments.find((instrument) => instrument.id === instrumentId) || state.instruments[0] || fallbackInstruments()[0];
}

function fallbackInstruments() {
  return [
    { id: "synth.lead", name: "Lead Synth", category: "Synths", type: "synth", oscillator: "sawtooth", envelope: { attack: 0.01, release: 0.18 }, octave: 0 },
    { id: "bass.synth", name: "Bass Synth", category: "Bass", type: "synth", oscillator: "square", envelope: { attack: 0.005, release: 0.12 }, octave: -12 },
    { id: "keys.soft-pad", name: "Soft Pad", category: "Keys", type: "synth", oscillator: "triangle", envelope: { attack: 0.14, release: 0.45 }, octave: 0 },
  ];
}

async function loadInstrumentBank() {
  try {
    const response = await fetch("../standalone-source/instruments/bank.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`Instrument bank ${response.status}`);
    const body = await response.json();
    state.instruments = Array.isArray(body.instruments) ? body.instruments : fallbackInstruments();
    setPill(el.bankState, `${state.instruments.length} loaded`, "ok");
  } catch (error) {
    state.instruments = fallbackInstruments();
    setPill(el.bankState, "Fallback", "warn");
  }
  renderInstrumentOptions();
}

function renderInstrumentOptions() {
  const current = el.patch.value || activeTrack()?.instrument || "synth.lead";
  el.patch.innerHTML = "";
  const groups = new Map();
  state.instruments.forEach((instrument) => {
    const group = instrument.category || "Instruments";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(instrument);
  });
  groups.forEach((items, label) => {
    const group = document.createElement("optgroup");
    group.label = label;
    items.forEach((instrument) => {
      const option = document.createElement("option");
      option.value = instrument.id;
      option.textContent = instrument.name;
      group.appendChild(option);
    });
    el.patch.appendChild(group);
  });
  el.patch.value = state.instruments.some((instrument) => instrument.id === current) ? current : state.instruments[0]?.id || "";
  updateInstrumentInfo();
}

function updateInstrumentInfo() {
  const instrument = instrumentDefinition(el.patch.value || activeTrack()?.instrument);
  el.info.textContent = `${instrument.name}\n${instrument.category || "Instrument"} / ${instrument.type || "synth"}`;
}

function renderAssetOptions() {
  el.assetSelect.innerHTML = '<option value="">Choose an existing creation</option>';
  state.assets.forEach((asset) => {
    const option = document.createElement("option");
    option.value = asset.id;
    option.textContent = `${asset.title} (${asset.kind || "audio"})`;
    el.assetSelect.appendChild(option);
  });
}

function renderTracks() {
  el.trackList.innerHTML = "";
  state.tracks.forEach((track) => {
    const row = document.createElement("div");
    row.className = `instrument-track-item${track.id === state.activeTrackId ? " active" : ""}`;
    row.innerHTML = `
      <div class="track-head">
        <button class="secondary-button" type="button">${escapeHtml(track.label)}</button>
      </div>
      <label class="field"><span>Name</span><input class="track-label" value="${escapeHtml(track.label)}" /></label>
      <label class="field"><span>Volume</span><input class="track-volume" type="range" min="0" max="1" step="0.05" value="${track.volume}" /></label>
      <div class="track-toggles">
        <label><input class="track-muted" type="checkbox"${track.muted ? " checked" : ""} /> Mute</label>
        <label><input class="track-record" type="checkbox"${track.playDuringRecord ? " checked" : ""} /> Play while recording</label>
      </div>
    `;
    row.querySelector("button").addEventListener("click", () => {
      state.activeTrackId = track.id;
      if (track.kind === "instrument") el.patch.value = track.instrument;
      renderTracks();
      draw();
    });
    row.querySelector(".track-label").addEventListener("input", (event) => {
      track.label = event.target.value;
      updateReadout();
    });
    row.querySelector(".track-volume").addEventListener("input", (event) => {
      track.volume = Number(event.target.value || 0.85);
    });
    row.querySelector(".track-muted").addEventListener("change", (event) => {
      track.muted = event.target.checked;
    });
    row.querySelector(".track-record").addEventListener("change", (event) => {
      track.playDuringRecord = event.target.checked;
    });
    el.trackList.appendChild(row);
  });
  updateReadout();
}

function updateReadout() {
  const track = activeTrack();
  el.activeTrackReadout.textContent = track ? `${track.label} / ${track.kind === "audio" ? "audio track" : "instrument track"}` : "No track selected";
}

function renderPianoKeys() {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B", "C"];
  el.keys.innerHTML = "";
  names.forEach((name, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `piano-key ${[1, 3, 6, 8, 10].includes(index % 12) ? "black" : "white"}`;
    button.textContent = name;
    button.addEventListener("pointerdown", () => playKeyboardPitch((Number(el.octave.value) + 1) * 12 + index));
    el.keys.appendChild(button);
  });
}

function allNotes() {
  return state.tracks.flatMap((track) => track.kind === "instrument" ? track.notes : []);
}

function contentBounds() {
  const barsBeats = Math.max(4, Number(el.bars.value || 4) * 4);
  const noteEnd = Math.max(0, ...allNotes().map((note) => note.start + note.duration));
  const audioEnd = state.tracks.some((track) => track.kind === "audio") ? barsBeats : 0;
  const cursorEnd = Math.max(0, state.cursorBeat || 0) + 2;
  const totalBeats = Math.max(barsBeats, noteEnd + 2, audioEnd, cursorEnd);
  const pitches = allNotes().map((note) => note.pitch);
  const minPitch = Math.max(0, Math.min(36, ...pitches));
  const maxPitch = Math.min(96, Math.max(84, ...pitches));
  return { totalBeats, minPitch, maxPitch };
}

function clampView() {
  const bounds = contentBounds();
  state.view.visibleBeats = Math.max(1, Math.min(state.view.visibleBeats, bounds.totalBeats));
  state.view.beatOffset = Math.max(0, Math.min(state.view.beatOffset, Math.max(0, bounds.totalBeats - state.view.visibleBeats)));
  state.view.visiblePitches = Math.max(12, Math.min(state.view.visiblePitches, 72));
  state.view.pitchOffset = Math.max(0, Math.min(state.view.pitchOffset, 127 - state.view.visiblePitches));
  const max = Math.max(0, bounds.totalBeats - state.view.visibleBeats);
  el.scroll.max = String(max);
  el.scroll.value = String(Math.min(max, state.view.beatOffset));
  el.scroll.disabled = max <= 0;
  el.viewport.textContent = `Beats ${state.view.beatOffset.toFixed(1)}-${(state.view.beatOffset + state.view.visibleBeats).toFixed(1)} | MIDI ${state.view.pitchOffset}-${state.view.pitchOffset + state.view.visiblePitches}`;
}

function keepCursorInView() {
  const margin = Math.max(0.5, state.view.visibleBeats * 0.12);
  const start = state.view.beatOffset;
  const end = state.view.beatOffset + state.view.visibleBeats;
  if (state.cursorBeat < start + margin) {
    state.view.beatOffset = Math.max(0, state.cursorBeat - margin);
  } else if (state.cursorBeat > end - margin) {
    state.view.beatOffset = Math.max(0, state.cursorBeat - state.view.visibleBeats + margin);
  }
}

function metrics() {
  const rect = el.canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(rect.width * scale));
  const height = Math.max(260, Math.floor(rect.height * scale));
  if (el.canvas.width !== width || el.canvas.height !== height) {
    el.canvas.width = width;
    el.canvas.height = height;
  }
  return { width, height, scale, padLeft: 46 * scale, padRight: 14 * scale, padTop: 12 * scale, padBottom: 24 * scale };
}

function beatToX(beat, m) {
  return m.padLeft + ((beat - state.view.beatOffset) / state.view.visibleBeats) * (m.width - m.padLeft - m.padRight);
}

function pitchToY(pitch, m) {
  return m.padTop + ((state.view.pitchOffset + state.view.visiblePitches - pitch - 1) / state.view.visiblePitches) * (m.height - m.padTop - m.padBottom);
}

function canvasToBeat(x, m) {
  return state.view.beatOffset + ((x - m.padLeft) / (m.width - m.padLeft - m.padRight)) * state.view.visibleBeats;
}

function canvasToPitch(y, m) {
  return Math.round(state.view.pitchOffset + state.view.visiblePitches - 1 - ((y - m.padTop) / (m.height - m.padTop - m.padBottom)) * state.view.visiblePitches);
}

function draw() {
  clampView();
  const m = metrics();
  const ctx = el.canvas.getContext("2d");
  ctx.clearRect(0, 0, m.width, m.height);
  ctx.fillStyle = "#070b10";
  ctx.fillRect(0, 0, m.width, m.height);
  ctx.strokeStyle = "#18222d";
  ctx.lineWidth = 1;
  for (let beat = Math.floor(state.view.beatOffset); beat <= state.view.beatOffset + state.view.visibleBeats; beat += 1) {
    const x = beatToX(beat, m);
    ctx.strokeStyle = beat % 4 === 0 ? "#2c3b48" : "#18222d";
    ctx.beginPath();
    ctx.moveTo(x, m.padTop);
    ctx.lineTo(x, m.height - m.padBottom);
    ctx.stroke();
  }
  for (let pitch = state.view.pitchOffset; pitch <= state.view.pitchOffset + state.view.visiblePitches; pitch += 1) {
    const y = pitchToY(pitch, m);
    ctx.strokeStyle = pitch % 12 === 0 ? "#27313c" : "#121b24";
    ctx.beginPath();
    ctx.moveTo(m.padLeft, y);
    ctx.lineTo(m.width - m.padRight, y);
    ctx.stroke();
  }
  ctx.font = `${11 * m.scale}px sans-serif`;
  ctx.fillStyle = "#91a1b2";
  for (let pitch = state.view.pitchOffset; pitch <= state.view.pitchOffset + state.view.visiblePitches; pitch += 12) {
    ctx.fillText(midiLabel(pitch), 8 * m.scale, pitchToY(pitch, m) + 4 * m.scale);
  }
  state.tracks.forEach((track) => {
    if (track.kind !== "instrument") return;
    track.notes.forEach((note) => drawNote(ctx, m, note, track.id === state.activeTrackId));
  });
  const cursorX = beatToX(state.cursorBeat, m);
  ctx.strokeStyle = state.selectionMode ? "#83a7ff" : "#36d1b7";
  ctx.lineWidth = 2 * m.scale;
  ctx.beginPath();
  ctx.moveTo(cursorX, m.padTop);
  ctx.lineTo(cursorX, m.height - m.padBottom);
  ctx.stroke();
  ctx.fillStyle = state.selectionMode ? "#83a7ff" : "#36d1b7";
  ctx.fillRect(cursorX - 5 * m.scale, m.padTop, 10 * m.scale, 8 * m.scale);
  if (state.drag?.mode === "select") {
    drawSelectionRange(ctx, m, state.drag.startBeat, state.drag.currentBeat);
  }
}

function drawNote(ctx, m, note, active) {
  const x = beatToX(note.start, m);
  const y = pitchToY(note.pitch, m) - 5 * m.scale;
  const width = Math.max(6 * m.scale, (note.duration / state.view.visibleBeats) * (m.width - m.padLeft - m.padRight));
  const height = 8 * m.scale;
  const selected = state.selectedNoteIds.includes(note.id);
  ctx.fillStyle = selected ? "#83a7ff" : active ? "#36d1b7" : "#607080";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = "#07100f";
  ctx.fillRect(x + width - 3 * m.scale, y, 3 * m.scale, height);
}

function noteAt(point, m) {
  const track = activeTrack();
  if (!track || track.kind !== "instrument") return null;
  return [...track.notes].reverse().find((note) => {
    const x = beatToX(note.start, m);
    const y = pitchToY(note.pitch, m) - 6 * m.scale;
    const width = Math.max(6 * m.scale, (note.duration / state.view.visibleBeats) * (m.width - m.padLeft - m.padRight));
    return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + 12 * m.scale;
  }) || null;
}

function pointerPoint(event) {
  const rect = el.canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  return { x: (event.clientX - rect.left) * scale, y: (event.clientY - rect.top) * scale };
}

function cursorHit(point, m) {
  const cursorX = beatToX(state.cursorBeat, m);
  return Math.abs(point.x - cursorX) <= 8 * m.scale
    && point.y >= m.padTop
    && point.y <= m.height - m.padBottom;
}

function updateRangeSelection(startBeat, endBeat) {
  const track = activeTrack();
  if (!track || track.kind !== "instrument") return;
  const start = Math.min(startBeat, endBeat);
  const end = Math.max(startBeat, endBeat);
  state.selectedNoteIds = track.notes
    .filter((note) => note.start <= end && note.start + note.duration >= start)
    .map((note) => note.id);
}

function clearSelectionMode() {
  state.selectionMode = false;
  state.selectedNoteIds = [];
  setPill(el.status, "Ready", "neutral");
}

function drawSelectionRange(ctx, m, startBeat, endBeat) {
  const startX = beatToX(Math.min(startBeat, endBeat), m);
  const endX = beatToX(Math.max(startBeat, endBeat), m);
  ctx.fillStyle = "rgba(131, 167, 255, 0.12)";
  ctx.fillRect(startX, m.padTop, Math.max(2 * m.scale, endX - startX), m.height - m.padTop - m.padBottom);
  ctx.strokeStyle = "rgba(131, 167, 255, 0.75)";
  ctx.strokeRect(startX, m.padTop, Math.max(2 * m.scale, endX - startX), m.height - m.padTop - m.padBottom);
}

function beginEdit(event) {
  event.preventDefault();
  el.canvas.setPointerCapture?.(event.pointerId);
  let track = activeTrack();
  const m = metrics();
  const point = pointerPoint(event);
  if (cursorHit(point, m)) {
    state.drag = { mode: "cursor" };
    return;
  }
  if (!track || track.kind !== "instrument") {
    const instrumentTrack = state.tracks.find((candidate) => candidate.kind === "instrument");
    if (!instrumentTrack) return;
    state.activeTrackId = instrumentTrack.id;
    track = instrumentTrack;
    renderTracks();
  }
  const note = noteAt(point, m);
  if (state.selectionMode) {
    const beat = quantize(canvasToBeat(point.x, m));
    if (note && state.selectedNoteIds.includes(note.id)) {
      const noteEnd = beatToX(note.start + note.duration, m);
      state.drag = {
        mode: Math.abs(point.x - noteEnd) < 8 * m.scale ? "resize" : "move",
        note,
        startBeat: canvasToBeat(point.x, m),
        startPitch: canvasToPitch(point.y, m),
        originalStart: note.start,
        originalDuration: note.duration,
        originalPitch: note.pitch,
      };
      return;
    }
    if (!note && state.selectedNoteIds.length) {
      clearSelectionMode();
      draw();
      return;
    }
    if (note) {
      state.selectedNoteIds = [note.id];
      const noteEnd = beatToX(note.start + note.duration, m);
      state.drag = {
        mode: Math.abs(point.x - noteEnd) < 8 * m.scale ? "resize" : "move",
        note,
        startBeat: canvasToBeat(point.x, m),
        startPitch: canvasToPitch(point.y, m),
        originalStart: note.start,
        originalDuration: note.duration,
        originalPitch: note.pitch,
      };
      return;
    }
    const endBeat = note ? note.start + note.duration : beat;
    state.drag = { mode: "select", startBeat: state.cursorBeat, currentBeat: endBeat };
    updateRangeSelection(state.cursorBeat, endBeat);
    draw();
    return;
  }
  if (event.shiftKey) {
    const beat = quantize(canvasToBeat(point.x, m));
    state.drag = { mode: "select", startBeat: state.cursorBeat, currentBeat: beat };
    updateRangeSelection(state.cursorBeat, beat);
    draw();
    return;
  }
  if (note) {
    if (!state.selectedNoteIds.includes(note.id)) state.selectedNoteIds = [note.id];
    const noteEnd = beatToX(note.start + note.duration, m);
    state.drag = {
      mode: Math.abs(point.x - noteEnd) < 8 * m.scale ? "resize" : "move",
      note,
      startBeat: canvasToBeat(point.x, m),
      startPitch: canvasToPitch(point.y, m),
      originalStart: note.start,
      originalDuration: note.duration,
      originalPitch: note.pitch,
    };
  } else {
    const beat = quantize(canvasToBeat(point.x, m));
    const pitch = Math.max(0, Math.min(127, canvasToPitch(point.y, m)));
    state.cursorBeat = beat;
    const newNote = { id: crypto.randomUUID(), pitch, start: beat, duration: 1, velocity: 0.82 };
    track.notes.push(newNote);
    state.selectedNoteIds = [newNote.id];
    state.drag = { mode: "resize", note: newNote, startBeat: beat, startPitch: pitch, originalStart: beat, originalDuration: 1, originalPitch: pitch };
  }
  draw();
}

function moveEdit(event) {
  if (!state.drag) return;
  event.preventDefault();
  const m = metrics();
  const point = pointerPoint(event);
  const beat = quantize(canvasToBeat(point.x, m));
  const pitch = Math.max(0, Math.min(127, canvasToPitch(point.y, m)));
  if (state.drag.mode === "cursor") {
    state.cursorBeat = Math.max(0, Math.min(contentBounds().totalBeats, beat));
    draw();
    return;
  }
  const track = activeTrack();
  if (!track || track.kind !== "instrument") return;
  if (state.drag.mode === "move") {
    const deltaBeat = beat - state.drag.startBeat;
    const deltaPitch = pitch - state.drag.startPitch;
    track.notes.forEach((note) => {
      if (!state.selectedNoteIds.includes(note.id)) return;
      note.start = Math.max(0, quantize(note.start === state.drag.originalStart ? state.drag.originalStart + deltaBeat : note.start + deltaBeat));
      note.pitch = Math.max(0, Math.min(127, note.pitch === state.drag.originalPitch ? state.drag.originalPitch + deltaPitch : note.pitch + deltaPitch));
    });
    state.drag.startBeat = beat;
    state.drag.startPitch = pitch;
  }
  if (state.drag.mode === "resize") {
    state.drag.note.duration = Math.max(0.25, quantize(beat - state.drag.note.start));
  }
  if (state.drag.mode === "select") {
    state.drag.currentBeat = beat;
    updateRangeSelection(state.drag.startBeat, beat);
  }
  draw();
}

function endEdit(event) {
  if (state.drag) el.canvas.releasePointerCapture?.(event?.pointerId);
  state.drag = null;
}

function handleWheel(event) {
  event.preventDefault();
  if (event.ctrlKey || event.metaKey) {
    zoom(event.deltaY > 0 ? 1.2 : 0.82);
  } else {
    state.view.beatOffset += event.deltaY > 0 ? 1 : -1;
    draw();
  }
}

function handleDoubleClick(event) {
  const m = metrics();
  const point = pointerPoint(event);
  if (!cursorHit(point, m)) return;
  event.preventDefault();
  state.selectionMode = true;
  state.selectedNoteIds = [];
  setPill(el.status, "Select range", "warn");
  draw();
}

function zoom(factor) {
  const center = state.view.beatOffset + state.view.visibleBeats / 2;
  state.view.visibleBeats = Math.max(1, Math.min(contentBounds().totalBeats, state.view.visibleBeats * factor));
  state.view.beatOffset = center - state.view.visibleBeats / 2;
  draw();
}

function fitAll() {
  const bounds = contentBounds();
  state.view.beatOffset = 0;
  state.view.visibleBeats = bounds.totalBeats;
  state.view.pitchOffset = bounds.minPitch;
  state.view.visiblePitches = bounds.maxPitch - bounds.minPitch + 1;
  draw();
}

function deleteSelected() {
  const track = activeTrack();
  if (!track || track.kind !== "instrument") return;
  track.notes = track.notes.filter((note) => !state.selectedNoteIds.includes(note.id));
  state.selectedNoteIds = [];
  state.selectionMode = false;
  draw();
}

function copySelected() {
  const track = activeTrack();
  if (!track || track.kind !== "instrument") return;
  const notes = track.notes.filter((note) => state.selectedNoteIds.includes(note.id));
  const start = Math.min(...notes.map((note) => note.start));
  state.clipboard = notes.map((note) => ({ ...note, id: "", start: note.start - start }));
  showToast(`${notes.length} note${notes.length === 1 ? "" : "s"} copied`);
}

function pasteNotes() {
  const track = activeTrack();
  if (!track || track.kind !== "instrument" || !state.clipboard.length) return;
  const pasted = state.clipboard.map((note) => ({ ...note, id: crypto.randomUUID(), start: quantize(state.cursorBeat + note.start) }));
  track.notes.push(...pasted);
  state.selectedNoteIds = pasted.map((note) => note.id);
  draw();
}

async function ensureContext() {
  if (!state.audioContext || state.audioContext.state === "closed") state.audioContext = new AudioContext();
  await state.audioContext.resume();
  return state.audioContext;
}

async function play() {
  await stop();
  const playable = state.tracks.filter((track) => !track.muted && (track.kind === "audio" || track.notes.length));
  if (!playable.length) return showToast("Add or import a track first");
  const context = await ensureContext();
  const startAt = context.currentTime + 0.05;
  await scheduleTracks(context, context.destination, playable, startAt, false);
  state.transportStartTime = startAt;
  state.transportStartBeat = state.cursorBeat;
  setPill(el.status, "Playing", "ok");
  const timer = window.setInterval(() => {
    state.cursorBeat = state.transportStartBeat + Math.max(0, context.currentTime - startAt) / beatSeconds();
    keepCursorInView();
    draw();
  }, 33);
  state.timers.push(timer);
}

async function record() {
  if (state.recording) return stop();
  await stop();
  setPill(el.status, "Starts in 2", "warn");
  const first = window.setTimeout(() => setPill(el.status, "Starts in 1", "warn"), 1000);
  const second = window.setTimeout(async () => {
    const context = await ensureContext();
    const startAt = context.currentTime + 0.05;
    await scheduleTracks(context, context.destination, state.tracks.filter((track) => !track.muted && track.playDuringRecord), startAt, true);
    state.recording = true;
    state.recordingStartedAt = performance.now();
    state.transportStartBeat = state.cursorBeat;
    setPill(el.status, "Recording", "warn");
    const timer = window.setInterval(() => {
      state.cursorBeat = state.transportStartBeat + ((performance.now() - state.recordingStartedAt) / 1000) / beatSeconds();
      keepCursorInView();
      draw();
    }, 33);
    state.timers.push(timer);
  }, 2000);
  state.timers.push(first, second);
}

async function stop() {
  state.timers.forEach((timer) => {
    window.clearTimeout(timer);
    window.clearInterval(timer);
  });
  state.timers = [];
  state.playingNodes.forEach((node) => {
    try { node.stop(); } catch {}
    try { node.disconnect(); } catch {}
  });
  state.playingNodes = [];
  state.heldNotes.clear();
  state.recording = false;
  if (state.audioContext && state.audioContext.state !== "closed") {
    await state.audioContext.close().catch(() => {});
  }
  state.audioContext = null;
  setPill(el.status, "Ready", "neutral");
  draw();
}

async function scheduleTracks(context, destination, tracks, startAt, recordingPass) {
  for (const track of tracks) {
    if (recordingPass && track.kind === "instrument" && track.id === state.activeTrackId) continue;
    if (track.kind === "audio") {
      const buffer = await loadAudioBuffer(context, track.audioUrl);
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = track.volume;
      source.connect(gain).connect(destination);
      const offsetSeconds = Math.max(0, state.cursorBeat * beatSeconds());
      if (offsetSeconds < buffer.duration) {
        source.start(startAt, offsetSeconds);
      }
      state.playingNodes.push(source);
    } else {
      for (const note of track.notes) {
        if (note.start + note.duration < state.cursorBeat) continue;
        const shifted = { ...note, start: Math.max(0, note.start - state.cursorBeat) };
        const node = await scheduleNote(context, destination, shifted, track, startAt);
        state.playingNodes.push(node);
      }
    }
  }
}

async function scheduleNote(context, destination, note, track, offsetSeconds = 0) {
  const instrument = instrumentDefinition(track.instrument);
  if (instrument.type === "sample") {
    return scheduleSampleNote(context, destination, note, track, instrument, offsetSeconds);
  }
  const start = offsetSeconds + note.start * beatSeconds();
  const duration = Math.max(0.05, note.duration * beatSeconds());
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = instrument.oscillator || "sawtooth";
  oscillator.frequency.setValueAtTime(midiFrequency(note.pitch + Number(instrument.octave || 0)), start);
  const envelope = instrument.envelope || {};
  const attack = Number(envelope.attack ?? 0.01);
  const release = Number(envelope.release ?? 0.18);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(note.velocity * track.volume, start + attack);
  gain.gain.setValueAtTime(note.velocity * track.volume, start + Math.max(attack, duration - release));
  gain.gain.linearRampToValueAtTime(0, start + duration + release);
  oscillator.connect(gain).connect(destination);
  oscillator.start(start);
  oscillator.stop(start + duration + release + 0.05);
  return oscillator;
}

async function scheduleSampleNote(context, destination, note, track, instrument, offsetSeconds) {
  const region = (instrument.samples || []).find((sample) => note.pitch >= sample.low && note.pitch <= sample.high) || instrument.samples?.[0];
  if (!region) return scheduleNote(context, destination, note, { ...track, instrument: "synth.lead" }, offsetSeconds);
  const buffer = await loadSampleBuffer(context, region.path);
  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  source.playbackRate.value = Math.pow(2, (note.pitch - Number(region.root || region.note || 60)) / 12);
  gain.gain.value = note.velocity * track.volume;
  source.connect(gain).connect(destination);
  source.start(offsetSeconds + note.start * beatSeconds());
  source.stop(offsetSeconds + (note.start + note.duration) * beatSeconds() + 0.1);
  return source;
}

async function loadSampleBuffer(context, path) {
  const url = `../standalone-source/instruments/${path}`;
  if (state.sampleBufferCache.has(url)) return state.sampleBufferCache.get(url);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load sample: ${path}`);
  const buffer = await context.decodeAudioData(await response.arrayBuffer());
  state.sampleBufferCache.set(url, buffer);
  return buffer;
}

async function loadAudioBuffer(context, url) {
  if (state.audioBufferCache.has(url)) return state.audioBufferCache.get(url);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load audio: ${response.status}`);
  const buffer = await context.decodeAudioData(await response.arrayBuffer());
  state.audioBufferCache.set(url, buffer);
  return buffer;
}

async function renderWav(tracks) {
  const renderable = tracks.filter((track) => !track.muted && (track.kind === "audio" || track.notes.length));
  if (!renderable.length) throw new Error("Add or import a track first");
  const duration = Math.max(Number(el.bars.value || 4) * 4 * beatSeconds(), ...renderable.flatMap((track) => (
    track.kind === "instrument" ? track.notes.map((note) => (note.start + note.duration) * beatSeconds() + 0.5) : [Number(el.bars.value || 4) * 4 * beatSeconds()]
  )));
  const sampleRate = 44100;
  const context = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
  const master = context.createGain();
  master.gain.value = Number(el.volume.value || 0.8);
  master.connect(context.destination);
  const previousCursor = state.cursorBeat;
  state.cursorBeat = 0;
  await scheduleTracks(context, master, renderable, 0, false);
  state.cursorBeat = previousCursor;
  const buffer = await context.startRendering();
  return audioBufferToWav(buffer);
}

async function renderPreview() {
  try {
    setPill(el.renderState, "Rendering", "warn");
    const wav = await renderWav(state.tracks);
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
    el.preview.src = state.previewUrl;
    setPill(el.renderState, "Rendered", "ok");
    return wav;
  } catch (error) {
    setPill(el.renderState, "Error", "error");
    showToast(error.message);
    return null;
  }
}

async function save(trackOnly = false) {
  try {
    setPill(el.renderState, "Saving", "warn");
    const active = activeTrack();
    const tracks = trackOnly && active ? [{ ...active, muted: false }] : state.tracks;
    const wav = await renderWav(tracks);
    const label = trackOnly && active ? active.label : el.label.value || "Instrument idea";
    post("instrument-lab:save", {
      name: `${safeStem(label)}.wav`,
      title: label,
      kind: trackOnly ? "instrumenttrack" : "instrument",
      mimeType: "audio/wav",
      bpm: Number(el.bpm.value || 120),
      key: el.key.value || "",
      bars: Number(el.bars.value || 4),
      tracks: tracks.map(serializeTrack),
      audio: wav,
    }, [wav]);
  } catch (error) {
    setPill(el.renderState, "Error", "error");
    showToast(error.message);
  }
}

function serializeTrack(track) {
  return track.kind === "instrument"
    ? { ...track, notes: track.notes.map((note) => ({ ...note })) }
    : { id: track.id, label: track.label, kind: track.kind, sourceTitle: track.sourceTitle, muted: track.muted, playDuringRecord: track.playDuringRecord, volume: track.volume };
}

async function playKeyboardPitch(pitch) {
  const track = activeTrack();
  if (!track || track.kind !== "instrument") return;
  const context = await ensureContext();
  const start = state.recording ? state.transportStartBeat + ((performance.now() - state.recordingStartedAt) / 1000) / beatSeconds() : state.cursorBeat;
  const note = { id: crypto.randomUUID(), pitch, start: quantize(start), duration: 0.5, velocity: 0.82 };
  await scheduleNote(context, context.destination, { ...note, start: 0 }, track, context.currentTime + 0.01);
  if (state.recording) {
    track.notes.push(note);
    draw();
  }
}

function handleKeydown(event) {
  if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName || "")) return;
  const map = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12 };
  const key = event.key.toLowerCase();
  if (key === "backspace" || key === "delete") {
    event.preventDefault();
    deleteSelected();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && key === "c") {
    event.preventDefault();
    copySelected();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && key === "v") {
    event.preventDefault();
    pasteNotes();
    return;
  }
  if (!(key in map)) return;
  event.preventDefault();
  playKeyboardPitch((Number(el.octave.value) + 1) * 12 + map[key]).catch((error) => showToast(error.message));
}

function importAssetTrack() {
  const asset = state.assets.find((item) => item.id === el.assetSelect.value);
  if (!asset?.url) return showToast("Choose an audio asset first");
  const track = createAudioTrack(asset);
  state.tracks.push(track);
  state.activeTrackId = track.id;
  renderTracks();
  draw();
}

function audioBufferToWav(buffer) {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const samples = buffer.length;
  const dataSize = samples * channels * 2;
  const wav = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wav);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let index = 0; index < samples; index += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[index]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return wav;
}

function writeAscii(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}

function beatSeconds() {
  return 60 / Math.max(20, Number(el.bpm.value || 120));
}

function midiFrequency(pitch) {
  return 440 * Math.pow(2, (pitch - 69) / 12);
}

function midiLabel(pitch) {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${names[((pitch % 12) + 12) % 12]}${Math.floor(pitch / 12) - 1}`;
}

function quantize(value) {
  return Math.max(0, Math.round(value * 4) / 4);
}

function safeStem(value) {
  return String(value || "instrument").trim().replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "") || "instrument";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function renderSaved() {
  if (!state.saved.length) {
    el.clipList.innerHTML = '<div class="empty-result">No instrument clips saved yet.</div>';
    return;
  }
  el.clipList.innerHTML = state.saved.map((item) => `
    <div class="generated-item">
      <strong>${escapeHtml(item.title || "Instrument clip")}</strong>
      <span>${escapeHtml(item.kind || "instrument")}</span>
    </div>
  `).join("");
}

el.addTrack.addEventListener("click", () => {
  const count = state.tracks.filter((track) => track.kind === "instrument").length + 1;
  const track = createInstrumentTrack(`Track ${count}`, el.patch.value || "synth.lead");
  state.tracks.push(track);
  state.activeTrackId = track.id;
  renderTracks();
  draw();
});
el.importAsset.addEventListener("click", importAssetTrack);
el.play.addEventListener("click", () => play().catch((error) => showToast(error.message)));
el.stop.addEventListener("click", () => stop().catch(() => {}));
el.record.addEventListener("click", () => record().catch((error) => showToast(error.message)));
el.deleteNote.addEventListener("click", deleteSelected);
el.copyNotes.addEventListener("click", copySelected);
el.pasteNotes.addEventListener("click", pasteNotes);
el.render.addEventListener("click", () => renderPreview());
el.saveTrack.addEventListener("click", () => save(true));
el.saveClip.addEventListener("click", () => save(false));
el.patch.addEventListener("change", () => {
  const track = activeTrack();
  if (track?.kind === "instrument") track.instrument = el.patch.value;
  updateInstrumentInfo();
  renderTracks();
});
el.octave.addEventListener("change", renderPianoKeys);
el.bars.addEventListener("change", draw);
el.scroll.addEventListener("input", () => {
  state.view.beatOffset = Number(el.scroll.value || 0);
  draw();
});
el.zoomOut.addEventListener("click", () => zoom(1.25));
el.zoomIn.addEventListener("click", () => zoom(0.8));
el.fit.addEventListener("click", fitAll);
el.canvas.addEventListener("pointerdown", beginEdit);
el.canvas.addEventListener("pointermove", moveEdit);
el.canvas.addEventListener("dblclick", handleDoubleClick);
el.canvas.addEventListener("wheel", handleWheel, { passive: false });
window.addEventListener("pointerup", endEdit);
window.addEventListener("keydown", handleKeydown);
window.addEventListener("resize", draw);

await loadInstrumentBank();
renderTracks();
renderPianoKeys();
draw();
post("instrument-lab:ready");
post("instrument-lab:request-assets");
