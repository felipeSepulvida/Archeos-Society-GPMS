import type { GameState } from "@/types/game";

// =============================================================================
// Store em memória
// =============================================================================
//
// Persistência simples em memória do processo. Em ambientes de produção (p.ex.
// serverless), este estado seria perdido entre invocações; para o escopo deste
// simulador (partidas locais com 2-3 jogadores em uma única sessão), é
// suficiente. O global é cuidado com globalThis para sobreviver a hot-reload
// do Next.js em desenvolvimento.
// =============================================================================

interface Store {
  games: Map<string, GameState>;
}

const globalForStore = globalThis as unknown as { __archeosStore?: Store };

function getStore(): Store {
  if (!globalForStore.__archeosStore) {
    globalForStore.__archeosStore = { games: new Map() };
  }
  return globalForStore.__archeosStore;
}

export function saveGame(state: GameState): void {
  getStore().games.set(state.id, state);
}

export function getGame(id: string): GameState | undefined {
  return getStore().games.get(id);
}

export function deleteGame(id: string): boolean {
  return getStore().games.delete(id);
}

export function listGames(): GameState[] {
  return Array.from(getStore().games.values());
}

export function generateGameId(): string {
  // ID curto, suficiente para escopo local.
  const ts = Date.now().toString(36);
  const rnd = Math.floor(Math.random() * 0xffffff).toString(36);
  return `g_${ts}_${rnd}`;
}
