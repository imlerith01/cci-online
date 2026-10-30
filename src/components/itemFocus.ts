// Pomocné funkce pro práci s položkami ve sloupcích a ve výsledcích hledání (fokus, posun).

export function itemId(classificationId: string, code: string): string {
  return `item-${classificationId}-${code}`
}

export function resultId(classificationId: string, code: string): string {
  return `result-${classificationId}-${code}`
}

/** Přesune fokus na prvek s daným id, až bude vykreslený (mohl vzniknout teprve výběrem nebo přepnutím). */
export function focusLater(id: string): void {
  setTimeout(() => document.getElementById(id)?.focus())
}

export function focusItem(classificationId: string, code: string): void {
  focusLater(itemId(classificationId, code))
}

/** Posune jen panel (ne celou stránku) tak, aby byl prvek vidět. */
export function scrollIntoPanel(el: HTMLElement): void {
  const body = el.closest<HTMLElement>('.column-body, .results-body')
  if (!body || body.scrollHeight <= body.clientHeight) return
  const margin = 40
  const top = el.offsetTop
  const bottom = top + el.offsetHeight
  if (top - margin < body.scrollTop) body.scrollTop = top - margin
  else if (bottom + 8 > body.scrollTop + body.clientHeight) body.scrollTop = bottom + 8 - body.clientHeight
}

/** Na mobilu jsou panely pod sebou – po výběru posuneme stránku na další panel. */
export function scrollToOnMobile(id: string): void {
  if (!window.matchMedia('(max-width: 759px)').matches) return
  setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
