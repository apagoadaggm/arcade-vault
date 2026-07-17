// Puerto a TypeScript de references/started-games/03-tetris/game.js.
// El motor no toca el DOM directamente: recibe ctx/width/height por parámetro
// y expone update(dt)/draw() para que el consumidor controle el loop.

const COLS = 10;
const ROWS = 20;

// Índice 0 nunca se usa (los tipos de pieza van de 1 a 8); se deja vacío para
// que el índice del array coincida con `type`.
const COLORS: (string | null)[] = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#90caf9", // J - pale blue
  "#ffb74d", // L - orange
  "#9e9e9e", // N - tuerca (gris metálico)
];

const PIECES: number[][][] = [
  [],
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

type Board = number[][];

interface Piece {
  type: number; // 1–8
  shape: number[][];
  x: number;
  y: number;
}

export interface TetrisEngineCallbacks {
  onScoreChange?: (score: number) => void;
  onLevelChange?: (level: number) => void;
  onLivesChange?: (lives: number) => void; // se emite una sola vez con valor 1
  onGameOver?: (finalScore: number) => void;
  onRestart?: () => void;
}

// Layout del canvas 800x600: tablero centrado + panel lateral a la derecha,
// ambos dibujados dentro del mismo canvas (sin segundo <canvas> para next).
const BLOCK = 24;
const BOARD_W = COLS * BLOCK; // 240
const BOARD_H = ROWS * BLOCK; // 480
const PANEL_W = 220;
const GAP = 40;
const CONTENT_W = BOARD_W + GAP + PANEL_W;

export class TetrisEngine {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private callbacks: TetrisEngineCallbacks;

  private boardX: number;
  private boardY: number;
  private panelX: number;

  private board: Board = [];
  private current!: Piece;
  private next!: Piece;
  private score = 0;
  private lines = 0;
  private level = 1;
  private dropInterval = 1000;
  private dropAccum = 0;
  private gameOver = false;

  private handleKeyDown = (e: KeyboardEvent) => {
    if (this.gameOver) return;
    switch (e.code) {
      case "ArrowLeft":
        if (
          !this.collide(this.current.shape, this.current.x - 1, this.current.y)
        )
          this.current.x--;
        break;
      case "ArrowRight":
        if (
          !this.collide(this.current.shape, this.current.x + 1, this.current.y)
        )
          this.current.x++;
        break;
      case "ArrowDown":
        this.softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        this.tryRotate();
        break;
      case "Space":
        e.preventDefault();
        this.hardDrop();
        break;
    }
  };

  constructor(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    callbacks: TetrisEngineCallbacks,
  ) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.callbacks = callbacks;

    this.boardX = Math.round((width - CONTENT_W) / 2);
    this.boardY = Math.round((height - BOARD_H) / 2);
    this.panelX = this.boardX + BOARD_W + GAP;

    window.addEventListener("keydown", this.handleKeyDown);

    this.initGame();
  }

  private createBoard(): Board {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }

  private randomPiece(): Piece {
    const type = Math.floor(Math.random() * 8) + 1;
    const shape = PIECES[type].map((row) => [...row]);
    return {
      type,
      shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
  }

  private collide(shape: number[][], ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && this.board[ny][nx]) return true;
      }
    }
    return false;
  }

  private rotateCW(shape: number[][]): number[][] {
    const rows = shape.length;
    const cols = shape[0].length;
    const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
    return result;
  }

  private tryRotate() {
    const rotated = this.rotateCW(this.current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!this.collide(rotated, this.current.x + kick, this.current.y)) {
        this.current.shape = rotated;
        this.current.x += kick;
        return;
      }
    }
  }

  private merge() {
    for (let r = 0; r < this.current.shape.length; r++)
      for (let c = 0; c < this.current.shape[r].length; c++)
        if (this.current.shape[r][c])
          this.board[this.current.y + r][this.current.x + c] =
            this.current.shape[r][c];
  }

  private clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r].every((v) => v !== 0)) {
        this.board.splice(r, 1);
        this.board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      this.lines += cleared;
      this.setScore(this.score + (LINE_SCORES[cleared] || 0) * this.level);
      this.setLevel(Math.floor(this.lines / 10) + 1);
      this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 90);
    }
  }

  private ghostY(): number {
    let gy = this.current.y;
    while (!this.collide(this.current.shape, this.current.x, gy + 1)) gy++;
    return gy;
  }

  private hardDrop() {
    const gy = this.ghostY();
    this.setScore(this.score + (gy - this.current.y) * 2);
    this.current.y = gy;
    this.lockPiece();
  }

  private softDrop() {
    if (!this.collide(this.current.shape, this.current.x, this.current.y + 1)) {
      this.current.y++;
      this.setScore(this.score + 1);
    } else {
      this.lockPiece();
    }
  }

  private lockPiece() {
    this.merge();
    this.clearLines();
    this.spawn();
  }

  private spawn() {
    this.current = this.next;
    this.next = this.randomPiece();
    if (this.collide(this.current.shape, this.current.x, this.current.y)) {
      this.setGameOver();
    }
  }

  private setScore(score: number) {
    this.score = score;
    this.callbacks.onScoreChange?.(this.score);
  }

  private setLevel(level: number) {
    this.level = level;
    this.callbacks.onLevelChange?.(this.level);
  }

  private setGameOver() {
    this.gameOver = true;
    this.callbacks.onGameOver?.(this.score);
  }

  private initGame() {
    this.board = this.createBoard();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.dropInterval = 1000;
    this.dropAccum = 0;
    this.gameOver = false;
    this.next = this.randomPiece();
    this.spawn();
    this.callbacks.onScoreChange?.(this.score);
    this.callbacks.onLevelChange?.(this.level);
    this.callbacks.onLivesChange?.(1);
  }

  update(dt: number) {
    if (this.gameOver) return;
    this.dropAccum += dt * 1000;
    if (this.dropAccum >= this.dropInterval) {
      this.dropAccum = 0;
      if (
        !this.collide(this.current.shape, this.current.x, this.current.y + 1)
      ) {
        this.current.y++;
      } else {
        this.lockPiece();
      }
    }
  }

  private drawBlock(
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    alpha = 1,
  ) {
    if (!colorIndex) return;
    const color = COLORS[colorIndex];
    if (!color) return;
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    ctx.globalAlpha = 1;
  }

  private drawGrid() {
    const ctx = this.ctx;
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, BOARD_H);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(BOARD_W, r * BLOCK);
      ctx.stroke();
    }
  }

  private drawBoard() {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.boardX, this.boardY);

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
    this.drawGrid();

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        this.drawBlock(c, r, this.board[r][c], BLOCK);

    const gy = this.ghostY();
    for (let r = 0; r < this.current.shape.length; r++)
      for (let c = 0; c < this.current.shape[r].length; c++)
        if (this.current.shape[r][c])
          this.drawBlock(
            this.current.x + c,
            gy + r,
            this.current.shape[r][c],
            BLOCK,
            0.2,
          );

    for (let r = 0; r < this.current.shape.length; r++)
      for (let c = 0; c < this.current.shape[r].length; c++)
        this.drawBlock(
          this.current.x + c,
          this.current.y + r,
          this.current.shape[r][c],
          BLOCK,
        );

    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, BOARD_W, BOARD_H);

    ctx.restore();
  }

  private drawNextPreview(x: number, y: number, size: number) {
    const ctx = this.ctx;
    const shape = this.next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    ctx.save();
    ctx.translate(x, y);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        this.drawBlock(offX + c, offY + r, shape[r][c], size);
    ctx.restore();
  }

  private drawPanelStat(x: number, y: number, label: string, value: string) {
    const ctx = this.ctx;
    ctx.textAlign = "left";
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText(label, x, y + 14);
    ctx.font = "bold 26px monospace";
    ctx.fillStyle = "#fff";
    ctx.fillText(value, x, y + 44);
  }

  private drawPanel() {
    const ctx = this.ctx;
    const x = this.panelX;
    let y = this.boardY;

    this.drawPanelStat(x, y, "SCORE", this.score.toLocaleString());
    y += 80;
    this.drawPanelStat(x, y, "LINES", `${this.lines}`);
    y += 80;
    this.drawPanelStat(x, y, "LEVEL", `${this.level}`);
    y += 80;

    ctx.textAlign = "left";
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("NEXT", x, y + 14);

    const previewSize = 24;
    const boxSize = previewSize * 4;
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y + 24, boxSize, boxSize);
    this.drawNextPreview(x, y + 24, previewSize);
  }

  draw() {
    const ctx = this.ctx;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, this.width, this.height);

    this.drawBoard();
    this.drawPanel();

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
  }
}
