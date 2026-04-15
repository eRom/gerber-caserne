# Pre-Merge Checklist

Before merging any PR, verify the following:

- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` succeeds
- [ ] No new TypeScript `any` types introduced
- [ ] Response shapes match the Zod envelopes in `packages/mcp/src/tools/contracts.ts`
- [ ] If you touched `embeddings/chunking.ts` or `embeddings/tokenizer.ts`:
  - [ ] Run `pnpm --filter @agent-brain/mcp test:e5` locally (downloads the real E5 model)

## Quick Verification

```bash
pnpm test && pnpm typecheck && pnpm build
```
