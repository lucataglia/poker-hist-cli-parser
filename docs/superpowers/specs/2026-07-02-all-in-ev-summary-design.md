# All-in EV summary — Design

Data: 2026-07-02

## Obiettivo

Aggiungere una terza vista alla CLI (`--view=ev`) che mostra il risultato
degli all-in **depurato dalla fortuna**: confronta le chip realmente vinte con
le chip attese (equity × pot) al momento dell'all-in, aggregando su tutti i
tornei del range `--timestamp`.

## Concetto (per l'utente)

Ad ogni all-in, il risultato dipende dalla bontà della decisione (equity) e
dalla fortuna (le carte uscite dopo). Questa vista separa le due cose:

- **actual** = chip realmente portate a casa dal pot (`collected`), 0 se perso.
- **ev** = equity al momento dell'all-in × pot totale della mano.
- **luck = actual − ev**: positivo = runni sopra EV (fortunato); negativo =
  sotto EV (sfortunato, ma stai giocando bene).

L'equity è calcolata col board **parziale visibile al momento dell'all-in**
(preflop = 0 carte, flop = 3, turn = 4), non a river completo — è il valore
atteso della decisione. In split pot l'equity monetaria usa `win% + tie%/2`.

## Attivazione

- Nuovo valore per il flag esistente: `--view=ev`.
- Il prompt interattivo (quando `--view` è assente) aggiunge una terza opzione:
  `[3] All-in EV summary`.
- `--view=detail` e `--view=graph` restano invariati.

## Dati e limiti

Calcolabile solo per gli all-in dell'eroe che arrivano a **showdown con carte
mostrate** (servono le carte dei villain per l'equity). All-in vinti senza
showdown, o villain che muckano senza mostrare, sono esclusi: non si conoscono
le carte avversarie. L'output dichiara esplicitamente "showdown hands only" per
onestà. Nei file reali ~60% delle mani arriva a showdown con carte visibili.

Gli all-in **vinti E persi** a showdown sono inclusi (a differenza della vista
detail attuale, che filtra `and won`).

## Output (esempio)

```
All-in EV summary (showdown hands only)

  All-ins analyzed        42
  Actual chips won      8450
  Expected chips (EV)   7900
  Luck (actual - EV)     +550
  Avg equity when all-in  53.2%
```

- `luck` colorato: verde se ≥ 0, rosso se < 0.
- Se nessun all-in a showdown nel range → messaggio "No all-in showdowns found".

## Architettura

Moduli nuovi/toccati (detail e graph non cambiano):

- **`src/ev-parser.js`** (nuovo) — funzione pura
  `parseAllInEV(fileContent, playerName) => { spots, totals }` dove:
  - `spots`: array di `{ equity, pot, actual }` (uno per all-in a showdown con
    carte visibili in cui l'eroe è coinvolto).
  - `totals`: `{ count, actualChips, evChips, avgEquity }`.
  - `equity` è una frazione 0..1 (`(win% + tie%/2) / 100`).
  - Nessun `console.log`, nessuno stato globale, nessuna lettura di `argv`.
    Riusa `poker-odds-calc` (TexasHoldem) come `all-in-parser.js`.
- **`src/helpers/index.js`** — `renderEVSummary(totals) => string`, stile
  riquadro coerente con `printEquityStats`.
- **`src/parse-files/sync.js`** — `buildAllInEV(directory, timeFilter, playerName)
  => totals` che legge i file del range, chiama `parseAllInEV` per file, e
  somma spots/totali. Media equity pesata sul numero di spot.
- **`index.js`** — `--view=ev` nel dispatch e nel prompt.

## Come si identifica uno spot (parsing)

Per ogni mano (split su `PokerStars Hand`):
1. La mano contiene `all-in` E l'eroe (`playerName`) è coinvolto in un all-in.
2. Si arriva a `*** SHOW DOWN ***` e almeno i villain coinvolti mostrano le
   carte (`shows [..]`).
3. `pot` = numero dopo `Total pot` (primo intero).
4. `actual` = intero dopo `<playerName> ... collected` se presente, altrimenti 0.
5. Carte di ogni giocatore mostrato: dalla riga `<name>: shows [X Y]`.
6. `board` al momento dell'all-in: ricostruito come già fa `all-in-parser.js`
   (le carte visibili quando l'ultimo all-in avviene). Se preflop, board vuoto.

## Test

- `parseAllInEV` sulle due fixture esistenti:
  - fixture 1 (hero all-in preflop, perde a showdown): 1 spot, `actual` 0,
    `equity` ~0.26 (Qs4d vs 4cAh preflop), `pot` dal file.
  - fixture 2 (hero all-in, vince a showdown): 1 spot, `actual` = pot raccolto,
    `equity` > 0.5, `pot` dal file.
- `renderEVSummary` snapshot su totali costruiti a mano: verifica presenza dei
  campi, segno/colore di luck, formattazione avg equity.
- `buildAllInEV` sulle fixture: aggrega i due spot, `count` 2.
- CLI: `--view=ev` mostra il riquadro EV e non il detail/graph.

## Edge case

- Nessun all-in a showdown → `renderEVSummary` con messaggio "No all-in
  showdowns found", non crash.
- Split pot (tie) → equity usa `win% + tie%/2`.
- Multi-way all-in (3 giocatori) → equity dell'eroe vs tutti; il motore la
  gestisce. `pot` = Total pot dell'intera mano.
- Side pot: si usa comunque `Total pot` (approssimazione accettabile; i side
  pot in 3-max sono rari e piccoli). Documentato come limite.

## Fuori scope (YAGNI)

- ICM-adjusted EV (serve payout table completa degli Spin&Go, non nei file).
- Griglia preflop posizionale (feature successiva).
- All-in non mostrati / equity stimata su range (non calcolabile senza carte).
