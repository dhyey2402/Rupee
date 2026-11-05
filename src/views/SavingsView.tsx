import React, { useState, useEffect } from 'react';
import { PiggyBank, ArrowDownLeft, ShieldCheck, Calendar, Layers, Sparkles, Fuel, ShoppingBag, ArrowRight } from 'lucide-react';
import { SavingsSummary, SavingsRecord } from '../types';
import { formatINR, splitINR, formatDate } from '../utils/format';
import { apiUrl } from '../utils/apiConfig';

interface SavingsViewProps {
  savingsData?: SavingsSummary | null;
  onRefresh?: () => void;
  onSelectTab?: (tab: any) => void;
}

export const SavingsView: React.FC<SavingsViewProps> = ({
  savingsData: initialSavingsData,
  onRefresh,
  onSelectTab,
}) => {
  const [savingsData, setSavingsData] = useState<SavingsSummary | null>(initialSavingsData || null);
  const [loading, setLoading] = useState(!initialSavingsData);

  useEffect(() => {
    if (initialSavingsData) {
      setSavingsData(initialSavingsData);
    } else {
      fetchSavings();
    }
  }, [initialSavingsData]);

  const fetchSavings = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/savings'));
      if (res.ok) {
        const json: SavingsSummary = await res.json();
        setSavingsData(json);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const totalSavedPaise = savingsData?.totalSavedPaise ?? 0;
  const totalSplit = splitINR(totalSavedPaise);
  const byAccount = savingsData?.byAccount ?? [];
  const records = savingsData?.records ?? [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-[#111318] tracking-tight">
              Savings Reference
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#065F46] uppercase">
              Dedicated Reserve
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#6B7280]">
            Dedicated tracking of unused money automatically saved when closing allocations
          </p>
        </div>
      </div>

      {/* 1. Hero Total Saved Presentation */}
      <div className="bg-white rounded-3xl border border-[#EAEBED] p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#6B7280]">
              <PiggyBank className="w-4 h-4 text-[#065F46]" />
              <span>Total Money Saved</span>
              <span className="text-[#D1D5DB]">•</span>
              <span>Accumulated across all closed allocations</span>
            </div>

            {/* Hero Numeric Display */}
            <div className="flex items-baseline gap-1 text-[#111318]">
              <span className="text-3xl sm:text-4xl font-bold text-[#6B7280]">
                {totalSplit.symbol}
              </span>
              <span className="text-4xl sm:text-6xl font-black tracking-tight tabular-nums text-[#065F46]">
                {totalSplit.integer}
              </span>
              <span className="text-2xl sm:text-3xl font-bold text-[#065F46]/60 tabular-nums">
                .{totalSplit.decimal}
              </span>
            </div>

            <p className="text-xs text-[#6B7280] pt-1">
              Protected reserve. Not a spending account and cannot be spent from directly.
            </p>
          </div>

          {/* Quick Info Box */}
          <div className="bg-[#F8F9FA] p-4 rounded-2xl border border-[#EBECEF] max-w-sm text-xs text-[#4B5563] space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-[#111318]">
              <ShieldCheck className="w-4 h-4 text-[#065F46]" />
              <span>Automatic Allocation Sweep</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#6B7280]">
              Whenever you finish an allocation in <strong>College Petrol</strong> or <strong>Personal Spending</strong>, close it out to automatically sweep any unspent money here.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Savings Accumulated from Each Account */}
      <div>
        <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-3">
          Savings Accumulated by Account
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {byAccount.length === 0 ? (
            <div className="sm:col-span-2 lg:col-span-3 bg-white p-6 rounded-2xl border border-[#EAEBED] text-center text-xs text-[#6B7280]">
              No allocations closed yet. When you close an allocation for College Petrol or Personal Spending, unused balances will appear here.
            </div>
          ) : (
            byAccount.map(acc => {
              const isPetrol = acc.source_account_name.toLowerCase().includes('petrol');
              const isSpending = acc.source_account_name.toLowerCase().includes('spending');

              return (
                <div
                  key={acc.source_account_name}
                  className="bg-white rounded-2xl border border-[#EAEBED] p-5 shadow-xs hover:border-[#D1D5DB] transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs ${
                          isPetrol ? 'bg-[#B45309]' : isSpending ? 'bg-[#0ea5e9]' : 'bg-[#065F46]'
                        }`}
                      >
                        {isPetrol ? (
                          <Fuel className="w-4 h-4" />
                        ) : isSpending ? (
                          <ShoppingBag className="w-4 h-4" />
                        ) : (
                          <PiggyBank className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#111318]">
                          {acc.source_account_name}
                        </h4>
                        <span className="text-[10px] text-[#6B7280]">
                          {acc.count} allocation{acc.count === 1 ? '' : 's'} closed
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-base font-extrabold text-[#065F46] tabular-nums">
                        +{formatINR(acc.total_paise)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. Savings History Ledger */}
      <div className="bg-white rounded-3xl border border-[#EAEBED] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#111318]">Savings History</h3>
            <p className="text-xs text-[#6B7280]">Complete ledger of funds swept into savings</p>
          </div>
          <span className="text-xs font-bold text-[#6B7280] tabular-nums">
            {records.length} record{records.length === 1 ? '' : 's'}
          </span>
        </div>

        {records.length === 0 ? (
          <div className="p-8 text-center bg-[#F9FAFB] rounded-2xl border border-[#E5E7EB] space-y-2">
            <PiggyBank className="w-8 h-8 text-[#9CA3AF] mx-auto mb-1" />
            <p className="text-xs font-bold text-[#111318]">No savings records yet</p>
            <p className="text-xs text-[#6B7280]">
              When you close an allocation on College Petrol or Personal Spending, the unused balance is swept here automatically.
            </p>
            {onSelectTab && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onSelectTab('accounts')}
                  className="px-4 py-2 bg-[#065F46] text-white text-xs font-bold rounded-xl cursor-pointer hover:bg-[#047857] transition-all"
                >
                  Go to Accounts
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#F0F1F3]">
            {records.map((rec: SavingsRecord) => (
              <div
                key={rec.id}
                className="py-3.5 flex items-center justify-between gap-3 text-xs hover:bg-[#F9FAFB] px-2 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-[#ECFDF5] text-[#065F46] flex items-center justify-center shrink-0">
                    <PiggyBank className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[#111318] truncate">
                        Saved from {rec.source_account_name}
                      </p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#4B5563] font-medium shrink-0">
                        Closed Allocation
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[#6B7280] mt-0.5">
                      <span>{formatDate(rec.date)}</span>
                      {rec.notes && (
                        <>
                          <span>•</span>
                          <span className="truncate">{rec.notes}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-[#065F46] tabular-nums">
                    +{formatINR(rec.amount_paise)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

