import React from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Fuel,
  AlertTriangle,
  ArrowRight,
  Plus,
  ArrowRightLeft,
  Calendar,
  Layers,
  ChevronRight,
  Clock,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { BootstrapData, Account, Transaction } from '../types';
import { formatINR, splitINR, formatRelativeDate, formatDate, getBudgetResetInfo, groupTransactionsByDate } from '../utils/format';
import { CategoryIcon } from '../components/CategoryIcon';

interface DashboardViewProps {
  data: BootstrapData;
  onOpenExpense: (accountId?: string) => void;
  onOpenIncome: () => void;
  onOpenTransfer: (fromId?: string, toId?: string) => void;
  onOpenAllocate: () => void;
  onSelectTab: (tab: any) => void;
  onEditTransaction: (tx: Transaction) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  data,
  onOpenExpense,
  onOpenIncome,
  onOpenTransfer,
  onOpenAllocate,
  onSelectTab,
  onEditTransaction,
}) => {
  const { summary, accounts, recentTransactions, categoryBreakdown, petrolOverview } = data;

  const petrolAccount = accounts.find(a => a.type === 'petrol');
  const petrolBudget = petrolAccount?.budget;
  const otherAccounts = accounts.filter(a => a.type !== 'petrol');

  const [y, m] = data.month.split('-').map(Number);
  const monthName = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const resetInfo = getBudgetResetInfo(data.month);

  const totalSplit = splitINR(summary.totalMoneyPaise);
  const groupedActivity = groupTransactionsByDate(recentTransactions.slice(0, 8));

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* 1. Hero Financial Command Center */}
      <div className="bg-white rounded-3xl border border-[#EAEBED] p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          {/* Main Net Worth / Total Balance Presentation */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#6B7280]">
              <span>Total Financial Holdings</span>
              <span className="text-[#D1D5DB]">•</span>
              <span>{monthName}</span>
            </div>

            {/* Giant Monzo/Revolut-style Hero Numeric Display */}
            <div className="flex items-baseline gap-1 text-[#111318]">
              <span className="text-3xl sm:text-4xl font-bold text-[#6B7280]">
                {totalSplit.symbol}
              </span>
              <span className="text-4xl sm:text-6xl font-black tracking-tight tabular-nums">
                {totalSplit.integer}
              </span>
              <span className="text-2xl sm:text-3xl font-bold text-[#9CA3AF] tabular-nums">
                .{totalSplit.decimal}
              </span>
            </div>

            {/* Subtle Distinct Breakdown - Clears user confusion */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#4B5563] pt-1">
              <span>
                Available to spend:{' '}
                <strong className="text-[#065F46] tabular-nums font-bold">
                  {formatINR(summary.availableSpendingPaise)}
                </strong>
              </span>
              <span className="text-[#D1D5DB]">•</span>
              <span>
                In savings:{' '}
                <strong className="text-[#0F766E] tabular-nums font-bold">
                  {formatINR(summary.totalSavingsPaise)}
                </strong>
              </span>
              {summary.unallocatedPaise > 0 && (
                <>
                  <span className="text-[#D1D5DB]">•</span>
                  <span>
                    Unallocated:{' '}
                    <strong className="text-[#B45309] tabular-nums font-bold">
                      {formatINR(summary.unallocatedPaise)}
                    </strong>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Quick Action Group */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => onOpenExpense()}
              className="px-5 py-2.5 bg-[#065F46] hover:bg-[#047857] active:scale-[0.99] text-white rounded-xl text-xs font-bold tracking-wide shadow-sm hover:shadow transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Expense</span>
            </button>
            <button
              type="button"
              onClick={onOpenIncome}
              className="px-4 py-2.5 bg-[#F9FAFB] hover:bg-[#F3F4F6] text-[#1F2937] border border-[#E5E7EB] rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <TrendingUp className="w-3.5 h-3.5 text-[#065F46]" />
              <span>Record Income</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenTransfer()}
              className="px-4 py-2.5 bg-[#F9FAFB] hover:bg-[#F3F4F6] text-[#1F2937] border border-[#E5E7EB] rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-[#4B5563]" />
              <span>Transfer</span>
            </button>
          </div>
        </div>

        {/* Unallocated Funds Callout */}
        {summary.unallocatedPaise > 0 && (
          <div className="mt-6 p-4 bg-[#FAF7F2] rounded-2xl border border-[#EFE8DC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#F5EEDF] text-[#854D0E] shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#713F12]">
                  Unallocated Money: {formatINR(summary.unallocatedPaise)}
                </p>
                <p className="text-[11px] text-[#854D0E]">
                  You have unassigned income. Allocate it across your accounts to keep balances accurate.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenAllocate}
              className="px-3.5 py-1.5 bg-[#B45309] hover:bg-[#92400E] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer self-start sm:self-auto shrink-0"
            >
              Allocate Now
            </button>
          </div>
        )}
      </div>

      {/* 2. College Petrol Account Spotlight (Special Emphasis) */}
      {petrolAccount && (
        <div className="bg-[#FAF7F2] rounded-3xl border border-[#EFE8DC] p-6 shadow-xs relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-3 flex-1">
              {/* Header Badge */}
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#B45309] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Fuel className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[#111318]">
                      College Petrol Account
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F5EEDF] text-[#854D0E] uppercase">
                      Dedicated Commute Budget
                    </span>
                  </div>
                  <p className="text-xs text-[#713F12]">
                    Available in account:{' '}
                    <strong className="text-[#111318] tabular-nums font-bold">
                      {formatINR(petrolAccount.balance_paise)}
                    </strong>{' '}
                    • {resetInfo.resetDateLabel} ({resetInfo.daysRemaining} days left)
                  </p>
                </div>
              </div>

              {/* 4 Quantitative Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                <div className="bg-white/90 p-3 rounded-xl border border-[#EFE8DC]">
                  <span className="text-[10px] uppercase font-bold text-[#854D0E]">Monthly Budget</span>
                  <p className="text-sm font-extrabold text-[#111318] tabular-nums mt-0.5">
                    {petrolBudget ? formatINR(petrolBudget.amount_paise) : '₹2,000.00'}
                  </p>
                </div>

                <div className="bg-white/90 p-3 rounded-xl border border-[#EFE8DC]">
                  <span className="text-[10px] uppercase font-bold text-[#854D0E]">Spent This Month</span>
                  <p className="text-sm font-extrabold text-[#854D0E] tabular-nums mt-0.5">
                    {formatINR(petrolOverview.spentPaise)}
                  </p>
                </div>

                <div className="bg-white/90 p-3 rounded-xl border border-[#EFE8DC]">
                  <span className="text-[10px] uppercase font-bold text-[#854D0E]">Remaining Budget</span>
                  <p
                    className={`text-sm font-extrabold tabular-nums mt-0.5 ${
                      petrolBudget?.is_exceeded ? 'text-[#DC2626]' : 'text-[#065F46]'
                    }`}
                  >
                    {petrolBudget
                      ? petrolBudget.is_exceeded
                        ? `-${formatINR(petrolBudget.exceeded_by_paise || 0)}`
                        : formatINR(petrolBudget.remaining_paise || 0)
                      : '₹2,000.00'}
                  </p>
                </div>

                <div className="bg-white/90 p-3 rounded-xl border border-[#EFE8DC]">
                  <span className="text-[10px] uppercase font-bold text-[#854D0E]">Budget Used</span>
                  <p
                    className={`text-sm font-extrabold tabular-nums mt-0.5 ${
                      (petrolBudget?.percentage || 0) > 100
                        ? 'text-[#DC2626]'
                        : (petrolBudget?.percentage || 0) >= 80
                        ? 'text-[#D97706]'
                        : 'text-[#065F46]'
                    }`}
                  >
                    {petrolBudget?.percentage ?? 0}%
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions for Petrol */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onOpenExpense(petrolAccount.id)}
                className="px-4 py-2 bg-[#B45309] hover:bg-[#92400E] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Record Petrol Refuel</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenTransfer(undefined, petrolAccount.id)}
                className="px-4 py-2 bg-white text-[#713F12] border border-[#EFE8DC] hover:bg-[#FDFBF7] text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-[#B45309]" />
                <span>Add Extra Funds</span>
              </button>
            </div>
          </div>

          {/* Progress Bar & Warning */}
          <div className="mt-4 pt-3 border-t border-[#EFE8DC]">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-[#854D0E] font-medium text-[11px]">
                Budget Pace: {formatINR(petrolOverview.spentPaise)} of {formatINR(petrolBudget?.amount_paise || 200000)}
              </span>
              {petrolBudget?.is_exceeded && (
                <span className="text-[#DC2626] font-bold text-[11px] flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Budget Exceeded by {formatINR(petrolBudget.exceeded_by_paise || 0)}
                </span>
              )}
            </div>
            <div className="w-full bg-[#EADDCE] h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  petrolBudget?.is_exceeded
                    ? 'bg-[#DC2626]'
                    : (petrolBudget?.percentage || 0) >= 80
                    ? 'bg-[#D97706]'
                    : 'bg-[#059669]'
                }`}
                style={{ width: `${Math.min(petrolBudget?.percentage || 0, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. Account Cards Overview (Personal Spending, Savings, Custom) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">
            Account Balances & Limits
          </h3>
          <button
            type="button"
            onClick={() => onSelectTab('accounts')}
            className="text-xs font-semibold text-[#065F46] hover:text-[#047857] flex items-center gap-1 cursor-pointer"
          >
            <span>Manage accounts</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {otherAccounts.map(acc => {
            const isSavings = acc.type === 'savings';
            const spent = acc.monthly_spent_paise || 0;
            const budget = acc.budget;

            return (
              <div
                key={acc.id}
                className="bg-white rounded-2xl border border-[#EAEBED] p-5 shadow-xs hover:border-[#D1D5DB] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                        style={{ backgroundColor: acc.color }}
                      >
                        <CategoryIcon name={acc.icon} className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#111318]">{acc.name}</h4>
                        <span className="text-[10px] font-semibold text-[#6B7280]">
                          {isSavings ? 'Untouchable Reserve' : 'Everyday Expenses'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-[#6B7280] block">Balance</span>
                      <p className="text-base font-extrabold text-[#111318] tabular-nums">
                        {formatINR(acc.balance_paise)}
                      </p>
                    </div>
                  </div>

                  {/* Budget info if applicable */}
                  {budget ? (
                    <div className="mt-4 pt-3 border-t border-[#F0F1F3] space-y-1">
                      <div className="flex justify-between text-[11px] text-[#6B7280]">
                        <span>Spent: {formatINR(spent)}</span>
                        <span>Cap: {formatINR(budget.amount_paise)}</span>
                      </div>
                      <div className="w-full bg-[#E5E7EB] h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            budget.is_exceeded ? 'bg-rose-500' : 'bg-[#065F46]'
                          }`}
                          style={{ width: `${Math.min(budget.percentage || 0, 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 pt-3 border-t border-[#F0F1F3] flex justify-between items-center text-[11px] text-[#6B7280]">
                      <span>Spent this month:</span>
                      <strong className="text-[#111318] tabular-nums">{formatINR(spent)}</strong>
                    </div>
                  )}
                </div>

                {/* Account Actions */}
                <div className="mt-4 pt-3 border-t border-[#F0F1F3] flex items-center justify-between gap-2">
                  {!isSavings ? (
                    <button
                      type="button"
                      onClick={() => onOpenExpense(acc.id)}
                      className="flex-1 py-1 px-2 rounded-lg bg-[#F9FAFB] hover:bg-[#F3F4F6] text-xs font-semibold text-[#1F2937] text-center border border-[#E5E7EB] cursor-pointer"
                    >
                      + Spend
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpenTransfer(undefined, acc.id)}
                      className="flex-1 py-1 px-2 rounded-lg bg-[#ECFDF5] hover:bg-[#D1FAE5] text-xs font-semibold text-[#065F46] text-center border border-[#A7F3D0] cursor-pointer"
                    >
                      + Deposit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenTransfer(acc.id)}
                    className="py-1 px-2.5 rounded-lg bg-[#F9FAFB] hover:bg-[#F3F4F6] text-xs font-medium text-[#4B5563] border border-[#E5E7EB] cursor-pointer flex items-center gap-1"
                  >
                    <ArrowRightLeft className="w-3 h-3 text-[#6B7280]" />
                    <span>Transfer</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Two-Column Layout: Activity Feed & Monthly Spending Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Recent Activity Feed (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-[#EAEBED] p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#111318]">Recent Activity</h3>
              <p className="text-xs text-[#6B7280]">Chronological activity feed</p>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab('activity')}
              className="text-xs font-semibold text-[#065F46] hover:text-[#047857] flex items-center gap-1 cursor-pointer"
            >
              <span>View all activity</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="p-8 text-center bg-[#F9FAFB] rounded-2xl border border-[#E5E7EB] space-y-2">
              <p className="text-xs font-bold text-[#111318]">No activity recorded yet</p>
              <p className="text-xs text-[#6B7280]">Record an expense or income to begin building your ledger.</p>
              <div className="flex justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => onOpenExpense()}
                  className="px-3 py-1.5 bg-[#065F46] text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Record Expense
                </button>
                <button
                  type="button"
                  onClick={onOpenIncome}
                  className="px-3 py-1.5 bg-white border border-[#D1D5DB] text-[#374151] rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Record Income
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedActivity.map(group => (
                <div key={group.rawDate} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#6B7280] uppercase tracking-wider px-1">
                    <span>{group.dateLabel}</span>
                  </div>

                  <div className="divide-y divide-[#F0F1F3] bg-[#FDFEFE] rounded-2xl border border-[#EAEBED] overflow-hidden">
                    {group.transactions.map(tx => {
                      const isExpense = tx.type === 'expense';
                      const isIncome = tx.type === 'income_allocation';
                      const isTransfer = tx.type === 'transfer_out' || tx.type === 'transfer_in';

                      return (
                        <div
                          key={tx.id}
                          onClick={() => onEditTransaction(tx)}
                          className="p-3.5 flex items-center justify-between gap-3 hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-[#F3F4F6] flex items-center justify-center shrink-0">
                              <CategoryIcon
                                name={tx.category_icon || 'Tag'}
                                className="w-4 h-4"
                                color={tx.category_color}
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#111318] truncate">
                                {tx.description}
                              </p>
                              <div className="flex items-center gap-2 text-[11px] text-[#6B7280] mt-0.5">
                                <span>{tx.account_name}</span>
                                {tx.merchant && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate">{tx.merchant}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <p
                              className={`text-xs sm:text-sm font-extrabold tabular-nums ${
                                isExpense
                                  ? 'text-[#111318]'
                                  : isIncome
                                  ? 'text-[#065F46]'
                                  : 'text-[#4B5563]'
                              }`}
                            >
                              {isExpense ? '-' : isIncome ? '+' : ''}
                              {formatINR(tx.amount_paise)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Category Spending & Cash Flow Insights (1 Col) */}
        <div className="space-y-6">
          {/* Category Breakdown Card */}
          <div className="bg-white rounded-3xl border border-[#EAEBED] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#111318]">Monthly Spending by Category</h3>
                <p className="text-xs text-[#6B7280]">{monthName}</p>
              </div>
              <button
                type="button"
                onClick={() => onSelectTab('insights')}
                className="text-xs font-semibold text-[#065F46] hover:text-[#047857] cursor-pointer"
              >
                Insights
              </button>
            </div>

            {categoryBreakdown.length === 0 ? (
              <p className="text-xs text-[#9CA3AF] text-center py-6">
                No categorized spending recorded this month.
              </p>
            ) : (
              <div className="space-y-3">
                {categoryBreakdown.slice(0, 5).map(cat => {
                  const totalSpent = summary.monthlyExpensePaise || 1;
                  const pct = Math.round((cat.total_paise / totalSpent) * 100);

                  return (
                    <div key={cat.id} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-[#374151] flex items-center gap-1.5">
                          <CategoryIcon name={cat.icon} className="w-3.5 h-3.5" color={cat.color} />
                          {cat.name}
                        </span>
                        <span className="font-bold tabular-nums text-[#111318]">
                          {formatINR(cat.total_paise)}{' '}
                          <span className="text-[10px] text-[#9CA3AF] font-normal">({pct}%)</span>
                        </span>
                      </div>
                      <div className="w-full bg-[#E5E7EB] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: cat.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cash Flow Summary */}
          <div className="bg-white rounded-3xl border border-[#EAEBED] p-6 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">
              Monthly Flow Summary
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[#6B7280]">Total Inflow:</span>
                <span className="font-bold text-[#065F46] tabular-nums">
                  +{formatINR(summary.monthlyIncomePaise)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#6B7280]">Total Outflow:</span>
                <span className="font-bold text-rose-600 tabular-nums">
                  -{formatINR(summary.monthlyExpensePaise)}
                </span>
              </div>
              <div className="pt-2 border-t border-[#F0F1F3] flex justify-between items-center">
                <span className="font-semibold text-[#111318]">Net Retained Cash:</span>
                <span
                  className={`font-black tabular-nums ${
                    summary.monthlyIncomePaise >= summary.monthlyExpensePaise
                      ? 'text-[#065F46]'
                      : 'text-rose-600'
                  }`}
                >
                  {formatINR(summary.monthlyIncomePaise - summary.monthlyExpensePaise)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
