import { useState } from 'react'
import { ancestors } from '../data'
import { plural } from '../format'
import type { IndexedClassification, TreeNode } from '../types'
import { buildUrl } from '../url'
import { Code, Highlight } from './Highlight'

interface DetailProps {
  classification: IndexedClassification
  node: TreeNode | null
  tokens: string[]
  onSelect: (node: TreeNode | null) => void
  /** Při hledání: ukončí hledání a ukáže položku ve sloupcích úrovní. */
  onShowInHierarchy?: () => void
}

export function Detail({ classification, node, tokens, onSelect, onShowInHierarchy }: DetailProps) {
  return (
    <aside id="detail" className="detail" aria-label="Detail položky">
      {node ? (
        <ItemDetail
          key={node.item.code}
          classification={classification}
          node={node}
          tokens={tokens}
          onSelect={onSelect}
          onShowInHierarchy={onShowInHierarchy}
        />
      ) : (
        <Overview classification={classification} searching={tokens.length > 0} />
      )}
    </aside>
  )
}

// Pořadí odpovídá důležitosti: kód a název, český popis, a teprve pak doplňkové údaje.
function ItemDetail({ classification, node, tokens, onSelect, onShowInHierarchy }: DetailProps & { node: TreeNode }) {
  const { item } = node
  const path = ancestors(node)
  const secondary: Array<[string, string | undefined, string?]> = [
    ['Anglicky', item.nameEn, 'en'],
    ['Explanation', item.descriptionEn, 'en'],
    ['Alternativní název', item.altName],
  ]

  return (
    <div className="detail-inner">
      <nav className="crumbs" aria-label="Umístění v hierarchii">
        <button type="button" onClick={() => onSelect(null)}>
          {classification.name}
        </button>
        {path.map((a) => (
          <button type="button" key={a.item.code} onClick={() => onSelect(a)} title={a.item.name}>
            <Code code={a.item.code} />
          </button>
        ))}
      </nav>

      {onShowInHierarchy && (
        <button type="button" className="btn btn-outline detail-locate" onClick={onShowInHierarchy}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <rect x="1.5" y="3" width="3.6" height="10" rx="1" />
            <rect x="6.2" y="3" width="3.6" height="10" rx="1" />
            <rect x="10.9" y="3" width="3.6" height="10" rx="1" />
          </svg>
          Zobrazit v hierarchii
        </button>
      )}

      <div className="detail-head">
        <Code code={item.code} tokens={tokens} className="detail-code" />
        <h2 className="detail-title">
          <Highlight text={item.name} tokens={tokens} />
        </h2>
      </div>

      {(item.description || item.examples) && (
        <dl className="fields">
          {item.description && (
            <div className="field">
              <dt>Vysvětlení</dt>
              <dd>
                <Highlight text={item.description} tokens={tokens} />
              </dd>
            </div>
          )}
          {item.examples && (
            <div className="field">
              <dt>Příklady</dt>
              <dd>
                <Highlight text={item.examples} tokens={tokens} />
              </dd>
            </div>
          )}
        </dl>
      )}

      <div className="detail-actions">
        <CopyButton label="Kopírovat kód" text={item.code} primary />
        <CopyButton label="Kód a název" text={`${item.code} ${item.name}`} />
        <CopyButton
          label="Odkaz"
          text={() =>
            window.location.origin + buildUrl({ classification: classification.id, code: item.code, query: '' })
          }
        />
      </div>

      <dl className="secondary">
        {secondary.map(([label, value, lang]) =>
          value ? (
            <div key={label}>
              <dt>{label}</dt>
              <dd lang={lang}>
                <Highlight text={value} tokens={tokens} />
              </dd>
            </div>
          ) : null,
        )}
        <div>
          <dt>Úroveň</dt>
          <dd>{item.level}</dd>
        </div>
        {item.origin && (
          <div>
            <dt>Původ</dt>
            <dd>{item.origin}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}

function Overview({ classification, searching }: { classification: IndexedClassification; searching: boolean }) {
  const total = classification.countsByLevel.reduce((a, b) => a + b, 0)
  return (
    <div className="detail-inner overview">
      <div className="sphere" aria-hidden="true" />
      <p className="eyebrow">Klasifikace</p>
      <h2 className="detail-title">{classification.name}</h2>
      {classification.description && <p className="overview-text">{classification.description}</p>}
      <div className="stats">
        <div>
          <strong>{total.toLocaleString('cs-CZ')}</strong>
          <span>{plural(total, 'položka', 'položky', 'položek')}</span>
        </div>
        {classification.countsByLevel.map((count, i) => (
          <div key={i}>
            <strong>{count.toLocaleString('cs-CZ')}</strong>
            <span>úroveň {i + 1}</span>
          </div>
        ))}
      </div>
      <p className="hint">
        {searching
          ? 'Vyberte výsledek hledání – zobrazí se tu jeho detail.'
          : 'Vyberte položku v úrovni 1, nebo začněte psát do vyhledávání.'}
      </p>
      {(classification.termEn || classification.descriptionEn) && (
        <dl className="secondary">
          <div>
            <dt>Anglicky</dt>
            <dd lang="en">
              {classification.termEn}
              {classification.descriptionEn && ` – ${classification.descriptionEn}`}
            </dd>
          </div>
        </dl>
      )}
    </div>
  )
}

function CopyButton({ label, text, primary }: { label: string; text: string | (() => string); primary?: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(typeof text === 'function' ? text() : text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Schránka nemusí být dostupná (např. bez HTTPS); tlačítko pak nic neudělá.
    }
  }
  return (
    <button type="button" className={`btn ${primary ? 'btn-filled' : 'btn-outline'}`} onClick={copy}>
      {copied ? 'Zkopírováno' : label}
    </button>
  )
}
