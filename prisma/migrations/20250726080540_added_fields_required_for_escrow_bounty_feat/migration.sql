/*
  Warnings:

  - A unique constraint covering the columns `[escrowPda]` on the table `Bounty` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Bounty" ADD COLUMN     "escrowPda" TEXT,
ADD COLUMN     "transactionHash" TEXT;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "githubPRNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Bounty_escrowPda_key" ON "Bounty"("escrowPda");
