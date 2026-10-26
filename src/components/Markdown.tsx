'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import rehypeHighlight from 'rehype-highlight'
import { useKb } from '@/client/store'

const MENTION_RE = /\[\[(\d+)\]\]/g

function rewriteMentions(src: string): string {
  return src.replace(MENTION_RE, (_match, id: string) => `[${id}](#task:${id})`)
}

export function Markdown({ children }: { children: string }) {
  const openPanel = useKb((s) => s.openPanel)

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize, rehypeHighlight]}
      components={{
        a({ href, children: linkChildren, ...props }) {
          if (href?.startsWith('#task:')) {
            const id = href.slice('#task:'.length)
            return (
              <a
                href={href}
                {...props}
                onClick={(e) => {
                  e.preventDefault()
                  openPanel(id)
                }}
              >
                {linkChildren}
              </a>
            )
          }
          return (
            <a href={href} {...props}>
              {linkChildren}
            </a>
          )
        },
      }}
    >
      {rewriteMentions(children)}
    </ReactMarkdown>
  )
}
