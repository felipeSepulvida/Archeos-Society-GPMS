"use client";

import type { GameState } from "@/types/game";
import { COLOR_HEX, COLOR_LABEL } from "@/lib/ui-labels";
import styles from "./PlayerPanel.module.css";

interface Props {
  game: GameState;
  viewerPlayerId: string;
}

const PLAYER_COLORS = ["#b94324", "#2c5b78", "#4a6f2a"];

export function PlayerPanel({ game, viewerPlayerId }: Props) {
  return (
    <div className={styles.wrap}>
      <div className={styles.title}>Aventureiros</div>
      <div className={styles.players}>
        {game.players.map((p, idx) => {
          const isCurrent = game.players[game.currentPlayerIndex].id === p.id;
          const isViewer = viewerPlayerId === p.id;
          return (
            <div
              key={p.id}
              className={`${styles.player} ${isCurrent ? styles.current : ""}`}
              style={{ ["--pcolor" as any]: PLAYER_COLORS[idx] }}
            >
              <div className={styles.head}>
                <div className={styles.token}>{p.name.charAt(0).toUpperCase()}</div>
                <div className={styles.nameWrap}>
                  <div className={styles.name}>
                    {p.name}
                    {isViewer && <span className={styles.youBadge}>VOCÊ</span>}
                  </div>
                  <div className={styles.score}>{p.score} pts</div>
                </div>
              </div>
              <div className={styles.stats}>
                <Stat label="Mão" value={`${p.hand.length}/10`} />
                <Stat label="Expedições" value={String(p.playedExpeditions.length)} />
                <Stat label="Linguista" value={String(p.linguistPosition)} />
                {p.hasBotanistFrame && (
                  <Stat label="Botânico" value={`★ ${p.botanistFrameSize}`} highlight />
                )}
              </div>
              {p.curatorRelics.length > 0 && (
                <div className={styles.relics}>
                  <span className={styles.relicsLabel}>Museu:</span>
                  {p.curatorRelics.map((c) => (
                    <span
                      key={c}
                      className={styles.relic}
                      style={{ background: COLOR_HEX[c] }}
                      title={`Relíquia ${COLOR_LABEL[c]}`}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`${styles.stat} ${highlight ? styles.statHi : ""}`}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
    </div>
  );
}
