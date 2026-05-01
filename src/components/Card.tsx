"use client";

import type { Card } from "@/types/game";
import { COLOR_HEX, COLOR_LABEL, ROLE_INITIAL, ROLE_LABEL } from "@/lib/ui-labels";
import styles from "./Card.module.css";

interface CardViewProps {
  card: Card;
  selected?: boolean;
  selectable?: boolean;
  isLeader?: boolean;
  small?: boolean;
  onClick?: () => void;
  facedown?: boolean;
}

export function CardView({
  card,
  selected,
  selectable,
  isLeader,
  small,
  onClick,
  facedown,
}: CardViewProps) {
  if (facedown) {
    return (
      <div
        className={`${styles.card} ${styles.facedown} ${small ? styles.small : ""}`}
        onClick={onClick}
        role={onClick ? "button" : undefined}
      >
        <div className={styles.facedownCrest}>
          <span>A·S</span>
        </div>
      </div>
    );
  }

  if (card.kind === "MONKEY") {
    return (
      <div className={`${styles.card} ${styles.monkey} ${small ? styles.small : ""}`}>
        <div className={styles.monkeyTop}>MACACO</div>
        <div className={styles.monkeyIcon}>🐒</div>
        <div className={styles.monkeyHint}>Fim de temporada se 3</div>
      </div>
    );
  }

  const colorVar = COLOR_HEX[card.color];
  return (
    <div
      className={[
        styles.card,
        small ? styles.small : "",
        selected ? styles.selected : "",
        selectable ? styles.selectable : "",
        isLeader ? styles.leader : "",
      ].join(" ")}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      style={{ ["--card-color" as any]: colorVar }}
    >
      <div className={styles.topBand}>
        <div className={styles.region}>{COLOR_LABEL[card.color]}</div>
        <div className={styles.roleBadge}>{ROLE_INITIAL[card.role]}</div>
      </div>
      <div className={styles.body}>
        <div className={styles.crest}>
          <div className={styles.crestInner}>
            {ROLE_INITIAL[card.role]}
          </div>
        </div>
        <div className={styles.roleLabel}>{ROLE_LABEL[card.role]}</div>
      </div>
      {isLeader && <div className={styles.leaderRibbon}>LÍDER</div>}
    </div>
  );
}
