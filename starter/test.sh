grep -n -E "owner.*repo.*prStr|GITHUB_TOKEN|ANTHROPIC_API_KEY|AWS_ACCESS_KEY_ID|ANTHROPIC_MODEL|CodeReviewOrchestrator" src/main.ts
grep -n "if (!owner || !repo || !prStr)" src/main.ts