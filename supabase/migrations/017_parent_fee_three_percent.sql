-- Charge parents a 3% transaction fee by default.
-- Existing policies still using the previous 2.75% default are migrated;
-- negotiated/custom rates are preserved.
ALTER TABLE school_pricing_policies
  ALTER COLUMN parent_fee_bps SET DEFAULT 300;

UPDATE school_pricing_policies
SET parent_fee_bps = 300
WHERE parent_fee_bps = 275;
