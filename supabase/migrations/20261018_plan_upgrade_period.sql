-- Plan changes on approval:
--  * renewing the same, still-active plan stacks onto the paid days;
--  * a new plan (upgrade, or buying after the plan lapsed) starts a fresh period today,
--    so the leftover days of a cheaper plan are not turned into days of a dearer one.
-- Credits always carry over. Downgrades are blocked in /api/payments while a plan is active.
create or replace function public.approve_payment_admin(p_submission_id text, p_admin_note text default 'Approved by admin'::text)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_sub record;
  v_period interval;
begin
  if not public.is_service_or_admin() then
    raise exception 'Only admins can approve payments';
  end if;

  select * into v_sub from public.payments where id = p_submission_id;
  if not found then
    return false;
  end if;
  -- Never credit the same payment twice.
  if v_sub.status = 'APPROVED' then
    return false;
  end if;

  v_period := case when v_sub.billing_cycle = 'quarterly' then interval '90 days' else interval '30 days' end;

  update public.payments
  set status = 'APPROVED', reviewed_at = now(), admin_note = p_admin_note
  where id = p_submission_id;

  if v_sub.user_id is not null then
    -- SET expressions read the row as it was before this update.
    update public.profiles
    set credits_remaining = coalesce(credits_remaining, 0) + coalesce(v_sub.credits_to_grant, 0),
        total_spent_bdt = coalesce(total_spent_bdt, 0) + coalesce(v_sub.discounted_price_bdt, 0),
        tier = case
          when v_sub.item_type = 'subscription' and v_sub.plan_id is not null then v_sub.plan_id
          else tier
        end,
        subscription_expires_at = case
          when v_sub.item_type <> 'subscription' then subscription_expires_at
          when v_sub.plan_id = tier and subscription_expires_at > now() then subscription_expires_at + v_period
          else now() + v_period
        end,
        updated_at = now()
    where id = v_sub.user_id;
  end if;

  if v_sub.promo_code_applied is not null and v_sub.promo_code_applied <> '' then
    perform public.credit_affiliate_commission(
      v_sub.promo_code_applied,
      coalesce(v_sub.discounted_price_bdt, 0),
      15
    );
  end if;

  return true;
end;
$function$;
