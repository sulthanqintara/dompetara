CREATE TABLE "user_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"locale" text,
	"language_prompt_shown_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON public.user_preferences FROM anon, authenticated;
