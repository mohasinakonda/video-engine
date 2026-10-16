/**
 * Client helpers for the affiliate dashboard. All balances are computed in
 * Postgres (get_affiliate_dashboard / request_affiliate_payout), so the browser
 * never decides how much an affiliate may withdraw.
 */

import { createClient } from '@/lib/supabase/client';

export type AffiliateSaleStatus = 'ON_HOLD' | 'AVAILABLE' | 'REVERSED';
export type AffiliatePayoutStatus = 'PENDING' | 'PAID' | 'REJECTED';
export type AffiliatePayoutMethod = 'bkash' | 'nagad' | 'bank';

export interface AffiliateSale {
  id: string;
  createdAt: string;
  customer: string;
  item: string | null;
  orderBdt: number;
  percent: number;
  commissionBdt: number;
  status: AffiliateSaleStatus;
  availableAt: string;
}

export interface AffiliatePayout {
  id: string;
  requestedAt: string;
  amountBdt: number;
  method: AffiliatePayoutMethod;
  account: string;
  status: AffiliatePayoutStatus;
  paidAt: string | null;
  note: string | null;
}

export interface AffiliateDashboard {
  holdDays: number;
  minPayoutBdt: number;
  salesCount: number;
  earnedBdt: number;
  onHoldBdt: number;
  nextReleaseAt: string | null;
  availableBdt: number;
  requestedBdt: number;
  paidBdt: number;
  sales: AffiliateSale[];
  payouts: AffiliatePayout[];
}

export async function fetchAffiliateDashboard(): Promise<AffiliateDashboard> {
  const { data, error } = await createClient().rpc('get_affiliate_dashboard');
  if (error) throw error;
  return data as AffiliateDashboard;
}

export async function requestAffiliatePayout(
  amountBdt: number,
  method: AffiliatePayoutMethod,
  account: string
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await createClient().rpc('request_affiliate_payout', {
    p_amount_bdt: Math.floor(amountBdt),
    p_payment_method: method,
    p_account_number: account.trim(),
  });
  if (error) return { ok: false, error: 'Could not submit the request. Please try again.' };
  return data as { ok: boolean; error?: string };
}

export function formatBdt(amount: number): string {
  return `৳${new Intl.NumberFormat('en-BD').format(amount)}`;
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
