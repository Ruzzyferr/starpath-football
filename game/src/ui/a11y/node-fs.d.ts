// Minimal typing so token tests can read tokens.css without pulling in @types/node.
declare module 'node:fs' {
  export function readFileSync(path: URL | string, encoding: 'utf8'): string
  export function writeFileSync(path: URL | string, data: string): void
  export function existsSync(path: URL | string): boolean
}
