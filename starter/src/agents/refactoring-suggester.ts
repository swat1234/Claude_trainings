import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { REFACTORING_SUGGESTER_PROMPT } from '../prompts/refactoring-suggester.prompt.js';

export const refactoringSuggester: AgentDefinition = {
  description:
    'Identifies safe, actionable refactoring opportunities including extraction, simplification, modernization, naming, and pattern improvements.',
  prompt: REFACTORING_SUGGESTER_PROMPT,
  model: 'inherit',
  tools: ['Read', 'Grep', 'Glob', 'Skill']
};
