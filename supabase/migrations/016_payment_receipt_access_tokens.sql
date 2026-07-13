ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS receipt_access_token TEXT DEFAULT encode(gen_random_bytes(18), 'hex');

UPDATE public.payment_requests
SET receipt_access_token = encode(gen_random_bytes(18), 'hex')
WHERE receipt_access_token IS NULL;

ALTER TABLE public.payment_requests
  ALTER COLUMN receipt_access_token SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_requests_receipt_access_token_key'
  ) THEN
    ALTER TABLE public.payment_requests
      ADD CONSTRAINT payment_requests_receipt_access_token_key UNIQUE (receipt_access_token);
  END IF;
END$$;
