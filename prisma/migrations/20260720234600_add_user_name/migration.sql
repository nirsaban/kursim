-- Optional display name for User, shown on leaderboard/certificates instead of
-- falling back to the local-part of the email address.
ALTER TABLE "User" ADD COLUMN     "name" TEXT;
