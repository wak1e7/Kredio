alter table public."Expense" enable row level security;

drop policy if exists expense_owner_all on public."Expense";

create policy expense_owner_all
on public."Expense"
for all
using (
  exists (
    select 1
    from public."Business" b
    where b.id = "businessId" and b."ownerId" = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public."Business" b
    where b.id = "businessId" and b."ownerId" = auth.uid()
  )
);
