<script setup lang="ts">
import {computed, ref} from 'vue'
import {useChatStore} from '../stores/chat'

const props = withDefaults(defineProps<{
  disabled?: boolean
  placeholder?: string
}>(), {
  disabled: false,
  placeholder: 'How can I help you today?',
})

const chat = useChatStore()
const text = ref('')
const taRef = ref<HTMLTextAreaElement | null>(null)

function send() {
  const t = text.value.trim()
  if (!t || props.disabled || chat.active?.messages.some(m => m.loading)) return
  chat.sendMessage(t)
  text.value = ''
  if (taRef.value) taRef.value.style.height = 'auto'
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

function onInput(e: Event) {
  const el = e.target as HTMLTextAreaElement
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}

const isLoading = computed(() => chat.active?.messages.some(m => m.loading) ?? false)
const canSend = computed(() => text.value.trim().length > 0 && !props.disabled && !isLoading.value)
</script>

<template>
  <div class="input-wrapper">
    <div class="input-inner">
      <div class="composer">
        <div class="composer-row">
          <textarea
              ref="taRef"
              v-model="text"
              :placeholder="placeholder"
              rows="1"
              class="composer-textarea"
              @keydown="onKeydown"
              @input="onInput"
          />
          <button
              v-if="isLoading"
              class="stop-btn"
              title="中断生成"
              @click="chat.stopChat()"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="3"/>
            </svg>
          </button>
          <button
              v-else
              :disabled="!canSend"
              :class="['send-btn', { 'send-btn-active': canSend }]"
              title="发送 (Enter)"
              @click="send"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"/>
              <polyline points="5 12 12 5 19 12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
