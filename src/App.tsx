/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { BootstrapData, Transaction, Account, Budget, Income } from './types';
import { getCurrentMonthString } from './utils/format';
import { apiUrl } from './utils/apiConfig';
import { Sidebar, NavTab } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';

// Views
import { DashboardView } from './views/DashboardView';
import { AccountsView } from './views/AccountsView';
import { TransactionsView } from './views/TransactionsView';
import { BudgetsView } from './views/BudgetsView';
import { SavingsView } from './views/SavingsView';
import { ReportsView } from './views/ReportsView';
import { AiAdvisorView } from './views/AiAdvisorView';
import { SettingsView } from './views/SettingsView';

// Modals
import { AddExpenseModal } from './components/modals/AddExpenseModal';
import { RecordIncomeModal } from './components/modals/RecordIncomeModal';
import { TransferModal } from './components/modals/TransferModal';
import { AllocateFundsModal } from './components/modals/AllocateFundsModal';
import { EditTransactionModal } from './components/modals/EditTransactionModal';
import { AccountModal } from './components/modals/AccountModal';
import { BudgetModal } from './components/modals/BudgetModal';
import { CloseAllocationModal } from './components/modals/CloseAllocationModal';
import { AddMoneyModal } from './components/modals/AddMoneyModal';
import { OnboardingModal } from './components/modals/OnboardingModal';
import { ConfirmDeleteModal } from './components/modals/ConfirmDeleteModal';

export default function App() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active navigation & month
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthString());

  // Modal triggers
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [preselectedAccountId, setPreselectedAccountId] = useState<string | undefined>(undefined);

  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferFromId, setTransferFromId] = useState<string | undefined>(undefined);
  const [transferToId, setTransferToId] = useState<string | undefined>(undefined);

  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
  const [selectedIncomeForAlloc, setSelectedIncomeForAlloc] = useState<Income | null>(null);

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  // Close Allocation modal
  const [accountForCloseAlloc, setAccountForCloseAlloc] = useState<Account | null>(null);

  // Add Money / Set Balance modal
  const [accountForAddMoney, setAccountForAddMoney] = useState<Account | null>(null);
  const [addMoneyDefaultMode, setAddMoneyDefaultMode] = useState<'add' | 'set'>('add');

  // Confirm delete modal state
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: async () => {},
  });

  // Fetch bootstrap data
  const fetchData = useCallback(async (month?: string) => {
    try {
      const m = month || selectedMonth;
      const res = await fetch(apiUrl(`/api/bootstrap?month=${m}`));
      if (!res.ok) throw new Error('Failed to load application data');
      const json: BootstrapData = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchData(selectedMonth);
  }, [fetchData, selectedMonth]);

  const handleMonthChange = (newMonth: string) => {
    setSelectedMonth(newMonth);
  };

  // Open modals with optional preselection
  const handleOpenExpense = (accId?: string) => {
    setPreselectedAccountId(accId);
    setIsExpenseModalOpen(true);
  };

  const handleOpenTransfer = (fromId?: string, toId?: string) => {
    setTransferFromId(fromId);
    setTransferToId(toId);
    setIsTransferModalOpen(true);
  };

  const handleOpenAllocate = async () => {
    try {
      const res = await fetch(apiUrl('/api/incomes'));
      const incomes: Income[] = await res.json();
      const unallocatedInc = incomes.find(i => i.unallocated_paise > 0);
      if (unallocatedInc) {
        setSelectedIncomeForAlloc(unallocatedInc);
        setIsAllocateModalOpen(true);
      } else {
        alert('No unallocated incomes found.');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleOpenCloseAllocation = (account: Account) => {
    setAccountForCloseAlloc(account);
  };

  const handleOpenAddMoney = (account: Account, defaultMode: 'add' | 'set' = 'add') => {
    setAccountForAddMoney(account);
    setAddMoneyDefaultMode(defaultMode);
  };

  // Delete transaction handler
  const handleDeleteTransaction = (tx: Transaction) => {
    const isExpense = tx.type === 'expense';
    const isIncome = tx.type === 'income_allocation';
    const isTransfer = tx.type === 'transfer_out' || tx.type === 'transfer_in';

    let impactDesc = '';
    if (isExpense) {
      impactDesc = `Deleting this expense will refund ₹${(tx.amount_paise / 100).toFixed(2)} back into ${tx.account_name}.`;
    } else if (isIncome) {
      impactDesc = `Deleting this allocation will deduct ₹${(tx.amount_paise / 100).toFixed(2)} from ${tx.account_name} and return it to the unallocated pool.`;
    } else if (isTransfer) {
      impactDesc = `Deleting this transfer will reverse the entire transfer of ₹${(tx.amount_paise / 100).toFixed(2)} between the accounts.`;
    }

    setDeleteModalState({
      isOpen: true,
      title: 'Delete Transaction',
      message: `${impactDesc} Are you sure you want to proceed?`,
      onConfirm: async () => {
        const res = await fetch(apiUrl(`/api/transactions/${tx.id}`), { method: 'DELETE' });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to delete transaction');
        }
        await fetchData();
      },
    });
  };

  // Delete account handler
  const handleDeleteAccount = (acc: Account) => {
    if (acc.balance_paise > 0) {
      alert(`Cannot delete ${acc.name} because it still has an active balance of ₹${(acc.balance_paise / 100).toFixed(2)}. Please transfer the money first.`);
      return;
    }

    setDeleteModalState({
      isOpen: true,
      title: `Delete Account: ${acc.name}`,
      message: `Are you sure you want to delete "${acc.name}"? This action cannot be undone.`,
      onConfirm: async () => {
        const res = await fetch(apiUrl(`/api/accounts/${acc.id}`), { method: 'DELETE' });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to delete account');
        }
        await fetchData();
      },
    });
  };

  // Delete budget handler
  const handleDeleteBudget = (budget: Budget) => {
    setDeleteModalState({
      isOpen: true,
      title: `Delete Budget: ${budget.name}`,
      message: `Are you sure you want to remove the budget cap for "${budget.name}"?`,
      onConfirm: async () => {
        const res = await fetch(apiUrl(`/api/budgets/${budget.id}`), { method: 'DELETE' });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to delete budget');
        }
        await fetchData();
      },
    });
  };

  // Load student demo scenario
  const handleLoadDemo = async () => {
    const res = await fetch(apiUrl('/api/demo/seed'), { method: 'POST' });
    if (!res.ok) throw new Error('Failed to load demo scenario');
    await fetchData();
  };

  // Clean factory reset
  const handleResetApp = async () => {
    const res = await fetch(apiUrl('/api/reset'), { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reset app');
    await fetchData();
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-[#065F46] text-white flex items-center justify-center font-mono font-bold text-xl shadow-md animate-pulse mb-3">
          ₹
        </div>
        <p className="text-sm font-bold text-[#111318]">Rupee.</p>
        <p className="text-xs text-[#717680] mt-1 font-mono">Loading financial accounts...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-lg border border-rose-200 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-[#DC2626] flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h2 className="text-base font-bold text-[#111318]">Unable to Connect</h2>
          <p className="text-xs text-[#717680]">{error}</p>
          <button
            onClick={() => fetchData()}
            className="px-5 py-2.5 bg-[#065F46] text-white text-xs font-bold rounded-xl shadow-xs hover:bg-[#047857] transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#111318] flex flex-col lg:flex-row font-sans selection:bg-[#065F46] selection:text-white">
      {/* Desktop Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        selectedMonth={selectedMonth}
        onMonthChange={handleMonthChange}
        onOpenExpense={() => handleOpenExpense()}
        onOpenIncome={() => setIsIncomeModalOpen(true)}
        onOpenTransfer={() => handleOpenTransfer()}
        bankAvailablePaise={data?.summary?.availableBankPaise ?? 0}
        spendingAvailablePaise={data?.summary?.availableSpendingPaise ?? 0}
        cashAvailablePaise={data?.summary?.availableCashPaise ?? 0}
        totalSavedPaise={data?.summary?.totalSavingsPaise ?? 0}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header & Bottom Navigation */}
        <MobileNav
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          selectedMonth={selectedMonth}
          onMonthChange={handleMonthChange}
          onOpenExpense={() => handleOpenExpense()}
        />

        {/* View Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
          {data && (
            <>
              {activeTab === 'overview' && (
                <DashboardView
                  data={data}
                  onOpenExpense={handleOpenExpense}
                  onOpenIncome={() => setIsIncomeModalOpen(true)}
                  onOpenTransfer={handleOpenTransfer}
                  onOpenAllocate={handleOpenAllocate}
                  onOpenAddMoney={handleOpenAddMoney}
                  onOpenCloseAllocation={handleOpenCloseAllocation}
                  onSelectTab={setActiveTab}
                  onEditTransaction={setEditingTransaction}
                />
              )}

              {activeTab === 'accounts' && (
                <AccountsView
                  accounts={data.accounts}
                  onOpenCreateAccount={() => {
                    setEditingAccount(null);
                    setIsAccountModalOpen(true);
                  }}
                  onOpenEditAccount={acc => {
                    setEditingAccount(acc);
                    setIsAccountModalOpen(true);
                  }}
                  onOpenTransfer={handleOpenTransfer}
                  onOpenExpense={handleOpenExpense}
                  onOpenAddMoney={handleOpenAddMoney}
                  onOpenCloseAllocation={handleOpenCloseAllocation}
                  onDeleteAccount={handleDeleteAccount}
                  onSelectTab={setActiveTab}
                />
              )}

              {activeTab === 'activity' && (
                <TransactionsView
                  accounts={data.accounts}
                  categories={data.categories}
                  onEditTransaction={setEditingTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                />
              )}

              {activeTab === 'savings' && (
                <SavingsView
                  savingsData={data.savings}
                  onRefresh={() => fetchData()}
                  onSelectTab={setActiveTab}
                />
              )}

              {activeTab === 'budgets' && (
                <BudgetsView
                  budgets={data.budgets}
                  accounts={data.accounts}
                  categories={data.categories}
                  selectedMonth={selectedMonth}
                  onOpenCreateBudget={() => {
                    setEditingBudget(null);
                    setIsBudgetModalOpen(true);
                  }}
                  onOpenEditBudget={b => {
                    setEditingBudget(b);
                    setIsBudgetModalOpen(true);
                  }}
                  onDeleteBudget={handleDeleteBudget}
                  onTogglePauseBudget={() => {}}
                />
              )}

              {activeTab === 'insights' && (
                <ReportsView
                  selectedMonth={selectedMonth}
                  onMonthChange={handleMonthChange}
                />
              )}

              {activeTab === 'advisor' && (
                <AiAdvisorView data={data} />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  settings={data.settings}
                  onRefreshData={() => fetchData()}
                  onLoadDemo={handleLoadDemo}
                  onResetApp={handleResetApp}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Modals */}
      {data && (
        <>
          <AddExpenseModal
            isOpen={isExpenseModalOpen}
            onClose={() => setIsExpenseModalOpen(false)}
            accounts={data.accounts}
            categories={data.categories}
            onSuccess={() => fetchData()}
            preselectedAccountId={preselectedAccountId}
          />

          <RecordIncomeModal
            isOpen={isIncomeModalOpen}
            onClose={() => setIsIncomeModalOpen(false)}
            accounts={data.accounts}
            onSuccess={() => fetchData()}
          />

          <TransferModal
            isOpen={isTransferModalOpen}
            onClose={() => setIsTransferModalOpen(false)}
            accounts={data.accounts}
            onSuccess={() => fetchData()}
            initialFromAccountId={transferFromId}
            initialToAccountId={transferToId}
          />

          <AllocateFundsModal
            isOpen={isAllocateModalOpen}
            onClose={() => setIsAllocateModalOpen(false)}
            income={selectedIncomeForAlloc}
            accounts={data.accounts}
            onSuccess={() => fetchData()}
          />

          <EditTransactionModal
            isOpen={!!editingTransaction}
            onClose={() => setEditingTransaction(null)}
            transaction={editingTransaction}
            accounts={data.accounts}
            categories={data.categories}
            onSuccess={() => fetchData()}
            onDeleteRequest={handleDeleteTransaction}
          />

          <AccountModal
            isOpen={isAccountModalOpen}
            onClose={() => setIsAccountModalOpen(false)}
            account={editingAccount}
            onSuccess={() => fetchData()}
          />

          <CloseAllocationModal
            isOpen={!!accountForCloseAlloc}
            onClose={() => setAccountForCloseAlloc(null)}
            account={accountForCloseAlloc}
            onSuccess={() => fetchData()}
          />

          <AddMoneyModal
            isOpen={!!accountForAddMoney}
            onClose={() => setAccountForAddMoney(null)}
            account={accountForAddMoney}
            defaultMode={addMoneyDefaultMode}
            onSuccess={() => fetchData()}
          />

          <BudgetModal
            isOpen={isBudgetModalOpen}
            onClose={() => setIsBudgetModalOpen(false)}
            budget={editingBudget}
            accounts={data.accounts}
            categories={data.categories}
            onSuccess={() => fetchData()}
          />

          <ConfirmDeleteModal
            isOpen={deleteModalState.isOpen}
            onClose={() => setDeleteModalState(prev => ({ ...prev, isOpen: false }))}
            title={deleteModalState.title}
            message={deleteModalState.message}
            onConfirm={deleteModalState.onConfirm}
          />
        </>
      )}
    </div>
  );
}
