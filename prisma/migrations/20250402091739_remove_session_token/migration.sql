/*
  Warnings:

  - You are about to drop the column `sessionToken` on the `session` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "session_sessionToken_key";

-- AlterTable
ALTER TABLE "session" DROP COLUMN "sessionToken";
