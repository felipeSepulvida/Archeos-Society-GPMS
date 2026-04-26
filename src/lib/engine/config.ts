import type { Color, Role, Site } from "@/types/game";

// =============================================================================
// Sítios arqueológicos
// =============================================================================
//
// O livro mostra trilhas com 7 espaços (0..6). Os valores de pontos e thresholds
// abaixo seguem aproximações do mapa-base padrão (lado "compass") usados em
// jogos similares da família Ethnos. Para o cenário Chichén Itzá (lado avançado
// do tabuleiro vermelho) implementaremos a regra ONGOING de "ao avançar, comprar
// até X cartas do baralho" — onde X é o número de cartas mostrado próximo ao
// threshold cruzado. Os demais sítios usam a regra padrão (somente pontos).
//
// Convenção:
//   pointsBySpace[i] = pontos no fim da temporada estando no espaço i.
//   thresholds[i]    = tamanho mínimo de expedição para avançar A PARTIR DO espaço i
//                       (i.e., para se mover de i -> i+1). thresholds[length-1] = Infinity.
// =============================================================================

const SITES: Site[] = [
  {
    id: "chichen_itza",
    name: "Chichén Itzá",
    color: "RED",
    pointsBySpace: [0, 1, 2, 3, 4, 5, 6],
    thresholds: [1, 2, 2, 3, 3, 4, Number.POSITIVE_INFINITY],
  },
  {
    id: "machu_picchu",
    name: "Machu Picchu",
    color: "GREEN",
    pointsBySpace: [0, 1, 2, 3, 4, 5, 6],
    thresholds: [1, 2, 2, 3, 4, 4, Number.POSITIVE_INFINITY],
  },
  {
    id: "tantallon_castle",
    name: "Tantallon Castle",
    color: "BLUE",
    pointsBySpace: [0, 1, 2, 3, 4, 5, 6],
    thresholds: [1, 2, 3, 3, 4, 4, Number.POSITIVE_INFINITY],
  },
  {
    id: "great_zimbabwe",
    name: "Great Zimbabwe",
    color: "YELLOW",
    pointsBySpace: [0, 1, 2, 3, 4, 5, 6],
    thresholds: [1, 2, 2, 3, 4, 5, Number.POSITIVE_INFINITY],
  },
  {
    id: "sigiriya",
    name: "Sigirîya",
    color: "PINK",
    pointsBySpace: [0, 1, 2, 3, 4, 5, 6],
    thresholds: [1, 2, 3, 3, 4, 5, Number.POSITIVE_INFINITY],
  },
  {
    id: "rapa_nui",
    name: "Rapa Nui",
    color: "PURPLE",
    pointsBySpace: [0, 1, 2, 3, 4, 5, 6],
    thresholds: [1, 2, 2, 3, 4, 4, Number.POSITIVE_INFINITY],
  },
];

export function getSites(): Site[] {
  // Cópia profunda para garantir que callers não mutem o array de referência.
  return SITES.map((s) => ({
    ...s,
    pointsBySpace: [...s.pointsBySpace],
    thresholds: [...s.thresholds],
  }));
}

// =============================================================================
// Baralho
// =============================================================================
//
// Conforme livro de regras (p. 8): "There are twice as many student cards in
// the deck as there are cards for the other roles". Para garantir variedade
// suficiente em partidas de 2-3 jogadores, usamos:
//
//   - Estudante: 2 cartas em CADA cor = 12 cartas
//   - Demais roles (5):  1 carta em CADA cor x 5 roles = 30 cartas
//   Total cartas de profissão = 42
//   Macacos = 3 (RF09)
//
// Resultado: 45 cartas no baralho, suficientes para 2 temporadas confortáveis.
// =============================================================================

const NON_STUDENT_ROLES: Role[] = [
  "BOTANIST",
  "LINGUIST",
  "CARTOGRAPHER",
  "CURATOR",
  "PHOTOGRAPHER",
];
const ALL_COLORS: Color[] = ["RED", "GREEN", "BLUE", "YELLOW", "PINK", "PURPLE"];

export function buildProfessionPool(): Array<{ role: Role; color: Color }> {
  const pool: Array<{ role: Role; color: Color }> = [];

  // 1 carta de cada non-student role em cada cor
  for (const role of NON_STUDENT_ROLES) {
    for (const color of ALL_COLORS) {
      pool.push({ role, color });
    }
  }

  // 2 cartas de Estudante em cada cor (dobro dos demais)
  for (const color of ALL_COLORS) {
    pool.push({ role: "STUDENT", color });
    pool.push({ role: "STUDENT", color });
  }

  return pool;
}

export const NUMBER_OF_MONKEYS = 3;

// =============================================================================
// Tabela de pontuação por tamanho de expedição (RF10)
// =============================================================================
//
// Conforme p. 6 do livro:
//   Tamanho:  1   2   3   4   5   6+
//   Pontos:   0   1   3   5   8  12
// =============================================================================

export const EXPEDITION_POINTS: Record<number, number> = {
  1: 0,
  2: 1,
  3: 3,
  4: 5,
  5: 8,
};

export function pointsForExpeditionSize(size: number): number {
  if (size <= 0) return 0;
  if (size >= 6) return 12;
  return EXPEDITION_POINTS[size] ?? 0;
}

// =============================================================================
// Trilha do Linguista
// =============================================================================
//
// O livro mostra uma trilha de 0..N onde alguns espaços têm "artefatos
// linguísticos" que concedem avanço gratuito em sítio à escolha. Modelamos
// uma trilha de 0..10 com artefatos nos espaços 3, 6 e 9. O jogador mais
// avançado ao fim da temporada ganha 2 pontos.
// =============================================================================

export const LINGUIST_TRACK_LENGTH = 10;
export const LINGUIST_ARTIFACT_SPACES = new Set([3, 6, 9]);
export const LINGUIST_END_OF_SEASON_BONUS = 2;
