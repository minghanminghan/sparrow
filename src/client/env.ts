// The dev server's data source, set on <html> by the root layout. Unset in production builds.
export function devEnv(): string | undefined {
  return typeof document === 'undefined' ? undefined : document.documentElement.dataset.env
}

// Keeps the browser cache and outbox of the local DB apart from those of prod.
export function storageKey(name: string): string {
  const env = devEnv()
  return env ? `${name}:${env}` : name
}
