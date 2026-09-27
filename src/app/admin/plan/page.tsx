'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Settings,
  DollarSign,
  Tag,
  Zap,
  Save,
  CheckCircle2,
  Plus,
  Trash2,
  Smartphone,
  Building,
  Sparkles,
  ArrowLeft,
  Megaphone,
  Check,
} from 'lucide-react';
import {
  getSubscriptionPlans,
  saveSubscriptionPlans,
  getTopupPacks,
  saveTopupPacks,
  getAdminSettings,
  saveAdminSettings,
  getAllPromoCodes,
  createNewPromoCode,
  deletePromoCode,
} from '@/lib/subscription-store';
import type {
  SubscriptionPlan,
  CreditTopupPack,
  AdminSettings,
  PromoCode,
  PromoDiscountType,
} from '@/types/subscription';

export default function AdminPlanSettingsPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [topupPacks, setTopupPacks] = useState<CreditTopupPack[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // New Promo Code state
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoType, setNewPromoType] = useState<PromoDiscountType>('PERCENTAGE');
  const [newPromoValue, setNewPromoValue] = useState(20);
  const [newPromoBonusCredits, setNewPromoBonusCredits] = useState(0);
  const [newPromoMaxUses, setNewPromoMaxUses] = useState(100);
  const [newPromoDays, setNewPromoDays] = useState(30);
  const [newPromoDesc, setNewPromoDesc] = useState('');
  const [showPromoModal, setShowPromoModal] = useState(false);

  // New custom topup pack state
  const [newPackName, setNewPackName] = useState('');
  const [newPackCredits, setNewPackCredits] = useState(500);
  const [newPackPriceBDT, setNewPackPriceBDT] = useState(350);

  useEffect(() => {
    setPlans(getSubscriptionPlans());
    setTopupPacks(getTopupPacks());
    setSettings(getAdminSettings());
    setPromoCodes(getAllPromoCodes());
  }, []);

  const handleSaveAll = () => {
    if (settings) saveAdminSettings(settings);
    saveSubscriptionPlans(plans);
    saveTopupPacks(topupPacks);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleUpdatePlan = (index: number, field: keyof SubscriptionPlan, value: unknown) => {
    setPlans((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleUpdateTopup = (index: number, field: keyof CreditTopupPack, value: unknown) => {
    setTopupPacks((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddTopupPack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPackName.trim()) return;
    const newPack: CreditTopupPack = {
      id: `topup_${Date.now()}`,
      name: newPackName.trim(),
      credits: newPackCredits,
      priceBDT: newPackPriceBDT,
      perCreditBDT: parseFloat((newPackPriceBDT / newPackCredits).toFixed(2)),
    };
    const updated = [...topupPacks, newPack];
    setTopupPacks(updated);
    saveTopupPacks(updated);
    setNewPackName('');
  };

  const handleDeleteTopupPack = (id: string) => {
    const updated = topupPacks.filter((p) => p.id !== id);
    setTopupPacks(updated);
    saveTopupPacks(updated);
  };

  const handleCreatePromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromoCode.trim()) return;

    const code: PromoCode = {
      code: newPromoCode.trim().toUpperCase(),
      type: newPromoType,
      discountValue: newPromoValue,
      bonusCredits: newPromoType === 'CREDIT_BONUS' ? newPromoBonusCredits : undefined,
      validUntil: Date.now() + newPromoDays * 24 * 60 * 60 * 1000,
      maxUses: newPromoMaxUses,
      currentUses: 0,
      description: newPromoDesc.trim() || `${newPromoCode} promotional discount`,
      isActive: true,
      commissionPercent: 15,
    };

    createNewPromoCode(code);
    setPromoCodes(getAllPromoCodes());
    setShowPromoModal(false);
    setNewPromoCode('');
    setNewPromoDesc('');
  };

  const handleDeletePromo = (code: string) => {
    if (confirm(`Delete promo code "${code}"?`)) {
      deletePromoCode(code);
      setPromoCodes(getAllPromoCodes());
    }
  };

  return (
    <div className="min-h-screen bg-bg-base text-zinc-100 py-10 px-4 sm:px-8">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white mb-2 transition-colors"
            >
              <ArrowLeft size={13} /> Back to Admin Hub
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <Settings size={26} className="text-emerald-400" />
              Plans, Pricing & Global Offers Control
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Change subscription prices, credit counts, global banners, and payment receiver details live
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveAll}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center gap-2 transition-colors shadow-lg shadow-emerald-500/20"
            >
              <Save size={15} />
              Save All Changes
            </button>
          </div>
        </div>

        {savedSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 size={16} />
            <span>All pricing, credit quotas, and settings have been saved successfully!</span>
          </div>
        )}

        {/* Section 1: WhatsApp & Payment Receiver Settings */}
        {settings && (
          <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Smartphone size={18} className="text-emerald-400" />
              WhatsApp & Payment Receiver Numbers
            </h2>
            <p className="text-xs text-zinc-400">
              Users will send money to these accounts and reach you directly on your WhatsApp to confirm their payments.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-emerald-400 mb-1">
                  Admin WhatsApp Number *
                </label>
                <input
                  type="text"
                  value={settings.whatsappNumber}
                  onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                  placeholder="e.g. 8801712345678"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  Include country code 88 for Bangladesh direct WhatsApp link
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-pink-400 mb-1">
                  bKash Personal / Merchant Number
                </label>
                <input
                  type="text"
                  value={settings.bkashNumber}
                  onChange={(e) => setSettings({ ...settings, bkashNumber: e.target.value })}
                  placeholder="e.g. 01712345678"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-orange-400 mb-1">
                  Nagad Personal Number
                </label>
                <input
                  type="text"
                  value={settings.nagadNumber}
                  onChange={(e) => setSettings({ ...settings, nagadNumber: e.target.value })}
                  placeholder="e.g. 01712345678"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-blue-400 mb-1">
                Bank Transfer Instructions & Account Details
              </label>
              <input
                type="text"
                value={settings.bankDetails}
                onChange={(e) => setSettings({ ...settings, bankDetails: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
          </div>
        )}

        {/* Section 2: Global Offers & Announcement Banner */}
        {settings && (
          <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Megaphone size={18} className="text-amber-400" />
              Global Site-wide Offers & Banner (All Users)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Global Discount */}
              <div className="space-y-3 p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200">Global Site-wide Discount</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.globalDiscountActive}
                      onChange={(e) => setSettings({ ...settings, globalDiscountActive: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                  </label>
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Percentage Off All Plans (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.globalDiscountPercent}
                    onChange={(e) => setSettings({ ...settings, globalDiscountPercent: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <p className="text-[10px] text-zinc-500">
                  When enabled, this discount applies automatically to all subscription plans on the pricing page.
                </p>
              </div>

              {/* Announcement Banner */}
              <div className="space-y-3 p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200">Announcement Banner</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.globalBannerActive}
                      onChange={(e) => setSettings({ ...settings, globalBannerActive: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500" />
                  </label>
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Banner Text</label>
                  <input
                    type="text"
                    value={settings.globalBannerText}
                    onChange={(e) => setSettings({ ...settings, globalBannerText: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Subscription Plans Manager */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <DollarSign size={20} className="text-emerald-400" />
              Monthly & Yearly Subscription Plans
            </h2>
            <p className="text-xs text-zinc-400">
              Customize the monthly price, yearly price, and monthly credit allowance for each tier
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan, idx) => (
              <div
                key={plan.id}
                className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white text-base">{plan.name}</span>
                    <span className="block text-[10px] text-zinc-500 font-mono">ID: {plan.id}</span>
                  </div>
                  <input
                    type="text"
                    value={plan.badge || ''}
                    onChange={(e) => handleUpdatePlan(idx, 'badge', e.target.value)}
                    placeholder="Badge (e.g. Popular)"
                    className="w-32 bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 text-[11px] text-zinc-300"
                  />
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="block text-zinc-400 text-[11px]">Monthly Price (BDT)</label>
                    <input
                      type="number"
                      value={plan.priceMonthly}
                      onChange={(e) => handleUpdatePlan(idx, 'priceMonthly', Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-[11px]">Yearly Price (BDT)</label>
                    <input
                      type="number"
                      value={plan.priceYearly}
                      onChange={(e) => handleUpdatePlan(idx, 'priceYearly', Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-[11px]">Image Credits / Month</label>
                    <input
                      type="number"
                      value={plan.creditsPerMonth}
                      onChange={(e) => handleUpdatePlan(idx, 'creditsPerMonth', Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-emerald-400 font-bold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-[11px]">Max Video Length (Seconds)</label>
                    <input
                      type="number"
                      value={plan.maxVideoDurationSec}
                      onChange={(e) => handleUpdatePlan(idx, 'maxVideoDurationSec', Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Pay-As-You-Go Top-up Packs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Zap size={20} className="text-amber-400 fill-amber-400" />
                Credit Top-up Packs
              </h2>
              <p className="text-xs text-zinc-400">
                Adjust credit top-up pricing or create new packs
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topupPacks.map((pack, idx) => (
              <div
                key={pack.id}
                className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3 relative group"
              >
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={pack.name}
                    onChange={(e) => handleUpdateTopup(idx, 'name', e.target.value)}
                    className="font-bold text-sm bg-transparent border-b border-transparent focus:border-zinc-600 text-white outline-none"
                  />
                  <button
                    onClick={() => handleDeleteTopupPack(pack.id)}
                    className="text-zinc-600 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-zinc-400">Credits</label>
                    <input
                      type="number"
                      value={pack.credits}
                      onChange={(e) => handleUpdateTopup(idx, 'credits', Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 text-emerald-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400">Price (BDT)</label>
                    <input
                      type="number"
                      value={pack.priceBDT}
                      onChange={(e) => handleUpdateTopup(idx, 'priceBDT', Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 text-white font-mono font-bold"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add New Topup Form */}
          <form
            onSubmit={handleAddTopupPack}
            className="p-4 rounded-xl bg-zinc-900/40 border border-dashed border-zinc-800 flex flex-wrap items-center gap-3 text-xs"
          >
            <span className="font-semibold text-zinc-300">Add New Pack:</span>
            <input
              type="text"
              placeholder="Pack Name (e.g. Mega Bundle)"
              value={newPackName}
              onChange={(e) => setNewPackName(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-white"
            />
            <input
              type="number"
              placeholder="Credits"
              value={newPackCredits}
              onChange={(e) => setNewPackCredits(Number(e.target.value))}
              className="w-24 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-white"
            />
            <input
              type="number"
              placeholder="Price BDT"
              value={newPackPriceBDT}
              onChange={(e) => setNewPackPriceBDT(Number(e.target.value))}
              className="w-28 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-white"
            />
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-colors flex items-center gap-1"
            >
              <Plus size={13} /> Add Pack
            </button>
          </form>
        </div>

        {/* Section 5: Global Promo Codes Manager */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Tag size={20} className="text-purple-400" />
                Global Promo Codes
              </h2>
              <p className="text-xs text-zinc-400">
                Create promotional coupons for marketing campaigns, influencers, and discounts
              </p>
            </div>
            <button
              onClick={() => setShowPromoModal(true)}
              className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus size={14} /> Create Promo Code
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {promoCodes.map((promo) => (
              <div
                key={promo.code}
                className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2.5 relative group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-base text-white bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                    {promo.code}
                  </span>
                  <button
                    onClick={() => handleDeletePromo(promo.code)}
                    className="text-zinc-600 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-xs text-zinc-400">{promo.description}</p>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-800 text-purple-400 font-semibold">
                  <span>
                    {promo.type === 'PERCENTAGE'
                      ? `${promo.discountValue}% OFF`
                      : promo.type === 'FIXED'
                      ? `৳${promo.discountValue} OFF`
                      : `+${promo.bonusCredits} Bonus Credits`}
                  </span>
                  <span className="text-zinc-400 font-normal">
                    {promo.currentUses} / {promo.maxUses} used
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Promo Code Modal */}
      {showPromoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Tag size={16} className="text-purple-400" />
              Create Global Promo Code
            </h3>
            <form onSubmit={handleCreatePromo} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Coupon Code</label>
                <input
                  type="text"
                  required
                  value={newPromoCode}
                  onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                  placeholder="e.g. FLASH30"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Discount Type</label>
                <select
                  value={newPromoType}
                  onChange={(e) => setNewPromoType(e.target.value as PromoDiscountType)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="PERCENTAGE">Percentage Discount (%)</option>
                  <option value="FIXED">Fixed Amount Discount (BDT)</option>
                  <option value="CREDIT_BONUS">Bonus Image Credits (+Credits)</option>
                </select>
              </div>

              {newPromoType === 'PERCENTAGE' && (
                <div>
                  <label className="block text-zinc-400 mb-1">Percentage Off (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newPromoValue}
                    onChange={(e) => setNewPromoValue(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              )}

              {newPromoType === 'FIXED' && (
                <div>
                  <label className="block text-zinc-400 mb-1">Discount Amount (BDT)</label>
                  <input
                    type="number"
                    min="1"
                    value={newPromoValue}
                    onChange={(e) => setNewPromoValue(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              )}

              {newPromoType === 'CREDIT_BONUS' && (
                <div>
                  <label className="block text-zinc-400 mb-1">Bonus Credits</label>
                  <input
                    type="number"
                    min="1"
                    value={newPromoBonusCredits}
                    onChange={(e) => setNewPromoBonusCredits(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Max Uses Limit</label>
                  <input
                    type="number"
                    value={newPromoMaxUses}
                    onChange={(e) => setNewPromoMaxUses(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Valid Days</label>
                  <input
                    type="number"
                    value={newPromoDays}
                    onChange={(e) => setNewPromoDays(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Description</label>
                <input
                  type="text"
                  value={newPromoDesc}
                  onChange={(e) => setNewPromoDesc(e.target.value)}
                  placeholder="e.g. Flash sale discount"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPromoModal(false)}
                  className="flex-1 py-2 rounded-xl bg-zinc-800 text-zinc-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold"
                >
                  Save Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
