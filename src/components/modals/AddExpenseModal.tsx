import React, { useState, useEffect } from 'react';
import {
  X,
  Fuel,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Calendar,
  Store,
  FileText,
  Gauge,
  Droplet,
} from 'lucide-react';
import { Account, Category } from '../../types';
import { inrToPaise, formatINR, getTodayDateString } from '../../utils/format';
import { CategoryIcon } from '../CategoryIcon';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  onSuccess: () => void;
  preselectedAccountId?: string;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  accounts,
  categories,
  onSuccess,
  preselectedAccountId,
}) => {
  const [amountStr, setAmountStr] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [date, setDate] = useState(getTodayDateString());
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [notes, setNotes] = useState('');

  // Commute / Petrol optional details
  const [isPetrolCategory, setIsPetrolCategory] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [litres, setLitres] = useState('');
  const [pricePerLitre, setPricePerLitre] = useState('102.50');
  const [odometer, setOdometer] = useState('');
  const [fuelStation, setFuelStation] = useState('');

  // Overdraft warning
  const [overdraftWarning, setOverdraftWarning] = useState<{
    message: string;
    currentBalancePaise: number;
    deficitPaise: number;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [successSaved, setSuccessSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAmountStr('');
      setDescription('');
      setMerchant('');
      setNotes('');
      setDate(getTodayDateString());
      setLitres('');
      setPricePerLitre('102.50');
      setOdometer('');
      setFuelStation('');
      setShowMoreDetails(false);
      setOverdraftWarning(null);
      setError(null);
      setSuccessSaved(false);

      // Default category
      const expenseCats = categories.filter(c => c.type === 'expense');
      const defaultCat = expenseCats[0]?.id || '';
      setSelectedCategoryId(defaultCat);

      // Default account
      if (preselectedAccountId) {
        setSelectedAccountId(preselectedAccountId);
        const acc = accounts.find(a => a.id === preselectedAccountId);
        if (acc?.type === 'petrol') {
          setIsPetrolCategory(true);
        }
      } else {
        const spendingAcc = accounts.find(a => a.type === 'spending');
        setSelectedAccountId(spendingAcc ? spendingAcc.id : accounts[0]?.id || '');
      }
    }
  }, [isOpen, preselectedAccountId, accounts, categories]);

  const handleCategorySelect = (catId: string) => {
    setSelectedCategoryId(catId);
    const cat = categories.find(c => c.id === catId);
    if (cat && cat.name.toLowerCase().includes('petrol')) {
      setIsPetrolCategory(true);
      const petrolAcc = accounts.find(a => a.type === 'petrol');
      if (petrolAcc) {
        setSelectedAccountId(petrolAcc.id);
      }
    } else {
      setIsPetrolCategory(false);
    }
  };

  const handleLitresChange = (val: string) => {
    setLitres(val);
    const l = parseFloat(val);
    const p = parseFloat(pricePerLitre);
    if (!isNaN(l) && !isNaN(p) && l > 0 && p > 0) {
      setAmountStr((l * p).toFixed(2));
    }
  };

  const handlePriceChange = (val: string) => {
    setPricePerLitre(val);
    const l = parseFloat(litres);
    const p = parseFloat(val);
    if (!isNaN(l) && !isNaN(p) && l > 0 && p > 0) {
      setAmountStr((l * p).toFixed(2));
    }
  };

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const amountPaise = inrToPaise(amountStr);

  const handleSubmit = async (e?: React.FormEvent, allowOverdraft = false) => {
    if (e) e.preventDefault();
    if (!selectedAccountId || !amountPaise || amountPaise <= 0) {
      setError('Please enter a positive expense amount.');
      return;
    }
    if (!description.trim()) {
      setError('Please enter a short description or merchant name.');
      return;
    }

    setLoading(true);
    setError(null);

    const payload: any = {
      accountId: selectedAccountId,
      amountPaise,
      categoryId: selectedCategoryId || null,
      date,
      description: description.trim(),
      merchant: merchant.trim() || undefined,
      notes: notes.trim() || undefined,
      allowOverdraft,
    };

    if (isPetrolCategory && (litres || pricePerLitre || odometer || fuelStation)) {
      payload.petrolDetails = {
        litres: litres ? parseFloat(litres) : undefined,
        pricePerLitre: pricePerLitre ? parseFloat(pricePerLitre) : undefined,
        odometer: odometer ? parseFloat(odometer) : undefined,
        fuelStation: fuelStation.trim() || undefined,
      };
    }

    try {
      const res = await fetch('/api/transactions/expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'INSUFFICIENT_BALANCE') {
          setOverdraftWarning({
            message: data.message,
            currentBalancePaise: data.currentBalancePaise,
            deficitPaise: data.deficitPaise,
          });
          setLoading(false);
          return;
        }
        throw new Error(data.error || 'Failed to record expense');
      }

      setSuccessSaved(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs transition-opacity">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl border border-[#EAEBED] w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-[#F0F1F3] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#111318] tracking-tight">Add Expense</h2>
            <p className="text-xs text-[#6B7280]">Deduct from an independent account bucket</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111318] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          {/* Overdraft Warning Banner */}
          {overdraftWarning && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2.5">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-900">Insufficient Account Balance</h4>
                  <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">{overdraftWarning.message}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleSubmit(undefined, true)}
                  disabled={loading}
                  className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Confirm Overdraft & Deduct
                </button>
                <button
                  type="button"
                  onClick={() => setOverdraftWarning(null)}
                  className="px-3 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-lg text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <form onSubmit={e => handleSubmit(e)} className="space-y-5">
            {/* Primary Hero Numeric Entry Area */}
            <div className="text-center py-2 bg-[#F9FAFB] rounded-2xl border border-[#EBECEF] p-4">
              <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">
                Expense Amount (INR)
              </label>
              <div className="flex items-center justify-center gap-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-[#9CA3AF]">₹</span>
                <input
                  type="number"
                  step="0.01"
                  autoFocus
                  placeholder="0"
                  value={amountStr}
                  onChange={e => setAmountStr(e.target.value)}
                  className="w-48 sm:w-60 text-center text-4xl sm:text-5xl font-black text-[#111318] bg-transparent outline-none tabular-nums placeholder:text-slate-300 tracking-tight"
                />
              </div>
            </div>

            {/* Account Selector with Balance & Budget distinction */}
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                Deduct From Account
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {accounts.map(acc => {
                  const isSelected = selectedAccountId === acc.id;
                  const isPetrol = acc.type === 'petrol';

                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        setSelectedAccountId(acc.id);
                        if (isPetrol) setIsPetrolCategory(true);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#065F46] bg-[#F0FDF4] ring-1 ring-[#065F46]'
                          : 'border-[#E5E7EB] bg-white hover:border-[#D1D5DB]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-[#111318] truncate">
                          {acc.name}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#065F46]" />}
                      </div>

                      <div className="space-y-0.5 text-[10px]">
                        <div className="flex justify-between text-[#6B7280]">
                          <span>Balance:</span>
                          <span className="font-bold tabular-nums text-[#111318]">
                            {formatINR(acc.balance_paise)}
                          </span>
                        </div>
                        {acc.budget && (
                          <div className="flex justify-between text-[#B45309]">
                            <span>Budget left:</span>
                            <span className="font-semibold tabular-nums">
                              {formatINR(acc.budget.remaining_paise || 0)}
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category Selector Chips */}
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                Category
              </label>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {categories
                  .filter(c => c.type === 'expense')
                  .map(cat => {
                    const isSelected = selectedCategoryId === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleCategorySelect(cat.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 flex items-center gap-1.5 border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#111318] text-white border-[#111318] shadow-xs'
                            : 'bg-white text-[#4B5563] border-[#E5E7EB] hover:bg-[#F9FAFB]'
                        }`}
                      >
                        <CategoryIcon
                          name={cat.icon}
                          className="w-3.5 h-3.5"
                          color={isSelected ? '#FFFFFF' : cat.color}
                        />
                        <span>{cat.name}</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Description & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#374151] mb-1">
                  Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Daily commute refuel, College canteen lunch"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#D1D5DB] text-sm text-[#111318] focus:border-[#065F46] focus:ring-1 focus:ring-[#065F46] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#D1D5DB] text-xs text-[#111318] font-medium focus:border-[#065F46] outline-none"
                />
              </div>
            </div>

            {/* Collapsible "More Details" Accordion */}
            <div>
              <button
                type="button"
                onClick={() => setShowMoreDetails(!showMoreDetails)}
                className="text-xs font-semibold text-[#065F46] hover:text-[#047857] flex items-center gap-1 cursor-pointer py-1"
              >
                {showMoreDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <span>{showMoreDetails ? 'Hide additional fields' : 'Add merchant, notes or fuel specs'}</span>
              </button>

              {showMoreDetails && (
                <div className="mt-3 p-4 bg-[#F9FAFB] rounded-2xl border border-[#E5E7EB] space-y-3.5 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#4B5563] mb-1 flex items-center gap-1">
                        <Store className="w-3.5 h-3.5 text-[#6B7280]" />
                        Merchant / Vendor Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Indian Oil, Campus Cafe"
                        value={merchant}
                        onChange={e => setMerchant(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-[#D1D5DB] text-xs text-[#111318] bg-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#4B5563] mb-1 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-[#6B7280]" />
                        Notes
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Paid via UPI"
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-[#D1D5DB] text-xs text-[#111318] bg-white outline-none"
                      />
                    </div>
                  </div>

                  {/* Petrol Specific Commute Inputs */}
                  {isPetrolCategory && (
                    <div className="pt-2 border-t border-[#E5E7EB] space-y-2">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-[#854D0E]">
                        <Fuel className="w-3.5 h-3.5 text-[#B45309]" />
                        <span>College Commute Telemetry (Optional)</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="block text-[10px] text-[#6B7280]">Litres</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="e.g. 2.92"
                            value={litres}
                            onChange={e => handleLitresChange(e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded border border-[#D1D5DB] bg-white tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#6B7280]">Price / Litre (₹)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={pricePerLitre}
                            onChange={e => handlePriceChange(e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded border border-[#D1D5DB] bg-white tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#6B7280]">Odometer (km)</label>
                          <input
                            type="number"
                            placeholder="e.g. 14250"
                            value={odometer}
                            onChange={e => setOdometer(e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded border border-[#D1D5DB] bg-white tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#6B7280]">Fuel Station</label>
                          <input
                            type="text"
                            placeholder="BPCL Campus"
                            value={fuelStation}
                            onChange={e => setFuelStation(e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded border border-[#D1D5DB] bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-[#F0F1F3] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-[#4B5563] hover:text-[#111318] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || successSaved}
                className="px-6 py-2.5 bg-[#065F46] hover:bg-[#047857] active:scale-[0.99] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {successSaved ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-200" />
                    <span>Saved!</span>
                  </>
                ) : loading ? (
                  'Saving Expense...'
                ) : (
                  'Save Expense'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
