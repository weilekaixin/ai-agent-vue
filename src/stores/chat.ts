import { defineStore } from 'pinia'
import { computed, reactive } from 'vue'
import type { Session, Message } from '../types'
import { estimateTokens } from '../types'
import * as api from '../api'

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

export const useChatStore = defineStore('chat', () => {
  const state = reactive({
    sessions: [] as Session[],
    activeId: null as string | null,
  })

  let abortController: AbortController | null = null

  const active = computed(() => {
    if (!state.activeId) return null
    return state.sessions.find(s => s.id === state.activeId) ?? null
  })

  /** 替换数组中的某个 session（reactive 自动触发更新） */
  function patchSession(idx: number, patch: Partial<Session>) {
    state.sessions[idx] = { ...state.sessions[idx], ...patch }
  }

  // ── 会话管理 ──────────────────────────────

  function newSession() {
    abortController?.abort()
    state.activeId = null
  }

  function selectSession(id: string) {
    state.activeId = id
  }

  function deleteSession(id: string) {
    state.sessions = state.sessions.filter(s => s.id !== id)
    if (id === state.activeId) {
      state.activeId = state.sessions.length > 0 ? state.sessions[0].id : null
    }
  }

  // ── 发送消息 ──────────────────────────────

  async function sendMessage(content: string) {
    const text = content.trim()
    if (!text) return

    abortController?.abort()

    let sessionId = state.activeId
    let isFirst = true
    if (sessionId) {
      const session = state.sessions.find(s => s.id === sessionId)
      isFirst = session ? session.messages.length === 0 : true
    } else {
      sessionId = uid()
    }

    const userMsg: Message = {
      id: uid(), role: 'user', content: text, timestamp: Date.now(),
      tokens: estimateTokens(text),
    }
    const botMsg: Message = {
      id: uid(), role: 'assistant', content: '', timestamp: Date.now(),
      loading: true, tokens: 0, startTime: Date.now(),
    }

    const existing = state.sessions.find(s => s.id === sessionId)
    if (existing) {
      const idx = state.sessions.findIndex(s => s.id === sessionId)
      if (idx >= 0) {
        patchSession(idx, {
          title: isFirst ? text.slice(0, 45) : state.sessions[idx].title,
          messages: [...state.sessions[idx].messages, userMsg, botMsg],
        })
      }
    } else {
      state.sessions = [{ id: sessionId!, title: text.slice(0, 45), messages: [userMsg, botMsg], createdAt: Date.now() }, ...state.sessions]
    }

    if (!state.activeId) state.activeId = sessionId

    const botId = botMsg.id
    const sid = sessionId

    abortController = api.chat(
      sid, text, undefined,
      (chunk) => {
        const outputDelta = estimateTokens(chunk)
        const idx = state.sessions.findIndex(s => s.id === sid)
        if (idx < 0) return
        const msgs = state.sessions[idx].messages.map(m =>
          m.id === botId
            ? { ...m, content: m.content + chunk, tokens: (m.tokens ?? 0) + outputDelta }
            : m,
        )
        patchSession(idx, { messages: msgs })
      },
      (meta) => {
        const idx = state.sessions.findIndex(s => s.id === sid)
        if (idx < 0) return
        const msgs = state.sessions[idx].messages.map(m => {
          if (m.id !== botId) return m
          const updated: Message = { ...m, loading: false }

          if (meta) {
            if (meta.completionTokens !== undefined) {
              updated.tokens = meta.completionTokens
              updated.outputTokens = meta.completionTokens
            }
            if (meta.promptTokens !== undefined) {
              updated.inputTokens = meta.promptTokens
            }
            if (meta.durationMs !== undefined) {
              updated.durationMs = meta.durationMs
            }
          }

          // 解析 DeepSeek-R1 思考链 <think>...</think>
          const fullContent = updated.content
          const thinkEndIdx = fullContent.lastIndexOf('</think>')
          if (thinkEndIdx >= 0) {
            const thinkStartIdx = fullContent.indexOf('<think>')
            if (thinkStartIdx >= 0 && thinkStartIdx < thinkEndIdx) {
              updated.thinking = fullContent.substring(thinkStartIdx + 7, thinkEndIdx).trim()
              updated.content = fullContent.substring(thinkEndIdx + 8).trim()
            }
          }

          return updated
        })
        patchSession(idx, { messages: msgs })
      },
      (err) => {
        const idx = state.sessions.findIndex(s => s.id === sid)
        if (idx < 0) return
        const msgs = state.sessions[idx].messages.map(m =>
          m.id === botId
            ? { ...m, content: m.content || `请求失败：${err.message}`, loading: false, error: true }
            : m,
        )
        patchSession(idx, { messages: msgs })
      },
    )
  }

  function stopChat() {
    abortController?.abort()
  }

  return {
    sessions: computed(() => state.sessions),
    activeId: computed(() => state.activeId),
    active,
    newSession, selectSession, deleteSession,
    sendMessage, stopChat,
  }
})
