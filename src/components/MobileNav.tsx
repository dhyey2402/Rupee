import React from 'react';
import {
  LayoutDashboard,
  Wallet,
  ReceiptText,
  Target,
  BarChart3,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { NavTab } from './Sidebar';

interface MobileNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  onOpenExpense: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  onSelectTab,
  selectedMonth,
  onMonthChange,
  onOpenExpense,
}) => {
  const [y, m] = selectedMonth.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const monthName = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const handlePrev = () => {
    const prev = new Date(y, m - 2, 1);
    onMonthChange(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNext = () => {
    const next = new Date(y, m, 1);
    onMonthChange(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };

  const tabs = [
    { id: 'overview' as NavTab, label: 'Overview', icon: LayoutDashboard },
    { id: 'accounts' as NavTab, label: 'Accounts', icon: Wallet },
    { id: 'activity' as NavTab, label: 'Activity', icon: ReceiptText },
    { id: 'budgets' as NavTab, label: 'Budgets', icon: Target },
    { id: 'insights' as NavTab, label: 'Insights', icon: BarChart3 },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Top Header */}
      <header className="lg:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-[#EAEBED] shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#065F46] text-white flex items-center justify-center font-bold text-xs shadow-xs">
            ₹
          </div>
          <span className="font-bold text-sm text-[#111318] tracking-tight">Money Manager</span>
        </div>

        {/* Month Stepper */}
        <div className="flex items-center gap-1 bg-[#F8F9FA] px-2 py-1 rounded-lg border border-[#EBECEF] text-xs font-semibold text-[#1F2937]">
          <button
            onClick={handlePrev}
            aria-label="Previous month"
            className="p-1 text-[#6B7280] hover:text-[#111318]"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] px-1 font-semibold tabular-nums">{monthName}</span>
          <button
            onClick={handleNext}
            aria-label="Next month"
            className="p-1 text-[#6B7280] hover:text-[#111318]"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Floating Action Button on Mobile */}
      <div className="lg:hidden fixed bottom-20 right-4 z-50">
        <button
          onClick={onOpenExpense}
          className="w-13 h-13 rounded-2xl bg-[#065F46] text-white flex items-center justify-center shadow-lg shadow-[#065F46]/30 active:scale-95 transition-all cursor-pointer"
          aria-label="Add expense"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#EAEBED] py-1 px-2 flex justify-around items-center shadow-md pb-[env(safe-area-inset-bottom,8px)]">
        {tabs.map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelectTab(t.id)}
              className={`flex flex-col items-center justify-center min-w-[50px] py-1.5 px-1 rounded-lg text-[10px] font-medium transition-colors ${
                isActive ? 'text-[#065F46] font-bold' : 'text-[#6B7280] hover:text-[#111318]'
              }`}
            >
              <Icon
                className={`w-4 h-4 mb-0.5 ${
                  isActive ? 'text-[#065F46] stroke-[2.2]' : 'text-[#6B7280]'
                }`}
              />
              <span className="truncate">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
