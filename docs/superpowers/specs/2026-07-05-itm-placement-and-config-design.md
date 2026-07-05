# ITM da piazzamento 2°/3° + config nome + prompt parametri — Design

Data: 2026-07-05

## Contesto e obiettivi

Tre migliorie distinte ma coese, emerse dall'uso reale:

1. **ITM completo (2°/3° a premio).** La metrica ITM attuale conta solo le
   vittorie (`<name> wins the tournament and receives €X`, 1° posto). Ma
   PokerStars scrive anche i premi da 2°/3° con una riga diversa:
   `<name> finished the tournament in <N>th place and received €X.00.`
   Oggi questi ITM vengono persi. Verificato sui file reali: 1 caso storico
   (un 2° posto da €2 in uno Spin 10x). Il premio esatto È NEL FILE, quindi
   NON serve tabella payout né inferenza moltiplicatore.

2. **Nome giocatore in `.env`.** Oggi `--name` è obbligatorio ad ogni run.
   Va letto da un file `.env` (git-ignored) come `PLAYER_NAME`, con `--name`
   che lo sovrascrive se presente.

3. **Prompt interattivo dei parametri mancanti.** Oggi se manca un parametro
   obbligatorio il tool fallisce. Deve invece chiederlo interattivamente, con
   opzioni dove esistono (es. `view` = detail/graph/ev) e default sensati.

## 1. ITM da piazzamento

PokerStars usa DUE formati per i premi dell'eroe:
- 1° posto: `<name> wins the tournament and receives €X.00 - congratulations!`
- 2°/3° a premio: `<name> finished the tournament in <N>th place and received €X.00.`

Il discriminante di "a premio" è la presenza di `and received €` (2°/3°) o
`and receives €` (1°). I piazzamenti senza premio hanno solo
`finished the tournament in <N>th place` (senza `and received`).

**Regola ITM:** un torneo conta come ITM se l'eroe ha una riga
`wins the tournament and receives €` OPPURE
`finished the tournament in <N>th place and received €`.

Effetto sul codice esistente:
- `all-in-parser.js` (metrica `itm`): oggi lo scan usa
  `^<name>\b.*\breceives\b`. Va esteso per catturare anche `received`.
- `pl-parser.js` (`parsePrize`): oggi somma solo `receives €X`. Va esteso a
  includere anche `finished ... and received €X`, così il P/L del grafico
  conta correttamente i premi da 2°/3°.

Nessun cambiamento di architettura: si estendono le regex esistenti.

## 2. Config nome (`.env`)

- File `.env` nella root, git-ignored, con `PLAYER_NAME=Jeff81088`.
- Un piccolo modulo `src/config.js` legge `.env` (parsing manuale, nessuna
  dipendenza: leggere il file, splittare per riga su `KEY=VALUE`).
- Precedenza per il nome: `--name` da CLI > `PLAYER_NAME` da `.env` > prompt.
- `.env.example` versionato con `PLAYER_NAME=` come documentazione.
- Aggiungere `.env` a `.gitignore`.

## 3. Prompt parametri mancanti

Sostituisce il blocco `mandatoryFields`/`process.exit(1)` di `index.js`.
Per ogni parametro assente dopo aver applicato CLI + `.env` + default:

| Param | Default | Prompt |
|---|---|---|
| `name` | (da .env) | "Qual è il tuo nome PokerStars?" (testo) |
| `dir` | `./` | usa default silenzioso |
| `timestamp` | tutta la storia (`0`) | usa default silenzioso |
| `view` | (chiedi) | "[1] detail [2] graph [3] ev" |

- `name`: se assente da CLI e `.env`, lo chiede come testo libero.
- `view`: se assente, lo chiede con le tre opzioni numerate (è il prompt che
  esiste già per la scelta vista; va esteso perché parta anche quando manca
  solo il nome/altro, non solo la vista).
- `dir` e `timestamp`: default silenziosi (`./` e nessun filtro = `0`), niente
  prompt (scelta utente: "tutta la storia").
- Input non valido su `view` → ripete la domanda (comportamento già esistente).
- I prompt usano `readline` nativo (già in uso), quindi nessuna dipendenza.

## Architettura

- **`src/config.js`** (nuovo) — `loadEnv(envPath) => { PLAYER_NAME?: string }`.
  Pura: legge il file se esiste, parsa `KEY=VALUE` per riga, ignora righe vuote
  e commenti (`#`). Ritorna `{}` se il file non esiste.
- **`src/all-in-parser.js`** — estende la regex `itmRegex` per `received`.
- **`src/pl-parser.js`** — estende `parsePrize` per `finished ... received €X`.
- **`index.js`** — legge `.env` via `config.js`, risolve name (CLI>env), imposta
  default per dir/timestamp, e se `name` o `view` mancano usa readline per
  chiederli (prompt esistente esteso). Rimuove il vecchio `mandatoryFields`
  hard-fail.
- **`.env.example`**, **`.gitignore`** — file di supporto.

## Test

- `loadEnv`: file con `PLAYER_NAME=X` → `{PLAYER_NAME:'X'}`; file mancante →
  `{}`; righe commento/vuote ignorate.
- `parsePrize` (pl-parser): fixture con premio 2° (`finished ... received €2.00`)
  → prize 2. Fixture 1° (`receives €X`) invariata. Fixture senza premio → 0.
- `itm` (all-in-parser via parser): un file con solo `finished ... received`
  (2° a premio, senza vittoria) conta come itm 1.
- CLI: `--view=ev` con name da `.env` (senza `--name`) funziona; `--name` CLI
  sovrascrive `.env`; assenza di `--view` (con `--name` presente) avvia il
  prompt vista.
- Nota test: i test CLI passano sempre `--view` e `--name` per non attivare
  readline e non dipendere da `.env`.

## Edge case

- `.env` assente → nessun errore, si procede a CLI/prompt.
- Nome con caratteri regex-speciali → già gestito da `escapeRegExp` esistente
  nel parser; `parsePrize` usa già escaping.
- Premio con importo intero senza decimali (`€2`) → le regex accettano
  `\d+(?:[.,]\d+)?` (già così in pl-parser).
- Piazzamento senza premio (moltiplicatori winner-take-all) → nessun
  `and received` → non conta come ITM. Corretto.

## Fuori scope (YAGNI)

- Tabella payout / inferenza moltiplicatore: non serve, l'importo è nel file.
  (La tabella €1 resta documentata qui come riferimento, non nel codice.)
- Prompt per dir/timestamp: default silenziosi per scelta utente.
- Dipendenza `dotenv`: parsing manuale sufficiente.

## Riferimento: tabella payout Spin&Go €1 (solo documentazione)

Dalla schermata ufficiale PokerStars.it (buy-in €1):

| Mult | 1° | 2° | 3° |
|---|---|---|---|
| 3x, 4x, 5x | €3/€4/€5 | — | — |
| 10x | €8 | €2 | — |
| 25x | €20 | €3 | €2 |
| 50x | €40 | €6 | €4 |
| 100x | €80 | €12 | €8 |
| 12000x | €10000 | €1200 | €800 |

2° pagato da 10x; 3° pagato da 25x. Non usata dal codice (l'importo reale è
nel file), tenuta come validazione futura.
