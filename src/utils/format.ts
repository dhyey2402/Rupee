import { Transaction } from '../types';

export function paiseToInr(paise: number): number {
  return paise / 100;
}

export function inrToPaise(inr: number | string): number {
  if (typeof inr === 'string') {
    const clean = inr.replace(/[^0-9.]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : Math.round(num * 100);
  }
  return Math.round(inr * 100);
}

export function formatINR(paise: number, includeDecimals = true): string {
  const inr = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: includeDecimals ? (paise % 100 === 0 ? 0 : 2) : 0,
    maximumFractionDigits: 2,
  }).format(inr);
}

export interface SplitCurrency {
  symbol: string;
  integer: string;
  decimal: string;
  isNegative: boolean;
  formatted: string;
}

export function splitINR(paise: number, forceDecimals = true): SplitCurrency {
  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const inr = absPaise / 100;

  const parts = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts(inr);

  let symbol = '₹';
  let integer = '0';
  let decimal = '00';

  parts.forEach(p => {
    if (p.type === 'currency') symbol = p.value;
    else if (p.type === 'integer' || p.type === 'group') {
      integer = (integer === '0' ? '' : integer) + p.value;
    } else if (p.type === 'fraction') {
      decimal = p.value;
    }
  });

  return {
    symbol,
    integer: integer || '0',
    decimal,
    isNegative,
    formatted: `${isNegative ? '-' : ''}${symbol}${integer}.${decimal}`
  };
}

export function formatINRCompact(paise: number): string {
  const inr = paise / 100;
  if (Math.abs(inr) >= 10000000) {
    return `₹${(inr / 10000000).toFixed(2)} Cr`;
  }
  if (Math.abs(inr) >= 100000) {
    return `₹${(inr / 100000).toFixed(2)} L`;
  }
  if (Math.abs(inr) >= 1000) {
    return `₹${(inr / 1000).toFixed(1)}k`;
  }
  return formatINR(paise, false);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

export function formatRelativeDate(dateStr: string): string {
  if (!dateStr) return '';
  const today = getTodayDateString();
  if (dateStr === today) return 'Today';

  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yesterday = d.toISOString().split('T')[0];
  if (dateStr === yesterday) return 'Yesterday';

  return formatDate(dateStr);
}

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentMonthString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getBudgetResetInfo(currentMonthStr: string) {
  const [y, m] = currentMonthStr.split('-').map(Number);
  const now = new Date();
  const lastDayOfMonth = new Date(y, m, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  
  // Next month first date
  const nextMonth = new Date(y, m, 1);
  const nextMonthName = nextMonth.toLocaleDateString('en-US', { month: 'short' });

  // Calculate days remaining in that month
  let daysRemaining = 0;
  if (now.getFullYear() === y && now.getMonth() + 1 === m) {
    daysRemaining = Math.max(0, daysInMonth - now.getDate());
  } else if (new Date(y, m - 1, 1) > now) {
    daysRemaining = daysInMonth;
  } else {
    daysRemaining = 0;
  }

  return {
    resetDateLabel: `Resets ${nextMonthName} 1`,
    daysRemaining,
    daysInMonth,
  };
}

export interface GroupedTransactions {
  dateLabel: string;
  rawDate: string;
  transactions: Transaction[];
  totalPaise: number;
}

export function groupTransactionsByDate(transactions: Transaction[]): GroupedTransactions[] {
  const groups: Record<string, Transaction[]> = {};
  
  transactions.forEach(tx => {
    if (!groups[tx.date]) {
      groups[tx.date] = [];
    }
    groups[tx.date].push(tx);
  });

  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return sortedDates.map(date => {
    const txs = groups[date];
    const totalPaise = txs.reduce((sum, t) => {
      if (t.type === 'expense') return sum - t.amount_paise;
      if (t.type === 'income_allocation') return sum + t.amount_paise;
      return sum;
    }, 0);

    return {
      dateLabel: formatRelativeDate(date),
      rawDate: date,
      transactions: txs,
      totalPaise,
    };
  });
}
