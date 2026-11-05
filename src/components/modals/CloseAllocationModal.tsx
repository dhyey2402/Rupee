import React, { useState, useEffect } from 'react';
import { X, PiggyBank, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { Account } from '../../types';
import { formatINR, getTodayDateString } from '../../utils/format';
import { apiUrl } from '../../utils/apiConfig';

interface CloseAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  onSuccess: () => void;
}

export const CloseAllocationModal: React.FC<CloseAllocationModalProps> = ({
  isOpen,
  onClose,
  account,
  onSuccess,
}) => {
  const [date, setDate] = useState(getTodayDateString());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && account) {
      setDate(getTodayDateString());
      setNotes(`Unused ${account.name} allocation swept to savings`);
      setError(null);
    }
  }, [isOpen, account]);

  if (!isOpen || !account) return null;

  const unusedPaise = account.balance_paise;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (unusedPaise <= 0) {
      setError(`Cannot close allocation: ${account.name} has ₹0.00 unused balance.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(apiUrl(`/api/accounts/${account.id}/close-allocation`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to close allocation');
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
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-[#F0F1F3] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#065F46] text-white flex items-center justify-center shadow-xs">
              <PiggyBank className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#111318] tracking-tight">
                Close Out Allocation
              </h2>
              <p className="text-xs text-[#6B7280]">{account.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111318] hover:bg-[#F3F4F6] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Amount Transfer Callout */}
          <div className="bg-[#FAF7F2] p-4.5 rounded-2xl border border-[#EFE8DC] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-[#854D0E] uppercase">Unused Allocated Money</span>
                <p className="text-2xl font-black text-[#111318] tabular-nums mt-0.5">
                  {formatINR(unusedPaise)}
                </p>
              </div>
              <div className="flex items-center text-[#B45309]">
                <ArrowRight className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold text-[#065F46] uppercase">Added To Savings</span>
                <p className="text-2xl font-black text-[#065F46] tabular-nums mt-0.5">
                  +{formatINR(unusedPaise)}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-[#EFE8DC] text-[11px] text-[#713F12] leading-relaxed space-y-1">
              <p>
                • Your <strong>{account.name}</strong> available balance will automatically become <strong>₹0.00</strong>.
              </p>
              <p>
                • The remaining <strong>{formatINR(unusedPaise)}</strong> is safely recorded as <strong>Savings</strong> (not as an expense or income).
              </p>
              <p>
                • You decide when you are finished with an allocation; no automatic sweeps occur without your confirmation.
              </p>
            </div>
          </div>

          <form onSubmit={handleConfirm} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">
                Closeout Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#D1D5DB] text-xs font-semibold text-[#111318] outline-none focus:border-[#065F46]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">
                Savings Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. November petrol buffer saved"
                value={notes}
                onChange={e => setNotes(e.target.value)}
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
                disabled={loading || unusedPaise <= 0}
                className="px-5 py-2.5 bg-[#065F46] hover:bg-[#047857] text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                <PiggyBank className="w-3.5 h-3.5" />
                <span>{loading ? 'Saving...' : `Confirm & Move ${formatINR(unusedPaise)} to Savings`}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

