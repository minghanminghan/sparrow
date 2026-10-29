import { createHash } from 'node:crypto'
import { parse, stringify } from 'yaml'
import { KbError } from './errors'
import type { Comment, Link, Ref, Task } from './types'

const HEADER_RE = /^### (\d{4}-\d\d-\d\dT\S+Z) · (.+)$/
const KNOWN_KEYS = [
  'id',
  'title',
  'status',
  'parent',
  'due',
  'rank',
  'links',
  'refs',
  'created',
  'updated',
  'completed',
]

function splitFrontmatter(text: string): { fmText: string; tail: string } {
  const lines = text.split('\n')
  if (lines[0] !== '---') throw new KbError('invalid', 'missing frontmatter')
  let closeIdx = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      closeIdx = i
      break
    }
  }
  if (closeIdx === -1) throw new KbError('invalid', 'missing closing frontmatter delimiter')
  return {
    fmText: lines.slice(1, closeIdx).join('\n'),
    tail: lines.slice(closeIdx + 1).join('\n'),
  }
}

function findCommentsStart(content: string): number | null {
  const lines = content.split('\n')
  let offset = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line === '## Comments') {
      let j = i + 1
      while (j < lines.length && lines[j] === '') j++
      if (j < lines.length && HEADER_RE.test(lines[j])) return offset
    }
    offset += line.length + 1
  }
  return null
}

function parseComments(text: string): Comment[] {
  const re = new RegExp(HEADER_RE.source, 'gm')
  const matches = [...text.matchAll(re)]
  return matches.map((m, idx) => {
    const start = m.index + m[0].length + 1
    const end = idx + 1 < matches.length ? matches[idx + 1].index : text.length
    let body = text.slice(start, end)
    if (body.endsWith('\n')) body = body.slice(0, -1)
    return { at: m[1], author: m[2], body }
  })
}

const idStr = (v: unknown) => (typeof v === 'number' ? String(v) : v)

export function parseTask(text: string): Task {
  const { fmText, tail } = splitFrontmatter(text)
  let data: Record<string, unknown>
  try {
    data = (parse(fmText) ?? {}) as Record<string, unknown>
  } catch (err) {
    throw new KbError('invalid', `invalid frontmatter yaml: ${(err as Error).message}`)
  }
  for (const key of ['id', 'parent']) if (key in data) data[key] = idStr(data[key])
  for (const key of ['id', 'title', 'status', 'rank']) {
    if (typeof data[key] !== 'string') throw new KbError('invalid', `missing or invalid "${key}"`)
  }

  const links: Link[] = Array.isArray(data.links)
    ? (data.links as Array<Record<string, string | number>>).map((m) => {
        const [type, id] = Object.entries(m)[0]
        return { type: type as Link['type'], id: String(id) }
      })
    : []
  const refs: Ref[] = Array.isArray(data.refs)
    ? (data.refs as Array<{ url: string; label?: string }>).map((r) =>
        r.label ? { url: r.url, label: r.label } : { url: r.url },
      )
    : []
  const extra: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (!KNOWN_KEYS.includes(key)) extra[key] = value
  }

  const content = tail.startsWith('\n') ? tail.slice(1) : tail
  const commentsStart = findCommentsStart(content)
  let body: string
  let comments: Comment[]
  if (commentsStart === null) {
    body = content
    comments = []
  } else {
    body = content.slice(0, commentsStart).replace(/\n+$/, '')
    const headingLineEnd = content.indexOf('\n', commentsStart)
    const afterHeading = headingLineEnd === -1 ? content.length : headingLineEnd + 1
    const commentsText = content.slice(afterHeading).replace(/^\n+/, '')
    comments = parseComments(commentsText)
  }

  return {
    id: data.id as string,
    title: data.title as string,
    status: data.status as string,
    rank: data.rank as string,
    parent: (data.parent as string) || undefined,
    due: (data.due as string) || undefined,
    completed: (data.completed as string) || undefined,
    links,
    refs,
    created: (data.created as string) || '',
    updated: (data.updated as string) || '',
    body,
    comments,
    extra,
  }
}

function buildFrontmatterObject(t: Task): Record<string, unknown> {
  const obj: Record<string, unknown> = { id: Number(t.id), title: t.title, status: t.status }
  if (t.parent) obj.parent = Number(t.parent)
  if (t.due) obj.due = t.due
  obj.rank = t.rank
  if (t.links.length) obj.links = t.links.map((l) => ({ [l.type]: Number(l.id) }))
  if (t.refs.length) {
    obj.refs = t.refs.map((r) => (r.label ? { url: r.url, label: r.label } : { url: r.url }))
  }
  if (t.created) obj.created = t.created
  if (t.updated) obj.updated = t.updated
  if (t.completed) obj.completed = t.completed
  for (const [key, value] of Object.entries(t.extra)) obj[key] = value
  return obj
}

function commentsEqual(a: Comment[], b: Comment[]): boolean {
  if (a.length !== b.length) return false
  return a.every((c, i) => c.at === b[i].at && c.author === b[i].author && c.body === b[i].body)
}

export function serializeTask(t: Task, original?: string): string {
  const frontmatter = '---\n' + stringify(buildFrontmatterObject(t)) + '---\n'

  if (original !== undefined) {
    const prev = parseTask(original)
    if (prev.body === t.body && commentsEqual(prev.comments, t.comments)) {
      return frontmatter + splitFrontmatter(original).tail
    }
  }

  let out = frontmatter + '\n' + t.body.replace(/\n+$/, '')
  if (t.comments.length) {
    const blocks = t.comments.map((c) => `### ${c.at} · ${c.author}\n${c.body}\n`)
    out += '\n\n## Comments\n\n' + blocks.join('\n')
  } else {
    out += '\n'
  }
  return out
}

export function hash(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 12)
}
