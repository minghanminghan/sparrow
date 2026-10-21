'use client'

import { useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import type { Backlink, Link as TaskLink, LinkType, Ref, TaskView } from '@/core'
import { columnByRole, isDone } from '@/core/columns'
import { ApiError } from '@/client/api'
import { useKb } from '@/client/store'
import { Markdown } from '@/components/Markdown'

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

const PR_RE = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/

function refLabel(ref: Ref): string {
  if (ref.label) return ref.label
  const m = PR_RE.exec(ref.url)
  return m ? `${m[1]}/${m[2]}#${m[3]}` : ref.url
}

function groupBy<T, K extends string>(items: T[], keyFn: (t: T) => K): Partial<Record<K, T[]>> {
  const out: Partial<Record<K, T[]>> = {}
  for (const item of items) {
    const k = keyFn(item)
    ;(out[k] ??= []).push(item)
  }
  return out
}

// Shared by the title and body editors: both save with a captured
// `baseHash`, apply optimistically, and on a 'conflict' rejection switch to
// a view showing the latest value next to the unsaved draft instead of
// toasting (the store already skips the toast for 'conflict').
type HashedState = { mode: 'view' } | { mode: 'edit'; draft: string; baseHash: string } | { mode: 'conflict'; draft: string }

function useHashedField(send: (draft: string, baseHash: string) => Promise<void>): {
  state: HashedState
  startEdit: (draft: string, baseHash: string) => void
  save: (draft: string, baseHash: string) => Promise<void>
  discard: () => void
} {
  const [state, setState] = useState<HashedState>({ mode: 'view' })

  function startEdit(draft: string, baseHash: string): void {
    setState({ mode: 'edit', draft, baseHash })
  }

  async function save(draft: string, baseHash: string): Promise<void> {
    try {
      await send(draft, baseHash)
      setState({ mode: 'view' })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'conflict') setState({ mode: 'conflict', draft })
      else setState({ mode: 'view' })
    }
  }

  function discard(): void {
    setState({ mode: 'view' })
  }

  return { state, startEdit, save, discard }
}

function Breadcrumb({ task }: { task: TaskView }) {
  const byId = useKb((s) => s.byId)
  const openPanel = useKb((s) => s.openPanel)

  const chain: TaskView[] = []
  let cur = task.parent ? byId[task.parent] : undefined
  while (cur) {
    chain.unshift(cur)
    cur = cur.parent ? byId[cur.parent] : undefined
  }
  if (chain.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1 text-xs text-gray-500">
      {chain.map((t, i) => (
        <span key={t.id} className="flex items-center gap-1">
          {i > 0 && <span>/</span>}
          <button onClick={() => openPanel(t.id)} className="hover:underline">
            {t.title}
          </button>
        </span>
      ))}
      <span>/</span>
    </div>
  )
}

function TitleEditor({ task }: { task: TaskView }) {
  const op = useKb((s) => s.op)
  const { state, startEdit, save, discard } = useHashedField((title, baseHash) =>
    op(task.id, { type: 'setTitle', title, baseHash }, (t) => ({ ...t, title })),
  )

  if (state.mode === 'view') {
    return (
      <h1
        onClick={() => startEdit(task.title, task.titleHash)}
        className="cursor-text text-xl font-semibold text-gray-900"
      >
        {task.title}
      </h1>
    )
  }

  if (state.mode === 'conflict') {
    return (
      <div className="rounded border border-amber-300 bg-amber-50 p-2 text-sm">
        <div className="text-amber-800">Title changed since you started editing.</div>
        <div className="mt-1">
          Latest: <span className="font-medium">{task.title}</span>
        </div>
        <div className="mt-1">
          Yours: <span className="font-medium">{state.draft}</span>
        </div>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => void save(state.draft, task.titleHash)}
            className="rounded bg-gray-900 px-2 py-1 text-xs text-white"
          >
            Use mine
          </button>
          <button onClick={discard} className="rounded border border-gray-300 px-2 py-1 text-xs">
            Discard
          </button>
        </div>
      </div>
    )
  }

  const commit = (): void => {
    const title = state.draft.trim()
    if (!title || title === task.title) discard()
    else void save(title, state.baseHash)
  }

  return (
    <input
      autoFocus
      value={state.draft}
      onChange={(e) => startEdit(e.target.value, state.baseHash)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        else if (e.key === 'Escape') discard()
      }}
      className="w-full rounded border border-gray-300 px-2 py-1 text-xl font-semibold outline-none"
    />
  )
}

function BodyEditor({ task }: { task: TaskView }) {
  const op = useKb((s) => s.op)
  const { state, startEdit, save, discard } = useHashedField((body, baseHash) =>
    op(task.id, { type: 'setBody', body, baseHash }, (t) => ({ ...t, body })),
  )
  const [preview, setPreview] = useState(false)

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && state.mode === 'edit') {
      e.preventDefault()
      void save(state.draft, state.baseHash)
    }
  }

  if (state.mode === 'conflict') {
    return (
      <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
        <div className="text-amber-800">This description changed since you started editing.</div>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 text-xs font-medium text-gray-500">Latest</div>
            <Markdown>{task.body}</Markdown>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-gray-500">Your draft</div>
            <pre className="whitespace-pre-wrap font-sans">{state.draft}</pre>
          </div>
        </div>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => void save(state.draft, task.bodyHash)}
            className="rounded bg-gray-900 px-2 py-1 text-xs text-white"
          >
            Use mine
          </button>
          <button onClick={discard} className="rounded border border-gray-300 px-2 py-1 text-xs">
            Discard
          </button>
        </div>
      </div>
    )
  }

  if (state.mode === 'edit') {
    return (
      <div>
        <div className="mb-1 flex gap-2 text-xs">
          <button onClick={() => setPreview(false)} className={preview ? 'text-gray-500' : 'font-medium'}>
            Write
          </button>
          <button onClick={() => setPreview(true)} className={preview ? 'font-medium' : 'text-gray-500'}>
            Preview
          </button>
          <span className="ml-auto text-gray-400">⌘Enter to save</span>
        </div>
        {preview ? (
          <div className="min-h-32 rounded border border-gray-200 p-2">
            <Markdown>{state.draft}</Markdown>
          </div>
        ) : (
          <textarea
            autoFocus
            value={state.draft}
            onChange={(e) => startEdit(e.target.value, state.baseHash)}
            onKeyDown={onKeyDown}
            rows={8}
            className="w-full rounded border border-gray-300 p-2 text-sm outline-none"
          />
        )}
        <div className="mt-1 flex gap-2">
          <button
            onClick={() => void save(state.draft, state.baseHash)}
            className="rounded bg-gray-900 px-2 py-1 text-xs text-white"
          >
            Save
          </button>
          <button onClick={discard} className="rounded border border-gray-300 px-2 py-1 text-xs">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-1 flex justify-end">
        <button
          onClick={() => startEdit(task.body, task.bodyHash)}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Edit
        </button>
      </div>
      {task.body.trim() ? (
        <Markdown>{task.body}</Markdown>
      ) : (
        <div className="text-sm text-gray-400">No description.</div>
      )}
    </div>
  )
}

function AssigneeInput({ task }: { task: TaskView }) {
  const op = useKb((s) => s.op)
  const [value, setValue] = useState(task.assignee ?? '')

  useEffect(() => setValue(task.assignee ?? ''), [task.assignee])

  function commit(): void {
    const next = value.trim() || null
    if (next === (task.assignee ?? null)) return
    void op(task.id, { type: 'setAssignee', assignee: next }, (t) => ({ ...t, assignee: next ?? undefined }))
  }

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      placeholder="Unassigned"
      className="rounded border border-gray-300 px-2 py-1 text-sm"
    />
  )
}

function Subtasks({ task }: { task: TaskView }) {
  const byId = useKb((s) => s.byId)
  const config = useKb((s) => s.index?.config)
  const op = useKb((s) => s.op)
  const create = useKb((s) => s.create)
  const [title, setTitle] = useState('')

  if (!config) return null
  const readyKey = columnByRole(config, 'ready').key
  const doneKey = columnByRole(config, 'done').key

  function toggle(childId: string, checked: boolean): void {
    const status = checked ? doneKey : readyKey
    void op(childId, { type: 'setStatus', status }, (t) => ({ ...t, status }))
  }

  async function addSubtask(): Promise<void> {
    const t = title.trim()
    if (!t) return
    setTitle('')
    try {
      await create({ title: t, parent: task.id })
    } catch {
      // the store already pushed a toast with the error
    }
  }

  return (
    <div>
      {task.progress.total > 0 && (
        <div className="mb-2 h-1.5 w-full rounded bg-gray-100">
          <div
            className="h-1.5 rounded bg-gray-900"
            style={{ width: `${(100 * task.progress.done) / task.progress.total}%` }}
          />
        </div>
      )}
      <ul className="space-y-1">
        {task.children.map((childId) => {
          const child = byId[childId]
          if (!child) return null
          const checked = isDone(config, child.status)
          return (
            <li key={childId} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={checked} onChange={(e) => toggle(childId, e.target.checked)} />
              <button onClick={() => useKb.getState().openPanel(childId)} className="hover:underline">
                {child.title}
              </button>
            </li>
          )
        })}
      </ul>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void addSubtask()
          }
        }}
        placeholder="+ Add subtask"
        className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-gray-400"
      />
    </div>
  )
}

const LINK_TYPES: { value: LinkType; label: string }[] = [
  { value: 'blocks', label: 'Blocks' },
  { value: 'relates', label: 'Relates to' },
  { value: 'duplicates', label: 'Duplicates' },
]

const BACKLINK_LABEL: Record<Backlink['type'], string> = {
  'blocked-by': 'Blocked by',
  relates: 'Related',
  'duplicated-by': 'Duplicated by',
  'mentioned-in': 'Mentioned in',
}

function LinkPicker({ task }: { task: TaskView }) {
  const tasks = useKb((s) => s.index?.tasks ?? [])
  const op = useKb((s) => s.op)
  const [type, setType] = useState<LinkType>('blocks')
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return tasks
      .filter((t) => t.id !== task.id && (t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q)))
      .slice(0, 8)
  }, [tasks, query, task.id])

  function addLink(id: string): void {
    void op(task.id, { type: 'addLink', link: { type, id } }, (t) => ({
      ...t,
      links: t.links.some((l) => l.type === type && l.id === id) ? t.links : [...t.links, { type, id }],
    }))
    setQuery('')
  }

  return (
    <div>
      <div className="flex gap-1">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as LinkType)}
          className="rounded border border-gray-300 px-1 py-1 text-xs"
        >
          {LINK_TYPES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) addLink(results[0].id)
          }}
          placeholder="Search by id or title…"
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
        />
      </div>
      {results.length > 0 && (
        <ul className="mt-1 rounded border border-gray-200 text-xs">
          {results.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => addLink(t.id)}
                className="block w-full px-2 py-1 text-left hover:bg-gray-50"
              >
                <span className="font-mono text-gray-400">{t.id}</span> {t.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Links({ task }: { task: TaskView }) {
  const byId = useKb((s) => s.byId)
  const op = useKb((s) => s.op)
  const openPanel = useKb((s) => s.openPanel)

  const outgoing = groupBy(task.links, (l) => l.type)
  const backlinks = groupBy(task.backlinks, (b) => b.type)

  function remove(link: TaskLink): void {
    void op(task.id, { type: 'removeLink', link }, (t) => ({
      ...t,
      links: t.links.filter((l) => !(l.type === link.type && l.id === link.id)),
    }))
  }

  return (
    <div className="space-y-2">
      {LINK_TYPES.map((o) => {
        const items = outgoing[o.value]
        if (!items || items.length === 0) return null
        return (
          <div key={o.value} className="text-sm">
            <div className="text-xs font-medium text-gray-500">{o.label}</div>
            <ul className="space-y-0.5">
              {items.map((l) => {
                const target = byId[l.id]
                return (
                  <li key={`${l.type}-${l.id}`} className="flex items-center gap-2">
                    {target ? (
                      <button onClick={() => openPanel(l.id)} className="hover:underline">
                        {l.id} — {target.title}
                      </button>
                    ) : (
                      <span className="text-gray-400 line-through">{l.id}</span>
                    )}
                    <button onClick={() => remove(l)} aria-label="Remove link" className="text-gray-400 hover:text-gray-700">
                      ×
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
      {(['blocked-by', 'relates', 'duplicated-by', 'mentioned-in'] as const).map((type) => {
        const items = backlinks[type]
        if (!items || items.length === 0) return null
        return (
          <div key={type} className="text-sm">
            <div className="text-xs font-medium text-gray-500">{BACKLINK_LABEL[type]}</div>
            <ul className="space-y-0.5">
              {items.map((b) => {
                const source = byId[b.id]
                return (
                  <li key={`${type}-${b.id}`}>
                    <button onClick={() => openPanel(b.id)} className="hover:underline">
                      {b.id}
                      {source ? ` — ${source.title}` : ''}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
      <LinkPicker task={task} />
    </div>
  )
}

function References({ task }: { task: TaskView }) {
  const op = useKb((s) => s.op)
  const [url, setUrl] = useState('')

  function addRef(): void {
    const u = url.trim()
    if (!u) return
    setUrl('')
    void op(task.id, { type: 'addRef', ref: { url: u } }, (t) => ({
      ...t,
      refs: t.refs.some((r) => r.url === u) ? t.refs : [...t.refs, { url: u }],
    }))
  }

  function remove(refUrl: string): void {
    void op(task.id, { type: 'removeRef', url: refUrl }, (t) => ({ ...t, refs: t.refs.filter((r) => r.url !== refUrl) }))
  }

  return (
    <div className="space-y-1 text-sm">
      <ul className="space-y-0.5">
        {task.refs.map((r) => (
          <li key={r.url} className="flex items-center gap-2">
            <a href={r.url} target="_blank" rel="noreferrer" className="truncate text-blue-600 hover:underline">
              {refLabel(r)}
            </a>
            <button onClick={() => remove(r.url)} aria-label="Remove reference" className="text-gray-400 hover:text-gray-700">
              ×
            </button>
          </li>
        ))}
      </ul>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            addRef()
          }
        }}
        placeholder="Paste a URL…"
        className="w-full rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-gray-400"
      />
    </div>
  )
}

function Comments({ task }: { task: TaskView }) {
  const op = useKb((s) => s.op)
  const author = useKb((s) => s.index?.config.user)
  const [body, setBody] = useState('')

  function submit(): void {
    const text = body.trim()
    if (!text || !author) return
    setBody('')
    void op(task.id, { type: 'addComment', author, body: text }, (t) => ({
      ...t,
      comments: [...t.comments, { at: nowIso(), author, body: text }],
    }))
  }

  return (
    <div className="space-y-3">
      {task.comments.map((c, i) => (
        <div key={i} className="rounded border border-gray-200 p-2 text-sm">
          <div className="mb-1 text-xs text-gray-500">
            {c.author} · {c.at}
          </div>
          <Markdown>{c.body}</Markdown>
        </div>
      ))}
      <div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          rows={3}
          placeholder="Leave a comment… (⌘Enter to submit)"
          className="w-full rounded border border-gray-300 p-2 text-sm outline-none"
        />
      </div>
    </div>
  )
}

export function TaskDetail({ id, fullPage = false }: { id: string; fullPage?: boolean }) {
  const task = useKb((s) => s.byId[id])
  const config = useKb((s) => s.index?.config)
  const op = useKb((s) => s.op)
  const openPanel = useKb((s) => s.openPanel)
  const remove = useKb((s) => s.remove)
  const router = useRouter()

  if (!task || !config) {
    return <div className="p-4 text-sm text-gray-500">Loading…</div>
  }

  async function handleDelete(): Promise<void> {
    if (!window.confirm(`Delete ${task.id}?`)) return
    await remove(task.id)
    openPanel(null)
    if (fullPage) router.push('/')
  }

  return (
    <div className="space-y-6 p-4">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <Breadcrumb task={task} />
          {!fullPage && (
            <NextLink href={`/t/${task.id}`} className="text-xs text-gray-500 hover:underline">
              Open full page
            </NextLink>
          )}
        </div>
        <TitleEditor task={task} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={task.status}
            onChange={(e) =>
              void op(task.id, { type: 'setStatus', status: e.target.value }, (t) => ({ ...t, status: e.target.value }))
            }
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            {config.columns.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={task.due ?? ''}
            onChange={(e) => {
              const due = e.target.value || null
              void op(task.id, { type: 'setDue', due }, (t) => ({ ...t, due: due ?? undefined }))
            }}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <AssigneeInput task={task} />
          <button onClick={() => void handleDelete()} className="ml-auto text-sm text-red-600 hover:underline">
            Delete
          </button>
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Description</h2>
        <BodyEditor task={task} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Subtasks</h2>
        <Subtasks task={task} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Links</h2>
        <Links task={task} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">References</h2>
        <References task={task} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Comments</h2>
        <Comments task={task} />
      </section>
    </div>
  )
}
