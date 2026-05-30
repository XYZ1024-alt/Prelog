# Prelog

Prelog is a blog system built with Next.js, TypeScript, PostgreSQL, Prisma, and Pretext. It includes a public-facing blog, an admin backend, a comment system, full-text-like blog search, dark/light theme switching, and Pretext-based reading and editing enhancements.

## Stack

- Next.js 16
- TypeScript
- PostgreSQL
- Prisma 7
- NextAuth
- Framer Motion
- Pretext

## Features

- Public blog home, post detail, categories, tags, search, and about page
- Admin login, post management, category management, and comment moderation
- Markdown authoring with live preview and editorial analysis
- Theme switching with the project palette `#F1F5E6` and `#2A313F`
- Pinyin slug generation for Chinese titles
- Comment review workflow with reply support and anti-spam scoring
- Search across title, slug, excerpt, content, category, and tags with relevance sorting
- Pretext-driven title fitting, ASCII treatment, dynamic article layout, and editorial feedback

## Getting Started

### 1. Install dependencies

```sh
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in at least:

```env
DATABASE_URL=
AUTH_SECRET=
NEXTAUTH_URL=http://127.0.0.1:3000
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

### 3. Generate Prisma client

```sh
npm run prisma:generate
```

### 4. Run migrations

```sh
npm run prisma:migrate
```

### 5. Seed initial data

```sh
npm run prisma:seed
```

### 6. Start the development server

```sh
npm run dev
```

Open `http://127.0.0.1:3000`.

## Scripts

```sh
npm run dev
npm run build
npm run lint
npm run typecheck
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run prisma:studio
```

## Project Structure

```text
src/
  app/            Next.js app router pages and server actions
  components/     Shared UI and Pretext-driven presentation components
  lib/            Prisma access, validation, search, editorial logic, helpers
prisma/
  migrations/     Database migrations
  seed.ts         Seed script
scripts/          Local project scripts
```

## Notes

- Prisma client is generated into `src/generated/prisma/` and should not be committed.
- The project follows a debug-first approach: failures should surface clearly rather than being silently swallowed.
- Search ranking is implemented in application code on top of Prisma queries, not via PostgreSQL full-text indexes yet.

## License

MIT. See [LICENSE](./LICENSE).
