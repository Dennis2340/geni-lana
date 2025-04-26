ALTER TABLE "email_notifications" ALTER COLUMN "created_at" SET DEFAULT '2025-05-03T03:02:41.378Z';--> statement-breakpoint
ALTER TABLE "liquidity_positions" ALTER COLUMN "created_at" SET DEFAULT '2025-05-03T03:02:41.381Z';--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "sent_at" SET DEFAULT '2025-05-03T03:02:41.380Z';--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "created_at" SET DEFAULT '2025-05-03T03:02:41.380Z';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT '2025-05-03T03:02:41.376Z';--> statement-breakpoint
ALTER TABLE "email_notifications" ADD COLUMN "username" text;