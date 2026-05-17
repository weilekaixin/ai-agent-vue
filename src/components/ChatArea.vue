<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useChatStore } from '../stores/chat'
import Message from './Message.vue'
import InputArea from './InputArea.vue'
import ConfirmDialog from './ConfirmDialog.vue'

defineEmits<{ 'toggle-sidebar': [] }>()

const chat = useChatStore()

const bottomRef = ref<HTMLDivElement | null>(null)
const isNearBottom = ref(true)
const SCROLL_THRESHOLD = 80

function greeting(): string {
  const h = new Date().getHours()
  if (h >= 6 && h < 12)  return '早上好！今天有什么可以帮你的？'
  if (h >= 12 && h < 14) return '中午好！有什么可以帮你的？'
  if (h >= 14 && h < 18) return '下午好！有什么可以帮你的？'
  if (h >= 18 && h < 22) return '晚上好！有什么可以帮你的？'
  return '夜深了，请问有什么可以帮到你的？'
}

function onScroll(e: Event) {
  const el = e.target as HTMLElement
  const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
  isNearBottom.value = distFromBottom < SCROLL_THRESHOLD
}

watch(() => chat.active?.messages, async () => {
  await nextTick()
  if (isNearBottom.value) {
    bottomRef.value?.scrollIntoView({ behavior: 'smooth' })
  }
}, { deep: true })
</script>

<template>
  <div class="chat-area">
    <!-- Mobile header with hamburger -->
    <div class="mobile-header">
      <button class="mobile-menu-btn" @click="$emit('toggle-sidebar')" aria-label="菜单">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
    </div>

    <!-- Empty state -->
    <template v-if="!chat.active">
      <div class="empty-state-swap fade-in">
        <div class="empty-center-area">
          <h1 class="empty-title">{{ greeting() }}</h1>
        </div>
        <ConfirmDialog />
        <InputArea />
      </div>
    </template>

    <!-- Chat -->
    <template v-else>
      <div class="msg-state-swap fade-in">
        <div class="msg-container" @scroll="onScroll">
          <div class="msg-list">
            <Message v-for="msg in chat.active.messages" :key="msg.id" :message="msg" />
          </div>
          <div ref="bottomRef" style="height: 1px" />
        </div>
        <ConfirmDialog />
        <InputArea :disabled="false" :placeholder="'继续对话...'" />
      </div>
    </template>
  </div>
</template>
