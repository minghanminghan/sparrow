export type Role = 'ready' | 'active' | 'done'
export type Column = { key: string; name: string; role?: Role }
export type Config = { user: string; columns: Column[] }
export type LinkType = 'blocks' | 'relates'
export type Link = { type: LinkType; id: string }
export type Ref = { url: string; label?: string }
export type Comment = { at: string; author: string; body: string }
export type Attachment = { id: string; filename: string; mime: string; size: number; created: string }
export type Task = {
  id: string
  title: string
  status: string
  rank: string
  parent?: string
  due?: string
  completed?: string
  links: Link[]
  refs: Ref[]
  created: string
  updated: string
  body: string
  comments: Comment[]
  extra: Record<string, unknown>
}
