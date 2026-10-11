-- Admin live feed (src/lib/adminFeed.js): one index on the time column of every source that had none,
-- so the bell's poll (every 4 s while an admin is connected) reads only the newest rows. Additive only.
CREATE INDEX IF NOT EXISTS "Pet_createdAt_feed_idx" ON "Pet" ("createdAt");
CREATE INDEX IF NOT EXISTS "PetWeightLog_createdAt_feed_idx" ON "PetWeightLog" ("createdAt");
CREATE INDEX IF NOT EXISTS "PetCareSchedule_createdAt_feed_idx" ON "PetCareSchedule" ("createdAt");
CREATE INDEX IF NOT EXISTS "PetCareEvent_createdAt_feed_idx" ON "PetCareEvent" ("createdAt");
CREATE INDEX IF NOT EXISTS "PetChatMessage_createdAt_feed_idx" ON "PetChatMessage" ("createdAt");
CREATE INDEX IF NOT EXISTS "MedicationSchedule_createdAt_feed_idx" ON "MedicationSchedule" ("createdAt");
CREATE INDEX IF NOT EXISTS "MedicationDoseEvent_occurredAt_feed_idx" ON "MedicationDoseEvent" ("occurredAt");
CREATE INDEX IF NOT EXISTS "CycleLog_createdAt_feed_idx" ON "CycleLog" ("createdAt");
CREATE INDEX IF NOT EXISTS "NutritionMeal_createdAt_feed_idx" ON "NutritionMeal" ("createdAt");
CREATE INDEX IF NOT EXISTS "MedicalRecord_createdAt_feed_idx" ON "MedicalRecord" ("createdAt");
CREATE INDEX IF NOT EXISTS "AssistantOperation_createdAt_feed_idx" ON "AssistantOperation" ("createdAt");
CREATE INDEX IF NOT EXISTS "QuestCompletion_completedAt_feed_idx" ON "QuestCompletion" ("completedAt");
CREATE INDEX IF NOT EXISTS "MedipulsiSession_endedAt_feed_idx" ON "MedipulsiSession" ("endedAt");
CREATE INDEX IF NOT EXISTS "CommunityMember_createdAt_feed_idx" ON "CommunityMember" ("createdAt");
CREATE INDEX IF NOT EXISTS "CommunityReport_createdAt_feed_idx" ON "CommunityReport" ("createdAt");
CREATE INDEX IF NOT EXISTS "TrainerLink_createdAt_feed_idx" ON "TrainerLink" ("createdAt");
CREATE INDEX IF NOT EXISTS "SupportThread_createdAt_feed_idx" ON "SupportThread" ("createdAt");
CREATE INDEX IF NOT EXISTS "Referral_createdAt_feed_idx" ON "Referral" ("createdAt");
