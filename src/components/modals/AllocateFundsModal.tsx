import React, { useState } from 'react';
import { X, Layers, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Account, Income } from '../../types';
import { inrToPaise, formatINR } from '../../utils/format';

interface AllocateFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  income: Income | null;
  accounts: Account[];
  onSuccess: () => void;
}

export const AllocateFundsModal: React.FC<AllocateFundsModalProps> = ({
  isOpen,
  onClose,
  income,
  accounts,
  onSuccess,
}) => {
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !income) return null;

  const unallocatedPaise = income.unallocated_paise;

  let totalAllocatedPaise = 0;
  Object.values(allocations).forEach(val => {
    const p = inrToPaise(val);
    if (p > 0) totalAllocatedPaise += p;
  });

  const remainingPaise = unallocatedPaise - totalAllocatedPaise;
  const isOverAllocated = remainingPaise < 0;
  const isFullyAllocated = remainingPaise === 0 && totalAllocatedPaise > 0;
  const allocPercentage = Math.min(100, Math.round((totalAllocatedPaise / unallocatedPaise) * 100)) || 0;

  const handleAllocationChange = (accId: string, val: string) => {
    setAllocations(prev => ({ ...prev, [accId]: val }));
  };

  const handleFillAll = (accId: string) => {
    if (remainingPaise > 0) {
      const current = inrToPaise(allocations[accId] || 0);
      const updated = current + remainingPaise;
      setAllocations(prev => ({
        ...prev,
        [accId]: (updated / 100).toFixed(2),
      }));
    }
  };

  const handleReset = () => {
    setAllocations({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalAllocatedPaise <= 0) {
      setError('Please allocate a positive amount.');
      return;
    }
    if (isOverAllocated) {
      setError('Allocated total exceeds the available unallocated income.');
      return;
    }

    const payloadAllocs: { accountId: string; amountPaise: number }[] = [];
    accounts.forEach(acc => {
      const p = inrToPaise(allocations[acc.id] || 0);
      if (p > 0) {
        payloadAllocs.push({
          accountId: acc.id,
          amountPaise: p,
        });
      }
    });

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/incomes/${income.id}/allocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations: payloadAllocs }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to allocate funds');

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111318]/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#EAEBED] w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#EAEBED] flex items-center justify-between bg-[#F8F9FA]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-[#EAEBED] text-[#111318] flex items-center justify-center shadow-xs">
              <Layers className="w-4 h-4 text-[#065F46]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#111318]">Allocate Funds</h2>
              <p className="text-xs text-[#717680]">
                {income.source} · Available: <span className="font-mono font-semibold text-[#111318]">{formatINR(unallocatedPaise)}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#717680] hover:text-[#111318] hover:bg-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 max-h-[80vh]">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Allocation Progress Bar */}
          <div className="bg-[#F8F9FA] rounded-xl p-3.5 border border-[#EAEBED] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#111318]">
                {isFullyAllocated ? (
                  <span className="inline-flex items-center gap-1 text-[#065F46]">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 100% Allocated
                  </span>
                ) : (
                  <span>Allocating: <strong className="font-mono text-[#111318]">{formatINR(totalAllocatedPaise)}</strong></span>
                )}
              </span>
              <span className="font-mono text-xs text-[#717680]">
                {remainingPaise > 0 ? `${formatINR(remainingPaise)} left` : isOverAllocated ? `${formatINR(Math.abs(remainingPaise))} over` : 'Complete'}
              </span>
            </div>
            <div className="h-1.5 w-full bg-[#EAEBED] rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  isOverAllocated ? 'bg-[#DC2626]' : isFullyAllocated ? 'bg-[#065F46]' : 'bg-[#065F46]'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, allocPercentage))}%` }}
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[#717680] px-1 font-semibold">
                <span>Destination Account</span>
                <span>Amount to Transfer</span>
              </div>

              {accounts.map(acc => {
                const val = allocations[acc.id] || '';
                return (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#EAEBED] hover:border-[#111318]/20 transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: acc.color }}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#111318] truncate">{acc.name}</p>
                        <p className="text-[11px] text-[#717680] font-mono">
                          Bal: {formatINR(acc.balance_paise)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="relative w-28">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#717680] text-xs font-mono font-bold">
                          ₹
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          value={val}
                          onChange={e => handleAllocationChange(acc.id, e.target.value)}
                          className="w-full pl-6 pr-2.5 py-1.5 rounded-lg border border-[#EAEBED] text-[#111318] text-xs font-semibold font-mono text-right focus:outline-none focus:ring-2 focus:ring-[#065F46]/20 focus:border-[#065F46]"
                        />
                      </div>
                      {remainingPaise > 0 && (
                        <button
                          type="button"
                          onClick={() => handleFillAll(acc.id)}
                          className="text-[11px] px-2 py-1 bg-[#F8F9FA] hover:bg-[#EAEBED] text-[#111318] rounded-md font-semibold transition-colors border border-[#EAEBED]"
                          title="Fill remaining balance into this account"
                        >
                          Fill
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-[#717680] hover:text-[#111318] underline font-medium"
              >
                Clear all
              </button>
              <div className="text-xs text-right">
                <span className="text-[#717680]">Remaining: </span>
                <span className={`font-mono font-bold ${isOverAllocated ? 'text-[#DC2626]' : 'text-[#111318]'}`}>
                  {formatINR(Math.max(0, remainingPaise))}
                </span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-[#EAEBED]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-[#717680] hover:text-[#111318]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || isOverAllocated || totalAllocatedPaise <= 0}
                className="px-5 py-2.5 bg-[#065F46] hover:bg-[#047857] text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50"
              >
                {loading ? 'Allocating...' : 'Confirm Allocation'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
