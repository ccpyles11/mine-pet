(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const now = () => Date.now();
  const STORAGE_KEY = 'cozy-pup-save-v1';

  const ui = {
    petName: document.getElementById('petName'),
    statusLine: document.getElementById('statusLine'),
    coinsText: document.getElementById('coinsText'),
    hungerBar: document.getElementById('hungerBar'),
    happyBar: document.getElementById('happyBar'),
    cleanBar: document.getElementById('cleanBar'),
    energyBar: document.getElementById('energyBar'),
    hungerText: document.getElementById('hungerText'),
    happyText: document.getElementById('happyText'),
    cleanText: document.getElementById('cleanText'),
    energyText: document.getElementById('energyText'),
    toast: document.getElementById('toast'),
  };

  const defaultState = () => ({
    petName: 'Cozy Pup',
    room: 'living',
    hunger: 84,
    happiness: 88,
    cleanliness: 78,
    energy: 82,
    level: 1,
    xp: 0,
    coins: 25,
    lastSaved: now(),
    lastDailyReward: 0,
    unlocked: {
      park: true,
      kitchen: true,
      bathroom: true,
      toyDuck: true,
      redBall: true,
      blueBed: false,
      plant: false,
      starRug: false,
    },
    action: 'idle',
  });

  let state = loadState();
  let pointer = { x: 0, y: 0, down: false };
  let tick = 0;
  let particles = [];
  let floatTexts = [];
  let ball = null;
  let bowlTimer = 0;
  let bathTimer = 0;
  let sleepTimer = 0;
  let soundReady = false;
  let audioCtx = null;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const loaded = raw ? JSON.parse(raw) : defaultState();
      const merged = { ...defaultState(), ...loaded, unlocked: { ...defaultState().unlocked, ...(loaded.unlocked || {}) } };
      applyOfflineProgress(merged);
      return merged;
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    state.lastSaved = now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function applyOfflineProgress(s) {
    const elapsedMin = Math.max(0, (now() - (s.lastSaved || now())) / 60000);
    if (elapsedMin < 1) return;
    s.hunger = clamp(s.hunger - elapsedMin * 0.9);
    s.happiness = clamp(s.happiness - elapsedMin * 0.42 - (s.hunger < 25 ? elapsedMin * 0.25 : 0));
    s.cleanliness = clamp(s.cleanliness - elapsedMin * 0.22);
    s.energy = clamp(s.energy + elapsedMin * 0.65);
  }

  function initAudio() {
    if (soundReady) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    soundReady = true;
  }

  function beep(freq = 440, duration = 0.08, type = 'sine', volume = 0.04) {
    if (!soundReady || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
  }

  function cuteSound() {
    beep(520, .07, 'sine', .035);
    setTimeout(() => beep(720, .08, 'sine', .035), 65);
  }

  function sadSound() {
    beep(240, .12, 'triangle', .035);
    setTimeout(() => beep(180, .16, 'triangle', .025), 95);
  }

  function showToast(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add('show');
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => ui.toast.classList.remove('show'), 1700);
  }

  function status() {
    if (state.hunger < 20) return `${state.petName} is starving. Feed your pup.`;
    if (state.cleanliness < 20) return `${state.petName} needs a bath badly.`;
    if (state.energy < 15) return `${state.petName} is tired. Let them rest.`;
    if (state.happiness < 25) return `${state.petName} needs play time.`;
    if (state.action === 'sleep') return 'Dreaming of treats and belly rubs.';
    if (state.room === 'park') return 'Fresh air, zoomies, and fetch time.';
    if (state.room === 'kitchen') return 'Snack station unlocked.';
    if (state.room === 'bathroom') return 'Bubble bath headquarters.';
    return 'Cozy, safe, and ready to play.';
  }

  function updateUI() {
    ui.petName.textContent = state.petName;
    ui.statusLine.textContent = status();
    ui.coinsText.textContent = state.coins;
    const stats = [
      ['hunger', ui.hungerBar, ui.hungerText],
      ['happiness', ui.happyBar, ui.happyText],
      ['cleanliness', ui.cleanBar, ui.cleanText],
      ['energy', ui.energyBar, ui.energyText],
    ];
    stats.forEach(([key, bar, text]) => {
      const val = Math.round(state[key]);
      bar.style.width = `${val}%`;
      text.textContent = `${val}%`;
    });
    document.querySelectorAll('.roomBtn').forEach(btn => btn.classList.toggle('active', btn.dataset.room === state.room));
  }

  function addXP(amount) {
    state.xp += amount;
    const needed = state.level * 60;
    if (state.xp >= needed) {
      state.xp -= needed;
      state.level += 1;
      state.coins += 20;
      if (state.level >= 2) state.unlocked.blueBed = true;
      if (state.level >= 3) state.unlocked.plant = true;
      if (state.level >= 4) state.unlocked.starRug = true;
      burst(360, 520, 'star', 26);
      showToast(`Level ${state.level}! New cozy rewards unlocked.`);
      cuteSound();
    }
  }

  function doAction(action) {
    initAudio();
    if (action === 'feed') {
      state.room = 'kitchen';
      state.hunger = clamp(state.hunger + 28);
      state.happiness = clamp(state.happiness + 5);
      state.coins = Math.max(0, state.coins - 1);
      state.action = 'eating';
      bowlTimer = 180;
      burst(360, 690, 'heart', 12);
      float('+ food', 360, 610);
      addXP(10);
      showToast(`${state.petName} loved the snack.`);
      cuteSound();
    }
    if (action === 'drink') {
      state.room = 'kitchen';
      state.hunger = clamp(state.hunger + 6);
      state.happiness = clamp(state.happiness + 3);
      state.action = 'drinking';
      bowlTimer = 150;
      burst(430, 720, 'drop', 12);
      float('+ refreshed', 380, 620);
      addXP(6);
      showToast('Hydrated pup, happy pup.');
      cuteSound();
    }
    if (action === 'play') {
      state.room = 'park';
      if (state.energy < 15 || state.hunger < 10) {
        state.action = 'sad';
        showToast(`${state.petName} needs food or rest first.`);
        sadSound();
        return;
      }
      state.happiness = clamp(state.happiness + 24);
      state.energy = clamp(state.energy - 16);
      state.cleanliness = clamp(state.cleanliness - 7);
      state.action = 'playing';
      ball = { x: 120, y: 620, vx: 8.2, vy: -7.5, life: 150 };
      burst(350, 650, 'star', 16);
      float('+ fun', 360, 590);
      addXP(14);
      showToast('Fetch mode activated.');
      cuteSound();
    }
    if (action === 'bath') {
      state.room = 'bathroom';
      state.cleanliness = clamp(state.cleanliness + 36);
      state.happiness = clamp(state.happiness - 2);
      state.action = 'bathing';
      bathTimer = 210;
      burst(360, 640, 'bubble', 34);
      float('+ clean', 360, 560);
      addXP(12);
      showToast('Squeaky clean, slightly dramatic.');
      beep(680, .08, 'sine', .03);
    }
    if (action === 'sleep') {
      state.room = 'living';
      state.energy = clamp(state.energy + 30);
      state.happiness = clamp(state.happiness + 4);
      state.action = 'sleep';
      sleepTimer = 260;
      float('+ rest', 360, 560);
      addXP(8);
      showToast('Rest time. Tiny snores included.');
      beep(360, .18, 'sine', .02);
    }
    saveState();
    updateUI();
  }

  function petMood() {
    if (state.action === 'sleep') return 'sleep';
    if (state.hunger < 18 || state.happiness < 18) return 'sad';
    if (state.cleanliness < 22) return 'dirty';
    if (state.action === 'bathing') return 'grumpy';
    if (state.action === 'playing') return 'excited';
    if (state.action === 'eating' || state.action === 'drinking') return 'happy';
    return 'happy';
  }

  function tapPet() {
    initAudio();
    if (state.action === 'sleep') {
      state.action = 'idle';
      sleepTimer = 0;
      showToast(`${state.petName} woke up for you.`);
    } else if (state.hunger < 15) {
      state.action = 'sad';
      showToast(`${state.petName} taps the bowl. Hungry!`);
      sadSound();
    } else {
      state.happiness = clamp(state.happiness + 2.5);
      state.action = 'tapHappy';
      burst(360, 585, 'heart', 10);
      float('woof!', 360, 520);
      cuteSound();
      setTimeout(() => { if (state.action === 'tapHappy') state.action = 'idle'; }, 800);
    }
    saveState();
    updateUI();
  }

  function float(text, x, y) {
    floatTexts.push({ text, x, y, life: 80 });
  }

  function burst(x, y, type = 'heart', count = 12) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1 + Math.random() * 4;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5, life: 45 + Math.random() * 35, type, size: 8 + Math.random() * 12 });
    }
  }

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawRoom() {
    const room = state.room;
    let wall1 = '#ffe9d7', wall2 = '#fff7ec', floor = '#d9a985';
    if (room === 'kitchen') { wall1 = '#fff0c9'; wall2 = '#eaf8f1'; floor = '#d8b284'; }
    if (room === 'bathroom') { wall1 = '#dff5ff'; wall2 = '#f7fdff'; floor = '#a9d8e9'; }
    if (room === 'park') { wall1 = '#bfe9ff'; wall2 = '#e7fff0'; floor = '#88c778'; }

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, wall1); grad.addColorStop(.48, wall2); grad.addColorStop(.49, floor); grad.addColorStop(1, '#7f563f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    if (room !== 'park') {
      ctx.fillStyle = 'rgba(255,255,255,.32)';
      for (let y = 230; y < 625; y += 72) {
        ctx.fillRect(0, y, W, 4);
      }
      ctx.strokeStyle = 'rgba(95,61,46,.10)'; ctx.lineWidth = 3;
      for (let x = 0; x < W; x += 96) {
        ctx.beginPath(); ctx.moveTo(x, 625); ctx.lineTo(x - 80, H); ctx.stroke();
      }
    }

    if (room === 'living') drawLivingRoom();
    if (room === 'kitchen') drawKitchen();
    if (room === 'bathroom') drawBathroom();
    if (room === 'park') drawPark();
  }

  function drawLivingRoom() {
    ctx.fillStyle = 'rgba(255,255,255,.38)'; roundedRect(255, 195, 210, 130, 26); ctx.fill();
    ctx.fillStyle = '#f5b7a6'; roundedRect(95, 740, 530, 95, 48); ctx.fill();
    ctx.fillStyle = '#f18f7a'; roundedRect(130, 685, 460, 95, 45); ctx.fill();
    ctx.fillStyle = '#fff2d8'; roundedRect(150, 650, 100, 88, 24); ctx.fill(); roundedRect(470, 650, 100, 88, 24); ctx.fill();
    ctx.fillStyle = state.unlocked.starRug ? '#ffd46b' : '#f7d7c4';
    ctx.beginPath(); ctx.ellipse(360, 890, 235, 70, 0, 0, Math.PI * 2); ctx.fill();
    if (state.unlocked.blueBed) {
      ctx.fillStyle = '#8fc7e8'; roundedRect(85, 845, 190, 72, 28); ctx.fill();
      ctx.fillStyle = '#ffffff88'; roundedRect(115, 822, 130, 52, 24); ctx.fill();
    }
    if (state.unlocked.plant) {
      ctx.fillStyle = '#d58b55'; roundedRect(548, 572, 65, 92, 20); ctx.fill();
      ctx.fillStyle = '#5cb779';
      for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(580 + Math.sin(i)*22, 548 - i*8, 18, 46, i*.5, 0, Math.PI*2); ctx.fill(); }
    }
  }

  function drawKitchen() {
    ctx.fillStyle = '#ffffffaa'; roundedRect(70, 238, 580, 205, 36); ctx.fill();
    ctx.fillStyle = '#f3b25f'; roundedRect(95, 330, 150, 95, 18); ctx.fill(); roundedRect(475, 330, 150, 95, 18); ctx.fill();
    ctx.fillStyle = '#fff'; roundedRect(275, 312, 170, 110, 24); ctx.fill();
    ctx.fillStyle = '#bcdbe8'; roundedRect(298, 334, 124, 34, 16); ctx.fill();
    ctx.fillStyle = '#f28f79'; roundedRect(120, 232, 110, 72, 18); ctx.fill(); roundedRect(490, 232, 110, 72, 18); ctx.fill();
    drawBowl(290, 760, '#f28f79', 'FOOD');
    drawBowl(430, 760, '#77bde0', 'WATER');
  }

  function drawBathroom() {
    ctx.fillStyle = '#ffffffa8'; roundedRect(75, 250, 570, 310, 34); ctx.fill();
    ctx.fillStyle = '#a9d8e9'; roundedRect(95, 615, 530, 220, 70); ctx.fill();
    ctx.fillStyle = '#ffffff'; roundedRect(120, 580, 480, 90, 42); ctx.fill();
    ctx.fillStyle = '#bfe3f8'; roundedRect(143, 607, 434, 42, 25); ctx.fill();
    ctx.strokeStyle = '#7fbad0'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(498, 575); ctx.quadraticCurveTo(530, 530, 575, 580); ctx.stroke();
    ctx.fillStyle = '#ffd46b'; ctx.beginPath(); ctx.arc(575, 735, 24, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#f4a33c'; ctx.beginPath(); ctx.moveTo(594,735); ctx.lineTo(624,725); ctx.lineTo(602,748); ctx.fill();
  }

  function drawPark() {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath(); ctx.arc(130, 185, 48, 0, Math.PI*2); ctx.arc(180, 170, 60, 0, Math.PI*2); ctx.arc(235, 190, 45, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffd46b'; ctx.beginPath(); ctx.arc(590, 175, 54, 0, Math.PI*2); ctx.fill();
    for (let i = 0; i < 4; i++) {
      const x = 75 + i * 155;
      ctx.fillStyle = '#7c543d'; roundedRect(x+42, 500, 32, 160, 13); ctx.fill();
      ctx.fillStyle = '#55a96b'; ctx.beginPath(); ctx.arc(x+60, 470, 75, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#6abc7b'; ctx.beginPath(); ctx.arc(x+25, 500, 52, 0, Math.PI*2); ctx.arc(x+100, 500, 52, 0, Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = '#ecd3a4'; roundedRect(120, 818, 480, 62, 30); ctx.fill();
  }

  function drawBowl(x, y, color, label) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, 70, 32, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, x, y+5);
  }

  function drawDog() {
    const mood = petMood();
    const t = tick / 20;
    let x = 360;
    let y = state.room === 'bathroom' && (state.action === 'bathing' || bathTimer > 0) ? 640 : 650;
    if (state.room === 'park' && state.action === 'playing') x += Math.sin(t * 1.8) * 82;
    if (state.action === 'eating') x = lerp(x, 292, .5);
    if (state.action === 'drinking') x = lerp(x, 432, .5);
    const bounce = Math.sin(t) * (state.action === 'playing' ? 14 : 4);
    const scale = 1 + Math.sin(t * 1.7) * 0.012;

    ctx.save();
    ctx.translate(x, y + bounce);
    ctx.scale(scale, scale);

    if (state.action === 'sleep') {
      ctx.rotate(Math.sin(t*.6)*.015);
      drawSleepingDog(mood);
    } else {
      drawStandingDog(mood);
    }
    ctx.restore();

    if (state.cleanliness < 22 && state.action !== 'bathing') drawStink(x, y - 170);
    if (state.action === 'sleep') drawZzz(x + 145, y - 190);
  }

  function drawStandingDog(mood) {
    const wag = Math.sin(tick / 7) * .5;
    ctx.strokeStyle = '#b96e2e'; ctx.lineWidth = 26; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(96, 24); ctx.quadraticCurveTo(145, -25 + wag*30, 105, -90); ctx.stroke();

    ctx.fillStyle = '#d98b3d';
    ctx.beginPath(); ctx.ellipse(0, 52, 118, 130, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#f2b867'; ctx.beginPath(); ctx.ellipse(0, 82, 76, 82, 0, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#b96e2e';
    roundedRect(-76, 132, 38, 86, 18); ctx.fill(); roundedRect(38, 132, 38, 86, 18); ctx.fill();
    ctx.fillStyle = '#7b4a2a'; roundedRect(-81, 203, 52, 22, 12); ctx.fill(); roundedRect(30, 203, 52, 22, 12); ctx.fill();

    ctx.fillStyle = '#d98b3d';
    ctx.beginPath(); ctx.ellipse(0, -95, 102, 94, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#b96e2e';
    ctx.beginPath(); ctx.ellipse(-78, -108, 33, 82, -.55, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(78, -108, 33, 82, .55, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#f4c077'; ctx.beginPath(); ctx.ellipse(0, -64, 58, 42, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#3d271d';
    const blink = Math.sin(tick/58) > .94;
    if (mood === 'sleep' || blink) {
      ctx.lineWidth = 5; ctx.strokeStyle = '#3d271d';
      ctx.beginPath(); ctx.moveTo(-42, -102); ctx.quadraticCurveTo(-28, -94, -13, -102); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(13, -102); ctx.quadraticCurveTo(28, -94, 42, -102); ctx.stroke();
    } else if (mood === 'sad') {
      ctx.beginPath(); ctx.ellipse(-30, -96, 9, 13, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(30, -96, 9, 13, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#3d271d'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-46, -116); ctx.lineTo(-15, -122); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(15, -122); ctx.lineTo(46, -116); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(-31, -101, 11, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(31, -101, 11, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-34, -105, 3, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(28, -105, 3, 0, Math.PI*2); ctx.fill();
    }

    ctx.fillStyle = '#2a1912'; ctx.beginPath(); ctx.ellipse(0, -66, 15, 11, 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#2a1912'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -55); ctx.lineTo(0, -45); ctx.stroke();
    if (mood === 'sad' || mood === 'grumpy') {
      ctx.beginPath(); ctx.arc(0, -32, 22, Math.PI*1.08, Math.PI*1.92); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(0, -48, 30, .25, Math.PI-.25); ctx.stroke();
      ctx.fillStyle = '#f06b75'; ctx.beginPath(); ctx.ellipse(0, -22, 16, 23, 0, 0, Math.PI); ctx.fill();
    }

    if (mood === 'dirty') {
      ctx.fillStyle = 'rgba(87,58,33,.35)';
      ctx.beginPath(); ctx.ellipse(-42, 25, 24, 15, .6, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(48, 80, 18, 12, -.4, 0, Math.PI*2); ctx.fill();
    }
  }

  function drawSleepingDog() {
    ctx.fillStyle = '#d98b3d'; ctx.beginPath(); ctx.ellipse(0, 65, 140, 82, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#f2b867'; ctx.beginPath(); ctx.ellipse(12, 78, 80, 46, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#d98b3d'; ctx.beginPath(); ctx.ellipse(-82, 16, 82, 72, -.2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#b96e2e'; ctx.beginPath(); ctx.ellipse(-133, -2, 28, 62, -.8, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#3d271d'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-108, 0); ctx.quadraticCurveTo(-95, 8, -79, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-51, 0); ctx.quadraticCurveTo(-38, 8, -22, 0); ctx.stroke();
    ctx.fillStyle = '#2a1912'; ctx.beginPath(); ctx.ellipse(-65, 31, 12, 9, 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#b96e2e'; ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(97, 56); ctx.quadraticCurveTo(156, 5, 96, -35); ctx.stroke();
  }

  function drawStink(x, y) {
    ctx.save(); ctx.strokeStyle = 'rgba(87,114,63,.58)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (let i=0; i<3; i++) {
      ctx.beginPath();
      const xx = x - 70 + i * 70;
      ctx.moveTo(xx, y + Math.sin(tick/20+i)*8);
      ctx.bezierCurveTo(xx-20, y-38, xx+20, y-56, xx, y-98);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawZzz(x, y) {
    ctx.save();
    ctx.fillStyle = 'rgba(95,61,46,.62)'; ctx.font = 'bold 42px sans-serif';
    ctx.fillText('Z', x + Math.sin(tick/20)*4, y - (tick%80)*.5);
    ctx.font = 'bold 30px sans-serif'; ctx.fillText('Z', x + 48, y + 35 - (tick%70)*.45);
    ctx.restore();
  }

  function drawBathEffects() {
    if (state.room !== 'bathroom' || bathTimer <= 0) return;
    for (let i=0; i<20; i++) {
      const x = 150 + (i * 29 + tick * 1.1) % 420;
      const y = 610 + Math.sin(tick/10 + i) * 16;
      ctx.fillStyle = 'rgba(255,255,255,.78)'; ctx.beginPath(); ctx.arc(x, y, 12 + (i%4)*4, 0, Math.PI*2); ctx.fill();
    }
  }

  function drawParticles() {
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life--;
      ctx.save(); ctx.globalAlpha = clamp(p.life / 50, 0, 1);
      if (p.type === 'heart') { ctx.fillStyle = '#f06b75'; ctx.font = `${p.size}px sans-serif`; ctx.fillText('♥', p.x, p.y); }
      if (p.type === 'star') { ctx.fillStyle = '#ffd46b'; ctx.font = `${p.size}px sans-serif`; ctx.fillText('★', p.x, p.y); }
      if (p.type === 'bubble') { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x,p.y,p.size/2,0,Math.PI*2); ctx.stroke(); }
      if (p.type === 'drop') { ctx.fillStyle = '#77bde0'; ctx.beginPath(); ctx.ellipse(p.x,p.y,p.size/3,p.size/1.6,0,0,Math.PI*2); ctx.fill(); }
      ctx.restore();
    });

    floatTexts = floatTexts.filter(f => f.life > 0);
    floatTexts.forEach(f => {
      f.y -= .8; f.life--;
      ctx.save(); ctx.globalAlpha = clamp(f.life/80, 0, 1); ctx.fillStyle = '#5f3d2e'; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y); ctx.restore();
    });
  }

  function drawBall() {
    if (!ball) return;
    ball.x += ball.vx; ball.y += ball.vy; ball.vy += .42; ball.life--;
    if (ball.y > 810) { ball.y = 810; ball.vy *= -.68; }
    ctx.fillStyle = '#f36b51'; ctx.beginPath(); ctx.arc(ball.x, ball.y, 28, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(ball.x, ball.y, 18, -1, 1); ctx.stroke();
    if (ball.life <= 0) ball = null;
  }

  function drawForeground() {
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.beginPath(); ctx.ellipse(360, 875, 190, 42, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(95,61,46,.18)';
    ctx.beginPath(); ctx.ellipse(360, 878, 155, 25, 0, 0, Math.PI*2); ctx.fill();
  }

  function updateGameLogic() {
    tick++;
    if (tick % 1800 === 0) {
      state.hunger = clamp(state.hunger - 1);
      state.happiness = clamp(state.happiness - .8 - (state.hunger < 25 ? 1 : 0));
      state.cleanliness = clamp(state.cleanliness - .55);
      if (state.action !== 'sleep') state.energy = clamp(state.energy - .35);
      saveState(); updateUI();
    }
    if (bowlTimer > 0) bowlTimer--; else if (state.action === 'eating' || state.action === 'drinking') state.action = 'idle';
    if (bathTimer > 0) bathTimer--; else if (state.action === 'bathing') state.action = 'idle';
    if (sleepTimer > 0) {
      sleepTimer--;
      if (tick % 80 === 0) state.energy = clamp(state.energy + 2);
    } else if (state.action === 'sleep') state.action = 'idle';
  }

  function draw() {
    updateGameLogic();
    ctx.clearRect(0, 0, W, H);
    drawRoom();
    drawForeground();
    drawBall();
    drawBathEffects();
    drawDog();
    drawParticles();
    requestAnimationFrame(draw);
  }

  function canvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return { x: (touch.clientX - rect.left) / rect.width * W, y: (touch.clientY - rect.top) / rect.height * H };
  }

  canvas.addEventListener('pointerdown', e => {
    pointer = { ...canvasPos(e), down: true };
    const dx = pointer.x - 360;
    const dy = pointer.y - 650;
    if (Math.hypot(dx, dy) < 210) tapPet();
  });

  document.querySelectorAll('.roomBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      initAudio();
      state.room = btn.dataset.room;
      state.action = 'idle';
      showToast(`Entering ${btn.querySelector('small').textContent}.`);
      beep(500, .06, 'sine', .025);
      saveState(); updateUI();
    });
  });

  document.querySelectorAll('.actionBtn').forEach(btn => btn.addEventListener('click', () => doAction(btn.dataset.action)));

  document.getElementById('dailyRewardBtn').addEventListener('click', () => {
    initAudio();
    const oneDay = 24 * 60 * 60 * 1000;
    if (now() - state.lastDailyReward < oneDay) {
      showToast('Daily treat already claimed. Come back tomorrow.');
      sadSound();
      return;
    }
    state.lastDailyReward = now();
    state.coins += 15;
    state.happiness = clamp(state.happiness + 10);
    burst(360, 510, 'star', 35);
    showToast('Daily reward claimed: +15 treats!');
    cuteSound();
    saveState(); updateUI();
  });

  document.getElementById('renameBtn').addEventListener('click', () => {
    const name = prompt('Name your pup:', state.petName);
    if (!name) return;
    state.petName = name.trim().slice(0, 18) || 'Cozy Pup';
    showToast(`Meet ${state.petName}.`);
    saveState(); updateUI();
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!confirm('Reset your virtual pet progress?')) return;
    localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    showToast('Fresh start created.');
    updateUI();
  });

  window.addEventListener('beforeunload', saveState);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveState();
    else { applyOfflineProgress(state); updateUI(); saveState(); }
  });

  updateUI();
  showToast('Tap your pup to interact.');
  draw();
})();
