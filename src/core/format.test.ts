import { describe, expect, test } from 'vitest'
import { stringify } from 'yaml'
import { KbError } from './errors'
import { parseTask, serializeTask } from './format'

function fixture(opts: { extra?: string; body?: string; comments?: string } = {}): string {
  const fm = {
    id: 1,
    title: 'Test task',
    status: 'todo',
    rank: 'a0',
    created: '2026-10-21T15:00:00Z',
    updated: '2026-10-21T15:00:00Z',
  }
  let yamlText = stringify(fm)
  if (opts.extra) yamlText += opts.extra
  const body = opts.body ?? 'Test body.'
  let text = `---\n${yamlText}---\n\n${body}`
  if (opts.comments) text += `\n\n## Comments\n\n${opts.comments}`
  return text
}

describe('format', () => {
  test('round trip keeps unknown fields and body bytes', () => {
    const src = fixture({ extra: 'custom: 1\n', body: 'Line\n\n  indented  \n' })
    const t = parseTask(src)
    expect(t.extra).toEqual({ custom: 1 })
    expect(serializeTask(t, src)).toBe(src)
  })

  test('comment text with headings survives', () => {
    const src = fixture({ comments: '### 2026-10-21T16:10:00Z · ai\nhi\n### not a header\n## Comments\nmore\n' })
    const t = parseTask(src)
    expect(t.comments).toHaveLength(1)
    expect(t.comments[0].body).toBe('hi\n### not a header\n## Comments\nmore')
  })

  test('missing title throws invalid', () => {
    expect(() => parseTask('---\nid: 1\nstatus: todo\nrank: a0\n---\n')).toThrow(KbError)
  })
})
