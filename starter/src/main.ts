import * as dotenv from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { CodeReviewOrchestrator } from './orchestrator.js';
import { ReportGenerator, formatError } from './utils/index.js';

dotenv.config();

/**
 * Main entry point for the Claude Multi-Agent Code Review System
 *
 * Usage:
 * npm run dev <owner> <repo> <pr-number>
 */
async function main(): Promise<void> {
  const [owner, repo, prStr] = process.argv.slice(2);

  // Validate required GitHub authentication
  if (!process.env.GITHUB_TOKEN?.trim()) {
    console.error(
      [
        'GITHUB_TOKEN is required.',
        '',
        'Set the GITHUB_TOKEN environment variable before starting the application.',
        'Example:',
        '  export GITHUB_TOKEN=<your-github-token>'
      ].join('\n')
    );
    process.exitCode = 1;
    return;
  }

  // Validate command-line arguments

  // Validate command-line arguments
  if (!owner || !repo || !prStr) {
    console.error(
      'Usage: npm run dev <owner> <repo> <pr-number>'
    );
    process.exitCode = 1;
    return;
  }

  const prNumber = Number(prStr);

  if (
    !Number.isInteger(prNumber) ||
    prNumber <= 0
  ) {
    console.error(
      `Invalid PR number: "${prStr}". PR number must be a positive integer.`
    );
    process.exitCode = 1;
    return;
  }

  // Validate authentication
  const hasAnthropicAuth =
    Boolean(process.env.ANTHROPIC_API_KEY);

  const hasAwsAuth =
    Boolean(process.env.AWS_ACCESS_KEY_ID) &&
    Boolean(process.env.AWS_SECRET_ACCESS_KEY);

  if (hasAwsAuth) {
    if (!process.env.AWS_REGION) {
      console.error(
        'AWS_REGION is required when using AWS Bedrock authentication.'
      );
      process.exitCode = 1;
      return;
    }

    console.log('Using AWS Bedrock authentication');
  } else if (hasAnthropicAuth) {
    console.log('Using Anthropic API authentication');
  } else {
    console.error(
      [
        'No Claude authentication configured.',
        '',
        'Configure one of:',
        '1. Anthropic API:',
        '   ANTHROPIC_API_KEY=<your-key>',
        '',
        '2. AWS Bedrock:',
        '   AWS_ACCESS_KEY_ID=<your-key-id>',
        '   AWS_SECRET_ACCESS_KEY=<your-secret>',
        '   AWS_REGION=<your-region>'
      ].join('\n')
    );

    process.exitCode = 1;
    return;
  }

  if (!process.env.ANTHROPIC_MODEL) {
    console.error(
      [
        'ANTHROPIC_MODEL is required.',
        '',
        'Examples:',
        'Anthropic API:',
        '  claude-sonnet-4-5-20250929',
        '',
        'AWS Bedrock:',
        '  us.anthropic.claude-sonnet-4-5-20250929-v1:0'
      ].join('\n')
    );

    process.exitCode = 1;
    return;
  }

  console.log('');
  console.log('Claude Multi-Agent Code Review');
  console.log('================================');
  console.log(`Repository: ${owner}/${repo}`);
  console.log(`Pull Request: #${prNumber}`);
  console.log(`Model: ${process.env.ANTHROPIC_MODEL}`);
  console.log('');

  try {
    const orchestrator = new CodeReviewOrchestrator();

    console.log('Starting multi-agent analysis...');

    const report = await orchestrator.reviewPullRequest(
      owner,
      repo,
      prNumber
    );

    console.log('Analysis complete.');

    const reportGenerator = new ReportGenerator();

    const reportsDirectory = join(
      process.cwd(),
      'reports'
    );

    await mkdir(reportsDirectory, {
      recursive: true
    });

    const safeOwner = owner.replace(/[^a-zA-Z0-9._-]/g, '_');
const safeRepo = repo.replace(/[^a-zA-Z0-9._-]/g, '_');

const baseName = `${safeOwner}_${safeRepo}_${prNumber}`;

    const jsonPath = join(
      reportsDirectory,
      `${baseName}.json`
    );

    const markdownPath = join(
      reportsDirectory,
      `${baseName}.md`
    );

    const htmlPath = join(
      reportsDirectory,
      `${baseName}.html`
    );

    await Promise.all([
      writeFile(
        jsonPath,
        reportGenerator.generateJSONReport(report),
        'utf8'
      ),

      writeFile(
        markdownPath,
        reportGenerator.generateMarkdownReport(report),
        'utf8'
      ),

      writeFile(
        htmlPath,
        reportGenerator.generateHTMLReport(report),
        'utf8'
      )
    ]);

    console.log('');
    console.log('Reports generated successfully:');
    console.log(`  ${jsonPath}`);
    console.log(`  ${markdownPath}`);
    console.log(`  ${htmlPath}`);

    console.log('');
    console.log('Review summary:');
    console.log(
      `  Files reviewed: ${report.summary.totalFiles}`
    );
    console.log(
      `  Overall score: ${report.summary.overallScore}/100`
    );
    console.log(
      `  Critical issues: ${report.summary.criticalIssues}`
    );
    console.log(
      `  High-priority tests: ${report.summary.highPriorityTests}`
    );
    console.log(
      `  Refactoring opportunities: ${report.summary.refactoringOpportunities}`
    );
  } catch (error) {
    console.error('');
    console.error(
      `Code review failed: ${formatError(error)}`
    );

    if (
      error instanceof Error &&
      process.env.LOG_LEVEL === 'debug'
    ) {
      console.error(error.stack);
    }

    process.exitCode = 1;
  }
}

void main();
