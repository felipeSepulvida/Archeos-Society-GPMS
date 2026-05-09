"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { fetchGame, postAction } from "@/lib/api-client";
import type {
  Card,
  Color,
  GameAction,
  GameState,
  PlayedExpedition,
  PlayerState,
  ProfessionCard,
  Role,
} from "@/types/game";
import {
  COLOR_HEX,
  COLOR_LABEL,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
} from "@/lib/ui-labels";
import { CardView } from "@/components/Card";
import { SiteTrack } from "@/components/SiteTrack";
import { PlayerPanel } from "@/components/PlayerPanel";
import styles from "./page.module.css";

export default function GamePage() {
  const params = useParams<{ gameId: string }>();
  const sp = useSearchParams();
  const router = useRouter();

  const [game, setGame] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Estado local da composição de uma expedição
  const [leaderId, setLeaderId] = useState<string | null>(null);
  const [followerIds, setFollowerIds] = useState<Set<string>>(new Set());
  const [bond, setBond] = useState<{ type: "COLOR"; color: Color } | { type: "ROLE"; role: Role } | null>(null);

  // Popups
  const [gameOverDismissed, setGameOverDismissed] = useState(false);
  const [monkeyPopup, setMonkeyPopup] = useState<{ count: number; final: boolean } | null>(null);

  const viewerId = sp.get("as") ?? game?.players[0].id ?? "p1";

  const refresh = useCallback(async () => {
    try {
      const g = await fetchGame(params.gameId);
      setGame(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }, [params.gameId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const currentPlayer: PlayerState | null = game ? game.players[game.currentPlayerIndex] : null;
  const viewer: PlayerState | null = game?.players.find((p) => p.id === viewerId) ?? null;
  const isViewerTurn = !!(currentPlayer && viewer && currentPlayer.id === viewer.id);

  // Resetar composição da expedição quando trocar de jogador
  useEffect(() => {
    setLeaderId(null);
    setFollowerIds(new Set());
    setBond(null);
  }, [game?.currentPlayerIndex, game?.id]);

  // Detectar novos macacos comparando o tamanho do log entre renders.
  // Usamos o log (e não monkeysRevealed) porque o 3º macaco zera o contador
  // imediatamente — o backend chama finalizeSeason+startNewSeason no mesmo
  // ciclo, então o estado retornado já tem monkeysRevealed = 0.
  const prevLogLengthRef = useRef<number>(0);
  useEffect(() => {
    if (!game) {
      prevLogLengthRef.current = 0;
      return;
    }
    const prevLen = prevLogLengthRef.current;
    const newEntries = game.log.slice(prevLen);
    prevLogLengthRef.current = game.log.length;
    // Procura a mensagem mais recente sobre macaco nos eventos novos.
    let latest: { count: number; final: boolean } | null = null;
    for (const entry of newEntries) {
      if (entry.message.includes("revelou o 3º macaco")) {
        latest = { count: 3, final: true };
      } else {
        const m = entry.message.match(/Macaco revelado \((\d)\/3\)/);
        if (m) latest = { count: parseInt(m[1], 10), final: false };
      }
    }
    if (latest) setMonkeyPopup(latest);
  }, [game]);

  // IMPORTANTE: este hook precisa ficar antes de QUALQUER return antecipado,
  // caso contrário a ordem dos hooks varia entre renders e o React lança
  // "Rendered more hooks than during the previous render."
  const leaderCard: ProfessionCard | null = useMemo(() => {
    if (!leaderId || !viewer) return null;
    const c = viewer.hand.find((c) => c.id === leaderId);
    return c?.kind === "PROFESSION" ? c : null;
  }, [leaderId, viewer]);

  async function doAction(action: GameAction) {
    if (!game || !currentPlayer) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await postAction(game.id, currentPlayer.id, action);
      setGame(updated);
      // Reset selections após ação bem-sucedida
      setLeaderId(null);
      setFollowerIds(new Set());
      setBond(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  if (error && !game) {
    return (
        <main className="container">
          <div className="panel">
            <h2>Erro</h2>
            <p>{error}</p>
            <button onClick={() => router.push("/")}>Voltar</button>
          </div>
        </main>
    );
  }

  if (!game) {
    return (
        <main className="container">
          <div className="panel">Carregando partida...</div>
        </main>
    );
  }

  // ===========================================================================
  // Lógica de composição de expedição na UI
  // ===========================================================================

  function selectLeader(card: Card) {
    if (card.kind !== "PROFESSION") return;
    if (leaderId === card.id) {
      setLeaderId(null);
      setFollowerIds(new Set());
      setBond(null);
      return;
    }
    setLeaderId(card.id);
    setFollowerIds(new Set());
    setBond(null); // forçar escolha do elo
  }

  function toggleFollower(card: Card) {
    if (card.kind !== "PROFESSION") return;
    if (card.id === leaderId) return;
    if (!leaderId || !bond) return;
    const leader = viewer?.hand.find((c) => c.id === leaderId);
    if (!leader || leader.kind !== "PROFESSION") return;
    // Só pode incluir se compartilhar o bond
    if (bond.type === "COLOR" && card.color !== bond.color) return;
    if (bond.type === "ROLE" && card.role !== bond.role) return;
    setFollowerIds((s) => {
      const next = new Set(s);
      if (next.has(card.id)) next.delete(card.id);
      else next.add(card.id);
      return next;
    });
  }

  function chooseBond(b: { type: "COLOR"; color: Color } | { type: "ROLE"; role: Role }) {
    setBond(b);
    // Limpar followers que não combinem mais
    if (!viewer) return;
    setFollowerIds((s) => {
      const next = new Set<string>();
      for (const fid of s) {
        const c = viewer.hand.find((h) => h.id === fid);
        if (!c || c.kind !== "PROFESSION") continue;
        if (b.type === "COLOR" && c.color === b.color) next.add(fid);
        if (b.type === "ROLE" && c.role === b.role) next.add(fid);
      }
      return next;
    });
  }

  const expeditionSize = 1 + followerIds.size;

  // ===========================================================================
  // Render
  // ===========================================================================

  const isGameEnd = game.phase === "GAME_END";
  const winner = isGameEnd ? game.players.find((p) => p.id === game.winnerId) : null;

  return (
      <main className={styles.main}>
        <header className={styles.topBar}>
          <div>
            <button onClick={() => router.push("/")}>← Sair</button>
          </div>
          <div className={styles.titleArea}>
            <div className={styles.eyebrow}>Sociedade Arqueológica</div>
            <h1 className={styles.title}>Archeos Society</h1>
            <div className={styles.meta}>
              <span>Temporada {game.season}/{game.totalSeasons}</span>
              <span className={styles.dot}>·</span>
              <span>Macacos {game.monkeysRevealed}/3</span>
              <span className={styles.dot}>·</span>
              <span>Baralho: {game.deck.length}</span>
            </div>
          </div>
          <div className={styles.viewerSwitch}>
            <span className="label-tiny">Visualizar como:</span>
            <select
                value={viewerId}
                onChange={(e) => router.push(`/game/${game.id}?as=${e.target.value}`)}
            >
              {game.players.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </header>

        <div className={styles.layout}>
          {/* Coluna esquerda: trilhas */}
          <section className={styles.colLeft}>
            <div className={styles.colTitle}>Sítios Arqueológicos</div>
            <div className={styles.tracks}>
              {game.sites.map((s) => (
                  <SiteTrack key={s.id} site={s} players={game.players} />
              ))}
            </div>
            {/* Trilha do Linguista */}
            <LinguistTrack game={game} />
          </section>

          {/* Coluna central: fileira + área de expedições */}
          <section className={styles.colCenter}>
            <div className={styles.displayArea}>
              <div className={styles.colTitle}>
                Fileira <span className={styles.muted}>({game.display.length} cartas)</span>
              </div>
              <div className={styles.cardsRow}>
                {game.display.length === 0 ? (
                    <div className={styles.emptyHint}>(Fileira vazia)</div>
                ) : (
                    game.display.map((c) => (
                        <CardView
                            key={c.id}
                            card={c}
                            selectable={isViewerTurn && game.turnPhase === "AWAITING_ACTION"}
                            onClick={
                              isViewerTurn && game.turnPhase === "AWAITING_ACTION"
                                  ? () => doAction({ type: "GAIN_FROM_DISPLAY", cardId: c.id })
                                  : undefined
                            }
                        />
                    ))
                )}
              </div>
            </div>

            <ExpeditionsRow game={game} viewerId={viewerId} />
          </section>

          {/* Coluna direita: jogadores */}
          <aside className={styles.colRight}>
            <PlayerPanel game={game} viewerPlayerId={viewerId} />
            <LogPanel game={game} />
          </aside>
        </div>

        {/* Painel inferior: mão + ações */}
        {!isGameEnd && viewer && (
            <section className={styles.bottomBar}>
              <div className={styles.handArea}>
                <div className={styles.handHeader}>
                  <div>
                    <div className="label-tiny">Mão de</div>
                    <div className={styles.handName}>{viewer.name}</div>
                  </div>
                  <div className={styles.handCount}>
                    {viewer.hand.length}/10 cartas
                  </div>
                </div>
                <div className={styles.handCards}>
                  {viewer.hand.length === 0 ? (
                      <div className={styles.emptyHint}>(Sem cartas na mão)</div>
                  ) : (
                      viewer.hand.map((c) => {
                        const isLeader = c.id === leaderId;
                        const isFollower = followerIds.has(c.id);
                        const isProf = c.kind === "PROFESSION";
                        let selectable = false;
                        if (isViewerTurn && isProf) {
                          if (!leaderId) selectable = true; // selecionando líder
                          else if (bond) {
                            if (bond.type === "COLOR" && c.color === bond.color) selectable = true;
                            if (bond.type === "ROLE" && c.role === bond.role) selectable = true;
                            if (c.id === leaderId) selectable = true;
                          } else {
                            // Líder escolhido mas elo ainda não → só o líder é selecionável
                            if (c.id === leaderId) selectable = true;
                          }
                        }
                        return (
                            <CardView
                                key={c.id}
                                card={c}
                                selected={isFollower}
                                isLeader={isLeader}
                                selectable={selectable}
                                onClick={
                                  selectable
                                      ? () => {
                                        if (!leaderId || c.id === leaderId) selectLeader(c);
                                        else toggleFollower(c);
                                      }
                                      : undefined
                                }
                            />
                        );
                      })
                  )}
                </div>
              </div>

              <div className={styles.actionsPanel}>
                <ActionsPanel
                    game={game}
                    viewer={viewer}
                    isViewerTurn={isViewerTurn}
                    busy={busy}
                    leaderCard={leaderCard}
                    expeditionSize={expeditionSize}
                    followerIds={followerIds}
                    bond={bond}
                    onDeck={() => doAction({ type: "GAIN_FROM_DECK" })}
                    onChooseBond={chooseBond}
                    onLaunch={() => {
                      if (!leaderCard || !bond) return;
                      doAction({
                        type: "PLAY_EXPEDITION",
                        leaderCardId: leaderCard.id,
                        followerCardIds: Array.from(followerIds),
                        bond,
                      });
                    }}
                    onSkipCarto={() => doAction({ type: "SKIP_CARTOGRAPHER_BONUS" })}
                    onClearSelection={() => {
                      setLeaderId(null);
                      setFollowerIds(new Set());
                      setBond(null);
                    }}
                />
                {error && <div className={styles.errorBox}>{error}</div>}
              </div>
            </section>
        )}

        {/* Popup de Macaco — bloqueia interações até o jogador fechar */}
        {monkeyPopup && (
            <section
                className={styles.modalOverlay}
                onClick={() => setMonkeyPopup(null)}
            >
              <div
                  className={`panel ${styles.monkeyModal}`}
                  onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.monkeyIconBig}>🐒</div>
                <div className="label-tiny">Macaco Revelado</div>
                <h2 className={styles.monkeyHeading}>
                  {monkeyPopup.final
                      ? "3º Macaco — Fim da Temporada!"
                      : `${monkeyPopup.count}º Macaco apareceu`}
                </h2>
                <p className={styles.monkeyText}>
                  {monkeyPopup.final ? (
                      <>
                        O baralho revelou seu terceiro guardião dourado. A temporada
                        termina imediatamente — pontuações de trilhas e expedições
                        serão contabilizadas agora.
                      </>
                  ) : (
                      <>
                        Uma das relíquias douradas surgiu do baralho. Faltam{" "}
                        <strong>{3 - monkeyPopup.count}</strong> para o fim da
                        temporada. A carta volta para a mesa como aviso e o jogo
                        continua normalmente.
                      </>
                  )}
                </p>
                <div className={styles.monkeyActions}>
                  <button className="primary" onClick={() => setMonkeyPopup(null)}>
                    Continuar
                  </button>
                </div>
              </div>
            </section>
        )}


        {/* Popup de Fim de Jogo — fechável; pode ser reaberto via botão */}
        {isGameEnd && winner && !gameOverDismissed && (
            <section
                className={styles.modalOverlay}
                onClick={() => setGameOverDismissed(true)}
            >
              <div
                  className={`panel ${styles.gameOverModal}`}
                  onClick={(e) => e.stopPropagation()}
              >
                <div className="label-tiny">Fim de Jogo</div>
                <h2 className={styles.gameOverHeading}>
                  🏆 {winner.name} venceu!
                </h2>
                <div className={styles.gameOverRanking}>
                  {[...game.players]
                      .sort((a, b) => b.score - a.score)
                      .map((p, i) => (
                          <div key={p.id} className={styles.gameOverRow}>
                            <span className={styles.gameOverRank}>#{i + 1}</span>
                            <span className={styles.gameOverName}>{p.name}</span>
                            <span className={styles.gameOverScore}>{p.score} pts</span>
                          </div>
                      ))}
                </div>
                <div className={styles.gameOverActions}>
                  <button onClick={() => setGameOverDismissed(true)}>
                    Fechar (ver diário)
                  </button>
                  <button className="primary" onClick={() => router.push("/")}>
                    Nova Partida
                  </button>
                </div>
              </div>
            </section>
        )}

        {/* Botão flutuante para reabrir o popup de fim de jogo */}
        {isGameEnd && winner && gameOverDismissed && (
            <button
                className={styles.reopenGameOver}
                onClick={() => setGameOverDismissed(false)}
                title="Reabrir resultado"
            >
              🏆 Resultado
            </button>
        )}
      </main>
  );
}

// =============================================================================
// Sub-componentes
// =============================================================================

function ExpeditionsRow({ game, viewerId }: { game: GameState; viewerId: string }) {
  return (
      <div className={styles.expeditionsArea}>
        <div className={styles.colTitle}>Expedições Lançadas</div>
        <div className={styles.expGrid}>
          {game.players.map((p) => (
              <PlayerExpeditions key={p.id} player={p} highlight={p.id === viewerId} />
          ))}
        </div>
      </div>
  );
}

function PlayerExpeditions({ player, highlight }: { player: PlayerState; highlight: boolean }) {
  if (player.playedExpeditions.length === 0) {
    return (
        <div className={`${styles.expCol} ${highlight ? styles.expHi : ""}`}>
          <div className={styles.expColName}>{player.name}</div>
          <div className={styles.emptyHint}>(Sem expedições)</div>
        </div>
    );
  }
  return (
      <div className={`${styles.expCol} ${highlight ? styles.expHi : ""}`}>
        <div className={styles.expColName}>{player.name}</div>
        <div className={styles.expStack}>
          {player.playedExpeditions.map((e) => (
              <ExpeditionStack key={e.id} exp={e} />
          ))}
        </div>
      </div>
  );
}

function ExpeditionStack({ exp }: { exp: PlayedExpedition }) {
  const size = 1 + exp.followers.length;
  return (
      <div className={styles.expGroup}>
        <div className={styles.expBadge}>
          <span>{size} cartas</span>
          <span className={styles.expSeason}>T{exp.season}</span>
        </div>
        <div className={styles.expCards}>
          <CardView card={exp.leader} small isLeader />
          {exp.followers.map((f, i) => (
              <div key={i} className={styles.expFollower}>
                <CardView card={f} small />
              </div>
          ))}
        </div>
      </div>
  );
}

function LinguistTrack({ game }: { game: GameState }) {
  const slots = Array.from({ length: 11 }); // 0..10
  return (
      <div className={`panel ${styles.linguistTrack}`}>
        <div className={styles.linguistTitle}>
          Trilha do Linguista
          <span className={styles.muted}> (artefatos: 3 · 6 · 9)</span>
        </div>
        <div className={styles.linguistSpaces}>
          {slots.map((_, idx) => {
            const isArtifact = idx === 3 || idx === 6 || idx === 9;
            return (
                <div
                    key={idx}
                    className={`${styles.linguistSlot} ${isArtifact ? styles.linguistArtifact : ""}`}
                >
                  <div className={styles.linguistNum}>{idx}</div>
                  <div className={styles.linguistVehicles}>
                    {game.players.map((p, pi) => {
                      if (p.linguistPosition !== idx) return null;
                      const colors = ["#b94324", "#2c5b78", "#4a6f2a"];
                      return (
                          <div
                              key={p.id}
                              className={styles.linguistVehicle}
                              style={{ background: colors[pi] }}
                              title={p.name}
                          >
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                      );
                    })}
                  </div>
                </div>
            );
          })}
        </div>
      </div>
  );
}

function LogPanel({ game }: { game: GameState }) {
  const recent = game.log.slice(-10).reverse();
  return (
      <div className={`panel ${styles.logPanel}`}>
        <div className={styles.logTitle}>Diário</div>
        <ul className={styles.logList}>
          {recent.map((e, i) => (
              <li key={i}>{e.message}</li>
          ))}
        </ul>
      </div>
  );
}

interface ActionsPanelProps {
  game: GameState;
  viewer: PlayerState;
  isViewerTurn: boolean;
  busy: boolean;
  leaderCard: ProfessionCard | null;
  expeditionSize: number;
  followerIds: Set<string>;
  bond: { type: "COLOR"; color: Color } | { type: "ROLE"; role: Role } | null;
  onDeck: () => void;
  onChooseBond: (b: { type: "COLOR"; color: Color } | { type: "ROLE"; role: Role }) => void;
  onLaunch: () => void;
  onSkipCarto: () => void;
  onClearSelection: () => void;
}

function ActionsPanel(props: ActionsPanelProps) {
  const {
    game,
    viewer,
    isViewerTurn,
    busy,
    leaderCard,
    expeditionSize,
    bond,
    onDeck,
    onChooseBond,
    onLaunch,
    onSkipCarto,
    onClearSelection,
  } = props;

  const currentPlayer = game.players[game.currentPlayerIndex];

  if (!isViewerTurn) {
    return (
        <div>
          <div className={styles.waitingTitle}>Aguarde sua vez</div>
          <div className={styles.waitingMsg}>
            É a vez de <strong>{currentPlayer.name}</strong>.
            {viewer.id !== currentPlayer.id && (
                <>
                  <br />
                  <span className="label-tiny">
                Use o seletor "Visualizar como" para alternar a perspectiva
                (em uma partida local todos jogam no mesmo dispositivo).
              </span>
                </>
            )}
          </div>
        </div>
    );
  }

  const isCartoBonus = game.turnPhase === "CARTOGRAPHER_BONUS";

  return (
      <div>
        <div className={styles.actionsTitle}>
          {isCartoBonus ? "Bônus do Cartógrafo" : `Sua vez, ${viewer.name}`}
        </div>

        {isCartoBonus && !leaderCard && (
            <>
              <div className={styles.actionsHint}>
                Você avançou um veículo liderando o Cartógrafo. Pode jogar uma
                <strong> 2ª expedição</strong> com as cartas restantes da sua mão
                (escolha um líder clicando nela) ou dispensar o bônus.
              </div>
              <div className={styles.bigActions}>
                <button onClick={onSkipCarto} disabled={busy}>
                  Pular bônus
                </button>
                <span className={styles.actionsHintInline}>
              ou clique em uma carta da sua mão para iniciar a 2ª expedição.
            </span>
              </div>
            </>
        )}

        {!isCartoBonus && !leaderCard && (
            <>
              <div className={styles.actionsHint}>
                Escolha uma de duas ações:
              </div>
              <div className={styles.bigActions}>
                <button
                    onClick={onDeck}
                    disabled={busy || viewer.hand.length >= 10}
                    title={viewer.hand.length >= 10 ? "Mão cheia" : ""}
                >
                  📚 Comprar do Baralho
                </button>
                <span className={styles.actionsHintInline}>
              ou clique em uma carta da fileira para recrutá-la,
              ou clique em uma carta da sua mão para iniciar uma expedição.
            </span>
              </div>
            </>
        )}

        {leaderCard && !bond && (
            <>
              <div className={styles.actionsHint}>
                Líder selecionado: <strong>{ROLE_LABEL[leaderCard.role]}</strong> ({COLOR_LABEL[leaderCard.color]}).
                Escolha o elo da expedição:
              </div>
              <div className={styles.bondChoices}>
                <button
                    onClick={() => onChooseBond({ type: "COLOR", color: leaderCard.color })}
                    style={{
                      background: COLOR_HEX[leaderCard.color],
                      color: "#f3e8d2",
                      borderColor: "rgba(0,0,0,0.4)",
                    }}
                >
                  Cor: {COLOR_LABEL[leaderCard.color]}
                </button>
                <button onClick={() => onChooseBond({ type: "ROLE", role: leaderCard.role })}>
                  Profissão: {ROLE_LABEL[leaderCard.role]}
                </button>
                <button onClick={onClearSelection} className="danger">Cancelar</button>
              </div>
            </>
        )}

        {leaderCard && bond && (
            <>
              <div className={styles.actionsHint}>
                Selecione cartas adicionais que compartilhem o elo (opcional).
                <br />
                <strong>{ROLE_LABEL[leaderCard.role]}</strong> · Elo:{" "}
                {bond.type === "COLOR" ? COLOR_LABEL[bond.color] : ROLE_LABEL[bond.role]} ·
                Tamanho atual: <strong>{expeditionSize}</strong>
              </div>
              <div className={styles.roleEffectBox}>
                <div className="label-tiny">Habilidade do Líder</div>
                <div className={styles.roleEffectText}>
                  {ROLE_DESCRIPTION[leaderCard.role]}
                </div>
              </div>
              <div className={styles.launchActions}>
                <button className="primary" onClick={onLaunch} disabled={busy}>
                  Lançar Expedição ({expeditionSize})
                </button>
                <button onClick={onClearSelection} className="danger">Cancelar</button>
              </div>
            </>
        )}
      </div>
  );
}
