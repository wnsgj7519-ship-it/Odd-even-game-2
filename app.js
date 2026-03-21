
const GAME_TIME = 30;
const PASS_SCORE = 20;
const BASE_DURATION = 3;
const MIN_DURATION = 0.5;

const state = {
  selected: null,
  stage: 1,
  score: 0,
  timeLeft: GAME_TIME,
  visibleDuration: BASE_DURATION,
  running: false,
  spawnTimer: null,
  tickTimer: null,
  bubbleTimers: new Map(),
  audioCtx: null,
  musicController: null,
  deferredPrompt: null,
};

const screens = {
  start: document.getElementById('startScreen'),
  game: document.getElementById('gameScreen'),
  result: document.getElementById('resultScreen'),
};

const el = {
  choiceBtns: [...document.querySelectorAll('.choice-btn')],
  selectedText: document.getElementById('selectedText'),
  startBtn: document.getElementById('startBtn'),
  installBtn: document.getElementById('installBtn'),
  arena: document.getElementById('arena'),
  messageBar: document.getElementById('messageBar'),
  hudChoice: document.getElementById('hudChoice'),
  hudStage: document.getElementById('hudStage'),
  hudScore: document.getElementById('hudScore'),
  hudTime: document.getElementById('hudTime'),
  hudDuration: document.getElementById('hudDuration'),
  resultTitle: document.getElementById('resultTitle'),
  resultText: document.getElementById('resultText'),
  resultStage: document.getElementById('resultStage'),
  resultScore: document.getElementById('resultScore'),
  resultNextDuration: document.getElementById('resultNextDuration'),
  nextStageBtn: document.getElementById('nextStageBtn'),
  retryBtn: document.getElementById('retryBtn'),
  homeBtn: document.getElementById('homeBtn'),
};

function showScreen(name) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  screens[name].classList.add('active');
}

function updateHUD() {
  el.hudChoice.textContent = state.selected === 'odd' ? '홀수' : state.selected === 'even' ? '짝수' : '-';
  el.hudStage.textContent = String(state.stage);
  el.hudScore.textContent = String(state.score);
  el.hudTime.textContent = String(state.timeLeft);
  el.hudDuration.textContent = `${state.visibleDuration.toFixed(1)}초`;
}

function setMessage(text, kind = 'warn') {
  el.messageBar.textContent = text;
  el.messageBar.classList.remove('good', 'bad');
  if (kind === 'good') el.messageBar.classList.add('good');
  if (kind === 'bad') el.messageBar.classList.add('bad');
}

function chooseSelection(choice) {
  state.selected = choice;
  el.choiceBtns.forEach(btn => btn.classList.toggle('selected', btn.dataset.choice === choice));
  el.selectedText.textContent = `선택: ${choice === 'odd' ? '홀수' : '짝수'}`;
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function prepareAudio() {
  if (!state.audioCtx) state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
}

function beep(freq, duration, type = 'sine', gainLevel = 0.04, delay = 0) {
  if (!state.audioCtx) return;
  const ctx = state.audioCtx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(gainLevel, ctx.currentTime + delay + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration + 0.02);
}

function playCorrectSound() {
  beep(740, 0.11, 'triangle', 0.05, 0);
  beep(988, 0.13, 'triangle', 0.04, 0.08);
}

function playWrongSound() {
  beep(250, 0.18, 'sawtooth', 0.05, 0);
  beep(180, 0.2, 'sawtooth', 0.04, 0.07);
}

function stopMusic() {
  if (state.musicController) state.musicController.stop();
  state.musicController = null;
}

function playStageMusic(stage) {
  if (!state.audioCtx) return;
  stopMusic();

  const ctx = state.audioCtx;
  const gain = ctx.createGain();
  gain.gain.value = 0.028;
  gain.connect(ctx.destination);

  const patterns = [
    [261.63, 329.63, 392.0, 523.25],
    [293.66, 369.99, 440.0, 587.33],
    [220.0, 277.18, 349.23, 466.16],
    [329.63, 415.3, 493.88, 659.25],
  ];
  const waveTypes = ['triangle', 'square', 'sawtooth', 'triangle'];
  const pattern = patterns[(stage - 1) % patterns.length];
  const wave = waveTypes[(stage - 1) % waveTypes.length];
  let noteIndex = 0;
  let stopped = false;

  function schedule() {
    if (stopped || !state.running) return;
    const base = ctx.currentTime + 0.02;
    for (let i = 0; i < 4; i += 1) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = wave;
      osc.frequency.value = pattern[(noteIndex + i) % pattern.length] * (1 + (((stage - 1) % 3) * 0.12));
      env.gain.setValueAtTime(0.0001, base + i * 0.32);
      env.gain.exponentialRampToValueAtTime(1, base + i * 0.32 + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, base + i * 0.32 + 0.24);
      osc.connect(env).connect(gain);
      osc.start(base + i * 0.32);
      osc.stop(base + i * 0.32 + 0.26);
    }
    noteIndex = (noteIndex + 1) % pattern.length;
    state.musicController.timer = setTimeout(schedule, 1080);
  }

  state.musicController = {
    timer: null,
    stop() {
      stopped = true;
      clearTimeout(this.timer);
      try { gain.disconnect(); } catch (error) {}
    },
  };

  schedule();
}

function removeBubble(bubble) {
  const timeoutId = state.bubbleTimers.get(bubble);
  if (timeoutId) clearTimeout(timeoutId);
  state.bubbleTimers.delete(bubble);
  if (bubble?.parentNode) bubble.parentNode.removeChild(bubble);
}

function clearArena() {
  clearTimeout(state.spawnTimer);
  state.bubbleTimers.forEach((timeoutId, bubble) => {
    clearTimeout(timeoutId);
    if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
  });
  state.bubbleTimers.clear();
}

function spawnBubble() {
  if (!state.running) return;

  const arenaRect = el.arena.getBoundingClientRect();
  const number = rand(1, 100);
  const bubbleSize = rand(58, 96);
  const bubble = document.createElement('button');
  const isOdd = number % 2 === 1;
  const correct = (state.selected === 'odd' && isOdd) || (state.selected === 'even' && !isOdd);

  bubble.type = 'button';
  bubble.className = 'number-bubble';
  bubble.textContent = String(number);
  bubble.style.width = `${bubbleSize}px`;
  bubble.style.height = `${bubbleSize}px`;
  bubble.style.fontSize = `${rand(20, 34)}px`;
  bubble.style.left = `${rand(6, Math.max(6, Math.floor(arenaRect.width - bubbleSize - 6)))}px`;
  bubble.style.top = `${rand(6, Math.max(6, Math.floor(arenaRect.height - bubbleSize - 6)))}px`;
  bubble.setAttribute('aria-label', `${number} 숫자`);

  bubble.addEventListener('click', () => {
    if (!state.running) return;
    bubble.classList.add('pop');
    if (correct) {
      state.score += 1;
      playCorrectSound();
      setMessage(`정답! ${number}은 ${isOdd ? '홀수' : '짝수'}입니다.`, 'good');
    } else {
      playWrongSound();
      setMessage(`오답! ${number}은 ${isOdd ? '홀수' : '짝수'}입니다.`, 'bad');
    }
    updateHUD();
    setTimeout(() => removeBubble(bubble), 70);
  }, { passive: true });

  el.arena.appendChild(bubble);
  const timeoutId = setTimeout(() => removeBubble(bubble), state.visibleDuration * 1000);
  state.bubbleTimers.set(bubble, timeoutId);
  state.spawnTimer = setTimeout(spawnBubble, rand(320, 720));
}

function endGame() {
  state.running = false;
  clearInterval(state.tickTimer);
  clearTimeout(state.spawnTimer);
  clearArena();
  stopMusic();

  const passed = state.score >= PASS_SCORE;
  const nextDuration = Math.max(MIN_DURATION, BASE_DURATION - (state.stage * 0.5));
  el.resultTitle.textContent = passed ? '스테이지 클리어!' : '시간 종료!';
  el.resultText.textContent = passed
    ? `축하합니다! ${state.score}점을 획득해 다음 스테이지로 넘어갈 수 있습니다.`
    : `${state.score}점을 획득했습니다. 20점 이상이면 다음 스테이지로 넘어갑니다.`;
  el.resultStage.textContent = String(state.stage);
  el.resultScore.textContent = String(state.score);
  el.resultNextDuration.textContent = `${nextDuration.toFixed(1)}초`;
  el.nextStageBtn.classList.toggle('hidden', !passed);
  showScreen('result');
}

function startRound() {
  if (!state.selected) {
    alert('먼저 홀수 또는 짝수를 선택해주세요.');
    return;
  }
  prepareAudio();
  state.score = 0;
  state.timeLeft = GAME_TIME;
  state.visibleDuration = Math.max(MIN_DURATION, BASE_DURATION - ((state.stage - 1) * 0.5));
  state.running = true;

  clearArena();
  updateHUD();
  setMessage('게임 시작! 선택한 숫자만 빠르게 터치하세요.');
  showScreen('game');
  playStageMusic(state.stage);

  state.tickTimer = setInterval(() => {
    state.timeLeft -= 1;
    updateHUD();
    if (state.timeLeft <= 0) endGame();
  }, 1000);

  state.spawnTimer = setTimeout(spawnBubble, 350);
}

function goHome() {
  state.running = false;
  clearInterval(state.tickTimer);
  clearTimeout(state.spawnTimer);
  clearArena();
  stopMusic();
  state.score = 0;
  state.timeLeft = GAME_TIME;
  updateHUD();
  setMessage('선택한 숫자만 터치하세요.');
  showScreen('start');
}

function nextStage() {
  state.stage += 1;
  startRound();
}

el.choiceBtns.forEach(btn => {
  btn.addEventListener('click', () => chooseSelection(btn.dataset.choice));
});

el.startBtn.addEventListener('click', startRound);
el.retryBtn.addEventListener('click', startRound);
el.homeBtn.addEventListener('click', () => {
  state.stage = 1;
  goHome();
});
el.nextStageBtn.addEventListener('click', nextStage);

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  state.deferredPrompt = event;
  el.installBtn.classList.remove('hidden');
});

el.installBtn.addEventListener('click', async () => {
  if (!state.deferredPrompt) return;
  state.deferredPrompt.prompt();
  await state.deferredPrompt.userChoice;
  state.deferredPrompt = null;
  el.installBtn.classList.add('hidden');
});

window.addEventListener('appinstalled', () => {
  el.installBtn.classList.add('hidden');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

updateHUD();
