import type { AgentTool, AgentToolDefinition } from '../../shared/types'

const TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/

/**
 * Registers, looks up and validates agent tools, and produces OpenAI-compatible
 * tool definitions for the model.
 */
export class AgentToolRegistry {
  private readonly tools: Map<string, AgentTool> = new Map()

  constructor(initialTools: AgentTool[] = []) {
    for (const tool of initialTools) {
      this.register(tool)
    }
  }

  register(tool: AgentTool): void {
    this.validateTool(tool)
    if (this.tools.has(tool.name)) {
      throw new Error(`重复注册 Agent 工具: ${tool.name}`)
    }
    this.tools.set(tool.name, tool)
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name)
  }

  require(name: string): AgentTool {
    const tool = this.get(name)
    if (!tool) {
      throw new Error(`未知 Agent 工具: ${name}`)
    }
    return tool
  }

  list(): AgentTool[] {
    return Array.from(this.tools.values())
  }

  toModelToolDefinitions(): AgentToolDefinition[] {
    return this.list().map(
      (tool): AgentToolDefinition => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      }),
    )
  }

  private validateTool(tool: AgentTool): void {
    if (!TOOL_NAME_PATTERN.test(tool.name)) {
      throw new Error(`Agent 工具名不合法: ${tool.name}`)
    }
    if (!tool.title || !tool.description) {
      throw new Error(`Agent 工具缺少标题或描述: ${tool.name}`)
    }
    if (!tool.inputSchema || tool.inputSchema.type !== 'object') {
      throw new Error(`Agent 工具参数 schema 必须是 object: ${tool.name}`)
    }
    if (!tool.inputSchema.properties) {
      throw new Error(`Agent 工具缺少 properties: ${tool.name}`)
    }
    if (!tool.inputSchema.required) {
      throw new Error(`Agent 工具缺少 required: ${tool.name}`)
    }
  }
}
