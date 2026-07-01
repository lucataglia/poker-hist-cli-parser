# Grafico P/L giornaliero — Design

Data: 2026-07-01
Branch: `fix/parser-bugs` (o branch dedicato)

## Obiettivo

Aggiungere alla CLI una seconda vista: un grafico a barre divergenti orizzontali
che mostra il profit/loss (P/L) reale in euro per ogni giornata di gioco. La vista
attuale (dettaglio degli all-in) resta invariata; l'utente sceglie quale vedere.

## Attivazione

- Nuovo flag `--view` con valori `detail` | `graph`.
- Se `--view` è assente, la CLI chiede interattivamente via `readline` (nativo Node,
  nessuna dipendenza nuova):

  ```
  Cosa vuoi vedere?
    [1] Dettaglio all-in (vista attuale)
    [2] Grafico P/L giornaliero
  >
  ```

  Input `1` → detail, `2` → graph. Input non valido → ripete la domanda.
- `--view=detail` / `--view=graph` saltano il prompt (scriptabile, testabile).

## Calcolo del P/L

Per ogni file (= un torneo):

- **Buy-in**: parsato dall'header, es. `€0.91+€0.09 EUR`. Somma delle due parti
  (prize pool + rake) = costo del torneo. Regex sull'header, gestisce sia `.` che `,`
  come separatore decimale. Fallback €1.00 se non parsabile (con log a stderr).
- **Premio**: riga `^<argvName>\b.*\breceives €X` → incasso in euro. 0 se il giocatore
  non arriva a premio (riga assente).
- **P/L torneo** = premio − buy-in.

Raggruppamento per data: la data si estrae dal nome file `HH<YYYYMMDD>` (helper
`extractTimeFromFilename` già esistente). Per ogni data si sommano i P/L dei tornei
e si conta il numero di tornei. Risultato: array ordinato cronologicamente di
`{ date: 'YYYYMMDD', pl: number, games: number }`.

## Rendering

Layout: barra piena colorata, asse centrale verticale, scala automatica sul massimo
`|P/L|` della sessione.

```
30 Giu │ ▓▓▓▓▓▓▓▓ 3.00€  (5)
01 Lug ▓▓▓ │ -1.00€        (10)
02 Lug │ ▓▓ 0.50€       (3)
       └───┼──────────
```

Regole:

- Asse **globale** condiviso da tutte le righe: giorni positivi si estendono a destra,
  negativi a sinistra, specchiati sullo stesso asse `│`.
- Barre **verdi tenui** (P/L ≥ 0) a destra, **rosse tenui** (P/L < 0) a sinistra,
  tramite `chalk` (già dipendenza). Tenue = varianti non-bright / dim.
- Larghezza massima barra = costante configurabile (es. 30 caratteri). Il giorno con
  `|P/L|` massimo occupa la larghezza piena; gli altri proporzionali (arrotondati,
  minimo 1 carattere se P/L ≠ 0).
- Ogni riga: `<data abbreviata IT> <barra> <valore €> (<n tornei>)`.
- Date in formato italiano abbreviato: `30 Giu`, `01 Lug`.

## Architettura

Moduli nuovi/toccati (la vista detail non cambia):

- **`src/pl-parser.js`** (nuovo) — funzione pura
  `parsePL(fileContent, playerName) → { prize, buyIn, pl }`.
  Nessun `console.log`, nessuno stato globale, nessuna lettura di `argv`. Primo mattone
  del futuro parser puro.
- **`src/helpers/index.js`** — aggiunge `renderPLChart(dailyData) → string` e
  `formatDateShortIt(yyyymmdd) → '30 Giu'`. Solo stringhe, testabili.
- **`src/parse-files/sync.js`** — aggiunge `buildDailyPL(directory, timeFilter, playerName) → dailyData[]`
  che legge la stessa lista file filtrata per `--timestamp`, chiama `parsePL` per file,
  aggrega per data. La funzione `parseAllOldFiles` esistente resta invariata.
- **`index.js`** — legge `--view`; se assente, prompt via `readline`; dispaccia:
  `detail` → flusso attuale, `graph` → `buildDailyPL` + `renderPLChart` + print.

## Test

- `parsePL` sulle due fixture esistenti:
  - fixture 1 (T1000000001): hero perde all-in, non arriva a premio → prize 0,
    buyIn 1.00, pl −1.00.
  - fixture 2 (T1000000002): hero vince torneo, `receives €2.00` → prize 2.00,
    buyIn 1.00, pl +1.00.
- `renderPLChart` snapshot su dati costruiti a mano: verifica segno (barra a sx/dx),
  proporzioni, presenza valore e conteggio.
- `formatDateShortIt('20260630') === '30 Giu'`.
- Test CLI: `--view=graph` produce il grafico e non il dettaglio; `--view=detail`
  produce il dettaglio.

## Edge case

- Giorno con P/L esattamente 0 → nessuna barra, solo asse.
- Un solo giorno di dati → grafico con una riga.
- Import italiani con virgola (`€2,00`) o punto (`€2.00`): entrambi gestiti.
- Nessun file nel range `--timestamp` → messaggio "nessun dato", non crash.

## Fuori scope (YAGNI)

- Grafici cumulativi / equity curve nel tempo.
- Export su file / immagine.
- Raggruppamenti diversi dal giorno (settimana, mese).
