import { useState, useCallback, useRef } from 'react'

async function* readSSE(response) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const json = line.slice(6).trim()
          if (json) {
            try { yield JSON.parse(json) } catch { /* skip malformed */ }
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export function useClaudeStream() {
  const [streaming, setStreaming] = useState(false)
  const abortRef = useRef(null)

  const stream = useCallback(async ({ messages, system, maxTokens, onChunk, onDone, onError }) => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setStreaming(true)

    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, system, maxTokens }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        // Anthropic shape: { type, error: { type, message } }
        const msg = data?.error?.message ?? data?.error ?? `API error ${res.status}`
        onError?.(typeof msg === 'string' ? msg : JSON.stringify(msg))
        return
      }

      let full = ''
      for await (const event of readSSE(res)) {
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          full += event.delta.text
          onChunk?.(full)
        }
        if (event.type === 'message_stop') break
      }
      onDone?.(full)
    } catch (err) {
      if (err.name !== 'AbortError') onError?.(err.message)
    } finally {
      setStreaming(false)
    }
  }, [])

  const abort = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
  }, [])

  return { stream, streaming, abort }
}
