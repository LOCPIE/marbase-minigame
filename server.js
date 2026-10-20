const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { SKILLS, RARITY_CONFIG, RARITY_WEIGHTS } = require('./skills');
const questions = require('./data/questions.json');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Store active game rooms
const rooms = new Map();

const BOT_NAMES = [
  'Thánh Troll', 'Bé Bắp', 'Chúa Hề', 'Cao Thủ Ẩn Danh', 
  'Mê Trà Sữa', 'Anh Ba Bựa', 'Sát Thủ Mẹo', 'Gấu Ngủ Gật', 'Chuyên Gia Lạc Đề'
];

const BOT_AVATARS = ['😎', '🤠', '🦄', '🐱', '🤖', '🦊', '🐸', '🦁', '🐼'];

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getRandomSkill() {
  const roll = Math.random() * 100;
  let targetRarity = 'common';
  if (roll < RARITY_WEIGHTS.legendary) {
    targetRarity = 'legendary';
  } else if (roll < RARITY_WEIGHTS.legendary + RARITY_WEIGHTS.epic) {
    targetRarity = 'epic';
  } else if (roll < RARITY_WEIGHTS.legendary + RARITY_WEIGHTS.epic + RARITY_WEIGHTS.rare) {
    targetRarity = 'rare';
  } else {
    targetRarity = 'common';
  }

  const pool = SKILLS.filter(s => s.rarity === targetRarity);
  const selected = (pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null) || SKILLS[Math.floor(Math.random() * SKILLS.length)];
  return { ...selected, uid: 'sk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5) };
}

function getSortedPlayers(room) {
  return [...room.players].sort((a, b) => b.score - a.score);
}

function sanitizeRoomState(room) {
  const safeRoom = {
    code: room.code,
    host: room.host ? { id: room.host.id, name: room.host.name, avatar: room.host.avatar } : null,
    hostId: room.hostId,
    state: room.state,
    questionIndex: room.questionIndex,
    totalQuestions: room.totalQuestions,
    timeLeft: room.timeLeft,
    skillPhaseTimeLeft: room.skillPhaseTimeLeft,
    logs: room.logs.slice(-6),
    skillHistory: (room.skillHistory || []).slice(0, 50),
    eligibleSkillUserIds: room.eligibleSkillUserIds || [],
    revealTimeLeft: room.revealTimeLeft !== undefined ? room.revealTimeLeft : 10,
    isGolden: !!room.isGolden,
    isSuddenDeath: !!room.isSuddenDeath,
    activeEvent: room.activeEvent || null,
    mvpAwards: room.mvpAwards || [],
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      score: p.score,
      prevScore: p.prevScore !== undefined ? p.prevScore : p.score,
      lastPointsGained: p.lastPointsGained || 0,
      fury: p.fury,
      streak: p.streak || 0,
      onFire: !!p.onFire,
      stats: p.stats || { correctCount: 0, wrongCount: 0, totalAnswerTime: 0, skillsUsed: 0, skillsTargeted: 0, pointsStolen: 0 },
      isBot: p.isBot,
      skills: p.skills,
      skillsCount: p.skills.length,
      buffs: { ...p.buffs },
      debuffs: { ...p.debuffs },
      hasAnswered: p.answered
    }))
  };

  // Only send question without answer during QUESTION state
  if (room.currentQuestion) {
    if (room.state === 'QUESTION') {
      safeRoom.question = {
        id: room.currentQuestion.id,
        index: room.questionIndex + 1,
        total: room.totalQuestions,
        question: room.currentQuestion.question,
        options: room.currentQuestion.options
      };
    } else if (room.state === 'REVEAL') {
      safeRoom.question = {
        id: room.currentQuestion.id,
        index: room.questionIndex + 1,
        total: room.totalQuestions,
        question: room.currentQuestion.question,
        options: room.currentQuestion.options,
        answer: room.currentQuestion.answer,
        explanation: room.currentQuestion.explanation
      };
    }
  }

  return safeRoom;
}

function sendPersonalizedState(room) {
  const base = sanitizeRoomState(room);

  // 1. Send personalized state to all competing players
  for (const player of room.players) {
    if (!player.isBot && player.socketId) {
      io.to(player.socketId).emit('room_sync', {
        ...base,
        me: {
          id: player.id,
          name: player.name,
          avatar: player.avatar,
          skills: player.skills,
          score: player.score,
          prevScore: player.prevScore !== undefined ? player.prevScore : player.score,
          lastPointsGained: player.lastPointsGained || 0,
          fury: player.fury,
          canUseSkill: (room.eligibleSkillUserIds || []).includes(player.id),
          isHost: false,
          isSpectator: false,
          buffs: player.buffs,
          debuffs: player.debuffs,
          answered: player.answered,
          selectedAnswer: player.selectedAnswer
        }
      });
    }
  }

  // 2. Send personalized state to Host (MC / Spectator - NOT a player, cannot see answer in advance)
  if (room.host && room.host.socketId) {
    io.to(room.host.socketId).emit('room_sync', {
      ...base,
      me: {
        id: room.host.id,
        name: room.host.name,
        avatar: room.host.avatar,
        skills: [],
        score: 0,
        prevScore: 0,
        lastPointsGained: 0,
        fury: 0,
        canUseSkill: false,
        isHost: true,
        isSpectator: true,
        buffs: {},
        debuffs: {},
        answered: false,
        selectedAnswer: null
      }
    });
  }
}

function addRoomLog(room, text) {
  room.logs.push({ text, time: Date.now() });
  if (room.logs.length > 20) room.logs.shift();
}

function addSkillHistory(room, entry) {
  if (!room.skillHistory) room.skillHistory = [];
  room.skillHistory.unshift({
    id: 'sh_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    time: Date.now(),
    questionNumber: (room.questionIndex || 0) + 1,
    ...entry
  });
  if (room.skillHistory.length > 50) room.skillHistory.pop();
}

function createRoom(hostSocketId, hostName, hostAvatar) {
  let code;
  do {
    code = generateRoomCode();
  } while (rooms.has(code));

  const host = {
    id: 'host_' + Date.now(),
    socketId: hostSocketId,
    name: hostName || 'Chủ Phòng / MC',
    avatar: hostAvatar || '👑'
  };

  const room = {
    code,
    host,
    hostId: host.id,
    players: [], // Host is MC/Spectator, NOT a competing player!
    state: 'LOBBY',
    questionIndex: 0,
    totalQuestions: 20,
    currentQuestion: null,
    timeLeft: 15,
    skillPhaseTimeLeft: 0,
    timerInterval: null,
    botTimeouts: [],
    logs: [{ text: `Phòng ${code} đã được tạo bởi Host [${host.name}]!`, time: Date.now() }],
    skillHistory: [],
    isGolden: false,
    isSuddenDeath: false,
    activeEvent: null,
    jackpotClaimed: false,
    mvpAwards: []
  };

  rooms.set(code, room);
  return room;
}

function startGame(room) {
  if (room.players.length === 0) return;
  room.state = 'STARTING';
  room.questionIndex = 0;
  addRoomLog(room, 'Trận đấu bắt đầu! Chuẩn bị đến với câu số 1...');
  sendPersonalizedState(room);

  setTimeout(() => {
    nextQuestion(room);
  }, 2500);
}

function nextQuestion(room) {
  if (room.questionIndex >= room.totalQuestions) {
    endGame(room);
    return;
  }

  // Clear any existing intervals and bot timeouts
  if (room.timerInterval) clearInterval(room.timerInterval);
  room.botTimeouts.forEach(t => clearTimeout(t));
  room.botTimeouts = [];

  // Determine Golden Question (câu 5, câu 10, câu cuối)
  room.isGolden = (room.questionIndex === 4 || room.questionIndex === 9 || room.questionIndex === room.totalQuestions - 1);

  // Determine Sudden Death / Vòng Sinh Tồn (3 câu cuối)
  room.isSuddenDeath = (room.questionIndex >= room.totalQuestions - 3);

  // Determine Random Room Event (mỗi 4 câu, trừ câu vàng và vòng sinh tồn)
  room.activeEvent = null;
  room.jackpotClaimed = false;
  if (!room.isGolden && !room.isSuddenDeath && (room.questionIndex + 1) % 4 === 0) {
    const events = [
      { type: 'BLITZ', name: '⚡ BLITZ - SIÊU TỐC', desc: 'Đồng hồ chỉ có 8 giây! Hãy phản xạ chớp nhoáng!', timeLimit: 8 },
      { type: 'FOG', name: '🌫️ SƯƠNG MÙ - ẨN BXH', desc: 'Đường đua bị sương mù che khuất trong câu này!' },
      { type: 'JACKPOT', name: '💰 JACKPOT - ĐỘC ĐẮC', desc: 'Người trả lời đúng NHANH NHẤT nhận thêm +100 điểm thưởng!' }
    ];
    room.activeEvent = events[Math.floor(Math.random() * events.length)];
  }

  // Pick question (cycling or random)
  const qIndex = room.questionIndex % questions.length;
  room.currentQuestion = questions[qIndex];
  room.state = 'QUESTION';
  room.timeLeft = (room.activeEvent && room.activeEvent.timeLimit) ? room.activeEvent.timeLimit : 15;

  // Reset player per-question status
  for (const p of room.players) {
    p.prevScore = p.score;
    p.lastPointsGained = 0;
    p.answered = false;
    p.answerTime = null;
    p.selectedAnswer = null;

    // Apply auto-correct if player had buff
    if (p.buffs.autoCorrect) {
      p.answered = true;
      p.selectedAnswer = room.currentQuestion.answer;
      p.lastPointsGained = 100;
      p.score += 100;
      delete p.buffs.autoCorrect;
      addRoomLog(room, `✨ [${p.name}] dùng Đổi Mệnh Thiên Cơ, nhận ngay 100đ!`);
    }

    // Time warp bonus 15s for caster
    if (p.buffs.timeWarp) {
      delete p.buffs.timeWarp;
    }
  }

  let modeTag = '';
  if (room.isGolden) modeTag = ' 🌟 [CÂU HỎI VÀNG: x2 ĐIỂM!]';
  else if (room.isSuddenDeath) modeTag = ' ☠️ [VÒNG SINH TỒN: SAI/TIMEOUT BỊ TRỪ 30Đ!]';
  else if (room.activeEvent) modeTag = ` 🎰 [BIẾN CỐ: ${room.activeEvent.name}]`;

  addRoomLog(room, `🔔 Câu hỏi ${room.questionIndex + 1}/${room.totalQuestions} (${room.timeLeft}s bắt đầu!)${modeTag}`);
  sendPersonalizedState(room);

  // Trigger bots to answer
  triggerBotsAnswer(room);

  // Main countdown timer
  room.timerInterval = setInterval(() => {
    room.timeLeft--;

    // Broadcast time tick
    io.to(room.code).emit('timer_tick', { timeLeft: room.timeLeft });

    if (room.timeLeft <= 0) {
      clearInterval(room.timerInterval);
      revealAnswer(room);
    }
  }, 1000);
}

function triggerBotsAnswer(room) {
  const currentQ = room.currentQuestion;
  for (const bot of room.players.filter(p => p.isBot && !p.answered)) {
    // If silenced or frozen, bot cannot answer
    if (bot.debuffs.silenced || bot.debuffs.frozen) continue;

    // Random reaction delay between 2s and 11s (for 15s timer)
    const delay = Math.floor(Math.random() * 9000) + 2000;
    const timeout = setTimeout(() => {
      if (room.state !== 'QUESTION' || bot.answered) return;
      
      // Bot accuracy ~ 65%
      const isCorrect = Math.random() < 0.65;
      let botAnswer;
      if (isCorrect) {
        botAnswer = currentQ.answer;
      } else {
        const wrongOpts = [0, 1, 2, 3].filter(i => i !== currentQ.answer);
        botAnswer = wrongOpts[Math.floor(Math.random() * wrongOpts.length)];
      }

      handlePlayerAnswer(room, bot, botAnswer, room.timeLeft);
    }, delay);

    room.botTimeouts.push(timeout);

    // Bot skill usage chance
    if (bot.skills.length > 0 && Math.random() < 0.35) {
      setTimeout(() => {
        if (bot.skills.length === 0) return;
        const skill = bot.skills[0];
        const others = room.players.filter(p => p.id !== bot.id);
        const target = others[Math.floor(Math.random() * others.length)];
        executeSkill(room, bot, skill.id, target ? target.id : null);
      }, delay - 2000 > 1000 ? delay - 2000 : 1500);
    }
  }
}

function handlePlayerAnswer(room, player, answerIndex, timeLeftAtAnswer) {
  if (room.state !== 'QUESTION' || player.answered) return;

  // Check if player is silenced or frozen
  if (player.debuffs.silenced) {
    if (!player.isBot && player.socketId) {
      io.to(player.socketId).emit('action_error', { message: 'Bạn đang bị Cấm Ngôn! Không thể trả lời câu này.' });
    }
    return;
  }
  if (player.debuffs.frozen) {
    if (!player.isBot && player.socketId) {
      io.to(player.socketId).emit('action_error', { message: 'Bạn đang bị Đóng Băng! Không thể bấm phím.' });
    }
    return;
  }

  player.answered = true;
  player.selectedAnswer = answerIndex;
  player.answerTime = 15 - timeLeftAtAnswer;

  if (!player.stats) {
    player.stats = { correctCount: 0, wrongCount: 0, totalAnswerTime: 0, skillsUsed: 0, skillsTargeted: 0, pointsStolen: 0 };
  }

  const isCorrect = answerIndex === room.currentQuestion.answer;
  let pointsGained = 0;

  if (isCorrect) {
    // 1. Streak & On-Fire System
    player.streak = (player.streak || 0) + 1;
    if (player.streak > (player.maxStreak || 0)) player.maxStreak = player.streak;
    const becameOnFire = player.streak >= 3 && !player.onFire;
    if (player.streak >= 3) player.onFire = true;

    // 2. Stats update
    player.stats.correctCount++;
    player.stats.totalAnswerTime += player.answerTime || 0;

    // 3. Points formula: 100 down to 0 depending on timeLeft
    const totalQTime = (room.activeEvent && room.activeEvent.timeLimit) ? room.activeEvent.timeLimit : 15;
    const effectiveTime = Math.max(0, Math.min(totalQTime, timeLeftAtAnswer));
    let basePoints = Math.max(0, Math.round(100 * (effectiveTime / totalQTime)));

    if (player.buffs.boost50) {
      basePoints = Math.round(basePoints * 1.5);
    }
    if (player.buffs.doubleOrNothing) {
      basePoints = Math.min(200, basePoints * 2);
    }

    // 4. On-Fire Bonus (+20%) & Golden Question (x2)
    let bonusTag = '';
    if (player.onFire) {
      basePoints = Math.round(basePoints * 1.2);
      bonusTag += ' 🔥[Rực Lửa +20%]';
    }
    if (room.isGolden) {
      basePoints = basePoints * 2;
      bonusTag += ' 🌟[x2 Vàng]';
    }

    // 5. Jackpot Event (+100đ for first correct answer)
    if (room.activeEvent && room.activeEvent.type === 'JACKPOT' && !room.jackpotClaimed) {
      room.jackpotClaimed = true;
      basePoints += 100;
      bonusTag += ' 💰[+100đ JACKPOT!]';
    }

    pointsGained = basePoints;
    player.lastPointsGained = pointsGained;
    player.score += pointsGained;

    // +1 Fury point (Điểm nộ) - tối đa 3 nộ
    player.fury = Math.min(3, player.fury + 1);
    let unlockedSkillMsg = '';

    if (player.fury >= 3) {
      if (player.skills.length === 0) {
        const newSkill = getRandomSkill();
        player.skills.push(newSkill);
        unlockedSkillMsg = ` [⚡ Nộ đầy: Mở khóa ${newSkill.name}!]`;
      } else {
        unlockedSkillMsg = ` [⚡ Nộ đầy: Sẵn sàng chờ lượt tung chiêu!]`;
      }
    }

    addRoomLog(room, `🎯 [${player.name}] trả lời ĐÚNG (+${pointsGained}đ)!${bonusTag}${unlockedSkillMsg}`);

    if (becameOnFire) {
      addRoomLog(room, `🔥 [${player.name}] đã đạt chuỗi 3 trận thắng và kích hoạt trạng thái RỰC LỬA (+20% điểm)!`);
    }

    // Check Point Magnet from other players
    const sorted = getSortedPlayers(room);
    if (sorted.length > 0 && sorted[0].id === player.id) {
      for (const other of room.players) {
        if (other.id !== player.id && other.buffs.pointMagnet) {
          const bonus = Math.round(pointsGained * 0.25);
          other.score += bonus;
          addRoomLog(room, `🧲 [${other.name}] hút được +${bonus}đ từ Top 1!`);
        }
      }
    }
  } else {
    // Wrong answer: Reset streak and On-Fire
    player.streak = 0;
    player.onFire = false;
    player.stats.wrongCount++;

    // "3 câu hỏi đầu tiên, người chơi trả lời đúng hay sai đều được cộng 1 điểm nộ"
    let furyGainedMsg = '';
    if (room.questionIndex < 3) {
      player.fury = Math.min(3, player.fury + 1);
      furyGainedMsg = ' (+1 Nộ)';
      if (player.fury >= 3 && player.skills.length === 0) {
        const newSkill = getRandomSkill();
        player.skills.push(newSkill);
        furyGainedMsg += ` [⚡ Nộ đầy: Mở khóa ${newSkill.name}!]`;
      }
    }

    addRoomLog(room, `❌ [${player.name}] trả lời SAI (0đ)!${furyGainedMsg}`);

    // Vòng Sinh Tồn (Sudden Death): Trừ 30 điểm khi sai!
    if (room.isSuddenDeath) {
      player.score = Math.max(0, player.score - 30);
      addRoomLog(room, `☠️ VÒNG SINH TỒN: [${player.name}] trả lời sai, bị trừ 30 điểm!`);
    }

    // Double or nothing penalty
    if (player.buffs.doubleOrNothing) {
      player.score = Math.max(0, player.score - 50);
      addRoomLog(room, `🎲 [${player.name}] cược x2 thất bại: Trừ 50đ!`);
    }

    // Time bomb detonation
    if (player.debuffs.timeBomb) {
      player.score = Math.max(0, player.score - 120);
      delete player.debuffs.timeBomb;
      addRoomLog(room, `💣 BÙM! Bom hẹn giờ phát nổ trên người [${player.name}], trừ 120đ!`);
    }
  }

  // Clear single-use buffs
  if (player.buffs.doubleOrNothing) delete player.buffs.doubleOrNothing;
  if (player.buffs.eagle5050) delete player.buffs.eagle5050;

  sendPersonalizedState(room);

  // Check if all players answered
  const activePlayable = room.players.filter(p => !p.debuffs.silenced && !p.debuffs.frozen);
  const allAnswered = activePlayable.every(p => p.answered);

  if (allAnswered && activePlayable.length > 0) {
    if (room.timerInterval) clearInterval(room.timerInterval);
    setTimeout(() => {
      revealAnswer(room);
    }, 800);
  }
}

function revealAnswer(room) {
  room.state = 'REVEAL';

  // Handle players who did not answer before timeout
  for (const p of room.players) {
    if (!p.answered) {
      p.streak = 0;
      p.onFire = false;
      if (!p.stats) p.stats = { correctCount: 0, wrongCount: 0, totalAnswerTime: 0, skillsUsed: 0, skillsTargeted: 0, pointsStolen: 0 };
      p.stats.wrongCount++;

      // Vòng Sinh Tồn penalty on timeout:
      if (room.isSuddenDeath) {
        p.score = Math.max(0, p.score - 30);
        addRoomLog(room, `☠️ VÒNG SINH TỒN: [${p.name}] hết giờ không chọn, bị trừ 30 điểm!`);
      }
    }
  }

  // "3 câu hỏi đầu tiên, người chơi trả lời đúng hay sai đều được cộng 1 điểm nộ"
  // (Cộng nộ cho cả người hết giờ chưa kịp chọn)
  if (room.questionIndex < 3) {
    for (const p of room.players) {
      if (!p.answered) {
        p.fury = Math.min(3, p.fury + 1);
        if (p.fury >= 3 && p.skills.length === 0) {
          p.skills.push(getRandomSkill());
        }
      }
    }
  }

  // Check anyone with time bomb who didn't answer
  for (const p of room.players) {
    if (!p.answered && p.debuffs.timeBomb) {
      p.score = Math.max(0, p.score - 120);
      delete p.debuffs.timeBomb;
      addRoomLog(room, `💣 [${p.name}] không trả lời kịp, Bom nổ tan tành: Trừ 120đ!`);
    }
  }

  // Decrement round-based buffs / debuffs
  for (const p of room.players) {
    if (p.buffs.boost50) {
      p.buffs.boost50--;
      if (p.buffs.boost50 <= 0) delete p.buffs.boost50;
    }
    if (p.buffs.divineShield) {
      p.buffs.divineShield--;
      if (p.buffs.divineShield <= 0) delete p.buffs.divineShield;
    }
    if (p.buffs.pointMagnet) {
      p.buffs.pointMagnet--;
      if (p.buffs.pointMagnet <= 0) delete p.buffs.pointMagnet;
    }
    if (p.buffs.spyTop1) {
      p.buffs.spyTop1--;
      if (p.buffs.spyTop1 <= 0) delete p.buffs.spyTop1;
    }
    if (p.buffs.reflectMirror) {
      p.buffs.reflectMirror--;
      if (p.buffs.reflectMirror <= 0) delete p.buffs.reflectMirror;
    }

    if (p.debuffs.silenced) {
      p.debuffs.silenced--;
      if (p.debuffs.silenced <= 0) delete p.debuffs.silenced;
    }
    if (p.debuffs.frozen) {
      delete p.debuffs.frozen;
    }
    if (p.debuffs.inkBlind) {
      delete p.debuffs.inkBlind;
    }
    if (p.debuffs.screenShake) {
      delete p.debuffs.screenShake;
    }
    if (p.debuffs.scrambleKeys) {
      delete p.debuffs.scrambleKeys;
    }
  }

  // --- 10S RACETRACK & SKILL ACTIVATION PHASE ---
  room.revealTimeLeft = 10;

  // Rule Check:
  // "Sau 3 câu đầu cả đội đều full nộ nhưng câu tiếp theo 2 người cuối bảng mới được sử dụng kỹ năng."
  if (room.questionIndex === 2) {
    for (const p of room.players) {
      p.fury = 3; // CẢ ĐỘI FULL NỘ!
      if (p.skills.length === 0) {
        p.skills.push(getRandomSkill());
      }
    }
    // 2 người cuối bảng mới được sử dụng kỹ năng:
    const sorted = [...room.players].sort((a, b) => a.score - b.score);
    const bottom2 = sorted.slice(0, 2);
    room.eligibleSkillUserIds = bottom2.map(p => p.id);
    const names = bottom2.map(p => p.name).join(' & ');
    addRoomLog(room, `⚡ HẾT 3 CÂU: CẢ ĐỘI FULL NỘ! 2 người cuối bảng [${names}] được quyền tung kỹ năng trong 10s!`);
  } else if (room.questionIndex >= 3) {
    // "Những câu tiếp lần lượt 2 người đủ nộ điểm thấp nhất được dùng kỹ năng"
    const fullFuryPlayers = room.players.filter(p => p.fury >= 3);
    fullFuryPlayers.sort((a, b) => a.score - b.score); // Sắp xếp điểm thấp nhất trước
    const eligibleBottom2 = fullFuryPlayers.slice(0, 2);

    for (const p of eligibleBottom2) {
      if (p.skills.length === 0) {
        p.skills.push(getRandomSkill());
      }
    }

    room.eligibleSkillUserIds = eligibleBottom2.map(p => p.id);
    if (eligibleBottom2.length > 0) {
      const names = eligibleBottom2.map(p => p.name).join(' & ');
      addRoomLog(room, `⚡ Lượt này: 2 người đủ nộ điểm thấp nhất [${names}] được quyền tung kỹ năng trong 10s!`);
    } else {
      addRoomLog(room, `⏱️ 10 giây xem BXH đường đua! Chưa có ai đủ 3 điểm nộ.`);
    }
  } else {
    // Câu 1 & 2: đang tích lũy nộ
    room.eligibleSkillUserIds = [];
    addRoomLog(room, `⏱️ 10 giây xem BXH đường đua! Trả lời đúng để tích nộ.`);
  }

  sendPersonalizedState(room);

  // Trigger bots to use skills if eligible
  setTimeout(() => {
    if (room.state !== 'REVEAL' || !room.eligibleSkillUserIds) return;
    const eligibleBots = room.players.filter(p => p.isBot && room.eligibleSkillUserIds.includes(p.id));
    for (const bot of eligibleBots) {
      if (bot.skills.length > 0) {
        const skill = bot.skills[0];
        const others = room.players.filter(p => p.id !== bot.id);
        const target = others[Math.floor(Math.random() * others.length)];
        executeSkill(room, bot, skill.id, target ? target.id : null);
      }
    }
  }, 2200);

  // 10s countdown timer
  if (room.revealInterval) clearInterval(room.revealInterval);
  room.revealTimeLeft = 10;
  room.revealInterval = setInterval(() => {
    room.revealTimeLeft--;
    io.to(room.code).emit('reveal_timer_tick', { timeLeft: room.revealTimeLeft });
    if (room.revealTimeLeft <= 0) {
      clearInterval(room.revealInterval);
      room.revealInterval = null;
      // Skills phase ended, now awaiting Host to click next question
      room.eligibleSkillUserIds = [];
      sendPersonalizedState(room);
    }
  }, 1000);

  // Safety fallback timeout (60s) in case host is idle/disconnected
  if (room.revealTimeout) clearTimeout(room.revealTimeout);
  room.revealTimeout = setTimeout(() => {
    if (room.state === 'REVEAL') {
      advanceNextQuestion(room);
    }
  }, 60000);
}

function advanceNextQuestion(room) {
  if (room.revealTimeout) {
    clearTimeout(room.revealTimeout);
    room.revealTimeout = null;
  }
  if (room.revealInterval) {
    clearInterval(room.revealInterval);
    room.revealInterval = null;
  }
  room.eligibleSkillUserIds = [];
  room.questionIndex++;
  if (room.questionIndex >= room.totalQuestions) {
    endGame(room);
  } else {
    nextQuestion(room);
  }
}

function executeSkill(room, caster, skillId, targetId) {
  // Check if player is eligible to use skill this phase
  if (room.eligibleSkillUserIds && !room.eligibleSkillUserIds.includes(caster.id)) {
    if (!caster.isBot && caster.socketId) {
      io.to(caster.socketId).emit('action_error', { 
        message: 'Chưa đến lượt bạn tung kỹ năng! Lượt này ưu tiên 2 người đủ nộ điểm thấp nhất.' 
      });
    }
    return false;
  }

  const skillIndex = caster.skills.findIndex(s => s.id === skillId);
  if (skillIndex === -1) return false;

  const skill = caster.skills[skillIndex];
  let target = room.players.find(p => p.id === targetId);

  // If skill is SWAP_TOP1: resolve target automatically (Top 1 if caster is not Top 1; if Top 1, rerolls into random skill)
  if (skill.id === 'SWAP_TOP1') {
    const sorted = getSortedPlayers(room);
    if (sorted.length > 0) {
      if (sorted[0].id === caster.id) {
        target = null; // Đang đứng Top 1: không hoán đổi mà đổi ra ngẫu nhiên 1 kỹ năng khác!
      } else {
        target = sorted[0]; // Chưa phải Top 1: hoán đổi với Top 1!
      }
    }
  }

  // Check if target has Reflect Mirror and skill is an attack/steal/swap
  if (target && target.id !== caster.id && (['attack', 'steal'].includes(skill.type) || ['SWAP_TOP1', 'STEAL_30'].includes(skill.id))) {
    if (target.buffs.reflectMirror) {
      delete target.buffs.reflectMirror;
      addRoomLog(room, `🪞 [${target.name}] dùng Gương Phản Chiếu dội ngược kỹ năng lại [${caster.name}]!`);
      target = caster; // Bounced back to caster!
    } else if (target.buffs.divineShield) {
      caster.skills.splice(skillIndex, 1);
      caster.fury = 0; // Dùng kỹ năng xong sẽ mất điểm nộ
      if (room.eligibleSkillUserIds) {
        room.eligibleSkillUserIds = room.eligibleSkillUserIds.filter(id => id !== caster.id);
      }
      addRoomLog(room, `🛡️ [${target.name}] có Khiên Thần Thánh! Vô hiệu hóa kỹ năng của [${caster.name}]!`);
      addSkillHistory(room, {
        casterId: caster.id,
        casterName: caster.name,
        casterAvatar: caster.avatar,
        skillId: skill.id,
        skillName: skill.name,
        skillIcon: skill.icon,
        rarity: skill.rarity || 'common',
        rarityName: skill.rarityName || 'Phổ Thông',
        rarityColor: skill.rarityColor || '#34d399',
        targetId: target.id,
        targetName: target.name,
        targetAvatar: target.avatar,
        blocked: true,
        outcome: `Bị Khiên Thần Thánh của [${target.name}] vô hiệu hóa!`
      });
      sendPersonalizedState(room);
      return true;
    }
  }

  // Remove skill from caster inventory & CONSUME FURY!
  caster.skills.splice(skillIndex, 1);
  caster.fury = 0; // "Dùng kỹ năng xong sẽ mất điểm nộ"
  if (room.eligibleSkillUserIds) {
    room.eligibleSkillUserIds = room.eligibleSkillUserIds.filter(id => id !== caster.id);
  }

  // Update Caster stats
  if (!caster.stats) {
    caster.stats = { correctCount: 0, wrongCount: 0, totalAnswerTime: 0, skillsUsed: 0, skillsTargeted: 0, pointsStolen: 0 };
  }
  caster.stats.skillsUsed++;

  let outcomeText = '';
  let targetDesc = target ? target.name : '';

  // Update Target stats & On-Fire Bounty System
  if (target && target.id !== caster.id) {
    if (!target.stats) {
      target.stats = { correctCount: 0, wrongCount: 0, totalAnswerTime: 0, skillsUsed: 0, skillsTargeted: 0, pointsStolen: 0 };
    }
    target.stats.skillsTargeted++;

    // Check if target is On-Fire and this is an offensive/steal skill:
    const isOffensive = ['attack', 'steal'].includes(skill.type) || 
      ['SWAP_TOP1', 'STEAL_30', 'FREEZE_ONE', 'TIME_BOMB', 'INK_BLIND', 'SCRAMBLE_KEYS', 'EARTHQUAKE', 'SILENCE_TOP3'].includes(skill.id);
    
    if (isOffensive && target.onFire) {
      target.onFire = false;
      target.streak = 0;
      caster.score += 50;
      outcomeText += ' [🔥 Dập tắt Rực Lửa: +50đ tiền thưởng!]';
      addRoomLog(room, `💰 SĂN TIỀN THƯỞNG: [${caster.name}] dập tắt chuỗi Rực Lửa của [${target.name}] và ẵm ngay +50 điểm!`);
    }
  }

  // Execute skill specific effect
  switch (skill.id) {
    case 'SWAP_TOP1': {
      const sorted = getSortedPlayers(room);
      const isCasterTop1 = sorted.length > 0 && sorted[0].id === caster.id;

      if (isCasterTop1) {
        // Đang Top 1: ra ngẫu nhiên 1 kỹ năng khác mà không hoán đổi với top 2
        let newSkill = getRandomSkill();
        let attempts = 0;
        while (newSkill.id === 'SWAP_TOP1' && attempts < 10) {
          newSkill = getRandomSkill();
          attempts++;
        }
        caster.skills.push(newSkill);
        targetDesc = 'Bản thân (Đang TOP 1)';
        outcomeText = `Đang Top 1 ➔ Chuyển hóa thành [${newSkill.name}] ${newSkill.icon}!`;
        addRoomLog(room, `🔄 [${caster.name}] đang đứng TOP 1! Hoán Đổi Càn Khôn biến chuyển thành kỹ năng mới: [${newSkill.name}] ${newSkill.icon}!`);
      } else if (target && target.id !== caster.id) {
        const oldCasterScore = caster.score;
        const oldTargetScore = target.score;
        caster.score = oldTargetScore;
        target.score = oldCasterScore;
        targetDesc = `${target.name} (TOP 1)`;
        outcomeText = `Hoán đổi điểm thành công (${oldCasterScore}đ ⇄ ${oldTargetScore}đ)!`;
        addRoomLog(room, `🔄 [${caster.name}] kích hoạt HOÁN ĐỔI ĐIỂM với TOP 1 [${target.name}] (${oldCasterScore}đ ⇄ ${oldTargetScore}đ)!`);
      } else {
        outcomeText = 'Không có đối thủ phù hợp để hoán đổi';
        addRoomLog(room, `🔄 [${caster.name}] dùng Hoán Đổi Càn Khôn nhưng không có đối thủ phù hợp để hoán đổi!`);
      }
      break;
    }

    case 'BOOST_50': {
      caster.buffs.boost50 = 3;
      targetDesc = 'Bản thân';
      outcomeText = '+50% điểm nhận được trong 3 câu tiếp theo';
      addRoomLog(room, `⚡ [${caster.name}] tăng tốc +50% điểm cho 3 câu hỏi tiếp theo!`);
      break;
    }

    case 'SILENCE_TOP3': {
      const sorted = getSortedPlayers(room);
      const top3 = sorted.slice(0, 3);
      top3.forEach(p => {
        if (!p.buffs.divineShield) {
          p.debuffs.silenced = 2;
        }
      });
      targetDesc = 'Top 3 bảng xếp hạng';
      outcomeText = 'Khóa quyền trả lời của 3 người dẫn đầu trong 2 câu tới!';
      addRoomLog(room, `🤫 [${caster.name}] kích hoạt CẤM NGÔN: Khóa miệng Top 3 trong 2 câu tới!`);
      break;
    }

    case 'FREEZE_ONE': {
      if (target) {
        target.debuffs.frozen = true;
        outcomeText = `Đóng băng [${target.name}] không thể bấm phím ở câu tiếp theo!`;
        addRoomLog(room, `❄️ [${caster.name}] ĐÓNG BĂNG [${target.name}] trong câu tiếp theo!`);
      }
      break;
    }

    case 'STEAL_30': {
      if (target && target.id !== caster.id) {
        const stolen = Math.min(100, Math.round(target.score * 0.3));
        target.score = Math.max(0, target.score - stolen);
        caster.score += stolen;
        if (!caster.stats) caster.stats = { correctCount: 0, wrongCount: 0, totalAnswerTime: 0, skillsUsed: 0, skillsTargeted: 0, pointsStolen: 0 };
        caster.stats.pointsStolen += stolen;
        outcomeText = `Hút trộm thành công +${stolen}đ từ [${target.name}] (tối đa 100đ)!`;
        addRoomLog(room, `🦹 [${caster.name}] hút trộm ${stolen}đ từ [${target.name}] (tối đa 100đ)!`);
      }
      break;
    }

    case 'TIME_BOMB': {
      if (target) {
        target.debuffs.timeBomb = true;
        outcomeText = `Gài bom hẹn giờ vào [${target.name}] (Nổ -120đ nếu sai/hết giờ)`;
        addRoomLog(room, `💣 [${caster.name}] gài BOM HẸN GIỜ vào người [${target.name}]!`);
      }
      break;
    }

    case 'DIVINE_SHIELD': {
      caster.buffs.divineShield = 3;
      targetDesc = 'Bản thân';
      outcomeText = 'Dựng Khiên Thần Thánh miễn nhiễm mọi kỹ năng xấu trong 3 câu!';
      addRoomLog(room, `🛡️ [${caster.name}] dựng KHIÊN THẦN THÁNH bất khả xâm phạm trong 3 câu!`);
      break;
    }

    case 'EAGLE_5050': {
      caster.buffs.eagle5050 = true;
      targetDesc = 'Bản thân';
      outcomeText = 'Loại bỏ 2 phương án sai ở câu hỏi tiếp theo';
      addRoomLog(room, `🎯 [${caster.name}] kích hoạt Mắt Đại Bàng: 50/50 ở câu tiếp theo!`);
      break;
    }

    case 'DOUBLE_OR_NOTHING': {
      caster.buffs.doubleOrNothing = true;
      targetDesc = 'Bản thân';
      outcomeText = 'Cược mạng: x2 điểm nếu đúng (tối đa 200đ), -50đ nếu sai';
      addRoomLog(room, `🎲 [${caster.name}] cược mạng: Nhân đôi điểm nếu đúng, trừ 50đ nếu sai!`);
      break;
    }

    case 'TIME_WARP': {
      caster.buffs.timeWarp = true;
      targetDesc = 'Bản thân';
      outcomeText = 'Tặng riêng bạn thêm +15 giây ở câu hỏi kế tiếp';
      addRoomLog(room, `⏳ [${caster.name}] bẻ cong thời gian: Nhận thêm +15 giây câu kế!`);
      break;
    }

    case 'INK_BLIND': {
      if (target) {
        target.debuffs.inkBlind = true;
        outcomeText = `Phun mực đen che kín màn hình [${target.name}]!`;
        addRoomLog(room, `🐙 [${caster.name}] phun mực bạch tuộc mù mịt che kín màn hình [${target.name}]!`);
      }
      break;
    }

    case 'SCREEN_SHAKE': {
      if (target) {
        target.debuffs.screenShake = true;
        outcomeText = `Làm xoay ngược 180° và rung lắc màn hình [${target.name}]!`;
        addRoomLog(room, `🌪️ [${caster.name}] tạo cơn lốc làm rung lắc và xoay đảo màn hình [${target.name}]!`);
      }
      break;
    }

    case 'AUTO_CORRECT': {
      caster.buffs.autoCorrect = true;
      targetDesc = 'Bản thân';
      outcomeText = 'Tự động ăn trọn 100 điểm tuyệt đối ở câu tiếp theo!';
      addRoomLog(room, `🔀 [${caster.name}] dùng Đổi Mệnh Thiên Cơ: Tự động ăn trọn 100đ câu tới!`);
      break;
    }

    case 'POINT_MAGNET': {
      caster.buffs.pointMagnet = 2;
      targetDesc = 'Top 1 bảng xếp hạng';
      outcomeText = 'Hút 25% số điểm của Top 1 trong 2 câu tới!';
      addRoomLog(room, `🧲 [${caster.name}] bật Nam Châm Hút Điểm từ Top 1 trong 2 câu!`);
      break;
    }

    case 'SPY_TOP1': {
      caster.buffs.spyTop1 = 2;
      targetDesc = 'Top 1 bảng xếp hạng';
      outcomeText = 'Nhìn trộm đáp án mà Top 1 vừa chọn trong 2 câu!';
      addRoomLog(room, `🎭 [${caster.name}] kích hoạt Kính Nhìn Trộm đáp án Top 1!`);
      break;
    }

    case 'FURY_SACRIFICE': {
      caster.score = Math.max(0, caster.score - 30);
      caster.skills.push(getRandomSkill(), getRandomSkill());
      targetDesc = 'Bản thân';
      outcomeText = 'Hy sinh 30đ để bốc ngay 2 kỹ năng mới!';
      addRoomLog(room, `🩸 [${caster.name}] hy sinh 30đ để rút ngay 2 kỹ năng mới!`);
      break;
    }

    case 'REFLECT_MIRROR': {
      caster.buffs.reflectMirror = 3;
      targetDesc = 'Bản thân';
      outcomeText = 'Dựng Gương Phản Chiếu dội ngược mọi đòn hại trong 3 câu!';
      addRoomLog(room, `🪞 [${caster.name}] dựng Gương Phản Chiếu sẵn sàng dội đòn hại!`);
      break;
    }

    case 'SCRAMBLE_KEYS': {
      if (target) {
        target.debuffs.scrambleKeys = true;
        outcomeText = `Làm đảo lộn vị trí các phím bấm A, B, C, D của [${target.name}]!`;
        addRoomLog(room, `🌀 [${caster.name}] làm đảo lộn vị trí các phím bấm của [${target.name}]!`);
      }
      break;
    }

    case 'LUCKY_BOX': {
      const luckyRoll = Math.floor(Math.random() * 3);
      targetDesc = 'Bản thân';
      if (luckyRoll === 0) {
        caster.score += 150;
        outcomeText = 'Mở Hộp May Mắn: +150 ĐIỂM!';
        addRoomLog(room, `🎁 [${caster.name}] mở Hộp May Mắn trúng đậm: +150 ĐIỂM!`);
      } else if (luckyRoll === 1) {
        caster.fury += 2;
        outcomeText = 'Mở Hộp May Mắn: +2 ĐIỂM NỘ!';
        addRoomLog(room, `🎁 [${caster.name}] mở Hộp May Mắn nhận ngay +2 ĐIỂM NỘ!`);
      } else {
        caster.buffs.divineShield = 2;
        outcomeText = 'Mở Hộp May Mắn: Nhận KHIÊN THẦN THÁNH 2 câu!';
        addRoomLog(room, `🎁 [${caster.name}] mở Hộp May Mắn nhận KHIÊN THẦN THÁNH 2 câu!`);
      }
      break;
    }

    case 'EARTHQUAKE': {
      room.players.forEach(p => {
        if (p.id !== caster.id && !p.buffs.divineShield) {
          p.score = Math.max(0, p.score - 25);
          p.debuffs.screenShake = true;
        }
      });
      targetDesc = 'Tất cả đối thủ trong phòng';
      outcomeText = 'Rung chấn toàn phòng, trừ 25 điểm tất cả đối thủ!';
      addRoomLog(room, `💥 [${caster.name}] kích hoạt ĐẠI ĐỊA CHẤN: Trừ 25đ của tất cả đối thủ!`);
      break;
    }
  }

  // Record into Skill Usage History
  addSkillHistory(room, {
    casterId: caster.id,
    casterName: caster.name,
    casterAvatar: caster.avatar,
    skillId: skill.id,
    skillName: skill.name,
    skillIcon: skill.icon,
    rarity: skill.rarity || 'common',
    rarityName: skill.rarityName || 'Phổ Thông',
    rarityColor: skill.rarityColor || '#34d399',
    targetId: target ? target.id : null,
    targetName: targetDesc,
    targetAvatar: target ? target.avatar : null,
    outcome: outcomeText
  });

  // Broadcast skill effect event for sound and visuals
  io.to(room.code).emit('skill_triggered', {
    casterId: caster.id,
    casterName: caster.name,
    skillId: skill.id,
    skillName: skill.name,
    skillIcon: skill.icon,
    targetId: target ? target.id : null,
    targetName: target ? target.name : null
  });

  sendPersonalizedState(room);
  return true;
}

function endGame(room) {
  if (room.timerInterval) clearInterval(room.timerInterval);
  room.state = 'ENDED';

  const ranked = getSortedPlayers(room);
  addRoomLog(room, `🏆 TRẬN ĐẤU KẾT THÚC! Chúc mừng Quán Quân [${ranked[0] ? ranked[0].name : 'Vô Danh'}]!`);

  // Calculate 5 Funny MVP Awards
  const awards = [];

  // 1. ⚡ Vua Tốc Độ (Người có avg answer time thấp nhất trong số người trả lời đúng >= 1 câu)
  const speedCandidates = room.players.filter(p => p.stats && p.stats.correctCount > 0);
  if (speedCandidates.length > 0) {
    speedCandidates.sort((a, b) => (a.stats.totalAnswerTime / a.stats.correctCount) - (b.stats.totalAnswerTime / b.stats.correctCount));
    const winner = speedCandidates[0];
    const avg = (winner.stats.totalAnswerTime / winner.stats.correctCount).toFixed(1);
    awards.push({
      title: '⚡ VUA TỐC ĐỘ',
      desc: `Phản xạ chớp nhoáng: TB ${avg}s/câu đúng`,
      player: { id: winner.id, name: winner.name, avatar: winner.avatar }
    });
  }

  // 2. 🦹 Chúa Tể Đạo Tặc (Người hút được nhiều điểm nhất từ Bàn tay đạo tặc)
  const stealCandidates = room.players.filter(p => p.stats && p.stats.pointsStolen > 0);
  if (stealCandidates.length > 0) {
    stealCandidates.sort((a, b) => b.stats.pointsStolen - a.stats.pointsStolen);
    const winner = stealCandidates[0];
    awards.push({
      title: '🦹 CHÚA TỂ ĐẠO TẶC',
      desc: `Hút trộm tổng cộng +${winner.stats.pointsStolen} điểm từ đối thủ`,
      player: { id: winner.id, name: winner.name, avatar: winner.avatar }
    });
  } else {
    // Fallback: Chiến Thần Chuỗi Thắng (Streak cao nhất)
    const streakCandidates = [...room.players].sort((a, b) => (b.maxStreak || 0) - (a.maxStreak || 0));
    const winner = streakCandidates[0];
    if (winner && (winner.maxStreak || 0) > 0) {
      awards.push({
        title: '🔥 CHIẾN THẦN CHUỖI',
        desc: `Chuỗi thắng dài nhất: ${winner.maxStreak} câu liên tiếp`,
        player: { id: winner.id, name: winner.name, avatar: winner.avatar }
      });
    }
  }

  // 3. 🎯 Thánh Xả Kỹ Năng (Dùng kỹ năng nhiều nhất)
  const skillCandidates = room.players.filter(p => p.stats && p.stats.skillsUsed > 0);
  if (skillCandidates.length > 0) {
    skillCandidates.sort((a, b) => b.stats.skillsUsed - a.stats.skillsUsed);
    const winner = skillCandidates[0];
    awards.push({
      title: '🎯 THÁNH XẢ KỸ NĂNG',
      desc: `Xả chiêu không ngớt: ${winner.stats.skillsUsed} lần kích hoạt`,
      player: { id: winner.id, name: winner.name, avatar: winner.avatar }
    });
  }

  // 4. 🛡️ Bao Cát Vàng (Bị trúng kỹ năng / nhắm tới nhiều nhất)
  const targetCandidates = room.players.filter(p => p.stats && p.stats.skillsTargeted > 0);
  if (targetCandidates.length > 0) {
    targetCandidates.sort((a, b) => b.stats.skillsTargeted - a.stats.skillsTargeted);
    const winner = targetCandidates[0];
    awards.push({
      title: '🛡️ BAO CÁT VÀNG',
      desc: `Gánh chịu ${winner.stats.skillsTargeted} lần chiêu xấu từ mọi người`,
      player: { id: winner.id, name: winner.name, avatar: winner.avatar }
    });
  }

  // 5. 🤡 Chúa Tể Lạc Đề (Trả lời sai nhiều nhất)
  const wrongCandidates = room.players.filter(p => p.stats && p.stats.wrongCount > 0);
  if (wrongCandidates.length > 0) {
    wrongCandidates.sort((a, b) => b.stats.wrongCount - a.stats.wrongCount);
    const winner = wrongCandidates[0];
    awards.push({
      title: '🤡 CHÚA TỂ LẠC ĐỀ',
      desc: `Đoán lụi sai đến ${winner.stats.wrongCount} câu`,
      player: { id: winner.id, name: winner.name, avatar: winner.avatar }
    });
  }

  room.mvpAwards = awards;

  io.to(room.code).emit('game_over', {
    rankings: ranked.map((p, idx) => ({
      rank: idx + 1,
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      score: p.score
    })),
    mvpAwards: awards
  });

  sendPersonalizedState(room);
}

// WebSocket connection handling
io.on('connection', (socket) => {
  // Create room
  socket.on('create_room', ({ name, avatar }) => {
    const room = createRoom(socket.id, name, avatar);
    socket.join(room.code);
    socket.emit('room_created', { code: room.code });
    sendPersonalizedState(room);
  });

  // Join room
  socket.on('join_room', ({ code, name, avatar }) => {
    const cleanCode = (code || '').trim().toUpperCase();
    const room = rooms.get(cleanCode);

    if (!room) {
      return socket.emit('join_error', { message: 'Mã phòng không tồn tại!' });
    }
    if (room.state !== 'LOBBY') {
      return socket.emit('join_error', { message: 'Trận đấu trong phòng này đã bắt đầu!' });
    }
    if (room.players.length >= 10) {
      return socket.emit('join_error', { message: 'Phòng đã đủ 10 người chơi!' });
    }

    const newPlayer = {
      id: 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      socketId: socket.id,
      name: name || `Người chơi ${room.players.length + 1}`,
      avatar: avatar || '🎮',
      score: 0,
      fury: 0,
      streak: 0,
      maxStreak: 0,
      onFire: false,
      stats: { correctCount: 0, wrongCount: 0, totalAnswerTime: 0, skillsUsed: 0, skillsTargeted: 0, pointsStolen: 0 },
      isBot: false,
      skills: [],
      buffs: {},
      debuffs: {},
      answered: false,
      answerTime: null,
      selectedAnswer: null
    };

    room.players.push(newPlayer);
    socket.join(room.code);
    addRoomLog(room, `👋 [${newPlayer.name}] đã tham gia phòng chơi.`);
    sendPersonalizedState(room);
  });

  // Add Bot (Host only, up to 10 players)
  socket.on('add_bot', ({ code }) => {
    const room = rooms.get(code);
    if (!room || room.players.length >= 10 || room.state !== 'LOBBY') return;
    if (!room.host || room.host.socketId !== socket.id) return;

    const usedNames = room.players.map(p => p.name);
    const availableNames = BOT_NAMES.filter(n => !usedNames.includes(n));
    const botName = availableNames[0] || `Bot ${room.players.length + 1}`;
    const botAvatar = BOT_AVATARS[room.players.length % BOT_AVATARS.length];

    const botPlayer = {
      id: 'bot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      socketId: null,
      name: botName,
      avatar: botAvatar,
      score: 0,
      fury: 0,
      streak: 0,
      maxStreak: 0,
      onFire: false,
      stats: { correctCount: 0, wrongCount: 0, totalAnswerTime: 0, skillsUsed: 0, skillsTargeted: 0, pointsStolen: 0 },
      isBot: true,
      skills: [],
      buffs: {},
      debuffs: {},
      answered: false,
      answerTime: null,
      selectedAnswer: null
    };

    room.players.push(botPlayer);
    addRoomLog(room, `🤖 Đã thêm [${botPlayer.name}] vào phòng chơi.`);
    sendPersonalizedState(room);
  });

  // Kick / remove bot or player (Host only)
  socket.on('remove_bot', ({ code }) => {
    const room = rooms.get(code);
    if (!room || room.state !== 'LOBBY') return;
    if (!room.host || room.host.socketId !== socket.id) return;
    const botIdx = room.players.findIndex(p => p.isBot);
    if (botIdx !== -1) {
      const removed = room.players.splice(botIdx, 1)[0];
      addRoomLog(room, `Đã xóa bot [${removed.name}]`);
      sendPersonalizedState(room);
    }
  });

  // Start game (Host only)
  socket.on('start_game', ({ code }) => {
    const room = rooms.get(code);
    if (!room) return;
    if (!room.host || room.host.socketId !== socket.id) return;
    if (room.state !== 'LOBBY') return;

    if (room.players.length === 0) {
      return socket.emit('action_error', { 
        message: 'Chưa có người chơi nào trong phòng! Vui lòng chờ người chơi vào hoặc bấm Thêm AI Bot.' 
      });
    }

    startGame(room);
  });

  // Next question (Host only)
  socket.on('next_question', ({ code }) => {
    const room = rooms.get(code);
    if (!room) return;
    if (!room.host || room.host.socketId !== socket.id) return;

    if (room.state === 'REVEAL') {
      advanceNextQuestion(room);
    } else if (room.state === 'QUESTION') {
      // Host force-reveals question
      if (room.timerInterval) clearInterval(room.timerInterval);
      revealAnswer(room);
    }
  });

  // Player answer submit
  socket.on('submit_answer', ({ code, answerIndex, timeLeft }) => {
    const room = rooms.get(code);
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (player) {
      handlePlayerAnswer(room, player, answerIndex, timeLeft);
    }
  });

  // Player use skill
  socket.on('use_skill', ({ code, skillId, targetId }) => {
    const room = rooms.get(code);
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (player) {
      executeSkill(room, player, skillId, targetId);
    }
  });

  // Dev / test helper: adjust player state for testing
  if (process.env.NODE_ENV !== 'production') {
    socket.on('dev_setup_player', ({ code, score, fury, skillId }) => {
      const room = rooms.get(code);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;
      if (typeof score === 'number') player.score = score;
      if (typeof fury === 'number') player.fury = fury;
      if (skillId) {
        const sDef = SKILLS.find(s => s.id === skillId);
        if (sDef) player.skills.push({ ...sDef, uid: 'dev_' + Date.now() });
      }
      sendPersonalizedState(room);
    });
  }

  // Live Emote Reaction (Tương tác cà khịa thả icon bay màn hình)
  socket.on('send_reaction', ({ code, emoji }) => {
    const room = rooms.get(code);
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id) || (room.host && room.host.socketId === socket.id ? room.host : null);
    const senderName = player ? player.name : 'Người chơi';
    io.to(room.code).emit('reaction_received', {
      id: 'rx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      senderName,
      emoji
    });
  });

  // Host Soundboard SFX
  socket.on('host_sound_fx', ({ code, sfxType }) => {
    const room = rooms.get(code);
    if (!room) return;
    if (!room.host || room.host.socketId !== socket.id) return;
    io.to(room.code).emit('host_sound_fx_triggered', { sfxType });
    addRoomLog(room, `📢 Host phát hiệu ứng âm thanh: ${sfxType}!`);
  });

  // Restart game back to lobby (Host only)
  socket.on('restart_game', ({ code }) => {
    const room = rooms.get(code);
    if (!room) return;
    if (!room.host || room.host.socketId !== socket.id) return;

    room.state = 'LOBBY';
    room.questionIndex = 0;
    room.timeLeft = 15;
    room.skillHistory = [];
    room.isGolden = false;
    room.isSuddenDeath = false;
    room.activeEvent = null;
    room.jackpotClaimed = false;
    room.mvpAwards = [];
    room.players.forEach(p => {
      p.score = 0;
      p.fury = 0;
      p.streak = 0;
      p.maxStreak = 0;
      p.onFire = false;
      p.stats = { correctCount: 0, wrongCount: 0, totalAnswerTime: 0, skillsUsed: 0, skillsTargeted: 0, pointsStolen: 0 };
      p.skills = [];
      p.buffs = {};
      p.debuffs = {};
      p.answered = false;
      p.answerTime = null;
      p.selectedAnswer = null;
    });
    addRoomLog(room, '🔄 Phòng chơi đã được làm mới! Sẵn sàng cho ván mới.');
    sendPersonalizedState(room);
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    for (const [code, room] of rooms.entries()) {
      // Check if Host disconnected
      if (room.host && room.host.socketId === socket.id) {
        addRoomLog(room, `⚠️ Host [${room.host.name}] bị mất kết nối.`);
        if (room.players.length === 0) {
          rooms.delete(code);
        } else {
          // In lobby, transfer host role to first human player if available
          const nextHumanIdx = room.players.findIndex(p => !p.isBot);
          if (room.state === 'LOBBY' && nextHumanIdx !== -1) {
            const nextHuman = room.players.splice(nextHumanIdx, 1)[0];
            room.host = {
              id: nextHuman.id,
              socketId: nextHuman.socketId,
              name: nextHuman.name,
              avatar: nextHuman.avatar
            };
            room.hostId = nextHuman.id;
            addRoomLog(room, `👑 [${nextHuman.name}] trở thành Host điều hành mới!`);
          }
          sendPersonalizedState(room);
        }
        break;
      }

      // Check if competing player disconnected
      const pIdx = room.players.findIndex(p => p.socketId === socket.id);
      if (pIdx !== -1) {
        const leavingPlayer = room.players[pIdx];
        if (room.state === 'LOBBY') {
          room.players.splice(pIdx, 1);
        } else {
          addRoomLog(room, `⚠️ [${leavingPlayer.name}] bị mất kết nối.`);
        }
        sendPersonalizedState(room);
        break;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`🎮 Minigame Server running on http://localhost:${PORT}`);
});
