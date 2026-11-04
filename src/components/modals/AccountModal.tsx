import React, { useState, useEffect } from 'react';
import { X, Wallet } from 'lucide-react';
import { Account } from '../../types';
import { inrToPaise, formatINR } from '../../utils/format';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  account?: Account | null;
  onSuccess: () => void;
}

const COLOR_PALETTE = [
  '#065F46', // Forest Green
  '#B45309', // Petrol Amber
  '#0D9488', // Mineral Teal
  '#1E293B', // Charcoal Slate
  '#4338CA', // Indigo
  '#BE185D', // Rose
  '#0284C7', // Sky
  '#7C3AED', // Violet
];

const ICONS = ['Wallet', 'PiggyBank', 'Fuel', 'ShoppingBag', 'CreditCard', 'Briefcase', 'Car', 'Plane', 'Home', 'ShieldCheck'];

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  account,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'petrol' | 'spending' | 'savings' | 'custom'>('custom');
  const [color, setColor] = useState('#065F46');
  const [icon, setIcon] = useState('Wallet');
  const [initialBalanceStr, setInitialBalanceStr] = useState('');
  const [budgetStr, setBudgetStr] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (account) {
        setName(account.name);
        setType(account.type);
        setColor(account.color);
        setIcon(account.icon);
        setInitialBalanceStr('');
        setBudgetStr(account.budget ? (account.budget.amount_paise / 100).toString() : '');
      } else {
        setName('');
        setType('custom');
        setColor('#065F46');
        setIcon('Wallet');
        setInitialBalanceStr('0');
        setBudgetStr('');
      }
      setError(null);
    }
  }, [isOpen, account]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Account name is required.');
      return;
    }

    setLoading(true);
    setError(null);

    const budgetPaise = budgetStr ? inrToPaise(budgetStr) : undefined;

    try {
      if (account) {
        const res = await fetch(`/api/accounts/${account.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            color,
            icon,
            monthlyBudgetPaise: budgetPaise !== undefined ? budgetPaise : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update account');
      } else {
        const initialPaise = initialBalanceStr ? inrToPaise(initialBalanceStr) : 0;
        const res = await fetch('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            type,
            color,
            icon,
            initialBalancePaise: initialPaise,
            budgetPaise,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create account');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs transition-opacity">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl border border-[#EAEBED] w-full max-w-md overflow-hidden max-h-[92vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        <div className="px-6 py-4.5 border-b border-[#F0F1F3] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#111318] tracking-tight">
              {account ? 'Edit Account' : 'Create New Account'}
            </h2>
            <p className="text-xs text-[#6B7280]">Independent financial bucket</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111318] hover:bg-[#F3F4F6] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">
                Account Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Emergency Fund, Travel, Tech"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#D1D5DB] text-sm text-[#111318] focus:border-[#065F46] outline-none"
              />
            </div>

            {!account && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Account Category
                  </label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] bg-white text-xs font-medium text-[#111318] outline-none"
                  >
                    <option value="custom">Standard Bucket</option>
                    <option value="spending">Daily Spending</option>
                    <option value="savings">Untouchable Savings</option>
                    <option value="petrol">Petrol Bucket</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Starting Balance (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={initialBalanceStr}
                    onChange={e => setInitialBalanceStr(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] text-xs font-medium text-[#111318] tabular-nums outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">
                Monthly Spending Limit (Optional ₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#9CA3AF]">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 2000"
                  value={budgetStr}
                  onChange={e => setBudgetStr(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 rounded-xl border border-[#D1D5DB] text-xs font-semibold text-[#111318] tabular-nums outline-none"
                />
              </div>
            </div>

            {/* Color Palette */}
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                Accent Color
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {COLOR_PALETTE.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                      color === c ? 'scale-115 ring-2 ring-[#111318] ring-offset-2' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Icon Picker */}
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                Account Icon
              </label>
              <div className="grid grid-cols-5 gap-2">
                {ICONS.map(i => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIcon(i)}
                    className={`p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      icon === i
                        ? 'border-[#065F46] bg-[#ECFDF5] text-[#065F46]'
                        : 'border-[#E5E7EB] hover:border-[#D1D5DB] text-[#4B5563]'
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-[#F0F1F3] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-[#4B5563] hover:text-[#111318] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-[#065F46] hover:bg-[#047857] text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Saving...' : account ? 'Save Changes' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
