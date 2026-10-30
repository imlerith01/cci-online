import type { IndexedClassification, SearchField, TreeNode } from './types'

const COMBINING_MARKS = /[̀-ͯ]/g

/** Odstraní diakritiku a převede na malá písmena, aby „strecha“ našlo „Střecha“. */
export function fold(text: string): string {
  return text.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase()
}

interface Term {
  /** Hledaný text (u delších slov bez koncovky). */
  text: string
  /**
   * U čtyřpísmenných slov jen jiný tvar téhož slova: kmen + nejvýš jedno písmeno, celé slovo
   * („voda“ → vody, vodu, ale ne vodič ani rozvod).
   */
  shortForm: RegExp | null
  /** Původní slovo dotazu. */
  word: string
}

/**
 * Velmi hrubé ořezání české koncovky, aby „strecha“ našlo i „střechy“ a „voda“ i „vody“.
 * Kódy (např. „AA?“) a slova bez samohlásky na konci zůstávají beze změny.
 */
function toTerm(word: string): Term {
  if (/^[a-z]+$/.test(word) && /[aeiouy]$/.test(word)) {
    const stem = word.slice(0, -1)
    if (word.length >= 5) return { text: stem, shortForm: null, word }
    if (word.length === 4) return { text: stem, shortForm: new RegExp(`(^|[^a-z0-9])${stem}[a-z]?($|[^a-z0-9])`), word }
  }
  return { text: word, shortForm: null, word }
}

function parse(query: string): Term[] {
  return fold(query).split(/\s+/).filter(Boolean).map(toTerm)
}

/** Slova dotazu ve tvaru, v jakém se hledají – používá se i pro zvýraznění. */
export function tokenize(query: string): string[] {
  return parse(query).map((t) => t.text)
}

function contains(text: string | undefined, term: Term): boolean {
  if (!text) return false
  if (!term.shortForm) return text.includes(term.text)
  return text.includes(term.word) || term.shortForm.test(text)
}

/** Prohledávaná pole v pořadí důležitosti. */
export const SEARCH_FIELDS: SearchField[] = ['code', 'name', 'altName', 'description', 'examples', 'nameEn', 'descriptionEn']

/** Čím menší váha, tím výš ve výsledcích; shoda v kódu nebo názvu je nejdůležitější. */
const FIELD_WEIGHT: Record<SearchField, number> = {
  code: 0,
  name: 0,
  altName: 1,
  description: 2,
  examples: 2,
  nameEn: 3,
  descriptionEn: 4,
}

export const FIELD_LABELS: Record<SearchField, string> = {
  code: 'Kód',
  name: 'Název',
  altName: 'Alternativní název',
  description: 'Vysvětlení',
  examples: 'Příklady',
  nameEn: 'Anglicky',
  descriptionEn: 'Explanation',
}

const SNIPPET_FIELDS: SearchField[] = ['altName', 'examples', 'description', 'nameEn', 'descriptionEn']

export interface Hit {
  node: TreeNode
  /** Pole se shodou, která není vidět v kódu ani názvu – zobrazí se z něj úryvek. */
  snippetField: SearchField | null
  /** Klíč řazení (menší = relevantnější), porovnává se po složkách. */
  rank: number[]
}

export function compareRank(a: number[], b: number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

function rankNode(node: TreeNode, terms: Term[], phrase: string): Hit {
  const f = node.folded
  const name = f.name ?? ''
  const code = (f.code ?? '').replace(/\?+$/, '')
  const exact = name === phrase || code === phrase ? 0 : 1
  const weightOf = (t: Term) =>
    SEARCH_FIELDS.reduce((best, k) => (contains(f[k], t) ? Math.min(best, FIELD_WEIGHT[k]) : best), 9)
  const weakest = Math.max(...terms.map(weightOf))
  const wordStart = terms.every((t) => ` ${name}`.includes(` ${t.text}`) || code.startsWith(t.text)) ? 0 : 1

  const outsideName = terms.filter((t) => !contains(name, t) && !contains(code, t))
  const snippetField = outsideName.length
    ? SNIPPET_FIELDS.find((k) => outsideName.some((t) => contains(f[k], t))) ?? null
    : null

  return { node, snippetField, rank: [exact, weakest, wordStart, node.index] }
}

/** Všechny shody v klasifikaci seřazené podle relevance. */
export function searchHits(classification: IndexedClassification, query: string): Hit[] {
  const terms = parse(query)
  if (terms.length === 0) return []
  const phrase = fold(query).trim().replace(/\s+/g, ' ')
  const hits: Hit[] = []
  for (const node of classification.nodes) {
    if (terms.every((t) => contains(node.haystack, t))) hits.push(rankNode(node, terms, phrase))
  }
  return hits.sort((a, b) => compareRank(a.rank, b.rank))
}

export interface HitGroup {
  classification: IndexedClassification
  hits: Hit[]
}

/** Skupiny výsledků po klasifikacích; nejdřív ta, která má nejlepší shodu. */
export function groupHits(
  classifications: IndexedClassification[],
  results: Map<string, Hit[]>,
  scope: string | null,
): HitGroup[] {
  return classifications
    .filter((c) => (!scope || c.id === scope) && results.get(c.id)!.length > 0)
    .map((c) => ({ classification: c, hits: results.get(c.id)! }))
    .sort((a, b) => compareRank(a.hits[0].rank.slice(0, 3), b.hits[0].rank.slice(0, 3)))
}

/**
 * Najde úseky textu odpovídající slovům dotazu (bez ohledu na diakritiku).
 * S `wholeWords` se zvýraznění protáhne do konce slova („čerpadl|o“ → „čerpadlo“).
 */
export function findRanges(text: string, tokens: string[], wholeWords = true): Array<[number, number]> {
  if (tokens.length === 0 || !text) return []

  // Složený text může mít jinou délku než původní, proto si pamatujeme mapování indexů.
  let folded = ''
  const origin: number[] = []
  for (let i = 0; i < text.length; i++) {
    for (const ch of fold(text[i])) {
      folded += ch
      origin.push(i)
    }
  }

  const ranges: Array<[number, number]> = []
  for (const token of tokens) {
    for (let at = folded.indexOf(token); at !== -1; at = folded.indexOf(token, at + token.length)) {
      let end = origin[at + token.length - 1] + 1
      if (wholeWords) while (end < text.length && /\p{L}/u.test(text[end])) end++
      ranges.push([origin[at], end])
    }
  }
  ranges.sort((a, b) => a[0] - b[0])

  const merged: Array<[number, number]> = []
  for (const r of ranges) {
    const last = merged.at(-1)
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([r[0], r[1]])
  }
  return merged
}

/** Krátký úryvek kolem první shody, aby bylo vidět, proč položka hledání odpovídá. */
export function excerpt(text: string, tokens: string[], radius = 50): string {
  const first = findRanges(text, tokens, false)[0]
  if (!first || text.length <= radius * 3) return text
  let start = Math.max(0, first[0] - radius)
  let end = Math.min(text.length, first[1] + radius * 2)
  if (start > 0) {
    const space = text.indexOf(' ', start)
    if (space !== -1 && space < first[0]) start = space + 1
  }
  if (end < text.length) {
    const space = text.lastIndexOf(' ', end)
    if (space > first[1]) end = space
  }
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
}
