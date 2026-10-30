// Stav prohlížečky v URL, aby šlo sdílet odkaz na konkrétní položku nebo hledání:
//   ?k=<klasifikace>&kod=<kód>&q=<dotaz>

export interface UrlState {
  classification: string | null
  code: string | null
  query: string
}

export function readUrl(): UrlState {
  const params = new URLSearchParams(window.location.search)
  return {
    classification: params.get('k'),
    code: params.get('kod'),
    query: params.get('q') ?? '',
  }
}

export function buildUrl(state: UrlState): string {
  const params = new URLSearchParams()
  if (state.classification) params.set('k', state.classification)
  if (state.code) params.set('kod', state.code)
  if (state.query.trim()) params.set('q', state.query.trim())
  const search = params.toString()
  return `${window.location.pathname}${search ? `?${search}` : ''}`
}

export function writeUrl(state: UrlState, mode: 'push' | 'replace'): void {
  const url = buildUrl(state)
  if (url === `${window.location.pathname}${window.location.search}`) return
  if (mode === 'push') window.history.pushState(null, '', url)
  else window.history.replaceState(null, '', url)
}
