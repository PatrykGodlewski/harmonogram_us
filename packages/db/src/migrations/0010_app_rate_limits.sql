CREATE TABLE "app_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"points" integer NOT NULL,
	"blocked_until" timestamp with time zone
);
