# AGENTS.md

## Product scope

This repository builds a mobile-first personal study assistant for one exam:
系统集成项目管理工程师（中级）.

Do not add multi-exam UI, commerce, communities, enterprise roles, or unrelated
exam content.

## Workflow

1. Read `docs/spec/` and `docs/DECISIONS.md` before changing code.
2. Work only in the currently approved phase.
3. Present a short plan before implementation.
4. Do not start the next phase without user approval.
5. Keep changes small, testable, and reversible.
6. Finish each phase with lint, typecheck, tests, and production build.

## Engineering rules

- TypeScript strict mode; do not use `any` without a narrow justification.
- Validate external input with Zod.
- Keep business rules out of UI components.
- Use Supabase SQL migrations.
- Preserve historical attempts and content versions.
- Keep exam duration, question counts, and scoring in editable configuration.
- Keep all secrets server-side.
- Scope future learning data by `user_id`, even in owner-only mode.
- Use Chinese UI copy.
- Do not present placeholders, invented statistics, or inactive controls as real.

## Current access model

Phase 1 uses a single `owner` profile and a server-validated access key. It does
not use Supabase Auth. The owner has both learner and content-management
capabilities. Retain `user_id` boundaries so formal authentication can be added
later without redesigning learning data.

## Content and quality

- Do not scrape or bulk-copy commercial textbooks or question banks.
- Every future knowledge point and question requires source and copyright data.
- AI content starts as a draft and requires human review.
- Disputed questions must not appear in random practice or mock exams.
- Required checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  relevant `pnpm test:e2e`, and `pnpm build`.
