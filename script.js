const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const menu = document.getElementById('menu');

// --- CARREGAMENTO DE IMAGENS ---
const imgPlayer = new Image();
imgPlayer.src = 'player.png'; // Nome do seu arquivo PNG

const imgEnemy = new Image();
imgEnemy.src = 'enemy.png'; // inimigo padrão
const imgEnemyVer = new Image(); imgEnemyVer.src = 'enemyver.gif';
const imgEnemyVerd = new Image(); imgEnemyVerd.src = 'enemyverd.png';

const imgFire = new Image();
imgFire.src = 'fire.png'; // tiro padrão
const imgBomb = new Image(); imgBomb.src = 'bombas.png';
const imgExpl = new Image(); imgExpl.src = 'explosão.png';
 
const imgPlatform = new Image();
imgPlatform.src = 'plataforma.png'; // imagem das plataformas
 
// plataforma principal fixa (carrega pelo nome existente primeiro)
const imgMainPlatform = new Image();
imgMainPlatform.src = 'plataforma principall.png';
imgMainPlatform.onerror = () => { imgMainPlatform.onerror = null; imgMainPlatform.src = 'plataforma principal.png'; };

// Sons (tentar carregar; se não existir, ignorar)
let sShot=null, sExpl=null, sHit=null;
try { sShot = new Audio('shot.wav'); sExpl = new Audio('explode.wav'); sHit = new Audio('hit.wav'); } catch(e) { sShot = sExpl = sHit = null; }
// -------------------------------

function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    // atualizar posição/dimensão da plataforma principal quando a tela muda
    if (typeof mainPlatform !== 'undefined') {
        mainPlatform.width = Math.min(300, Math.max(100, canvas.width * 0.5));
        mainPlatform.height = 24;
        mainPlatform.x = Math.floor(canvas.width / 2 - mainPlatform.width / 2);
        // não acessar `ground` aqui (pode estar em TDZ), posicionar provisoriamente acima do fundo padrão
        mainPlatform.y = Math.floor(canvas.height - 25 - mainPlatform.height - 6);
    }
}
// listeners e chamada inicial de resize serão registrados após declarar `mainPlatform`

let platforms = [], enemies = [], playerProjectiles = [], enemyProjectiles = [];
let mainPlatform = { width: 140, height: 24, x: 0, y: 0 };

window.addEventListener('load', resize);
window.addEventListener('resize', resize);
resize();
let player, score = 0, isGameOver = true, ground;
let record = 0;
let animationId;
const gravity = 0.25;
// maxEnemies agora é dinâmico (1..3) com base no score

class Projectile {
    constructor(x, y, vx, vy, color, type='bullet') {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.color = color; this.radius = 6; this.type = type; this.life = 300;
    }
    update() { this.x += this.vx; this.y += this.vy; }
    draw() { 
        if (this.type === 'bomb') {
            ctx.drawImage(imgBomb, this.x - 12, this.y - 12, 24, 24);
            // bomba tem gravidade
            this.vy += 0.3;
        } else if (this.type === 'explosion') {
            ctx.drawImage(imgExpl, this.x - 20, this.y - 20, 40, 40);
        } else {
            ctx.drawImage(imgFire, this.x - 10, this.y - 10, 20, 20);
        }
        // Se preferir o tiro como círculo colorido antigo, use o código abaixo:
        // ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.fill(); 
    }
}

class BaseGround {
    constructor() { this.height = 25; }
    draw() {
        ctx.fillStyle = "#34495e";
        ctx.fillRect(0, canvas.height - this.height, canvas.width, this.height);
        ctx.fillStyle = "#2c3e50";
        ctx.fillRect(0, canvas.height - this.height, canvas.width, 4);
    }
}

class Player {
    constructor() {
        this.width = 50; // Aumentei um pouco para o PNG aparecer melhor
        this.height = 50;
        this.x = canvas.width / 2 - 25;
        this.y = canvas.height - 150;
        this.vx = 0; this.vy = 0;
        this.jumpStrength = -10;
        this.direction = 1;
        this.isFlying = false;
    }
    draw() {
        ctx.save();
        ctx.translate(this.x + this.width/2, this.y + this.height/2);
        ctx.scale(this.direction, 1);
        
        // Se estiver voando, desenha o fogo embaixo do boneco
        if(this.isFlying) {
            ctx.drawImage(imgFire, -15, 20, 30, 30);
        }

        // Desenha o boneco PNG
        ctx.drawImage(imgPlayer, -this.width/2, -this.height/2, this.width, this.height);
        
        ctx.restore();
    }
    update() {
        if (this.isFlying) this.vy = -6; else this.vy += gravity;
        this.y += this.vy; this.x += this.vx;
        if (this.x < -40) this.x = canvas.width;
        if (this.x > canvas.width) this.x = -40;

        if (this.y < canvas.height / 2 && this.vy < 0) {
            let diff = this.vy;
            platforms.forEach(p => p.y -= diff);
            enemies.forEach(e => e.y -= diff);
            playerProjectiles.forEach(pr => pr.y -= diff);
            enemyProjectiles.forEach(ep => ep.y -= diff);
            this.y -= diff;
            score += Math.abs(Math.round(diff));
        }
    }
    shoot() {
        // atira na direção do inimigo mais próximo, se houver
        let vx = 0, vy = -10;
        if (enemies && enemies.length > 0) {
            let nearest = null, bestDist = Infinity;
            enemies.forEach(e => {
                const dx = (e.x + e.width/2) - (this.x + this.width/2);
                const dy = (e.y + e.height/2) - (this.y + this.height/2);
                const d = Math.hypot(dx, dy);
                if (d < bestDist) { bestDist = d; nearest = {dx, dy}; }
            });
            if (nearest) {
                const speed = 7;
                const ang = Math.atan2(nearest.dy, nearest.dx);
                vx = Math.cos(ang) * speed;
                vy = Math.sin(ang) * speed;
            }
        }
        playerProjectiles.push(new Projectile(this.x + this.width/2, this.y + this.height/2, vx, vy, "#e74c3c"));
    }
}

class Enemy {
    constructor(y) {
        // tipo aleatório: basic, vermelho (lança bombas), verde (atira dois)
        const types = ['basic','vermelho','verde'];
        this.type = types[Math.floor(Math.random()*types.length)];
        // manter o mesmo tamanho do player quando possível
        const pW = (typeof player !== 'undefined' && player && player.width) ? player.width : 50;
        const pH = (typeof player !== 'undefined' && player && player.height) ? player.height : 50;
        this.width = pW; this.height = pH;
        this.x = Math.random() * Math.max(1, (canvas.width - this.width));
        this.y = y;
        this.shootTimer = 0;
        this.speed = 1.8;
    }
    update() {
        if (player) {
            if (this.x < player.x) this.x += this.speed;
            else if (this.x > player.x) this.x -= this.speed;
        }

        this.shootTimer++;
        if (this.shootTimer > 100) {
            if (this.type === 'verde') {
                // atira dois tiros com ângulos offset
                if (player) {
                    const dx = (player.x + player.width/2) - (this.x + this.width/2);
                    const dy = (player.y + player.height/2) - (this.y + this.height/2);
                    const base = Math.atan2(dy, dx);
                    const s = 5;
                    enemyProjectiles.push(new Projectile(this.x+this.width/2, this.y+this.height/2, Math.cos(base-0.2)*s, Math.sin(base-0.2)*s, "#f1c40f", 'enemy_fire'));
                    enemyProjectiles.push(new Projectile(this.x+this.width/2, this.y+this.height/2, Math.cos(base+0.2)*s, Math.sin(base+0.2)*s, "#f1c40f", 'enemy_fire'));
                    if (sShot) try{ sShot.cloneNode().play(); }catch(e){}
                }
            } else if (this.type === 'vermelho') {
                // solta bomba
                enemyProjectiles.push(new Projectile(this.x+this.width/2, this.y+this.height/2, 0, 2, "#000", 'bomb'));
                if (sShot) try{ sShot.cloneNode().play(); }catch(e){}
            } else {
                // básico: atira um tiro simples
                if (player) {
                    const s = 4.5;
                    const dx = (player.x + player.width/2) - (this.x + this.width/2);
                    const dy = (player.y + player.height/2) - (this.y + this.height/2);
                    const angle = Math.atan2(dy, dx);
                    enemyProjectiles.push(new Projectile(this.x+this.width/2, this.y+this.height/2, Math.cos(angle)*s, Math.sin(angle)*s, "#f1c40f", 'enemy_fire'));
                    if (sShot) try{ sShot.cloneNode().play(); }catch(e){}
                }
            }
            this.shootTimer = 0;
        }
    }
    draw() {
        // Desenha conforme tipo
        if (this.type === 'vermelho' && imgEnemyVer && imgEnemyVer.complete && imgEnemyVer.naturalWidth) ctx.drawImage(imgEnemyVer, this.x, this.y, this.width, this.height);
        else if (this.type === 'verde' && imgEnemyVerd && imgEnemyVerd.complete && imgEnemyVerd.naturalWidth) ctx.drawImage(imgEnemyVerd, this.x, this.y, this.width, this.height);
        else ctx.drawImage(imgEnemy, this.x, this.y, this.width, this.height);
    }
}

class Platform {
    constructor(y) {
        this.width = 160; this.height = 32;
        this.x = Math.random() * Math.max(1, (canvas.width - this.width));
        this.y = y;
        // mover horizontalmente aleatoriamente
        this.vx = (Math.random() > 0.5) ? 1.2 : -1.2;
    }
    draw() {
        if (imgPlatform && imgPlatform.complete && imgPlatform.naturalWidth !== 0) {
            ctx.drawImage(imgPlatform, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = "#27ae60";
            if (typeof ctx.roundRect === 'function') {
                ctx.beginPath(); ctx.roundRect(this.x, this.y, this.width, this.height, 5); ctx.fill();
            } else {
                ctx.fillRect(this.x, this.y, this.width, this.height);
            }
        }
    }
    update() {
        this.x += this.vx;
        if (this.x < 0) { this.x = 0; this.vx *= -1; }
        if (this.x + this.width > canvas.width) { this.x = canvas.width - this.width; this.vx *= -1; }
    }
}

// --- LÓGICA BÁSICA DE INICIALIZAÇÃO E LOOP ---
function spawnInitialPlatforms() {
    platforms = [];
    const gap = Math.floor(canvas.height / 6);
    for (let i = 0; i < 6; i++) {
        const p = new Platform(canvas.height - (i * gap) - 120);
        p.x = Math.random() * (canvas.width - p.width);
        platforms.push(p);
    }
}

function init() {
    player = new Player();
    ground = new BaseGround();
    playerProjectiles = [];
    enemyProjectiles = [];
    enemies = [];
    score = 0;
    spawnInitialPlatforms();
    // carregar record do localStorage
    try { record = parseInt(localStorage.getItem('bob_record')) || 0; } catch(e) { record = 0; }
    console.log('init record=', record);
}

function gameLoop() {
    try {
        if (isGameOver) return;
        console.log('gameLoop: frame');
        updateEntities();
        checkCollisions();
        checkPlayerPlatformCollision();
        drawEntities();

        if (player && ground && player.y > canvas.height - ground.height) {
            gameOver();
            return;
        }
    } catch (err) {
        console.error('Erro no gameLoop:', err);
        isGameOver = true;
        if (menu) menu.style.display = 'block';
        return;
    }
    animationId = requestAnimationFrame(gameLoop);
}

function gameOver() {
    isGameOver = true;
    if (animationId) cancelAnimationFrame(animationId);
    if (menu) {
        menu.style.display = 'block';
        try { if (menu.querySelector) menu.querySelector('h1').textContent = 'Game Over'; } catch(e){}
    }
}

function startGame() {
    if (menu) menu.style.display = 'none';
    isGameOver = false;
    init();
    console.log('startGame(): iniciando');
    animationId = requestAnimationFrame(gameLoop);
}

function checkPlayerPlatformCollision() {
    // Colisão com as plataformas normais (já está correto no seu código)
    platforms.forEach(p => {
        if (player.vy > 0 && player.x + player.width > p.x && player.x < p.x + p.width && player.y + player.height > p.y && player.y + player.height < p.y + p.height + player.vy + 5) {
            player.vy = player.jumpStrength;
            player.y = p.y - player.height - 1;
        }
    });

    // CORREÇÃO DA PLATAFORMA PRINCIPAL:
    const mp = mainPlatform;
    if (player.vy > 0 && 
        player.x + player.width > mp.x && 
        player.x < mp.x + mp.width && 
        player.y + player.height > mp.y && 
        player.y + player.height < mp.y + mp.height + player.vy + 6) {
        
        // Em vez de player.vy = 0 (que prende o boneco), usamos o pulo:
        player.vy = player.jumpStrength; 
        player.y = mp.y - player.height - 1;
    }
}

function updateEntities() {
    player.update();
    enemies.forEach(e => e.update());
    playerProjectiles.forEach(pr => pr.update());
    enemyProjectiles.forEach(ep => ep.update());
    platforms.forEach(p => p.update && p.update());

    // ajustar número de inimigos dinamicamente entre 1 e 3 conforme o score
    const desiredEnemies = Math.min(3, Math.max(1, 1 + Math.floor(score / 1000)));
    while (enemies.length < desiredEnemies) {
        const spawnY = Math.random() * (canvas.height * 0.45);
        enemies.push(new Enemy(spawnY));
    }

    // Remove tiros fora da tela
    playerProjectiles = playerProjectiles.filter(pr => pr.y > -50 && pr.y < canvas.height + 50 && pr.x > -50 && pr.x < canvas.width + 50);
    enemyProjectiles = enemyProjectiles.filter(ep => ep.y > -50 && ep.y < canvas.height + 50 && ep.x > -50 && ep.x < canvas.width + 50);

    // Remover plataformas que saíram muito acima e gerar novas abaixo
    platforms = platforms.filter(p => p.y < canvas.height + 50);
    while (platforms.length < 6) {
        const lastY = platforms.length ? Math.min(...platforms.map(p=>p.y)) : canvas.height;
        const np = new Platform(lastY - 120 - Math.random()*60);
        np.x = Math.random() * (canvas.width - np.width);
        platforms.push(np);
    }
}

// --- COLISÕES ---
function rectsIntersect(a, b) {
    return !(a.x + a.width < b.x || a.x > b.x + b.width || a.y + a.height < b.y || a.y > b.y + b.height);
}

function checkCollisions() {
    if (!player) return;

    // player <-> enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        const pr = { x: player.x, y: player.y, width: player.width, height: player.height };
        const er = { x: e.x, y: e.y, width: e.width, height: e.height };
        if (rectsIntersect(pr, er)) {
            console.log('colisão player <-> enemy');
            gameOver();
            return;
        }
    }

    // playerProjectiles -> enemies
    for (let pi = playerProjectiles.length - 1; pi >= 0; pi--) {
        const prj = playerProjectiles[pi];
        const prRect = { x: prj.x - 6, y: prj.y - 6, width: 12, height: 12 };
        for (let ei = enemies.length - 1; ei >= 0; ei--) {
            const e = enemies[ei];
            const eRect = { x: e.x, y: e.y, width: e.width, height: e.height };
            if (rectsIntersect(prRect, eRect)) {
                // remove inimigo e projétil
                enemies.splice(ei, 1);
                playerProjectiles.splice(pi, 1);
                score += 100;
                break;
            }
        }
    }

    // enemyProjectiles -> player
    for (let ei = enemyProjectiles.length - 1; ei >= 0; ei--) {
        const ep = enemyProjectiles[ei];
        const epRect = { x: ep.x - 6, y: ep.y - 6, width: 12, height: 12 };
        const pRect = { x: player.x, y: player.y, width: player.width, height: player.height };
        if (rectsIntersect(epRect, pRect)) {
            console.log('colisão player < - projétil inimigo');
            gameOver();
            return;
        }
    }
}



function drawEntities() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // desenha chão (comente se quiser remover a barra cinza)
    if (ground && typeof ground.draw === 'function') ground.draw();

    // entidades
    platforms.forEach(p => p.draw());
    enemies.forEach(e => e.draw());
    playerProjectiles.forEach(pr => pr.draw());
    enemyProjectiles.forEach(ep => ep.draw());

    // plataforma principal fixa
    if (imgMainPlatform && imgMainPlatform.complete && imgMainPlatform.naturalWidth !== 0) {
        ctx.drawImage(imgMainPlatform, mainPlatform.x, mainPlatform.y, mainPlatform.width, mainPlatform.height);
    } else {
        ctx.fillStyle = '#8e44ad';
        if (typeof ctx.roundRect === 'function') { ctx.beginPath(); ctx.roundRect(mainPlatform.x, mainPlatform.y, mainPlatform.width, mainPlatform.height, 6); ctx.fill(); }
        else ctx.fillRect(mainPlatform.x, mainPlatform.y, mainPlatform.width, mainPlatform.height);
    }

    if (player) player.draw();
    // atualizar record se necessário
    if (score > record) {
        record = score;
        try { localStorage.setItem('bob_record', String(record)); } catch(e){}
    }
    scoreElement.textContent = 'Score: ' + score + '  Record: ' + record;
}

// Debug: desenha um marcador no canto para confirmar que o loop está rodando
function drawDebugMarker() {
    try {
        ctx.fillStyle = 'red';
        ctx.fillRect(4, 4, 12, 12);
        ctx.fillStyle = 'black';
        ctx.font = '12px sans-serif';
        ctx.fillText('frame', 22, 14);
    } catch (e) {
        console.error('Erro desenhando debug:', e);
    }
}

// Chamar debug ao final de cada frame
const _origDrawEntities = drawEntities;
drawEntities = function() { _origDrawEntities(); drawDebugMarker(); };

// Controles básicos
const startBtn = document.getElementById('mainStartBtn');
if (startBtn) startBtn.addEventListener('click', () => startGame());

let leftPressed = false, rightPressed = false;
let flyButtonPressed = false; // botão VOAR na tela
let flyKeyPressed = false; // tecla ArrowUp
window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') leftPressed = true;
    if (e.key === 'ArrowRight') rightPressed = true;
    if (e.key === ' ' || e.key === 'Spacebar') player && player.shoot();
    if (e.key === 'ArrowUp') flyKeyPressed = true;
});
window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') leftPressed = false;
    if (e.key === 'ArrowRight') rightPressed = false;
    if (e.key === 'ArrowUp') flyKeyPressed = false;
});

function applyKeyboardMotion() {
    if (player) {
        if (leftPressed) player.vx = -4;
        else if (rightPressed) player.vx = 4;
        else player.vx = 0;
        // setar voo se qualquer fonte estiver pedindo (setas, botão VOAR ou tecla)
        player.isFlying = !!(flyButtonPressed || flyKeyPressed || leftPressed || rightPressed);
    }
    requestAnimationFrame(applyKeyboardMotion);
}
applyKeyboardMotion();

// Touch/buttons
const leftBtn = document.getElementById('leftButton');
const rightBtn = document.getElementById('rightButton');
const flyBtns = document.querySelectorAll('.fly');
const shootBtn = document.getElementById('shootButton');

if (leftBtn) {
    leftBtn.addEventListener('pointerdown', ()=> leftPressed = true);
    leftBtn.addEventListener('pointerup', ()=> leftPressed = false);
    leftBtn.addEventListener('pointercancel', ()=> leftPressed = false);
}
if (rightBtn) {
    rightBtn.addEventListener('pointerdown', ()=> rightPressed = true);
    rightBtn.addEventListener('pointerup', ()=> rightPressed = false);
    rightBtn.addEventListener('pointercancel', ()=> rightPressed = false);
}
if (flyBtns) {
    flyBtns.forEach(b => {
        b.addEventListener('pointerdown', ()=> flyButtonPressed = true);
        b.addEventListener('pointerup', ()=> flyButtonPressed = false);
        b.addEventListener('pointercancel', ()=> flyButtonPressed = false);
    });
}
if (shootBtn) { shootBtn.addEventListener('pointerdown', ()=> player && player.shoot()); }

// Start menu initial visibility
menu.style.display = 'block';

