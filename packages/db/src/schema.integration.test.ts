import { randomUUID } from "node:crypto";

import { SEVERITIES } from "@aegis/core";
import { afterAll, describe, expect, it } from "vitest";

import { generateApiKey } from "./api-key";
import { createPrismaClient } from "./client";
import { Severity } from "./generated/prisma/client";

const prisma = createPrismaClient();
const createdUserIds: string[] = [];
const createdOrgIds: string[] = [];

let githubRepoSeq = BigInt(Date.now()) * 1000n;

async function createTenant() {
  const tag = randomUUID();
  const user = await prisma.user.create({ data: { email: `${tag}@test.local` } });
  const org = await prisma.organization.create({
    data: {
      name: "Personal Workspace",
      slug: `test-${tag}`,
      personalOwnerId: user.id,
      memberships: { create: { userId: user.id, role: "OWNER" } },
    },
  });
  createdUserIds.push(user.id);
  createdOrgIds.push(org.id);

  const repo = await prisma.repository.create({
    data: { organizationId: org.id, githubRepoId: ++githubRepoSeq, fullName: `test/${tag}` },
  });
  const scan = await prisma.scan.create({
    data: {
      organizationId: org.id,
      repositoryId: repo.id,
      trigger: "MANUAL",
      commitSha: "a".repeat(40),
      triggeredById: user.id,
    },
  });
  return { user, org, repo, scan };
}

function findingData(
  t: { org: { id: string }; repo: { id: string }; scan: { id: string } },
  fingerprint: string,
) {
  return {
    organizationId: t.org.id,
    repositoryId: t.repo.id,
    scanId: t.scan.id,
    ruleId: "test/rule",
    severity: Severity.high,
    title: "t",
    message: "m",
    filePath: "a.ts",
    startLine: 1,
    fingerprint,
  };
}

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("schema", () => {
  it("keeps the Severity enum in sync with @aegis/core", () => {
    expect(Object.values(Severity)).toEqual([...SEVERITIES]);
  });
});

describe("multi-tenant isolation (composite foreign keys)", () => {
  it("rejects a scan pointing at another tenant's repository", async () => {
    const a = await createTenant();
    const b = await createTenant();

    await expect(
      prisma.scan.create({
        data: {
          organizationId: b.org.id,
          repositoryId: a.repo.id,
          trigger: "API",
          commitSha: "b".repeat(40),
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("rejects a finding whose scan belongs to another repository", async () => {
    const t = await createTenant();
    const otherRepo = await prisma.repository.create({
      data: { organizationId: t.org.id, githubRepoId: ++githubRepoSeq, fullName: "test/other" },
    });

    await expect(
      prisma.finding.create({ data: { ...findingData(t, "fp"), repositoryId: otherRepo.id } }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("rejects a finding whose scan belongs to another tenant", async () => {
    const a = await createTenant();
    const b = await createTenant();

    await expect(
      prisma.finding.create({ data: { ...findingData(b, "fp"), scanId: a.scan.id } }),
    ).rejects.toMatchObject({ code: "P2003" });
  });
});

describe("uniqueness", () => {
  it("deduplicates findings by fingerprint within a scan", async () => {
    const t = await createTenant();
    await prisma.finding.create({ data: findingData(t, "dup") });

    await expect(prisma.finding.create({ data: findingData(t, "dup") })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  it("enforces a unique API key hash", async () => {
    const t = await createTenant();
    const { keyHash, keyPrefix } = generateApiKey();
    await prisma.apiKey.create({ data: { organizationId: t.org.id, name: "k1", keyHash, keyPrefix } });

    await expect(
      prisma.apiKey.create({ data: { organizationId: t.org.id, name: "k2", keyHash, keyPrefix } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("allows only one personal workspace per user", async () => {
    const t = await createTenant();

    await expect(
      prisma.organization.create({
        data: { name: "Personal Workspace", slug: `dup-${randomUUID()}`, personalOwnerId: t.user.id },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});

describe("delete behaviour", () => {
  it("purging an organization cascades to all tenant data", async () => {
    const t = await createTenant();
    await prisma.finding.create({ data: findingData(t, "fp") });
    const { keyHash, keyPrefix } = generateApiKey();
    await prisma.apiKey.create({ data: { organizationId: t.org.id, name: "k", keyHash, keyPrefix } });

    await prisma.organization.delete({ where: { id: t.org.id } });

    const where = { organizationId: t.org.id };
    expect(await prisma.membership.count({ where })).toBe(0);
    expect(await prisma.repository.count({ where })).toBe(0);
    expect(await prisma.scan.count({ where })).toBe(0);
    expect(await prisma.finding.count({ where })).toBe(0);
    expect(await prisma.apiKey.count({ where })).toBe(0);
    expect(await prisma.user.count({ where: { id: t.user.id } })).toBe(1);
  });

  it("deleting a user keeps organization data and nulls authorship", async () => {
    const t = await createTenant();
    const { keyHash, keyPrefix } = generateApiKey();
    const key = await prisma.apiKey.create({
      data: { organizationId: t.org.id, name: "k", keyHash, keyPrefix, createdById: t.user.id },
    });

    await prisma.user.delete({ where: { id: t.user.id } });

    expect(await prisma.scan.findUniqueOrThrow({ where: { id: t.scan.id } })).toMatchObject({
      triggeredById: null,
    });
    expect(await prisma.apiKey.findUniqueOrThrow({ where: { id: key.id } })).toMatchObject({
      createdById: null,
    });
    expect(await prisma.organization.findUniqueOrThrow({ where: { id: t.org.id } })).toMatchObject({
      personalOwnerId: null,
    });
    expect(await prisma.membership.count({ where: { userId: t.user.id } })).toBe(0);
  });

  it("uninstalling the GitHub App keeps repositories", async () => {
    const t = await createTenant();
    const installation = await prisma.githubInstallation.create({
      data: {
        organizationId: t.org.id,
        installationId: ++githubRepoSeq,
        accountId: 1n,
        accountLogin: "x",
        accountType: "USER",
      },
    });
    await prisma.repository.update({
      where: { id: t.repo.id },
      data: { githubInstallationId: installation.id },
    });

    await prisma.githubInstallation.delete({ where: { id: installation.id } });

    expect(await prisma.repository.findUniqueOrThrow({ where: { id: t.repo.id } })).toMatchObject({
      githubInstallationId: null,
    });
  });
});
