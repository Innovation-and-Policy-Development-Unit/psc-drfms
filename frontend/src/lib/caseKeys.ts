/**
 * The API converts the keys of every JSON object to camelCase (contract_value -> contractValue).
 * That is right for field names, but wrong for data whose keys ARE the data: custom field values keyed by
 * field name, or rules keyed by document type. These helpers read such objects whichever way they arrive.
 */
export const toCamel = (key: string) => key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
export const toSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

/** `obj[key]`, also finding it under the camelCase spelling. */
export function lookup<T>(obj: Record<string, T> | undefined | null, key: string): T | undefined {
  if (!obj) return undefined
  return key in obj ? obj[key] : obj[toCamel(key)]
}

/** A copy of `obj` with snake_case keys, ready to send back. */
export function withSnakeKeys<T>(obj: Record<string, T> | undefined | null): Record<string, T> {
  return Object.fromEntries(Object.entries(obj ?? {}).map(([k, v]) => [toSnake(k), v]))
}
