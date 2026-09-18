-- ==============================================================================
-- RespiGuard AI Copilot Encrypted Chat Messages Table Migration
-- ==============================================================================
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/twpxlmulgjsacelerzvg/sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.copilot_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    message_body TEXT NOT NULL,
    tools_called TEXT DEFAULT '[]',
    mode TEXT DEFAULT 'groq_cloud',
    model TEXT DEFAULT 'llama-3.3-70b-versatile',
    is_encrypted BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for rapid conversation history retrieval by user
CREATE INDEX IF NOT EXISTS idx_copilot_messages_user_id ON public.copilot_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_copilot_messages_created_at ON public.copilot_messages(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;

-- Permissive policy for authenticated and service roles
DROP POLICY IF EXISTS "Allow all operations on copilot_messages" ON public.copilot_messages;
CREATE POLICY "Allow all operations on copilot_messages"
ON public.copilot_messages
FOR ALL
TO public, anon, authenticated
USING (true)
WITH CHECK (true);
