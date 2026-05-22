import { useEffect, useRef } from 'react'

let scriptLoaded = false
const pendingCallbacks = []

function loadEditorScript(src, cb) {
  if (scriptLoaded) { cb(); return }
  if (pendingCallbacks.length > 0) { pendingCallbacks.push(cb); return }
  pendingCallbacks.push(cb)
  const script = document.createElement('script')
  script.src = src
  script.async = true
  script.onload = () => {
    scriptLoaded = true
    pendingCallbacks.forEach(fn => fn())
    pendingCallbacks.length = 0
  }
  script.onerror = () => { pendingCallbacks.length = 0 }
  document.head.appendChild(script)
}

export default function OnlyOfficeEditor({ config, apiUrl }) {
  const editorRef = useRef(null)
  const containerId = 'oo-editor-container'

  useEffect(() => {
    if (!config || !apiUrl) return

    loadEditorScript(apiUrl, () => {
      if (!window.DocsAPI) return
      editorRef.current?.destroyEditor?.()
      editorRef.current = new window.DocsAPI.DocEditor(containerId, config)
    })

    return () => {
      editorRef.current?.destroyEditor?.()
      editorRef.current = null
    }
  }, [config, apiUrl])

  return <div id={containerId} className="w-full h-full min-h-[520px]" />
}
