CREATE TABLE "webhook_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "delivery_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "action" TEXT,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webhook_deliveries_delivery_id_key" ON "webhook_deliveries"("delivery_id");

ALTER TABLE "github_installations" ADD COLUMN "deleted_at" TIMESTAMP(3);
CREATE INDEX "github_installations_deleted_at_idx" ON "github_installations"("deleted_at");
