<script setup lang="ts">
import { ref } from 'vue'
import Sidebar from './components/Sidebar.vue'
import ChatArea from './components/ChatArea.vue'

const sidebarOpen = ref(false)

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

function closeSidebar() {
  sidebarOpen.value = false
}
</script>

<template>
  <div class="app-layout">
    <Sidebar :open="sidebarOpen" @close="closeSidebar" />
    <ChatArea @toggle-sidebar="toggleSidebar" />
  </div>
</template>
