import { useState, useEffect } from 'react'
import { collaborationApi } from '../../api'
import { Send, Trash2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export default function CommentsPanel({ recordId }) {
  const { user } = useAuth()
  const [comments, setComments] = useState([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const load = () => {
    collaborationApi.getComments(recordId)
      .then(({ data }) => setComments(data.results || data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [recordId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!body.trim()) return
    setSending(true)
    try {
      await collaborationApi.createComment(recordId, { body: body.trim() })
      setBody('')
      load()
    } catch (err) {
      console.error(err)
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async (id) => {
    await collaborationApi.deleteComment(id)
    load()
  }

  if (loading) return <div className="p-4 skeleton h-32 rounded-lg" />

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 p-4">
        {comments.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No comments yet. Start the conversation.</p>
        ) : comments.map(c => (
          <div key={c.id} className="rounded-lg bg-slate-50 dark:bg-slate-800/80 p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-sm font-medium text-slate-900 dark:text-white">{c.author_name}</span>
              <span className="text-xs text-slate-400">{new Date(c.created_at).toLocaleString()}</span>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{c.body}</p>
            {c.author === user?.id && (
              <button type="button" onClick={() => handleDelete(c.id)} className="mt-2 text-xs text-red-500 hover:underline flex items-center gap-1">
                <Trash2 size={12} /> Delete
              </button>
            )}
            {c.replies?.length > 0 && (
              <div className="mt-2 ms-3 border-s border-slate-200 dark:border-slate-600 space-y-2 ps-3">
                {c.replies.map(r => (
                  <div key={r.id}>
                    <span className="text-xs font-medium">{r.author_name}</span>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{r.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-2">
        <input
          className="input flex-1 text-sm"
          placeholder="Add a comment… Use @username to mention"
          value={body}
          onChange={e => setBody(e.target.value)}
        />
        <button type="submit" disabled={sending} className="btn-primary btn-sm">
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}
