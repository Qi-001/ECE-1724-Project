-- AlterTable
ALTER TABLE "account" ALTER COLUMN "type" SET DEFAULT 'user',
ALTER COLUMN "provider" DROP NOT NULL,
ALTER COLUMN "provider" SET DEFAULT 'email',
ALTER COLUMN "providerAccountId" DROP NOT NULL;
