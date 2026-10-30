// The only place a project's color shows: a small square left of a key or name.
export function ProjectSquare({ color, size = 'h-2 w-2' }: { color?: string; size?: string }) {
  return <span className={`${size} inline-block shrink-0 bg-gray-300`} style={color ? { background: color } : undefined} />
}
