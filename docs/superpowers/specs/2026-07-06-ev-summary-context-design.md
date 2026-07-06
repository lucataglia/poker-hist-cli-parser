# EV summary: periodo, tornei, EV in bb, %≥50%, nota campione — Design

Data: 2026-07-06

## Obiettivo

Arricchire la vista `--view=ev` (All-in EV summary) con contesto e metriche utili
per un grinder Spin&Go. Oggi mostra solo count/actual/EV/luck/avg-equity, senza
sapere QUALE periodo si sta guardando né quanto è affidabile il campione.

## Nuove righe da aggiungere

Sopra le metriche attuali, un blocco di contesto:

- **Period** — prima e ultima data dei tornei effettivamente analizzati nel range,
  formato italiano abbreviato: `Period: 04 Jul 2026 → 06 Jul 2026`. Se un solo
  giorno: `Period: 04 Jul 2026`. Se nessun torneo: riga assente (già gestito il
  caso "No all-in showdowns found").
- **Tournaments** — numero di tornei (file) analizzati nel range: `Tournaments: 37`.

Sotto le metriche attuali:

- **All-in EV converte anche in bb**: accanto a `Expected chips (EV)` e
  `Actual chips won`, mostrare l'equivalente in big blind. bb-per-spot = big blind
  della mano dell'all-in (dal `Level X (sb/bb)` nell'header, secondo numero).
  Totale in bb = somma per spot di `chips / bb`. Mostrato come:
  `Actual (bb)  717.0` / `Expected (bb)  810.0` / `Luck (bb)  -93.0`.
- **% all-in ≥ 50% equity** — quota di spot in cui l'eroe era favorito:
  `All-in ahead (≥50%): 62%`.
- **Nota campione** — se `count < 30`, una riga finale:
  `⚠ Small sample (<30 all-ins) — treat as indicative only`.

## Perché bb e non solo chip

Le chip non sono comparabili tra livelli di blind diversi (100 chip al Level I
10/20 valgono 5bb; al Level VI 50/100 valgono 1bb). Convertendo ogni spot in bb
col big blind DEL SUO livello, i numeri diventano confrontabili nel tempo e tra
tornei. La conversione è per-spot, non sul totale.

## Dati e derivazione

Tutto derivabile dai file, nessun dato esterno:
- **Period**: `extractTimeFromFilename` (già esistente) sui file del range; min e max.
- **Tournaments**: numero di file HH nel range (già enumerati da `buildAllInEV`).
- **bb per spot**: dall'header della mano dell'all-in, `Level ... (\d+/(\d+))` →
  secondo numero. Ogni mano ha questo header (verificato). Nuovo campo `bb` nello
  spot restituito da `parseAllInEV`.
- **% ≥50%**: conteggio spot con `equity >= 0.5` / count.

## Architettura (estende, non riscrive)

- **`src/ev-parser.js`** — `parseHandSpot` estrae anche `bb` (big blind dal Level
  dell'header); lo spot diventa `{ equity, pot, actual, bb }`. `parseAllInEV`
  aggrega in `totals` anche: `evBb`, `actualBb` (somma per-spot di chips/bb),
  `aheadCount` (spot con equity ≥ 0.5).
- **`src/parse-files/sync.js`** — `buildAllInEV` accumula i nuovi campi tra i file,
  e in più calcola `tournaments` (numero file), `periodStart`/`periodEnd`
  (min/max data dai nomi file). Ritorna tutto in un oggetto totals esteso.
- **`src/helpers/index.js`** — `renderEVSummary` mostra le nuove righe. Riusa
  `formatDateShort` (già esistente) per le date, estendendolo o formattando qui
  con anno. Nota campione condizionale.

## Formati

- Date periodo: `DD Mmm YYYY` (es. `04 Jul 2026`). `formatDateShort` oggi dà
  `DD Mmm` senza anno; per il periodo serve l'anno → funzione dedicata o parametro.
- bb: una cifra decimale (`717.0`).
- Luck (chip e bb): verde se ≥ 0, rosso se < 0 (come oggi).
- % ahead: intero con `%`.

## Test

- `parseHandSpot`/`parseAllInEV`: fixture con BB noto (es. Level V 40/80 → bb 80);
  spot ha `bb: 80`; se pot=300 e equity 0.5 → evBb per spot = 150/80.
- `buildAllInEV`: su fixtures, `tournaments` = numero file nel range;
  `periodStart`/`periodEnd` = min/max data; `aheadCount` coerente.
- `renderEVSummary`: mostra Period, Tournaments, righe bb, % ahead; con `count<30`
  mostra la nota campione; con `count>=30` NON la mostra.
- Snapshot: nessun crash con count 0 (già "No all-in showdowns found").

## Edge case

- Un solo giorno → `Period: 04 Jul 2026` (niente `→`).
- bb mancante in un header (non dovrebbe succedere) → salta la conversione bb per
  quello spot (non contarlo nel totale bb) ma tienilo nei chip. Documentato.
- count 0 → messaggio esistente, nessuna riga extra.

## Fuori scope (YAGNI)

- EV in € (servirebbe il valore chip→€, non lineare negli Spin). Restiamo su bb.
- Grafico dell'EV nel tempo.
