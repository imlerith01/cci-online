import { useEffect, useState, type KeyboardEvent } from 'react'
import { ancestors } from '../data'
import { plural } from '../format'
import { excerpt, FIELD_LABELS, type Hit, type HitGroup } from '../search'
import type { TreeNode } from '../types'
import { Code, Highlight } from './Highlight'
import { focusLater, resultId, scrollIntoPanel, scrollToOnMobile } from './itemFocus'

/** Kolik výsledků jedné klasifikace ukázat, než je potřeba kliknout na „Zobrazit další“. */
const PAGE = 25

interface SearchResultsProps {
  groups: HitGroup[]
  query: string
  tokens: string[]
  /** Název klasifikace, pokud je hledání omezené záložkou. */
  scopeName: string | null
  /** Počet shod ve všech klasifikacích – pro nabídku zrušit omezení. */
  totalAll: number
  onClearScope: () => void
  selected: { classificationId: string; node: TreeNode } | null
  onSelect: (classificationId: string, node: TreeNode, mode: 'push' | 'replace') => void
  onExit: () => void
}

export function SearchResults(props: SearchResultsProps) {
  const { groups, query, tokens, scopeName, totalAll, onClearScope, selected, onSelect, onExit } = props
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const shown = groups.map((g) => ({
    ...g,
    visible: expanded.has(g.classification.id) ? g.hits : g.hits.slice(0, PAGE),
  }))
  const flat = shown.flatMap((g) => g.visible.map((hit) => ({ classificationId: g.classification.id, hit })))
  const total = groups.reduce((sum, g) => sum + g.hits.length, 0)
  const selectedId = selected ? resultId(selected.classificationId, selected.node.item.code) : null

  useEffect(() => {
    const el = selectedId && document.getElementById(selectedId)
    if (el) scrollIntoPanel(el)
  }, [selectedId])

  const choose = (classificationId: string, node: TreeNode, mode: 'push' | 'replace') => {
    onSelect(classificationId, node, mode)
    focusLater(resultId(classificationId, node.item.code))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const id = (event.target as HTMLElement).closest<HTMLElement>('[role="option"]')?.id
    const index = flat.findIndex((r) => resultId(r.classificationId, r.hit.node.item.code) === id)
    if (index < 0) return
    const target =
      event.key === 'ArrowDown'
        ? flat[index + 1]
        : event.key === 'ArrowUp'
          ? flat[index - 1]
          : event.key === 'Home'
            ? flat[0]
            : event.key === 'End'
              ? flat.at(-1)
              : undefined
    if (event.key === 'Escape') onExit()
    else if (target) choose(target.classificationId, target.hit.node, 'replace')
    else if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
  }

  return (
    <section className="results" aria-label="Výsledky hledání">
      <header className="results-head">
        <h2>
          {total.toLocaleString('cs-CZ')} {plural(total, 'výsledek', 'výsledky', 'výsledků')} pro „{query.trim()}“
        </h2>
        <p>
          {scopeName
            ? `v klasifikaci ${scopeName}`
            : groups.length > 1
              ? `ve ${groups.length} klasifikacích, nejrelevantnější nahoře`
              : 'nejrelevantnější nahoře'}
        </p>
      </header>

      <div className="results-body" role="listbox" aria-label="Výsledky hledání" onKeyDown={onKeyDown}>
        {total === 0 && (
          <div className="results-empty">
            <p>{scopeName ? `V klasifikaci ${scopeName} nic nenalezeno.` : 'Nic nenalezeno. Zkuste jiné nebo kratší slovo.'}</p>
            {scopeName && totalAll > 0 && (
              <button type="button" className="btn btn-outline" onClick={onClearScope}>
                Hledat ve všech klasifikacích <span className="tab-count">{totalAll}</span>
              </button>
            )}
          </div>
        )}

        {shown.map((group) => (
          <div key={group.classification.id} role="group" aria-label={group.classification.name}>
            <h3 className="results-group">
              {group.classification.name}
              <span className="pill-count">{group.hits.length}</span>
            </h3>
            {group.visible.map((hit, i) => (
              <Result
                key={hit.node.item.code}
                classificationId={group.classification.id}
                hit={hit}
                tokens={tokens}
                selected={selectedId === resultId(group.classification.id, hit.node.item.code)}
                tabbable={selectedId ? selectedId === resultId(group.classification.id, hit.node.item.code) : group === shown[0] && i === 0}
                onClick={() => {
                  choose(group.classification.id, hit.node, 'push')
                  scrollToOnMobile('detail')
                }}
              />
            ))}
            {group.visible.length < group.hits.length && (
              <button
                type="button"
                className="btn btn-ghost results-more"
                onClick={() => setExpanded((prev) => new Set(prev).add(group.classification.id))}
              >
                Zobrazit další ({group.hits.length - group.visible.length})
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

interface ResultProps {
  classificationId: string
  hit: Hit
  tokens: string[]
  selected: boolean
  tabbable: boolean
  onClick: () => void
}

function Result({ classificationId, hit, tokens, selected, tabbable, onClick }: ResultProps) {
  const { item } = hit.node
  const path = ancestors(hit.node)
  const snippet = hit.snippetField ? item[hit.snippetField] : undefined
  return (
    <div
      id={resultId(classificationId, item.code)}
      role="option"
      aria-selected={selected}
      tabIndex={tabbable ? 0 : -1}
      className={`result${selected ? ' is-selected' : ''}`}
      onClick={onClick}
    >
      <Code code={item.code} tokens={tokens} className="result-code" />
      <div className="result-main">
        <div className="result-name">
          <Highlight text={item.name} tokens={tokens} />
        </div>
        {path.length > 0 && (
          <div className="result-path">
            {path.map((a) => (
              <span key={a.item.code}>
                <Code code={a.item.code} /> {a.item.name}
              </span>
            ))}
          </div>
        )}
        {snippet && (
          <div className="result-snippet">
            <span className="result-field">{FIELD_LABELS[hit.snippetField!]}:</span>{' '}
            <Highlight text={excerpt(snippet, tokens)} tokens={tokens} />
          </div>
        )}
      </div>
    </div>
  )
}
