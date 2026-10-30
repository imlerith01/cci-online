import type { KeyboardEvent, Ref } from 'react'

interface SearchBoxProps {
  value: string
  onChange: (value: string) => void
  onEnter: () => void
  onArrowDown: () => void
  inputRef: Ref<HTMLInputElement>
}

export function SearchBox({ value, onChange, onEnter, onArrowDown, inputRef }: SearchBoxProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') onEnter()
    else if (event.key === 'ArrowDown') onArrowDown()
    else if (event.key === 'Escape' && value) onChange('')
    else return
    event.preventDefault()
  }

  return (
    <div className="search" role="search">
      <svg className="search-icon" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="8.5" cy="8.5" r="5.5" />
        <path d="M13 13l4 4" />
      </svg>
      <label htmlFor="search-input" className="visually-hidden">
        Hledat v klasifikaci
      </label>
      <input
        id="search-input"
        ref={inputRef}
        type="search"
        autoComplete="off"
        spellCheck={false}
        placeholder="Hledat kód, název, popis nebo příklad…"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      {value ? (
        <button type="button" className="search-clear" onClick={() => onChange('')} aria-label="Vymazat hledání">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      ) : (
        <kbd className="search-kbd" aria-hidden="true">
          /
        </kbd>
      )}
    </div>
  )
}
