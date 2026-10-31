(() => {
  'use strict';

  const ROUND_SECONDS = 60;
  const WRONG_PENALTY = 4;
  const BEST_KEY = 'odd-one-out-neon-best-v1';
  const COLORS = ['#63f5ff', '#a889ff', '#ff63d4', '#ffd16b', '#70ffc2', '#ff8d72'];
  const SHAPES = ['circle', 'square', 'diamond', 'triangle'];
  const CHALLENGES = [
    { id: 'color', label: 'color', instruction: 'Find the different color' },
    { id: 'shape', label: 'shape', instruction: 'Find the different shape' },
    { id: 'rotation', label: 'rotation', instruction: 'Find the different rotation' }
  ];

  const screens = {
    home: document.getElementById('home-screen'),
    game: document.getElementById('game-screen'),
    end: document.getElementById('end-screen')
  };
  const ui = {
    start: document.getElementById('start-button'),
    home: document.getElementById('home-button'),
    endHome: document.getElementById('end-home-button'),
    restart: document.getElementById('restart-button'),
    grid: document.getElementById('game-grid'),
    timer: document.getElementById('timer-value'),
    timerCard: document.getElementById('timer-card'),
    timerBar: document.getElementById('timer-bar'),
    score: document.getElementById('score-value'),
    streak: document.getElementById('streak-value'),
    best: document.getElementById('best-value'),
    instruction: document.getElementById('instruction-text'),
    round: document.getElementById('round-label'),
    difficulty: document.getElementById('difficulty-label'),
    gridSize: document.getElementById('grid-size-label'),
    feedback: document.getElementById('feedback-message'),
    finalScore: document.getElementById('final-score-value'),
    finalStreak: document.getElementById('final-streak-value'),
    finalRounds: document.getElementById('final-rounds-value'),
    endTitle: document.getElementById('end-title'),
    endSubtitle: document.getElementById('end-subtitle'),
    newBest: document.getElementById('new-best-message'),
    toast: document.getElementById('toast')
  };

  const state = {
    score: 0,
    streak: 0,
    bestStreak: 0,
    rounds: 0,
    timeLeft: ROUND_SECONDS,
    deadline: 0,
    timerId: null,
    toastId: null,
    oddIndex: -1,
    previousChallenge: '',
    running: false,
    sessionId: 0,
    best: readBest()
  };

  ui.best.textContent = state.best;
  ui.start.addEventListener('click', startGame);
  ui.restart.addEventListener('click', startGame);
  ui.home.addEventListener('click', goHome);
  ui.endHome.addEventListener('click', goHome);
  document.querySelector('.brand').addEventListener('click', event => {
    event.preventDefault();
    goHome();
  });

  function readBest() {
    try {
      const value = Number.parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch {
      return 0;
    }
  }

  function saveBest(value) {
    try {
      localStorage.setItem(BEST_KEY, String(value));
    } catch {
      // The current run still works when browser storage is unavailable.
    }
  }

  function showScreen(name) {
    for (const [screenName, element] of Object.entries(screens)) {
      element.hidden = screenName !== name;
    }
  }

  function startGame() {
    clearInterval(state.timerId);
    clearTimeout(state.toastId);
    state.score = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.rounds = 0;
    state.timeLeft = ROUND_SECONDS;
    state.deadline = Date.now() + ROUND_SECONDS * 1000;
    state.previousChallenge = '';
    state.running = true;
    state.sessionId += 1;
    ui.timerCard.classList.remove('timer-low');
    ui.toast.classList.remove('is-visible');
    showScreen('game');
    updateStats();
    nextRound();
    tick();
    state.timerId = window.setInterval(tick, 100);
  }

  function goHome() {
    clearInterval(state.timerId);
    state.running = false;
    state.sessionId += 1;
    showScreen('home');
  }

  function getGridSize() {
    if (state.score >= 280) return 7;
    if (state.score >= 150) return 6;
    if (state.score >= 60) return 5;
    return 4;
  }

  function getLevel() {
    if (state.score >= 280) return 4;
    if (state.score >= 150) return 3;
    if (state.score >= 60) return 2;
    return 1;
  }

  function nextRound() {
    const candidates = CHALLENGES.filter(item => item.id !== state.previousChallenge);
    const challenge = candidates[Math.floor(Math.random() * candidates.length)];
    state.previousChallenge = challenge.id;
    state.rounds += 1;
    const size = getGridSize();
    const count = size * size;
    state.oddIndex = Math.floor(Math.random() * count);
    ui.grid.replaceChildren();
    ui.grid.style.setProperty('--grid-columns', String(size));
    ui.grid.setAttribute('aria-label', `${size} by ${size} pattern grid. ${challenge.instruction}.`);
    ui.instruction.textContent = challenge.instruction;
    ui.round.textContent = `ROUND ${String(state.rounds).padStart(2, '0')}`;
    ui.difficulty.textContent = `LEVEL ${String(getLevel()).padStart(2, '0')}`;
    ui.gridSize.textContent = `${count} TILES`;
    ui.feedback.textContent = 'TAP THE ONE THAT DOESN’T MATCH';

    const shape = challenge.id === 'rotation' ? 'arrow' : pick(SHAPES);
    const color = pick(COLORS);
    const oddColor = pickDifferent(COLORS, color);
    const oddShape = pickDifferent(SHAPES, shape);
    const oddRotation = Math.random() < .5 ? 90 : 270;

    for (let index = 0; index < count; index += 1) {
      const isOdd = index === state.oddIndex;
      const button = document.createElement('button');
      button.className = 'tile';
      button.type = 'button';
      button.setAttribute('aria-label', `Pattern ${index + 1}`);
      button.addEventListener('click', () => chooseTile(button, index));
      const piece = document.createElement('span');
      const tileShape = challenge.id === 'shape' && isOdd ? oddShape : shape;
      piece.className = `shape shape--${tileShape}`;
      piece.style.setProperty('--piece-color', challenge.id === 'color' && isOdd ? oddColor : color);
      if (challenge.id === 'rotation' && isOdd) piece.style.transform = `rotate(${oddRotation}deg)`;
      button.append(piece);
      ui.grid.append(button);
    }
    if (state.rounds === 1 || !ui.grid.contains(document.activeElement)) {
      ui.grid.querySelector('.tile')?.focus({ preventScroll: true });
    }
  }

  function chooseTile(button, index) {
    if (!state.running) return;
    if (Date.now() >= state.deadline) {
      tick();
      return;
    }
    if (index === state.oddIndex) {
      const nextStreak = state.streak + 1;
      const bonus = Math.min(20, (nextStreak - 1) * 2);
      state.streak = nextStreak;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      state.score += 10 + bonus;
      button.classList.add('is-correct');
      ui.grid.querySelectorAll('.tile').forEach(tile => { tile.disabled = true; });
      ui.feedback.textContent = bonus ? `NICE! +${10 + bonus} POINTS  ·  ${state.streak}× STREAK` : 'NICE! +10 POINTS';
      updateStats();
      const completedSession = state.sessionId;
      window.setTimeout(() => {
        if (state.running && state.sessionId === completedSession) nextRound();
      }, 240);
    } else {
      state.streak = 0;
      state.deadline -= WRONG_PENALTY * 1000;
      state.timeLeft = Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000));
      button.classList.add('is-wrong');
      button.disabled = true;
      ui.feedback.textContent = 'NOT THAT ONE — 4 SECONDS LOST';
      updateStats();
      showToast('−4 SECONDS');
      tick();
    }
  }

  function updateStats() {
    ui.score.textContent = state.score;
    ui.streak.textContent = state.streak;
    ui.best.textContent = state.best;
    ui.timer.textContent = Math.max(0, state.timeLeft);
  }

  function tick() {
    if (!state.running) return;
    state.timeLeft = Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000));
    ui.timer.textContent = state.timeLeft;
    ui.timerBar.style.width = `${Math.max(0, (state.deadline - Date.now()) / (ROUND_SECONDS * 10))}%`;
    ui.timerCard.classList.toggle('timer-low', state.timeLeft <= 10);
    if (state.timeLeft <= 0) finishGame();
  }

  function finishGame() {
    if (!state.running) return;
    state.running = false;
    state.sessionId += 1;
    clearInterval(state.timerId);
    const isNewBest = state.score > state.best;
    if (isNewBest) {
      state.best = state.score;
      saveBest(state.best);
    }
    ui.best.textContent = state.best;
    ui.finalScore.textContent = state.score;
    ui.finalStreak.textContent = state.bestStreak;
    ui.finalRounds.textContent = Math.max(0, state.rounds - 1);
    ui.endTitle.textContent = 'TIME’S UP.';
    ui.endSubtitle.textContent = state.score > 0 ? 'Nice scan. Ready for another run?' : 'The clock got you. Give it another shot?';
    ui.newBest.hidden = !isNewBest;
    showScreen('end');
  }

  function showToast(message) {
    clearTimeout(state.toastId);
    ui.toast.textContent = message;
    ui.toast.classList.add('is-visible');
    state.toastId = window.setTimeout(() => ui.toast.classList.remove('is-visible'), 800);
  }

  function pick(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function pickDifferent(items, current) {
    const choices = items.filter(item => item !== current);
    return pick(choices);
  }
})();
