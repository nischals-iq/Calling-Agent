-- CreateEnum
CREATE TYPE "TelephonyStatus" AS ENUM ('INITIATED', 'RINGING', 'CONNECTED', 'BUSY', 'NO_ANSWER', 'FAILED', 'COMPLETED', 'CANCELLED');

-- CreateTable: ai_call_sessions
CREATE TABLE IF NOT EXISTS "ai_call_sessions" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "callJobId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'MOCK_TELEPHONY',
    "providerCallId" TEXT NOT NULL,
    "status" "TelephonyStatus" NOT NULL DEFAULT 'INITIATED',
    "languageUsed" TEXT DEFAULT 'en',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connectedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "outcome" TEXT,
    "qualificationScore" DOUBLE PRECISION,
    "summary" TEXT,
    "recordingReference" TEXT,
    "recordingDuration" INTEGER,
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_call_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ai_call_messages
CREATE TABLE IF NOT EXISTS "ai_call_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "transcriptText" TEXT NOT NULL,
    "languageCode" TEXT,
    "turnOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_call_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ai_call_sessions_providerCallId_key" ON "ai_call_sessions"("providerCallId");
CREATE INDEX IF NOT EXISTS "ai_call_sessions_clientId_leadId_idx" ON "ai_call_sessions"("clientId", "leadId");
CREATE INDEX IF NOT EXISTS "ai_call_sessions_clientId_status_idx" ON "ai_call_sessions"("clientId", "status");
CREATE INDEX IF NOT EXISTS "ai_call_sessions_callJobId_idx" ON "ai_call_sessions"("callJobId");
CREATE INDEX IF NOT EXISTS "ai_call_sessions_providerCallId_idx" ON "ai_call_sessions"("providerCallId");
CREATE INDEX IF NOT EXISTS "ai_call_messages_sessionId_idx" ON "ai_call_messages"("sessionId");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_call_sessions_clientId_fkey') THEN
        ALTER TABLE "ai_call_sessions" ADD CONSTRAINT "ai_call_sessions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_call_sessions_leadId_fkey') THEN
        ALTER TABLE "ai_call_sessions" ADD CONSTRAINT "ai_call_sessions_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_call_sessions_callJobId_fkey') THEN
        ALTER TABLE "ai_call_sessions" ADD CONSTRAINT "ai_call_sessions_callJobId_fkey" FOREIGN KEY ("callJobId") REFERENCES "ai_call_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_call_messages_sessionId_fkey') THEN
        ALTER TABLE "ai_call_messages" ADD CONSTRAINT "ai_call_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ai_call_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
