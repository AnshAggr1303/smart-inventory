import 'server-only'

export class AgentRunError extends Error {
  constructor(
    public agent_type: string,
    public org_id: string,
    message: string
  ) {
    super(message)
    this.name = 'AgentRunError'
  }
}

export class AgentDuplicateError extends Error {
  constructor(public item_id: string) {
    super(`Pending action already exists for item ${item_id}`)
    this.name = 'AgentDuplicateError'
  }
}
