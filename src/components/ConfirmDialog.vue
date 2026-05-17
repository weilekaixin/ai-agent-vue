<script setup lang="ts">
import { computed } from 'vue'
import { useChatStore } from '../stores/chat'

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
  return type ? (map[type] ?? type) : '操作确认'
}

/** 将原始 actionData 转为显示条目，针对 send_email 等特殊处理 */
const displayData = computed(() => {
  const meta = chat.pendingConfirm
  if (!meta || !meta.actionData) return []
  const entries: { label: string; value: string }[] = []

  if (meta.actionType === 'send_email') {
    const args = meta.actionData
    if (args.to) entries.push({ label: '收件人', value: String(args.to) })
    if (args.subject) entries.push({ label: '主题', value: String(args.subject) })
    if (args.body && typeof args.body === 'string') {
      const bodyLen = args.body.length
      entries.push({ label: '内容', value: `共 ${bodyLen} 字符` })
    }
    return entries
  }

  // 默认：展示所有 key-value，长值截断
  for (const [k, v] of Object.entries(meta.actionData)) {
    const str = String(v)
    entries.push({ label: k, value: str.length > 30 ? str.slice(0, 30) + '…' : str })
  }
  return entries
})
</script>

<template>
  <div v-if="chat.pendingConfirm" class="confirm-bar">
    <div class="confirm-bar__body">
      <span class="confirm-bar__icon">
        <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
          <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-width="1.5"/>
          <path d="M12 8V12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M12 16H12.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </span>
      <span class="confirm-bar__text">
        {{ formatActionType(chat.pendingConfirm.actionType) }}
        <template v-if="displayData.length > 0">
          <template v-for="entry in displayData" :key="entry.label">
            · {{ entry.label }}: {{ entry.value }}
          </template>
        </template>
      </span>
    </div>
    <div class="confirm-bar__actions">
      <button class="confirm-bar__btn confirm-bar__btn--reject" :disabled="chat.confirming" @click="chat.rejectAction()">拒绝</button>
      <button class="confirm-bar__btn confirm-bar__btn--allow" :disabled="chat.confirming" @click="chat.confirmAction()">
        <template v-if="chat.confirming">处理中…</template>
        <template v-else>允许</template>
      </button>
    </div>
  </div>
</template>
