import { useEffect, type CSSProperties, type KeyboardEvent } from 'react'
import { ancestors } from '../data'
import type { IndexedClassification, TreeNode } from '../types'
import { Code } from './Highlight'
import { focusItem, itemId, scrollIntoPanel, scrollToOnMobile } from './itemFocus'

interface Column {
  level: number
  /** Vybraná položka o úroveň výš, jejíž potomky sloupec ukazuje. */
  parent: TreeNode | null
  nodes: TreeNode[]
  /** Text místo prázdného sloupce. */
  empty: string | null
}

function buildColumns(classification: IndexedClassification, path: TreeNode[]): Column[] {
  return Array.from({ length: classification.levels }, (_, i): Column => {
    const level = i + 1
    if (level === 1) return { level, parent: null, nodes: classification.roots, empty: null }
    const parent = path[level - 2]
    if (!parent) return { level, parent: null, nodes: [], empty: `Vyberte položku v úrovni ${level - 1}.` }
    return { level, parent, nodes: parent.children, empty: parent.children.length ? null : 'Bez podřazených položek.' }
  })
}

interface ColumnsProps {
  classification: IndexedClassification
  selected: TreeNode | null
  onSelect: (node: TreeNode, mode: 'push' | 'replace') => void
}

export function Columns({ classification, selected, onSelect }: ColumnsProps) {
  const path = selected ? [...ancestors(selected), selected] : []
  const columns = buildColumns(classification, path)

  // Vybraná cesta musí být vidět i v dlouhých sloupcích.
  useEffect(() => {
    if (!selected) return
    for (const node of [...ancestors(selected), selected]) {
      const el = document.getElementById(itemId(classification.id, node.item.code))
      if (el) scrollIntoPanel(el)
    }
  }, [classification.id, selected])

  const choose = (node: TreeNode) => {
    onSelect(node, 'push')
    const hasNext = node.item.level < classification.levels && node.children.length > 0
    scrollToOnMobile(hasNext ? `column-${node.item.level + 1}` : 'detail')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const code = (event.target as HTMLElement).closest<HTMLElement>('[data-code]')?.dataset.code
    const node = code ? classification.byCode.get(code) : undefined
    if (!node) return
    const list = columns[node.item.level - 1].nodes
    const index = list.indexOf(node)
    let next: TreeNode | undefined
    switch (event.key) {
      case 'ArrowDown':
        next = list[index + 1]
        break
      case 'ArrowUp':
        next = list[index - 1]
        break
      case 'Home':
        next = list[0]
        break
      case 'End':
        next = list.at(-1)
        break
      case 'ArrowRight':
        next = node.children[0]
        break
      case 'ArrowLeft':
        next = node.parent ?? undefined
        break
      case 'Enter':
      case ' ':
        onSelect(node, 'push')
        event.preventDefault()
        return
      default:
        return
    }
    event.preventDefault()
    if (!next) return
    onSelect(next, 'replace')
    focusItem(classification.id, next.item.code)
  }

  return (
    <div className="columns" style={{ '--levels': columns.length } as CSSProperties} onKeyDown={onKeyDown}>
      {columns.map((column, i) => {
        const onPath = path[i]
        const tabbable = onPath ?? column.nodes[0]
        return (
          <section key={column.level} id={`column-${column.level}`} className="column">
            <header className="column-head">
              <div className="column-title">
                <h2>Úroveň {column.level}</h2>
                {column.nodes.length > 0 && <span className="pill-count">{column.nodes.length}</span>}
              </div>
              {column.parent && (
                <p className="column-sub">
                  <Code code={column.parent.item.code} /> {column.parent.item.name}
                </p>
              )}
            </header>

            <div
              key={column.parent?.item.code ?? 'root'}
              className="column-body"
              role="listbox"
              aria-label={`Úroveň ${column.level}`}
            >
              {column.empty && <p className="column-empty">{column.empty}</p>}
              {column.nodes.map((node) => {
                const childCount = node.item.level < classification.levels ? node.children.length : 0
                const isSelected = node === selected
                const className = ['column-item', isSelected && 'is-selected', !isSelected && node === onPath && 'is-path']
                  .filter(Boolean)
                  .join(' ')
                return (
                  <div
                    key={node.item.code}
                    id={itemId(classification.id, node.item.code)}
                    data-code={node.item.code}
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={node === tabbable ? 0 : -1}
                    className={className}
                    onClick={() => choose(node)}
                  >
                    <Code code={node.item.code} className="column-code" />
                    <span className="column-name">{node.item.name}</span>
                    {childCount > 0 && (
                      <span className="column-more" aria-label={`${childCount} podřazených`}>
                        {childCount}
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                          <path d="M6 4l4 4-4 4" />
                        </svg>
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
