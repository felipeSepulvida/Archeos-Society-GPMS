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
 * Esta função NÃO chama endSeason — quem chama deve verificar
 * `state.monkeysRevealed === 3` e tratar o fim de temporada depois.
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
        // Sinaliza fim da temporada — quem comprou o 3º macaco será o
        // primeiro jogador da próxima temporada.
        return null;
      }
      // Continua o loop: compra outra carta.
      continue;
    }
    return card; // ProfessionCard
  }
  // Baralho vazio (situação rara: deveria ter terminado em macaco antes)
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
      return doSkipCartographerBonus(state);
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
// RF05/RF06/RF07/RF08 - Lançar expedição
// =============================================================================

function doPlayExpedition(
    state: GameState,
    action: Extract<GameAction, { type: "PLAY_EXPEDITION" }>,
): GameState {
  const isCartoBonus = state.turnPhase === "CARTOGRAPHER_BONUS";
  if (state.turnPhase !== "AWAITING_ACTION" && !isCartoBonus) {
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

  // RF07 - Avanço em trilha (cor do líder), respeitando habilidades:
  //  - Estudante: NÃO pode avançar veículos (regra mandatória).
  //  - Guia (não implementado nesta versão).
  //  - Cartógrafo: avança normalmente, e ganha 1 expedição extra se avançou.
  let advanced = false;
  if (leader.role !== "STUDENT") {
    advanced = tryAdvanceVehicleAtSiteOfColor(
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
      // Efeito ONGOING de Chichén Itzá (lado avançado): comprar até X cartas
      // ao avançar.
      const site = state.sites.find((s) => s.color === leader.color);
      if (site && site.id === "chichen_itza") {
        applyChichenItzaBonus(state, player);
      }
    }
  }

  // RF08 - Habilidade da profissão líder
  applyLeaderRoleEffect(state, player, leader, expeditionSize, action);

  // ============================================================================
  // Devolução da mão para o display (RF06)
  // ============================================================================
  // Regra do livro (p. 8 - Cartographer): "If you advance your vehicle with this
  // expedition, you may immediately play 1 additional expedition from your hand
  // (resolving its effects) BEFORE returning your hand of cards to the display."
  //
  // Caso 1 — Esta é a 1ª expedição E o líder é Cartógrafo E avançou veículo
  //          E o jogador AINDA TEM cartas para uma 2ª expedição:
  //   → entra na fase CARTOGRAPHER_BONUS, devolve as cartas remanescentes à
  //     `hand` do jogador para que ele possa compor a 2ª expedição.
  //
  // Caso 2 — Qualquer outra expedição (inclusive a 2ª do Cartógrafo):
  //   → devolve imediatamente o restante para o display e encerra o turno.
  // ============================================================================

  const isCartographerWithAdvance =
      leader.role === "CARTOGRAPHER" && advanced && !isCartoBonus;
  const hasCardsForBonus = remaining.length > 0;

  if (isCartographerWithAdvance && hasCardsForBonus) {
    // Devolve as cartas restantes à mão para que o jogador possa usá-las na
    // 2ª expedição. Se ele optar por dispensar o bônus (SKIP), elas vão para
    // o display em `doSkipCartographerBonus`.
    player.hand = remaining;
    state.turnPhase = "CARTOGRAPHER_BONUS";
    logEvent(
        state,
        `${player.name} pode jogar uma expedição adicional (Cartógrafo). ` +
        `Cartas disponíveis: ${remaining.length}.`,
        player.id,
    );
    return state;
  }

  if (isCartographerWithAdvance && !hasCardsForBonus) {
    // Cartógrafo avançou mas não tem mais cartas — bônus inviável, log informativo.
    logEvent(
        state,
        `${player.name} avançou com o Cartógrafo, mas não há cartas para uma 2ª expedição.`,
        player.id,
    );
  }

  // Devolve as cartas restantes ao display.
  state.display.push(...remaining);

  return endTurn(state);
}

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

/**
 * Efeito ONGOING avançado de Chichén Itzá: ao avançar, comprar 1 carta
 * do BARALHO (não do display), respeitando o limite de 10 na mão.
 */
function applyChichenItzaBonus(state: GameState, player: PlayerState) {
  if (player.hand.length >= MAX_HAND_SIZE) return;
  const drawn = drawFromDeckHandlingMonkeys(state);
  if (drawn === null) {
    // Caso raríssimo: 3º macaco saiu nesse bônus.
    return;
  }
  player.hand.push(drawn);
  logEvent(
      state,
      `${player.name} comprou 1 carta extra (Chichén Itzá).`,
      player.id,
  );
}

function doSkipCartographerBonus(state: GameState): GameState {
  if (state.turnPhase !== "CARTOGRAPHER_BONUS") {
    throw new Error("Nada para pular.");
  }
  // O jogador optou por não jogar a 2ª expedição: agora sim devolvemos a
  // mão remanescente ao display, conforme RF06.
  const player = currentPlayer(state);
  if (player.hand.length > 0) {
    state.display.push(...player.hand);
    logEvent(
        state,
        `${player.name} dispensou o bônus do Cartógrafo. ${player.hand.length} carta(s) retornam ao display.`,
        player.id,
    );
    player.hand = [];
  } else {
    logEvent(
        state,
        `${player.name} dispensou o bônus do Cartógrafo.`,
        player.id,
    );
  }
  return endTurn(state);
}

// =============================================================================
// RF08 - Efeitos de profissões líder
// =============================================================================

function applyLeaderRoleEffect(
    state: GameState,
    player: PlayerState,
    leader: ProfessionCard,
    expeditionSize: number,
    action: Extract<GameAction, { type: "PLAY_EXPEDITION" }>,
) {
  switch (leader.role) {
    case "BOTANIST":
      applyBotanistEffect(state, player, expeditionSize);
      break;
    case "LINGUIST":
      applyLinguistEffect(state, player, expeditionSize);
      break;
    case "CURATOR":
      applyCuratorEffect(state, player, leader, action);
      break;
    case "PHOTOGRAPHER":
      // Efeito é resolvido apenas no FIM da temporada (conta +1 carta).
      break;
    case "CARTOGRAPHER":
      // O bônus de expedição extra é tratado em doPlayExpedition (turnPhase).
      break;
    case "STUDENT":
      // Restrição já aplicada (não avança trilha). Sem efeito imediato.
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
 * Para cada espaço com artefato linguístico em que parar OU passar,
 * avança 1 veículo em qualquer sítio (à escolha — nesta v1, escolha
 * automática: o sítio com menor pontuação atual onde ele AINDA pode
 * avançar; se nenhum, ignora).
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
      `${player.name} avança ${end - start} casas na trilha do Linguista (artefatos: ${artifactsCrossed}).`,
      player.id,
  );

  // Para cada artefato, avança 1 veículo onde for possível (escolha automática).
  for (let i = 0; i < artifactsCrossed; i++) {
    const candidate = pickSiteForFreeAdvance(state, player);
    if (!candidate) break;
    player.vehiclePositions[candidate.id] += 1;
    logEvent(
        state,
        `${player.name} avança gratuitamente em ${candidate.name} (artefato linguístico).`,
        player.id,
    );
  }
}

function pickSiteForFreeAdvance(
    state: GameState,
    player: PlayerState,
): Site | null {
  // Escolhe o sítio com MENOR posição atual do jogador onde ele ainda pode avançar.
  let best: Site | null = null;
  let bestPos = Infinity;
  for (const s of state.sites) {
    const pos = player.vehiclePositions[s.id] ?? 0;
    const max = s.pointsBySpace.length - 1;
    if (pos < max && pos < bestPos) {
      best = s;
      bestPos = pos;
    }
  }
  return best;
}

/**
 * CURATOR (livro p. 8 — IMMEDIATELY):
 * Coloca uma relíquia da cor do Curador no museu (limite: 1 por cor).
 * Pontua no FIM DO JOGO (ver scoreCuratorBonus).
 */
function applyCuratorEffect(
    state: GameState,
    player: PlayerState,
    leader: ProfessionCard,
    action: Extract<GameAction, { type: "PLAY_EXPEDITION" }>,
) {
  // Por padrão aplicamos o efeito (é opcional no livro, mas útil sempre).
  if (action.useCuratorEffect === false) return;
  if (player.curatorRelics.includes(leader.color)) {
    logEvent(
        state,
        `${player.name} já tem uma relíquia ${leader.color} no museu.`,
        player.id,
    );
    return;
  }
  player.curatorRelics.push(leader.color);
  logEvent(
      state,
      `${player.name} coleta relíquia ${leader.color} no museu.`,
      player.id,
  );
}

// =============================================================================
// Final de turno
// =============================================================================

function endTurn(state: GameState): GameState {
  // Avança para o próximo jogador
  state.currentPlayerIndex =
      (state.currentPlayerIndex + 1) % state.players.length;
  state.turnPhase = "AWAITING_ACTION";

  // Verifica handsize: se o próximo jogador tem 10 cartas, ele só pode
  // jogar expedição (essa restrição é validada no momento da ação).

  return state;
}

// =============================================================================
// Fim de temporada / fim de jogo
// =============================================================================

/**
 * Finaliza a temporada atual. `triggererId` é o jogador que comprou o 3º macaco
 * — ele se torna o primeiro jogador da próxima temporada (se houver).
 */
function finalizeSeason(state: GameState, triggererId: string): GameState {
  state.phase = "SEASON_END";

  // Passo 1: cartas na mão e display voltam ao baralho (sem efeito).
  for (const p of state.players) p.hand = [];
  state.display = [];

  // Passo 2: efeitos de fim de temporada (papéis com SEASON END):
  //  - Botânico: dono do quadro ganha +2 pts (e devolve o quadro).
  //  - Fotógrafo: cada expedição liderada por Fotógrafo conta +1 no tamanho
  //    (aplicado em scoreExpeditions abaixo).
  //  - Linguista: jogador mais avançado na trilha do Linguista ganha +2 pts.
  resolveBotanistSeasonEnd(state);
  resolveLinguistSeasonEnd(state);

  // Passo 3: Pontos por sítios (posição do veículo).
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

  // Passo 4: Pontos por expedições.
  for (const p of state.players) {
    let total = 0;
    for (const exp of p.playedExpeditions) {
      // Apenas as expedições DESTA temporada são pontuadas neste passo.
      if (exp.season !== state.season) continue;
      let size = 1 + exp.followers.length;
      // Fotógrafo: conta como tamanho+1 no fim da temporada.
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

  // Decide próximo passo
  if (state.season >= state.totalSeasons) {
    return finalizeGame(state);
  }

  // Define o gatilho do próximo turno: jogador que pegou o 3º macaco
  // será o primeiro a jogar na próxima temporada.
  const triggererIdx = state.players.findIndex((p) => p.id === triggererId);
  if (triggererIdx >= 0) state.currentPlayerIndex = triggererIdx;

  // Inicia nova temporada (devolve cartas, redistribui mãos, etc.)
  startNewSeason(state);

  return state;
}

function resolveBotanistSeasonEnd(state: GameState) {
  for (const p of state.players) {
    if (p.hasBotanistFrame) {
      p.score += 2;
      p.hasBotanistFrame = false;
      p.botanistFrameSize = 0;
      logEvent(state, `${p.name} ganha 2 pts (quadro do Botânico).`, p.id);
    }
  }
}

function resolveLinguistSeasonEnd(state: GameState) {
  let max = -1;
  for (const p of state.players) {
    if (p.linguistPosition > max) max = p.linguistPosition;
  }
  if (max <= 0) return;
  for (const p of state.players) {
    if (p.linguistPosition === max) {
      p.score += LINGUIST_END_OF_SEASON_BONUS;
      logEvent(
          state,
          `${p.name} ganha ${LINGUIST_END_OF_SEASON_BONUS} pts (mais avançado na trilha do Linguista).`,
          p.id,
      );
    }
  }
  // Trilha do Linguista NÃO é resetada entre temporadas neste simulador
  // (espelha o comportamento dos veículos: progresso é mantido).
}

// =============================================================================
// Fim de jogo
// =============================================================================

function finalizeGame(state: GameState): GameState {
  // Bônus de fim de jogo: Curador.
  for (const p of state.players) {
    const distinct = new Set(p.curatorRelics).size;
    const bonus = curatorBonusForRelics(distinct);
    if (bonus > 0) {
      p.score += bonus;
      logEvent(
          state,
          `${p.name} ganha ${bonus} pts (museu do Curador: ${distinct} relíquias).`,
          p.id,
      );
    }
  }

  // Determina vencedor (maior pontuação; tie-break = maior expedição na
  // temporada final, depois sucessivamente).
  const ranked = [...state.players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-break: maior expedição na temporada final
    const finalSeason = state.season;
    const sortedSizes = (p: PlayerState) =>
        p.playedExpeditions
            .filter((e) => e.season === finalSeason)
            .map((e) => 1 + e.followers.length)
            .sort((x, y) => y - x);
    const sa = sortedSizes(a);
    const sb = sortedSizes(b);
    const len = Math.max(sa.length, sb.length);
    for (let i = 0; i < len; i++) {
      const va = sa[i] ?? 0;
      const vb = sb[i] ?? 0;
      if (vb !== va) return vb - va;
    }
    return 0;
  });

  state.winnerId = ranked[0]?.id;
  state.phase = "GAME_END";
  logEvent(state, `Fim de jogo. Vencedor: ${ranked[0]?.name}.`);
  return state;
}

/**
 * Bônus de Curador conforme livro (chart no rodapé da p. 8 — escala
 * progressiva por número de relíquias distintas).
 */
function curatorBonusForRelics(distinct: number): number {
  // Aproximação suave da escala mostrada no livro:
  //  1 -> 1 pt, 2 -> 3 pts, 3 -> 6 pts, 4 -> 10 pts, 5 -> 15 pts, 6 -> 21 pts.
  const table: Record<number, number> = {
    0: 0,
    1: 1,
    2: 3,
    3: 6,
    4: 10,
    5: 15,
    6: 21,
  };
  return table[distinct] ?? 0;
}