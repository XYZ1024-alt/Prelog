# Repository Guidelines

## Project Structure & Module Organization

Prelog is a Next.js 16 and React 19 application written in strict TypeScript. App Router pages, API routes, and Server Actions live in `src/app/`; shared UI belongs in `src/components/`; business, validation, and data-access helpers live in `src/lib/`; and type augmentations live in `src/types/`. Keep the Prisma schema, migrations, and seed data in `prisma/`, maintenance utilities in `scripts/`, and integration/E2E support in `tests/`. Unit tests are colocated with library code. `src/generated/prisma/` is generated and must not be edited or committed.

## Build, Test, and Development Commands

Use Node.js 24 (the CI version) and npm.

- `npm ci`: install exactly from `package-lock.json`.
- `npm run dev`: start the local Next.js development server.
- `npm run build`: generate Prisma Client and create a production build.
- `npm run lint`: apply Next.js Core Web Vitals and TypeScript ESLint rules.
- `npm run typecheck`: generate Prisma Client and run `tsc --noEmit`.
- `npm run test:unit`: run fast Vitest unit tests.
- `npm test`: run the unit, integration, and E2E suites.
- `npm run check:ci`: run linting, type checks, unit, integration, and E2E tests.

Install Chromium once with `npx playwright install chromium` before local E2E runs.

## Coding Style & Naming Conventions

Match the existing style: two-space indentation, double quotes, semicolons, and `const` by default. Use kebab-case filenames (`comment-moderation.ts`), PascalCase for React components and types, camelCase for functions and variables, and UPPER_SNAKE_CASE for constants. Prefer the `@/` alias for imports from `src/`. No Prettier configuration is present; ESLint and TypeScript are authoritative.

## Testing Guidelines

Name unit and integration tests `*.test.ts`; place E2E scenarios under `tests/e2e/` as `*.spec.ts`. Integration and E2E tests require PostgreSQL and reset the configured test database. Set `DATABASE_URL_TEST` to a dedicated database whose URL contains `test`, and never equal it to `DATABASE_URL`. No coverage threshold is configured; add focused regression tests for changed behavior.

## Commit & Pull Request Guidelines

History favors concise, type-prefixed subjects such as `feat: add comment filtering` and `fix: handle admin redirects`; use `<type>: <imperative summary>`. Pull requests should explain scope and user impact, link relevant issues, list verification commands, and include screenshots for UI changes. Commit Prisma migrations with schema changes and call out configuration changes explicitly.

## Security & Configuration

Copy `.env.example` to `.env`, keep real credentials out of Git, and document new variables in `.env.example`. Treat `ADMIN_PATH` as routing configuration, not an authorization boundary.
