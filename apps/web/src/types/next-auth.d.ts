import type { DefaultSession } from "next-auth";
import type { MembershipRole } from "@aegis/db";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      organizations: {
        role: MembershipRole;
        organization: { id: string; name: string; slug: string };
      }[];
    };
  }
}
