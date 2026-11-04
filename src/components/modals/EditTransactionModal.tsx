import React, { useState, useEffect } from 'react';
import { X, Edit3, Trash2 } from 'lucide-react';
import { Transaction, Account, Category } from '../../types';
import { inrToPaise } from '../../utils/format';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  accounts: Account[];
  categories: Category[];
  onSuccess: () => void;
  onDeleteRequest: (tx: Transaction) => void;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  onClose,
  transaction,
  accounts,
  categories,
  onSuccess,
  onDeleteRequest,
}) => {
  const [amountStr, setAmountStr] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && transaction) {
      setAmountStr((transaction.amount_paise / 100).toFixed(2));
      setAccountId(transaction.account_id);
      setCategoryId(transaction.category_id || '');
      setDate(transaction.date);
      setDescription(transaction.description);
      setMerchant(transaction.merchant || '');
      setNotes(transaction.notes || '');
      setError(null);
    }
  }, [isOpen, transaction]);

  if (!isOpen || !transaction) return null;

  const isExpense = transaction.type === 'expense';
  const amountPaise = inrToPaise(amountStr);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Description is required.');
      return;
    }
    if (isExpense && (!amountPaise || amountPaise <= 0)) {
      setError('Please enter a valid amount.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/transactions/${transaction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountPaise,
          accountId,
          categoryId: categoryId || null,
          date,
          description: description.trim(),
          merchant: merchant.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update transaction');

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
              <Edit3 className="w-4 h-4 text-[#065F46]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#111318]">Edit Transaction</h2>
              <p className="text-xs text-[#717680] capitalize">
                {transaction.type.replace('_', ' ')}
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
        <div className="p-6 overflow-y-auto space-y-4 max-h-[80vh]">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isExpense && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-[#111318] mb-1.5">
                    Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#717680] font-bold font-mono">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={amountStr}
                      onChange={e => setAmountStr(e.target.value)}
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-[#EAEBED] text-[#111318] font-bold font-mono text-lg focus:outline-none focus:ring-2 focus:ring-[#065F46]/20 focus:border-[#065F46] transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#111318] mb-1.5">
                      Account
                    </label>
                    <select
                      value={accountId}
                      onChange={e => setAccountId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#EAEBED] bg-white text-[#111318] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#065F46]/20 focus:border-[#065F46]"
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#111318] mb-1.5">
                      Category
                    </label>
                    <select
                      value={categoryId}
                      onChange={e => setCategoryId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#EAEBED] bg-white text-[#111318] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#065F46]/20 focus:border-[#065F46]"
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#111318] mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EAEBED] bg-white text-[#111318] text-xs focus:outline-none focus:ring-2 focus:ring-[#065F46]/20 focus:border-[#065F46]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#717680] mb-1.5">
                  Merchant (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Merchant / Outlet"
                  value={merchant}
                  onChange={e => setMerchant(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EAEBED] text-[#111318] text-xs focus:outline-none focus:ring-2 focus:ring-[#065F46]/20 focus:border-[#065F46]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111318] mb-1.5">
                Description
              </label>
              <input
                type="text"
                required
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#EAEBED] text-[#111318] text-xs focus:outline-none focus:ring-2 focus:ring-[#065F46]/20 focus:border-[#065F46]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#717680] mb-1.5">
                Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#EAEBED] text-[#111318] text-xs focus:outline-none focus:ring-2 focus:ring-[#065F46]/20 focus:border-[#065F46]"
              />
            </div>

            {/* Footer Buttons */}
            <div className="pt-4 flex items-center justify-between border-t border-[#EAEBED]">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDeleteRequest(transaction);
                }}
                className="px-3 py-2 text-xs font-semibold text-[#DC2626] hover:bg-[#FEF2F2] rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-[#717680] hover:text-[#111318]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-[#065F46] hover:bg-[#047857] text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
