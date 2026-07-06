# Vista graph: dettaglio giornaliero + riepilogo totale — Design

Data: 2026-07-06

## Obiettivo

Nella vista `--view=graph`, prima del grafico a barre esistente, aggiungere:
1. Un **dettaglio per giorno**: sotto ogni data, una riga per ogni torneo giocato
   quel giorno.
2. Un **riepilogo totale** finale: tornei vinti (ITM) / persi / giocate + € netto
   complessivo.

Il grafico a barre esistente resta invariato (viene dopo il dettaglio).

## 1. Dettaglio per giorno

Per ogni data (ordine cronologico), l'intestazione data e sotto una riga per torneo:

```
04 Jul 2026
  Spin&Go 1€ [8€]  2°  +1.00€
  Spin&Go 1€ [3€]  1°  +2.00€
  torneo 1€        3°  -1.00€
```

Campi della riga torneo:
- **Nome**: `Spin&Go` se il montepremi (moltiplicatore) è deducibile dal file,
  altrimenti `torneo`. (Deducibile = il file contiene una riga
  `<qualcuno> wins the tournament and receives €X`.)
- **buy-in**: dall'header, somma delle parti `€A+€B` → intero/decimale € (es. `1€`).
- **[montepremi]**: SOLO se deducibile. È il premio del 1° posto = X della riga
  winner. Formato `[8€]`. Omesso del tutto (niente parentesi) se non deducibile.
- **posizione**: `1°`/`2°`/`3°` (da `wins the tournament` = 1°, o
  `finished the tournament in Nth place`).
- **netto**: quanto l'eroe ha incassato − buy-in. Verde se ≥ 0, rosso se < 0.
  Formato `+1.00€` / `-1.00€`.

Ordinamento tornei nel giorno: cronologico (per timestamp del file, che è già
l'ordine di `HH<data>` + numero torneo; in pratica ordine di lettura stabile).

## 2. Riepilogo totale

Alla fine (dopo il grafico, o prima — vedi layout), una riga/box:

```
Vinti (ITM): 43   Persi: 79   Giocate: 122   Netto: -12.50€
```

- **Vinti (ITM)**: tornei a premio (prize > 0). [già calcolato: somma degli `itm`]
- **Persi**: tornei senza premio (giocate − ITM).
- **Giocate**: totale tornei nel range.
- **Netto**: somma dei netti (Σ premi − Σ buy-in), verde se ≥ 0, rosso se < 0.

Nota: "Vinti" qui = ITM (a premio), come chiarito dall'utente. Non solo 1° posto.

## Dati e derivazione (tutto nei file)

Per ogni file (torneo):
- **buyIn**: header `€A+€B EUR` → A+B (già fatto da `parseBuyIn` in pl-parser).
- **prize**: quanto l'eroe ha incassato (`receives`/`received €X`) → già `parsePL`.
- **net** = prize − buyIn → già `parsePL` (`pl`).
- **position**: `wins the tournament` → 1; `finished the tournament in Nth place`
  → N. Nuovo campo.
- **prizePool** (montepremi 1° posto): la prima riga
  `wins the tournament and receives €X` nel file → X. `null` se assente. Nuovo campo.
- **isSpin**: `prizePool !== null` (se c'è il montepremi lo trattiamo come Spin).
- **date**: da `extractTimeFromFilename`.

## Architettura

- **`src/pl-parser.js`** — estendere `parsePL` per restituire anche `position`
  (numero 1/2/3, o null) e `prizePool` (numero €, o null). Resta puro.
- **`src/parse-files/sync.js`** — nuovo `buildDailyDetail(directory, timeFilter,
  playerName)` che ritorna, per ogni giorno, `{ date, tournaments: [{ buyIn,
  prizePool, position, net, isSpin }], ... }` e i totali complessivi
  `{ won (itm), lost, played, netTotal }`. Riusa `parsePL`. `buildDailyPL` resta
  invariato (il grafico lo usa ancora).
- **`src/helpers/index.js`** — `renderDailyDetail(days)` (le righe per giorno) e
  `renderDailySummary(totals)` (il riepilogo). Colori con `chalk`.
- **`index.js`** — nel branch `graph`: stampare `renderDailyDetail` PRIMA del
  grafico, e `renderDailySummary` alla fine.

## Colori (gestiti internamente)

- Netto per torneo e netto totale: verde se ≥ 0, rosso se < 0.
- Data: neutro/bold per leggibilità.
- Posizione: 1° in verde tenue (vittoria), 2°/3° neutri (o 2° giallo se a premio).
  Scelta pragmatica: 1° verde, gli altri neutri; il colore informativo è sul netto.
- `Spin&Go`/`torneo` + buy-in + `[montepremi]`: neutri.

## Test

- `parsePL`: fixture 1° posto → position 1, prizePool = suo prize; fixture 2° a
  premio → position 2, prizePool = premio winner nel file; fixture senza winner
  line → prizePool null (→ `torneo`).
- `buildDailyDetail`: aggrega per giorno; ogni torneo ha i campi; i totali
  won/lost/played/netTotal coerenti (won+lost = played).
- `renderDailyDetail`: intestazione data + righe; "Spin&Go" quando prizePool
  presente, "torneo" quando null; niente `[...]` quando null; netto colorato.
- `renderDailySummary`: mostra Vinti/Persi/Giocate/Netto con colore su netto.
- CLI `--view=graph`: l'output contiene sia il dettaglio giornaliero sia il
  grafico a barre esistente sia il riepilogo.

## Edge case

- Torneo senza montepremi deducibile (3° posto tipico) → `torneo`, niente `[€]`.
- Nessun torneo nel range → dettaglio vuoto + grafico "Nessun dato" (già gestito).
- buy-in con virgola/punto → già gestito da parseBuyIn.
- Più tornei stesso giorno → più righe sotto la stessa data.

## Fuori scope (YAGNI)

- Ordinamento per orario preciso (basta l'ordine stabile di lettura file).
- Deduzione del montepremi quando assente (non nei file, come da decisione utente).
