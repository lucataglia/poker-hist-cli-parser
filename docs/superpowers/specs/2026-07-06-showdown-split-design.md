# Showdown / Non-showdown winnings — Design

Data: 2026-07-06

## Obiettivo

Aggiungere al riquadro `--view=ev` due nuove righe: le chip vinte/perse in mani
andate a **showdown** (blu, PT4) e quelle in mani finite **senza showdown**
(rosso, PT4 "red line"), in bb. È la metrica PT4 "Showdown / Non-Showdown
Winnings". Per ora solo numeri, non grafico.

## Concetto (PT4)

Ogni mano finisce in esattamente uno dei due secchi:
- **Showdown**: l'eroe è arrivato a vedere le carte (`*** SHOW DOWN ***` presente
  E l'eroe NON ha foldato prima).
- **Non-showdown**: la mano è finita prima per l'eroe (tutti gli altri hanno
  foldato, oppure l'eroe ha foldato prima dello showdown).

Identità: `Total = Showdown + Non-Showdown`.

Convenzione segni (netto per mano = chip raccolte − chip messe nel piatto):
- Rubi i bui / fai foldare tutti prima dello showdown → non-showdown positivo.
- Posti un buio e foldi, o punti e ti arrendi → non-showdown negativo.
- Il red line negativo è normale (i bui costano); è un leak solo se scende ripido.

## Classificazione showdown-per-eroe (importante)

NON basta la presenza di `*** SHOW DOWN ***`: gli avversari possono andare a
showdown dopo che l'eroe ha foldato. Regola robusta: l'eroe è andato a showdown
se e solo se la mano contiene `*** SHOW DOWN ***` E l'eroe NON ha una riga
`<name>: folds` prima E il summary non dice `<name> ... folded`.
Verificato su file reali: esiste il caso "SHOW DOWN presente ma Jeff folded on
the Flop" → per l'eroe è non-showdown.

## Calcolo del netto per mano — metodo primario + oracolo di verifica

Scelta: metodo A come primario runtime, metodo B come oracolo di test; verificare
che combacino in chip (tolleranza 0) su tutte le fixture.

- **Metodo A — delta stack (PRIMARIO runtime)**: netto = `stackIniziale(mano
  successiva) − stackIniziale(mano corrente)`, dove lo stack iniziale è la riga
  `Seat N: <name> (X in chips)`. Banalmente corretto: immune a raise incrementali
  e uncalled bet (già riflessi nello stack). Verificato su caso reale complicato
  (raise all-in con uncalled: 270→10 = −260, corretto).
  L'ULTIMA mano di ogni torneo non ha "successiva" → fallback: se l'eroe ha una
  riga `finished the tournament`, netto = `−stackIniziale` (busta, perde tutto);
  altrimenti (ha vinto il torneo → è l'ultima mano) netto = metodo B su quella
  mano.
- **Metodo B — azioni − collected (ORACOLO di test)**: netto = `Σ(collected
  dell'eroe) − contributo`, dove `contributo = Σ_street( max importo impegnato
  dall'eroe su quello street ) − Σ(uncalled bet returned all'eroe)`. Per ogni
  street, l'importo impegnato dell'eroe è: il `to` più alto dei suoi `raises N to
  M` su quello street (M), altrimenti la somma di bet/call, più i bui postati
  preflop se non superati da un raise. Regola pratica robusta: per street prendi
  il MASSIMO tra (somma call+bet dell'eroe su quello street) e (il più alto `to`
  dei raise dell'eroe su quello street); somma i bui/ante come impegno preflop
  già incluso nel primo raise/call. ATTENZIONE: `raises N to M` → M è il TOTALE
  impegnato su quello street, NON un incremento da sommare al blind.

Nessun ante nei file (verificato). L'eroe è seduto in tutte le mani (verificato).

**Verifica incrociata (test di correttezza)**: su tutte le fixture, per ogni mano
in cui A è definito (cioè tranne l'ultima mano-non-bust di ogni torneo), il
netto-chip di A e B deve coincidere esattamente. Se divergono, il test fallisce.
Serve a blindare la regola sottile del contributo in B e la correttezza di A.

## Unità

bb, come PT4 e come l'EV summary esistente. Per ogni mano: netto in bb =
nettoChip / bigBlind della mano (dal `Level (sb/bb)` header, secondo numero).
Somma per secchio. Mostrare anche il totale (= somma dei due) come sanity.

## Output (aggiunte al riquadro `--view=ev`)

Sotto le righe esistenti, un blocco nuovo:

```
  Showdown (bb)          +120.5
  Non-showdown (bb)      -70.5
  ... (Total winnings bb = 50.0)  [opzionale, come verifica]
```

- Showdown/Non-showdown: verde se ≥ 0, rosso se < 0 (come luck).
- Il blocco appare solo se ci sono mani analizzate (riusa il guard esistente).

## Architettura

- **`src/lines-parser.js`** (nuovo) — parser puro `parseShowdownSplit(fileContent,
  playerName) => { sdBb, nonSdBb, sdChips, nonSdChips, hands }`. Usa il metodo A
  (delta-stack) per il netto, la classificazione showdown-per-eroe, e converte in
  bb col big blind di ogni mano. Nessun console.log/argv/globals.
- **`src/lines-oracle.js`** (nuovo, SOLO per test) — `netByActions(handText,
  playerName) => chips` (metodo B). Usato dal test di verifica incrociata.
- **`src/parse-files/sync.js`** — `buildShowdownSplit(directory, timeFilter,
  playerName)` aggrega su tutti i file: somma sdBb/nonSdBb/sdChips/nonSdChips/hands.
- **`src/helpers/index.js`** — `renderEVSummary` mostra le nuove righe (i totali
  arrivano già calcolati; passati dentro l'oggetto totals o come secondo arg).
- **`index.js`** — `showEV` chiama anche `buildShowdownSplit` e passa i risultati
  a `renderEVSummary`.

## Test

- `parseShowdownSplit`: fixture note. Mano dove l'eroe ruba i bui (non-showdown
  positivo); mano dove posta e folda (non-showdown negativo); mano a showdown
  vinta (showdown positivo); mano con SHOW DOWN ma eroe foldato prima
  (classificata non-showdown).
- Verifica incrociata A vs B: su tutte le fixture, netto-chip per mano identico.
- `buildShowdownSplit`: aggrega su più file; hands = mani totali; sd+nonsd chips =
  netto totale.
- `renderEVSummary`: mostra le due righe con segno/colore; assenti se count 0.

## Edge case

- Ultima mano del torneo (no "successiva"): netto da metodo B (oracolo) o
  −stackIniziale se busta. Documentato; il metodo A da solo la gestisce con
  fallback a B per l'ultima mano.
- Split/side pot: sommare tutte le righe `collected` dell'eroe (metodo B); il
  metodo A (delta-stack) le gestisce nativamente.
- bb mancante in un header (non dovrebbe): salta la conversione bb di quella mano.
- Rake: già riflesso nei `collected` (post-rake) e nello stack; nessun modello.

## Fuori scope (YAGNI)

- Grafico cumulativo blu/rosso (fase successiva; per ora solo i totali).
- Cash game / formati diversi.
