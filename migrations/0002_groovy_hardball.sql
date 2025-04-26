CREATE TABLE "chats" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_public_key" text,
	"title" text DEFAULT 'New Chat' NOT NULL,
	"created_at" text DEFAULT '2025-05-03T08:16:50.108Z' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_notifications" ALTER COLUMN "created_at" SET DEFAULT '2025-05-03T08:16:50.106Z';--> statement-breakpoint
ALTER TABLE "liquidity_positions" ALTER COLUMN "created_at" SET DEFAULT '2025-05-03T08:16:50.109Z';--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "sent_at" SET DEFAULT '2025-05-03T08:16:50.108Z';--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "created_at" SET DEFAULT '2025-05-03T08:16:50.109Z';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT '2025-05-03T08:16:50.102Z';--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "chat_id" integer;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_user_public_key_users_public_key_fk" FOREIGN KEY ("user_public_key") REFERENCES "public"."users"("public_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE no action ON UPDATE no action;