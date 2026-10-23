// Client Application Logic
const socket = io();

// State
let myPlayerId = null;
let currentRoomCode = null;
let isHost = false;
let currentGameState = null;
let selectedAnswer = null;
let selectedSkillToUse = null;
let inkCanvasCtx = null;
let inkPointsRemaining = 100;
let renderedQuestionId = null;
let handledDebuffQuestionId = null;

// Elements
const viewHome = document.getElementById('view-home');
const viewLobby = document.getElementById('view-lobby');
const viewGame = document.getElementById('view-game');
const viewRacetrack = document.getElementById('view-racetrack');
const viewSkillPhase = document.getElementById('view-skill-phase');
const viewEnded = document.getElementById('view-ended');

const racetrackCountdown = document.getElementById('racetrack-countdown');
const racetrackAnswerRecap = document.getElementById('racetrack-answer-recap');
const racetrackLanes = document.getElementById('racetrack-lanes');
const racetrackSkillsList = document.getElementById('racetrack-skills-list');
const racetrackFuryIndicator = document.getElementById('racetrack-fury-indicator');
const racetrackPermissionBanner = document.getElementById('racetrack-permission-banner');

const inputPlayerName = document.getElementById('player-name');
const inputRoomCode = document.getElementById('room-code-input');
const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');
const btnAddBot = document.getElementById('btn-add-bot');
const btnStartGame = document.getElementById('btn-start-game');
const btnLeaveLobby = document.getElementById('btn-leave-lobby');
const btnSoundToggle = document.getElementById('btn-sound-toggle');
const btnAllSkillsModal = document.getElementById('btn-all-skills-modal');
const btnPlayAgain = document.getElementById('btn-play-again');

const lobbyRoomCode = document.getElementById('lobby-room-code');
const lobbyPlayerCount = document.getElementById('lobby-player-count');
const lobbyPlayerList = document.getElementById('lobby-player-list');
const lobbyRoleTag = document.getElementById('lobby-role-tag');
const hostControls = document.getElementById('host-controls');
const guestWaitingBox = document.getElementById('guest-waiting-box');

const hostRacetrackBar = document.getElementById('host-racetrack-bar');
const guestRacetrackBar = document.getElementById('guest-racetrack-bar');
const btnHostNextQ = document.getElementById('btn-host-next-q');
const hostNextBtnText = document.getElementById('host-next-btn-text');
const btnHostSkipQ = document.getElementById('btn-host-skip-q');

const furyContainerBox = document.getElementById('fury-container-box');
const playerSkillsBar = document.getElementById('player-skills-bar');
const hostLiveTracker = document.getElementById('host-live-tracker');
const hostAnswerProgress = document.getElementById('host-answer-progress');
const hostPlayerAnswerList = document.getElementById('host-player-answer-list');
const racetrackSkillBarEl = document.getElementById('racetrack-skill-bar');

const qCurrentIndex = document.getElementById('q-current-index');
const qTotal = document.getElementById('q-total');
const myScoreDisplay = document.getElementById('my-score-display');
const timerBarFill = document.getElementById('timer-bar-fill');
const timerSeconds = document.getElementById('timer-seconds');
const questionText = document.getElementById('question-text');
const optionsGrid = document.getElementById('options-grid');
const explanationBox = document.getElementById('explanation-box');
const skillsList = document.getElementById('skills-list');
const furySlots = document.querySelectorAll('.fury-slot');

const targetModal = document.getElementById('target-modal');
const targetList = document.getElementById('target-list');
const btnCloseTargetModal = document.getElementById('btn-close-target-modal');

const allSkillsModal = document.getElementById('all-skills-modal');
const btnCloseSkillsModal = document.getElementById('btn-close-skills-modal');

const btnLeaderboardModal = document.getElementById('btn-leaderboard-modal');
const leaderboardModal = document.getElementById('leaderboard-modal');
const btnCloseLeaderboardModal = document.getElementById('btn-close-leaderboard-modal');
const liveLeaderboardList = document.getElementById('live-leaderboard-list');

const btnSkillHistoryModal = document.getElementById('btn-skill-history-modal');
const btnQuickSkillHistory = document.getElementById('btn-quick-skill-history');
const skillHistoryModal = document.getElementById('skill-history-modal');
const btnCloseSkillHistoryModal = document.getElementById('btn-close-skill-history-modal');
const skillHistoryList = document.getElementById('skill-history-list');

const toastContainer = document.getElementById('toast-container');
const inkCanvas = document.getElementById('ink-canvas');
const inkHint = document.getElementById('ink-hint');
const appContainer = document.getElementById('app');

const gameEventBannerContainer = document.getElementById('game-event-banner-container');
const racetrackEventBannerContainer = document.getElementById('racetrack-event-banner-container');
const floatingReactionsLayer = document.getElementById('floating-reactions-layer');
const hostSoundboardBar = document.getElementById('host-soundboard-bar');
const mvpAwardsSection = document.getElementById('mvp-awards-section');
const mvpAwardsGrid = document.getElementById('mvp-awards-grid');

// Avatars configuration
let selectedAvatar = '😎';
const avatarItems = document.querySelectorAll('.avatar-item');
avatarItems.forEach(item => {
  item.addEventListener('click', () => {
    avatarItems.forEach(i => i.classList.remove('selected'));
    item.classList.add('selected');
    selectedAvatar = item.dataset.avatar;
    if (window.soundEngine) window.soundEngine.playTick();
  });
});

// View switcher
function switchView(view) {
  [viewHome, viewLobby, viewGame, viewRacetrack, viewSkillPhase, viewEnded].forEach(v => {
    if (v) v.classList.remove('active');
  });
  if (view) view.classList.add('active');

  const inPlay = (view === viewGame || view === viewRacetrack || view === viewEnded);
  if (hostSoundboardBar) {
    hostSoundboardBar.style.display = (inPlay && isHost) ? 'flex' : 'none';
  }
}

// Toast notification
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 4000);
}

// Sound toggle
let soundOn = true;
btnSoundToggle.addEventListener('click', () => {
  soundOn = !soundOn;
  window.soundEngine.enabled = soundOn;
  btnSoundToggle.textContent = soundOn ? '🔊' : '🔇';
});

// Home View Handlers
btnCreateRoom.addEventListener('click', () => {
  const name = inputPlayerName.value.trim() || 'Thủ Lĩnh ' + Math.floor(Math.random() * 90 + 10);
  window.soundEngine.init();
  socket.emit('create_room', { name, avatar: selectedAvatar });
});

btnJoinRoom.addEventListener('click', () => {
  const code = inputRoomCode.value.trim().toUpperCase();
  const name = inputPlayerName.value.trim() || 'Người Chơi ' + Math.floor(Math.random() * 90 + 10);
  if (!code) {
    showToast('⚠️ Vui lòng nhập mã phòng!');
    return;
  }
  window.soundEngine.init();
  socket.emit('join_room', { code, name, avatar: selectedAvatar });
});

// Lobby Handlers
btnAddBot.addEventListener('click', () => {
  if (currentRoomCode) {
    socket.emit('add_bot', { code: currentRoomCode });
    window.soundEngine.playTick();
  }
});

btnStartGame.addEventListener('click', () => {
  if (currentRoomCode) {
    socket.emit('start_game', { code: currentRoomCode });
    window.soundEngine.playFanfare();
  }
});

if (btnHostNextQ) {
  btnHostNextQ.addEventListener('click', () => {
    if (currentRoomCode) {
      socket.emit('next_question', { code: currentRoomCode });
      window.soundEngine.playTick();
    }
  });
}

if (btnHostSkipQ) {
  btnHostSkipQ.addEventListener('click', () => {
    if (currentRoomCode) {
      socket.emit('next_question', { code: currentRoomCode });
      window.soundEngine.playTick();
    }
  });
}

btnLeaveLobby.addEventListener('click', () => {
  location.reload();
});

btnPlayAgain.addEventListener('click', () => {
  if (currentRoomCode) {
    socket.emit('restart_game', { code: currentRoomCode });
  } else {
    location.reload();
  }
});

// Socket Events
socket.on('connect', () => {
  try {
    const saved = sessionStorage.getItem('minigame_session');
    if (saved) {
      const data = JSON.parse(saved);
      if (data && data.code) {
        currentRoomCode = data.code;
        myPlayerId = data.playerId;
        isHost = !!data.isHost;
        socket.emit('rejoin_session', data);
      }
    }
  } catch(e) {}
});

socket.on('room_created', ({ code }) => {
  currentRoomCode = code;
  isHost = true;
  try {
    sessionStorage.setItem('minigame_session', JSON.stringify({
      code,
      playerId: null,
      name: inputPlayerName.value.trim() || 'Chủ Phòng',
      avatar: selectedAvatar,
      isHost: true
    }));
  } catch(e) {}
  showToast(`✅ Đã tạo phòng ${code}!`);
});

socket.on('join_error', ({ message }) => {
  showToast(`❌ ${message}`);
  window.soundEngine.playWrong();
});

socket.on('action_error', ({ message }) => {
  showToast(`⚠️ ${message}`);
  window.soundEngine.playWrong();
});

socket.on('room_sync', (room) => {
  currentGameState = room;
  currentRoomCode = room.code;
  if (room.me) myPlayerId = room.me.id;
  isHost = !!(room.me && room.me.isHost);

  if (room.code && room.me) {
    try {
      sessionStorage.setItem('minigame_session', JSON.stringify({
        code: room.code,
        playerId: room.me.id,
        name: room.me.name,
        avatar: room.me.avatar,
        isHost: !!room.me.isHost
      }));
    } catch(e) {}
  }

  // Route Views based on room state
  if (room.state === 'LOBBY') {
    renderLobby(room);
    switchView(viewLobby);
  } else if (room.state === 'STARTING') {
    renderedQuestionId = null;
    handledDebuffQuestionId = null;
    switchView(viewGame);
    questionText.textContent = '🚀 Trận đấu đang chuẩn bị khởi tranh...';
    optionsGrid.innerHTML = '';
  } else if (room.state === 'QUESTION') {
    switchView(viewGame);
    renderGame(room);
  } else if (room.state === 'REVEAL' || room.state === 'SKILL_PHASE') {
    switchView(viewRacetrack);
    renderRacetrack(room);
  } else if (room.state === 'ENDED') {
    switchView(viewEnded);
  }

  // Live update open modals
  if (leaderboardModal && leaderboardModal.classList.contains('active')) {
    renderLiveLeaderboardModal();
  }
  if (skillHistoryModal && skillHistoryModal.classList.contains('active')) {
    renderSkillHistoryModal();
  }
});

// Timer tick event
socket.on('timer_tick', ({ timeLeft }) => {
  timerSeconds.textContent = `${timeLeft}s`;
  const pct = (timeLeft / 15) * 100;
  timerBarFill.style.width = `${Math.max(0, pct)}%`;

  // Real-time points decreasing from 100 down to 0
  const livePoints = Math.max(0, Math.round(100 * (timeLeft / 15)));
  const livePointsEl = document.getElementById('timer-live-points');
  if (livePointsEl) {
    livePointsEl.textContent = `Điểm nhận: ${livePoints}đ`;
  }

  if (timeLeft <= 4) {
    timerBarFill.classList.add('hurry');
    if (timeLeft > 0) window.soundEngine.playTickHurry();
  } else {
    timerBarFill.classList.remove('hurry');
    if (timeLeft % 3 === 0) window.soundEngine.playTick();
  }
});

// Racetrack 10s reveal timer tick
socket.on('reveal_timer_tick', ({ timeLeft }) => {
  if (racetrackCountdown) {
    racetrackCountdown.textContent = timeLeft > 0 ? `${timeLeft}s` : 'Chuẩn bị câu kế...';
  }
  if (timeLeft <= 3 && timeLeft > 0) {
    window.soundEngine.playTickHurry();
  }
});

// Skill phase tick
socket.on('skill_phase_tick', ({ timeLeft, title }) => {
  if (racetrackCountdown) racetrackCountdown.textContent = `${timeLeft}s`;
  const skillTimer = document.getElementById('skill-phase-timer');
  const skillTitle = document.getElementById('skill-phase-title');
  if (skillTimer) skillTimer.textContent = `${timeLeft}s`;
  if (skillTitle) skillTitle.textContent = title;
});

// Skill triggered broadcast
socket.on('skill_triggered', (data) => {
  showToast(`✨ [${data.casterName}] dùng [${data.skillIcon} ${data.skillName}]!`);
  
  // Specific sounds
  if (data.skillId === 'EARTHQUAKE' || data.skillId === 'TIME_BOMB') {
    window.soundEngine.playExplosion();
    triggerScreenShake();
  } else if (data.skillId === 'FREEZE_ONE') {
    window.soundEngine.playFreeze();
  } else if (data.skillId === 'INK_BLIND') {
    window.soundEngine.playInk();
  } else if (data.skillId === 'STEAL_30') {
    window.soundEngine.playZap();
  } else if (data.skillId === 'DIVINE_SHIELD') {
    window.soundEngine.playShieldHum();
  } else {
    window.soundEngine.playSkill();
  }

  // Trigger visual beam / projectile / blast FX on the racetrack!
  triggerSkillVisualFX(data);
});

// Floating Reaction Spawner
function spawnFloatingReaction(emoji, senderName) {
  if (!floatingReactionsLayer) return;
  const item = document.createElement('div');
  item.className = 'floating-reaction-item';
  const leftPos = Math.floor(Math.random() * 75) + 12; // 12% to 87%
  item.style.left = `${leftPos}%`;
  item.textContent = emoji;
  if (senderName) {
    item.title = senderName;
  }
  floatingReactionsLayer.appendChild(item);
  setTimeout(() => {
    if (item.parentNode) item.parentNode.removeChild(item);
  }, 2600);
}

// Socket: Reaction Received
socket.on('reaction_received', ({ senderName, emoji }) => {
  spawnFloatingReaction(emoji, senderName);
  window.soundEngine.playPop();
});

// Socket: Host Sound FX Triggered
socket.on('host_sound_fx_triggered', ({ sfxType }) => {
  if (sfxType === 'applause') window.soundEngine.playApplause();
  else if (sfxType === 'alarm') window.soundEngine.playAlarm();
  else if (sfxType === 'crickets') window.soundEngine.playCrickets();
  else if (sfxType === 'fanfare') window.soundEngine.playFanfare();
});

// Host Soundboard Button Listeners

document.querySelectorAll('.host-sfx-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const sfx = btn.dataset.sfx;
    if (currentRoomCode && isHost) {
      socket.emit('host_sound_fx', { code: currentRoomCode, sfxType: sfx });
      btn.style.transform = 'scale(1.1)';
      setTimeout(() => btn.style.transform = '', 120);
    }
  });
});

// Render Event Banners
function renderEventBanners(room) {
  let bannerHtml = '';
  if (room.isGolden) {
    bannerHtml = `
      <div class="game-event-banner banner-golden">
        <span class="game-event-banner-icon">🌟</span>
        <div class="game-event-banner-text">
          <div class="game-event-banner-title">CÂU HỎI VÀNG - ĐIỂM SỐ X2!</div>
          <div class="game-event-banner-desc">Cơ hội vàng bứt tốc ngoạn mục! Trả lời đúng nhận gấp đôi điểm!</div>
        </div>
      </div>
    `;
  } else if (room.isSuddenDeath) {
    bannerHtml = `
      <div class="game-event-banner banner-sudden-death">
        <span class="game-event-banner-icon">☠️</span>
        <div class="game-event-banner-text">
          <div class="game-event-banner-title">VÒNG SINH TỒN (SUDDEN DEATH)</div>
          <div class="game-event-banner-desc">3 câu quyết định! Trả lời sai hoặc hết giờ bị TRỪ 30 ĐIỂM!</div>
        </div>
      </div>
    `;
  } else if (room.activeEvent) {
    bannerHtml = `
      <div class="game-event-banner banner-room-event">
        <span class="game-event-banner-icon">🎰</span>
        <div class="game-event-banner-text">
          <div class="game-event-banner-title">${escapeHtml(room.activeEvent.name)}</div>
          <div class="game-event-banner-desc">${escapeHtml(room.activeEvent.desc)}</div>
        </div>
      </div>
    `;
  }

  if (gameEventBannerContainer) gameEventBannerContainer.innerHTML = bannerHtml;
  if (racetrackEventBannerContainer) racetrackEventBannerContainer.innerHTML = bannerHtml;
}

// Game over rankings & Funny MVPs
socket.on('game_over', ({ rankings, mvpAwards }) => {
  renderVictoryPodium(rankings, mvpAwards);
  window.soundEngine.playFanfare();
  launchConfetti();
});

// Render Lobby
function renderLobby(room) {
  lobbyRoomCode.textContent = room.code;
  lobbyPlayerCount.textContent = `${room.players.length}/10 người chơi`;

  lobbyPlayerList.innerHTML = '';
  if (room.players.length === 0) {
    lobbyPlayerList.innerHTML = `
      <div style="text-align:center; padding:24px 12px; color:var(--text-muted); font-size:0.85rem; line-height:1.5;">
        <span>🎮 Chưa có người chơi nào tham gia.</span><br>
        <span style="font-size:0.8rem;">Hãy chia sẻ mã phòng <b>${room.code}</b> hoặc bấm <b>🤖 Thêm AI Bot</b>!</span>
      </div>
    `;
  } else {
    room.players.forEach(p => {
      const card = document.createElement('div');
      card.className = 'player-card';
      card.innerHTML = `
        <div class="player-info">
          <div class="player-avatar">${p.avatar}</div>
          <div>
            <div class="player-name">${escapeHtml(p.name)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">
              ${p.isBot ? '🤖 AI Bot' : '👤 Người chơi'}
            </div>
          </div>
        </div>
        <div>
          ${p.id === myPlayerId ? '<span class="player-tag">Bạn</span>' : ''}
        </div>
      `;
      lobbyPlayerList.appendChild(card);
    });
  }

  if (isHost) {
    hostControls.style.display = 'block';
    if (guestWaitingBox) guestWaitingBox.style.display = 'none';
    if (lobbyRoleTag) {
      lobbyRoleTag.innerHTML = '<span style="color:var(--neon-gold); font-size:0.85rem;">👑 BẠN LÀ MC / HOST ĐIỀU HÀNH (Không thi đấu)</span>';
    }
    btnAddBot.disabled = room.players.length >= 10;
    btnStartGame.innerHTML = `<span>🔥</span> BẮT ĐẦU TRẬN ĐẤU (${room.players.length} NGƯỜI CHƠI)`;
  } else {
    hostControls.style.display = 'none';
    if (guestWaitingBox) guestWaitingBox.style.display = 'block';
    const hostName = room.host ? room.host.name : 'Chủ phòng';
    if (lobbyRoleTag) {
      lobbyRoleTag.innerHTML = `<span style="color:var(--neon-cyan); font-size:0.85rem;">👤 BẠN LÀ NGƯỜI CHƠI (MC: ${escapeHtml(hostName)})</span>`;
    }
  }
}

// Render Game Screen
function renderGame(room) {
  const me = room.me;
  if (!me || !room.question) return;

  const isPresenter = isHost || (me && me.isSpectator);

  // Header counters
  qCurrentIndex.textContent = room.question.index;
  qTotal.textContent = room.totalQuestions;

  // Render Event / Golden / Sudden Death Banner
  renderEventBanners(room);

  // Toggle elements for Host vs Player
  if (isPresenter) {
    if (myScoreDisplay) myScoreDisplay.style.display = 'none';
    if (furyContainerBox) furyContainerBox.style.display = 'none';
    if (playerSkillsBar) playerSkillsBar.style.display = 'none';
    if (btnHostSkipQ) {
      btnHostSkipQ.style.display = 'block';
      btnHostSkipQ.textContent = '👑 Chiếu Kết Quả & BXH ➡️';
    }
    if (hostLiveTracker) hostLiveTracker.style.display = 'block';
  } else {
    if (myScoreDisplay) {
      myScoreDisplay.style.display = 'block';
      myScoreDisplay.textContent = `${me.score}đ`;
    }
    if (furyContainerBox) furyContainerBox.style.display = 'flex';
    if (playerSkillsBar) playerSkillsBar.style.display = 'block';
    if (btnHostSkipQ) btnHostSkipQ.style.display = 'none';
    if (hostLiveTracker) hostLiveTracker.style.display = 'none';
  }

  // Fury meter rendering (for players)
  if (!isPresenter) {
    const currentFury = me.fury || 0;
    furySlots.forEach((slot, idx) => {
      if (idx < currentFury) {
        slot.classList.add('active');
      } else {
        slot.classList.remove('active');
      }
    });
    handleDebuffs(me.debuffs, room.question.id);
  }

  // Question text
  questionText.textContent = room.question.question;

  const prefixLetters = ['A', 'B', 'C', 'D'];
  const isSilenced = !!(me.debuffs && me.debuffs.silenced);
  const isFrozen = !!(me.debuffs && me.debuffs.frozen);
  const is5050 = !!(me.buffs && me.buffs.eagle5050);

  let hiddenOpts = [];
  if (is5050 && room.state === 'QUESTION') {
    hiddenOpts = [1, 3];
  }

  let optionIndices = [0, 1, 2, 3];
  if (me.debuffs && me.debuffs.scrambleKeys) {
    optionIndices = [3, 1, 0, 2];
  }

  if (isPresenter) {
    // HOST VIEW: Options displayed without knowing answer beforehand, non-clickable
    if (renderedQuestionId !== room.question.id) {
      renderedQuestionId = room.question.id;
      optionsGrid.innerHTML = '';
      (room.question.options || []).forEach((optText, optIdx) => {
        const optBtn = document.createElement('div');
        optBtn.className = 'option-btn';
        optBtn.dataset.optIdx = optIdx;
        optBtn.innerHTML = `
          <div class="option-prefix">${prefixLetters[optIdx]}</div>
          <div style="flex:1;">${escapeHtml(optText)}</div>
        `;
        optionsGrid.appendChild(optBtn);
      });
    }

    // Render Live Answer Tracking for all players
    const answeredCount = room.players.filter(p => p.hasAnswered).length;
    if (hostAnswerProgress) hostAnswerProgress.textContent = `${answeredCount}/${room.players.length} người chơi`;
    if (hostPlayerAnswerList) {
      hostPlayerAnswerList.innerHTML = '';
      room.players.forEach(p => {
        const chip = document.createElement('div');
        chip.style.cssText = `
          display:flex; align-items:center; gap:6px; padding:4px 8px; border-radius:6px; font-size:0.75rem; font-weight:700;
          background:${p.hasAnswered ? 'rgba(0, 245, 212, 0.15)' : 'rgba(255, 255, 255, 0.05)'};
          border:1px solid ${p.hasAnswered ? 'var(--neon-cyan)' : 'rgba(255, 255, 255, 0.1)'};
          color:${p.hasAnswered ? 'var(--neon-cyan)' : 'var(--text-muted)'};
        `;
        chip.innerHTML = `
          <span>${p.avatar}</span>
          <span style="max-width:90px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(p.name)}</span>
          <span style="margin-left:auto;">${p.hasAnswered ? '✅' : '⏳'}</span>
        `;
        hostPlayerAnswerList.appendChild(chip);
      });
    }
    return; // Exit renderGame for Host
  }

  // PLAYER VIEW: Normal clickable options
  const isQuestionNew = (renderedQuestionId !== room.question.id);
  if (isQuestionNew) {
    renderedQuestionId = room.question.id;
    optionsGrid.innerHTML = '';

    optionIndices.forEach((optIdx, displayIdx) => {
      const optBtn = document.createElement('button');
      optBtn.className = 'option-btn';
      optBtn.dataset.optIdx = optIdx;

      if (hiddenOpts.includes(optIdx)) {
        optBtn.classList.add('disabled');
        optBtn.innerHTML = `
          <div class="option-prefix">${prefixLetters[displayIdx]}</div>
          <div>(Đã bị loại 50/50)</div>
        `;
        optionsGrid.appendChild(optBtn);
        return;
      }

      if (isSilenced || isFrozen) {
        optBtn.classList.add('disabled');
      }

      if (me.answered && me.selectedAnswer === optIdx) {
        optBtn.classList.add('selected');
      }

      optBtn.innerHTML = `
        <div class="option-prefix">${prefixLetters[displayIdx]}</div>
        <div style="flex:1;">${escapeHtml(room.question.options[optIdx])}</div>
      `;

      optBtn.addEventListener('click', () => {
        if (room.state !== 'QUESTION' || me.answered || isSilenced || isFrozen) return;
        selectedAnswer = optIdx;
        optBtn.classList.add('selected');
        window.soundEngine.playTick();

        socket.emit('submit_answer', {
          code: currentRoomCode,
          answerIndex: optIdx,
          timeLeft: room.timeLeft
        });
      });

      optionsGrid.appendChild(optBtn);
    });
  } else {
    // Only update existing buttons in-place (zero DOM thrashing while other players answer)
    const buttons = optionsGrid.querySelectorAll('.option-btn');
    buttons.forEach(optBtn => {
      const optIdx = parseInt(optBtn.dataset.optIdx, 10);
      if (hiddenOpts.includes(optIdx) || isSilenced || isFrozen) {
        optBtn.classList.add('disabled');
      } else {
        optBtn.classList.remove('disabled');
      }

      if (me.answered && me.selectedAnswer === optIdx) {
        optBtn.classList.add('selected');
      }
    });
  }

  if (room.state === 'REVEAL' && room.question.explanation) {
    explanationBox.style.display = 'block';
    const isCorrect = me.selectedAnswer === room.question.answer;
    explanationBox.innerHTML = `
      <div style="font-weight:800; font-size:1rem; margin-bottom:4px;">
        ${isCorrect ? '🎉 Bạn đã trả lời ĐÚNG!' : '😅 Bạn đã trả lời SAI!'}
      </div>
      <div>💡 <strong>Giải thích:</strong> ${escapeHtml(room.question.explanation)}</div>
    `;
    if (isCorrect) {
      window.soundEngine.playCorrect();
    } else {
      window.soundEngine.playWrong();
    }
  } else {
    explanationBox.style.display = 'none';
  }

  renderMySkills(me.skills || []);
}

// Render Skill Phase Screen
function renderSkillPhase(room) {
  const me = room.me;
  const container = document.getElementById('skill-phase-cards');
  container.innerHTML = '';

  if (!me || !me.skills || me.skills.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:20px;">Bạn chưa có kỹ năng nào. Hãy tích cực trả lời đúng để tích nộ!</div>`;
    return;
  }

  me.skills.forEach(skill => {
    const rarity = skill.rarity || 'common';
    const rarityName = skill.rarityName || (rarity === 'legendary' ? 'Huyền Thoại' : (rarity === 'epic' ? 'Sử Thi' : (rarity === 'rare' ? 'Hiếm' : 'Phổ Thông')));
    const card = document.createElement('div');
    card.className = `glass-card skill-card-${rarity} ${rarity === 'legendary' ? 'glow-legendary' : ''}`;
    card.style.marginBottom = '12px';
    card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:24px;">${skill.icon}</span>
          <div>
            <span style="font-weight:800; font-size:1.05rem;">${escapeHtml(skill.name)}</span>
            <span class="rarity-badge rarity-badge-${rarity}" style="margin-left:6px;">${escapeHtml(rarityName)}</span>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-use-${skill.uid || skill.id}">KÍCH HOẠT</button>
      </div>
      <div style="font-size:0.88rem; color:var(--text-muted); line-height:1.4;">${escapeHtml(skill.desc)}</div>
    `;

    card.querySelector(`#btn-use-${skill.uid || skill.id}`).addEventListener('click', () => {
      promptSkillUsage(skill);
    });

    container.appendChild(card);
  });
}

// Render Skills in in-game footer
function renderMySkills(skills) {
  skillsList.innerHTML = '';
  if (skills.length === 0) {
    skillsList.innerHTML = `<span style="font-size:0.8rem; color:var(--text-muted);">Chưa có kỹ năng. Trả lời đúng để tích nộ!</span>`;
    return;
  }

  skills.forEach(skill => {
    const rarity = skill.rarity || 'common';
    const chip = document.createElement('div');
    chip.className = `skill-chip skill-card-${rarity}`;
    chip.innerHTML = `
      <span class="skill-chip-icon">${skill.icon}</span>
      <span class="skill-chip-name">${escapeHtml(skill.name)}</span>
      <span class="rarity-badge rarity-badge-${rarity}" style="font-size:0.6rem; padding:1px 5px;">${escapeHtml(skill.rarityName || '')}</span>
    `;
    chip.addEventListener('click', () => {
      promptSkillUsage(skill);
    });
    skillsList.appendChild(chip);
  });
}

// Skill usage prompt (target picker or instant)
function promptSkillUsage(skill) {
  const me = currentGameState && currentGameState.me;
  if (!me || !me.canUseSkill) {
    if (me && me.fury >= 3) {
      showToast('⏳ Bạn đã đủ 3 Nộ nhưng lượt này đang nhường quyền cho 2 người điểm thấp nhất!');
    } else {
      showToast(`⚡ Cần tích lũy đủ 3 Nộ và nằm trong 2 người điểm thấp nhất để tung kỹ năng! (Hiện có: ${me ? me.fury : 0}/3)`);
    }
    window.soundEngine.playWrong();
    return;
  }

  selectedSkillToUse = skill;

  // Skills requiring target selection
  if (skill.target === 'choose_one') {
    showTargetSelector(skill);
  } else {
    // Instant or self target
    socket.emit('use_skill', {
      code: currentRoomCode,
      skillId: skill.id,
      targetId: null
    });
    window.soundEngine.playSkill();
  }
}

// Target selector modal
function showTargetSelector(skill) {
  targetList.innerHTML = '';
  const opponents = currentGameState.players.filter(p => p.id !== myPlayerId);

  if (opponents.length === 0) {
    showToast('Không có đối thủ nào khác trong phòng!');
    return;
  }

  opponents.forEach(opp => {
    const item = document.createElement('div');
    item.className = 'target-item';
    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:22px;">${opp.avatar}</span>
        <span style="font-weight:700;">${escapeHtml(opp.name)}</span>
      </div>
      <div style="font-weight:800; color:var(--neon-gold);">${opp.score}đ</div>
    `;

    item.addEventListener('click', () => {
      targetModal.classList.remove('active');
      socket.emit('use_skill', {
        code: currentRoomCode,
        skillId: skill.id,
        targetId: opp.id
      });
      window.soundEngine.playSkill();
    });

    targetList.appendChild(item);
  });

  targetModal.classList.add('active');
}

btnCloseTargetModal.addEventListener('click', () => {
  targetModal.classList.remove('active');
});

// All Skills Reference Modal
btnAllSkillsModal.addEventListener('click', () => {
  allSkillsModal.classList.add('active');
});
btnCloseSkillsModal.addEventListener('click', () => {
  allSkillsModal.classList.remove('active');
});

// Live Leaderboard Modal
btnLeaderboardModal.addEventListener('click', () => {
  renderLiveLeaderboardModal();
  leaderboardModal.classList.add('active');
  window.soundEngine.playTick();
});
btnCloseLeaderboardModal.addEventListener('click', () => {
  leaderboardModal.classList.remove('active');
});
leaderboardModal.addEventListener('click', (e) => {
  if (e.target === leaderboardModal) {
    leaderboardModal.classList.remove('active');
  }
});

function renderLiveLeaderboardModal() {
  if (!liveLeaderboardList) return;
  liveLeaderboardList.innerHTML = '';

  const players = (currentGameState && currentGameState.players) ? [...currentGameState.players] : [];
  if (players.length === 0) {
    liveLeaderboardList.innerHTML = `
      <div style="text-align:center; padding:24px 12px; color:var(--text-muted); line-height:1.5;">
        <div style="font-size:32px; margin-bottom:8px;">🏁</div>
        <div style="font-weight:800; color:#fff; font-size:1rem; margin-bottom:4px;">Chưa vào phòng chơi</div>
        <div style="font-size:0.85rem;">Hãy tạo phòng mới hoặc nhập mã phòng để bắt đầu cuộc đua bảng xếp hạng cùng bạn bè!</div>
      </div>
    `;
    return;
  }

  // Sort descending by score
  players.sort((a, b) => b.score - a.score);

  players.forEach((p, idx) => {
    const card = document.createElement('div');
    card.className = 'player-card';
    card.style.marginBottom = '6px';
    if (p.id === myPlayerId) {
      card.style.borderColor = 'var(--neon-cyan)';
      card.style.background = 'rgba(0, 245, 212, 0.1)';
    }

    // Rank styling
    let rankColor = 'var(--text-muted)';
    if (idx === 0) rankColor = 'var(--neon-gold)';
    else if (idx === 1) rankColor = '#e2e8f0';
    else if (idx === 2) rankColor = '#d97706';

    // Status auras badges
    let statusTags = '';
    if (p.buffs && p.buffs.divineShield) statusTags += `<span title="Khiên Thần" style="font-size:14px;">🛡️</span>`;
    if (p.debuffs && p.debuffs.timeBomb) statusTags += `<span title="Bom" style="font-size:14px;">💣</span>`;
    if (p.debuffs && p.debuffs.frozen) statusTags += `<span title="Băng" style="font-size:14px;">🧊</span>`;
    if (p.buffs && p.buffs.boost50) statusTags += `<span title="+50% Điểm" style="font-size:14px;">⚡</span>`;
    if (p.debuffs && p.debuffs.silenced) statusTags += `<span title="Cấm ngôn" style="font-size:14px;">🔒</span>`;
    if (p.buffs && p.buffs.reflectMirror) statusTags += `<span title="Gương" style="font-size:14px;">🪞</span>`;

    // Skills count
    const skillsCount = (p.skills && p.skills.length) || p.skillsCount || 0;

    card.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-weight:900; font-size:1.05rem; color:${rankColor}; width:24px; text-align:center;">#${idx + 1}</span>
        <span style="font-size:24px;">${p.avatar}</span>
        <div>
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-weight:800; font-size:0.95rem;">${escapeHtml(p.name)}</span>
            ${p.id === myPlayerId ? '<span class="player-tag">Bạn</span>' : ''}
          </div>
          <div style="font-size:0.75rem; color:var(--text-muted); display:flex; gap:8px; align-items:center; margin-top:2px;">
            <span>⚡ Nộ: ${p.fury || 0}/3</span>
            <span>🎒 ${skillsCount} kỹ năng</span>
            <span>${statusTags}</span>
          </div>
        </div>
      </div>
      <div style="font-weight:900; font-size:1.1rem; color:var(--neon-gold);">${p.score}đ</div>
    `;

    liveLeaderboardList.appendChild(card);
  });
}

// Skill History Modal Handlers & Renderer
function openSkillHistoryModal() {
  renderSkillHistoryModal();
  if (skillHistoryModal) skillHistoryModal.classList.add('active');
  if (window.soundEngine) window.soundEngine.playTick();
}

if (btnSkillHistoryModal) {
  btnSkillHistoryModal.addEventListener('click', openSkillHistoryModal);
}
if (btnQuickSkillHistory) {
  btnQuickSkillHistory.addEventListener('click', openSkillHistoryModal);
}
if (btnCloseSkillHistoryModal) {
  btnCloseSkillHistoryModal.addEventListener('click', () => {
    if (skillHistoryModal) skillHistoryModal.classList.remove('active');
  });
}
if (skillHistoryModal) {
  skillHistoryModal.addEventListener('click', (e) => {
    if (e.target === skillHistoryModal) {
      skillHistoryModal.classList.remove('active');
    }
  });
}

function renderSkillHistoryModal() {
  if (!skillHistoryList) return;
  skillHistoryList.innerHTML = '';

  const history = (currentGameState && currentGameState.skillHistory) ? currentGameState.skillHistory : [];
  if (history.length === 0) {
    skillHistoryList.innerHTML = `
      <div style="text-align:center; padding:28px 12px; color:var(--text-muted); line-height:1.5;">
        <div style="font-size:32px; margin-bottom:8px;">⚔️</div>
        <div style="font-weight:800; color:#fff; font-size:1rem; margin-bottom:4px;">Chưa có kỹ năng nào được sử dụng</div>
        <div style="font-size:0.85rem;">Khi các đấu thủ tích đủ nộ và tung chiêu, toàn bộ lịch sử đấu phép và kết quả tác động sẽ được lưu lại tại đây!</div>
      </div>
    `;
    return;
  }

  history.forEach(item => {
    const card = document.createElement('div');
    const rarity = item.rarity || 'common';
    card.className = `glass-card skill-card-${rarity}`;
    card.style.marginBottom = '6px';
    card.style.padding = '12px 14px';

    const timeStr = item.time ? new Date(item.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
    const qBadge = item.questionNumber ? `<span style="font-size:0.75rem; font-weight:800; color:var(--neon-gold); background:rgba(255,215,0,0.15); border:1px solid rgba(255,215,0,0.3); padding:2px 6px; border-radius:4px;">Câu ${item.questionNumber}</span>` : '';

    let targetInfo = '';
    if (item.targetName) {
      targetInfo = `
        <div style="display:flex; align-items:center; gap:6px; font-size:0.8rem; color:var(--text-muted); margin-top:4px;">
          <span>🎯 Mục tiêu:</span>
          <span style="font-weight:700; color:#fff;">${escapeHtml(item.targetAvatar ? item.targetAvatar + ' ' : '')}${escapeHtml(item.targetName)}</span>
        </div>
      `;
    }

    let outcomeInfo = '';
    if (item.outcome) {
      outcomeInfo = `
        <div style="font-size:0.82rem; color:${item.blocked ? 'var(--neon-pink)' : 'var(--neon-cyan)'}; margin-top:4px; font-weight:600;">
          ${item.blocked ? '🛡️' : '⚡'} ${escapeHtml(item.outcome)}
        </div>
      `;
    }

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:22px;">${item.casterAvatar || '👤'}</span>
          <span style="font-weight:800; font-size:0.95rem; color:#fff;">${escapeHtml(item.casterName)}</span>
          <span class="rarity-badge rarity-badge-${rarity}">${escapeHtml(item.rarityName || '')}</span>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          ${qBadge}
          <span style="font-size:0.75rem; color:var(--text-muted);">${timeStr}</span>
        </div>
      </div>

      <div style="display:flex; align-items:center; gap:6px; margin:4px 0;">
        <span style="font-size:20px;">${item.skillIcon}</span>
        <span style="font-weight:800; color:${item.rarityColor || '#fff'}; font-size:0.95rem;">${escapeHtml(item.skillName)}</span>
      </div>

      ${targetInfo}
      ${outcomeInfo}
    `;

    skillHistoryList.appendChild(card);
  });
}

// Handle Debuffs visually (Ink, screen shake, scramble)
function handleDebuffs(debuffs, qId) {
  if (!debuffs) return;
  if (handledDebuffQuestionId === qId) return;
  handledDebuffQuestionId = qId;

  // Ink blind
  if (debuffs.inkBlind) {
    triggerInkBlindness();
  }

  // Screen shake / tornado
  if (debuffs.screenShake) {
    triggerScreenShake();
  }
}

// Octopus Ink scratch-off canvas feature
function triggerInkBlindness() {
  inkCanvas.classList.add('active');
  inkHint.style.display = 'block';

  inkCanvas.width = window.innerWidth;
  inkCanvas.height = window.innerHeight;
  inkCanvasCtx = inkCanvas.getContext('2d');

  // Fill canvas with thick black-purple squid ink splatters
  inkCanvasCtx.fillStyle = 'rgba(10, 8, 20, 0.95)';
  inkCanvasCtx.fillRect(0, 0, inkCanvas.width, inkCanvas.height);

  // Draw some gooey ink splat blobs
  for (let i = 0; i < 15; i++) {
    const rx = Math.random() * inkCanvas.width;
    const ry = Math.random() * inkCanvas.height;
    const r = Math.random() * 80 + 40;
    inkCanvasCtx.beginPath();
    inkCanvasCtx.arc(rx, ry, r, 0, Math.PI * 2);
    inkCanvasCtx.fillStyle = '#05020c';
    inkCanvasCtx.fill();
  }

  let clearedPixels = 0;

  function scratch(e) {
    const rect = inkCanvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;

    inkCanvasCtx.globalCompositeOperation = 'destination-out';
    inkCanvasCtx.beginPath();
    inkCanvasCtx.arc(x, y, 45, 0, Math.PI * 2);
    inkCanvasCtx.fill();

    clearedPixels++;
    if (clearedPixels > 60) {
      inkCanvas.classList.remove('active');
      inkHint.style.display = 'none';
      clearedPixels = 0;
      showToast('🧽 Bạn đã lau sạch vết mực!');
    }
  }

  inkCanvas.onmousemove = scratch;
  inkCanvas.ontouchmove = scratch;
}

function triggerScreenShake() {
  appContainer.classList.add('screen-shake');
  setTimeout(() => {
    appContainer.classList.remove('screen-shake');
  }, 1200);
}

// Victory Podium Render
function renderVictoryPodium(rankings, mvpAwards) {
  const p1 = rankings[0];
  const p2 = rankings[1];
  const p3 = rankings[2];

  const p1El = document.getElementById('podium-p1');
  const p2El = document.getElementById('podium-p2');
  const p3El = document.getElementById('podium-p3');

  if (p1 && p1El) {
    p1El.querySelector('.podium-avatar').innerHTML = `<span class="podium-crown">👑</span>${p1.avatar}`;
    p1El.querySelector('.podium-name').textContent = p1.name;
    p1El.querySelector('.podium-score').textContent = `${p1.score}đ`;
  }
  if (p2 && p2El) {
    p2El.querySelector('.podium-avatar').textContent = p2.avatar;
    p2El.querySelector('.podium-name').textContent = p2.name;
    p2El.querySelector('.podium-score').textContent = `${p2.score}đ`;
  }
  if (p3 && p3El) {
    p3El.querySelector('.podium-avatar').textContent = p3.avatar;
    p3El.querySelector('.podium-name').textContent = p3.name;
    p3El.querySelector('.podium-score').textContent = `${p3.score}đ`;
  }

  // Render Funny MVP Awards
  if (mvpAwardsGrid) {
    mvpAwardsGrid.innerHTML = '';
    const awards = mvpAwards || [];
    if (awards.length === 0) {
      if (mvpAwardsSection) mvpAwardsSection.style.display = 'none';
    } else {
      if (mvpAwardsSection) mvpAwardsSection.style.display = 'block';
      awards.forEach(award => {
        const card = document.createElement('div');
        card.className = 'mvp-card';
        card.innerHTML = `
          <div class="mvp-card-header">
            <span class="mvp-card-title">${escapeHtml(award.title)}</span>
          </div>
          <div class="mvp-winner-box">
            <span class="mvp-winner-avatar">${award.player ? award.player.avatar : '👤'}</span>
            <span class="mvp-winner-name">${award.player ? escapeHtml(award.player.name) : 'Ẩn danh'}</span>
          </div>
          <div class="mvp-card-desc">${escapeHtml(award.desc)}</div>
        `;
        mvpAwardsGrid.appendChild(card);
      });
    }
  }

  // Full rankings list table
  const rankTable = document.getElementById('final-rankings-list');
  rankTable.innerHTML = '';
  rankings.forEach(p => {
    const row = document.createElement('div');
    row.className = 'player-card';
    row.style.marginBottom = '6px';
    row.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-weight:900; width:20px;">#${p.rank}</span>
        <span style="font-size:22px;">${p.avatar}</span>
        <span style="font-weight:700;">${escapeHtml(p.name)}</span>
      </div>
      <div style="font-weight:800; color:var(--neon-gold);">${p.score}đ</div>
    `;
    rankTable.appendChild(row);
  });
}

// Confetti Animation for End Game
function launchConfetti() {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#00f5d4', '#7928ca', '#ff007f', '#ffb703', '#06d6a0'];

  for (let i = 0; i < 120; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      speedY: Math.random() * 4 + 2,
      speedX: (Math.random() - 0.5) * 3,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 8
    });
  }

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.y += p.speedY;
      p.x += p.speedX;
      p.rotation += p.rotSpeed;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });

    frame++;
    if (frame < 220) {
      requestAnimationFrame(animate);
    } else {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
  }
  animate();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================
// RACETRACK LEADERBOARD & SKILL VISUAL EFFECTS CONTROLLER
// ============================================================
let racetrackTimerInterval = null;

function renderRacetrack(room) {
  const me = room.me;
  if (!me) return;

  // 1. Play engine revving sound
  window.soundEngine.playEngineRev();

  // Render Event / Golden / Sudden Death Banner on Racetrack
  renderEventBanners(room);

  // Fog event effect on racetrack
  if (racetrackLanes) {
    if (room.activeEvent && room.activeEvent.type === 'FOG') {
      racetrackLanes.style.filter = 'blur(4px) opacity(0.65)';
    } else {
      racetrackLanes.style.filter = '';
    }
  }

  // 2. Render answer recap banner
  if (room.question && room.question.answer !== undefined) {
    const answerChars = ['A', 'B', 'C', 'D'];
    const ansChar = answerChars[room.question.answer] || '';
    const ansText = (room.question.options && room.question.options[room.question.answer]) || '';

    if (isHost) {
      racetrackAnswerRecap.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; flex-wrap:wrap; gap:4px;">
          <span style="font-weight:900; color:var(--neon-green); font-size:0.92rem;">
            👑 BẢNG TỔNG KẾT CÂU HỎI (MC VIEW)
          </span>
          <span style="font-weight:800; font-size:0.85rem; color:var(--neon-cyan);">
            Đáp án: ${ansChar} - ${escapeHtml(ansText)}
          </span>
        </div>
        <div style="font-size:0.8rem; color:var(--text-muted); line-height:1.35;">
          💡 ${escapeHtml(room.question.explanation || '')}
        </div>
      `;
    } else {
      const hasAnswered = me.answered && me.selectedAnswer !== null && me.selectedAnswer !== undefined;
      const isCorrect = hasAnswered && me.selectedAnswer === room.question.answer;
      let resultTitle = '⏰ HẾT GIỜ! Bạn chưa kịp trả lời (0đ)';
      let resultColor = 'var(--neon-orange)';
      if (hasAnswered) {
        if (isCorrect) {
          resultTitle = `🎉 BẠN ĐÃ TRẢ LỜI ĐÚNG (+${me.lastPointsGained || 0}đ)!`;
          resultColor = 'var(--neon-green)';
        } else {
          resultTitle = '❌ BẠN ĐÃ TRẢ LỜI SAI (0đ)!';
          resultColor = 'var(--neon-red)';
        }
      }
      
      racetrackAnswerRecap.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; flex-wrap:wrap; gap:4px;">
          <span style="font-weight:900; color:${resultColor}; font-size:0.92rem;">
            ${resultTitle}
          </span>
          <span style="font-weight:800; font-size:0.82rem; color:var(--neon-cyan);">
            Đáp án: ${ansChar} - ${escapeHtml(ansText)}
          </span>
        </div>
        <div style="font-size:0.8rem; color:var(--text-muted); line-height:1.35;">
          💡 ${escapeHtml(room.question.explanation || '')}
        </div>
      `;

      if (isCorrect && me.lastPointsGained > 0) {
        setTimeout(() => {
          window.soundEngine.playNitro();
        }, 350);
      }
    }
  }

  // 3. Countdown timer on race track (10 seconds)
  if (racetrackTimerInterval) clearInterval(racetrackTimerInterval);
  let timeLeft = room.revealTimeLeft !== undefined ? room.revealTimeLeft : 10;
  racetrackCountdown.textContent = timeLeft > 0 ? `${timeLeft}s` : 'Chuẩn bị câu kế...';
  racetrackTimerInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft > 0) {
      racetrackCountdown.textContent = `${timeLeft}s`;
    } else {
      racetrackCountdown.textContent = 'Chuẩn bị câu kế...';
      clearInterval(racetrackTimerInterval);
    }
  }, 1000);

  // Host Next Question Bar rendering on Racetrack
  if (isHost) {
    if (hostRacetrackBar) hostRacetrackBar.style.display = 'block';
    if (guestRacetrackBar) guestRacetrackBar.style.display = 'none';
    const nextQNum = (room.questionIndex !== undefined ? room.questionIndex : 0) + 2;
    const totalQ = room.totalQuestions || 20;
    if (hostNextBtnText) {
      if (nextQNum <= totalQ) {
        hostNextBtnText.textContent = `CÂU HỎI TIẾP THEO (${nextQNum}/${totalQ}) ➡️`;
      } else {
        hostNextBtnText.textContent = `XEM TỔNG KẾT & QUÁN QUÂN 🏆`;
      }
    }
  } else {
    if (hostRacetrackBar) hostRacetrackBar.style.display = 'none';
    if (guestRacetrackBar) guestRacetrackBar.style.display = 'block';
  }

  // 4. Sort players by score for the racetrack lanes
  const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
  const maxScore = Math.max(...room.players.map(p => p.score || 0), 100);
  const TARGET_SCORE = Math.max((room.totalQuestions || 20) * 75, Math.ceil(maxScore * 1.15));

  racetrackLanes.innerHTML = '';
  const VEHICLES = ['🏎️', '🚀', '🏍️', '🛸', '🏎️', '🚀', '🏍️', '🛸', '🏎️', '🚀'];

  sortedPlayers.forEach((p, idx) => {
    const lane = document.createElement('div');
    lane.className = `racetrack-lane ${p.onFire ? 'lane-on-fire' : ''}`;
    lane.id = `lane-${p.id}`;

    // Calculate progression percentage (from prevScore to current score)
    const prevPct = Math.min(88, Math.max(3, ((p.prevScore || 0) / TARGET_SCORE) * 85));
    const currPct = Math.min(88, Math.max(3, ((p.score || 0) / TARGET_SCORE) * 85));

    // Vehicle icon
    const vehicleIcon = VEHICLES[idx % VEHICLES.length];

    // Active status auras on racer
    let auraHtml = '';
    if (p.buffs && p.buffs.divineShield) auraHtml += `<div class="racer-aura-shield" title="Khiên Thần Thánh (Miễn nhiễm)"></div>`;
    if (p.debuffs && p.debuffs.timeBomb) auraHtml += `<div class="racer-aura-bomb" title="Bom Hẹn Giờ (Sắp nổ)">💣</div>`;
    if (p.debuffs && p.debuffs.frozen) auraHtml += `<div class="racer-aura-ice" title="Đang bị đóng băng">🧊</div>`;
    if (p.buffs && p.buffs.boost50) auraHtml += `<div class="racer-aura-boost" title="+50% Điểm">⚡</div>`;
    if (p.debuffs && p.debuffs.silenced) auraHtml += `<div class="racer-aura-silence" title="Bị cấm ngôn">🔒</div>`;
    if (p.debuffs && p.debuffs.inkBlind) auraHtml += `<div class="racer-aura-ink" title="Bị dính mực"></div>`;
    if (p.buffs && p.buffs.reflectMirror) auraHtml += `<div class="racer-aura-mirror" title="Gương phản chiếu"></div>`;

    // Nitro flame & floating delta points
    let boostHtml = '';
    if (p.lastPointsGained > 0) {
      boostHtml = `
        <div class="nitro-flame">🔥</div>
        <div class="racer-score-delta">+${p.lastPointsGained}đ</div>
      `;
    }

    // Skills badges displayed on the lane
    let skillsBadgesHtml = '';
    if (p.skills && p.skills.length > 0) {
      skillsBadgesHtml = `<div class="lane-skills-badges">`;
      p.skills.forEach(sk => {
        skillsBadgesHtml += `
          <div class="skill-lane-chip" title="${escapeHtml(sk.name)}: ${escapeHtml(sk.desc)}" data-skill-id="${sk.id}" data-owner-id="${p.id}">
            <span>${sk.icon}</span>
            <span style="font-size:0.65rem;">${escapeHtml(sk.name.split(' ')[0])}</span>
          </div>
        `;
      });
      skillsBadgesHtml += `</div>`;
    }

    const onFireBadge = p.onFire ? '<span class="on-fire-badge">🔥 RỰC LỬA (+20%)</span>' : '';
    const streakBadge = (p.streak >= 2 && !p.onFire) ? `<span style="font-size:0.65rem; color:#ffb703; font-weight:800; margin-left:3px;">⚡x${p.streak}</span>` : '';

    lane.innerHTML = `
      <div class="lane-rank-badge ${idx === 0 ? 'top-1' : ''}">#${idx + 1}</div>
      <div class="racer-kart" id="racer-${p.id}" style="left: ${prevPct}%;">
        ${boostHtml}
        <div class="racer-vehicle-box">
          <span class="racer-avatar">${p.avatar}</span>
          <span class="racer-kart-icon">${vehicleIcon}</span>
          ${auraHtml}
        </div>
        <div class="racer-info-tag">
          <span class="racer-name" style="${p.id === myPlayerId ? 'color:var(--neon-cyan);' : ''}">${escapeHtml(p.name)}</span>
          ${onFireBadge}
          ${streakBadge}
          <span class="racer-score">${p.score}đ</span>
        </div>
      </div>
      ${skillsBadgesHtml}
    `;

    // Allow user to click their own skill chips directly on their lane
    if (p.id === myPlayerId) {
      lane.querySelectorAll('.skill-lane-chip').forEach((chipEl, skIdx) => {
        chipEl.style.cursor = 'pointer';
        chipEl.style.borderColor = 'var(--neon-cyan)';
        chipEl.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetSkill = p.skills[skIdx];
          if (targetSkill) promptSkillUsage(targetSkill);
        });
      });
    }

    racetrackLanes.appendChild(lane);

    // Animate racer zooming smoothly to new position with nitro flame
    setTimeout(() => {
      const racerEl = document.getElementById(`racer-${p.id}`);
      if (racerEl) {
        racerEl.style.left = `${currPct}%`;
      }
    }, 150 + idx * 40);
  });

  // 5. Render quick skills bar at bottom of racetrack (Only for competing players, NOT for Host)
  if (isHost) {
    if (racetrackSkillBarEl) racetrackSkillBarEl.style.display = 'none';
  } else {
    if (racetrackSkillBarEl) racetrackSkillBarEl.style.display = 'flex';
    renderRacetrackSkills(me);
  }
}

function renderRacetrackSkills(me) {
  racetrackSkillsList.innerHTML = '';
  
  const canUse = !!me.canUseSkill;
  const furyCount = me.fury || 0;

  if (canUse) {
    racetrackFuryIndicator.className = 'fury-eligible-text';
    racetrackFuryIndicator.textContent = `🔥 ĐƯỢC TUNG KỸ NĂNG! (Nộ: ${furyCount}/3)`;
  } else if (furyCount >= 3) {
    racetrackFuryIndicator.className = 'fury-waiting-text';
    racetrackFuryIndicator.textContent = `⏳ Đã đủ 3 Nộ (Chờ lượt)`;
  } else {
    racetrackFuryIndicator.className = '';
    racetrackFuryIndicator.textContent = `⚡ Nộ: ${furyCount}/3`;
  }

  if (racetrackPermissionBanner) {
    if (canUse) {
      racetrackPermissionBanner.innerHTML = `
        <div class="skill-permission-banner banner-eligible">
          <span>🔥 <b>BẠN ĐƯỢC QUYỀN TUNG CHIÊU!</b> Nhấn nút <b>DÙNG</b> bên dưới (Còn lại trong 10s). Sau khi dùng sẽ mất hết điểm Nộ!</span>
        </div>
      `;
    } else if (furyCount >= 3) {
      racetrackPermissionBanner.innerHTML = `
        <div class="skill-permission-banner banner-waiting">
          <span>⏳ <b>BẠN ĐÃ ĐỦ 3 NỘ:</b> Lượt này đang nhường quyền tung chiêu cho 2 người có điểm thấp nhất bảng. Lượt tới nếu điểm bạn thấp nhất sẽ được dùng!</span>
        </div>
      `;
    } else {
      const currentQIdx = (currentGameState && currentGameState.questionIndex !== undefined) ? currentGameState.questionIndex : 0;
      const furyNote = currentQIdx < 3
        ? `3 câu đầu tiên trả lời ĐÚNG hay SAI đều được +1 Nộ! Cả đội sẽ full nộ sau câu 3.`
        : `Trả lời đúng để tích Nộ. Khi đủ 3 Nộ và nằm trong 2 người điểm thấp nhất, bạn sẽ được tung kỹ năng!`;
      racetrackPermissionBanner.innerHTML = `
        <div class="skill-permission-banner banner-accumulate">
          <span>⚡ <b>TÍCH LŨY NỘ (${furyCount}/3):</b> ${furyNote}</span>
        </div>
      `;
    }
  }

  if (!me.skills || me.skills.length === 0) {
    racetrackSkillsList.innerHTML = `<span style="font-size:0.8rem; color:var(--text-muted); padding:4px 0;">Chưa có kỹ năng trong túi đồ. Hãy tích cực trả lời đúng để tích nộ!</span>`;
    return;
  }

  me.skills.forEach(skill => {
    const rarity = skill.rarity || 'common';
    const chip = document.createElement('div');
    chip.className = `skill-chip skill-card-${rarity} ${canUse ? 'eligible-chip' : 'disabled-chip'}`;
    const btnLabel = canUse ? 'DÙNG' : (furyCount >= 3 ? '🔒 CHỜ LƯỢT' : '🔒 CẦN 3 NỘ');
    const btnStyle = canUse 
      ? 'background:rgba(0,245,212,0.3); color:var(--neon-cyan); border:1px solid var(--neon-cyan);' 
      : 'background:rgba(255,255,255,0.08); color:var(--text-muted); border:1px solid rgba(255,255,255,0.15);';

    chip.innerHTML = `
      <span class="skill-chip-icon">${skill.icon}</span>
      <span class="skill-chip-name">${escapeHtml(skill.name)}</span>
      <span class="rarity-badge rarity-badge-${rarity}" style="font-size:0.6rem; padding:1px 5px;">${escapeHtml(skill.rarityName || '')}</span>
      <span style="font-size:0.7rem; font-weight:800; padding:2px 6px; border-radius:4px; margin-left:4px; ${btnStyle}">${btnLabel}</span>
    `;
    chip.addEventListener('click', () => {
      promptSkillUsage(skill);
    });
    racetrackSkillsList.appendChild(chip);
  });
}

// Skill visual projectile & blast FX on the racetrack
function triggerSkillVisualFX(data) {
  const casterEl = document.getElementById(`racer-${data.casterId}`);
  const targetEl = data.targetId ? document.getElementById(`racer-${data.targetId}`) : null;

  // 1. Explosion Blast FX for Bomb or Earthquake
  if ((data.skillId === 'TIME_BOMB' || data.skillId === 'EARTHQUAKE') && targetEl) {
    const rect = targetEl.getBoundingClientRect();
    const blast = document.createElement('div');
    blast.className = 'skill-blast-fx';
    blast.style.left = `${rect.left + rect.width / 2}px`;
    blast.style.top = `${rect.top + rect.height / 2}px`;
    document.body.appendChild(blast);
    setTimeout(() => {
      if (blast.parentNode) blast.parentNode.removeChild(blast);
    }, 750);
  }

  // 2. Projectile Energy Beam between caster and target on track
  if (casterEl && targetEl && casterEl !== targetEl) {
    const cRect = casterEl.getBoundingClientRect();
    const tRect = targetEl.getBoundingClientRect();

    const beam = document.createElement('div');
    beam.className = 'skill-beam-fx';

    const x1 = cRect.left + cRect.width / 2;
    const y1 = cRect.top + cRect.height / 2;
    const x2 = tRect.left + tRect.width / 2;
    const y2 = tRect.top + tRect.height / 2;

    const length = Math.hypot(x2 - x1, y2 - y1);
    const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

    beam.style.left = `${x1}px`;
    beam.style.top = `${y1}px`;
    beam.style.width = `${length}px`;
    beam.style.transform = `rotate(${angle}deg)`;

    document.body.appendChild(beam);
    setTimeout(() => {
      if (beam.parentNode) beam.parentNode.removeChild(beam);
    }, 600);
  }

  // 3. Swap Top 1 Animation: Quick flash warp effect
  if (data.skillId === 'SWAP_TOP1' && casterEl && targetEl) {
    casterEl.style.transition = 'all 0.6s cubic-bezier(0.68, -0.55, 0.27, 1.55)';
    targetEl.style.transition = 'all 0.6s cubic-bezier(0.68, -0.55, 0.27, 1.55)';
    casterEl.style.filter = 'brightness(2) drop-shadow(0 0 15px var(--neon-cyan))';
    targetEl.style.filter = 'brightness(2) drop-shadow(0 0 15px var(--neon-pink))';
    setTimeout(() => {
      casterEl.style.filter = '';
      targetEl.style.filter = '';
    }, 1000);
  }
}

