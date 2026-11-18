import { query } from '@anthropic-ai/claude-agent-sdk';

import {
  ReviewReportSchema,
  ReviewReportJSONSchema,
  type ReviewReport
} from './types/report-types.js';

import { mcpServersConfig } from './config/mcp.config.js';

import {
  codeQualityAnalyzer,
  testCoverageAnalyzer,
  refactoringSuggester
} from './agents/index.js';

import { buildOrchestratorPrompt } from './prompts/index.js';

import {
  RateLimiter,
  withRetry,
  withTimeout,
  ReviewError,
  ErrorCodes
} from './utils/index.js';

import type { RateLimiterConfig } from './utils/index.js';

/**
 * Orchestrator configuration options
 */
export interface OrchestratorOptions {
  rateLimit?: Partial<RateLimiterConfig>;
  timeoutMs?: number;
  maxRetries?: number;
}

/**
 * Main Code Review Orchestrator.
 *
 * The main agent retrieves the PR through GitHub MCP,
 * delegates analysis through Task to three specialized subagents,
 * and returns a schema-validated ReviewReport.
 */
export class CodeReviewOrchestrator {
  private readonly rateLimiter: RateLimiter;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: OrchestratorOptions = {}) {
    this.rateLimiter = new RateLimiter(options.rateLimit);
    this.timeoutMs = options.timeoutMs ?? 300000;
    this.maxRetries = options.maxRetries ?? 2;
  }

  /**
   * Review a pull request using specialized subagents.
   */
  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    const startedAt = Date.now();

    if (!owner.trim() || !repo.trim()) {
      throw new ReviewError(
        'Repository owner and repository name are required',
        ErrorCodes.INVALID_CONFIG
      );
    }

    if (!Number.isInteger(prNumber) || prNumber <= 0) {
      throw new ReviewError(
        'Pull request number must be a positive integer',
        ErrorCodes.INVALID_CONFIG,
        { prNumber }
      );
    }

    await this.rateLimiter.acquire(5000);

    try {
      const operation = async (): Promise<ReviewReport> => {
        let structuredOutput: unknown;

        const response = query({
          prompt: buildOrchestratorPrompt(owner, repo, prNumber),

          options: {
            cwd: process.env.PROJECT_ROOT || process.cwd(),

            model: process.env.ANTHROPIC_MODEL,
            maxTurns: 30,
            permissionMode: 'dontAsk',
            mcpServers: mcpServersConfig,

            tools: [
              'Task',
              'Read',
              'Grep',
              'Glob',
              'Skill',
              'mcp__github__*',
              'mcp__eslint__*'
            ],

            allowedTools: [
              'Task',
              'Read',
              'Grep',
              'Glob',
              'Skill',
              'mcp__github__*',
              'mcp__eslint__*'
            ],

            agents: {
              'code-quality-analyzer': codeQualityAnalyzer,
              'test-coverage-analyzer': testCoverageAnalyzer,
              'refactoring-suggester': refactoringSuggester
            },

            settingSources: ['project'],

            outputFormat: {
              type: 'json_schema',
              schema: ReviewReportJSONSchema
            }
          }
        });

        for await (const message of response) {
          if (
            message.type === 'result' &&
            message.subtype === 'success'
          ) {
            structuredOutput = message.structured_output;
          }

          if (
            message.type === 'result' &&
            message.subtype !== 'success'
          ) {
            throw new ReviewError(
              `Agent SDK execution failed: ${message.subtype}`,
              ErrorCodes.AGENT_FAILED,
              {
                errors:
                  'errors' in message
                    ? message.errors
                    : undefined
              }
            );
          }
        }

        if (structuredOutput === undefined) {
          throw new ReviewError(
            'Claude Agent SDK returned no structured review output',
            ErrorCodes.STRUCTURED_OUTPUT_FAILED
          );
        }

        const parsed = ReviewReportSchema.safeParse(structuredOutput);

        if (!parsed.success) {
          throw new ReviewError(
            'Review output failed ReviewReport schema validation',
            ErrorCodes.VALIDATION_FAILED,
            {
              validationErrors: parsed.error.issues
            }
          );
        }

        /*
         * The schema requires runtime metadata. Preserve the model-generated
         * metadata but ensure duration and analysis timestamp reflect this
         * execution.
         */
        return {
          ...parsed.data,
          pullRequest: {
            owner,
            repo,
            number: prNumber
          },
          metadata: {
            ...parsed.data.metadata,
            analyzedAt:
              parsed.data.metadata.analyzedAt ||
              new Date().toISOString(),
            duration: Date.now() - startedAt
          }
        };
      };

      return await withRetry(
        () =>
          withTimeout(
            operation,
            this.timeoutMs,
            `Code review timed out after ${this.timeoutMs}ms`
          ),
        this.maxRetries,
        1000
      );
    } finally {
      this.rateLimiter.release();
    }
  }
}
