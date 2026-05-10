# Archeos Society — Simulador

Simulador digital local do jogo de tabuleiro **Archeos Society** (Paolo Mori, SPACE Cowboys, 2023). Implementa o cenário inicial **Chichén Itzá** com as 6 profissões base e os 6 sítios arqueológicos do livro de regras, para partidas locais com **2 ou 3 jogadores**.

> Este projeto é um simulador de fãs não-oficial. Não é afiliado, endossado ou patrocinado pela SPACE Cowboys ou Asmodee.

## Tecnologias

- **Next.js 14** (App Router) — frontend e backend integrados.
- **TypeScript** — tipagem estática estrita em todo o código.
- **React 18** — UI reativa.
- **Node.js >= 18** — runtime.
- **API REST + JSON** — comunicação cliente/servidor exclusivamente via fetch (RNF02).

> Nota: o documento de Análise de Requisitos original especificava Python para o backend (RNF01), mas, conforme alinhado com o cliente, adotamos Next.js como stack unificada.

## Como Executar

```bash
npm install
npm run dev
```

Abra <http://localhost:3000>.

Para build de produção:

```bash
npm run build
npm start
```

## Estrutura

```
src/
├── app/
│   ├── api/games/                 # API REST
│   │   ├── route.ts               # POST/GET /api/games
│   │   └── [gameId]/
│   │       ├── route.ts           # GET /api/games/:id
│   │       └── action/route.ts    # POST /api/games/:id/action
│   ├── game/[gameId]/             # Tela da partida
│   ├── page.tsx                   # Lobby (criação de partida)
│   ├── layout.tsx
│   └── globals.css
├── components/                    # CardView, SiteTrack, PlayerPanel
├── lib/
│   ├── engine/                    # Motor do jogo (puro, sem React)
│   │   ├── config.ts              # Sítios, baralho, pontuação
│   │   ├── rng.ts                 # RNG seedável
│   │   ├── setup.ts               # Inicialização e nova temporada
│   │   ├── turns.ts               # Ações, habilidades, fim de temporada
│   │   ├── validation.ts          # Validação de expedições
│   │   └── index.ts
│   ├── store.ts                   # Persistência em memória
│   ├── api-client.ts              # Cliente HTTP do frontend
│   └── ui-labels.ts
└── types/game.ts                  # Tipos do domínio
```

## Mapeamento Requisitos → Implementação

| Req | Descrição | Onde |
|-----|-----------|------|
| RF01 | Configuração de partida (2 ou 3 jogadores) | `app/page.tsx` + `POST /api/games` |
| RF02 | Geração de baralho, mão inicial e fileira | `engine/setup.ts:createInitialGame` |
| RF03 | Turno: 1 de 2 ações (Recrutar / Lançar Expedição) | `engine/turns.ts:applyAction` |
| RF04 | Recrutar (display ou baralho) | `doGainFromDisplay`, `doGainFromDeck` |
| RF05 | Lançar expedição (líder + cartas + elo) | `doPlayExpedition` + `validation.ts` |
| RF06 | Descarte obrigatório (mão → fileira) | `doPlayExpedition` |
| RF07 | Avanço em trilha pela cor do líder | `tryAdvanceVehicleAtSite` |
| RF08 | Habilidades das 6 profissões | `applyLeaderRoleEffect` |
| RF09 | 3 Macacos na metade inferior; 3º termina temporada | `shuffleMonkeysIntoBottomHalf` + `drawFromDeckHandlingMonkeys` |
| RF10 | Pontuação: trilhas + tamanho de expedição | `finalizeSeason` + `pointsForExpeditionSize` |
| RNF02 | API REST com JSON | `app/api/games/**` |
| RNF03 | Otimizado para desktop | layout em colunas, sem media queries mobile |
| RNF04 | Versionamento Git | `.gitignore` configurado |
| RNF05 | Licença MIT | `LICENSE` |

## Profissões Implementadas

As 6 profissões do cenário inicial **Chichén Itzá** (livro p. 3):

| Profissão | Efeito |
|-----------|--------|
| **Botânico** | Imediato: se a expedição for ≥ que a do quadro, ganha o quadro (+2 pts). Fim de temporada: detentor do quadro ganha +2 pts. |
| **Linguista** | Imediato: avança N na trilha do Linguista. Cada artefato cruzado dá +1 avanço grátis em algum sítio. Fim de temporada: jogador mais avançado ganha +2 pts. |
| **Cartógrafo** | Imediato: se avançar veículo nesta expedição, pode jogar 1 expedição extra. |
| **Curador** | Imediato: coleta uma relíquia da cor do líder no museu (limite 1 por cor). Fim de jogo: pontos por relíquias distintas. |
| **Fotógrafo** | Fim de temporada: a expedição conta como tendo +1 carta para pontuação. |
| **Estudante** | Restrição: ao liderar, não avança veículo. Há 2x mais cartas dele no baralho. |

## Sítios Arqueológicos

Os 6 sítios do livro com 7 espaços (0..6) cada:

- **Chichén Itzá** (Vermelho — América do Norte) — *com efeito ONGOING avançado: ao avançar, compre 1 carta extra.*
- **Machu Picchu** (Verde — América do Sul)
- **Tantallon Castle** (Azul — Europa)
- **Great Zimbabwe** (Amarelo — África)
- **Sigirîya** (Rosa — Ásia)
- **Rapa Nui** (Roxo — Oceania)

## API REST

### `POST /api/games`
Cria uma nova partida.

```json
// Body
{ "playerNames": ["Alice", "Bruno"] }

// 201 Response
{ "game": <GameState> }
```

### `GET /api/games/:gameId`
Retorna o estado atual da partida.

### `POST /api/games/:gameId/action`
Aplica uma ação de jogador.

```json
// Body
{
  "playerId": "p1",
  "action": {
    "type": "PLAY_EXPEDITION",
    "leaderCardId": "c_42",
    "followerCardIds": ["c_15", "c_28"],
    "bond": { "type": "COLOR", "color": "RED" }
  }
}
```

Tipos de ação suportados:
- `{ type: "GAIN_FROM_DISPLAY", cardId }` — recruta carta da fileira
- `{ type: "GAIN_FROM_DECK" }` — compra carta do baralho
- `{ type: "PLAY_EXPEDITION", leaderCardId, followerCardIds, bond }` — lança expedição
- `{ type: "SKIP_CARTOGRAPHER_BONUS" }` — dispensa o bônus do Cartógrafo

## Notas de Implementação

- **Persistência**: o `store.ts` mantém partidas em memória do processo. Em produção real bastaria substituí-lo por uma camada de banco (Postgres, Redis, etc.).
- **Privacidade da mão**: o frontend possui um seletor "Visualizar como" para alternar a perspectiva entre jogadores na mesma máquina (modo passa-e-joga). Em uma versão multi-dispositivo a mão de outros jogadores deveria ser filtrada no servidor antes de retornar o estado.
- **Determinismo**: o RNG é seedável (`createRng`), permitindo testes reproduzíveis.

## Licença

MIT — veja [LICENSE](./LICENSE).
