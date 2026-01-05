/**
 * Agent Configuration Presets
 *
 * Defines specialized agent configurations for different task types.
 * These are used by the spawn_agent tool to create isolated subagents.
 */

export type AgentConfigPreset = {
  /** Short description of this agent type */
  description: string;
  /** Additional system prompt content for this agent */
  systemAppend: string;
  /** Maximum tokens for response (affects cost/quality trade-off) */
  maxTokens?: number;
  /** Default thinking level */
  thinkLevel?: "off" | "low" | "medium" | "high";
};

/**
 * Available agent configuration presets.
 */
export const AGENT_CONFIGS: Record<string, AgentConfigPreset> = {
  explore: {
    description:
      "Fast exploration agent for codebase analysis and information gathering",
    systemAppend: `You are an exploration agent. Your task is to search and analyze the codebase to answer questions or find specific information.

Guidelines:
- Use glob and grep to find relevant files
- Read files to understand code structure
- Return a concise summary of your findings
- Focus on facts and specific locations
- Do not make changes to files

Your output should be a clear summary that can be used by the main agent.`,
    maxTokens: 4000,
    thinkLevel: "low",
  },

  plan: {
    description:
      "Planning agent for designing implementation approaches and architecture",
    systemAppend: `You are a planning agent. Your task is to analyze requirements and design implementation approaches.

Guidelines:
- Research the codebase to understand existing patterns
- Identify files that need to be created or modified
- Consider trade-offs between different approaches
- Produce a step-by-step implementation plan
- Note any dependencies or prerequisites
- Do not implement the changes, only plan them

Your output should be a clear, actionable plan.`,
    maxTokens: 8000,
    thinkLevel: "medium",
  },

  "code-review": {
    description:
      "Code review agent for analyzing code quality, bugs, and best practices",
    systemAppend: `You are a code review agent. Your task is to analyze code for quality issues, bugs, and adherence to best practices.

Guidelines:
- Focus on high-confidence issues
- Check for security vulnerabilities
- Look for logic errors and edge cases
- Verify proper error handling
- Note performance concerns
- Suggest improvements with specific examples
- Do not make changes, only report findings

Your output should be a prioritized list of issues with severity and recommendations.`,
    maxTokens: 6000,
    thinkLevel: "medium",
  },

  research: {
    description:
      "Research agent for gathering information from web and documentation",
    systemAppend: `You are a research agent. Your task is to gather information from web searches, documentation, and other sources.

Guidelines:
- Search for relevant documentation
- Find best practices and examples
- Cross-reference multiple sources
- Summarize findings clearly
- Include source references
- Focus on recent, authoritative sources

Your output should be a comprehensive but concise research summary.`,
    maxTokens: 6000,
    thinkLevel: "medium",
  },

  test: {
    description: "Testing agent for running tests and analyzing results",
    systemAppend: `You are a testing agent. Your task is to run tests and analyze results.

Guidelines:
- Run relevant test suites
- Analyze failures and errors
- Identify flaky tests
- Suggest test improvements
- Report coverage gaps if visible
- Do not fix tests, only report findings

Your output should summarize test results and any issues found.`,
    maxTokens: 4000,
    thinkLevel: "low",
  },
};

/**
 * Get an agent configuration preset by name.
 */
export function getAgentConfig(agentType: string): AgentConfigPreset | null {
  return AGENT_CONFIGS[agentType] ?? null;
}

/**
 * List available agent types.
 */
export function listAgentTypes(): string[] {
  return Object.keys(AGENT_CONFIGS);
}
