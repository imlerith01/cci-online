import type { ReactNode } from 'react'
import { findRanges } from '../search'

/** Vykreslí text se zvýrazněnými výskyty hledaných slov. */
export function Highlight({ text, tokens, wholeWords }: { text: string; tokens: string[]; wholeWords?: boolean }) {
  const ranges = findRanges(text, tokens, wholeWords)
  if (ranges.length === 0) return <>{text}</>

  const parts: ReactNode[] = []
  let pos = 0
  for (const [start, end] of ranges) {
    if (start > pos) parts.push(text.slice(pos, start))
    parts.push(<mark key={start}>{text.slice(start, end)}</mark>)
    pos = end
  }
  if (pos < text.length) parts.push(text.slice(pos))
  return <>{parts}</>
}

/** Kód třídy; zástupné „?“ na konci (např. „AA?“) jsou vykresleny tlumeně. */
export function Code({ code, tokens = [], className = '' }: { code: string; tokens?: string[]; className?: string }) {
  const base = code.replace(/\?+$/, '')
  const wildcard = code.slice(base.length)
  return (
    <span className={`code ${className}`} aria-label={code}>
      <Highlight text={base} tokens={tokens} wholeWords={false} />
      {wildcard && <span className="code-wildcard">{wildcard}</span>}
    </span>
  )
}
