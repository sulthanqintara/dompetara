CREATE TABLE "ledger" (
	"user_id" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger" ENABLE ROW LEVEL SECURITY;
