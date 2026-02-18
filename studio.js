// studio.js

document.addEventListener('DOMContentLoaded', () => {
  // ===================================================================
  // 1. Global Variables
  // ===================================================================
  let activeStudioScriptId = null; // Tracks the ID of the script currently being edited or viewed
  let activeStudioPlay = null; // Tracks the current active play session { script, userRole, aiRole, aiChatId, history }

  // ===================================================================
  // 2. DOM Element References (fetched once for performance)
  // ===================================================================
  const studioAppIcon = document.getElementById('studio-app-icon');
  const addScriptBtn = document.getElementById('add-studio-script-btn');
  const backFromEditorBtn = document.getElementById('back-from-studio-editor');
  const saveScriptBtn = document.getElementById('save-studio-script-btn');
  const scriptListEl = document.getElementById('studio-script-list');
  const editorScreen = document.getElementById('studio-editor-screen');
  const editorTitle = document.getElementById('studio-editor-title');
  const nameInput = document.getElementById('studio-name-input');
  const bgInput = document.getElementById('studio-background-input');
  const goalInput = document.getElementById('studio-goal-input');
  const char1Input = document.getElementById('studio-char1-identity-input');
  const char2Input = document.getElementById('studio-char2-identity-input');
  const roleSelectionModal = document.getElementById('studio-role-selection-modal');
  const playScreen = document.getElementById('studio-play-screen');
  const playMessagesEl = document.getElementById('studio-play-messages');
  const playInput = document.getElementById('studio-play-input');
  const sendPlayActionBtn = document.getElementById('send-studio-play-action-btn');
  const exitPlayBtn = document.getElementById('exit-studio-play-btn');
  const rerollPlayBtn = document.getElementById('reroll-studio-play-btn');
  const summaryModal = document.getElementById('studio-summary-modal');
  const novelModal = document.getElementById('studio-novel-share-modal');
  const aiGenerateScriptBtn = document.getElementById('ai-generate-script-btn');
  const importScriptBtn = document.getElementById('import-studio-script-btn');
  const importInput = document.getElementById('studio-import-input');
  const exportScriptBtn = document.getElementById('export-studio-script-btn');
  // ===================================================================
  // 3. Core Functions
  // ===================================================================

  /**
   * Show the Studio main screen and render the script list
   */
  async function showStudioScreen() {
    await renderStudioScriptList();
    showScreen('studio-screen');
  }

  /**
   * Read scripts from the database and render them to the main list
   */
  async function renderStudioScriptList() {
    if (!scriptListEl) return;
    const scripts = await db.studioScripts.toArray();
    scriptListEl.innerHTML = '';

    if (scripts.length === 0) {
      scriptListEl.innerHTML =
        '<p style="text-align:center; color: var(--text-secondary); padding: 50px 0;">No scripts yet. Tap the top-right button to create one!</p>';
      return;
    }

    scripts.forEach(script => {
      const item = document.createElement('div');
      item.className = 'studio-script-item';
      item.innerHTML = `
                <div class="title">${script.name || 'Unnamed Script'}</div>
                <div class="goal">🎯 ${script.storyGoal || 'No goal set'}</div>
            `;
      item.addEventListener('click', () => openRoleSelection(script.id));

      // Add long-press to delete
      addLongPressListener(item, () => {
        openStudioEditor(script.id);
      });

      scriptListEl.appendChild(item);
    });
  }

  /**
   * Open the script editor (new or edit)
   * @param {number|null} scriptId - Pass an ID for editing, or null to create new
   */
  async function openStudioEditor(scriptId = null) {
    activeStudioScriptId = scriptId;
    const deleteBtn = document.getElementById('delete-studio-script-btn');
    // ▼▼▼ Get export button ▼▼▼
    const exportBtn = document.getElementById('export-studio-script-btn');
    const openingRemarkInput = document.getElementById('studio-opening-remark-input');

    if (scriptId) {
      editorTitle.textContent = 'Edit Script';
      const script = await db.studioScripts.get(scriptId);
      nameInput.value = script.name || '';
      bgInput.value = script.storyBackground || '';
      goalInput.value = script.storyGoal || '';
      openingRemarkInput.value = script.openingRemark || '';
      char1Input.value = script.character1_identity || '';
      char2Input.value = script.character2_identity || '';
      deleteBtn.style.display = 'block';
      // ▼▼▼ Edit mode: show export button ▼▼▼
      if (exportBtn) exportBtn.style.display = 'block';
    } else {
      editorTitle.textContent = 'New Script';
      [nameInput, bgInput, goalInput, openingRemarkInput, char1Input, char2Input].forEach(input => (input.value = ''));
      deleteBtn.style.display = 'none';
      // ▼▼▼ New mode: hide export button ▼▼▼
      if (exportBtn) exportBtn.style.display = 'none';
    }

    showScreen('studio-editor-screen');
  }

  /**
   * Use AI to generate or complete script content
   */
  async function generateScriptWithAI() {
    await showCustomAlert('Please Wait', 'The AI scriptwriter is at work...');

    // 1. Collect all filled-in information
    const existingData = {
      name: document.getElementById('studio-name-input').value.trim(),
      background: document.getElementById('studio-background-input').value.trim(),
      goal: document.getElementById('studio-goal-input').value.trim(),
      openingRemark: document.getElementById('studio-opening-remark-input').value.trim(),
      char1: document.getElementById('studio-char1-identity-input').value.trim(),
      char2: document.getElementById('studio-char2-identity-input').value.trim(),
    };

    // 2. Build detailed instructions (Prompt) for AI
    const systemPrompt = `
    **【LANGUAGE RULE - HIGHEST PRIORITY】: You MUST reply in Vietnamese (Tiếng Việt) for ALL messages. Never use Chinese or any other language.**

    # 你的角色
    你是一位才华横溢、想象力丰富的剧本创作大师。

    # 你的任务
    根据下方用户提供的【已有信息】，创作或补完一个引人入胜的戏剧剧本。
    你需要在【已有信息】的基础上进行构思，并生成所有标记为【(待生成)】的空白部分。

    # 已有信息
    - 剧本名称: ${existingData.name || '(待生成)'}
    - 故事背景: ${existingData.background || '(待生成)'}
    - 故事目标: ${existingData.goal || '(待生成)'}
    - 开场白: ${existingData.openingRemark || '(待生成)'}
    - 人物1身份背景: ${existingData.char1 || '(待生成)'}
    - 人物2身份背景: ${existingData.char2 || '(待生成)'}

    # 输出要求 (【【【最高指令，必须严格遵守】】】)
    1.  你的回复【必须且只能】是一个完整的、严格的JSON对象，绝不能包含任何解释性文字或Markdown标记。
    2.  这个JSON对象必须包含以下六个键: "name", "background", "goal", "openingRemark", "char1", "char2"。
    3.  你需要为所有标记为【(待生成)】的字段生成内容，并保持与已有信息的一致性和逻辑性。
    4.  生成的内容需要有创造性、戏剧性，并符合剧本创作的基本要求。人物和背景要鲜明、包含动机和潜在的秘密。
    5.  不能给人物1和人物2起名字，生成的全部内容，如背景、目标等，都不允许出现人物姓名，可以用身份指代。
    6.  生成人物时重点在身份和背景，尽量不要包含人物性格。

    # JSON输出格式示例:
    {
    "name": "失落的星图",
    "background": "在一个蒸汽朋克与魔法共存的世界里，传说中的星图被盗，这件神器据说能指引通往失落天空城的道路。",
    "goal": "在皇家飞艇启航前，找回星图，并揭露盗贼的真实身份。",
    "openingRemark": "锈蚀的齿轮在雨夜中呻吟，一封染血的密信滑入了侦探社的门缝...",
    "char1": "一位负债累累、但观察力敏锐的私家侦探，曾是皇家护卫队的一员，因一次意外被开除。",
    "char2": "一位神秘的贵族千金，星图失窃案的委托人，但她似乎对星图本身比对找回它更感兴趣。"
    }

    现在，请开始你的创作。`;

    try {
      const responseText = await getApiResponse(systemPrompt);

      // 3. Parse the JSON data returned by AI
      const sanitizedText = responseText.replace(/^```json\s*|```$/g, '').trim();
      const parsedData = JSON.parse(sanitizedText);

      // 4. Fill generated content back into inputs (only fill originally empty ones)
      if (!existingData.name && parsedData.name) {
        document.getElementById('studio-name-input').value = parsedData.name;
      }
      if (!existingData.background && parsedData.background) {
        document.getElementById('studio-background-input').value = parsedData.background;
      }
      if (!existingData.goal && parsedData.goal) {
        document.getElementById('studio-goal-input').value = parsedData.goal;
      }
      if (!existingData.openingRemark && parsedData.openingRemark) {
        document.getElementById('studio-opening-remark-input').value = parsedData.openingRemark;
      }
      if (!existingData.char1 && parsedData.char1) {
        document.getElementById('studio-char1-identity-input').value = parsedData.char1;
      }
      if (!existingData.char2 && parsedData.char2) {
        document.getElementById('studio-char2-identity-input').value = parsedData.char2;
      }

      await showCustomAlert('Done!', 'The script has been filled in by AI!');
    } catch (error) {
      console.error('AI script generation failed:', error);
      await showCustomAlert(
        'Generation Failed',
        `An error occurred: ${error.message}\n\nThe AI's raw response may not be valid JSON. Check the console for details.`,
      );
      console.error('AI raw response:', error.rawResponse || 'none'); // Error object may contain raw response
    }
  }

  /**
   * Save the currently edited script to the database
   */
  async function saveStudioScript() {
    const scriptData = {
      name: nameInput.value.trim() || 'Unnamed Script',
      storyBackground: bgInput.value.trim(),
      storyGoal: goalInput.value.trim(),
      openingRemark: document.getElementById('studio-opening-remark-input').value.trim(),
      character1_identity: char1Input.value.trim(),
      character2_identity: char2Input.value.trim(),
    };

    if (
      !scriptData.name ||
      !scriptData.storyBackground ||
      !scriptData.storyGoal ||
      !scriptData.character1_identity ||
      !scriptData.character2_identity
    ) {
      alert('All fields except the opening remark are required!');
      return;
    }

    if (activeStudioScriptId) {
      await db.studioScripts.update(activeStudioScriptId, scriptData);
    } else {
      await db.studioScripts.add(scriptData);
    }

    alert('Script saved!');
    showStudioScreen();
  }
  /**
   * Export the currently edited script
   */
  async function exportCurrentScript() {
    if (!activeStudioScriptId) {
      alert('Please save the script before exporting!');
      return;
    }

    const script = await db.studioScripts.get(activeStudioScriptId);
    if (!script) {
      alert('Script data not found.');
      return;
    }

    // 1. Prepare data
    const exportData = {
      type: 'EPhone_Studio_Script', // file type marker
      version: 1,
      data: script,
    };

    // 2. Create file and download
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    // Filename: [Script]ScriptName.json
    link.download = `[Script]${script.name}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert('Script exported successfully!');
  }

  /**
   * Import a script file
   */
  function handleScriptImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const text = e.target.result;
        const json = JSON.parse(text);

        // Basic format validation
        if (json.type !== 'EPhone_Studio_Script' || !json.data) {
          // Try to support plain object format (if user manually copied content)
          if (!json.name || !json.storyBackground) {
            throw new Error('Invalid file format: missing required fields.');
          }
          // If it's a plain object, use it directly
          json.data = json;
        }

        const scriptData = json.data;

        // Generate a new ID to avoid conflicts
        scriptData.id = Date.now();
        // Append (imported) suffix in case of name duplicates
        scriptData.name = scriptData.name + ' (imported)';

        await db.studioScripts.add(scriptData);

        await renderStudioScriptList();
        alert(`Script "${scriptData.name}" imported successfully!`);
      } catch (error) {
        console.error('Import failed:', error);
        alert(`Import failed: ${error.message}`);
      } finally {
        // Clear input to allow re-importing the same file
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  /**
   * Open the role selection modal
   * @param {number} scriptId - The selected script ID
   */
  async function openRoleSelection(scriptId) {
    const script = await db.studioScripts.get(scriptId);
    if (!script) return;

    activeStudioScriptId = scriptId;

    const role1Desc = document.getElementById('studio-role1-desc');
    const role2Desc = document.getElementById('studio-role2-desc');
    const role1IdentitySelect = document.getElementById('studio-role1-identity-select');
    const role2IdentitySelect = document.getElementById('studio-role2-identity-select');

    role1Desc.textContent = script.character1_identity || 'No description';
    role2Desc.textContent = script.character2_identity || 'No description';

    // 1. Get the user's Weibo nickname and persona
    if (!window.state || !window.state.qzoneSettings) {
      alert('Error: Unable to load user information. Make sure the main app is loaded correctly.');
      return;
    }
    const userNickname = window.state.qzoneSettings.nickname || 'Me';
    const userPersona = window.state.qzoneSettings.weiboUserPersona || 'An ordinary user.';

    // 2. Populate dropdown options (now identity list)
    const characters = Object.values(window.state.chats).filter(chat => !chat.isGroup);
    let optionsHtml = `<option value="user" data-persona="${escape(userPersona)}">${userNickname}</option>`;
    optionsHtml += characters
      .map(char => {
        const persona = char.settings.aiPersona || '';
        return `<option value="${char.id}" data-persona="${escape(persona)}">${char.name}</option>`;
      })
      .join('');

    role1IdentitySelect.innerHTML = optionsHtml;
    role2IdentitySelect.innerHTML = optionsHtml;

    // 3. Set default identity assignments
    role1IdentitySelect.value = 'user'; // Character 1 defaults to your identity
    if (characters.length > 0) {
      role2IdentitySelect.value = characters[0].id; // Character 2 defaults to first AI's identity
    } else {
      // If no AI characters, disable the other dropdown or show a hint
      role2IdentitySelect.innerHTML = '<option value="">No AI character identities available</option>';
    }

    // 4. Set default player assignments
    const radiosRole1 = document.querySelectorAll('input[name="player-role1"]');
    const radiosRole2 = document.querySelectorAll('input[name="player-role2"]');
    radiosRole1.forEach(r => {
      if (r.value === 'user') r.checked = true;
    }); // Character 1 defaults to played by you
    radiosRole2.forEach(r => {
      if (r.value === 'ai') r.checked = true;
    }); // Character 2 defaults to played by AI

    // 5. Bind radio button link events
    const playerSelectionGroups = document.querySelectorAll('.player-selection-group');
    playerSelectionGroups.forEach((group, index) => {
      group.addEventListener('change', e => {
        const selectedPlayer = e.target.value;
        const otherIndex = index === 0 ? 1 : 0; // Find the other character group
        const otherGroupRadios = playerSelectionGroups[otherIndex].querySelectorAll('input[type="radio"]');

        if (selectedPlayer === 'user') {
          // If current character is set to "played by me", the other must be "played by AI"
          otherGroupRadios.forEach(radio => {
            if (radio.value === 'ai') radio.checked = true;
          });
        } else {
          // selectedPlayer === 'ai'
          // If current character is set to "played by AI", the other must be "played by me"
          otherGroupRadios.forEach(radio => {
            if (radio.value === 'user') radio.checked = true;
          });
        }
      });
    });

    roleSelectionModal.classList.add('visible');
  }

  /**
   * Start the play
   */
  async function startStudioPlay() {
    const script = await db.studioScripts.get(activeStudioScriptId);

    // 1. Get player info
    const role1Player = document.querySelector('input[name="player-role1"]:checked').value;
    const role2Player = document.querySelector('input[name="player-role2"]:checked').value;

    // 2. Get identity info
    const role1IdentitySelect = document.getElementById('studio-role1-identity-select');
    const role2IdentitySelect = document.getElementById('studio-role2-identity-select');
    const role1IdentityValue = role1IdentitySelect.value;
    const role2IdentityValue = role2IdentitySelect.value;

    // Get persona from the <option> data attribute
    const role1Persona = unescape(role1IdentitySelect.options[role1IdentitySelect.selectedIndex].dataset.persona);
    const role2Persona = unescape(role2IdentitySelect.options[role2IdentitySelect.selectedIndex].dataset.persona);

    // 3. Validation
    if (role1Player === 'ai' && role2Player === 'ai') {
      alert('At least one character must be played by you!');
      return;
    }
    if (role1IdentityValue === role2IdentityValue) {
      alert('Both characters cannot share the same identity!');
      return;
    }

    const userRoleNumber = role1Player === 'user' ? 1 : 2;
    const aiRoleNumber = role1Player === 'ai' ? 1 : 2;

    const aiIdentityValue = aiRoleNumber === 1 ? role1IdentityValue : role2IdentityValue;
    const aiChatId =
      aiIdentityValue !== 'user' ? aiIdentityValue : userRoleNumber === 1 ? role2IdentityValue : role1IdentityValue;

    // Get nickname
    const userNickname = window.state.qzoneSettings.nickname || 'Me';

    // Helper: get name from identity dropdown value
    const getNameFromIdentityValue = val => {
      if (val === 'user') return userNickname;
      if (window.state.chats[val]) return window.state.chats[val].name;
      return 'Unknown character';
    };

    const role1Name = getNameFromIdentityValue(role1IdentityValue);
    const role2Name = getNameFromIdentityValue(role2IdentityValue);
    // 4. Initialize play session
    activeStudioPlay = {
      script: script,
      userRole: userRoleNumber,
      aiRole: aiRoleNumber,
      aiChatId: aiChatId,
      // Store identities
      aiIdentity: aiRoleNumber === 1 ? script.character1_identity : script.character2_identity,
      userPersona: userRoleNumber === 1 ? script.character1_identity : script.character2_identity,
      // Store names for novel generation
      role1Name: role1Name,
      role2Name: role2Name,
      history: [],
    };

    const backgroundMessage = {
      role: 'system',
      content: `[Story Background]\n${script.storyBackground}`,
    };
    activeStudioPlay.history.push(backgroundMessage);

    if (script.openingRemark) {
      const openingMessage = {
        role: 'system',
        content: `[Opening Remark]\n${script.openingRemark}`,
      };
      activeStudioPlay.history.push(openingMessage);
    }

    roleSelectionModal.classList.remove('visible');
    renderStudioPlayScreen();
    showScreen('studio-play-screen');
  }

  /**
   * Render the play screen
   */
  function renderStudioPlayScreen() {
    if (!activeStudioPlay) return;

    document.getElementById('studio-play-title').textContent = activeStudioPlay.script.name;
    playMessagesEl.innerHTML = '';

    activeStudioPlay.history.forEach(msg => {
      const bubble = createPlayMessageElement(msg);
      playMessagesEl.appendChild(bubble);
    });

    playMessagesEl.scrollTop = playMessagesEl.scrollHeight;
  }

  /**
   * Create a play message bubble
   * @param {object} msg - Message object
   */
  function createPlayMessageElement(msg) {
    const wrapper = document.createElement('div');

    // Map 'assistant' role to 'ai' class name
    const roleClass = msg.role === 'assistant' ? 'ai' : msg.role;

    if (msg.role === 'system') {
      wrapper.className = 'message-wrapper studio-system';
      wrapper.innerHTML = `<div class="message-bubble studio-system-bubble">${msg.content.replace(
        /\n/g,
        '<br>',
      )}</div>`;
    } else {
      wrapper.className = `message-wrapper ${roleClass}`;
      const bubble = document.createElement('div');
      bubble.className = `message-bubble ${roleClass}`;

      const chat = window.state.chats[activeStudioPlay.aiChatId];
      let avatarSrc = 'https://i.postimg.cc/PxZrFFFL/o-o-1.jpg'; // default avatar

      // Get the correct avatar based on role
      if (msg.role === 'user') {
        const userNickname = window.state.qzoneSettings.weiboNickname || 'Me';
        const userIdentityValue =
          activeStudioPlay.userRole === 1
            ? document.getElementById('studio-role1-identity-select').value
            : document.getElementById('studio-role2-identity-select').value;
        if (userIdentityValue !== 'user' && window.state.chats[userIdentityValue]) {
          avatarSrc = window.state.chats[userIdentityValue].settings.aiAvatar;
        } else {
          avatarSrc = window.state.qzoneSettings.avatar || avatarSrc;
        }
      } else {
        // assistant
        avatarSrc = chat?.settings?.aiAvatar || avatarSrc;
      }

      bubble.innerHTML = `<img src="${avatarSrc}" class="avatar"><div class="content">${msg.content.replace(
        /\n/g,
        '<br>',
      )}</div>`;
      wrapper.appendChild(bubble);
    }

    return wrapper;
  }

  /**
   * Handle user clicking "Re-roll" button to regenerate AI's last response
   */
  async function handleRerollPlay() {
    if (!activeStudioPlay || activeStudioPlay.history.length < 2) {
      alert('Not enough content to re-roll yet.');
      return;
    }

    // Undo last step — usually the last message is narration (system), second-to-last is AI reply (assistant)
    const lastMsg = activeStudioPlay.history[activeStudioPlay.history.length - 1];
    if (lastMsg && lastMsg.role === 'system' && lastMsg.content.includes('[Narration]')) {
      activeStudioPlay.history.pop();
    }

    const secondLastMsg = activeStudioPlay.history[activeStudioPlay.history.length - 1];
    if (secondLastMsg && secondLastMsg.role === 'assistant') {
      activeStudioPlay.history.pop();
    } else {
      // If narration failed after AI reply, there may only be the AI reply
      if (lastMsg && lastMsg.role === 'assistant') {
        activeStudioPlay.history.pop();
      }
    }

    // Re-render the screen to remove undone messages
    renderStudioPlayScreen();

    // Re-trigger AI response
    await triggerAiStudioResponse();
  }

  /**
   * Handle user sending an action during play
   */
  async function handleUserPlayAction() {
    const content = playInput.value.trim();
    if (!content) return;

    const userMessage = { role: 'user', content: content };
    activeStudioPlay.history.push(userMessage);

    // Clear input and refresh UI
    playInput.value = '';
    playInput.style.height = 'auto';
    playMessagesEl.appendChild(createPlayMessageElement(userMessage));
    playMessagesEl.scrollTop = playMessagesEl.scrollHeight;

    // Trigger AI response
    await triggerAiStudioResponse();
  }

  /**
   * Trigger AI response during play
   */
  async function triggerAiStudioResponse() {
    const { script, aiRole, aiChatId, history, aiIdentity, userPersona, role1Name, role2Name } = activeStudioPlay;
    const chat = window.state.chats[aiChatId];

    // If AI plays role 1, it's role1Name; opponent is role2Name, and vice versa.
    const aiActingName = aiRole === 1 ? role1Name : role2Name;
    const userActingName = aiRole === 1 ? role2Name : role1Name;

    // 1. Show "character is acting" indicator
    const actionTypingIndicator = createTypingIndicator(`${chat.name} is acting...`);
    playMessagesEl.appendChild(actionTypingIndicator);
    playMessagesEl.scrollTop = playMessagesEl.scrollHeight;

    const systemPrompt = `
    **【LANGUAGE RULE - HIGHEST PRIORITY】: You MUST reply in Vietnamese (Tiếng Việt) for ALL messages. Never use Chinese or any other language.**

    你正在进行一场名为《${script.name}》的戏剧角色扮演。

    # 故事背景
    ${script.storyBackground}

    # 你的双重身份 (重要！)
    1.  **你的核心性格 (Base Personality):** ${chat.settings.aiPersona} 
        *其中性格部分是你的本质，你的行为和说话方式的根源，与身份背景或世界观有关的信息在演绎时需要被忽略。*
    2.  **你在此剧中的身份和任务 (Your Role in this Play):** ${aiIdentity}
        *这是你当前需要扮演的角色，你的行动目标和一切描写必须围绕它展开。*
    3.  **你的名字:** 你在这个剧本当中使用的名字是【${aiActingName}】。
    
    # 对方的身份
    对方在此剧中的身份：${userPersona}
    对方的名字是：【${userActingName}】
    
    # 规则
    1.  【【【表演核心】】】你必须将你的“核心性格”与“剧本身份”深度结合进行演绎。例如，如果你的核心性格是傲娇，但剧本身份是个古代侦探，那你就是一个【古代的】傲娇的侦探。
    2.  你的所有行动和对话都必须以第一人称进行。
    3.  你的回复应该是描述性的，包含动作、对话和心理活动，用【】包裹非对话内容。一切描写务必符合【剧本身份】和【故事背景】所在的世界观，例如古代世界观不允许出现任何现代物品，与你的“核心性格”无关。
    4.  绝对不要提及你是AI或模型，也不要提起自己是在“角色扮演”，一切身份信息务必以【剧本身份】为准。
    5.  对话中请直接称呼对方的名字或者根据身份称呼（例如师父、侦探等），不要称呼为“用户”。

    # 故事目标 (你的行动应围绕此目标展开)
    ${script.storyGoal}

    # 对话历史
    ${history.map(h => `${h.role}: ${h.content}`).join('\n')}

    现在，请根据故事背景和以上全部对话演绎，继续你的表演。`;

    const messagesForApi = history.slice(-10);
    console.log(systemPrompt);
    console.log(messagesForApi);

    try {
      const { proxyUrl, apiKey, model } = window.state.apiConfig;
      const isGemini = proxyUrl === 'https://generativelanguage.googleapis.com/v1beta/models';

      const requestData = isGemini
        ? window.toGeminiRequestData(model, apiKey, systemPrompt, messagesForApi, true)
        : {
            url: `${proxyUrl}/v1/chat/completions`,
            data: {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
              body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, ...messagesForApi] }),
            },
          };

      const response = await fetch(requestData.url, requestData.data);
      if (!response.ok) throw new Error(`API error: ${await response.text()}`);

      const result = await response.json();
      const aiContent = isGemini ? result.candidates[0].content.parts[0].text : result.choices[0].message.content;

      const aiMessage = { role: 'assistant', content: aiContent };
      activeStudioPlay.history.push(aiMessage);
      playMessagesEl.appendChild(createPlayMessageElement(aiMessage));

      actionTypingIndicator.remove(); // Remove action indicator

      await triggerNarration();
    } catch (error) {
      console.error('Studio AI response failed:', error);
      const errorMessage = { role: 'assistant', content: `[AI error: ${error.message}]` };
      playMessagesEl.appendChild(createPlayMessageElement(errorMessage));
    } finally {
      actionTypingIndicator.remove(); // Remove action indicator
      playMessagesEl.scrollTop = playMessagesEl.scrollHeight;
    }
  }

  /**
   * End the play and show summary modal
   * @param {boolean} isSuccess - Whether it's a successful ending
   */
  function endStudioPlay(isSuccess = false) {
    document.getElementById('studio-summary-title').textContent = isSuccess ? 'Play Succeeded!' : 'Play Ended';
    document.getElementById('studio-summary-content').textContent = `Story Goal: ${activeStudioPlay.script.storyGoal}`;
    summaryModal.classList.add('visible');
  }

  /**
   * Generate a novel from the play history
   */
  async function generateNovelFromPlay() {
    await showCustomAlert('Please Wait', 'Converting your play session into a novel...');

    const { script, history, userRole, aiChatId, role1Name, role2Name } = activeStudioPlay;
    const chat = window.state.chats[aiChatId];

    const systemPrompt = `
    **【LANGUAGE RULE - HIGHEST PRIORITY】: You MUST reply in Vietnamese (Tiếng Việt) for ALL messages. Never use Chinese or any other language.**

    # 你的任务
    你是一位出色的小说家。请根据下面的剧本设定和对话历史，将这段角色扮演的过程改编成一篇引人入胜的短篇小说。

    # 剧本设定
    - 剧本名: ${script.name}
    - 故事背景: ${script.storyBackground}
    - 角色1 (由 ${role1Name} 饰演): ${script.character1_identity}
    - 角色2 (由 ${role2Name} 饰演): ${script.character2_identity}
    - 故事目标: ${script.storyGoal}

    # 对话历史
    ${history
      .map(h => {
        // Format role display for AI clarity
        let roleName =
          h.role === 'user' ? (userRole === 1 ? role1Name : role2Name) : userRole === 1 ? role2Name : role1Name;
        // If system narration
        if (h.role === 'system') return `[Narration/System]: ${h.content}`;
        return `${roleName}: ${h.content}`;
      })
      .join('\n')}

    # 写作要求
    1. 使用第三人称叙事。
    2. **重要**：请在小说中使用角色的具体名字（${role1Name} 和 ${role2Name}）来称呼他们，而不是使用“人物1”或“用户”。
    3. 保持故事的连贯性和逻辑性。
    4. 丰富人物的心理活动和环境描写，将对话无缝融入到叙事中。
    5. 最终得出一个清晰的结局，并点明故事目标是否达成。
    6. 小说内容要完整、精彩，字数在1000字以上。
    `;

    try {
      const { proxyUrl, apiKey, model } = window.state.apiConfig;
      const isGemini = proxyUrl === 'https://generativelanguage.googleapis.com/v1beta/models';
      const requestData = isGemini
        ? window.toGeminiRequestData(model, apiKey, systemPrompt, [{ role: 'user', content: 'Please begin the story.' }], true)
        : {
            url: `${proxyUrl}/v1/chat/completions`,
            data: {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
              body: JSON.stringify({ model, messages: [{ role: 'user', content: systemPrompt }], temperature: 0.7 }),
            },
          };

      const response = await fetch(requestData.url, requestData.data);
      if (!response.ok) throw new Error(`API error: ${await response.text()}`);

      const result = await response.json();
      const novelText = isGemini ? result.candidates[0].content.parts[0].text : result.choices[0].message.content;

      // Save story record
      const myNickname = window.state.qzoneSettings.nickname || 'Me';
      const historyRecord = {
        scriptName: script.name,
        storyGoal: script.storyGoal,
        novelContent: novelText,
        timestamp: Date.now(),
        participants: {
          role1: role1Name,
          role2: role2Name,
        },
      };
      await db.studioHistory.add(historyRecord);
      console.log('Story record saved to database successfully!');

      document.getElementById('studio-novel-content').textContent = novelText;
      novelModal.classList.add('visible');
      summaryModal.classList.remove('visible');
    } catch (error) {
      console.error('Novel generation failed:', error);
      await showCustomAlert('Generation Failed', `An error occurred: ${error.message}`);
    }
  }

  /**
   * Share the generated novel with participating characters
   */
  async function shareNovel() {
    const novelText = document.getElementById('studio-novel-content').textContent;
    if (!novelText) return;

    const { aiChatId } = activeStudioPlay;
    const chat = window.state.chats[aiChatId];

    const confirmed = await showCustomConfirm('Confirm Share', `Are you sure you want to share this novel with "${chat.name}"?`);

    if (confirmed) {
      const shareMessage = {
        role: 'user',
        type: 'share_link',
        title: `Our co-written novel: "${activeStudioPlay.script.name}"`,
        description: 'Click to read our co-created story!',
        source_name: 'Studio',
        content: novelText,
        timestamp: Date.now(),
      };

      chat.history.push(shareMessage);
      await db.chats.put(chat);

      novelModal.classList.remove('visible');
      alert('Shared successfully!');
      // Optionally navigate back to chat screen
      openChat(aiChatId);
    }
  }

  // ===================================================================
  // 4. Event Listeners
  // ===================================================================
  if (studioAppIcon) {
    studioAppIcon.addEventListener('click', showStudioScreen);
  }

  const studioHistoryBtn = document.getElementById('studio-history-btn');
  if (studioHistoryBtn) {
    studioHistoryBtn.addEventListener('click', openStudioHistoryScreen);
  }

  const backFromHistoryBtn = document.getElementById('back-from-studio-history');
  if (backFromHistoryBtn) {
    backFromHistoryBtn.addEventListener('click', showStudioScreen);
  }

  if (addScriptBtn) {
    addScriptBtn.addEventListener('click', () => openStudioEditor(null));
  }

  if (addScriptBtn) {
    addScriptBtn.addEventListener('click', () => openStudioEditor(null));
  }

  if (backFromEditorBtn) {
    backFromEditorBtn.addEventListener('click', showStudioScreen);
  }

  if (saveScriptBtn) {
    saveScriptBtn.addEventListener('click', saveStudioScript);
  }

  if (aiGenerateScriptBtn) {
    aiGenerateScriptBtn.addEventListener('click', generateScriptWithAI);
  }

  if (roleSelectionModal) {
    document.getElementById('cancel-role-selection-btn').addEventListener('click', () => {
      roleSelectionModal.classList.remove('visible');
    });
    document.getElementById('confirm-role-selection-btn').addEventListener('click', startStudioPlay);
  }

  if (exitPlayBtn) {
    exitPlayBtn.addEventListener('click', async () => {
      const confirmed = await showCustomConfirm('Confirm Exit', 'Are you sure you want to exit this play session?', {
        confirmButtonClass: 'btn-danger',
      });
      if (confirmed) {
        endStudioPlay(false);
      }
    });
  }

  if (rerollPlayBtn) {
    rerollPlayBtn.addEventListener('click', handleRerollPlay);
  }

  if (sendPlayActionBtn) {
    sendPlayActionBtn.addEventListener('click', handleUserPlayAction);
    playInput.addEventListener('keypress', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleUserPlayAction();
      }
    });
  }

  if (summaryModal) {
    document.getElementById('generate-novel-btn').addEventListener('click', generateNovelFromPlay);
    document.getElementById('close-studio-summary-btn').addEventListener('click', () => {
      summaryModal.classList.remove('visible');
      showStudioScreen(); // Return to script list
    });
  }

  if (novelModal) {
    document.getElementById('share-novel-btn').addEventListener('click', shareNovel);
    document.getElementById('close-novel-share-btn').addEventListener('click', () => {
      novelModal.classList.remove('visible');
      showStudioScreen();
    });
  }
  // ▼▼▼ Import/Export event bindings ▼▼▼

  // 1. Import button click -> trigger file picker
  if (importScriptBtn) {
    importScriptBtn.addEventListener('click', () => {
      importInput.click();
    });
  }

  // 2. File selection changed -> execute import logic
  if (importInput) {
    importInput.addEventListener('change', handleScriptImport);
  }

  // 3. Export button click
  if (exportScriptBtn) {
    exportScriptBtn.addEventListener('click', exportCurrentScript);
  }

  // ▲▲▲ End of import/export bindings ▲▲▲
  /**
   * Open the story history screen
   */
  async function openStudioHistoryScreen() {
    await renderStudioHistoryList();
    showScreen('studio-history-screen');
  }

  /**
   * Render the story history list
   */
  async function renderStudioHistoryList() {
    const listEl = document.getElementById('studio-history-list');
    if (!listEl) return;

    // Get all records in reverse chronological order
    const records = await db.studioHistory.orderBy('timestamp').reverse().toArray();
    listEl.innerHTML = '';

    if (records.length === 0) {
      listEl.innerHTML =
        '<p style="text-align:center; color: var(--text-secondary); padding: 50px 0;">No stories completed yet.</p>';
      return;
    }

    records.forEach(record => {
      const item = document.createElement('div');
      item.className = 'studio-script-item'; // Reuse script list styles
      const recordDate = new Date(record.timestamp);

      item.innerHTML = `
                <div class="title">${record.scriptName}</div>
                <div class="goal" style="margin-top: 5px;">🎭 Participants: ${record.participants.role1}, ${
        record.participants.role2
      }</div>
                <div class="goal" style="font-size: 12px; margin-top: 8px;">Recorded on: ${recordDate.toLocaleString()}</div>
            `;

      item.addEventListener('click', () => viewStudioHistoryDetail(record.id));

      // Add long-press to delete
      addLongPressListener(item, async () => {
        const confirmed = await showCustomConfirm('Delete Record', 'Are you sure you want to delete this story record? This cannot be undone.', {
          confirmButtonClass: 'btn-danger',
        });
        if (confirmed) {
          await deleteStudioHistory(record.id);
        }
      });
      listEl.appendChild(item);
    });
  }

  /**
   * View details (novel content) of a specific story record
   * @param {number} recordId - Record ID
   */
  async function viewStudioHistoryDetail(recordId) {
    const record = await db.studioHistory.get(recordId);
    if (!record) {
      alert('Record not found!');
      return;
    }

    // Reuse novel share modal to display content
    const novelContentEl = document.getElementById('studio-novel-content');
    novelContentEl.textContent = record.novelContent;

    // Modify modal buttons to show only "Close"
    const footer = novelModal.querySelector('.modal-footer');
    footer.innerHTML = `<button class="save" id="close-history-view-btn" style="width:100%">Close</button>`;
    document.getElementById('close-history-view-btn').addEventListener('click', () => {
      novelModal.classList.remove('visible');
    });

    novelModal.classList.add('visible');
  }

  /**
   * Delete a story record
   * @param {number} recordId - Record ID
   */
  async function deleteStudioHistory(recordId) {
    await db.studioHistory.delete(recordId);
    await renderStudioHistoryList(); // Refresh list
    alert('Story record deleted.');
  }

  const deleteScriptBtn = document.getElementById('delete-studio-script-btn');
  if (deleteScriptBtn) {
    deleteScriptBtn.addEventListener('click', async () => {
      if (!activeStudioScriptId) return;

      const script = await db.studioScripts.get(activeStudioScriptId);
      const scriptName = script ? script.name : 'this script';

      const confirmed = await showCustomConfirm('Confirm Delete', `Are you sure you want to permanently delete the script "${scriptName}"? This cannot be undone.`, {
        confirmButtonClass: 'btn-danger',
      });

      if (confirmed) {
        await db.studioScripts.delete(activeStudioScriptId);
        activeStudioScriptId = null;
        alert('Script deleted.');
        showStudioScreen(); // Return to script list
      }
    });
  }

  /**
   * Create a typing indicator element
   * @param {string} text - Text to display
   * @returns {HTMLElement}
   */
  function createTypingIndicator(text) {
    const indicator = document.createElement('div');
    indicator.className = 'message-wrapper studio-indicator';
    // Use same bubble style as narration for consistency
    indicator.innerHTML = `<div class="message-bubble studio-system-bubble" style="opacity: 0.8;">${text}</div>`;
    return indicator;
  }

  /**
   * Trigger narration generation (includes ending detection)
   */
  async function triggerNarration() {
    const { script, history } = activeStudioPlay;

    const narrationTypingIndicator = createTypingIndicator('Story unfolding...');
    playMessagesEl.appendChild(narrationTypingIndicator);
    playMessagesEl.scrollTop = playMessagesEl.scrollHeight;

    const narrationPrompt = `
    # 你的任务
    你是一个掌控故事节奏的“地下城主”(DM)或“旁白”。你的主要任务是根据剧本设定和已发生的对话，推动情节发展。

    # 剧本设定
    - 剧本名: ${script.name}
    - 故事背景: ${script.storyBackground}
    - 故事目标: ${script.storyGoal}

    # 已发生的对话历史
    ${history.map(h => `${h.role}: ${h.content}`).join('\n')}

    # 【第一任务：结局判定 (最高优先级)】
    1.  首先，请仔细阅读上方的【故事目标】。
    2.  然后，审视【已发生的对话历史】，判断角色的行动和对话是否已经明确达成了【故事目标】。
    3.  如果【故事目标已达成】且剧情已完整，你的回复【必须且只能】是一个JSON对象，格式如下：
        {"isEnd": true, "narration": "在这里写下总结性的结局旁白，例如：随着真相大白，这场风波终于落下帷幕..."}
    4.  如果【故事目标未达成】或剧情尚在发展中，请继续执行你的第二任务。

    # 【第二任务：旁白生成 (当结局未达成时执行)】
    1.  **保持中立**: 以第三人称客观视角进行描述，不要带有任何角色的主观情绪，也不可以包含任何角色的行动或感受。
    2.  **推进剧情**: 你的旁白应该引入新的事件、新的线索、环境的变化或意想不到的转折。
    3.  **控制节奏**: 不要过快地让角色达成最终目标。你的任务是制造波折和悬念，让故事更有趣。
    4.  **简短精悍**: 旁白内容不宜过长，几句话即可。
    5.  **禁止对话**: 你的回复【只能是旁白描述】，绝对不能包含任何角色的对话。

    现在，请根据以上所有信息，开始你的工作。`;

    try {
      const responseText = await getApiResponse(narrationPrompt);

      // Try to parse AI reply to detect ending signal
      try {
        const parsedResponse = JSON.parse(responseText);
        if (parsedResponse.isEnd === true && parsedResponse.narration) {
          // AI confirmed the ending is reached
          const finalNarration = { role: 'system', content: `[Ending]\n${parsedResponse.narration}` };
          activeStudioPlay.history.push(finalNarration);
          playMessagesEl.appendChild(createPlayMessageElement(finalNarration));

          // Brief delay, then show success summary window
          setTimeout(() => {
            endStudioPlay(true);
          }, 1500);

          return; // End function, no further logic needed
        }
      } catch (e) {
        // Parse failed — AI returned plain narration text, not a JSON ending signal; continue normally
      }

      // If we reach here, ending not yet reached; handle narration normally
      if (responseText) {
        const narrationMessage = { role: 'system', content: `[Narration]\n${responseText}` };
        activeStudioPlay.history.push(narrationMessage);
        playMessagesEl.appendChild(createPlayMessageElement(narrationMessage));
      }
    } catch (error) {
      console.error('Narration generation failed:', error);
      const errorMessage = { role: 'system', content: `[Narration failed: ${error.message}]` };
      playMessagesEl.appendChild(createPlayMessageElement(errorMessage));
    } finally {
      narrationTypingIndicator.remove();
      playMessagesEl.scrollTop = playMessagesEl.scrollHeight;
    }
  }

  /**
   * Generic AI API request function
   * @param {string} systemPrompt - System instructions sent to AI
   * @returns {Promise<string>} AI response text
   */
  async function getApiResponse(systemPrompt) {
    const { proxyUrl, apiKey, model } = window.state.apiConfig;
    const isGemini = proxyUrl === 'https://generativelanguage.googleapis.com/v1beta/models';

    const temperature = parseFloat(window.state.apiConfig.temperature) || 0.8;

    // Add a user message to form a valid conversation for OpenAI-compatible APIs
    const messagesForApi = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Please begin your performance.' },
    ];

    const requestData = isGemini
      ? window.toGeminiRequestData(
          model,
          apiKey,
          systemPrompt,
          [{ role: 'user', content: 'Please begin your performance.' }],
          true,
          temperature,
        )
      : {
          url: `${proxyUrl}/v1/chat/completions`,
          data: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ model, messages: messagesForApi, temperature }),
          },
        };

    const response = await fetch(requestData.url, requestData.data);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    // Robust check on API return value
    const aiContent = isGemini
      ? result?.candidates?.[0]?.content?.parts?.[0]?.text
      : result?.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error('API returned empty content, possibly due to a safety policy trigger.');
    }

    return aiContent.trim();
  }
});
