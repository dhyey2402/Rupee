import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Fuel,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Info,
  Droplet,
  Gauge,
} from 'lucide-react';
import { formatINR, formatDate } from '../utils/format';
import { CategoryIcon } from '../components/CategoryIcon';

interface ReportsViewProps {
  selectedMonth: string;
  onMonthChange: (m: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ selectedMonth, onMonthChange }) => {
  const [reportData, setReportData] = useState<any>(null);
  const [petrolReport, setPetrolReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hoveredTrend, setHoveredTrend] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/reports/monthly?month=${selectedMonth}`).then(r => r.json()),
      fetch(`/api/reports/petrol?month=${selectedMonth}`).then(r => r.json()),
    ])
      .then(([monthly, petrol]) => {
        setReportData(monthly);
        setPetrolReport(petrol);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedMonth]);

  const [y, m] = selectedMonth.split('-').map(Number);
  const monthName = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  if (loading || !reportData || !petrolReport) {
    return (
      <div className="p-16 text-center text-xs text-[#6B7280]">
        Compiling analytics for {monthName}...
      </div>
    );
  }

  const {
    incomePaise,
    expensePaise,
    savingsAddedPaise,
    netFlowPaise,
    categoryBreakdown,
    accountBreakdown,
    sixMonthsTrend,
    dailySpending,
  } = reportData;

  // Max value in six month trend for chart scaling
  const maxTrendVal = Math.max(
    ...sixMonthsTrend.map((t: any) => Math.max(t.incomePaise, t.expensePaise)),
    100000
  );

  // Generate authentic quantitative insight sentences
  const petrolPct = petrolReport.budgetPaise > 0
    ? ((petrolReport.totalSpentPaise / petrolReport.budgetPaise) * 100).toFixed(1)
    : '0';

  // Compare with previous month trend if available
  const currentTrendIdx = sixMonthsTrend.findIndex((t: any) => t.month === selectedMonth);
  const prevMonthTrend = currentTrendIdx > 0 ? sixMonthsTrend[currentTrendIdx - 1] : null;

  let petrolDeltaText = '';
  if (prevMonthTrend) {
    const diff = petrolReport.totalSpentPaise - prevMonthTrend.petrolPaise;
    if (diff > 0) {
      petrolDeltaText = `Petrol spending is ${formatINR(diff)} higher than last month.`;
    } else if (diff < 0) {
      petrolDeltaText = `Petrol spending is ${formatINR(Math.abs(diff))} lower than last month.`;
    } else {
      petrolDeltaText = `Petrol spending matches last month's pace.`;
    }
  }

  const savingsRate = incomePaise > 0 ? Math.round((savingsAddedPaise / incomePaise) * 100) : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#111318] tracking-tight">
            Financial Insights & Reports
          </h2>
          <p className="text-xs sm:text-sm text-[#6B7280]">
            Quantitative analysis grounded strictly in your recorded transactions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={e => onMonthChange(e.target.value)}
            className="px-3 py-1.5 bg-white border border-[#D1D5DB] rounded-xl text-xs font-semibold text-[#111318] outline-none shadow-2xs"
          />
        </div>
      </div>

      {/* Narrative Insights Strip (Domain-Grounded) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="bg-[#FAF7F2] p-4.5 rounded-2xl border border-[#EFE8DC] space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#854D0E]">
            <Fuel className="w-3.5 h-3.5 text-[#B45309]" />
            <span>Petrol Commute Utilization</span>
          </div>
          <p className="text-xs text-[#713F12] leading-relaxed">
            You have used <strong className="text-[#111318] font-bold tabular-nums">{petrolPct}%</strong> of your ₹2,000 petrol budget this month.
          </p>
          {petrolDeltaText && (
            <p className="text-[11px] text-[#B45309] font-medium pt-1">
              {petrolDeltaText}
            </p>
          )}
        </div>

        <div className="bg-[#F0FDF4] p-4.5 rounded-2xl border border-[#DCFCE7] space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#166534]">
            <TrendingUp className="w-3.5 h-3.5 text-[#065F46]" />
            <span>Net Capital Retention</span>
          </div>
          <p className="text-xs text-[#14532D] leading-relaxed">
            Retained <strong className="text-[#111318] font-bold tabular-nums">{formatINR(netFlowPaise)}</strong> of net capital after all expenses this month.
          </p>
          <p className="text-[11px] text-[#15803D] font-medium pt-1">
            Savings allocation rate: {savingsRate}% of total income.
          </p>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-[#EAEBED] space-y-1 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#374151]">
            <Calendar className="w-3.5 h-3.5 text-[#6B7280]" />
            <span>Monthly Flow Volume</span>
          </div>
          <p className="text-xs text-[#4B5563] leading-relaxed">
            Inflow: <strong className="text-[#065F46] tabular-nums font-bold">+{formatINR(incomePaise)}</strong> • Outflow: <strong className="text-rose-600 tabular-nums font-bold">-{formatINR(expensePaise)}</strong>
          </p>
          <p className="text-[11px] text-[#6B7280] pt-1">
            Across {petrolReport.count} refuel sessions and personal expenses.
          </p>
        </div>
      </div>

      {/* 6-Month Income vs Outflow Interactive Trend Chart */}
      <div className="bg-white rounded-3xl border border-[#EAEBED] p-6 sm:p-7 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#111318]">6-Month Financial Flow Comparison</h3>
            <p className="text-xs text-[#6B7280]">Hover or inspect bars to see exact monthly balance</p>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-[#065F46]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#065F46]" />
              Income
            </span>
            <span className="flex items-center gap-1.5 text-[#DC2626]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" />
              Expenses
            </span>
            <span className="flex items-center gap-1.5 text-[#B45309]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#B45309]" />
              Petrol
            </span>
          </div>
        </div>

        {/* Interactive Chart Container */}
        <div className="pt-6 pb-2">
          <div className="grid grid-cols-6 gap-2 sm:gap-6 h-52 items-end border-b border-[#E5E7EB] pb-2">
            {sixMonthsTrend.map((item: any) => {
              const incH = Math.max((item.incomePaise / maxTrendVal) * 100, 4);
              const expH = Math.max((item.expensePaise / maxTrendVal) * 100, 4);
              const petH = Math.max((item.petrolPaise / maxTrendVal) * 100, 2);
              const isSelected = item.month === selectedMonth;

              return (
                <div
                  key={item.month}
                  onMouseEnter={() => setHoveredTrend(item)}
                  onMouseLeave={() => setHoveredTrend(null)}
                  onClick={() => onMonthChange(item.month)}
                  className={`flex flex-col items-center gap-1.5 h-full justify-end cursor-pointer group p-1 rounded-xl transition-colors ${
                    isSelected ? 'bg-[#F9FAFB]' : 'hover:bg-[#F9FAFB]'
                  }`}
                >
                  <div className="flex items-end gap-1 sm:gap-2 w-full justify-center h-full">
                    {/* Income Bar */}
                    <div
                      className="w-3 sm:w-6 bg-[#065F46] rounded-t-sm transition-all group-hover:brightness-110"
                      style={{ height: `${incH}%` }}
                    />
                    {/* Expense Bar */}
                    <div
                      className="w-3 sm:w-6 bg-[#DC2626] rounded-t-sm transition-all group-hover:brightness-110"
                      style={{ height: `${expH}%` }}
                    />
                    {/* Petrol Sub-Bar */}
                    <div
                      className="w-2 sm:w-3.5 bg-[#B45309] rounded-t-sm transition-all group-hover:brightness-110"
                      style={{ height: `${petH}%` }}
                    />
                  </div>
                  <span
                    className={`text-[10px] font-bold tabular-nums whitespace-nowrap ${
                      isSelected ? 'text-[#065F46]' : 'text-[#6B7280]'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Interactive Inspection Tooltip Banner */}
          <div className="mt-3 min-h-[32px] flex items-center justify-between text-xs text-[#4B5563] bg-[#F9FAFB] p-2.5 rounded-xl border border-[#E5E7EB]">
            {hoveredTrend ? (
              <div className="flex flex-wrap items-center gap-3 w-full justify-between">
                <span className="font-bold text-[#111318]">{hoveredTrend.label}:</span>
                <span className="text-[#065F46] font-bold tabular-nums">
                  Income: {formatINR(hoveredTrend.incomePaise)}
                </span>
                <span className="text-rose-600 font-bold tabular-nums">
                  Expenses: {formatINR(hoveredTrend.expensePaise)}
                </span>
                <span className="text-[#B45309] font-bold tabular-nums">
                  Petrol: {formatINR(hoveredTrend.petrolPaise)}
                </span>
                <span className="font-semibold tabular-nums text-[#374151]">
                  Net: {formatINR(hoveredTrend.netSavingsPaise)}
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-[#9CA3AF]">
                Hover over any month column above to inspect breakdown values. Click to switch active period.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* College Petrol Commute Deep-Dive */}
      <div className="bg-white rounded-3xl border border-[#EAEBED] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#B45309] text-white flex items-center justify-center">
              <Fuel className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#111318]">
                College Commute Fuel Ledger ({monthName})
              </h3>
              <p className="text-xs text-[#6B7280]">
                Telemetry recorded for college commuting
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-[#6B7280]">Total Petrol</span>
            <p className="text-base font-extrabold text-[#111318] tabular-nums">
              {formatINR(petrolReport.totalSpentPaise)}
            </p>
          </div>
        </div>

        {petrolReport.transactions?.length === 0 ? (
          <p className="text-xs text-[#9CA3AF] text-center py-6">
            No petrol expenses logged in {monthName}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#F0F1F3] text-[#6B7280] font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Station</th>
                  <th className="py-2.5 px-3 text-right">Litres</th>
                  <th className="py-2.5 px-3 text-right">Price/L</th>
                  <th className="py-2.5 px-3 text-right">Odometer</th>
                  <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F1F3] font-medium">
                {petrolReport.transactions.map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-[#F9FAFB]">
                    <td className="py-2.5 px-3 text-[#4B5563] tabular-nums">{formatDate(tx.date)}</td>
                    <td className="py-2.5 px-3 font-bold text-[#111318]">{tx.description}</td>
                    <td className="py-2.5 px-3 text-[#6B7280]">{tx.fuel_station || tx.merchant || '—'}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{tx.litres ? `${tx.litres} L` : '—'}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-[#6B7280]">
                      {tx.price_per_litre ? `₹${tx.price_per_litre}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-[#6B7280]">
                      {tx.odometer ? `${tx.odometer} km` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black tabular-nums text-[#111318]">
                      {formatINR(tx.amount_paise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Two Column Layout: Account-wise Outflow & Category Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-[#EAEBED] p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-[#111318]">Category-Wise Spending Breakdown</h3>
          {categoryBreakdown.length === 0 ? (
            <p className="text-xs text-[#9CA3AF] py-6 text-center">No expenses in this month</p>
          ) : (
            <div className="space-y-3">
              {categoryBreakdown.map((cat: any) => {
                const pct = expensePaise > 0 ? Math.round((cat.total_paise / expensePaise) * 100) : 0;
                return (
                  <div key={cat.id} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-[#374151] flex items-center gap-1.5">
                        <CategoryIcon name={cat.icon} className="w-3.5 h-3.5" color={cat.color} />
                        {cat.name}
                      </span>
                      <span className="font-bold tabular-nums text-[#111318]">
                        {formatINR(cat.total_paise)} <span className="text-[10px] text-[#9CA3AF]">({pct}%)</span>
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

        <div className="bg-white rounded-3xl border border-[#EAEBED] p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-[#111318]">Account-Wise Expense Outflow</h3>
          {accountBreakdown.length === 0 ? (
            <p className="text-xs text-[#9CA3AF] py-6 text-center">No expenses in this month</p>
          ) : (
            <div className="space-y-3">
              {accountBreakdown.map((acc: any) => {
                const pct = expensePaise > 0 ? Math.round((acc.total_paise / expensePaise) * 100) : 0;
                return (
                  <div key={acc.id} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-[#111318] flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: acc.color }} />
                        {acc.name}
                      </span>
                      <span className="font-bold tabular-nums text-[#111318]">
                        {formatINR(acc.total_paise)} <span className="text-[10px] text-[#9CA3AF]">({pct}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-[#E5E7EB] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: acc.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
