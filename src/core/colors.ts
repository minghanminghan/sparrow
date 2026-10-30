// Tailwind 600/700 shades, readable as text on white cards. SPAR uses the first.
export const PROJECT_COLORS: string[] = [
  '#2563eb',
  '#dc2626',
  '#15803d',
  '#7c3aed',
  '#ea580c',
  '#0f766e',
  '#db2777',
  '#b45309',
  '#4f46e5',
  '#0369a1',
  '#a21caf',
  '#475569',
]

export function pickColor(used: string[]): string {
  const free = PROJECT_COLORS.filter((c) => !used.includes(c))
  const from = free.length ? free : PROJECT_COLORS
  return from[Math.floor(Math.random() * from.length)]
}
