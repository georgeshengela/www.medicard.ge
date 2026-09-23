-- Additive community storage. Apply explicitly; never db push against production.
CREATE TABLE IF NOT EXISTS "CommunityMember" (
 "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
 "alias" TEXT NOT NULL, "rulesVersion" TEXT NOT NULL DEFAULT '2026-09-23',
 "banned" BOOLEAN NOT NULL DEFAULT FALSE, "pushEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS "CommunityPost" (
 "id" TEXT PRIMARY KEY, "authorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "body" TEXT NOT NULL CHECK(length("body") BETWEEN 1 AND 3000),
 "topic" TEXT NOT NULL CHECK("topic" IN ('everyday','cycle','pregnancy','wellbeing')),
 "anonymous" BOOLEAN NOT NULL DEFAULT TRUE,
 "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK("status" IN ('PENDING','PUBLISHED','HIDDEN')),
 "image" BYTEA, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
 "requestId" TEXT NOT NULL, UNIQUE("authorId","requestId")
);
CREATE INDEX IF NOT EXISTS "CommunityPost_feed" ON "CommunityPost"("status","createdAt" DESC,"id");
CREATE TABLE IF NOT EXISTS "CommunityComment" (
 "id" TEXT PRIMARY KEY, "postId" TEXT NOT NULL REFERENCES "CommunityPost"("id") ON DELETE CASCADE,
 "authorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "body" TEXT NOT NULL CHECK(length("body") BETWEEN 1 AND 1500), "anonymous" BOOLEAN NOT NULL DEFAULT TRUE,
 "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK("status" IN ('PENDING','PUBLISHED','HIDDEN')),
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(), "requestId" TEXT NOT NULL, UNIQUE("authorId","requestId")
);
CREATE INDEX IF NOT EXISTS "CommunityComment_post" ON "CommunityComment"("postId","createdAt");
CREATE TABLE IF NOT EXISTS "CommunityReaction" (
 "postId" TEXT NOT NULL REFERENCES "CommunityPost"("id") ON DELETE CASCADE,
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "value" SMALLINT NOT NULL CHECK("value" IN (-1,1)), PRIMARY KEY("postId","userId")
);
CREATE TABLE IF NOT EXISTS "CommunityBlock" (
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "blockedId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "id" TEXT NOT NULL UNIQUE, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(), PRIMARY KEY("userId","blockedId"), CHECK("userId"<>"blockedId")
);
CREATE TABLE IF NOT EXISTS "CommunityReport" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "postId" TEXT REFERENCES "CommunityPost"("id") ON DELETE CASCADE,
 "commentId" TEXT REFERENCES "CommunityComment"("id") ON DELETE CASCADE,
 "reason" TEXT NOT NULL, "resolved" BOOLEAN NOT NULL DEFAULT FALSE, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
 CHECK(("postId" IS NULL) <> ("commentId" IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS "CommunityReport_post_unique" ON "CommunityReport"("userId","postId") WHERE "postId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "CommunityReport_comment_unique" ON "CommunityReport"("userId","commentId") WHERE "commentId" IS NOT NULL;
CREATE TABLE IF NOT EXISTS "CommunityNotification" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "actorId" TEXT REFERENCES "User"("id") ON DELETE CASCADE,
 "postId" TEXT NOT NULL REFERENCES "CommunityPost"("id") ON DELETE CASCADE,
 "kind" TEXT NOT NULL CHECK("kind" IN ('like','dislike','comment','approved')),
 "eventKey" TEXT NOT NULL UNIQUE, "readAt" TIMESTAMPTZ(3), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
 "pushState" TEXT NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
 "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "CommunityNotification_inbox" ON "CommunityNotification"("userId","createdAt" DESC);
CREATE TABLE IF NOT EXISTS "CommunityAudit" (
 "id" TEXT PRIMARY KEY, "adminId" TEXT NOT NULL, "action" TEXT NOT NULL,
 "targetId" TEXT NOT NULL, "reason" TEXT NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);

ALTER TABLE "CommunityNotification" ADD COLUMN IF NOT EXISTS "commentId" TEXT REFERENCES "CommunityComment"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "CommunityNotification_outbox" ON "CommunityNotification"("pushState","nextAttemptAt");
CREATE INDEX IF NOT EXISTS "CommunityNotification_comment" ON "CommunityNotification"("commentId");
CREATE INDEX IF NOT EXISTS "CommunityBlock_target" ON "CommunityBlock"("blockedId");

ALTER TABLE "CommunityPost" ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CommunityComment" ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "CommunityComment" ADD COLUMN IF NOT EXISTS "parentId" TEXT REFERENCES "CommunityComment"("id") ON DELETE SET NULL;
ALTER TABLE "CommunityReaction" ADD COLUMN IF NOT EXISTS emoji TEXT CHECK(emoji IN ('like','love','care','haha','wow','sad','angry','dislike'));
ALTER TABLE "CommunityNotification" ADD COLUMN IF NOT EXISTS "eventType" TEXT;
CREATE INDEX IF NOT EXISTS "CommunityComment_parent" ON "CommunityComment"("parentId");
CREATE TABLE IF NOT EXISTS "CommunityCommentLike" (
 "commentId" TEXT NOT NULL REFERENCES "CommunityComment"("id") ON DELETE CASCADE,
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 PRIMARY KEY("commentId","userId")
);
