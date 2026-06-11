import { useEffect, useRef } from 'react'

let scriptLoaded = false
const pendingCallbacks: Array<() => void> = []

function loadEditorScript(src: string, cb: () => void) {
  if (scriptLoaded) { cb(); return }
  if (pendingCallbacks.length > 0) { pendingCallbacks.push(cb); return }
  pendingCallbacks.push(cb)
  const script = document.createElement('script')
  script.src = src
  script.async = true
  script.onload = () => {
    scriptLoaded = true
    pendingCallbacks.forEach((fn) => fn())
    pendingCallbacks.length = 0
  }
  script.onerror = () => { pendingCallbacks.length = 0 }
  document.head.appendChild(script)
}

interface OnlyOfficeEditorProps {
  config: Record<string, unknown> | null
  apiUrl: string | null
}

function buildEditorConfig(raw: Record<string, unknown>) {
  const { editorApiUrl: _a, editor_api_url: _b, ...editorConfig } = raw
  return editorConfig
}

export default function OnlyOfficeEditor({ config, apiUrl }: OnlyOfficeEditorProps) {
  const editorRef = useRef<{ destroyEditor?: () => void } | null>(null)
  const containerId = 'oo-editor-container'

  useEffect(() => {
    if (!config || !apiUrl) return

    const editorConfig = buildEditorConfig(config)

    loadEditorScript(apiUrl, () => {
      if (!window.DocsAPI) return
      editorRef.current?.destroyEditor?.()
      editorRef.current = new window.DocsAPI.DocEditor(containerId, editorConfig)
    })

    return () => {
      editorRef.current?.destroyEditor?.()
      editorRef.current = null
    }
  }, [config, apiUrl])

  return <div id={containerId} className="w-full h-full min-h-[520px]" />
}
