// Puerto a TypeScript de references/started-games/04-arkanoid/game.js +
// levels.js + assets/spritesheet.js. El motor no toca el DOM directamente:
// recibe ctx/width/height por parámetro y expone update(dt)/draw() para que
// el consumidor controle el loop. Progresión infinita: al limpiar el nivel 5,
// el nivel 6 reutiliza el patrón del nivel 1 (ciclo de 5), cada vez más rápido
// y con más puntos por bloque — el único fin de partida es perder las vidas.

export type BlockColor =
  "gray" | "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green";

interface Paddle {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Ball {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
}
interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
}
interface Explosion {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  elapsed: number;
}

const PADDLE_SPEED = 400;
const PADDLE_W = 81;
const PADDLE_H = 14;
const BALL_SIZE = 16;
const BLOCK_COLS = 10;
const BLOCK_ROWS = 6;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const EXPLOSION_DURATION = 150; // ms, igual al original

// Puerto literal de levels.js: 5 patrones de bloques (col, row, color), sin
// velocidad embebida — la velocidad y el puntaje del nivel se calculan por
// fórmula (progresión infinita, ver speedForLevel/pointsPerBlockForLevel).
const BLOCK_PATTERNS: { col: number; row: number; color: BlockColor }[][] =
  (() => {
    const rowColors1: BlockColor[] = [
      "red",
      "yellow",
      "cyan",
      "magenta",
      "hotpink",
      "green",
    ];
    const rowColors2: BlockColor[] = [
      "gray",
      "cyan",
      "hotpink",
      "yellow",
      "magenta",
      "green",
    ];
    const rowColors4: BlockColor[] = [
      "cyan",
      "magenta",
      "green",
      "yellow",
      "hotpink",
      "red",
    ];

    const l1: { col: number; row: number; color: BlockColor }[] = [];
    for (let row = 0; row < BLOCK_ROWS; row++)
      for (let col = 0; col < BLOCK_COLS; col++)
        l1.push({ col, row, color: rowColors1[row] });

    const l2: { col: number; row: number; color: BlockColor }[] = [];
    const pyStart = [4, 3, 2, 1, 0, 0];
    const pyEnd = [5, 6, 7, 8, 9, 9];
    for (let row = 0; row < BLOCK_ROWS; row++)
      for (let col = pyStart[row]; col <= pyEnd[row]; col++)
        l2.push({ col, row, color: rowColors2[row] });

    const l3: { col: number; row: number; color: BlockColor }[] = [];
    for (let row = 0; row < BLOCK_ROWS; row++)
      for (let col = 0; col < BLOCK_COLS; col++)
        if ((col + row) % 2 === 0)
          l3.push({ col, row, color: row < 3 ? "yellow" : "magenta" });

    const gaps4 = [
      [2, 5, 8],
      [0, 4, 7, 9],
      [1, 3, 6],
      [2, 5, 8, 9],
      [0, 4, 7],
      [1, 3, 6, 9],
    ];
    const l4: { col: number; row: number; color: BlockColor }[] = [];
    for (let row = 0; row < BLOCK_ROWS; row++)
      for (let col = 0; col < BLOCK_COLS; col++)
        if (!gaps4[row].includes(col))
          l4.push({ col, row, color: rowColors4[row] });

    const l5: { col: number; row: number; color: BlockColor }[] = [];
    for (let row = 0; row < BLOCK_ROWS; row++)
      for (let col = 0; col < BLOCK_COLS; col++) {
        const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
        const isCross = col === 4 || row === 2;
        if (isFrame || isCross)
          l5.push({
            col,
            row,
            color: isCross && !isFrame ? "hotpink" : "cyan",
          });
      }

    return [l1, l2, l3, l4, l5];
  })();

// Progresión infinita (nivel 6+ reutiliza los patrones en ciclo):
const patternForLevel = (level: number) => BLOCK_PATTERNS[(level - 1) % 5];
const speedForLevel = (level: number) => Math.pow(1.1, level - 1);
const pointsPerBlockForLevel = (level: number) =>
  Math.round(10 * Math.pow(1.1, level - 1));

// Atlas de sprites, puerto literal de assets/spritesheet.js (coordenadas
// sx/sy/sw/sh dentro del spritesheet):
const SPRITES = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  },
} as const;

const EXPLOSION_FRAMES: Record<
  BlockColor,
  { sx: number; sy: number; sw: number; sh: number }[]
> = {
  red: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
  cyan: [
    { sx: 256, sy: 192, sw: 32, sh: 16 },
    { sx: 288, sy: 192, sw: 32, sh: 16 },
    { sx: 320, sy: 192, sw: 32, sh: 16 },
    { sx: 352, sy: 192, sw: 32, sh: 16 },
  ],
  green: [
    { sx: 256, sy: 208, sw: 32, sh: 16 },
    { sx: 288, sy: 208, sw: 32, sh: 16 },
    { sx: 320, sy: 208, sw: 32, sh: 16 },
    { sx: 352, sy: 208, sw: 32, sh: 16 },
  ],
  magenta: [
    { sx: 256, sy: 224, sw: 32, sh: 16 },
    { sx: 288, sy: 224, sw: 32, sh: 16 },
    { sx: 320, sy: 224, sw: 32, sh: 16 },
    { sx: 352, sy: 224, sw: 32, sh: 16 },
  ],
  yellow: [
    { sx: 256, sy: 240, sw: 32, sh: 16 },
    { sx: 288, sy: 240, sw: 32, sh: 16 },
    { sx: 320, sy: 240, sw: 32, sh: 16 },
    { sx: 352, sy: 240, sw: 32, sh: 16 },
  ],
  hotpink: [
    { sx: 256, sy: 256, sw: 32, sh: 16 },
    { sx: 288, sy: 256, sw: 32, sh: 16 },
    { sx: 320, sy: 256, sw: 32, sh: 16 },
    { sx: 352, sy: 256, sw: 32, sh: 16 },
  ],
  gray: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
};

export interface ArkanoidEngineCallbacks {
  onScoreChange?: (score: number) => void;
  onLevelChange?: (level: number) => void;
  onLivesChange?: (lives: number) => void;
  onGameOver?: (finalScore: number) => void;
  onRestart?: () => void;
}

export class ArkanoidEngine {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private callbacks: ArkanoidEngineCallbacks;

  private blocksOriginX: number;

  private paddle: Paddle = { x: 0, y: 0, w: PADDLE_W, h: PADDLE_H };
  private ball: Ball = { x: 0, y: 0, w: BALL_SIZE, h: BALL_SIZE, vx: 0, vy: 0 };
  private blocks: Block[] = [];
  private explosions: Explosion[] = [];
  private score = 0;
  private lives = 3;
  private level = 1;
  private gameOver = false;

  private spriteImg: HTMLImageElement;
  private spriteReady = false;

  private static readonly GAME_KEYS = new Set(["ArrowLeft", "ArrowRight"]);

  private keys: Record<string, boolean> = {};
  private handleKeyDown = (e: KeyboardEvent) => {
    if (ArkanoidEngine.GAME_KEYS.has(e.code)) e.preventDefault();
    this.keys[e.code] = true;
  };
  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  constructor(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    callbacks: ArkanoidEngineCallbacks,
  ) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.callbacks = callbacks;
    this.blocksOriginX = (width - BLOCK_COLS * BLOCK_W) / 2;

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);

    this.spriteImg = new Image();
    this.spriteImg.onload = () => {
      this.spriteReady = true;
    };
    this.spriteImg.src = "/games/arkanoid/spritesheet-breakout.png";

    this.initGame();
  }

  private initPaddle() {
    this.paddle.x = (this.width - this.paddle.w) / 2;
    this.paddle.y = this.height - 40;
  }

  private initBall(speed: number) {
    this.ball.x = this.paddle.x + (this.paddle.w - this.ball.w) / 2;
    this.ball.y = this.paddle.y - this.ball.h;
    this.ball.vx = BASE_BALL_VX * speed;
    this.ball.vy = BASE_BALL_VY * speed;
  }

  private loadLevel(n: number) {
    this.level = n;
    this.callbacks.onLevelChange?.(n);
    const pattern = patternForLevel(n);
    this.blocks = pattern.map((b) => ({
      x: this.blocksOriginX + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    this.explosions = [];
    this.initBall(speedForLevel(n));
  }

  private collideAABB(block: Block): boolean {
    return (
      this.ball.x < block.x + block.w &&
      this.ball.x + this.ball.w > block.x &&
      this.ball.y < block.y + block.h &&
      this.ball.y + this.ball.h > block.y
    );
  }

  private setScore(score: number) {
    this.score = score;
    this.callbacks.onScoreChange?.(this.score);
  }

  private setLives(lives: number) {
    this.lives = lives;
    this.callbacks.onLivesChange?.(this.lives);
  }

  private setGameOver() {
    this.gameOver = true;
    this.callbacks.onGameOver?.(this.score);
  }

  private initGame() {
    this.gameOver = false;
    this.initPaddle();
    this.setScore(0);
    this.setLives(3);
    this.loadLevel(1);
  }

  update(dt: number) {
    if (this.gameOver) return;

    if (this.keys["ArrowLeft"])
      this.paddle.x = Math.max(0, this.paddle.x - PADDLE_SPEED * dt);
    if (this.keys["ArrowRight"])
      this.paddle.x = Math.min(
        this.width - this.paddle.w,
        this.paddle.x + PADDLE_SPEED * dt,
      );

    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    if (this.ball.x <= 0) {
      this.ball.x = 0;
      this.ball.vx = Math.abs(this.ball.vx);
    }
    if (this.ball.x + this.ball.w >= this.width) {
      this.ball.x = this.width - this.ball.w;
      this.ball.vx = -Math.abs(this.ball.vx);
    }
    if (this.ball.y <= 0) {
      this.ball.y = 0;
      this.ball.vy = Math.abs(this.ball.vy);
    }

    if (
      this.ball.vy > 0 &&
      this.ball.x + this.ball.w > this.paddle.x &&
      this.ball.x < this.paddle.x + this.paddle.w &&
      this.ball.y + this.ball.h >= this.paddle.y &&
      this.ball.y + this.ball.h <= this.paddle.y + this.paddle.h + 8
    ) {
      this.ball.y = this.paddle.y - this.ball.h;
      this.ball.vy = -Math.abs(this.ball.vy);
    }

    for (const block of this.blocks) {
      if (!block.alive) continue;
      if (this.collideAABB(block)) {
        block.alive = false;
        this.explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        this.setScore(this.score + pointsPerBlockForLevel(this.level));
        this.ball.vy = -this.ball.vy;
        if (this.blocks.every((b) => !b.alive)) {
          this.loadLevel(this.level + 1);
        }
        break; // un bloque por frame, igual al original
      }
    }

    for (const exp of this.explosions) exp.elapsed += dt * 1000;
    this.explosions = this.explosions.filter(
      (exp) => exp.elapsed < EXPLOSION_DURATION,
    );

    if (this.ball.y > this.height) {
      this.setLives(this.lives - 1);
      if (this.lives <= 0) {
        this.setGameOver();
      } else {
        this.initBall(speedForLevel(this.level));
      }
    }
  }

  private drawSprite(
    sprite: { sx: number; sy: number; sw: number; sh: number },
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    this.ctx.drawImage(
      this.spriteImg,
      sprite.sx,
      sprite.sy,
      sprite.sw,
      sprite.sh,
      x,
      y,
      w,
      h,
    );
  }

  private drawHUD() {
    const ctx = this.ctx;
    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`Score: ${this.score}`, 10, 10);
    ctx.textAlign = "center";
    ctx.fillText(`Nivel: ${this.level}`, this.width / 2, 10);

    if (this.spriteReady) {
      const ballSize = 16;
      const ballSpacing = 4;
      for (let i = 0; i < this.lives; i++) {
        const bx =
          this.width - 10 - (this.lives - i) * (ballSize + ballSpacing);
        this.drawSprite(SPRITES.ball, bx, 10, ballSize, ballSize);
      }
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.spriteReady) {
      for (const block of this.blocks) {
        if (block.alive)
          this.drawSprite(
            SPRITES.blocks[block.color],
            block.x,
            block.y,
            block.w,
            block.h,
          );
      }

      for (const exp of this.explosions) {
        const frameIndex = Math.min(
          Math.floor((exp.elapsed / EXPLOSION_DURATION) * 4),
          3,
        );
        this.drawSprite(
          EXPLOSION_FRAMES[exp.color][frameIndex],
          exp.x,
          exp.y,
          exp.w,
          exp.h,
        );
      }

      this.drawSprite(
        SPRITES.paddle,
        this.paddle.x,
        this.paddle.y,
        this.paddle.w,
        this.paddle.h,
      );
      this.drawSprite(
        SPRITES.ball,
        this.ball.x,
        this.ball.y,
        this.ball.w,
        this.ball.h,
      );
    }

    this.drawHUD();

    if (this.gameOver) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 40px monospace";
      ctx.fillText("GAME OVER", this.width / 2, this.height / 2);
    }
  }

  reset() {
    this.initGame();
    this.callbacks.onRestart?.();
  }

  forceGameOver() {
    if (this.gameOver) return;
    this.setGameOver();
  }

  destroy() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }
}
