import React, { useState, useEffect } from 'react';
import {
  Fuel,
  Plus,
  Gauge,
  Droplet,
  IndianRupee,
  MapPin,
  Calendar,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  ChevronRight,
} from 'lucide-react';
import { Account, Budget } from '../types';
import { formatINR, formatDate, getTodayDateString } from '../utils/format';

interface PetrolTrackerViewProps {
  accounts: Account[];
  budgets: Budget[];
  onOpenExpense: (accountId?: string) => void;
  onOpenTransfer: (fromId?: string, toId?: string) => void;
  selectedMonth: string;
}

export const PetrolTrackerView: React.FC<PetrolTrackerViewProps> = ({
  accounts,
  budgets,
  onOpenExpense,
  onOpenTransfer,
  selectedMonth,
}) => {
  const [petrolLogs, setPetrolLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalSpentPaise: 0,
    totalLitres: 0,
    avgPricePerLitre: 0,
    totalRefuels: 0,
  });
  const [loading, setLoading] = useState(false);

  // Quick inline refuel modal/card state
  const [showQuickRefuel, setShowQuickRefuel] = useState(false);
  const [quickLitres, setQuickLitres] = useState('');
  const [quickPrice, setQuickPrice] = useState('102.50');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickOdometer, setQuickOdometer] = useState('');
  const [quickStation, setQuickStation] = useState('');
  const [quickDate, setQuickDate] = useState(getTodayDateString());
  const [quickDesc, setQuickDesc] = useState('College Commute Fuel');
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  const petrolAccount = accounts.find(a => a.type === 'petrol');
  const petrolBudget = budgets.find(b => b.linked_account_id === 'acc-petrol');

  const fetchPetrolData = () => {
    setLoading(true);
    fetch('/api/petrol/logs')
      .then(res => res.json())
      .then(data => {
        setPetrolLogs(data.logs || []);
        setStats(data.stats || {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchPetrolData();
  }, [selectedMonth]);

  // Litres & price auto-calculator
  const handleLitresChange = (val: string) => {
    setQuickLitres(val);
    const l = parseFloat(val);
    const p = parseFloat(quickPrice);
    if (!isNaN(l) && !isNaN(p) && l > 0 && p > 0) {
      setQuickAmount((l * p).toFixed(2));
    }
  };

  const handlePriceChange = (val: string) => {
    setQuickPrice(val);
    const l = parseFloat(quickLitres);
    const p = parseFloat(val);
    if (!isNaN(l) && !isNaN(p) && l > 0 && p > 0) {
      setQuickAmount((l * p).toFixed(2));
    }
  };

  const handleAmountChange = (val: string) => {
    setQuickAmount(val);
    const amt = parseFloat(val);
    const p = parseFloat(quickPrice);
    if (!isNaN(amt) && !isNaN(p) && amt > 0 && p > 0) {
      setQuickLitres((amt / p).toFixed(2));
    }
  };

  const handleQuickRefuelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!petrolAccount) return;
    const amountNum = parseFloat(quickAmount);
    if (!amountNum || amountNum <= 0) {
      setQuickError('Please enter a valid expense amount.');
      return;
    }

    setQuickLoading(true);
    setQuickError(null);

    const payload: any = {
      accountId: petrolAccount.id,
      amountPaise: Math.round(amountNum * 100),
      categoryId: 'cat-petrol',
      date: quickDate,
      description: quickDesc.trim(),
      merchant: quickStation.trim() || undefined,
      petrolDetails: {
        litres: quickLitres ? parseFloat(quickLitres) : undefined,
        pricePerLitre: quickPrice ? parseFloat(quickPrice) : undefined,
        odometer: quickOdometer ? parseFloat(quickOdometer) : undefined,
        fuelStation: quickStation.trim() || undefined,
      },
    };

    try {
      const res = await fetch('/api/transactions/expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record petrol refuel');

      setShowQuickRefuel(false);
      setQuickLitres('');
      setQuickAmount('');
      setQuickOdometer('');
      fetchPetrolData();
    } catch (err: any) {
      setQuickError(err.message);
    } finally {
      setQuickLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Fuel className="w-6 h-6 text-amber-500" />
            College Commute Petrol Tracker
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Dedicated fuel log, odometer reading & commute budget tracking
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenTransfer(undefined, petrolAccount?.id)}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
          >
            <span>+ Add Petrol Funds</span>
          </button>
          <button
            type="button"
            onClick={() => setShowQuickRefuel(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-xs transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Record Refuel</span>
          </button>
        </div>
      </div>

      {/* College Petrol Budget Status Bar */}
      {petrolAccount && (
        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-md border border-slate-800">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-extrabold text-amber-400 tracking-wider">
                  College Petrol Account
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  Fixed ₹2,000 / month cap
                </span>
              </div>
              <h3 className="text-2xl font-black text-white mt-1">
                {formatINR(petrolAccount.balance_paise)}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Available money in petrol bucket</p>
            </div>

            <div className="grid grid-cols-3 gap-3 bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Monthly Budget</span>
                <p className="text-sm font-bold text-white">
                  {formatINR(petrolBudget?.amount_paise || 200000)}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Spent This Month</span>
                <p className="text-sm font-bold text-amber-300">
                  {formatINR(petrolBudget?.spent_paise || 0)}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Remaining</span>
                <p
                  className={`text-sm font-bold ${
                    petrolBudget?.is_exceeded ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {petrolBudget?.is_exceeded
                    ? `-${formatINR(petrolBudget.exceeded_by_paise || 0)}`
                    : formatINR(petrolBudget?.remaining_paise || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Petrol Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">Total Petrol Spent</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-black text-slate-900">
            {formatINR(stats.totalSpentPaise)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Total recorded refills</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">Total Fuel Purchased</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Droplet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-black text-slate-900">
            {stats.totalLitres} <span className="text-sm font-bold text-slate-500">Litres</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Across all fuel stations</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">Average Fuel Price</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Fuel className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-black text-slate-900">
            ₹{stats.avgPricePerLitre > 0 ? stats.avgPricePerLitre : '102.50'}{' '}
            <span className="text-sm font-bold text-slate-500">/ L</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Weighted average price</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">Refuel Sessions</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Gauge className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-black text-slate-900">
            {stats.totalRefuels}{' '}
            <span className="text-sm font-bold text-slate-500">Times</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Logged commute refills</p>
        </div>
      </div>

      {/* Quick Refuel Form (Card overlay / expandable) */}
      {showQuickRefuel && (
        <div className="bg-amber-50/70 border-2 border-amber-300 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-amber-950 flex items-center gap-2">
              <Fuel className="w-5 h-5 text-amber-600" />
              Log Petrol Commute Purchase
            </h3>
            <button
              type="button"
              onClick={() => setShowQuickRefuel(false)}
              className="text-xs font-bold text-amber-800 hover:underline"
            >
              Close
            </button>
          </div>

          {quickError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              {quickError}
            </div>
          )}

          <form onSubmit={handleQuickRefuelSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-amber-900 mb-1">
                  Litres Purchased
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 3.5"
                  value={quickLitres}
                  onChange={e => handleLitresChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-900 mb-1">
                  Price per Litre (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="102.50"
                  value={quickPrice}
                  onChange={e => handlePriceChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-900 mb-1">
                  Total Expense Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={quickAmount}
                  onChange={e => handleAmountChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-slate-900 text-base font-bold focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-amber-900 mb-1">
                  Odometer Reading (km)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 14250"
                  value={quickOdometer}
                  onChange={e => setQuickOdometer(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-slate-900 text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-900 mb-1">
                  Fuel Station / Pump
                </label>
                <input
                  type="text"
                  placeholder="e.g. Indian Oil Highway"
                  value={quickStation}
                  onChange={e => setQuickStation(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-slate-900 text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-900 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={quickDate}
                  onChange={e => setQuickDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-slate-900 text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowQuickRefuel(false)}
                className="px-4 py-2 text-xs font-semibold text-amber-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={quickLoading}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-xs transition-all disabled:opacity-50"
              >
                {quickLoading ? 'Logging...' : 'Save & Deduct from Petrol Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Refuel Logs Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Recorded Fuel Purchases</h3>
          <span className="text-xs text-slate-400 font-semibold">{petrolLogs.length} total refuels</span>
        </div>

        {loading ? (
          <p className="text-xs text-slate-400 text-center py-8">Loading fuel logs...</p>
        ) : petrolLogs.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
            <p className="text-sm font-bold text-slate-700">No petrol refuels recorded yet</p>
            <p className="text-xs text-slate-400">
              Click &quot;Record Refuel&quot; to log your college commute petrol purchase.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Fuel Station</th>
                  <th className="py-3 px-4 text-right">Litres</th>
                  <th className="py-3 px-4 text-right">Price / L</th>
                  <th className="py-3 px-4 text-right">Odometer</th>
                  <th className="py-3 px-4 text-right">Expense (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {petrolLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {formatDate(log.date)}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {log.description || 'Petrol Refuel'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {log.fuel_station || log.merchant || '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-800">
                      {log.litres ? `${log.litres} L` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">
                      {log.price_per_litre ? `₹${log.price_per_litre}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">
                      {log.odometer ? `${log.odometer} km` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                      {formatINR(log.expense_paise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
