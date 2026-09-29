import { prisma, type PrismaClient } from "@aegis/db";

import { getInstallationOctokit } from "./github-app";

interface RepositoryPayload {
  id: number;
  full_name: string;
  default_branch?: string | null;
  private: boolean;
}

interface InstallationPayload {
  id: number;
  account: { id: number; login: string; type: string };
}

interface WebhookPayload {
  action?: string;
  sender?: { id: number };
  installation?: InstallationPayload;
  repositories?: RepositoryPayload[];
  repositories_added?: RepositoryPayload[];
  repositories_removed?: RepositoryPayload[];
  repository?: RepositoryPayload;
  ref?: string;
  after?: string;
  pull_request?: { head: { ref: string; sha: string } };
}

async function resolveOrganizationId(db: PrismaClient, senderId: number): Promise<string> {
  const account = await db.account.findUnique({
    where: { provider_providerAccountId: { provider: "github", providerAccountId: String(senderId) } },
    select: {
      user: {
        select: {
          memberships: {
            where: { organization: { deletedAt: null } },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { organizationId: true },
          },
        },
      },
    },
  });
  const organizationId = account?.user.memberships[0]?.organizationId;
  if (!organizationId) throw new Error("No Aegis organization found for GitHub installation sender");
  return organizationId;
}

function repositoryData(repository: RepositoryPayload, organizationId: string, installationId: string) {
  return {
    organizationId,
    githubInstallationId: installationId,
    githubRepoId: BigInt(repository.id),
    fullName: repository.full_name,
    defaultBranch: repository.default_branch ?? "main",
    isPrivate: repository.private,
    deletedAt: null,
  };
}

export async function processGithubWebhook(
  event: string,
  deliveryId: string,
  payload: WebhookPayload,
  db: PrismaClient = prisma(),
): Promise<"processed" | "duplicate" | "ignored"> {
  let fetchedRepositories = payload.repositories ?? [];
  if (event === "installation" && payload.action === "created" && payload.installation) {
    const octokit = await getInstallationOctokit(payload.installation.id);
    const response = await octokit.paginate(octokit.rest.apps.listReposAccessibleToInstallation, {
      per_page: 100,
    });
    fetchedRepositories = response.map((repository) => ({
      id: repository.id,
      full_name: repository.full_name,
      default_branch: repository.default_branch,
      private: repository.private,
    }));
  }

  try {
    return await db.$transaction(async (tx) => {
      await tx.webhookDelivery.create({
        data: { deliveryId, event, action: payload.action },
      });

      if (event === "installation" && payload.installation && payload.sender) {
        if (payload.action === "created") {
          const organizationId = await resolveOrganizationId(tx as PrismaClient, payload.sender.id);
          const installation = await tx.githubInstallation.upsert({
            where: { installationId: BigInt(payload.installation.id) },
            create: {
              organizationId,
              installationId: BigInt(payload.installation.id),
              accountId: BigInt(payload.installation.account.id),
              accountLogin: payload.installation.account.login,
              accountType: payload.installation.account.type === "Organization" ? "ORGANIZATION" : "USER",
            },
            update: { organizationId, deletedAt: null, suspendedAt: null },
          });
          for (const repository of fetchedRepositories) {
            const data = repositoryData(repository, organizationId, installation.id);
            await tx.repository.upsert({
              where: { organizationId_githubRepoId: { organizationId, githubRepoId: data.githubRepoId } },
              create: data,
              update: data,
            });
          }
          return "processed";
        }
        if (payload.action === "deleted") {
          const installation = await tx.githubInstallation.findUnique({
            where: { installationId: BigInt(payload.installation.id) },
          });
          if (installation) {
            const deletedAt = new Date();
            await tx.githubInstallation.update({ where: { id: installation.id }, data: { deletedAt } });
            await tx.repository.updateMany({
              where: { githubInstallationId: installation.id },
              data: { deletedAt, githubInstallationId: null },
            });
          }
          return "processed";
        }
      }

      if (event === "installation_repositories" && payload.installation) {
        const installation = await tx.githubInstallation.findUnique({
          where: { installationId: BigInt(payload.installation.id) },
        });
        if (!installation) return "ignored";
        if (payload.action === "added") {
          for (const repository of payload.repositories_added ?? []) {
            const data = repositoryData(repository, installation.organizationId, installation.id);
            await tx.repository.upsert({
              where: {
                organizationId_githubRepoId: {
                  organizationId: installation.organizationId,
                  githubRepoId: data.githubRepoId,
                },
              },
              create: data,
              update: data,
            });
          }
        } else if (payload.action === "removed") {
          await tx.repository.updateMany({
            where: {
              organizationId: installation.organizationId,
              githubRepoId: { in: (payload.repositories_removed ?? []).map((repo) => BigInt(repo.id)) },
            },
            data: { deletedAt: new Date(), githubInstallationId: null },
          });
        }
        return "processed";
      }

      if ((event === "push" || event === "pull_request") && payload.repository) {
        const repository = await tx.repository.findFirst({
          where: { githubRepoId: BigInt(payload.repository.id), deletedAt: null },
        });
        const commitSha = event === "push" ? payload.after : payload.pull_request?.head.sha;
        if (repository && commitSha) {
          // Sprint 1 queue stub: the durable QUEUED row is the hand-off contract for the Go worker in Sprint 2.
          await tx.scan.create({
            data: {
              organizationId: repository.organizationId,
              repositoryId: repository.id,
              trigger: event === "push" ? "PUSH" : "PULL_REQUEST",
              commitSha,
              branch: event === "push" ? payload.ref?.replace("refs/heads/", "") : payload.pull_request?.head.ref,
            },
          });
        }
        return "processed";
      }
      return "ignored";
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return "duplicate";
    }
    throw error;
  }
}
