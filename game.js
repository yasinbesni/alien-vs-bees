// ---- AYARLAR ----
/*  
{
  el,           // DOM elementi
  img,          // <img>
  x, y,         // konum
  vx,           // hız
  frameIndex,   // hangi kanat frame'i
  frameTimer    // frame değiştirme zamanlayıcısı
}

*/



const ENEMY_SPAWN_MS = 650;
const ENEMY_SPEED_MIN = 2.2;
const ENEMY_SPEED_MAX = 4.8;

const BULLET_SPEED = 9;
const FIRE_COOLDOWN_MS = 150;

const SHIP_SPEED = 6;          // klavye ile hız
const SHIP_X = 30;             // sabit X
const SHIP_W = 120;
const SHIP_H = 80;

const beeFrames = [
  "./bee1.png",
  "./bee2.png",
  "./bee3.png",
  "./bee4.png",
  "./bee5.png",
  "./bee6.png",
];

// ---- ELEMANLAR ----
const game = document.getElementById("game");
const ship = document.getElementById("ship");
const flame = document.getElementById("ship-flame");
const scoreEl = document.getElementById("score");

// ---- DURUM ----
let score = 0;
let lastFireAt = 0;
let keys = { up: false, down: false };

let shipY = window.innerHeight * 0.4;

const enemies = []; // { el, x, y, vx, w, h }
const bullets = []; // { el, x, y, vx, w, h }

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

// ---- UZAY GEMİSİ ÇİZ ----
function renderShip() {
  ship.style.left = `${SHIP_X}px`;
  ship.style.top = `${shipY}px`;
}

// ---- ATEŞ (HAREKETTEYKEN) ----
let flameFrame = 0;
const flameFrames = ["./flame1.png", "./flame2.png", "./flame3.png"]; // varsa 3 frame
setInterval(() => {
  flameFrame = (flameFrame + 1) % flameFrames.length;
  flame.src = flameFrames[flameFrame];
}, 80);

// ---- DÜŞMAN OLUŞTUR ----
function spawnEnemy() {
  const el = document.createElement("div");
  el.className = "enemy";

 /*  const img = document.createElement("img");
  img.src = pick(enemiesSprites);
  img.alt = "bee"; */
  const img = document.createElement("img");
  img.src = beeFrames[0];
  img.alt = "bee";

  el.appendChild(img);
  game.appendChild(el);

  const w = 64;
  const h = 64;

 /*  const x = window.innerWidth + w;
  const y = rand(20, window.innerHeight - h - 20);
  const vx = -rand(ENEMY_SPEED_MIN, ENEMY_SPEED_MAX); */

  enemies.push(
    {
    el,
    img,
    x: window.innerWidth + w,
    y: rand(20, window.innerHeight - h - 20),
    vx: -rand(2.2, 4.8),
    w,
    h,
    frameIndex: 0,
    frameTimer: 0,
  }
  );
}

// ---- MERMİ ----
function fireBullet() {
  const now = performance.now();
  if (now - lastFireAt < FIRE_COOLDOWN_MS) return;
  lastFireAt = now;

  const el = document.createElement("div");
  el.className = "bullet";
  game.appendChild(el);

  const w = 18;
  const h = 6;

  // mermi geminin ortasından çıksın
  const x = SHIP_X + SHIP_W - 10;
  const y = shipY + SHIP_H / 2 - h / 2;

  bullets.push({ el, x, y, vx: BULLET_SPEED, w, h });
}

// ---- INPUT ----
window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowUp" || e.code === "KeyW") keys.up = true;
  if (e.code === "ArrowDown" || e.code === "KeyS") keys.down = true;
  if (e.code === "Space") fireBullet();
});

window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowUp" || e.code === "KeyW") keys.up = false;
  if (e.code === "ArrowDown" || e.code === "KeyS") keys.down = false;
});

// click ile ateş
window.addEventListener("mousedown", () => fireBullet());

// mouse ile sadece Y kontrolü (istersen aç)
window.addEventListener("mousemove", (e) => {
  // shipY'yi mouse Y'e yaklaştır (yumuşak)
  const target = e.clientY - SHIP_H / 2;
  shipY = clamp(target, 10, window.innerHeight - SHIP_H - 10);
});

// ---- OYUN DÖNGÜSÜ ----
let lastT = performance.now();

function loop(t) {
  const dt = (t - lastT) / 16.67; // 60fps bazlı
  lastT = t;

  // gemi hareket (klavye)
  let moving = false;
  if (keys.up) {
    shipY -= SHIP_SPEED * dt;
    moving = true;
  }
  if (keys.down) {
    shipY += SHIP_SPEED * dt;
    moving = true;
  }

  shipY = clamp(shipY, 10, window.innerHeight - SHIP_H - 10);

  // hareket edince ateş görünsün
  flame.style.opacity = moving ? "1" : "0";
  flame.style.transform = moving ? "scale(1.05)" : "scale(0.9)";

  renderShip();
const BEE_FRAME_INTERVAL = 180; // ms

  // düşmanları ilerlet
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.x += e.vx * dt;

     // 🐝 KANAT ANİMASYONU
  e.frameTimer += dt * 16.67; // gerçek ms'e yaklaştır
  if (e.frameTimer > BEE_FRAME_INTERVAL) {
    e.frameIndex = (e.frameIndex + 1) % beeFrames.length;
    e.img.src = beeFrames[e.frameIndex];
    e.frameTimer = 0;
  }

    e.el.style.transform = `translate(${e.x}px, ${e.y}px)`;

    // ekran dışına çıktıysa sil
    if (e.x < -e.w - 50) {
      e.el.remove();
      enemies.splice(i, 1);
    }
  }

  // mermileri ilerlet
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;

    b.el.style.transform = `translate(${b.x}px, ${b.y}px)`;

    if (b.x > window.innerWidth + 50) {
      b.el.remove();
      bullets.splice(i, 1);
    }
  }

  // çarpışma: mermi - düşman
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const b = bullets[bi];
    let hit = false;

    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];

      if (rectsOverlap(b, e)) {
        // düşmanı öldür
        e.el.remove();
        enemies.splice(ei, 1);

        // mermiyi sil
        b.el.remove();
        bullets.splice(bi, 1);

        score += 10;
        scoreEl.textContent = score;

        hit = true;
        break;
      }
    }

    if (hit) continue;
  }

  requestAnimationFrame(loop);
}

setInterval(spawnEnemy, ENEMY_SPAWN_MS);
requestAnimationFrame(loop);

// resize
window.addEventListener("resize", () => {
  shipY = clamp(shipY, 10, window.innerHeight - SHIP_H - 10);
});
//renderShip();