"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createGame } from "@/lib/api-client";
import styles from "./page.module.css";

export default function HomePage() {
  const router = useRouter();
  const [numPlayers, setNumPlayers] = useState(2);
  const [names, setNames] = useState<string[]>(["Aventureiro 1", "Aventureiro 2", ""]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function setName(i: number, v: string) {
    setNames((arr) => arr.map((x, idx) => (idx === i ? v : x)));
  }

  async function start() {
    setError(null);
    setLoading(true);
    try {
      const playerNames = names.slice(0, numPlayers).map((n) => n.trim());
      if (playerNames.some((n) => !n)) {
        throw new Error("Todos os jogadores precisam de um nome.");
      }
      const game = await createGame(playerNames);
      router.push(`/game/${game.id}?as=${game.players[0].id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={`container ${styles.main}`}>
      <header className={styles.header}>
        <div className={styles.eyebrow}>Simulador Digital</div>
        <h1 className={styles.title}>Archeos Society</h1>
        <p className={styles.subtitle}>
          Recrute exploradores. Lidere expedições.<br />
          Traga o maior prestígio para a Sociedade.
        </p>
      </header>

      <section className={`panel ${styles.setup}`}>
        <h2>Nova Expedição</h2>

        <div className={styles.field}>
          <label className="label-tiny">Número de Jogadores</label>
          <div className={styles.choices}>
            {[2, 3].map((n) => (
              <button
                key={n}
                className={numPlayers === n ? "primary" : ""}
                onClick={() => setNumPlayers(n)}
              >
                {n} jogadores
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label className="label-tiny">Nomes dos Aventureiros</label>
          <div className={styles.namesGrid}>
            {Array.from({ length: numPlayers }).map((_, i) => (
              <div key={i} className={styles.nameRow}>
                <span className={styles.nameNum}>{i + 1}</span>
                <input
                  value={names[i] ?? ""}
                  onChange={(e) => setName(i, e.target.value)}
                  placeholder={`Aventureiro ${i + 1}`}
                  maxLength={24}
                />
              </div>
            ))}
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button className="primary" onClick={start} disabled={loading}>
            {loading ? "Preparando o baralho..." : "Iniciar Partida"}
          </button>
        </div>
      </section>

      <section className={`panel ${styles.about}`}>
        <h2>Como Funciona</h2>
        <p>
          Em cada turno você executa <strong>uma única</strong> de duas ações:
          recrutar uma carta (da fileira ou do baralho) ou lançar uma expedição
          escolhendo um líder e cartas de mesmo traço (cor ou profissão).
          Ao final de cada temporada — quando o terceiro Macaco aparece —
          os pontos por trilhas e expedições são contabilizados.
        </p>
        <p>
          O jogo desenrola-se em <strong>2 temporadas</strong> para 2 ou 3 jogadores.
          A maior pontuação ao final vence.
        </p>
      </section>

      <footer className={styles.footer}>
        Simulador local · MIT License · 6 profissões base · 6 sítios arqueológicos
      </footer>
    </main>
  );
}
