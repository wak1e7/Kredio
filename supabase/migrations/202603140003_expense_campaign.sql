alter table public."Expense"
add column "campaignId" uuid;

create index "Expense_campaignId_idx" on public."Expense"("campaignId");

alter table public."Expense"
add constraint "Expense_campaignId_fkey"
foreign key ("campaignId") references public."Campaign"("id")
on delete set null on update cascade;
