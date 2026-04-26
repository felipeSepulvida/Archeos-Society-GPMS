import { NextResponse } from "next/server";
import { getGame } from "@/lib/store";

export async function GET(
  _req: Request,
  { params }: { params: { gameId: string } },
) {
  const state = getGame(params.gameId);
  if (!state) {
    return NextResponse.json({ error: "Partida não encontrada." }, { status: 404 });
  }
  return NextResponse.json({ game: state });
}
