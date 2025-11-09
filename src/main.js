// doublePen/src/main.js
// Main application bootstrap: DOM wiring, canvas resizing, controls,
// and stubbed physics module import. This file is an ES module and is
// meant to be loaded from index.html as <script type="module">.
//
// Behavior summary:
// - Resizes canvases to match CSS size * devicePixelRatio.
// - Wires Play / Pause / Reset controls, settings form, and presets.
// - Dynamically attempts to import `./physics/doublePendulum.js`
//   and uses it when available; otherwise falls back to a simple stub.
// - Runs a fixed-step physics integrator (RK4 when provided) and
//   renders the simulation and a simple graph area.
//
// Notes:
// - This file purposefully keeps physics code separate; implement
//   `derivatives(state, params)` and `rk4Step(state, params, dt)` in
//   `src/physics/doublePendulum.js` (suggested API).
// - The simulation canvas is centered on the page; the UI layout is
//   provided by index.html and CSS.

'use strict';

let canvasSim = null;
let ctxSim = null;
let canvasGraph = null;
let ctxGraph = null;
let dpr = Math.max(1, window.devicePixelRatio || 1);

// DOM elements
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const settingsForm = document.getElementById('settingsForm');
const presetSmallBtn = document.getElementById('presetSmall');
const presetChaoticBtn = document.getElementById('presetChaotic');

let physicsModule = null; // will hold the imported physics module (if available)

// Simulation control
let running = false;
let lastTime = null;
let accumulator = 0;

// Default parameters (kept in SI-like units where lengths are pixels for rendering)
const defaultParams = {
  m1: 1.0,
  m2: 1.0,
  l1: 150, // px
  l2: 150, // px
  g: 9.81,
  drag: 0.0,
  dt: 0.0041667 // seconds (approx 240 Hz steps)
};

// State vector: [theta1, omega1, theta2, omega2]
let state = [Math.PI / 2 - 0.2, 0.0, Math.PI / 2 + 0.1, 0.0];

// For graphing: simple ring buffer of trailing angle2 positions
const graphBuffer = {
  capacity: 2000,
  data: new Float32Array(2000),
  writeIndex: 0,
  length: 0
};

function pushGraphSample(v) {
  graphBuffer.data[graphBuffer.writeIndex] = v;
  graphBuffer.writeIndex = (graphBuffer.writeIndex + 1) % graphBuffer.capacity;
  if (graphBuffer.length < graphBuffer.capacity) graphBuffer.length++;
}

function readSettings() {
  const fd = new FormData(settingsForm);
  const params = {};
  for (const [k, v] of fd.entries()) {
    // parse numbers; keep fallback to defaults
    const num = Number(v);
    params[k] = Number.isFinite(num) ? num : defaultParams[k];
  }
  // Fill missing with defaults
  for (const k of Object.keys(defaultParams)) {
    if (!(k in params) || Number.isNaN(params[k])) params[k] = defaultParams[k];
  }
  return params;
}

function applySettingsToForm(params) {
  for (const key of Object.keys(params)) {
    const input = settingsForm.elements.namedItem(key);
    if (input) input.value = params[key];
  }
}

function applyPresetSmall() {
  // Small angles near vertical; useful for validating small-angle behavior
  state = [Math.PI / 2 - 0.05, 0, Math.PI / 2 + 0.03, 0];
  applySettingsToForm({
    m1: 1.0,
    m2: 1.0,
    l1: 150,
    l2: 150,
    g: 9.81,
    drag: 0.0,
    dt: 0.0041667
  });
  clearGraph();
}

function applyPresetChaotic() {
  // More energetic initial conditions
  state = [Math.PI / 2 - 0.7, 0.0, Math.PI / 2 + 0.2, 0.0];
  applySettingsToForm({
    m1: 1.0,
    m2: 1.5,
    l1: 150,
    l2: 120,
    g: 9.81,
    drag: 0.001,
    dt: 0.0041667
  });
  clearGraph();
}

function clearGraph() {
  graphBuffer.writeIndex = 0;
  graphBuffer.length = 0;
  graphBuffer.data.fill(0);
}

function tryLoadPhysics() {
  // Dynamically import physics module if it exists. If import fails,
  // physicsModule remains null and the file uses a fallback integrator.
  import('./physics/doublePendulum.js')
    .then(mod => {
      physicsModule = mod;
      console.info('Physics module loaded:', mod);
    })
    .catch(err => {
      physicsModule = null;
      console.warn('Physics module could not be loaded; using fallback stub.', err);
    });
}

// --- Canvas sizing helpers ---
function resizeCanvasToDisplaySize(canvas) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    // Style size remains CSS-managed (width/height), so no changes there
    return true;
  }
  return false;
}

function resizeCanvases() {
  dpr = Math.max(1, window.devicePixelRatio || 1);
  resizeCanvasToDisplaySize(canvasSim);
  resizeCanvasToDisplaySize(canvasGraph);
  // Re-establish 2D contexts' scale so drawing units are in CSS pixels
  ctxSim.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctxGraph.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// --- Physics stepping ---
// Prefer physicsModule.rk4Step if available; otherwise fallback.
function physicsStep(currentState, params, dt) {
  if (physicsModule && typeof physicsModule.rk4Step === 'function') {
    try {
      return physicsModule.rk4Step(currentState, params, dt);
    } catch (e) {
      console.warn('physicsModule.rk4Step threw; falling back.', e);
    }
  }
  // Fallback simple stub: weakly coupled pendulums using small-angle linearization
  // This is NOT physically accurate for general cases, but allows UI to function.
  // state = [t1, w1, t2, w2]
  const [t1, w1, t2, w2] = currentState;
  // simple spring-like coupling
  const k = 0.5; // coupling strength
  const g = params.g ?? 9.81;
  const l1 = params.l1 ?? 150;
  const l2 = params.l2 ?? 150;
  const m1 = params.m1 ?? 1;
  const m2 = params.m2 ?? 1;
  const drag = params.drag ?? 0.0;
  // linearized accelerations (very approximate)
  const a1 = -(g / l1) * (t1 - Math.PI / 2) - k * (t1 - t2) - drag * w1;
  const a2 = -(g / l2) * (t2 - Math.PI / 2) - k * (t2 - t1) - drag * w2;
  // simple semi-implicit Euler step for fallback
  const newW1 = w1 + a1 * dt;
  const newT1 = t1 + newW1 * dt;
  const newW2 = w2 + a2 * dt;
  const newT2 = t2 + newW2 * dt;
  return [newT1, newW1, newT2, newW2];
}

// --- Rendering ---
function clearSim() {
  const cssWidth = canvasSim.clientWidth;
  const cssHeight = canvasSim.clientHeight;
  ctxSim.clearRect(0, 0, cssWidth, cssHeight);
}

function drawSim(currentState, params) {
  // Draw double pendulum centered in canvasSim
  const cssW = canvasSim.clientWidth;
  const cssH = canvasSim.clientHeight;
  const cx = cssW / 2;
  const cy = cssH / 4; // pivot slightly above center
  clearSim();

  // Background grid (subtle)
  ctxSim.save();
  ctxSim.globalAlpha = 0.06;
  ctxSim.fillStyle = '#000';
  ctxSim.fillRect(0, 0, cssW, cssH);
  ctxSim.restore();

  // unpack state
  const [t1, w1, t2, w2] = currentState;
  const l1 = params.l1;
  const l2 = params.l2;
  // Convert angles (we store angles from vertical so compute positions)
  const x1 = cx + l1 * Math.sin(t1);
  const y1 = cy + l1 * Math.cos(t1);
  const x2 = x1 + l2 * Math.sin(t2);
  const y2 = y1 + l2 * Math.cos(t2);

  // Draw rods
  ctxSim.lineWidth = 3;
  ctxSim.strokeStyle = '#9fb4c7';
  ctxSim.beginPath();
  ctxSim.moveTo(cx, cy);
  ctxSim.lineTo(x1, y1);
  ctxSim.lineTo(x2, y2);
  ctxSim.stroke();

  // Draw pivots / masses
  ctxSim.fillStyle = '#e6eef3';
  ctxSim.beginPath();
  ctxSim.arc(cx, cy, 6, 0, Math.PI * 2); // pivot
  ctxSim.fill();

  // mass 1
  ctxSim.fillStyle = '#3ddc84';
  ctxSim.beginPath();
  ctxSim.arc(x1, y1, Math.max(6, Math.sqrt(Math.max(1, params.m1)) * 6), 0, Math.PI * 2);
  ctxSim.fill();

  // mass 2
  ctxSim.fillStyle = '#0284c7';
  ctxSim.beginPath();
  ctxSim.arc(x2, y2, Math.max(6, Math.sqrt(Math.max(1, params.m2)) * 6), 0, Math.PI * 2);
  ctxSim.fill();

  // trail for second mass (using graphBuffer recent samples as simple trail)
  ctxSim.save();
  ctxSim.globalAlpha = 0.9;
  ctxSim.lineWidth = 2;
  ctxSim.strokeStyle = 'rgba(61,220,132,0.6)';
  ctxSim.beginPath();
  const trailLen = Math.min(120, graphBuffer.length);
  for (let i = 0; i < trailLen; i++) {
    // sample earlier states by looking back in buffer (we stored angle2)
    const idx = (graphBuffer.writeIndex - 1 - i + graphBuffer.capacity) % graphBuffer.capacity;
    const ang = graphBuffer.data[idx];
    const tx = cx + l1 * Math.sin(state[0]) + l2 * Math.sin(ang);
    const ty = cy + l1 * Math.cos(state[0]) + l2 * Math.cos(ang);
    if (i === 0) ctxSim.moveTo(tx, ty);
    else ctxSim.lineTo(tx, ty);
  }
  ctxSim.stroke();
  ctxSim.restore();

  // HUD readout
  ctxSim.fillStyle = 'rgba(0,0,0,0.4)';
  ctxSim.fillRect(10, 10, 170, 70);
  ctxSim.fillStyle = '#dff0ff';
  ctxSim.font = '12px sans-serif';
  ctxSim.fillText(`θ1: ${t1.toFixed(3)}`, 18, 30);
  ctxSim.fillText(`ω1: ${w1.toFixed(3)}`, 18, 46);
  ctxSim.fillText(`θ2: ${t2.toFixed(3)}`, 18, 62);
}

function drawGraph() {
  // Very simple graph: plot theta2 over time (most recent to the right)
  const cssW = canvasGraph.clientWidth;
  const cssH = canvasGraph.clientHeight;
  ctxGraph.clearRect(0, 0, cssW, cssH);

  // Background
  ctxGraph.fillStyle = 'rgba(0,0,0,0.04)';
  ctxGraph.fillRect(0, 0, cssW, cssH);

  const len = graphBuffer.length;
  if (len < 2) return;
  ctxGraph.strokeStyle = '#f6a623';
  ctxGraph.lineWidth = 1.5;
  ctxGraph.beginPath();
  // We'll draw newest samples to the right
  const samplesToDraw = Math.min(len, cssW);
  for (let i = 0; i < samplesToDraw; i++) {
    // read sample starting from oldest
    const age = samplesToDraw - 1 - i; // 0 = newest
    const idx = (graphBuffer.writeIndex - 1 - age + graphBuffer.capacity) % graphBuffer.capacity;
    const v = graphBuffer.data[idx];
    // Map angle range [-pi, pi] to vertical pixels
    const vy = ((v + Math.PI) / (2 * Math.PI)) * cssH;
    const vx = (i / (samplesToDraw - 1)) * cssW;
    if (i === 0) ctxGraph.moveTo(vx, vy);
    else ctxGraph.lineTo(vx, vy);
  }
  ctxGraph.stroke();

  // axis
  ctxGraph.strokeStyle = 'rgba(255,255,255,0.06)';
  ctxGraph.beginPath();
  ctxGraph.moveTo(0, cssH / 2);
  ctxGraph.lineTo(cssW, cssH / 2);
  ctxGraph.stroke();
}

// --- Main loop ---
function stepFrame(now) {
  if (!lastTime) lastTime = now;
  const elapsed = (now - lastTime) / 1000; // seconds
  lastTime = now;

  const params = readSettings();
  accumulator += elapsed;

  // Clamp accumulator to avoid spiral of death
  const maxAcc = 0.25;
  if (accumulator > maxAcc) accumulator = maxAcc;

  const dt = params.dt;

  // Advance simulation in fixed dt steps
  while (accumulator >= dt) {
    state = physicsStep(state, params, dt);
    accumulator -= dt;

    // store angle2 for graph/trail
    pushGraphSample(state[2]);
  }

  // Render
  drawSim(state, params);
  drawGraph();

  if (running) requestAnimationFrame(stepFrame);
  else lastTime = null;
}

// --- Control handlers ---
function startSimulation() {
  if (running) return;
  running = true;
  lastTime = null;
  requestAnimationFrame(stepFrame);
}

function pauseSimulation() {
  running = false;
}

function resetSimulation() {
  // Reset to small-angle preset by default
  applyPresetSmall();
  clearGraph();
  // redraw once
  resizeCanvases();
  drawSim(state, readSettings());
  drawGraph();
}

// --- Setup & initialization ---
function attachEventListeners() {
  playBtn.addEventListener('click', () => {
    startSimulation();
  });

  pauseBtn.addEventListener('click', () => {
    pauseSimulation();
  });

  resetBtn.addEventListener('click', () => {
    resetSimulation();
  });

  presetSmallBtn.addEventListener('click', () => {
    applyPresetSmall();
    // one immediate render
    drawSim(state, readSettings());
    drawGraph();
  });

  presetChaoticBtn.addEventListener('click', () => {
    applyPresetChaotic();
    drawSim(state, readSettings());
    drawGraph();
  });

  // Simple live update of parameters: when settings change, we update immediately.
  settingsForm.addEventListener('input', () => {
    // No special action needed; readSettings() reads live values.
  });

  // Window/resizing
  window.addEventListener('resize', () => {
    resizeCanvases();
    drawSim(state, readSettings());
    drawGraph();
  });

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
      // space toggles play/pause
      e.preventDefault();
      if (running) pauseSimulation();
      else startSimulation();
    } else if (e.key === 'r') {
      resetSimulation();
    }
  });
}

function initCanvasReferences() {
  canvasSim = document.getElementById('simCanvas');
  canvasGraph = document.getElementById('graphCanvas');
  if (!canvasSim || !canvasGraph) {
    throw new Error('Could not find canvases in DOM: ensure #simCanvas and #graphCanvas exist.');
  }
  ctxSim = canvasSim.getContext('2d', { alpha: true });
  ctxGraph = canvasGraph.getContext('2d', { alpha: true });
  // initial resize
  resizeCanvases();
}

// Initialize app
function init() {
  tryLoadPhysics();
  initCanvasReferences();
  attachEventListeners();
  applyPresetSmall(); // initial state
  clearGraph();
  // initial draw
  drawSim(state, readSettings());
  drawGraph();
  // start paused; user can press Play
  running = false;
}

// Run init on module load
init();

// Expose some helpers to window for debugging (optional)
window.doublePen = {
  start: startSimulation,
  pause: pauseSimulation,
  reset: resetSimulation,
  readSettings,
  state,
  setState(s) {
    if (Array.isArray(s) && s.length === 4) state = s.slice();
  }
};
