import type { IndexedClassification } from '../types'

interface TabsProps {
  classifications: IndexedClassification[]
  /** Aktivní klasifikace; null = při hledání „Vše“. */
  activeId: string | null
  /** Počet položek (nebo výsledků hledání) pro každou klasifikaci. */
  counts: Map<string, number>
  /** Při hledání záložky filtrují výsledky a přibude záložka „Vše“. */
  searching: boolean
  onChange: (id: string | null) => void
}

export function Tabs({ classifications, activeId, counts, searching, onChange }: TabsProps) {
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  const tabs: Array<{ id: string | null; name: string; count: number }> = [
    ...(searching ? [{ id: null, name: 'Vše', count: total }] : []),
    ...classifications.map((c) => ({ id: c.id, name: c.name, count: counts.get(c.id) ?? 0 })),
  ]

  return (
    <div className="tabs" role="tablist" aria-label="Klasifikace">
      {tabs.map(({ id, name, count }) => {
        const active = id === activeId
        return (
          <button
            key={id ?? 'all'}
            type="button"
            role="tab"
            aria-selected={active}
            className={`tab${active ? ' is-active' : ''}${searching && count === 0 ? ' is-empty' : ''}`}
            onClick={() => onChange(id)}
          >
            {active && <span className="tab-dot" aria-hidden="true" />}
            {name}
            <span className="tab-count">{count.toLocaleString('cs-CZ')}</span>
          </button>
        )
      })}
    </div>
  )
}
