const gameBoard = document.getElementById("gameBoard");
const timerEl = document.getElementById("timer");
const scoreEl = document.getElementById("score");
const stageScoreEl = document.getElementById("stageScore");
const stageEl = document.getElementById("stage");
const targetModeEl = document.getElementById("targetMode");
const bestScoreEl = document.getElementById("bestScore");
const messageEl = document.getElementById("message");

const oddBtn = document.getElementById("selectOdd");
const evenBtn = document.getElementById("selectEven");
const startBtn = document.getElementById("startGame");
const restartBtn = document.getElementById("restartGame");
const endBtn = document.getElementById("endGame");

const BEST_SCORE_KEY = "oddEvenBestScore";
const GAME_TIME = 30;
const BASE_VISIBLE_TIME = 3000;
const STAGE_CLEAR_SCORE = 15;
const BASE_SPAWN_INTERVAL = 800;

let selectedMode = null;
let totalScore = 0;     // 전체 누적 점수
let stageScore = 0;     // 현재 스테이지 점수
let bestScore = Number(localStorage.getItem(BEST_SCORE_KEY) || 0);
let stage = 1;
let timeLeft = GAME_TIME;
let gameRunning = false;

let gameTimer = null;
let spawnTimer = null;
let audioCtx = null;
let bgmNodes = [];
let bgmSeq = null;

bestScoreEl.textContent = bestScore;

oddBtn.addEventListener("click", () => {
  selectedMode = "odd";
  updateModeButtons();
});

evenBtn.addEventListener("click", () => {
  selectedMode = "even";
  updateModeButtons();
});

startBtn.addEventListener("click", async () => {
  if (!selectedMode) {
    showMessage("먼저 홀수 또는 짝수를 선택하세요.", "bad");
    return;
  }
  await unlockAudio();
  startGame();
});

restartBtn.addEventListener("click", () => {
  resetGame();
});

endBtn.addEventListener("click", () => {
  if (!gameRunning) {
    showMessage("진행 중인 게임이 없습니다.", "normal");
    return;
  }
  finishEntireGame("게임을 종료했습니다.");
});

function updateModeButtons() {
  oddBtn.classList.toggle("active", selectedMode === "odd");
  evenBtn.classList.toggle("active", selectedMode === "even");
  targetModeEl.textContent = selectedMode === "odd" ? "홀수" : "짝수";
}

function resetGame() {
  clearTimers();
  removeAllBubbles();
  stopBgm();

  totalScore = 0;
  stageScore = 0;
  stage = 1;
  timeLeft = GAME_TIME;
  gameRunning = false;

  updateUi();
  showMessage("다시 시작할 준비 완료!", "normal");
}

function startGame() {
  clearTimers();
  removeAllBubbles();
  stopBgm();

  totalScore = 0;
  stageScore = 0;
  stage = 1;
  timeLeft = GAME_TIME;
  gameRunning = true;

  updateUi();
  showMessage("게임 시작!", "good");

  startCurrentStage();
}

function startCurrentStage() {
  clearTimers();
  removeAllBubbles();

  // 핵심: 스테이지가 시작될 때마다 그 스테이지 점수는 0점부터 시작
  stageScore = 0;
  timeLeft = GAME_TIME;
  gameRunning = true;

  updateUi();
  playStageBgm(stage);

  gameTimer = setInterval(() => {
    timeLeft -= 1;
    timerEl.textContent = timeLeft;

    if (timeLeft <= 0) {
      finishStageByTimeOut();
    }
  }, 1000);

  spawnTimer = setInterval(() => {
    spawnNumberBubble();
  }, getSpawnInterval());

  spawnNumberBubble();
}

function finishStageByTimeOut() {
  clearTimers();
  removeAllBubbles();

  // 핵심 규칙:
  // "현재 스테이지 점수"가 15점 이상일 때만 다음 단계
  if (stageScore >= STAGE_CLEAR_SCORE) {
    gameRunning = false;
    showMessage(`스테이지 ${stage} 클리어! 현재 스테이지 ${stageScore}점`, "good");
    playSfx("stage");

    setTimeout(() => {
      stage += 1;
      startCurrentStage();
      showMessage(`스테이지 ${stage} 시작!`, "good");
    }, 1400);
  } else {
    // 현재 스테이지 점수가 15점 미만이면 즉시 전체 게임 종료
    finishEntireGame(`스테이지 ${stage} 실패! 현재 스테이지 점수 ${stageScore}점`);
  }
}

function finishEntireGame(text) {
  clearTimers();
  removeAllBubbles();
  stopBgm();
  gameRunning = false;
  updateBestScore();
  updateUi();
  showMessage(text, "bad");
}

function getVisibleTime() {
  return Math.max(700, BASE_VISIBLE_TIME - (stage - 1) * 500);
}

function getSpawnInterval() {
  return Math.max(380, BASE_SPAWN_INTERVAL - (stage - 1) * 35);
}

function spawnNumberBubble() {
  if (!gameRunning) return;

  const boardRect = gameBoard.getBoundingClientRect();
  if (boardRect.width === 0 || boardRect.height === 0) return;

  const bubble = document.createElement("button");
  bubble.type = "button";
  bubble.className = "number-bubble";

  const number = Math.floor(Math.random() * 100) + 1;
  bubble.textContent = number;

  const size = randomInt(64, 104);
  const fontSize = randomInt(24, 40);
  const maxLeft = Math.max(8, boardRect.width - size - 8);
  const maxTop = Math.max(8, boardRect.height - size - 8);

  bubble.style.width = `${size}px`;
  bubble.style.height = `${size}px`;
  bubble.style.left = `${randomInt(8, Math.floor(maxLeft))}px`;
  bubble.style.top = `${randomInt(8, Math.floor(maxTop))}px`;
  bubble.style.fontSize = `${fontSize}px`;

  bubble.addEventListener("click", () => {
    handleBubbleClick(number, bubble);
  });

  gameBoard.appendChild(bubble);

  setTimeout(() => {
    bubble.remove();
  }, getVisibleTime());
}

function handleBubbleClick(number, bubble) {
  if (!gameRunning) return;

  const isOdd = number % 2 === 1;
  const isCorrect =
    (selectedMode === "odd" && isOdd) ||
    (selectedMode === "even" && !isOdd);

  bubble.remove();

  if (isCorrect) {
    totalScore += 1;
    stageScore += 1;
    showMessage("정답! +1점", "good");
    playSfx("correct");
    vibrateGood();
  } else {
    totalScore = Math.max(0, totalScore - 1);
    stageScore = Math.max(0, stageScore - 1);
    showMessage("오답! -1점", "bad");
    playSfx("wrong");
    vibrateBad();
  }

  updateUi();
}

function updateBestScore() {
  if (totalScore > bestScore) {
    bestScore = totalScore;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  }
  bestScoreEl.textContent = bestScore;
}

function updateUi() {
  scoreEl.textContent = totalScore;
  stageScoreEl.textContent = stageScore;
  stageEl.textContent = stage;
  timerEl.textContent = timeLeft;
  bestScoreEl.textContent = bestScore;
  targetModeEl.textContent =
    selectedMode === "odd" ? "홀수" :
    selectedMode === "even" ? "짝수" : "-";
}

function clearTimers() {
  if (gameTimer) clearInterval(gameTimer);
  if (spawnTimer) clearInterval(spawnTimer);
  gameTimer = null;
  spawnTimer = null;
}

function removeAllBubbles() {
  gameBoard.innerHTML = "";
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function showMessage(text, type = "normal") {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
}

function vibrateGood() {
  if (navigator.vibrate) navigator.vibrate(35);
}

function vibrateBad() {
  if (navigator.vibrate) navigator.vibrate([70, 40, 70]);
}

/* -------------------------
   Audio
------------------------- */

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

async function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
}

function playSfx(type) {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  if (type === "correct") {
    tone(ctx, "triangle", 660, 0.00, 0.14, 0.10);
    tone(ctx, "triangle", 880, 0.06, 0.16, 0.08);
  } else if (type === "wrong") {
    tone(ctx, "square", 240, 0.00, 0.18, 0.11, 150);
  } else if (type === "stage") {
    tone(ctx, "triangle", 523.25, 0.00, 0.18, 0.11);
    tone(ctx, "triangle", 659.25, 0.08, 0.18, 0.10);
    tone(ctx, "triangle", 783.99, 0.16, 0.22, 0.09);
  }
}

function tone(ctx, type, freq, delay, duration, volume, endFreq = null) {
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);

  if (endFreq) {
    osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
  }

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function stopBgm() {
  if (bgmSeq) {
    clearInterval(bgmSeq);
    bgmSeq = null;
  }

  bgmNodes.forEach((node) => {
    try {
      node.osc.stop();
    } catch (_) {}
  });
  bgmNodes = [];
}

function playStageBgm(stageNumber) {
  stopBgm();

  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const patterns = [
    [523.25, 659.25, 783.99, 659.25, 587.33, 659.25, 783.99, 1046.5],
    [587.33, 739.99, 880.0, 739.99, 659.25, 739.99, 880.0, 1174.66],
    [659.25, 830.61, 987.77, 830.61, 739.99, 830.61, 987.77, 1318.51],
    [698.46, 880.0, 1046.5, 880.0, 783.99, 880.0, 1046.5, 1396.91]
  ];

  const durations = [240, 210, 180, 160];
  const idx = Math.min(stageNumber - 1, patterns.length - 1);
  const pattern = patterns[idx];
  const speed = durations[idx];

  const lead = createLoopOsc(ctx, "sawtooth", now, 0.018);
  const sub = createLoopOsc(ctx, "triangle", now, 0.012);

  bgmNodes.push(lead, sub);

  let step = 0;
  bgmSeq = setInterval(() => {
    if (!gameRunning) return;

    const f = pattern[step % pattern.length];
    lead.osc.frequency.setTargetAtTime(f, ctx.currentTime, 0.03);
    sub.osc.frequency.setTargetAtTime(f / 2, ctx.currentTime, 0.05);

    step += 1;
  }, speed);
}

function createLoopOsc(ctx, type, startTime, volume) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.value = 440;
  gain.gain.value = volume;

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);

  return { osc, gain };
}

/* -------------------------
   PWA
------------------------- */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}