const fs = require('fs');

let failed = false;

for (const pr of [1, 2, 3]) {
  const file = `reports/pr-${pr}-review.json`;

  console.log(`\n========== PR #${pr} ==========`);

  if (!fs.existsSync(file)) {
    console.log('FAIL: JSON report missing');
    failed = true;
    continue;
  }

  const r = JSON.parse(fs.readFileSync(file, 'utf8'));

  const reviews = r.fileReviews ?? [];

  const issues = reviews.flatMap(
    x => x.codeQuality?.issues ?? []
  );

  const testGaps = reviews.flatMap(
    x => x.testCoverage?.untestedPaths ?? []
  );

  const refactorings = reviews.flatMap(
    x => x.refactorings?.suggestions ?? []
  );

  const checks = {
    'files populated':
      reviews.length > 0,

    'summary totalFiles > 0':
      r.summary?.totalFiles > 0,

    'file paths populated':
      reviews.every(x => Boolean(x.file)),

    'issue line numbers valid':
      issues.every(
        x => Number.isFinite(x.line) && x.line > 0
      ),

    'issue severities populated':
      issues.every(x => Boolean(x.severity)),

    'test suggestions populated':
      testGaps.every(
        x =>
          Boolean(x.location) &&
          Boolean(x.reasoning) &&
          Boolean(x.suggestedTest)
      ),

    'refactoring examples populated':
      refactorings.every(
        x =>
          Boolean(x.location) &&
          Boolean(x.description) &&
          Boolean(x.before) &&
          Boolean(x.after) &&
          Boolean(x.benefits)
      ),

    'overall score valid':
      Number.isFinite(r.summary?.overallScore) &&
      r.summary.overallScore >= 0 &&
      r.summary.overallScore <= 100,

    'recommendations populated':
      (r.recommendations?.length ?? 0) > 0
  };

  for (const [name, ok] of Object.entries(checks)) {
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);

    if (!ok) {
      failed = true;
    }
  }

  console.log(`Files: ${reviews.length}`);
  console.log(`Issues: ${issues.length}`);
  console.log(`Test gaps: ${testGaps.length}`);
  console.log(`Refactorings: ${refactorings.length}`);
  console.log(`Recommendations: ${r.recommendations?.length ?? 0}`);
  console.log(`Score: ${r.summary?.overallScore}`);
}

process.exitCode = failed ? 1 : 0;
