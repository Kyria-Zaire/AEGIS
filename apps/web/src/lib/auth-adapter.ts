import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";

import { prisma, type PrismaClient } from "@aegis/db";

/** Auth adapter with Aegis' tenant lifecycle and OAuth-token-at-rest policy. */
export function createAegisAdapter(db?: PrismaClient): Adapter {
  const client =
    db ??
    new Proxy({} as PrismaClient, {
      get: (_target, property) => {
        // eslint-disable-next-line @typescript-eslint/unbound-method -- read only to bind Prisma methods below
        const value = prisma()[property as keyof PrismaClient];
        return typeof value === "function" ? value.bind(prisma()) : value;
      },
    });
  const base = PrismaAdapter(client as unknown as Parameters<typeof PrismaAdapter>[0]);

  return {
    ...base,
    async createUser(user) {
      return client.$transaction(async (tx) => {
        const { id: _adapterId, ...data } = user;
        const created = await tx.user.create({ data });
        await tx.organization.create({
          data: {
            name: "Personal Workspace",
            slug: `personal-${created.id.replaceAll("-", "").slice(0, 8)}`,
            personalOwnerId: created.id,
            memberships: { create: { userId: created.id, role: "OWNER" } },
          },
        });
        return created;
      });
    },
    linkAccount(account) {
      const {
        access_token: _accessToken,
        refresh_token: _refreshToken,
        id_token: _idToken,
        ...safeAccount
      } = account;
      return client.account.create({ data: safeAccount }) as never;
    },
    async deleteUser(userId) {
      await client.$transaction(async (tx) => {
        const workspace = await tx.organization.findUnique({
          where: { personalOwnerId: userId },
          include: {
            memberships: {
              where: { userId: { not: userId } },
              orderBy: { createdAt: "asc" },
            },
          },
        });

        if (workspace) {
          const successor = workspace.memberships.find((membership) => membership.role === "ADMIN");
          if (successor) {
            await tx.membership.update({ where: { id: successor.id }, data: { role: "OWNER" } });
            await tx.organization.update({
              where: { id: workspace.id },
              data: { personalOwnerId: successor.userId },
            });
          } else if (workspace.memberships.length === 0) {
            await tx.organization.update({
              where: { id: workspace.id },
              data: { deletedAt: new Date(), personalOwnerId: null },
            });
          } else {
            // TODO(debt): cleanup job must resolve workspaces that have members but no ADMIN successor.
            await tx.organization.update({ where: { id: workspace.id }, data: { personalOwnerId: null } });
          }
        }
        await tx.user.delete({ where: { id: userId } });
      });
    },
  };
}
