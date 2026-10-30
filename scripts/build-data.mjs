// Převede Excel s klasifikací CCI (data/*.xlsx) do public/cci.json.
// Každý list = jedna klasifikace. Struktura listu:
//   řádek 3  … záhlaví (Úroveň 1..n, Název (ČJ), Vysvětlení (ČJ), Příklady (ČJ), Term (EN), Explanation (EN), Původ)
//   řádek 4  … definice samotné klasifikace
//   řádek 5  … popisek tabulky (přeskakuje se)
//   řádek 6+ … položky; kód je ve sloupci úrovně, do které položka patří
// Za sloupcem „Původ“ bývá nepojmenovaný sloupec s alternativním názvem.

import { readdir, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import readExcelFile from 'read-excel-file/node'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(root, 'data')
const outFile = path.join(root, 'public', 'cci.json')

const HEADER_ROW = 2
const META_ROW = 3
const FIRST_ITEM_ROW = 5

const files = (await readdir(dataDir)).filter((f) => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$')).sort()
if (files.length === 0) throw new Error(`Ve složce ${dataDir} není žádný .xlsx soubor.`)
const sourceFile = files.at(-1)

/** Sjednotí bílé znaky (Excel obsahuje ruční zalomení řádků) a odstraní BOM. */
function clean(value) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/﻿/g, '').replace(/\s+/g, ' ').trim()
}

function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function findColumn(header, prefix) {
  return header.findIndex((h) => clean(h).toLowerCase().startsWith(prefix.toLowerCase()))
}

function parseSheet({ sheet, data }) {
  const header = data[HEADER_ROW] ?? []
  const levelCols = header.flatMap((h, i) => (/^Úroveň\s*\d+/i.test(clean(h)) ? [i] : []))
  const col = {
    name: findColumn(header, 'Název'),
    description: findColumn(header, 'Vysvětlení'),
    examples: findColumn(header, 'Příklady'),
    nameEn: findColumn(header, 'Term'),
    descriptionEn: findColumn(header, 'Explanation'),
    origin: findColumn(header, 'Původ'),
  }
  if (levelCols.length === 0 || Object.values(col).some((i) => i < 0)) {
    throw new Error(`List „${sheet}“ nemá očekávané záhlaví: ${JSON.stringify(header)}`)
  }

  const items = []
  const lastAtLevel = []
  for (const row of data.slice(FIRST_ITEM_ROW)) {
    const levelIndex = levelCols.findIndex((i) => clean(row[i]) !== '')
    if (levelIndex < 0) continue
    const code = clean(row[levelCols[levelIndex]])
    const parent = levelIndex > 0 ? lastAtLevel[levelIndex - 1] ?? null : null
    lastAtLevel[levelIndex] = code
    lastAtLevel.length = levelIndex + 1

    const name = clean(row[col.name])
    const altName = clean(row.slice(col.origin + 1).find((c) => clean(c) !== ''))
    const item = {
      code,
      level: levelIndex + 1,
      parent,
      name,
      description: clean(row[col.description]),
      examples: clean(row[col.examples]),
      nameEn: clean(row[col.nameEn]),
      descriptionEn: clean(row[col.descriptionEn]),
      origin: clean(row[col.origin]),
      altName: altName.toLowerCase() !== name.toLowerCase() ? altName : '',
    }
    for (const key of Object.keys(item)) if (item[key] === '') delete item[key]
    items.push(item)
  }

  const codes = new Set(items.map((i) => i.code))
  const orphans = items.filter((i) => i.parent && !codes.has(i.parent))
  if (orphans.length) throw new Error(`List „${sheet}“: položky bez rodiče: ${orphans.map((o) => o.code).join(', ')}`)
  if (codes.size !== items.length) console.warn(`List „${sheet}“ obsahuje duplicitní kódy.`)

  const meta = data[META_ROW] ?? []
  return {
    id: slugify(sheet),
    name: sheet,
    term: clean(meta[col.name]),
    description: clean(meta[col.description]),
    termEn: clean(meta[col.nameEn]),
    descriptionEn: clean(meta[col.descriptionEn]),
    levels: levelCols.length,
    items,
  }
}

const sheets = await readExcelFile(path.join(dataDir, sourceFile))
const classifications = sheets.map(parseSheet).filter((c) => c.items.length > 0)

await mkdir(path.dirname(outFile), { recursive: true })
await writeFile(outFile, JSON.stringify({ source: sourceFile, classifications }))

console.log(`cci.json ← ${sourceFile}`)
for (const c of classifications) console.log(`  ${c.name}: ${c.items.length} položek, ${c.levels} úrovně`)
