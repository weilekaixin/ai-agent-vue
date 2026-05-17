import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import type { Session, Message, ChatMetadata } from '../types'
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
  const pendingConfirm = ref<ChatMetadata | null>(null)
  /** 确认/拒绝请求进行中，防止重复点击 */
  const confirming = ref(false)

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
        const session = state.sessions[idx]
        const botMsg = session.messages.find(m => m.id === botId)
        if (botMsg) {
          botMsg.content += chunk
          botMsg.tokens = (botMsg.tokens ?? 0) + outputDelta
          // Trigger reactivity by replacing the array reference (cheaper than full map)
          patchSession(idx, { messages: [...session.messages] })
        }
      },
      (meta) => {
        const idx = state.sessions.findIndex(s => s.id === sid)
        if (idx < 0) return
        const session = state.sessions[idx]
        const botMsg = session.messages.find(m => m.id === botId)
        if (!botMsg) return

        botMsg.loading = false

        if (meta) {
          if (meta.completionTokens !== undefined) {
            botMsg.tokens = meta.completionTokens
            botMsg.outputTokens = meta.completionTokens
          }
          if (meta.promptTokens !== undefined) {
            botMsg.inputTokens = meta.promptTokens
          }
          if (meta.durationMs !== undefined) {
            botMsg.durationMs = meta.durationMs
          }
          // 保存待确认信息到消息
          if (meta.needConfirm) {
            botMsg.actionType = meta.actionType
            botMsg.actionData = meta.actionData
          }
        }

        // 解析 DeepSeek-R1 思考链 <think>...</think>
        const fullContent = botMsg.content
        const thinkEndIdx = fullContent.lastIndexOf('</think>')
        if (thinkEndIdx >= 0) {
          const thinkStartIdx = fullContent.indexOf('<think>')
          if (thinkStartIdx >= 0 && thinkStartIdx < thinkEndIdx) {
            botMsg.thinking = fullContent.substring(thinkStartIdx + 7, thinkEndIdx).trim()
            botMsg.content = fullContent.substring(thinkEndIdx + 8).trim()
          }
        }

        patchSession(idx, { messages: [...session.messages] })
      },
      (err) => {
        const idx = state.sessions.findIndex(s => s.id === sid)
        if (idx < 0) return
        const session = state.sessions[idx]
        const botMsg = session.messages.find(m => m.id === botId)
        if (!botMsg) return
        botMsg.content = botMsg.content || `请求失败：${err.message}`
        botMsg.loading = false
        botMsg.error = true
        patchSession(idx, { messages: [...session.messages] })
      },
      // onNeedConfirm — 实时收到需确认信号立即弹出弹框
      (meta) => {
        pendingConfirm.value = meta
      },
    )
  }

  function stopChat() {
    abortController?.abort()
  }

  // ── 人工确认 ──────────────────────────────

  async function confirmAction() {
    if (!pendingConfirm.value || !state.activeId || confirming.value) return
    confirming.value = true
    const sid = state.activeId

    try {
      const response = await fetch('/api/chat/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sid, approved: true }),
      })
      if (!response.ok) {
        console.error('resume API 失败:', response.status)
        return
      }
      // 读取 SSE 流中的补充回复
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let extraContent = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''
        for (const part of parts) {
          const lines = part.split('\n')
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const data = line.slice(5)
              if (data && !data.startsWith('{') && !data.startsWith('__')) {
                extraContent += data
              }
            }
          }
        }
      }
      // 把补充回复追加到最后一条 bot 消息
      if (extraContent) {
        const idx = state.sessions.findIndex(s => s.id === sid)
        if (idx >= 0) {
          const msgs = [...state.sessions[idx].messages]
          // 从后往前找最后一条非 loading 的 assistant 消息
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === 'assistant' && !msgs[i].loading) {
              msgs[i] = { ...msgs[i], content: msgs[i].content + '\n\n' + extraContent }
              break
            }
          }
          patchSession(idx, { messages: msgs })
        }
      }
    } catch (err) {
      console.error('resume API 异常:', err)
    } finally {
      pendingConfirm.value = null
      confirming.value = false
    }
  }

  async function rejectAction() {
    if (!pendingConfirm.value || !state.activeId || confirming.value) return
    confirming.value = true
    const sid = state.activeId

    try {
      const response = await fetch('/api/chat/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sid, approved: false }),
      })
      if (!response.ok) {
        console.error('reject API 失败:', response.status)
      }
    } catch (err) {
      console.error('reject API 异常:', err)
    } finally {
      pendingConfirm.value = null
      confirming.value = false
    }
  }

  return {
    sessions: computed(() => state.sessions),
    activeId: computed(() => state.activeId),
    active,
    pendingConfirm,
    confirming,
    newSession, selectSession, deleteSession,
    sendMessage, stopChat,
    confirmAction, rejectAction,
  }
})
