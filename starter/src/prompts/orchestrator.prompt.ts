export function buildOrchestratorPrompt(
  owner: string,
  repo: string,
  prNumber: number
): string {
  return `
Review pull request #${prNumber} in ${owner}/${repo}.

Required workflow:

1. Use GitHub MCP tools to fetch pull-request metadata, changed files,
   patches, additions, deletions, and relevant repository context.
2. Review every changed source file.
3. Dispatch the following three registered subagents through the Task tool:
   - code-quality-analyzer
   - test-coverage-analyzer
   - refactoring-suggester
4. Run independent analyses in parallel where possible.
5. Combine the subagent findings file by file.
6. Gracefully preserve successful findings if one analysis fails.
7. Calculate summary counts and a defensible overall score.
8. Produce recommendations ordered by critical, high, medium, then low.
9. Return only data matching the required ReviewReport JSON schema.

Do not invent files, line numbers, tests, findings, or repository details.
Every changed file must have codeQuality, testCoverage, and refactorings
results. Empty result arrays are valid when no supported finding exists.

Claude Skills:
Instruct subagents to use the Skill tool and invoke
javascript-best-practices when reviewing JavaScript or TypeScript.
`;
}
