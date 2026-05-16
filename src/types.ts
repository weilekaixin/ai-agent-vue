export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  loading?: boolean
  error?: boolean
  /** 该消息的 token 数（助手回复：服务端精确值覆盖客户端估算） */
  tokens?: number
  /** 输入 token 数（服务端精确值） */
  inputTokens?: number
  /** 输出 token 数（服务端精确值） */
  outputTokens?: number
  /** 回复耗时（毫秒） */
  durationMs?: number
  /** DeepSeek-R1 思考链内容（解析 <think> 标签得到） */
  thinking?: string
  /** 消息创建时间戳（用于实时计时） */
  startTime?: number
}

export interface Session {
  id: string
  title: string
  messages: Message[]
  createdAt: number
}

/** SSE 结束事件携带的元数据 */
export interface ChatMetadata {
  promptTokens: number
  completionTokens: number
  durationMs: number
}

/** 粗略估算 token 数（与后端 estimateTokens 保持一致） */
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length * 0.5)
}
