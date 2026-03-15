create extension if not exists pgcrypto;

-- 1) Bootstrap automatico de perfil + negocio cuando se crea un usuario en auth.users
create or replace function public.handle_new_supabase_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fallback_email text;
  profile_name text;
  business_name text;
begin
  fallback_email := coalesce(new.email, new.id::text || '@no-email.local');
  profile_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(fallback_email, '@', 1), 'Usuario Kredio');
  business_name := coalesce(new.raw_user_meta_data->>'business_name', profile_name || ' - Negocio');

  insert into public."AppUser" (
    id,
    email,
    "fullName",
    "isActive",
    "createdAt",
    "updatedAt"
  )
  values (
    new.id,
    fallback_email,
    profile_name,
    true,
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    "fullName" = excluded."fullName",
    "updatedAt" = now();

  insert into public."Business" (
    id,
    "ownerId",
    name,
    "createdAt",
    "updatedAt"
  )
  values (
    gen_random_uuid(),
    new.id,
    business_name,
    now(),
    now()
  )
  on conflict ("ownerId") do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_supabase_user();

-- 2) Habilitar RLS
alter table public."AppUser" enable row level security;
alter table public."Business" enable row level security;
alter table public."Customer" enable row level security;
alter table public."Product" enable row level security;
alter table public."Campaign" enable row level security;
alter table public."Purchase" enable row level security;
alter table public."PurchaseItem" enable row level security;
alter table public."CustomerCampaignBalance" enable row level security;
alter table public."Payment" enable row level security;
alter table public."PaymentApplication" enable row level security;

-- 3) Limpiar policies previas (idempotente)
drop policy if exists app_user_select_own on public."AppUser";
drop policy if exists app_user_insert_own on public."AppUser";
drop policy if exists app_user_update_own on public."AppUser";

drop policy if exists business_select_owner on public."Business";
drop policy if exists business_insert_owner on public."Business";
drop policy if exists business_update_owner on public."Business";
drop policy if exists business_delete_owner on public."Business";

drop policy if exists customer_owner_all on public."Customer";
drop policy if exists product_owner_all on public."Product";
drop policy if exists campaign_owner_all on public."Campaign";
drop policy if exists purchase_owner_all on public."Purchase";
drop policy if exists purchase_item_owner_all on public."PurchaseItem";
drop policy if exists customer_campaign_balance_owner_all on public."CustomerCampaignBalance";
drop policy if exists payment_owner_all on public."Payment";
drop policy if exists payment_application_owner_all on public."PaymentApplication";

-- 4) Policies AppUser
create policy app_user_select_own
on public."AppUser"
for select
using (id = auth.uid());

create policy app_user_insert_own
on public."AppUser"
for insert
with check (id = auth.uid());

create policy app_user_update_own
on public."AppUser"
for update
using (id = auth.uid())
with check (id = auth.uid());

-- 5) Policies Business
create policy business_select_owner
on public."Business"
for select
using ("ownerId" = auth.uid());

create policy business_insert_owner
on public."Business"
for insert
with check ("ownerId" = auth.uid());

create policy business_update_owner
on public."Business"
for update
using ("ownerId" = auth.uid())
with check ("ownerId" = auth.uid());

create policy business_delete_owner
on public."Business"
for delete
using ("ownerId" = auth.uid());

-- 6) Policies tablas con businessId
create policy customer_owner_all
on public."Customer"
for all
using (
  exists (
    select 1 from public."Business" b
    where b.id = "businessId" and b."ownerId" = auth.uid()
  )
)
with check (
  exists (
    select 1 from public."Business" b
    where b.id = "businessId" and b."ownerId" = auth.uid()
  )
);

create policy product_owner_all
on public."Product"
for all
using (
  exists (
    select 1 from public."Business" b
    where b.id = "businessId" and b."ownerId" = auth.uid()
  )
)
with check (
  exists (
    select 1 from public."Business" b
    where b.id = "businessId" and b."ownerId" = auth.uid()
  )
);

create policy campaign_owner_all
on public."Campaign"
for all
using (
  exists (
    select 1 from public."Business" b
    where b.id = "businessId" and b."ownerId" = auth.uid()
  )
)
with check (
  exists (
    select 1 from public."Business" b
    where b.id = "businessId" and b."ownerId" = auth.uid()
  )
);

create policy purchase_owner_all
on public."Purchase"
for all
using (
  exists (
    select 1 from public."Business" b
    where b.id = "businessId" and b."ownerId" = auth.uid()
  )
)
with check (
  exists (
    select 1 from public."Business" b
    where b.id = "businessId" and b."ownerId" = auth.uid()
  )
);

create policy payment_owner_all
on public."Payment"
for all
using (
  exists (
    select 1 from public."Business" b
    where b.id = "businessId" and b."ownerId" = auth.uid()
  )
)
with check (
  exists (
    select 1 from public."Business" b
    where b.id = "businessId" and b."ownerId" = auth.uid()
  )
);

-- 7) Policies tablas dependientes sin businessId directo
create policy purchase_item_owner_all
on public."PurchaseItem"
for all
using (
  exists (
    select 1
    from public."Purchase" p
    join public."Business" b on b.id = p."businessId"
    where p.id = "purchaseId" and b."ownerId" = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public."Purchase" p
    join public."Business" b on b.id = p."businessId"
    where p.id = "purchaseId" and b."ownerId" = auth.uid()
  )
);

create policy customer_campaign_balance_owner_all
on public."CustomerCampaignBalance"
for all
using (
  exists (
    select 1
    from public."Campaign" c
    join public."Business" b on b.id = c."businessId"
    where c.id = "campaignId" and b."ownerId" = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public."Campaign" c
    join public."Business" b on b.id = c."businessId"
    where c.id = "campaignId" and b."ownerId" = auth.uid()
  )
);

create policy payment_application_owner_all
on public."PaymentApplication"
for all
using (
  exists (
    select 1
    from public."Campaign" c
    join public."Business" b on b.id = c."businessId"
    where c.id = "campaignId" and b."ownerId" = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public."Campaign" c
    join public."Business" b on b.id = c."businessId"
    where c.id = "campaignId" and b."ownerId" = auth.uid()
  )
);
