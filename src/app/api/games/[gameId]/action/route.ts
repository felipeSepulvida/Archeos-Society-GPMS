import { NextResponse, type NextRequest } from "next/server";
import { applyAction } from "@/lib/engine";
import { getGame, saveGame } from "@/lib/store";
import type { GameAction } from "@/types/game";

interface ActionBody {
  playerId: string;
  action: GameAction;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { gameId: string } },
) {
  const state = getGame(params.gameId);
  if (!state) {
    return NextResponse.json({ error: "Partida não encontrada." }, { status: 404 });
  }

  let body: ActionBody;
  try {
    body = (await req.json()) as ActionBody;
  } catch {
    return NextResponse.json(
      { error: "JSON inválido no corpo da requisição." },
      { status: 400 },
    );
  }
  if (!body || typeof body.playerId !== "string" || !body.action) {
    return NextResponse.json(
      { error: "Body deve conter playerId e action." },
      { status: 400 },
    );
  }

  try {
    const updated = applyAction(state, body.playerId, body.action);
    saveGame(updated);
    return NextResponse.json({ game: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao aplicar ação." },
      { status: 400 },
    );
  }
}
