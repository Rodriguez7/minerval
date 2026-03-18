ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS payment_access_token TEXT DEFAULT encode(gen_random_bytes(20), 'hex');

UPDATE public.schools
SET payment_access_token = encode(gen_random_bytes(20), 'hex')
WHERE payment_access_token IS NULL;

ALTER TABLE public.schools
  ALTER COLUMN payment_access_token SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'schools_payment_access_token_key'
  ) THEN
    ALTER TABLE public.schools
      ADD CONSTRAINT schools_payment_access_token_key UNIQUE (payment_access_token);
  END IF;
END$$;
