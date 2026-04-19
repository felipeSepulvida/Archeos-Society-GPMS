import type { Color, Role, Site } from "@/types/game";

// =============================================================================
// Sítios arqueológicos
// =============================================================================
//
// O livro mostra trilhas com 7 espaços (0..6). Os valores de pontos e thresholds
// abaixo seguem aproximações do mapa-base padrão (lado "compass") usados em
// jogos similares da família Ethnos.
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

  for (const role of NON_STUDENT_ROLES) {
    for (const color of ALL_COLORS) {
      pool.push({ role, color });
    }
  }

  for (const color of ALL_COLORS) {
    pool.push({ role: "STUDENT", color });
    pool.push({ role: "STUDENT", color });
  }

  return pool;
}

export const NUMBER_OF_MONKEYS = 3;
