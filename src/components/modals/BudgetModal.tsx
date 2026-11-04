import React, { useState, useEffect } from 'react';
import { X, Target } from 'lucide-react';
import { Budget, Account, Category } from '../../types';
import { inrToPaise, formatINR, getTodayDateString } from '../../utils/format';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  budget?: Budget | null;
  accounts: Account[];
  categories: Category[];
  onSuccess: () => void;
}

export const BudgetModal: React.FC<BudgetModalProps> = ({
  isOpen,
  onClose,
  budget,
  accounts,
  categories,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [targetType, setTargetType] = useState<'account' | 'category'>('account');
  const [linkedAccountId, setLinkedAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [period, setPeriod] = useState<'monthly' | 'weekly' | 'custom'>('monthly');
  const [startDate, setStartDate] = useState(getTodayDateString());
  const [endDate, setEndDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (budget) {
        setName(budget.name);
        setAmountStr((budget.amount_paise / 100).toString());
        setPeriod(budget.period);
        setStartDate(budget.start_date || getTodayDateString());
        setEndDate(budget.end_date || '');
        if (budget.linked_account_id) {
          setTargetType('account');
          setLinkedAccountId(budget.linked_account_id);
          setCategoryId('');
        } else if (budget.category_id) {
          setTargetType('category');
          setCategoryId(budget.category_id);
          setLinkedAccountId('');
        }
      } else {
        setName('');
        setAmountStr('');
        setTargetType('account');
        setLinkedAccountId(accounts[0]?.id || '');
        setCategoryId(categories.filter(c => c.type === 'expense')[0]?.id || '');
        setPeriod('monthly');
        setStartDate(getTodayDateString());
        setEndDate('');
      }
      setError(null);
    }
  }, [isOpen, budget, accounts, categories]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountPaise = inrToPaise(amountStr);
    if (!name.trim()) {
      setError('Budget title is required.');
      return;
    }
    if (!amountPaise || amountPaise <= 0) {
      setError('Please provide a positive budget amount.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (budget) {
        const res = await fetch(`/api/budgets/${budget.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            amountPaise,
            period,
            startDate,
            endDate: endDate || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update budget');
      } else {
        const res = await fetch('/api/budgets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            linkedAccountId: targetType === 'account' ? linkedAccountId : null,
            categoryId: targetType === 'category' ? categoryId : null,
            amountPaise,
            period,
            startDate,
            endDate: endDate || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create budget');
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
              {budget ? 'Edit Budget Cap' : 'Create Budget Cap'}
            </h2>
            <p className="text-xs text-[#6B7280]">Cap spending for an account or category</p>
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
                Budget Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Monthly Shopping Cap, Dining Allowance"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#D1D5DB] text-sm text-[#111318] focus:border-[#065F46] outline-none"
              />
            </div>

            {!budget && (
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">
                  Budget Target
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setTargetType('account')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      targetType === 'account'
                        ? 'border-[#065F46] bg-[#ECFDF5] text-[#065F46]'
                        : 'border-[#E5E7EB] text-[#4B5563] hover:bg-[#F9FAFB]'
                    }`}
                  >
                    Account-Linked
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType('category')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      targetType === 'category'
                        ? 'border-[#065F46] bg-[#ECFDF5] text-[#065F46]'
                        : 'border-[#E5E7EB] text-[#4B5563] hover:bg-[#F9FAFB]'
                    }`}
                  >
                    Category-Specific
                  </button>
                </div>

                {targetType === 'account' ? (
                  <div>
                    <label className="block text-[11px] font-medium text-[#6B7280] mb-1">
                      Linked Account
                    </label>
                    <select
                      value={linkedAccountId}
                      onChange={e => setLinkedAccountId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] bg-white text-xs font-medium text-[#111318] outline-none"
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-medium text-[#6B7280] mb-1">
                      Expense Category
                    </label>
                    <select
                      value={categoryId}
                      onChange={e => setCategoryId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] bg-white text-xs font-medium text-[#111318] outline-none"
                    >
                      {categories
                        .filter(c => c.type === 'expense')
                        .map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">
                  Budget Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#9CA3AF]">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="2000"
                    value={amountStr}
                    onChange={e => setAmountStr(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#111318] tabular-nums outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">
                  Cadence
                </label>
                <select
                  value={period}
                  onChange={e => setPeriod(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] bg-white text-xs font-medium text-[#111318] outline-none"
                >
                  <option value="monthly">Monthly (auto-resets)</option>
                  <option value="weekly">Weekly</option>
                  <option value="custom">Custom Date Range</option>
                </select>
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
                {loading ? 'Saving...' : budget ? 'Update Budget' : 'Save Budget Cap'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
