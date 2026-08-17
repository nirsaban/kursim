-- Cal.com integration for leads: bookings arrive by webhook and are matched
-- to the lead; the uid makes retried deliveries idempotent.
ALTER TABLE "Lead" ADD COLUMN "calcomUid" TEXT;
CREATE INDEX "Lead_calcomUid_idx" ON "Lead"("calcomUid");
