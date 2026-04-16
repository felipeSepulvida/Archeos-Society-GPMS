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
 * Sítio arqueológico (trilha). Cada um tem 7 espaços (0..6),
 * com pontos por espaço e threshold de tamanho de expedição
 * necessário para avançar a partir do espaço atual.
 */
export interface Site {
  id: string;
  name: string;
  color: Color;
  /** Pontos ganhos no fim da temporada por estar em cada espaço (índice = espaço). */
  pointsBySpace: number[];
  /** Threshold mínimo de tamanho de expedição para avançar a PARTIR do espaço i. */
  thresholds: number[];
}

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
  /** Expedições já lançadas nesta partida (conservadas para tie-break). */
  playedExpeditions: PlayedExpedition[];
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
  /**
   * Buffer de cartas que serão devolvidas ao display ao final do turno.
   * Usado pelo Cartógrafo: quando ele lidera uma expedição e avança veículo,
   * recebe direito a uma 2ª expedição ANTES de devolver a mão. As cartas
   * não usadas na 1ª expedição ficam aqui temporariamente e:
   *   - permanecem disponíveis para compor a 2ª expedição (se o jogador
   *     optar pelo bônus), retornando à `hand` antes da 2ª expedição;
   *   - são despejadas no display ao final do turno.
   * Em todas as outras situações este buffer fica vazio.
   */
  pendingDisplayReturn: Card[];
}

/**
 * Uma expedição já lançada e mantida na frente do jogador.
 */
export interface PlayedExpedition {
  /** Identificador único da expedição (para UI). */
  id: string;
  /** Carta líder. */
  leader: ProfessionCard;
  /** Cartas adicionais (excluindo o líder). */
  followers: Card[]; // pode incluir Mercenários em outras expansões; aqui só PROFESSION
  /** Traço escolhido como elo da expedição (cor ou role). */
  bond: { type: "COLOR"; color: Color } | { type: "ROLE"; role: Role };
  /** Em qual temporada foi lançada (1, 2, ...). */
  season: number;
}

/**
 * Em qual fase do turno o sistema está. Permite habilidades que
 * concedem expedições extras (Cartógrafo) ou exigem decisões adicionais.
 */
export type TurnPhase =
    | "AWAITING_ACTION"           // jogador deve escolher GAIN_CARD ou PLAY_EXPEDITION
    | "BOTANIST_RESOLUTION"       // [reservado] resolução adicional (não usada na v1)
    | "CARTOGRAPHER_BONUS"        // jogador pode jogar 1 expedição extra (opcional)
    | "TURN_END";                 // turno encerrado, passar para o próximo jogador

/** Fase global da partida. */
export type GamePhase =
    | "SETUP"
    | "PLAYING"
    | "SEASON_END"
    | "GAME_END";

/**
 * Estado completo da partida. Toda a lógica do motor opera sobre este objeto.
 */
export interface GameState {
  id: string;
  createdAt: string;
  phase: GamePhase;
  players: PlayerState[];
  currentPlayerIndex: number;
  /** Temporada atual (1 ou 2 para 2-3 jogadores). */
  season: number;
  /** Total de temporadas a jogar (2 para 2-3 jogadores). */
  totalSeasons: number;
  /** Baralho (topo = última posição do array). */
  deck: Card[];
  /** Fileira (cartas viradas para cima disponíveis para recrutar). */
  display: Card[];
  /** Quantos macacos já foram revelados nesta temporada. */
  monkeysRevealed: number;
  /** Sítios arqueológicos da partida. */
  sites: Site[];
  /** Log de eventos (para auditoria e UI). */
  log: GameLogEntry[];
  /** Fase do turno corrente. */
  turnPhase: TurnPhase;
  /** Vencedor (apenas quando phase === "GAME_END"). */
  winnerId?: string;
}

/** Entrada do log para feedback ao usuário. */
export interface GameLogEntry {
  at: string;
  message: string;
  /** Identificador do jogador relacionado, se aplicável. */
  playerId?: string;
}

// =============================================================================
// Inputs de ações (API REST)
// =============================================================================

export type GameAction =
    | { type: "GAIN_FROM_DISPLAY"; cardId: string }
    | { type: "GAIN_FROM_DECK" }
    | {
  type: "PLAY_EXPEDITION";
  leaderCardId: string;
  followerCardIds: string[];
  bond: { type: "COLOR"; color: Color } | { type: "ROLE"; role: Role };
  /** Para o Cartógrafo: deseja avançar veículo no sítio da cor do líder? */
  advanceVehicle?: boolean;
  /** Para o Curador: deseja coletar relíquia? */
  useCuratorEffect?: boolean;
}
    | { type: "SKIP_CARTOGRAPHER_BONUS" };

export interface CreateGameInput {
  playerNames: string[]; // 2 ou 3
}