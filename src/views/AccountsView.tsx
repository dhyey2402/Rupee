import React, { useState } from 'react';
import {
  Wallet,
  Plus,
  ArrowRightLeft,
  Edit2,
  Trash2,
  AlertCircle,
  PiggyBank,
  Fuel,
  ShoppingBag,
  TrendingUp,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { Account, Transaction } from '../types';
import { formatINR, formatDate } from '../utils/format';
import { CategoryIcon } from '../components/CategoryIcon';

interface AccountsViewProps {
  accounts: Account[];
  onOpenCreateAccount: () => void;
  onOpenEditAccount: (acc: Account) => void;
  onOpenTransfer: (fromId?: string, toId?: string) => void;
  onOpenExpense: (accountId?: string) => void;
  onDeleteAccount: (acc: Account) => void;
  onSelectTab: (tab: any) => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  accounts,
  onOpenCreateAccount,
  onOpenEditAccount,
  onOpenTransfer,
  onOpenExpense,
  onDeleteAccount,
  onSelectTab,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id || '');
  const [accountHistory, setAccountHistory] = useState<Transaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const activeAccount = accounts.find(a => a.id === selectedAccountId) || accounts[0];

  React.useEffect(() => {
    if (activeAccount) {
      setLoadingHistory(true);
      fetch(`/api/transactions?accountId=${activeAccount.id}&limit=50`)
        .then(res => res.json())
        .then(data => {
          setAccountHistory(data);
          setLoadingHistory(false);
        })
        .catch(() => setLoadingHistory(false));
    }
  }, [activeAccount?.id]);

  const totalBalancePaise = accounts.reduce((acc, a) => acc + a.balance_paise, 0);
  const savingsPaise = accounts
    .filter(a => a.type === 'savings')
    .reduce((acc, a) => acc + a.balance_paise, 0);
  const spendingPaise = totalBalancePaise - savingsPaise;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#111318] tracking-tight">
            Account Management
          </h2>
          <p className="text-xs sm:text-sm text-[#6B7280]">
            Independent financial stores with isolated balances and dedicated monthly caps
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenTransfer()}
            className="px-4 py-2 bg-white hover:bg-[#F9FAFB] text-[#374151] border border-[#E5E7EB] rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-[#065F46]" />
            <span>Transfer Funds</span>
          </button>
          <button
            type="button"
            onClick={onOpenCreateAccount}
            className="px-4 py-2 bg-[#065F46] hover:bg-[#047857] text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New Account</span>
          </button>
        </div>
      </div>

      {/* Aggregate Balance Callout Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white p-5 rounded-2xl border border-[#EAEBED] shadow-xs">
          <span className="text-xs font-semibold text-[#6B7280]">Combined Account Balance</span>
          <p className="text-2xl font-black text-[#111318] tabular-nums mt-1">{formatINR(totalBalancePaise)}</p>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">Total across all accounts</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#EAEBED] shadow-xs">
          <span className="text-xs font-semibold text-[#6B7280]">Available for Spending</span>
          <p className="text-2xl font-black text-[#065F46] tabular-nums mt-1">{formatINR(spendingPaise)}</p>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">Excludes locked savings</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#EAEBED] shadow-xs">
          <span className="text-xs font-semibold text-[#6B7280]">Total Savings Reserve</span>
          <p className="text-2xl font-black text-[#0F766E] tabular-nums mt-1">{formatINR(savingsPaise)}</p>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">Untouchable safety net</p>
        </div>
      </div>

      {/* Account Grid & Ledger Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Account Selection Cards */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] px-1">
            Accounts
          </h3>

          <div className="space-y-2.5">
            {accounts.map(acc => {
              const isSelected = activeAccount?.id === acc.id;
              const isPetrol = acc.type === 'petrol';
              const isSavings = acc.type === 'savings';

              return (
                <div
                  key={acc.id}
                  onClick={() => setSelectedAccountId(acc.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[#065F46] bg-white ring-1 ring-[#065F46] shadow-sm'
                      : 'border-[#EAEBED] bg-white hover:border-[#D1D5DB] shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                        style={{ backgroundColor: acc.color }}
                      >
                        <CategoryIcon name={acc.icon} className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-[#111318]">{acc.name}</h4>
                        </div>
                        <p className="text-xs text-[#6B7280]">
                          {isPetrol ? 'Petrol Budget (₹2k)' : isSavings ? 'Savings Reserve' : 'Everyday Spending'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-base font-extrabold text-[#111318] tabular-nums">
                        {formatINR(acc.balance_paise)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Account Profile & Transaction Ledger */}
        {activeAccount && (
          <div className="lg:col-span-2 space-y-4">
            {/* Account Profile Card */}
            <div className="bg-white rounded-3xl border border-[#EAEBED] p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#F0F1F3]">
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xs"
                    style={{ backgroundColor: activeAccount.color }}
                  >
                    <CategoryIcon name={activeAccount.icon} className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#111318]">{activeAccount.name}</h3>
                    <p className="text-xs text-[#6B7280]">
                      Account Type: <strong className="capitalize text-[#374151]">{activeAccount.type}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenEditAccount(activeAccount)}
                    className="p-2 rounded-xl text-[#6B7280] hover:text-[#111318] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
                    title="Edit Account Name, Color, or Limit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  {!activeAccount.is_system && (
                    <button
                      type="button"
                      onClick={() => onDeleteAccount(activeAccount)}
                      className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Delete Account"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* 3 Metric Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-[#F9FAFB] p-3.5 rounded-xl border border-[#E5E7EB]">
                  <span className="text-[10px] uppercase font-bold text-[#6B7280]">Current Balance</span>
                  <p className="text-lg font-black text-[#111318] tabular-nums mt-0.5">
                    {formatINR(activeAccount.balance_paise)}
                  </p>
                </div>

                <div className="bg-[#F9FAFB] p-3.5 rounded-xl border border-[#E5E7EB]">
                  <span className="text-[10px] uppercase font-bold text-[#6B7280]">Monthly Spending Limit</span>
                  <p className="text-lg font-bold text-[#374151] tabular-nums mt-0.5">
                    {activeAccount.budget ? formatINR(activeAccount.budget.amount_paise) : 'No Limit Set'}
                  </p>
                </div>

                <div className="bg-[#F9FAFB] p-3.5 rounded-xl border border-[#E5E7EB]">
                  <span className="text-[10px] uppercase font-bold text-[#6B7280]">Spent This Month</span>
                  <p className="text-lg font-bold text-[#111318] tabular-nums mt-0.5">
                    {formatINR(activeAccount.monthly_spent_paise || 0)}
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 pt-1">
                {activeAccount.type !== 'savings' ? (
                  <button
                    type="button"
                    onClick={() => onOpenExpense(activeAccount.id)}
                    className="px-4 py-2 bg-[#065F46] hover:bg-[#047857] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    + Record Expense
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpenTransfer(undefined, activeAccount.id)}
                    className="px-4 py-2 bg-[#065F46] hover:bg-[#047857] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    + Deposit to Savings
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onOpenTransfer(activeAccount.id)}
                  className="px-4 py-2 bg-[#F9FAFB] hover:bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB] rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Transfer Money
                </button>
              </div>
            </div>

            {/* Account Ledger */}
            <div className="bg-white rounded-3xl border border-[#EAEBED] p-6 shadow-xs space-y-3">
              <h4 className="text-sm font-bold text-[#111318]">
                Recent Ledger Entries for {activeAccount.name}
              </h4>

              {loadingHistory ? (
                <p className="text-xs text-[#6B7280] text-center py-6">Loading ledger...</p>
              ) : accountHistory.length === 0 ? (
                <p className="text-xs text-[#9CA3AF] text-center py-6 bg-[#F9FAFB] rounded-xl">
                  No transactions recorded on this account yet.
                </p>
              ) : (
                <div className="divide-y divide-[#F0F1F3]">
                  {accountHistory.map(tx => {
                    const isOutflow = tx.type === 'expense' || tx.type === 'transfer_out';
                    return (
                      <div
                        key={tx.id}
                        className="py-3 flex items-center justify-between text-xs hover:bg-[#F9FAFB] px-2 rounded-lg"
                      >
                        <div className="space-y-0.5">
                          <p className="font-bold text-[#111318]">{tx.description}</p>
                          <div className="flex items-center gap-2 text-[11px] text-[#6B7280]">
                            <span>{formatDate(tx.date)}</span>
                            {tx.merchant && <span>• {tx.merchant}</span>}
                          </div>
                        </div>

                        <div className="text-right">
                          <p
                            className={`font-black tabular-nums ${
                              isOutflow ? 'text-[#111318]' : 'text-[#065F46]'
                            }`}
                          >
                            {isOutflow ? '-' : '+'}
                            {formatINR(tx.amount_paise)}
                          </p>
                          <span className="text-[10px] uppercase font-semibold text-[#9CA3AF]">
                            {tx.type.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
