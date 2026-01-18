-- Add email column to users table
ALTER TABLE "public"."users" 
ADD COLUMN IF NOT EXISTS "email" TEXT;

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "public"."users"("email");
