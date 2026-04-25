import { buildProfessionPool, getSites } from "./config";
import { createRng, shuffleInPlace, type Rng } from "./rng";
import type {
  Card,
  GameState,
  PlayerState,
  ProfessionCard,
} from "@/types/game";

// =============================================================================
// IDs e baralho fresco
// =============================================================================

// Contador de IDs determinístico (independente de Date.now ou random)
function makeIdGen(prefix: string) {
  let n = 0;
  return () => `${prefix}_${++n}`;
}

/**
 * Constrói um baralho fresco de cartas de profissão (sem macacos),
 * já embaralhado.
 */
function buildFreshProfessionDeck(rng: Rng): ProfessionCard[] {
  const cardId = makeIdGen("c");
  const pool = buildProfessionPool();
  const cards: ProfessionCard[] = pool.map((spec) => ({
    id: cardId(),
    kind: "PROFESSION",
    role: spec.role,
    color: spec.color,
  }));
  shuffleInPlace(cards, rng);
  return cards;
}

/**
 * Cria o estado inicial de uma partida nova.
 * - 2 a 3 jogadores
 * - 6 sítios
 * - 1 carta inicial na mão de cada jogador
 * - Display de (numPlayers + 2) cartas viradas para cima
 * - 2 temporadas (para 2-3 jogadores)
 *
 * NOTA: Macacos ainda não inseridos no baralho — será implementado
 * na tarefa "Cartas do Macaco".
 */
export function createInitialGame(params: {
  gameId: string;
  playerNames: string[];
  seed?: number;
}): GameState {
  const { gameId, playerNames } = params;
  if (playerNames.length < 2 || playerNames.length > 3) {
    throw new Error("A partida deve ter 2 ou 3 jogadores.");
  }
  const seed = params.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = createRng(seed);

  const sites = getSites();

  const players: PlayerState[] = playerNames.map((name, idx) => {
    const vehiclePositions: Record<string, number> = {};
    for (const s of sites) vehiclePositions[s.id] = 0;

    return {
      id: `p${idx + 1}`,
      name,
      hand: [],
      vehiclePositions,
      playedExpeditions: [],
      score: 0,
      linguistPosition: 0,
      hasBotanistFrame: false,
      botanistFrameSize: 0,
      curatorRelics: [],
      pendingDisplayReturn: [],
    };
  });

  const fresh = buildFreshProfessionDeck(rng);
  // Distribui 1 carta para cada jogador (mão inicial)
  for (const p of players) {
    const drawn = fresh.pop();
    if (!drawn) throw new Error("Baralho vazio na distribuição inicial");
    p.hand.push(drawn);
  }
  // Cria display de (numPlayers + 2) cartas
  const displaySize = players.length + 2;
  const display: Card[] = [];
  for (let i = 0; i < displaySize; i++) {
    const c = fresh.pop();
    if (!c) throw new Error("Baralho insuficiente para o display inicial");
    display.push(c);
  }

  const deck: Card[] = [...fresh];

  const state: GameState = {
    id: gameId,
    createdAt: new Date().toISOString(),
    phase: "PLAYING",
    players,
    currentPlayerIndex: 0,
    season: 1,
    totalSeasons: 2,
    deck,
    display,
    monkeysRevealed: 0,
    sites,
    log: [
      {
        at: new Date().toISOString(),
        message: `Partida iniciada com ${players.length} jogadores. Temporada 1.`,
      },
    ],
    turnPhase: "AWAITING_ACTION",
  };

  return state;
}

/**
 * Inicia uma nova temporada. Devolve baralho refeito, novo display e mãos
 * zeradas com 1 carta para cada jogador.
 *
 * Importante: veículos e pontuações NÃO são resetados; expedições jogadas
 * são removidas (cartas voltam ao baralho).
 *
 * NOTA: Macacos ainda não são reinseridos no baralho — será tratado pela
 * tarefa "Cartas do Macaco".
 */
export function startNewSeason(state: GameState, seed?: number): GameState {
  const rng = createRng(seed ?? Math.floor(Math.random() * 2 ** 31));

  const allProfCards: ProfessionCard[] = [];
  for (const p of state.players) {
    for (const exp of p.playedExpeditions) {
      const cards: Card[] = [exp.leader, ...exp.followers];
      for (const c of cards) {
        if (c.kind === "PROFESSION") allProfCards.push(c);
      }
    }
    for (const c of p.hand) {
      if (c.kind === "PROFESSION") allProfCards.push(c);
    }
    for (const c of p.pendingDisplayReturn) {
      if (c.kind === "PROFESSION") allProfCards.push(c);
    }
    p.hand = [];
    p.pendingDisplayReturn = [];
    p.playedExpeditions = [];
    p.hasBotanistFrame = false;
    p.botanistFrameSize = 0;
  }
  for (const c of state.display) {
    if (c.kind === "PROFESSION") allProfCards.push(c);
  }
  for (const c of state.deck) {
    if (c.kind === "PROFESSION") allProfCards.push(c);
  }

  shuffleInPlace(allProfCards, rng);

  for (const p of state.players) {
    const drawn = allProfCards.pop();
    if (!drawn) throw new Error("Baralho vazio ao iniciar nova temporada");
    p.hand.push(drawn);
  }

  const displaySize = state.players.length + 2;
  const display: Card[] = [];
  for (let i = 0; i < displaySize; i++) {
    const c = allProfCards.pop();
    if (!c) throw new Error("Baralho insuficiente ao montar display");
    display.push(c);
  }

  state.deck = [...allProfCards];
  state.display = display;
  state.monkeysRevealed = 0;
  state.season += 1;
  state.phase = "PLAYING";
  state.turnPhase = "AWAITING_ACTION";
  state.log.push({
    at: new Date().toISOString(),
    message: `Temporada ${state.season} iniciada.`,
  });

  return state;
}
