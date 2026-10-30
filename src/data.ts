import { fold, SEARCH_FIELDS } from './search'
import type { Classification, Dataset, IndexedClassification, TreeNode } from './types'

export async function loadDataset(): Promise<Dataset> {
  const response = await fetch(`${import.meta.env.BASE_URL}cci.json`)
  if (!response.ok) throw new Error(`Nepodařilo se načíst data (${response.status}).`)
  return response.json()
}

function indexClassification(classification: Classification): IndexedClassification {
  const { items, ...meta } = classification
  const byCode = new Map<string, TreeNode>()
  const roots: TreeNode[] = []
  const nodes: TreeNode[] = []
  const countsByLevel = Array.from({ length: classification.levels }, () => 0)

  for (const item of items) {
    const parent = item.parent ? byCode.get(item.parent) ?? null : null
    const folded: TreeNode['folded'] = {}
    for (const field of SEARCH_FIELDS) if (item[field]) folded[field] = fold(item[field])
    const node: TreeNode = {
      item,
      parent,
      children: [],
      index: nodes.length,
      haystack: Object.values(folded).join('\n'),
      folded,
    }
    byCode.set(item.code, node)
    nodes.push(node)
    countsByLevel[item.level - 1]++
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  return { ...meta, roots, byCode, nodes, countsByLevel }
}

export function indexDataset(dataset: Dataset): IndexedClassification[] {
  return dataset.classifications.map(indexClassification)
}

export function ancestors(node: TreeNode): TreeNode[] {
  const path: TreeNode[] = []
  for (let n = node.parent; n; n = n.parent) path.unshift(n)
  return path
}
