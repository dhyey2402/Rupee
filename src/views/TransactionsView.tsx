import React, { useState, useEffect } from 'react';
import {
  ReceiptText,
  Search,
  Filter,
  Download,
  Edit2,
  Trash2,
  ArrowRightLeft,
  TrendingUp,
  X,
  ChevronDown,
  Calendar,
} from 'lucide-react';
import { Transaction, Account, Category } from '../types';
import { formatINR, formatRelativeDate, formatDate, groupTransactionsByDate } from '../utils/format';
import { CategoryIcon } from '../components/CategoryIcon';

interface TransactionsViewProps {
  accounts: Account[];
  categories: Category[];
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (tx: Transaction) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  accounts,
  categories,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters state
  const [search, setSearch] = useState('');
  const [filterAccount, setFilterAccount] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchTransactions = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.append('search', search.trim());
    if (filterAccount) params.append('accountId', filterAccount);
    if (filterType) params.append('type', filterType);
    if (filterCategory) params.append('categoryId', filterCategory);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    params.append('limit', '200');

    fetch(`/api/transactions?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        setTransactions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchTransactions();
  }, [filterAccount, filterType, filterCategory, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTransactions();
  };

  const clearFilters = () => {
    setSearch('');
    setFilterAccount('');
    setFilterType('');
    setFilterCategory('');
    setStartDate('');
    setEndDate('');
    fetch('/api/transactions?limit=200')
      .then(res => res.json())
      .then(data => setTransactions(data));
  };

  const handleExportCSV = () => {
    window.location.href = '/api/export/csv';
  };

  const hasActiveFilters = Boolean(filterAccount || filterType || filterCategory || startDate || endDate);
  const groupedData = groupTransactionsByDate(transactions);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#111318] tracking-tight">
            Activity Feed
          </h2>
          <p className="text-xs sm:text-sm text-[#6B7280]">
            Complete ledger of transactions, internal transfers, and income deposits
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
              showFilters || hasActiveFilters
                ? 'bg-[#111318] text-white border-[#111318]'
                : 'bg-white text-[#374151] border-[#E5E7EB] hover:bg-[#F9FAFB]'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            )}
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white hover:bg-[#F9FAFB] text-[#374151] border border-[#E5E7EB] rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#6B7280]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-white rounded-3xl border border-[#EAEBED] p-4 sm:p-5 shadow-xs space-y-3.5">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search description, merchant, or notes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-[#E5E7EB] text-xs sm:text-sm text-[#111318] focus:border-[#065F46] outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-[#111318] text-white rounded-xl text-xs font-bold hover:bg-black transition-colors cursor-pointer"
          >
            Search
          </button>
        </form>

        {showFilters && (
          <div className="pt-3 border-t border-[#F0F1F3] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in duration-150">
            <div>
              <label className="block text-[11px] font-semibold text-[#4B5563] mb-1">Account</label>
              <select
                value={filterAccount}
                onChange={e => setFilterAccount(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-[#D1D5DB] bg-white text-xs text-[#111318] outline-none"
              >
                <option value="">All Accounts</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#4B5563] mb-1">Transaction Type</label>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-[#D1D5DB] bg-white text-xs text-[#111318] outline-none"
              >
                <option value="">All Types</option>
                <option value="expense">Expense</option>
                <option value="income_allocation">Income Allocation</option>
                <option value="transfer_out">Transfer (Out)</option>
                <option value="transfer_in">Transfer (In)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#4B5563] mb-1">Category</label>
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-[#D1D5DB] bg-white text-xs text-[#111318] outline-none"
              >
                <option value="">All Categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={clearFilters}
                className="w-full py-1.5 px-3 rounded-lg bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] text-xs font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Activity Feed Grouped by Date */}
      {loading ? (
        <div className="p-12 text-center text-xs text-[#6B7280]">
          Loading activity records...
        </div>
      ) : transactions.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-[#EAEBED] space-y-2">
          <p className="text-sm font-bold text-[#111318]">No activity found</p>
          <p className="text-xs text-[#6B7280]">Try clearing or adjusting your search parameters.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedData.map(group => (
            <div key={group.rawDate} className="space-y-2">
              {/* Date Header with Daily Subtotal */}
              <div className="flex items-center justify-between px-2 text-xs font-semibold text-[#6B7280]">
                <span>{group.dateLabel}</span>
                <span className="tabular-nums font-medium text-[11px]">
                  Daily net: {group.totalPaise < 0 ? '-' : '+'}{formatINR(Math.abs(group.totalPaise))}
                </span>
              </div>

              {/* Day's Transactions Card */}
              <div className="bg-white rounded-2xl border border-[#EAEBED] divide-y divide-[#F0F1F3] overflow-hidden shadow-xs">
                {group.transactions.map(tx => {
                  const isExpense = tx.type === 'expense';
                  const isIncome = tx.type === 'income_allocation';
                  const isTransfer = tx.type === 'transfer_out' || tx.type === 'transfer_in';

                  return (
                    <div
                      key={tx.id}
                      className="p-4 flex items-center justify-between gap-3 hover:bg-[#F9FAFB] transition-colors group"
                    >
                      <div
                        onClick={() => onEditTransaction(tx)}
                        className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer"
                      >
                        <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] flex items-center justify-center shrink-0">
                          <CategoryIcon
                            name={tx.category_icon || 'Tag'}
                            className="w-4.5 h-4.5"
                            color={tx.category_color}
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs sm:text-sm font-bold text-[#111318] truncate">
                              {tx.description}
                            </h4>
                            {tx.merchant && (
                              <span className="text-[11px] text-[#6B7280] hidden sm:inline">
                                • {tx.merchant}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-[#6B7280] mt-0.5">
                            <span
                              className="font-medium px-1.5 py-0.2 rounded text-[10px]"
                              style={{
                                backgroundColor: `${tx.account_color || '#6B7280'}15`,
                                color: tx.account_color || '#374151',
                              }}
                            >
                              {tx.account_name}
                            </span>
                            {tx.category_name && (
                              <>
                                <span>•</span>
                                <span>{tx.category_name}</span>
                              </>
                            )}
                            {tx.notes && (
                              <span className="hidden md:inline italic text-[#9CA3AF]">
                                ({tx.notes})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
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
                          <span className="text-[10px] text-[#9CA3AF] uppercase font-semibold block">
                            {tx.type.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => onEditTransaction(tx)}
                            className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111318] hover:bg-[#F3F4F6] cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTransaction(tx)}
                            className="p-1.5 rounded-lg text-[#6B7280] hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
  );
};
