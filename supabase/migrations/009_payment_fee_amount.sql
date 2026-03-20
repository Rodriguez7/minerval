-- fee_amount is nullable: NULL for legacy rows created before Phase 4.
-- When present: amount = school_fee + fee_amount (parent pays amount, school receives amount - fee_amount).
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS fee_amount INT;
