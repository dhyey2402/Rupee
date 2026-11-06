import React from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Fuel,
  ShoppingBag,
  Building2,
  Banknote,
  ArrowRight,
  Plus,
  ArrowRightLeft,
  Calendar,
  Layers,
  ChevronRight,
  Clock,
  CheckCircle2,
  Sparkles,
  Bot,
  Mic,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { BootstrapData, Account, Transaction } from '../types';
import { formatINR, splitINR, formatRelativeDate, formatDate, groupTransactionsByDate } from '../utils/format';
import { CategoryIcon } from '../components/CategoryIcon';

interface DashboardViewProps {
  data: BootstrapData;
  onOpenExpense: (accountId?: string) => void;
  onOpenIncome: () => void;
  onOpenTransfer: (fromId?: string, toId?: string) => void;
  onOpenAllocate: () => void;
  onOpenAddMoney: (account: Account, defaultMode?: 'add' | 'set') => void;
  onOpenCloseAllocation: (account: Account) => void;
  onSelectTab: (tab: any) => void;
  onEditTransaction: (tx: Transaction) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  data,
  onOpenExpense,
  onOpenIncome,
  onOpenTransfer,
  onOpenAllocate,
  onOpenAddMoney,
  onOpenCloseAllocation,
  onSelectTab,
  onEditTransaction,
}) => {
  const { summary, accounts, recentTransactions, categoryBreakdown, petrolOverview } = data;

  // Primary Financial Accounts: Bank Account, Personal Spending, Cash
  const bankAccount = accounts.find(a => a.type === 'bank');
  const spendingAccount = accounts.find(a => a.type === 'spending');
  const cashAccount = accounts.find(a => a.type === 'cash');
  const customAccounts = accounts.filter(
    a => a.type !== 'bank' && a.type !== 'spending' && a.type !== 'cash' && a.type !== 'petrol' && a.type !== 'savings' && a.type !== 'archived_savings'
  );

  const [y, m] = data.month.split('-').map(Number);
  const monthName = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const totalSplit = splitINR(summary.totalMoneyPaise);
  const groupedActivity = groupTransactionsByDate(recentTransactions.slice(0, 8));

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* 1. Hero Financial Command Center */}
      <div className="bg-white rounded-3xl border border-[#EAEBED] p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          {/* Main Total Balance Presentation */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#6B7280]">
              <span>Total Money Across All Accounts</span>
              <span className="text-[#D1D5DB]">•</span>
              <span>{monthName}</span>
            </div>

            {/* Numeric Display */}
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

            {/* Clean Account Breakdown Badges */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[#4B5563] pt-1">
              <span>
                Bank Account:{' '}
                <strong className="text-[#0284c7] tabular-nums font-bold">
                  {formatINR(bankAccount ? bankAccount.balance_paise : summary.availableBankPaise || 0)}
                </strong>
              </span>
              <span className="text-[#D1D5DB]">•</span>
              <span>
                Personal Spending:{' '}
                <strong className="text-[#065F46] tabular-nums font-bold">
                  {formatINR(spendingAccount ? spendingAccount.balance_paise : summary.availableSpendingPaise)}
                </strong>
              </span>
              <span className="text-[#D1D5DB]">•</span>
              <span>
                Cash:{' '}
                <strong className="text-[#059669] tabular-nums font-bold">
                  {formatINR(cashAccount ? cashAccount.balance_paise : summary.availableCashPaise || 0)}
                </strong>
              </span>
              <span className="text-[#D1D5DB]">•</span>
              <span>
                Total Saved:{' '}
                <strong className="text-[#111318] tabular-nums font-bold">
                  {formatINR(summary.totalSavingsPaise)}
                </strong>
              </span>
              {summary.unallocatedPaise > 0 && (
                <>
                  <span className="text-[#D1D5DB]">•</span>
                  <span>
                    Unallocated Income:{' '}
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

        {/* Unallocated Funds Banner if any */}
        {summary.unallocatedPaise > 0 && (
          <div className="mt-6 p-4 bg-[#FAF7F2] rounded-2xl border border-[#EFE8DC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#F5EEDF] text-[#854D0E] shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#713F12]">
                  Unallocated Income: {formatINR(summary.unallocatedPaise)}
                </p>
                <p className="text-[11px] text-[#854D0E]">
                  You have unassigned income. Allocate it directly to Bank Account, Personal Spending, or Cash.
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

      {/* 2. Primary Financial Accounts: Bank Account, Personal Spending & Cash */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bank Account Spotlight */}
        {bankAccount && (
          <div className="bg-[#F0F9FF] rounded-3xl border border-[#BAE6FD] p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-[#0284C7] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#111318]">
                      Bank Account
                    </h3>
                    <span className="text-[10px] font-semibold text-[#0369A1]">
                      Actual bank account balance
                    </span>
                  </div>
                </div>

                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#E0F2FE] text-[#0369A1] uppercase">
                  Bank
                </span>
              </div>

              {/* Exact 3 Financial Metrics */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="bg-white/95 p-3 rounded-xl border border-[#BAE6FD]">
                  <span className="text-[9px] uppercase font-bold text-[#0369A1] block truncate">Current Balance</span>
                  <p className="text-sm sm:text-base font-black text-[#111318] tabular-nums mt-0.5">
                    {formatINR(bankAccount.balance_paise)}
                  </p>
                </div>

                <div className="bg-white/95 p-3 rounded-xl border border-[#BAE6FD]">
                  <span className="text-[9px] uppercase font-bold text-[#0369A1] block truncate">Spent This Month</span>
                  <p className="text-sm sm:text-base font-extrabold text-[#0284C7] tabular-nums mt-0.5">
                    {formatINR(bankAccount.monthly_spent_paise || 0)}
                  </p>
                </div>

                <div className="bg-white/95 p-3 rounded-xl border border-[#BAE6FD]">
                  <span className="text-[9px] uppercase font-bold text-[#0369A1] block truncate">Available Money</span>
                  <p className="text-sm sm:text-base font-black text-[#065F46] tabular-nums mt-0.5">
                    {formatINR(bankAccount.balance_paise)}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions for Bank Account */}
            <div className="pt-2 border-t border-[#BAE6FD] flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => onOpenExpense(bankAccount.id)}
                className="px-3 py-1.5 bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Expense</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenAddMoney(bankAccount, 'add')}
                className="px-2.5 py-1.5 bg-white text-[#0369A1] border border-[#BAE6FD] hover:bg-[#F0F9FF] text-xs font-semibold rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#0284C7]" />
                <span>Add Money</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenAddMoney(bankAccount, 'set')}
                className="px-2.5 py-1.5 bg-white text-[#0369A1] border border-[#BAE6FD] hover:bg-[#F0F9FF] text-xs font-semibold rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                title="Set actual bank balance"
              >
                <span>Set Balance</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenTransfer(bankAccount.id)}
                className="px-2.5 py-1.5 bg-white text-[#0369A1] border border-[#BAE6FD] hover:bg-[#F0F9FF] text-xs font-semibold rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-[#0284C7]" />
                <span>Transfer</span>
              </button>
            </div>
          </div>
        )}

        {/* Personal Spending Account Spotlight */}
        {spendingAccount && (
          <div className="bg-[#FAF7F2] rounded-3xl border border-[#EFE8DC] p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-[#065F46] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#111318]">
                      Personal Spending
                    </h3>
                    <span className="text-[10px] font-semibold text-[#854D0E]">
                      Food, shopping & personal expenses
                    </span>
                  </div>
                </div>

                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#F5EEDF] text-[#854D0E] uppercase">
                  Spending
                </span>
              </div>

              {/* Exact 3 Financial Metrics */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="bg-white/95 p-3 rounded-xl border border-[#EFE8DC]">
                  <span className="text-[9px] uppercase font-bold text-[#854D0E] block truncate">Current Balance</span>
                  <p className="text-sm sm:text-base font-black text-[#111318] tabular-nums mt-0.5">
                    {formatINR(spendingAccount.balance_paise)}
                  </p>
                </div>

                <div className="bg-white/95 p-3 rounded-xl border border-[#EFE8DC]">
                  <span className="text-[9px] uppercase font-bold text-[#854D0E] block truncate">Spent This Month</span>
                  <p className="text-sm sm:text-base font-extrabold text-[#B45309] tabular-nums mt-0.5">
                    {formatINR(spendingAccount.monthly_spent_paise || 0)}
                  </p>
                </div>

                <div className="bg-white/95 p-3 rounded-xl border border-[#EFE8DC]">
                  <span className="text-[9px] uppercase font-bold text-[#854D0E] block truncate">Available Money</span>
                  <p className="text-sm sm:text-base font-black text-[#065F46] tabular-nums mt-0.5">
                    {formatINR(spendingAccount.balance_paise)}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions for Personal Spending */}
            <div className="pt-2 border-t border-[#EFE8DC] flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => onOpenExpense(spendingAccount.id)}
                className="px-3 py-1.5 bg-[#065F46] hover:bg-[#047857] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Expense</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenAddMoney(spendingAccount, 'add')}
                className="px-2.5 py-1.5 bg-white text-[#713F12] border border-[#EFE8DC] hover:bg-[#FDFBF7] text-xs font-semibold rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#065F46]" />
                <span>Add Money</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenAddMoney(spendingAccount, 'set')}
                className="px-2.5 py-1.5 bg-white text-[#713F12] border border-[#EFE8DC] hover:bg-[#FDFBF7] text-xs font-semibold rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                title="Set current balance"
              >
                <span>Set Balance</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenTransfer(spendingAccount.id)}
                className="px-2.5 py-1.5 bg-white text-[#713F12] border border-[#EFE8DC] hover:bg-[#FDFBF7] text-xs font-semibold rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-[#065F46]" />
                <span>Transfer</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenCloseAllocation(spendingAccount)}
                className="px-2.5 py-1.5 bg-[#F5EEDF] hover:bg-[#EADDCE] text-[#854D0E] text-xs font-bold rounded-xl transition-colors flex items-center gap-1 cursor-pointer ml-auto"
                title="Close allocation and automatically save remaining unused money"
              >
                <PiggyBank className="w-3.5 h-3.5 text-[#854D0E]" />
                <span>Close</span>
              </button>
            </div>
          </div>
        )}

        {/* Cash Account Spotlight */}
        {cashAccount && (
          <div className="bg-[#ECFDF5] rounded-3xl border border-[#A7F3D0] p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-[#059669] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#111318]">
                      Cash
                    </h3>
                    <span className="text-[10px] font-semibold text-[#047857]">
                      Physical cash in hand
                    </span>
                  </div>
                </div>

                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white text-[#047857] border border-[#A7F3D0] uppercase">
                  Cash
                </span>
              </div>

              {/* Exact 3 Financial Metrics */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="bg-white/95 p-3 rounded-xl border border-[#A7F3D0]">
                  <span className="text-[9px] uppercase font-bold text-[#047857] block truncate">Current Balance</span>
                  <p className="text-sm sm:text-base font-black text-[#111318] tabular-nums mt-0.5">
                    {formatINR(cashAccount.balance_paise)}
                  </p>
                </div>

                <div className="bg-white/95 p-3 rounded-xl border border-[#A7F3D0]">
                  <span className="text-[9px] uppercase font-bold text-[#047857] block truncate">Spent This Month</span>
                  <p className="text-sm sm:text-base font-extrabold text-[#059669] tabular-nums mt-0.5">
                    {formatINR(cashAccount.monthly_spent_paise || 0)}
                  </p>
                </div>

                <div className="bg-white/95 p-3 rounded-xl border border-[#A7F3D0]">
                  <span className="text-[9px] uppercase font-bold text-[#047857] block truncate">Available Money</span>
                  <p className="text-sm sm:text-base font-black text-[#065F46] tabular-nums mt-0.5">
                    {formatINR(cashAccount.balance_paise)}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions for Cash */}
            <div className="pt-2 border-t border-[#A7F3D0] flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => onOpenExpense(cashAccount.id)}
                className="px-3 py-1.5 bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Expense</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenAddMoney(cashAccount, 'add')}
                className="px-2.5 py-1.5 bg-white text-[#047857] border border-[#A7F3D0] hover:bg-[#F0FDF4] text-xs font-semibold rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#059669]" />
                <span>Add Cash</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenAddMoney(cashAccount, 'set')}
                className="px-2.5 py-1.5 bg-white text-[#047857] border border-[#A7F3D0] hover:bg-[#F0FDF4] text-xs font-semibold rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                title="Set current cash on hand"
              >
                <span>Set Balance</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenTransfer(cashAccount.id)}
                className="px-2.5 py-1.5 bg-white text-[#047857] border border-[#A7F3D0] hover:bg-[#F0FDF4] text-xs font-semibold rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-[#059669]" />
                <span>Transfer</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Dedicated Savings Reference Strip */}
      <div className="bg-gradient-to-r from-[#ECFDF5] to-[#F0FDF4] rounded-3xl border border-[#A7F3D0] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#065F46] text-white flex items-center justify-center shrink-0 shadow-xs">
            <PiggyBank className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#111318]">Total Money Saved</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#065F46] border border-[#A7F3D0] uppercase">
                Reference Section
              </span>
            </div>
            <p className="text-xs text-[#065F46] mt-0.5">
              Accumulated from closed College Petrol and Personal Spending allocations. Not a financial account.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 self-end sm:self-auto">
          <div className="text-right">
            <span className="text-[10px] font-semibold text-[#065F46] uppercase block">Total Saved</span>
            <p className="text-2xl font-black text-[#065F46] tabular-nums">
              {formatINR(summary.totalSavingsPaise)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSelectTab('savings')}
            className="px-4 py-2 bg-[#065F46] hover:bg-[#047857] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>View Savings</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3.5. Any Custom Accounts if present */}
      {customAccounts.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-3">
            Custom Accounts
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {customAccounts.map(acc => (
              <div
                key={acc.id}
                className="bg-white rounded-2xl border border-[#EAEBED] p-5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: acc.color }}
                      >
                        <CategoryIcon name={acc.icon} className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#111318]">{acc.name}</h4>
                        <span className="text-[10px] text-[#6B7280]">Custom Account</span>
                      </div>
                    </div>
                    <p className="text-base font-extrabold text-[#111318] tabular-nums">
                      {formatINR(acc.balance_paise)}
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-[#F0F1F3] flex justify-between text-xs text-[#6B7280]">
                    <span>Spent this month:</span>
                    <strong className="text-[#111318] tabular-nums">
                      {formatINR(acc.monthly_spent_paise || 0)}
                    </strong>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#F0F1F3] flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenExpense(acc.id)}
                    className="flex-1 py-1 px-2 rounded-lg bg-[#F9FAFB] hover:bg-[#F3F4F6] text-xs font-semibold text-[#1F2937] text-center border border-[#E5E7EB] cursor-pointer"
                  >
                    + Spend
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenAddMoney(acc, 'add')}
                    className="flex-1 py-1 px-2 rounded-lg bg-[#F9FAFB] hover:bg-[#F3F4F6] text-xs font-semibold text-[#1F2937] text-center border border-[#E5E7EB] cursor-pointer"
                  >
                    + Add Money
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenTransfer(acc.id)}
                    className="py-1 px-2.5 rounded-lg bg-[#F9FAFB] hover:bg-[#F3F4F6] text-xs font-medium text-[#4B5563] border border-[#E5E7EB] cursor-pointer"
                  >
                    Transfer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. AI Voice & Chat Advisor Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#065F46] to-emerald-900 rounded-3xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
        <div className="space-y-1.5 relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-white/20 text-white uppercase tracking-wider">
              Gemini AI Financial Companion
            </span>
            <span className="text-xs text-emerald-200">
              Personalized money guidance & live voice
            </span>
          </div>
          <h3 className="text-base font-bold text-white">
            Personal Finance Voice Assistant & AI Advisor
          </h3>
          <p className="text-xs text-emerald-100/80 max-w-xl">
            Real-time awareness of your College Petrol account, Personal Spending, and closed allocation savings.
          </p>
        </div>

        <div className="flex items-center gap-2.5 relative z-10 shrink-0">
          <button
            type="button"
            onClick={() => onSelectTab('advisor')}
            className="px-4 py-2.5 bg-white text-[#065F46] hover:bg-emerald-50 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <Mic className="w-4 h-4 text-[#B45309]" />
            <span>Start Live Voice</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('advisor')}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Bot className="w-4 h-4" />
            <span>Open Chatbot</span>
          </button>
        </div>
      </div>

      {/* 5. Two-Column Layout: Activity Feed & Monthly Spending Breakdown */}
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
              <p className="text-xs text-[#6B7280]">Record an expense or add funds to begin building your ledger.</p>
              <div className="flex justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => onOpenExpense()}
                  className="px-3.5 py-1.5 bg-[#065F46] text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Record Expense
                </button>
                <button
                  type="button"
                  onClick={onOpenIncome}
                  className="px-3.5 py-1.5 bg-white border border-[#D1D5DB] text-[#374151] rounded-lg text-xs font-semibold cursor-pointer"
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
                      const isSavingsSweep = tx.type === 'savings_sweep';
                      const isDeposit = tx.type === 'direct_deposit';

                      return (
                        <div
                          key={tx.id}
                          onClick={() => onEditTransaction(tx)}
                          className="p-3.5 flex items-center justify-between gap-3 hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-[#F3F4F6] flex items-center justify-center shrink-0">
                              {isSavingsSweep ? (
                                <PiggyBank className="w-4 h-4 text-[#065F46]" />
                              ) : isDeposit ? (
                                <Plus className="w-4 h-4 text-[#065F46]" />
                              ) : (
                                <CategoryIcon
                                  name={tx.category_icon || 'Tag'}
                                  className="w-4 h-4"
                                  color={tx.category_color}
                                />
                              )}
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
                                  : isSavingsSweep
                                  ? 'text-[#065F46]'
                                  : isIncome || isDeposit
                                  ? 'text-[#065F46]'
                                  : 'text-[#4B5563]'
                              }`}
                            >
                              {isExpense ? '-' : isIncome || isDeposit ? '+' : ''}
                              {formatINR(tx.amount_paise)}
                            </p>
                            {isSavingsSweep && (
                              <span className="text-[10px] font-semibold text-[#065F46] block">
                                Swept to Savings
                              </span>
                            )}
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

        {/* Right: Monthly Category Spending & Cash Flow Insights (1 Col) */}
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
              Monthly Cash Flow
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
