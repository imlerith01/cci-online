/** České skloňování podle počtu: 1 položka, 2–4 položky, 5+ položek. */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one
  if (n >= 2 && n <= 4) return few
  return many
}
