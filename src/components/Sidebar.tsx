import React from 'react';
import {
  LayoutDashboard,
  Wallet,
  ReceiptText,
  Target,
  BarChart3,
  Settings,
  Plus,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Fuel,
  Sparkles,
} from 'lucide-react';
import { formatINR } from '../utils/format';

export type NavTab = 'overview' | 'accounts' | 'activity' | 'budgets' | 'insights' | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  selectedMonth: string; // YYYY-MM
  onMonthChange: (month: string) => void;
  onOpenExpense: () => void;
  onOpenIncome: () => void;
  onOpenTransfer: () => void;
  petrolRemainingPaise?: number;
  petrolBudgetPaise?: number;
  petrolPercentage?: number;
  petrolExceeded?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  selectedMonth,
  onMonthChange,
  onOpenExpense,
  onOpenIncome,
  onOpenTransfer,
  petrolRemainingPaise = 200000,
  petrolBudgetPaise = 200000,
  petrolPercentage = 0,
  petrolExceeded = false,
}) => {
  const navItems = [
    { id: 'overview' as NavTab, label: 'Overview', icon: LayoutDashboard },
    { id: 'accounts' as NavTab, label: 'Accounts', icon: Wallet },
    { id: 'activity' as NavTab, label: 'Activity', icon: ReceiptText },
    { id: 'budgets' as NavTab, label: 'Budgets', icon: Target },
    { id: 'insights' as NavTab, label: 'Insights', icon: BarChart3 },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
  ];

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prev = new Date(y, m - 2, 1);
    onMonthChange(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const next = new Date(y, m, 1);
    onMonthChange(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };

  const formatMonthTitle = (monthStr: string) => {
    const [y, m] = monthStr.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <aside className="hidden lg:flex flex-col w-[268px] bg-white border-r border-[#EAEBED] shrink-0 h-screen sticky top-0 select-none z-30">
      {/* Brand Zone */}
      <div className="px-6 py-6 border-b border-[#F0F1F3] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#065F46] text-white flex items-center justify-center font-bold text-sm tracking-tighter shadow-xs">
            ₹
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-[#111318]">
              Money Manager
            </h1>
            <p className="text-[11px] text-[#6B7280] font-medium tracking-normal">
              Private Ledger
            </p>
          </div>
        </div>
      </div>

      {/* Primary Action Button (Prominent, High-Contrast Fintech CTA) */}
      <div className="px-5 pt-5 pb-3 space-y-2">
        <button
          type="button"
          onClick={onOpenExpense}
          className="w-full py-2.5 px-4 bg-[#065F46] hover:bg-[#047857] active:scale-[0.99] text-white rounded-xl text-xs font-semibold tracking-wide shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Expense</span>
        </button>

        {/* Secondary Quick Action Row */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onOpenIncome}
            className="py-1.5 px-2.5 bg-[#F9FAFB] hover:bg-[#F3F4F6] text-[#1F2937] border border-[#E5E7EB] rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <TrendingUp className="w-3.5 h-3.5 text-[#065F46]" />
            <span>Income</span>
          </button>
          <button
            type="button"
            onClick={onOpenTransfer}
            className="py-1.5 px-2.5 bg-[#F9FAFB] hover:bg-[#F3F4F6] text-[#1F2937] border border-[#E5E7EB] rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-[#4B5563]" />
            <span>Transfer</span>
          </button>
        </div>
      </div>

      {/* Month Navigator Bar */}
      <div className="px-5 py-2">
        <div className="flex items-center justify-between bg-[#F8F9FA] rounded-xl px-2.5 py-1.5 border border-[#EBECEF]">
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Previous month"
            className="p-1 rounded-md text-[#6B7280] hover:text-[#111318] hover:bg-white transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-semibold text-[#1F2937] tabular-nums">
            {formatMonthTitle(selectedMonth)}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Next month"
            className="p-1 rounded-md text-[#6B7280] hover:text-[#111318] hover:bg-white transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Primary Navigation Menu */}
      <nav className="flex-1 overflow-y-auto px-3.5 py-3 space-y-0.5">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#ECFDF5] text-[#065F46] font-bold shadow-xs'
                  : 'text-[#4B5563] hover:text-[#111318] hover:bg-[#F8F9FA]'
              }`}
            >
              <Icon
                className={`w-4 h-4 transition-colors ${
                  isActive ? 'text-[#065F46] stroke-[2.2]' : 'text-[#6B7280]'
                }`}
              />
              <span className="flex-1 text-left">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Petrol Budget Quick-Glance Micro-Card */}
      <div className="p-4 border-t border-[#F0F1F3]">
        <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#EFE8DC] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#854D0E] flex items-center gap-1.5">
              <Fuel className="w-3.5 h-3.5 text-[#B45309]" />
              College Petrol
            </span>
            <span className={`text-[10px] font-bold tabular-nums ${petrolExceeded ? 'text-[#DC2626]' : 'text-[#854D0E]'}`}>
              {petrolPercentage}%
            </span>
          </div>

          <div className="w-full bg-[#EADDCE] h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                petrolExceeded ? 'bg-[#DC2626]' : petrolPercentage >= 80 ? 'bg-[#D97706]' : 'bg-[#059669]'
              }`}
              style={{ width: `${Math.min(petrolPercentage, 100)}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[10px] text-[#713F12]">
            <span>{petrolExceeded ? 'Exceeded' : 'Remaining'}</span>
            <span className="font-bold tabular-nums text-[#1F2937]">
              {formatINR(petrolRemainingPaise)}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
