CREATE TYPE "PurchaseSource" AS ENUM ('DIRECT', 'WAREHOUSE_TRANSFER');

ALTER TABLE public."Purchase"
ADD COLUMN "source" "PurchaseSource" NOT NULL DEFAULT 'DIRECT';

ALTER TABLE public."PurchaseItem"
ADD COLUMN "warehouseItemId" UUID NULL;

CREATE TABLE public."WarehouseItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "businessId" UUID NOT NULL,
  "campaignId" UUID NOT NULL,
  "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "size" TEXT,
  "color" TEXT,
  "quantity" INTEGER NOT NULL,
  "availableQuantity" INTEGER NOT NULL,
  "costPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "salePrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WarehouseItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WarehouseItem_businessId_entryDate_idx" ON public."WarehouseItem"("businessId", "entryDate");
CREATE INDEX "WarehouseItem_campaignId_idx" ON public."WarehouseItem"("campaignId");
CREATE INDEX "WarehouseItem_businessId_availableQuantity_idx" ON public."WarehouseItem"("businessId", "availableQuantity");
CREATE INDEX "PurchaseItem_warehouseItemId_idx" ON public."PurchaseItem"("warehouseItemId");

ALTER TABLE public."PurchaseItem"
ADD CONSTRAINT "PurchaseItem_warehouseItemId_fkey"
FOREIGN KEY ("warehouseItemId") REFERENCES public."WarehouseItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public."WarehouseItem"
ADD CONSTRAINT "WarehouseItem_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES public."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public."WarehouseItem"
ADD CONSTRAINT "WarehouseItem_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES public."Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;