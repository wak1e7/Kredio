alter table public."PurchaseItem"
add column "category" text,
add column "costPrice" decimal(12, 2) not null default 0,
add column "salePrice" decimal(12, 2) not null default 0;

update public."PurchaseItem"
set
  "salePrice" = "unitPrice",
  "costPrice" = 0
where "salePrice" = 0;
