-- Track Stripe discounts/coupons applied to subscriptions.
-- One row per discount-on-subscription instance. When a discount is removed
-- from a subscription, we set removed_at instead of deleting so we keep history.
create table if not exists subscription_discounts (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  stripe_discount_id text not null,
  stripe_coupon_id text not null,
  promotion_code text,
  coupon_name text,
  percent_off numeric,
  amount_off integer,
  currency text,
  duration text,
  duration_in_months integer,
  start_at timestamptz,
  end_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (subscription_id, stripe_discount_id)
);

create index if not exists subscription_discounts_subscription_id_idx
  on subscription_discounts(subscription_id);

create index if not exists subscription_discounts_active_idx
  on subscription_discounts(subscription_id) where removed_at is null;

alter table subscription_discounts enable row level security;

-- Service role (the webhook) is the only writer. Admins read via the
-- subscriptions admin page using service role for that page; keep a basic
-- policy so authenticated users can read their own discounts if needed later.
create policy "service role manages subscription_discounts"
  on subscription_discounts
  for all
  to service_role
  using (true)
  with check (true);

create policy "users can read their own subscription discounts"
  on subscription_discounts
  for select
  to authenticated
  using (
    exists (
      select 1 from subscriptions s
      where s.id = subscription_discounts.subscription_id
        and s.user_id = auth.uid()
    )
  );
