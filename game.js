// Pobieramy canvas i jego kontekst do rysowania
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Elementy UI
const playerHpSpan = document.getElementById('playerHp');
const gameTimerSpan = document.getElementById('gameTimer');
const pistolAmmoSpan = document.getElementById('pistolAmmo');
const pistolReloadSpan = document.getElementById('pistolReload');
const electronicsCountSpan = document.getElementById('electronicsCount');

// --- Zmienne gry ---
let gameRunning = false;
let gameTime = 0; // Czas w sekundach
let lastTime = 0; // Do mierzenia delty czasu

const enemies = []; // Tablica na wszystkich aktywnych wrogów
const projectiles = []; // Tablica na wszystkie aktywne pociski/broń
const lootItems = []; // Tablica na różne przedmioty upuszczone przez wrogów

// --- Gracz ---
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    size: 20, // To będzie średnica koła gracza
    color: '#00BFFF', // Kolor gracza (głęboki błękit / cyjan)
    hp: 100,
    maxHp: 100,
    speed: 150, // Prędkość gracza w pikselach/sekundę
    weapons: [], // Bronie aktywne gracza
    passiveItems: [], // Przedmioty pasywne gracza
    lastMoveDirection: { x: 0, y: -1 }, // Domyślny kierunek w górę dla Pistoletu
    lootCollectRange: 50, // Zasięg zbierania lootu
    electronicsCount: 0, // Zebrana elektronika
};

// --- Konfiguracja Broni ---
const weaponDefinitions = {
    // Podstawowa broń: Pistolet
    pistol: {
        name: "Pistolet",
        baseDamage: 15,
        baseCooldown: 0.25, // ZMIENIONO: Szybkostrzelność x2 (0.5 na 0.25)
        baseSize: 8, // Rozmiar pocisku
        baseSpeed: 900,
        maxLevel: 8,
        magazineSize: 10, // Rozmiar magazynka
        reloadTime: 5, // Czas przeładowania
        description: "Standardowy pistolet laserowy. Celuje w kierunku ruchu.",
        draw: (ctx, projectile) => {
            ctx.fillStyle = '#FFD700'; // Złoty/żółty kolor pocisku
            ctx.fillRect(projectile.x - projectile.size / 2, projectile.y - projectile.size / 2, projectile.size, projectile.size);
        }
    },
    // Druga broń: Wiązka Plazmowa
    plasmaBeam: {
        name: "Wiązka Plazmowa",
        baseDamage: 10,
        baseCooldown: 1.5,
        baseSize: 15,
        baseSpeed: 600,
        maxLevel: 8,
        description: "Intensywna wiązka energii, która przecina maszyny.",
        draw: (ctx, projectile) => {
            ctx.strokeStyle = '#00FFFF'; // Jasnoniebieski (cyjan) kolor
            ctx.lineWidth = 4; // Grubsza kreska
            ctx.beginPath();
            ctx.moveTo(projectile.x - projectile.size / 2, projectile.y);
            ctx.lineTo(projectile.x + projectile.size / 2, projectile.y);
            ctx.moveTo(projectile.x, projectile.y - projectile.size / 2);
            ctx.lineTo(projectile.x, projectile.y + projectile.size / 2);
            ctx.stroke();
        }
    },
};

// --- Definicje Wrogów ---
const enemyDefinitions = {
    t800: {
        name: "T-800",
        size: 20,
        speed: 25,
        hp: 25,
        electronicsDrop: 1, // Ilość elektroniki
        draw: (ctx, enemy) => {
            const size = enemy.size;
            const halfSize = size / 2;

            // Główna część czaszki (lekko owalna, biała)
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.ellipse(enemy.x, enemy.y, halfSize, halfSize * 1.1, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.closePath();

            // Szczęka (nieco niżej, szara)
            ctx.fillStyle = 'lightgray';
            ctx.beginPath();
            ctx.ellipse(enemy.x, enemy.y + halfSize * 0.5, halfSize * 0.8, halfSize * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.closePath();

            // Otwory oczu (ciemne, niemal czarne)
            const eyeSocketSize = size / 3.5;
            const eyeOffset = size / 4.5;
            ctx.fillStyle = '#333'; // Ciemnoszary dla oczodołów
            ctx.beginPath();
            ctx.arc(enemy.x - eyeOffset, enemy.y - eyeOffset, eyeSocketSize / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(enemy.x + eyeOffset, enemy.y - eyeOffset, eyeSocketSize / 2, 0, Math.PI * 2);
            ctx.fill();

            // Czerwone oczy (mniejsze kółka w oczodołach)
            const eyePupilSize = size / 6;
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(enemy.x - eyeOffset, enemy.y - eyeOffset, eyePupilSize / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(enemy.x + eyeOffset, enemy.y - eyeOffset, eyePupilSize / 2, 0, Math.PI * 2);
            ctx.fill();

            // Otwór nosowy (mały ciemny trójkąt)
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.moveTo(enemy.x, enemy.y + size * 0.1); // Wierzchołek
            ctx.lineTo(enemy.x - size * 0.1, enemy.y + size * 0.3); // Lewy dół
            ctx.lineTo(enemy.x + size * 0.1, enemy.y + size * 0.3); // Prawy dół
            ctx.closePath();
            ctx.fill();
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

// Nowa flaga do zarządzania serią Pistoletu
let pistolShotQueued = false; // Oznacza, że kliknięcie LPM aktywowało serię

document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key in keys) {
        keys[key] = true;
        e.preventDefault(); // Zapobiegaj domyślnemu zachowaniu (np. przewijaniu strony)
    }
});

document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key in keys) {
        keys[key] = false;
    }
});

document.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // LPM to przycisk 0
        pistolShotQueued = true; // Ustaw flagę, że chcemy strzelić
    }
});

document.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
        // Nic nie robimy, seria jest aktywowana jednym kliknięciem
    }
});

// --- Funkcje rysowania ---
function drawPlayer() {
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
}

function drawDirectionIndicator() {
    ctx.strokeStyle = '#FFFF00'; // Żółty kolor dla wskaźnika
    ctx.lineWidth = 2; // Grubość linii
    const indicatorLength = player.size * 0.8; // ZMIENIONO: Długość wskaźnika (z 1.5 na 0.8)

    const angle = Math.atan2(player.lastMoveDirection.y, player.lastMoveDirection.x);

    const endX = player.x + Math.cos(angle) * indicatorLength;
    const endY = player.y + Math.sin(angle) * indicatorLength;

    ctx.beginPath();
    ctx.moveTo(player.x, player.y); // Początek linii w centrum gracza
    ctx.lineTo(endX, endY);        // Koniec linii
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
    checkCollisions();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawPlayer();
    drawDirectionIndicator(); // Rysuj wskaźnik kierunku

    enemies.forEach(drawEnemy);
    projectiles.forEach(drawProjectile);
    lootItems.forEach(drawLootItem);
}

function updateUI() {
    playerHpSpan.textContent = `${player.hp}/${player.maxHp}`;
    const minutes = Math.floor(gameTime / 60).toString().padStart(2, '0');
    const seconds = Math.floor(gameTime % 60).toString().padStart(2, '0');
    gameTimerSpan.textContent = `${minutes}:${seconds}`;

    const pistol = player.weapons.find(w => w.type === 'pistol');
    if (pistol) {
        pistolAmmoSpan.textContent = `${pistol.currentAmmo}/${pistol.magazineSize}`;
        if (pistol.reloading) {
            pistolReloadSpan.textContent = `${pistol.reloadTimer.toFixed(1)}s`;
        } else {
            pistolReloadSpan.textContent = `Gotowe`;
        }
    } else {
        pistolAmmoSpan.textContent = `N/A`;
        pistolReloadSpan.textContent = `N/A`;
    }

    electronicsCountSpan.textContent = player.electronicsCount;
}

// --- Funkcje wrogów ---
let enemySpawnTimer = 0;
const spawnInterval = 1;
const maxEnemies = 50;

function spawnEnemy() {
    if (enemies.length >= maxEnemies) return;

    const enemyType = 't800';
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

    enemies.push({ x, y, size, speed, hp, maxHp: hp, electronicsDrop, active: true, type: enemyType });
}

function updateEnemies(deltaTime) {
    enemySpawnTimer += deltaTime;
    if (enemySpawnTimer >= spawnInterval) {
        spawnEnemy();
        enemySpawnTimer = 0;
    }

    enemies.forEach(enemy => {
        if (!enemy.active) return;

        const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        enemy.x += Math.cos(angle) * enemy.speed * deltaTime;
        enemy.y += Math.sin(angle) * enemy.speed * deltaTime;
    });
}

// --- Funkcje broni ---
function addStartingWeapon(weaponName) {
    const weaponDef = weaponDefinitions[weaponName];
    if (weaponDef) {
        const newWeapon = {
            name: weaponDef.name,
            type: weaponName,
            level: 1, // Poziom broni (do ulepszeń elektroniką)
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
            shotsInSeries: 0, // Ile strzałów pozostało w aktualnej serii dla Pistoletu
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
                console.log(`${weapon.name} przeładowany! (${weapon.currentAmmo} / ${weapon.magazineSize})`);
            }
        } else { // Broń NIE przeładowuje się
            // Logika dla Wiązki Plazmowej (nadal automatyczna)
            if (weapon.type === 'plasmaBeam' && weapon.currentCooldown <= 0) {
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
            // Logika dla Pistoletu (seria po LPM)
            else if (weapon.type === 'pistol') {
                // Jeśli kliknięto LPM i zaczynamy nową serię
                if (pistolShotQueued && weapon.currentAmmo > 0 && weapon.shotsInSeries === 0) {
                    weapon.shotsInSeries = weapon.magazineSize; // Aktywuj pełną serię
                    pistolShotQueued = false; // Skonsumuj kliknięcie, aby nie wywołać kolejnej serii
                }

                // Jeśli seria jest aktywna i można strzelić
                if (weapon.shotsInSeries > 0 && weapon.currentCooldown <= 0) {
                    if (weapon.currentAmmo > 0) {
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
                        });
                        weapon.currentAmmo--; // Zmniejsz amunicję
                        weapon.shotsInSeries--; // Zmniejsz liczbę strzałów w serii
                        weapon.currentCooldown = weapon.cooldown; // Reset cooldownu strzału

                        if (weapon.currentAmmo <= 0) {
                            weapon.reloading = true;
                            weapon.reloadTimer = weapon.reloadTime;
                            weapon.shotsInSeries = 0; // Przerwij serię, jeśli skończyła się amunicja
                            console.log(`${weapon.name} - magazynek pusty! Rozpoczynam przeładowanie...`);
                        }
                    } else {
                        // Jeśli amunicja = 0, ale shotsInSeries > 0 (bo mogła się skończyć w trakcie serii)
                        // Wymuś przeładowanie i przerwij serię
                        weapon.reloading = true;
                        weapon.reloadTimer = weapon.reloadTime;
                        weapon.shotsInSeries = 0;
                        console.log(`${weapon.name} - magazynek pusty! Rozpoczynam przeładowanie...`);
                    }
                }
            }
        }
    });
}

function updateProjectiles(deltaTime) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];

        p.x += Math.cos(p.angle) * p.speed * deltaTime;
        p.y += Math.sin(p.angle) * p.speed * deltaTime;

        if (p.type === 'plasmaBeam') {
            if (!p.returning) {
                p.distanceTraveled += p.speed * deltaTime;
                if (p.distanceTraveled >= p.maxDistance) {
                    p.returning = true;
                }
            } else {
                const angleToPlayer = Math.atan2(player.y - p.y, player.x - p.x);
                p.x += Math.cos(angleToPlayer) * p.speed * deltaTime;
                p.y += Math.sin(angleToPlayer) * p.speed * deltaTime;

                const distanceToPlayer = Math.sqrt(
                    Math.pow(p.x - player.x, 2) + Math.pow(p.y - p.y, 2)
                );
                if (distanceToPlayer < (player.size / 2 + p.size / 2) - 5) {
                    projectiles.splice(i, 1);
                }
            }
        } else if (p.type === 'pistol') {
            if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
                projectiles.splice(i, 1);
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

            if (projectile.x + projHalfSize > enemy.x - enemyHalfSize &&
                projectile.x - projHalfSize < enemy.x + enemyHalfSize &&
                projectile.y + projHalfSize > enemy.y - enemyHalfSize &&
                projectile.y - projHalfSize < enemy.y + enemyHalfSize)
            {
                enemy.hp -= projectile.damage;
                if (projectile.type !== 'plasmaBeam') {
                    projectiles.splice(i, 1);
                    i--;
                }

                if (enemy.hp <= 0) {
                    enemy.active = false;
                    spawnLootItem(enemy.x, enemy.y, 'electronics', enemy.electronicsDrop);
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

    enemies.length = 0;
    projectiles.length = 0;
    lootItems.length = 0;

    gameTime = 0;
    enemySpawnTimer = 0;
    pistolShotQueued = false; // Resetuj flagę serii Pistoletu

    addStartingWeapon('pistol');

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