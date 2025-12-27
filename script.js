const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const menu = document.getElementById('menu');

// --- CARREGAMENTO DE IMAGENS ---
const imgPlayer = new Image();
imgPlayer.src = 'player.png'; // Nome do seu arquivo PNG

const imgEnemy = new Image();
imgEnemy.src = 'enemy.png'; // Nome do seu arquivo PNG do inimigo

const imgFire = new Image();
imgFire.src = 'fire.png'; // Nome do seu arquivo PNG do fogo (propulsor ou tiro)
// -------------------------------

function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}
window.addEventListener('load', resize);
window.addEventListener('resize', resize);
resize();

let platforms = [], enemies = [], playerProjectiles = [], enemyProjectiles = [];
let player, score = 0, isGameOver = true, ground;
let animationId;
const gravity = 0.25;
let maxEnemies = 2; 

class Projectile {
    constructor(x, y, vx, vy, color) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.color = color; this.radius = 4;
    }
    update() { this.x += this.vx; this.y += this.vy; }
    draw() { 
        // Se quiser que o tiro seja o PNG de fogo:
        ctx.drawImage(imgFire, this.x - 10, this.y - 10, 20, 20);
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
        playerProjectiles.push(new Projectile(this.x + this.width/2, this.y, 0, -10, "#e74c3c"));
    }
}

class Enemy {
    constructor(y) {
        this.width = 45; this.height = 45;
        this.x = Math.random() * (canvas.width - 45);
        this.y = y;
        this.shootTimer = 0;
        this.speed = 1.8;
    }
    update() {
        if (this.x < player.x) this.x += this.speed;
        else if (this.x > player.x) this.x -= this.speed;

        this.shootTimer++;
        if (this.shootTimer > 120) {
            const s = 5;
            const dx = (player.x + player.width/2) - (this.x + this.width/2);
            const dy = (player.y + player.height/2) - (this.y + this.height/2);
            const angle = Math.atan2(dy, dx);
            enemyProjectiles.push(new Projectile(this.x+20, this.y+20, Math.cos(angle)*s, Math.sin(angle)*s, "#f1c40f"));
            this.shootTimer = 0;
        }
    }
    draw() {
        // Desenha o inimigo PNG
        ctx.drawImage(imgEnemy, this.x, this.y, this.width, this.height);
    }
}

class Platform {
    constructor(y) {
        this.width = 65; this.height = 15;
        this.x = Math.random() * (canvas.width - this.width);
        this.y = y;
    }
    draw() {
        ctx.fillStyle = "#27ae60";
        ctx.beginPath(); ctx.roundRect(this.x, this.y, this.width, this.height, 5); ctx.fill();
    }
}

// ... (Funções init, gameLoop, gameOver, startGame e Controles permanecem as mesmas do código anterior)
// Basta manter o restante do código que já estava funcionando!
