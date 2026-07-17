export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER";
  cover: string;
  color: "cyan" | "magenta" | "yellow" | "green";
}

export const GAMES: Game[] = [
  {
    id: "bloque-buster",
    title: "BLOQUE BUSTER",
    short: "Rebota la pelota y destruye muros de neón.",
    long: "Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cada nivel reorganiza la grilla en patrones imposibles. ¿Hasta dónde llegará tu racha?",
    cat: "ARCADE",
    cover: "cover-bricks",
    color: "cyan",
  },
  {
    id: "caida",
    title: "CAÍDA",
    short: "Encaja las piezas antes de que el techo te aplaste.",
    long: "Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.",
    cat: "PUZZLE",
    cover: "cover-tetro",
    color: "magenta",
  },
  {
    id: "serpentina",
    title: "SERPENTINA",
    short: "Crece sin morder tu propia cola.",
    long: "Una serpiente de luz recorre la grilla buscando núcleos magenta. Cada bocado la alarga y la hace más veloz. Un movimiento en falso y se devora a sí misma.",
    cat: "ARCADE",
    cover: "cover-snake",
    color: "green",
  },
  {
    id: "gloton",
    title: "GLOTÓN",
    short: "Devora puntos y escapa de los fantasmas.",
    long: "Un círculo glotón patrulla un laberinto coleccionando puntos luminosos. Cuatro espectros lo persiguen, pero cada cierto tiempo aparece una píldora que invierte los papeles.",
    cat: "ARCADE",
    cover: "cover-glot",
    color: "yellow",
  },
  {
    id: "invasores",
    title: "INVASORES",
    short: "Defiende el planeta de filas alienígenas.",
    long: "Olas de pixeles hostiles descienden formación tras formación. Mueve tu cañón en horizontal y abre fuego con precisión, antes de que toquen la superficie.",
    cat: "SHOOTER",
    cover: "cover-invaders",
    color: "green",
  },
  {
    id: "rocas",
    title: "ROCAS",
    short: "Pulveriza asteroides en gravedad cero.",
    long: "Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Cuidado con los OVNIs en el horizonte.",
    cat: "SHOOTER",
    cover: "cover-rocas",
    color: "yellow",
  },
  {
    id: "asteroides",
    title: "ASTEROIDES",
    short: "Sobrevive al campo de rocas y suma puntos.",
    long: "Pilotas una nave solitaria atrapada en un campo de asteroides sin fin. Dispara para fragmentar rocas gigantes en pedazos cada vez más pequeños, recoge el power-up de disparo triple y sobrevive ronda tras ronda mientras el campo se vuelve más denso.",
    cat: "SHOOTER",
    cover: "cover-asteroides",
    color: "cyan",
  },
  {
    id: "tetris",
    title: "TETRIS",
    short: "Encaja las piezas antes de que la torre te sepulte.",
    long: "Piezas geométricas caen sin descanso desde la oscuridad. Rota, desliza y encaja cada tetrominó para completar líneas antes de que el tablero se desborde. Cada 10 líneas el ritmo se acelera sin piedad.",
    cat: "PUZZLE",
    cover: "cover-tetris",
    color: "yellow",
  },
  {
    id: "arkanoid",
    title: "ARKANOID",
    short: "Rebota la pelota y no dejes que ningún bloque sobreviva.",
    long: "Controla una paleta de neón y desvía una pelota implacable contra murallas de bloques cromáticos. Cada impacto suma puntos; cada nivel superado acelera la pelota y reordena el patrón. Los cinco patrones se repiten en un ciclo infinito cada vez más veloz — resiste todo lo que puedas antes de perder tus tres vidas.",
    cat: "ARCADE",
    cover: "cover-arkanoid",
    color: "magenta",
  },
  {
    id: "snake",
    title: "SNAKE",
    short: "Come frutas, crece y no choques contigo mismo.",
    long: "Guía a la serpiente por una cuadrícula de 20×20 recogiendo las frutas más variadas del arcade. Cada fruta suma puntos según lo rara que sea, y cada 5 frutas la velocidad aumenta un poco más. Un solo error contra el borde o tu propia cola termina la partida.",
    cat: "ARCADE",
    cover: "cover-snake-real",
    color: "green",
  },
];

export const CATS: ("TODOS" | Game["cat"])[] = [
  "TODOS",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
];
