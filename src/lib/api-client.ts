import type { GameAction, GameState } from "@/types/game";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export async function createGame(playerNames: string[]): Promise<GameState> {
  const res = await fetch("/api/games", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerNames }),
  });
  const data = await handle<{ game: GameState }>(res);
  return data.game;
}

export async function fetchGame(gameId: string): Promise<GameState> {
  const res = await fetch(`/api/games/${gameId}`);
  const data = await handle<{ game: GameState }>(res);
  return data.game;
}

export async function postAction(
  gameId: string,
  playerId: string,
  action: GameAction,
): Promise<GameState> {
  const res = await fetch(`/api/games/${gameId}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, action }),
  });
  const data = await handle<{ game: GameState }>(res);
  return data.game;
}
