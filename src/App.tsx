import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Columns } from './components/Columns'
import { Detail } from './components/Detail'
import { focusItem, focusLater, itemId, resultId } from './components/itemFocus'
import { SearchBox } from './components/SearchBox'
import { SearchResults } from './components/SearchResults'
import { Tabs } from './components/Tabs'
import { indexDataset, loadDataset } from './data'
import { groupHits, searchHits, tokenize, type Hit } from './search'
import type { IndexedClassification, TreeNode } from './types'
import { readUrl, writeUrl } from './url'

interface Loaded {
  classifications: IndexedClassification[]
  source: string
}

export default function App() {
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDataset()
      .then((d) => setData({ classifications: indexDataset(d), source: d.source }))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  if (error)
    return (
      <Shell>
        <p className="status">{error}</p>
      </Shell>
    )
  if (!data)
    return (
      <Shell>
        <p className="status">Načítám klasifikaci…</p>
      </Shell>
    )
  return <Browser {...data} />
}

function Shell({ children, source }: { children: ReactNode; source?: string }) {
  return (
    <div className="page">
      <header className="topbar">
        <a className="wordmark" href="/">
          <span className="wordmark-sphere" aria-hidden="true" />
          CCI online
        </a>
        {source && <span className="topbar-meta">Zdroj dat: {source}</span>}
      </header>
      <section className="hero">
        <h1>Klasifikace CCI</h1>
        <p>
          Prohlížečka klasifikačního systému CCI (Construction Classification International) pro stavebnictví.
          Procházejte úrovně klasifikace nebo hledejte podle kódu, názvu, vysvětlení a příkladů.
        </p>
      </section>
      {children}
    </div>
  )
}

type UrlMode = 'push' | 'replace'

function initialState(classifications: IndexedClassification[]) {
  const url = readUrl()
  const active = classifications.find((c) => c.id === url.classification) ?? classifications[0]
  const code = url.code && active.byCode.has(url.code) ? url.code : null
  return {
    activeId: active.id,
    selected: { [active.id]: code } as Record<string, string | null>,
    query: url.query,
  }
}

function searchAll(classifications: IndexedClassification[], query: string): Map<string, Hit[]> | null {
  if (tokenize(query).length === 0) return null
  return new Map(classifications.map((c) => [c.id, searchHits(c, query)]))
}

function Browser({ classifications, source }: Loaded) {
  const [init] = useState(() => initialState(classifications))
  const [activeId, setActiveId] = useState(init.activeId)
  // Každá klasifikace si pamatuje svůj výběr, aby o něj přepnutí záložky nepřipravilo.
  const [selectedByTab, setSelectedByTab] = useState(init.selected)
  const [query, setQuery] = useState(init.query)
  // Při hledání záložky jen filtrují výsledky; null = všechny klasifikace.
  const [scope, setScope] = useState<string | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const urlMode = useRef<UrlMode>('replace')
  const pendingFocus = useRef<string | null>(null)

  const active = classifications.find((c) => c.id === activeId) ?? classifications[0]
  const selectedCode = selectedByTab[active.id] ?? null
  const selected = selectedCode ? active.byCode.get(selectedCode) ?? null : null

  const deferredQuery = useDeferredValue(query)
  const tokens = useMemo(() => tokenize(deferredQuery), [deferredQuery])
  const results = useMemo(() => searchAll(classifications, deferredQuery), [classifications, deferredQuery])
  const searching = results !== null
  const groups = useMemo(() => (results ? groupHits(classifications, results, scope) : []), [classifications, results, scope])

  const counts = useMemo(
    () => new Map(classifications.map((c) => [c.id, results ? results.get(c.id)!.length : c.nodes.length])),
    [classifications, results],
  )

  // Synchronizace stavu do URL.
  useEffect(() => {
    writeUrl({ classification: activeId, code: selectedCode, query }, urlMode.current)
    urlMode.current = 'replace'
  }, [activeId, selectedCode, query])

  // Zpět/vpřed v prohlížeči.
  useEffect(() => {
    const onPopState = () => {
      const url = readUrl()
      const target = classifications.find((c) => c.id === url.classification) ?? classifications[0]
      const code = url.code && target.byCode.has(url.code) ? url.code : null
      setActiveId(target.id)
      setSelectedByTab((prev) => ({ ...prev, [target.id]: code }))
      setQuery(url.query)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [classifications])

  // Klávesa „/“ přesune kurzor do vyhledávání.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.key !== '/' || target.closest('input, textarea, [contenteditable="true"]')) return
      event.preventDefault()
      searchRef.current?.focus()
      searchRef.current?.select()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Výška lepicí lišty – podle ní se počítá výška panelů.
  useEffect(() => {
    const el = toolbarRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--toolbar-h', `${el.offsetHeight}px`)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Fokus na položku, která se teprve vykreslí – výsledky i sloupce se kvůli useDeferredValue
  // mohou objevit až o render později než změna dotazu.
  useEffect(() => {
    const el = pendingFocus.current && document.getElementById(pendingFocus.current)
    if (!el) return
    el.focus()
    pendingFocus.current = null
  })

  const selectIn = (classificationId: string, node: TreeNode | null, mode: UrlMode) => {
    urlMode.current = mode
    setActiveId(classificationId)
    setSelectedByTab((prev) => ({ ...prev, [classificationId]: node?.item.code ?? null }))
  }
  const select = (node: TreeNode | null, mode: UrlMode = 'push') => selectIn(active.id, node, mode)

  const changeQuery = (value: string) => {
    // Nové hledání začíná ve všech klasifikacích.
    if (!query.trim() && value.trim()) setScope(null)
    setQuery(value)
  }

  const changeTab = (id: string | null) => {
    if (searching) setScope(id)
    if (id && id !== activeId) {
      urlMode.current = 'push'
      setActiveId(id)
    }
  }

  const showInHierarchy = () => {
    if (selected) pendingFocus.current = itemId(active.id, selected.item.code)
    urlMode.current = 'push'
    setQuery('')
  }

  // Klávesy z vyhledávání pracují s aktuálním textem, ne s odloženým (useDeferredValue) – při rychlém
  // psaní a Enteru by jinak výsledky ještě neodpovídaly dotazu.
  const firstResult = () => {
    const live = searchAll(classifications, query)
    const group = live ? groupHits(classifications, live, scope)[0] : undefined
    return group ? { classificationId: group.classification.id, node: group.hits[0].node } : null
  }

  const openFirstResult = () => {
    // Na mobilu Enter jen schová klávesnici, výsledky zůstanou vidět.
    if (window.matchMedia('(max-width: 759px)').matches) {
      searchRef.current?.blur()
      return
    }
    const first = firstResult()
    if (!first) return
    selectIn(first.classificationId, first.node, 'push')
    pendingFocus.current = resultId(first.classificationId, first.node.item.code)
  }

  const focusPanels = () => {
    if (tokenize(query).length > 0) {
      const live = searchAll(classifications, query)
      const inResults = selected && live?.get(active.id)?.some((hit) => hit.node === selected)
      if (inResults && (!scope || scope === active.id)) focusLater(resultId(active.id, selected.item.code))
      else openFirstResult()
      return
    }
    const target = selected ?? active.roots[0]
    select(target, 'replace')
    focusItem(active.id, target.item.code)
  }

  const scopeName = scope ? classifications.find((c) => c.id === scope)?.name ?? null : null

  return (
    <Shell source={source}>
      <div className="toolbar" ref={toolbarRef}>
        <SearchBox
          value={query}
          onChange={changeQuery}
          inputRef={searchRef}
          onEnter={openFirstResult}
          onArrowDown={focusPanels}
        />
        <Tabs
          classifications={classifications}
          activeId={searching ? scope : active.id}
          counts={counts}
          searching={searching}
          onChange={changeTab}
        />
      </div>

      <main className="browser">
        {searching ? (
          <SearchResults
            key={deferredQuery}
            groups={groups}
            query={deferredQuery}
            tokens={tokens}
            scopeName={scopeName}
            totalAll={[...results.values()].reduce((sum, hits) => sum + hits.length, 0)}
            onClearScope={() => setScope(null)}
            selected={selected ? { classificationId: active.id, node: selected } : null}
            onSelect={selectIn}
            onExit={() => searchRef.current?.focus()}
          />
        ) : (
          <Columns key={active.id} classification={active} selected={selected} onSelect={select} />
        )}

        <Detail
          classification={active}
          node={selected}
          tokens={tokens}
          onSelect={(node) => select(node)}
          onShowInHierarchy={searching ? showInHierarchy : undefined}
        />
      </main>

      <footer className="footer">
        <span>
          {classifications.length} klasifikací ·{' '}
          {classifications.reduce((sum, c) => sum + c.nodes.length, 0).toLocaleString('cs-CZ')} položek
        </span>
        <span>Data: {source}</span>
      </footer>
    </Shell>
  )
}
