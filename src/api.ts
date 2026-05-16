import type { ChatMetadata } from './types'

const BASE = '/api'

// ── SSE 流式对话（唯一入口） ───────────────────────────────────────────

/**
 * 对话（SSE 流式）
 *
 * 用 fetch + ReadableStream 解析 SSE 事件，逐字回调。
 * 返回 AbortController 用于中断请求。
 *
 * 后端格式（Spring SseEmitter）：
 *   event:message
 *   data:xxx
 *                    （空行 = 事件分隔）
 *   event:message
 *   data:{"__meta__":true,"promptTokens":15,"completionTokens":82,"durationMs":5000}
 *
 * 元数据事件与普通内容事件共用 "message" 类型，通过 data 中的 __meta__ 标记区分。
 */
function parseSsePart(part: string, onChunk: (chunk: string) => void, onMeta: (meta: ChatMetadata) => void) {
  const lines = part.split('\n')
  const dataLines: string[] = []

  for (const line of lines) {
    const trimmed = line.replace(/\r$/, '')
    if (trimmed.startsWith('data:')) {
      dataLines.push(trimmed.slice(5))
    }
  }

  if (dataLines.length === 0) return

  // 不 trim 保留空格原貌，只把真正空（长度为 0）的 data 当换行符
  const raw = dataLines.join('\n')
  if (raw === '') {
    onChunk('\n')
    return
  }

  // 尝试解析 JSON 元数据（含 __meta__ 标记）
  if (raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw.trim())
      if (parsed.__meta__ === true) {
        onMeta(parsed as ChatMetadata)
        return
      }
    } catch {
      // 不是 JSON，当作普通内容
    }
  }

  // 普通内容（保留原始空格）
  onChunk(raw)
}

export function chat(
  sessionId: string,
  question: string,
  systemPrompt: string | undefined,
  onChunk: (chunk: string) => void,
  onDone: (meta?: ChatMetadata) => void,
  onError: (err: Error) => void,
): AbortController {
  const abortController = new AbortController()

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  fetch(`${BASE}/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ session_id: sessionId, message: question }),
    signal: abortController.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        onError(new Error(`HTTP ${response.status}`))
        return
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let collectedMeta: ChatMetadata | undefined

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          parseSsePart(part, onChunk, (meta) => { collectedMeta = meta })
        }
      }

      // Flush remaining buffer (last event may not have trailing \n\n)
      if (buffer.trim()) {
        parseSsePart(buffer, onChunk, (meta) => { collectedMeta = meta })
      }

      onDone(collectedMeta)
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onError(err)
      } else {
        onDone()  // 用户中断也算结束，清理 loading 状态
      }
    })

  return abortController
}
