# CCI online

Online prohlížečka klasifikace CCI (Construction Classification International). Zobrazuje všech pět klasifikací
z Excelu (Stavební entity, Vybudované prostory, Funkční systém, Technický systém, Komponenty) a umožňuje
fulltextové vyhledávání.

- **Hierarchie ve sloupcích** – každá úroveň má vlastní panel (Úroveň 1 | Úroveň 2 | Úroveň 3), další panel
  ukazuje podřazené položky vybrané položky. Ovládání šipkami (↑ ↓ v úrovni, ← → mezi úrovněmi). Na mobilu
  jsou úrovně pod sebou.
- **Detail** – nejvýrazněji kód a název, pod nimi vysvětlení a příklady; anglický překlad, alternativní název,
  úroveň a původ jsou v tlumeném bloku „doplňkových údajů“.
- **Hledání** – v kódu, českém i anglickém názvu, vysvětlení, příkladech a alternativním názvu; bez ohledu
  na diakritiku a velikost písmen, s jednoduchým ořezáním koncovek („voda“ najde i „vody“), víc slov = všechna
  musí sedět. Místo sloupců se ukáže seznam výsledků ze všech klasifikací seřazený podle relevance (shoda
  v kódu/názvu nahoře). U každého výsledku je cesta v hierarchii a úryvek, pokud se shoda našla jinde než
  v názvu. Záložky výsledky filtrují, „Zobrazit v hierarchii“ ukáže položku ve sloupcích. Enter otevře první
  výsledek, ↑↓ procházejí výsledky, Esc vrátí kurzor do hledání, `/` skočí do vyhledávání.
- **Sdílitelné odkazy** – stav je v URL, např. `/?k=komponenty&kod=GPA` nebo `/?k=stavebni-entity&q=garáž`.

Technicky jde o statický web (Vite + React + TypeScript), takže na Vercelu nepotřebuje žádný server.

## Lokální spuštění

```bash
npm install
npm run dev
```

Aplikace poběží na <http://localhost:5173>. Produkční build: `npm run build` (výstup ve složce `dist/`).

## Aktualizace dat

Data se čtou z Excelu ve složce `data/` při každém `npm run dev` / `npm run build` skriptem
[`scripts/build-data.mjs`](scripts/build-data.mjs), který vytvoří `public/cci.json` (ten se necommituje).

Novou verzi klasifikace nahrajete tak, že **nahradíte soubor v `data/`** a pushnete – Vercel web sám přestaví.
Pokud je ve složce víc `.xlsx`, použije se abecedně poslední (např. `CCI_komplet_20240101.xlsx` má přednost
před `CCI_komplet_20220910.xlsx`).

Skript očekává tuto strukturu každého listu (list = jedna klasifikace):

| Řádek | Obsah |
|-------|-------|
| 3 | záhlaví: `Úroveň 1` … `Úroveň n`, `Název (ČJ)`, `Vysvětlení (ČJ)`, `Příklady (ČJ)`, `Term (EN)`, `Explanation (EN)`, `Původ` |
| 4 | definice samotné klasifikace (zobrazí se v přehledu) |
| 6+ | položky – kód je ve sloupci úrovně, do které položka patří (`A??` → `AA?` → `AAA`) |

První neprázdný sloupec za `Původ` (v současném Excelu nepojmenovaný sloupec R) se zobrazuje jako
„Alternativní název“, pokud se liší od názvu. Když list záhlaví nemá nebo některá položka nemá rodiče,
build skončí chybou s popisem problému.

## Nasazení na Vercel

1. Pushněte repozitář na GitHub.
2. Na [vercel.com/new](https://vercel.com/new) importujte repozitář. Framework se rozpozná sám (Vite):
   build `npm run build`, výstup `dist`.
3. Každý push do hlavní větve se automaticky nasadí, pull requesty dostanou náhledovou URL.

## Struktura

```
data/                  zdrojový Excel s klasifikací
scripts/build-data.mjs převod Excel → public/cci.json
src/App.tsx            stav aplikace, URL, rozvržení
src/components/        Columns (panely úrovní), SearchResults, Detail, SearchBox, Tabs, Highlight
src/search.ts          normalizace textu, hledání, řazení podle relevance, zvýraznění
src/styles.css         vzhled podle DESIGN.md
```
