import { useState } from 'react'

export default function CopyButton({
  text,
  title = 'Copy',
}: {
  text: string
  title?: string
}) {
  const [copied, setCopied] = useState(false)

  const copyText = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      className="btn btn-ghost btn-sm"
      title={title}
      onClick={copyText}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}
