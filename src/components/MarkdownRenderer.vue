<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import python from 'highlight.js/lib/languages/python'
import java from 'highlight.js/lib/languages/java'
import typescript from 'highlight.js/lib/languages/typescript'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import sql from 'highlight.js/lib/languages/sql'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'

const md = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  typographer: true,
})

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('java', java)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('json', json)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('css', css)

// ── 自定义 fence 渲染：干净简约，无语言标签 ──
md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx]
  const info = token.info ? token.info.trim().split(/\s+/g)[0] : ''
  const str = token.content

  let highlighted: string
  if (info && hljs.getLanguage(info)) {
    try {
      highlighted = hljs.highlight(str, { language: info, ignoreIllegals: true }).value
    } catch {
      highlighted = escapeHtml(str)
    }
  } else {
    highlighted = escapeHtml(str)
  }

  return `<pre class="code-block"><code class="hljs">${highlighted}</code></pre>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Markdown 预处理器：在块级元素前插入空行，解决 LLM 输出缺少空行分隔的问题。
 */
function preprocessMarkdown(src: string): string {
  let s = src.replace(/\r\n/g, '\n')

  // ═══════════════════════════════════════════════════════════════
  // Phase 1 — 行中出现的块级标记前插入换行
  //   让 "text##heading" / "text- list" 等变为独占一行
  // ═══════════════════════════════════════════════════════════════
  //   标题标记：## / ### / #### 等（前面不能是 # 或换行）
  s = s.replace(/([^\n#])(#{2,6})/g, '$1\n$2')
  //   代码 fence：```
  s = s.replace(/([^\n])(```)/g, '$1\n$2')
  //   引用：> 后跟空格或非空
  s = s.replace(/([^\n])(>[ \t])/g, '$1\n$2')
  //   无序列表：- 后跟空格（排除前面是 - 的情况，避免拆分表格分隔行 |---|）
  s = s.replace(/([^\n-])(-[ \t])/g, '$1\n$2')
  //   有序列表：行中出现的 \d+. 前插入换行（如 "text 2. xxx" → "text\n2. xxx"）
  s = s.replace(/(\S)\s*(\d+\.\s)/g, '$1\n$2')
  //   表格：中文标点后紧跟 |col|col|col| 插入换行
  //   注意：只匹配全角标点（：。！？），避免 ASCII : 在分隔行 colspan 末尾误匹配
  s = s.replace(/([。！？：])\s*(\|[^|\n]+\|[^|\n]+\|)/g, '$1\n$2')

  // ═══════════════════════════════════════════════════════════════
  // Phase 2 — 确保标记后有空格（必须在 Phase 3 之前）
  //   因为 Phase 3 检测空格来确认是列表/标题
  // ═══════════════════════════════════════════════════════════════
  //   标题行补空格： "##标题" → "## 标题"
  s = s.replace(/^(#{1,6})([^\s#\n].*)$/gm, '$1 $2')
  //   无序列表补空格："-文本" → "- 文本"（* 避免匹配 **bold**）
  s = s.replace(/^(\s*-)([^\s\n].*)$/gm, '$1 $2')
  s = s.replace(/^(\s*\*)(?!\*)([^\s\n].*)$/gm, '$1 $2')
  s = s.replace(/^(\s*\+)([^\s\n].*)$/gm, '$1 $2')
  //   有序列表补空格："1.文本" → "1. 文本"
  s = s.replace(/^(\s*\d+\.)([^\s\n].*)$/gm, '$1 $2')
  //   引用补空格：">文本" → "> 文本"
  s = s.replace(/^(\s*>)([^\s\n].*)$/gm, '$1 $2')

  // ═══════════════════════════════════════════════════════════════
  // Phase 2.5 — 标题标记在单独一行，内容在下一行时合并（后端 tokenizer 丢空格）
  //   "#\n文本" → "# 文本"
  // ═══════════════════════════════════════════════════════════════
  s = s.replace(/^(#{1,6})\n(.+)$/gm, '$1 $2')

  // ═══════════════════════════════════════════════════════════════
  // Phase 2.75 — 修复后端 tokenizer 损坏的表格
  //   1) ||（行间分隔符）→ |\n|，将同一行上多个表格行拆开
  //   2) 丢失前导 | 的标题行：两行 content|\ncontent|\n|--| 合并为 |content|content|\n|--|
  // ═══════════════════════════════════════════════════════════════
  s = s.replace(/\|(\|[^|\n]+\|)/g, '|\n$1')
  //   处理分隔行单元格缺少闭合 | 的情况（tokenizer 在 | 前截断）
  //   "||:----:" → "|\n|:----:"（行尾）
  s = s.replace(/\|(\|[-:]+)$/gm, '|\n$1')
  //   合并跨行断裂的分隔行（有闭合 | 的场景）
  //   "|:----:|\n|:----:|:----:|:----:|" → "|:----:|:----:|:----:|:----:|"
  s = s.replace(/(\|[-:]+)\|\n\|([-:]+\|)/g, '$1|$2')
  //   合并跨行断裂的分隔行（无闭合 | 的场景）
  //   "|:----:\n|:----:|:----:|:----:|" → "|:----:|:----:|:----:|:----:|"
  s = s.replace(/(\|[-:]+)\n(\|[-:]+\|)/g, '$1$2')
  s = s.replace(/^([^\n]{1,20})\|\n\|?([^|\n]{1,20})\|\n(\|[-:]+(?:\|[-:]+)*\|)$/gm, '|$1|$2|\n$3')

  // ═══════════════════════════════════════════════════════════════
  // Phase 3 — 确保块级元素前有空行（markdown-it 严格要求）
  // ═══════════════════════════════════════════════════════════════
  //   fence
  s = s.replace(/([^\n])\n(\s*)(```|~~~)/g, '$1\n\n$2$3')
  //   修复：```后紧跟非语言内容同行时拆开（如 ```**输出：** → ```\n**输出：**）
  //   保留 ```python 这类合法开头不受影响
  s = s.replace(/^(`{3,})(?!\s*\w+\s*$)(.+)$/gm, '$1\n$2')
  //   表格行（保留连续表格行之间单换行）
  s = s.replace(/([^\n])\n(\|)/g, '$1\n\n$2')
  s = s.replace(/(\|[^\n]*)\n\n(?=\|)/g, '$1\n')
  //   合并表格中断裂的单格行：后端 tokenizer 丢掉了行内分隔列的 | 管道符
  //   "|a|\nb|\nc|" → "|a|b|c|"（仅当后续行不以 | 开头时合并）
  let tbl_prev: string
  do {
    tbl_prev = s
    s = s.replace(/(\|[^|\n]*\|)\n(?!\|)([^|\n]*\|)/g, '$1$2')
  } while (s !== tbl_prev)
  //   修复多行单元格值：|key|\nvalue\nvalue| → |key|valuevalue|
  s = s.replace(/(\|[^|\n]*\|)\n([^|\n]+)\n([^|\n]*\|)/g, '$1$2$3')
  //   无序列表
  s = s.replace(/([^\n])\n([-*+]) /g, '$1\n\n$2 ')
  //   有序列表
  s = s.replace(/([^\n])\n(\d+\.) /g, '$1\n\n$2 ')
  //   标题
  s = s.replace(/([^\n])\n(#)/g, '$1\n\n$2')
  //   引用
  s = s.replace(/([^\n])\n(>)/g, '$1\n\n$2')

  // ═══════════════════════════════════════════════════════════════
  // Phase 4 — 标题行中混入的表格管道拆到下一行
  //   "## 5.表格|col1|col2|" → "## 5.表格\n|col1|col2|"
  // ═══════════════════════════════════════════════════════════════
  s = s.replace(/^(#{1,6}\s[^|\n]+)(\|.*)$/gm, '$1\n$2')

  // ═══════════════════════════════════════════════════════════════
  // Phase 5 — 将同行表头行与分隔行（|--|）拆开
  //   "|a|b|c||---|---|" → "|a|b|c|\n|---|---|"
  // ═══════════════════════════════════════════════════════════════
  s = s.replace(/(\|[^|\n]+(?:\|[^|\n]+)*\|)\s*(\|[-:]+(?:\|[-:]+)*\|)/g, '$1\n$2')
  //   同时将分隔行与下一个数据行拆开（LLM 常写在一行）
  //   "|---|---||数据|" → "|---|---|\n|数据|"
  s = s.replace(/(\|[-:]+(?:\|[-:]+)*\|)(?=\|)/g, '$1\n')

  return s
}

const props = defineProps<{ content: string }>()

// Debounced content to avoid re-rendering on every SSE token
const debouncedContent = ref(props.content)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(() => props.content, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedContent.value = val
  }, 80)
}, { immediate: true })

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})

const html = computed(() => md.render(preprocessMarkdown(debouncedContent.value)))
</script>

<template>
  <div class="prose-msg" v-html="html" />
</template>
