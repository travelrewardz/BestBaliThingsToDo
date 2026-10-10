-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "categoryLinks" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "destinationLinks" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoKeywords" TEXT,
ADD COLUMN     "seoTitle" TEXT,
ADD COLUMN     "shortDescription" TEXT;

-- AlterTable
ALTER TABLE "ProductOption" ADD COLUMN     "agentNetBps" INTEGER;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD';

-- CreateTable
CREATE TABLE "OptionTier" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minPax" INTEGER NOT NULL DEFAULT 1,
    "maxPax" INTEGER,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OptionTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OptionTier_optionId_sortOrder_idx" ON "OptionTier"("optionId", "sortOrder");

-- AddForeignKey
ALTER TABLE "OptionTier" ADD CONSTRAINT "OptionTier_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ProductOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
