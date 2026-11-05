import React, { useState, useEffect } from 'react';
import { X, Plus, Wallet, ShieldCheck, Check, AlertCircle } from 'lucide-react';
import { Account } from '../../types';
import { inrToPaise, formatINR, getTodayDateString } from '../../utils/format';
import { apiUrl } from '../../utils/apiConfig';

interface AddMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  onSuccess: () => void;
  defaultMode?: 'add' | 'set';
}

export const AddMoneyModal: React.FC<AddMoneyModalProps> = ({
  isOpen,
  onClose,
  account,
  onSuccess,
  defaultMode = 'add',
}) => {
  const [mode, setMode] = useState<'add' | 'set'>(defaultMode);
  const [amountStr, setAmountStr] = useState('');
  const [targetBalanceStr, setTargetBalanceStr] = useState('');
  const [isNewIncome, setIsNewIncome] = useState(false);
  const [source, setSource] = useState('IT work');
  const [customSource, setCustomSource] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(getTodayDateString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sources = ['IT work', 'Pocket money', 'Personal Allowance', 'Salary', 'Family', 'Other'];

  useEffect(() => {
    if (isOpen && account) {
      setMode(defaultMode);
      setAmountStr('');
      setTargetBalanceStr((account.balance_paise / 100).toFixed(2));
      setIsNewIncome(false);
      setSource('IT work');
      setCustomSource('');
      setDescription('');
      setDate(getTodayDateString());
      setError(null);
    }
  }, [isOpen, account, defaultMode]);

  if (!isOpen || !account) return null;

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountPaise = inrToPaise(amountStr);
    if (!amountPaise || amountPaise <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    setLoading(true);
    setError(null);

    const actualSource = source === 'Other' && customSource.trim() ? customSource.trim() : source;

    try {
      const res = await fetch(apiUrl(`/api/accounts/${account.id}/add-money`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountPaise,
          isNewIncome,
          source: isNewIncome ? actualSource : 'Direct Addition',
          description: description.trim() || undefined,
          date,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add funds');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetBalancePaise = inrToPaise(targetBalanceStr);
    if (targetBalancePaise < 0) {
      setError('Balance cannot be negative.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(apiUrl(`/api/accounts/${account.id}/set-balance`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetBalancePaise,
          notes: description.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update balance');
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
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-[#F0F1F3] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl text-white flex items-center justify-center shadow-xs"
              style={{ backgroundColor: account.color }}
            >
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#111318] tracking-tight">
                {mode === 'add' ? 'Add Money' : 'Set Available Balance'}
              </h2>
              <p className="text-xs text-[#6B7280]">
                {account.name} • Current: <strong>{formatINR(account.balance_paise)}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111318] hover:bg-[#F3F4F6] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="px-6 pt-4 pb-1">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F3F4F6] rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => { setMode('add'); setError(null); }}
              className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                mode === 'add'
                  ? 'bg-white text-[#111318] shadow-xs font-bold'
                  : 'text-[#6B7280] hover:text-[#111318]'
              }`}
            >
              + Add Money
            </button>
            <button
              type="button"
              onClick={() => { setMode('set'); setError(null); }}
              className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                mode === 'set'
                  ? 'bg-white text-[#111318] shadow-xs font-bold'
                  : 'text-[#6B7280] hover:text-[#111318]'
              }`}
            >
              Set Current Balance
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'add' ? (
            <form onSubmit={handleAddFunds} className="space-y-4">
              {/* Numeric Input */}
              <div className="text-center py-2 bg-[#F9FAFB] rounded-2xl border border-[#EBECEF] p-4">
                <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">
                  Amount to Add
                </label>
                <div className="flex items-center justify-center gap-1">
                  <span className="text-2xl sm:text-3xl font-extrabold text-[#9CA3AF]">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    autoFocus
                    placeholder="0.00"
                    value={amountStr}
                    onChange={e => setAmountStr(e.target.value)}
                    className="w-44 text-center text-4xl font-black text-[#111318] bg-transparent outline-none tabular-nums"
                  />
                </div>
              </div>

              {/* Source Mode Toggle: Direct vs New Income */}
              <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#EFE8DC] space-y-2">
                <label className="block text-xs font-bold text-[#713F12]">
                  How was this money received?
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setIsNewIncome(false)}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      !isNewIncome
                        ? 'border-[#065F46] bg-white ring-1 ring-[#065F46] text-[#065F46] font-bold'
                        : 'border-[#E5E7EB] bg-white/70 text-[#4B5563]'
                    }`}
                  >
                    <p className="font-bold text-[11px]">Already Recorded</p>
                    <p className="text-[10px] text-[#6B7280] mt-0.5">Prevents double-counting income</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsNewIncome(true)}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      isNewIncome
                        ? 'border-[#065F46] bg-white ring-1 ring-[#065F46] text-[#065F46] font-bold'
                        : 'border-[#E5E7EB] bg-white/70 text-[#4B5563]'
                    }`}
                  >
                    <p className="font-bold text-[11px]">New Income</p>
                    <p className="text-[10px] text-[#6B7280] mt-0.5">Records as new income source</p>
                  </button>
                </div>
              </div>

              {isNewIncome && (
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Income Source
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 mb-2">
                    {sources.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSource(s)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer truncate ${
                          source === s
                            ? 'border-[#065F46] bg-[#ECFDF5] text-[#065F46]'
                            : 'border-[#E5E7EB] bg-white text-[#4B5563]'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  {source === 'Other' && (
                    <input
                      type="text"
                      placeholder="Specify income source"
                      value={customSource}
                      onChange={e => setCustomSource(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-[#D1D5DB] text-xs text-[#111318] outline-none"
                    />
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">
                  Description / Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. November allowance, freelance cash"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#D1D5DB] text-xs font-medium text-[#111318] outline-none focus:border-[#065F46]"
                />
              </div>

              <div className="pt-3 border-t border-[#F0F1F3] flex items-center justify-end gap-2.5">
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
                  className="px-5 py-2.5 bg-[#065F46] hover:bg-[#047857] text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{loading ? 'Adding...' : 'Add Money to Account'}</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSetBalance} className="space-y-4">
              <div className="text-center py-2 bg-[#F9FAFB] rounded-2xl border border-[#EBECEF] p-4">
                <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">
                  Current Available Balance
                </label>
                <div className="flex items-center justify-center gap-1">
                  <span className="text-2xl sm:text-3xl font-extrabold text-[#9CA3AF]">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    autoFocus
                    placeholder="0.00"
                    value={targetBalanceStr}
                    onChange={e => setTargetBalanceStr(e.target.value)}
                    className="w-44 text-center text-4xl font-black text-[#111318] bg-transparent outline-none tabular-nums"
                  />
                </div>
              </div>

              <div className="p-3 bg-[#F0FDF4] rounded-xl border border-[#DCFCE7] text-[11px] text-[#14532D] leading-relaxed">
                <p>
                  • Enter the actual money you currently have available for <strong>{account.name}</strong>.
                </p>
                <p className="mt-1">
                  • This amount will remain available across months until you spend it or close the allocation.
                </p>
                <p className="mt-1">
                  • Does not count as additional income, preventing double-counting.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">
                  Reason for Adjustment (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Month-start balance reconciliation"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#D1D5DB] text-xs font-medium text-[#111318] outline-none focus:border-[#065F46]"
                />
              </div>

              <div className="pt-3 border-t border-[#F0F1F3] flex items-center justify-end gap-2.5">
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
                  className="px-5 py-2.5 bg-[#065F46] hover:bg-[#047857] text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{loading ? 'Saving...' : 'Set Available Balance'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

