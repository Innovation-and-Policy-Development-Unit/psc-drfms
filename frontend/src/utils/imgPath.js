const base = import.meta.env.BASE_URL
export const img = (path) => `${base}${path.startsWith('/') ? path.slice(1) : path}`
