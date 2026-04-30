import { applyAction, createInitialGame } from "../src/lib/engine";
import type { Card, GameState, ProfessionCard } from "../src/types/game";

// Simulação simples: um agente "burro" que recolhe cartas até ter 4,
// depois lança uma expedição usando todas as cartas que partilham um traço.

function findExpeditionInHand(hand: Card[]): {
  leader: ProfessionCard;
  followers: ProfessionCard[];
  bond: { type: "COLOR"; color: ProfessionCard["color"] } | { type: "ROLE"; role: ProfessionCard["role"] };
} | null {
  const profs = hand.filter((c): c is ProfessionCard => c.kind === "PROFESSION");
  if (profs.length === 0) return null;

  // Tenta agrupar por cor com 2+ cartas
  const byColor = new Map<string, ProfessionCard[]>();
  for (const c of profs) {
    const arr = byColor.get(c.color) ?? [];
    arr.push(c);
    byColor.set(c.color, arr);
  }
  const byRole = new Map<string, ProfessionCard[]>();
  for (const c of profs) {
    const arr = byRole.get(c.role) ?? [];
    arr.push(c);
    byRole.set(c.role, arr);
  }

  let best: ProfessionCard[] | null = null;
  let bestBond: any = null;

  for (const [color, arr] of byColor) {
    if (!best || arr.length > best.length) {
      best = arr;
      bestBond = { type: "COLOR" as const, color };
    }
  }
  for (const [role, arr] of byRole) {
    if (!best || arr.length > best.length) {
      best = arr;
      bestBond = { type: "ROLE" as const, role };
    }
  }

  if (!best || best.length === 0) return null;
  // Se tiver só 1, joga 1-card expedition
  if (best.length === 1) {
    return { leader: best[0], followers: [], bond: bestBond };
  }
  return { leader: best[0], followers: best.slice(1), bond: bestBond };
}

function play(state: GameState, maxTurns = 500): GameState {
  let turns = 0;
  while (state.phase !== "GAME_END" && turns < maxTurns) {
    const player = state.players[state.currentPlayerIndex];
    const handSize = player.hand.length;

    // Política: se tem 4+ cartas OU está com 10, joga expedição.
    const shouldPlay = handSize >= 4 || handSize === 10;
    let action;
    if (shouldPlay) {
      const exp = findExpeditionInHand(player.hand);
      if (exp) {
        action = {
          type: "PLAY_EXPEDITION" as const,
          leaderCardId: exp.leader.id,
          followerCardIds: exp.followers.map((f) => f.id),
          bond: exp.bond,
        };
      } else if (state.display.length > 0) {
        action = { type: "GAIN_FROM_DISPLAY" as const, cardId: state.display[0].id };
      } else {
        action = { type: "GAIN_FROM_DECK" as const };
      }
    } else {
      // Recolhe carta: se tem display, pega do display; senão, do deck.
      if (state.display.length > 0) {
        action = { type: "GAIN_FROM_DISPLAY" as const, cardId: state.display[0].id };
      } else {
        action = { type: "GAIN_FROM_DECK" as const };
      }
    }

    try {
      state = applyAction(state, player.id, action);
    } catch (e) {
      console.error(`Turno ${turns}: erro -`, (e as Error).message);
      // Tenta sair da fase de bônus
      if (state.turnPhase === "CARTOGRAPHER_BONUS") {
        state = applyAction(state, player.id, { type: "SKIP_CARTOGRAPHER_BONUS" });
      } else {
        // Forçar progresso: tenta comprar
        try {
          state = applyAction(state, player.id, { type: "GAIN_FROM_DECK" });
        } catch (e2) {
          console.error("Falha forçada:", (e2 as Error).message);
          break;
        }
      }
    }
    turns++;
  }
  console.log(`Partida finalizou em ${turns} turnos. Fase: ${state.phase}`);
  return state;
}

// Roda 2-3 partidas
for (const numPlayers of [2, 3]) {
  const names = ["Alice", "Bruno", "Clara"].slice(0, numPlayers);
  console.log(`\n=== Partida com ${numPlayers} jogadores ===`);
  let state = createInitialGame({ gameId: `test_${numPlayers}`, playerNames: names, seed: 42 });
  state = play(state);
  console.log("Pontuações:");
  for (const p of state.players) {
    console.log(`  ${p.name}: ${p.score} pts (expedições: ${p.playedExpeditions.length})`);
  }
  console.log("Vencedor:", state.players.find(p => p.id === state.winnerId)?.name);
}
