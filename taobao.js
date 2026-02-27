let currentEditingProductId = null; // Track the product ID currently being edited
let currentEditingFoodId = null;
let logisticsUpdateTimers = [];
let isSelectionMode = false;
let notificationTimeout;
let imageGenerationQueue = []; // Global image generation task queue
let isProcessingImage = false; // A flag to prevent the queue from being processed multiple times simultaneously
// 物流时间线模板 (delay单位是毫秒)
// 你可以随意修改这里的文本和延迟时间，打造你自己的物流故事！
const logisticsTimelineTemplate = [
  { text: "Your order has been placed", delay: 1000 * 2 }, // 2 seconds
  { text: "Payment successful, waiting for seller to pack", delay: 1000 * 10 }, // 10 seconds later
  { text: "[{city} Warehouse] Packed, waiting for courier pickup", delay: 1000 * 60 * 5 }, // 5 minutes later
  { text: "[{city} Express] Picked up", delay: 1000 * 60 * 20 }, // 20 minutes later
  { text: "Package has arrived at [{city} Sorting Center]", delay: 1000 * 60 * 60 * 2 }, // 2 hours later
  {
    text: "[{city} Sorting Center] Departed, next stop [{next_city}]",
    delay: 1000 * 60 * 60 * 8,
  }, // 8 hours later
  { text: "Package has arrived at [{user_city} Transfer Center]", delay: 1000 * 60 * 60 * 20 }, // 20 hours later
  {
    text: "Package is out for delivery. Courier: TuTu Express, Tel: 123-4567-8910, please keep your phone on",
    delay: 1000 * 60 * 60 * 24,
  }, // 24 hours later
  {
    text: "Your package has been delivered. Thank you for shopping at Taobao, hope to serve you again!",
    delay: 1000 * 60 * 60 * 28,
  }, // 28 hours later
];
/* --- 娃娃机逻辑开始 --- */

// 1. 默认娃娃图片列表 (在这里替换你想给用户的默认图片URL)
const DEFAULT_DOLL_IMAGES = [
  "https://i.postimg.cc/3rCsgRTN/tkwwj2.png",
  "https://i.postimg.cc/yxB2MqFB/tkwwj.png",
  "https://i.postimg.cc/3xnr91QF/tkwwj12.png",
  "https://i.postimg.cc/8ztkw4gH/tkwwj11.png",
  "https://i.postimg.cc/dV4Qn6c9/tkwwj10.png",
  "https://i.postimg.cc/9MvHk9DZ/wwj6.png",
];

// 2. 奖励等级配置
const REWARD_TIERS = [
  { type: "coin_small", value: 10, label: "Small Coins", prob: 40, color: "#edd1d1" },
  { type: "coin_mid", value: 50, label: "Red Envelope", prob: 30, color: "#d4a5a5" },
  { type: "coin_big", value: 100, label: "Jackpot", prob: 15, color: "#b58e8e" },
  { type: "bad_luck", value: -20, label: "Deduction", prob: 10, color: "#9e9e9e" },
  { type: "mystery", value: 0, label: "Mystery", prob: 5, color: "#c9c0bb" },
];

let clawState = {
  x: 50,
  y: 0,
  isGrabbing: false,
  joystickInterval: null,
};

async function initClawMachineData() {
  const count = await db.clawMachineDolls.count();
  if (count === 0) {
    console.log("Initialize default doll images...");
    const dollObjects = DEFAULT_DOLL_IMAGES.map((url) => ({ url: url }));
    await db.clawMachineDolls.bulkAdd(dollObjects);
  }
}

async function openClawMachine() {
  await initClawMachineData();
  const modal = document.getElementById("claw-machine-modal");
  modal.classList.add("visible");
  updateClawBalanceDisplay();
  await resetClawMachine(); // Reset and generate new dolls
  initJoystick();
}

function updateClawBalanceDisplay() {
  document.getElementById("claw-machine-balance").textContent = (
    state.globalSettings.userBalance || 0
  ).toFixed(2);
}

// ★★★ Core modification: Render real-time statistics pie chart ★★★
// This function now reads the actual elements in #doll-pool instead of the configuration table
function renderRealTimeStats() {
  const pieChart = document.getElementById("prob-pie-chart");
  const legendEl = document.getElementById("prob-legend");
  legendEl.innerHTML = "";

  const dolls = document.querySelectorAll("#doll-pool .game-doll");
  const totalCount = dolls.length;

  if (totalCount === 0) {
    pieChart.style.background = "#eee";
    legendEl.innerHTML = "No Dolls";
    return;
  }

  // 1. 统计当前池子里每种类型的数量
  const counts = {};
  dolls.forEach((d) => {
    const type = d.dataset.type;
    counts[type] = (counts[type] || 0) + 1;
  });

  // 2. 生成饼图 CSS 和 图例
  let gradientStr = "";
  let currentDeg = 0;

  // 遍历配置表是为了保证颜色和顺序一致，但数据用的是上面统计的 counts
  let hasData = false;

  REWARD_TIERS.forEach((tier, index) => {
    const count = counts[tier.type] || 0;
    if (count > 0) {
      hasData = true;
      const percent = count / totalCount;
      const degrees = percent * 360;
      const endDeg = currentDeg + degrees;

      // 拼接 CSS
      gradientStr += `${tier.color} ${currentDeg}deg ${endDeg}deg`;
      // 如果不是最后一段，加逗号
      // 这里有个小逻辑问题：forEach里面很难判断是不是最后一个有数据的tier
      // 所以我们加个简单的逗号处理逻辑：在每次添加前检查是否需要加逗号

      currentDeg = endDeg;

      // 生成图例
      const legendItem = document.createElement("div");
      legendItem.className = "legend-item";
      legendItem.innerHTML = `
                <div class="legend-dot" style="background: ${tier.color}"></div>
                <span>${tier.label} x${count}</span>
            `;
      legendEl.appendChild(legendItem);
    }
  });

  // 修复 CSS 逗号问题：简单的做法是直接用逗号拼接，最后如果有逗号不影响（CSS宽容度），
  // 或者更严谨地处理。这里我们重组一下 gradientStr
  // 上面的循环直接拼会有问题，我们改用 map + join

  let gradients = [];
  currentDeg = 0;
  REWARD_TIERS.forEach((tier) => {
    const count = counts[tier.type] || 0;
    if (count > 0) {
      const percent = count / totalCount;
      const degrees = percent * 360;
      const endDeg = currentDeg + degrees;
      gradients.push(`${tier.color} ${currentDeg}deg ${endDeg}deg`);
      currentDeg = endDeg;
    }
  });

  if (gradients.length > 0) {
    pieChart.style.background = `conic-gradient(${gradients.join(", ")})`;
  } else {
    pieChart.style.background = "#eee";
  }
}

function getRandomRewardTier() {
  const totalWeight = REWARD_TIERS.reduce((sum, item) => sum + item.prob, 0);
  let randomNum = Math.random() * totalWeight;
  for (let tier of REWARD_TIERS) {
    if (randomNum < tier.prob) return tier;
    randomNum -= tier.prob;
  }
  return REWARD_TIERS[0];
}

// 重置/刷新娃娃机
async function resetClawMachine() {
  // 增加刷新动画反馈
  const pool = document.getElementById("doll-pool");
  pool.style.opacity = "0";

  clawState.x = 50;
  clawState.y = 0;
  clawState.isGrabbing = false;
  updateClawPosition();

  await new Promise((r) => setTimeout(r, 200)); // 稍作停顿
  pool.innerHTML = "";

  const availableImages = await db.clawMachineDolls.toArray();
  if (availableImages.length === 0) {
    pool.innerHTML =
      '<div style="text-align:center; padding-top:100px; color:#fff;">No image library...<br>Please click ⚙️ to add</div>';
    pool.style.opacity = "1";
    return;
  }

  const count = Math.floor(Math.random() * 6) + 10; // 10-15个

  for (let i = 0; i < count; i++) {
    const tierConfig = getRandomRewardTier();
    const imageObj =
      availableImages[Math.floor(Math.random() * availableImages.length)];

    const doll = document.createElement("div");
    doll.className = "game-doll";
    doll.dataset.type = tierConfig.type;
    doll.dataset.value = tierConfig.value;
    doll.dataset.label = tierConfig.label;

    doll.style.backgroundImage = `url(${imageObj.url})`;
    doll.style.left = Math.random() * 80 + "%";
    doll.style.bottom = Math.random() * 40 + "px";
    doll.style.transform = `rotate(${Math.random() * 60 - 30}deg)`;

    pool.appendChild(doll);
  }

  pool.style.opacity = "1";
  document.getElementById("claw-grab-btn").disabled = false;

  // ★★★ 关键：生成完娃娃后，立即计算并渲染饼图 ★★★
  renderRealTimeStats();
}

function updateClawPosition() {
  const claw = document.getElementById("machine-claw");
  clawState.x = Math.max(5, Math.min(95, clawState.x));
  claw.style.left = `${clawState.x}%`;
}

function initJoystick() {
  const joystick = document.getElementById("machine-joystick");
  const newJoystick = joystick.cloneNode(true);
  joystick.parentNode.replaceChild(newJoystick, joystick);

  const activeJoystick = document.getElementById("machine-joystick");
  let isDragging = false;
  let startX = 0;

  const startMove = (e) => {
    if (clawState.isGrabbing) return;
    isDragging = true;
    startX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
    activeJoystick.style.transition = "none";
  };

  const move = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const currentX = e.type.includes("mouse")
      ? e.clientX
      : e.touches[0].clientX;
    const deltaX = currentX - startX;
    const maxDist = 20;
    const moveX = Math.max(-maxDist, Math.min(maxDist, deltaX));
    activeJoystick.style.transform = `translate(calc(-50% + ${moveX}px), -50%)`;
    if (Math.abs(moveX) > 5) {
      clawState.x += moveX * 0.05;
      updateClawPosition();
    }
  };

  const endMove = () => {
    isDragging = false;
    activeJoystick.style.transition = "transform 0.2s";
    activeJoystick.style.transform = `translate(-50%, -50%)`;
  };

  activeJoystick.addEventListener("mousedown", startMove);
  document.addEventListener("mousemove", move);
  document.addEventListener("mouseup", endMove);
  activeJoystick.addEventListener("touchstart", startMove);
  document.addEventListener("touchmove", move);
  document.addEventListener("touchend", endMove);
}

// 刷新按钮功能
async function handleRestartClaw() {
  // 可以设置是否扣费刷新，这里暂定为免费
  // 如果要扣费：
  /*
    if (state.globalSettings.userBalance < 5) { alert('余额不足5元，无法刷新'); return; }
    await updateUserBalanceAndLogTransaction(-5, "刷新娃娃机");
    updateClawBalanceDisplay();
    */

  const btn = document.getElementById("claw-restart-btn");
  btn.classList.add("rotating"); // 加一个旋转动画class效果更好
  await resetClawMachine();
  setTimeout(() => btn.classList.remove("rotating"), 500);
}

async function handleGrab() {
  if (clawState.isGrabbing) return;
  clawState.isGrabbing = true;

  // 每次抓取扣除 2 元 (在此处实现投币逻辑)
  // if ((state.globalSettings.userBalance || 0) < 2) {
  //     alert("余额不足 2 元，无法启动！");
  //     clawState.isGrabbing = false;
  //     return;
  // }
  // await updateUserBalanceAndLogTransaction(-2, "娃娃机投币");
  // updateClawBalanceDisplay();

  const btn = document.getElementById("claw-grab-btn");
  const claw = document.getElementById("machine-claw");
  btn.disabled = true;

  // 1. 下落
  claw.style.transition = "top 1s ease-in";
  claw.style.top = "70%";

  await new Promise((r) => setTimeout(r, 1000));

  // 2. 抓取
  claw.classList.add("grabbing");

  // 3. 碰撞检测
  const clawRect = claw.getBoundingClientRect();
  const dolls = document.querySelectorAll("#doll-pool .game-doll"); // 确保只选池子里的
  let caughtDoll = null;
  let minDistance = Infinity;

  dolls.forEach((doll) => {
    const dollRect = doll.getBoundingClientRect();
    const dist = Math.abs(
      clawRect.left + clawRect.width / 2 - (dollRect.left + dollRect.width / 2),
    );
    if (dist < 30) {
      if (dist < minDistance) {
        minDistance = dist;
        caughtDoll = doll;
      }
    }
  });

  // 4. 上升
  if (caughtDoll) {
    caughtDoll.classList.add("caught");
    caughtDoll.style.left = "50%";
    caughtDoll.style.top = "10px";
    caughtDoll.style.bottom = "auto";
    caughtDoll.style.transform = "translate(-50%, 0)";
    claw.appendChild(caughtDoll);
  }

  await new Promise((r) => setTimeout(r, 500));
  claw.style.transition = "top 1s ease-out";
  claw.style.top = "0";

  await new Promise((r) => setTimeout(r, 1000));

  // 5. 移到出口
  claw.style.transition = "left 1s linear";
  claw.style.left = "15%";

  await new Promise((r) => setTimeout(r, 1000));

  // 6. 松开
  claw.classList.remove("grabbing");

  if (caughtDoll) {
    caughtDoll.style.transition = "top 0.5s ease-in";
    caughtDoll.style.top = "200px"; // 掉落动画

    await new Promise((r) => setTimeout(r, 500));

    const type = caughtDoll.dataset.type;
    let value = parseFloat(caughtDoll.dataset.value);
    const label = caughtDoll.dataset.label;
    let message = "";

    if (type === "mystery") {
      const input = await showCustomPrompt(
        "Caught a Mystery Doll!",
        "Enter the amount you want to receive:",
        "",
        "number",
      );
      if (input !== null) {
        value = parseFloat(input);
        if (isNaN(value)) value = 0;
        message = `Mystery power activated! Balance increased by ¥${value.toFixed(2)}`;
      } else {
        value = 0;
        message = "You gave up the mystery reward.";
      }
    } else if (value < 0) {
      message = `Oh no! Caught a prank doll! Deducted ¥${Math.abs(value)}`;
    } else {
      message = `Congratulations! Caught a ${label} doll, earned ¥${value}!`;
    }

    if (value !== 0) {
      if (window.updateUserBalanceAndLogTransaction) {
        await window.updateUserBalanceAndLogTransaction(value, "Claw machine reward");
      }
      updateClawBalanceDisplay();
      if (typeof renderBalanceDetails === "function")
        await renderBalanceDetails();
    }

    alert(message);
    caughtDoll.remove();

    // ★★★ 抓走娃娃后，池子里的娃娃变少了，重新计算概率饼图 ★★★
    renderRealTimeStats();
  } else {
    await showCustomPrompt(
      "So Close!",
      "Almost caught it! Try again?",
      "Go for it",
      "text",
    );
  }

  // 7. 复位
  claw.style.transition = "left 0.5s ease";
  claw.style.left = "50%";
  clawState.x = 50;

  await new Promise((r) => setTimeout(r, 500));
  clawState.isGrabbing = false;
  btn.disabled = false;
}

// 娃娃管理逻辑 (保持不变)
async function openDollManager() {
  await renderDollManagerGrid();
  document.getElementById("doll-manager-modal").classList.add("visible");
}

async function renderDollManagerGrid() {
  const grid = document.getElementById("doll-manager-grid");
  grid.innerHTML = "";
  const dolls = await db.clawMachineDolls.toArray();

  dolls.forEach((doll) => {
    const item = document.createElement("div");
    item.style.cssText = `
            position: relative; width: 80px; height: 80px;
            background-image: url(${doll.url}); background-size: cover; background-position: center;
            border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        `;
    const delBtn = document.createElement("div");
    delBtn.innerHTML = "×";
    delBtn.style.cssText = `
            position: absolute; top: -5px; right: -5px; width: 20px; height: 20px;
            background: #ff4d4f; color: white; border-radius: 50%; text-align: center; line-height: 18px;
            cursor: pointer; font-weight: bold;
        `;
    delBtn.onclick = async () => {
      if (confirm("Are you sure you want to delete this doll?")) {
        await db.clawMachineDolls.delete(doll.id);
        renderDollManagerGrid();
      }
    };
    item.appendChild(delBtn);
    grid.appendChild(item);
  });
}

async function handleAddDoll() {
  const choice = await showChoiceModal("Add Doll", [
    { text: "📁 Local Upload (multi-select supported)", value: "local" },
    { text: "🌐 Network URL", value: "url" },
  ]);
  if (choice === "local") {
    document.getElementById("doll-upload-input").click();
  } else if (choice === "url") {
    const url = await showCustomPrompt("Enter URL", "Please enter the image link");
    if (url && url.trim()) {
      await db.clawMachineDolls.add({ url: url.trim() });
      renderDollManagerGrid();
    }
  }
}

async function handleDollFileChange(e) {
  const files = e.target.files;
  if (!files.length) return;
  for (const file of files) {
    const base64 = await handleImageUploadAndCompress(file);
    await db.clawMachineDolls.add({ url: base64 });
  }
  renderDollManagerGrid();
  e.target.value = null;
}

async function resetDefaultDolls() {
  if (confirm("Are you sure you want to clear all dolls and restore defaults?")) {
    await db.clawMachineDolls.clear();
    const dollObjects = DEFAULT_DOLL_IMAGES.map((url) => ({ url: url }));
    await db.clawMachineDolls.bulkAdd(dollObjects);
    renderDollManagerGrid();
    alert("Default dolls restored!");
  }
}

/* --- 娃娃机逻辑结束 --- */

const addProductChoiceModal = document.getElementById(
  "add-product-choice-modal",
);
const aiGeneratedProductsModal = document.getElementById(
  "ai-generated-products-modal",
);
const productSearchInput = document.getElementById("product-search-input");
const productSearchBtn = document.getElementById("product-search-btn");
const STICKER_REGEX = /^(https?:\/\/.+|data:image)/;

// 全局的、通用的商品图片提示词模板库
// 我们会根据商品名称的关键词来智能匹配这些模板
const GENERIC_PRODUCT_PROMPTS = [
  {
    keywords: [
      "clothes",
      "dress",
      "pants",
      "t-shirt",
      "shirt",
      "coat",
      "hoodie",
      "sweater",
      "apparel",
      "outfit",
    ],
    englishCategory: "a piece of fashion clothing",
    prompt:
      "A piece of modern clothing, {productName}, elegantly displayed on a mannequin or lying flat, clean minimalist studio shot, professional product photography, soft shadows, solid color background, high detail, photorealistic, 8k",
  },
  {
    keywords: ["shoes", "boots", "sneaker", "boot"],
    englishCategory: "a modern sneaker",
    prompt:
      "A single modern shoe, {productName}, studio product shot, minimalist, on a solid color platform, detailed, photorealistic, commercial photography, soft studio lighting",
  },
  {
    keywords: ["bag", "pouch", "backpack", "handbag"],
    englishCategory: "a stylish modern bag",
    prompt:
      "A stylish modern bag, {productName}, professional product photography, minimalist, clean background, studio lighting, high fashion, high detail, 8k, hyperrealistic",
  },
  {
    keywords: [
      "phone",
      "earphones",
      "keyboard",
      "mouse",
      "data cable",
      "charger",
      "digital",
      "electronics",
    ],
    englishCategory: "a sleek electronic gadget",
    prompt:
      "A sleek electronic gadget, {productName}, on a clean modern desk, minimalist product shot, tech aesthetic, studio lighting, photorealistic, octane render, 8k",
  },
  {
    keywords: [
      "snacks",
      "cookies",
      "chips",
      "candy",
      "chocolate",
      "water",
      "beverage",
      "tea",
      "coffee",
      "food",
      "snack",
      "noodles",
      "rice",
      "burger",
      "milk tea",
    ],
    englishCategory: "a delicious-looking food or drink product",
    prompt:
      "Delicious-looking {productName}, professional product shot, appetizing, packaging or food itself displayed, minimalist setup, vibrant colors, solid color background, high detail, food photography",
  },
  {
    keywords: [
      "cup",
      "bowl",
      "plate",
      "pot",
      "lamp",
      "blanket",
      "pillow",
      "home decor",
      "ornament",
      "decoration",
    ],
    englishCategory: "a modern home decor item",
    prompt:
      "A modern home decor item, {productName}, in a cozy and minimalist living room setting, soft lighting, professional product shot, high detail, photorealistic, interior design magazine style",
  },
  {
    keywords: ["makeup", "skincare", "lipstick", "eyeshadow", "perfume", "face mask"],
    englishCategory: "a cosmetic product package",
    prompt:
      "A bottle or package of a cosmetic product, {productName}, clean product shot, on a podium with simple geometric shapes, minimalist, beauty photography, high detail, solid color background, soft shadows",
  },
  {
    keywords: ["toy", "doll", "model", "figure", "toy", "figure"],
    englishCategory: "a cute or cool toy figure",
    prompt:
      "A cute or cool toy figure, {productName}, product shot, on a simple stand, plain background, studio lighting, detailed, collectible, anime style, 8k",
  },
  {
    keywords: ["book", "notebook", "pen", "stationery"],
    englishCategory: "a book or stationery item",
    prompt:
      "A book or stationery item, {productName}, neatly arranged on a clean desk, minimalist, flat lay photography, high detail, studio lighting, soft shadows",
  },
  {
    // 这是默认的备用模板，如果上面的关键词都匹配不上，就用这个
    keywords: [],
    englishCategory: "a modern product", // 默认的英文品类名
    // ★★★ 全面优化的备用提示词 ★★★
    prompt:
      "Commercial product photography of {productName}. Professional studio shot, clean minimalist aesthetic, displayed on a podium or flat surface. Soft, even lighting, subtle soft shadows. Shot on a high-end camera, 8k, hyperrealistic, high detail.",
  },
];

/**
 * 顺序处理图片生成队列
 * 这个函数会一个接一个地为队列中的商品/美食生成图片，避免并发请求。
 */
async function processImageQueue() {
  // 如果当前有其他任务正在处理，就直接返回，让它处理完再说
  if (isProcessingImage) return;

  // 标记为“正在处理中”，锁上开关
  isProcessingImage = true;
  console.log(
    `Queue processing started, currently ${imageGenerationQueue.length} image generation tasks.`,
  );

  // 只要队列里还有任务，就一直循环
  while (imageGenerationQueue.length > 0) {
    // 从队列的头部取出一个任务
    const task = imageGenerationQueue.shift();

    console.log(`Generating image for "${task.item.name}"...`);

    try {
      // 根据任务类型，调用对应的图片处理函数
      // 这里我们等待 (await) 每个图片生成函数执行完毕
      if (task.type === "taobao") {
        await processProductImage(task.item);
      } else if (task.type === "eleme") {
        await processFoodImage(task.item);
      }
    } catch (error) {
      // 即使单个任务失败，也要打印错误并继续处理下一个任务
      console.error(`Error occurred while generating image for "${task.item.name}":`, error);
    }
  }

  // 所有任务都处理完了，标记为“已完成”，解开开关，等待下一次任务
  isProcessingImage = false;
  console.log("Image generation queue has been processed.");
}

/**
 * 根据商品名智能选择一个通用的图片提示词
 * @param {string} productName - 商品的中文名
 * @returns {string} - 拼接好的、纯英文的提示词
 */
function selectGenericImagePrompt(productName) {
  const lowerCaseName = productName.toLowerCase();

  let matchedTemplate = null;

  // 1. 寻找最匹配的模板
  for (const template of GENERIC_PRODUCT_PROMPTS) {
    if (
      template.keywords.length > 0 &&
      template.keywords.some((kw) => lowerCaseName.includes(kw))
    ) {
      matchedTemplate = template;
      break; // 找到第一个匹配的就跳出循环
    }
  }

  // 2. 如果没有找到匹配的，则使用默认的备用模板
  if (!matchedTemplate) {
    matchedTemplate =
      GENERIC_PRODUCT_PROMPTS[GENERIC_PRODUCT_PROMPTS.length - 1];
  }

  console.log(
    `Matched category for "${productName}": ${matchedTemplate.englishCategory}`,
  );

  const finalPrompt = matchedTemplate.prompt.replace(
    "{productName}",
    matchedTemplate.englishCategory,
  );

  return finalPrompt;
}

async function generateAndLoadImage(prompt) {
  while (true) {
    try {
      const encodedPrompt = encodeURIComponent(prompt);
      const seed = Math.floor(Math.random() * 100000);

      // 1. 获取 API Key (从全局状态获取)
      const pollApiKey = state.apiConfig.pollinationsApiKey;
      console.log(`Using API Key: ${pollApiKey}`);

      // 2. 构建基础 URL
      let primaryUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?width=1024&height=640&seed=${seed}&model=flux`;

      // === 分支 A: 如果有 API Key，使用 fetch 发送带 Header 的请求 ===
      if (pollApiKey) {
        primaryUrl += `&key=${pollApiKey}`;
        console.log(`Using URL with API Key: ${primaryUrl}`);
        console.log("Generating image using Pollinations API Key...");
        const response = await fetch(primaryUrl, {
          method: "GET",
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }

        // 获取二进制数据并转换为 Blob URL
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        return objectUrl; // 返回 Blob URL
      }

      // === 分支 B: 如果没有 API Key 或 API Key 请求失败，走原来的公开接口逻辑 ===

      // 定义加载器辅助函数
      const loadImage = (url) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.src = url;
          img.onload = () => resolve(url);
          img.onerror = () => reject(new Error(`URL loading failed: ${url}`));
        });

      const imageUrl = await loadImage(primaryUrl).catch(async () => {
        console.warn(`Primary URL loading failed, trying fallback URL for: ${prompt}`);
        const fallbackUrl = `https://pollinations.ai/p/${encodedPrompt}?width=1024&height=640&seed=${seed}`;
        return await loadImage(fallbackUrl);
      });

      // 如果成功加载，返回 URL
      return imageUrl;
    } catch (error) {
      // 如果彻底失败（Fetch失败 或 Image加载失败）
      console.error(`Image generation failed, will retry in 5 seconds. Error: ${error.message}`);
      // 等待5秒钟，然后循环继续，开始下一次尝试 (无限重试机制)
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

/**
 * 为Prompt生成并加载图片
 * @param {string} prompt - 用于生成图片的英文提示词
 * @returns {Promise<string>} - 返回一个Promise，它最终会resolve为一个有效的图片URL
 */
async function generateAndLoadImage(prompt) {
  while (true) {
    try {
      const encodedPrompt = encodeURIComponent(prompt);
      const seed = Math.floor(Math.random() * 100000);

      // 尝试主域名
      const primaryUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=640&seed=${seed}`;

      const loadImage = (url) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.src = url;
          img.onload = () => resolve(url);
          img.onerror = () => reject(new Error(`URL loading failed: ${url}`));
        });

      const imageUrl = await loadImage(primaryUrl).catch(async () => {
        console.warn(`Primary URL loading failed, trying fallback URL for: ${prompt}`);
        const fallbackUrl = `https://pollinations.ai/p/${encodedPrompt}?width=1024&height=640&seed=${seed}`;
        return await loadImage(fallbackUrl);
      });

      // 如果任何一个URL成功加载，就返回结果，并跳出循环
      return imageUrl;
    } catch (error) {
      // 如果主域名和备用域名都失败了...
      console.error(`Image generation failed completely, will retry in 5 seconds. Error: ${error.message}`);
      // 等待5秒钟，然后循环会继续，开始下一次尝试
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

/**
 * 异步处理单个商品图片的生成和保存
 * @param {object} product - 商品对象
 */
async function processProductImage(product) {
  try {
    // 智能决策，决定使用哪个提示词
    let imagePrompt;
    if (product.imagePrompt && product.imagePrompt.trim() !== "") {
      // 如果这个商品数据中自带了专属的 imagePrompt (通常来自AI生成)，就优先使用它！
      imagePrompt = product.imagePrompt;
      console.log(
        `Generating image for Taobao product "${product.name}" using AI-provided prompt...`,
      );
    } else {
      // 否则（比如是手动添加的、或者旧数据），就回退到通用模板匹配方案
      imagePrompt = selectGenericImagePrompt(product.name);
      console.log(`Generating image for Taobao product "${product.name}" using generic prompt...`);
    }

    // 2. 调用全局统一的 Pollinations 生图函数
    const imageUrl = await window.generatePollinationsImage(imagePrompt, {
      width: 1024,
      height: 1024,
      model: "flux",
      nologo: true,
    });

    // 3. 将生成好的图片URL保存回“桃宝”的数据库，实现持久化
    await db.taobaoProducts.update(product.id, { imageUrl: imageUrl });

    const cardElement = document.querySelector(
      `.product-card[data-product-id="${product.id}"]`,
    );
    if (cardElement) {
      const imageContainer = cardElement.querySelector(
        ".product-image-container",
      );
      if (imageContainer) {
        imageContainer.innerHTML = `<img src="${imageUrl}" class="product-image" alt="${product.name}">`;
      }
    }
  } catch (error) {
    console.error(`Failed to process image for Taobao product "${product.name}":`, error);
    const cardElement = document.querySelector(
      `.product-card[data-product-id="${product.id}"]`,
    );
    if (cardElement) {
      const imageContainer = cardElement.querySelector(
        ".product-image-container",
      );
      if (imageContainer) {
        imageContainer.innerHTML = `<span>Image<br>loading failed</span>`;
      }
    }
  }
}

/**
 * 异步处理单个美食图片的生成和保存
 * @param {object} food - 美食对象
 */
async function processFoodImage(food) {
  try {
    // 1. 智能决策：决定使用哪个提示词
    let imagePrompt;
    if (food.imagePrompt && food.imagePrompt.trim() !== "") {
      // 如果这个美食数据中自带了专属的 imagePrompt，就优先使用它！
      imagePrompt = food.imagePrompt;
      console.log(`Generating image for "${food.name}" using AI-provided prompt...`);
    } else {
      // 否则（比如是手动添加的、或者旧数据），就回退到通用模板匹配方案
      imagePrompt = selectGenericImagePrompt(food.name);
      console.log(`Generating image for "${food.name}" using generic prompt...`);
    }

    // 2. 调用全局统一的 Pollinations 生图函数
    const imageUrl = await window.generatePollinationsImage(imagePrompt, {
      width: 1024,
      height: 1024,
      model: "flux",
      nologo: true,
    });

    // 3. 将生成好的图片URL保存回“饿了么”的数据库，实现持久化
    await db.elemeFoods.update(food.id, { imageUrl: imageUrl });

    const cardElement = document.querySelector(
      `.product-card[data-food-id="${food.id}"]`,
    );
    if (cardElement) {
      const imageContainer = cardElement.querySelector(
        ".product-image-container",
      );
      if (imageContainer) {
        imageContainer.innerHTML = `<img src="${imageUrl}" class="product-image" alt="${food.name}">`;
      }
    }
  } catch (error) {
    // 理论上很难触发，但作为保险
    console.error(`Failed to process image for "${food.name}":`, error);
    const cardElement = document.querySelector(
      `.product-card[data-food-id="${food.id}"]`,
    );
    if (cardElement) {
      const imageContainer = cardElement.querySelector(
        ".product-image-container",
      );
      if (imageContainer) {
        imageContainer.innerHTML = `<span>Image<br>loading failed</span>`;
      }
    }
  }
}

/**
 * 为商品名称生成图片
 * @param {string} productName - 商品的中文名称
 * @returns {Promise<string>} - 返回一个Promise，它最终会resolve为一个有效的图片URL
 */
async function generateImageForProduct(productName) {
  // 1. 调用新函数，根据商品名智能选择一个提示词（不再需要API！）
  const imagePrompt = selectGenericImagePrompt(productName);
  console.log(`Selected prompt for "${productName}":`, imagePrompt);

  // 2. 调用已具备“无限重试”功能的核心图片生成函数
  // 这个函数会一直尝试，直到成功返回一个图片URL
  try {
    const imageUrl = await window.generatePollinationsImage(imagePrompt, {
      width: 1024,
      height: 1024,
      model: "flux",
      nologo: true,
    });
    return imageUrl;
  } catch (error) {
    // 理论上，由于 generateAndLoadImage 是无限循环，代码不会执行到这里。
    // 但为了代码健壮性，我们仍然保留一个最终的备用方案。
    console.error(
      `[Ultimate Catch] An unexpected error occurred while generating image for "${productName}":`,
      error,
    );
    return getRandomDefaultProductImage();
  }
}

async function renderChatList() {
  const chatListEl = document.getElementById("chat-list");
  chatListEl.innerHTML = "";

  // 1. 获取所有聊天和分组数据
  const allChats = Object.values(state.chats);
  const allGroups = await db.qzoneGroups.toArray();

  if (allChats.length === 0) {
    chatListEl.innerHTML =
      '<p style="text-align:center; color: #8a8a8a; margin-top: 50px;">Click "+" or the group icon in the top right to add a chat</p>';
    return;
  }

  // 2. 将聊天明确地分为“置顶”和“未置顶”两组
  const pinnedChats = allChats.filter((chat) => chat.isPinned);
  const unpinnedChats = allChats.filter((chat) => !chat.isPinned);

  // 3. 对置顶的聊天，仅按最新消息时间排序
  pinnedChats.sort(
    (a, b) =>
      (b.history.slice(-1)[0]?.timestamp || 0) -
      (a.history.slice(-1)[0]?.timestamp || 0),
  );

  // 4. 【优先渲染】所有置顶的聊天
  pinnedChats.forEach((chat) => {
    const item = createChatListItem(chat);
    chatListEl.appendChild(item);
  });

  // 5. 为每个分组找到其内部最新的消息时间戳 (只在未置顶聊天中查找)
  allGroups.forEach((group) => {
    const latestChatInGroup = unpinnedChats
      .filter((chat) => chat.groupId === group.id) // 找到属于这个组的聊天
      .sort(
        (a, b) =>
          (b.history.slice(-1)[0]?.timestamp || 0) -
          (a.history.slice(-1)[0]?.timestamp || 0),
      )[0]; // 排序后取第一个

    group.latestTimestamp = latestChatInGroup
      ? latestChatInGroup.history.slice(-1)[0]?.timestamp || 0
      : 0;
  });

  // 根据分组的最新时间戳，对分组本身进行排序
  allGroups.sort((a, b) => b.latestTimestamp - a.latestTimestamp);

  // 6. 遍历排序后的分组，渲染其中的【未置顶】好友
  allGroups.forEach((group) => {
    const groupChats = unpinnedChats
      .filter((chat) => !chat.isGroup && chat.groupId === group.id)
      .sort(
        (a, b) =>
          (b.history.slice(-1)[0]?.timestamp || 0) -
          (a.history.slice(-1)[0]?.timestamp || 0),
      );

    if (groupChats.length === 0) return; // 如果这个分组里没有未置顶的好友，就跳过

    const groupContainer = document.createElement("div");
    groupContainer.className = "chat-group-container";

    groupContainer.innerHTML = `
            <div class="chat-group-header">
                <span class="arrow">▼</span>
                <span class="group-name">${group.name}</span>
            </div>
            <div class="chat-group-content"></div>
        `;
    const contentEl = groupContainer.querySelector(".chat-group-content");

    groupChats.forEach((chat) => {
      const item = createChatListItem(chat);
      contentEl.appendChild(item);
    });
    chatListEl.appendChild(groupContainer);
  });

  // 7. 最后，渲染所有【未置顶】的群聊和【未分组的】好友
  const remainingChats = unpinnedChats
    .filter((chat) => chat.isGroup || (!chat.isGroup && !chat.groupId))
    .sort(
      (a, b) =>
        (b.history.slice(-1)[0]?.timestamp || 0) -
        (a.history.slice(-1)[0]?.timestamp || 0),
    );

  remainingChats.forEach((chat) => {
    const item = createChatListItem(chat);
    chatListEl.appendChild(item);
  });

  // 为所有分组标题添加折叠事件
  document.querySelectorAll(".chat-group-header").forEach((header) => {
    header.addEventListener("click", () => {
      header.classList.toggle("collapsed");
      header.nextElementSibling.classList.toggle("collapsed");
    });
  });
}

function createChatListItem(chat) {
  const lastMsgObj =
    chat.history.filter((msg) => !msg.isHidden).slice(-1)[0] || {};
  let lastMsgDisplay;

  // --- 消息预览的逻辑 (这部分保持不变) ---
  if (!chat.isGroup && chat.relationship?.status === "pending_user_approval") {
    lastMsgDisplay = `<span style="color: #ff8c00;">[Friend Request] ${
      chat.relationship.applicationReason || "Wants to add you as a friend"
    }</span>`;
  } else if (!chat.isGroup && chat.relationship?.status === "blocked_by_ai") {
    lastMsgDisplay = `<span style="color: #dc3545;">[You have been blocked]</span>`;
  } else if (chat.isGroup) {
    if (lastMsgObj.type === "pat_message") {
      lastMsgDisplay = `[System] ${lastMsgObj.content}`;
    } else if (lastMsgObj.type === "transfer") {
      lastMsgDisplay = "[Transfer]";
    } else if (
      lastMsgObj.type === "ai_image" ||
      lastMsgObj.type === "user_photo"
    ) {
      lastMsgDisplay = "[Photo]";
    } else if (lastMsgObj.type === "voice_message") {
      lastMsgDisplay = "[Voice]";
    } else if (
      typeof lastMsgObj.content === "string" &&
      STICKER_REGEX.test(lastMsgObj.content)
    ) {
      lastMsgDisplay = lastMsgObj.meaning
        ? `[Sticker: ${lastMsgObj.meaning}]`
        : "[Sticker]";
    } else if (Array.isArray(lastMsgObj.content)) {
      lastMsgDisplay = `[Image]`;
    } else {
      lastMsgDisplay = String(lastMsgObj.content || "...").substring(0, 20);
    }
    if (lastMsgObj.senderName && lastMsgObj.type !== "pat_message") {
      lastMsgDisplay = `${lastMsgObj.senderName}: ${lastMsgDisplay}`;
    }
  } else {
    const statusText = chat.status?.text || "Online";
    lastMsgDisplay = `[${statusText}]`;
  }

  const lastMsgTimestamp = lastMsgObj?.timestamp;
  const timeDisplay = formatChatListTimestamp(lastMsgTimestamp);

  const container = document.createElement("div");
  container.className = "chat-list-item-swipe-container";
  container.dataset.chatId = chat.id;

  const content = document.createElement("div");
  content.className = `chat-list-item-content ${chat.isPinned ? "pinned" : ""}`;

  const avatar = chat.isGroup
    ? chat.settings.groupAvatar
    : chat.settings.aiAvatar;

  let streakHtml = "";
  // 检查是否为单聊、功能是否开启
  if (!chat.isGroup && chat.settings.streak && chat.settings.streak.enabled) {
    const streak = chat.settings.streak;

    let isExtinguished = false;
    if (streak.lastInteractionDate && streak.extinguishThreshold !== -1) {
      const lastDate = new Date(streak.lastInteractionDate);
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const daysDiff = (todayDate - lastDate) / (1000 * 3600 * 24);
      if (daysDiff >= streak.extinguishThreshold) {
        isExtinguished = true;
      }
    }

    // 准备图标和颜色
    const litIconUrl = streak.litIconUrl;
    const extinguishedIconUrl = streak.extinguishedIconUrl;
    const fontColor = streak.fontColor || "#ff6f00"; // 如果没设置颜色，就用默认的橙色

    let iconHtml = "";

    if (isExtinguished) {
      // 如果熄灭了，优先用自定义熄灭图片，否则用默认 Emoji
      iconHtml = extinguishedIconUrl
        ? `<img src="${extinguishedIconUrl}" style="height: 1.2em; vertical-align: middle;">`
        : "🧊";
    } else if (streak.currentDays > 0) {
      // 如果在续，优先用自定义点亮图片，否则用默认 Emoji
      iconHtml = litIconUrl
        ? `<img src="${litIconUrl}" style="height: 1.2em; vertical-align: middle;">`
        : "🔥";
    }

    // 拼接最终的HTML
    if (iconHtml) {
      // 如果火花已熄灭 (isExtinguished 为 true)
      if (isExtinguished) {
        // 就只显示熄灭的图标，不显示天数
        streakHtml = `<span class="streak-indicator" style="color: ${fontColor};">${iconHtml}</span>`;
      }
      // 如果是永不熄灭模式（并且未熄灭）
      else if (streak.currentDays === -1 || streak.initialDays === -1) {
        streakHtml = `<span class="streak-indicator" style="color: ${fontColor};">${iconHtml}∞</span>`;
      }
      // 其他所有情况（即，火花是点亮的）
      else {
        // 才显示图标和天数
        streakHtml = `<span class="streak-indicator" style="color: ${fontColor};">${iconHtml}${streak.currentDays}</span>`;
      }
    }
  }

  content.innerHTML = `
        <div class="chat-list-item" data-chat-id="${chat.id}">
            <img src="${avatar || defaultAvatar}" class="avatar">
            <div class="info">
                <div class="name-line">
                    <span class="name">${chat.name}</span>
                    ${chat.isGroup ? '<span class="group-tag">Group</span>' : ""}
                    ${streakHtml}
                </div>
                <div class="last-msg" style="color: ${
                  chat.isGroup ? "var(--text-secondary)" : "#b5b5b5"
                }; font-style: italic;">${lastMsgDisplay}</div>
            </div>
            <div class="chat-list-right-column">
                <div class="chat-list-time">${timeDisplay}</div>
                <div class="unread-count-wrapper">
                    <span class="unread-count" style="display: none;">0</span>
                </div>
            </div>
        </div>
    `;

  const actions = document.createElement("div");
  actions.className = "swipe-actions";
  const pinButtonText = chat.isPinned ? "Unpin" : "Pin";
  const pinButtonClass = chat.isPinned ? "unpin" : "pin";
  actions.innerHTML = `<button class="swipe-action-btn ${pinButtonClass}">${pinButtonText}</button><button class="swipe-action-btn delete">Delete</button>`;

  container.appendChild(content);
  container.appendChild(actions);

  const unreadCount = chat.unreadCount || 0;
  const unreadEl = content.querySelector(".unread-count");
  if (unreadCount > 0) {
    unreadEl.textContent = unreadCount > 99 ? "99+" : unreadCount;
    unreadEl.style.display = "inline-flex";
  } else {
    unreadEl.style.display = "none";
  }

  const infoEl = content.querySelector(".info");
  if (infoEl) {
    infoEl.addEventListener("click", () => openChat(chat.id));
  }
  const avatarEl = content.querySelector(".avatar, .avatar-with-frame");
  if (avatarEl) {
    avatarEl.addEventListener("click", (e) => {
      e.stopPropagation();
      handleUserPat(chat.id, chat.name);
    });
  }

  return container;
}

/**
 * 根据时间戳，格式化聊天列表右侧的日期/时间显示
 * @param {number} timestamp - 消息的时间戳
 * @returns {string} - 格式化后的字符串 (例如 "14:30", "昨天", "08/03")
 */
function formatChatListTimestamp(timestamp) {
  if (!timestamp) return ""; // 如果没有时间戳，返回空字符串

  const now = new Date();
  const msgDate = new Date(timestamp);

  // 判断是否为今天
  const isToday =
    now.getFullYear() === msgDate.getFullYear() &&
    now.getMonth() === msgDate.getMonth() &&
    now.getDate() === msgDate.getDate();

  if (isToday) {
    // 如果是今天，只显示时间
    return msgDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // 判断是否为昨天
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    yesterday.getFullYear() === msgDate.getFullYear() &&
    yesterday.getMonth() === msgDate.getMonth() &&
    yesterday.getDate() === msgDate.getDate();

  if (isYesterday) {
    return "Yesterday";
  }

  // 判断是否为今年
  if (now.getFullYear() === msgDate.getFullYear()) {
    // 如果是今年，显示 "月/日"
    const month = String(msgDate.getMonth() + 1).padStart(2, "0");
    const day = String(msgDate.getDate()).padStart(2, "0");
    return `${month}/${day}`;
  }

  // 如果是更早的年份，显示 "年/月/日"
  const year = msgDate.getFullYear();
  const month = String(msgDate.getMonth() + 1).padStart(2, "0");
  const day = String(msgDate.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

function showNotification(chatId, messageContent) {
  playNotificationSound();
  clearTimeout(notificationTimeout);
  const chat = state.chats[chatId];
  if (!chat) return;
  const bar = document.getElementById("notification-bar");
  document.getElementById("notification-avatar").src =
    chat.settings.aiAvatar || chat.settings.groupAvatar || defaultAvatar;
  document
    .getElementById("notification-content")
    .querySelector(".name").textContent = chat.name;
  document
    .getElementById("notification-content")
    .querySelector(".message").textContent = messageContent;
  const newBar = bar.cloneNode(true);
  bar.parentNode.replaceChild(newBar, bar);
  newBar.addEventListener("click", () => {
    openChat(chatId);
    newBar.classList.remove("visible");
  });
  newBar.classList.add("visible");
  notificationTimeout = setTimeout(() => {
    newBar.classList.remove("visible");
  }, 4000);
}
function addLongPressListener(element, callback) {
  let pressTimer;
  const startPress = (e) => {
    if (isSelectionMode) return;
    e.preventDefault();
    pressTimer = window.setTimeout(() => callback(e), 500);
  };
  const cancelPress = () => clearTimeout(pressTimer);
  element.addEventListener("mousedown", startPress);
  element.addEventListener("mouseup", cancelPress);
  element.addEventListener("mouseleave", cancelPress);
  element.addEventListener("touchstart", startPress, { passive: true });
  element.addEventListener("touchend", cancelPress);
  element.addEventListener("touchmove", cancelPress);
}
/**
 * 播放消息提示音，增加健壮性
 */
function playNotificationSound() {
  const soundUrl =
    state.globalSettings.notificationSoundUrl ||
    "https://laddy-lulu.github.io/Ephone-stuffs/message.mp3";

  // 1. 增加安全检查：如果链接为空，直接返回，不执行任何操作
  if (!soundUrl || !soundUrl.trim()) return;

  try {
    const audio = new Audio(soundUrl);
    audio.volume = 0.7;

    audio.play().catch((error) => {
      // 2. 优化错误提示，现在能更准确地反映问题
      if (error.name === "NotAllowedError") {
        console.warn(
          "Failed to play notification sound: User interaction with the page (e.g., a click) is required before audio can be played automatically.",
        );
      } else {
        // For other errors (like the one we encountered this time), directly print the error details
        console.error(
          `Failed to play notification sound (${error.name}): ${error.message}`,
          "URL:",
          soundUrl,
        );
      }
    });
  } catch (error) {
    console.error("Failed to create notification sound Audio object:", error);
  }
}

/**
 * 获取一张随机的外卖默认图片
 * @returns {string} - 返回一张随机图片的URL
 */
function getRandomWaimaiImage() {
  const defaultImages = [
    "https://i.postimg.cc/mD8DB9Q7/food1.jpg",
    "https://i.postimg.cc/W12WqgJp/food2.jpg",
    "https://i.postimg.cc/KzA1df4y/food3.jpg",
  ];
  return defaultImages[Math.floor(Math.random() * defaultImages.length)];
}

/**
 * 获取一张随机的淘宝宝贝默认图片
 * @returns {string} - 返回一张随机图片的URL
 */
function getRandomDefaultProductImage() {
  const defaultImages = [
    "https://i.postimg.cc/W4svy4Hm/Image-1760206134285.jpg",
    "https://i.postimg.cc/jjRb1jF7/Image-1760206125678.jpg",
  ];
  // 从数组中随机选择一个并返回
  return defaultImages[Math.floor(Math.random() * defaultImages.length)];
}

/**
 * 核心函数：更新用户余额并记录一笔交易
 * @param {number} amount - 交易金额 (正数为收入, 负数为支出)
 * @param {string} description - 交易描述 (例如: "转账给 XX", "收到 XX 的红包")
 */
async function updateUserBalanceAndLogTransaction(amount, description) {
  if (isNaN(amount)) return; // 安全检查

  // 确保余额是数字
  state.globalSettings.userBalance =
    (state.globalSettings.userBalance || 0) + amount;

  const newTransaction = {
    type: amount > 0 ? "income" : "expense",
    amount: Math.abs(amount),
    description: description,
    timestamp: Date.now(),
  };

  // 使用数据库事务，确保两步操作要么都成功，要么都失败
  await db.transaction(
    "rw",
    db.globalSettings,
    db.userWalletTransactions,
    async () => {
      await db.globalSettings.put(state.globalSettings);
      await db.userWalletTransactions.add(newTransaction);
    },
  );

  console.log(
    `User wallet updated: amount=${amount.toFixed(2)}, new balance=${state.globalSettings.userBalance.toFixed(2)}`,
  );
}
/**
 * 处理角色手机钱包余额和交易记录的通用函数
 * @param {string} charId - 要更新钱包的角色ID
 * @param {number} amount - 交易金额 (正数为收入, 负数为支出)
 * @param {string} description - 交易描述
 */
async function updateCharacterPhoneBankBalance(charId, amount, description) {
  const chat = state.chats[charId];
  if (!chat || chat.isGroup) return;

  if (!chat.characterPhoneData) chat.characterPhoneData = {};
  if (!chat.characterPhoneData.bank)
    chat.characterPhoneData.bank = { balance: 0, transactions: [] };
  if (typeof chat.characterPhoneData.bank.balance !== "number")
    chat.characterPhoneData.bank.balance = 0;

  chat.characterPhoneData.bank.balance += amount;

  const newTransaction = {
    type: amount > 0 ? "income" : "expense",
    amount: Math.abs(amount),
    description: description,
    timestamp: Date.now(),
  };

  // Keep newest transactions at the front
  if (!Array.isArray(chat.characterPhoneData.bank.transactions)) {
    chat.characterPhoneData.bank.transactions = [];
  }
  chat.characterPhoneData.bank.transactions.unshift(newTransaction);

  await db.chats.put(chat);
  console.log(
    `✅ Character [${chat.name}] wallet updated: amount=${amount.toFixed(2)}, new balance=${chat.characterPhoneData.bank.balance.toFixed(
      2,
    )}`,
  );
}

/**
 * Clear all products and cart from the Taobao home page
 */
async function clearTaobaoProducts() {
  const confirmed = await showCustomConfirm(
    "Confirm Clear",
    "Are you sure you want to clear all products from Taobao? This will also clear your shopping cart and cannot be undone.",
    { confirmButtonClass: "btn-danger" },
  );

  if (confirmed) {
    try {
      // 使用数据库事务，确保两步操作要么都成功，要么都失败，更安全
      await db.transaction("rw", db.taobaoProducts, db.taobaoCart, async () => {
        // 清空商品库
        await db.taobaoProducts.clear();
        // 清空购物车数据库
        await db.taobaoCart.clear();
      });

      // 重新渲染UI
      await renderTaobaoProducts();
      // 刷新购物车UI（让页面变空）
      await renderTaobaoCart();
      // 更新购物车角标（让红点消失）
      updateCartBadge();

      // 2. 修改成功提示
      await showCustomAlert("Success", "All products and shopping cart have been cleared!");
    } catch (error) {
      console.error("Error clearing Taobao products:", error);
      await showCustomAlert("Failed", `An error occurred: ${error.message}`);
    }
  }
}

/**
 * 打开“桃宝”App，并渲染默认视图
 */
async function openTaobaoApp() {
  showScreen("taobao-screen");
  await renderTaobaoProducts(); // 默认显示所有商品
  renderBalanceDetails(); // 刷新余额显示
}

/**
 * 渲染“饿了么”页面的美食列表
 */
async function renderElemeFoods() {
  const gridEl = document.getElementById("eleme-grid");
  gridEl.innerHTML = "";
  const foods = await db.elemeFoods.toArray();

  if (foods.length === 0) {
    gridEl.innerHTML =
      '<p style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary);">No food items yet. Click "✨" or "+" in the top right to discover delicious food!</p>';
    return;
  }

  foods.forEach((food) => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.style.cursor = "pointer";
    card.dataset.foodId = food.id;

    card.innerHTML = `
        <div class="product-image-container">
            <!-- Image or loading spinner will be here -->
        </div>
        <div class="product-info">
            <div class="product-name" title="${food.name} · ${food.restaurant}">${food.name}</div>
            <div class="product-price">¥${food.price.toFixed(2)}</div>
        </div>
    `;

    const imageContainer = card.querySelector(".product-image-container");

    if (food.imageUrl) {
      imageContainer.innerHTML = `<img src="${food.imageUrl}" class="product-image" alt="${food.name}">`;
    } else {
      imageContainer.innerHTML = `<div class="loading-spinner"></div>`;
      imageGenerationQueue.push({ type: "eleme", item: food });
    }

    addLongPressListener(card, () => showFoodActions(food.id));
    gridEl.appendChild(card);
  });

  // 渲染完所有卡片后，触发一次队列处理器
  processImageQueue();
}

/**
 * 打开美食详情弹窗
 * @param {number} foodId - 美食的ID
 */
async function openFoodDetail(foodId) {
  const food = await db.elemeFoods.get(foodId);
  if (!food) return;

  const modal = document.getElementById("product-detail-modal");
  const bodyEl = document.getElementById("product-detail-body");
  const reviewsSection = document.getElementById("product-reviews-section");
  const closeBtn = document.getElementById("close-product-detail-btn");
  const actionBtn = document.getElementById("detail-add-to-cart-btn");

  // 1. 渲染美食基本信息
  bodyEl.innerHTML = `
        <img src="${food.imageUrl}" class="product-image" alt="${food.name}">
        <h2 class="product-name">${food.name}</h2>
        <p class="product-price">¥${food.price.toFixed(2)}</p>
        <p style="color: #888; font-size: 13px;">Store: ${food.restaurant || "Featured Merchant"}</p>
    `;

  // 2. 隐藏不相关的“宝贝评价”区域
  reviewsSection.style.display = "none";

  // 3. 改造底部按钮
  const newActionBtn = actionBtn.cloneNode(true);
  newActionBtn.textContent = "Order for Them"; // Change button text
  actionBtn.parentNode.replaceChild(newActionBtn, actionBtn);

  // 为新按钮绑定“点单”逻辑
  newActionBtn.onclick = async () => {
    modal.classList.remove("visible"); // 先关闭弹窗
    await handleOrderForChar(foodId); // 再执行点单流程
  };

  // 绑定关闭按钮
  closeBtn.onclick = () => modal.classList.remove("visible");

  // 显示弹窗
  modal.classList.add("visible");
}
/**
 * 【全新】清空饿了么的所有美食
 */
async function clearElemeFoods() {
  const confirmed = await showCustomConfirm(
    "Confirm Clear",
    "Are you sure you want to clear all food items from Eleme? This cannot be undone.",
    {
      confirmButtonClass: "btn-danger",
    },
  );

  if (confirmed) {
    try {
      await db.elemeFoods.clear(); // Clear the food database
      await renderElemeFoods(); // Re-render UI to show empty state
      await showCustomAlert("Success", "All food items have been cleared!");
    } catch (error) {
      console.error("Error clearing Eleme foods:", error);
      await showCustomAlert("Failed", `An error occurred: ${error.message}`);
    }
  }
}

/**
 * 为“饿了么”随机生成商品
 */
async function handleGenerateFoodsAI() {
  await showCustomAlert("Please wait...", "AI is searching for great food items across the city...");
  const { proxyUrl, apiKey, model } = state.apiConfig;
  if (!proxyUrl || !apiKey || !model) {
    alert("Please configure the API settings first before using AI features!");
    return;
  }

  const prompt = `
# Task
You are an editor for the food delivery app "Eleme". Please randomly recommend 5-8 food items.

# Core Rules
1.  **Diverse Products**: The types of products must be diverse, including [Food, Snacks, Beverages, Medicine, Daily Necessities], etc.
2.  **Enticing Names**: The product names should sound appealing.

3.  **Strict JSON Format**: Your response **must** be a strict JSON array, with each object representing a product and containing the following fields:
    -   \`"name"\`: Product name (string)
    -   \`"price"\`: Price (number)
    -   \`"restaurant"\`: Virtual restaurant name (string)
    -   \`"category"\`: Product category (string, e.g., "Food", "Beverages", "Snacks", "Medicine", "Daily Necessities")
    -   \`"imagePrompt"\`: A detailed English prompt for text-to-image AI, used to generate an appetizing product shot for the item.

# JSON Output Format Example:
[
  {
    "name": "Fresh Grape Cheese Tea",
    "price": 22.0,
    "restaurant": "Naixue's Tea",
    "category": "Beverages",
    "imagePrompt": "A cup of grape cheese foam tea, with fresh grape pulp, product shot, minimalist, vibrant, delicious and appetizing, commercial photography"
  },
  {
    "name": "Ibuprofen Sustained-Release Capsules",
    "price": 15.5,
    "restaurant": "Local Pharmacy",
    "category": "Medicine",
    "imagePrompt": "A box of Ibuprofen sustained-release capsules, clean medical product shot, minimalist, on a white background, professional photography"
  }
]`;

  try {
    const messagesForApi = [{ role: "user", content: prompt }];
    const isGemini = proxyUrl === GEMINI_API_URL;
    const requestData = isGemini
      ? toGeminiRequestData(model, apiKey, prompt, messagesForApi, isGemini)
      : {
          url: `${proxyUrl}/v1/chat/completions`,
          options: {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              temperature: 1.1,
              response_format: { type: "json_object" },
            }),
          },
        };
    const response = await fetch(requestData.url, requestData.options);
    if (!response.ok) throw new Error(`API request failed: ${await response.text()}`);
    const data = await response.json();
    const rawContent = isGemini
      ? data.candidates[0].content.parts[0].text
      : data.choices[0].message.content;
    let newFoods;
    try {
      newFoods = JSON.parse(rawContent.replace(/^```json\s*|```$/g, "").trim());
    } catch (e) {
      throw new Error("The JSON format returned by AI is incorrect.");
    }

    if (Array.isArray(newFoods) && newFoods.length > 0) {
      const foodsToSave = newFoods.map((food) => ({ ...food, imageUrl: "" }));
      await db.elemeFoods.bulkAdd(foodsToSave);
      await renderElemeFoods(); // Re-render Eleme page
      await showCustomAlert(
        "Generated Successfully!",
        `Successfully recommended ${newFoods.length} items for you!`,
      );
    } else {
      throw new Error("The data format returned by AI is incorrect or empty.");
    }
  } catch (error) {
    console.error("AI failed to generate Eleme products:", error);
    await showCustomAlert("Generation Failed", `An error occurred: ${error.message}`);
  }
}

/**
 * 根据关键词搜索商品
 */
async function handleSearchFoodsAI() {
  const searchTerm = document.getElementById("eleme-search-input").value.trim();
  if (!searchTerm) {
    alert("Please enter a keyword to search for products!");
    return;
  }

  await showCustomAlert(
    "Please wait...",
    `AI is searching for products related to "${searchTerm}"...`,
  );
  const { proxyUrl, apiKey, model } = state.apiConfig;
  if (!proxyUrl || !apiKey || !model) {
    alert("Please configure the API first!");
    return;
  }

  const prompt = `
# Task
You are a search engine for the food delivery app "Eleme". Please create a list of 5-8 relevant food items based on the user's provided [search keyword].

# User's search keyword:
"${searchTerm}"

# Core Rules
1.  **Highly Relevant**: All products must be closely related to the user's search keyword "${searchTerm}".
2.  **Strict JSON Format**: Your response **must** be a strict JSON array, with each object representing a product and containing the following fields:
    -   \`"name"\`: Product name (string)
    -   \`"price"\`: Price (number)
    -   \`"restaurant"\`: Virtual restaurant name (string)
    -   \`"category"\`: Product category (string, e.g., "Food", "Beverages", "Snacks", "Medicine", "Daily Necessities")
    -   \`"imagePrompt"\`: A detailed English prompt for text-to-image AI, used to generate an appetizing product shot for the item.

# JSON Output Format Example:
[
  {
    "name": "Classic Italian Bolognese Pasta",
    "price": 42.0,
    "restaurant": "Corner Pasta House",
    "category": "Food",
    "imagePrompt": "A bowl of classic Italian bolognese pasta, food photography, close-up, delicious and appetizing, garnished with basil leaves, high detail"
  }
]`;

  try {
    const messagesForApi = [{ role: "user", content: prompt }];
    const isGemini = proxyUrl === GEMINI_API_URL;
    const requestData = isGemini
      ? toGeminiRequestData(model, apiKey, prompt, messagesForApi, isGemini)
      : {
          url: `${proxyUrl}/v1/chat/completions`,
          options: {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              temperature: 0.8,
              response_format: { type: "json_object" },
            }),
          },
        };

    const response = await fetch(requestData.url, requestData.options);
    if (!response.ok) throw new Error(`API request failed: ${await response.text()}`);

    const data = await response.json();
    const rawContent = isGemini
      ? data.candidates[0].content.parts[0].text
      : data.choices[0].message.content;
    let foundFoods;
    try {
      foundFoods = JSON.parse(
        rawContent.replace(/^```json\s*|```$/g, "").trim(),
      );
    } catch (e) {
      throw new Error("The JSON format returned by AI is incorrect.");
    }

    if (Array.isArray(foundFoods) && foundFoods.length > 0) {
      const foodsToSave = foundFoods.map((food) => ({ ...food, imageUrl: "" }));
      await db.elemeFoods.bulkAdd(foodsToSave);
      await renderElemeFoods(); // Refresh list
      await showCustomAlert(
        "Search Successful!",
        `AI found ${foundFoods.length} items and added them to the list!`,
      );
    } else {
      throw new Error("AI did not find any related products.");
    }
  } catch (error) {
    console.error("AI failed to search Eleme products:", error);
    await showCustomAlert("Search Failed", `An error occurred: ${error.message}`);
  }
}

/**
 * 打开美食编辑器（支持添加和编辑）
 * @param {number|null} foodId - 如果是编辑模式，传入美食ID；否则为null
 */
async function openFoodEditor(foodId = null) {
  currentEditingFoodId = foodId; // 保存正在编辑的美食ID
  const modal = document.getElementById("product-editor-modal");
  const titleEl = document.getElementById("product-editor-title");

  // 调整UI和填充数据
  document.getElementById("product-category-input").placeholder =
    "Store name (optional)";
  // 确保保存按钮的事件指向美食保存函数
  const saveBtn = document.getElementById("save-product-btn");
  const newSaveBtn = saveBtn.cloneNode(true); // 克隆以清除旧事件
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
  newSaveBtn.addEventListener("click", saveFoodItem);

  if (foodId) {
    // 编辑模式
    titleEl.textContent = "Edit Food Item";
    const food = await db.elemeFoods.get(foodId);
    if (food) {
      document.getElementById("product-name-input").value = food.name;
      document.getElementById("product-price-input").value = food.price;
      document.getElementById("product-image-input").value = food.imageUrl;
      document.getElementById("product-category-input").value =
        food.restaurant || "";
    }
  } else {
    // 添加模式
    titleEl.textContent = "Add Food Item Manually";
    // 清空输入框
    document.getElementById("product-name-input").value = "";
    document.getElementById("product-price-input").value = "";
    document.getElementById("product-image-input").value = "";
    document.getElementById("product-category-input").value = "";
  }

  modal.classList.add("visible");
}

/**
 * 保存手动添加或编辑的美食
 */
async function saveFoodItem() {
  const name = document.getElementById("product-name-input").value.trim();
  const price = parseFloat(
    document.getElementById("product-price-input").value,
  );
  let imageUrl = document.getElementById("product-image-input").value.trim();
  const restaurant = document
    .getElementById("product-category-input")
    .value.trim();

  if (!name || isNaN(price) || price <= 0) {
    alert("Please fill in the food name and a valid price!");
    return;
  }

  // If user did not provide an image link, leave it empty so the renderer triggers AI image generation
  if (!imageUrl) {
    imageUrl = "";
  }

  const foodData = {
    name,
    price,
    imageUrl,
    restaurant: restaurant || "Home Kitchen",
  };

  try {
    if (currentEditingFoodId) {
      // 更新模式
      await db.elemeFoods.update(currentEditingFoodId, foodData);
      await showCustomAlert("Saved Successfully", "Food item information has been updated!");
    } else {
      // Add mode
      await db.elemeFoods.add(foodData);
      await showCustomAlert("Added Successfully", "New food item has been added!");
    }

    // Close modal and refresh list after operation
    document.getElementById("product-editor-modal").classList.remove("visible");
    await renderElemeFoods();
  } catch (error) {
    console.error("Failed to save food item:", error);
    await showCustomAlert("Save Failed", `An error occurred: ${error.message}`);
  } finally {
    currentEditingFoodId = null; // 无论成功失败，都重置编辑ID
  }
}

/**
 * 核心函数：处理用户点击“给Ta点单”的完整流程
 * @param {number} foodId - 被点击的美食的ID
 */
async function handleOrderForChar(foodId) {
  const food = await db.elemeFoods.get(foodId);
  if (!food) return;

  // 1. 检查用户余额
  if ((state.globalSettings.userBalance || 0) < food.price) {
    alert("Your balance is insufficient to place an order for them!");
    return;
  }

  // 2. 打开角色选择器，让用户选择为谁点单
  const targetCharId = await openCharSelectorForEleme();
  if (!targetCharId) return; // 如果用户取消了选择，则结束流程

  const char = state.chats[targetCharId];
  if (!char) return;

  // 3. 弹出最终确认框
  const confirmed = await showCustomConfirm(
    "Confirm Order",
    `Are you sure you want to spend ¥${food.price.toFixed(2)} to order "${food.name}" for "${char.name}"?`,
    { confirmText: "Place Order Now" },
  );

  if (confirmed) {
    const remark = await showCustomPrompt(
      "Delivery Note (optional)",
      "Any special instructions for the rider or merchant?",
      "Contactless delivery, thank you!", // A friendly default value
    );
    // 如果用户点了取消，remark会是null，但不影响流程

    await showCustomAlert("Please wait...", `Placing order for "${char.name}"...`);

    // 4. 扣除用户余额
    await updateUserBalanceAndLogTransaction(
      -food.price,
      `Order delivery for ${char.name}: ${food.name}`,
    );

    // 5. 创建外卖订单记录
    await db.elemeOrders.add({
      foodId: foodId,
      quantity: 1,
      timestamp: Date.now(),
      status: "Order Placed",
      recipientId: targetCharId,
    });

    await sendElemeOrderNotificationToChar(targetCharId, food, remark);

    await showCustomAlert(
      "Order Placed Successfully!",
      `You have successfully placed an order for "${char.name}" and notified them via private message!`,
    );
    renderChatList();
  }
}

/**
 * 辅助函数：打开一个单选的角色选择器
 * @returns {Promise<string|null>} - 返回选中的角色ID，如果取消则返回null
 */
async function openCharSelectorForEleme() {
  return new Promise((resolve) => {
    const modal = document.getElementById("share-target-modal");
    const listEl = document.getElementById("share-target-list");
    const titleEl = document.getElementById("share-target-modal-title");
    const confirmBtn = document.getElementById("confirm-share-target-btn");
    const cancelBtn = document.getElementById("cancel-share-target-btn");

    titleEl.textContent = "Who do you want to order for?";
    listEl.innerHTML = "";

    const singleChats = Object.values(state.chats).filter((c) => !c.isGroup);

    if (singleChats.length === 0) {
      alert("You don't have any friends to order for yet.");
      modal.classList.remove("visible");
      resolve(null);
      return;
    }

    singleChats.forEach((chat) => {
      const item = document.createElement("div");
      item.className = "contact-picker-item";
      item.innerHTML = `
                <input type="radio" name="eleme-target" value="${chat.id}" id="target-${
                  chat.id
                }" style="margin-right: 15px;">
                <label for="target-${chat.id}" style="display:flex; align-items:center; width:100%; cursor:pointer;">
                    <img src="${chat.settings.aiAvatar || defaultAvatar}" class="avatar">
                    <span class="name">${chat.name}</span>
                </label>
            `;
      listEl.appendChild(item);
    });

    modal.classList.add("visible");

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    const cleanup = () => modal.classList.remove("visible");

    newConfirmBtn.onclick = () => {
      const selectedRadio = document.querySelector(
        'input[name="eleme-target"]:checked',
      );
      if (selectedRadio) {
        cleanup();
        resolve(selectedRadio.value);
      } else {
        alert("Please select a recipient!");
      }
    };

    newCancelBtn.onclick = () => {
      cleanup();
      resolve(null);
    };
  });
}

/**
 * 发送外卖订单通知到指定角色的聊天
 */
async function sendElemeOrderNotificationToChar(targetChatId, food, remark) {
  const chat = state.chats[targetChatId];
  if (!chat) return;

  // 准备给AI看的文本，现在包含了备注信息
  const textContentForAI = `[System Prompt: The user has ordered a delivery from "${food.restaurant}" for you: "${food.name}", with the remark: "${
    remark || "None"
  }". Please respond according to your character.]`;

  // 准备要渲染成卡片的数据 (payload)
  const notificationPayload = {
    foodName: food.name,
    foodImageUrl: food.imageUrl,
    senderName: state.qzoneSettings.nickname || "Me",
    remark: remark || "", // 将备注保存到payload中
  };

  // 创建消息对象
  const notificationMessage = {
    role: "user", // 由用户发出
    type: "eleme_order_notification",
    timestamp: Date.now(),
    // content 字段现在用于AI理解上下文，而不是UI渲染
    content: `I have ordered a delivery for you: ${food.name} `,
    payload: notificationPayload,
  };
  chat.history.push(notificationMessage);

  // 创建给AI看的隐藏指令
  const hiddenMessage = {
    role: "system",
    content: textContentForAI,
    timestamp: Date.now() + 1,
    isHidden: true,
  };
  chat.history.push(hiddenMessage);

  chat.unreadCount = (chat.unreadCount || 0) + 1;
  await db.chats.put(chat);

  if (state.activeChatId !== targetChatId) {
    showNotification(targetChatId, "You have received a delivery!");
  }

  // Actively trigger AI response
  openChat(targetChatId);
}

function switchTaobaoView(viewId) {
  document
    .querySelectorAll(".taobao-view")
    .forEach((v) => v.classList.remove("active"));
  document.getElementById(viewId).classList.add("active");

  document.querySelectorAll(".taobao-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.view === viewId);
  });

  if (viewId === "orders-view") {
    renderTaobaoOrders();
  } else if (viewId === "my-view") {
    renderBalanceDetails();
  } else if (viewId === "cart-view") {
    renderTaobaoCart();
  } else if (viewId === "eleme-view") {
    // <-- Newly added condition
    renderElemeFoods();
  }
}

/**
 * Render the shopping cart page
 */
async function renderTaobaoCart() {
  const listEl = document.getElementById("cart-item-list");
  const checkoutBar = document.getElementById("cart-checkout-bar");
  listEl.innerHTML = "";

  const cartItems = await db.taobaoCart.toArray();

  if (cartItems.length === 0) {
    listEl.innerHTML =
      '<p style="text-align:center; color: var(--text-secondary); padding: 50px 0;">Your cart is empty~</p>';
    checkoutBar.style.display = "none";
    updateCartBadge(0);
    return;
  }

  checkoutBar.style.display = "flex";
  let totalPrice = 0;
  let totalItems = 0;

  for (const item of cartItems) {
    const product = await db.taobaoProducts.get(item.productId);
    if (!product) continue;

    totalItems += item.quantity;
    totalPrice += product.price * item.quantity;

    const itemEl = document.createElement("div");
    itemEl.className = "cart-item";
    itemEl.innerHTML = `
            <img src="${product.imageUrl}" class="product-image" data-product-id="${product.id}">
            <div class="cart-item-info" data-product-id="${product.id}">
                <div class="product-name">${product.name}</div>
                <div class="product-price">¥${product.price.toFixed(2)}</div>
            </div>
            <div class="quantity-controls">
                <button class="quantity-decrease" data-cart-id="${item.id}" ${
                  item.quantity <= 1 ? "disabled" : ""
                }>-</button>
                <span class="quantity-display">${item.quantity}</span>
                <button class="quantity-increase" data-cart-id="${item.id}">+</button>
            </div>
            <button class="delete-cart-item-btn" data-cart-id="${item.id}">×</button>
        `;
    listEl.appendChild(itemEl);
  }

  document.getElementById("cart-total-price").textContent =
    `¥ ${totalPrice.toFixed(2)}`;
  const checkoutBtn = document.getElementById("checkout-btn");
  checkoutBtn.textContent = `Checkout(${totalItems})`;
  checkoutBtn.dataset.totalPrice = totalPrice; // Store the total price for checkout

  updateCartBadge(totalItems);
}

/**
 * Update the badge count on the shopping cart icon
 */
function updateCartBadge() {
  const badge = document.getElementById("cart-item-count-badge");
  db.taobaoCart.toArray().then((items) => {
    const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
    if (totalCount > 0) {
      badge.textContent = totalCount > 99 ? "99+" : totalCount;
      badge.style.display = "inline-block";
    } else {
      badge.style.display = "none";
    }
  });
}

/**
 * Handle adding items to the cart
 */
async function handleAddToCart(productId) {
  const existingItem = await db.taobaoCart
    .where("productId")
    .equals(productId)
    .first();
  if (existingItem) {
    // If the item already exists, increase the quantity by 1
    await db.taobaoCart.update(existingItem.id, {
      quantity: existingItem.quantity + 1,
    });
  } else {
    // If the item does not exist, add a new entry
    await db.taobaoCart.add({ productId: productId, quantity: 1 });
  }
  await showCustomAlert("Success", "The item has been added to your cart!");
  updateCartBadge(); // Update the badge
}

/**
 * 处理购物车内商品数量的变化
 */
async function handleChangeCartItemQuantity(cartId, change) {
  const item = await db.taobaoCart.get(cartId);
  if (!item) return;

  const newQuantity = item.quantity + change;
  if (newQuantity <= 0) {
    // 如果数量减到0，就删除该项
    await handleRemoveFromCart(cartId);
  } else {
    await db.taobaoCart.update(cartId, { quantity: newQuantity });
    await renderTaobaoCart();
  }
}

/**
 * 从购物车中移除商品
 */
async function handleRemoveFromCart(cartId) {
  await db.taobaoCart.delete(cartId);
  await renderTaobaoCart();
}

/**
 * 打开商品详情弹窗
 */
async function openProductDetail(productId) {
  const product = await db.taobaoProducts.get(productId);
  if (!product) return;

  const modal = document.getElementById("product-detail-modal");
  const bodyEl = document.getElementById("product-detail-body");
  const reviewsSection = document.getElementById("product-reviews-section");
  const reviewsListEl = document.getElementById("product-reviews-list");
  const generateBtn = document.getElementById("generate-reviews-btn");
  const actionBtn = document.getElementById("detail-add-to-cart-btn");

  // 强制重置UI状态
  // 无论上次是什么状态，都确保评价区是可见的
  reviewsSection.style.display = "block";

  // 渲染商品基本信息
  bodyEl.innerHTML = `
        <img src="${product.imageUrl}" class="product-image" alt="${product.name}">
        <h2 class="product-name">${product.name}</h2>
        <p class="product-price">${product.price.toFixed(2)}</p>
        <p style="color: #888; font-size: 13px;">Store: ${product.store || "Taobao Official Store"}</p>
    `;

  // 渲染评价区域
  reviewsListEl.innerHTML = "";
  if (product.reviews && product.reviews.length > 0) {
    product.reviews.forEach((review) => {
      const reviewEl = document.createElement("div");
      reviewEl.className = "product-review-item";
      reviewEl.innerHTML = `
                <div class="review-author">${review.author}</div>
                <p>${review.text}</p>
            `;
      reviewsListEl.appendChild(reviewEl);
    });
    generateBtn.style.display = "none";
  } else {
    reviewsListEl.innerHTML =
      '<p style="text-align: center; color: var(--text-secondary); font-size: 13px;">No reviews yet~</p>';
    generateBtn.style.display = "block";
  }

  // Rebind the "Generate Reviews" button event (to prevent duplicate bindings)
  const newGenerateBtn = generateBtn.cloneNode(true);
  generateBtn.parentNode.replaceChild(newGenerateBtn, generateBtn);
  newGenerateBtn.addEventListener("click", () =>
    generateProductReviews(productId),
  );

  // Force reset the button and rebind the event
  // 先克隆按钮以清除旧事件监听器
  const newAddToCartBtn = actionBtn.cloneNode(true);

  newAddToCartBtn.textContent = "Add to Cart";
  // 为新按钮绑定正确的“加入购物车”逻辑
  newAddToCartBtn.onclick = async () => {
    await handleAddToCart(productId);
    modal.classList.remove("visible"); // 添加后自动关闭弹窗
  };
  actionBtn.parentNode.replaceChild(newAddToCartBtn, actionBtn);

  // 绑定关闭按钮
  document.getElementById("close-product-detail-btn").onclick = () =>
    modal.classList.remove("visible");

  // 最后，显示弹窗
  modal.classList.add("visible");
}

/**
 * 为指定商品生成评价
 * @param {number} productId - 商品的ID
 */
async function generateProductReviews(productId) {
  await showCustomAlert("Please wait...", "Calling in the buyer reviews...");
  const { proxyUrl, apiKey, model } = state.apiConfig;
  if (!proxyUrl || !apiKey || !model) {
    alert("Please configure the API first!");
    return;
  }

  const product = await db.taobaoProducts.get(productId);
  if (!product) return;

  const prompt = `
# Task
You are a professional e-commerce review generator. Please generate 3–5 simulated buyer reviews with different styles for the following product.

# Product Information
- Name: ${product.name}
- Price: ${product.price} CNY
- Category: ${product.category || "Uncategorized"}

# Core Rules
1.  **Diverse Styles**: The generated reviews should include different styles, such as:
    -   **Positive**: Praise a specific advantage of the product in detail.
    -   **Neutral/Follow-up**: Describe the experience after using the product for a while, possibly mentioning minor flaws.
    -   **Negative**: Critique a specific disadvantage of the product, but in a realistic buyer tone.
    -   **Humorous**: Write some funny and witty reviews.
    -   **Concise**: For example, "Great!", "It's okay", "Fast delivery".
2.  **Realistic Nicknames**: The author nicknames ("author") must be random, lifelike, and consistent with typical shopping app users. For example: "Anonymous", "Xiao Wang doesn't eat cilantro", "Cola Lover".
3.  **Strict JSON Format**: Your response **must and only** be a strict JSON array, with each object representing a review and containing "author" and "text" fields.

# JSON output format example:
[
  { "author": "Anonymous", "text": "Fast delivery, well-packaged, and the product matches the description. Great!" },
  { "author": "Xiao Zhang", "text": "Slight color difference, but acceptable. Will use it for a while and then update the review." }
]
`;
  try {
    const messagesForApi = [{ role: "user", content: prompt }];
    let isGemini = proxyUrl === GEMINI_API_URL;
    let geminiConfig = toGeminiRequestData(
      model,
      apiKey,
      prompt,
      messagesForApi,
      isGemini,
    );

    const response = isGemini
      ? await fetch(geminiConfig.url, geminiConfig.data)
      : await fetch(`${proxyUrl}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: messagesForApi,
            temperature: parseFloat(state.apiConfig.temperature) || 1.0,
            response_format: { type: "json_object" },
          }),
        });

    if (!response.ok) throw new Error(`API request failed: ${await response.text()}`);

    const data = await response.json();
    const rawContent = isGemini
      ? data.candidates[0].content.parts[0].text
      : data.choices[0].message.content;
    const cleanedContent = rawContent.replace(/^```json\s*|```$/g, "").trim();
    const newReviews = JSON.parse(cleanedContent);

    if (Array.isArray(newReviews) && newReviews.length > 0) {
      // Save the AI-generated reviews to the product data
      await db.taobaoProducts.update(productId, { reviews: newReviews });
      await showCustomAlert(
        "Generation Successful!",
        `Successfully generated ${newReviews.length} reviews.`,
      );
      // Reopen the product detail page to refresh the display
      await openProductDetail(productId);
    } else {
      throw new Error("AI returned data in an incorrect format.");
    }
  } catch (error) {
    console.error("Failed to generate product reviews:", error);
    await showCustomAlert("Generation Failed", `An error occurred: ${error.message}`);
  }
}

/**
 * 结算购物车
 */
async function handleCheckout() {
  const checkoutBtn = document.getElementById("checkout-btn");
  const totalPrice = parseFloat(checkoutBtn.dataset.totalPrice);

  if (totalPrice <= 0) return;

  const currentBalance = state.globalSettings.userBalance || 0;
  if (currentBalance < totalPrice) {
    alert("Insufficient balance! Please recharge on the 'My' page first.");
    return;
  }

  const confirmed = await showCustomConfirm(
    "Confirm Payment",
    `This purchase will cost ¥${totalPrice.toFixed(2)}. Are you sure you want to proceed?`,
    {
      confirmText: "Pay Now",
    },
  );

  if (confirmed) {
    const cartItems = await db.taobaoCart.toArray();
    const productPromises = cartItems.map((item) =>
      db.taobaoProducts.get(item.productId),
    );
    const productsInCart = await Promise.all(productPromises);
    const validProducts = productsInCart.filter(Boolean);

    let description = "Purchase items: ";
    const itemNames = validProducts.map((p) => `“${p.name}”`);
    if (itemNames.length > 2) {
      description +=
        itemNames.slice(0, 2).join("、") + ` and ${itemNames.length - 2} other items`;
    } else {
      description += itemNames.join("、");
    }

    await updateUserBalanceAndLogTransaction(-totalPrice, description);

    // Create initial logistics history for each order
    const newOrders = cartItems.map((item, index) => ({
      productId: item.productId,
      quantity: item.quantity,
      timestamp: Date.now() + index, // Order creation time
      status: "Paid, waiting for shipment",
      // We no longer need to store logisticsHistory in the database, as it is dynamically simulated
    }));

    await db.taobaoOrders.bulkAdd(newOrders);
    await db.taobaoCart.clear();
    await renderTaobaoCart();

    alert("Payment successful! Your items are being packed quickly~");
    switchTaobaoView("orders-view");
  }
}

/**
 * Render product list, generate and permanently save images as needed
 */
async function renderTaobaoProducts(category = null) {
  const gridEl = document.getElementById("product-grid");
  gridEl.innerHTML = "";

  const allProducts = await db.taobaoProducts.orderBy("name").toArray();
  const categories = [
    ...new Set(allProducts.map((p) => p.category).filter(Boolean)),
  ];

  const productsToRender = category
    ? allProducts.filter((p) => p.category === category)
    : allProducts;

  if (productsToRender.length === 0) {
    gridEl.innerHTML =
      '<p style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary);">No products available. Click the "+" button in the top right corner to add some!</p>';
    return;
  }

  productsToRender.forEach((product) => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.dataset.productId = product.id;

    card.innerHTML = `
        <div class="product-image-container">
            <!-- Image or loading animation will be here -->
        </div>
        <div class="product-info">
            <div class="product-name">${product.name}</div>
            <div class="product-price">${product.price.toFixed(2)}</div>
        </div>
    `;

    const imageContainer = card.querySelector(".product-image-container");

    if (product.imageUrl) {
      imageContainer.innerHTML = `<img src="${product.imageUrl}" class="product-image" alt="${product.name}">`;
    } else {
      imageContainer.innerHTML = `<div class="loading-spinner"></div>`;
      imageGenerationQueue.push({ type: "taobao", item: product });
    }

    addLongPressListener(card, () => showProductActions(product.id));
    gridEl.appendChild(card);
  });

  // 渲染完所有卡片后，触发一次队列处理器
  processImageQueue();
}

/**
 * 渲染“我的订单”列表
 */
async function renderTaobaoOrders() {
  const listEl = document.getElementById("order-list");
  listEl.innerHTML = "";
  const orders = await db.taobaoOrders.reverse().sortBy("timestamp");

  if (orders.length === 0) {
    listEl.innerHTML =
      '<p style="text-align: center; color: var(--text-secondary);">No orders yet</p>';
    return;
  }

  for (const order of orders) {
    const product = await db.taobaoProducts.get(order.productId);
    if (!product) continue;

    const item = document.createElement("div");
    item.className = "order-item";
    item.dataset.orderId = order.id;
    item.innerHTML = `
            <img src="${product.imageUrl}" class="product-image">
            <div class="order-info">
                <div class="product-name">${product.name}</div>
                <div class="order-status">${order.status}</div>
                <div class="order-time">${new Date(order.timestamp).toLocaleString()}</div>
            </div>
        `;
    listEl.appendChild(item);
  }
}

/**
 * Render "My" page balance
 */
function renderTaobaoBalance() {
  const balance = state.globalSettings.userBalance || 0;
  document.getElementById("user-balance-display").textContent =
    `¥ ${balance.toFixed(2)}`;
}

/**
 * Open the modal to choose how to add a product
 */
function openAddProductChoiceModal() {
  document.getElementById("add-product-choice-modal").classList.add("visible");
}

/**
 * Open the modal to manually add/edit a product
 */
function openProductEditor(productId = null) {
  currentEditingProductId = productId;
  const modal = document.getElementById("product-editor-modal");
  const titleEl = document.getElementById("product-editor-title");

  // 1. Restore default placeholder for the input field (because Eleme might change it)
  document.getElementById("product-category-input").placeholder =
    "e.g., Clothing, Snacks...";


  // 2. ★★★ 核心修复：重新绑定保存按钮 ★★★
  // 使用克隆大法清除之前可能绑定的“饿了么”保存事件或重复的“桃宝”保存事件
  const saveBtn = document.getElementById("save-product-btn");
  const newSaveBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

  // 绑定专属的桃宝保存函数
  newSaveBtn.addEventListener("click", saveProduct);

  if (productId) {
    titleEl.textContent = "Edit Product";
    // (异步) 加载现有商品数据
    db.taobaoProducts.get(productId).then((product) => {
      if (product) {
        document.getElementById("product-name-input").value = product.name;
        document.getElementById("product-price-input").value = product.price;
        document.getElementById("product-image-input").value = product.imageUrl;
        document.getElementById("product-category-input").value =
          product.category || "";
      }
    });
  } else {
    titleEl.textContent = "Add New Product";
    // Clear input fields
    document.getElementById("product-name-input").value = "";
    document.getElementById("product-price-input").value = "";
    document.getElementById("product-image-input").value = "";
    document.getElementById("product-category-input").value = "";
  }
  modal.classList.add("visible");
}

/**
 * Save manually added or edited product
 */
async function saveProduct() {
  const name = document.getElementById("product-name-input").value.trim();
  const price = parseFloat(
    document.getElementById("product-price-input").value,
  );
  let imageUrl = document.getElementById("product-image-input").value.trim();
  const category = document
    .getElementById("product-category-input")
    .value.trim();

  if (!name || isNaN(price) || price <= 0) {
    alert("Please fill in all required fields (Name, Valid Price)!");
    return;
  }

  // If the user did not provide an image URL, save an empty string.
  // The new rendering logic will automatically detect the empty URL and trigger AI image generation.
  if (!imageUrl) {
    imageUrl = ""; // Set to empty, let the renderer handle it
  }

  const productData = { name, price, imageUrl, category };

  if (currentEditingProductId) {
    await db.taobaoProducts.update(currentEditingProductId, productData);
    alert("Product updated!");
  } else {
    await db.taobaoProducts.add(productData);
    alert("New product added!");
  }

  document.getElementById("product-editor-modal").classList.remove("visible");
  await renderTaobaoProducts();
  currentEditingProductId = null;
}

/**
 * Save manually added food item
 */
async function saveFoodItem() {
  const name = document.getElementById("product-name-input").value.trim();
  const price = parseFloat(
    document.getElementById("product-price-input").value,
  );
  let imageUrl = document.getElementById("product-image-input").value.trim();
  const restaurant = document
    .getElementById("product-category-input")
    .value.trim();

  if (!name || isNaN(price) || price <= 0) {
    alert("Please fill in all required fields (Name, Valid Price)!");
    return;
  }

  // If the user did not provide an image URL, save an empty string.
  // The new rendering logic will automatically detect the empty URL and trigger AI image generation.
  if (!imageUrl) {
    imageUrl = ""; // Set to empty, let the renderer handle it
  }
  // ★★★ 修改结束 ★★★

  const foodData = {
    name,
    price,
    imageUrl,
    restaurant: restaurant || "Private Kitchen",
  };

  await db.elemeFoods.add(foodData);
  alert("New food item added!");

  document.getElementById("product-editor-modal").classList.remove("visible");
  await renderElemeFoods();
}

/**
 * 打开识别链接的弹窗
 */
function openAddFromLinkModal() {
  document.getElementById("link-paste-area").value = "";
  document.getElementById("add-from-link-modal").classList.add("visible");
}

/**
 * 处理粘贴的分享文案
 */
async function handleAddFromLink() {
  const text = document.getElementById("link-paste-area").value;
  const nameMatch = text.match(/「(.+?)」/);

  if (!nameMatch || !nameMatch[1]) {
    alert("Unable to recognize product name! Please ensure you have pasted the complete share text containing the 「product name」.");
    return;
  }

  const name = nameMatch[1];
  document.getElementById("add-from-link-modal").classList.remove("visible");

  const priceStr = await showCustomPrompt(
    `Product: ${name}`,
    "Please enter the price (CNY):",
    "",
    "number",
  );
  if (priceStr === null) return;
  const price = parseFloat(priceStr);
  if (isNaN(price) || price <= 0) {
    alert("Please enter a valid price!");
    return;
  }

  let imageUrl = await showCustomPrompt(
    `Product: ${name}`,
    "Please enter the image URL (optional, leave blank for AI generation):",
  );
  if (imageUrl === null) return;

  // 1. If the user did not enter an image URL
  if (!imageUrl || !imageUrl.trim()) {
    try {
      // 就调用我们的AI生图函数
      imageUrl = await generateImageForProduct(name);
    } catch (e) {
      console.error("An unexpected error occurred while calling the AI image generation function:", e);
      imageUrl = getRandomDefaultProductImage();
    }
  }

  const category = await showCustomPrompt(
    `Product: ${name}`,
    "Please enter the category (optional):",
  );

  await db.taobaoProducts.add({
    name,
    price,
    imageUrl,
    category: category || "",
  });
  await renderTaobaoProducts();
  alert("Product added successfully via link!");
}

/**
 * Trigger AI to generate products based on user search
 */
async function handleSearchProductsAI() {
  const searchTerm = productSearchInput.value.trim();
  if (!searchTerm) {
    alert("Please enter the product you want to search for!");
    return;
  }

  await showCustomAlert(
    "Please wait...",
    `AI is searching for inspiration related to "${searchTerm}"...`,
  );
  const { proxyUrl, apiKey, model } = state.apiConfig;
  if (!proxyUrl || !apiKey || !model) {
    alert("Please configure the API first!");
    return;
  }

  const prompt = `
# Task
You are the search engine for a virtual shopping app "Taobao". Based on the user's provided [search keywords], create a list of 5-8 related products.

# User's search keywords:
"${searchTerm}"

# Core Rules
1.  **Highly Relevant**: All products must be closely related to the user's search keywords "${searchTerm}".
2.  **Product Diversity**: Even for the same theme, try to showcase different styles, functions, or angles of the products.
3.  **Strict Format**: Your response **must** be a strict JSON array, with each object representing a product, and **must** include the following fields:
    -   \`"name"\`: Product name
    -   \`"price"\`: Price (number)
    -   \`"category"\`: Product category
    -   \`"imagePrompt"\`: A detailed English prompt for text-to-image AI, describing the product shot. Style requirements: clean, minimalist, solid color or gradient background.

# JSON output format example:
[
  {
    "name": "Cyberpunk Style Glowing Data Cable",
    "price": 69.9,
    "category": "Digital Accessories",
    "imagePrompt": "A glowing cyberpunk style data cable, product shot, on a dark tech background, neon lights, high detail"
  }
]`;

  try {
    const messagesForApi = [{ role: "user", content: prompt }];

    // 恢复对 Gemini 和 OpenAI 的兼容判断逻辑
    const isGemini = proxyUrl === GEMINI_API_URL;
    const requestData = isGemini
      ? toGeminiRequestData(model, apiKey, prompt, messagesForApi, isGemini)
      : {
          url: `${proxyUrl}/v1/chat/completions`,
          options: {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              temperature: 0.8,
              response_format: { type: "json_object" },
            }),
          },
        };

    const response = await fetch(requestData.url, requestData.options);

    if (!response.ok) throw new Error(`API request failed: ${await response.text()}`);

    const data = await response.json();
    const rawContent = isGemini
      ? data.candidates[0].content.parts[0].text
      : data.choices[0].message.content;
    const cleanedContent = rawContent.replace(/^```json\s*|```$/g, "").trim();
    const newProducts = JSON.parse(cleanedContent);

    if (Array.isArray(newProducts) && newProducts.length > 0) {
      displayAiGeneratedProducts(
        newProducts,
        `AI found the following products related to "${searchTerm}"`,
      );
    } else {
      throw new Error("AI did not find any related products.");
    }
  } catch (error) {
    console.error("AI product search failed:", error);
    await showCustomAlert("Search Failed", `An error occurred: ${error.message}`);
  }
}

/**
 * UI function: Display AI-generated product list in a modal and asynchronously load images
 * @param {Array} products - Array of AI-generated product objects
 * @param {string} title - Title of the modal
 */
function displayAiGeneratedProducts(products, title) {
  const modal = document.getElementById("ai-generated-products-modal");
  const titleEl = document.getElementById("ai-products-modal-title");
  const gridEl = document.getElementById("ai-product-results-grid");

  titleEl.textContent = title;
  gridEl.innerHTML = "";

  products.forEach((product, index) => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.id = `ai-product-${index}`;

    // Before inserting into HTML attributes, escape the JSON string to prevent quote conflicts
    // 1. Convert the product object to a JSON string
    const productJsonString = JSON.stringify(product);
    // 2. Replace single quotes in the string with HTML entity encoding
    const safeProductJsonString = productJsonString.replace(/'/g, "&#39;");

    card.innerHTML = `
        <div class="product-image-container">
            <div class="loading-spinner"></div>
        </div>
        <div class="product-info">
            <div class="product-name">${product.name}</div>
            <div class="product-price">${product.price.toFixed(2)}</div>
        </div>
        <button class="add-to-my-page-btn" data-product='${safeProductJsonString}'>+ Add to My Taobao</button>
    `;
    gridEl.appendChild(card);

    // Call the asynchronous function to load images
    // This function will silently generate images in the background and update the card upon success
    loadAndDisplayAiProductImage(product, card);
  });

  modal.classList.add("visible");
}

/**
 * 为AI生成的单个商品卡片加载图片
 * @param {object} productData - 商品数据，包含 imagePrompt
 * @param {HTMLElement} cardElement - 对应的商品卡片DOM元素
 */
async function loadAndDisplayAiProductImage(productData, cardElement) {
  const imageContainer = cardElement.querySelector(".product-image-container");
  if (!imageContainer) return;

  try {
    // 1. 调用全局统一的生图函数
    const imageUrl = await window.generatePollinationsImage(
      productData.imagePrompt,
      {
        width: 1024,
        height: 1024,
        model: "flux",
        nologo: true,
      },
    );

    // 2. Write back the generated image URL to the product data for later use when adding to the homepage
    productData.imageUrl = imageUrl;
    const addButton = cardElement.querySelector(".add-to-my-page-btn");
    if (addButton) {
      addButton.dataset.product = JSON.stringify(productData);
    }

    // 3. Update the card UI, replacing the loading animation with the generated image
    //    Check again if the card still exists on the page to prevent errors if the user closes the modal early
    if (document.body.contains(imageContainer)) {
      imageContainer.innerHTML = `<img src="${imageUrl}" class="product-image" alt="${productData.name}">`;
    }
  } catch (error) {
    // In theory, because generateAndLoadImage retries indefinitely, this is unlikely to be triggered
    // But for code robustness, we still handle this just in case
    console.error(`Failed to generate image for product "${productData.name}":`, error);
    if (document.body.contains(imageContainer)) {
      imageContainer.innerHTML = `<span>Image failed to load</span>`;
    }
  }
}

/**
 * Trigger AI to [randomly] generate products and display them in a modal
 */
async function handleGenerateProductsAI() {
  await showCustomAlert("Please wait...", "Requesting AI to generate a batch of interesting products...");
  const { proxyUrl, apiKey, model } = state.apiConfig;
  if (!proxyUrl || !apiKey || !model) {
    alert("Please configure the API first!");
    return;
  }

  const prompt = `
# Task
You are a product planner for a virtual shopping app "Taobao". Please create a list of 5-8 products.

# Core Rules
1.  **Product Diversity**: Products must be interesting and diverse, including clothing, snacks, home goods, virtual items, etc.
2.  **Clear Categorization**: Assign a reasonable category to each product.
3.  **Strict Format**: Your response **must and only** be a strict JSON array, with each object representing a product, **must** include the following fields:
    -   \`"name"\`: Product name (string)
    -   \`"price"\`: Price (number)
    -   \`"category"\`: Product category (string)
    -   \`"imagePrompt"\`: A detailed English prompt for text-to-image AI, describing the product shot. Style requirements: clean, minimalist, solid color or gradient background.

# JSON Output Format Example:
[
  {
    "name": "Glowing Mushroom Night Light",
    "price": 49.9,
    "category": "Home",
    "imagePrompt": "A glowing mushroom-shaped night light, minimalist, product shot, studio lighting, simple gradient background, high detail, photorealistic"
  }
]`;

  try {
    const messagesForApi = [{ role: "user", content: prompt }];

    // 恢复对 Gemini 和 OpenAI 的兼容判断逻辑
    const isGemini = proxyUrl === GEMINI_API_URL;
    const requestData = isGemini
      ? toGeminiRequestData(model, apiKey, prompt, messagesForApi, isGemini)
      : {
          url: `${proxyUrl}/v1/chat/completions`,
          options: {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              temperature: 1.1,
              response_format: { type: "json_object" },
            }),
          },
        };

    const response = await fetch(requestData.url, requestData.options);

    if (!response.ok) throw new Error(`API request failed: ${await response.text()}`);

    const data = await response.json();
    const rawContent = isGemini
      ? data.candidates[0].content.parts[0].text
      : data.choices[0].message.content;
    const cleanedContent = rawContent.replace(/^```json\s*|```$/g, "").trim();
    const newProducts = JSON.parse(cleanedContent);

    if (Array.isArray(newProducts) && newProducts.length > 0) {
      displayAiGeneratedProducts(newProducts, "AI randomly generated the following products");
    } else {
      throw new Error("AI returned data in an incorrect format.");
    }
  } catch (error) {
    console.error("AI failed to generate products:", error);
    await showCustomAlert("Generation Failed", `An error occurred: ${error.message}`);
  }
}

/**
 * 处理用户点击商品卡片的逻辑（购买）
 */
async function handleBuyProduct(productId) {
  const product = await db.taobaoProducts.get(productId);
  if (!product) return;

  const currentBalance = state.globalSettings.userBalance || 0;
  if (currentBalance < product.price) {
    alert("Insufficient balance, please top up in the 'My' page first!");
    return;
  }

  const confirmed = await showCustomConfirm(
    "Confirm Purchase",
    `Are you sure you want to spend ¥${product.price.toFixed(2)} to buy "${product.name}"?`,
    { confirmText: "Pay Now" },
  );

  if (confirmed) {
    // 1. Deduct balance
    state.globalSettings.userBalance -= product.price;
    await db.globalSettings.put(state.globalSettings);

    // 2. Create order
    const newOrder = {
      productId: productId,
      timestamp: Date.now(),
      status: "Paid, waiting for shipment",
    };
    await db.taobaoOrders.add(newOrder);

    // Simulate logistics update
    setTimeout(async () => {
      const orderToUpdate = await db.taobaoOrders
        .where({ timestamp: newOrder.timestamp })
        .first();
      if (orderToUpdate) {
        await db.taobaoOrders.update(orderToUpdate.id, {
          status: "Shipped, in transit",
        });
      }
    }, 1000 * 10); // Update to "Shipped" after 10 seconds

    alert("Purchase successful! You can check the logistics information in 'My Orders'.");
    renderTaobaoBalance(); // Refresh balance display
  }
}

/**
 * 长按商品时显示操作菜单
 */
async function showProductActions(productId) {
  const choice = await showChoiceModal("Product Actions", [
    { text: "✏️ Edit Product", value: "edit" },
    { text: "🗑️ Delete Product", value: "delete" },
  ]);

  if (choice === "edit") {
    openProductEditor(productId);
  } else if (choice === "delete") {
    const product = await db.taobaoProducts.get(productId);
    const confirmed = await showCustomConfirm(
      "Confirm Deletion",
      `Are you sure you want to delete the product "${product.name}"?`,
      {
        confirmButtonClass: "btn-danger",
      },
    );
    if (confirmed) {
      await db.taobaoProducts.delete(productId);
      await renderTaobaoProducts();
      alert("Product has been deleted.");
    }
  }
}

/**
 * 长按饿了么美食时显示操作菜单
 * @param {number} foodId - 美食的ID
 */
async function showFoodActions(foodId) {
  const choice = await showChoiceModal("Food Actions", [
    { text: "✏️ Edit", value: "edit" },
    { text: "🗑️ Delete", value: "delete" },
  ]);

  if (choice === "edit") {
    // 调用我们即将修改的、支持编辑的函数
    openFoodEditor(foodId);
  } else if (choice === "delete") {
    const food = await db.elemeFoods.get(foodId);
    if (!food) return;
    const confirmed = await showCustomConfirm(
      "Confirm Deletion",
      `Are you sure you want to delete "${food.name}"?`,
      {
        confirmButtonClass: "btn-danger",
      },
    );
    if (confirmed) {
      await db.elemeFoods.delete(foodId);
      await renderElemeFoods(); // Re-render the list
      await showCustomAlert("Deletion Successful", "The food item has been removed from the list.");
    }
  }
}

/**
 * 核心函数：更新用户余额并记录一笔交易
 * @param {number} amount - 交易金额 (正数为收入, 负数为支出)
 * @param {string} description - 交易描述 (例如: "转账给 XX", "收到 XX 的红包")
 */
async function updateUserBalanceAndLogTransaction(amount, description) {
  if (isNaN(amount)) return; // 安全检查

  // 确保余额是数字
  state.globalSettings.userBalance =
    (state.globalSettings.userBalance || 0) + amount;

  const newTransaction = {
    type: amount > 0 ? "income" : "expense",
    amount: Math.abs(amount),
    description: description,
    timestamp: Date.now(),
  };

  // 使用数据库事务，确保两步操作要么都成功，要么都失败
  await db.transaction(
    "rw",
    db.globalSettings,
    db.userWalletTransactions,
    async () => {
      await db.globalSettings.put(state.globalSettings);
      await db.userWalletTransactions.add(newTransaction);
    },
  );

  console.log(
    `User wallet updated: Amount=${amount.toFixed(2)}, New balance=${state.globalSettings.userBalance.toFixed(2)}`,
  );
}
/**
 * 处理删除单条交易记录（收入或支出）
 * @param {number} transactionId - 要删除的交易记录的ID
 */
async function handleDeleteTransaction(transactionId) {
  // 1. 在弹出确认框之前，先从数据库获取这条记录的详细信息
  const transaction = await db.userWalletTransactions.get(transactionId);
  if (!transaction) {
    await showCustomAlert("Error", "The transaction record could not be found, it may have been deleted.");
    return;
  }

  // 根据记录类型，生成动态的、更清晰的提示信息
  const actionText = transaction.type === "income" ? "deduct" : "refund";
  const confirmMessage = `Are you sure you want to delete this ${
    transaction.type === "income" ? "income" : "expense"
  } record?<br><br>This action will <strong>${actionText}</strong> <strong>¥${transaction.amount.toFixed(2)}</strong> from your balance.`;

  const confirmed = await showCustomConfirm("Confirm Deletion", confirmMessage, {
    confirmButtonClass: "btn-danger",
  });

  if (!confirmed) {
    return; // 如果用户取消，则不执行任何操作
  }

  try {
    // 2. 使用数据库事务来保证数据安全
    await db.transaction(
      "rw",
      db.globalSettings,
      db.userWalletTransactions,
      async () => {
        // 根据记录类型，决定是加余额还是减余额
        if (transaction.type === "income") {
          // 如果删除的是一笔收入，那么总余额应该减少
          state.globalSettings.userBalance -= transaction.amount;
        } else if (transaction.type === "expense") {
          // 如果删除的是一笔支出，那么总余额应该增加（钱被“退回”了）
          state.globalSettings.userBalance += transaction.amount;
        }

        // 3. 更新全局设置
        await db.globalSettings.put(state.globalSettings);

        // 4. 从交易记录表中删除这条记录
        await db.userWalletTransactions.delete(transactionId);
      },
    );

    // 5. 操作成功后，刷新UI
    await renderBalanceDetails();

    await showCustomAlert("Operation Successful", "The transaction record has been deleted and the balance has been updated.");
  } catch (error) {
    console.error("Error deleting transaction record:", error);
    await showCustomAlert("Operation Failed", `An error occurred: ${error.message}`);
  }
}

/**
 * 渲染“我的”页面的余额和交易明细 (支持删除所有记录)
 */
async function renderBalanceDetails() {
  // 1. 渲染当前余额
  const balance = state.globalSettings.userBalance || 0;
  document.getElementById("user-balance-display").textContent =
    `¥ ${balance.toFixed(2)}`;

  // 2. 渲染交易明细列表
  const listEl = document.getElementById("balance-details-list");
  listEl.innerHTML = ""; // 清空旧列表

  const transactions = await db.userWalletTransactions
    .reverse()
    .sortBy("timestamp");

  if (transactions.length === 0) {
    listEl.innerHTML =
      '<p style="text-align: center; color: var(--text-secondary); margin-top: 20px;">还没有任何明细记录</p>';
    return;
  }

  // 给列表加个标题
  listEl.innerHTML =
    '<h3 style="margin-bottom: 10px; color: var(--text-secondary);">余额明细</h3>';

  transactions.forEach((item) => {
    const itemEl = document.createElement("div");
    itemEl.className = "transaction-item";
    const sign = item.type === "income" ? "+" : "-";

    // 移除了 if 判断，现在为每一条记录都生成删除按钮
    const deleteButtonHtml = `<button class="delete-transaction-btn" data-transaction-id="${item.id}">×</button>`;

    itemEl.innerHTML = `
            <div class="transaction-info">
                <div class="description">${item.description}</div>
                <div class="timestamp">${new Date(item.timestamp).toLocaleString()}</div>
            </div>
            <div class="transaction-amount-wrapper">
                <div class="transaction-amount ${item.type}">
                    ${sign} ${item.amount.toFixed(2)}
                </div>
                ${deleteButtonHtml} 
            </div>
        `;
    listEl.appendChild(itemEl);
  });
}

/**
 * 打开物流详情页面
 * @param {number} orderId - 被点击的订单ID
 */
async function openLogisticsView(orderId) {
  const order = await db.taobaoOrders.get(orderId);
  if (!order) {
    alert("Order not found!");
    return;
  }

  // 每次打开都先清空旧的计时器
  logisticsUpdateTimers.forEach((timerId) => clearTimeout(timerId));
  logisticsUpdateTimers = [];

  // 显示物流页面，并开始渲染
  showScreen("logistics-screen");
  await renderLogisticsView(order);
}

/**
 * 渲染物流详情页面的所有内容
 * @param {object} order - 订单对象
 */
async function renderLogisticsView(order) {
  const contentArea = document.getElementById("logistics-content-area");
  contentArea.innerHTML = "Loading...";

  const product = await db.taobaoProducts.get(order.productId);
  if (!product) {
    contentArea.innerHTML = "Unable to load product information.";
    return;
  }

  // Render the top product information card
  contentArea.innerHTML = `
        <div class="logistics-product-summary">
            <img src="${product.imageUrl}" class="product-image">
            <div class="info">
                <div class="name">${product.name} (x${order.quantity})</div>
                <div class="status" id="logistics-main-status">Loading...</div>
            </div>
        </div>
        <div class="logistics-timeline" id="logistics-timeline-container"></div>
    `;

  const timelineContainer = document.getElementById(
    "logistics-timeline-container",
  );
  const mainStatusEl = document.getElementById("logistics-main-status");
  const creationTime = order.timestamp; // 使用订单的创建时间作为起点

  // 准备一些随机城市名，让物流看起来更真实
  const cities = [
    "Dongguan",
    "Guangzhou",
    "Changsha",
    "Wuhan",
    "Zhengzhou",
    "Beijing",
    "Shanghai",
    "Chengdu",
    "Xi'an",
  ];
  const startCity = getRandomItem(cities);
  let nextCity = getRandomItem(cities.filter((c) => c !== startCity));
  const userCity =
    getRandomItem(cities.filter((c) => c !== startCity && c !== nextCity)) ||
    "Your city";

  // --- 这就是模拟物流的核心 ---
  let cumulativeDelay = 0;
  logisticsTimelineTemplate.forEach((stepInfo) => {
    cumulativeDelay += stepInfo.delay;
    const eventTime = creationTime + cumulativeDelay; // 计算出这个步骤“应该”发生的时间
    const now = Date.now();

    // 替换文本中的占位符
    const stepText = stepInfo.text
      .replace(/{city}/g, startCity)
      .replace("{next_city}", nextCity)
      .replace("{user_city}", userCity);

    // 如果这个步骤的发生时间已经过去或就是现在
    if (now >= eventTime) {
      // 就立即把它渲染到页面上
      addLogisticsStep(
        timelineContainer,
        mainStatusEl,
        stepText,
        eventTime,
        true,
      );
    } else {
      // 否则，它就是一个“未来”的步骤
      const delayUntilEvent = eventTime - now; // 计算还有多久才发生
      // 设置一个定时器，在未来的那个时间点执行
      const timerId = setTimeout(() => {
        // 执行前再次检查用户是否还停留在物流页面
        if (
          document
            .getElementById("logistics-screen")
            .classList.contains("active")
        ) {
          addLogisticsStep(
            timelineContainer,
            mainStatusEl,
            stepText,
            eventTime,
            true,
          );
        }
      }, delayUntilEvent);
      // 把这个定时器的ID存起来，方便离开页面时清除
      logisticsUpdateTimers.push(timerId);
    }
  });

  // 如果订单刚刚创建，可能还没有任何步骤满足时间条件，此时手动显示第一条
  if (timelineContainer.children.length === 0) {
    const firstStep = logisticsTimelineTemplate[0];
    const stepText = firstStep.text
      .replace(/{city}/g, startCity)
      .replace("{next_city}", nextCity)
      .replace("{user_city}", userCity);
    addLogisticsStep(
      timelineContainer,
      mainStatusEl,
      stepText,
      creationTime,
      true,
    );
  }
}

/**
 * 在时间轴上添加一个物流步骤的辅助函数
 * @param {HTMLElement} container - 时间轴的DOM容器
 * @param {HTMLElement} mainStatusEl - 顶部主状态的DOM元素
 * @param {string} text - 物流信息文本
 * @param {number} timestamp - 该步骤发生的时间戳
 * @param {boolean} prepend - 是否添加到最前面（最新的步骤放前面）
 */
function addLogisticsStep(
  container,
  mainStatusEl,
  text,
  timestamp,
  prepend = false,
) {
  const stepEl = document.createElement("div");
  stepEl.className = "logistics-step";
  stepEl.innerHTML = `
        <div class="logistics-step-content">
            <div class="status-text">${text}</div>
            <div class="timestamp">${new Date(timestamp).toLocaleString("zh-CN")}</div>
        </div>
    `;

  if (prepend) {
    container.prepend(stepEl); // 插入到最前面
    mainStatusEl.textContent = text; // 更新顶部的状态
  } else {
    container.appendChild(stepEl);
  }
}

/**
 * 处理角色手机钱包余额和交易记录的通用函数
 * @param {string} charId - 要更新钱包的角色ID
 * @param {number} amount - 交易金额 (正数为收入, 负数为支出)
 * @param {string} description - 交易描述
 */
async function updateCharacterPhoneBankBalance(charId, amount, description) {
  const chat = state.chats[charId];
  if (!chat || chat.isGroup) return;

  if (!chat.characterPhoneData) chat.characterPhoneData = {};
  if (!chat.characterPhoneData.bank)
    chat.characterPhoneData.bank = { balance: 0, transactions: [] };
  if (typeof chat.characterPhoneData.bank.balance !== "number")
    chat.characterPhoneData.bank.balance = 0;

  chat.characterPhoneData.bank.balance += amount;

  const newTransaction = {
    type: amount > 0 ? "收入" : "支出",
    amount: Math.abs(amount),
    description: description,
    timestamp: Date.now(),
  };

  // 让最新的交易记录显示在最前面
  if (!Array.isArray(chat.characterPhoneData.bank.transactions)) {
    chat.characterPhoneData.bank.transactions = [];
  }
  chat.characterPhoneData.bank.transactions.unshift(newTransaction);

  await db.chats.put(chat);
  console.log(
    `✅ 角色[${chat.name}]钱包已更新: 金额=${amount.toFixed(2)}, 新余额=${chat.characterPhoneData.bank.balance.toFixed(
      2,
    )}`,
  );
}

/**
 * 打开一个单选的角色选择器，让用户选择一个代付对象
 * @returns {Promise<string|null>} - 返回选中的角色ID，如果取消则返回null
 */
async function openCharSelectorForCart() {
  return new Promise((resolve) => {
    // 复用分享功能的弹窗，很方便
    const modal = document.getElementById("share-target-modal");
    const listEl = document.getElementById("share-target-list");
    const titleEl = document.getElementById("share-target-modal-title");
    const confirmBtn = document.getElementById("confirm-share-target-btn");
    const cancelBtn = document.getElementById("cancel-share-target-btn");

    titleEl.textContent = "分享给谁代付？";
    listEl.innerHTML = "";

    const singleChats = Object.values(state.chats).filter((c) => !c.isGroup);

    if (singleChats.length === 0) {
      alert("你还没有任何可以分享的好友哦。");
      modal.classList.remove("visible");
      resolve(null);
      return;
    }

    // 使用 radio 单选按钮
    singleChats.forEach((chat) => {
      const item = document.createElement("div");
      item.className = "contact-picker-item";
      item.innerHTML = `
                <input type="radio" name="cart-share-target" value="${chat.id}" id="target-${
                  chat.id
                }" style="margin-right: 15px;">
                <label for="target-${chat.id}" style="display:flex; align-items:center; width:100%; cursor:pointer;">
                    <img src="${chat.settings.aiAvatar || defaultAvatar}" class="avatar">
                    <span class="name">${chat.name}</span>
                </label>
            `;
      listEl.appendChild(item);
    });

    modal.classList.add("visible");

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    const cleanup = () => modal.classList.remove("visible");

    newConfirmBtn.onclick = () => {
      const selectedRadio = document.querySelector(
        'input[name="cart-share-target"]:checked',
      );
      if (selectedRadio) {
        cleanup();
        resolve(selectedRadio.value);
      } else {
        alert("请选择一个代付对象！");
      }
    };

    newCancelBtn.onclick = () => {
      cleanup();
      resolve(null);
    };
  });
}

/**
 * 清空桃宝购物车
 */
async function clearTaobaoCart() {
  await db.taobaoCart.clear();
  await renderTaobaoCart();
  updateCartBadge();
}

/**
 * 根据购物车内容创建订单
 * @param {Array} cartItems - 购物车项目数组
 */
async function createOrdersFromCart(cartItems) {
  if (!cartItems || cartItems.length === 0) return;
  const newOrders = cartItems.map((item, index) => ({
    productId: item.productId,
    quantity: item.quantity,
    timestamp: Date.now() + index, // 防止时间戳完全相同
    status: "已付款，等待发货",
  }));
  await db.taobaoOrders.bulkAdd(newOrders);
  // 简单模拟物流更新
  setTimeout(async () => {
    const ordersToUpdate = await db.taobaoOrders
      .where("status")
      .equals("已付款，等待发货")
      .toArray();
    for (const order of ordersToUpdate) {
      await db.taobaoOrders.update(order.id, { status: "已发货，运输中" });
    }
  }, 1000 * 10);
}

/**
 * 处理“分享给Ta代付”的全部逻辑
 */
async function handleShareCart() {
  const cartItems = await db.taobaoCart.toArray();
  if (cartItems.length === 0) {
    alert("购物车是空的，先去加点宝贝吧！");
    return;
  }

  const targetChatId = await openCharSelectorForCart();
  if (!targetChatId) return;

  const char = state.chats[targetChatId];
  if (!char) return;

  let totalPrice = 0;
  const productPromises = cartItems.map((item) =>
    db.taobaoProducts.get(item.productId),
  );
  const products = await Promise.all(productPromises);
  cartItems.forEach((item, index) => {
    const product = products[index];
    if (product) {
      totalPrice += product.price * item.quantity;
    }
  });

  const charBalance = char.characterPhoneData?.bank?.balance || 0;
  if (charBalance < totalPrice) {
    await showCustomAlert(
      "代付失败",
      `“${char.name}”的钱包余额不足！\n需要 ¥${totalPrice.toFixed(2)}，但余额只有 ¥${charBalance.toFixed(2)}。`,
    );
    return;
  }

  const confirmed = await showCustomConfirm(
    "确认代付",
    `将分享购物车给“${char.name}”并请求代付，共计 ¥${totalPrice.toFixed(
      2,
    )}。\n这将会清空你的购物车，并从Ta的钱包扣款。确定吗？`,
    { confirmText: "确定" },
  );

  if (!confirmed) return;

  await showCustomAlert("处理中...", "正在通知Ta代付并下单...");

  // 1. 获取角色的手机数据，准备查找备注名
  const characterPhoneData = char.characterPhoneData || { chats: {} };

  // 2. 在角色的联系人中，找到代表“用户”的那个联系人对象
  //    （通常是那个没有聊天记录的特殊联系人条目）
  const userContactInData = Object.values(characterPhoneData.chats || {}).find(
    (c) => !c.history || c.history.length === 0,
  );

  // 3. 获取角色给用户的备注名，如果没设置，就默认用“我”
  const remarkForUser = userContactInData ? userContactInData.remarkName : "我";

  // 4. 使用这个新的备注名来创建交易记录
  const description = `为“${remarkForUser}”的桃宝购物车买单`;
  await updateCharacterPhoneBankBalance(targetChatId, -totalPrice, description);

  await createOrdersFromCart(cartItems);

  const itemsSummary = products
    .map((p, i) => `${p.name} x${cartItems[i].quantity}`)
    .join("、 ");

  // 给AI看的隐藏指令，告诉它发生了什么
  const hiddenMessage = {
    role: "system",
    content: `[系统提示：用户刚刚与你分享了TA的购物车，并请求你为总价为 ¥${totalPrice.toFixed(
      2,
    )} 的商品付款。你已经同意并支付了，你的钱包余额已被扣除。商品包括：${itemsSummary}。请根据你的人设对此作出回应，例如表示宠溺、抱怨花钱太多或者询问买了什么。]`,
    timestamp: Date.now(),
    isHidden: true,
  };
  char.history.push(hiddenMessage);
  await db.chats.put(char);

  await clearTaobaoCart();

  await showCustomAlert("操作成功", `“${char.name}”已成功为你买单！`);
  renderChatList();

  openChat(targetChatId); // 跳转到聊天界面
  triggerAiResponse(); // 让AI回应这次代付
}

/**
 * 处理“为Ta购买”的全部逻辑
 */
async function handleBuyForChar() {
  const cartItems = await db.taobaoCart.toArray();
  if (cartItems.length === 0) {
    alert("购物车是空的，先去加点宝贝吧！");
    return;
  }

  const targetChatId = await openCharSelectorForCart();
  if (!targetChatId) return; // 用户取消选择

  const char = state.chats[targetChatId];
  if (!char) return;

  let totalPrice = 0;
  const productPromises = cartItems.map((item) =>
    db.taobaoProducts.get(item.productId),
  );
  const products = await Promise.all(productPromises);
  products.forEach((product, index) => {
    if (product) {
      totalPrice += product.price * cartItems[index].quantity;
    }
  });

  // 检查用户余额
  if ((state.globalSettings.userBalance || 0) < totalPrice) {
    alert(
      `余额不足！本次需要 ¥${totalPrice.toFixed(2)}，但你的余额只有 ¥${(
        state.globalSettings.userBalance || 0
      ).toFixed(2)}。`,
    );
    return;
  }

  const confirmed = await showCustomConfirm(
    "确认赠送",
    `确定要花费 ¥${totalPrice.toFixed(2)} 为“${char.name}”购买购物车中的所有商品吗？`,
    { confirmText: "为Ta买单" },
  );

  if (confirmed) {
    await showCustomAlert("正在处理...", "正在为你心爱的Ta下单...");

    // 1. 扣除用户余额
    await updateUserBalanceAndLogTransaction(
      -totalPrice,
      `为 ${char.name} 购买商品`,
    );

    // 2. 将购物车内容转化为订单（记录在你的订单里）
    await createOrdersFromCart(cartItems);

    // 3. 发送礼物通知给对方
    await sendGiftNotificationToChar(
      targetChatId,
      products,
      cartItems,
      totalPrice,
    );

    // 4. 清空购物车
    await clearTaobaoCart();

    await showCustomAlert(
      "赠送成功！",
      `你为“${char.name}”购买的礼物已下单，并已通过私信通知对方啦！`,
    );
    renderChatList(); // 刷新列表，显示未读消息
  }
}

/**
 * 处理“为Ta购买”的全部逻辑
 */
async function handleBuyForChar() {
  const cartItems = await db.taobaoCart.toArray();
  if (cartItems.length === 0) {
    alert("购物车是空的，先去加点宝贝吧！");
    return;
  }

  const targetChatId = await openCharSelectorForCart();
  if (!targetChatId) return; // 用户取消选择

  const char = state.chats[targetChatId];
  if (!char) return;

  let totalPrice = 0;
  const productPromises = cartItems.map((item) =>
    db.taobaoProducts.get(item.productId),
  );
  const products = await Promise.all(productPromises);
  products.forEach((product, index) => {
    if (product) {
      totalPrice += product.price * cartItems[index].quantity;
    }
  });

  // 检查用户余额
  if ((state.globalSettings.userBalance || 0) < totalPrice) {
    alert(
      `余额不足！本次需要 ¥${totalPrice.toFixed(2)}，但你的余额只有 ¥${(
        state.globalSettings.userBalance || 0
      ).toFixed(2)}。`,
    );
    return;
  }

  const confirmed = await showCustomConfirm(
    "确认赠送",
    `确定要花费 ¥${totalPrice.toFixed(2)} 为“${char.name}”购买购物车中的所有商品吗？`,
    { confirmText: "为Ta买单" },
  );

  if (confirmed) {
    await showCustomAlert("正在处理...", "正在为你心爱的Ta下单...");

    // 1. 扣除用户余额
    await updateUserBalanceAndLogTransaction(
      -totalPrice,
      `为 ${char.name} 购买商品`,
    );

    // 2. 将购物车内容转化为订单（记录在你的订单里）
    await createOrdersFromCart(cartItems);

    // 3. 发送礼物通知给对方
    await sendGiftNotificationToChar(
      targetChatId,
      products,
      cartItems,
      totalPrice,
    );

    // 4. 清空购物车
    await clearTaobaoCart();

    await showCustomAlert(
      "赠送成功！",
      `你为“${char.name}”购买的礼物已下单，并已通过私信通知对方啦！`,
    );
    renderChatList(); // 刷新列表，显示未读消息
  }
}

/**
 * 发送礼物通知到指定角色的聊天
 * 效果：发送一条本质是文本、但外观是卡片的消息。
 *      - 用户界面显示为漂亮的礼物卡片。
 *      - 消息数据中包含完整的文本信息。
 *      - AI 仍然通过隐藏的系统指令接收信息。
 */
async function sendGiftNotificationToChar(
  targetChatId,
  products,
  cartItems,
  totalPrice,
) {
  const chat = state.chats[targetChatId];
  if (!chat) return;

  const itemsSummary = products
    .map((p, i) => `${p.name} x${cartItems[i].quantity}`)
    .join("、");

  // 1. 先准备好这条消息的“文本内容”
  const messageTextContent = `我给你买了新礼物，希望你喜欢！\n商品清单：${itemsSummary}\n合计：¥${totalPrice.toFixed(
    2,
  )}`;

  // 2. 创建对用户【可见】的消息对象。现在它同时拥有 “文本内容” 和 “卡片样式指令”
  const visibleMessage = {
    role: "user",

    // 为这条消息添加一个 content 属性，这就是它的“文本本体”
    // 当你复制这条消息时，复制出来的内容就是这个。
    content: messageTextContent,

    // 同时保留 type 和 payload，它们告诉渲染器“把这条消息画成卡片”
    type: "gift_notification",
    timestamp: Date.now(),
    payload: {
      senderName: state.qzoneSettings.nickname || "我",
      itemSummary: itemsSummary,
      totalPrice: totalPrice,
      itemCount: cartItems.length,
    },
  };
  chat.history.push(visibleMessage);

  // 3. 创建一条给AI看的【隐藏】指令，确保AI能理解并回应
  const hiddenMessage = {
    role: "system",
    content: `[系统指令：用户刚刚为你购买了${cartItems.length}件商品，总价值为${totalPrice.toFixed(
      2,
    )}元。商品包括：${itemsSummary}。请根据你的人设对此表示感谢或作出其他反应。]`,
    timestamp: Date.now() + 1,
    isHidden: true,
  };
  chat.history.push(hiddenMessage);

  // 4. 未读消息只增加1条
  chat.unreadCount = (chat.unreadCount || 0) + 1;
  await db.chats.put(chat);

  // 5. 发送横幅通知
  if (state.activeChatId !== targetChatId) {
    showNotification(targetChatId, "你收到了一份礼物！");
  }
}

/**
 * 处理用户点击“分享给Ta代付”按钮的逻辑
 */
async function handleShareCartRequest() {
  const cartItems = await db.taobaoCart.toArray();
  if (cartItems.length === 0) {
    alert("购物车是空的，先去加点宝贝吧！");
    return;
  }

  const targetChatId = await openCharSelectorForCart();
  if (!targetChatId) return;

  const chat = state.chats[targetChatId];
  if (!chat) return;

  let totalPrice = 0;
  const productPromises = cartItems.map((item) =>
    db.taobaoProducts.get(item.productId),
  );
  const products = await Promise.all(productPromises);
  const itemsSummary = products
    .map((p, i) => {
      if (p) {
        totalPrice += p.price * cartItems[i].quantity;
        return `${p.name} x${cartItems[i].quantity}`;
      }
      return "";
    })
    .filter(Boolean)
    .join("、 ");

  const charBalance = chat.characterPhoneData?.bank?.balance || 0;

  const confirmed = await showCustomConfirm(
    "确认代付请求",
    `将向“${chat.name}”发起购物车代付请求，共计 ¥${totalPrice.toFixed(2)}。`,
    { confirmText: "发送请求" },
  );

  if (!confirmed) return;

  // 1. 直接将所有信息都放入 content 字段，让用户也能看到
  const requestContent = `[购物车代付请求]
总金额: ¥${totalPrice.toFixed(2)}
商品: ${itemsSummary}
(你的当前余额: ¥${charBalance.toFixed(2)})
请使用 'cart_payment_response' 指令回应。`;

  // 2. 创建一条普通的用户消息，不再有 isHidden 标记
  const requestMessage = {
    role: "user", // 由用户发出
    type: "cart_share_request", // 类型保持不变，用于UI渲染
    timestamp: Date.now(),
    content: requestContent, // 将包含所有信息的文本作为内容
    payload: {
      // payload 依然保留，用于UI渲染卡片
      totalPrice: totalPrice,
      itemCount: cartItems.length,
      status: "pending",
    },
  };

  // 3. 将这条【单一的】消息添加到历史记录
  chat.history.push(requestMessage);

  await db.chats.put(chat);

  await showCustomAlert(
    "请求已发送",
    `已将代付请求发送给“${chat.name}”，请在聊天中查看TA的回应。`,
  );

  openChat(targetChatId);
}

/**
 * 【辅助函数】打开一个单选的角色选择器，让用户选择代付对象
 * (这个函数复用了分享功能的弹窗，稍作修改)
 */
async function openCharSelectorForCart() {
  return new Promise((resolve) => {
    const modal = document.getElementById("share-target-modal");
    const listEl = document.getElementById("share-target-list");
    const titleEl = document.getElementById("share-target-modal-title");
    const confirmBtn = document.getElementById("confirm-share-target-btn");
    const cancelBtn = document.getElementById("cancel-share-target-btn");

    titleEl.textContent = "分享给谁代付？";
    listEl.innerHTML = "";

    const singleChats = Object.values(state.chats).filter((c) => !c.isGroup);

    if (singleChats.length === 0) {
      alert("你还没有任何可以分享的好友哦。");
      modal.classList.remove("visible");
      resolve(null);
      return;
    }

    // 使用 radio 单选按钮
    singleChats.forEach((chat) => {
      const item = document.createElement("div");
      item.className = "contact-picker-item";
      item.innerHTML = `
                <input type="radio" name="cart-share-target" value="${chat.id}" id="target-${
                  chat.id
                }" style="margin-right: 15px;">
                <label for="target-${chat.id}" style="display:flex; align-items:center; width:100%; cursor:pointer;">
                    <img src="${chat.settings.aiAvatar || defaultAvatar}" class="avatar">
                    <span class="name">${chat.name}</span>
                </label>
            `;
      listEl.appendChild(item);
    });

    modal.classList.add("visible");

    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    const cleanup = () => modal.classList.remove("visible");

    newConfirmBtn.onclick = () => {
      const selectedRadio = document.querySelector(
        'input[name="cart-share-target"]:checked',
      );
      if (selectedRadio) {
        cleanup();
        resolve(selectedRadio.value);
      } else {
        alert("请选择一个代付对象！");
      }
    };

    newCancelBtn.onclick = () => {
      cleanup();
      resolve(null);
    };
  });
}

/**
 * 【辅助函数】清空用户的桃宝购物车
 */
async function clearTaobaoCart() {
  await db.taobaoCart.clear();
  updateCartBadge();
  // 如果用户正好在看购物车，就刷新一下
  if (document.getElementById("cart-view").classList.contains("active")) {
    renderTaobaoCart();
  }
}

/**
 * 【辅助函数】根据购物车内容创建订单
 * @param {Array} cartItems - 从数据库读出的购物车项目数组
 */
async function createOrdersFromCart(cartItems) {
  if (!cartItems || cartItems.length === 0) return;
  const newOrders = cartItems.map((item, index) => ({
    productId: item.productId,
    quantity: item.quantity,
    timestamp: Date.now() + index, // 防止时间戳完全相同
    status: "已付款，等待发货",
  }));
  await db.taobaoOrders.bulkAdd(newOrders);

  // 模拟10秒后自动发货
  setTimeout(async () => {
    const orderIds = newOrders.map((order) => order.timestamp);
    const ordersToUpdate = await db.taobaoOrders
      .where("timestamp")
      .anyOf(orderIds)
      .toArray();
    for (const order of ordersToUpdate) {
      await db.taobaoOrders.update(order.id, { status: "已发货，运输中" });
    }
    console.log(`${ordersToUpdate.length} 个新订单状态已更新为“已发货”。`);
  }, 1000 * 10);
}

/* --- “桃宝”App 功能函数结束 --- */
function initTaobao() {
  /* --- “桃宝”App 事件监听器 --- */

  // 1. 绑定主屏幕的App图标
  document
    .getElementById("taobao-app-icon")
    .addEventListener("click", openTaobaoApp);
  // 绑定新加的“清空”按钮
  document
    .getElementById("clear-taobao-products-btn")
    .addEventListener("click", clearTaobaoProducts);

  /* --- 桃宝购物车功能事件监听器 --- */

  // 1. 绑定App内部的页签切换
  document.querySelector(".taobao-tabs").addEventListener("click", (e) => {
    if (e.target.classList.contains("taobao-tab")) {
      switchTaobaoView(e.target.dataset.view);
    }
  });

  // 使用事件委托，统一处理桃宝所有页面的点击事件
  document
    .getElementById("taobao-screen")
    .addEventListener("click", async (e) => {
      const target = e.target;

      // --- 桃宝首页 ---
      if (target.closest("#products-view")) {
        const productCard = target.closest(".product-card");
        // 如果点击的是商品卡片本身（而不是添加购物车按钮）
        if (productCard && !target.classList.contains("add-cart-btn")) {
          // 调用桃宝的详情函数
          await openProductDetail(parseInt(productCard.dataset.productId));
        }
        // 如果点击的是添加购物车按钮
        else if (target.classList.contains("add-cart-btn")) {
          await handleAddToCart(parseInt(target.dataset.productId));
        }
        // 如果点击的是分类页签
        else if (target.closest(".category-tab-btn")) {
          const category =
            target.closest(".category-tab-btn").dataset.category === "all"
              ? null
              : target.closest(".category-tab-btn").dataset.category;
          await renderTaobaoProducts(category);
        }
      }

      // --- 饿了么页  ---
      else if (target.closest("#eleme-view")) {
        // 处理顶部的几个功能按钮
        if (target.closest("#eleme-search-btn")) {
          handleSearchFoodsAI();
        } else if (target.closest("#eleme-add-manual-btn")) {
          openFoodEditor();
        } else if (target.closest("#eleme-generate-ai-btn")) {
          handleGenerateFoodsAI();
        }
        // 处理美食卡片的点击
        else {
          const foodCard = target.closest(".product-card");
          if (foodCard) {
            const foodId = parseInt(foodCard.dataset.foodId);
            if (!isNaN(foodId)) {
              // ★★★ 当在饿了么页面点击卡片时，确保调用的是 openFoodDetail 函数！ ★★★
              await openFoodDetail(foodId);
            }
          }
        }
      }

      // --- 购物车页 ---
      else if (target.closest("#cart-view")) {
        if (
          target.closest(".cart-item-info") ||
          target.classList.contains("product-image")
        ) {
          const cartItem = target.closest(".cart-item");
          if (cartItem) {
            // 这里虽然也打开商品详情，但是从购物车点进去是合理的
            const productId =
              parseInt(
                cartItem.querySelector(".delete-cart-item-btn").dataset
                  .productId,
              ) || parseInt(target.dataset.productId);
            await openProductDetail(productId);
          }
        } else if (target.classList.contains("quantity-increase")) {
          await handleChangeCartItemQuantity(
            parseInt(target.dataset.cartId),
            1,
          );
        } else if (target.classList.contains("quantity-decrease")) {
          await handleChangeCartItemQuantity(
            parseInt(target.dataset.cartId),
            -1,
          );
        } else if (target.classList.contains("delete-cart-item-btn")) {
          const confirmed = await showCustomConfirm(
            "移出购物车",
            "确定要删除这个宝贝吗？",
          );
          if (confirmed)
            await handleRemoveFromCart(parseInt(target.dataset.cartId));
        } else if (target.id === "checkout-btn") {
          await handleCheckout();
        } else if (target.id === "share-cart-to-char-btn") {
          await handleShareCartRequest();
        } else if (target.id === "buy-for-char-btn") {
          await handleBuyForChar();
        }
      }

      // --- 订单页 ---
      else if (target.closest("#orders-view")) {
        const orderItem = target.closest(".order-item");
        if (orderItem)
          await openLogisticsView(parseInt(orderItem.dataset.orderId));
      }

      // --- 我的页面 ---
      else if (target.closest("#my-view")) {
        if (target.id === "top-up-btn") {
          // 调用新写的打开娃娃机函数
          openClawMachine();
        } else if (target.classList.contains("delete-transaction-btn")) {
          await handleDeleteTransaction(parseInt(target.dataset.transactionId));
        }
      }
    });

  // 4. 绑定首页右上角的“+”按钮
  document
    .getElementById("add-product-btn")
    .addEventListener("click", openAddProductChoiceModal);

  // 5. 绑定添加方式选择弹窗的按钮
  document
    .getElementById("add-product-manual-btn")
    .addEventListener("click", () => {
      document
        .getElementById("add-product-choice-modal")
        .classList.remove("visible");
      openProductEditor();
    });
  document
    .getElementById("add-product-link-btn")
    .addEventListener("click", () => {
      document
        .getElementById("add-product-choice-modal")
        .classList.remove("visible");
      openAddFromLinkModal();
    });
  document
    .getElementById("add-product-ai-btn")
    .addEventListener("click", () => {
      document
        .getElementById("add-product-choice-modal")
        .classList.remove("visible");
      handleGenerateProductsAI();
    });
  document
    .getElementById("cancel-add-choice-btn")
    .addEventListener("click", () => {
      document
        .getElementById("add-product-choice-modal")
        .classList.remove("visible");
    });

  // 6. 绑定手动添加/编辑弹窗的按钮
  document
    .getElementById("cancel-product-editor-btn")
    .addEventListener("click", () => {
      document
        .getElementById("product-editor-modal")
        .classList.remove("visible");
    });

  // 7. 绑定识别链接弹窗的按钮
  document
    .getElementById("cancel-link-paste-btn")
    .addEventListener("click", () => {
      document
        .getElementById("add-from-link-modal")
        .classList.remove("visible");
    });
  document
    .getElementById("confirm-link-paste-btn")
    .addEventListener("click", handleAddFromLink);

  document
    .getElementById("products-view")
    .addEventListener("click", async (e) => {
      const target = e.target;

      // 把原来的购买逻辑，改成了打开详情页的逻辑
      const productCard = target.closest(".product-card");
      if (productCard && !target.classList.contains("add-cart-btn")) {
        const productId = parseInt(productCard.dataset.productId);
        if (!isNaN(productId)) {
          await openProductDetail(productId); // <--- 就是修改了这里！
        }
        return;
      }

      // 下面这两部分逻辑保持不变
      if (target.classList.contains("add-cart-btn")) {
        const productId = parseInt(target.dataset.productId);
        if (!isNaN(productId)) {
          await handleAddToCart(productId);
        }
        return;
      }
      const categoryTab = target.closest(".category-tab-btn");
      if (categoryTab) {
        const category =
          categoryTab.dataset.category === "all"
            ? null
            : categoryTab.dataset.category;
        renderTaobaoProducts(category);
        return;
      }
    });

  // 饿了么功能的核心事件监听器
  document.getElementById("eleme-view").addEventListener("click", async (e) => {
    // AI生成按钮
    if (e.target.closest("#eleme-generate-ai-btn")) {
      handleGenerateFoodsAI();
      return;
    }
    // 手动添加按钮
    if (e.target.closest("#eleme-add-manual-btn")) {
      openFoodEditor();
      return;
    }
    // 搜索按钮
    if (e.target.closest("#eleme-search-btn")) {
      handleSearchFoodsAI();
      return;
    }
    // ★★★ 核心修改：现在监听整个美食卡片的点击 ★★★
    const foodCard = e.target.closest(".product-card");
    if (foodCard) {
      const foodId = parseInt(foodCard.dataset.foodId);
      if (!isNaN(foodId)) {
        // 点击卡片后，调用我们新写的函数打开详情页
        await openFoodDetail(foodId);
      }
    }
  });

  // 绑定饿了么的“清空”按钮
  document
    .getElementById("eleme-clear-all-btn")
    .addEventListener("click", clearElemeFoods);

  /* --- “桃宝”App 搜索与AI结果弹窗事件监听器 --- */

  // 1. 绑定搜索按钮
  productSearchBtn.addEventListener("click", handleSearchProductsAI);
  productSearchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      handleSearchProductsAI();
    }
  });

  // 2. 绑定AI结果弹窗的关闭按钮
  document
    .getElementById("close-ai-products-modal-btn")
    .addEventListener("click", async () => {
      aiGeneratedProductsModal.classList.remove("visible");
      // 关闭后刷新主页，显示新添加的商品
      await renderTaobaoProducts();
    });

  // 3. 使用事件委托，处理结果弹窗内所有“添加”按钮的点击
  document
    .getElementById("ai-product-results-grid")
    .addEventListener("click", async (e) => {
      if (e.target.classList.contains("add-to-my-page-btn")) {
        const button = e.target;
        const productData = JSON.parse(button.dataset.product);

        // 1. 检查AI返回的商品数据里是否已经成功生成了图片URL
        if (!productData.imageUrl) {
          // 2. 如果【没有】图片URL（即生图失败了），
          //    我们就手动将它的imageUrl设置为空字符串''。
          productData.imageUrl = "";
          console.log(
            `AI生成的商品 "${productData.name}" 缺少图片，将添加到主页后继续尝试生成。`,
          );
        }
        // 3. 如果已经有图片URL了，就什么也不做，直接使用现有的URL。
        //    我们不再需要那个补充默认图的 else 分支了。
        // ★★★★★ 修改结束 ★★★★★

        // 检查商品是否已存在（这部分逻辑不变）
        const existingProduct = await db.taobaoProducts
          .where("name")
          .equals(productData.name)
          .first();
        if (existingProduct) {
          alert("这个商品已经存在于你的桃宝主页啦！");
          button.textContent = "已添加";
          button.disabled = true;
          return;
        }

        // 添加到数据库（现在，生图失败的商品会以 imageUrl: '' 的形式被保存）
        await db.taobaoProducts.add(productData);

        // 禁用按钮并更新文本，给用户反馈
        button.textContent = "✓ 已添加";
        button.disabled = true;
      }
    });

  /* --- 桃宝订单物流功能事件监听器 --- */

  // 1. 使用事件委托，为“我的订单”列表中的所有订单项绑定点击事件
  document.getElementById("orders-view").addEventListener("click", (e) => {
    const item = e.target.closest(".order-item");
    if (item && item.dataset.orderId) {
      const orderId = parseInt(item.dataset.orderId);
      if (!isNaN(orderId)) {
        openLogisticsView(orderId);
      }
    }
  });

  // 2. 绑定物流页面的返回按钮
  document
    .getElementById("logistics-back-btn")
    .addEventListener("click", () => {
      // 返回时，直接显示“桃宝”主界面，并自动切换到“我的订单”页签
      showScreen("taobao-screen");
      switchTaobaoView("orders-view");
    });

  /* --- 事件监听结束 --- */

  document
    .getElementById("share-cart-to-char-btn")
    .addEventListener("click", handleShareCartRequest);

  document
    .getElementById("buy-for-char-btn")
    .addEventListener("click", handleBuyForChar);
  // ... 其他绑定 ...

  // 绑定娃娃机内部按钮
  document
    .getElementById("close-claw-machine")
    .addEventListener("click", () => {
      document.getElementById("claw-machine-modal").classList.remove("visible");
    });

  const grabBtn = document.getElementById("claw-grab-btn");
  // 使用 cloneNode 移除旧的监听器，防止重复绑定 (可选，更安全)
  const newGrabBtn = grabBtn.cloneNode(true);
  grabBtn.parentNode.replaceChild(newGrabBtn, grabBtn);
  newGrabBtn.addEventListener("click", handleGrab);

  // ★★★ 绑定管理按钮 (Gear icon) ★★★
  const manageBtn = document.getElementById("claw-manage-btn");
  if (manageBtn) {
    manageBtn.addEventListener("click", openDollManager);
  }

  // ★★★ 绑定刷新按钮 (Restart icon) ★★★
  const restartBtn = document.getElementById("claw-restart-btn");
  if (restartBtn) {
    restartBtn.addEventListener("click", handleRestartClaw);
  }

  // 管理弹窗内的按钮
  document
    .getElementById("close-doll-manager-btn")
    .addEventListener("click", () => {
      document.getElementById("doll-manager-modal").classList.remove("visible");
      // 关闭管理窗口时，自动刷新一下娃娃机，以便显示用户刚上传的图
      resetClawMachine();
    });
  document
    .getElementById("add-doll-btn")
    .addEventListener("click", handleAddDoll);
  document
    .getElementById("reset-dolls-btn")
    .addEventListener("click", resetDefaultDolls);
  document
    .getElementById("doll-upload-input")
    .addEventListener("change", handleDollFileChange);
}
