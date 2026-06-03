import React, { useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import { openExternalUrlSafe } from '../../services/external-url'

interface AIChatMarkdownProps {
  content: string
}

type LinkClickHandler = React.MouseEventHandler<HTMLAnchorElement>

/**
 * Renders AI assistant markdown content with secure link handling.
 *
 * - Uses react-markdown v9 to render standard markdown (headings, bold, italic,
 *   lists, code blocks, links, paragraphs).
 * - Does NOT use rehype-raw — raw HTML is stripped by default for safety since
 *   the content originates from an AI model.
 * - External links go through {@link openExternalUrlSafe} which validates
 *   protocols (http/https only), detects suspicious patterns, and shows a
 *   confirmation dialog for flagged URLs.
 * - Styled with Tailwind `prose` classes and custom overrides for code blocks,
 *   headings, and links to match the chat bubble aesthetic in both light and dark mode.
 */
export function AIChatMarkdown({ content }: AIChatMarkdownProps) {
  const handleLinkClick: LinkClickHandler = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      const href = e.currentTarget.getAttribute('href')
      if (!href) {
        e.preventDefault()
        return
      }

      e.preventDefault()
      void openExternalUrlSafe(href)
    },
    [],
  )

  const components: Partial<Components> = {
    a({ href, children, ...props }) {
      return (
        <a
          href={href}
          onClick={handleLinkClick}
          rel="noopener noreferrer"
          target="_blank"
          {...props}
        >
          {children}
        </a>
      )
    },
    // Ensure code blocks render with proper monospace font
    code({ className, children, ...props }) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      )
    },
  }

  return (
    <div className="prose prose-sm dark:prose-invert prose-headings:text-text prose-p:my-1.5 prose-a:cursor-pointer prose-a:text-accent prose-a:underline prose-code:rounded prose-code:bg-surface-tertiary prose-code:px-1 prose-code:py-0.5 prose-code:font-mono prose-code:text-sm prose-code:before:content-none prose-code:after:content-none prose-pre:rounded-lg prose-pre:border prose-pre:border-border prose-pre:bg-surface-secondary prose-li:my-0.5 prose-headings:dark:text-text-dark-primary prose-pre:dark:border-border-dark prose-pre:dark:bg-surface-dark-secondary max-w-none">
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  )
}
