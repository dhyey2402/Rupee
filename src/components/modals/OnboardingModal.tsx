import React, { useState } from 'react';
import { Fuel, ShoppingBag, PiggyBank, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { inrToPaise } from '../../utils/format';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onLoadDemo: () => Promise<void>;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onLoadDemo,
}) => {
  const [step, setStep] = useState<'welcome' | 'balances'>('welcome');
  const [petrolBalance, setPetrolBalance] = useState('');
  const [spendingBalance, setSpendingBalance] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartClean = async () => {
    setLoading(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'is_onboarded', value: 'true' }),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInitialBalances = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const pPaise = inrToPaise(petrolBalance);
      const sPaise = inrToPaise(spendingBalance);

      const totalInitial = pPaise + sPaise;

      if (totalInitial > 0) {
        const today = new Date().toISOString().split('T')[0];
        const allocations = [];
        if (pPaise > 0) allocations.push({ accountId: 'acc-bank', amountPaise: pPaise });
        if (sPaise > 0) allocations.push({ accountId: 'acc-spending', amountPaise: sPaise });

        await fetch('/api/incomes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amountPaise: totalInitial,
            source: 'Initial Balance',
            date: today,
            description: 'Starting balances entered during setup',
            allocations,
          }),
        });
      }

      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'is_onboarded', value: 'true' }),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadDemo = async () => {
    setDemoLoading(true);
    try {
      await onLoadDemo();
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111318]/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#EAEBED] w-full max-w-lg overflow-hidden flex flex-col">
        {step === 'welcome' ? (
          <div className="p-8 space-y-6">
            <div className="text-center space-y-2.5">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-[#065F46] flex items-center justify-center text-white shadow-md">
                <span className="font-mono text-xl font-bold">₹</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#111318] tracking-tight">
                  Rupee.
                </h2>
                <p className="text-xs text-[#717680] max-w-sm mx-auto mt-1">
                  Dedicated personal finance system with independent accounts for College Petrol, Personal Spending, and Savings.
                </p>
              </div>
            </div>

            {/* 3 Core Highlights Showcase */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-3.5 p-3.5 bg-[#F8F9FA] rounded-xl border border-[#EAEBED]">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-[#B45309] flex items-center justify-center shrink-0">
                  <Fuel className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-[#111318]">College Petrol Account</h4>
                  <p className="text-[11px] text-[#717680] mt-0.5">
                    Dedicated exclusively for college travel. Holds allocated money until spent or closed out.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3.5 p-3.5 bg-[#F8F9FA] rounded-xl border border-[#EAEBED]">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-[#065F46] flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-[#111318]">Personal Spending Account</h4>
                  <p className="text-[11px] text-[#717680] mt-0.5">
                    Everyday food, shopping, canteen, and personal expenses. No spending limit.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3.5 p-3.5 bg-[#F8F9FA] rounded-xl border border-[#EAEBED]">
                <div className="w-9 h-9 rounded-lg bg-teal-500/10 text-teal-700 flex items-center justify-center shrink-0">
                  <PiggyBank className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-[#111318]">Savings Reference</h4>
                  <p className="text-[11px] text-[#717680] mt-0.5">
                    Automatically accumulates unspent money when you close out an allocation.
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                {error}
              </div>
            )}

            {/* Quick Action Options */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => setStep('balances')}
                className="w-full py-2.5 px-4 bg-[#065F46] hover:bg-[#047857] text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5"
              >
                <span>Enter Starting Balances</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleStartClean}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-white hover:bg-[#F8F9FA] text-[#111318] rounded-xl font-semibold text-xs border border-[#EAEBED] transition-colors"
              >
                Start Clean with ₹0 Balances
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleLoadDemo}
                  disabled={demoLoading}
                  className="text-xs font-medium text-[#717680] hover:text-[#065F46] transition-colors"
                >
                  {demoLoading ? 'Loading demo scenario...' : 'Or explore with Student Demo (₹5,000 IT income split)'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveInitialBalances} className="p-7 space-y-5">
            <div>
              <h3 className="text-base font-bold text-[#111318]">Starting Balances</h3>
              <p className="text-xs text-[#717680] mt-0.5">
                Enter your current cash or bank balances for each account, or leave at ₹0.
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-[#F8F9FA] rounded-xl border border-[#EAEBED]">
                <label className="block text-xs font-semibold text-[#111318] mb-1.5 flex items-center gap-1.5">
                  <Fuel className="w-3.5 h-3.5 text-[#B45309]" />
                  College Petrol Starting Balance
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#717680] font-mono font-bold text-xs">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={petrolBalance}
                    onChange={e => setPetrolBalance(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 rounded-lg border border-[#EAEBED] bg-white text-[#111318] text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-[#065F46]/20 focus:border-[#065F46]"
                  />
                </div>
              </div>

              <div className="p-3 bg-[#F8F9FA] rounded-xl border border-[#EAEBED]">
                <label className="block text-xs font-semibold text-[#111318] mb-1.5 flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-[#065F46]" />
                  Personal Spending Starting Balance
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#717680] font-mono font-bold text-xs">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={spendingBalance}
                    onChange={e => setSpendingBalance(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 rounded-lg border border-[#EAEBED] bg-white text-[#111318] text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-[#065F46]/20 focus:border-[#065F46]"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep('welcome')}
                className="text-xs font-semibold text-[#717680] hover:text-[#111318]"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-[#065F46] hover:bg-[#047857] text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50"
              >
                {loading ? 'Setting Up...' : 'Start Managing My Money'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
