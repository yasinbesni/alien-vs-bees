// -------------------- GAME STATE --------------------
const GAME_STATE = {
  MENU: "menu",
  PLAYING: "playing",
  PAUSED: "paused",
  GAMEOVER: "gameover",
  LEVEL_UNLOCK: "level_unlock",
};

const footer = document.getElementById("footer");

function updateFooterVisibility() {
  if (!footer) return;

  const show =
    gameState === GAME_STATE.MENU ||
    gameState === GAME_STATE.GAMEOVER ||
    gameState === GAME_STATE.LEVEL_UNLOCK;

  footer.style.display = show ? "block" : "none";
}


function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fadeTo(targetVolume, ms = 500) {
  if (!bgm) return;
  const steps = 20;
  const start = bgm.volume ?? 0.35;
  const delta = (targetVolume - start) / steps;
  const stepMs = ms / steps;

  for (let i = 0; i < steps; i++) {
    bgm.volume = Math.max(0, Math.min(1, start + delta * (i + 1)));
    await sleep(stepMs);
  }
}

async function playMusicFadeIn() {
  if (!bgm) return;
  try {
    bgm.loop = true;
    bgm.muted = false;
    bgm.volume = 0;
    bgm.currentTime = 0;
    bgm.load();
    await bgm.play();
    await fadeTo(0.35, 600); // hedef ses
  } catch (e) {}
}

async function resumeMusicFadeIn() {
  if (!bgm) return;
  try {
    bgm.muted = false;
    if (bgm.paused) await bgm.play();
    await fadeTo(0.35, 350);
  } catch (e) {}
}

async function stopMusicFadeOut() {
  if (!bgm) return;
  try {
    await fadeTo(0, 450);
    bgm.pause();
    bgm.currentTime = 0;
    bgm.volume = 0.35; // sonraki play için reset
  } catch (e) {}
}



let gameState = GAME_STATE.MENU;
let currentLevel = 1;
let shipHP = 3;
const SHIP_MAX_HP = 3;

const hpEl = document.getElementById("hp");
function setHpUI(){ if(hpEl) hpEl.textContent = String(shipHP); }

function nextLevelScore() {
  return currentLevel * 400; // 1->400, 2->800, 3->1200 ...
}


// -------------------- DOM --------------------
const game = document.getElementById("game");
const bgm = document.getElementById("bgm");



const ship = document.getElementById("ship");
const flame = document.getElementById("ship-flame");

const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");

const pauseBtn = document.getElementById("pauseBtn");

const centerUI = document.getElementById("centerUI");
const centerTitle = document.getElementById("centerTitle");
const centerDesc = document.getElementById("centerDesc");
const startBtn = document.getElementById("startBtn");

const rotateOverlay = document.getElementById("rotateOverlay");
const tryLockBtn = document.getElementById("tryLock");

// -------------------- ASSETS --------------------
const beeFrames = ["./bee1.png","./bee2.png","./bee3.png","./bee4.png","./bee5.png","./bee6.png"];
const planeImgSrc = "./enemyPlane.png";
const flameFrames = ["./flame1.png","./flame2.png","./flame3.png"]; // same file 3x if you have only one

// -------------------- CONSTANTS --------------------
const SHIP_X = 30;
const SHIP_W = 120;
const SHIP_H = 80;

const SHIP_SPEED = 6;

const BULLET_SPEED = 9;
const ENEMY_BULLET_SPEED = -5.2;

const FIRE_COOLDOWN_MS = 150;

const BEE_FRAME_INTERVAL = 180;

// Difficulty updated per level
const difficulty = {
  enemySpawnMs: 650,
  enemySpeedMin: 2.2,
  enemySpeedMax: 4.8,
};
let musicUnlocked = false;
// -------------------- RUNTIME --------------------
let score = 0;

let lastFireAt = 0;
let lastT = performance.now();

let shipY = window.innerHeight * 0.4;
let targetShipY = shipY;

let isFiringHeld = false;
let isSpaceHeld = false;
let keys = { up: false, down: false };

// Orientation gate
let isGamePausedForOrientation = false;

// Timers
let enemySpawnTimer = null;

// Entities
const enemies = [];      // {type, el, img, x,y,vx,w,h, frameIndex, frameTimer, hp, shootTimer, shootInterval}
const bullets = [];      // {el,x,y,vx,w,h}
const enemyBullets = []; // {el,x,y,vx,vy,w,h}






function isDesktop() {
  return window.matchMedia("(pointer: fine)").matches; // mouse olan cihazlar
}
function levelSpeedBoost() {
  return 1 + (currentLevel - 1) * 0.15; 
  // L1: 1.00
  // L2: 1.15
  // L3: 1.30
  // L4: 1.45
}

// -------------------- HELPERS --------------------
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function rand(min, max) { return Math.random() * (max - min) + min; }

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}
    //çarpışma belirginliği için içe 3-4px inset
function insetRect(rect, inset = 4) {
  return {
    x: rect.x + inset,
    y: rect.y + inset,
    w: rect.w - inset * 2,
    h: rect.h - inset * 2,
  };
}


function renderShip() {
  ship.style.left = `${SHIP_X}px`;
  ship.style.top = `${shipY}px`;
}

function setLevelUI() { levelEl.textContent = String(currentLevel); }
function setScoreUI() { scoreEl.textContent = String(score); }

function showCenterUI(title, desc, btnText = "Oyunu Başlat") {
  centerTitle.textContent = title;
  centerDesc.textContent = desc;
  startBtn.textContent = btnText;
  centerUI.classList.remove("hidden");
}
function hideCenterUI() { centerUI.classList.add("hidden"); }

function startSpawning() {
  if (enemySpawnTimer) return;
  enemySpawnTimer = setInterval(() => {
    if (isGamePausedForOrientation) return;
    if (gameState !== GAME_STATE.PLAYING) return;
    spawnEnemyOrPlane();
  }, difficulty.enemySpawnMs);
}
function stopSpawning() {
  if (!enemySpawnTimer) return;
  clearInterval(enemySpawnTimer);
  enemySpawnTimer = null;
}

function resetRound() {
  bullets.forEach(b => b.el.remove()); bullets.length = 0;
  enemyBullets.forEach(b => b.el.remove()); enemyBullets.length = 0;
  enemies.forEach(e => e.el.remove()); enemies.length = 0;

  shipY = window.innerHeight * 0.4;
  targetShipY = shipY;

  keys.up = false; keys.down = false;
  isFiringHeld = false; isSpaceHeld = false;

  lastFireAt = 0;

  shipHP = SHIP_MAX_HP;
  setHpUI?.();
  renderShip();
}

function gameOver(reasonText = "Game Over") {
  stopMusicFadeOut();
  gameState = GAME_STATE.GAMEOVER;
  stopSpawning();
  pauseBtn.textContent = "Durdur";
  showCenterUI("GAME OVER", reasonText, "Yeniden Başlat");
  updateFooterVisibility();
}

function unlockNextLevel() {
  stopMusicFadeOut();
  gameState = GAME_STATE.LEVEL_UNLOCK;
  stopSpawning();
  currentLevel += 1;
  setLevelUI();
  pauseBtn.textContent = "Durdur";
  showCenterUI(
    `Tebrikler! ${currentLevel}. seviye kilidi açıldı`,
    "Devam etmek için Başlat'a bas",
    `${currentLevel}. Seviyeyi Başlat`
  );
  updateFooterVisibility();
}

function startGameOrLevel() {
  if (isGamePausedForOrientation) return;

  resetRound();

  // Increase difficulty by level
  difficulty.enemySpawnMs = Math.max(240, 650 - (currentLevel - 1) * 80);
  difficulty.enemySpeedMin = 1.2 + (currentLevel - 1) * 0.25;
  difficulty.enemySpeedMax = 2.2 + (currentLevel - 1) * 0.35;

  stopSpawning();
  startSpawning();

  gameState = GAME_STATE.PLAYING;
  pauseBtn.textContent = "Durdur";
  hideCenterUI();
  updateFooterVisibility();
}

function pauseGame() {
  if (gameState !== GAME_STATE.PLAYING) return;
  stopMusicFadeOut();
  gameState = GAME_STATE.PAUSED;
  stopSpawning();
  pauseBtn.textContent = "Devam";
}
async function resumeGame() {
  if (gameState !== GAME_STATE.PAUSED) return;
   await resumeMusicFadeIn();
  gameState = GAME_STATE.PLAYING;
  startSpawning();
  pauseBtn.textContent = "Durdur";
}
function spawnHitSpark(x, y, size = 26) {
  const el = document.createElement("div");
  el.className = "hit-spark";
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  game.appendChild(el);
  setTimeout(() => el.remove(), 200);
}

function spawnBeeExplosion(x, y, size = 70) {
  const el = document.createElement("div");
  el.className = "explosion-bee";
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  game.appendChild(el);
  setTimeout(() => el.remove(), 320);
}

function spawnPlaneExplosion(x, y, size = 130) {
  const el = document.createElement("div");
  el.className = "explosion-plane";
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  game.appendChild(el);
  setTimeout(() => el.remove(), 600);
}


function centerOfEnemy(e) {
  return { x: e.x + e.w / 2, y: e.y + e.h / 2 };
}

const sfxShoot = document.getElementById("sfxShoot");

function playShootSfx() {
  if (!sfxShoot) return;

  try {
    const a = sfxShoot.cloneNode(true); // overlap için
    a.volume = 0.35;
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch (_) {}
}
function spawnHitEffect(x, y) {
  const hit = document.createElement("div");
  hit.className = "hit-effect";
  hit.style.left = `${x}px`;
  hit.style.top = `${y}px`;
  game.appendChild(hit);

  setTimeout(() => hit.remove(), 180);
}
function planeHitFeedback(e) {
  e.el.classList.add("hit-shake");
  e.el.classList.add("hit-flash");

  setTimeout(() => {
    e.el.classList.remove("hit-shake");
    e.el.classList.remove("hit-flash");
  }, 120);
}
function spawnSmoke(x, y) {
  const smoke = document.createElement("div");
  smoke.className = "smoke";

  const size = rand(18, 32);
  smoke.style.width = `${size}px`;
  smoke.style.height = `${size}px`;
  smoke.style.left = `${x}px`;
  smoke.style.top = `${y}px`;

  game.appendChild(smoke);

  setTimeout(() => smoke.remove(), 900);
}

function spawnShipExplosion(x, y, size = 140) {
  const el = document.createElement("div");
  el.className = "explosion-plane"; // uçak patlamasıyla aynı görünsün
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  game.appendChild(el);
  setTimeout(() => el.remove(), 600);
}




// -------------------- FLAME ANIM --------------------
let flameFrame = 0;
setInterval(() => {
  flameFrame = (flameFrame + 1) % flameFrames.length;
  flame.src = flameFrames[flameFrame];
}, 80);

// -------------------- ENEMY LOGIC --------------------
function maxPlanesForLevel() {
  if (currentLevel < 2) return 0;      // Level 1: hiç yok
  return Math.min(currentLevel - 1, 6); // L2:1, L3:2, L4:3... (istersen üst limit değiştir)
}

function countPlanesOnScreen() {
  return enemies.reduce((acc, e) => acc + (e.type === "plane" ? 1 : 0), 0);
}


function spawnEnemyOrPlane() {
  const maxPlanes = maxPlanesForLevel();
  const planesNow = countPlanesOnScreen();

  // Uçak limiti dolduysa sadece arı
  if (planesNow >= maxPlanes) {
    spawnBeeEnemy();
    return;
  }

  // Level 1'de zaten 0 olduğu için buraya düşmez.
  // Level arttıkça uçak gelme olasılığı artsın:
  const planeChance = Math.min(0.35, 0.10 + (currentLevel - 2) * 0.08); 
  // L2:10%, L3:18%, L4:26%, L5:34% ...

  const spawnPlane = Math.random() < planeChance;
  if (spawnPlane) spawnPlaneEnemy();
  else spawnBeeEnemy();
}

function spawnBeeEnemy() {
  const w = 64, h = 64;
  const beeDesktopBoost = isDesktop() ? 2 : 1;
  const speedBoost = levelSpeedBoost();

  const el = document.createElement("div");
  el.className = "enemy";

  const img = document.createElement("img");
  const frameIndex = Math.floor(Math.random() * beeFrames.length);
  img.src = beeFrames[frameIndex];
  img.alt = "bee";
  el.appendChild(img);

  const e = {
    type: "bee",
    el, img,
    x: window.innerWidth + w,
    y: rand(20, window.innerHeight - h - 20),
    vx: -clampSpeed(rand(
      difficulty.enemySpeedMin * beeDesktopBoost * speedBoost,
      difficulty.enemySpeedMax * beeDesktopBoost * speedBoost
    )),
    w, h,
    frameIndex,
    frameTimer: 0,
    hp: 1,
    shootTimer: 0,
    shootInterval: 0,
  };

  // ✅ önce konum
  el.style.transform = `translate(${e.x}px, ${e.y}px)`;
  game.appendChild(el);
  requestAnimationFrame(() => el.classList.add("fade-in"));

  enemies.push(e);
}



function clampSpeed(v) {
  return Math.min(v, 6.5); // asla bundan hızlı olmasın
}

function removeEnemyWithFade(e) {
  if (e._removing) return; // çift çağrıyı engelle
  e._removing = true;

  const cx = e.x + e.w / 2;
  const cy = e.y + e.h / 2;

  if (e.type === "plane") spawnPlaneExplosion(cx, cy, 140);
  else spawnBeeExplosion(cx, cy, 80);

  e.el.classList.remove("fade-in");
  e.el.classList.add("fade-out");

  setTimeout(() => {
    e.el.remove();

    const idx = enemies.indexOf(e);
    if (idx !== -1) enemies.splice(idx, 1);
  }, 300);
}






function spawnPlaneEnemy() {
  const w = 96, h = 64;
  const speedBoost = levelSpeedBoost();

  const e = {
    type: "plane",
    el: document.createElement("div"),
    img: document.createElement("img"),
    x: window.innerWidth + w,
    y: rand(20, window.innerHeight - h - 20),
    vx: -clampSpeed(rand(
      difficulty.enemySpeedMin * 0.30 * speedBoost,
      difficulty.enemySpeedMax * 0.30 * speedBoost
    )),
    w, h,
    frameIndex: 0,
    frameTimer: 0,
    hp: 5,
    maxHp: 5,
    smokeTimer: 0,
    shootTimer: 0,
    shootInterval: rand(1400, 2400),
  };

  e.el.className = "enemy plane";
  e.img.src = planeImgSrc;
  e.img.alt = "enemy plane";
  e.el.appendChild(e.img);

  // ✅ DOM’a eklemeden ÖNCE konumu ver (0,0 flash biter)
  e.el.style.transform = `translate(${e.x}px, ${e.y}px)`;

  game.appendChild(e.el);

  // ✅ fade-in’i bir sonraki frame’de ekle (transition düzgün çalışır)
  requestAnimationFrame(() => e.el.classList.add("fade-in"));

  enemies.push(e);
}


function spawnEnemyBullet(fromX, fromY, enemyWidth = 96) {
  const el = document.createElement("div");
  el.className = "bullet enemy";
  game.appendChild(el);

  const w = 14, h = 5;

  enemyBullets.push({
    el,
    // 👇 uçağın ÖNÜNDEN (sol burun)
    x: fromX - w,
    y: fromY - h / 2,
    vx: ENEMY_BULLET_SPEED,
    vy: 0,
    w, h,
  });
}


// -------------------- PLAYER BULLETS --------------------
function fireBullet() {
  if (isGamePausedForOrientation) return;
  if (gameState !== GAME_STATE.PLAYING) return;

  const now = performance.now();
  if (now - lastFireAt < FIRE_COOLDOWN_MS) return;
  lastFireAt = now;

  const el = document.createElement("div");
  el.className = "bullet";
  game.appendChild(el);
  playShootSfx(); // ✅ mermi sesi

  const w = 18, h = 6;
  const x = SHIP_X + SHIP_W - 10;
  const y = shipY + SHIP_H / 2 - h / 2;

  bullets.push({ el, x, y, vx: BULLET_SPEED, w, h });
}

// -------------------- INPUT --------------------
function setTargetFromClientY(clientY) {
  targetShipY = clamp(clientY - SHIP_H / 2, 10, window.innerHeight - SHIP_H - 10);
}

window.addEventListener("pointerdown", (e) => {
  if (isGamePausedForOrientation) return;
  if (gameState !== GAME_STATE.PLAYING) return;
  isFiringHeld = true;
  setTargetFromClientY(e.clientY);
  fireBullet();
}, { passive: true });

window.addEventListener("pointermove", (e) => {
  if (isGamePausedForOrientation) return;
  if (gameState !== GAME_STATE.PLAYING) return;
  setTargetFromClientY(e.clientY);
}, { passive: true });

window.addEventListener("pointerup", () => { isFiringHeld = false; }, { passive: true });
window.addEventListener("pointercancel", () => { isFiringHeld = false; }, { passive: true });

window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowUp" || e.code === "KeyW") keys.up = true;
  if (e.code === "ArrowDown" || e.code === "KeyS") keys.down = true;

  if (e.code === "Space") {
    isSpaceHeld = true;
    fireBullet();
    e.preventDefault();
  }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowUp" || e.code === "KeyW") keys.up = false;
  if (e.code === "ArrowDown" || e.code === "KeyS") keys.down = false;

  if (e.code === "Space") {
    isSpaceHeld = false;
    e.preventDefault();
  }
});

// -------------------- ORIENTATION GATE --------------------
function isPortrait() { return window.matchMedia("(orientation: portrait)").matches; }

function pauseGameForOrientation() {
  isGamePausedForOrientation = true;
  stopSpawning();
  rotateOverlay.classList.remove("hidden");
}
function resumeGameAfterOrientation() {
  isGamePausedForOrientation = false;
  rotateOverlay.classList.add("hidden");
  // only resume spawning if currently playing
  if (gameState === GAME_STATE.PLAYING) startSpawning();
}

function updateOrientationGate() {
  const isMobile = window.matchMedia("(max-width: 900px)").matches;
  if (isMobile && isPortrait()) pauseGameForOrientation();
  else resumeGameAfterOrientation();
}

async function tryLockLandscape() {
  try {
    if (screen.orientation?.lock) await screen.orientation.lock("landscape");
  } catch (_) {}
  updateOrientationGate();
}

tryLockBtn?.addEventListener("click", tryLockLandscape);
window.addEventListener("resize", updateOrientationGate);
window.addEventListener("orientationchange", updateOrientationGate);

// -------------------- UI EVENTS --------------------
pauseBtn.addEventListener("click", async () => {
  if (isGamePausedForOrientation) return;
  if (gameState === GAME_STATE.PLAYING) pauseGame();
  else if (gameState === GAME_STATE.PAUSED) await resumeGame();
});


startBtn.addEventListener("click", async () => {
  if (isGamePausedForOrientation) return;

  // Müzik sadece oyuna girerken başlasın (MENU / GAMEOVER / LEVEL_UNLOCK)
  await playMusicFadeIn();
  sfxShoot?.load();

  if (gameState === GAME_STATE.MENU) {
    score = 0;
    currentLevel = 1;
    setLevelUI();
    setScoreUI();
    startGameOrLevel();
    return;
  }

  if (gameState === GAME_STATE.GAMEOVER) {
    score = 0;
    currentLevel = 1;
    setLevelUI();
    setScoreUI();
    startGameOrLevel();
    return;
  }

  if (gameState === GAME_STATE.LEVEL_UNLOCK) {
    // Skoru sıfırlamadan sonraki level başlasın
    startGameOrLevel();
    return;
  }
});


// -------------------- MAIN LOOP --------------------
function loop(t) {
  requestAnimationFrame(loop);

  // hard stop if not playing or orientation locked
  if (isGamePausedForOrientation) return;
  if (gameState !== GAME_STATE.PLAYING) return;

  const dt = (t - lastT) / 16.67; // 60fps base
  lastT = t;

  // Ship movement (keyboard)
  let moving = false;
  if (keys.up) { shipY -= SHIP_SPEED * dt; moving = true; }
  if (keys.down) { shipY += SHIP_SPEED * dt; moving = true; }

  // Ship follows pointer target (mobile + desktop)
  const followStrength = 0.25;
  const before = shipY;
  shipY = shipY + (targetShipY - shipY) * followStrength;
  if (Math.abs(shipY - before) > 0.2) moving = true;

  shipY = clamp(shipY, 10, window.innerHeight - SHIP_H - 10);

  // auto-fire while held
  if (isSpaceHeld || isFiringHeld) fireBullet();

  // flame visual
  flame.style.opacity = moving ? "1" : "0";
  flame.style.transform = moving ? "scale(1.05)" : "scale(0.9)";

  renderShip();

  const shipRect = { x: SHIP_X, y: shipY, w: SHIP_W, h: SHIP_H };

  // Enemies update
for (let i = enemies.length - 1; i >= 0; i--) {
  const e = enemies[i];
  e.x += e.vx * dt;

  // Bee wing animation
  if (e.type === "bee") {
    e.frameTimer += dt * 16.67;
    if (e.frameTimer > BEE_FRAME_INTERVAL) {
      e.frameIndex = (e.frameIndex + 1) % beeFrames.length;
      e.img.src = beeFrames[e.frameIndex];
      e.frameTimer = 0;
    }
  }

  // Plane shoots
  if (e.type === "plane") {
    const isOnScreen = e.x <= (window.innerWidth - e.w - 10);
    if (!isOnScreen) {
      e.shootTimer = 0;
    } else {
      e.shootTimer += dt * 16.67;
      if (e.shootTimer >= e.shootInterval) {
        e.shootTimer = 0;
        e.shootInterval = rand(1400, 2400);
        spawnEnemyBullet(e.x, e.y + e.h / 2, e.w);
      }
    }
  }

  // ✅✅✅ DUMAN TAM BURAYA
  if (e.type === "plane") {
    const hpRatio = e.hp / e.maxHp;

    e.smokeTimer = (e.smokeTimer ?? 0) + dt * 16.67;

      let smokeInterval = null;
      let smokeCount = 1;

     if (hpRatio <= 0.15) {
    smokeInterval = 60;   // ÇOK YOĞUN
    smokeCount = 4;
  } else if (hpRatio <= 0.35) {
    smokeInterval = 120;
    smokeCount = 3;
  } else if (hpRatio <= 0.6) {
    smokeInterval = 220;
    smokeCount = 2;
  } else if (hpRatio <= 0.8) {
    smokeInterval = 380;  // ERKEN DUMAN
    smokeCount = 1;
  }

    if (smokeInterval && e.smokeTimer >= smokeInterval) {
      e.smokeTimer = 0;
      for (let s = 0; s < smokeCount; s++){
      spawnSmoke(
        e.x + e.w * (0.6 + Math.random() * 0.2),
        e.y + e.h * (0.2 + Math.random() * 0.4)
      );
    }
  }
  }
  // düşmanı ekranda çizdir
  e.el.style.transform = `translate(${e.x}px, ${e.y}px)`;
    // ✅ SHIP vs ENEMY COLLISION (3-4px iç içe girince)
const shipHit = insetRect({ x: SHIP_X, y: shipY, w: SHIP_W, h: SHIP_H }, 4);
const enemyHit = insetRect(e, 4);

if (rectsOverlap(shipHit, enemyHit)) {
  // gemi uçak gibi patlasın
  spawnPlaneExplosion(SHIP_X + SHIP_W / 2, shipY + SHIP_H / 2, 160);

  // çarpan düşman da patlasın
  removeEnemyWithFade(e);

  shipHP = 0;
  setHpUI?.();
  gameOver(e.type === "plane" ? "Uçakla çarpışarak gemini patlatın!" : "Arıyla çarpışarak gemini patlatın!");
  return;
}

  // GAME OVER: enemy reaches left edge (x<=0)
  if (e.x <= 0) {
    removeEnemyWithFade(e);
    gameOver(e.type === "plane" ? "Arı uçağı hududu geçti!" : "Arı hududu geçti!");
    return;
  }

  // çarpışma vs...
}


  // Player bullets update
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.el.style.transform = `translate(${b.x}px, ${b.y}px)`;

    if (b.x > window.innerWidth + 80) {
      b.el.remove();
      bullets.splice(i, 1);
    }
  }

  // Enemy bullets update + collision
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.el.style.transform = `translate(${b.x}px, ${b.y}px)`;
    // COLLISION: enemy bullet -> ship
    const shipHit = insetRect(shipRect, 4);
    const bulletHit = insetRect(b, 2); // mermi daha küçük
    if (rectsOverlap(bulletHit, shipHit)) {
  b.el.remove();
  enemyBullets.splice(i, 1);

  shipHP -= 1;
  setHpUI?.();

  if (shipHP <= 0) {
    gameOver("Vurularak Öldürüldün!");
  }
  return;
}

    if (b.x < -80) {
      b.el.remove();
      enemyBullets.splice(i, 1);
    }
  }

  // Collisions: player bullet -> enemy (HP system)
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const b = bullets[bi];

    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];

      const enemyHit = insetRect(e, 3);
      const bulletHit = insetRect(b, 1);
      if (rectsOverlap(bulletHit, enemyHit)) {
        // remove bullet
        b.el.remove();
        bullets.splice(bi, 1);

        // damage enemy
        e.hp -= 1;
        // mermi çarpma noktası
        const hx = b.x + b.w / 2;
        const hy = b.y + b.h / 2;
        spawnHitEffect(hx, hy);

        if (e.type === "plane") planeHitFeedback(e);
        // SADECE HP BİTİNCE BÜYÜK PATLAMA
        if (e.hp <= 0) {
          removeEnemyWithFade(e);

          score += (e.type === "plane") ? 50 : 10;
          setScoreUI();

          // Level unlock
          if (score >= nextLevelScore()) {
            unlockNextLevel();
            return;
          }
        }

        break;
      }
    }
  }
}

// -------------------- INIT --------------------
setLevelUI();
setScoreUI();
renderShip();
updateOrientationGate();
// Footer ilk yüklemede doğru görünsün
updateFooterVisibility();

// Do NOT auto start game.
showCenterUI("Uzaylı Vs Arılar", "Başlamak için butona bas", "Oyunu Başlat");

// Start RAF loop (guarded by state)
requestAnimationFrame(loop);

// Resize guard
window.addEventListener("resize", () => {
  shipY = clamp(shipY, 10, window.innerHeight - SHIP_H - 10);
  targetShipY = clamp(targetShipY, 10, window.innerHeight - SHIP_H - 10);
  renderShip();
});
