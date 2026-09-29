# Aegis

AI security scanner for dev teams — Turborepo monorepo (Next.js 15 · Go worker · Prisma · Claude).

```bash
pnpm install && cp .env.example .env         # Node >= 22.12, pnpm 10, Go 1.25+ (auto-fetched), Docker
pnpm infra:up                                # Postgres 16 + Redis 7 (infra/docker)
pnpm dev                                     # web → http://localhost:3000 · worker → http://localhost:8090/readyz
pnpm lint && pnpm typecheck && pnpm test     # Go: cd apps/worker && go test ./...
```
