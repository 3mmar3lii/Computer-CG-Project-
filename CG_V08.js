/* --- CONSTANTS & CONFIG --- */
const DOM = {
    stage: document.getElementById('gameStage'),
    hero: document.getElementById('hero-container'),
    shadow: document.getElementById('char-shadow'),
    flyBtn: document.getElementById('flyBtn'),
    fightBtn: document.getElementById('fightBtn'),
    health: document.getElementById('healthValue'),
    kills: document.getElementById('killValue'),
    muzzle: document.getElementById('muzzleFlash'),
    resultOverlay: document.getElementById('resultOverlay'),
    resultText: document.getElementById('resultText'),
    resultSubtext: document.getElementById('resultSubtext'),
    scaleInput: document.getElementById('scale'),
    scaleLabel: document.getElementById('scaleValue')
};

const CFG = {
    SPEED: 2.5,
    TURBO: 4.0,
    FRICTION: 0.75,
    GRAVITY: 0.8,
    FLY_SPEED: 3.0,
    LASER_Y_OFFSET: 220,
    GROUND_OFFSET: 80,
    COLLISION_DAMAGE_HEALTH: 1,
    KILL_SCORE_AMOUNT: 10,
    SCALE_LOSS_PERCENT: 5,
    VICTORY_ROTATION_RATE: 360
};

const state = {
    x: 50, // %
    y: 0, // px
    vx: 0,
    vy: 0,
    isFlying: false,
    fightMode: false,
    facingRight: true,
    theme: 'dark',
    health: 3,
    kills: 0,
    scale: 100,
    manualRotation: 0,
    skewX: 0,
    skewY: 0,
    rotations: {
        head: 0,
        'left-arm': 0,
        'right-arm': 0
    },
    hasEnded: false,
    victoryRotation: 0
};

const keys = {
    ArrowRight: false,
    ArrowLeft: false,
    ArrowUp: false,
    ArrowDown: false,
    Shift: false
};

const projectiles = [];
const particles = [];
const enemies = [];
const particlePool = [];
const MAX_PARTICLES = 100;

let lastTime = 0;

/* --- INITIALIZATION --- */
function init() {
    if (!DOM.stage) return;

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.display = 'none';
        DOM.stage.appendChild(p);
        particlePool.push({
            el: p,
            active: false
        });
    }
    updateHealthDisplay();

    requestAnimationFrame(gameLoop);
    setInterval(spawnEnemy, 2000);
}

/* --- UI UPDATES --- */
function updateHealthDisplay() {
    DOM.health.textContent = `${state.health} ${'❤️'.repeat(Math.max(0, state.health))}`;
}

/* --- INPUT HANDLING --- */
function handleKeyDown(e) {
    if (state.hasEnded) return;

    if (e.code === 'Space') {
        e.preventDefault();
        if (!state.isFlying) toggleFlight();
    }
    if (e.code === 'KeyF') shootProjectile();
    if (e.key === 'Shift') keys.Shift = true;
    if (keys.hasOwnProperty(e.code)) keys[e.code] = true;
}

function handleKeyUp(e) {
    if (e.key === 'Shift') keys.Shift = false;
    if (keys.hasOwnProperty(e.code)) keys[e.code] = false;
}

/* --- ACTIONS --- */
function toggleView() {
    document.body.classList.toggle('zen-mode');
    window.dispatchEvent(new Event('resize'));
}

function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', state.theme);
    document.getElementById('themeToggle').className = `celestial ${state.theme === 'light' ? 'sun' : 'moon'}`;
}

function toggleFightMode() {
    if (state.hasEnded) return;

    state.fightMode = !state.fightMode;
    DOM.fightBtn.classList.toggle('active', state.fightMode);
    if (state.fightMode) {
        spawnParticles(5, 'spark', (state.x / 100) * DOM.stage.offsetWidth, state.y + 100);
    }
}

function toggleFlight() {
    if (state.hasEnded) return;

    state.isFlying = !state.isFlying;
    DOM.hero.classList.toggle('flying-mode', state.isFlying);
    DOM.hero.classList.toggle('idle', !state.isFlying);
    DOM.flyBtn.classList.toggle('active', state.isFlying);

    if (state.isFlying) {
        state.vy = 12;
        spawnParticles(10, 'cloud');
    }
}

function shootProjectile() {
    if (state.hasEnded) return;

    DOM.hero.classList.add('firing');
    setTimeout(() => DOM.hero.classList.remove('firing'), 100);

    triggerShake();

    const stageWidth = DOM.stage.offsetWidth;
    const heroX = (state.x / 100) * stageWidth;
    const heroY = state.y + CFG.LASER_Y_OFFSET * (state.scale / 100);

    const muzzleOffset = state.facingRight ? 30 * (state.scale / 100) : -30 * (state.scale / 100);
    DOM.muzzle.style.transform = `translate3d(${heroX + muzzleOffset}px, -${heroY}px, 0)`;
    DOM.muzzle.classList.add('active');
    setTimeout(() => DOM.muzzle.classList.remove('active'), 50);

    const recoilForce = state.isFlying ? 1 : 2;
    state.vx += state.facingRight ? -recoilForce : recoilForce;

    const p = document.createElement('div');
    p.className = 'projectile';
    DOM.stage.appendChild(p);

    const direction = state.facingRight ? 1 : -1;

    projectiles.push({
        el: p,
        x: heroX,
        y: heroY,
        vx: 30 * direction,
        life: 100
    });
}

function triggerShake() {
    DOM.stage.classList.remove('shaking');
    void DOM.stage.offsetWidth;
    DOM.stage.classList.add('shaking');
}

function addCoin(x, y, amount = CFG.KILL_SCORE_AMOUNT) {
    const popup = document.createElement('div');
    popup.className = 'float-text';
    popup.textContent = `+${amount}`;
    popup.style.left = x + 'px';
    popup.style.bottom = (y + 80) + 'px';

    DOM.stage.appendChild(popup);
    setTimeout(() => popup.remove(), 1000);
}

function takeDamage(x, y) {
    if (state.hasEnded) return;

    state.health = Math.max(0, state.health - CFG.COLLISION_DAMAGE_HEALTH);
    damageHero(CFG.SCALE_LOSS_PERCENT); // Shrink visual power
    updateHealthDisplay();

    const popup = document.createElement('div');
    popup.className = 'float-text loss';
    popup.textContent = `-1 ❤️`;
    popup.style.left = x + 'px';
    popup.style.bottom = (y + 80) + 'px';

    DOM.stage.appendChild(popup);
    setTimeout(() => popup.remove(), 1000);

    if (state.health <= 0) {
        triggerLoss();
    }
}

/* --- SPAWNERS --- */
function spawnParticles(count, type, x, y) {
    const stageWidth = DOM.stage.offsetWidth;
    const originX = x !== undefined ? x : (state.x / 100) * stageWidth;
    const originY = y !== undefined ? y : state.y + 10;

    let spawned = 0;
    for (let i = 0; i < particlePool.length; i++) {
        if (spawned >= count) break;
        if (!particlePool[i].active) {
            const p = particlePool[i];
            p.active = true;
            p.el.style.display = 'block';

            const size = Math.random() * 8 + 4;
            p.el.style.width = size + 'px';
            p.el.style.height = size + 'px';
            p.el.style.backgroundColor = type === 'spark' ? getComputedStyle(document.body).getPropertyValue('--beam-color') : 'rgba(255,255,255,0.5)';

            p.x = originX + (Math.random() * 40 - 20);
            p.y = originY;

            if (type === 'spark') {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 5 + 2;
                p.vx = Math.cos(angle) * speed;
                p.vy = Math.sin(angle) * speed;
                p.life = 20;
                p.decay = true;
                p.gravity = 0.5;
            } else {
                p.vx = (Math.random() * 2 - 1);
                p.vy = (Math.random() * -2);
                p.life = 60;
                p.decay = true;
                p.gravity = 0;
            }

            spawned++;
        }
    }
}

function spawnEnemy() {
    if (!state.fightMode) return;
    if (enemies.length > 5 || state.hasEnded) return;

    const el = document.createElement('div');
    el.className = 'enemy';
    const inner = document.createElement('div');
    inner.className = 'enemy-inner';
    el.appendChild(inner);
    DOM.stage.appendChild(el);

    const fromRight = Math.random() > 0.5;
    const startX = fromRight ? DOM.stage.offsetWidth + 50 : -50;
    const startY = Math.random() * 300 + 50;

    const baseSpeed = 2;
    const killFactor = Math.floor(state.kills / 5) * 0.5;
    const enemySpeed = baseSpeed + killFactor;

    enemies.push({
        el: el,
        x: startX,
        y: startY,
        vx: fromRight ? -enemySpeed : enemySpeed,
        scale: 1
    });
}

/* --- GAME LOGIC --- */
function handleEnemyDefeated() {
    state.kills++;
    DOM.kills.textContent = state.kills;

    if (state.kills % 1 === 0) {
        forceGrow(10);
    }
}

function damageHero(amount) {
    if (state.hasEnded) return;

    state.scale = Math.max(50, parseInt(state.scale) - amount);

    DOM.scaleInput.value = state.scale;
    DOM.scaleLabel.textContent = state.scale + '%';

    DOM.hero.style.filter = "sepia(1) saturate(5) hue-rotate(-50deg) drop-shadow(0 0 10px red)";
    setTimeout(() => DOM.hero.style.filter = "", 200);

    triggerShake();
}

function forceGrow(amount) {
    state.scale = Math.min(200, parseInt(state.scale) + amount);

    DOM.scaleInput.value = state.scale;
    DOM.scaleLabel.textContent = state.scale + '%';

    spawnParticles(20, 'spark', (state.x / 100) * DOM.stage.offsetWidth, state.y + 100);

    if (state.scale >= 150) {
        triggerWin();
    }
}

function triggerWin() {
    if (state.hasEnded) return;
    state.hasEnded = true;

    DOM.resultText.textContent = 'YOU WON!';
    DOM.resultText.classList.remove('loss-text');
    DOM.resultText.classList.add('win-text');
    DOM.resultSubtext.textContent = 'MAXIMUM POWER REACHED';

    DOM.resultOverlay.classList.add('active');

    state.isFlying = true;
    DOM.hero.classList.add('flying-mode');
    DOM.hero.classList.remove('idle');
    state.y = 200;
    state.vx = 0;
    state.vy = 0;
}

function triggerLoss() {
    if (state.hasEnded) return;
    state.hasEnded = true;

    DOM.resultText.textContent = 'GAME OVER';
    DOM.resultText.classList.remove('win-text');
    DOM.resultText.classList.add('loss-text');
    DOM.resultSubtext.textContent = 'LOST ALL POWER';

    DOM.resultOverlay.classList.add('active');

    state.isFlying = false;
    DOM.hero.classList.remove('flying-mode');
    DOM.hero.classList.add('idle');
    state.vy = -10;
    triggerShake();
}

/* --- PHYSICS --- */

function updatePhysics(dtFactor) {
    if (state.hasEnded) {
        if (state.scale >= 150) {
            // VICTORY SPIN PHYSICS

            const targetX = 50;
            const centeringForce = (targetX - state.x) * 0.1;
            state.x += centeringForce * dtFactor;

            const targetY = 200;
            const currentPixelY = state.y;
            const yCenteringForce = (targetY - currentPixelY) * 0.1;
            state.y += yCenteringForce * dtFactor;

            const rotationIncrement = CFG.VICTORY_ROTATION_RATE * (dtFactor * 16.66 / 1000);
            state.victoryRotation += rotationIncrement;

        } else {
            // LOSS FALL PHYSICS
            state.vy -= CFG.GRAVITY * dtFactor * 2;
            state.y += state.vy * dtFactor;
            if (state.y <= 0) {
                state.y = 0;
                state.vy = 0;
            }
        }
        return;
    }

    const currentSpeed = (keys.Shift ? CFG.TURBO : CFG.SPEED) * dtFactor;

    // Horizontal Move 
    if (keys.ArrowRight) {
        state.vx += state.isFlying ? currentSpeed * 0.4 : currentSpeed * 0.3;
        state.facingRight = true;
        if (!state.isFlying && Math.random() > 0.8) spawnParticles(1, 'dust');
    }
    if (keys.ArrowLeft) {
        state.vx -= state.isFlying ? currentSpeed * 0.4 : currentSpeed * 0.3;
        state.facingRight = false;
        if (!state.isFlying && Math.random() > 0.8) spawnParticles(1, 'dust');
    }

    const maxV = keys.Shift ? 15 : 8;
    state.vx = Math.max(-maxV, Math.min(maxV, state.vx));


    // Friction & Position
    state.vx *= Math.pow(CFG.FRICTION, dtFactor);
    state.x += (state.vx / 6) * dtFactor;

    // Boundaries
    if (state.x < 2) {
        state.x = 2;
        state.vx = 0;
    }
    if (state.x > 98) {
        state.x = 98;
        state.vx = 0;
    }

    // Vertical Physics
    if (state.isFlying) {
        if (keys.ArrowUp) state.vy += CFG.FLY_SPEED * 0.2 * dtFactor;
        if (keys.ArrowDown) state.vy -= CFG.FLY_SPEED * 0.2 * dtFactor;
        state.vy *= Math.pow(0.9, dtFactor);
        state.y += state.vy * dtFactor;
    } else {
        if (state.y > 0) {
            state.vy -= CFG.GRAVITY * dtFactor;
            state.y += state.vy * dtFactor;
        }
        if (state.y <= 0) {
            state.y = 0;
            state.vy = 0;
        }
    }
    if (state.y > 380) state.y = 380;
}

function updateEntities(dtFactor) {
    const stageWidth = DOM.stage.offsetWidth;

    // 1. Enemies
    const heroX = (state.x / 100) * stageWidth;
    const scaleFactor = state.scale / 100;

    const heroWidth = 70 * scaleFactor;
    const heroHeight = 190 * scaleFactor;

    const hL = heroX - (heroWidth / 2);
    const hR = heroX + (heroWidth / 2);
    const hB = state.y;
    const hT = state.y + heroHeight;

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.x += e.vx * dtFactor;
        e.y += Math.sin(Date.now() / 200) * 1 * dtFactor;

        e.el.style.transform = `translate3d(${e.x}px, -${e.y + CFG.GROUND_OFFSET}px, 0)`;

        if (e.x < -100 || e.x > stageWidth + 100) {
            if (!state.hasEnded) {
                e.el.remove();
                enemies.splice(i, 1);
            }
            continue;
        }

        if (!state.hasEnded) {
            const eL = e.x;
            const eR = e.x + 40;
            const eB = e.y;
            const eT = e.y + 40;

            if (hL < eR && hR > eL && hB < eT && hT > eB) {
                damageHero(CFG.SCALE_LOSS_PERCENT);
                takeDamage(e.x, e.y);

                spawnParticles(10, 'dust', e.x, e.y + CFG.GROUND_OFFSET);
                e.el.remove();
                enemies.splice(i, 1);
                continue;
            }
        }
    }

    // 2. Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.x += p.vx * dtFactor;
        p.life -= 1 * dtFactor;

        p.el.style.transform = `translate3d(${p.x}px, -${p.y}px, 0)`;

        let destroyed = false;

        // Hit Enemy
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            const dx = p.x - e.x;
            const dy = p.y - (e.y + CFG.GROUND_OFFSET);

            if (Math.sqrt(dx * dx + dy * dy) < 40) {
                spawnParticles(12, 'spark', e.x, e.y + CFG.GROUND_OFFSET);
                addCoin(e.x, e.y);
                e.el.remove();
                enemies.splice(j, 1);
                destroyed = true;

                handleEnemyDefeated();

                break;
            }
        }

        if (!destroyed && (p.x > stageWidth || p.x < 0 || p.life <= 0)) {
            if (p.life > 0) spawnParticles(5, 'spark', p.x, p.y);
            destroyed = true;
        }

        if (destroyed) {
            p.el.remove();
            projectiles.splice(i, 1);
        }
    }

    // 3. Particles
    particlePool.forEach(p => {
        if (p.active) {
            p.x += p.vx * dtFactor;
            p.y += p.vy * dtFactor;
            if (p.gravity) p.vy -= p.gravity * dtFactor;
            p.life -= 1 * dtFactor;

            const yOffset = p.gravity ? 0 : 80;
            p.el.style.transform = `translate3d(${p.x}px, -${p.y + yOffset}px, 0) scale(${p.decay ? p.life/20 : 1})`;
            p.el.style.opacity = p.decay ? p.life / 20 : 1;

            if (p.life <= 0) {
                p.active = false;
                p.el.style.display = 'none';
            }
        }
    });
}

function renderHero() {
    const dir = state.facingRight ? 1 : -1;
    const tilt = state.isFlying ? state.vx * 3 : state.vx * 1.5;
    const stageWidth = DOM.stage.offsetWidth;
    const pixelX = (state.x / 100) * stageWidth;

    const rotation = (state.hasEnded && state.scale >= 150 ? state.victoryRotation : tilt) + state.manualRotation;

    const t = `translate3d(${pixelX - 70}px, -${state.y + CFG.GROUND_OFFSET}px, 0) 
                 scaleX(${dir * state.scale/100}) 
                 scaleY(${state.scale/100}) 
                 rotate(${rotation}deg) 
                 skewX(${state.skewX}deg) 
                 skewY(${state.skewY}deg)`;

    DOM.hero.style.transform = t;

    // Shadow
    const shadowOpacity = Math.max(0, 1 - (state.y / 200));
    DOM.shadow.style.opacity = shadowOpacity;
    DOM.shadow.style.transform = `translate3d(${pixelX - 40}px, -75px, 0) scale(${shadowOpacity * state.scale/100})`;
}

function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = (timestamp - lastTime) / 16.66;
    lastTime = timestamp;
    const safeDt = Math.min(dt, 4);

    updatePhysics(safeDt);
    updateEntities(safeDt);
    renderHero();

    requestAnimationFrame(gameLoop);
}

/* --- UI HELPERS --- */
const partValueMap = {
    'head': 'headValue',
    'left-arm': 'leftArmValue',
    'right-arm': 'rightArmValue'
};

function rotatePart(partId, degrees) {
    state.rotations[partId] = parseInt(degrees);
    document.getElementById(partId).style.transform = `rotate(${degrees}deg)`;
    document.getElementById(partValueMap[partId]).textContent = degrees + '°';
}

function updateTransform() {
    state.scale = parseInt(DOM.scaleInput.value);
    state.skewX = document.getElementById('skewX').value;
    state.skewY = document.getElementById('skewY').value;

    state.manualRotation = parseInt(document.getElementById('rotate').value);
    document.getElementById('rotateValue').textContent = state.manualRotation + '°';

    DOM.scaleLabel.textContent = state.scale + '%';
    document.getElementById('skewXValue').textContent = state.skewX + '°';
    document.getElementById('skewYValue').textContent = state.skewY + '°';
}

function resetGame() {
    // Reset main state
    state.x = 50;
    state.y = 0;
    state.vx = 0;
    state.vy = 0;
    state.isFlying = false;
    state.fightMode = false;
    state.health = 3;
    state.kills = 0;
    state.scale = 100;
    state.hasEnded = false;
    state.victoryRotation = 0;

    // Reset UI displays
    updateHealthDisplay();
    DOM.kills.textContent = '0';
    DOM.resultOverlay.classList.remove('active');
    DOM.hero.style.filter = "";

    // Reset controls and hero state
    DOM.scaleInput.value = 100;
    resetTransform();
    DOM.hero.classList.remove('flying-mode');
    DOM.flyBtn.classList.remove('active');
    DOM.fightBtn.classList.remove('active');
    DOM.hero.classList.add('idle');

    // Clear entities
    [...enemies, ...projectiles].forEach(e => e.el.remove());
    enemies.length = 0;
    projectiles.length = 0;
    particlePool.forEach(p => {
        p.active = false;
        p.el.style.display = 'none';
    });
}

function resetTransform() {
    DOM.scaleInput.value = 100;
    document.getElementById('skewX').value = 0;
    document.getElementById('skewY').value = 0;
    document.getElementById('rotate').value = 0;

    ['head', 'left-arm', 'right-arm'].forEach(p => {
        document.getElementById(p + 'Rotation').value = 0;
        rotatePart(p, 0);
    });
    updateTransform();
}

// Start
init();
