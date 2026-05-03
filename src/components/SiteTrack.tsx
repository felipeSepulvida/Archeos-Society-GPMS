"use client";

import type { PlayerState, Site } from "@/types/game";
import { COLOR_HEX, COLOR_REGION } from "@/lib/ui-labels";
import styles from "./SiteTrack.module.css";

interface SiteTrackProps {
  site: Site;
  players: PlayerState[];
}

const PLAYER_COLORS = ["#b94324", "#2c5b78", "#4a6f2a"]; // até 3 jogadores

export function SiteTrack({ site, players }: SiteTrackProps) {
  return (
    <div className={styles.wrap} style={{ ["--site-color" as any]: COLOR_HEX[site.color] }}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.colorDot} />
          <div>
            <div className={styles.name}>{site.name}</div>
            <div className={styles.region}>{COLOR_REGION[site.color]}</div>
          </div>
        </div>
      </div>
      <div className={styles.track}>
        {site.pointsBySpace.map((pts, idx) => {
          const threshold = site.thresholds[idx];
          const isLast = idx === site.pointsBySpace.length - 1;
          return (
            <div key={idx} className={styles.space}>
              <div className={styles.spaceTop}>
                <span className={styles.points}>{pts}</span>
                <span className={styles.pointsStar}>★</span>
              </div>
              <div className={styles.spaceMid}>
                {players.map((p, pi) => {
                  if ((p.vehiclePositions[site.id] ?? 0) !== idx) return null;
                  return (
                    <div
                      key={p.id}
                      className={styles.vehicle}
                      style={{ background: PLAYER_COLORS[pi] }}
                      title={p.name}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                  );
                })}
              </div>
              <div className={styles.spaceBottom}>
                {!isLast && (
                  <div className={styles.threshold}>
                    <span className={styles.thresholdNum}>≥{threshold}</span>
                    <span className={styles.thresholdArrow}>→</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
