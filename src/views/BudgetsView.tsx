import React from 'react';
import {
  Target,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Fuel,
  Calendar,
} from 'lucide-react';
import { Budget, Account, Category } from '../types';
import { formatINR, getBudgetResetInfo } from '../utils/format';

interface BudgetsViewProps {
  budgets: Budget[];
  accounts: Account[];
  categories: Category[];
  selectedMonth: string;
  onOpenCreateBudget: () => void;
  onOpenEditBudget: (b: Budget) => void;
  onDeleteBudget: (b: Budget) => void;
  onTogglePauseBudget: (b: Budget) => void;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({
  budgets,
  accounts,
  categories,
  selectedMonth,
  onOpenCreateBudget,
  onOpenEditBudget,
  onDeleteBudget,
  onTogglePauseBudget,
}) => {
  const [y, m] = selectedMonth.split('-').map(Number);
  const monthName = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const resetInfo = getBudgetResetInfo(selectedMonth);

  const petrolBudget = budgets.find(b => b.category_id === 'cat-petrol' || b.name.toLowerCase().includes('petrol'));
  const otherBudgets = budgets.filter(b => b.id !== petrolBudget?.id);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#111318] tracking-tight">
            Budgets & Expense Caps
          </h2>
          <p className="text-xs sm:text-sm text-[#6B7280]">
            Tracked period: <strong className="text-[#111318]">{monthName}</strong> • {resetInfo.resetDateLabel}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenCreateBudget}
          className="px-4 py-2 bg-[#065F46] hover:bg-[#047857] text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>New Budget Cap</span>
        </button>
      </div>

      {/* College Petrol Budget Highlight Card */}
      {petrolBudget && (
        <div className="bg-[#FAF7F2] rounded-3xl border border-[#EFE8DC] p-6 sm:p-7 shadow-xs relative overflow-hidden space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#B45309] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Fuel className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#111318]">{petrolBudget.name}</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-[#F5EEDF] text-[#854D0E] rounded-full uppercase">
                    Monthly Auto-Reset
                  </span>
                </div>
                <p className="text-xs text-[#713F12] mt-0.5">
                  Linked Account: <strong>College Petrol</strong> • Resets on the 1st of every calendar month
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenEditBudget(petrolBudget)}
              className="p-2 rounded-xl bg-white border border-[#EFE8DC] text-[#713F12] hover:bg-white/90 text-xs font-semibold shadow-2xs transition-colors cursor-pointer self-start sm:self-auto"
              title="Edit Petrol Budget"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/90 p-4 rounded-2xl border border-[#EFE8DC]">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#854D0E]">Cap Allowance</span>
              <p className="text-base font-black text-[#111318] tabular-nums mt-0.5">
                {formatINR(petrolBudget.amount_paise)}
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#854D0E]">Spent This Month</span>
              <p className="text-base font-black text-[#854D0E] tabular-nums mt-0.5">
                {formatINR(petrolBudget.spent_paise || 0)}
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#854D0E]">Remaining</span>
              <p
                className={`text-base font-black tabular-nums mt-0.5 ${
                  petrolBudget.is_exceeded ? 'text-[#DC2626]' : 'text-[#065F46]'
                }`}
              >
                {petrolBudget.is_exceeded
                  ? `-${formatINR(petrolBudget.exceeded_by_paise || 0)}`
                  : formatINR(petrolBudget.remaining_paise || 0)}
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#854D0E]">Budget Used</span>
              <p
                className={`text-base font-black tabular-nums mt-0.5 ${
                  (petrolBudget.percentage || 0) > 100
                    ? 'text-[#DC2626]'
                    : (petrolBudget.percentage || 0) >= 80
                    ? 'text-[#D97706]'
                    : 'text-[#065F46]'
                }`}
              >
                {petrolBudget.percentage}%
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="w-full bg-[#EADDCE] h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  petrolBudget.is_exceeded
                    ? 'bg-[#DC2626]'
                    : (petrolBudget.percentage || 0) >= 80
                    ? 'bg-[#D97706]'
                    : 'bg-[#059669]'
                }`}
                style={{ width: `${Math.min(petrolBudget.percentage || 0, 100)}%` }}
              />
            </div>
            {petrolBudget.is_exceeded && (
              <p className="text-xs font-bold text-[#DC2626] mt-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Budget Exceeded by {formatINR(petrolBudget.exceeded_by_paise || 0)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Additional Budgets Grid */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] px-1">
          Other Account & Category Budgets
        </h3>

        {otherBudgets.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#EAEBED] p-8 text-center space-y-3 shadow-xs">
            <h4 className="text-sm font-bold text-[#111318]">No additional budget caps</h4>
            <p className="text-xs text-[#6B7280] max-w-sm mx-auto">
              Set monthly caps on Personal Spending or specific categories like Shopping or Dining to curb discretionary spending.
            </p>
            <button
              type="button"
              onClick={onOpenCreateBudget}
              className="px-4 py-2 bg-[#065F46] text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Add Budget Cap
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {otherBudgets.map(b => {
              const spent = b.spent_paise || 0;
              const remaining = b.remaining_paise || 0;
              const pct = b.percentage || 0;
              const isExceeded = b.is_exceeded;

              return (
                <div
                  key={b.id}
                  className="bg-white rounded-2xl border border-[#EAEBED] p-5 shadow-xs hover:border-[#D1D5DB] transition-all space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-[#111318]">{b.name}</h4>
                      <p className="text-xs text-[#6B7280]">
                        Target:{' '}
                        <strong className="text-[#374151]">
                          {b.account_name ? `Account: ${b.account_name}` : `Category: ${b.category_name}`}
                        </strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onOpenEditBudget(b)}
                        className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111318] hover:bg-[#F3F4F6] cursor-pointer"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteBudget(b)}
                        className="p-1.5 rounded-lg text-[#6B7280] hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#6B7280] tabular-nums">
                        Spent {formatINR(spent)} of {formatINR(b.amount_paise)}
                      </span>
                      <span
                        className={`font-bold tabular-nums ${
                          isExceeded
                            ? 'text-rose-600'
                            : pct >= 80
                            ? 'text-amber-600'
                            : 'text-[#065F46]'
                        }`}
                      >
                        {pct}%
                      </span>
                    </div>

                    <div className="w-full bg-[#E5E7EB] h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isExceeded
                            ? 'bg-rose-500'
                            : pct >= 80
                            ? 'bg-amber-500'
                            : 'bg-[#065F46]'
                        }`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-[#6B7280] pt-0.5">
                      <span>Monthly cadence</span>
                      {isExceeded ? (
                        <span className="text-rose-600 font-bold tabular-nums">
                          Exceeded by {formatINR(b.exceeded_by_paise || 0)}
                        </span>
                      ) : (
                        <span className="tabular-nums">{formatINR(remaining)} remaining</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
