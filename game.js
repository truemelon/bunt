// Pobieramy canvas i jego kontekst do rysowania
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Elementy UI
const playerHpSpan = document.getElementById('playerHp');
const gameTimerSpan = document.getElementById('gameTimer');
const pistolAmmoSpan = document.getElementById('pistolAmmo');
const pistolReloadSpan = document.getElementById('pistolReload');
const electronicsCountSpan = document.getElementById('electronicsCount');
const grenadeReloadSpan = document.getElementById('grenadeReload'); // UI dla granatnika
const plasmaBombReloadSpan = document.getElementById('plasmaBombReload'); // UI dla bomby

// --- Zmienne gry ---
let gameRunning = false;
let gameTime = 0;
let lastTime = 0;

const enemies = [];
const projectiles = [];
const lootItems = [];
const plasmaBombs = []; // specjalna lista dla bomb plazmowych

// --- Gracz ---
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    size: 20,
    color: '#00BFFF',
    hp: 100,
    maxHp: 100,
    speed: 150,
    weapons: [],
    passiveItems: [],
    lastMoveDirection: { x: 0, y: -1 },
    lootCollectRange: 50,
    electronicsCount: 0,
    plasmaBombReady: true,
    plasmaBombReload: 0
};

// --- Definicje Wrogów ---
const enemyDefinitions = {
    t800: {
        name: "T-800",
        size: 20,
        speed: 25,
        hp: 25,
        electronicsDrop: 1,
        draw: (ctx, enemy) => {
            const size = enemy.size;
            const halfSize = size / 2;
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.ellipse(enemy.x, enemy.y, halfSize, halfSize * 1.1, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.closePath();
            ctx.fillStyle = 'lightgray';
            ctx.beginPath();
            ctx.ellipse(enemy.x, enemy.y + halfSize * 0.5, halfSize * 0.8, halfSize * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.closePath();
            const eyeSocketSize = size / 3.5;
            const eyeOffset = size / 4.5;
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.arc(enemy.x - eyeOffset, enemy.y - eyeOffset, eyeSocketSize / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(enemy.x + eyeOffset, enemy.y - eyeOffset, eyeSocketSize / 2, 0, Math.PI * 2);
            ctx.fill();
            const eyePupilSize = size / 6;
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(enemy.x - eyeOffset, enemy.y - eyeOffset, eyePupilSize / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(enemy.x + eyeOffset, enemy.y - eyeOffset, eyePupilSize / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.moveTo(enemy.x, enemy.y + size * 0.1);
            ctx.lineTo(enemy.x - size * 0.1, enemy.y + size * 0.3);
            ctx.lineTo(enemy.x + size * 0.1, enemy.y + size * 0.3);
            ctx.closePath();
            ctx.fill();
        }
    },
    t1000: {
        name: "T-1000",
        size: 24,
        speed: 35,
        hp: 1,
        electronicsDrop: 5,
        draw: (ctx, enemy) => {
            ctx.save();
            ctx.globalAlpha = enemy.frozen ? 0.5 : 1;
            ctx.fillStyle = enemy.frozen ? "#b0e0ff" : "#11b7ff";
            ctx.beginPath();
            ctx.ellipse(enemy.x, enemy.y, enemy.size / 2, enemy.size * 0.7 / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#c0c0c0";
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
            if (enemy.frozen) {
                ctx.save();
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2;
                ctx.beginPath();
                for (let i = 0; i < 8; i++) {
                    const angle = (Math.PI * 2) * (i / 8);
                    ctx.moveTo(enemy.x, enemy.y);
                    ctx.lineTo(enemy.x + Math.cos(angle) * enemy.size / 2, enemy.y + Math.sin(angle) * enemy.size / 2);
                }
                ctx.stroke();
                ctx.restore();
            }
        }
    },
    bigTank: {
        name: "Duży Czołg",
        size: 40,
        speed: 12,
        hp: 80,
        electronicsDrop: 15,
        shootCooldown: 3,
        draw: (ctx, enemy) => {
            // Kadłub
            ctx.fillStyle = '#555';
            ctx.fillRect(enemy.x - enemy.size/2, enemy.y - enemy.size/2, enemy.size, enemy.size * 0.7);
            // Wieża
            ctx.fillStyle = '#aaa';
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.size * 0.27, 0, Math.PI * 2);
            ctx.fill();
            // Lufa
            const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
            ctx.save();
            ctx.strokeStyle = '#ccc';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(enemy.x, enemy.y);
            ctx.lineTo(enemy.x + Math.cos(angle) * enemy.size * 0.8, enemy.y + Math.sin(angle) * enemy.size * 0.8);
            ctx.stroke();
            ctx.restore();
        }
    }
};

// --- Konfiguracja Broni ---
const weaponDefinitions = {
    pistol: {
        name: "Pistolet",
        baseDamage: 15,
        baseCooldown: 0.25,
        baseSize: 8,
        baseSpeed: 900,
        maxLevel: 8,
        magazineSize: 10,
        reloadTime: 5,
        description: "Standardowy pistolet laserowy. Celuje w kierunku ruchu.",
        draw: (ctx, projectile) => {
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(projectile.x - projectile.size / 2, projectile.y - projectile.size / 2, projectile.size, projectile.size);
        }
    },
    plasmaBeam: {
        name: "Wiązka Plazmowa",
        baseDamage: 10,
        baseCooldown: 1.5,
        baseSize: 15,
        baseSpeed: 600,
        maxLevel: 8,
        description: "Intensywna wiązka energii, która przecina maszyny.",
        draw: (ctx, projectile) => {
            ctx.strokeStyle = '#00FFFF';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(projectile.x - projectile.size / 2, projectile.y);
            ctx.lineTo(projectile.x + projectile.size / 2, projectile.y);
            ctx.moveTo(projectile.x, projectile.y - projectile.size / 2);
            ctx.lineTo(projectile.x, projectile.y + projectile.size / 2);
            ctx.stroke();
        }
    },
    grenadeLauncher: {
        name: "Granatnik",
        baseDamage: 50,
        baseCooldown: 0,
        baseSize: 16,
        baseSpeed: 500,
        maxLevel: 1,
        magazineSize: 1,
        reloadTime: 5,
        explosionRadius: enemyDefinitions.t800.size * 4,
        description: "Granatnik - wybuchowy atak obszarowy PPM.",
        draw: (ctx, projectile) => {
            ctx.fillStyle = '#3aff4f';
            ctx.beginPath();
            ctx.arc(projectile.x, projectile.y, projectile.size / 2, 0, Math.PI * 2);
            ctx.fill();
        },
        drawExplosion: (ctx, x, y, radius) => {
            ctx.save();
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = "#ffff00";
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    },
    tankLaser: {
        name: "Laser Czołgu",
        baseDamage: 18,
        baseCooldown: 0,
        baseSize: 10,
        baseSpeed: 350,
        draw: (ctx, projectile) => {
            ctx.save();
            ctx.strokeStyle = "#ff5050";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(projectile.x, projectile.y);
            ctx.lineTo(projectile.x - Math.cos(projectile.angle) * 18, projectile.y - Math.sin(projectile.angle) * 18);
            ctx.stroke();
            ctx.restore();
        }
    },
    plasmaBomb: {
        name: "Bomba plazmowa",
        explosionRadius: 52,
        reloadTime: 10,
        timer: 5,
        draw: (ctx, bomb) => {
            ctx.save();
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.arc(bomb.x, bomb.y, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            ctx.save();
            ctx.globalAlpha = 0.5 + 0.5 * Math.sin(performance.now() / 100);
            ctx.strokeStyle = "#00ffff";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(bomb.x, bomb.y, 16, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        },
        drawExplosion: (ctx, x, y, radius) => {
            ctx.save();
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = "#00ffff";
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
};

// --- Sterowanie ---
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    w: false,
    s: false,
    a: false,
    d: false,
};

let pistolShotQueued = false;
let grenadeShotQueued = false;
let plasmaBombQueued = false;

document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key in keys) {
        keys[key] = true;
        e.preventDefault();
    }
    if (e.code === "Space") {
        plasmaBombQueued = true;
        e.preventDefault();
    }
});
document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key in keys) {
        keys[key] = false;
    }
});
document.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        pistolShotQueued = true;
    }
    if (e.button === 2) {
        grenadeShotQueued = true;
    }
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

// --- Funkcje rysowania ---
function drawPlayer() {
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
}
function drawDirectionIndicator() {
    ctx.strokeStyle = '#FFFF00';
    ctx.lineWidth = 2;
    const indicatorLength = player.size * 0.8;
    const angle = Math.atan2(player.lastMoveDirection.y, player.lastMoveDirection.x);
    const endX = player.x + Math.cos(angle) * indicatorLength;
    const endY = player.y + Math.sin(angle) * indicatorLength;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.closePath();
}
function drawEnemy(enemy) {
    const enemyDef = enemyDefinitions[enemy.type];
    if (enemyDef && enemyDef.draw) {
        enemyDef.draw(ctx, enemy);
    } else {
        ctx.fillStyle = enemy.color || 'gray';
        ctx.fillRect(enemy.x - enemy.size / 2, enemy.y - enemy.size / 2, enemy.size, enemy.size);
    }
}
function drawProjectile(projectile) {
    const weaponDef = weaponDefinitions[projectile.type];
    if (weaponDef && weaponDef.draw) {
        weaponDef.draw(ctx, projectile);
    } else {
        ctx.fillStyle = 'white';
        ctx.fillRect(projectile.x - projectile.size / 2, projectile.y - projectile.size / 2, projectile.size, projectile.size);
    }
    if (projectile.type === 'grenadeLauncher' && projectile.exploded) {
        weaponDefinitions.grenadeLauncher.drawExplosion(ctx, projectile.x, projectile.y, projectile.explosionRadius);
    }
}
function drawLootItem(item) {
    if (item.type === 'electronics') {
        ctx.fillStyle = '#00E676';
        ctx.beginPath();
        ctx.moveTo(item.x, item.y - item.size / 2);
        ctx.lineTo(item.x - item.size / 2, item.y + item.size / 2);
        ctx.lineTo(item.x + item.size / 2, item.y + item.size / 2);
        ctx.closePath();
        ctx.fill();
    }
}
function drawPlasmaBomb(bomb) {
    weaponDefinitions.plasmaBomb.draw(ctx, bomb);
    if (bomb.exploded) {
        weaponDefinitions.plasmaBomb.drawExplosion(ctx, bomb.x, bomb.y, bomb.radius);
    }
}

// --- Główna pętla gry ---
function gameLoop(timestamp) {
    if (!gameRunning) return;
    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    gameTime += deltaTime;
    update(deltaTime);
    draw();
    updateUI();
    requestAnimationFrame(gameLoop);
}

function update(deltaTime) {
    let dx = 0;
    let dy = 0;
    if (keys.ArrowUp || keys.w) dy -= 1;
    if (keys.ArrowDown || keys.s) dy += 1;
    if (keys.ArrowLeft || keys.a) dx -= 1;
    if (keys.ArrowRight || keys.d) dx += 1;
    if (dx !== 0 && dy !== 0) {
        const diagonalSpeed = Math.sqrt(2);
        dx /= diagonalSpeed;
        dy /= diagonalSpeed;
    }
    if (dx !== 0 || dy !== 0) {
        player.lastMoveDirection.x = dx;
        player.lastMoveDirection.y = dy;
    }
    player.x += dx * player.speed * deltaTime;
    player.y += dy * player.speed * deltaTime;
    player.x = Math.max(player.size / 2, Math.min(canvas.width - player.size / 2, player.x));
    player.y = Math.max(player.size / 2, Math.min(canvas.height - player.size / 2, player.y));
    updateEnemies(deltaTime);
    updateWeapons(deltaTime);
    updateProjectiles(deltaTime);
    updateLootItems(deltaTime);
    updatePlasmaBombs(deltaTime);
    checkCollisions();
    updatePlasmaBombReload(deltaTime);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPlayer();
    drawDirectionIndicator();
    enemies.forEach(drawEnemy);
    projectiles.forEach(drawProjectile);
    lootItems.forEach(drawLootItem);
    plasmaBombs.forEach(drawPlasmaBomb);
}

function updateUI() {
    playerHpSpan.textContent = `${player.hp}/${player.maxHp}`;
    const minutes = Math.floor(gameTime / 60).toString().padStart(2, '0');
    const seconds = Math.floor(gameTime % 60).toString().padStart(2, '0');
    gameTimerSpan.textContent = `${minutes}:${seconds}`;

    // Pistolet
    const pistol = player.weapons.find(w => w.type === 'pistol');
    const pistolReloadP = pistolReloadSpan.parentElement;
    if (pistol) {
        pistolAmmoSpan.textContent = `${pistol.currentAmmo}/${pistol.magazineSize}`;
        if (pistol.reloading) {
            pistolReloadSpan.textContent = `${pistol.reloadTimer.toFixed(1)}s`;
            pistolReloadP.classList.add('reload');
        } else {
            pistolReloadSpan.textContent = `Gotowe`;
            pistolReloadP.classList.remove('reload');
        }
    } else {
        pistolAmmoSpan.textContent = `N/A`;
        pistolReloadSpan.textContent = `N/A`;
        pistolReloadP.classList.remove('reload');
    }

    // Granatnik
    if (grenadeReloadSpan) {
        const grenade = player.weapons.find(w => w.type === 'grenadeLauncher');
        const grenadeReloadP = grenadeReloadSpan.parentElement;
        if (grenade) {
            if (grenade.reloading) {
                grenadeReloadSpan.textContent = `${grenade.reloadTimer.toFixed(1)}s`;
                grenadeReloadP.classList.add('reload');
            } else {
                grenadeReloadSpan.textContent = `Gotowe`;
                grenadeReloadP.classList.remove('reload');
            }
        } else {
            grenadeReloadSpan.textContent = `N/A`;
            grenadeReloadP.classList.remove('reload');
        }
    }

    // Bomba plazmowa
    if (plasmaBombReloadSpan) {
        const plasmaBombReloadP = plasmaBombReloadSpan.parentElement;
        if (player.plasmaBombReady) {
            plasmaBombReloadSpan.textContent = "Gotowa";
            plasmaBombReloadP.classList.remove('reload');
        } else {
            plasmaBombReloadSpan.textContent = `${player.plasmaBombReload.toFixed(1)}s`;
            plasmaBombReloadP.classList.add('reload');
        }
    }

    electronicsCountSpan.textContent = player.electronicsCount;
}

// --- Funkcje wrogów ---
let enemySpawnTimer = 0;
const spawnInterval = 1;
const maxEnemies = 50;

function spawnEnemy() {
    if (enemies.length >= maxEnemies) return;
    let enemyType = 't800';
    const roll = Math.random();
    if (roll < 0.07) {
        enemyType = 't1000';
    } else if (roll < 0.10) {
        enemyType = 'bigTank';
    }
    const def = enemyDefinitions[enemyType];
    const size = def.size;
    const speed = def.speed;
    const hp = def.hp;
    const electronicsDrop = def.electronicsDrop;
    let x, y;
    const side = Math.floor(Math.random() * 4);
    switch (side) {
        case 0: x = Math.random() * canvas.width; y = -size; break;
        case 1: x = canvas.width + size; y = Math.random() * canvas.height; break;
        case 2: x = Math.random() * canvas.width; y = canvas.height + size; break;
        case 3: x = -size; y = Math.random() * canvas.height; break;
    }
    const enemy = {
        x, y, size, speed, hp, maxHp: hp, electronicsDrop,
        active: true, type: enemyType, frozen: false, frozenTimer: 0
    };
    if (enemyType === 'bigTank') {
        enemy.shootCooldown = enemyDefinitions.bigTank.shootCooldown;
        enemy.shootTimer = Math.random() * 2;
    }
    enemies.push(enemy);
}

function updateEnemies(deltaTime) {
    enemySpawnTimer += deltaTime;
    if (enemySpawnTimer >= spawnInterval) {
        spawnEnemy();
        enemySpawnTimer = 0;
    }
    enemies.forEach(enemy => {
        if (!enemy.active) return;
        if (enemy.type === "t1000" && enemy.frozen) {
            enemy.frozenTimer -= deltaTime;
            if (enemy.frozenTimer <= 0) {
                enemy.frozen = false;
            }
            return;
        }
        if (enemy.type === "bigTank") {
            enemy.shootTimer -= deltaTime;
            if (enemy.shootTimer <= 0) {
                spawnTankLaser(enemy);
                enemy.shootTimer = enemy.shootCooldown;
            }
        }
        const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        enemy.x += Math.cos(angle) * enemy.speed * deltaTime;
        enemy.y += Math.sin(angle) * enemy.speed * deltaTime;
    });
}

function spawnTankLaser(enemy) {
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    projectiles.push({
        type: 'tankLaser',
        x: enemy.x + Math.cos(angle) * (enemy.size*0.8),
        y: enemy.y + Math.sin(angle) * (enemy.size*0.8),
        size: 10,
        damage: 18,
        speed: 350,
        angle: angle,
        owner: enemy,
    });
}

// --- Funkcje broni ---
function addStartingWeapon(weaponName) {
    const weaponDef = weaponDefinitions[weaponName];
    if (weaponDef) {
        const newWeapon = {
            name: weaponDef.name,
            type: weaponName,
            level: 1,
            damage: weaponDef.baseDamage,
            cooldown: weaponDef.baseCooldown,
            currentCooldown: 0,
            size: weaponDef.baseSize,
            speed: weaponDef.baseSpeed,
            magazineSize: weaponDef.magazineSize || 0,
            currentAmmo: weaponDef.magazineSize || 0,
            reloadTime: weaponDef.reloadTime || 0,
            reloadTimer: 0,
            reloading: false,
            shotsInSeries: 0,
            explosionRadius: weaponDef.explosionRadius || 0
        };
        if (weaponName === 'plasmaBeam') {
            newWeapon.maxDistance = 200;
        }
        player.weapons.push(newWeapon);
        console.log(`Zainstalowano moduł: ${weaponDef.name}`);
    }
}

function updateWeapons(deltaTime) {
    player.weapons.forEach(weapon => {
        weapon.currentCooldown -= deltaTime;
        if (weapon.reloading) {
            weapon.reloadTimer -= deltaTime;
            if (weapon.reloadTimer <= 0) {
                weapon.reloading = false;
                weapon.currentAmmo = weapon.magazineSize;
            }
        } else {
            if (weapon.type === 'pistol') {
                if (pistolShotQueued && weapon.currentAmmo > 0 && weapon.shotsInSeries === 0) {
                    weapon.shotsInSeries = weapon.magazineSize;
                    pistolShotQueued = false;
                }
                if (weapon.shotsInSeries > 0 && weapon.currentCooldown <= 0) {
                    if (weapon.currentAmmo > 0) {
                        let dx = player.lastMoveDirection.x;
                        let dy = player.lastMoveDirection.y;
                        if (dx === 0 && dy === 0) {
                            dx = 0;
                            dy = -1;
                        }
                        const angle = Math.atan2(dy, dx);
                        projectiles.push({
                            type: weapon.type,
                            x: player.x,
                            y: player.y,
                            size: weapon.size,
                            damage: weapon.damage,
                            speed: weapon.speed,
                            angle: angle,
                            owner: player,
                        });
                        weapon.currentAmmo--;
                        weapon.shotsInSeries--;
                        weapon.currentCooldown = weapon.cooldown;
                        if (weapon.currentAmmo <= 0) {
                            weapon.reloading = true;
                            weapon.reloadTimer = weapon.reloadTime;
                            weapon.shotsInSeries = 0;
                        }
                    } else {
                        weapon.reloading = true;
                        weapon.reloadTimer = weapon.reloadTime;
                        weapon.shotsInSeries = 0;
                    }
                }
            }
            else if (weapon.type === 'grenadeLauncher') {
                if (grenadeShotQueued && weapon.currentAmmo > 0 && weapon.currentCooldown <= 0) {
                    const angle = Math.atan2(player.lastMoveDirection.y, player.lastMoveDirection.x);
                    projectiles.push({
                        type: weapon.type,
                        x: player.x,
                        y: player.y,
                        size: weapon.size,
                        damage: weapon.damage,
                        speed: weapon.speed,
                        angle: angle,
                        owner: player,
                        explosionRadius: weapon.explosionRadius,
                        exploded: false,
                        explosionTimer: 0
                    });
                    weapon.currentAmmo = 0;
                    weapon.reloading = true;
                    weapon.reloadTimer = weapon.reloadTime;
                    grenadeShotQueued = false;
                }
            }
            else if (weapon.type === 'plasmaBeam' && weapon.currentCooldown <= 0) {
                const angle = Math.random() * Math.PI * 2;
                projectiles.push({
                    type: weapon.type,
                    x: player.x,
                    y: player.y,
                    size: weapon.size,
                    damage: weapon.damage,
                    speed: weapon.speed,
                    angle: angle,
                    returning: false,
                    maxDistance: weapon.maxDistance,
                    distanceTraveled: 0,
                    owner: player
                });
                weapon.currentCooldown = weapon.cooldown;
            }
        }
    });
    grenadeShotQueued = false;
}

// --- BOMBA PLAZMOWA ---
function updatePlasmaBombs(deltaTime) {
    for (let i = plasmaBombs.length - 1; i >= 0; i--) {
        const bomb = plasmaBombs[i];
        if (!bomb.exploded) {
            bomb.timer -= deltaTime;
            if (bomb.timer <= 0) {
                bomb.exploded = true;
                bomb.explosionTimer = 0;
                for (let j = enemies.length - 1; j >= 0; j--) {
                    const enemy = enemies[j];
                    if (!enemy.active) continue;
                    const dist = Math.hypot(bomb.x - enemy.x, bomb.y - enemy.y);
                    if (dist < bomb.radius + enemy.size / 2) {
                        if (enemy.type === "t1000" || enemy.type === "bigTank") {
                            enemy.active = false;
                            spawnLootItem(enemy.x, enemy.y, 'electronics', enemy.electronicsDrop);
                        } else if (enemy.type === "t800") {
                            enemy.hp = 0;
                            enemy.active = false;
                            spawnLootItem(enemy.x, enemy.y, 'electronics', enemy.electronicsDrop);
                        }
                    }
                }
            }
        } else {
            bomb.explosionTimer += deltaTime;
            if (bomb.explosionTimer > 0.6) {
                plasmaBombs.splice(i, 1);
            }
        }
    }
    if (plasmaBombQueued && player.plasmaBombReady) {
        plasmaBombs.push({
            x: player.x,
            y: player.y,
            timer: weaponDefinitions.plasmaBomb.timer,
            exploded: false,
            radius: weaponDefinitions.plasmaBomb.explosionRadius,
            explosionTimer: 0
        });
        player.plasmaBombReady = false;
        player.plasmaBombReload = weaponDefinitions.plasmaBomb.reloadTime;
    }
    plasmaBombQueued = false;
}
function updatePlasmaBombReload(deltaTime) {
    if (!player.plasmaBombReady) {
        player.plasmaBombReload -= deltaTime;
        if (player.plasmaBombReload <= 0) {
            player.plasmaBombReload = 0;
            player.plasmaBombReady = true;
        }
    }
}

// --- Aktualizacja pocisków ---
function updateProjectiles(deltaTime) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        if (p.type === 'grenadeLauncher') {
            if (!p.exploded) {
                p.x += Math.cos(p.angle) * p.speed * deltaTime;
                p.y += Math.sin(p.angle) * p.speed * deltaTime;
                if (
                    p.x < 0 || p.x > canvas.width ||
                    p.y < 0 || p.y > canvas.height
                ) {
                    explodeGrenade(p, i);
                    continue;
                }
                for (let j = enemies.length - 1; j >= 0; j--) {
                    const enemy = enemies[j];
                    if (!enemy.active) continue;
                    const dist = Math.hypot(p.x - enemy.x, p.y - enemy.y);
                    if (dist < p.size / 2 + enemy.size / 2) {
                        explodeGrenade(p, i);
                        break;
                    }
                }
            } else {
                p.explosionTimer += deltaTime;
                if (p.explosionTimer > 0.25) {
                    projectiles.splice(i, 1);
                }
            }
        }
        else if (p.type === 'plasmaBeam') {
            if (!p.returning) {
                p.x += Math.cos(p.angle) * p.speed * deltaTime;
                p.y += Math.sin(p.angle) * p.speed * deltaTime;
                p.distanceTraveled += p.speed * deltaTime;
                if (p.distanceTraveled >= p.maxDistance) {
                    p.returning = true;
                }
            } else {
                const angleToPlayer = Math.atan2(player.y - p.y, player.x - p.x);
                p.x += Math.cos(angleToPlayer) * p.speed * deltaTime;
                p.y += Math.sin(angleToPlayer) * p.speed * deltaTime;
                const distanceToPlayer = Math.sqrt(
                    Math.pow(p.x - player.x, 2) + Math.pow(p.y - player.y, 2)
                );
                if (distanceToPlayer < (player.size / 2 + p.size / 2) - 5) {
                    projectiles.splice(i, 1);
                }
            }
        }
        else if (p.type === 'pistol') {
            p.x += Math.cos(p.angle) * p.speed * deltaTime;
            p.y += Math.sin(p.angle) * p.speed * deltaTime;
            if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
                projectiles.splice(i, 1);
            }
        }
        else if (p.type === 'tankLaser') {
            p.x += Math.cos(p.angle) * p.speed * deltaTime;
            p.y += Math.sin(p.angle) * p.speed * deltaTime;
            if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
                projectiles.splice(i, 1);
            }
        }
    }
}

// --- Funkcja do wybuchu granatu ---
function explodeGrenade(grenade, projectileIndex) {
    grenade.exploded = true;
    grenade.explosionTimer = 0;
    const radius = grenade.explosionRadius;
    for (let j = enemies.length - 1; j >= 0; j--) {
        const enemy = enemies[j];
        if (!enemy.active) continue;
        const dist = Math.hypot(grenade.x - enemy.x, grenade.y - enemy.y);
        if (dist < radius + enemy.size / 2) {
            if (enemy.type === "t800") {
                enemy.hp -= grenade.damage;
                if (enemy.hp <= 0) {
                    enemy.active = false;
                    spawnLootItem(enemy.x, enemy.y, 'electronics', enemy.electronicsDrop);
                }
            } else if (enemy.type === "t1000") {
                enemy.frozen = true;
                enemy.frozenTimer = 5;
            } else if (enemy.type === "bigTank") {
                // Czołg jest zamrażany przez granat na 5 sekund
                enemy.frozen = true;
                enemy.frozenTimer = 5;
            }
        }
    }
}

// --- Funkcje dla lootu ---
function spawnLootItem(x, y, type, value, size = 10) {
    lootItems.push({ x, y, size, type, value, collected: false });
}
function updateLootItems(deltaTime) {
    for (let i = lootItems.length - 1; i >= 0; i--) {
        const item = lootItems[i];
        if (item.collected) {
            lootItems.splice(i, 1);
            continue;
        }
        const distanceToPlayer = Math.sqrt(
            Math.pow(player.x - item.x, 2) + Math.pow(player.y - item.y, 2)
        );
        if (distanceToPlayer < player.lootCollectRange) {
            const angleToPlayer = Math.atan2(player.y - item.y, player.x - item.x);
            const attractionSpeed = 180;
            item.x += Math.cos(angleToPlayer) * attractionSpeed * deltaTime;
            item.y += Math.sin(angleToPlayer) * attractionSpeed * deltaTime;
            if (distanceToPlayer < (player.size / 2 + item.size / 2)) {
                if (item.type === 'electronics') {
                    player.electronicsCount += item.value;
                }
                item.collected = true;
            }
        }
    }
}

// --- Kolizje ---
function checkCollisions() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            if (!enemy.active) continue;
            const projHalfSize = projectile.size / 2;
            const enemyHalfSize = enemy.size / 2;
            if (projectile.type === 'grenadeLauncher') continue;
            if (projectile.x + projHalfSize > enemy.x - enemyHalfSize &&
                projectile.x - projHalfSize < enemy.x + enemyHalfSize &&
                projectile.y + projHalfSize > enemy.y - enemyHalfSize &&
                projectile.y - projHalfSize < enemy.y + enemyHalfSize)
            {
                if (enemy.type === "t800") {
                    enemy.hp -= projectile.damage;
                    if (projectile.type !== 'plasmaBeam') {
                        projectiles.splice(i, 1);
                        i--;
                    }
                    if (enemy.hp <= 0) {
                        enemy.active = false;
                        spawnLootItem(enemy.x, enemy.y, 'electronics', enemy.electronicsDrop);
                    }
                } else if (enemy.type === "t1000") {
                    enemy.frozen = true;
                    enemy.frozenTimer = 5;
                    if (projectile.type !== 'plasmaBeam') {
                        projectiles.splice(i, 1);
                        i--;
                    }
                } else if (enemy.type === "bigTank") {
                    // Czołg jest zamrażany przez pistolet i plazmę (nie ginie)
                    enemy.frozen = true;
                    enemy.frozenTimer = 5;
                    if (projectile.type !== 'plasmaBeam') {
                        projectiles.splice(i, 1);
                        i--;
                    }
                }
            }
        }
        // Tank laser trafia gracza
        if (projectiles[i] && projectiles[i].type === 'tankLaser') {
            const p = projectiles[i];
            const dist = Math.hypot(player.x - p.x, player.y - p.y);
            if (dist < player.size/2 + p.size/2) {
                player.hp -= p.damage;
                projectiles.splice(i, 1);
                i--;
                if (player.hp <= 0) {
                    endGame(false);
                    return;
                }
            }
        }
    }
    enemies.splice(0, enemies.length, ...enemies.filter(e => e.active));
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (!enemy.active) continue;
        const distance = Math.sqrt(
            Math.pow(player.x - enemy.x, 2) + Math.pow(player.y - enemy.y, 2)
        );
        if (distance < (player.size / 2 + enemy.size / 2)) {
             player.hp -= 1;
            if (player.hp <= 0) {
                endGame(false);
                return;
            }
        }
    }
}

// --- Uruchomienie gry ---
function startGame() {
    player.hp = player.maxHp = 100;
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.lastMoveDirection = { x: 0, y: -1 };
    player.weapons = [];
    player.passiveItems = [];
    player.electronicsCount = 0;
    player.plasmaBombReady = true;
    player.plasmaBombReload = 0;
    enemies.length = 0;
    projectiles.length = 0;
    lootItems.length = 0;
    plasmaBombs.length = 0;
    gameTime = 0;
    enemySpawnTimer = 0;
    pistolShotQueued = false;
    grenadeShotQueued = false;
    plasmaBombQueued = false;
    addStartingWeapon('pistol');
    addStartingWeapon('grenadeLauncher');
    gameRunning = true;
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
    console.log("Rozpoczynasz misję przetrwania!");
}

function endGame(win) {
    gameRunning = false;
    if (win) {
        alert(`Gratulacje! Zneutralizowałeś zagrożenie w ${Math.floor(gameTime)} sekund!`);
    } else {
        alert(`MISJA PRZERWANA! Przetrwałeś ${Math.floor(gameTime)} sekund. Systemy zostały zniszczone. Spróbuj ponownie!`);
    }
}

startGame();