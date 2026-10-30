// Tvar dat v public/cci.json (viz scripts/build-data.mjs).

export interface Item {
  code: string
  level: number
  parent: string | null
  name: string
  description?: string
  examples?: string
  nameEn?: string
  descriptionEn?: string
  origin?: string
  altName?: string
}

export interface Classification {
  id: string
  name: string
  term: string
  description: string
  termEn: string
  descriptionEn: string
  levels: number
  items: Item[]
}

export interface Dataset {
  source: string
  classifications: Classification[]
}

/** Prohledávaná pole položky. */
export type SearchField = 'code' | 'name' | 'altName' | 'description' | 'examples' | 'nameEn' | 'descriptionEn'

export interface TreeNode {
  item: Item
  parent: TreeNode | null
  children: TreeNode[]
  /** Pořadí v Excelu – poslední kritérium řazení výsledků. */
  index: number
  /** Text všech prohledávaných polí bez diakritiky a malými písmeny. */
  haystack: string
  /** Jednotlivá pole bez diakritiky – pro řazení výsledků podle toho, kde se shoda našla. */
  folded: Partial<Record<SearchField, string>>
}

export interface IndexedClassification extends Omit<Classification, 'items'> {
  roots: TreeNode[]
  byCode: Map<string, TreeNode>
  /** Všechny uzly v pořadí jako v Excelu (pre-order). */
  nodes: TreeNode[]
  countsByLevel: number[]
}
