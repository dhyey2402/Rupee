import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowRightLeft,
  AlertTriangle,
  ArrowRight,
  Check,
} from 'lucide-react';
import { Account } from '../../types';
import { inrToPaise, formatINR, getTodayDateString } from '../../utils/format';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  onSuccess: () => void;
  initialFromAccountId?: string;
  initialToAccountId?: string;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  accounts,
  onSuccess,
  initialFromAccountId,
  initialToAccountId,
}) => {
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [date, setDate] = useState(getTodayDateString());
  const [note, setNote] = useState('');

  const [overdraftWarning, setOverdraftWarning] = useState<{
    message: string;
    currentBalancePaise: number;
    deficitPaise: number;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [successSaved, setSuccessSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transferableAccounts = accounts.filter(a => a.type !== 'savings' && a.type !== 'archived_savings' && a.type !== 'spending');

  useEffect(() => {
    if (isOpen) {
      setAmountStr('');
      setNote('');
      setDate(getTodayDateString());
      setOverdraftWarning(null);
      setError(null);
      setSuccessSaved(false);

      if (initialFromAccountId) {
        setFromAccountId(initialFromAccountId);
      } else {
        const bank = transferableAccounts.find(a => a.type === 'bank');
        setFromAccountId(bank ? bank.id : transferableAccounts[0]?.id || '');
      }

      if (initialToAccountId) {
        setToAccountId(initialToAccountId);
      } else {
        const cash = transferableAccounts.find(a => a.type === 'cash');
        setToAccountId(cash ? cash.id : transferableAccounts[1]?.id || '');
      }
    }
  }, [isOpen, initialFromAccountId, initialToAccountId, accounts]);

  const fromAccount = transferableAccounts.find(a => a.id === fromAccountId);
  const toAccount = transferableAccounts.find(a => a.id === toAccountId);
  const amountPaise = inrToPaise(amountStr);

  const handleSwap = () => {
    const temp = fromAccountId;
    setFromAccountId(toAccountId);
    setToAccountId(temp);
  };

  const handleSubmit = async (e?: React.FormEvent, allowOverdraft = false) => {
    if (e) e.preventDefault();
    if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) {
      setError('Please choose two distinct accounts.');
      return;
    }
    if (!amountPaise || amountPaise <= 0) {
      setError('Please enter a positive transfer amount.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAccountId,
          toAccountId,
          amountPaise,
          date,
          note: note.trim() || undefined,
          allowOverdraft,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'INSUFFICIENT_BALANCE') {
          setOverdraftWarning({
            message: data.message,
            currentBalancePaise: data.currentBalancePaise,
            deficitPaise: data.deficitPaise,
          });
          setLoading(false);
          return;
        }
        throw new Error(data.error || 'Failed to complete transfer');
      }

      setSuccessSaved(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs transition-opacity">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl border border-[#EAEBED] w-full max-w-lg overflow-hidden max-h-[92vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-[#F0F1F3] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#111318] tracking-tight">Transfer Between Accounts</h2>
            <p className="text-xs text-[#6B7280]">Zero net impact • Rebalance independent buckets</p>
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

          {overdraftWarning && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
              <div className="flex items-start gap-2 text-amber-800 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{overdraftWarning.message}</span>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleSubmit(undefined, true)}
                  disabled={loading}
                  className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Confirm Overdraft Transfer
                </button>
                <button
                  type="button"
                  onClick={() => setOverdraftWarning(null)}
                  className="px-3 py-1.5 bg-white text-slate-700 border border-slate-200 text-xs rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <form onSubmit={e => handleSubmit(e)} className="space-y-5">
            {/* Amount Hero */}
            <div className="text-center py-2 bg-[#F9FAFB] rounded-2xl border border-[#EBECEF] p-4">
              <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">
                Transfer Amount (INR)
              </label>
              <div className="flex items-center justify-center gap-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-[#9CA3AF]">₹</span>
                <input
                  type="number"
                  step="0.01"
                  autoFocus
                  placeholder="0"
                  value={amountStr}
                  onChange={e => setAmountStr(e.target.value)}
                  className="w-48 sm:w-60 text-center text-4xl sm:text-5xl font-black text-[#111318] bg-transparent outline-none tabular-nums placeholder:text-slate-300 tracking-tight"
                />
              </div>
            </div>

            {/* From & To Selector with Swap Button */}
            <div className="space-y-2 bg-[#F9FAFB] p-4 rounded-2xl border border-[#E5E7EB]">
              {/* From Account */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-bold text-[#4B5563] uppercase tracking-wider">From Account</span>
                  {fromAccount && (
                    <span className="text-[10px] text-[#6B7280]">
                      Available: <strong className="text-[#111318] tabular-nums">{formatINR(fromAccount.balance_paise)}</strong>
                    </span>
                  )}
                </div>
                <select
                  value={fromAccountId}
                  onChange={e => setFromAccountId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] bg-white text-xs font-bold text-[#111318] outline-none"
                >
                  {transferableAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} — {formatINR(acc.balance_paise)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Swap Button */}
              <div className="flex justify-center -my-1">
                <button
                  type="button"
                  onClick={handleSwap}
                  className="p-1.5 rounded-full bg-white border border-[#D1D5DB] text-[#4B5563] hover:text-[#111318] hover:border-[#9CA3AF] shadow-2xs transition-all cursor-pointer"
                  title="Swap source and destination"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* To Account */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-bold text-[#4B5563] uppercase tracking-wider">To Account</span>
                  {toAccount && (
                    <span className="text-[10px] text-[#6B7280]">
                      Current: <strong className="text-[#111318] tabular-nums">{formatINR(toAccount.balance_paise)}</strong>
                    </span>
                  )}
                </div>
                <select
                  value={toAccountId}
                  onChange={e => setToAccountId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] bg-white text-xs font-bold text-[#111318] outline-none"
                >
                  {transferableAccounts
                    .filter(acc => acc.id !== fromAccountId)
                    .map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} — {formatINR(acc.balance_paise)}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Date & Note */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] text-xs font-medium text-[#111318] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">Reason / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Extra petrol for exam week"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] text-xs text-[#111318] outline-none"
                />
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
                disabled={loading || successSaved}
                className="px-6 py-2.5 bg-[#111318] hover:bg-black active:scale-[0.99] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {successSaved ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Transferred!</span>
                  </>
                ) : loading ? (
                  'Executing Transfer...'
                ) : (
                  'Confirm Transfer'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
