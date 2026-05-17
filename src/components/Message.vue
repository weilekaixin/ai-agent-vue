<script lang="ts" setup>
import {computed, onMounted, onUnmounted, ref, watch} from 'vue'
import type {Message as Msg} from '../types'
import MarkdownRenderer from './MarkdownRenderer.vue'
import { useChatStore } from '../stores/chat'

const props = defineProps<{ message: Msg }>()
const thinkOpen = ref(false)
const chat = useChatStore()

function formatActionType(type?: string): string {
  const map: Record<string, string> = {
    send_email: '发送邮件',
    send_message: '发送消息',
    execute_code: '执行代码',
    create_file: '创建文件',
    modify_file: '修改文件',
    delete_file: '删除文件',
    web_search: '搜索网络',
    web_fetch: '读取网页',
    tool_call: '调用工具',
  }
  return type ? (map[type] ?? type) : '操作'
}

/** 当前内容是否包含思考链（用于流式进行中检测） */
const hasThinking = computed(() => {
  return !!props.message.thinking || props.message.content.includes('<think>')
})

/** 流式进行中从 content 实时提取思考内容 */
const liveThinking = computed(() => {
  if (props.message.thinking) return props.message.thinking
  const c = props.message.content
  const start = c.indexOf('<think>')
  const end = c.lastIndexOf('</think>')
  if (start >= 0 && end > start) {
    return c.substring(start + 7, end).trim()
  }
  if (start >= 0 && end < 0) {
    return c.substring(start + 7).trim()
  }
  return ''
})

// ── 实时计时器 ──
const elapsed = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

function startTimer() {
  if (!props.message.startTime) return
  elapsed.value = 0
  timer = setInterval(() => {
    elapsed.value = Math.floor((Date.now() - (props.message.startTime ?? Date.now())) / 1000)
  }, 1000)
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

onMounted(() => {
  if (props.message.loading && props.message.startTime) {
    startTimer()
  }
})

watch(() => props.message.loading, (loading) => {
  if (loading && props.message.startTime) {
    startTimer()
  } else if (!loading) {
    stopTimer()
  }
})

onUnmounted(() => {
  stopTimer()
})

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remain = seconds % 60
  return `${minutes}m ${remain}s`
}

function formatTokenCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}
</script>

<template>
  <div :class="['msg-row', message.role === 'user' ? 'user' : '']">
    <div
        :class="['msg-bubble-wrap', message.role === 'user' ? 'user' : '']"
        :style="{ maxWidth: message.role === 'user' ? '72%' : '90%' }"
    >
      <!-- Loading dots -->
      <div v-if="message.loading && !message.content" class="msg-loading-wrap">
        <div class="loading-dots">
          <span class="loading-dot"/>
          <span class="loading-dot"/>
          <span class="loading-dot"/>
        </div>
      </div>

      <!-- Error -->
      <p v-else-if="message.error" class="input-error">{{ message.content }}</p>

      <!-- User message -->
      <template v-else-if="message.role === 'user'">
        <div class="msg-bubble user">{{ message.content }}</div>
      </template>

      <!-- Assistant message -->
      <template v-else>
        <!-- Thinking chain (DeepSeek style) -->
        <div v-if="hasThinking" class="think-section">
          <button
              :class="message.loading ? 'is-thinking' : 'is-done'"
              class="think-badge"
              @click="thinkOpen = !thinkOpen"
          >
            <span class="think-label">{{ message.loading ? '思考中' : '已思考' }}</span>
            <span v-if="message.loading && message.startTime" class="think-time">
              {{ formatDuration(elapsed * 1000) }}
            </span>
            <span v-else-if="message.durationMs" class="think-time">
              （{{ formatDuration(message.durationMs) }}）
            </span>
          </button>
          <div v-show="thinkOpen" class="think-expanded">
            <MarkdownRenderer :content="liveThinking"/>
          </div>
        </div>

        <!-- Processing status indicators -->
        <div v-if="message.actionType && (chat.pendingConfirm || chat.confirming)" class="msg-status">
          <span v-if="chat.confirming" class="msg-status-badge msg-status-badge--executing">
            <span class="msg-status-icon">&#128228;</span>
            <span>{{ ' 正在执行' + formatActionType(message.actionType) + '...' }}</span>
          </span>
          <span v-else class="msg-status-badge msg-status-badge--pending">
            <span class="msg-status-icon">&#9203;</span>
            <span>{{ ' 正在准备' + formatActionType(message.actionType) + '...' }}</span>
          </span>
        </div>

        <div class="msg-bubble assistant">
          <MarkdownRenderer :content="message.content"/>
        </div>
        <div class="msg-meta">
          <span v-if="message.loading && message.startTime" class="msg-duration">
            <span class="msg-duration-icon">⏱</span>
            {{ formatDuration(elapsed * 1000) }}
          </span>
          <span v-else-if="message.durationMs" class="msg-duration">
            <span class="msg-duration-icon">⏱</span>
            {{ formatDuration(message.durationMs) }}
          </span>
          <span v-if="message.durationMs && message.tokens !== undefined" class="msg-meta-dot">·</span>
          <span v-if="message.tokens !== undefined" class="msg-token">
            <span class="msg-token-arrow">↓</span>
            <span class="msg-token-num">{{ formatTokenCount(message.tokens) }}</span>
            <span class="msg-token-suffix"> tokens</span>
          </span>
        </div>
      </template>
    </div>
  </div>
</template>
