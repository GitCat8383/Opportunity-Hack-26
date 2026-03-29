ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reminder_sent_for_scheduled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reminder_error TEXT;
