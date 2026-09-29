import NextAuth from "next-auth";

import { prisma } from "@aegis/db";

import { createAegisAdapter } from "./auth-adapter";
import { authConfig } from "./auth-config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: createAegisAdapter(),
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile }) {
      if (account?.provider !== "github" || !account.access_token) return false;
      const response = await fetch("https://api.github.com/user/emails", {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${account.access_token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
      if (!response.ok) return false;
      const emails = (await response.json()) as { email: string; primary: boolean; verified: boolean }[];
      return emails.some((item) => item.verified && (item.primary || item.email === profile?.email));
    },
    async session({ session, user }) {
      session.user.id = user.id;
      session.user.organizations = await prisma().membership.findMany({
        where: { userId: user.id, organization: { deletedAt: null } },
        select: { role: true, organization: { select: { id: true, name: true, slug: true } } },
      });
      return session;
    },
  },
});
