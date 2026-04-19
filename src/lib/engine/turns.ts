import type {
  Card,
  GameAction,
  GameState,
  PlayerState,
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
// RF04 - Recrutar (mesa/display)
// =============================================================================

export function gainCardFromDisplay(state: GameState, cardId: string): GameState {
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
  return state;
}

export function gainCardFromDeck(state: GameState): GameState {
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
  return state;
}
