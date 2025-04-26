CREATE TABLE "email_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_public_key" text,
	"email" text NOT NULL,
	"schedule" text DEFAULT 'daily' NOT NULL,
	"risk_level" integer DEFAULT 50 NOT NULL,
	"notifications_enabled" boolean DEFAULT true,
	"user_wallet" text,
	"topic_preferences" jsonb,
	"created_at" text DEFAULT '2025-05-03T02:09:12.531Z' NOT NULL,
	CONSTRAINT "email_notifications_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "liquidity_positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_public_key" text,
	"position_data" jsonb NOT NULL,
	"risk_level" integer NOT NULL,
	"created_at" text DEFAULT '2025-05-03T02:09:12.534Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_public_key" text,
	"content" text NOT NULL,
	"sent_at" text DEFAULT '2025-05-03T02:09:12.533Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_public_key" text,
	"transaction_data" jsonb NOT NULL,
	"created_at" text DEFAULT '2025-05-03T02:09:12.533Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"public_key" text PRIMARY KEY NOT NULL,
	"username" text,
	"created_at" text DEFAULT '2025-05-03T02:09:12.528Z' NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "email_notifications" ADD CONSTRAINT "email_notifications_user_public_key_users_public_key_fk" FOREIGN KEY ("user_public_key") REFERENCES "public"."users"("public_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidity_positions" ADD CONSTRAINT "liquidity_positions_user_public_key_users_public_key_fk" FOREIGN KEY ("user_public_key") REFERENCES "public"."users"("public_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_public_key_users_public_key_fk" FOREIGN KEY ("user_public_key") REFERENCES "public"."users"("public_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_public_key_users_public_key_fk" FOREIGN KEY ("user_public_key") REFERENCES "public"."users"("public_key") ON DELETE no action ON UPDATE no action;