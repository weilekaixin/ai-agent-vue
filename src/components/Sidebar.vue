<script setup lang="ts">
import { ref } from 'vue'
import { useChatStore } from '../stores/chat'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const chat = useChatStore()

const menuId = ref<string | null>(null)

const user = { id: 1, username: 'dev' }
</script>

<template>
  <!-- Mobile overlay backdrop -->
  <transition name="fade">
    <div v-if="open" class="sidebar-overlay" @click="emit('close')" />
  </transition>

  <aside :class="['sidebar', { open }]">
    <!-- Header -->
    <div class="sidebar-header">
      <a href="/" class="sidebar-brand" @click.prevent>
        <svg class="brand-logo" width="45.4" viewBox="0 0 46 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M32.73 0H25.7846L38.4499 32H45.3953L32.73 0Z" fill="currentColor" />
          <path d="M12.6653 0L0 32H7.08167L9.67193 25.28H22.9219L25.5122 32H32.5939L19.9286 0H12.6653ZM11.9626 19.3371L16.2969 8.09143L20.6313 19.3371H11.9626Z" fill="currentColor" />
        </svg>
      </a>
      <button class="sidebar-close-btn" @click="emit('close')" aria-label="关闭菜单">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <nav class="sidebar-nav">
      <!-- New session -->
      <div
        class="sidebar-menu-item"
        role="button"
        tabindex="0"
        @click="chat.newSession(); emit('close')"
        @keydown.enter.prevent="chat.newSession()"
        @keydown.space.prevent="chat.newSession()"
      >
        <span class="sidebar-menu-item-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </span>
        <span class="sidebar-menu-item-text">新建会话</span>
      </div>

      <div v-if="chat.sessions.length > 0" class="sidebar-divider" />
      <p v-if="chat.sessions.length === 0" class="sidebar-empty">暂无对话</p>

      <!-- Session list -->
      <div
        v-for="s in chat.sessions"
        :key="s.id"
        :class="['sidebar-item', { active: s.id === chat.activeId }]"
        role="button"
        tabindex="0"
        @click="chat.selectSession(s.id); menuId = null; emit('close')"
        @keydown.enter.prevent="chat.selectSession(s.id); menuId = null; emit('close')"
        @keydown.space.prevent="chat.selectSession(s.id); menuId = null; emit('close')"
        @mouseleave="menuId = null"
      >
        <span class="sidebar-item-title">{{ s.title }}</span>

        <button
          class="sidebar-ellipsis"
          title="更多"
          @click.stop="menuId = (menuId === s.id ? null : s.id)"
          @keydown.enter.stop="menuId = (menuId === s.id ? null : s.id)"
          @keydown.space.stop="menuId = (menuId === s.id ? null : s.id)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5"  cy="12" r="1.5"/>
            <circle cx="12" cy="12" r="1.5"/>
            <circle cx="19" cy="12" r="1.5"/>
          </svg>
        </button>

        <div v-if="menuId === s.id" class="delete-menu">
          <button
            class="delete-btn"
            @click.stop="chat.deleteSession(s.id); menuId = null"
            @keydown.enter.stop="chat.deleteSession(s.id); menuId = null"
            @keydown.space.stop="chat.deleteSession(s.id); menuId = null"
          >
            删除对话
          </button>
        </div>
      </div>
    </nav>

    <!-- Footer -->
    <div class="sidebar-footer">
      <div class="sidebar-avatar">{{ user.username.charAt(0).toUpperCase() }}</div>
      <div class="sidebar-user-info">
        <span class="sidebar-user-name">{{ user.username }}</span>
        <span class="sidebar-user-plan">Free plan</span>
      </div>
    </div>
  </aside>
</template>
