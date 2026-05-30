/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  DocsAPI?: {
    DocEditor: new (
      containerId: string,
      config: Record<string, unknown>
    ) => { destroyEditor?: () => void }
  }
}
