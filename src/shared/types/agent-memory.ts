export type AgentMemorySource = 'user_confirmed' | 'manual' | 'imported'

export interface AgentMemoryRecord {
  topic: string
  content: string
  source: AgentMemorySource
  updatedAt: number
}
