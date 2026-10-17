-- CreateTable
CREATE TABLE "OptionBookingQuestion" (
    "id" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "remark" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OptionBookingQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionBookingAnswer" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "questionId" TEXT,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "value" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OptionBookingAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OptionBookingQuestion_optionId_sortOrder_idx" ON "OptionBookingQuestion"("optionId", "sortOrder");

-- CreateIndex
CREATE INDEX "OptionBookingAnswer_bookingId_sortOrder_idx" ON "OptionBookingAnswer"("bookingId", "sortOrder");

-- AddForeignKey
ALTER TABLE "OptionBookingQuestion" ADD CONSTRAINT "OptionBookingQuestion_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ProductOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionBookingAnswer" ADD CONSTRAINT "OptionBookingAnswer_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionBookingAnswer" ADD CONSTRAINT "OptionBookingAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "OptionBookingQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
