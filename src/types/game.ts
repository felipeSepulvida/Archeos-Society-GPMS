// =============================================================================
// Tipos do Domínio - Archeos Society
// =============================================================================

/**
 * As 6 profissões base implementadas (cenário Chichén Itzá do livro).
 */
export type Role =
    | "BOTANIST"     // Botânico
    | "LINGUIST"     // Linguista
    | "CARTOGRAPHER" // Cartógrafo
    | "CURATOR"      // Curador
    | "PHOTOGRAPHER" // Fotógrafo
    | "STUDENT";     // Estudante

/**
 * As 6 cores de regiões / trilhas correspondentes aos sítios arqueológicos.
 */
export type Color =
    | "RED"     // North America - Chichén Itzá
    | "GREEN"   // South America - Machu Picchu (genérico)
    | "BLUE"    // Europe         - Tantallon Castle (genérico)
    | "YELLOW"  // Africa         - Great Zimbabwe (genérico)
    | "PINK"    // Asia           - Sigirîya (genérico)
    | "PURPLE"; // Oceania        - Rapa Nui (genérico)

/**
 * Carta de expedição. Pode ser uma carta de profissão (com cor + role)
 * ou uma carta especial de Macaco (sem profissão nem cor).
 */
export interface ProfessionCard {
  id: string;
  kind: "PROFESSION";
  role: Role;
  color: Color;
}

export interface MonkeyCard {
  id: string;
  kind: "MONKEY";
}

export type Card = ProfessionCard | MonkeyCard;

/**
 * Estado de cada jogador.
 */
export interface PlayerState {
  id: string;
  name: string;
  /** Cartas na mão (escondidas dos outros jogadores). */
  hand: Card[];
  /** Posição de seu veículo em cada sítio (chave = siteId). */
  vehiclePositions: Record<string, number>;
  /** Pontuação total acumulada. */
  score: number;
  /** Posição na trilha do Linguista (0..N). */
  linguistPosition: number;
  /** Indica se este jogador detém o quadro do Botânico no momento. */
  hasBotanistFrame: boolean;
  /** Tamanho da expedição que está atualmente sob o quadro do Botânico. */
  botanistFrameSize: number;
  /** Tokens de Curador coletados no museu (uma cor de cada vez). */
  curatorRelics: Color[];
}
