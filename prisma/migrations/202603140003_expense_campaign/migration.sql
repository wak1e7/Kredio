alter table "Expense"
add column "campaignId" uuid;

create index "Expense_campaignId_idx" on "Expense"("campaignId");

alter table "Expense"
add constraint "Expense_campaignId_fkey"
foreign key ("campaignId") references "Campaign"("id")
on delete set null on update cascade;
