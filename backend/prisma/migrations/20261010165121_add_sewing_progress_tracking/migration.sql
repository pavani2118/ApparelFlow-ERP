-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'SEWING_COMPLETED';

-- AlterTable
ALTER TABLE "cutting_orders" ADD COLUMN     "completed_qty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sewing_completed_at" TIMESTAMP(3),
ADD COLUMN     "sewing_started_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "sewing_progress_logs" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "supervisor_id" INTEGER NOT NULL,
    "previous_qty" INTEGER NOT NULL,
    "completed_qty" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sewing_progress_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sewing_progress_logs_order_id_timestamp_idx" ON "sewing_progress_logs"("order_id", "timestamp");

-- AddForeignKey
ALTER TABLE "sewing_progress_logs" ADD CONSTRAINT "sewing_progress_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "cutting_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sewing_progress_logs" ADD CONSTRAINT "sewing_progress_logs_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
