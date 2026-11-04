import React, { useState, useEffect } from 'react';
import {
  X,
  TrendingUp,
  Sparkles,
  Check,
  AlertCircle,
  Coins,
  Percent,
} from 'lucide-react';
import { Account } from '../../types';
import { inrToPaise, formatINR, getTodayDateString } from '../../utils/format';

interface RecordIncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  onSuccess: () => void;
}

export const RecordIncomeModal: React.FC<RecordIncomeModalProps> = ({
  isOpen,
  onClose,
  accounts,
  onSuccess,
}) => {
  const [amountStr, setAmountStr] = useState('');
  const [source, setSource] = useState('IT work');
  const [customSource, setCustomSource] = useState('');
  const [date, setDate] = useState(getTodayDateString());
  const [description, setDescription] = useState('');

  // Allocation per account: map of accountId -> string amount
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sources = ['IT work', 'Pocket money', 'Family', 'Salary', 'Freelance', 'Other'];

  useEffect(() => {
    if (isOpen) {
      setAmountStr('');
      setSource('IT work');
      setCustomSource('');
      setDate(getTodayDateString());
      setDescription('');
      setError(null);

      const initAllocs: Record<string, string> = {};
      accounts.forEach(a => {
        initAllocs[a.id] = '';
      });
      setAllocations(initAllocs);
    }
  }, [isOpen, accounts]);

  const totalIncomePaise = inrToPaise(amountStr);

  let totalAllocatedPaise = 0;
  Object.values(allocations).forEach(val => {
    const p = inrToPaise(val);
    if (p > 0) totalAllocatedPaise += p;
  });

  const remainingUnallocatedPaise = totalIncomePaise - totalAllocatedPaise;
  const isOverAllocated = remainingUnallocatedPaise < 0;
  const allocationPercentage = totalIncomePaise > 0
    ? Math.min(Math.round((totalAllocatedPaise / totalIncomePaise) * 100), 100)
    : 0;

  // Preset 1: Student Commute Scenario (₹5,000 -> 2k Petrol, 2k Spending, 1k Savings)
  const handlePresetStudentSplit = () => {
    const petrolAcc = accounts.find(a => a.type === 'petrol');
    const spendingAcc = accounts.find(a => a.type === 'spending');
    const savingsAcc = accounts.find(a => a.type === 'savings');

    setAmountStr('5000');
    setSource('IT work');
    setDescription('Freelance Web Development Project');

    const newAllocs: Record<string, string> = {};
    accounts.forEach(a => {
      if (a.id === petrolAcc?.id) newAllocs[a.id] = '2000';
      else if (a.id === spendingAcc?.id) newAllocs[a.id] = '2000';
      else if (a.id === savingsAcc?.id) newAllocs[a.id] = '1000';
      else newAllocs[a.id] = '0';
    });
    setAllocations(newAllocs);
  };

  const handleEqualSplit = () => {
    if (totalIncomePaise <= 0 || accounts.length === 0) return;
    const splitPaise = Math.floor(totalIncomePaise / accounts.length);
    const newAllocs: Record<string, string> = {};
    accounts.forEach(a => {
      newAllocs[a.id] = (splitPaise / 100).toFixed(2);
    });
    setAllocations(newAllocs);
  };

  const handleAllocationChange = (accId: string, val: string) => {
    setAllocations(prev => ({ ...prev, [accId]: val }));
  };

  const handleFillRemainder = (accId: string) => {
    if (remainingUnallocatedPaise > 0) {
      const current = inrToPaise(allocations[accId] || 0);
      const updatedPaise = current + remainingUnallocatedPaise;
      setAllocations(prev => ({
        ...prev,
        [accId]: (updatedPaise / 100).toFixed(2),
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalIncomePaise <= 0) {
      setError('Please enter a valid positive income amount.');
      return;
    }
    if (isOverAllocated) {
      setError('Total allocated money exceeds the total income received!');
      return;
    }

    const finalSource = source === 'Other' && customSource.trim() ? customSource.trim() : source;

    const allocationPayload: { accountId: string; amountPaise: number }[] = [];
    accounts.forEach(acc => {
      const p = inrToPaise(allocations[acc.id] || 0);
      if (p > 0) {
        allocationPayload.push({
          accountId: acc.id,
          amountPaise: p,
        });
      }
    });

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/incomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountPaise: totalIncomePaise,
          source: finalSource,
          date,
          description: description.trim() || undefined,
          allocations: allocationPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record income');

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs transition-opacity">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl border border-[#EAEBED] w-full max-w-xl overflow-hidden max-h-[92vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-[#F0F1F3] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#111318] tracking-tight">Record Income & Allocation</h2>
            <p className="text-xs text-[#6B7280]">Record new money and distribute directly across account buckets</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111318] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Top row: Amount Hero */}
            <div className="text-center py-2 bg-[#F0FDF4] rounded-2xl border border-[#DCFCE7] p-4">
              <label className="block text-[11px] font-semibold text-[#166534] uppercase tracking-wider mb-1">
                Income Amount Received (INR)
              </label>
              <div className="flex items-center justify-center gap-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-[#15803D]">₹</span>
                <input
                  type="number"
                  step="0.01"
                  autoFocus
                  placeholder="0"
                  value={amountStr}
                  onChange={e => setAmountStr(e.target.value)}
                  className="w-48 sm:w-60 text-center text-4xl sm:text-5xl font-black text-[#14532D] bg-transparent outline-none tabular-nums placeholder:text-emerald-300 tracking-tight"
                />
              </div>
            </div>

            {/* Income Source & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">
                  Income Source
                </label>
                <select
                  value={source}
                  onChange={e => setSource(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#D1D5DB] bg-white text-xs font-medium text-[#111318] focus:border-[#065F46] outline-none"
                >
                  {sources.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">
                  Date Received
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#D1D5DB] text-xs font-medium text-[#111318] focus:border-[#065F46] outline-none"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">
                Description / Memo (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Freelance IT project payout, monthly pocket money"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#D1D5DB] text-xs text-[#111318] focus:border-[#065F46] outline-none"
              />
            </div>

            {/* Allocation Section */}
            <div className="pt-2 border-t border-[#F0F1F3] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-[#111318] uppercase tracking-wider">
                    Distribute to Accounts
                  </h4>
                  <p className="text-[11px] text-[#6B7280]">
                    Real allocation of money into isolated buckets
                  </p>
                </div>

                {/* Presets */}
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={handlePresetStudentSplit}
                    className="px-2.5 py-1 rounded-lg bg-[#FAF7F2] text-[#854D0E] border border-[#EFE8DC] text-[10px] font-bold hover:bg-[#F5EEDF] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-[#B45309]" />
                    <span>₹5k Student Split</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleEqualSplit}
                    className="px-2 py-1 rounded-lg bg-[#F3F4F6] text-[#4B5563] text-[10px] font-semibold hover:bg-[#E5E7EB] transition-colors cursor-pointer"
                  >
                    Equal
                  </button>
                </div>
              </div>

              {/* Progress Summary Card */}
              <div className="p-3.5 bg-[#F9FAFB] rounded-2xl border border-[#E5E7EB] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-[#4B5563]">Allocated Total:</span>
                  <span className={`font-bold tabular-nums ${isOverAllocated ? 'text-rose-600' : 'text-[#111318]'}`}>
                    {formatINR(totalAllocatedPaise)} / {formatINR(totalIncomePaise)}
                  </span>
                </div>

                <div className="w-full bg-[#E5E7EB] h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isOverAllocated ? 'bg-rose-500' : 'bg-[#065F46]'
                    }`}
                    style={{ width: `${Math.min(allocationPercentage, 100)}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#6B7280]">Remaining to allocate:</span>
                  <span className={`font-bold tabular-nums ${remainingUnallocatedPaise > 0 ? 'text-[#065F46]' : 'text-[#6B7280]'}`}>
                    {formatINR(Math.max(0, remainingUnallocatedPaise))}
                  </span>
                </div>
              </div>

              {/* Account Allocation Rows */}
              <div className="space-y-2">
                {accounts.map(acc => {
                  const val = allocations[acc.id] || '';
                  return (
                    <div
                      key={acc.id}
                      className="p-3 bg-white rounded-xl border border-[#E5E7EB] flex items-center justify-between gap-3 hover:border-[#D1D5DB] transition-all"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: acc.color }}
                        />
                        <div>
                          <p className="text-xs font-bold text-[#111318]">{acc.name}</p>
                          <p className="text-[10px] text-[#6B7280] tabular-nums">
                            Current balance: {formatINR(acc.balance_paise)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <div className="relative w-28 sm:w-32">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#9CA3AF]">
                            ₹
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0"
                            value={val}
                            onChange={e => handleAllocationChange(acc.id, e.target.value)}
                            className="w-full pl-6 pr-2.5 py-1.5 rounded-lg border border-[#D1D5DB] text-xs font-bold text-right tabular-nums text-[#111318] focus:border-[#065F46] outline-none"
                          />
                        </div>
                        {remainingUnallocatedPaise > 0 && (
                          <button
                            type="button"
                            onClick={() => handleFillRemainder(acc.id)}
                            className="px-2 py-1.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                            title="Fill remaining balance into this account"
                          >
                            +Rest
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions */}
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
                disabled={loading || isOverAllocated || totalIncomePaise <= 0}
                className="px-6 py-2.5 bg-[#065F46] hover:bg-[#047857] active:scale-[0.99] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Recording...' : 'Confirm & Deposit Income'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
