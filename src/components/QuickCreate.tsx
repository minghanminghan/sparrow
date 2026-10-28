'use client'

import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { Link, Ref } from '@/core'
import { rankBetween } from '@/core/rank'
import { useKb } from '@/client/store'
import { shrinkImage } from '@/client/image'
import { visibleColumnTasks } from '@/components/board/visibleTasks'
import { LINK_TYPES, LinkPicker } from '@/components/detail/TaskDetail'

const FIELD = 'rounded border border-gray-300 px-2 py-1 text-sm'

export function QuickCreate() {
  const createFor = useKb((s) => s.createFor)
  const openCreate = useKb((s) => s.openCreate)
  const create = useKb((s) => s.create)
  const columns = useKb((s) => s.index?.config.columns)
  const byId = useKb((s) => s.byId)
  const titleRef = useRef<HTMLInputElement>(null)
  const submitting = useRef(false)
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState('')
  const [parent, setParent] = useState('')
  const [due, setDue] = useState('')
  const [assignee, setAssignee] = useState('')
  const [body, setBody] = useState('')
  const [links, setLinks] = useState<Link[]>([])
  const [refs, setRefs] = useState<Ref[]>([])
  const [url, setUrl] = useState('')
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([])

  useEffect(() => {
    if (!createFor) return
    setStatus(createFor.status ?? '')
    titleRef.current?.focus()
  }, [createFor])

  if (!createFor) return null

  function reset(): void {
    setTitle('')
    setParent('')
    setDue('')
    setAssignee('')
    setBody('')
    setLinks([])
    setRefs([])
    setUrl('')
    for (const p of photos) URL.revokeObjectURL(p.url)
    setPhotos([])
  }

  function close(): void {
    reset()
    openCreate(null)
  }

  function onClose(): void {
    const dirty = title || parent || due || assignee || body || url || links.length || refs.length || photos.length
    if (dirty && !window.confirm('Discard this task?')) return
    close()
  }

  async function submit(): Promise<void> {
    const t = title.trim()
    if (!t || submitting.current) return
    submitting.current = true
    // Opened from a column: put the new task at the top of it, like the old inline input did.
    const state = useKb.getState()
    const first =
      status && status === createFor?.status && state.index
        ? visibleColumnTasks(state.index, state.filters, status)[0]
        : undefined
    try {
      await create({
        title: t,
        status: status || undefined,
        rank: first ? rankBetween(undefined, first.rank) : undefined,
        parent: parent.trim() || undefined,
        due: due || undefined,
        assignee: assignee.trim() || undefined,
        body: body.trim() || undefined,
        links,
        refs,
      }, photos.map((p) => p.file))
      close()
    } catch {
      // the store already pushed a toast with the error
    } finally {
      submitting.current = false
    }
  }

  async function addPhotos(files: FileList | null): Promise<void> {
    if (!files) return
    const shrunk = await Promise.all([...files].map((f) => shrinkImage(f)))
    setPhotos((prev) => [...prev, ...shrunk.map((file) => ({ file, url: URL.createObjectURL(file) }))])
  }

  function removePhoto(p: { file: File; url: string }): void {
    URL.revokeObjectURL(p.url)
    setPhotos((prev) => prev.filter((x) => x !== p))
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

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/20 pt-24" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
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
        <div className="flex flex-wrap gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={FIELD}>
            <option value="">Default status</option>
            {columns?.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={FIELD} />
          <input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Unassigned" className={FIELD} />
          <input
            value={parent}
            onChange={(e) => setParent(e.target.value)}
            placeholder="Parent ID (optional)"
            className={`flex-1 ${FIELD}`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded border border-gray-300 px-2 py-1 text-xs text-gray-600">
            📷 Photo
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void addPhotos(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
          {photos.map((p) => (
            <span key={p.url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-12 w-12 rounded border border-gray-200 object-cover" />
              <button
                onClick={() => removePhoto(p)}
                aria-label="Remove photo"
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gray-900 text-xs leading-none text-white"
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Description</h2>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="field-sizing-content min-h-24 w-full rounded border border-gray-300 p-2 text-sm outline-none"
          />
        </section>

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

        <div className="flex items-center justify-end gap-3">
          <span className="text-xs text-gray-400">⌘Enter to create</span>
          <button
            onClick={() => void submit()}
            className="rounded bg-gray-900 px-3 py-1 text-sm text-white hover:bg-gray-700"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
