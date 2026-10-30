'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent } from 'react'
import type { Link, Ref } from '@/core'
import { rankBetween } from '@/core/rank'
import { useKb } from '@/client/store'
import { shrinkImage } from '@/client/image'
import { visibleColumnTasks } from '@/components/board/visibleTasks'
import { LINK_TYPES, LinkPicker } from '@/components/detail/TaskDetail'
import { ProjectSquare } from '@/components/ProjectSquare'

type Photo = { file: File; url: string }

const FIELD = 'rounded border border-gray-300 px-2 py-1 text-sm'

// Below Tailwind's `md` breakpoint the form is a full-screen page with its own layout.
const PHONE_QUERY = '(width < 48rem)'

function subscribePhone(onChange: () => void): () => void {
  const mq = window.matchMedia(PHONE_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

export function QuickCreate() {
  const createFor = useKb((s) => s.createFor)
  const openCreate = useKb((s) => s.openCreate)
  const create = useKb((s) => s.create)
  const columns = useKb((s) => s.index?.config.columns)
  const projects = useKb((s) => s.index?.projects)
  const byId = useKb((s) => s.byId)
  const titleRef = useRef<HTMLInputElement>(null)
  const submitting = useRef(false)
  const [title, setTitle] = useState('')
  const [project, setProject] = useState('')
  const startProject = useRef('')
  const [status, setStatus] = useState('')
  const [parent, setParent] = useState('')
  const [due, setDue] = useState('')
  const [body, setBody] = useState('')
  const [links, setLinks] = useState<Link[]>([])
  const [refs, setRefs] = useState<Ref[]>([])
  const [url, setUrl] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const photosRef = useRef<Photo[]>([])
  const pending = useRef<Promise<unknown>>(Promise.resolve())
  const generation = useRef(0)
  const phone = useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE_QUERY).matches, () => false)

  useEffect(() => {
    if (!createFor) return
    setStatus(createFor.status ?? '')
    startProject.current = useKb.getState().filters.projects[0] ?? ''
    setProject(startProject.current)
    titleRef.current?.focus()
  }, [createFor])

  if (!createFor) return null

  function updatePhotos(next: Photo[]): void {
    photosRef.current = next
    setPhotos(next)
  }

  function reset(): void {
    setTitle('')
    setParent('')
    setDue('')
    setBody('')
    setLinks([])
    setRefs([])
    setUrl('')
    generation.current++
    for (const p of photosRef.current) URL.revokeObjectURL(p.url)
    updatePhotos([])
  }

  function close(): void {
    reset()
    openCreate(null)
  }

  function onClose(): void {
    const dirty =
      title || parent || due || body || url || links.length || refs.length || photos.length || project !== startProject.current
    if (dirty && !window.confirm('Discard this task?')) return
    close()
  }

  async function submit(): Promise<void> {
    const t = title.trim()
    if (!t || !project || submitting.current) return
    submitting.current = true
    await pending.current
    // Opened from a column: put the new task at the top of it, like the old inline input did.
    const state = useKb.getState()
    const first =
      status && status === createFor?.status && state.index
        ? visibleColumnTasks(state.index, state.filters, status)[0]
        : undefined
    try {
      await create({
        title: t,
        project,
        status: status || undefined,
        rank: first ? rankBetween(undefined, first.rank) : undefined,
        parent: parent.trim() || undefined,
        due: due || undefined,
        body: body.trim() || undefined,
        links,
        refs,
      }, photosRef.current.map((p) => p.file))
      close()
    } catch {
      // the store already pushed a toast with the error
    } finally {
      submitting.current = false
    }
  }

  function addPhotos(files: FileList | null): void {
    if (!files) return
    const gen = generation.current
    const job = Promise.all([...files].map((f) => shrinkImage(f))).then((shrunk) => {
      if (gen !== generation.current) return
      updatePhotos([...photosRef.current, ...shrunk.map((file) => ({ file, url: URL.createObjectURL(file) }))])
    })
    pending.current = Promise.all([pending.current, job])
  }

  function removePhoto(p: Photo): void {
    URL.revokeObjectURL(p.url)
    updatePhotos(photosRef.current.filter((x) => x !== p))
  }

  function addRef(): void {
    const u = url.trim()
    if (!u) return
    setUrl('')
    if (!refs.some((r) => r.url === u)) setRefs([...refs, { url: u }])
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void submit()
    }
  }

  const titleInput = (
    <input
      ref={titleRef}
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onKeyDown={(e) => {
        // ⌘Enter bubbles to the dialog's handler; submitting here too made two tasks.
        if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
          e.preventDefault()
          void submit()
        }
      }}
      placeholder="Task title"
      className="w-full border-b border-gray-300 pb-2 text-lg outline-none"
    />
  )

  const projectPicker = (
    <div className="flex flex-wrap gap-2">
      {projects?.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => setProject(p.key)}
          aria-pressed={p.key === project}
          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-xs ${
            p.key === project ? 'border-gray-900 bg-gray-100 text-gray-900' : 'border-gray-300 text-gray-700'
          }`}
        >
          <ProjectSquare color={p.color} />
          {p.key}
        </button>
      ))}
    </div>
  )

  const statusSelect = (
    <select value={status} onChange={(e) => setStatus(e.target.value)} className={FIELD}>
      <option value="">Default status</option>
      {columns?.map((c) => (
        <option key={c.key} value={c.key}>
          {c.name}
        </option>
      ))}
    </select>
  )

  const dueInput = <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={FIELD} />
  const parentInput = (
    <input
      value={parent}
      onChange={(e) => setParent(e.target.value)}
      placeholder="Parent key (optional)"
      className={`flex-1 ${FIELD}`}
    />
  )

  const photoRow = (
    <div className="flex flex-wrap items-center gap-2">
      <label className="cursor-pointer rounded border border-gray-300 px-2 py-1 text-xs text-gray-600">
        📷 Photo
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addPhotos(e.target.files)
            e.target.value = ''
          }}
        />
      </label>
      {photos.map((p) => (
        <span key={p.url} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.url} alt="" className="h-12 w-12 rounded border border-gray-200 object-cover" />
          <button
            type="button"
            onClick={() => removePhoto(p)}
            aria-label="Remove photo"
            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gray-900 text-xs leading-none text-white"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  )

  const bodyInput = (
    <textarea
      value={body}
      onChange={(e) => setBody(e.target.value)}
      placeholder={phone ? 'Notes' : undefined}
      className="field-sizing-content min-h-24 w-full rounded border border-gray-300 p-2 text-sm outline-none"
    />
  )

  const linksSection = (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-gray-700">Links</h2>
      <ul className="mb-1 space-y-0.5 text-sm">
        {links.map((l) => (
          <li key={`${l.type}-${l.id}`} className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{LINK_TYPES.find((o) => o.value === l.type)?.label}</span>
            {l.id} — {byId[l.id]?.title}
            <button
              onClick={() => setLinks(links.filter((x) => x !== l))}
              aria-label="Remove link"
              className="text-gray-400 hover:text-gray-700"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <LinkPicker
        onAdd={(link) => {
          if (!links.some((l) => l.type === link.type && l.id === link.id)) setLinks([...links, link])
        }}
      />
    </section>
  )

  const refsSection = (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-gray-700">References</h2>
      <ul className="mb-1 space-y-0.5 text-sm">
        {refs.map((r) => (
          <li key={r.url} className="flex items-center gap-2">
            <span className="truncate">{r.url}</span>
            <button
              onClick={() => setRefs(refs.filter((x) => x !== r))}
              aria-label="Remove reference"
              className="text-gray-400 hover:text-gray-700"
            >
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
    </section>
  )

  if (phone) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-white" onKeyDown={onKeyDown}>
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
          <button onClick={onClose} className="text-sm text-gray-500">
            Cancel
          </button>
          <span className="text-sm font-medium">New task</span>
          <button
            onClick={() => void submit()}
            disabled={!project}
            className="rounded bg-gray-900 px-3 py-1 text-sm text-white disabled:opacity-40"
          >
            Create
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {titleInput}
          {projectPicker}
          {bodyInput}
          {photoRow}
          {statusSelect}
          <details>
            <summary className="cursor-pointer text-sm text-gray-500">More</summary>
            <div className="mt-3 flex flex-col gap-3">
              {parentInput}
              {dueInput}
              {linksSection}
              {refsSection}
            </div>
          </details>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/20 pt-24" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {titleInput}
        {projectPicker}
        <div className="flex flex-wrap gap-2">
          {statusSelect}
          {dueInput}
          {parentInput}
        </div>

        {photoRow}

        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Description</h2>
          {bodyInput}
        </section>

        {linksSection}

        {refsSection}

        <div className="flex items-center justify-end gap-3">
          <span className="text-xs text-gray-400">⌘Enter to create</span>
          <button
            onClick={() => void submit()}
            disabled={!project}
            className="rounded bg-gray-900 px-3 py-1 text-sm text-white hover:bg-gray-700 disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
