import type { Card, Color, ProfessionCard, Role } from "@/types/game";

/**
 * Valida se um conjunto de cartas (líder + seguidores) forma uma expedição
 * legal segundo o "elo" (bond) escolhido.
 *
 * Regras (livro p. 5):
 *  - Todas as cartas DEVEM compartilhar o mesmo traço (ou cor, ou role).
 *  - O traço precisa ser um dos traços do líder.
 *  - Mercenários poderiam ser "wild", mas não os implementamos nesta versão.
 */
export function validateExpedition(params: {
  leader: ProfessionCard;
  followers: Card[];
  bond: { type: "COLOR"; color: Color } | { type: "ROLE"; role: Role };
}): { ok: true } | { ok: false; reason: string } {
  const { leader, followers, bond } = params;

  // O bond precisa ser um dos traços do líder.
  if (bond.type === "COLOR" && bond.color !== leader.color) {
    return {
      ok: false,
      reason: "A cor escolhida como elo não corresponde à cor do líder.",
    };
  }
  if (bond.type === "ROLE" && bond.role !== leader.role) {
    return {
      ok: false,
      reason: "A profissão escolhida como elo não corresponde à do líder.",
    };
  }

  // Todas as cartas (excluindo o líder) devem corresponder ao bond.
  for (const f of followers) {
    if (f.kind !== "PROFESSION") {
      return {
        ok: false,
        reason: "Cartas de Macaco não podem fazer parte de uma expedição.",
      };
    }
    if (bond.type === "COLOR" && f.color !== bond.color) {
      return {
        ok: false,
        reason: `Carta ${f.role}/${f.color} não compartilha a cor do elo.`,
      };
    }
    if (bond.type === "ROLE" && f.role !== bond.role) {
      return {
        ok: false,
        reason: `Carta ${f.role}/${f.color} não compartilha a profissão do elo.`,
      };
    }
  }

  return { ok: true };
}
