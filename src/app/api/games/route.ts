import { NextResponse, type NextRequest } from "next/server";
import { createInitialGame } from "@/lib/engine";
import { generateGameId, listGames, saveGame } from "@/lib/store";
import type { CreateGameInput } from "@/types/game";

export async function GET() {
  const games = listGames().map((g) => ({
    id: g.id,
    createdAt: g.createdAt,
    phase: g.phase,
    season: g.season,
    players: g.players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
  }));
  return NextResponse.json({ games });
}

export async function POST(req: NextRequest) {
  let body: CreateGameInput;
  try {
    body = (await req.json()) as CreateGameInput;
  } catch {
    return NextResponse.json(
      { error: "JSON inválido no corpo da requisição." },
      { status: 400 },
    );
  }

  if (
    !body ||
    !Array.isArray(body.playerNames) ||
    body.playerNames.length < 2 ||
    body.playerNames.length > 3 ||
    body.playerNames.some((n) => typeof n !== "string" || n.trim().length === 0)
  ) {
    return NextResponse.json(
      { error: "playerNames deve ser um array com 2 ou 3 nomes não-vazios." },
      { status: 400 },
    );
  }

  try {
    const gameId = generateGameId();
    const state = createInitialGame({
      gameId,
      playerNames: body.playerNames.map((n) => n.trim()),
    });
    saveGame(state);
    return NextResponse.json({ game: state }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro desconhecido." },
      { status: 400 },
    );
  }
}
