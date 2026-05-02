import type { Color, Role } from "@/types/game";

export const ROLE_LABEL: Record<Role, string> = {
  BOTANIST: "Botânico",
  LINGUIST: "Linguista",
  CARTOGRAPHER: "Cartógrafo",
  CURATOR: "Curador",
  PHOTOGRAPHER: "Fotógrafo",
  STUDENT: "Estudante",
};

export const ROLE_INITIAL: Record<Role, string> = {
  BOTANIST: "B",
  LINGUIST: "L",
  CARTOGRAPHER: "C",
  CURATOR: "U",
  PHOTOGRAPHER: "F",
  STUDENT: "E",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  BOTANIST:
    "Imediato: se a expedição for ≥ que a do quadro, ganhe o quadro do Botânico (+2 pts).",
  LINGUIST:
    "Imediato: avance N casas na trilha do Linguista. Cada artefato cruzado dá +1 avanço grátis em algum sítio.",
  CARTOGRAPHER:
    "Imediato: se avançar veículo nesta expedição, pode jogar 1 expedição extra.",
  CURATOR:
    "Imediato: coloca uma relíquia da cor do líder no museu (limite 1 por cor). Pontua no fim do jogo.",
  PHOTOGRAPHER:
    "Fim de temporada: esta expedição conta como tendo +1 carta para pontuação.",
  STUDENT:
    "Restrição: ao liderar, NÃO avança veículo. Há mais cartas dele no baralho.",
};

export const COLOR_LABEL: Record<Color, string> = {
  RED: "Vermelha",
  GREEN: "Verde",
  BLUE: "Azul",
  YELLOW: "Amarela",
  PINK: "Rosa",
  PURPLE: "Roxa",
};

export const COLOR_REGION: Record<Color, string> = {
  RED: "América do Norte",
  GREEN: "América do Sul",
  BLUE: "Europa",
  YELLOW: "África",
  PINK: "Ásia",
  PURPLE: "Oceania",
};

export const COLOR_HEX: Record<Color, string> = {
  RED: "var(--region-red)",
  GREEN: "var(--region-green)",
  BLUE: "var(--region-blue)",
  YELLOW: "var(--region-yellow)",
  PINK: "var(--region-pink)",
  PURPLE: "var(--region-purple)",
};
