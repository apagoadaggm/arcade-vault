// Motor de Snake diseñado desde cero (sin game.js de referencia).
// El motor no toca el DOM directamente: recibe ctx/width/height por parámetro
// y expone update(dt)/draw() para que el consumidor controle el loop.

import { FRUIT_POINTS, FRUIT_SPRITES } from "./sprites";

// ── Constantes de grid ──────────────────────────────────────────────────────
const GRID_COLS = 20; // columnas
const GRID_ROWS = 20; // filas
const CELL_W = 40; // 800 / 20 = 40px de ancho por celda
const CELL_H = 30; // 600 / 20 = 30px de alto por celda

// ── Velocidad ────────────────────────────────────────────────────────────────
const BASE_MOVE_INTERVAL = 0.16; // segundos por celda en nivel 1
const MOVE_INTERVAL_STEP = 0.012; // aceleración por nivel
const MIN_MOVE_INTERVAL = 0.06; // piso de velocidad
const FRUITS_PER_LEVEL = 5;

const GREEN = "#00ff88";

// ── Direcciones ──────────────────────────────────────────────────────────────
interface Vec {
  x: number;
  y: number;
}

const UP: Vec = { x: 0, y: -1 };
const DOWN: Vec = { x: 0, y: 1 };
const LEFT: Vec = { x: -1, y: 0 };
const RIGHT: Vec = { x: 1, y: 0 };

const isOpposite = (a: Vec, b: Vec) => a.x === -b.x && a.y === -b.y;

const FRUIT_KEYS = Object.keys(FRUIT_SPRITES);

// ── Motor ─────────────────────────────────────────────────────────────────────
type GameState = "playing" | "gameover";

export interface SnakeEngineCallbacks {
  onScoreChange?: (score: number) => void;
  onLevelChange?: (level: number) => void;
  onGameOver?: (finalScore: number) => void;
  onRestart?: () => void;
}

export class SnakeEngine {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private callbacks: SnakeEngineCallbacks;
  private fruitImage: HTMLImageElement;

  private static readonly GAME_KEYS = new Set([
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Space",
  ]);

  private justPressedSpace = false;
  private handleKeyDown = (e: KeyboardEvent) => {
    if (SnakeEngine.GAME_KEYS.has(e.code)) e.preventDefault();

    if (e.code === "Space") {
      this.justPressedSpace = true;
      return;
    }

    const dirByCode: Record<string, Vec> = {
      ArrowUp: UP,
      ArrowDown: DOWN,
      ArrowLeft: LEFT,
      ArrowRight: RIGHT,
    };
    const nextDir = dirByCode[e.code];
    if (!nextDir) return;
    if (isOpposite(nextDir, this.direction)) return;
    this.pendingDirection = nextDir;
  };

  private snake: Vec[] = [];
  private direction: Vec = RIGHT;
  private pendingDirection: Vec = RIGHT;
  private fruit: { x: number; y: number; key: string } | null = null;
  private moveTimer = 0;
  private moveInterval = BASE_MOVE_INTERVAL;
  private score = 0;
  private level = 1;
  private fruitsEaten = 0;
  private state: GameState = "playing";

  constructor(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    callbacks: SnakeEngineCallbacks,
    fruitImage: HTMLImageElement,
  ) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.callbacks = callbacks;
    this.fruitImage = fruitImage;

    window.addEventListener("keydown", this.handleKeyDown);

    this.initGame();
  }

  private initGame() {
    const startX = Math.floor(GRID_COLS / 2);
    const startY = Math.floor(GRID_ROWS / 2);
    this.snake = [
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
      { x: startX - 3, y: startY },
    ];
    this.direction = RIGHT;
    this.pendingDirection = RIGHT;
    this.moveTimer = 0;
    this.moveInterval = BASE_MOVE_INTERVAL;
    this.fruitsEaten = 0;
    this.state = "playing";
    this.setScore(0);
    this.setLevel(1);
    this.spawnFruit();
  }

  private occupied(x: number, y: number): boolean {
    return this.snake.some((seg) => seg.x === x && seg.y === y);
  }

  private spawnFruit() {
    const freeCells: Vec[] = [];
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        if (!this.occupied(x, y)) freeCells.push({ x, y });
      }
    }
    if (freeCells.length === 0) return;

    const cell = freeCells[Math.floor(Math.random() * freeCells.length)];
    const key = FRUIT_KEYS[Math.floor(Math.random() * FRUIT_KEYS.length)];
    this.fruit = { x: cell.x, y: cell.y, key };
  }

  private setScore(score: number) {
    this.score = score;
    this.callbacks.onScoreChange?.(this.score);
  }

  private addScore(points: number) {
    this.setScore(this.score + points);
  }

  private setLevel(level: number) {
    this.level = level;
    this.callbacks.onLevelChange?.(this.level);
  }

  private setGameOver() {
    this.state = "gameover";
    this.callbacks.onGameOver?.(this.score);
  }

  private step() {
    this.direction = this.pendingDirection;
    const head = this.snake[0];
    const newHead: Vec = {
      x: head.x + this.direction.x,
      y: head.y + this.direction.y,
    };

    if (
      newHead.x < 0 ||
      newHead.x >= GRID_COLS ||
      newHead.y < 0 ||
      newHead.y >= GRID_ROWS
    ) {
      this.setGameOver();
      return;
    }

    const ate =
      !!this.fruit && newHead.x === this.fruit.x && newHead.y === this.fruit.y;
    const bodyToCheck = ate ? this.snake : this.snake.slice(0, -1);
    if (bodyToCheck.some((seg) => seg.x === newHead.x && seg.y === newHead.y)) {
      this.setGameOver();
      return;
    }

    this.snake.unshift(newHead);
    if (ate && this.fruit) {
      this.addScore(FRUIT_POINTS[this.fruit.key] ?? 0);
      this.fruitsEaten++;
      if (this.fruitsEaten % FRUITS_PER_LEVEL === 0) {
        this.setLevel(this.level + 1);
        this.moveInterval = Math.max(
          MIN_MOVE_INTERVAL,
          BASE_MOVE_INTERVAL - MOVE_INTERVAL_STEP * (this.level - 1),
        );
      }
      this.spawnFruit();
    } else {
      this.snake.pop();
    }
  }

  update(dt: number) {
    if (this.state === "gameover") {
      if (this.justPressedSpace) this.reset();
      this.justPressedSpace = false;
      return;
    }

    this.justPressedSpace = false;

    this.moveTimer += dt;
    while (this.moveTimer >= this.moveInterval && this.state === "playing") {
      this.moveTimer -= this.moveInterval;
      this.step();
    }
  }

  private drawGrid() {
    const ctx = this.ctx;
    ctx.strokeStyle = "rgba(0, 255, 136, 0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= GRID_COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL_W, 0);
      ctx.lineTo(x * CELL_W, this.height);
      ctx.stroke();
    }
    for (let y = 0; y <= GRID_ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL_H);
      ctx.lineTo(this.width, y * CELL_H);
      ctx.stroke();
    }
  }

  private drawSnake() {
    const ctx = this.ctx;
    ctx.shadowColor = GREEN;
    ctx.fillStyle = GREEN;
    this.snake.forEach((seg, i) => {
      ctx.shadowBlur = i === 0 ? 12 : 6;
      ctx.fillRect(
        seg.x * CELL_W + 1,
        seg.y * CELL_H + 1,
        CELL_W - 2,
        CELL_H - 2,
      );
    });
    ctx.shadowBlur = 0;
  }

  private drawFruit() {
    if (!this.fruit) return;
    const rect = FRUIT_SPRITES[this.fruit.key];
    if (!rect) return;
    this.ctx.drawImage(
      this.fruitImage,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      this.fruit.x * CELL_W,
      this.fruit.y * CELL_H,
      CELL_W,
      CELL_H,
    );
  }

  private drawHUD() {
    const ctx = this.ctx;
    ctx.fillStyle = "#fff";
    ctx.font = "15px monospace";

    ctx.textAlign = "left";
    ctx.fillText(`SCORE  ${this.score}`, 14, 26);

    ctx.textAlign = "center";
    ctx.fillText(`NIVEL ${this.level}`, this.width / 2, 26);
  }

  private drawOverlay(title: string, sub: string) {
    const ctx = this.ctx;
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 46px monospace";
    ctx.fillText(title, this.width / 2, this.height / 2 - 18);
    ctx.font = "18px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillText(sub, this.width / 2, this.height / 2 + 22);
  }

  draw() {
    const ctx = this.ctx;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.width, this.height);

    this.drawGrid();
    this.drawFruit();
    this.drawSnake();
    this.drawHUD();

    if (this.state === "gameover")
      this.drawOverlay(
        "GAME OVER",
        `PUNTAJE: ${this.score}   —   ESPACIO PARA REINICIAR`,
      );
  }

  reset() {
    this.initGame();
    this.callbacks.onRestart?.();
  }

  forceGameOver() {
    this.setGameOver();
  }

  destroy() {
    window.removeEventListener("keydown", this.handleKeyDown);
  }
}
