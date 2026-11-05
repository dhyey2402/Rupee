export interface Account {
  id: string;
  name: string;
  type: 'petrol' | 'spending' | 'custom' | 'savings' | 'archived_savings';
  balance_paise: number;
  available_money_paise?: number;
  color: string;
  icon: string;
  is_system: number;
  created_at: string;
  monthly_spent_paise?: number;
  budget?: Budget | null;
}

export interface SavingsRecord {
  id: string;
  amount_paise: number;
  source_account_id?: string | null;
  source_account_name: string;
  date: string;
  notes?: string | null;
  created_at: string;
}

export interface SavingsSummary {
  totalSavedPaise: number;
  byAccount: {
    source_account_name: string;
    total_paise: number;
    count: number;
  }[];
  records: SavingsRecord[];
}

export interface Budget {
  id: string;
  name: string;
  linked_account_id?: string | null;
  category_id?: string | null;
  amount_paise: number;
  period: 'monthly' | 'weekly' | 'custom';
  start_date: string;
  end_date?: string | null;
  is_paused: number;
  created_at: string;
  spent_paise?: number;
  remaining_paise?: number;
  percentage?: number;
  is_exceeded?: boolean;
  exceeded_by_paise?: number;
  account_name?: string;
  category_name?: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'expense' | 'income';
  icon: string;
  color: string;
  is_system: number;
}

export interface IncomeAllocation {
  id: string;
  income_id: string;
  account_id: string;
  amount_paise: number;
  created_at: string;
  account_name?: string;
  account_color?: string;
}

export interface Income {
  id: string;
  amount_paise: number;
  source: string;
  date: string;
  description?: string | null;
  allocated_paise: number;
  unallocated_paise: number;
  created_at: string;
  allocations?: IncomeAllocation[];
}

export interface Transfer {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount_paise: number;
  date: string;
  note?: string | null;
  created_at: string;
  from_account_name?: string;
  from_account_color?: string;
  to_account_name?: string;
  to_account_color?: string;
}

export interface Transaction {
  id: string;
  type: 'expense' | 'income_allocation' | 'transfer_out' | 'transfer_in' | 'savings_sweep' | 'direct_deposit' | 'balance_adjustment';
  account_id: string;
  amount_paise: number;
  category_id?: string | null;
  date: string;
  description: string;
  merchant?: string | null;
  notes?: string | null;
  related_transfer_id?: string | null;
  related_income_id?: string | null;
  created_at: string;
  account_name?: string;
  account_color?: string;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  litres?: number | null;
  price_per_litre?: number | null;
  odometer?: number | null;
  fuel_station?: string | null;
}

export interface PetrolLog {
  id: string;
  transaction_id: string;
  expense_paise: number;
  litres?: number | null;
  price_per_litre?: number | null;
  odometer?: number | null;
  fuel_station?: string | null;
  date: string;
  notes?: string | null;
  created_at: string;
  description?: string;
  merchant?: string;
  account_name?: string;
}

export interface BootstrapData {
  month: string;
  startDate: string;
  endDate: string;
  summary: {
    totalMoneyPaise: number;
    totalAccountBalancePaise: number;
    unallocatedPaise: number;
    totalSavingsPaise: number;
    availableSpendingPaise: number;
    availablePetrolPaise?: number;
    monthlyIncomePaise: number;
    monthlyExpensePaise: number;
  };
  savings: SavingsSummary;
  accounts: Account[];
  budgets: Budget[];
  categories: Category[];
  settings: Record<string, string>;
  recentTransactions: Transaction[];
  categoryBreakdown: {
    id: string;
    name: string;
    color: string;
    icon: string;
    total_paise: number;
  }[];
  petrolOverview: {
    spentPaise: number;
    txCount: number;
    litres: number;
  };
}
