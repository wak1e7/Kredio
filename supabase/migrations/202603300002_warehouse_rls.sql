ALTER TABLE public."WarehouseItem" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS warehouse_item_owner_all ON public."WarehouseItem";

CREATE POLICY warehouse_item_owner_all
ON public."WarehouseItem"
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public."Business" b
    WHERE b.id = "businessId" AND b."ownerId" = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public."Business" b
    WHERE b.id = "businessId" AND b."ownerId" = auth.uid()
  )
);