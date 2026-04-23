import { validateExpedition } from "./validation";
import type {
  Card,
  GameAction,
  GameState,
  PlayedExpedition,
  PlayerState,
  ProfessionCard,
} from "@/types/game";

const MAX_HAND_SIZE = 10;

// =============================================================================
// Helpers
// =============================================================================

function currentPlayer(state: GameState): PlayerState {
  return state.players[state.currentPlayerIndex];
}

function logEvent(state: GameState, message: string, playerId?: string) {
  state.log.push({
    at: new Date().toISOString(),
    message,
    playerId,
  });
}

function findCardIndex(cards: Card[], cardId: string): number {
  return cards.findIndex((c) => c.id === cardId);
}

// =============================================================================
// Aplicação de ações
// =============================================================================

export function applyAction(
    state: GameState,
    playerId: string,
    action: GameAction,
): GameState {
  if (state.phase === "GAME_END") {
    throw new Error("A partida já terminou.");
  }
  if (state.phase !== "PLAYING") {
    throw new Error(`Ação inválida na fase ${state.phase}.`);
  }
  const player = currentPlayer(state);
  if (player.id !== playerId) {
    throw new Error(`Não é o turno de ${playerId}. É a vez de ${player.id}.`);
  }

  switch (action.type) {
    case "GAIN_FROM_DISPLAY":
      return doGainFromDisplay(state, action.cardId);
    case "GAIN_FROM_DECK":
      return doGainFromDeck(state);
    case "PLAY_EXPEDITION":
      return doPlayExpedition(state, action);
    case "SKIP_CARTOGRAPHER_BONUS":
      throw new Error("Bônus do Cartógrafo ainda não implementado.");
  }
}

// =============================================================================
// RF04 - Recrutar
// =============================================================================

function doGainFromDisplay(state: GameState, cardId: string): GameState {
  if (state.turnPhase !== "AWAITING_ACTION") {
    throw new Error("Não é momento de recrutar uma carta.");
  }
  const player = currentPlayer(state);
  if (player.hand.length >= MAX_HAND_SIZE) {
    throw new Error(
        "Mão cheia (10 cartas). Você deve lançar uma expedição.",
    );
  }
  const idx = findCardIndex(state.display, cardId);
  if (idx < 0) {
    throw new Error("Carta não encontrada na fileira.");
  }
  const [card] = state.display.splice(idx, 1);
  player.hand.push(card);
  logEvent(
      state,
      `${player.name} recrutou uma carta da fileira.`,
      player.id,
  );
  return endTurn(state);
}

function doGainFromDeck(state: GameState): GameState {
  if (state.turnPhase !== "AWAITING_ACTION") {
    throw new Error("Não é momento de comprar uma carta.");
  }
  const player = currentPlayer(state);
  if (player.hand.length >= MAX_HAND_SIZE) {
    throw new Error(
        "Mão cheia (10 cartas). Você deve lançar uma expedição.",
    );
  }
  const drawn = state.deck.pop();
  if (!drawn) {
    throw new Error("Baralho vazio.");
  }
  player.hand.push(drawn);
  logEvent(
      state,
      `${player.name} comprou uma carta do baralho.`,
      player.id,
  );

  return endTurn(state);
}

// =============================================================================
// RF05/RF06 - Lançar expedição
// =============================================================================

function doPlayExpedition(
    state: GameState,
    action: Extract<GameAction, { type: "PLAY_EXPEDITION" }>,
): GameState {
  if (state.turnPhase !== "AWAITING_ACTION") {
    throw new Error("Não é momento de lançar uma expedição.");
  }

  const player = currentPlayer(state);

  // Localiza líder na mão
  const leaderIdx = findCardIndex(player.hand, action.leaderCardId);
  if (leaderIdx < 0) {
    throw new Error("Carta líder não está na mão.");
  }
  const leader = player.hand[leaderIdx];
  if (leader.kind !== "PROFESSION") {
    throw new Error("Macacos não podem ser líderes.");
  }

  // Localiza seguidores
  const followers: ProfessionCard[] = [];
  const followerIdxs = new Set<number>();
  for (const fid of action.followerCardIds) {
    if (fid === action.leaderCardId) {
      throw new Error("Líder não pode estar duplicado nos seguidores.");
    }
    const idx = findCardIndex(player.hand, fid);
    if (idx < 0) {
      throw new Error(`Seguidor ${fid} não está na mão.`);
    }
    if (followerIdxs.has(idx)) {
      throw new Error("Seguidor duplicado.");
    }
    followerIdxs.add(idx);
    const c = player.hand[idx];
    if (c.kind !== "PROFESSION") {
      throw new Error("Macacos não podem entrar em expedições.");
    }
    followers.push(c);
  }

  // Valida regras de compatibilidade
  const validation = validateExpedition({
    leader,
    followers,
    bond: action.bond,
  });
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  // Remove cartas usadas (líder + seguidores) da mão
  const usedIds = new Set<string>([
    leader.id,
    ...followers.map((f) => f.id),
  ]);
  const remaining = player.hand.filter((c) => !usedIds.has(c.id));
  player.hand = [];

  const expedition: PlayedExpedition = {
    id: `exp_${player.id}_${player.playedExpeditions.length + 1}_s${state.season}`,
    leader,
    followers,
    bond: action.bond,
    season: state.season,
  };
  player.playedExpeditions.push(expedition);

  const expeditionSize = 1 + followers.length;
  logEvent(
      state,
      `${player.name} lançou expedição (líder: ${leader.role}/${leader.color}, tamanho ${expeditionSize}).`,
      player.id,
  );

  // Devolve cartas restantes ao display (RF06)
  state.display.push(...remaining);

  return endTurn(state);
}

// =============================================================================
// Encerramento do turno
// =============================================================================

function endTurn(state: GameState): GameState {
  state.turnPhase = "AWAITING_ACTION";
  state.currentPlayerIndex =
      (state.currentPlayerIndex + 1) % state.players.length;
  return state;
}
