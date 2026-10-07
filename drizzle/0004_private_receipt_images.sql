CREATE TABLE "receipt_images" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"state" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "receipt_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "receipt_images" ADD CONSTRAINT "receipt_images_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "receipt_images_cleanup_idx" ON "receipt_images" USING btree ("state","created_at");
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.receipt_images FROM anon, authenticated;
