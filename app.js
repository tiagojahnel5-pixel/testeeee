/* ============================================================
   CABINE DE FOTOS — JavaScript App
   ============================================================ */

'use strict';

// ── State ────────────────────────────────────────────────────
const state = {
  stream: null,
  currentFilter: 'normal',
  currentSticker: 'none',
  captureMode: 1,       // 1, 3, or 4 photos
  captureDelay: 3,      // seconds
  stripColor: '#ffffff',
  stripLabel: '',
  photos: [],           // captured ImageData / dataURLs
  isCapturing: false,
  isMirror: true,
  showGrid: false,
  soundEnabled: true,
  animFrame: null,
};

// ── Filter Definitions ───────────────────────────────────────
const FILTERS = {
  normal:    { css: 'none',                      label: 'Normal' },
  grayscale: { css: 'grayscale(100%)',            label: 'P&B'    },
  sepia:     { css: 'sepia(80%)',                 label: 'Sépia'  },
  invert:    { css: 'invert(100%)',               label: 'Neg.'   },
  warm:      { css: 'sepia(30%) saturate(150%) hue-rotate(-20deg)', label: 'Quente' },
  cool:      { css: 'saturate(120%) hue-rotate(180deg) brightness(1.1)', label: 'Frio' },
  vivid:     { css: 'saturate(200%) contrast(110%)', label: 'Vívido' },
  retro:     { css: 'sepia(60%) contrast(90%) brightness(0.9)', label: 'Retrô' },
};

// ── Sticker Emojis ───────────────────────────────────────────
const STICKERS = {
  none:     [],
  hearts:   ['💕','❤️','💖','💗','💝','💓','♥️','💞'],
  stars:    ['⭐','🌟','✨','💫','🌠','⚡','🔆','💥'],
  sparkles: ['✨','🌟','💫','🔮','🪄','💎','🌈','⚡'],
  rainbow:  ['🌈','☁️','⛅','🌤️','☀️','🌦️','🌥️','🌂'],
  flowers:  ['🌸','🌺','🌻','🌹','🌷','🪷','💐','🌼'],
};

// ── DOM refs ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const video          = $('video');
const canvasLive     = $('canvasLive');
const countdownOverlay = $('countdownOverlay');
const countdownNumber  = $('countdownNumber');
const recordingBadge   = $('recordingBadge');
const cameraOff        = $('cameraOff');
const cameraFrame      = $('cameraFrame');
const flashOverlay     = $('flashOverlay');
const btnCapture       = $('btnCapture');
const captureHint      = $('captureHint');
const stripSection     = $('stripSection');
const canvasStrip      = $('canvasStrip');
const progressDots     = $('progressDots');
const dotsRow          = $('dotsRow');
const btnDownload      = $('btnDownload');
const btnReset         = $('btnReset');
const btnSound         = $('btnSound');
const mirrorToggle     = $('mirrorToggle');
const gridToggle       = $('gridToggle');
const stripLabelInput  = $('stripLabel');

const ctxLive  = canvasLive.getContext('2d');
const ctxStrip = canvasStrip.getContext('2d');

// ── Particles ────────────────────────────────────────────────
function createParticles() {
  const container = $('particles');
  const colors = ['#a855f7','#ec4899','#06b6d4','#f59e0b','#10b981'];
  for (let i = 0; i < 25; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 6 + 2;
    p.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${Math.random() * 100}%;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration: ${Math.random() * 15 + 10}s;
      animation-delay: ${Math.random() * 10}s;
    `;
    container.appendChild(p);
  }
}

// ── Camera ────────────────────────────────────────────────────
async function startCamera() {
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 960 }, facingMode: 'user' },
      audio: false,
    });
    video.srcObject = state.stream;
    await video.play();

    recordingBadge.classList.add('visible');
    cameraOff.classList.add('hidden');
    btnCapture.disabled = false;
    captureHint.textContent = 'Pronto! Clique para tirar foto';

    startLiveCanvas();
  } catch (err) {
    console.error('Camera error:', err);
    captureHint.textContent = '❌ Erro ao acessar câmera';
  }
}

// ── Live canvas loop (apply CSS filter via drawImage) ────────
function startLiveCanvas() {
  function loop() {
    if (!state.stream) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) { state.animFrame = requestAnimationFrame(loop); return; }

    canvasLive.width  = vw;
    canvasLive.height = vh;

    // We actually let the CSS filter on the video element do the work
    // and use the canvas only for drawing sticker overlays.
    ctxLive.clearRect(0, 0, vw, vh);
    drawStickersOnCanvas(ctxLive, vw, vh);

    state.animFrame = requestAnimationFrame(loop);
  }
  state.animFrame = requestAnimationFrame(loop);
}

// Apply filter to video element CSS
function applyVideoFilter(filterKey) {
  video.style.filter = FILTERS[filterKey]?.css || 'none';
}

// ── Sticker drawing ──────────────────────────────────────────
let stickerPositions = [];
let stickerRefresh = 0;

function drawStickersOnCanvas(ctx, w, h) {
  const emojis = STICKERS[state.currentSticker];
  if (!emojis || emojis.length === 0) return;

  const now = Date.now();
  if (now - stickerRefresh > 3000 || stickerPositions.length === 0) {
    stickerPositions = Array.from({ length: 12 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      size: Math.random() * 20 + 16,
      alpha: Math.random() * 0.5 + 0.3,
    }));
    stickerRefresh = now;
  }

  ctx.save();
  for (const s of stickerPositions) {
    ctx.globalAlpha = s.alpha;
    ctx.font = `${s.size}px serif`;
    ctx.fillText(s.emoji, s.x, s.y);
  }
  ctx.restore();
}

// ── Capture photo to dataURL ──────────────────────────────────
function capturePhotoToDataURL() {
  const tmpCanvas = document.createElement('canvas');
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  tmpCanvas.width  = vw;
  tmpCanvas.height = vh;
  const ctx = tmpCanvas.getContext('2d');

  // Mirror
  if (state.isMirror) {
    ctx.translate(vw, 0);
    ctx.scale(-1, 1);
  }

  // Draw video
  ctx.drawImage(video, 0, 0, vw, vh);

  // Apply filter via canvas (manual filter)
  applyCanvasFilter(ctx, vw, vh, state.currentFilter);

  // Reset transform before stickers
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Draw stickers
  const emojis = STICKERS[state.currentSticker];
  if (emojis && emojis.length > 0) {
    for (const s of stickerPositions) {
      const sx = state.isMirror ? vw - s.x : s.x;
      ctx.globalAlpha = s.alpha;
      ctx.font = `${s.size * (vw / canvasLive.width || 1)}px serif`;
      ctx.fillText(s.emoji, sx, s.y * (vh / canvasLive.height || 1));
    }
    ctx.globalAlpha = 1;
  }

  return tmpCanvas.toDataURL('image/jpeg', 0.95);
}

// Apply canvas filter manually (image data manipulation)
function applyCanvasFilter(ctx, w, h, filterKey) {
  if (filterKey === 'normal') return;

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i+1], b = data[i+2];

    switch (filterKey) {
      case 'grayscale': {
        const gray = 0.299*r + 0.587*g + 0.114*b;
        data[i] = data[i+1] = data[i+2] = gray;
        break;
      }
      case 'sepia': {
        data[i]   = Math.min(255, r*0.393 + g*0.769 + b*0.189);
        data[i+1] = Math.min(255, r*0.349 + g*0.686 + b*0.168);
        data[i+2] = Math.min(255, r*0.272 + g*0.534 + b*0.131);
        break;
      }
      case 'invert': {
        data[i] = 255 - r; data[i+1] = 255 - g; data[i+2] = 255 - b;
        break;
      }
      case 'warm': {
        data[i]   = Math.min(255, r * 1.15);
        data[i+1] = Math.min(255, g * 1.0);
        data[i+2] = Math.min(255, b * 0.8);
        break;
      }
      case 'cool': {
        data[i]   = Math.min(255, r * 0.8);
        data[i+1] = Math.min(255, g * 1.0);
        data[i+2] = Math.min(255, b * 1.2);
        break;
      }
      case 'vivid': {
        const gv = 0.299*r + 0.587*g + 0.114*b;
        data[i]   = Math.min(255, gv + (r - gv) * 2.0);
        data[i+1] = Math.min(255, gv + (g - gv) * 2.0);
        data[i+2] = Math.min(255, gv + (b - gv) * 2.0);
        break;
      }
      case 'retro': {
        const gr = 0.299*r + 0.587*g + 0.114*b;
        data[i]   = Math.min(255, gr*0.6 + r*0.4 + 30);
        data[i+1] = Math.min(255, gr*0.6 + g*0.4 + 10);
        data[i+2] = Math.min(255, gr*0.6 + b*0.4 - 10);
        break;
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

// ── Countdown ─────────────────────────────────────────────────
function runCountdown(seconds) {
  return new Promise(resolve => {
    countdownOverlay.classList.add('active');
    let current = seconds;

    const tick = () => {
      countdownNumber.textContent = current;
      // Re-trigger animation
      countdownNumber.style.animation = 'none';
      countdownNumber.offsetHeight; // reflow
      countdownNumber.style.animation = '';

      playBeep();

      if (current <= 0) {
        countdownOverlay.classList.remove('active');
        resolve();
        return;
      }
      current--;
      setTimeout(tick, 1000);
    };

    tick();
  });
}

// ── Flash effect ──────────────────────────────────────────────
function doFlash() {
  flashOverlay.classList.remove('active');
  flashOverlay.offsetHeight;
  flashOverlay.classList.add('active');
  cameraFrame.classList.add('flash-border');
  setTimeout(() => cameraFrame.classList.remove('flash-border'), 300);
}

// ── Sound ─────────────────────────────────────────────────────
function playBeep() {
  if (!state.soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch (_) {}
}

function playShutter() {
  if (!state.soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03));
    }
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.5;
    source.start();
  } catch (_) {}
}

// ── Photo Strip Rendering ─────────────────────────────────────
function renderStrip(photos) {
  const count  = photos.length;
  const IMG_W  = 420;
  const IMG_H  = 315;
  const MARGIN = 16;
  const HEADER = 50;
  const FOOTER = count === 1 ? 60 : 70;
  const PAD    = 20;

  const stripW = IMG_W + PAD * 2;
  const stripH = HEADER + (IMG_H + MARGIN) * count - MARGIN + FOOTER + PAD * 2;

  canvasStrip.width  = stripW;
  canvasStrip.height = stripH;

  // Background
  if (state.stripColor === 'gradient') {
    const grad = ctxStrip.createLinearGradient(0, 0, stripW, stripH);
    grad.addColorStop(0,   '#a855f7');
    grad.addColorStop(0.5, '#ec4899');
    grad.addColorStop(1,   '#06b6d4');
    ctxStrip.fillStyle = grad;
  } else {
    ctxStrip.fillStyle = state.stripColor;
  }
  ctxStrip.fillRect(0, 0, stripW, stripH);

  // Header text
  const isDark = isColorDark(state.stripColor);
  ctxStrip.fillStyle = isDark ? '#ffffff' : '#1a1a2e';
  ctxStrip.font = 'bold 18px Outfit, sans-serif';
  ctxStrip.textAlign = 'center';
  ctxStrip.fillText('📷 Cabine de Fotos', stripW / 2, HEADER - 10);

  // Draw photos
  const loadAndDraw = photos.map((dataURL, idx) => new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const x = PAD;
      const y = HEADER + PAD / 2 + idx * (IMG_H + MARGIN);
      // Rounded rect clip
      ctxStrip.save();
      roundRect(ctxStrip, x, y, IMG_W, IMG_H, 10);
      ctxStrip.clip();
      ctxStrip.drawImage(img, x, y, IMG_W, IMG_H);
      ctxStrip.restore();
      // Border
      ctxStrip.save();
      ctxStrip.strokeStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)';
      ctxStrip.lineWidth = 2;
      roundRect(ctxStrip, x, y, IMG_W, IMG_H, 10);
      ctxStrip.stroke();
      ctxStrip.restore();
      res();
    };
    img.src = dataURL;
  }));

  Promise.all(loadAndDraw).then(() => {
    // Footer
    const footerY = HEADER + PAD / 2 + count * (IMG_H + MARGIN) - MARGIN / 2 + MARGIN;

    ctxStrip.fillStyle = isDark ? '#ffffff' : '#1a1a2e';
    ctxStrip.font = 'bold 14px Outfit, sans-serif';
    ctxStrip.textAlign = 'center';

    const labelText = state.stripLabel || '✨ Sorria! ✨';
    ctxStrip.fillText(labelText, stripW / 2, footerY + 20);

    ctxStrip.font = '11px Outfit, sans-serif';
    ctxStrip.fillStyle = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)';
    const dateStr = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });
    ctxStrip.fillText(dateStr, stripW / 2, footerY + 38);

    stripSection.style.display = '';
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x, y + h - r,      r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y,     x + r, y,              r);
  ctx.closePath();
}

function isColorDark(color) {
  if (color === 'gradient') return true;
  const hex = color.replace('#','');
  const r = parseInt(hex.substr(0,2),16);
  const g = parseInt(hex.substr(2,2),16);
  const b = parseInt(hex.substr(4,2),16);
  return (0.299*r + 0.587*g + 0.114*b) < 128;
}

// ── Capture Session ───────────────────────────────────────────
async function startCaptureSession() {
  if (state.isCapturing || !state.stream) return;
  state.isCapturing = true;
  state.photos = [];
  stripSection.style.display = 'none';

  const total = state.captureMode;
  btnCapture.disabled = true;

  // Show progress dots
  progressDots.style.display = 'flex';
  dotsRow.innerHTML = '';
  const dots = [];
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('div');
    dot.className = 'dot';
    dotsRow.appendChild(dot);
    dots.push(dot);
  }

  cameraFrame.classList.add('active-capture');

  for (let i = 0; i < total; i++) {
    captureHint.textContent = `Foto ${i+1} de ${total} — Prepare-se!`;
    await runCountdown(state.captureDelay);
    doFlash();
    playShutter();
    const dataURL = capturePhotoToDataURL();
    state.photos.push(dataURL);
    dots[i].classList.add('taken');
    if (i < total - 1) {
      captureHint.textContent = 'Próxima foto em breve...';
      await sleep(800);
    }
  }

  cameraFrame.classList.remove('active-capture');
  captureHint.textContent = '✅ Sessão completa! Veja sua tira.';
  renderStrip(state.photos);

  state.isCapturing = false;
  btnCapture.disabled = false;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Download ──────────────────────────────────────────────────
function downloadStrip() {
  const link = document.createElement('a');
  link.download = `cabine-de-fotos-${Date.now()}.png`;
  link.href = canvasStrip.toDataURL('image/png');
  link.click();
}

// ── Reset ─────────────────────────────────────────────────────
function resetSession() {
  state.photos = [];
  stripSection.style.display = 'none';
  progressDots.style.display = 'none';
  captureHint.textContent = 'Pronto! Clique para tirar foto';
}

// ── Event Listeners ───────────────────────────────────────────
$('btnStartCamera').addEventListener('click', startCamera);
btnCapture.addEventListener('click', startCaptureSession);
btnDownload.addEventListener('click', downloadStrip);
btnReset.addEventListener('click', resetSession);

// Sound toggle
btnSound.addEventListener('click', () => {
  state.soundEnabled = !state.soundEnabled;
  btnSound.textContent = state.soundEnabled ? '🔊' : '🔇';
});

// Mirror toggle
mirrorToggle.addEventListener('change', e => {
  state.isMirror = e.target.checked;
  video.classList.toggle('no-mirror', !state.isMirror);
});

// Grid toggle
gridToggle.addEventListener('change', e => {
  state.showGrid = e.target.checked;
  cameraFrame.classList.toggle('show-grid', state.showGrid);
});

// Strip label
stripLabelInput.addEventListener('input', e => {
  state.stripLabel = e.target.value;
  if (state.photos.length > 0) renderStrip(state.photos);
});

// Filters
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.currentFilter = btn.dataset.filter;
    applyVideoFilter(state.currentFilter);
    stickerPositions = []; // refresh sticker positions
  });
});

// Stickers
document.querySelectorAll('.sticker-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sticker-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.currentSticker = btn.dataset.sticker;
    stickerPositions = [];
  });
});

// Mode
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.captureMode = parseInt(btn.dataset.mode, 10);
    resetSession();
  });
});

// Delay
document.querySelectorAll('.delay-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.delay-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.captureDelay = parseInt(btn.dataset.delay, 10);
  });
});

// Color swatches
document.querySelectorAll('.color-swatch').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.stripColor = btn.dataset.color;
    if (state.photos.length > 0) renderStrip(state.photos);
  });
});

// Keyboard shortcut: Space = capture
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !state.isCapturing && state.stream) {
    e.preventDefault();
    startCaptureSession();
  }
});

// ── Init ──────────────────────────────────────────────────────
createParticles();

// Try to auto-start camera
(async () => {
  try {
    await startCamera();
  } catch (_) {
    // Manual start needed
  }
})();
