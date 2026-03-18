ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT,
  ADD COLUMN IF NOT EXISTS reconciliation_note TEXT,
  ADD COLUMN IF NOT EXISTS reconciliation_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reconciliation_updated_by TEXT;

UPDATE public.payment_requests
SET
  reconciliation_status = CASE
    WHEN status IN ('success', 'failed') THEN 'reconciled'
    ELSE 'pending_review'
  END,
  reconciliation_updated_at = COALESCE(reconciliation_updated_at, updated_at, created_at),
  reconciliation_updated_by = COALESCE(reconciliation_updated_by, 'system')
WHERE reconciliation_status IS NULL;

ALTER TABLE public.payment_requests
  ALTER COLUMN reconciliation_status SET DEFAULT 'pending_review';

ALTER TABLE public.payment_requests
  ALTER COLUMN reconciliation_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_requests_reconciliation_status_check'
  ) THEN
    ALTER TABLE public.payment_requests
      ADD CONSTRAINT payment_requests_reconciliation_status_check
      CHECK (
        reconciliation_status = ANY (
          ARRAY['pending_review'::text, 'reconciled'::text, 'needs_review'::text, 'manual_override'::text]
        )
      );
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_payment_requests_reconciliation_status
  ON public.payment_requests (school_id, reconciliation_status, created_at DESC);
