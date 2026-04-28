import {
  LINGUIST_ARTIFACT_SPACES,
  LINGUIST_END_OF_SEASON_BONUS,
  LINGUIST_TRACK_LENGTH,
  pointsForExpeditionSize,
} from "./config";
import { startNewSeason } from "./setup";
import { validateExpedition } from "./validation";
import type {
  Card,
  Color,
  GameAction,
  GameState,
  PlayedExpedition,
  PlayerState,
  ProfessionCard,
  Role,
  Site,
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

/**
 * Compra a próxima carta do topo do baralho. Se for um Macaco, revela-o,
 * incrementa o contador e tenta de novo. Retorna a carta de profissão
 * comprada, ou `null` se a temporada terminou (3 macacos revelados).
 *
 * Atenção: ao revelar o 3º macaco, a temporada termina IMEDIATAMENTE.
 */
function drawFromDeckHandlingMonkeys(state: GameState): ProfessionCard | null {
  while (state.deck.length > 0) {
    const card = state.deck.pop()!; // topo do baralho = final do array
    if (card.kind === "MONKEY") {
      state.monkeysRevealed += 1;
      logEvent(
          state,
          `Macaco revelado (${state.monkeysRevealed}/3).`,
      );
      if (state.monkeysRevealed >= 3) {
        return null;
      }
      continue;
    }
    return card;
  }
  return null;
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
  const drawn = drawFromDeckHandlingMonkeys(state);
  if (drawn === null) {
    // 3º macaco saiu durante esta compra → fim imediato da temporada.
    logEvent(
        state,
        `${player.name} revelou o 3º macaco. Fim da temporada.`,
        player.id,
    );
    return finalizeSeason(state, player.id);
  }
  player.hand.push(drawn);
  logEvent(
      state,
      `${player.name} comprou uma carta do baralho.`,
      player.id,
  );

  // Regra do livro: "After drawing a card from the deck, draw 1 extra card
  // if the display is empty." (com limite de 10 na mão)
  if (state.display.length === 0 && player.hand.length < MAX_HAND_SIZE) {
    const extra = drawFromDeckHandlingMonkeys(state);
    if (extra === null) {
      logEvent(
          state,
          `${player.name} revelou o 3º macaco. Fim da temporada.`,
          player.id,
      );
      return finalizeSeason(state, player.id);
    }
    player.hand.push(extra);
    logEvent(
        state,
        `${player.name} comprou uma carta extra (fileira vazia).`,
        player.id,
    );
  }

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

  // RF07 - Avanço em trilha (cor do líder)
  //  - Estudante: NÃO pode avançar veículos (regra mandatória).
  if (leader.role !== "STUDENT") {
    const advanced = tryAdvanceVehicleAtSiteOfColor(
        state,
        player,
        leader.color,
        expeditionSize,
    );
    if (advanced) {
      logEvent(
          state,
          `${player.name} avançou veículo na trilha ${leader.color}.`,
          player.id,
      );
    }
  }

  // RF08 - Habilidade da profissão líder
  applyLeaderRoleEffect(state, player, leader, expeditionSize);

  // Devolve cartas restantes ao display (RF06)
  state.display.push(...remaining);

  return endTurn(state);
}

// =============================================================================
// RF08 - Efeitos de profissões líder (imediatos)
// =============================================================================

function applyLeaderRoleEffect(
    state: GameState,
    player: PlayerState,
    leader: ProfessionCard,
    expeditionSize: number,
) {
  switch (leader.role) {
    case "BOTANIST":
      applyBotanistEffect(state, player, expeditionSize);
      break;
    case "LINGUIST":
      applyLinguistEffect(state, player, expeditionSize);
      break;
    case "PHOTOGRAPHER":
      // Efeito é resolvido apenas no FIM da temporada (conta +1 carta).
      break;
    case "STUDENT":
      // Restrição já aplicada (não avança trilha).
      break;
    default:
      // Curador e Cartógrafo serão implementados em commits seguintes.
      break;
  }
}

/**
 * BOTANIST (livro p. 8 — IMMEDIATELY):
 * Compara tamanho desta expedição com a expedição que detém o quadro.
 * Se >= , ganha 2 pontos e fica com o quadro. Pode tomar de si mesmo.
 */
function applyBotanistEffect(
    state: GameState,
    player: PlayerState,
    expeditionSize: number,
) {
  const currentHolder = state.players.find((p) => p.hasBotanistFrame);
  const heldSize = currentHolder?.botanistFrameSize ?? 0;
  if (expeditionSize >= heldSize) {
    if (currentHolder && currentHolder.id !== player.id) {
      currentHolder.hasBotanistFrame = false;
      currentHolder.botanistFrameSize = 0;
    }
    player.hasBotanistFrame = true;
    player.botanistFrameSize = expeditionSize;
    player.score += 2;
    logEvent(
        state,
        `${player.name} pega o quadro do Botânico (+2 pts).`,
        player.id,
    );
  }
}

/**
 * LINGUIST (livro p. 8 — IMMEDIATELY):
 * Avança N espaços na trilha do Linguista (N = tamanho da expedição).
 * Para cada espaço com artefato em que parar OU passar, avança 1 veículo
 * em qualquer sítio (escolha automática: o sítio com menor pontuação atual
 * onde ele AINDA pode avançar; se nenhum, ignora).
 */
function applyLinguistEffect(
    state: GameState,
    player: PlayerState,
    expeditionSize: number,
) {
  const start = player.linguistPosition;
  const end = Math.min(start + expeditionSize, LINGUIST_TRACK_LENGTH);
  let artifactsCrossed = 0;
  for (let pos = start + 1; pos <= end; pos++) {
    if (LINGUIST_ARTIFACT_SPACES.has(pos)) artifactsCrossed += 1;
  }
  player.linguistPosition = end;
  logEvent(
      state,
      `${player.name} avançou para a posição ${end} na trilha do Linguista.`,
      player.id,
  );

  // Para cada artefato cruzado, escolhe um sítio para avançar.
  for (let i = 0; i < artifactsCrossed; i++) {
    const candidate = chooseSiteForLinguistAdvance(state, player);
    if (!candidate) break;
    const cur = player.vehiclePositions[candidate.id] ?? 0;
    if (cur < candidate.pointsBySpace.length - 1) {
      player.vehiclePositions[candidate.id] = cur + 1;
      logEvent(
          state,
          `${player.name} avançou veículo em ${candidate.name} (artefato).`,
          player.id,
      );
    }
  }
}

function chooseSiteForLinguistAdvance(
    state: GameState,
    player: PlayerState,
): Site | null {
  let best: Site | null = null;
  let bestScore = Infinity;
  for (const s of state.sites) {
    const cur = player.vehiclePositions[s.id] ?? 0;
    if (cur >= s.pointsBySpace.length - 1) continue;
    if (cur < bestScore) {
      bestScore = cur;
      best = s;
    }
  }
  return best;
}

// =============================================================================
// RF07 - Progressão nos sítios arqueológicos
// =============================================================================

function tryAdvanceVehicleAtSiteOfColor(
    state: GameState,
    player: PlayerState,
    color: Color,
    expeditionSize: number,
): boolean {
  const site = state.sites.find((s) => s.color === color);
  if (!site) return false;
  return tryAdvanceVehicleAtSite(state, player, site, expeditionSize);
}

function tryAdvanceVehicleAtSite(
    state: GameState,
    player: PlayerState,
    site: Site,
    expeditionSize: number,
): boolean {
  const current = player.vehiclePositions[site.id] ?? 0;
  const maxIndex = site.pointsBySpace.length - 1;
  if (current >= maxIndex) return false;
  const required = site.thresholds[current];
  if (expeditionSize >= required) {
    player.vehiclePositions[site.id] = current + 1;
    return true;
  }
  return false;
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

// =============================================================================
// Fim de temporada
// =============================================================================

/**
 * Finaliza a temporada atual. `triggererId` é o jogador que comprou o 3º macaco
 * — ele se torna o primeiro jogador da próxima temporada (se houver).
 *
 * Estrutura básica: limpa mãos/display, computa pontos por sítios e por
 * expedições, depois decide se inicia nova temporada ou encerra o jogo.
 * Os efeitos de habilidades de fim-de-temporada (Botânico, Linguista,
 * Fotógrafo) e o bônus do Curador serão integrados em tarefas posteriores.
 */
export function finalizeSeason(state: GameState, triggererId: string): GameState {
  state.phase = "SEASON_END";

  for (const p of state.players) p.hand = [];
  state.display = [];

  // Efeitos de fim-de-temporada do Botânico (dono do quadro ganha +2).
  for (const p of state.players) {
    if (p.hasBotanistFrame) {
      p.score += 2;
      p.hasBotanistFrame = false;
      p.botanistFrameSize = 0;
      logEvent(state, `${p.name} ganha 2 pts (quadro do Botânico).`, p.id);
    }
  }

  // Efeito de fim-de-temporada do Linguista (mais avançado na trilha).
  let maxLing = -1;
  for (const p of state.players) {
    if (p.linguistPosition > maxLing) maxLing = p.linguistPosition;
  }
  if (maxLing > 0) {
    for (const p of state.players) {
      if (p.linguistPosition === maxLing) {
        p.score += LINGUIST_END_OF_SEASON_BONUS;
        logEvent(
            state,
            `${p.name} ganha ${LINGUIST_END_OF_SEASON_BONUS} pts (mais avançado na trilha do Linguista).`,
            p.id,
        );
      }
    }
  }

  // Pontos por sítios (posição do veículo).
  for (const p of state.players) {
    let total = 0;
    for (const s of state.sites) {
      const pos = p.vehiclePositions[s.id] ?? 0;
      total += s.pointsBySpace[pos] ?? 0;
    }
    p.score += total;
    logEvent(
        state,
        `${p.name} ganha ${total} pts pelas posições nas trilhas.`,
        p.id,
    );
  }

  // Pontos por expedições desta temporada (Fotógrafo conta +1 no tamanho).
  for (const p of state.players) {
    let total = 0;
    for (const exp of p.playedExpeditions) {
      if (exp.season !== state.season) continue;
      let size = 1 + exp.followers.length;
      if (exp.leader.role === "PHOTOGRAPHER") size += 1;
      total += pointsForExpeditionSize(size);
    }
    p.score += total;
    logEvent(
        state,
        `${p.name} ganha ${total} pts pelas expedições desta temporada.`,
        p.id,
    );
  }

  if (state.season >= state.totalSeasons) {
    state.phase = "GAME_END";
    logEvent(state, `Fim do jogo.`);
    return state;
  }

  const triggererIdx = state.players.findIndex((p) => p.id === triggererId);
  if (triggererIdx >= 0) state.currentPlayerIndex = triggererIdx;

  startNewSeason(state);

  return state;
}
