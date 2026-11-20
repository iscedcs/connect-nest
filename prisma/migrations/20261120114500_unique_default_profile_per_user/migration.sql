-- Ensure at most one active (non-deleted) default profile per user
CREATE UNIQUE INDEX IF NOT EXISTS "Profile_userId_default_active_key"
ON "Profile" ("userId")
WHERE "is_default" = true AND "deletedAt" IS NULL;
