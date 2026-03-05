// =======================================================================
// ===               EPhone 游戏大厅 (Game Hall) 脚本                  ===
// =======================================================================
// 此文件包含了所有与游戏大厅及其内部游戏相关的功能，
// 与主聊天、动态、设置等功能完全分离。

document.addEventListener('DOMContentLoaded', () => {
  const LUDO_BOARD_SIZE = 42; // 总格子数，可以根据你的棋盘布局调整

  // ▼▼▼ 游戏状态管理器 ▼▼▼
  // ▼▼▼ 【全新】这是狼人杀游戏的状态管理器 ▼▼▼
  let werewolfGameState = {
    isActive: false, // 游戏是否正在进行
    players: [], // 玩家列表 { id, name, avatar, role, isAlive, persona }
    roles: {}, // 角色配置 { wolf: 2, villager: 2, ... }
    gamePhase: 'setup', // 游戏阶段: setup, night, day_discussion, day_vote, etc.
    dayNumber: 0, // 天数
    gameLog: [], // 游戏日志
    turnIndex: 0, // 当前发言/行动的玩家索引
    votes: {}, // 投票记录
    seerLastNightResult: null, // 预言家昨晚查验结果
    witchPotions: { save: 1, poison: 1 }, // 女巫药剂
    hunterTarget: null, // 猎人目标
    lastNightKilled: [], // 昨晚被杀的玩家ID
    waitingFor: null, // 当前等待谁的行动: 'seer', 'witch_save', 'witch_poison', 'hunter', 'user_vote'
    gameConfig: {}, // 游戏配置
  };
  // ▲▲▲ 新增变量结束 ▲▲▲
  // ▼▼▼ 【全局修复】获取所有通用模态框的DOM元素，并声明一个全局的Promise解决器 ▼▼▼
  // （请将此代码块粘贴到所有 gameState 变量定义的正下方）
  let modalOverlay,
    modalConfirmBtn,
    modalCancelBtn,
    modalResolve = null;
  // 假设你的通用模态框ID是 'custom-modal-overlay'
  // 如果不是，请修改成你HTML里正确的ID
  modalOverlay = document.getElementById('custom-modal-overlay');
  modalConfirmBtn = document.getElementById('custom-modal-confirm');
  modalCancelBtn = document.getElementById('custom-modal-cancel');

  // ▲▲▲ 全局修复代码结束 ▲▲▲

  // ▼▼▼ 【全新】这是海龟汤游戏的状态管理器 ▼▼▼
  let seaTurtleSoupState = {
    isActive: false, // 游戏是否正在进行
    phase: 'setup', // 游戏阶段: setup, guessing, reveal
    players: [], // 玩家列表 { id, name, avatar, persona, isUser, isProvider }
    riddleProvider: null, // 出题人对象
    riddle: '', // 谜面
    answer: '', // 谜底
    gameLog: [], // 游戏日志
    currentTurnIndex: 0, // 当前轮到谁行动的索引
  };
  // ▲▲▲ 新增变量结束 ▲▲▲
  // ▼▼▼ 【全新】这是剧本杀游戏的状态管理器 ▼▼▼
  let scriptKillGameState = {
    isActive: false, // 游戏是否正在进行
    script: null, // 当前加载的剧本对象
    players: [], // 玩家列表 { id, name, avatar, role, isUser, evidence, persona }
    gamePhase: 'setup', // 游戏阶段: setup, introduction, evidence, discussion, voting, end
    turnIndex: 0, // 当前行动的玩家索引
    gameLog: [], // 游戏日志
    evidenceCounts: {}, // 记录每个玩家已搜证次数
    votes: {}, // 投票记录
    is自由选择: false, // 是否为自由选择角色模式
  };
  // ▲▲▲ 新增变量结束 ▲▲▲
  // ▼▼▼ 在这里粘贴下面的新代码 ▼▼▼
  let guessWhatGameState = {
    isActive: false, // 游戏是否正在进行
    mode: 'ai_guesses', // 游戏模式: 'ai_guesses' 或 'user_guesses'
    opponent: null, // 对手玩家对象 { id, name, avatar, persona }
    secretWord: '', // 谜底词语
    gameLog: [], // 游戏日志
    currentTurn: 'user', // 当前轮到谁: 'user' 或 'ai'
  };
  // ▲▲▲ 新代码粘贴结束 ▲▲▲

  // ▼▼▼ 在这里粘贴下面这一整块新代码 ▼▼▼

  let ludoGameState = {
    isActive: false,
    opponent: null,
    players: [], // { id, name, avatar, piecePosition: -1 (at home), isUser }
    currentTurnIndex: 0,
    gameLog: [],
    boardLayout: [],
    isDiceRolling: false,
  };
  // ▼▼▼ 用这块【功能增强版】的代码，替换旧的 undercoverGameState ▼▼▼
  let undercoverGameState = {
    isActive: false,
    players: [],
    civilianWord: '',
    undercoverWord: '',
    gamePhase: 'setup',
    dayNumber: 1, // 【核心修改1】将初始轮次改为 1，更符合游戏逻辑
    gameLog: [],
    turnIndex: 0,
    votes: {},
    votedOutPlayers: [], // 【核心修改2】新增此行，用于记录每轮被投出去的玩家
    tiedPlayers: [],
  };
  // ▲▲▲ 替换结束 ▲▲▲
  // ...（上面是 undercoverGameState 的定义）...

  // ▲▲▲ 替换结束 ▲▲▲
  // ▼▼▼ 【全新】万能Markdown渲染函数 (带安全过滤和遮挡效果) ▼▼▼
  function addLongPressListener(element, callback) {
    let pressTimer;
    const startPress = e => {
      if (isSelectionMode) return;
      e.preventDefault();
      pressTimer = window.setTimeout(() => callback(e), 500);
    };
    const cancelPress = () => clearTimeout(pressTimer);
    element.addEventListener('mousedown', startPress);
    element.addEventListener('mouseup', cancelPress);
    element.addEventListener('mouseleave', cancelPress);
    element.addEventListener('touchstart', startPress, { passive: true });
    element.addEventListener('touchend', cancelPress);
    element.addEventListener('touchmove', cancelPress);
  }

  /**
   * 将Markdown文本安全地渲染为HTML
   * @param {string} markdownText - 原始的Markdown文本
   * @returns {string} - 处理和净化后的安全HTML字符串
   */
  function renderMarkdown(markdownText) {
    if (!markdownText) return '';

    // 1. 【预处理】支持自定义的“遮挡/剧透”语法 ||spoiler||
    // 我们在 marked.js 处理之前，手动把 ||text|| 替换成带特定class的HTML标签
    let processedText = markdownText.replace(/\|\|(.*?)\|\|/g, '<span class="spoiler">$1</span>');

    // 2. 【核心】使用 marked.js 将Markdown转换为HTML
    // gfm: true 开启GitHub风格的Markdown，支持删除线等
    // breaks: true 让回车符也能变成<br>，更符合聊天习惯
    let rawHtml = marked.parse(processedText, { gfm: true, breaks: true });

    // 3. 【安全】使用 DOMPurify 清洗HTML，防止XSS攻击
    let sanitizedHtml = DOMPurify.sanitize(rawHtml);

    return sanitizedHtml;
  }

  // ▲▲▲ 新函数粘贴结束 ▲▲▲

  let tempGeneratedScriptData = null;

  // ▼▼▼ 游戏功能函数 ▼▼▼

  // --- 狼人杀 Werewolf ---
  // ...（后面的代码）...

  // ▼▼▼ 游戏功能函数 ▼▼▼

  // --- 狼人杀 Werewolf ---
  // ▼▼▼ 【全新】这里是狼人杀游戏的所有核心功能函数 ▼▼▼

  /**
   * 【狼人杀】打开游戏设置界面
   */
  async function openWerewolfSetup() {
    showScreen('werewolf-setup-screen');
    const selectionEl = document.getElementById('werewolf-player-selection');
    selectionEl.innerHTML = '<p>"Loading character list..."</p>';

    const singleChats = Object.values(state.chats).filter(chat => !chat.isGroup);
    const allNpcs = Object.values(state.chats).flatMap(chat =>
      (chat.npcLibrary || []).map(npc => ({ ...npc, owner: chat.name })),
    );

    let playerOptions = [
      ...singleChats.map(c => ({ id: c.id, name: c.name, avatar: c.settings.aiAvatar, type: 'Character' })),
      ...allNpcs.map(n => ({ id: n.id, name: n.name, avatar: n.avatar, type: `NPC (${n.owner})` })),
    ];

    selectionEl.innerHTML = '';
    playerOptions.forEach(player => {
      const item = document.createElement('div');
      item.className = 'player-selection-item';
      item.innerHTML = `
            <input type="checkbox" class="werewolf-player-checkbox" value="${player.id}">
            <img src="${player.avatar || defaultAvatar}" alt="${player.name}">
            <span class="name">${player.name}</span>
            <span class="type-tag">${player.type}</span>
        `;
      selectionEl.appendChild(item);
    });
    // ▼▼▼ 在这里粘贴下面这块新代码 ▼▼▼
    const inviteModeRadios = document.querySelectorAll('input[name="undercover_invite_mode"]');
    const manualOptions = document.getElementById('undercover-manual-invite-options');
    const randomOptions = document.getElementById('undercover-random-invite-options');

    inviteModeRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.value === 'manual') {
          manualOptions.style.display = 'block';
          randomOptions.style.display = 'none';
        } else {
          // random mode
          manualOptions.style.display = 'none'; // 隐藏手动列表
          randomOptions.style.display = 'block'; // 显示随机选项
        }
      });
    });

    // 默认触发一次，以确保初始状态正确
    document.querySelector('input[name="undercover_invite_mode"]:checked').dispatchEvent(new Event('change'));
    // ▲▲▲ 粘贴结束 ▲▲▲
  }

  /**
   * 【狼人杀】开始游戏的核心逻辑
   */
  async function startWerewolfGame() {
    const countSelect = document.getElementById('werewolf-player-count');
    const totalPlayers = parseInt(countSelect.value);

    const selectedCheckboxes = document.querySelectorAll('.werewolf-player-checkbox:checked');
    // 邀请的AI/NPC数量必须是总人数-1（因为User是必须加入的）
    if (selectedCheckboxes.length !== totalPlayers - 1) {
      alert(`Please select ${totalPlayers - 1} AI or NPC players!`);
      return;
    }

    // --- 1. 重置并初始化游戏状态 ---
    werewolfGameState = {
      isActive: true,
      players: [],
      roles: {},
      gamePhase: 'start',
      dayNumber: 0,
      gameLog: [],
      turnIndex: 0,
      votes: {},
      seerLastNightResult: null,
      witchPotions: { save: 1, poison: 1 },
      hunterTarget: null,
      lastNightKilled: [],
      waitingFor: null,
      gameConfig: { totalPlayers },
    };

    // --- 2. 收集玩家信息 ---
    // 添加User
    werewolfGameState.players.push({
      id: 'user',
      name: state.qzoneSettings.nickname || 'Me',
      avatar: state.qzoneSettings.avatar || defaultAvatar,
      isAlive: true,
      isUser: true, // 标记为真实用户
    });

    // 添加被邀请的AI和NPC
    selectedCheckboxes.forEach(checkbox => {
      const playerId = checkbox.value;
      const chat = Object.values(state.chats).find(c => c.id === playerId);
      if (chat) {
        // 是主要角色
        werewolfGameState.players.push({
          id: chat.id,
          name: chat.name,
          avatar: chat.settings.aiAvatar,
          persona: chat.settings.aiPersona,
          isAlive: true,
          isUser: false,
        });
      } else {
        // 是NPC
        for (const c of Object.values(state.chats)) {
          const npc = (c.npcLibrary || []).find(n => n.id === playerId);
          if (npc) {
            werewolfGameState.players.push({
              id: npc.id,
              name: npc.name,
              avatar: npc.avatar,
              persona: npc.persona,
              isAlive: true,
              isUser: false,
            });
            break;
          }
        }
      }
    });

    // 打乱玩家顺序（座位顺序）
    werewolfGameState.players.sort(() => Math.random() - 0.5);

    // --- 3. 根据人数分配角色 ---
    const roleConfigs = {
      6: { wolf: 2, villager: 2, seer: 1, guard: 1 },
      9: { wolf: 3, villager: 3, seer: 1, witch: 1, hunter: 1 },
      12: { wolf: 4, villager: 4, seer: 1, witch: 1, hunter: 1, idiot: 1 },
    };
    // ▼▼▼ 【核心Bug修复】用这块代码替换上面的错误代码 ▼▼▼
    const rolesToAssign = [];
    const config = roleConfigs[totalPlayers];
    werewolfGameState.roles = config; // 将角色配置存入游戏状态
    for (const role in config) {
      for (let i = 0; i < config[role]; i++) {
        // 修正：config[i] -> config[role]
        rolesToAssign.push(role);
      }
    }
    // ▲▲▲ 修复结束 ▲▲▲
    rolesToAssign.sort(() => Math.random() - 0.5); // 打乱角色

    werewolfGameState.players.forEach((player, index) => {
      player.role = rolesToAssign[index];
    });
    // ▼▼▼ 在这里添加下面的新代码 ▼▼▼
    // ▼▼▼ 第1处修改（添加翻译）▼▼▼
    const roleNameMap = {
      wolf: 'Wolf',
      villager: 'Villager',
      seer: 'Seer',
      witch: 'Witch',
      hunter: 'Hunter',
      guard: 'Guard',
      idiot: 'Idiot',
    };

    // 弹窗告知用户身份
    const userPlayer = werewolfGameState.players.find(p => p.isUser);
    if (userPlayer) {
      const myRoleName = roleNameMap[userPlayer.role] || userPlayer.role;
      await showCustomAlert('Your Role', `Your role in this game is: 【${myRoleName}】`);
    }
    // ▲▲▲ 修改结束 ▲▲▲
    // --- 4. 切换到游戏界面并开始游戏循环 ---
    showScreen('werewolf-game-screen');
    await processGameTurn();
  }

  // ▼▼▼ 用这【一整块】全新的游戏引擎代码，替换旧的 processGameTurn 函数 ▼▼▼
  /**
   * 【狼人杀 V2】游戏主循环/引擎
   */
  async function processGameTurn() {
    if (!werewolfGameState.isActive) return;

    renderWerewolfGameScreen();

    switch (werewolfGameState.gamePhase) {
      case 'start':
        logToWerewolfGame('Game start, assigning roles...');
        const roleNameMapForLog = {
          wolf: 'Wolf',
          villager: 'Villager',
          seer: 'Seer',
          witch: 'Witch',
          hunter: 'Hunter',
          guard: 'Guard',
          idiot: 'Idiot',
        };
        const configText = Object.entries(werewolfGameState.roles)
          .map(([role, count]) => `${roleNameMapForLog[role] || role}x${count}`)
          .join(', ');
        logToWerewolfGame(`Game configuration: ${configText}`);
        werewolfGameState.gamePhase = 'night_start';
        await sleep(3000);
        await processGameTurn();
        break;

      case 'night_start':
        werewolfGameState.dayNumber++;
        werewolfGameState.lastNightKilled = [];
        werewolfGameState.votes = {};
        logToWerewolfGame(`Day ${werewolfGameState.dayNumber}, night falls. Please close your eyes.`);
        werewolfGameState.gamePhase = 'guard_action'; // 从守卫开始
        await sleep(2000);
        await processGameTurn();
        break;

      // 【守卫行动阶段】
      case 'guard_action':
        const guard = werewolfGameState.players.find(p => p.role === 'guard' && p.isAlive);
        if (guard) {
          logToWerewolfGame('Guard, please open your eyes and choose a player to protect.');
          let protectedId;
          // ★★★ 核心检查点1：判断守卫是不是User ★★★
          if (guard.isUser) {
            // 如果是，就调用waitForUserAction，这会弹出操作框
            protectedId = await waitForUserAction('Please choose a player to protect', 'guard_protect');
          } else {
            // 如果不是，就让AI自己决策
            protectedId = await triggerWerewolfAiAction(guard.id, 'guard_protect');
          }
          werewolfGameState.guardLastNightProtected = protectedId;
          logToWerewolfGame(`Guard, please close your eyes.`);
        }
        werewolfGameState.gamePhase = 'wolf_action';
        await sleep(2000);
        await processGameTurn();
        break;

      // ▼▼▼ 用这块【狼人频道增强+平票处理版】的代码替换旧的 'wolf_action' case ▼▼▼
      case 'wolf_action':
        logToWerewolfGame('Wolves, please open your eyes and choose a target.');
        const wolves = werewolfGameState.players.filter(p => p.role === 'wolf' && p.isAlive);
        const userPlayer = wolves.find(w => w.isUser);
        let allWolfVotes = [];

        // 场景1: 用户是狼人
        if (userPlayer) {
          const aiWolves = wolves.filter(w => !w.isUser);
          let suggestionsText = '🐺 Wolf Channel (Secret):\n';

          if (aiWolves.length > 0) {
            // 从AI队友获取建议
            const aiVotePromises = aiWolves.map(wolf =>
              triggerWerewolfAiAction(wolf.id, 'wolf_kill', { isUserWolfAlly: true }),
            );
            const aiVotes = (await Promise.all(aiVotePromises)).filter(Boolean);
            allWolfVotes.push(...aiVotes);

            // 格式化建议给用户看
            aiVotes.forEach((targetId, index) => {
              const votingWolf = aiWolves[index];
              const targetPlayer = werewolfGameState.players.find(p => p.id === targetId);
              if (votingWolf && targetPlayer) {
                suggestionsText += `- ${votingWolf.name} suggests killing: ${targetPlayer.name}\n`;
              }
            });
            suggestionsText += '\nPlease consider your teammates\' suggestions before voting.';

            await showCustomAlert('Wolves, please communicate', suggestionsText);
          } else {
            await showCustomAlert('You are the only wolf', 'Please decide tonight\'s target alone.');
          }

          // 获取用户的最终投票
          const userVote = await waitForUserAction('Please choose the final target', 'wolf_kill');
          if (userVote) {
            allWolfVotes.push(userVote);
          }
        } else {
          // 场景2: 用户不是狼人，AI狼人自行决定
          const wolfPromises = wolves.map(wolf => triggerWerewolfAiAction(wolf.id, 'wolf_kill'));
          const wolfVotes = (await Promise.all(wolfPromises)).filter(Boolean);
          allWolfVotes.push(...wolfVotes);
        }

        // 统计所有狼人的投票
        const voteCounts = {};
        allWolfVotes.forEach(vote => {
          voteCounts[vote] = (voteCounts[vote] || 0) + 1;
        });

        let maxVotes = 0;
        let targetId = null;
        let tied = false;
        for (const id in voteCounts) {
          if (voteCounts[id] > maxVotes) {
            maxVotes = voteCounts[id];
            targetId = id;
            tied = false;
          } else if (voteCounts[id] === maxVotes) {
            tied = true;
          }
        }

        // ★★★ 这就是我们新增的平票处理逻辑！★★★
        if (tied && maxVotes > 0) {
          // 如果出现平票，就从所有平票的目标中随机选择一个
          const tiedTargets = Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes);
          targetId = tiedTargets[Math.floor(Math.random() * tiedTargets.length)];
          logToWerewolfGame(
            `(After intense discussion among the wolves, the final target is ${werewolfGameState.players.find(p => p.id === targetId).name})`,
          );
        }

        if (targetId) {
          // 只要有目标（无论是统一意见还是随机决定），就执行击杀
          werewolfGameState.lastNightKilled = [targetId];
          logToWerewolfGame(`Wolves, please close your eyes.`);
        } else {
          // 只有在所有狼人都没投票的情况下，才会是平安夜
          logToWerewolfGame(`Wolves have decided to take no action tonight. No one was attacked.`);

          werewolfGameState.lastNightKilled = [];
        }

        // 进入下一个游戏阶段
        werewolfGameState.gamePhase = 'seer_action';
        await sleep(2000);
        await processGameTurn();
        break;
      // ▲▲▲ 替换结束 ▲▲▲

      // 【预言家行动阶段】
      case 'seer_action':
        const seer = werewolfGameState.players.find(p => p.role === 'seer' && p.isAlive);
        if (seer) {
          logToWerewolfGame('Seer, please open your eyes and choose a player to check.');
          let targetId;
          // ★★★ 核心检查点3：判断预言家是不是User ★★★
          if (seer.isUser) {
            targetId = await waitForUserAction('Please choose a player to check', 'seer_check');
          } else {
            targetId = await triggerWerewolfAiAction(seer.id, 'seer_check');
          }
          const targetPlayer = werewolfGameState.players.find(p => p.id === targetId);
          const isWolf = targetPlayer.role === 'wolf';
          werewolfGameState.seerLastNightResult = { targetName: targetPlayer.name, isWolf: isWolf };
          logToWerewolfGame(`Seer, please close your eyes.`);
          if (seer.isUser) {
            await showCustomAlert('Check Result', `${targetPlayer.name}'s role is: ${isWolf ? 'Wolf' : 'Villager'}`);
          }
        }
        werewolfGameState.gamePhase = 'witch_action';
        await sleep(2000);
        await processGameTurn();
        break;

      // 【女巫行动阶段】
      case 'witch_action':
        const witch = werewolfGameState.players.find(p => p.role === 'witch' && p.isAlive);
        if (witch) {
          logToWerewolfGame('Witch, please open your eyes.');
          const killedId = werewolfGameState.lastNightKilled[0];
          let killedPlayerName = null;
          if (killedId) {
            killedPlayerName = werewolfGameState.players.find(p => p.id === killedId).name;
            logToWerewolfGame(`Tonight ${killedPlayerName} was attacked.`);
          }

          let witchAction;
          // ★★★ 核心检查点4：判断女巫是不是User ★★★
          if (witch.isUser) {
            witchAction = await waitForUserAction('Witch, please take action', 'witch_action', { killedId, killedPlayerName });
          } else {
            witchAction = await triggerWerewolfAiAction(witch.id, 'witch_action', { killedId });
          }

          if (witchAction?.action === 'save' && killedId) {
            werewolfGameState.lastNightKilled = [];
            werewolfGameState.witchPotions.save = 0;
          } else if (witchAction?.action === 'poison' && witchAction.targetId) {
            werewolfGameState.lastNightKilled.push(witchAction.targetId);
            werewolfGameState.witchPotions.poison = 0;
          }
        }
        logToWerewolfGame(`Witch, please close your eyes.`);
        werewolfGameState.gamePhase = 'day_start';
        await sleep(2000);
        await processGameTurn();
        break;

      case 'day_start':
        logToWerewolfGame('Day has come.');
        let deathAnnouncements = [];
        const deathsThisNight = new Set();

        werewolfGameState.lastNightKilled.forEach(killedId => {
          if (killedId === werewolfGameState.guardLastNightProtected) {
            logToWerewolfGame(
              `Last night ${werewolfGameState.players.find(p => p.id === killedId).name} was attacked but was also protected.`,
            );
          } else {
            deathsThisNight.add(killedId);
          }
        });

        if (deathsThisNight.size === 0) {
          logToWerewolfGame('Last night was a peaceful night.');
        } else {
          deathsThisNight.forEach(deadId => {
            const deadPlayer = werewolfGameState.players.find(p => p.id === deadId);
            if (deadPlayer.isAlive) {
              deadPlayer.isAlive = false;
              deathAnnouncements.push(`${deadPlayer.name} was eliminated last night.`);
            }
          });
          deathAnnouncements.forEach(announcement => logToWerewolfGame(announcement));
        }

        renderWerewolfGameScreen();
        if (checkGameOver()) return;

        let hunterDied = null;
        deathsThisNight.forEach(deadId => {
          const deadPlayer = werewolfGameState.players.find(p => p.id === deadId);
          if (deadPlayer.role === 'hunter') hunterDied = deadPlayer;
        });

        if (hunterDied) {
          logToWerewolfGame(`${hunterDied.name} is the Hunter and can choose a player to take down with them.`);
          let targetId;
          // ★★★ 核心检查点5：判断猎人是不是User ★★★
          if (hunterDied.isUser) {
            targetId = await waitForUserAction('Please choose a player to take down', 'hunter_shoot');
          } else {
            targetId = await triggerWerewolfAiAction(hunterDied.id, 'hunter_shoot');
          }
          if (targetId) {
            const targetPlayer = werewolfGameState.players.find(p => p.id === targetId);
            targetPlayer.isAlive = false;
            logToWerewolfGame(`The Hunter took down ${targetPlayer.name}.`);
            renderWerewolfGameScreen();
            if (checkGameOver()) return;
          }
        }

        werewolfGameState.gamePhase = 'day_discussion';
        await sleep(2000);
        await processGameTurn();
        break;

      case 'day_discussion':
        logToWerewolfGame('Now it\'s time for each player to speak.');
        const alivePlayersForSpeech = werewolfGameState.players.filter(p => p.isAlive);
        for (const player of alivePlayersForSpeech) {
          renderWerewolfGameScreen({ speakingPlayerId: player.id });
          let speech;
          if (player.isUser) {
            speech = await waitForUserAction('It\'s your turn to speak', 'speak');
          } else {
            speech = await triggerWerewolfAiAction(player.id, 'speak');
          }
          logToWerewolfGame({ player: player, speech: speech }, 'speech');
          await sleep(1000);
        }
        renderWerewolfGameScreen();
        werewolfGameState.gamePhase = 'day_vote';
        await processGameTurn();
        break;

      case 'day_vote':
        logToWerewolfGame('Please vote for the player you think is a werewolf.');
        const voterPromises = werewolfGameState.players
          .filter(p => p.isAlive)
          .map(player => {
            if (player.isUser) {
              return waitForUserAction('Please vote', 'vote');
            } else {
              return triggerWerewolfAiAction(player.id, 'vote');
            }
          });
        const allVotesResult = (await Promise.all(voterPromises)).filter(Boolean);

        const voteTallyResult = {};
        allVotesResult.forEach(vote => {
          voteTallyResult[vote] = (voteTallyResult[vote] || 0) + 1;
        });

        let maxVotesResult = 0,
          playersToEliminate = [];
        for (const playerId in voteTallyResult) {
          if (voteTallyResult[playerId] > maxVotesResult) {
            maxVotesResult = voteTallyResult[playerId];
            playersToEliminate = [playerId];
          } else if (voteTallyResult[playerId] === maxVotesResult) {
            playersToEliminate.push(playerId);
          }
        }

        if (playersToEliminate.length === 1) {
          const eliminatedPlayer = werewolfGameState.players.find(p => p.id === playersToEliminate[0]);
          eliminatedPlayer.isAlive = false;
          logToWerewolfGame(`Vote result: ${eliminatedPlayer.name} was eliminated.`);
          renderWerewolfGameScreen();
          if (checkGameOver()) return;
          if (eliminatedPlayer.role === 'hunter') {
            logToWerewolfGame(`${eliminatedPlayer.name} is the Hunter and can choose a player to take down with them.`);
            let targetId;
            if (eliminatedPlayer.isUser) {
              targetId = await waitForUserAction('Please choose a player to take down', 'hunter_shoot');
            } else {
              targetId = await triggerWerewolfAiAction(eliminatedPlayer.id, 'hunter_shoot');
            }
            if (targetId) {
              const targetPlayer = werewolfGameState.players.find(p => p.id === targetId);
              targetPlayer.isAlive = false;
              logToWerewolfGame(`The Hunter took down ${targetPlayer.name}.`);
              renderWerewolfGameScreen();
              if (checkGameOver()) return;
            }
          }
        } else {
          logToWerewolfGame('The vote is tied, no one is eliminated.');
        }

        werewolfGameState.gamePhase = 'night_start';
        await sleep(3000);
        await processGameTurn();
        break;
    }
  }
  // ▲▲▲ 新引擎代码结束 ▲▲▲
  // ▼▼▼ 【全新】这是狼人杀的重roll功能核心函数 ▼▼▼
  /**
   * 【狼人杀】处理AI发言的重roll请求
   * @param {number} logIndex - 要重roll的发言在gameLog中的索引
   */
  async function handleWerewolfReroll(logIndex) {
    const logEntry = werewolfGameState.gameLog[logIndex];
    if (!logEntry || logEntry.type !== 'speech' || logEntry.message.player.isUser) {
      return; // 安全检查，确保我们操作的是AI的发言
    }

    const playerToReroll = logEntry.message.player;

    // 给用户一个即时反馈
    const speechTextElement = document
      .querySelector(`button[data-log-index="${logIndex}"]`)
      .closest('.speech-content')
      .querySelector('.speech-text');
    if (speechTextElement) {
      speechTextElement.innerHTML = '<i>Thinking...</i>';
    }

    try {
      // 重新调用AI生成新的发言
      const newSpeech = await triggerWerewolfAiAction(playerToReroll.id, 'speak');

      // 用新的发言内容替换掉旧的
      werewolfGameState.gameLog[logIndex].message.speech = newSpeech;

      // 重新渲染整个游戏界面以显示更新
      renderWerewolfGameScreen();
    } catch (error) {
      console.error('Werewolf AI speech reroll failed:', error);
      if (speechTextElement) {
        speechTextElement.innerHTML = `<i style="color:red;">Reroll failed, please check your network or API settings.</i>`;
      }
    }
  }
  // ▲▲▲ 新增函数结束 ▲▲▲

  // ▼▼▼ 请用这块【已添加重roll按钮】的代码，完整替换旧的 renderWerewolfGameScreen 函数 ▼▼▼
  /**
   * 【狼人杀】渲染游戏主界面
   */
  function renderWerewolfGameScreen(options = {}) {
    const playersGrid = document.getElementById('werewolf-players-grid');
    const logContainer = document.getElementById('werewolf-game-log');

    // 渲染玩家座位
    playersGrid.innerHTML = '';
    werewolfGameState.players.forEach(player => {
      const seat = document.createElement('div');
      seat.className = 'player-seat';
      const avatarClass = `player-avatar ${!player.isAlive ? 'dead' : ''} ${
        options.speakingPlayerId === player.id ? 'speaking' : ''
      } ${options.activePlayerId === player.id ? 'active-turn' : ''}`;

      let roleIndicator = '';
      const user = werewolfGameState.players.find(p => p.isUser);
      // 如果我是狼人，显示所有狼人队友
      if (user.role === 'wolf' && player.role === 'wolf') {
        roleIndicator = '<div class="player-role-indicator" style="display: flex;">W</div>';
      }

      seat.innerHTML = `
            ${roleIndicator}
            <img src="${player.avatar}" class="${avatarClass}">
            <span class="player-name">${player.name} (${player.isAlive ? 'Alive' : 'Eliminated'})</span>
        `;
      playersGrid.appendChild(seat);
    });

    // 渲染游戏日志
    logContainer.innerHTML = werewolfGameState.gameLog
      .map((log, index) => {
        // ★ 核心修改1：增加了index参数
        // 判断是否为AI的发言
        if (log.type === 'speech' && typeof log.message === 'object' && !log.message.player.isUser) {
          const { player, speech } = log.message;
          // ★ 核心修改2：在AI发言的DOM结构中，加入一个带有特殊data属性的重roll按钮
          return `
            <div class="log-entry speech">
                <img src="${player.avatar}" class="speech-avatar">
                <div class="speech-content">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="speaker">${player.name}</span>
                        <button class="werewolf-reroll-btn" data-log-index="${index}" title="Reroll speech" style="background:none; border:none; cursor:pointer; padding:0; color:var(--text-secondary);">
                            <svg class="reroll-btn-icon" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                        </button>
                    </div>
                    <span class="speech-text">${speech.replace(/\n/g, '<br>')}</span>
                </div>
            </div>
        `;
        }
        // 用户发言或其他系统消息保持原样
        else if (log.type === 'speech' && typeof log.message === 'object') {
          const { player, speech } = log.message;
          return `
            <div class="log-entry speech">
                <img src="${player.avatar}" class="speech-avatar">
                <div class="speech-content">
                    <span class="speaker">${player.name}</span>
                    <span class="speech-text">${speech.replace(/\n/g, '<br>')}</span>
                </div>
            </div>
        `;
        } else {
          return `<div class="log-entry ${log.type}">${String(log.message).replace(/\n/g, '<br>')}</div>`;
        }
      })
      .join('');
    logContainer.scrollTop = logContainer.scrollHeight;
  }
  // ▲▲▲ 替换结束 ▲▲▲

  /**
   * 【狼人杀】等待用户投票
   */
  function waitForUserVote() {
    return new Promise(resolve => {
      const actionArea = document.getElementById('werewolf-action-area');
      const alivePlayers = werewolfGameState.players.filter(p => p.isAlive && !p.isUser);

      actionArea.innerHTML = '<h5>Please vote:</h5>';
      const grid = document.createElement('div');
      grid.className = 'vote-target-grid';

      alivePlayers.forEach(player => {
        const btn = document.createElement('button');
        btn.className = 'form-button-secondary vote-target-btn';
        btn.textContent = player.name;
        btn.onclick = () => {
          actionArea.innerHTML = '';
          resolve(player.id);
        };
        grid.appendChild(btn);
      });
      actionArea.appendChild(grid);
    });
  }

  /**
   * 【狼人杀】添加一条游戏日志
   */
  function logToWerewolfGame(message, type = 'system') {
    werewolfGameState.gameLog.push({ message, type });
    renderWerewolfGameScreen();
  }
  /**
   * 【狼人杀-AI核心】调用AI为整局游戏生成复盘摘要
   * @returns {Promise<string>} - AI生成的摘要文本
   */
  async function generateAiGameSummary() {
    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
      return '(AI summary generation failed: API not configured)';
    }

    // 格式化完整的游戏日志，让AI能够理解
    const formattedLog = werewolfGameState.gameLog
      .map(log => {
        if (log.type === 'speech') {
          return `${log.message.player.name}: ${log.message.speech}`;
        }
        return log.message;
      })
      .join('\n');

    const prompt = `
# Task
You are a professional Werewolf game analyst. Based on the complete game log below, please summarize the key events and turning points of this game in 100-150 words, objectively and concisely.

# Core Requirements
- Your summary should be logical and well-structured.
- Highlight the actions of key players, such as the Seer's checks, the Witch's actions, and the Hunter's shots.

- Analyze the strategic interactions between the Werewolf and Villager factions.
- Your output must be plain text containing only the game summary, without any additional dialogue or headings.

# Game Log
${formattedLog}
`;

    try {
      const messagesForApi = [{ role: 'user', content: prompt }];
      let isGemini = proxyUrl === GEMINI_API_URL;
      let geminiConfig = toGeminiRequestData(model, apiKey, prompt, messagesForApi, isGemini);

      const response = isGemini
        ? await fetch(geminiConfig.url, geminiConfig.data)
        : await fetch(`${proxyUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              temperature: parseFloat(state.apiConfig.temperature) || 0.8,
            }),
          });

      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      return (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).trim();
    } catch (error) {
      console.error('AI summary generation failed:', error);
      return '(AI summary generation failed, please check your network or API settings)';
    }
  }

  /**
   * 【狼人杀 V2 - 增强版】生成游戏复盘的文本，包含AI摘要
   * @param {string} winner - 胜利的阵营名称
   * @param {string} aiSummary - AI生成的摘要文本
   * @returns {string} - 格式化后的完整复盘Markdown文本
   */
  function generateWerewolfSummary(winner, aiSummary) {
    const roleNameMap = {
      wolf: 'Werewolf',
      villager: 'Villager',
      seer: 'Seer',
      witch: 'Witch',
      hunter: 'Hunter',
      guard: 'Guard',
      idiot: 'Idiot',
    };

    let summaryText = `**Werewolf - Game Summary**\n\n`; // 优化标题
    summaryText += `🏆 **Winner:** ${winner}\n`;
    summaryText += `📅 **Game Days:** ${werewolfGameState.dayNumber} days\n\n`;

    // 加入AI生成的摘要
    summaryText += `**Game Summary:**\n${aiSummary}\n\n`;

    summaryText += `**Player Review:**\n`;
    werewolfGameState.players.forEach(p => {
      const status = p.isAlive ? 'Alive' : 'Eliminated';
      const roleName = roleNameMap[p.role] || p.role;
      summaryText += `- ${p.name} (${roleName}) - ${status}\n`;
    });

    return summaryText;
  }

  /**
   * 【狼人杀】打开复盘发送目标选择器
   * @param {string} summaryText - 要发送的复盘文本
   */
  function openWerewolfSummaryTargetPicker(summaryText) {
    const modal = document.getElementById('werewolf-target-picker-modal');
    const listEl = document.getElementById('werewolf-target-list');
    listEl.innerHTML = '';

    const aiPlayers = werewolfGameState.players.filter(p => !p.isUser);

    if (aiPlayers.length === 0) {
      alert('No AI players available to send.');
      return;
    }

    // Render the list of selectable AI players
    aiPlayers.forEach(player => {
      const item = document.createElement('div');
      item.className = 'player-selection-item'; // 复用之前的样式
      item.innerHTML = `
            <input type="checkbox" class="werewolf-target-checkbox" value="${player.id}" checked>
            <img src="${player.avatar || defaultAvatar}" alt="${player.name}">
            <span class="name">${player.name}</span>
        `;
      listEl.appendChild(item);
    });

    // 绑定按钮事件
    const confirmBtn = document.getElementById('wt-confirm-btn');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.onclick = () => {
      const selectedIds = Array.from(document.querySelectorAll('.werewolf-target-checkbox:checked')).map(
        cb => cb.value,
      );
      if (selectedIds.length > 0) {
        sendSummaryToSelectedPlayers(summaryText, selectedIds);
      } else {
        alert('Please select at least one recipient!');
      }
    };

    const cancelBtn = document.getElementById('wt-cancel-btn');
    cancelBtn.onclick = () => modal.classList.remove('visible');

    document.getElementById('wt-select-all-btn').onclick = () => {
      document.querySelectorAll('.werewolf-target-checkbox').forEach(cb => (cb.checked = true));
    };
    document.getElementById('wt-deselect-all-btn').onclick = () => {
      document.querySelectorAll('.werewolf-target-checkbox').forEach(cb => (cb.checked = false));
    };

    modal.classList.add('visible');
  }

  /**
   * 【狼人杀】显示游戏结算卡片模态框
   * @param {string} summaryText - 复盘文本
   */
  function showWerewolfSummaryModal(summaryText) {
    const modal = document.getElementById('werewolf-summary-modal');
    const contentEl = document.getElementById('werewolf-summary-content');

    // 使用你已有的Markdown渲染函数，让复盘更好看
    contentEl.innerHTML = renderMarkdown(summaryText);

    // 为按钮绑定事件 (使用克隆节点防止重复绑定)
    const repostBtn = document.getElementById('repost-summary-btn');
    const newRepostBtn = repostBtn.cloneNode(true);
    repostBtn.parentNode.replaceChild(newRepostBtn, repostBtn);
    newRepostBtn.onclick = () => openWerewolfSummaryTargetPicker(summaryText);

    const backBtn = document.getElementById('back-to-hall-btn');
    const newBackBtn = backBtn.cloneNode(true);
    backBtn.parentNode.replaceChild(newBackBtn, backBtn);
    newBackBtn.onclick = () => {
      modal.classList.remove('visible');
      showScreen('game-hall-screen');
    };

    modal.classList.add('visible');
  }
  /**
   * 【狼人杀 V2 - 增强版】将游戏复盘发送到【选定】的AI角色的聊天中
   * @param {string} summaryText - 复盘文本
   * @param {string[]} targetIds - 目标AI角色的ID数组
   */
  async function sendSummaryToSelectedPlayers(summaryText, targetIds) {
    // 先关闭所有可能打开的弹窗
    document.getElementById('werewolf-summary-modal').classList.remove('visible');
    document.getElementById('werewolf-target-picker-modal').classList.remove('visible');

    const aiPlayers = werewolfGameState.players.filter(p => !p.isUser);
    let sentCount = 0;

    const aiContext = `[System Instruction: A game of Werewolf has just ended. This is the game summary. Please use this summary to chat with the user in character.]\n\n${summaryText}`;

    for (const chatId of targetIds) {
      const chat = state.chats[chatId];
      if (chat) {
        // ▼▼▼ 核心修改就在这里 ▼▼▼
        // 1. 创建对用户可见的【复盘卡片】消息
        // 创建对用户可见的复盘消息
        const visibleMessage = {
          role: 'user',
          type: 'share_link',
          timestamp: Date.now(),
          title: 'Werewolf - Game Summary',
          description: 'Click to view the detailed game summary',
          source_name: 'Game Center',
          content: summaryText,
        };

        // 2. 创建对AI可见的【隐藏指令】
        const hiddenInstruction = {
          role: 'system',
          content: aiContext,
          timestamp: Date.now() + 1,
          isHidden: true,
        };

        // 3. 将【两条】消息推入历史记录
        chat.history.push(visibleMessage, hiddenInstruction);
        await db.chats.put(chat);
        sentCount++;
        // ▲▲▲ 修改结束 ▲▲▲
      }
    }

    await showCustomAlert('Send Successful', `The game summary has been sent to ${sentCount} AI players' chats!`);
    showScreen('game-hall-screen');
  }

  // ▼▼▼ 用这个【修正后】的函数替换旧的 checkGameOver ▼▼▼
  function checkGameOver() {
    const alivePlayers = werewolfGameState.players.filter(p => p.isAlive);
    const aliveWolves = alivePlayers.filter(p => p.role === 'wolf').length;
    const aliveGods = alivePlayers.filter(p => ['seer', 'witch', 'hunter', 'guard', 'idiot'].includes(p.role)).length;
    const aliveVillagers = alivePlayers.filter(p => p.role === 'villager').length;

    let winner = null;

    if (aliveWolves === 0) {
      winner = 'Villager Team';
    } else if (aliveWolves >= aliveGods + aliveVillagers) {
      winner = 'Werewolf Team';
    } else if (aliveGods === 0 && aliveVillagers === 0) {
      winner = 'Werewolf Team';
    }

    if (winner) {
      logToWerewolfGame(`Game Over! ${winner} wins!`);
      const roleNameMap = {
        wolf: 'Werewolf',
        villager: 'Villager',
        seer: 'Seer',
        witch: 'Witch',
        hunter: 'Hunter',
        guard: 'Guard',
        idiot: 'Idiot',
      };
      const rolesReveal = werewolfGameState.players.map(p => `${p.name}: ${roleNameMap[p.role] || p.role}`).join('\n');
      logToWerewolfGame(`Roles Revealed:\n${rolesReveal}`);

      // 【核心修改】在这里调用AI生成摘要并显示结算卡
      (async () => {
        await showCustomAlert('Please wait...', 'AI is generating the game summary...');
        const aiSummary = await generateAiGameSummary();
        const summary = generateWerewolfSummary(winner, aiSummary);
        showWerewolfSummaryModal(summary);
      })();

      werewolfGameState.isActive = false;
      document.getElementById('werewolf-action-area').innerHTML = '';

      return true;
    }

    return false;
  }
  // ▲▲▲ 替换结束 ▲▲▲

  // ▼▼▼ 【狼人杀输入框美化】请用这个【全新】的函数，完整替换掉你旧的 waitForUserAction 函数 ▼▼▼
  /**
   * 【狼人杀 V2 - 输入框美化版】等待用户行动的通用函数
   */
  function waitForUserAction(prompt, actionType, context = {}) {
    const me = werewolfGameState.players.find(p => p.isUser);

    // ★★★ 核心修复：当用户死亡时，允许'hunter_shoot'动作继续执行 ★★★
    if (me && !me.isAlive && actionType !== 'hunter_shoot') {
      const actionArea = document.getElementById('werewolf-action-area');
      actionArea.innerHTML = `<h5>You have been eliminated, watching the game...</h5>`;
      return new Promise(async resolve => {
        await sleep(3000);
        actionArea.innerHTML = '';
        resolve(null);
      });
    }
    // ★★★ 修复结束 ★★★

    return new Promise(resolve => {
      const actionArea = document.getElementById('werewolf-action-area');
      actionArea.innerHTML = ''; // 清空，准备新的UI
      actionArea.className = 'werewolf-action-area'; // 重置class

      if (actionType === 'speak') {
        // --- 这是我们美化后的发言输入区 ---
        actionArea.classList.add('speaking-mode'); // 激活新CSS

        const textarea = document.createElement('textarea');
        textarea.id = 'user-speech-input';
        textarea.rows = 1;
        textarea.placeholder = 'Enter your speech...';
        // 实时调整高度
        textarea.addEventListener('input', () => {
          textarea.style.height = 'auto';
          textarea.style.height = textarea.scrollHeight + 'px';
        });

        const endBtn = document.createElement('button');
        endBtn.id = 'end-speech-btn';
        endBtn.className = 'form-button'; // 保留一个基础class
        endBtn.textContent = 'End Speech';

        actionArea.appendChild(textarea);
        actionArea.appendChild(endBtn);

        textarea.focus();

        endBtn.onclick = () => {
          const speech = textarea.value.trim() || 'I pass.';
          actionArea.innerHTML = '';
          actionArea.classList.remove('speaking-mode');
          resolve(speech);
        };
        return; // 结束 'speak' 分支
      }

      // --- 以下是其他非发言动作的UI，保持原样 ---
      actionArea.innerHTML = `<h5>${prompt}</h5>`;
      const grid = document.createElement('div');
      grid.className = 'vote-target-grid';

      if (actionType === 'witch_action') {
        if (context.killedId && werewolfGameState.witchPotions.save > 0) {
          const saveBtn = document.createElement('button');
          saveBtn.className = 'form-button';
          saveBtn.textContent = `Use Antidote to save ${context.killedPlayerName}`;
          saveBtn.onclick = () => {
            actionArea.innerHTML = '';
            resolve({ action: 'save' });
          };
          grid.appendChild(saveBtn);
        }
        if (werewolfGameState.witchPotions.poison > 0) {
          const poisonBtn = document.createElement('button');
          poisonBtn.className = 'form-button form-button-secondary';
          poisonBtn.textContent = 'Use Poison';
          poisonBtn.onclick = async () => {
            const targetId = await waitForUserAction('Choose a player to poison', 'witch_poison_target');
            resolve({ action: 'poison', targetId: targetId });
          };
          grid.appendChild(poisonBtn);
        }
        const passBtn = document.createElement('button');
        passBtn.className = 'form-button form-button-secondary';
        passBtn.textContent = 'Pass';
        passBtn.onclick = () => {
          actionArea.innerHTML = '';
          resolve({ action: 'none' });
        };
        grid.appendChild(passBtn);
        actionArea.appendChild(grid);
        return;
      }

      let targets = [];
      if (['guard_protect', 'seer_check', 'hunter_shoot', 'witch_poison_target'].includes(actionType)) {
        targets = werewolfGameState.players.filter(p => p.isAlive);
      } else if (actionType === 'wolf_kill') {
        targets = werewolfGameState.players.filter(p => p.isAlive && p.role !== 'wolf');
      } else if (actionType === 'vote') {
        targets = werewolfGameState.players.filter(p => p.isAlive);
      }

      // ★★★ 针对猎人开枪的特殊目标筛选 ★★★
      // 如果是猎人开枪，目标不应该包括自己
      if (actionType === 'hunter_shoot') {
        targets = targets.filter(p => p.id !== me.id);
      }

      targets.forEach(player => {
        const btn = document.createElement('button');
        btn.className = 'form-button-secondary vote-target-btn';
        btn.textContent = player.name;
        btn.onclick = () => {
          actionArea.innerHTML = '';
          resolve(player.id);
        };
        grid.appendChild(btn);
      });

      if (actionType === 'vote') {
        const passBtn = document.createElement('button');
        passBtn.className = 'form-button-secondary vote-target-btn';
        passBtn.textContent = 'Abstain';
        passBtn.onclick = () => {
          actionArea.innerHTML = '';
          resolve(null);
        };
        grid.appendChild(passBtn);
      }
      actionArea.appendChild(grid);
    });
  }

  /**
   * 【狼人杀AI核心 V3 - 终极修复版】
   * @param {string} playerId - 触发行动的AI玩家ID
   * @param {string} action - AI需要执行的动作，例如 'speak', 'vote'
   * @param {object} context - 附加信息，例如女巫的救人目标
   * @returns {Promise<any>} - AI的决策结果
   */
  async function triggerWerewolfAiAction(playerId, action, context = {}) {
    const player = werewolfGameState.players.find(p => p.id === playerId);
    if (!player || !player.isAlive) return null;

    const { proxyUrl, apiKey, model } = state.apiConfig;

    let actionPrompt = '';
    let jsonFormat = '';

    // 1. 构建一个清晰的、包含所有存活玩家及其ID的列表
    const alivePlayersList = werewolfGameState.players
      .filter(p => p.isAlive)
      .map(p => `- ${p.name} (id: ${p.id})`)
      .join('\n');

    // 2. 构建完整的游戏日志，这是AI的“记忆核心”
    const fullGameLog = werewolfGameState.gameLog
      .map(log => {
        if (log.type === 'speech') {
          return `${log.message.player.name}: ${log.message.speech}`;
        }
        return log.message.replace(/<strong>/g, '').replace(/<\/strong>/g, ''); // 移除HTML标签
      })
      .join('\n');

    let extraContext = '';
    // 如果是预言家发言，提供专属情报
    if (player.role === 'seer' && action === 'speak' && werewolfGameState.seerLastNightResult) {
      const result = werewolfGameState.seerLastNightResult;
      extraContext = `\n# Seer Exclusive Information (Visible only to you)\n- **Important Information**: Last night you checked **${
        result.targetName
      }**. Their identity is 【${
        result.isWolf ? 'Werewolf' : 'Villager'
      }】.\n- **Your Task**: You can choose to reveal this information in your speech (you can tell the truth or lie to mislead the werewolves), or keep it hidden for now. Please make the most advantageous decision based on your persona and the current situation.\n`;
      werewolfGameState.seerLastNightResult = null;
    }

    // 3. 根据不同的行动类型，生成具体的任务描述和输出格式要求
    switch (action) {
      case 'guard_protect':
        actionPrompt = 'You are the **Guard**. Please choose a player to protect. You cannot protect the same person on two consecutive nights.';
        jsonFormat = '{"action": "vote", "targetId": "The ID of the player you choose to protect"}';
        if (werewolfGameState.guardLastNightProtected)
          extraContext = `\n- Hint: Last night you protected ${
            werewolfGameState.players.find(p => p.id === werewolfGameState.guardLastNightProtected).name
          }.`;
        break;
      case 'wolf_kill':
        const wolfTeammates = werewolfGameState.players
          .filter(p => p.role === 'wolf' && p.id !== player.id)
          .map(w => w.name)
          .join('、');
        if (context.isUserWolfAlly) {
          actionPrompt = `You are a **Werewolf**. Your teammates are **【${wolfTeammates}】** and **【the user】**. Please give your user teammate a suggestion on who to kill.`;
        } else {
          actionPrompt = `You are a **Werewolf**. Your teammates are **【${wolfTeammates || 'None'}】**. Please choose a non-werewolf player to attack.`;
        }
        extraContext += `\n# Werewolf Tactical Instructions (Crucial)\n- **Teamwork**: Your primary goal is to focus on the same target as your werewolf teammates to ensure a successful kill.\n- **Attack Priority**: Please prioritize attacking players you believe to be **Seer**, **Witch**, or other special roles, or players who are logical and pose a significant threat to the werewolf faction.`;
        jsonFormat = '{"action": "vote", "targetId": "The ID of the player you choose to attack"}';
        break;
      case 'seer_check':
        actionPrompt = 'You are the **Seer**. Please choose a player to check their identity (Villager or Werewolf).';
        jsonFormat = '{"action": "vote", "targetId": "The ID of the player you choose to check"}';
        break;
      case 'witch_action':
        actionPrompt = 'You are the **Witch**.';
        if (context.killedId) {
          actionPrompt += `Tonight ${werewolfGameState.players.find(p => p.id === context.killedId).name} was attacked.`;
        } else {
          actionPrompt += 'Tonight is a peaceful night.';
        }
        actionPrompt += ` You have ${werewolfGameState.witchPotions.save} potion(s) to save and ${werewolfGameState.witchPotions.poison} potion(s) to poison. Please decide your action.`;
        jsonFormat = '{"action": "save" | "poison" | "none", "targetId": "(If using poison, provide the target ID)"}';
        break;
      case 'hunter_shoot':
        actionPrompt = 'You are the **Hunter**. You have been eliminated. Please choose a player to take down with you.';
        jsonFormat = '{"action": "vote", "targetId": "The ID of the player you choose to take down"}';
        break;
      case 'speak':
        actionPrompt =
          'It is now your turn to speak. Based on your role, character persona, and the current game situation, share your thoughts. You may lie or try to guide the discussion. Your statement should focus on the game itself rather than chatting only with the user.';
        jsonFormat = '{"action": "speak", "speech": "Your speech content..."}';
        break;
      case 'vote':
        actionPrompt = 'It is now the daytime voting phase. Based on everyone\'s statements and your own judgment, vote for the player you believe is a werewolf.';
        jsonFormat = '{"action": "vote", "targetId": "The ID of the player you vote for"}';
        break;
    }

    // 4. 构建最终发送给AI的、结构清晰的完整Prompt
    const systemPrompt = `
**【LANGUAGE RULE - HIGHEST PRIORITY】: You MUST reply in Vietnamese (Tiếng Việt) for ALL messages. Never use Chinese or any other language.**

# Game Background: Werewolf
# Your Identity and Persona
- **Your Name**: ${player.name}
- **Your Role**: ${player.role}
- **Your Character Persona**: ${player.persona}

# Current Situation
- **Alive Players List**:
${alivePlayersList}
- **Game Log (This is the complete game record, you must read and remember all information)**:
${fullGameLog}
${extraContext}

# Your Task: ${actionPrompt}

# Output Format: Your reply **must and only** be a strict JSON object, formatted as follows:
${jsonFormat}
`;
    // 5. 发送请求并处理返回结果 (这部分保持不变)
    try {
      const messagesForApi = [{ role: 'user', content: systemPrompt }];
      let isGemini = proxyUrl === GEMINI_API_URL;
      let geminiConfig = toGeminiRequestData(
        model,
        apiKey,
        systemPrompt,
        messagesForApi,
        isGemini,
        state.apiConfig.temperature,
      );

      const response = await fetch(
        isGemini ? geminiConfig.url : `${proxyUrl}/v1/chat/completions`,
        isGemini
          ? geminiConfig.data
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
              body: JSON.stringify({
                model: model,
                messages: messagesForApi,
                temperature: parseFloat(state.apiConfig.temperature) || 0.8,
                response_format: { type: 'json_object' },
              }),
            },
      );
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      const content = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).replace(
        /^```json\s*|```$/g,
        '',
      );
      const aiAction = JSON.parse(content);

      if (action === 'witch_action') return aiAction;
      if (aiAction.action === 'vote') return aiAction.targetId;
      if (aiAction.action === 'speak') return aiAction.speech;

      return null;
    } catch (error) {
      console.error(`AI (${player.name}) action failed:`, error);
      // 如果AI出错，提供一个保底的行动，防止游戏卡死
      if (
        action.includes('vote') ||
        action.includes('kill') ||
        action.includes('protect') ||
        action.includes('check') ||
        action.includes('shoot')
      ) {
        const potentialTargets = werewolfGameState.players.filter(p => p.isAlive && p.id !== player.id);
        if (potentialTargets.length > 0)
          return potentialTargets[Math.floor(Math.random() * potentialTargets.length)].id;
      }
      if (action === 'witch_action') return { action: 'none' };
      return 'I have no action tonight.';
    }
  }

  /**
   * A simple sleep function to create pauses in the game flow
   */
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ▲▲▲ 狼人杀功能函数结束 ▲▲▲

  // ▼▼▼ 【全新】这里是海龟汤游戏的所有核心功能函数 ▼▼▼

  /**
   * 【海龟汤】总入口：打开游戏设置界面
   */
  async function openSeaTurtleSoupSetup() {
    // 1. 重置游戏状态
    seaTurtleSoupState = {
      isActive: false,
      phase: 'setup',
      players: [],
      riddleProvider: null,
      riddle: '',
      answer: '',
      gameLog: [],
      currentTurnIndex: 0,
    };

    // 2. Render player selection list
    const selectionEl = document.getElementById('sts-player-selection');
    selectionEl.innerHTML = '<p>Loading character list...</p>';

    const singleChats = Object.values(state.chats).filter(chat => !chat.isGroup);
    const allNpcs = Object.values(state.chats).flatMap(chat =>
      (chat.npcLibrary || []).map(npc => ({ ...npc, owner: chat.name })),
    );

    let playerOptions = [
      ...singleChats.map(c => ({ id: c.id, name: c.name, avatar: c.settings.aiAvatar, type: 'Character' })),
      ...allNpcs.map(n => ({ id: n.id, name: n.name, avatar: n.avatar, type: `NPC (${n.owner})` })),
    ];

    selectionEl.innerHTML = '';
    playerOptions.forEach(player => {
      const item = document.createElement('div');
      item.className = 'player-selection-item'; // Reuse Werewolf style
      item.innerHTML = `
            <input type="checkbox" class="sts-player-checkbox" value="${player.id}">
            <img src="${player.avatar || defaultAvatar}" alt="${player.name}">
            <span class="name">${player.name}</span>
            <span class="type-tag">${player.type}</span>
        `;
      selectionEl.appendChild(item);
    });

    // 3. 重置并显示设置弹窗
    document.getElementById('sts-riddle-provider-select').value = 'random';
    document.getElementById('sts-user-riddle-input-area').style.display = 'none';
    document.getElementById('sts-ai-riddle-input-area').style.display = 'none';
    document.getElementById('sea-turtle-soup-setup-modal').classList.add('visible');
  }

  /**
   * 【海龟汤】开始游戏的核心逻辑
   */
  async function startSeaTurtleSoupGame() {
    const selectedCheckboxes = document.querySelectorAll('.sts-player-checkbox:checked');
    if (selectedCheckboxes.length < 1) {
      alert('Please invite at least one AI or NPC player!');
      return;
    }

    await showCustomAlert('Please wait...', 'Preparing the Sea Turtle Soup game...');

    // 1. Collect player information
    let players = [
      {
        id: 'user',
        name: state.qzoneSettings.nickname || 'Me',
        avatar: state.qzoneSettings.avatar || defaultAvatar,
        isUser: true,
        persona: 'A curious ordinary person',
      },
    ];
    selectedCheckboxes.forEach(checkbox => {
      const playerId = checkbox.value;
      const chat = Object.values(state.chats).find(c => c.id === playerId);
      if (chat) {
        // 是主要角色
        players.push({
          id: chat.id,
          name: chat.name,
          avatar: chat.settings.aiAvatar,
          persona: chat.settings.aiPersona,
          isUser: false,
        });
      } else {
        // 是NPC
        for (const c of Object.values(state.chats)) {
          const npc = (c.npcLibrary || []).find(n => n.id === playerId);
          if (npc) {
            players.push({ id: npc.id, name: npc.name, avatar: npc.avatar, persona: npc.persona, isUser: false });
            break;
          }
        }
      }
    });
    players.sort(() => Math.random() - 0.5); // 打乱座位顺序
    seaTurtleSoupState.players = players;

    // 2. 决定出题人
    const providerChoice = document.getElementById('sts-riddle-provider-select').value;
    let providerIndex = -1;

    if (providerChoice === 'user') {
      providerIndex = players.findIndex(p => p.isUser);
    } else if (providerChoice === 'random_ai') {
      const aiIndices = players.map((p, i) => (!p.isUser ? i : -1)).filter(i => i !== -1);
      providerIndex = aiIndices[Math.floor(Math.random() * aiIndices.length)];
    } else {
      // random
      providerIndex = Math.floor(Math.random() * players.length);
    }

    seaTurtleSoupState.players[providerIndex].isProvider = true;
    seaTurtleSoupState.riddleProvider = seaTurtleSoupState.players[providerIndex];

    // 3. 获取谜面和谜底
    if (seaTurtleSoupState.riddleProvider.isUser) {
      const riddle = document.getElementById('sts-user-riddle-surface').value.trim();
      const answer = document.getElementById('sts-user-riddle-answer').value.trim();
      if (!riddle || !answer) {
        alert('As the riddle provider, both the riddle and the answer cannot be empty!');
        return;
      }
      seaTurtleSoupState.riddle = riddle;
      seaTurtleSoupState.answer = answer;
    } else {
      const riddleType = document.getElementById('sts-ai-riddle-type').value.trim();
      const { riddle, answer } = await generateSeaTurtleRiddle(seaTurtleSoupState.riddleProvider, riddleType);
      if (!riddle || !answer) {
        alert('AI failed to generate a riddle. Please check the API or try again later.');
        return;
      }
      seaTurtleSoupState.riddle = riddle;
      seaTurtleSoupState.answer = answer;
    }

    // 4. Initialize game
    seaTurtleSoupState.isActive = true;
    seaTurtleSoupState.phase = 'guessing';
    logToStsGame(
      `Game started! The riddle provider is ${seaTurtleSoupState.riddleProvider.name}.`,
      'system',
      seaTurtleSoupState.riddleProvider,
    );
    logToStsGame(`【Riddle】\n${seaTurtleSoupState.riddle}`);

    document.getElementById('sea-turtle-soup-setup-modal').classList.remove('visible');
    showScreen('sea-turtle-soup-screen');
    renderSeaTurtleGameScreen({ activePlayerId: 'user' });

    // Game starts, enter the first turn
    await processStsTurn();
  }

  /**
   * 【Sea Turtle Soup-AI Core | Optimized】Let AI generate a riddle based on the specified type, prioritizing classic riddles
   */
  async function generateSeaTurtleRiddle(provider, riddleType) {
    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) return { riddle: null, answer: null };

    // Core modification: optimized the prompt, added instruction to "prioritize classic riddles"
    const typePrompt = riddleType ? `Please create a 【${riddleType}】 type` : 'Please create a';

    const systemPrompt = `
**【LANGUAGE RULE - HIGHEST PRIORITY】: You MUST reply in Vietnamese (Tiếng Việt) for ALL messages. Never use Chinese or any other language.**

# Task
You are now the character "${provider.name}", your persona is "${provider.persona}".
Your task is to play this character and ${typePrompt} classic Sea Turtle Soup riddles.

# Core Rules
1.  **Prioritize Classics**: You **must prioritize** selecting a riddle from known, classic, and widely recognized "Sea Turtle Soup" stories. This ensures the logic and playability of the riddle.
2.  **Appropriate Originality**: Only when you cannot think of a suitable classic riddle are you allowed to create an original one. Original riddles must also be logically sound and reasonable.
3.  **Strict Format**: Your response **must and can only** be a strict JSON object containing the fields "riddle" (the riddle) and "answer" (the answer).
4.  **No Breaking Character**: Do not say anything unrelated to the riddle.

# JSON Output Format Example:
{
  "riddle": "A man walks into a bar and asks the bartender for a glass of water. The bartender pulls out a gun and points it at him. The man says 'Thank you' and leaves. Why?",
  "answer": "The man had the hiccups. He wanted to stop them by drinking water, but the bartender used a more effective method—scaring him—which cured his hiccups. So the man thanked him and left."
}
`;
    try {
      const messagesForApi = [{ role: 'user', content: systemPrompt }];
      let isGemini = proxyUrl === GEMINI_API_URL;
      let geminiConfig = toGeminiRequestData(
        model,
        apiKey,
        systemPrompt,
        messagesForApi,
        isGemini,
        state.apiConfig.temperature,
      );

      const response = isGemini
        ? await fetch(geminiConfig.url, geminiConfig.data)
        : await fetch(`${proxyUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              temperature: parseFloat(state.apiConfig.temperature) || 0.8,
              response_format: { type: 'json_object' },
            }),
          });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      const content = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).replace(
        /^```json\s*|```$/g,
        '',
      );
      return JSON.parse(content);
    } catch (error) {
      console.error('AI failed to generate a riddle:', error);
      return { riddle: null, answer: null };
    }
  }

  /**
   * 【Sea Turtle Soup】Render the game main screen (highlighting the current turn player)
   */
  function renderSeaTurtleGameScreen(options = {}) {
    const playersGrid = document.getElementById('sts-players-grid');
    const logContainer = document.getElementById('sts-game-log');

    // Render player seats
    playersGrid.innerHTML = '';
    seaTurtleSoupState.players.forEach(player => {
      const seat = document.createElement('div');
      seat.className = 'player-seat';
      const roleIndicator = player.isProvider
        ? '<div class="player-role-indicator riddle-master" title="Riddle Master">👑</div>'
        : '';
      const avatarClass = `player-avatar ${options.activePlayerId === player.id ? 'active-turn' : ''}`;

      seat.innerHTML = `
            ${roleIndicator}
            <img src="${player.avatar}" class="${avatarClass}">
            <span class="player-name">${player.name}</span>
        `;
      playersGrid.appendChild(seat);
    });

    // Render game log
    logContainer.innerHTML = '';
    seaTurtleSoupState.gameLog.forEach(log => {
      const logEl = document.createElement('div');
      logEl.className = `sts-log-entry ${log.type}`;

      let avatarUrl = 'https://i.postimg.cc/PxZrFFFL/o-o-1.jpg';
      if (log.speakerObj && log.speakerObj.avatar) {
        avatarUrl = log.speakerObj.avatar;
      }

      switch (log.type) {
        case 'system':
          logEl.innerHTML = log.message.replace(/\n/g, '<br>');
          break;
        case 'question':
        case 'guess':
          logEl.innerHTML = `
                    <img src="${avatarUrl}" class="sts-log-avatar">
                    <div class="sts-log-content">
                        <div class="speaker">${log.speaker}</div>
                        <div>${log.message}</div>
                    </div>
                `;
          break;
        case 'answer':
          const answerClass = { Yes: 'yes', No: 'no', Irrelevant: 'irrelevant' }[log.message] || 'irrelevant';
          logEl.innerHTML = `
                    <div class="sts-log-content">
                         <span class="answer-text ${answerClass}">${log.message}</span>
                    </div>
                    <img src="${avatarUrl}" class="sts-log-avatar">
                `;
          break;
      }
      logContainer.appendChild(logEl);
    });

    logContainer.scrollTop = logContainer.scrollHeight;
  }

  /**
   * 【海龟汤】添加一条游戏日志
   */
  function logToStsGame(message, type = 'system', speakerObj = { name: 'System' }) {
    seaTurtleSoupState.gameLog.push({ message, type, speaker: speakerObj.name, speakerObj }); // 保存整个对象
    renderSeaTurtleGameScreen();
  }

  // ▼▼▼ 用这块【已添加重roll按钮】的代码，完整替换旧的 handleStsUserQuestion 函数 ▼▼▼
  /**
   * 【海龟汤】处理用户提问
   */
  async function handleStsUserQuestion() {
    if (seaTurtleSoupState.phase !== 'guessing') return;
    const input = document.getElementById('sts-question-input');
    const question = input.value.trim();
    if (!question) return;

    const userPlayer = seaTurtleSoupState.players.find(p => p.isUser);
    logToStsGame(question, 'question', userPlayer);
    input.value = '';

    // ★ 核心修改：在用户提问后，先移除可能存在的重roll按钮
    const oldRerollBtn = document.getElementById('sts-reroll-ai-turn-btn');
    if (oldRerollBtn) oldRerollBtn.remove();

    // 将控制权交给游戏主循环，并告知是用户在提问
    await processStsTurn(question, userPlayer);
  }
  // ▲▲▲ 替换结束 ▲▲▲

  // ▼▼▼ 把这一整块全新的函数，粘贴到 handleStsUserQuestion 函数的后面 ▼▼▼

  /**
   * 【海龟汤】处理用户猜测答案
   */
  async function handleStsUserGuess() {
    if (seaTurtleSoupState.phase !== 'guessing') return;
    const input = document.getElementById('sts-question-input');
    const guess = input.value.trim();
    if (!guess) {
      alert('The guess cannot be empty!');
      return;
    }

    const userPlayer = seaTurtleSoupState.players.find(p => p.isUser);
    logToStsGame(guess, 'guess', userPlayer);
    input.value = '';

    const provider = seaTurtleSoupState.riddleProvider;
    let isCorrect = false;

    if (provider.isUser) {
      isCorrect = await showCustomConfirm(
        'Judge Guess',
        `Player ${userPlayer.name} guessed the answer:\n\n"${guess}"\n\nIs this guess correct?`,
      );
    } else {
      const aiEvaluation = await triggerStsAiTurn(provider, 'evaluate_guess', guess);
      isCorrect = aiEvaluation.isCorrect;
    }

    if (isCorrect) {
      logToStsGame(`${userPlayer.name} guessed correctly! Game over!`, 'system', userPlayer);
      await revealStsAnswer();
    } else {
      logToStsGame('Incorrect.', 'answer', provider);
      await processStsTurn();
    }
  }
  // ▼▼▼ 【全新】这是海龟汤的重roll功能核心函数 ▼▼▼
  /**
   * 【海龟汤】处理重roll整个AI回合的请求
   */
  async function handleStsReroll() {
    // 1. 找到最后一次用户的发言（提问或猜测）
    const lastUserActionIndex = findLastIndex(seaTurtleSoupState.gameLog, log => log.speakerObj.isUser);

    if (lastUserActionIndex === -1) {
      alert('No user actions found, cannot reroll.');
      return;
    }

    // 2. 移除那之后的所有日志（也就是所有AI的行动记录）
    const removedLogs = seaTurtleSoupState.gameLog.splice(lastUserActionIndex + 1);

    if (removedLogs.length === 0) {
      alert('AI has not acted yet, no need to reroll.');
      return;
    }

    console.log(`Sea Turtle Soup: Removed ${removedLogs.length} AI action logs, preparing to reroll.`);

    // 3. Re-render the UI, the interface will immediately roll back
    renderSeaTurtleGameScreen();

    // 4. Give the user a prompt
    await showCustomAlert('Please wait...', 'AI is reorganizing its language...');

    // 5. Re-invoke the game loop, it will automatically execute the AI's turn
    await processStsTurn();
  }

  /**
   * Helper function: Find the last index of an element in an array that satisfies the predicate
   */
  function findLastIndex(array, predicate) {
    for (let i = array.length - 1; i >= 0; i--) {
      if (predicate(array[i], i, array)) {
        return i;
      }
    }
    return -1;
  }
  // ▲▲▲ New function ends ▲▲▲

  /**
   * 【海龟汤】游戏主循环/引擎
   */
  async function processStsTurn(userQuestion = null, userObj = null) {
    if (!seaTurtleSoupState.isActive || seaTurtleSoupState.phase !== 'guessing') return;

    // 1. 如果有用户提问，出题人先回答
    if (userQuestion && userObj) {
      const provider = seaTurtleSoupState.riddleProvider;
      let providerAnswerResponse;
      if (provider.isUser) {
        const choice = await showChoiceModal(`Answer ${userObj.name}'s question: "${userQuestion}"`, [
          { text: 'Yes', value: 'yes' },
          { text: 'No', value: 'no' },
          { text: 'Irrelevant', value: 'irrelevant' },
        ]);
        providerAnswerResponse = { judgement: choice || 'irrelevant', remark: '' };
      } else {
        providerAnswerResponse = await triggerStsAiTurn(provider, 'answer', {
          question: userQuestion,
          askerName: userObj.name,
        });
      }

      logToStsGame(providerAnswerResponse.judgement, 'answer', provider);
      if (providerAnswerResponse.remark) {
        await sleep(500);
        logToStsGame(providerAnswerResponse.remark, 'question', provider);
      }
    }

    // 2. 轮到AI玩家行动 (提问或猜测)
    const guessers = seaTurtleSoupState.players.filter(p => !p.isProvider);
    if (guessers.length === 0) return;

    for (const guesser of guessers) {
      if (guesser.isUser) continue;

      await sleep(2000 + Math.random() * 2000);

      renderSeaTurtleGameScreen({ activePlayerId: guesser.id });
      const aiAction = await triggerStsAiTurn(guesser, 'guess');

      if (aiAction.type === 'question') {
        logToStsGame(aiAction.content, 'question', guesser);
        await sleep(6000);

        const provider = seaTurtleSoupState.riddleProvider;
        let providerAnswerResponse;
        if (provider.isUser) {
          const choice = await showChoiceModal(`Answer ${guesser.name}'s question: "${aiAction.content}"`, [
            { text: 'Yes', value: 'yes' },
            { text: 'No', value: 'no' },
            { text: 'Irrelevant', value: 'irrelevant' },
          ]);
          providerAnswerResponse = { judgement: choice || 'irrelevant', remark: '' };
        } else {
          providerAnswerResponse = await triggerStsAiTurn(provider, 'answer', {
            question: aiAction.content,
            askerName: guesser.name,
          });
        }

        logToStsGame(providerAnswerResponse.judgement, 'answer', provider);
        if (providerAnswerResponse.remark) {
          await sleep(500);
          logToStsGame(providerAnswerResponse.remark, 'question', provider);
        }
      } else if (aiAction.type === 'guess') {
        logToStsGame(aiAction.content, 'guess', guesser);

        let isCorrect = false;
        if (seaTurtleSoupState.riddleProvider.isUser) {
          isCorrect = await showCustomConfirm(
            'Judge Guess',
            `Player ${guesser.name} guessed the answer:\n\n"${aiAction.content}"\n\nIs this guess correct?`,
          );
        } else {
          const aiEvaluation = await triggerStsAiTurn(
            seaTurtleSoupState.riddleProvider,
            'evaluate_guess',
            aiAction.content,
          );
          isCorrect = aiEvaluation.isCorrect;
        }

        if (isCorrect) {
          logToStsGame(`${guesser.name} guessed correctly! Game over!`, 'system', guesser);
          await revealStsAnswer();
          return;
        } else {
          logToStsGame('Incorrect.', 'answer', seaTurtleSoupState.riddleProvider);
        }
      }
    }

    renderSeaTurtleGameScreen({ activePlayerId: 'user' });
    // ▼▼▼ 在这里粘贴下面的新代码 ▼▼▼
    // ★ 核心修改：AI回合结束后，在操作区添加重roll按钮
    const actionArea = document.getElementById('sts-action-area');
    const mainRow = actionArea.querySelector('.chat-input-main-row');
    if (mainRow) {
      // 先检查是否已经存在，避免重复添加
      if (!document.getElementById('sts-reroll-ai-turn-btn')) {
        const rerollBtn = document.createElement('button');
        rerollBtn.id = 'sts-reroll-ai-turn-btn';
        rerollBtn.className = 'action-button';
        rerollBtn.title = 'Let AI re-ask or re-guess';
        rerollBtn.style.backgroundColor = '#ff9800'; // Give it a prominent orange color
        rerollBtn.style.width = '40px';
        rerollBtn.style.height = '40px';
        rerollBtn.innerHTML = `<svg class="reroll-btn-icon" viewBox="0 0 24 24" style="stroke:white;"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>`;

        // 将按钮插入到“提问”按钮的前面
        mainRow.insertBefore(rerollBtn, document.getElementById('send-sts-question-btn'));
      }
    }
    // ▲▲▲ 新增代码结束 ▲▲▲
  }

  /**
   * 【海龟汤-AI核心 V2】触发AI行动（回答、提问、判断或猜测）
   */
  async function triggerStsAiTurn(player, actionType, contextPayload = {}) {
    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) return { type: 'question', content: "I don't know what to ask." };

    let systemPrompt = '';
    const gameLogText = seaTurtleSoupState.gameLog
      .map(log => `${log.speaker}: ${log.message}`)
      .slice(-15)
      .join('\n');

    if (actionType === 'answer') {
      // 人设加强版 V3 Prompt
      systemPrompt = `
**【LANGUAGE RULE - HIGHEST PRIORITY】: You MUST reply in Vietnamese (Tiếng Việt) for ALL messages. Never use Chinese or any other language.**

# Task: Turtle Soup Riddle Host (Advanced Persona Version)
You are now the character "${player.name}", and your persona is "${player.persona}".
You are the host of the Turtle Soup game, and the answer to your riddle is "${seaTurtleSoupState.answer}".
Now, the player "${contextPayload.askerName}" has asked you a question: "${contextPayload.question}".

Your task is to first provide a judgement, and then give a remark that fully aligns with your persona.

# Your Code of Conduct (Must Strictly Follow)

## 1. About Judgement
Your "judgement" field must be one of the following four options: \`Yes\`, \`No\`, \`Irrelevant\`, \`Partially\`.

## 2. About Remark
-   **【【【Persona Iron Law】】】**: Every remark you make must be something that the character "${player.name}" would say. Consider how a person with the persona "${player.persona}" would respond to this question. Would they tease, encourage, act profound, or be impatient?
-   **Align with Judgement**: When the judgement is "Partially", your remark should cleverly point out the part they got right.
-   **Provide Hints (Only When the Player is Stuck)**:
    -   **Judgement Bottleneck**: If you observe that most of the last 5-8 questions are "Irrelevant", it indicates that the player might be stuck in a mental rut.
    -   **Action**: In such cases, your remark must include a directional hint, delivered naturally in your persona's voice.

# Format Iron Law
1.  Your reply **must and can only** be a strict JSON object containing the fields "judgement" and "remark".
2.  **Absolutely prohibited** from using Emoji or out-of-character words in any of your replies.

# JSON Output Format Example:
{
  "judgement": "",
  "remark": ""
}
Now, please directly output your JSON judgement.`;
    } else if (actionType === 'evaluate_guess') {
      systemPrompt = `
**【LANGUAGE RULE - HIGHEST PRIORITY】: You MUST reply in Vietnamese (Tiếng Việt) for ALL messages. Never use Chinese or any other language.**

# Task: Turtle Soup Riddle Host - Evaluate Guess
You are now the character "${player.name}", and your persona is "${player.persona}".
You are the host of the Turtle Soup game, and the answer to your riddle is "${seaTurtleSoupState.answer}".
Now, a player has directly guessed the answer: "${contextPayload}".
Your task is to determine whether this guess aligns with the core meaning of your answer, with a 70% accuracy threshold.

# Core Rules
1.  **Format Iron Law**: Your reply **must and can only** be a strict JSON object, formatted as: \`{"isCorrect": true}\` or \`{"isCorrect": false}\`.
2.  **Judgement Criteria**: The core plot, character relationships, key props, and final outcome of the guess must align with the answer. Exact word-for-word matching is not required.

Now, please directly output your judgement.`;
    } else {
      // 'guess'
      systemPrompt = `
**【LANGUAGE RULE - HIGHEST PRIORITY】: You MUST reply in Vietnamese (Tiếng Việt) for ALL messages. Never use Chinese or any other language.**

# Task: Turtle Soup Guess Player
You are now the character "${player.name}", and your persona is "${player.persona}".
You are playing the Turtle Soup game and need to ask questions or guess the answer based on the known information.

# Game Information
- Riddle: ${seaTurtleSoupState.riddle}
- Known Clues (Complete Dialogue History):
${gameLogText}

# Core Rules
1.  **【【【Logical Reasoning Iron Law】】】**: You **must** carefully analyze the "Known Clues" above, avoiding repeated or contradictory questions. Your questions or guesses should be based on the existing information, demonstrating logical reasoning.
2.  **【【【Persona Role-Playing Iron Law】】】**: Your questions and guesses **must** align with your persona and tone, just like a real player. You can appropriately include your thought process or emotional expressions to make the dialogue more vivid. For example, you might say: "Let me think... Since it's not related to the location, could it be related to time?", and try to be as verbose as possible.
3.  **Decision Making**: Based on the clues, decide whether to ask a key "yes/no" question to narrow down the possibilities or directly guess the answer. When the clues are sufficient, boldly use the "guess" command to guess the complete story.
4.  **【【【Acceleration Rule】】】**: If the "Known Clues" dialogue history exceeds 30 entries, it indicates that the game has been going on for too long. In this case, you **should be more inclined to directly guess the answer** rather than continue asking detailed questions.
5.  **Format Iron Law**: Your reply **must and can only** be a strict JSON object.
   - If asking a question, format: \`{"type": "question", "content": "Your question..."}\`
   - If guessing, format: \`{"type": "guess", "content": "Your complete story guess..."}\`
6.  **禁止Emoji**: 【绝对禁止】在你的任何回复中使用Emoji表情符号。

Now, based on your character persona and judgment, generate your action.`;
    }
    const maxRetries = 3; // 最多重试3次
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const messagesForApi = [{ role: 'user', content: 'Please follow the rules in the system instructions and start your action immediately.' }];
        let isGemini = proxyUrl === GEMINI_API_URL;
        let geminiConfig = toGeminiRequestData(
          model,
          apiKey,
          systemPrompt,
          messagesForApi,
          isGemini,
          state.apiConfig.temperature,
        );

        const response = isGemini
          ? await fetch(geminiConfig.url, geminiConfig.data)
          : await fetch(`${proxyUrl}/v1/chat/completions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
              body: JSON.stringify({
                model: model,
                messages: [{ role: 'system', content: systemPrompt }, ...messagesForApi],
                temperature: parseFloat(state.apiConfig.temperature) || 0.8,
                response_format: { type: 'json_object' },
              }),
            });

        // 【重要】如果响应状态码是429，也主动抛出错误，进入catch块进行重试
        if (response.status === 429) {
          const errorData = await response.json();
          // 构造一个和之前日志里一样的错误信息，方便我们解析
          throw new Error(JSON.stringify({ error: errorData.error }));
        }
        if (!response.ok) {
          // 对于其他错误，直接抛出
          throw new Error(`API request failed: ${response.status} - ${await response.text()}`);
        }

        const data = await response.json();
        const content = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).replace(
          /^```json\s*|```$/g,
          '',
        );

        // 如果成功，解析并返回结果，结束函数
        return JSON.parse(content);
      } catch (error) {
        console.error(`Sea Turtle Soup AI action failed (Attempt ${attempt}):`, error.message);

        // 如果是最后一次尝试，就彻底失败，并把错误抛出去
        if (attempt === maxRetries) {
          // 将原始错误重新包装后抛出，以便外部能捕获
          throw new Error(`AI action failed after ${maxRetries} attempts: ${error.message}`);
        }

        let delay = 2000 * attempt; // 默认的指数退避延迟

        // 智能解析API建议的等待时间
        try {
          // 错误信息本身可能是一个JSON字符串，先解析它
          const errorJson = JSON.parse(error.message);
          const errorMessage = errorJson.error.message;

          // 正则表达式匹配 "retry in X.XXXXs"
          const retryMatch = errorMessage.match(/retry in (\d+\.?\d*)s/);
          if (retryMatch && retryMatch[1]) {
            // 找到了建议时间，就用它，并额外加一点点缓冲
            delay = parseFloat(retryMatch[1]) * 1000 + 500;
            console.log(`API request rate limit exceeded, will retry in ${Math.round(delay / 1000)} seconds...`);
          }
        } catch (e) {
          // 如果解析失败，说明错误信息格式不符合预期，就使用默认延迟
          console.log(`API request failed, will retry in ${Math.round(delay / 1000)} seconds (Attempt ${attempt + 1})...`);
        }

        // 等待计算出的延迟时间
        await sleep(delay);
      }
    }
    // ==========================================================
    // --- ▲▲▲ 【核心修改】到这里结束 ▲▲▲ ---
    // ==========================================================

    // 如果循环结束都没成功，返回一个备用结果，防止游戏卡死
    console.error('All retries failed, returning fallback action.');
    if (actionType === 'answer') return { judgement: 'irrelevant', remark: '(AI thought process short-circuited...)' };
    if (actionType === 'evaluate_guess') return { isCorrect: false };
    return { type: 'question', content: 'Is he/she human?' };
  }
  /**
   * 【海龟汤 V2 - 结算增强版】揭晓答案并显示结算界面
   */
  async function revealStsAnswer() {
    if (!seaTurtleSoupState.isActive) return;

    // 1. 标记游戏结束
    seaTurtleSoupState.isActive = false; // 确保游戏状态变为非激活
    seaTurtleSoupState.phase = 'reveal';

    // 2. 隐藏游戏中的操作区域
    document.getElementById('sts-action-area').style.visibility = 'hidden';

    // 3. 准备复盘内容
    const summaryText = generateStsSummary();

    // 4. 显示结算弹窗
    showStsSummaryModal(summaryText);
  }
  // ▼▼▼ 【全新】海龟汤结算与分享功能函数 ▼▼▼

  /**
   * 生成海龟汤的复盘文本
   * @returns {string} 格式化后的复盘Markdown文本
   */
  function generateStsSummary() {
    let summaryText = `**Sea Turtle Soup - Game Summary**\n\n`;
    summaryText += `**Riddle Provider:** ${seaTurtleSoupState.riddleProvider.name}\n\n`;
    summaryText += `**Riddle:**\n${seaTurtleSoupState.riddle}\n\n`;
    summaryText += `**Answer:**\n${seaTurtleSoupState.answer}`;
    return summaryText;
  }

  /**
   * 显示游戏结算卡片模态框
   * @param {string} summaryText - 复盘文本
   */
  function showStsSummaryModal(summaryText) {
    const modal = document.getElementById('sts-summary-modal');
    const contentEl = document.getElementById('sts-summary-content');

    // 使用你已有的Markdown渲染函数，让复盘更好看
    contentEl.innerHTML = renderMarkdown(summaryText);

    // 为按钮绑定事件 (使用克隆节点防止重复绑定)
    const shareBtn = document.getElementById('share-sts-summary-btn');
    const newShareBtn = shareBtn.cloneNode(true);
    shareBtn.parentNode.replaceChild(newShareBtn, shareBtn);
    newShareBtn.onclick = () => openStsShareTargetPicker(summaryText);

    const backBtn = document.getElementById('back-to-hall-from-sts-btn');
    const newBackBtn = backBtn.cloneNode(true);
    backBtn.parentNode.replaceChild(newBackBtn, backBtn);
    newBackBtn.onclick = () => {
      modal.classList.remove('visible');
      showScreen('game-hall-screen');
    };

    modal.classList.add('visible');
  }

  /**
   * 打开复盘分享目标选择器
   * @param {string} summaryText - 要分享的复盘文本
   */
  function openStsShareTargetPicker(summaryText) {
    const modal = document.getElementById('sts-share-target-modal');
    const listEl = document.getElementById('sts-share-target-list');
    listEl.innerHTML = '';

    // 从游戏状态中获取所有非出题人的AI玩家
    const aiPlayers = seaTurtleSoupState.players.filter(p => !p.isUser && !p.isProvider);

    if (aiPlayers.length === 0) {
      alert('No AI players available for sharing.');
      return;
    }

    // Render the list of selectable AI players
    aiPlayers.forEach(player => {
      const item = document.createElement('div');
      item.className = 'player-selection-item'; // 复用样式
      item.innerHTML = `
            <input type="checkbox" class="sts-target-checkbox" value="${player.id}" checked>
            <img src="${player.avatar || defaultAvatar}" alt="${player.name}">
            <span class="name">${player.name}</span>
        `;
      listEl.appendChild(item);
    });

    // 绑定按钮事件
    const confirmBtn = document.getElementById('sts-confirm-share-btn');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.onclick = () => {
      const selectedIds = Array.from(document.querySelectorAll('.sts-target-checkbox:checked')).map(cb => cb.value);
      if (selectedIds.length > 0) {
        sendStsSummaryToSelectedPlayers(summaryText, selectedIds);
      } else {
        alert('Please select at least one target to share!');
      }
    };

    document.getElementById('sts-cancel-share-btn').onclick = () => modal.classList.remove('visible');
    document.getElementById('sts-select-all-btn').onclick = () => {
      document.querySelectorAll('.sts-target-checkbox').forEach(cb => (cb.checked = true));
    };
    document.getElementById('sts-deselect-all-btn').onclick = () => {
      document.querySelectorAll('.sts-target-checkbox').forEach(cb => (cb.checked = false));
    };

    modal.classList.add('visible');
  }

  /**
   * 将游戏复盘发送到【选定】的AI角色的聊天中
   * @param {string} summaryText - 复盘文本
   * @param {string[]} targetIds - 目标AI角色的ID数组
   */
  async function sendStsSummaryToSelectedPlayers(summaryText, targetIds) {
    // 关闭所有可能打开的弹窗
    document.getElementById('sts-summary-modal').classList.remove('visible');
    document.getElementById('sts-share-target-modal').classList.remove('visible');

    let sentCount = 0;
    const aiContext = `[System Instruction: A game of Sea Turtle Soup has just ended. This is the game summary. Please discuss the game based on this summary, using your character persona.]\n\n${summaryText}`;

    for (const chatId of targetIds) {
      const chat = state.chats[chatId];
      if (chat) {
        // 创建对用户可见的复盘卡片消息
        const visibleMessage = {
          role: 'user',
          type: 'share_link',
          timestamp: Date.now(),
          title: 'Sea Turtle Soup - Game Summary',
          description: 'Click to view the detailed game summary',
          source_name: 'Game Center',
          content: summaryText,
        };

        // 创建对AI可见的隐藏指令
        const hiddenInstruction = {
          role: 'system',
          content: aiContext,
          timestamp: Date.now() + 1,
          isHidden: true,
        };

        chat.history.push(visibleMessage, hiddenInstruction);
        await db.chats.put(chat);
        sentCount++;
      }
    }

    await showCustomAlert('Share Successful', `The game summary has been shared with ${sentCount} AI players!`);
    showScreen('game-hall-screen');
  }

  // ▲▲▲ 新增函数结束 ▲▲▲

  /**
   * 【辅助函数】计算两个字符串的简单相似度
   */
  function simpleSimilarity(str1, str2) {
    const set1 = new Set(str1.split(''));
    const set2 = new Set(str2.split(''));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    return intersection.size / Math.max(set1.size, set2.size);
  }

  // ▲▲▲ 海龟汤功能函数结束 ▲▲▲

  // ▼▼▼ 【全新】这里是剧本杀游戏的所有核心功能函数 ▼▼▼

  /**
   * 【剧本杀】打开游戏设置界面
   */
  async function openScriptKillSetup() {
    showScreen('script-kill-setup-screen');

    const scriptSelect = document.getElementById('script-kill-script-select');
    scriptSelect.innerHTML = '<option value="">-- 请选择剧本 --</option>';

    // --- ▼▼▼ 核心修改在这里 ▼▼▼ ---

    // 1. 遍历我们创建的内置剧本库
    BUILT_IN_SCRIPTS.forEach(script => {
      const option = document.createElement('option');
      option.value = script.id; // value 是剧本的唯一ID
      option.textContent = `【内置】${script.name}`; // 显示的文本
      scriptSelect.appendChild(option);
    });

    // 2. 加载并显示自定义剧本
    const customScripts = await db.scriptKillScripts.toArray();
    customScripts.forEach(script => {
      const option = document.createElement('option');
      option.value = script.id;
      option.textContent = `【自定义】${script.name}`;
      scriptSelect.appendChild(option);
    });

    // --- ▲▲▲ 修改结束 ▲▲▲ ---
    // 渲染玩家选择列表
    const selectionEl = document.getElementById('script-kill-player-selection');
    selectionEl.innerHTML = '<p>正在加载角色列表...</p>';

    const singleChats = Object.values(state.chats).filter(chat => !chat.isGroup);
    const allNpcs = Object.values(state.chats).flatMap(chat =>
      (chat.npcLibrary || []).map(npc => ({ ...npc, owner: chat.name })),
    );

    let playerOptions = [
      ...singleChats.map(c => ({ id: c.id, name: c.name, avatar: c.settings.aiAvatar, type: '角色' })),
      ...allNpcs.map(n => ({ id: n.id, name: n.name, avatar: n.avatar, type: `NPC (${n.owner})` })),
    ];

    selectionEl.innerHTML = '';
    playerOptions.forEach(player => {
      const item = document.createElement('div');
      item.className = 'player-selection-item'; // 复用样式
      item.innerHTML = `
            <input type="checkbox" class="script-kill-player-checkbox" value="${player.id}">
            <img src="${player.avatar || defaultAvatar}" alt="${player.name}">
            <span class="name">${player.name}</span>
            <span class="type-tag">${player.type}</span>
        `;
      selectionEl.appendChild(item);
    });
  }
  // ▼▼▼ 在这里开始粘贴 ▼▼▼

  /**
   * 【剧本杀】显示角色选择弹窗，让用户选择角色
   * @param {string} title - 弹窗标题
   * @param {Array<object>} options - 角色选项数组 [{text, value}]
   * @returns {Promise<number|null>} - 返回用户选择的角色的索引，如果取消则返回null
   */
  async function showRoleSelectionModal(title, options) {
    return new Promise(resolve => {
      const modal = document.getElementById('custom-modal-overlay');
      const modalTitle = document.getElementById('custom-modal-title');
      const modalBody = document.getElementById('custom-modal-body');
      const modalConfirmBtn = document.getElementById('custom-modal-confirm');
      const modalCancelBtn = document.getElementById('custom-modal-cancel');

      modalTitle.textContent = title;

      let optionsHtml = '<div style="text-align: left; max-height: 400px; overflow-y: auto;">';
      options.forEach((option, index) => {
        optionsHtml += `
                <label style="display: block; padding: 10px; border-bottom: 1px solid #eee; cursor: pointer;">
                    <input type="radio" name="role_selection" value="${option.value}" ${index === 0 ? 'checked' : ''}>
                    ${option.text}
                </label>
            `;
      });
      optionsHtml += '</div>';

      modalBody.innerHTML = optionsHtml;
      modalConfirmBtn.textContent = '确认选择';
      modalCancelBtn.style.display = 'block';

      modal.classList.add('visible');

      modalConfirmBtn.onclick = () => {
        const selectedRadio = document.querySelector('input[name="role_selection"]:checked');
        if (selectedRadio) {
          modal.classList.remove('visible');
          resolve(parseInt(selectedRadio.value));
        } else {
          alert('请选择一个角色！');
        }
      };

      modalCancelBtn.onclick = () => {
        modal.classList.remove('visible');
        resolve(null);
      };
    });
  }

  /**
   * 【剧本杀】开始游戏的核心逻辑 (V3 - 玩家自选，AI随机版)
   */
  async function startScriptKillGame() {
    const scriptId = document.getElementById('script-kill-script-select').value;
    if (!scriptId) {
      alert('请先选择一个剧本！');
      return;
    }
    // ▼▼▼ 用这块【已修复】的代码替换旧的 if/else 逻辑 ▼▼▼
    let script;
    // 【核心修改】我们不再只检查 'built_in_1'，而是检查 scriptId 是否以 'built_in_' 开头
    if (scriptId.startsWith('built_in_')) {
      // 如果是，就调用 getBuiltInScript 函数，并将正确的ID传进去
      script = getBuiltInScript(scriptId);
    } else {
      // 否则，说明是自定义剧本，才去数据库里查找
      script = await db.scriptKillScripts.get(parseInt(scriptId));
    }
    // ▲▲▲ 替换结束 ▲▲▲
    if (!script) {
      alert('加载剧本失败！');
      return;
    }

    const selectedCheckboxes = document.querySelectorAll('.script-kill-player-checkbox:checked');
    const requiredPlayers = script.roles.length - 1;
    if (selectedCheckboxes.length !== requiredPlayers) {
      alert(`此剧本需要您邀请 ${requiredPlayers} 位AI或NPC玩家！`);
      return;
    }

    await showCustomAlert('请稍候...', '正在分配角色，请耐心等待...');

    // 1. 初始化游戏状态
    scriptKillGameState = {
      isActive: true,
      script: script,
      players: [],
      gamePhase: 'start',
      turnIndex: 0,
      gameLog: [],
      evidenceCounts: {},
      votes: {},
      isFreeChoice: document.getElementById('script-kill-free-choice-toggle').checked,
      discussionRound: 1, // <--- ★★★ 在这里添加这一行 ★★★
      collectedClueIds: new Set(),
    };
    // 2. 收集玩家信息 (这部分不变)
    let invitedPlayers = [];
    selectedCheckboxes.forEach(checkbox => {
      const playerId = checkbox.value;
      const chat = Object.values(state.chats).find(c => c.id === playerId);
      if (chat) {
        invitedPlayers.push({
          id: chat.id,
          name: chat.name,
          avatar: chat.settings.aiAvatar,
          persona: chat.settings.aiPersona,
          isUser: false,
        });
      } else {
        for (const c of Object.values(state.chats)) {
          const npc = (c.npcLibrary || []).find(n => n.id === playerId);
          if (npc) {
            invitedPlayers.push({
              id: npc.id,
              name: npc.name,
              avatar: npc.avatar,
              persona: npc.persona,
              isUser: false,
            });
            break;
          }
        }
      }
    });
    const userPlayer = {
      id: 'user',
      name: state.qzoneSettings.nickname || '我',
      avatar: state.qzoneSettings.avatar || defaultAvatar,
      isUser: true,
      persona: '一个喜欢探案的普通人',
    };

    // --- 3. 【核心改造】根据开关状态，执行不同的分配逻辑 ---
    const assignedRoles = new Map(); // 使用Map存储 {playerId -> roleObject}
    let remainingRoles = [...script.roles]; // 创建一个可修改的角色列表副本

    if (scriptKillGameState.isFreeChoice) {
      // --- 自由选择模式 (玩家自选，AI随机) ---

      // 3a. 用户先从所有角色中选择一个
      const roleOptions = remainingRoles.map((role, index) => ({
        text: `【${role.name}】: ${role.description.substring(0, 40)}...`,
        value: index,
      }));
      const userChoiceIndex = await showRoleSelectionModal('请选择你的角色', roleOptions);
      if (userChoiceIndex === null) {
        hideCustomModal();
        alert('你取消了角色选择，游戏未开始。');
        return;
      }
      // 从角色池中移除用户选择的角色，并分配给用户
      const userChosenRole = remainingRoles.splice(userChoiceIndex, 1)[0];
      assignedRoles.set(userPlayer.id, userChosenRole);

      // 3b. 【【【这就是本次的核心修改！】】】
      // 将剩余的角色【随机打乱】
      remainingRoles.sort(() => Math.random() - 0.5);
      // 然后【按顺序】分配给AI们
      invitedPlayers.forEach((aiPlayer, index) => {
        assignedRoles.set(aiPlayer.id, remainingRoles[index]);
      });
    } else {
      // --- 随机分配模式 (旧逻辑保持不变) ---
      const allGamePlayers = [userPlayer, ...invitedPlayers];
      allGamePlayers.sort(() => Math.random() - 0.5);
      const shuffledRoles = [...script.roles].sort(() => Math.random() - 0.5);
      allGamePlayers.forEach((player, index) => {
        assignedRoles.set(player.id, shuffledRoles[index]);
      });
    }

    // 4. 组合最终的玩家列表 (这部分不变)
    const allPlayersWithRoles = [userPlayer, ...invitedPlayers].map(player => ({
      ...player,
      role: assignedRoles.get(player.id),
      evidence: [],
    }));
    scriptKillGameState.players = allPlayersWithRoles;

    // 5. 显示身份给用户 (这部分不变)
    const myPlayer = scriptKillGameState.players.find(p => p.isUser);
    hideCustomModal();
    await showCustomAlert(
      `你的角色是：【${myPlayer.role.name}】`,
      `**角色介绍:**\n${myPlayer.role.description}\n\n**你的任务:**\n${myPlayer.role.tasks}`,
    );

    // 6. 切换到游戏界面并开始 (这部分不变)
    showScreen('script-kill-game-screen');
    await processScriptKillTurn();
  }

  // ▲▲▲ 替换结束 ▲▲▲

  // ▼▼▼ 【最终流程版】请用这整块代码，完整替换旧的 processScriptKillTurn 函数 ▼▼▼
  /**
   * 【剧本杀 V4 - 最终流程引擎】游戏主循环/引擎
   */
  async function processScriptKillTurn() {
    if (!scriptKillGameState.isActive) return;
    renderScriptKillGameScreen();

    switch (scriptKillGameState.gamePhase) {
      case 'start':
        logToScriptKillGame(`游戏开始！剧本：【${scriptKillGameState.script.name}】`, 'system');
        await sleep(1000);
        logToScriptKillGame(`【故事背景】\n${scriptKillGameState.script.storyBackground}`, 'system');
        await sleep(3000);
        logToScriptKillGame('请各位玩家查看自己的角色信息，准备进行自我介绍。', 'system');
        scriptKillGameState.gamePhase = 'introduction';
        await sleep(2000);
        await processScriptKillTurn();
        break;

      case 'introduction':
        logToScriptKillGame('现在开始轮流进行自我介绍。', 'system');
        for (const player of scriptKillGameState.players) {
          renderScriptKillGameScreen({ speakingPlayerId: player.id });
          let introduction = player.isUser
            ? await waitForUserActionSK('轮到你自我介绍了', 'speak', '简单介绍一下你自己和你所扮演的角色...')
            : await triggerScriptKillAiAction(player.id, 'introduce');
          logToScriptKillGame({ player: player, speech: introduction }, 'speech');
          await sleep(1000);
        }
        renderScriptKillGameScreen();
        logToScriptKillGame('自我介绍结束，现在请各位玩家分享自己的时间线。', 'system');
        scriptKillGameState.gamePhase = 'timeline_discussion';
        await sleep(2000);
        await processScriptKillTurn();
        break;

      case 'timeline_discussion':
        logToScriptKillGame('请各位玩家轮流发言，梳理并公开自己的时间线。', 'system');
        await sleep(1500);
        for (const player of scriptKillGameState.players) {
          renderScriptKillGameScreen({ speakingPlayerId: player.id });
          let timelineSpeech = player.isUser
            ? await waitForUserActionSK('轮到你陈述时间线了', 'speak', '请根据你的剧本，详细说明你的行动轨迹...')
            : await triggerScriptKillAiAction(player.id, 'discuss_timeline');
          logToScriptKillGame({ player: player, speech: timelineSpeech }, 'speech');
          await sleep(1000);
        }
        renderScriptKillGameScreen();
        logToScriptKillGame('时间线陈述结束，现在进入【第一轮搜证环节】。', 'system');
        scriptKillGameState.gamePhase = 'evidence_round_1';
        await processScriptKillTurn();
        break;

      case 'evidence_round_1':
        updateActionAreaSK();
        logToScriptKillGame('进入第一轮搜证，每位玩家有【2次】搜证机会。', 'system');
        await sleep(2000);

        // 【核心修改】AI 进行第一轮的第1次搜证
        for (const player of scriptKillGameState.players) {
          if (player.isUser) continue;
          logToScriptKillGame(`轮到 ${player.role.name} (${player.name}) 进行第1次搜证...`);
          await sleep(2000);
          await handleAiSearch(player);
        }
        // 【核心修改】AI 进行第一轮的第2次搜证
        for (const player of scriptKillGameState.players) {
          if (player.isUser) continue;
          logToScriptKillGame(`轮到 ${player.role.name} (${player.name}) 进行第2次搜证...`);
          await sleep(2000);
          await handleAiSearch(player);
        }
        logToScriptKillGame('所有AI搜证完毕，玩家可以继续搜证或结束本环节进入讨论。', 'system');
        break;

      case 'discussion_round_1':
        logToScriptKillGame('第一轮搜证结束，现在进入【第一轮讨论环节】。', 'system');
        updateActionAreaSK();
        break;

      case 'evidence_round_2':
        updateActionAreaSK();
        logToScriptKillGame('第一轮讨论结束，现在进入【第二轮搜证环节】。', 'system');
        logToScriptKillGame('根据刚才的讨论，各位玩家现在还有【1次】搜证机会。', 'system');
        await sleep(2000);

        // 【核心修改】AI 进行第二轮的唯一次搜证
        for (const player of scriptKillGameState.players) {
          if (player.isUser) continue;
          const searchCount = scriptKillGameState.evidenceCounts[player.id] || 0;
          if (searchCount < 3) {
            // 确保AI也有次数限制
            logToScriptKillGame(`轮到 ${player.role.name} (${player.name}) 进行补充搜证...`);
            await sleep(2000);
            await handleAiSearch(player);
          }
        }
        logToScriptKillGame('所有AI补充搜证完毕，玩家可以继续搜证或结束本环节进入最终讨论。', 'system');
        break;

      // 【全新阶段】第二轮讨论
      case 'discussion_round_2':
        logToScriptKillGame('第二轮搜证结束，现在进入【第二轮讨论环节】。', 'system');
        updateActionAreaSK(); // 显示发言按钮
        break;

      // 【全新阶段】第三轮（最终）讨论
      case 'discussion_round_3':
        logToScriptKillGame('第二轮讨论结束，现在进入【最终讨论环节】。', 'system');
        updateActionAreaSK(); // 再次显示发言按钮
        break;

      case 'voting':
        // 投票和结束逻辑保持不变
        logToScriptKillGame('最终讨论结束，现在进入投票环节。请投票指认凶手！', 'system');
        const detailedVotes = {};
        const alivePlayers = scriptKillGameState.players;
        for (const voter of alivePlayers) {
          let targetId = voter.isUser
            ? await waitForUserActionSK('请投票指认凶手', 'vote')
            : await triggerScriptKillAiAction(voter.id, 'vote');
          detailedVotes[voter.id] = targetId;
          if (targetId) {
            const targetPlayer = scriptKillGameState.players.find(p => p.id === targetId);
            logToScriptKillGame(`${voter.name} 投票给了 ${targetPlayer.name}。`);
          } else {
            logToScriptKillGame(`${voter.name} 弃票了。`);
          }
        }
        scriptKillGameState.votes = detailedVotes;
        scriptKillGameState.gamePhase = 'end';
        await sleep(2000);
        await processScriptKillTurn();
        break;

      case 'end':
        // 结束逻辑保持不变
        logToScriptKillGame('投票结束，正在公布真相...', 'system');
        await sleep(2000);
        const voteCounts = {};
        for (const voterId in scriptKillGameState.votes) {
          const targetId = scriptKillGameState.votes[voterId];
          if (targetId) {
            voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
          }
        }
        let maxVotes = 0,
          votedPlayerIds = [];
        for (const playerId in voteCounts) {
          if (voteCounts[playerId] > maxVotes) {
            maxVotes = voteCounts[playerId];
            votedPlayerIds = [playerId];
          } else if (voteCounts[playerId] === maxVotes) {
            votedPlayerIds.push(playerId);
          }
        }
        const killer = scriptKillGameState.players.find(p => p.role.isKiller);
        let winner = '',
          resultText = '';
        if (votedPlayerIds.length === 1 && votedPlayerIds[0] === killer.id) {
          winner = '好人阵营';
          resultText = `恭喜！你们成功指认出凶手【${killer.role.name} (${killer.name})】！好人阵营胜利！`;
        } else {
          winner = '凶手阵营';
          resultText = `很遗憾，真正的凶手是【${killer.role.name} (${killer.name})】！凶手阵营胜利！`;
        }
        logToScriptKillGame(resultText, 'system');
        await sleep(3000);
        logToScriptKillGame(`【真相】\n${scriptKillGameState.script.truth}`, 'system');
        await showCustomAlert('请稍候...', 'AI正在生成本局复盘摘要...');
        const aiSummary = await generateAiSkSummary();
        const summary = generateSkSummary(winner, aiSummary);
        showScriptKillSummaryModal(summary);
        scriptKillGameState.isActive = false;
        updateActionAreaSK();
        break;
    }
  }
  // ▲▲▲ 替换结束 ▲▲▲
  // ▼▼▼ 【全新】这是剧本杀的重roll功能核心函数 ▼▼▼
  /**
   * 【剧本杀】处理AI发言的重roll请求
   * @param {number} logIndex - 要重roll的发言在gameLog中的索引
   */
  async function handleScriptKillReroll(logIndex) {
    const logEntry = scriptKillGameState.gameLog[logIndex];
    if (!logEntry || logEntry.type !== 'speech' || !logEntry.message.player || logEntry.message.player.isUser) {
      return; // 安全检查，确保操作的是AI的发言
    }

    const playerToReroll = logEntry.message.player;

    // 给用户一个即时反馈
    const speechTextElement = document
      .querySelector(`button.sk-reroll-btn[data-log-index="${logIndex}"]`)
      .closest('.speech-content')
      .querySelector('.speech-text');
    if (speechTextElement) {
      speechTextElement.innerHTML = '<i>正在重新思考...</i>';
    }

    try {
      // 根据游戏阶段智能判断AI应该执行哪个动作
      let actionType;
      const currentPhase = scriptKillGameState.gamePhase;
      if (currentPhase === 'introduction') {
        actionType = 'introduce';
      } else if (currentPhase === 'timeline_discussion') {
        actionType = 'discuss_timeline';
      } else {
        actionType = 'discuss'; // 默认为自由讨论
      }

      // 重新调用AI生成新的发言
      const newSpeech = await triggerScriptKillAiAction(playerToReroll.id, actionType);

      // 用新的发言内容替换掉旧的
      scriptKillGameState.gameLog[logIndex].message.speech = newSpeech;

      // 重新渲染整个游戏界面以显示更新
      renderScriptKillGameScreen();
    } catch (error) {
      console.error('剧本杀发言重roll失败:', error);
      if (speechTextElement) {
        speechTextElement.innerHTML = `<i style="color:red;">重新生成失败，请检查网络或API设置。</i>`;
      }
    }
  }
  // ▲▲▲ 新增函数结束 ▲▲▲

  // ▼▼▼ 【剧本杀】用这块【已添加重roll按钮】的代码，完整替换旧的 renderScriptKillGameScreen 函数 ▼▼▼
  /**
   * 【剧本杀】渲染游戏主界面
   */
  function renderScriptKillGameScreen(options = {}) {
    const playersGrid = document.getElementById('script-kill-players-grid');
    const logContainer = document.getElementById('script-kill-game-log');

    playersGrid.innerHTML = '';
    scriptKillGameState.players.forEach(player => {
      const seat = document.createElement('div');
      seat.className = 'player-seat';
      const avatarClass = `player-avatar ${options.speakingPlayerId === player.id ? 'speaking' : ''}`;

      seat.innerHTML = `
            <img src="${player.avatar}" class="${avatarClass}">
            <span class="player-name">${player.role.name}</span>
        `;
      playersGrid.appendChild(seat);
    });

    logContainer.innerHTML = '';
    scriptKillGameState.gameLog.forEach((log, index) => {
      // ★ 核心修改1：增加了index参数
      const logEl = document.createElement('div');
      // ★ 核心修改2：判断是否是AI的发言
      if (log.type === 'speech' && typeof log.message === 'object' && !log.message.player.isUser) {
        logEl.className = 'log-entry speech';
        const { player, speech } = log.message;

        // ★ 核心修改3：为AI发言添加重roll按钮
        logEl.innerHTML = `
            <img src="${player.avatar}" class="speech-avatar">
            <div class="speech-content">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="speaker">${player.role.name} (${player.name})</span>
                    <button class="sk-reroll-btn" data-log-index="${index}" title="重新生成发言" style="background:none; border:none; cursor:pointer; padding:0; color:var(--text-secondary);">
                        <svg class="reroll-btn-icon" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                    </button>
                </div>
                <span class="speech-text">${speech.replace(/\n/g, '<br>')}</span>
            </div>
        `;
      } else if (log.type === 'speech') {
        // 用户的发言保持原样
        logEl.className = 'log-entry speech';
        const { player, speech } = log.message;
        logEl.innerHTML = `
            <img src="${player.avatar}" class="speech-avatar">
            <div class="speech-content">
                <span class="speaker">${player.role.name} (${player.name})</span>
                <span class="speech-text">${speech.replace(/\n/g, '<br>')}</span>
            </div>
        `;
      } else {
        // 其他系统消息也保持原样
        logEl.className = `log-entry ${log.type}`;
        logEl.innerHTML = String(log.message).replace(/\n/g, '<br>');
      }
      logContainer.appendChild(logEl);
    });
    logContainer.scrollTop = logContainer.scrollHeight;
  }
  // ▲▲▲ 替换结束 ▲▲▲

  /**
   * 【剧本杀】添加一条游戏日志
   */
  function logToScriptKillGame(message, type = 'system') {
    scriptKillGameState.gameLog.push({ message, type });
    renderScriptKillGameScreen();
  }

  /**
   * 【剧本杀 V4 - 新流程版】更新底部操作区域的按钮
   */
  function updateActionAreaSK() {
    const actionArea = document.getElementById('script-kill-action-area');
    actionArea.innerHTML = '';
    const user = scriptKillGameState.players.find(p => p.isUser);

    const phase = scriptKillGameState.gamePhase;
    const searchCount = scriptKillGameState.evidenceCounts[user.id] || 0;

    if (phase === 'evidence_round_1' || phase === 'evidence_round_2') {
      let searchesLeftInRound, totalInRound;
      if (phase === 'evidence_round_1') {
        searchesLeftInRound = 2 - searchCount;
        totalInRound = 2;
      } else {
        // evidence_round_2
        searchesLeftInRound = 3 - searchCount;
        totalInRound = 1;
      }

      const searchBtn = document.createElement('button');
      searchBtn.id = 'sk-search-evidence-btn';
      searchBtn.className = 'form-button';
      searchBtn.textContent = `搜证 (${searchesLeftInRound}/${totalInRound})`;
      searchBtn.disabled = searchesLeftInRound <= 0;
      actionArea.appendChild(searchBtn);

      const endSearchBtn = document.createElement('button');
      endSearchBtn.id = 'sk-end-search-btn';
      endSearchBtn.className = 'form-button-secondary';
      endSearchBtn.textContent = phase === 'evidence_round_1' ? '进入第一轮讨论' : '进入第二轮讨论';
      actionArea.appendChild(endSearchBtn);
    } else if (phase === 'discussion_round_1' || phase === 'discussion_round_2' || phase === 'discussion_round_3') {
      const speakBtn = document.createElement('button');
      speakBtn.id = 'sk-speak-btn';
      speakBtn.className = 'form-button';
      speakBtn.textContent = '我要发言';
      actionArea.appendChild(speakBtn);
    } else if (!scriptKillGameState.isActive && phase === 'end') {
      const backBtn = document.createElement('button');
      backBtn.className = 'form-button';
      backBtn.textContent = '返回游戏大厅';
      backBtn.onclick = () => showScreen('game-hall-screen');
      actionArea.appendChild(backBtn);
    }
  }

  // ▼▼▼ 【剧本杀输入框美化版】请用这个【全新】的函数，完整替换掉你旧的 waitForUserActionSK 函数 ▼▼▼
  /**
   * 【剧本杀 V2 - 输入框美化版】等待用户行动的通用函数
   */
  function waitForUserActionSK(promptText, actionType, placeholder = '') {
    return new Promise(resolve => {
      const actionArea = document.getElementById('script-kill-action-area');
      actionArea.innerHTML = '';
      actionArea.className = 'script-kill-action-area'; // 重置class

      if (actionType === 'speak') {
        // --- 这是我们美化后的发言输入区 ---
        actionArea.classList.add('speaking-mode'); // 激活新CSS

        const textarea = document.createElement('textarea');
        textarea.id = 'user-sk-speech-input'; // 使用剧本杀专用的ID
        textarea.rows = 1;
        textarea.placeholder = placeholder || '请输入你的发言...';
        // 实时调整高度
        textarea.addEventListener('input', () => {
          textarea.style.height = 'auto';
          textarea.style.height = textarea.scrollHeight + 'px';
        });

        const endBtn = document.createElement('button');
        endBtn.id = 'sk-end-speech-btn'; // 使用剧本杀专用的ID
        endBtn.className = 'form-button';
        endBtn.textContent = '结束发言';

        actionArea.appendChild(textarea);
        actionArea.appendChild(endBtn);

        textarea.focus();

        endBtn.onclick = () => {
          const speech = textarea.value.trim() || '我没什么好说的，过。';
          actionArea.innerHTML = '';
          actionArea.classList.remove('speaking-mode');
          resolve(speech);
        };
        return; // 结束 'speak' 分支
      }

      // --- 以下是投票逻辑，保持原样 ---
      else if (actionType === 'vote') {
        const modal = document.getElementById('script-kill-vote-modal');
        const optionsEl = document.getElementById('sk-vote-options-list');
        optionsEl.innerHTML = '';

        scriptKillGameState.players.forEach(player => {
          const label = document.createElement('label');
          label.innerHTML = `<input type="radio" name="sk_vote_target" value="${player.id}"> ${player.role.name} (${player.name})`;
          optionsEl.appendChild(label);
        });

        document.getElementById('confirm-sk-vote-btn').onclick = () => {
          const selected = document.querySelector('input[name="sk_vote_target"]:checked');
          if (selected) {
            modal.classList.remove('visible');
            resolve(selected.value);
          } else {
            alert('请选择一个投票对象！');
          }
        };
        document.getElementById('cancel-sk-vote-btn').onclick = () => {
          modal.classList.remove('visible');
          resolve(null); // 用户取消
        };
        modal.classList.add('visible');
      }
    });
  }
  // ▲▲▲ 替换结束 ▲▲▲
  /**
   * 【全新】处理单个AI的搜证行动 (每次只搜一个线索)
   * @param {object} player - 正在行动的AI玩家对象
   */
  async function handleAiSearch(player) {
    const script = scriptKillGameState.script;

    // 消耗一次搜证机会
    scriptKillGameState.evidenceCounts[player.id] = (scriptKillGameState.evidenceCounts[player.id] || 0) + 1;

    let foundMessage = ''; // 用于记录本轮搜证的结果

    // 1. 增加随机性：有30%的几率什么都搜不到
    if (Math.random() < 0.3) {
      foundMessage = '什么都没发现。';
    } else {
      // 2. 找出所有【全局还未被发现】的线索
      const uncollectedClues = script.clues.filter(c => !scriptKillGameState.collectedClueIds.has(c.description));

      if (uncollectedClues.length > 0) {
        // 3. 随机找到一条新线索
        const foundClue = uncollectedClues[Math.floor(Math.random() * uncollectedClues.length)];
        const clueSource = foundClue.owner === '公共' ? '公共区域' : `角色 ${foundClue.owner} 的私人物品`;

        // 4. 将线索存入AI手牌和全局线索池
        player.evidence.push({ description: foundClue.description, source: clueSource });
        scriptKillGameState.collectedClueIds.add(foundClue.description);

        let revealed = true; // 默认公开

        // 5. 如果线索是关于自己的，让AI决策是否公开
        if (foundClue.owner === player.role.name) {
          const revealDecision = await triggerScriptKillAiAction(player.id, 'reveal_clue', {
            clue: foundClue.description,
          });
          if (revealDecision && revealDecision.action === 'hide') {
            revealed = false;
          }
        }

        // 6. 根据AI的决策，记录不同的搜证结果
        if (revealed) {
          foundMessage = `在【${clueSource}】发现并公开了线索：“${foundClue.description}”`;
        } else {
          foundMessage = `在【${clueSource}】发现了一条关于自己的线索，并选择将其隐藏。`;
        }
      } else {
        foundMessage = '没有发现更多新线索了。';
      }
    }

    // 7. 将搜证结果记录到游戏日志
    logToScriptKillGame(`${player.name} 完成了一次搜证: ${foundMessage}`);
    await sleep(1500);
  }

  /**
   * 【剧本杀-AI核心】触发AI行动
   */
  async function triggerScriptKillAiAction(playerId, action, context = {}) {
    const player = scriptKillGameState.players.find(p => p.id === playerId);
    if (!player) return;

    const { proxyUrl, apiKey, model } = state.apiConfig;

    // ▼▼▼ 请用下面这【一整块】代码，完整替换掉旧的 systemPrompt 变量定义 ▼▼▼
    let jsonFormat = '';
    let extraContext = '';
    let systemPrompt = `
**【LANGUAGE RULE - HIGHEST PRIORITY】: You MUST reply in Vietnamese (Tiếng Việt) for ALL messages. Never use Chinese or any other language.**

# 任务: 剧本杀角色扮演
# 你的双重身份 (必须严格遵守)
1.  **你的本体**: 你的真实身份是 **${player.name}**，你的核心性格是：**${player.persona}**。
2.  **你的剧本角色**: 在这场游戏中，你需要扮演角色 **【${player.role.name}】**。
    -   **剧本身份设定**: ${player.role.description}
    -   **你的故事线 (时间线)**: ${player.role.storyline} 
    -   **剧本秘密任务**: ${player.role.tasks}

# 你已掌握的线索: 
${player.evidence.map(e => `- ${e.description}`).join('\n') || '(暂无线索)'}

# 当前游戏阶段: ${scriptKillGameState.gamePhase}
# 游戏日志 (最近50条):
${scriptKillGameState.gameLog
  .slice(-50)
  .map(log => {
    if (log.type === 'speech') return `${log.message.player.role.name}: ${log.message.speech}`;
    return log.message;
  })
  .join('\n')}
${extraContext}
# 你的行动指令
`;

    // ▲▲▲ 替换结束 ▲▲▲

    switch (action) {
      case 'introduce':
        systemPrompt += '现在轮到你进行自我介绍。请根据你的人设，以第一人称进行一段简短的介绍。';
        jsonFormat = '{"action": "speak", "speech": "你的自我介绍..."}';
        break;
      // ▼▼▼ 【全新】在这里为AI添加“讨论时间线”的新指令 ▼▼▼
      case 'discuss_timeline':
        systemPrompt +=
          '现在是时间线陈述环节。请根据你的角色剧本（包括身份设定和秘密任务），详细、清晰地陈述你在案发时间段内的行动轨迹。你的发言必须是第一人称，并且要听起来自然，可以适当隐藏对你不利的信息，但不能凭空捏造。';
        jsonFormat = '{"action": "speak", "speech": "你的时间线陈述..."}';
        break;
      // ▲▲▲ 新增指令结束 ▲▲▲
      case 'discuss':
        systemPrompt += '现在是自由讨论环节。请根据你掌握的线索和场上其他人的发言，发表你的看法、提出疑问或指证他人。';
        jsonFormat = '{"action": "speak", "speech": "你的发言..."}';
        break;
      case 'vote':
        systemPrompt += '现在是最终投票环节。请综合所有信息，投出你认为的凶手。';
        jsonFormat = '{"action": "vote", "targetId": "你投票的玩家ID"}';
        break;
      // ▼▼▼ 在 triggerScriptKillAiAction 函数的 switch 语句内添加这个 case ▼▼▼
      case 'reveal_clue':
        systemPrompt += `你刚刚搜到了一个关于你自己的线索：“${context.clue}”。\n公开这条线索可能会让你暴露，但也可能洗清嫌疑；隐藏它可能会让你在后期被动。\n请根据你的人设和任务，决定是公开还是隐藏。`;
        jsonFormat = '{"action": "reveal" or "hide", "reasoning": "你的决策理由..."}';
        break;
      // ▲▲▲ 添加结束 ▲▲▲
    }

    systemPrompt += `\n# 存活玩家列表:\n${scriptKillGameState.players
      .map(p => `- ${p.role.name} (id: ${p.id})`)
      .join('\n')}\n# 输出格式: 你的回复【必须且只能】是一个严格的JSON对象，格式如下:\n${jsonFormat}`;

    try {
      let isGemini = proxyUrl === GEMINI_API_URL;
      let messagesForApi = [{ role: 'user', content: systemPrompt }];
      let geminiConfig = toGeminiRequestData(
        model,
        apiKey,
        systemPrompt,
        messagesForApi,
        isGemini,
        state.apiConfig.temperature,
      );

      const response = isGemini
        ? await fetch(geminiConfig.url, geminiConfig.data)
        : await fetch(`${proxyUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model,
              messages: messagesForApi,
              temperature: parseFloat(state.apiConfig.temperature) || 0.8,
              response_format: { type: 'json_object' },
            }),
          });

      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      const content = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).replace(
        /^```json\s*|```$/g,
        '',
      );
      // ▼▼▼ 用这块新代码替换旧的 return 逻辑 ▼▼▼
      const aiAction = JSON.parse(content);

      if (aiAction.action === 'speak') return aiAction.speech;
      if (aiAction.action === 'vote') return aiAction.targetId;
      if (action === 'reveal_clue') return aiAction; // 【核心修改】返回整个决策对象

      return null;
      // ▲▲▲ 替换结束 ▲▲▲
    } catch (error) {
      console.error(`AI (${player.name}) 行动失败:`, error);
      // 返回一个保底的行动，防止游戏卡死
      if (action === 'vote') {
        const potentialTargets = scriptKillGameState.players.filter(p => p.id !== player.id);
        return potentialTargets[Math.floor(Math.random() * potentialTargets.length)].id;
      }
      return '我...我需要再想想。';
    }
  }

  // ▼▼▼ 用这块新代码替换旧的 getBuiltInScript 函数 ▼▼▼

  /**
   * 【剧本杀】根据ID获取一个内置剧本
   * @param {string} scriptId - 要获取的剧本的ID, 例如 'built_in_1'
   * @returns {object|null} - 找到的剧本对象，或 null
   */
  function getBuiltInScript(scriptId) {
    // 【核心修改】我们现在从 BUILT_IN_SCRIPTS 数组中查找匹配的剧本
    return BUILT_IN_SCRIPTS.find(script => script.id === scriptId) || null;
  }

  // ▲▲▲ 替换结束 ▲▲▲

  // --- 【全新】剧本杀自定义剧本管理核心功能 ---

  let editingScriptId = null; // 用于追踪正在编辑的剧本ID

  /**
   * 【总入口】打开自定义剧本管理模态框
   */
  async function openScriptManager() {
    await renderScriptManagerList();
    document.getElementById('script-kill-manager-modal').classList.add('visible');
  }

  /**
   * 渲染自定义剧本列表
   */
  async function renderScriptManagerList() {
    const listEl = document.getElementById('custom-scripts-list');
    listEl.innerHTML = '';
    const scripts = await db.scriptKillScripts.toArray();

    if (scripts.length === 0) {
      listEl.innerHTML =
        '<p style="text-align:center; color: var(--text-secondary); padding: 50px 0;">还没有自定义剧本，点击右上角“添加”创建一个吧！</p>';
      return;
    }

    scripts.forEach(script => {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <div class="item-title">${script.name}</div>
        <div class="item-content">${(script.storyBackground || '暂无简介').substring(0, 50)}...</div>
    `;

      item.addEventListener('click', () => openScriptEditorForEdit(script.id));

      addLongPressListener(item, async () => {
        // ▼▼▼ 核心修改：在菜单里增加 'export' 选项 ▼▼▼
        const choice = await showChoiceModal(`操作《${script.name}》`, [
          { text: '📤 导出剧本', value: 'export' }, // <-- 新增
          { text: '🗑️ 删除剧本', value: 'delete', isDanger: true },
        ]);

        if (choice === 'delete') {
          deleteCustomScript(script.id, script.name);
        } else if (choice === 'export') {
          // <-- 新增处理逻辑
          await exportCustomScript(script.id);
        }
        // ▲▲▲ 修改结束 ▲▲▲
      });
      listEl.appendChild(item);
    });
  }

  /**
   * 打开剧本编辑器（用于创建新剧本）
   */
  function openScriptEditorForCreate() {
    editingScriptId = null; // 标记为创建模式
    document.getElementById('script-editor-title').textContent = '创建新剧本';
    document.getElementById('script-name-input').value = '';
    document.getElementById('script-background-input').value = '';
    // 提供一个JSON结构示例，方便用户填写
    const jsonExample = {
      roles: [
        { name: '角色A', description: '...', tasks: '...', isKiller: true },
        { name: '角色B', description: '...', tasks: '...', isKiller: false },
      ],
      clues: [
        { owner: '角色A', description: '线索描述...', isKey: false },
        { owner: '公共', description: '公共线索...' },
      ],
      truth: '真相是...',
    };
    document.getElementById('script-roles-json-input').value = JSON.stringify(jsonExample, null, 2);

    document.getElementById('script-kill-editor-modal').classList.add('visible');
  }

  /**
   * 打开剧本编辑器（用于编辑现有剧本）
   * @param {number} scriptId - 要编辑的剧本ID
   */
  async function openScriptEditorForEdit(scriptId) {
    editingScriptId = scriptId;
    const script = await db.scriptKillScripts.get(scriptId);
    if (!script) return;

    document.getElementById('script-editor-title').textContent = `编辑剧本: ${script.name}`;
    document.getElementById('script-name-input').value = script.name;
    document.getElementById('script-background-input').value = script.storyBackground;

    // 将 roles, clues, truth 重新组合成一个对象并格式化为JSON
    const jsonData = {
      roles: script.roles,
      clues: script.clues,
      truth: script.truth,
    };
    document.getElementById('script-roles-json-input').value = JSON.stringify(jsonData, null, 2);

    document.getElementById('script-kill-editor-modal').classList.add('visible');
  }

  // ▼▼▼ 用这块【可视化版】代码，替换旧的 saveCustomScript 函数 ▼▼▼
  /**
   * 【可视化版】保存或更新自定义剧本
   */
  async function saveCustomScript() {
    const name = document.getElementById('script-name-input').value.trim();
    const background = document.getElementById('script-background-input').value.trim();
    const truth = document.getElementById('sk-truth-input').value.trim();

    if (!name || !background || !truth) {
      alert('剧本名称、故事背景和最终真相都不能为空！');
      return;
    }

    // 从 currentEditingScriptData 全局变量中获取角色和线索数据
    if (!currentEditingScriptData.roles || currentEditingScriptData.roles.length === 0) {
      alert('请至少添加一个角色！');
      return;
    }

    try {
      const scriptData = {
        name: name,
        storyBackground: background,
        roles: currentEditingScriptData.roles,
        clues: currentEditingScriptData.clues,
        truth: truth,
        isBuiltIn: false,
      };

      if (editingScriptId) {
        await db.scriptKillScripts.update(editingScriptId, scriptData);
        alert('剧本更新成功！');
      } else {
        await db.scriptKillScripts.add(scriptData);
        alert('新剧本保存成功！');
      }

      document.getElementById('script-kill-editor-modal').classList.remove('visible');
      await renderScriptManagerList(); // 刷新管理列表
      editingScriptId = null;
    } catch (error) {
      alert(`保存失败: ${error.message}`);
    }
  }
  // ▲▲▲ 替换结束 ▲▲▲
  // ▼▼▼ 把这一整块全新的功能函数，粘贴到 init() 函数的【正上方】 ▼▼▼

  // --- 【全新】剧本杀可视化编辑器核心功能 ---

  let currentEditingScriptData = { roles: [], clues: [] }; // 用于暂存正在编辑的剧本数据
  let editingItemIndex = -1; // -1 表示新建，否则为被编辑项的索引

  /**
   * 渲染可视化剧本编辑器的主界面
   */
  function renderVisualScriptEditor() {
    const rolesContainer = document.getElementById('sk-roles-container');
    const cluesContainer = document.getElementById('sk-clues-container');
    rolesContainer.innerHTML = '';
    cluesContainer.innerHTML = '';

    // 渲染角色列表
    currentEditingScriptData.roles.forEach((role, index) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'sk-editor-item';
      itemEl.innerHTML = `
            <div class="item-info">
                <div class="item-name">${role.name} ${role.isKiller ? '🔪' : ''}</div>
                <div class="item-meta">${role.description.substring(0, 20)}...</div>
            </div>
            <div class="item-actions">
                <button class="form-button-secondary edit-role-btn" data-index="${index}">编辑</button>
                <button class="form-button-secondary delete-role-btn" data-index="${index}" style="border-color:#ff3b30; color:#ff3b30;">删除</button>
            </div>
        `;
      rolesContainer.appendChild(itemEl);
    });

    // 渲染线索列表
    currentEditingScriptData.clues.forEach((clue, index) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'sk-editor-item';
      itemEl.innerHTML = `
            <div class="item-info">
                <div class="item-name">线索 ${index + 1}</div>
                <div class="item-meta">归属于: ${clue.owner}</div>
            </div>
            <div class="item-actions">
                <button class="form-button-secondary edit-clue-btn" data-index="${index}">编辑</button>
                <button class="form-button-secondary delete-clue-btn" data-index="${index}" style="border-color:#ff3b30; color:#ff3b30;">删除</button>
            </div>
        `;
      cluesContainer.appendChild(itemEl);
    });
  }

  /**
   * 打开角色编辑器（新建或编辑）
   */
  function openRoleEditor(index = -1) {
    editingItemIndex = index;
    const modal = document.getElementById('sk-item-editor-modal');
    document.getElementById('sk-role-editor-fields').style.display = 'block';
    document.getElementById('sk-clue-editor-fields').style.display = 'none';

    if (index > -1) {
      // 编辑模式
      const role = currentEditingScriptData.roles[index];
      document.getElementById('sk-item-editor-title').textContent = `编辑角色: ${role.name}`;
      document.getElementById('sk-role-name-input').value = role.name;
      document.getElementById('sk-role-desc-input').value = role.description;
      // ▼▼▼ 在这里添加下面这行新代码 ▼▼▼
      document.getElementById('sk-role-storyline-input').value = role.storyline || ''; // 使用 || '' 确保旧数据不会显示'undefined'
      // ▲▲▲ 新代码粘贴结束 ▲▲▲
      document.getElementById('sk-role-tasks-input').value = role.tasks;
      document.getElementById('sk-role-killer-toggle').checked = role.isKiller;
    } else {
      // 新建模式
      document.getElementById('sk-item-editor-title').textContent = '添加新角色';
      document.getElementById('sk-role-name-input').value = '';
      document.getElementById('sk-role-desc-input').value = '';
      // ▼▼▼ 在这里添加下面这行新代码 ▼▼▼
      document.getElementById('sk-role-storyline-input').value = ''; // 新建时清空
      // ▲▲▲ 新代码粘贴结束 ▲▲▲
      document.getElementById('sk-role-tasks-input').value = '';
      document.getElementById('sk-role-killer-toggle').checked = false;
    }
    modal.classList.add('visible');
  }

  /**
   * 打开线索编辑器（新建或编辑）
   */
  function openClueEditor(index = -1) {
    editingItemIndex = index;
    const modal = document.getElementById('sk-item-editor-modal');
    document.getElementById('sk-role-editor-fields').style.display = 'none';
    document.getElementById('sk-clue-editor-fields').style.display = 'block';

    // 动态填充线索归属的下拉菜单
    const ownerSelect = document.getElementById('sk-clue-owner-select');
    ownerSelect.innerHTML = '<option value="公共">公共线索</option>';
    currentEditingScriptData.roles.forEach(role => {
      const option = document.createElement('option');
      option.value = role.name;
      option.textContent = `角色: ${role.name}`;
      ownerSelect.appendChild(option);
    });

    if (index > -1) {
      // 编辑模式
      const clue = currentEditingScriptData.clues[index];
      document.getElementById('sk-item-editor-title').textContent = `编辑线索 ${index + 1}`;
      ownerSelect.value = clue.owner;
      document.getElementById('sk-clue-desc-input').value = clue.description;
      document.getElementById('sk-clue-key-toggle').checked = clue.isKey || false;
    } else {
      // 新建模式
      document.getElementById('sk-item-editor-title').textContent = '添加新线索';
      ownerSelect.value = '公共';
      document.getElementById('sk-clue-desc-input').value = '';
      document.getElementById('sk-clue-key-toggle').checked = false;
    }
    modal.classList.add('visible');
  }

  /**
   * 保存子编辑器（角色或线索）中的数据
   */
  function saveItemFromEditor() {
    const isRoleEditor = document.getElementById('sk-role-editor-fields').style.display === 'block';

    if (isRoleEditor) {
      const roleData = {
        name: document.getElementById('sk-role-name-input').value.trim(),
        description: document.getElementById('sk-role-desc-input').value.trim(),
        // ▼▼▼ 在这里添加下面这行新代码 ▼▼▼
        storyline: document.getElementById('sk-role-storyline-input').value.trim(),
        // ▲▲▲ 新代码粘贴结束 ▲▲▲
        tasks: document.getElementById('sk-role-tasks-input').value.trim(),
        isKiller: document.getElementById('sk-role-killer-toggle').checked,
      };
      if (!roleData.name) {
        alert('角色名称不能为空！');
        return;
      }

      if (editingItemIndex > -1) {
        currentEditingScriptData.roles[editingItemIndex] = roleData;
      } else {
        currentEditingScriptData.roles.push(roleData);
      }
    } else {
      const clueData = {
        owner: document.getElementById('sk-clue-owner-select').value,
        description: document.getElementById('sk-clue-desc-input').value.trim(),
        isKey: document.getElementById('sk-clue-key-toggle').checked,
      };
      if (!clueData.description) {
        alert('线索描述不能为空！');
        return;
      }

      if (editingItemIndex > -1) {
        currentEditingScriptData.clues[editingItemIndex] = clueData;
      } else {
        currentEditingScriptData.clues.push(clueData);
      }
    }

    document.getElementById('sk-item-editor-modal').classList.remove('visible');
    renderVisualScriptEditor(); // 刷新主编辑器界面
  }

  /**
   * 替换 openScriptEditorForCreate 函数
   */
  function openScriptEditorForCreate() {
    editingScriptId = null;
    currentEditingScriptData = { roles: [], clues: [] }; // 清空暂存数据
    document.getElementById('script-editor-title').textContent = '创建新剧本';
    document.getElementById('script-name-input').value = '';
    document.getElementById('script-background-input').value = '';
    document.getElementById('sk-truth-input').value = '';
    renderVisualScriptEditor(); // 渲染空的编辑器
    document.getElementById('script-kill-editor-modal').classList.add('visible');
  }

  /**
   * 替换 openScriptEditorForEdit 函数
   */
  async function openScriptEditorForEdit(scriptId) {
    editingScriptId = scriptId;
    const script = await db.scriptKillScripts.get(scriptId);
    if (!script) return;

    // 将数据库数据加载到暂存对象
    currentEditingScriptData = {
      roles: script.roles || [],
      clues: script.clues || [],
    };

    document.getElementById('script-editor-title').textContent = `编辑剧本: ${script.name}`;
    document.getElementById('script-name-input').value = script.name;
    document.getElementById('script-background-input').value = script.storyBackground;
    document.getElementById('sk-truth-input').value = script.truth;

    renderVisualScriptEditor(); // 渲染带有数据的编辑器
    document.getElementById('script-kill-editor-modal').classList.add('visible');
  }

  // --- ▲▲▲ 新增功能函数结束 ▲▲▲

  /**
   * 删除一个自定义剧本
   * @param {number} scriptId - 要删除的剧本ID
   * @param {string} scriptName - 剧本名称，用于确认提示
   */
  async function deleteCustomScript(scriptId, scriptName) {
    const confirmed = await showCustomConfirm('删除剧本', `确定要永久删除自定义剧本《${scriptName}》吗？`, {
      confirmButtonClass: 'btn-danger',
    });
    if (confirmed) {
      await db.scriptKillScripts.delete(scriptId);
      await renderScriptManagerList();
      alert('剧本已删除。');
    }
  }
  /**
   * 【全新】导出指定的自定义剧本
   * @param {number} scriptId - 要导出的剧本ID
   */
  async function exportCustomScript(scriptId) {
    try {
      const script = await db.scriptKillScripts.get(scriptId);
      if (!script) {
        alert('错误：找不到要导出的剧本。');
        return;
      }

      // 1. 准备要导出的纯数据结构 (去除本地数据库ID，保留核心内容)
      const exportData = {
        type: 'EPhoneScriptKill', // 标记文件类型
        version: 1,
        name: script.name,
        storyBackground: script.storyBackground,
        truth: script.truth,
        roles: script.roles,
        clues: script.clues,
      };

      // 2. 转换为JSON字符串
      const jsonString = JSON.stringify(exportData, null, 2);

      // 3. 创建并下载文件
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      // 文件名示例: [剧本杀]古堡之谜-2024-01-01.json
      link.href = url;
      link.download = `[剧本杀]${script.name}-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();

      // 4. 清理
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      await showCustomAlert('导出成功', `剧本《${script.name}》已成功导出！`);
    } catch (error) {
      console.error('导出剧本失败:', error);
      await showCustomAlert('导出失败', `发生错误: ${error.message}`);
    }
  }

  /**
   * 【全新】导入剧本杀剧本文件
   * @param {File} file - 用户选择的JSON文件
   */
  async function importCustomScript(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const text = e.target.result;
        const data = JSON.parse(text);

        // 1. 简单的格式验证
        if (!data.name || !data.roles || !data.clues || !data.truth) {
          throw new Error('文件格式无效。缺少必要的剧本字段(name, roles, clues, truth)。');
        }

        // 2. 检查是否重名，如果重名自动重命名
        let newScriptName = data.name;
        const existingScript = await db.scriptKillScripts.where('name').equals(newScriptName).first();
        if (existingScript) {
          newScriptName = `${newScriptName} (导入)`;
        }

        // 3. 构建入库数据
        const scriptToAdd = {
          name: newScriptName,
          storyBackground: data.storyBackground || '（无背景介绍）',
          truth: data.truth,
          roles: data.roles,
          clues: data.clues,
          isBuiltIn: false, // 标记为自定义剧本
        };

        // 4. 存入数据库
        await db.scriptKillScripts.add(scriptToAdd);

        // 5. 刷新列表并提示
        await renderScriptManagerList();
        await showCustomAlert('导入成功', `剧本《${newScriptName}》已成功导入！`);
      } catch (error) {
        console.error('导入剧本失败:', error);
        await showCustomAlert('导入失败', `解析文件时出错: ${error.message}`);
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  // --- ▲▲▲ 新增功能函数结束 ▲▲▲
  // ▼▼▼ 在 init() 函数的【正上方】粘贴下面这一整块新代码 ▼▼▼

  /**
   * 【剧本杀】AI核心：调用AI为整局游戏生成复盘摘要
   * @returns {Promise<string>} - AI生成的摘要文本
   */
  async function generateAiSkSummary() {
    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
      return '（AI摘要生成失败：API未配置）';
    }

    const formattedLog = scriptKillGameState.gameLog
      .map(log => {
        if (log.type === 'speech') {
          return `${log.message.player.role.name}: ${log.message.speech}`;
        }
        return log.message;
      })
      .join('\n');

    const killer = scriptKillGameState.players.find(p => p.role.isKiller)?.role.name || '未知';

    const prompt = `
# 任务
你是一位专业的剧本杀复盘DM。请根据以下完整的游戏日志，用200字左右，客观、精炼地总结本局游戏的【关键事件】、【重要线索】和【玩家逻辑】。

# 核心要求
- 你的总结需要有逻辑、有条理，像一个真正的游戏复盘。
- 点出关键线索是如何被发现和利用的。
- 分析凶手(${killer})是如何隐藏自己的，以及好人阵营的推理亮点或误区。
- 你的输出【必须且只能】是复盘摘要的纯文本内容，不要包含任何额外的对话或标题。

# 游戏日志
${formattedLog}
`;

    try {
      const messagesForApi = [{ role: 'user', content: prompt }];
      let isGemini = proxyUrl === GEMINI_API_URL;
      let geminiConfig = toGeminiRequestData(model, apiKey, prompt, messagesForApi, isGemini);

      const response = isGemini
        ? await fetch(geminiConfig.url, geminiConfig.data)
        : await fetch(`${proxyUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              temperature: parseFloat(state.apiConfig.temperature) || 0.8,
            }),
          });

      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      return (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).trim();
    } catch (error) {
      console.error('AI摘要生成失败:', error);
      return '（AI摘要生成失败，请检查网络或API设置）';
    }
  }

  // ▼▼▼ 用这个【功能增强版】函数，完整替换你旧的 generateSkSummary 函数 ▼▼▼
  /**
   * 【剧本杀 V2 - 增强版】生成游戏复盘的文本，包含AI摘要和投票详情
   * @param {string} winner - 胜利的阵营名称
   * @param {string} aiSummary - AI生成的摘要文本
   * @returns {string} - 格式化后的完整复盘Markdown文本
   */
  function generateSkSummary(winner, aiSummary) {
    const roleNameMap = {
      wolf: '狼人',
      villager: '平民',
      seer: '预言家',
      witch: '女巫',
      hunter: '猎人',
      guard: '守卫',
      idiot: '白痴',
    };

    let summaryText = `**剧本杀 - 游戏复盘**\n\n`;
    summaryText += `**剧本:** ${scriptKillGameState.script.name}\n`;
    summaryText += `🏆 **胜利方:** ${winner}\n\n`;

    summaryText += `**本局摘要:**\n${aiSummary}\n\n`;

    summaryText += `**玩家身份:**\n`;
    scriptKillGameState.players.forEach(p => {
      const roleName = p.role.name || '未知角色';
      const isKiller = p.role.isKiller ? ' (🔪凶手)' : '';
      summaryText += `- ${p.name}: 扮演 ${roleName}${isKiller}\n`;
    });

    // --- ▼▼▼ 这就是我们本次新增的核心代码！▼▼▼ ---
    summaryText += `\n**投票详情:**\n`;
    const votes = scriptKillGameState.votes;
    const playerMap = new Map(scriptKillGameState.players.map(p => [p.id, p.name]));

    for (const voterId in votes) {
      const voterName = playerMap.get(voterId) || '未知投票者';
      const targetId = votes[voterId];

      if (targetId) {
        // 如果不是弃票
        const targetName = playerMap.get(targetId) || '未知目标';
        summaryText += `- ${voterName}  →  ${targetName}\n`;
      } else {
        // 如果是弃票
        summaryText += `- ${voterName}  →  弃票\n`;
      }
    }
    // --- ▲▲▲ 新增代码结束 ▲▲▲ ---

    return summaryText;
  }
  // ▲▲▲ 替换结束 ▲▲▲

  /**
   * 【剧本杀】显示游戏结算卡片模态框
   * @param {string} summaryText - 复盘文本
   */
  function showScriptKillSummaryModal(summaryText) {
    const modal = document.getElementById('script-kill-summary-modal');
    const contentEl = document.getElementById('script-kill-summary-content');

    contentEl.innerHTML = renderMarkdown(summaryText);

    const repostBtn = document.getElementById('repost-sk-summary-btn');
    const newRepostBtn = repostBtn.cloneNode(true);
    repostBtn.parentNode.replaceChild(newRepostBtn, repostBtn);
    newRepostBtn.onclick = () => openSkSummaryTargetPicker(summaryText);

    const backBtn = document.getElementById('back-to-hall-from-sk-btn');
    const newBackBtn = backBtn.cloneNode(true);
    backBtn.parentNode.replaceChild(newBackBtn, backBtn);
    newBackBtn.onclick = () => {
      modal.classList.remove('visible');
      showScreen('game-hall-screen');
    };

    modal.classList.add('visible');
  }

  /**
   * 【剧本杀】打开复盘发送目标选择器
   * @param {string} summaryText - 要转发的复盘文本
   */
  function openSkSummaryTargetPicker(summaryText) {
    const modal = document.getElementById('script-kill-target-picker-modal');
    const listEl = document.getElementById('script-kill-target-list');
    listEl.innerHTML = '';

    const aiPlayers = scriptKillGameState.players.filter(p => !p.isUser);

    if (aiPlayers.length === 0) {
      alert('没有可转发的AI玩家。');
      return;
    }

    aiPlayers.forEach(player => {
      const item = document.createElement('div');
      item.className = 'player-selection-item';
      item.innerHTML = `
            <input type="checkbox" class="script-kill-target-checkbox" value="${player.id}" checked>
            <img src="${player.avatar || defaultAvatar}" alt="${player.name}">
            <span class="name">${player.name}</span>
        `;
      listEl.appendChild(item);
    });

    const confirmBtn = document.getElementById('sk-confirm-share-btn');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.onclick = () => {
      const selectedIds = Array.from(document.querySelectorAll('.script-kill-target-checkbox:checked')).map(
        cb => cb.value,
      );
      if (selectedIds.length > 0) {
        sendSkSummaryToSelectedPlayers(summaryText, selectedIds);
      } else {
        alert('请至少选择一个转发对象！');
      }
    };

    modal.classList.add('visible');
  }

  /**
   * 【剧本杀】将游戏复盘发送到【选定】的AI角色的单聊中
   * @param {string} summaryText - 复盘文本
   * @param {string[]} targetIds - 目标AI角色的ID数组
   */
  async function sendSkSummaryToSelectedPlayers(summaryText, targetIds) {
    document.getElementById('script-kill-summary-modal').classList.remove('visible');
    document.getElementById('script-kill-target-picker-modal').classList.remove('visible');
    let sentCount = 0;

    const aiContext = `[系统指令：刚刚结束了一局剧本杀，这是游戏复盘。请根据这个复盘内容，以你的角色人设，和用户聊聊刚才的游戏。]\n\n${summaryText}`;

    for (const chatId of targetIds) {
      const chat = state.chats[chatId];
      if (chat) {
        const visibleMessage = {
          role: 'user',
          type: 'share_link',
          timestamp: Date.now(),
          title: '剧本杀 - 游戏复盘',
          description: '点击查看详细复盘记录',
          source_name: '游戏中心',
          content: summaryText,
        };

        const hiddenInstruction = {
          role: 'system',
          content: aiContext,
          timestamp: Date.now() + 1,
          isHidden: true,
        };

        chat.history.push(visibleMessage, hiddenInstruction);
        await db.chats.put(chat);
        sentCount++;
      }
    }

    await showCustomAlert('转发成功', `游戏复盘已发送至 ${sentCount} 位AI玩家的单聊中！`);
    showScreen('game-hall-screen');
  }

  // ▲▲▲ 新代码粘贴结束 ▲▲▲
  // ▼▼▼ 【全新】这是剧本杀AI生成功能的所有核心函数 ▼▼▼

  function openAiScriptGenerator() {
    // 隐藏剧本管理弹窗
    document.getElementById('script-kill-manager-modal').classList.remove('visible');

    const modal = document.getElementById('sk-ai-generator-modal');
    // ▼▼▼ 在这里修改 ▼▼▼
    document.getElementById('sk-ai-elements-input').value = ''; // 清空要素输入框
    document.getElementById('sk-ai-summary-input').value = ''; // 清空梗概输入框
    // ▲▲▲ 修改结束 ▲▲▲
    document.getElementById('sk-ai-result-preview').textContent = '点击“开始生成”后，结果将显示在这里...';
    document.getElementById('sk-ai-generator-save-btn').disabled = true;
    tempGeneratedScriptData = null;

    modal.classList.add('visible');
  }

  /**
   * 【AI核心 V2 - 强制时间线版】根据用户的要素和梗概，调用AI生成剧本
   */
  async function generateSkScriptWithAI() {
    // 1. 从新的两个输入框获取数据
    const elements = document.getElementById('sk-ai-elements-input').value.trim();
    const summary = document.getElementById('sk-ai-summary-input').value.trim();
    const playerCount = document.getElementById('sk-ai-player-count-input').value;

    if (!elements) {
      // 核心要素是必填的
      alert('请输入剧本的核心要素！');
      return;
    }

    const previewEl = document.getElementById('sk-ai-result-preview');
    const saveBtn = document.getElementById('sk-ai-generator-save-btn');
    previewEl.textContent = '🧠 AI正在奋力创作中，这可能需要1-2分钟，请耐心等待...';
    saveBtn.disabled = true;

    // 2. 构建给AI的【全新、更严格】的指令(Prompt)
    const systemPrompt = `
**【LANGUAGE RULE - HIGHEST PRIORITY】: You MUST reply in Vietnamese (Tiếng Việt) for ALL messages. Never use Chinese or any other language.**

# 任务
你是一个专业的剧本杀剧本创作AI。你的任务是根据用户提供的核心要素和剧情梗概，创作一个【${playerCount}人】的、完整、可玩的剧本杀剧本。

# 用户提供的核心要素:
-   **玩家人数**: ${playerCount}人
-   **核心元素**: ${elements}
-   **剧情梗概**: ${summary || '（用户未提供详细梗概，请根据核心元素自由发挥）'}

# 【【【时间线铁律：这是最高指令，必须严格遵守】】】
在生成每个角色的 "storyline" (故事线) 字段时，你【必须】遵循以下规则：
1.  **必须包含明确的时间点**：每一段关键行动前，都必须有一个具体的时间，格式为【**HH:mm**】（例如：**20:30** 或 **晚上8点15分**）。
2.  **必须是具体的行动轨迹**：禁止使用“后来”、“过了一会儿”等模糊描述。必须清楚地写出角色在【什么时间】、【什么地点】、【做了什么事】。
3.  **提供清晰的示例**:
    -   **【【错误的模糊示例】】**: "晚上我和他吵了一架，然后离开了。"
    -   **【【正确的详细示例】】**: "**20:30**: 我在书房因为项目资金问题和王总监大吵一架，他威胁要解雇我。 **20:45**: 我愤怒地摔门而出，回到了自己的工位。"

# 剧本创作核心要求
1.  **完整性**: 你必须生成剧本的所有组成部分，包括：剧本名称(name)、故事背景(storyBackground)、角色设定(roles)、线索卡(clues)、以及最终真相(truth)。
2.  **角色设定 (roles)**:
    -   必须是一个包含【${playerCount}个】角色对象的数组。
    -   每个角色对象必须包含以下字段:
        -   name: 角色名称 (字符串)。
        -   description: 角色简介 (字符串, 简短描述)。
        -   storyline: 角色的个人故事线或时间线 (字符串, **必须遵守【时间线铁律】**)。
        -   tasks: 角色的秘密任务 (字符串)。
        -   isKiller: 是否是凶手 (布尔值, true 或 false)。
    -   剧本中【必须有且只有一个】角色的 isKiller 为 true。
3.  **线索卡 (clues)**:
    -   必须是一个包含多个线索对象的数组。
    -   每个线索对象必须包含以下字段:
        -   owner: 线索归属 (字符串, 可以是某个角色名，也可以是 "公共")。
        -   description: 线索的详细描述 (字符串)。
        -   isKey: 是否是关键线索 (布尔值, true 或 false)。
    -   至少要有一条关键线索。
4.  **最终真相 (truth)**: 必须清晰、有逻辑地揭示整个案件的真相、凶手的动机和作案手法。

# 【格式铁律】
你的回复【必须且只能】是一个严格的JSON对象，直接以 '{' 开头，以 '}' 结尾。禁止包含任何 "json", "\`\`\`" 或其他解释性文字。
`;

    // 3. 调用API (这部分逻辑与之前相同)
    try {
      const { proxyUrl, apiKey, model } = state.apiConfig;
      let isGemini = proxyUrl === GEMINI_API_URL;
      let messagesForApi = [{ role: 'user', content: systemPrompt }];
      let geminiConfig = toGeminiRequestData(
        model,
        apiKey,
        systemPrompt,
        messagesForApi,
        isGemini,
        state.apiConfig.temperature,
      );

      const response = isGemini
        ? await fetch(geminiConfig.url, geminiConfig.data)
        : await fetch(`${proxyUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              temperature: parseFloat(state.apiConfig.temperature) || 0.8,
              response_format: { type: 'json_object' },
            }),
          });

      if (!response.ok) throw new Error(`API请求失败: ${response.status} - ${await response.text()}`);

      const data = await response.json();
      const rawContent = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content)
        .replace(/^```json\s*|```$/g, '')
        .trim();

      const generatedScript = JSON.parse(rawContent);

      if (
        !generatedScript.name ||
        !generatedScript.storyBackground ||
        !Array.isArray(generatedScript.roles) ||
        !Array.isArray(generatedScript.clues) ||
        !generatedScript.truth
      ) {
        throw new Error('AI返回的JSON格式不完整，缺少必要的字段。');
      }

      previewEl.textContent = JSON.stringify(generatedScript, null, 2);
      tempGeneratedScriptData = generatedScript;
      saveBtn.disabled = false;

      await showCustomAlert('生成成功！', '剧本已生成，请在下方预览。如果满意，可以点击保存。');
    } catch (error) {
      console.error('AI剧本生成失败:', error);
      previewEl.textContent = `生成失败！请检查API设置或网络后重试。\n\n错误信息: ${error.message}`;
      await showCustomAlert('生成失败', `发生了一个错误：\n${error.message}`);
    }
  }

  /**
   * 保存AI生成的剧本
   */
  async function saveAiGeneratedScript() {
    if (!tempGeneratedScriptData) {
      alert('没有可以保存的剧本数据。');
      return;
    }

    try {
      const scriptToSave = {
        ...tempGeneratedScriptData,
        isBuiltIn: false, // 标记为非内置剧本
      };

      // 存入数据库
      await db.scriptKillScripts.add(scriptToSave);

      document.getElementById('sk-ai-generator-modal').classList.remove('visible'); // 关闭AI生成器
      await renderScriptManagerList(); // 刷新剧本管理列表

      alert(`剧本《${scriptToSave.name}》已成功保存到你的自定义剧本库中！`);
    } catch (error) {
      console.error('保存AI剧本失败:', error);
      alert(`保存失败: ${error.message}`);
    }
  }

  // ▲▲▲ 新增功能函数结束 ▲▲▲

  // ▲▲▲ 剧本杀功能函数结束 ▲▲▲
  // ▼▼▼ 【全新】这里是“你说我猜”游戏的所有核心功能函数 ▼▼▼

  // ▼▼▼ 【全新】这里是“你说我猜”游戏的所有核心功能函数 ▼▼▼

  /**
   * 【你说我猜】打开游戏设置界面 (V2 - 复选框版)
   */
  async function openGuessWhatSetup() {
    // 重置游戏状态，以防上次游戏数据残留
    guessWhatGameState = {
      isActive: false,
      mode: 'ai_guesses',
      opponent: null,
      secretWord: '',
      gameLog: [],
      currentTurn: 'user',
    };

    showScreen('guess-what-setup-screen');
    const selectionEl = document.getElementById('guess-what-player-selection');
    selectionEl.innerHTML = '<p>正在加载玩伴列表...</p>';

    const singleChats = Object.values(state.chats).filter(chat => !chat.isGroup);
    const allNpcs = Object.values(state.chats).flatMap(chat =>
      (chat.npcLibrary || []).map(npc => ({ ...npc, owner: chat.name })),
    );
    let playerOptions = [
      ...singleChats.map(c => ({ id: c.id, name: c.name, avatar: c.settings.aiAvatar, type: '角色' })),
      ...allNpcs.map(n => ({ id: n.id, name: n.name, avatar: n.avatar, type: `NPC (${n.owner})` })),
    ];

    selectionEl.innerHTML = '';
    if (playerOptions.length === 0) {
      selectionEl.innerHTML =
        '<p style="text-align:center; color: var(--text-secondary);">还没有可以一起玩的好友哦~</p>';
      return;
    }

    // 【核心修改1】使用复选框，并添加专属class
    playerOptions.forEach((player, index) => {
      const item = document.createElement('div');
      item.className = 'player-selection-item';
      item.innerHTML = `
            <input type="checkbox" class="guess-what-player-checkbox" value="${player.id}" id="opponent-${player.id}" ${
        index === 0 ? 'checked' : ''
      }>
            <img src="${player.avatar || defaultAvatar}" alt="${player.name}">
            <span class="name">${player.name}</span>
            <span class="type-tag">${player.type}</span>
        `;
      selectionEl.appendChild(item);
    });

    // 【核心修改2】添加事件监听，实现单选效果
    selectionEl.addEventListener('click', e => {
      if (e.target.type === 'checkbox' && e.target.classList.contains('guess-what-player-checkbox')) {
        // 当点击一个复选框时，取消其他所有同类复选框的选中状态
        document.querySelectorAll('.guess-what-player-checkbox').forEach(cb => {
          if (cb !== e.target) cb.checked = false;
        });
      }
    });

    // 默认显示“我出题”模式的输入框
    document.getElementById('user-word-input-container').style.display = 'block';
  }

  /**
   * 【你说我猜】开始游戏的核心逻辑 (V2 - 复选框版)
   */
  async function startGuessWhatGame() {
    // 【核心修改】修改选择器以匹配新的复选框class
    const selectedOpponentCheckbox = document.querySelector('.guess-what-player-checkbox:checked');
    if (!selectedOpponentCheckbox) {
      alert('请选择一位玩伴！');
      return;
    }
    const opponentId = selectedOpponentCheckbox.value;
    const gameMode = document.querySelector('input[name="guess_what_mode"]:checked').value;
    const userWord = document.getElementById('guess-what-user-word').value.trim();

    if (gameMode === 'ai_guesses' && !userWord) {
      alert('“我出题”模式下，词语不能为空！');
      return;
    }

    await showCustomAlert('请稍候...', '正在准备游戏，AI也在摩拳擦掌...');

    const chat = Object.values(state.chats).find(c => c.id === opponentId);
    let opponentInfo = null;
    if (chat) {
      opponentInfo = { id: chat.id, name: chat.name, avatar: chat.settings.aiAvatar, persona: chat.settings.aiPersona };
    } else {
      for (const c of Object.values(state.chats)) {
        const npc = (c.npcLibrary || []).find(n => n.id === opponentId);
        if (npc) {
          opponentInfo = { id: npc.id, name: npc.name, avatar: npc.avatar, persona: npc.persona };
          break;
        }
      }
    }
    if (!opponentInfo) {
      alert('找不到所选的玩伴信息！');
      return;
    }

    guessWhatGameState.isActive = true;
    guessWhatGameState.mode = gameMode;
    guessWhatGameState.opponent = opponentInfo;
    guessWhatGameState.gameLog = [];

    document.getElementById('guess-what-game-title').textContent = `与 ${opponentInfo.name} 的游戏`;
    const inputEl = document.getElementById('guess-what-user-input');

    if (gameMode === 'ai_guesses') {
      guessWhatGameState.secretWord = userWord;
      guessWhatGameState.currentTurn = 'user';
      logToGuessWhatGame('游戏开始！你来出题，请给出你的第一个提示。', 'system');
      inputEl.placeholder = '请给出第一个提示...';
      inputEl.disabled = false;
    } else {
      const { secretWord, firstHint } = await triggerGuessWhatAiAction('generate_word');
      if (!secretWord) {
        await showCustomAlert('出题失败', '抱歉，AI今天好像没灵感，想不出题目来。请稍后再试或检查API设置。');
        guessWhatGameState.isActive = false;
        showScreen('game-hall-screen');
        return;
      }
      guessWhatGameState.secretWord = secretWord;
      guessWhatGameState.currentTurn = 'user';
      logToGuessWhatGame(`游戏开始！${opponentInfo.name} 已经想好了一个词。`, 'system');
      logToGuessWhatGame(
        { player: opponentInfo, text: `【${opponentInfo.name}托着下巴想了想】第一个提示是... ${firstHint}` },
        'ai-turn',
      );
      inputEl.placeholder = '请根据提示进行猜测...';
      inputEl.disabled = false;
    }

    showScreen('guess-what-game-screen');
    renderGuessWhatGameScreen();
    inputEl.focus();
    const actionArea = document.getElementById('guess-what-action-area');
    if (actionArea) actionArea.style.display = 'flex';
  }
  // ▼▼▼ 【全新】这是“你说我猜”的重roll功能核心函数 ▼▼▼
  /**
   * 【你说我猜】处理AI发言的重roll请求
   * @param {number} logIndex - 要重roll的AI发言在gameLog中的索引
   */
  async function handleGuessWhatReroll(logIndex) {
    // 1. 找到AI的发言和触发它的那条用户发言
    const aiLogIndex = logIndex;
    const userLogIndex = logIndex - 1;

    // 安全检查
    if (
      userLogIndex < 0 ||
      !guessWhatGameState.gameLog[userLogIndex] ||
      guessWhatGameState.gameLog[userLogIndex].type !== 'user-turn'
    ) {
      alert('无法重roll，找不到触发此回应的用户消息。');
      return;
    }

    // 2. 提取用户原始的输入内容
    const originalUserInput = guessWhatGameState.gameLog[userLogIndex].message.text;

    // 3. 从日志中移除这两条记录，实现“时间倒流”
    guessWhatGameState.gameLog.splice(userLogIndex, 2);

    // 4. 立即刷新界面，让用户看到消息消失了
    renderGuessWhatGameScreen();
    await showCustomAlert('请稍候...', 'AI正在换个思路...');

    // 5. 使用用户原始的输入，重新调用游戏主流程
    await processGuessWhatTurn(originalUserInput);
  }
  // ▲▲▲ 新增函数结束 ▲▲▲

  // ▼▼▼ 【你说我猜】用这块【已添加重roll按钮】的代码，完整替换旧的 renderGuessWhatGameScreen 函数 ▼▼▼
  /**
   * 【你说我猜】渲染游戏主界面
   */
  function renderGuessWhatGameScreen() {
    const logContainer = document.getElementById('guess-what-game-log');
    logContainer.innerHTML = '';

    guessWhatGameState.gameLog.forEach((log, index) => {
      // ★ 核心修改1：增加了index参数
      const logEl = document.createElement('div');
      logEl.className = `guess-log-entry ${log.type}`;

      if (log.type === 'system') {
        logEl.textContent = log.message;
      } else if (log.type === 'ai-turn') {
        // ★ 核心修改2：定位到AI的发言
        const avatarUrl = log.message.player.avatar;
        // ★ 核心修改3：为AI发言添加重roll按钮
        logEl.innerHTML = `
                <img src="${avatarUrl}" class="avatar">
                <div class="bubble">
                    <div class="name" style="display: flex; align-items: center; gap: 8px;">
                        ${log.message.player.name}
                        <button class="gw-reroll-btn" data-log-index="${index}" title="让Ta换个说法" style="background:none; border:none; cursor:pointer; padding:0; color:var(--text-secondary);">
                           <svg class="reroll-btn-icon" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                        </button>
                    </div>
                    <div>${log.message.text.replace(/\n/g, '<br>')}</div>
                </div>
            `;
      } else {
        // 用户的发言保持原样
        const avatarUrl = log.message.player.isUser
          ? state.qzoneSettings.avatar || defaultAvatar
          : log.message.player.avatar;
        logEl.innerHTML = `
                <img src="${avatarUrl}" class="avatar">
                <div class="bubble">
                    <div class="name">${log.message.player.name}</div>
                    <div>${log.message.text.replace(/\n/g, '<br>')}</div>
                </div>
            `;
      }
      logContainer.appendChild(logEl);
    });

    logContainer.scrollTop = logContainer.scrollHeight;
  }
  // ▲▲▲ 替换结束 ▲▲▲

  /**
   * 【你说我猜】添加一条游戏日志
   */
  function logToGuessWhatGame(message, type = 'system') {
    guessWhatGameState.gameLog.push({ message, type });
    renderGuessWhatGameScreen();
  }

  /**
   * 【你说我猜 V5 | 裁判逻辑最终修复版】游戏主循环/引擎
   * @param {string} userInput - 用户刚刚的输入
   */
  async function processGuessWhatTurn(userInput) {
    if (!guessWhatGameState.isActive) return;

    const inputEl = document.getElementById('guess-what-user-input');
    const userPlayer = { id: 'user', name: state.qzoneSettings.nickname || '我', isUser: true };
    const aiPlayer = guessWhatGameState.opponent;
    const currentMode = guessWhatGameState.mode;

    // 1. 记录并显示用户的行为
    logToGuessWhatGame({ player: userPlayer, text: userInput }, 'user-turn');

    // 2. 轮到AI行动，禁用输入框
    guessWhatGameState.currentTurn = 'ai';
    inputEl.placeholder = `等待 ${aiPlayer.name} 的回应...`;
    inputEl.disabled = true;
    renderGuessWhatGameScreen();
    await sleep(1500);

    // 3. 让AI根据上下文执行动作
    const aiResponse = await triggerGuessWhatAiAction(
      currentMode === 'ai_guesses' ? 'guess_word' : 'give_hint',
      userInput,
    );

    // 4. 【核心修复】使用 switch 结构清晰地处理AI的每一种行动结果
    if (aiResponse) {
      switch (aiResponse.type) {
        case 'guess':
          const guessText = aiResponse.text;
          // 先把AI的猜测显示出来
          logToGuessWhatGame({ player: aiPlayer, text: guessText }, 'ai-turn');

          // 调用裁判函数进行判断
          if (isGuessCorrect(guessText, guessWhatGameState.secretWord)) {
            await sleep(1000); // 停顿一下，让玩家看到猜测内容
            endGuessWhatGame('ai', `我猜对啦！答案就是【${guessWhatGameState.secretWord}】！`);
            return; // 猜对了，游戏结束，退出函数
          }
          // 如果没猜对，则不执行任何操作，流程会自然地走到最后，把控制权还给用户
          break;

        case 'hint':
          // AI给出新提示
          logToGuessWhatGame({ player: aiPlayer, text: aiResponse.text }, 'ai-turn');
          break;

        case 'game_over':
          // AI在给提示时直接判断用户猜对了
          endGuessWhatGame(aiResponse.winner, aiResponse.reason);
          return; // 游戏结束，退出函数

        case 'error':
          // AI返回了错误信息
          logToGuessWhatGame({ player: aiPlayer, text: aiResponse.text }, 'ai-turn');
          break;

        default:
          // 未知类型的回复，也记录下来
          logToGuessWhatGame({ player: aiPlayer, text: '我好像有点跑神了，我们说到哪了？' }, 'ai-turn');
          console.warn('收到了未知的AI行动类型:', aiResponse);
          break;
      }
    } else {
      // API调用彻底失败
      logToGuessWhatGame({ player: aiPlayer, text: '我...好像彻底断线了...' }, 'ai-turn');
    }

    // 5. 如果游戏没有结束，则轮到用户行动，恢复输入框
    guessWhatGameState.currentTurn = 'user';
    inputEl.placeholder = currentMode === 'ai_guesses' ? '请继续给出你的提示...' : '请根据提示继续猜测...';
    inputEl.disabled = false;
    inputEl.focus();
  }

  /**
   * 【你说我猜】游戏结束处理
   */
  function endGuessWhatGame(winner, reason) {
    if (!guessWhatGameState.isActive) return; // 防止重复执行
    guessWhatGameState.isActive = false; // 标记游戏为非激活状态

    // 立即隐藏游戏中的输入区域
    const actionArea = document.getElementById('guess-what-action-area');
    if (actionArea) actionArea.style.display = 'none';

    // 生成复盘文本
    const summaryText = generateGuessWhatSummary(winner, reason);
    // 显示结算卡片
    showGuessWhatSummaryModal(summaryText);
  }
  /**
   * 【全新】判断AI的猜测是否正确（简单版）
   * @param {string} guess - AI猜测的词语
   * @param {string} answer - 正确答案
   * @returns {boolean}
   */
  function isGuessCorrect(guess, answer) {
    if (!guess || !answer) return false;

    // 为了更宽松的匹配，我们都转为小写并去除空格
    const cleanGuess = guess.toLowerCase().replace(/\s+/g, '');
    const cleanAnswer = answer.toLowerCase().replace(/\s+/g, '');

    // 只要猜测包含了答案，或者答案包含了猜测，就认为正确
    // 例如：答案是“冰淇淋”，猜测“冰淇淋车”或“淇淋”，都算对
    return cleanGuess.includes(cleanAnswer) || cleanAnswer.includes(cleanGuess);
  }

  /**
   * 【你说我猜-AI核心 V4 | 铜墙铁壁版】调用AI执行游戏逻辑，内置强大的重试机制
   * @param {string} actionType - AI需要执行的动作: 'generate_word', 'give_hint', 'guess_word'
   * @param {string} userInput - 用户刚刚的输入
   * @returns {Promise<object|null>} - AI的行动结果
   */
  async function triggerGuessWhatAiAction(actionType, userInput = null) {
    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) return null;

    // --- 这部分Prompt逻辑保持不变 ---
    const opponent = guessWhatGameState.opponent;
    const historyText = guessWhatGameState.gameLog
      .map(log =>
        log.type === 'system' ? `[系统提示: ${log.message}]` : `${log.message.player.name}: ${log.message.text}`,
      )
      .slice(-10)
      .join('\n');
    let systemPrompt = `**【LANGUAGE RULE - HIGHEST PRIORITY】: You MUST reply in Vietnamese (Tiếng Việt) for ALL messages. Never use Chinese or any other language.**\n\n# 你的任务\n你正在扮演角色"${opponent.name}"，人设是："${opponent.persona}"。\n你正在和"${
      state.qzoneSettings.nickname || '我'
    }”玩“你说我猜”游戏。\n你的所有发言都【必须】严格符合你的人设和口吻，让整个过程像一次真实的聊天互动。\n\n# 游戏历史 (最近的对话)\n${historyText}\n`;
    switch (actionType) {
      case 'generate_word':
        systemPrompt += `# 你的行动指令\n1. 根据你的人设，想一个常见的、2-5个字的中文词语作为谜底。\n2. 为这个词语，给出你的【第一条】符合人设的、有趣的提示。\n3. 你的回复【必须且只能】是一个严格的JSON对象，包含 "secretWord" 和 "firstHint" 两个字段。\n\n# JSON输出格式示例:\n{"secretWord": "月亮", "firstHint": "【指了指天上】晚上才能看到的东西哦，圆圆的，亮亮的~"}`;
        break;
      case 'give_hint':
        systemPrompt += `# 游戏规则
你是出题人，你的谜底是【${guessWhatGameState.secretWord}】。
用户刚刚的猜测是：“${userInput}”。

# 你的行动指令
1.  首先判断用户的猜测是否正确。
2.  如果用户猜对了，游戏结束。
3.  如果用户猜错了，你【必须】根据用户的错误猜测，给出【下一条】新的、更具针对性的提示，引导他们。
4.  【【【人设扮演铁律】】】你的所有提示都【必须】符合你的人设和口吻，可以加入动作、表情、语气词，甚至可以对用户【笨笨的猜测进行一些俏皮的吐槽】，让游戏更有趣。
5.  你的回复【必须且只能】是一个严格的JSON对象。

# JSON输出格式
- 如果猜对了: \`{"type": "game_over", "winner": "user", "reason": "恭喜你猜对啦！就是【${guessWhatGameState.secretWord}】！"}\`
- 如果猜错了: \`{"type": "hint", "text": "【叹气】不对哦，再想想。提示是：[在这里写你的新提示]"}\``;
        break;

      // ▼▼▼ 请用这整块【修复后】的代码，替换掉旧的 case 'guess_word' 代码块 ▼▼▼
      case 'guess_word':
        systemPrompt += `# 游戏规则
你是猜题人，用户正在描述一个词语，你需要根据提示猜出这个词。
用户刚刚给你的新提示是：“${userInput}”。

# 你的行动指令
1.  综合分析【游戏历史】中用户给出的【所有提示】。
2.  根据所有线索，进行【一次】猜测。
3.  【【【人设扮演铁律】】】你的猜测【必须】符合你的人设和口吻。你可以加入你的思考过程、情绪，甚至可以【对用户的提示进行吐槽】。
4.  【【【趣味性指令】】】为了逗弄用户，你可以【故意给出一些有趣的、沾点边但明显错误的答案】，然后再给出你认为最可能的答案。但这只是偶尔的调剂，你的最终目的还是要猜对。
5.  【【【绝对禁止】】】你【不能】再向用户提问，你的任务是直接猜测。
6.  你的回复【必须且只能】是一个严格的JSON对象。

# JSON输出格式 (注意：你无法判断自己是否猜对，所以永远使用这个格式)
{"type": "guess", "text": "【假装恍-然大悟】哦~我知道了，是“电饭煲”对不对？...好吧好吧不逗你了，我猜是...[你的真实猜测]"}`;
        break;
      // ▲▲▲ 替换结束 ▲▲▲
    }

    // --- 【核心改造】带有智能重试的API请求逻辑 ---
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const messagesForApi = [{ role: 'user', content: '请根据你在系统指令中读到的规则，立即开始你的行动。' }];
        const isGemini = proxyUrl === GEMINI_API_URL;
        const geminiConfig = toGeminiRequestData(model, apiKey, systemPrompt, messagesForApi, isGemini);

        const response = isGemini
          ? await fetch(geminiConfig.url, geminiConfig.data)
          : await fetch(`${proxyUrl}/v1/chat/completions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
              body: JSON.stringify({
                model: model,
                messages: [{ role: 'system', content: systemPrompt }, ...messagesForApi],
                temperature: parseFloat(state.apiConfig.temperature) || 0.8,
                response_format: { type: 'json_object' },
              }),
            });

        // 智能判断错误类型
        if (!response.ok) {
          // 对于 4xx 类的客户端错误 (如 401 Unauthorized, 400 Bad Request)，通常重试无效，直接抛出。
          if (response.status >= 400 && response.status < 500) {
            const errorText = await response.text();
            throw new Error(`API客户端错误 (状态码 ${response.status}): ${errorText}`);
          }
          // 对于 5xx 服务器错误或 429 速率限制，是可重试的。
          throw new Error(`API服务器临时错误 (状态码 ${response.status})`);
        }

        const data = await response.json();
        const content = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).replace(
          /^```json\s*|```$/g,
          '',
        );
        return JSON.parse(content); // **成功，直接返回结果，跳出循环**
      } catch (error) {
        console.error(`“你说我猜”AI行动[${actionType}]失败 (第 ${attempt}/${maxRetries} 次尝试):`, error.message);

        // 如果是最后一次尝试，或者是一个不可重试的错误，则跳出循环准备返回最终失败信息
        if (attempt === maxRetries || error.message.includes('API客户端错误')) {
          break;
        }

        // 等待一段时间再重试（比如 1.5s, 3s, 4.5s）
        await sleep(1500 * attempt);
      }
    }

    // --- 所有重试都失败后的最终处理 ---
    console.error(`“你说我猜”AI行动[${actionType}]在所有尝试后均失败。`);
    // 根据失败的阶段，返回一个特定的错误对象
    if (actionType === 'generate_word') {
      return { secretWord: null, firstHint: null };
    }
    // 返回一个全新的 'error' 类型，让游戏主循环知道如何处理
    return { type: 'error', text: '【叹了口气】抱歉，我的网络好像出问题了，试了好几次都没连上...' };
  }
  // ▼▼▼ 【全新】“你说我猜”游戏结算与转发功能核心代码 ▼▼▼

  /**
   * 【你说我猜】生成游戏复盘的文本
   * @param {string} winner - 胜利者 ('user' or 'ai')
   * @param {string} reason - 游戏结束原因
   * @returns {string} 格式化后的复盘Markdown文本
   */
  function generateGuessWhatSummary(winner, reason) {
    let summaryText = `**你说我猜 - 游戏复盘**\n\n`;
    summaryText += `**游戏结果:** ${reason}\n`;
    summaryText += `**谜底:** ${guessWhatGameState.secretWord}\n\n`;
    summaryText += `**参与玩家:** 我, ${guessWhatGameState.opponent.name}\n\n`;
    summaryText += `---\n\n**游戏记录:**\n`;

    const formattedLog = guessWhatGameState.gameLog
      .map(log => {
        if (log.type === 'system') {
          return `[系统提示: ${log.message}]`;
        } else {
          return `${log.message.player.name}: ${log.message.text}`;
        }
      })
      .join('\n');

    summaryText += formattedLog;

    return summaryText;
  }

  /**
   * 【你说我猜】显示游戏结算卡片模态框
   * @param {string} summaryText - 复盘文本
   */
  function showGuessWhatSummaryModal(summaryText) {
    const modal = document.getElementById('guess-what-summary-modal');
    const contentEl = document.getElementById('guess-what-summary-content');

    contentEl.innerHTML = renderMarkdown(summaryText);

    // 使用克隆节点技巧，防止事件重复绑定
    const forwardBtn = document.getElementById('forward-guess-what-summary-btn');
    const newForwardBtn = forwardBtn.cloneNode(true);
    forwardBtn.parentNode.replaceChild(newForwardBtn, forwardBtn);

    const closeBtn = document.getElementById('close-guess-what-summary-btn');
    const newCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

    // 检查对手是否是主要角色（有独立聊天窗口），而不是NPC
    const opponentId = guessWhatGameState.opponent.id;
    const canForward = state.chats[opponentId] !== undefined;

    if (canForward) {
      newForwardBtn.style.display = 'block';
      newForwardBtn.onclick = () => forwardGuessWhatSummary(summaryText);
    } else {
      // 如果对手是NPC，没有独立聊天窗口，则隐藏转发按钮
      newForwardBtn.style.display = 'none';
    }

    newCloseBtn.onclick = () => {
      modal.classList.remove('visible');
      showScreen('game-hall-screen');
    };

    modal.classList.add('visible');
  }

  /**
   * 【你说我猜】将游戏复盘转发到对应的AI角色的聊天中
   * @param {string} summaryText - 复盘文本
   */
  async function forwardGuessWhatSummary(summaryText) {
    const opponentId = guessWhatGameState.opponent.id;
    const chat = state.chats[opponentId];

    if (!chat) {
      await showCustomAlert('转发失败', '找不到该玩家的聊天窗口。');
      return;
    }

    document.getElementById('guess-what-summary-modal').classList.remove('visible');

    // 创建对用户可见的复盘消息
    // 创建对用户可见的复盘消息
    const visibleMessage = {
      role: 'user',
      type: 'share_link',
      timestamp: Date.now(),
      title: '你说我猜 - 游戏复盘',
      description: '点击查看详细复盘记录',
      source_name: '游戏中心',
      content: summaryText,
    };

    // 创建给AI看的隐藏指令
    const aiContext = `[系统指令：刚刚结束了一局“你说我猜”，这是游戏复盘。请根据这个复盘内容，以你的角色人设，和用户聊聊刚才的游戏。]\n\n${summaryText}`;
    const hiddenInstruction = {
      role: 'system',
      content: aiContext,
      timestamp: Date.now() + 1,
      isHidden: true,
    };

    chat.history.push(visibleMessage, hiddenInstruction);
    await db.chats.put(chat);

    await showCustomAlert('转发成功', `游戏复盘已发送至与“${chat.name}”的聊天中！`);

    // ▼▼▼ 这就是本次的核心修改！ ▼▼▼
    // 我们现在通过 window 对象来调用这两个“公共函数”
    window.openChat(chat.id);
    window.triggerAiResponse();
    // ▲▲▲ 修改结束 ▲▲▲
  }

  // ▲▲▲ 新增代码粘贴结束 ▲▲▲
  // ▼▼▼ 【全新】这是“心动飞行棋”的所有核心功能函数 ▼▼▼
  /**
   * 【全新】导出指定的飞行棋问题库
   * @param {number} bankId - 要导出的问题库的ID
   */
  async function exportLudoQuestionBank(bankId) {
    try {
      const bank = await db.ludoQuestionBanks.get(bankId);
      const questions = await db.ludoQuestions.where('bankId').equals(bankId).toArray();

      if (!bank) {
        alert('错误：找不到要导出的题库。');
        return;
      }

      // 1. 准备要导出的数据结构，只包含纯粹的数据
      const exportData = {
        bankName: bank.name,
        questions: questions.map(q => ({
          text: q.text,
          type: q.type,
        })),
      };

      // 2. 将数据转换为格式化的JSON字符串
      const jsonString = JSON.stringify(exportData, null, 2);

      // 3. 创建Blob对象
      const blob = new Blob([jsonString], { type: 'application/json' });

      // 4. 创建并触发下载链接
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `[飞行棋题库]${bank.name}-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();

      // 5. 清理临时创建的对象
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      await showCustomAlert('导出成功', `问题库“${bank.name}”已成功导出！`);
    } catch (error) {
      console.error('导出飞行棋题库失败:', error);
      await showCustomAlert('导出失败', `发生了一个错误: ${error.message}`);
    }
  }

  /**
   * 【全新】处理导入的飞行棋问题库文件
   * @param {File} file - 用户选择的JSON文件
   */
  async function importLudoQuestionBank(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const text = e.target.result;
        const data = JSON.parse(text);

        // 1. 验证文件格式
        if (!data.bankName || !Array.isArray(data.questions)) {
          throw new Error("文件格式无效。必须包含 'bankName' 和 'questions' 数组。");
        }

        // 2. 检查题库名称是否已存在
        let newBankName = data.bankName;
        const existingBank = await db.ludoQuestionBanks.where('name').equals(newBankName).first();
        if (existingBank) {
          newBankName = `${newBankName} (导入)`; // 如果重名，自动添加后缀
        }

        // 3. 创建新的题库
        const newBankId = await db.ludoQuestionBanks.add({ name: newBankName });

        // 4. 准备要批量添加的新问题
        const questionsToAdd = data.questions.map(q => ({
          bankId: newBankId,
          text: q.text,
          type: q.type || 'both_answer', // 兼容旧的没有type的题库
        }));

        // 5. 如果有问题，就批量添加到数据库
        if (questionsToAdd.length > 0) {
          await db.ludoQuestions.bulkAdd(questionsToAdd);
        }

        // 6. 刷新UI并给出提示
        await renderLudoQuestionBanks();
        await showCustomAlert('导入成功', `问题库“${newBankName}”已成功导入，包含 ${questionsToAdd.length} 个问题！`);
      } catch (error) {
        console.error('导入飞行棋题库失败:', error);
        await showCustomAlert('导入失败', `无法解析文件，请确保它是正确的题库备份文件。\n\n错误: ${error.message}`);
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  /**
   * 【飞行棋】打开游戏设置界面 (V2 - 复选框版)
   */
  async function openLudoSetup() {
    showScreen('ludo-setup-screen');
    const selectionEl = document.getElementById('ludo-player-selection');
    selectionEl.innerHTML = '<p>正在加载角色列表...</p>';

    // 【核心修改】为了保持统一，我们在这里也加载NPC作为可选玩伴
    const singleChats = Object.values(state.chats).filter(chat => !chat.isGroup);
    const allNpcs = Object.values(state.chats).flatMap(chat =>
      (chat.npcLibrary || []).map(npc => ({ ...npc, owner: chat.name })),
    );
    let playerOptions = [
      ...singleChats.map(c => ({ id: c.id, name: c.name, avatar: c.settings.aiAvatar, type: '角色' })),
      ...allNpcs.map(n => ({ id: n.id, name: n.name, avatar: n.avatar, type: `NPC (${n.owner})` })),
    ];

    selectionEl.innerHTML = '';
    if (playerOptions.length === 0) {
      selectionEl.innerHTML =
        '<p style="text-align:center; color: var(--text-secondary);">还没有可以一起玩的好友哦~</p>';
      return;
    }

    // 【核心修改1】渲染复选框列表
    playerOptions.forEach((player, index) => {
      const item = document.createElement('div');
      item.className = 'player-selection-item';
      item.innerHTML = `
            <input type="checkbox" class="ludo-player-checkbox" value="${player.id}" id="ludo-opponent-${player.id}" ${
        index === 0 ? 'checked' : ''
      }>
            <img src="${player.avatar || defaultAvatar}" alt="${player.name}">
            <span class="name">${player.name}</span>
            <span class="type-tag">${player.type}</span>
        `;
      selectionEl.appendChild(item);
    });

    // 【核心修改2】添加事件监听以实现单选
    selectionEl.addEventListener('click', e => {
      if (e.target.type === 'checkbox' && e.target.classList.contains('ludo-player-checkbox')) {
        document.querySelectorAll('.ludo-player-checkbox').forEach(cb => {
          if (cb !== e.target) cb.checked = false;
        });
      }
    });

    // 加载问题库到下拉框
    const bankSelect = document.getElementById('ludo-question-bank-select');
    bankSelect.innerHTML = '';
    const banks = await db.ludoQuestionBanks.toArray();
    if (banks.length === 0) {
      bankSelect.innerHTML = '<option value="">暂无可用题库</option>';
    } else {
      banks.forEach(bank => {
        const option = document.createElement('option');
        option.value = bank.id;
        option.textContent = bank.name;
        bankSelect.appendChild(option);
      });
    }
  }

  /**
   * 【飞行棋】开始游戏的核心逻辑 (V2 - 复选框版)
   */
  async function startLudoGame() {
    // 【核心修改】修改选择器以匹配新的复选框class
    const selectedOpponentRadio = document.querySelector('.ludo-player-checkbox:checked');
    if (!selectedOpponentRadio) {
      alert('请选择一位玩伴！');
      return;
    }
    const opponentId = selectedOpponentRadio.value;
    const opponentChat =
      state.chats[opponentId] ||
      Object.values(state.chats)
        .flatMap(c => c.npcLibrary)
        .find(n => n.id === opponentId);

    const selectedBankId = parseInt(document.getElementById('ludo-question-bank-select').value);
    if (isNaN(selectedBankId)) {
      alert('请选择一个有效的问题库！');
      return;
    }

    // 查找对手的完整信息（和旧逻辑一样）
    let opponentInfo = null;
    const mainChat = Object.values(state.chats).find(c => c.id === opponentId);
    if (mainChat) {
      opponentInfo = { ...mainChat, persona: mainChat.settings.aiPersona, avatar: mainChat.settings.aiAvatar };
    } else {
      for (const c of Object.values(state.chats)) {
        const npc = (c.npcLibrary || []).find(n => n.id === opponentId);
        if (npc) {
          opponentInfo = npc;
          break;
        }
      }
    }
    if (!opponentInfo) {
      alert('找不到所选的玩伴信息！');
      return;
    }

    // 初始化游戏状态 (和旧逻辑一样)
    ludoGameState = {
      isActive: true,
      opponent: opponentInfo,
      players: [],
      currentTurnIndex: 0,
      gameLog: [],
      boardLayout: [],
      isDiceRolling: false,
      activeQuestionBankId: selectedBankId,
    };
    const userPlayer = {
      id: 'user',
      name: '你',
      avatar: state.qzoneSettings.avatar || defaultAvatar,
      piecePosition: -1,
      isUser: true,
    };
    const charPlayer = {
      id: opponentInfo.id,
      name: opponentInfo.name,
      avatar: opponentInfo.avatar || defaultAvatar,
      piecePosition: -1,
      isUser: false,
      persona: opponentInfo.persona,
    };
    if (Math.random() > 0.5) {
      ludoGameState.players = [userPlayer, charPlayer];
    } else {
      ludoGameState.players = [charPlayer, userPlayer];
    }
    ludoGameState.currentTurnIndex = 0;
    generateLudoBoard();
    showScreen('ludo-game-screen');
    renderLudoGameScreen();
    logToLudoGame('游戏开始！掷出6点即可起飞。', 'system');
    await sleep(1000);
    await processLudoTurn();
  }
  // ▼▼▼ 【全新】这是飞行棋的重roll功能核心函数 ▼▼▼
  /**
   * 【飞行棋】处理AI发言的重roll请求
   * @param {number} logIndex - 要重roll的发言在gameLog中的索引
   */
  async function handleLudoReroll(logIndex) {
    const logEntry = ludoGameState.gameLog[logIndex];
    if (!logEntry || logEntry.type !== 'char') return;

    // 提取原始发言内容
    const originalSpeech = logEntry.message.replace(/<strong>.*?<\/strong>:\s*/, '');

    // 重新调用AI，让它换个说法
    const newSpeech = await triggerLudoAiAction('reroll_comment', { originalSpeech: originalSpeech });

    // 更新日志并重新渲染
    ludoGameState.gameLog[logIndex].message = `<strong>${ludoGameState.opponent.name}:</strong> ${newSpeech}`;
    renderLudoGameScreen();
  }
  // ▲▲▲ 新增函数结束 ▲▲▲

  // ▼▼▼ 【飞行棋】用这块【已添加重roll按钮】的代码，完整替换旧的 renderLudoGameScreen 函数 ▼▼▼
  function renderLudoGameScreen(options = {}) {
    if (!ludoGameState.isActive) return;

    const userPieceEl = document.getElementById('ludo-user-piece');
    const charPieceEl = document.getElementById('ludo-char-piece');
    if (!userPieceEl || !charPieceEl) return;

    userPieceEl.style.backgroundImage = `url(${ludoGameState.players.find(p => p.isUser).avatar})`;
    charPieceEl.style.backgroundImage = `url(${ludoGameState.players.find(p => !p.isUser).avatar})`;

    ludoGameState.players.forEach(player => {
      const pieceEl = player.isUser ? userPieceEl : charPieceEl;
      const pos = player.piecePosition;

      if (pos === -1) {
        const startCell = document.querySelector('.ludo-cell.start');
        if (startCell) {
          pieceEl.style.left = `${startCell.offsetLeft + (player.isUser ? 0 : 5)}px`;
          pieceEl.style.top = `${startCell.offsetTop + (player.isUser ? 0 : 5)}px`;
        }
      } else if (pos >= LUDO_BOARD_SIZE) {
        const endCell = document.querySelector('.ludo-cell.end');
        if (endCell) {
          pieceEl.style.left = `${endCell.offsetLeft + (player.isUser ? 0 : 5)}px`;
          pieceEl.style.top = `${endCell.offsetTop + (player.isUser ? 0 : 5)}px`;
        }
      } else {
        const cell = document.querySelector(`.ludo-cell[data-index="${pos}"]`);
        if (cell) {
          pieceEl.style.left = `${cell.offsetLeft + (player.isUser ? 0 : 5)}px`;
          pieceEl.style.top = `${cell.offsetTop + (player.isUser ? 0 : 5)}px`;
        }
      }
    });

    const logContainer = document.getElementById('ludo-game-log');
    // ★ 核心修改：在map函数中加入 index 参数
    logContainer.innerHTML = ludoGameState.gameLog
      .map((log, index) => {
        // ★ 核心修改：判断是否为AI发言
        if (log.type === 'char') {
          // ★ 核心修改：为AI发言添加重roll按钮
          return `
                <div class="log-entry char">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span>${log.message.replace(/\n/g, '<br>')}</span>
                        <button class="ludo-reroll-btn" data-log-index="${index}" title="让Ta换个说法" style="background:none; border:none; cursor:pointer; padding:0 5px; color:var(--text-secondary);">
                           <svg class="reroll-btn-icon" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                        </button>
                    </div>
                </div>
            `;
        }
        // 其他类型的日志保持原样
        return `<div class="log-entry ${log.type}">${log.message.replace(/\n/g, '<br>')}</div>`;
      })
      .join('');
    logContainer.scrollTop = logContainer.scrollHeight;
  }
  // ▲▲▲ 替换结束 ▲▲▲

  /**
   * 【全新】飞行棋专用的用户输入函数
   * @param {string} promptText - 提示文字 (虽然我们没用上，但保留接口)
   * @param {string} placeholder - 输入框的占位文字
   * @returns {Promise<string>} - 返回用户的输入内容
   */
  function waitForLudoUserAction(promptText, placeholder) {
    return new Promise(resolve => {
      const actionArea = document.getElementById('ludo-action-area');
      actionArea.innerHTML = ''; // 清空旧内容（比如骰子）
      actionArea.classList.add('speaking-mode'); // 复用剧本杀的发言样式

      const textarea = document.createElement('textarea');
      textarea.id = 'ludo-user-speech-input'; // 使用新ID，避免冲突
      textarea.rows = 1;
      textarea.placeholder = placeholder || '请输入你的回答...';

      // 实时调整高度
      textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
      });

      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'form-button'; // 使用通用按钮样式
      confirmBtn.textContent = '确认回答';

      actionArea.appendChild(textarea);
      actionArea.appendChild(confirmBtn);
      textarea.focus();

      confirmBtn.onclick = () => {
        const answer = textarea.value.trim() || '...（跳过）';
        actionArea.innerHTML = ''; // 清空输入框和按钮
        actionArea.classList.remove('speaking-mode');
        resolve(answer);
      };
    });
  }
  // ▲▲▲ 新代码粘贴结束 ▲▲▲

  // ▼▼▼ 用这块【V2 - 支持新问题类型】的代码，完整替换你旧的 handleLudoQuestionEvent 函数 ▼▼▼
  async function handleLudoQuestionEvent(player) {
    // 1. 根据游戏状态获取问题库
    const questionBankId = ludoGameState.activeQuestionBankId;
    let questions = [];
    if (questionBankId) {
      questions = await db.ludoQuestions.where('bankId').equals(questionBankId).toArray();
    }

    // 2. 如果题库是空的，提示并直接进入下一回合
    if (questions.length === 0) {
      logToLudoGame('当前题库是空的，跳过本轮问答。', 'system');
      await sleep(1500);
      await advanceTurn(); // 别忘了切换回合
      return;
    }

    // 3. 随机抽一个问题
    const questionObj = getRandomItem(questions);
    const questionText = questionObj.text;

    // 4. 【核心】弹出模式选择框，让用户决定怎么玩
    const mode = await showAnswerModeSelector(questionText);
    if (!mode) {
      logToLudoGame('玩家取消了答题，游戏继续。', 'system');
      await advanceTurn(); // 取消也要切换回合
      return;
    }

    // 5. 根据选择的模式，执行不同的流程
    logToLudoGame(
      `【${mode === 'both_answer' ? '共同回答' : '一人回答，一人评价'}】抽到的问题是：“${questionText}”`,
      'system',
    );
    await sleep(1500);

    const currentPlayer = player;
    const otherPlayer = ludoGameState.players.find(p => p.id !== currentPlayer.id);

    // --- 流程分支 ---
    if (mode === 'both_answer') {
      logToLudoGame(`请 <strong>${currentPlayer.name}</strong> 先回答。`, 'system');
      let answer1 = currentPlayer.isUser
        ? await waitForLudoUserAction('轮到你回答问题', '请输入你的回答...')
        : await triggerLudoAiAction('answer_question', { question: questionText });
      logToLudoGame(`<strong>${currentPlayer.name}:</strong> ${answer1}`, currentPlayer.isUser ? 'user' : 'char');
      await sleep(2000);

      logToLudoGame(`现在请 <strong>${otherPlayer.name}</strong> 回答。`, 'system');
      let answer2 = otherPlayer.isUser
        ? await waitForLudoUserAction('轮到你回答问题', '请输入你的回答...')
        : await triggerLudoAiAction('answer_question', { question: questionText });
      logToLudoGame(`<strong>${otherPlayer.name}:</strong> ${answer2}`, otherPlayer.isUser ? 'user' : 'char');
    } else if (mode === 'single_answer') {
      logToLudoGame(`请 <strong>${currentPlayer.name}</strong> 先回答。`, 'system');
      let answer = currentPlayer.isUser
        ? await waitForLudoUserAction('轮到你回答问题', '请输入你的回答...')
        : await triggerLudoAiAction('answer_question', { question: questionText });
      logToLudoGame(`<strong>${currentPlayer.name}:</strong> ${answer}`, currentPlayer.isUser ? 'user' : 'char');
      await sleep(2000);

      logToLudoGame(`现在请 <strong>${otherPlayer.name}</strong> 对Ta的回答发表一下看法吧。`, 'system');
      let evaluation = otherPlayer.isUser
        ? await waitForLudoUserAction(`对“${answer}”的看法`, '请输入你的评价...')
        : await triggerLudoAiAction('evaluate_answer', { question: questionText, answer: answer });
      logToLudoGame(`<strong>${otherPlayer.name}:</strong> ${evaluation}`, otherPlayer.isUser ? 'user' : 'char');
    }

    // 6. 问答流程结束后，提示并切换到下一回合
    await sleep(1500);
    logToLudoGame('本轮问答结束，游戏继续！', 'system');
    await advanceTurn();
  }
  // ▲▲▲ 替换结束 ▲▲▲

  /**
   * 【飞行棋】添加一条游戏日志
   */
  function logToLudoGame(message, type) {
    ludoGameState.gameLog.push({ message, type });
    renderLudoGameScreen();
  }
  // ▼▼▼ 在这里粘贴下面的新函数 ▼▼▼
  /**
   * 【全新】一个带“魔法”的掷骰子函数
   * @param {object} player - 正在掷骰子的玩家对象
   * @returns {number} - 最终的骰子点数
   */
  function rollTheDice(player) {
    // 如果玩家还在起点（没有起飞）
    if (player.piecePosition === -1) {
      // 就有50%的超高概率直接掷出6！
      if (Math.random() < 0.5) {
        return 6;
      }
      // 另外50%的概率，随机掷出1-5
      return Math.floor(Math.random() * 5) + 1;
    }
    // 如果已经起飞了，就恢复正常的公平骰子
    return Math.floor(Math.random() * 6) + 1;
  }
  // ▲▲▲ 新函数粘贴结束 ▲▲▲

  /**
   * 【飞行棋】游戏主循环
   */
  async function processLudoTurn() {
    if (!ludoGameState.isActive) return;

    const currentPlayer = ludoGameState.players[ludoGameState.currentTurnIndex];
    logToLudoGame(`轮到 <strong>${currentPlayer.name}</strong> 行动了。`, 'system');

    if (currentPlayer.isUser) {
      // 用户回合
      const actionArea = document.getElementById('ludo-action-area');
      actionArea.innerHTML = `
            <div id="ludo-dice-container" title="点击掷骰子">
                <div class="dice">
                    <div class="face front">1</div><div class="face back">6</div>
                    <div class="face right">3</div><div class="face left">4</div>
                    <div class="face top">2</div><div class="face bottom">5</div>
                </div>
            </div>
        `;
      document.getElementById('ludo-dice-container').onclick = handleUserRollDice;
    } else {
      // AI回合
      document.getElementById('ludo-action-area').innerHTML = `<p>${currentPlayer.name} 正在思考...</p>`;
      await sleep(2000);
      const diceRoll = rollTheDice(currentPlayer);
      await handlePlayerMove(currentPlayer, diceRoll, false);
    }
  }

  /**
   * 【飞行棋】处理用户掷骰子
   */
  async function handleUserRollDice() {
    if (ludoGameState.isDiceRolling) return;
    ludoGameState.isDiceRolling = true;

    const diceEl = document.querySelector('.dice');
    diceEl.classList.add('rolling');
    document.getElementById('ludo-dice-container').onclick = null; // 防止重复点击

    const userPlayer = ludoGameState.players.find(p => p.isUser); // 先找到用户玩家对象
    const diceRoll = rollTheDice(userPlayer); // 调用新函数

    setTimeout(async () => {
      diceEl.classList.remove('rolling');
      // 根据点数旋转到对应面 (这是一个简化的视觉效果)
      const rotations = {
        1: 'rotateY(0deg)',
        2: 'rotateX(-90deg)',
        3: 'rotateY(-90deg)',
        4: 'rotateY(90deg)',
        5: 'rotateX(90deg)',
        6: 'rotateY(180deg)',
      };
      diceEl.style.transform = rotations[diceRoll];

      const userPlayer = ludoGameState.players.find(p => p.isUser);
      await handlePlayerMove(userPlayer, diceRoll, true);

      ludoGameState.isDiceRolling = false;
    }, 1500);
  }

  // ▼▼▼ 用这块【已修复】的代码，完整替换你旧的 handlePlayerMove 函数 ▼▼▼
  async function handlePlayerMove(player, diceRoll, isUserMove) {
    logToLudoGame(
      `<strong>${player.name}</strong> 掷出了 <strong>${diceRoll}</strong> 点！`,
      isUserMove ? 'user' : 'char',
    );

    if (player.piecePosition === -1) {
      // 如果棋子还在起点
      if (diceRoll === 6) {
        player.piecePosition = 0; // 起飞到第0格
        logToLudoGame(`<strong>${player.name}</strong> 的棋子起飞了！`, 'system');
        renderLudoGameScreen();

        if (!isUserMove) {
          await triggerLudoAiAction('roll_6');
        }
        logToLudoGame(`掷出6点，<strong>${player.name}</strong> 再行动一次。`, 'system');
        await sleep(1000);
        await processLudoTurn(); // 重新执行当前玩家的回合
      } else {
        logToLudoGame('点数不是6，无法起飞。', 'system');
        await advanceTurn(); // 切换到下一位玩家
      }
      return; // 结束本次移动处理
    }

    // --- ▼▼▼ 核心修复从这里开始 ▼▼▼ ---

    const newPosition = player.piecePosition + diceRoll;
    const finalPositionIndex = LUDO_BOARD_SIZE - 1; // 终点格子的索引

    // 1. 【核心修改】只要新位置大于或等于终点，就直接判定胜利！
    if (newPosition >= finalPositionIndex) {
      player.piecePosition = finalPositionIndex; // 无论掷出几点，都让棋子停在终点格子上
      renderLudoGameScreen();
      logToLudoGame(`🎉 <strong>${player.name}</strong> 到达了终点！`, 'system');
      await triggerLudoAiAction(isUserMove ? 'user_win' : 'char_win');
      ludoGameState.isActive = false;
      document.getElementById('ludo-action-area').innerHTML = '';
      await sleep(1000);
      showLudoSummary(player.name); // 显示结算界面
      return; // 游戏结束，直接返回
    }
    // 2. 如果不是胜利，就正常移动
    else {
      player.piecePosition = newPosition;
    }

    // --- ▲▲▲ 核心修复到这里结束 ▲▲▲ ---

    renderLudoGameScreen();
    await sleep(500);

    // 检查是否踩到对方棋子
    const opponent = ludoGameState.players.find(p => p.id !== player.id);
    if (player.piecePosition === opponent.piecePosition && opponent.piecePosition !== -1) {
      opponent.piecePosition = -1; // 将对方棋子送回起点
      logToLudoGame(`💥 <strong>${player.name}</strong> 踩中了 <strong>${opponent.name}</strong>！`, 'system');
      renderLudoGameScreen();
      await triggerLudoAiAction(isUserMove ? 'kick_char' : 'kick_user');
      await sleep(1000);
    }

    // ▼▼▼ 请用这块【新代码】替换旧的“检查是否踩到事件格子”的 if 语句块 ▼▼▼

    // 检查是否踩到事件格子
    const cellIndex = ludoGameState.boardLayout.findIndex(c => c && c.index === player.piecePosition);
    if (cellIndex > -1 && ludoGameState.boardLayout[cellIndex].event) {
      const cellData = ludoGameState.boardLayout[cellIndex];
      const eventType = cellData.event;
      if (eventType === 'question') {
        // 【核心修改】将格子上的问题对象，直接传给处理函数
        await handleLudoQuestionEvent(player, cellData.question);
        return;
      }
    }
    // ▲▲▲ 替换结束 ▲▲▲

    // 如果掷出6点，再行动一次
    if (diceRoll === 6) {
      if (!isUserMove) {
        await triggerLudoAiAction('roll_6');
      }
      logToLudoGame(`掷出6点，<strong>${player.name}</strong> 再行动一次。`, 'system');
      await sleep(1000);
      await processLudoTurn();
    } else {
      await advanceTurn(); // 否则切换到下一位玩家
    }
  }
  // ▲▲▲ 替换结束 ▲▲▲

  /**
   * 【飞行棋】推进到下一个回合
   */
  async function advanceTurn() {
    ludoGameState.currentTurnIndex = (ludoGameState.currentTurnIndex + 1) % ludoGameState.players.length;
    await processLudoTurn();
  }

  // ▼▼▼ 用这块【优化后】的代码，完整替换你旧的 triggerLudoAiAction 函数 ▼▼▼
  async function triggerLudoAiAction(eventType, context = {}) {
    const aiPlayer = ludoGameState.players.find(p => !p.isUser);
    const userPlayer = ludoGameState.players.find(p => p.isUser);

    const eventPrompts = {
      roll_6: '你掷出了6点，可以再行动一次！',
      kick_char: '你刚刚把我踢回了起点！',
      kick_user: '我刚刚把你的棋子踢回了起点！',
      char_win: '我赢得了这场游戏！',
      user_win: '你赢得了这场游戏！',
    };

    let eventPrompt = eventPrompts[eventType] || '请根据当前情况自由发挥。';

    // --- ▼▼▼ 核心修改1：为不同的问答场景提供更详细的指令 ▼▼▼ ---
    if (eventType === 'answer_question') {
      eventPrompt = `现在请根据你的人设，详细回答这个问题：“${context.question}”`;
    } else if (eventType === 'evaluate_answer') {
      eventPrompt = `对于问题“${context.question}”，对方的回答是：“${context.answer}”。现在请你以你的角色身份，对这个回答详细地发表一下看法或感受。`;
    }
    // ★★★ 在这里粘贴下面的新代码 ★★★
    else if (eventType === 'reroll_comment') {
      eventPrompt = `你之前说了：“${context.originalSpeech}”。请换一种说法，但表达类似的情绪或意思。`;
    }
    // ★★★ 粘贴结束 ★★★
    const systemPrompt = `
**【LANGUAGE RULE - HIGHEST PRIORITY】: You MUST reply in Vietnamese (Tiếng Việt) for ALL messages. Never use Chinese or any other language.**

# 角色扮演指令
你正在和你的伴侣(${userPlayer.name})玩一场心动的线上飞行棋游戏。
你的名字是"${aiPlayer.name}"，你的人设是：${aiPlayer.persona}
你的回复必须完全符合你的人设，自然地表达你的情绪。

# 游戏当前状态
- 你的棋子位置: ${aiPlayer.piecePosition}
- 对方的棋子位置: ${userPlayer.piecePosition}
- 当前回合: 轮到 ${ludoGameState.players[ludoGameState.currentTurnIndex].name}

# 刚刚发生的事件
${eventPrompt}

# 你的任务
根据以上所有信息，生成一段符合你人设的回应。你的回应可以包含动作、心理活动和对话，让互动更生动，要非常的贴合你的人设，以人设为主。

# 输出格式
你的回复【必须且只能】是一个严格的JSON对象，格式如下:
{"speech": "你的回应..."}
`;

    try {
      const { proxyUrl, apiKey, model } = state.apiConfig;
      let isGemini = proxyUrl === GEMINI_API_URL;
      let messagesForApi = [{ role: 'user', content: systemPrompt }];
      let geminiConfig = toGeminiRequestData(
        model,
        apiKey,
        systemPrompt,
        messagesForApi,
        isGemini,
        state.apiConfig.temperature,
      );

      const response = isGemini
        ? await fetch(geminiConfig.url, geminiConfig.data)
        : await fetch(`${proxyUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              temperature: parseFloat(state.apiConfig.temperature) || 0.8,
              response_format: { type: 'json_object' },
            }),
          });

      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      const content = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).replace(
        /^```json\s*|```$/g,
        '',
      );
      const aiResponse = JSON.parse(content);
      // ★★★ 在这里粘贴下面的新代码 ★★★
      // 如果是重roll请求，直接返回新的发言内容
      if (eventType === 'reroll_comment') {
        return aiResponse.speech || '嗯...好吧。';
      }
      // ★★★ 粘贴结束 ★★★
      if (eventType === 'answer_question' || eventType === 'evaluate_answer') {
        return aiResponse.speech || '嗯...让我想想。';
      }

      if (aiResponse.speech) {
        logToLudoGame(`<strong>${aiPlayer.name}:</strong> ${aiResponse.speech}`, 'char');
      }
    } catch (error) {
      console.error('飞行棋AI响应失败:', error);
      if (eventType === 'answer_question' || eventType === 'evaluate_answer') {
        return '我...我不知道该怎么回答了。';
      }
    }
  }
  // ▲▲▲ 替换结束 ▲▲▲

  // ▼▼▼ 【最终智能版 | 问题数量精确匹配】用这块代码，完整替换你旧的 generateLudoBoard 函数 ▼▼▼
  /**
   * 【飞行棋】生成棋盘格子 (V4 - 问题数量精确匹配版)
   */
  async function generateLudoBoard() {
    const boardEl = document.getElementById('ludo-board');
    boardEl.innerHTML = '';
    const pathCoordinates = [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
      [5, 0],
      [6, 0],
      [7, 0],
      [8, 0],
      [9, 0],
      [9, 1],
      [9, 2],
      [8, 2],
      [7, 2],
      [6, 2],
      [5, 2],
      [4, 2],
      [3, 2],
      [2, 2],
      [1, 2],
      [0, 2],
      [0, 3],
      [0, 4],
      [1, 4],
      [2, 4],
      [3, 4],
      [4, 4],
      [5, 4],
      [6, 4],
      [7, 4],
      [8, 4],
      [9, 4],
      [9, 5],
      [8, 5],
      [7, 5],
      [6, 5],
      [5, 5],
      [4, 5],
      [3, 5],
      [2, 5],
      [1, 5],
      [0, 5],
    ];

    let cells = Array(60).fill(null);
    pathCoordinates.slice(0, LUDO_BOARD_SIZE).forEach((coord, i) => {
      const pos = coord[1] * 10 + coord[0];
      cells[pos] = { type: 'path', index: i };
    });

    cells[21] = { type: 'start', index: -1 };
    cells[38] = { type: 'end', index: LUDO_BOARD_SIZE };

    // --- ▼▼▼ 这就是本次的【核心修改】 ▼▼▼ ---

    // 1. 获取当前游戏选择的问题库ID
    const questionBankId = ludoGameState.activeQuestionBankId;
    let questionsInBank = [];

    // 2. 从数据库中加载该问题库的所有问题
    if (questionBankId) {
      questionsInBank = await db.ludoQuestions.where('bankId').equals(questionBankId).toArray();
    }

    // ▼▼▼ 请用这块【全新的代码】替换掉函数中从 “// 4. 筛选出所有可以放置问题的普通格子...” 开始的那一大段逻辑 ▼▼▼

    // 4. 筛选出所有可以放置问题的普通格子
    const availableCellIndices = [];
    cells.forEach((cellData, index) => {
      if (cellData && cellData.type === 'path' && cellData.index > 0) {
        availableCellIndices.push(index);
      }
    });

    // 5. 【核心修改】我们不再打乱问题库，而是打乱可用的格子索引！
    availableCellIndices.sort(() => Math.random() - 0.5);

    // 6. 确定要放置的问题数量，仍然是取问题数和可用格子数的最小值
    const questionCount = Math.min(questionsInBank.length, availableCellIndices.length);

    if (questionsInBank.length > availableCellIndices.length) {
      console.warn(
        `飞行棋警告：问题库中的问题数量(${questionsInBank.length})超过了棋盘上的可用格子数量(${availableCellIndices.length})，部分问题将不会出现。`,
      );
    }

    // 7. 将问题库里的问题，按顺序放置到【被打乱顺序】的格子里
    for (let i = 0; i < questionCount; i++) {
      // 这次我们是从被打乱的格子列表里取出一个随机的格子
      const cellIndexToModify = availableCellIndices[i];
      // 然后按顺序从问题库里拿一个问题放上去
      const questionToPlace = questionsInBank[i];

      if (cells[cellIndexToModify]) {
        cells[cellIndexToModify].event = 'question';
        cells[cellIndexToModify].question = questionToPlace;
      }
    }
    // ▲▲▲ 替换结束 ▲▲▲

    ludoGameState.boardLayout = cells;

    // 后续的渲染逻辑保持不变...
    cells.forEach((cellData, i) => {
      if (cellData) {
        const cellEl = document.createElement('div');
        cellEl.className = 'ludo-cell';

        if (cellData.type === 'path') {
          cellEl.dataset.index = cellData.index;
          cellEl.innerHTML = `<span class="cell-number">${cellData.index + 1}</span>`;
        }
        if (cellData.type === 'start') {
          cellEl.classList.add('start');
          cellEl.innerHTML = '🏠';
        }
        if (cellData.type === 'end') {
          cellEl.classList.add('end');
          cellEl.innerHTML = '🏁';
        }
        if (cellData.event === 'question') {
          cellEl.classList.add(`event-truth`);
          cellEl.innerHTML += '❓';
        }

        const position = ludoGameState.boardLayout.indexOf(cellData);
        const row = Math.floor(position / 10);
        const col = position % 10;
        cellEl.style.gridRowStart = row + 1;
        cellEl.style.gridColumnStart = col + 1;

        boardEl.appendChild(cellEl);
      }
    });
  }
  // ▲▲▲ 替换结束 ▲▲▲

  // ▼▼▼ 把这一整块全新的功能函数，粘贴到 init() 函数的【正上方】 ▼▼▼

  // ▼▼▼ 用这整块新代码，替换掉所有旧的飞行棋问题库核心函数 ▼▼▼

  /* --- 【全新 | V2分类版】飞行棋问题库功能核心函数 --- */

  let activeQuestionBankId = null; // 用于追踪正在编辑的问题库ID
  let editingQuestionId = null; // 用于追踪正在编辑的问题ID
  function hideCustomModal() {
    modalOverlay.classList.remove('visible');
    modalConfirmBtn.classList.remove('btn-danger');
    if (modalResolve) modalResolve(null);
  }
  // ▼▼▼ 用这块【已修复】的代码，完整替换你旧的 migrateDefaultLudoQuestions 函数 ▼▼▼
  /**
   * 【数据迁移】在首次加载时，将旧的硬编码问题迁移到数据库
   */
  async function migrateDefaultLudoQuestions() {
    const defaultBankName = '默认题库';
    const existingBank = await db.ludoQuestionBanks.where('name').equals(defaultBankName).first();
    // 如果“默认题库”已经存在，就说明迁移过了，直接返回
    if (existingBank) return;

    console.log('正在迁移飞行棋默认问题到数据库...');

    // 创建默认题库
    const bankId = await db.ludoQuestionBanks.add({ name: defaultBankName });

    // ★★★ 核心修改：将问题库改为对象数组，并为每个问题添加类型 ★★★
    const defaultQuestions = [
      // --- 类型1: 共同回答 (双方都需要回答) ---
      { type: 'both_answer', text: '如果我们一起去旅行，你最想去哪里，为什么？' },
      { type: 'both_answer', text: '你认为一段完美的关系中，最不可或缺的三个要素是什么？' },
      { type: 'both_answer', text: '分享一件最近因为我而让你感到心动或开心的小事。' },
      { type: 'both_answer', text: '回忆一下，我们第一次见面时，你对我的第一印象是什么？' },
      { type: 'both_answer', text: '如果我们可以一起学习一项新技能，你希望是什么？' },
      { type: 'both_answer', text: '描述一个你最希望和我一起度过的完美周末。' },
      { type: 'both_answer', text: '你觉得我们之间最有默契的一件事是什么？' },
      { type: 'both_answer', text: '如果用一种动物来形容我，你觉得是什么？为什么？' },
      { type: 'both_answer', text: '在未来的一年里，你最想和我一起完成的一件事是什么？' },
      { type: 'both_answer', text: '分享一部你最近很喜欢、并且想推荐给我一起看的电影或剧。' },
      { type: 'both_answer', text: '我们下次约会，你希望穿什么风格的衣服？' },

      // --- 类型2: 一人回答，对方评价 ---
      { type: 'single_answer', text: '描述一下我最让你心动的一个瞬间。' },
      { type: 'single_answer', text: '诚实地说，我做的哪件事曾经让你偷偷生过气？' },
      { type: 'single_answer', text: '如果我有一种超能力，你希望是什么？' },
      { type: 'single_answer', text: '给我三个最贴切的标签。' },
      { type: 'single_answer', text: '在你心里，我的形象和你的理想型有多接近？' },
      { type: 'single_answer', text: '分享一个你觉得我可能不知道的，关于你的小秘密。' },
      { type: 'single_answer', text: '如果我们的故事是一首歌，你觉得歌名应该叫什么？' },
      { type: 'single_answer', text: '说一件你觉得我做得比你好/更擅长的事情。' },
      { type: 'single_answer', text: '如果可以回到我们认识的任意一天，你会选择哪一天，想做什么？' },
      { type: 'single_answer', text: '用三个词来形容你眼中的我们的关系。' },
    ];

    const questionsToAdd = defaultQuestions.map(q => ({
      bankId: bankId,
      text: q.text,
      type: q.type, // <-- 关键修复：把类型也存进去！
    }));

    await db.ludoQuestions.bulkAdd(questionsToAdd);
    console.log(`成功迁移了 ${questionsToAdd.length} 条默认问题。`);
  }
  // ▲▲▲ 替换结束 ▲▲▲

  /**
   * 打开问题库管理弹窗
   */
  async function openLudoQuestionBankManager() {
    await renderLudoQuestionBanks();
    document.getElementById('ludo-qbank-manager-modal').classList.add('visible');
  }

  /**
   * 渲染问题库列表
   */
  async function renderLudoQuestionBanks() {
    const listEl = document.getElementById('ludo-qbank-list');
    listEl.innerHTML = '';
    const banks = await db.ludoQuestionBanks.toArray();

    if (banks.length === 0) {
      listEl.innerHTML =
        '<p style="text-align:center; color: var(--text-secondary); padding: 50px 0;">还没有问题库，点击右上角“新建”创建一个吧！</p>';
    } else {
      banks.forEach(bank => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `<div class="item-title">${bank.name}</div>`;
        item.addEventListener('click', () => openLudoQuestionEditor(bank.id, bank.name));
        addLongPressListener(item, async () => {
          // ▼▼▼ 核心修改在这里：在菜单里增加一个 'export' 选项 ▼▼▼
          const choice = await showChoiceModal(`操作“${bank.name}”`, [
            { text: '✏️ 重命名', value: 'rename' },
            { text: '📤 导出', value: 'export' }, // <-- 新增的导出选项
            { text: '🗑️ 删除', value: 'delete', isDanger: true },
          ]);

          if (choice === 'rename') {
            const newName = await showCustomPrompt('重命名问题库', '请输入新的名称：', bank.name);
            if (newName && newName.trim()) {
              await db.ludoQuestionBanks.update(bank.id, { name: newName.trim() });
              await renderLudoQuestionBanks();
            }
          } else if (choice === 'export') {
            // ▼▼▼ 在这里调用我们新写的导出函数 ▼▼▼
            await exportLudoQuestionBank(bank.id);
          } else if (choice === 'delete') {
            const confirmed = await showCustomConfirm(
              '确认删除',
              `确定要删除问题库“${bank.name}”吗？这将同时删除库内所有问题。`,
              { confirmButtonClass: 'btn-danger' },
            );
            if (confirmed) {
              await db.transaction('rw', db.ludoQuestionBanks, db.ludoQuestions, async () => {
                await db.ludoQuestions.where('bankId').equals(bank.id).delete();
                await db.ludoQuestionBanks.delete(bank.id);
              });
              await renderLudoQuestionBanks();
            }
          }
        });
        listEl.appendChild(item);
      });
    }
  }

  /**
   * 添加一个新的问题库
   */
  async function addNewLudoQuestionBank() {
    const name = await showCustomPrompt('新建问题库', '请输入问题库的名称：');
    if (name && name.trim()) {
      await db.ludoQuestionBanks.add({ name: name.trim() });
      await renderLudoQuestionBanks();
    }
  }

  /**
   * 打开指定问题库的问题编辑器
   */
  async function openLudoQuestionEditor(bankId, bankName) {
    activeQuestionBankId = bankId;
    document.getElementById('ludo-question-editor-title').textContent = `编辑 - ${bankName}`;
    await renderLudoQuestionsInBank(bankId);
    document.getElementById('ludo-question-editor-modal').classList.add('visible');
  }

  /**
   * 渲染一个问题库中的所有问题
   */
  async function renderLudoQuestionsInBank(bankId) {
    const listEl = document.getElementById('ludo-question-list');
    listEl.innerHTML = '';
    const questions = await db.ludoQuestions.where('bankId').equals(bankId).toArray();

    if (questions.length === 0) {
      listEl.innerHTML =
        '<p style="text-align:center; color: var(--text-secondary); padding: 50px 0;">这个题库还是空的，点击右上角“+”添加第一个问题吧！</p>';
    } else {
      questions.forEach(q => {
        const item = document.createElement('div');
        item.className = 'list-item';

        // ★★★ 核心修改：根据问题类型添加标签 ★★★
        const typeText = q.type === 'single_answer' ? '一人回答' : '共同回答';
        const typeClass = q.type === 'single_answer' ? 'single-answer' : 'both-answer';

        item.innerHTML = `
                <div class="item-title" style="white-space: normal; display: flex; align-items: center;">
                    <span>${q.text}</span>
                    <span class="question-type-tag ${typeClass}">${typeText}</span>
                </div>
            `;

        item.addEventListener('click', () => openSingleQuestionEditor(q.id));
        addLongPressListener(item, async () => {
          const confirmed = await showCustomConfirm('删除问题', '确定要删除这个问题吗？', {
            confirmButtonClass: 'btn-danger',
          });
          if (confirmed) {
            await db.ludoQuestions.delete(q.id);
            await renderLudoQuestionsInBank(bankId);
          }
        });
        listEl.appendChild(item);
      });
    }
  }

  /**
   * 打开单个问题编辑器（用于新建或编辑）
   */
  async function openSingleQuestionEditor(questionId = null) {
    editingQuestionId = questionId;
    const modal = document.getElementById('ludo-single-question-editor-modal');
    const titleEl = document.getElementById('ludo-single-question-title');
    const textInput = document.getElementById('ludo-question-text-input');
    const typeRadios = document.querySelectorAll('input[name="ludo_question_type"]');

    if (questionId) {
      // 编辑模式
      const question = await db.ludoQuestions.get(questionId);
      if (!question) return;
      titleEl.textContent = '编辑问题';
      textInput.value = question.text;
      typeRadios.forEach(radio => (radio.checked = radio.value === (question.type || 'both_answer')));
    } else {
      // 新建模式
      titleEl.textContent = '添加新问题';
      textInput.value = '';
      typeRadios[0].checked = true; // 默认选中“共同回答”
    }

    modal.classList.add('visible');
  }

  /**
   * 保存单个问题（新建或更新）
   */
  async function saveSingleQuestion() {
    const text = document.getElementById('ludo-question-text-input').value.trim();
    if (!text) {
      alert('问题内容不能为空！');
      return;
    }
    const type = document.querySelector('input[name="ludo_question_type"]:checked').value;

    if (editingQuestionId) {
      // 更新
      await db.ludoQuestions.update(editingQuestionId, { text, type });
    } else {
      // 新建
      await db.ludoQuestions.add({ bankId: activeQuestionBankId, text, type });
    }

    document.getElementById('ludo-single-question-editor-modal').classList.remove('visible');
    await renderLudoQuestionsInBank(activeQuestionBankId); // 刷新列表
    editingQuestionId = null;
  }

  // ▼▼▼ 请用这块【全新的函数】完整替换旧的 handleLudoQuestionEvent 函数 ▼▼▼

  /**
   * 【飞行棋】处理踩中问题格子的事件 (V3 - 直接使用传入的问题)
   */
  async function handleLudoQuestionEvent(player, questionObj) {
    // 1. 安全检查：如果因为某种原因没有拿到问题，就跳过
    if (!questionObj || !questionObj.text) {
      logToLudoGame('未找到问题，跳过本轮问答。', 'system');
      await sleep(1500);
      await advanceTurn();
      return;
    }

    // 2. 直接使用传入的问题对象，不再随机抽取
    const questionText = questionObj.text;
    const mode = questionObj.type || 'both_answer'; // 直接从问题对象获取模式

    logToLudoGame(
      `【${mode === 'both_answer' ? '共同回答' : '一人回答，一人评价'}】抽到的问题是：“${questionText}”`,
      'system',
    );
    await sleep(1500);

    const currentPlayer = player;
    const otherPlayer = ludoGameState.players.find(p => p.id !== currentPlayer.id);

    // --- 流程分支 (这部分逻辑保持不变) ---
    if (mode === 'both_answer') {
      logToLudoGame(`请 <strong>${currentPlayer.name}</strong> 先回答。`, 'system');
      let answer1 = currentPlayer.isUser
        ? await waitForLudoUserAction('轮到你回答问题', '请输入你的回答...')
        : await triggerLudoAiAction('answer_question', { question: questionText });
      logToLudoGame(`<strong>${currentPlayer.name}:</strong> ${answer1}`, currentPlayer.isUser ? 'user' : 'char');
      await sleep(2000);

      logToLudoGame(`现在请 <strong>${otherPlayer.name}</strong> 回答。`, 'system');
      let answer2 = otherPlayer.isUser
        ? await waitForLudoUserAction('轮到你回答问题', '请输入你的回答...')
        : await triggerLudoAiAction('answer_question', { question: questionText });
      logToLudoGame(`<strong>${otherPlayer.name}:</strong> ${answer2}`, otherPlayer.isUser ? 'user' : 'char');
    } else if (mode === 'single_answer') {
      logToLudoGame(`请 <strong>${currentPlayer.name}</strong> 回答这个问题。`, 'system');
      let answer = currentPlayer.isUser
        ? await waitForLudoUserAction('轮到你回答问题', '请输入你的回答...')
        : await triggerLudoAiAction('answer_question', { question: questionText });
      logToLudoGame(`<strong>${currentPlayer.name}:</strong> ${answer}`, currentPlayer.isUser ? 'user' : 'char');
      await sleep(2000);

      logToLudoGame(`现在请 <strong>${otherPlayer.name}</strong> 对Ta的回答发表一下看法吧。`, 'system');
      let evaluation = otherPlayer.isUser
        ? await waitForLudoUserAction(`对“${answer}”的看法`, '请输入你的评价...')
        : await triggerLudoAiAction('evaluate_answer', { question: questionText, answer: answer });
      logToLudoGame(`<strong>${otherPlayer.name}:</strong> ${evaluation}`, otherPlayer.isUser ? 'user' : 'char');
    }

    await sleep(1500);
    logToLudoGame('本轮问答结束，游戏继续！', 'system');
    await advanceTurn();
  }
  // ▲▲▲ 替换结束 ▲▲▲

  /**
   * 【全新】显示飞行棋游戏结算卡片
   * @param {string} winnerName - 胜利者的名字
   */
  function showLudoSummary(winnerName) {
    const modal = document.getElementById('ludo-summary-modal');
    const contentEl = document.getElementById('ludo-summary-content');

    // 1. 提取问答记录
    let qaLogHtml = '<h4>心动问答记录</h4>';
    const questionsAndAnswers = [];
    let currentQuestion = null;

    ludoGameState.gameLog.forEach(log => {
      // 通过识读系统日志里的特定文本来找到“问题”
      if (log.type === 'system' && log.message.includes('抽到的问题是')) {
        const questionText = log.message.match(/“(.+?)”/);
        if (questionText && questionText[1]) {
          currentQuestion = { question: questionText[1], answers: [] };
          questionsAndAnswers.push(currentQuestion);
        }
      }
      // 如果我们刚刚找到了一个问题，那么后续的用户或角色发言就是“回答”
      else if (currentQuestion && (log.type === 'user' || log.type === 'char') && !log.message.includes('掷出了')) {
        const answerText = log.message.replace(/<strong>.*?<\/strong>:\s*/, '');
        const speakerNameMatch = log.message.match(/<strong>(.*?)<\/strong>/);
        if (speakerNameMatch && speakerNameMatch[1]) {
          currentQuestion.answers.push({ speaker: speakerNameMatch[1], text: answerText });
        }
      }
    });

    // 2. 将提取出的问答记录格式化为HTML
    if (questionsAndAnswers.length > 0) {
      questionsAndAnswers.forEach((qa, index) => {
        qaLogHtml += `<div class="qa-item">
                <div class="qa-question">Q${index + 1}: ${qa.question}</div>`;
        qa.answers.forEach(ans => {
          qaLogHtml += `<div class="qa-answer"><strong>${ans.speaker}:</strong> ${ans.text}</div>`;
        });
        qaLogHtml += `</div>`;
      });
    } else {
      qaLogHtml += '<p>本局没有触发任何问答。</p>';
    }

    // 3. 拼接完整的结算卡片内容
    contentEl.innerHTML = `
        <h3>🎉 恭喜 ${winnerName} 获胜！ 🎉</h3>
        <div class="ludo-qa-log">${qaLogHtml}</div>
    `;

    // 4. 为按钮绑定事件 (使用克隆节点技巧防止重复绑定)
    const shareBtn = document.getElementById('share-ludo-summary-btn');
    const backBtn = document.getElementById('back-to-hall-from-ludo-btn');

    const newShareBtn = shareBtn.cloneNode(true);
    shareBtn.parentNode.replaceChild(newShareBtn, shareBtn);
    newShareBtn.onclick = () => {
      // 准备纯文本格式的复盘内容用于分享
      const summaryForShare =
        `飞行棋游戏结束啦！🎉\n\n胜利者: ${winnerName}\n\n--- 心动问答 ---\n` +
        questionsAndAnswers
          .map(
            (qa, i) => `Q${i + 1}: ${qa.question}\n` + qa.answers.map(ans => `${ans.speaker}: ${ans.text}`).join('\n'),
          )
          .join('\n\n');

      shareLudoSummary(summaryForShare, winnerName);
    };

    const newBackBtn = backBtn.cloneNode(true);
    backBtn.parentNode.replaceChild(newBackBtn, backBtn);
    newBackBtn.onclick = () => {
      modal.classList.remove('visible');
      showScreen('game-hall-screen');
    };

    // 5. 显示结算弹窗
    modal.classList.add('visible');
  }

  /**
   * 【全新】将飞行棋游戏复盘发送给对手
   * @param {string} summaryText - 要发送的复盘文本
   */
  async function shareLudoSummary(summaryText, winnerName) {
    const opponentId = ludoGameState.opponent?.id;
    if (!opponentId) {
      alert('找不到对手信息，无法分享。');
      return;
    }

    const chat = state.chats[opponentId];
    if (!chat) {
      alert('找不到与对手的聊天窗口，无法分享。');
      return;
    }

    // 创建对用户可见的复盘消息
    const visibleMessage = {
      role: 'user',
      type: 'share_link',
      timestamp: Date.now(),
      title: '心动飞行棋 - 游戏复盘',
      description: '点击查看详细复盘记录',
      source_name: '游戏中心',
      content: summaryText,
    };

    // 创建给AI看的隐藏指令，让它可以就游戏结果发表感想
    const aiContext = `[系统指令：刚刚结束了一局飞行棋。重要：本次游戏的胜利者是【${winnerName}】。这是游戏复盘，请根据这个结果，以你的角色人设，和用户聊聊刚才的游戏。]\n\n${summaryText}`;
    const hiddenInstruction = {
      role: 'system',
      content: aiContext,
      timestamp: Date.now() + 1,
      isHidden: true,
    };

    chat.history.push(visibleMessage, hiddenInstruction);
    await db.chats.put(chat);

    // 关闭结算卡片
    document.getElementById('ludo-summary-modal').classList.remove('visible');

    await showCustomAlert('分享成功', `游戏复盘已发送至与“${chat.name}”的聊天中！`);

    window.openChat(chat.id);
    window.triggerAiResponse();
  }

  // ▲▲▲ 新增代码粘贴结束 ▲▲▲

  // ▼▼▼ 【全新】这是“谁是卧底”游戏的全部核心逻辑代码，请粘贴到 init() 函数前 ▼▼▼

  /**
   * 【卧底】打开游戏设置界面
   */
  async function openUndercoverSetup() {
    showScreen('undercover-setup-screen');
    const selectionEl = document.getElementById('undercover-player-selection');
    selectionEl.innerHTML = '<p>正在加载角色列表...</p>';

    // 复用狼人杀的玩家加载逻辑，非常方便
    const singleChats = Object.values(state.chats).filter(chat => !chat.isGroup);
    const allNpcs = Object.values(state.chats).flatMap(chat =>
      (chat.npcLibrary || []).map(npc => ({ ...npc, owner: chat.name })),
    );
    let playerOptions = [
      ...singleChats.map(c => ({ id: c.id, name: c.name, avatar: c.settings.aiAvatar, type: '角色' })),
      ...allNpcs.map(n => ({ id: n.id, name: n.name, avatar: n.avatar, type: `NPC (${n.owner})` })),
    ];

    selectionEl.innerHTML = '';
    if (playerOptions.length < 2) {
      selectionEl.innerHTML =
        '<p style="text-align:center; padding-top: 50px; color: var(--text-secondary);">你需要至少2位AI或NPC好友才能开始游戏哦。</p>';
      document.getElementById('start-undercover-game-btn').disabled = true;
      return;
    }

    document.getElementById('start-undercover-game-btn').disabled = false;
    playerOptions.forEach(player => {
      const item = document.createElement('div');
      item.className = 'player-selection-item';
      item.innerHTML = `
            <input type="checkbox" class="undercover-player-checkbox" value="${player.id}">
            <img src="${player.avatar || defaultAvatar}" alt="${player.name}">
            <span class="name">${player.name}</span>
            <span class="type-tag">${player.type}</span>
        `;
      selectionEl.appendChild(item);
    });
  }

  /**
   * 【卧底V2】开始游戏的核心逻辑 (支持手动/随机邀请)
   */
  async function startUndercoverGame() {
    const inviteMode = document.querySelector('input[name="undercover_invite_mode"]:checked').value;
    let invitedPlayerInfos = [];
    let totalPlayers = 0;

    // --- 1. 根据邀请模式，收集被邀请的玩家信息 ---
    if (inviteMode === 'manual') {
      const selectedCheckboxes = document.querySelectorAll('.undercover-player-checkbox:checked');
      totalPlayers = selectedCheckboxes.length + 1;
      if (totalPlayers < 3) {
        alert(`游戏最少需要3人！当前手动选择了 ${selectedCheckboxes.length} 人。`);
        return;
      }
      selectedCheckboxes.forEach(checkbox => {
        const playerId = checkbox.value;
        const chat = Object.values(state.chats).find(c => c.id === playerId);
        if (chat) {
          invitedPlayerInfos.push({
            id: chat.id,
            name: chat.name,
            avatar: chat.settings.aiAvatar,
            persona: chat.settings.aiPersona,
            isUser: false,
          });
        } else {
          for (const c of Object.values(state.chats)) {
            const npc = (c.npcLibrary || []).find(n => n.id === playerId);
            if (npc) {
              invitedPlayerInfos.push({
                id: npc.id,
                name: npc.name,
                avatar: npc.avatar,
                persona: npc.persona,
                isUser: false,
              });
              break;
            }
          }
        }
      });
    } else {
      // 'random' mode
      const randomPlayerCount = parseInt(document.getElementById('undercover-random-player-count').value);
      if (isNaN(randomPlayerCount) || randomPlayerCount < 2) {
        alert('随机邀请人数至少为2人！');
        return;
      }
      totalPlayers = randomPlayerCount + 1;

      const singleChats = Object.values(state.chats).filter(chat => !chat.isGroup);
      const allNpcs = Object.values(state.chats).flatMap(chat =>
        (chat.npcLibrary || []).map(npc => ({ ...npc, owner: chat.name })),
      );
      let allAvailablePlayers = [
        ...singleChats.map(c => ({
          id: c.id,
          name: c.name,
          avatar: c.settings.aiAvatar,
          persona: c.settings.aiPersona,
          isUser: false,
        })),
        ...allNpcs.map(n => ({ id: n.id, name: n.name, avatar: n.avatar, persona: n.persona, isUser: false })),
      ];

      if (allAvailablePlayers.length < randomPlayerCount) {
        alert(`可用玩家不足！需要 ${randomPlayerCount} 人，但只有 ${allAvailablePlayers.length} 人可选。`);
        return;
      }

      allAvailablePlayers.sort(() => Math.random() - 0.5); // 洗牌
      invitedPlayerInfos = allAvailablePlayers.slice(0, randomPlayerCount); // 取出需要的人数
    }

    // --- 2. 重置并初始化游戏状态 ---
    undercoverGameState = {
      isActive: true,
      players: [],
      gamePhase: 'reveal_words',
      dayNumber: 1,
      gameLog: [],
      turnIndex: 0,
      votes: {},
      votedOutPlayers: [],
      tiedPlayers: [],
    };

    // --- 3. 让AI生成或从内置词库获取词语 ---
    let wordPair;
    try {
      wordPair = await generateUndercoverWordsAI();
    } catch (e) {
      await showCustomAlert('AI出题失败', '呜，AI今天没灵感了...将使用内置词库为你出题！');
      const BUILT_IN_WORDS = [
        { civilian: '牛奶', undercover: '豆浆' },
        { civilian: '白菜', undercover: '生菜' },
        { civilian: '饺子', undercover: '馄饨' },
        { civilian: '手套', undercover: '袜子' },
        { civilian: '情书', undercover: '遗书' },
      ];
      wordPair = getRandomItem(BUILT_IN_WORDS);
    }
    undercoverGameState.civilianWord = wordPair.civilian;
    undercoverGameState.undercoverWord = wordPair.undercover;

    // --- 4. 添加玩家到游戏状态 ---
    const userPlayer = {
      id: 'user',
      name: state.qzoneSettings.nickname || '我',
      avatar: state.qzoneSettings.avatar || defaultAvatar,
      isAlive: true,
      isUser: true,
    };
    undercoverGameState.players.push(userPlayer);
    invitedPlayerInfos.forEach(pInfo => {
      undercoverGameState.players.push({ ...pInfo, isAlive: true });
    });
    undercoverGameState.players.sort(() => Math.random() - 0.5); // 打乱座位顺序

    // --- 5. 分配角色和词语 ---
    let rolesToAssign = [];
    if (totalPlayers >= 3 && totalPlayers <= 5) {
      rolesToAssign.push('undercover');
    } else if (totalPlayers >= 6 && totalPlayers <= 8) {
      rolesToAssign.push('undercover');
      rolesToAssign.push('whiteboard');
    } else {
      rolesToAssign.push('undercover');
      rolesToAssign.push('undercover');
      rolesToAssign.push('whiteboard');
    }
    while (rolesToAssign.length < totalPlayers) {
      rolesToAssign.push('civilian');
    }
    rolesToAssign.sort(() => Math.random() - 0.5);

    undercoverGameState.players.forEach((player, index) => {
      const role = rolesToAssign[index];
      player.role = role;
      if (role === 'civilian') player.word = undercoverGameState.civilianWord;
      else if (role === 'undercover') player.word = undercoverGameState.undercoverWord;
      else if (role === 'whiteboard') player.word = null;
    });

    // --- 6. 切换到游戏界面并开始 ---
    showScreen('undercover-game-screen');
    await processUndercoverTurn();
  }

  // ▼▼▼ 【最终流程修复版】请用这整块代码，完整替换旧的 processUndercoverTurn 函数 ▼▼▼
  /**
   * 【卧底】游戏主循环/引擎 (V3 - 已修复轮次卡死问题)
   */
  async function processUndercoverTurn() {
    if (!undercoverGameState.isActive) return;

    renderUndercoverGameScreen();

    switch (undercoverGameState.gamePhase) {
      case 'reveal_words': {
        logToUndercoverGame(`游戏开始，第 ${undercoverGameState.dayNumber} 轮。请查看自己的词语。`, 'system');
        const me = undercoverGameState.players.find(p => p.isUser);
        const roleName = { undercover: '卧底', civilian: '平民', whiteboard: '白板' }[me.role] || '未知';
        const wordText = me.word ? `你的词语是：【${me.word}】` : '你是一个白板，需要根据他人描述猜测平民词语。';
        await showCustomAlert(`你的身份是：【${roleName}】`, wordText);

        undercoverGameState.gamePhase = 'description_round';
        await sleep(1000);
        await processUndercoverTurn();
        break;
      }

      case 'description_round': {
        logToUndercoverGame(`第 ${undercoverGameState.dayNumber} 轮发言开始，请依次描述自己的词语。`, 'system');

        const alivePlayers = undercoverGameState.players.filter(p => p.isAlive);
        for (const player of alivePlayers) {
          renderUndercoverGameScreen({ speakingPlayerId: player.id });
          let description;
          if (player.isUser) {
            description = await waitForUserUndercoverAction('轮到你发言', 'speak', {
              placeholder: '请用一句话描述你的词语...',
            });
          } else {
            description = await triggerUndercoverAiAction(player.id, 'describe');
          }
          logToUndercoverGame({ player: player, speech: description }, 'speech');
          await sleep(1000);
        }
        renderUndercoverGameScreen();
        undercoverGameState.gamePhase = 'voting_round';
        await sleep(1000);
        await processUndercoverTurn();
        break;
      }

      case 'voting_round': {
        logToUndercoverGame('描述结束，现在开始投票。', 'system');
        undercoverGameState.votes = {}; // 清空上一轮的票
        const alivePlayers = undercoverGameState.players.filter(p => p.isAlive);
        for (const voter of alivePlayers) {
          let voteResult;
          if (voter.isUser) {
            voteResult = await waitForUserUndercoverAction('请投票', 'vote');
          } else {
            voteResult = await triggerUndercoverAiAction(voter.id, 'vote');
          }

          if (voteResult && voteResult.voteForId) {
            const targetId = voteResult.voteForId;
            const reason = voteResult.reason || '未说明理由';
            const targetPlayer = undercoverGameState.players.find(p => p.id === targetId);

            if (targetPlayer) {
              logToUndercoverGame(
                `<strong>${voter.name}</strong> 投票给了 <strong>${targetPlayer.name}</strong>，理由是：“${reason}”`,
              );
              undercoverGameState.votes[targetId] = (undercoverGameState.votes[targetId] || 0) + 1;
            }
          } else {
            const reason = voteResult ? voteResult.reason || '信息不足，无法判断。' : '信息不足，无法判断。';
            logToUndercoverGame(`<strong>${voter.name}</strong> 弃票了，理由是：“${reason}”`);
          }
          await sleep(500);
        }

        undercoverGameState.gamePhase = 'elimination';
        await sleep(2000);
        await processUndercoverTurn();
        break;
      }

      case 'elimination': {
        logToUndercoverGame('投票结束，正在计票...', 'system');
        await sleep(2000);

        const voteCounts = undercoverGameState.votes;
        let maxVotes = 0;
        let playersToEliminate = [];

        for (const playerId in voteCounts) {
          if (voteCounts[playerId] > maxVotes) {
            maxVotes = voteCounts[playerId];
            playersToEliminate = [playerId];
          } else if (voteCounts[playerId] === maxVotes) {
            playersToEliminate.push(playerId);
          }
        }

        if (playersToEliminate.length > 1) {
          // 处理平票
          logToUndercoverGame(
            `出现平票: ${playersToEliminate
              .map(id => undercoverGameState.players.find(p => p.id === id).name)
              .join('、 ')}。`,
            'system',
          );
          logToUndercoverGame('平票玩家将进行补充发言，之后再次投票。', 'system');
          undercoverGameState.tiedPlayers = playersToEliminate;
          undercoverGameState.gamePhase = 'tie_vote_speech';
          await sleep(2000);
          await processUndercoverTurn();
          return;
        } else if (playersToEliminate.length === 1) {
          // 唯一最高票，淘汰
          const eliminatedPlayerId = playersToEliminate[0];
          const eliminatedPlayer = undercoverGameState.players.find(p => p.id === eliminatedPlayerId);
          eliminatedPlayer.isAlive = false;
          undercoverGameState.votedOutPlayers.push(eliminatedPlayer);
          const roleName =
            { undercover: '卧底', civilian: '平民', whiteboard: '白板' }[eliminatedPlayer.role] || '未知';
          logToUndercoverGame(`【${eliminatedPlayer.name}】被淘汰！他/她的身份是【${roleName}】。`, 'system');
        } else {
          // 无人被投
          logToUndercoverGame('本轮无人被投，无人出局。', 'system');
        }

        renderUndercoverGameScreen();
        if (checkUndercoverGameOver()) return;

        // ★★★ 核心修改：无论是否有人淘汰，都正确进入下一轮 ★★★
        undercoverGameState.dayNumber++;
        undercoverGameState.gamePhase = 'description_round';
        logToUndercoverGame('游戏继续...', 'system');
        await sleep(3000);
        await processUndercoverTurn();
        break;
      }

      case 'tie_vote_speech': {
        logToUndercoverGame('现在请平票玩家依次进行补充发言。', 'system');
        const tiedPlayers = undercoverGameState.players.filter(p => undercoverGameState.tiedPlayers.includes(p.id));
        for (const player of tiedPlayers) {
          if (!player.isAlive) continue;
          renderUndercoverGameScreen({ speakingPlayerId: player.id });
          let speech;
          if (player.isUser) {
            speech = await waitForUserUndercoverAction('请进行补充发言', 'speak', {
              placeholder: '为自己辩解，说服大家不要投你...',
            });
          } else {
            speech = await triggerUndercoverAiAction(player.id, 'tie_speak');
          }
          logToUndercoverGame({ player: player, speech: speech }, 'speech');
          await sleep(1000);
        }
        renderUndercoverGameScreen();
        undercoverGameState.gamePhase = 'tie_vote_re-vote';
        await processUndercoverTurn();
        break;
      }

      case 'tie_vote_re-vote': {
        logToUndercoverGame('补充发言结束，请在平票玩家中投票。', 'system');

        const voters = undercoverGameState.players.filter(
          p => p.isAlive && !undercoverGameState.tiedPlayers.includes(p.id),
        );
        const targets = undercoverGameState.players.filter(p => undercoverGameState.tiedPlayers.includes(p.id));
        undercoverGameState.votes = {};

        for (const voter of voters) {
          let voteResult;
          if (voter.isUser) {
            voteResult = await waitForUserUndercoverAction('请投票', 'vote', { targets: targets });
          } else {
            voteResult = await triggerUndercoverAiAction(voter.id, 'vote', { targets: targets });
          }

          if (voteResult && voteResult.voteForId) {
            const targetId = voteResult.voteForId;
            const reason = voteResult.reason || '未说明理由';
            const targetPlayer = targets.find(p => p.id === targetId);
            if (targetPlayer) {
              logToUndercoverGame(
                `<strong>${voter.name}</strong> 投票给了 <strong>${targetPlayer.name}</strong>，理由是：“${reason}”`,
              );
              undercoverGameState.votes[targetId] = (undercoverGameState.votes[targetId] || 0) + 1;
            }
          } else {
            const reason = voteResult ? voteResult.reason || '信息不足，无法判断。' : '信息不足，无法判断。';
            logToUndercoverGame(`<strong>${voter.name}</strong> 弃票了，理由是：“${reason}”`);
          }
          await sleep(500);
        }

        const voteCounts = undercoverGameState.votes;
        let maxVotes = 0;
        let playersToEliminate = [];
        for (const playerId in voteCounts) {
          if (voteCounts[playerId] > maxVotes) {
            maxVotes = voteCounts[playerId];
            playersToEliminate = [playerId];
          } else if (voteCounts[playerId] === maxVotes) {
            playersToEliminate.push(playerId);
          }
        }

        if (playersToEliminate.length !== 1) {
          logToUndercoverGame('再次平票，本轮无人出局。', 'system');
        } else {
          const eliminatedPlayerId = playersToEliminate[0];
          const eliminatedPlayer = undercoverGameState.players.find(p => p.id === eliminatedPlayerId);
          eliminatedPlayer.isAlive = false;
          undercoverGameState.votedOutPlayers.push(eliminatedPlayer);
          const roleName =
            { undercover: '卧底', civilian: '平民', whiteboard: '白板' }[eliminatedPlayer.role] || '未知';
          logToUndercoverGame(
            `PK投票结果：【${eliminatedPlayer.name}】被淘汰！他/她的身份是【${roleName}】。`,
            'system',
          );
        }

        renderUndercoverGameScreen();
        if (checkUndercoverGameOver()) return;

        undercoverGameState.tiedPlayers = [];
        undercoverGameState.dayNumber++;
        undercoverGameState.gamePhase = 'description_round';
        await sleep(3000);
        await processUndercoverTurn();
        break;
      }
    }
  }
  // ▲▲▲ 替换结束 ▲▲▲
  // ▼▼▼ 【全新】这是“谁是卧底”的重roll功能核心函数 ▼▼▼
  /**
   * 【卧底】处理AI发言的重roll请求
   * @param {number} logIndex - 要重roll的发言在gameLog中的索引
   */
  async function handleUndercoverReroll(logIndex) {
    const logEntry = undercoverGameState.gameLog[logIndex];
    if (!logEntry || logEntry.type !== 'speech' || !logEntry.message.player || logEntry.message.player.isUser) {
      return;
    }

    const playerToReroll = logEntry.message.player;

    const speechTextElement = document
      .querySelector(`button.uc-reroll-btn[data-log-index="${logIndex}"]`)
      .closest('.speech-content')
      .querySelector('.speech-text');
    if (speechTextElement) {
      speechTextElement.innerHTML = '<i>重新描述中...</i>';
    }

    try {
      // 判断当前游戏阶段来决定AI的行动
      const actionType = undercoverGameState.gamePhase === 'tie_vote_speech' ? 'tie_speak' : 'describe';

      const newSpeech = await triggerUndercoverAiAction(playerToReroll.id, actionType);
      undercoverGameState.gameLog[logIndex].message.speech = newSpeech;
      renderUndercoverGameScreen();
    } catch (error) {
      console.error('卧底发言重roll失败:', error);
      if (speechTextElement) {
        speechTextElement.innerHTML = `<i style="color:red;">重新生成失败，请检查网络或API设置。</i>`;
      }
    }
  }
  // ▲▲▲ 新增函数结束 ▲▲▲

  // ▼▼▼ 【谁是卧底】用这块【已添加重roll按钮】的代码，完整替换旧的 renderUndercoverGameScreen 函数 ▼▼▼
  /**
   * 【卧底】渲染游戏主界面
   */
  function renderUndercoverGameScreen(options = {}) {
    const playersGrid = document.getElementById('undercover-players-grid');
    const logContainer = document.getElementById('undercover-game-log');

    playersGrid.innerHTML = '';
    undercoverGameState.players.forEach(player => {
      const seat = document.createElement('div');
      seat.className = 'player-seat';
      const avatarClass = `player-avatar ${!player.isAlive ? 'dead' : ''} ${
        options.speakingPlayerId === player.id ? 'speaking' : ''
      }`;

      seat.innerHTML = `
            <img src="${player.avatar}" class="${avatarClass}">
            <span class="player-name">${player.name} ${!player.isAlive ? '(淘汰)' : ''}</span>
        `;
      playersGrid.appendChild(seat);
    });

    logContainer.innerHTML = '';
    undercoverGameState.gameLog.forEach((log, index) => {
      // ★ 核心修改1：增加了index参数
      const logEl = document.createElement('div');
      // ★ 核心修改2：判断是否是AI的发言
      if (log.type === 'speech' && typeof log.message === 'object' && !log.message.player.isUser) {
        logEl.className = 'log-entry speech';
        const { player, speech } = log.message;

        // ★ 核心修改3：为AI发言添加重roll按钮
        logEl.innerHTML = `
            <img src="${player.avatar}" class="speech-avatar">
            <div class="speech-content">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="speaker">${player.name}</span>
                    <button class="uc-reroll-btn" data-log-index="${index}" title="重新生成发言" style="background:none; border:none; cursor:pointer; padding:0; color:var(--text-secondary);">
                        <svg class="reroll-btn-icon" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                    </button>
                </div>
                <span class="speech-text">${speech.replace(/\n/g, '<br>')}</span>
            </div>
        `;
      } else if (log.type === 'speech') {
        // 用户发言保持原样
        logEl.className = 'log-entry speech';
        logEl.innerHTML = `
                <img src="${log.message.player.avatar}" class="speech-avatar">
                <div class="speech-content">
                    <span class="speaker">${log.message.player.name}</span>
                    <span class="speech-text">${log.message.speech.replace(/\n/g, '<br>')}</span>
                </div>
            `;
      } else {
        // 其他系统消息也保持原样
        logEl.className = `log-entry ${log.type}`;
        logEl.innerHTML = String(log.message).replace(/\n/g, '<br>');
      }
      logContainer.appendChild(logEl);
    });
    logContainer.scrollTop = logContainer.scrollHeight;
  }
  // ▲▲▲ 替换结束 ▲▲▲

  /**
   * 【卧底】添加一条游戏日志
   */
  function logToUndercoverGame(message, type = 'system') {
    undercoverGameState.gameLog.push({ message, type });
    renderUndercoverGameScreen();
  }

  // ▼▼▼ 【卧底输入框美化版】请用这个【全新】的函数，完整替换掉你旧的 waitForUserUndercoverAction 函数 ▼▼▼
  /**
   * 【卧底 V4】等待用户行动的通用函数（已修复placeholder错误）
   */
  function waitForUserUndercoverAction(promptText, actionType, context = {}) {
    const me = undercoverGameState.players.find(p => p.isUser);
    if (me && !me.isAlive) {
      const actionArea = document.getElementById('undercover-action-area');
      actionArea.innerHTML = `<h5>您已淘汰，正在观战...</h5>`;
      return new Promise(async resolve => {
        await sleep(3000);
        actionArea.innerHTML = '';
        resolve(null);
      });
    }

    return new Promise(resolve => {
      const actionArea = document.getElementById('undercover-action-area');
      actionArea.innerHTML = '';
      actionArea.className = 'undercover-action-area';

      if (actionType === 'speak') {
        actionArea.classList.add('speaking-mode');

        // ★★★ 核心修复：从 context 对象中获取 placeholder ★★★
        const placeholderText = context.placeholder || '请输入你的发言...';

        actionArea.innerHTML = `<textarea id="undercover-user-speech-input" rows="1" placeholder="${placeholderText}"></textarea><button id="undercover-end-speech-btn" class="form-button">发言</button>`;

        const textarea = document.getElementById('undercover-user-speech-input');
        const endBtn = document.getElementById('undercover-end-speech-btn');
        textarea.addEventListener('input', () => {
          textarea.style.height = 'auto';
          textarea.style.height = textarea.scrollHeight + 'px';
        });
        textarea.focus();
        endBtn.onclick = () => {
          const speech = textarea.value.trim() || '我过。';
          actionArea.innerHTML = '';
          actionArea.classList.remove('speaking-mode');
          resolve(speech);
        };
      } else if (actionType === 'vote') {
        actionArea.innerHTML = `<h5>${promptText}</h5>`;
        const grid = document.createElement('div');
        grid.className = 'vote-target-grid';

        // ★★★ 核心修改：在这里判断是普通投票还是最终PK投票 ★★★
        const targets = context.targets
          ? context.targets.filter(p => !p.isUser)
          : undercoverGameState.players.filter(p => p.isAlive && !p.isUser); // 否则是所有存活玩家

        targets.forEach(player => {
          const btn = document.createElement('button');
          btn.className = 'form-button-secondary vote-target-btn';
          btn.textContent = player.name;
          btn.onclick = async () => {
            const reason = await showCustomPrompt(`投票给 ${player.name}`, '请输入你的投票理由（可选）');
            if (reason !== null) {
              actionArea.innerHTML = '';
              resolve({ voteForId: player.id, reason: reason.trim() || '没有理由，跟着感觉走。' });
            }
          };
          grid.appendChild(btn);
        });

        // ★★★ 核心修改：只有在普通投票时才显示“弃票”按钮 ★★★
        if (!context.targets) {
          const passBtn = document.createElement('button');
          passBtn.className = 'form-button-secondary vote-target-btn';
          passBtn.textContent = '弃票';
          passBtn.onclick = async () => {
            const reason = await showCustomPrompt(`确认弃票`, '请输入你弃票的理由（可选）');
            if (reason !== null) {
              actionArea.innerHTML = '';
              resolve({ voteForId: null, reason: reason.trim() || '信息不足，无法判断。' });
            }
          };
          grid.appendChild(passBtn);
        }

        actionArea.appendChild(grid);
      }
    });
  }
  // ▲▲▲ 替换结束 ▲▲▲

  // ▼▼▼ 用这块【已添加平票逻辑】的代码，完整替换你旧的 triggerUndercoverAiAction 函数 ▼▼▼
  /**
   * 【卧底-AI核心 V4 - 平票逻辑增强版】
   * @param {string} playerId - 触发行动的AI玩家ID
   * @param {string} actionType - AI需要执行的动作: 'describe', 'vote', 'tie_speak'
   * @returns {Promise<object|string|null>} - AI的行动结果
   */
  async function triggerUndercoverAiAction(playerId, actionType, context = {}) {
    const player = undercoverGameState.players.find(p => p.id === playerId);
    if (!player || !player.isAlive) return null;

    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
      if (actionType === 'describe' || actionType === 'tie_speak') return '我...词穷了，过。';
      if (actionType === 'vote') {
        const targets = context.targets || undercoverGameState.players.filter(p => p.isAlive && p.id !== playerId);
        const randomTargetId = targets.length > 0 ? targets[Math.floor(Math.random() * targets.length)].id : null;
        return { voteForId: randomTargetId, reason: '我凭直觉投的。' };
      }
      return null;
    }

    let actionPrompt = '';
    let jsonFormat = '';
    let roleDescription = '';
    let votingRule = '';
    // 【核心修改1】根据是否是平票后的再次投票，来决定可投票的目标
    const voteTargets = context.targets || undercoverGameState.players.filter(p => p.isAlive && p.id !== player.id);
    const alivePlayersListForVote = voteTargets.map(p => `- ${p.name} (id: ${p.id})`).join('\n');

    const gameLog = undercoverGameState.gameLog
      .filter(log => log.type === 'speech')
      .map(log => `${log.message.player.name}: ${log.message.speech}`)
      .join('\n');

    switch (actionType) {
      case 'describe':
        // ★★★ 核心修改2：为“描述”指令添加轮次信息 ★★★
        if (undercoverGameState.dayNumber > 1) {
          actionPrompt = `游戏进入了第 ${undercoverGameState.dayNumber} 轮。现在轮到你发言。请根据你的身份和词语，用一句【全新的、和之前轮次不同】的话来描述。你的描述必须是真实的，但要足够模糊。禁止重复他人的描述。`;
        } else {
          actionPrompt = `现在是第一轮，轮到你发言。请根据你的身份和词语，用一句话描述。你的描述必须是真实的，但要足够模糊。禁止重复他人的描述。`;
        }
        jsonFormat = '{"description": "你的描述..."}';
        break;
      // =======================================================
      // ★★★ 【全新】为AI增加补充发言的指令 ★★★
      // =======================================================
      case 'tie_speak':
        actionPrompt =
          '你因为平票正在进行补充发言。请为自己辩解，说服其他人不要投票给你。你的发言要简短有力，符合你的人设和身份。';
        jsonFormat = '{"description": "你的补充发言..."}';
        break;
      case 'vote':
        actionPrompt = `现在是投票环节。请仔细分析【所有玩家的发言】，找出描述最可疑、最偏离主题、或者听起来最心虚的那个人，然后投票给他/她，并给出【简洁且符合逻辑】的理由。或者，如果你觉得信息不足无法判断，也可以选择弃票，并说明你弃票的原因。`;
        jsonFormat = '{"voteForId": "你投票的玩家ID或null", "reason": "你的投票或弃票理由..."}';
        votingRule = `
# 【【【投票铁律：这是最高指令，必须严格遵守】】】
在你的 "reason" 投票理由中，【绝对禁止】直接或间接提及你自己的词语，或猜测别人的词语是什么。你的理由只能基于对他人【发言描述】的分析，例如“他的描述很模糊”、“她的描述和大家不一样”等等。
`;
        break;
    }

    if (player.role === 'civilian') {
      roleDescription = `你是【平民】，你的词是【${player.word}】。你的目标是找出卧底和白板并投票淘汰他们。`;
    } else if (player.role === 'undercover') {
      roleDescription = `你是【卧底】，你的词是【${player.word}】。你的词和平民的词意思相近但不同。你的任务是【伪装】！仔细听别人的发言，找出他们的共同点，让自己听起来像个好人。`;
    } else {
      // whiteboard
      roleDescription = `你是【白板】，你没有词语。你的任务是【伪装和猜测】！在轮到你发言之前，【仔细听】前面所有人的描述，【猜出】他们的词语大概是什么，然后给出一个【非常模糊】的描述，让自己听起来和他们是一伙的。`;
    }

    const systemPrompt = `
**【LANGUAGE RULE - HIGHEST PRIORITY】: You MUST reply in Vietnamese (Tiếng Việt) for ALL messages. Never use Chinese or any other language.**

# 游戏背景: 谁是卧底
你正在扮演玩家"${player.name}"，你的人设是："${player.persona}"。

# 你的身份和任务
${roleDescription}
你的所有行为都必须符合你的人设和游戏目标。
${votingRule}
# 当前场上局势
- 可投票的玩家列表:
${alivePlayersListForVote} 
- 本轮所有人的发言记录:
${gameLog || '(暂无发言)'}

# 你的行动指令
${actionPrompt}

# 输出格式
你的回复【必须且只能】是一个严格的JSON对象，格式如下:
${jsonFormat}
`;

    try {
      const messagesForApi = [{ role: 'user', content: systemPrompt }];
      let isGemini = proxyUrl === GEMINI_API_URL;
      let geminiConfig = toGeminiRequestData(
        model,
        apiKey,
        systemPrompt,
        messagesForApi,
        isGemini,
        state.apiConfig.temperature,
      );

      const response = isGemini
        ? await fetch(geminiConfig.url, geminiConfig.data)
        : await fetch(`${proxyUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              temperature: parseFloat(state.apiConfig.temperature) || 0.8,
              response_format: { type: 'json_object' },
            }),
          });

      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      const content = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content).replace(
        /^```json\s*|```$/g,
        '',
      );
      const aiAction = JSON.parse(content);

      // 【核心修改2】根据不同的行动类型，返回不同的结果
      if (actionType === 'describe' || actionType === 'tie_speak') {
        return aiAction.description || '我过。';
      }

      if (actionType === 'vote') {
        if (aiAction.voteForId === player.id) {
          const targets = voteTargets.filter(p => p.id !== player.id); // 确保不会投给自己
          const randomTargetId = targets.length > 0 ? targets[Math.floor(Math.random() * targets.length)].id : null;
          return { voteForId: randomTargetId, reason: '我感觉有点混乱，随便投一个吧。' };
        }
        return aiAction;
      }
      return null;
    } catch (error) {
      console.error(`卧底AI (${player.name}) 行动失败:`, error);
      if (actionType === 'describe' || actionType === 'tie_speak') return '我想不出来，过。';
      if (actionType === 'vote') {
        const targets = voteTargets.filter(p => p.id !== player.id);
        const randomTargetId = targets.length > 0 ? targets[Math.floor(Math.random() * targets.length)].id : null;
        return { voteForId: randomTargetId, reason: '思考超时，凭直觉投的。' };
      }
      return null;
    }
  }
  // ▲▲▲ 替换结束 ▲▲▲

  /**
   * 【卧底】检查游戏是否结束 (已集成复盘分享)
   */
  function checkUndercoverGameOver() {
    const alivePlayers = undercoverGameState.players.filter(p => p.isAlive);
    const aliveCount = alivePlayers.length;
    const undercoverCount = alivePlayers.filter(p => p.role === 'undercover' || p.role === 'whiteboard').length;
    const civilianCount = aliveCount - undercoverCount;

    let winner = null;

    if (undercoverCount === 0) {
      winner = '平民阵营';
    } else if (civilianCount <= undercoverCount) {
      winner = '卧底阵营';
    }

    if (winner) {
      undercoverGameState.isActive = false;
      logToUndercoverGame(`游戏结束！${winner}胜利！`, 'system');

      // ▼▼▼ 【核心修改】在这里调用我们新的复盘功能！ ▼▼▼
      setTimeout(() => {
        const summaryText = generateUndercoverSummary(winner);
        showUndercoverSummaryModal(summaryText);
      }, 2000);
      // ▲▲▲ 修改结束 ▲▲▲

      document.getElementById('undercover-action-area').innerHTML = '';
      return true;
    }
    return false;
  }

  // ▼▼▼ 【全新】“谁是卧底”游戏复盘与分享功能核心代码 ▼▼▼

  /**
   * 生成“谁是卧底”的复盘文本，包含完整的游戏日志
   * @param {string} winner - 胜利的阵营名称
   * @returns {string} - 格式化后的复盘Markdown文本
   */
  function generateUndercoverSummary(winner) {
    let summary = `**谁是卧底 - 游戏复盘**\n\n`;
    summary += `🏆 **胜利方:** ${winner}\n\n`;
    summary += `**词语揭晓:**\n- 平民词: **${undercoverGameState.civilianWord}**\n- 卧底词: **${undercoverGameState.undercoverWord}**\n\n`;

    summary += `**玩家身份:**\n`;
    undercoverGameState.players.forEach(p => {
      const roleName = { undercover: '卧底', civilian: '平民', whiteboard: '白板' }[p.role];
      summary += `- ${p.name}: ${roleName}\n`;
    });

    summary += `\n---\n\n**游戏过程回顾:**\n`;
    const formattedLog = undercoverGameState.gameLog
      .map(log => {
        if (log.type === 'speech') {
          return `${log.message.player.name}: ${log.message.speech}`;
        }
        return log.message.replace(/<strong>/g, '**').replace(/<\/strong>/g, '**'); // 将HTML粗体转为Markdown
      })
      .join('\n');
    summary += formattedLog;

    return summary;
  }

  /**
   * 【卧底】打开复盘分享目标选择器
   * @param {string} summaryText - 要分享的复盘文本
   */
  function openUndercoverSummaryTargetPicker(summaryText) {
    const modal = document.getElementById('undercover-target-picker-modal');
    const listEl = document.getElementById('undercover-target-list');
    listEl.innerHTML = '';

    const aiPlayers = undercoverGameState.players.filter(p => !p.isUser);

    if (aiPlayers.length === 0) {
      alert('没有可分享的AI玩家。');
      return;
    }

    // 渲染可选的AI玩家列表
    aiPlayers.forEach(player => {
      const item = document.createElement('div');
      item.className = 'player-selection-item'; // 复用之前的样式
      item.innerHTML = `
            <input type="checkbox" class="undercover-target-checkbox" value="${player.id}" checked>
            <img src="${player.avatar || defaultAvatar}" alt="${player.name}">
            <span class="name">${player.name}</span>
        `;
      listEl.appendChild(item);
    });

    // 绑定按钮事件
    const confirmBtn = document.getElementById('uc-confirm-share-btn');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.onclick = () => {
      const selectedIds = Array.from(document.querySelectorAll('.undercover-target-checkbox:checked')).map(
        cb => cb.value,
      );
      if (selectedIds.length > 0) {
        sendUndercoverSummaryToSelectedPlayers(summaryText, selectedIds);
      } else {
        alert('请至少选择一个分享对象！');
      }
    };

    document.getElementById('uc-cancel-share-btn').onclick = () => modal.classList.remove('visible');
    document.getElementById('uc-select-all-btn').onclick = () => {
      document.querySelectorAll('.undercover-target-checkbox').forEach(cb => (cb.checked = true));
    };
    document.getElementById('uc-deselect-all-btn').onclick = () => {
      document.querySelectorAll('.undercover-target-checkbox').forEach(cb => (cb.checked = false));
    };

    modal.classList.add('visible');
  }

  /**
   * 【卧底】将游戏复盘发送到【选定】的AI角色的单聊中
   * @param {string} summaryText - 复盘文本
   * @param {string[]} targetIds - 目标AI角色的ID数组
   */
  async function sendUndercoverSummaryToSelectedPlayers(summaryText, targetIds) {
    document.getElementById('undercover-summary-modal').classList.remove('visible');
    document.getElementById('undercover-target-picker-modal').classList.remove('visible');
    let sentCount = 0;

    const aiContext = `[系统指令：刚刚结束了一局“谁是卧底”，这是游戏复盘。请根据这个复盘内容，以你的角色人设，和用户聊聊刚才的游戏。]\n\n${summaryText}`;

    for (const chatId of targetIds) {
      const chat = state.chats[chatId];
      if (chat) {
        const visibleMessage = {
          role: 'user',
          type: 'share_link',
          timestamp: Date.now(),
          title: '谁是卧底 - 游戏复盘',
          description: '点击查看详细复盘记录',
          source_name: '游戏中心',
          content: summaryText,
        };

        const hiddenInstruction = {
          role: 'system',
          content: aiContext,
          timestamp: Date.now() + 1,
          isHidden: true,
        };

        chat.history.push(visibleMessage, hiddenInstruction);
        await db.chats.put(chat);
        sentCount++;
      }
    }

    await showCustomAlert('分享成功', `游戏复盘已分享至 ${sentCount} 位AI玩家的单聊中！`);
    showScreen('game-hall-screen');
  }

  /**
   * 【卧底】显示游戏结算卡片 (V2 - 已集成分享功能)
   */
  function showUndercoverSummaryModal(summaryText) {
    const modal = document.getElementById('undercover-summary-modal');
    const contentEl = document.getElementById('undercover-summary-content');

    // 使用Markdown渲染函数，让复盘更好看
    contentEl.innerHTML = renderMarkdown(summaryText);

    // --- ▼▼▼ 核心修改在这里 ▼▼▼ ---

    // 为“分享复盘”按钮绑定新的点击事件
    const repostBtn = document.getElementById('repost-undercover-summary-btn');
    const newRepostBtn = repostBtn.cloneNode(true);
    repostBtn.parentNode.replaceChild(newRepostBtn, repostBtn);
    newRepostBtn.onclick = () => openUndercoverSummaryTargetPicker(summaryText); // 调用我们即将创建的目标选择器函数

    // 为“返回大厅”按钮绑定事件
    const backBtn = document.getElementById('back-to-hall-from-undercover-btn');
    const newBackBtn = backBtn.cloneNode(true);
    backBtn.parentNode.replaceChild(newBackBtn, backBtn);
    newBackBtn.onclick = () => {
      modal.classList.remove('visible');
      showScreen('game-hall-screen');
    };

    // --- ▲▲▲ 修改结束 ▲▲▲ ---

    modal.classList.add('visible');
  }

  // ▲▲▲ “谁是卧底”核心逻辑代码结束 ▲▲▲
  /**
   * 【全新】调用AI为“谁是卧底”游戏生成一组词语
   * @returns {Promise<object>} - 返回一个包含 { civilian: '平民词', undercover: '卧底词' } 的对象
   */
  async function generateUndercoverWordsAI() {
    await showCustomAlert('请稍候...', 'AI正在为你出题...');
    const { proxyUrl, apiKey, model } = state.apiConfig;
    if (!proxyUrl || !apiKey || !model) {
      throw new Error('API未配置，无法生成词语。');
    }

    const prompt = `
# 任务
你是一个“谁是卧底”游戏出题人。请生成一组有趣且有迷惑性的词语。

# 规则
1.  你必须生成两个词语：一个“平民词(civilianWord)”和一个“卧底词(undercoverWord)”。
2.  这两个词语必须属于同一大类，但具体指向不同。例如：牛奶 vs 豆浆，唇膏 vs 口红。
3.  词语必须是常见的2-4个字的中文名词。
4.  你的回复【必须且只能】是一个严格的JSON对象，格式如下:
    {"civilianWord": "...", "undercoverWord": "..."}
5.  【绝对禁止】返回任何JSON以外的文本、解释或分析。

现在，请出题。`;

    try {
      const messagesForApi = [{ role: 'user', content: prompt }];
      let isGemini = proxyUrl === GEMINI_API_URL;
      let geminiConfig = toGeminiRequestData(model, apiKey, prompt, messagesForApi, isGemini);

      const response = isGemini
        ? await fetch(geminiConfig.url, geminiConfig.data)
        : await fetch(`${proxyUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              temperature: parseFloat(state.apiConfig.temperature) || 0.8,
              response_format: { type: 'json_object' },
            }),
          });

      if (!response.ok) throw new Error(`API请求失败: ${response.status}`);

      const data = await response.json();
      const rawContent = (isGemini ? data.candidates[0].content.parts[0].text : data.choices[0].message.content)
        .replace(/^```json\s*|```$/g, '')
        .trim();
      const wordPair = JSON.parse(rawContent);

      if (wordPair.civilianWord && wordPair.undercoverWord) {
        return { civilian: wordPair.civilianWord, undercover: wordPair.undercoverWord };
      }
      throw new Error('AI返回的词语格式不正确。');
    } catch (error) {
      console.error('AI生成词语失败:', error);
      throw error; // 将错误抛出，由调用者处理
    }
  }

  // ▲▲▲ 新功能函数粘贴结束 ▲▲▲

  // (请确保你把上面提到的所有游戏相关函数都从原文件剪切过来了)
  // 下面是完整的函数示例，你只需确保你的代码里有这些函数即可

  /* ******************************************* */
  /* ***           完整的游戏函数代码            *** */
  /* ******************************************* */

  // ▼▼▼ 用这块【已添加飞行棋】的代码，替换旧的 game-hall-grid 事件监听器 ▼▼▼
  document.getElementById('game-hall-grid').addEventListener('click', e => {
    const gameCard = e.target.closest('.game-card');
    if (!gameCard) return;

    const gameId = gameCard.dataset.game;
    if (gameId === 'werewolf') {
      openWerewolfSetup();
    } else if (gameId === 'sea-turtle-soup') {
      openSeaTurtleSoupSetup();
    } else if (gameId === 'script-kill') {
      openScriptKillSetup();
    } else if (gameId === 'guess-what') {
      openGuessWhatSetup();
    }
    // ★★★ 这就是我们新增的分支 ★★★
    else if (gameId === 'ludo') {
      openLudoSetup(); // 调用我们新写的函数
    }
    // ★★★ 新增结束 ★★★
    // ▼▼▼ 在这里添加新的 else if 分支 ▼▼▼
    else if (gameId === 'undercover') {
      openUndercoverSetup();
    }
    // ▲▲▲ 新增代码结束 ▲▲▲
    else {
      alert(`“${gameCard.querySelector('.game-title').textContent}”还在开发中，敬请期待！`);
    }
  });
  // ▲▲▲ 替换结束 ▲▲▲

  // ▼▼▼ 【全新】狼人杀游戏事件监听器 ▼▼▼
  document.getElementById('start-werewolf-game-btn').addEventListener('click', startWerewolfGame);

  document.getElementById('exit-werewolf-game-btn').addEventListener('click', async () => {
    const confirmed = await showCustomConfirm('退出游戏', '确定要中途退出游戏吗？当前进度不会保存。');
    if (confirmed) {
      werewolfGameState.isActive = false; // 停止游戏循环
      showScreen('game-hall-screen');
    }
  });

  document.getElementById('werewolf-my-role-btn').addEventListener('click', () => {
    if (werewolfGameState.isActive) {
      const me = werewolfGameState.players.find(p => p.isUser);
      if (me) {
        alert(`你的身份是：【${me.role}】`);
      }
    }
  });
  // ▲▲▲ 新增事件监听结束 ▲▲▲
  // ▼▼▼ 【全新】海龟汤游戏事件监听器 ▼▼▼

  // 1. 设置弹窗内的交互
  document.getElementById('cancel-sts-setup-btn').addEventListener('click', () => {
    document.getElementById('sea-turtle-soup-setup-modal').classList.remove('visible');
  });
  document.getElementById('start-sts-game-btn').addEventListener('click', startSeaTurtleSoupGame);

  // 监听“出题人”下拉框的变化
  document.getElementById('sts-riddle-provider-select').addEventListener('change', e => {
    const userArea = document.getElementById('sts-user-riddle-input-area');
    const aiArea = document.getElementById('sts-ai-riddle-input-area');
    userArea.style.display = 'none';
    aiArea.style.display = 'none';
    if (e.target.value === 'user') {
      userArea.style.display = 'block';
    } else if (e.target.value === 'random_ai') {
      aiArea.style.display = 'block';
    }
  });

  // 2. 游戏主界面的按钮
  document.getElementById('exit-sts-game-btn').addEventListener('click', async () => {
    const confirmed = await showCustomConfirm('退出游戏', '确定要中途退出游戏吗？');
    if (confirmed) {
      seaTurtleSoupState.isActive = false;
      showScreen('game-hall-screen');
    }
  });
  document.getElementById('reveal-sts-answer-btn').addEventListener('click', async () => {
    const confirmed = await showCustomConfirm('揭晓答案', '确定要提前揭晓答案并结束游戏吗？');
    if (confirmed) {
      revealStsAnswer();
    }
  });
  document.getElementById('send-sts-question-btn').addEventListener('click', handleStsUserQuestion);
  // ▼▼▼ 在 init() 的事件监听器区域末尾添加 ▼▼▼
  document.getElementById('guess-sts-answer-btn').addEventListener('click', handleStsUserGuess);
  // ▲▲▲ 添加结束 ▲▲▲
  document.getElementById('sts-question-input').addEventListener('keypress', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('send-sts-question-btn').click();
    }
  });

  // ▲▲▲ 新事件监听器结束 ▲▲▲
  // ▼▼▼ 【全新】剧本杀游戏事件监听器 ▼▼▼
  document.getElementById('start-script-kill-game-btn').addEventListener('click', startScriptKillGame);
  document.getElementById('exit-script-kill-game-btn').addEventListener('click', async () => {
    const confirmed = await showCustomConfirm('退出游戏', '确定要中途退出游戏吗？当前进度不会保存。');
    if (confirmed) {
      scriptKillGameState.isActive = false; // 停止游戏循环
      showScreen('game-hall-screen');
    }
  });
  // 剧本杀游戏事件监听器
  document.getElementById('script-kill-my-role-btn').addEventListener('click', () => {
    if (!scriptKillGameState.isActive) return;
    const myPlayer = scriptKillGameState.players.find(p => p.isUser);
    if (myPlayer) {
      const modal = document.getElementById('script-kill-role-modal');
      document.getElementById('sk-role-name').textContent = `你的角色：${myPlayer.role.name}`;
      // ▼▼▼ 核心修改在这里 ▼▼▼
      document.getElementById('sk-role-details').innerHTML = `
            <p><strong>角色介绍:</strong><br>${myPlayer.role.description}</p>
            <p><strong>你的时间线:</strong><br>${myPlayer.role.storyline || '（暂无时间线信息）'}</p>
            <p><strong>你的任务:</strong><br>${myPlayer.role.tasks}</p>
        `;
      // ▲▲▲ 修改结束 ▲▲▲
      modal.classList.add('visible');
    }
  });
  document.getElementById('close-sk-role-modal-btn').addEventListener('click', () => {
    document.getElementById('script-kill-role-modal').classList.remove('visible');
  });

  // 查看线索板
  document.getElementById('script-kill-all-evidence-btn').addEventListener('click', () => {
    if (!scriptKillGameState.isActive) return;
    const modal = document.getElementById('script-kill-evidence-modal');
    const listEl = document.getElementById('sk-evidence-list');
    listEl.innerHTML = '';

    const myPlayer = scriptKillGameState.players.find(p => p.isUser);
    if (myPlayer.evidence.length === 0) {
      listEl.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">你还没有搜到任何线索。</p>';
    } else {
      myPlayer.evidence.forEach(clue => {
        const card = document.createElement('div');
        card.className = 'sk-evidence-card';
        card.innerHTML = `
                <div class="source">来源: ${clue.source}</div>
                <div class="description">${clue.description}</div>
            `;
        listEl.appendChild(card);
      });
    }
    modal.classList.add('visible');
  });
  document.getElementById('close-sk-evidence-modal-btn').addEventListener('click', () => {
    document.getElementById('script-kill-evidence-modal').classList.remove('visible');
  });

  // ▼▼▼ 【最终流程版】请用这整块代码，完整替换旧的 script-kill-action-area 事件监听器 ▼▼▼
  document.getElementById('script-kill-action-area').addEventListener('click', async e => {
    const phase = scriptKillGameState.gamePhase;

    // ▼▼▼ 从这里开始复制，替换掉你旧的 'sk-search-evidence-btn' 的 if 代码块 ▼▼▼
    if (e.target.id === 'sk-search-evidence-btn') {
      const user = scriptKillGameState.players.find(p => p.isUser);
      const script = scriptKillGameState.script;

      const searchCount = scriptKillGameState.evidenceCounts[user.id] || 0;
      const phase = scriptKillGameState.gamePhase;

      // 检查搜证次数限制
      if ((phase === 'evidence_round_1' && searchCount >= 2) || (phase === 'evidence_round_2' && searchCount >= 3)) {
        alert('本轮搜证次数已用完！');
        return;
      }

      // 消耗一次搜证机会并更新UI
      scriptKillGameState.evidenceCounts[user.id] = searchCount + 1;
      updateActionAreaSK();

      let foundMessage = '';

      // 找出所有还未被发现的线索
      const uncollectedClues = script.clues.filter(c => !scriptKillGameState.collectedClueIds.has(c.description));

      if (uncollectedClues.length > 0) {
        // 随机找到一条新线索
        const foundClue = uncollectedClues[Math.floor(Math.random() * uncollectedClues.length)];
        const clueSource = foundClue.owner === '公共' ? '公共区域' : `角色 ${foundClue.owner} 的私人物品`;

        // 无论如何，线索都会先加入玩家手牌，并标记为已发现
        user.evidence.push({ description: foundClue.description, source: clueSource });
        scriptKillGameState.collectedClueIds.add(foundClue.description);

        // --- ★★★ 核心修改逻辑开始 ★★★ ---

        // 判断这条线索是不是关于玩家自己的
        if (foundClue.owner === user.role.name) {
          // 如果是，弹出一个选择框让玩家决定
          const choice = await showChoiceModal('发现个人线索', [
            { text: '公开这条线索', value: 'public' },
            { text: '隐藏这条线索', value: 'private' },
          ]);

          if (choice === 'public') {
            // 玩家选择【公开】
            foundMessage = `在【${clueSource}】发现并公开了线索：“${foundClue.description}”`;
            logToScriptKillGame(`${user.name} 完成了一次搜证: ${foundMessage}`);
            await showCustomAlert('搜证结果', foundMessage);
          } else {
            // 玩家选择【隐藏】或关闭了弹窗
            foundMessage = `你在【${clueSource}】发现了一条关于自己的线索，并选择将其隐藏。`;
            // 只给玩家自己一个弹窗提示，告诉他已经拿到了线索
            await showCustomAlert('搜证结果', `你已将线索“${foundClue.description}”收入囊中。`);
            // 在公共日志里只显示一个模糊的信息，告诉大家你搜过证了
            logToScriptKillGame(`${user.name} 完成了一次搜证。`);
          }
        } else {
          // 如果线索是公共的，或者关于其他人的，就按原来的逻辑直接公开
          foundMessage = `在【${clueSource}】发现线索：“${foundClue.description}”`;
          logToScriptKillGame(`${user.name} 完成了一次搜证: ${foundMessage}`);
          await showCustomAlert('搜证结果', foundMessage);
        }

        // --- ★★★ 核心修改逻辑结束 ★★★ ---
      } else {
        // 如果已经没有新线索了
        foundMessage = '没有发现更多新线索了。';
        logToScriptKillGame(`${user.name} 完成了一次搜证: ${foundMessage}`);
        await showCustomAlert('搜证结果', foundMessage);
      }
    }
    // ▲▲▲ 复制到这里结束 ▲▲▲

    // --- 2. 处理“结束搜证”按钮 ---
    if (e.target.id === 'sk-end-search-btn') {
      if (phase === 'evidence_round_1') {
        scriptKillGameState.gamePhase = 'discussion_round_1';
        await processScriptKillTurn();
      } else if (phase === 'evidence_round_2') {
        // 【核心修改】第二轮搜证后，进入第二轮讨论
        scriptKillGameState.gamePhase = 'discussion_round_2';
        await processScriptKillTurn();
      }
    }

    // --- 3. 处理“我要发言”按钮 ---
    if (e.target.id === 'sk-speak-btn') {
      const speech = await waitForUserActionSK('轮到你发言了', 'speak', '请输入你的发言...');
      const userPlayer = scriptKillGameState.players.find(p => p.isUser);
      logToScriptKillGame({ player: userPlayer, speech: speech }, 'speech');

      for (const player of scriptKillGameState.players.filter(p => !p.isUser)) {
        await sleep(2000);
        renderScriptKillGameScreen({ speakingPlayerId: player.id });
        const aiSpeech = await triggerScriptKillAiAction(player.id, 'discuss');
        logToScriptKillGame({ player: player, speech: aiSpeech }, 'speech');
      }
      renderScriptKillGameScreen();

      // 【核心修改】根据当前讨论轮次，决定下一个阶段
      if (phase === 'discussion_round_1') {
        scriptKillGameState.gamePhase = 'evidence_round_2';
        await processScriptKillTurn();
      } else if (phase === 'discussion_round_2') {
        // 第二轮讨论后，进入第三轮（最终）讨论
        scriptKillGameState.gamePhase = 'discussion_round_3';
        await processScriptKillTurn();
      } else if (phase === 'discussion_round_3') {
        // 最终讨论后，才进入投票
        scriptKillGameState.gamePhase = 'voting';
        await processScriptKillTurn();
      }
    }
  });
  // ▲▲▲ 替换结束 ▲▲▲

  // ▼▼▼ 【全新 | 已修复】剧本杀管理功能事件监听器 ▼▼▼
  document.getElementById('manage-custom-scripts-btn').addEventListener('click', openScriptManager);

  // 管理器弹窗的按钮
  document.getElementById('add-new-script-btn').addEventListener('click', () => {
    document.getElementById('script-kill-manager-modal').classList.remove('visible');
    openScriptEditorForCreate();
  });
  document.getElementById('close-script-manager-btn').addEventListener('click', () => {
    document.getElementById('script-kill-manager-modal').classList.remove('visible');
    // 关闭后刷新一下设置页面的剧本下拉框
    openScriptKillSetup();
    showScreen('script-kill-setup-screen');
  });

  // 编辑器弹窗的按钮
  document.getElementById('save-script-btn').addEventListener('click', saveCustomScript);
  document.getElementById('cancel-script-editor-btn').addEventListener('click', () => {
    document.getElementById('script-kill-editor-modal').classList.remove('visible');
    // 如果是从管理界面进来的，就返回管理界面
    if (document.getElementById('script-kill-manager-modal').classList.contains('visible') === false) {
      openScriptManager();
    }
  });
  // ▲▲▲ 修复结束 ▲▲▲
  // ▼▼▼ 【全新】剧本杀可视化编辑器事件监听器 ▼▼▼
  document.getElementById('sk-add-role-btn').addEventListener('click', () => openRoleEditor());
  document.getElementById('sk-add-clue-btn').addEventListener('click', () => openClueEditor());

  document.getElementById('sk-item-editor-cancel-btn').addEventListener('click', () => {
    document.getElementById('sk-item-editor-modal').classList.remove('visible');
  });
  document.getElementById('sk-item-editor-save-btn').addEventListener('click', saveItemFromEditor);

  // 使用事件委托处理角色和线索卡片上的按钮点击
  document.getElementById('script-kill-editor-modal').addEventListener('click', e => {
    const target = e.target;
    if (target.classList.contains('edit-role-btn')) {
      openRoleEditor(parseInt(target.dataset.index));
    }
    if (target.classList.contains('delete-role-btn')) {
      const index = parseInt(target.dataset.index);
      currentEditingScriptData.roles.splice(index, 1);
      renderVisualScriptEditor();
    }
    if (target.classList.contains('edit-clue-btn')) {
      openClueEditor(parseInt(target.dataset.index));
    }
    if (target.classList.contains('delete-clue-btn')) {
      const index = parseInt(target.dataset.index);
      currentEditingScriptData.clues.splice(index, 1);
      renderVisualScriptEditor();
    }
  });
  // ▲▲▲ 新增事件监听结束 ▲▲▲
  // ▼▼▼ 在 init() 函数的事件监听器区域末尾，粘贴这块新代码 ▼▼▼

  // 【全新】剧本杀复盘分享功能事件绑定
  document.getElementById('sk-cancel-share-btn').addEventListener('click', () => {
    document.getElementById('script-kill-target-picker-modal').classList.remove('visible');
  });
  document.getElementById('sk-select-all-btn').addEventListener('click', () => {
    document.querySelectorAll('.script-kill-target-checkbox').forEach(cb => (cb.checked = true));
  });
  document.getElementById('sk-deselect-all-btn').addEventListener('click', () => {
    document.querySelectorAll('.script-kill-target-checkbox').forEach(cb => (cb.checked = false));
  });
  // ▲▲▲ 新代码粘贴结束 ▲▲▲
  // ▼▼▼ 【全新】AI剧本生成器事件监听器 ▼▼▼
  document.getElementById('open-sk-ai-generator-btn').addEventListener('click', openAiScriptGenerator);
  document.getElementById('sk-ai-generator-cancel-btn').addEventListener('click', () => {
    document.getElementById('sk-ai-generator-modal').classList.remove('visible');
    // 返回到剧本管理界面
    openScriptManager();
  });
  document.getElementById('sk-trigger-ai-generation-btn').addEventListener('click', generateSkScriptWithAI);
  document.getElementById('sk-ai-generator-save-btn').addEventListener('click', saveAiGeneratedScript);
  // ▲▲▲ 新事件监听器结束 ▲▲▲

  // ▲▲▲ 剧本杀事件监听器结束 ▲▲▲
  // ▼▼▼ 【全新】“你说我猜”游戏事件监听器 ▼▼▼

  // 1. 设置界面的交互
  document.querySelectorAll('input[name="guess_what_mode"]').forEach(radio => {
    radio.addEventListener('change', function () {
      document.getElementById('user-word-input-container').style.display =
        this.value === 'ai_guesses' ? 'block' : 'none';
    });
  });
  document.getElementById('start-guess-what-game-btn').addEventListener('click', startGuessWhatGame);

  // 2. 游戏界面的交互
  document.getElementById('exit-guess-what-game-btn').addEventListener('click', async () => {
    const confirmed = await showCustomConfirm('退出游戏', '确定要中途退出游戏吗？谜底将会揭晓。');
    if (confirmed) {
      endGuessWhatGame('none', '游戏被中途放弃。');
      // 延迟一点再返回大厅，让玩家能看到结果
      setTimeout(() => {
        showScreen('game-hall-screen');
      }, 3000);
    }
  });

  document.getElementById('give-up-guess-what-btn').addEventListener('click', () => {
    endGuessWhatGame(guessWhatGameState.currentTurn === 'user' ? 'ai' : 'user', '玩家放弃了游戏。');
  });

  document.getElementById('send-guess-what-input-btn').addEventListener('click', () => {
    const input = document.getElementById('guess-what-user-input');
    const text = input.value.trim();
    if (text) {
      processGuessWhatTurn(text);
      input.value = '';
    }
  });

  document.getElementById('guess-what-user-input').addEventListener('keypress', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('send-guess-what-input-btn').click();
    }
  });

  // ▲▲▲ “你说我猜”事件监听器结束 ▲▲▲
  // ▼▼▼ 在这里粘贴下面这整块【全新的】事件监听器代码 ▼▼▼
  // ▼▼▼ 用这整块新代码，替换旧的飞行棋事件监听器 ▼▼▼
  /* --- 【全新 | V2分类版】心动飞行棋功能事件监听器 --- */

  // 1. 设置页面的按钮
  document.getElementById('start-ludo-game-btn').addEventListener('click', startLudoGame);
  document.getElementById('manage-ludo-question-banks-btn').addEventListener('click', openLudoQuestionBankManager);

  // 2. 游戏主界面的按钮
  document.getElementById('exit-ludo-game-btn').addEventListener('click', async () => {
    const confirmed = await showCustomConfirm('退出游戏', '确定要中途退出游戏吗？');
    if (confirmed) {
      ludoGameState.isActive = false;
      showScreen('game-hall-screen');
    }
  });
  document.getElementById('restart-ludo-game-btn').addEventListener('click', async () => {
    const confirmed = await showCustomConfirm('重新开始', '确定要重新开始这一局吗？');
    if (confirmed) {
      startLudoGame();
    }
  });

  // 3. 问题库管理弹窗的按钮
  document.getElementById('close-qbank-manager-btn').addEventListener('click', async () => {
    document.getElementById('ludo-qbank-manager-modal').classList.remove('visible');
    // 如果设置页面还开着，就刷新一下下拉框
    if (document.getElementById('ludo-setup-screen').classList.contains('active')) {
      await openLudoSetup();
    }
  });
  document.getElementById('add-ludo-qbank-btn').addEventListener('click', addNewLudoQuestionBank);

  // 4. 问题编辑器弹窗的按钮
  document.getElementById('back-to-qbank-manager-btn').addEventListener('click', () => {
    document.getElementById('ludo-question-editor-modal').classList.remove('visible');
    openLudoQuestionBankManager(); // 返回到题库管理列表
  });
  document.getElementById('add-ludo-question-btn').addEventListener('click', () => openSingleQuestionEditor(null));

  // 5. 单个问题编辑/添加弹窗的按钮
  document.getElementById('cancel-single-question-btn').addEventListener('click', () => {
    document.getElementById('ludo-single-question-editor-modal').classList.remove('visible');
  });
  document.getElementById('save-single-question-btn').addEventListener('click', saveSingleQuestion);
  // ▼▼▼ 在这里粘贴下面的新代码 ▼▼▼
  /* --- 【全新】飞行棋题库导入功能事件监听 --- */
  document.getElementById('import-ludo-qbank-btn').addEventListener('click', () => {
    // 点击“导入”按钮时，触发隐藏的文件选择框
    document.getElementById('ludo-qbank-import-input').click();
  });

  document.getElementById('ludo-qbank-import-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      // 当用户选择了文件后，调用我们的导入处理函数
      importLudoQuestionBank(file);
    }
    e.target.value = null; // 清空，以便下次能选择同一个文件
  });
  /* --- 事件监听结束 --- */
  // ▲▲▲ 新代码粘贴结束 ▲▲▲

  /* --- 飞行棋事件监听器结束 --- */
  // ▼▼▼ 【全新】“谁是卧底”游戏事件监听器 ▼▼▼
  document.getElementById('start-undercover-game-btn').addEventListener('click', startUndercoverGame);
  document.getElementById('exit-undercover-game-btn').addEventListener('click', async () => {
    const confirmed = await showCustomConfirm('退出游戏', '确定要中途退出游戏吗？当前进度不会保存。');
    if (confirmed) {
      undercoverGameState.isActive = false; // 停止游戏循环
      showScreen('game-hall-screen');
    }
  });
  document.getElementById('undercover-my-word-btn').addEventListener('click', () => {
    if (undercoverGameState.isActive) {
      const me = undercoverGameState.players.find(p => p.isUser);
      if (me) {
        const roleName = { undercover: '卧底', civilian: '平民', whiteboard: '白板' }[me.role] || '未知';
        const wordText = me.word ? `你的词语是：【${me.word}】` : '你是一个白板，需要根据他人描述猜测平民词语。';
        showCustomAlert(`你的身份是：【${roleName}】`, wordText);
      }
    }
  });
  // ▲▲▲ 新增事件监听器结束 ▲▲▲
  // ▼▼▼ 在init()的事件监听区添加 ▼▼▼
  document.getElementById('werewolf-game-log').addEventListener('click', e => {
    const rerollBtn = e.target.closest('.werewolf-reroll-btn');
    if (rerollBtn) {
      const logIndex = parseInt(rerollBtn.dataset.logIndex);
      if (!isNaN(logIndex)) {
        handleWerewolfReroll(logIndex);
      }
    }
  });
  // ▲▲▲ 添加结束 ▲▲▲
  // ▼▼▼ 在init()的事件监听区添加 ▼▼▼
  document.getElementById('sts-action-area').addEventListener('click', e => {
    const rerollBtn = e.target.closest('#sts-reroll-ai-turn-btn');
    if (rerollBtn) {
      handleStsReroll();
    }
  });
  // ▲▲▲ 添加结束 ▲▲▲
  // ▼▼▼ 在init()的事件监听区添加 ▼▼▼
  // 剧本杀重roll事件
  document.getElementById('script-kill-game-log').addEventListener('click', e => {
    const rerollBtn = e.target.closest('.sk-reroll-btn');
    if (rerollBtn) {
      const logIndex = parseInt(rerollBtn.dataset.logIndex);
      if (!isNaN(logIndex)) {
        handleScriptKillReroll(logIndex);
      }
    }
  });
  // ▲▲▲ 添加结束 ▲▲▲
  // ▼▼▼ 在init()的事件监听区添加 ▼▼▼
  // “你说我猜”重roll事件
  document.getElementById('guess-what-game-log').addEventListener('click', e => {
    const rerollBtn = e.target.closest('.gw-reroll-btn');
    if (rerollBtn) {
      const logIndex = parseInt(rerollBtn.dataset.logIndex);
      if (!isNaN(logIndex)) {
        handleGuessWhatReroll(logIndex);
      }
    }
  });
  // ▲▲▲ 添加结束 ▲▲▲
  // ▼▼▼ 在init()的事件监听区添加 ▼▼▼
  // 飞行棋重roll事件
  document.getElementById('ludo-game-log').addEventListener('click', e => {
    const rerollBtn = e.target.closest('.ludo-reroll-btn');
    if (rerollBtn) {
      const logIndex = parseInt(rerollBtn.dataset.logIndex);
      if (!isNaN(logIndex)) {
        handleLudoReroll(logIndex);
      }
    }
  });
  // ▲▲▲ 添加结束 ▲▲▲
  // ▼▼▼ 在init()的事件监听区添加 ▼▼▼
  // “谁是卧底”重roll事件
  document.getElementById('undercover-game-log').addEventListener('click', e => {
    const rerollBtn = e.target.closest('.uc-reroll-btn');
    if (rerollBtn) {
      const logIndex = parseInt(rerollBtn.dataset.logIndex);
      if (!isNaN(logIndex)) {
        handleUndercoverReroll(logIndex);
      }
    }
  });
  // ▲▲▲ 添加结束 ▲▲▲
  // --- 【全新】剧本杀导入功能事件监听 ---

  // 1. 点击“导入”按钮，触发文件选择
  const importScriptBtn = document.getElementById('import-script-btn');
  if (importScriptBtn) {
    importScriptBtn.addEventListener('click', () => {
      document.getElementById('script-kill-import-input').click();
    });
  }

  // 2. 监听文件选择变化，执行导入
  const importScriptInput = document.getElementById('script-kill-import-input');
  if (importScriptInput) {
    importScriptInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) {
        importCustomScript(file);
      }
      e.target.value = null; // 清空，以便下次能选择同一个文件
    });
  }
  // --- 事件监听结束 ---
});
