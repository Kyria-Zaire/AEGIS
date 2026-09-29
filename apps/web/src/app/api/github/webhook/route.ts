import { verifyWebhookSignature } from "@/lib/github-app";
import { processGithubWebhook } from "@/lib/webhook";

export async function POST(request: Request): Promise<Response> {
  const body = await request.text();
  if (!verifyWebhookSignature(body, request.headers.get("x-hub-signature-256"))) {
    // eslint-disable-next-line no-console -- security audit signal; never includes payload or secrets
    console.warn("Rejected GitHub webhook with invalid signature");
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }
  const event = request.headers.get("x-github-event");
  const deliveryId = request.headers.get("x-github-delivery");
  if (!event || !deliveryId) return Response.json({ error: "Missing GitHub headers" }, { status: 400 });

  try {
    const result = await processGithubWebhook(event, deliveryId, JSON.parse(body) as never);
    return Response.json({ ok: true, result });
  } catch (error) {
    // eslint-disable-next-line no-console -- operational error without payload, private key, or token
    console.error("GitHub webhook processing failed", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
