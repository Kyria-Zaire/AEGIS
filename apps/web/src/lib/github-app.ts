import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";

import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";

export async function getInstallationOctokit(installationId: bigint | number): Promise<Octokit> {
  const privateKeyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
  const appId = process.env.GITHUB_APP_ID;
  if (!privateKeyPath || !appId) throw new Error("GitHub App credentials are not configured");
  const privateKey = await readFile(privateKeyPath, "utf8");
  return new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey, installationId: Number(installationId) },
  });
}

export function verifyWebhookSignature(payload: string | Buffer, signature: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const suppliedHex = signature.slice(7);
  if (!/^[a-f0-9]{64}$/i.test(suppliedHex)) return false;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const supplied = Buffer.from(suppliedHex, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
