-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "aiEngine" TEXT NOT NULL DEFAULT 'gemini_flash';
