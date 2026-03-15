create table "Expense" (
  "id" uuid not null default gen_random_uuid(),
  "businessId" uuid not null,
  "expenseDate" timestamp(3) not null default current_timestamp,
  "concept" text not null,
  "amount" decimal(12, 2) not null,
  "notes" text,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null default current_timestamp,
  constraint "Expense_pkey" primary key ("id")
);

create index "Expense_businessId_expenseDate_idx" on "Expense"("businessId", "expenseDate");

alter table "Expense"
add constraint "Expense_businessId_fkey"
foreign key ("businessId") references "Business"("id")
on delete cascade on update cascade;
