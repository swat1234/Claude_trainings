import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  CodeQualityResultSchema,
  TestCoverageResultSchema,
  RefactoringSuggestionSchema,
  CodeQualityResultJSONSchema,
  TestCoverageResultJSONSchema,
  RefactoringSuggestionJSONSchema
} from '../src/types/analysis-results.js';

import {
  ReviewReportSchema,
  ReviewReportJSONSchema
} from '../src/types/report-types.js';


describe('CodeQualityResultSchema', () => {
  const validData = {
    file: 'src/example.ts',
    issues: [
      {
        line: 10,
        severity: 'high' as const,
        category: 'security' as const,
        description: 'Untrusted input is used without validation',
        suggestion: 'Validate the input before use'
      }
    ],
    overallScore: 75,
    summary: 'One high-severity issue found'
  };

  it('accepts valid data', () => {
    expect(() =>
      CodeQualityResultSchema.parse(validData)
    ).not.toThrow();
  });

  it('rejects invalid severity', () => {
    expect(() =>
      CodeQualityResultSchema.parse({
        ...validData,
        issues: [
          {
            ...validData.issues[0],
            severity: 'dangerous'
          }
        ]
      })
    ).toThrow(z.ZodError);
  });

  it('rejects missing required fields', () => {
    expect(() =>
      CodeQualityResultSchema.parse({
        file: 'src/example.ts'
      })
    ).toThrow(z.ZodError);
  });

  it('accepts an empty issues array', () => {
    expect(() =>
      CodeQualityResultSchema.parse({
        ...validData,
        issues: []
      })
    ).not.toThrow();
  });

  it('accepts score boundary 0', () => {
    expect(() =>
      CodeQualityResultSchema.parse({
        ...validData,
        overallScore: 0
      })
    ).not.toThrow();
  });

  it('accepts score boundary 100', () => {
    expect(() =>
      CodeQualityResultSchema.parse({
        ...validData,
        overallScore: 100
      })
    ).not.toThrow();
  });

  it('rejects score below 0', () => {
    expect(() =>
      CodeQualityResultSchema.parse({
        ...validData,
        overallScore: -1
      })
    ).toThrow(z.ZodError);
  });

  it('rejects score above 100', () => {
    expect(() =>
      CodeQualityResultSchema.parse({
        ...validData,
        overallScore: 101
      })
    ).toThrow(z.ZodError);
  });
});


describe('TestCoverageResultSchema', () => {
  const validData = {
    file: 'src/example.ts',
    hasTests: true,
    testFiles: ['tests/example.test.ts'],
    untestedPaths: [
      {
        type: 'branch' as const,
        location: 'src/example.ts:20',
        priority: 'high' as const,
        reasoning: 'Error branch is not tested',
        suggestedTest:
          'Call the function with invalid input and expect it to throw'
      }
    ],
    coverageEstimate: 80,
    summary: 'Most primary paths are tested'
  };

  it('accepts valid data', () => {
    expect(() =>
      TestCoverageResultSchema.parse(validData)
    ).not.toThrow();
  });

  it('accepts empty test files and untested paths', () => {
    expect(() =>
      TestCoverageResultSchema.parse({
        ...validData,
        hasTests: false,
        testFiles: [],
        untestedPaths: [],
        coverageEstimate: 0
      })
    ).not.toThrow();
  });

  it('accepts coverage estimate 100', () => {
    expect(() =>
      TestCoverageResultSchema.parse({
        ...validData,
        coverageEstimate: 100
      })
    ).not.toThrow();
  });

  it('rejects invalid priority', () => {
    expect(() =>
      TestCoverageResultSchema.parse({
        ...validData,
        untestedPaths: [
          {
            ...validData.untestedPaths[0],
            priority: 'urgent'
          }
        ]
      })
    ).toThrow(z.ZodError);
  });

  it('rejects coverage above 100', () => {
    expect(() =>
      TestCoverageResultSchema.parse({
        ...validData,
        coverageEstimate: 101
      })
    ).toThrow(z.ZodError);
  });
});


describe('RefactoringSuggestionSchema', () => {
  const validData = {
    file: 'src/example.ts',
    suggestions: [
      {
        type: 'extract-function' as const,
        location: 'src/example.ts:30-45',
        impact: 'medium' as const,
        description: 'Extract validation into a helper function',
        before: 'if (value && value.length > 0) { /* validation */ }',
        after: 'validateValue(value);',
        benefits: 'Improves readability and reuse'
      }
    ],
    summary: 'One refactoring opportunity found'
  };

  it('accepts valid data', () => {
    expect(() =>
      RefactoringSuggestionSchema.parse(validData)
    ).not.toThrow();
  });

  it('accepts an empty suggestions array', () => {
    expect(() =>
      RefactoringSuggestionSchema.parse({
        ...validData,
        suggestions: []
      })
    ).not.toThrow();
  });

  it('rejects invalid refactoring type', () => {
    expect(() =>
      RefactoringSuggestionSchema.parse({
        ...validData,
        suggestions: [
          {
            ...validData.suggestions[0],
            type: 'rewrite-everything'
          }
        ]
      })
    ).toThrow(z.ZodError);
  });

  it('rejects missing required suggestion fields', () => {
    expect(() =>
      RefactoringSuggestionSchema.parse({
        file: 'src/example.ts',
        suggestions: [
          {
            type: 'rename'
          }
        ],
        summary: 'Invalid example'
      })
    ).toThrow(z.ZodError);
  });
});


describe('ReviewReportSchema', () => {
  const codeQuality = {
    file: 'src/example.ts',
    issues: [],
    overallScore: 90,
    summary: 'Good quality'
  };

  const testCoverage = {
    file: 'src/example.ts',
    hasTests: true,
    testFiles: ['tests/example.test.ts'],
    untestedPaths: [],
    coverageEstimate: 90,
    summary: 'Good coverage'
  };

  const refactorings = {
    file: 'src/example.ts',
    suggestions: [],
    summary: 'No major refactoring required'
  };

  const validReport = {
    pullRequest: {
      owner: 'udacity',
      repo: 'cd14715-simple-todo-app',
      number: 1
    },
    fileReviews: [
      {
        file: 'src/example.ts',
        codeQuality,
        testCoverage,
        refactorings
      }
    ],
    summary: {
      totalFiles: 1,
      overallScore: 90,
      criticalIssues: 0,
      highPriorityTests: 0,
      refactoringOpportunities: 0
    },
    recommendations: [],
    metadata: {
      analyzedAt: '2026-01-16T12:00:00.000Z',
      duration: 1000,
      agentVersions: {
        codeQuality: '1.0',
        testCoverage: '1.0',
        refactoring: '1.0'
      }
    }
  };

  it('accepts a valid complete report', () => {
    expect(() =>
      ReviewReportSchema.parse(validReport)
    ).not.toThrow();
  });

  it('accepts empty file review and recommendation arrays', () => {
    expect(() =>
      ReviewReportSchema.parse({
        ...validReport,
        fileReviews: [],
        recommendations: [],
        summary: {
          ...validReport.summary,
          totalFiles: 0
        }
      })
    ).not.toThrow();
  });

  it('rejects an invalid recommendation priority', () => {
    expect(() =>
      ReviewReportSchema.parse({
        ...validReport,
        recommendations: [
          {
            priority: 'urgent',
            category: 'security',
            description: 'Fix immediately',
            files: ['src/example.ts']
          }
        ]
      })
    ).toThrow(z.ZodError);
  });

  it('rejects missing required report fields', () => {
    expect(() =>
      ReviewReportSchema.parse({
        pullRequest: validReport.pullRequest
      })
    ).toThrow(z.ZodError);
  });
});


describe('JSON Schema exports', () => {
  it('exports CodeQualityResult as JSON Schema', () => {
    expect(CodeQualityResultJSONSchema).toBeDefined();
    expect(CodeQualityResultJSONSchema.type).toBe('object');
    expect(CodeQualityResultJSONSchema.properties).toBeDefined();
  });

  it('marks CodeQualityResult required fields', () => {
    const required =
      CodeQualityResultJSONSchema.required as string[] | undefined;

    expect(required).toEqual(
      expect.arrayContaining([
        'file',
        'issues',
        'overallScore',
        'summary'
      ])
    );
  });

  it('exports TestCoverageResult as JSON Schema', () => {
    expect(TestCoverageResultJSONSchema).toBeDefined();
    expect(TestCoverageResultJSONSchema.type).toBe('object');
    expect(TestCoverageResultJSONSchema.properties).toBeDefined();
  });

  it('exports RefactoringSuggestion as JSON Schema', () => {
    expect(RefactoringSuggestionJSONSchema).toBeDefined();
    expect(RefactoringSuggestionJSONSchema.type).toBe('object');
    expect(RefactoringSuggestionJSONSchema.properties).toBeDefined();
  });

  it('exports ReviewReport as JSON Schema', () => {
    expect(ReviewReportJSONSchema).toBeDefined();
    expect(ReviewReportJSONSchema.type).toBe('object');
    expect(ReviewReportJSONSchema.properties).toBeDefined();
  });

  it('marks ReviewReport required fields', () => {
    const required =
      ReviewReportJSONSchema.required as string[] | undefined;

    expect(required).toEqual(
      expect.arrayContaining([
        'pullRequest',
        'fileReviews',
        'summary',
        'recommendations',
        'metadata'
      ])
    );
  });
});
