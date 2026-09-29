// Local development seed. Idempotent: safe to re-run. Refuses to run in production.
import { generateApiKey } from "../src/api-key";
import { createPrismaClient } from "../src/client";
import { type Prisma, Severity } from "../src/generated/prisma/client";

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to seed a production database.");
}

const SEED_EMAIL = "dev@aegis.local";
const SEED_COMMIT = "0000000000000000000000000000000000000001";

const prisma = createPrismaClient();

async function main(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { email: SEED_EMAIL },
      update: {},
      create: { email: SEED_EMAIL, name: "Aegis Dev", emailVerified: new Date() },
    });

    // Mirrors sign-up: every user gets a Personal Workspace they own.
    const org = await tx.organization.upsert({
      where: { personalOwnerId: user.id },
      update: {},
      create: {
        name: "Personal Workspace",
        slug: "aegis-dev",
        personalOwnerId: user.id,
        memberships: { create: { userId: user.id, role: "OWNER" } },
      },
    });

    const installation = await tx.githubInstallation.upsert({
      where: { installationId: 1n },
      update: {},
      create: {
        organizationId: org.id,
        installationId: 1n,
        accountId: 1n,
        accountLogin: "aegis-dev",
        accountType: "USER",
      },
    });

    const repo = await tx.repository.upsert({
      where: { organizationId_githubRepoId: { organizationId: org.id, githubRepoId: 1n } },
      update: {},
      create: {
        organizationId: org.id,
        githubInstallationId: installation.id,
        githubRepoId: 1n,
        fullName: "aegis-dev/demo-app",
      },
    });

    const existingScan = await tx.scan.findFirst({
      where: { repositoryId: repo.id, commitSha: SEED_COMMIT },
    });
    if (!existingScan) {
      const scan = await tx.scan.create({
        data: {
          organizationId: org.id,
          repositoryId: repo.id,
          status: "COMPLETED",
          trigger: "MANUAL",
          commitSha: SEED_COMMIT,
          branch: "main",
          triggeredById: user.id,
          startedAt: new Date(Date.now() - 60_000),
          finishedAt: new Date(),
        },
      });
      const tenant = { organizationId: org.id, repositoryId: repo.id, scanId: scan.id };

      const findings: Prisma.FindingCreateManyInput[] = [
        {
          ...tenant,
          ruleId: "secrets/aws-access-key",
          severity: Severity.critical,
          title: "AWS access key committed",
          message: "A string matching an AWS access key ID was found in source code.",
          filePath: "config/aws.ts",
          startLine: 12,
          fingerprint: "seed-fp-aws-key",
        },
        {
          ...tenant,
          ruleId: "injection/sql-string-concat",
          severity: Severity.high,
          title: "SQL query built with string concatenation",
          message: "User input flows into a raw SQL query without parameterization.",
          filePath: "src/users/repository.ts",
          startLine: 48,
          endLine: 51,
          fingerprint: "seed-fp-sqli",
        },
        {
          ...tenant,
          ruleId: "deps/outdated-lockfile",
          severity: Severity.low,
          title: "Lockfile out of date",
          message: "package.json and the lockfile declare different versions.",
          filePath: "package.json",
          startLine: 1,
          fingerprint: "seed-fp-lockfile",
        },
      ];

      await tx.finding.createMany({ data: findings });
    }

    const hasKey = await tx.apiKey.findFirst({ where: { organizationId: org.id, name: "Local dev" } });
    if (!hasKey) {
      // The plaintext is discarded on purpose: create a real key from the UI when you need one.
      const { keyHash, keyPrefix } = generateApiKey();
      await tx.apiKey.create({
        data: { organizationId: org.id, name: "Local dev", keyHash, keyPrefix, createdById: user.id },
      });
    }
  });

  const counts = {
    users: await prisma.user.count(),
    organizations: await prisma.organization.count(),
    repositories: await prisma.repository.count(),
    scans: await prisma.scan.count(),
    findings: await prisma.finding.count(),
    apiKeys: await prisma.apiKey.count(),
  };
  process.stdout.write(`Seed complete: ${JSON.stringify(counts)}\n`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
