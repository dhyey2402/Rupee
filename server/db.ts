import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

// Ensure data directory exists
const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'moneymanager.db');

export const db = new DatabaseSync(DB_PATH);

// Enable WAL mode and foreign keys for performance and reliability
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
`);

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- 'bank', 'spending', 'cash', 'custom'
      balance_paise INTEGER NOT NULL DEFAULT 0,
      color TEXT NOT NULL DEFAULT '#0ea5e9',
      icon TEXT NOT NULL DEFAULT 'Wallet',
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'expense', -- 'expense', 'income'
      icon TEXT NOT NULL DEFAULT 'Tag',
      color TEXT NOT NULL DEFAULT '#64748b',
      is_system INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      linked_account_id TEXT,
      category_id TEXT,
      amount_paise INTEGER NOT NULL,
      period TEXT NOT NULL DEFAULT 'monthly', -- 'monthly', 'weekly', 'custom'
      start_date TEXT NOT NULL,
      end_date TEXT,
      is_paused INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (linked_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS incomes (
      id TEXT PRIMARY KEY,
      amount_paise INTEGER NOT NULL,
      source TEXT NOT NULL,
      date TEXT NOT NULL,
      description TEXT,
      allocated_paise INTEGER NOT NULL DEFAULT 0,
      unallocated_paise INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS income_allocations (
      id TEXT PRIMARY KEY,
      income_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      amount_paise INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (income_id) REFERENCES incomes(id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transfers (
      id TEXT PRIMARY KEY,
      from_account_id TEXT NOT NULL,
      to_account_id TEXT NOT NULL,
      amount_paise INTEGER NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (from_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL, -- 'expense', 'income_allocation', 'transfer_out', 'transfer_in'
      account_id TEXT NOT NULL,
      amount_paise INTEGER NOT NULL,
      category_id TEXT,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      merchant TEXT,
      notes TEXT,
      related_transfer_id TEXT,
      related_income_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (related_transfer_id) REFERENCES transfers(id) ON DELETE CASCADE,
      FOREIGN KEY (related_income_id) REFERENCES incomes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS petrol_logs (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      expense_paise INTEGER NOT NULL,
      litres REAL,
      price_per_litre REAL,
      odometer REAL,
      fuel_station TEXT,
      date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS savings_records (
      id TEXT PRIMARY KEY,
      amount_paise INTEGER NOT NULL,
      source_account_id TEXT,
      source_account_name TEXT NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (source_account_id) REFERENCES accounts(id) ON DELETE SET NULL
    );
  `);

  // Seed default categories if empty
  const countCategoriesStmt = db.prepare('SELECT COUNT(*) as count FROM categories');
  const catResult = countCategoriesStmt.get() as { count: number };
  if (catResult.count === 0) {
    const defaultCategories = [
      { id: 'cat-petrol', name: 'Petrol', type: 'expense', icon: 'Fuel', color: '#f59e0b', is_system: 1 },
      { id: 'cat-food', name: 'Food & Dining', type: 'expense', icon: 'Utensils', color: '#ef4444', is_system: 1 },
      { id: 'cat-shopping', name: 'Shopping', type: 'expense', icon: 'ShoppingBag', color: '#ec4899', is_system: 1 },
      { id: 'cat-travel', name: 'Travel & Commute', type: 'expense', icon: 'Bus', color: '#8b5cf6', is_system: 1 },
      { id: 'cat-education', name: 'Education & College', type: 'expense', icon: 'GraduationCap', color: '#3b82f6', is_system: 1 },
      { id: 'cat-subscriptions', name: 'Subscriptions', type: 'expense', icon: 'Tv', color: '#6366f1', is_system: 1 },
      { id: 'cat-services', name: 'Services', type: 'expense', icon: 'Wrench', color: '#14b8a6', is_system: 1 },
      { id: 'cat-health', name: 'Health & Personal Care', type: 'expense', icon: 'HeartPulse', color: '#10b981', is_system: 1 },
      { id: 'cat-other', name: 'Other Expenses', type: 'expense', icon: 'MoreHorizontal', color: '#64748b', is_system: 1 },
      { id: 'cat-inc-it', name: 'IT Work', type: 'income', icon: 'Laptop', color: '#10b981', is_system: 1 },
      { id: 'cat-inc-pocket', name: 'Pocket Money', type: 'income', icon: 'Coins', color: '#06b6d4', is_system: 1 },
      { id: 'cat-inc-family', name: 'Family', type: 'income', icon: 'Users', color: '#8b5cf6', is_system: 1 },
      { id: 'cat-inc-other', name: 'Other Income', type: 'income', icon: 'PlusCircle', color: '#14b8a6', is_system: 1 }
    ];

    const insertCat = db.prepare(`
      INSERT INTO categories (id, name, type, icon, color, is_system)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const c of defaultCategories) {
      insertCat.run(c.id, c.name, c.type, c.icon, c.color, c.is_system);
    }
  }

  // Seed default settings if empty
  const countSettingsStmt = db.prepare('SELECT COUNT(*) as count FROM settings');
  const settingsResult = countSettingsStmt.get() as { count: number };
  if (settingsResult.count === 0) {
    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('allow_overdraft', 'false');
    insertSetting.run('currency_symbol', '₹');
    insertSetting.run('date_format', 'DD/MM/YYYY');
    insertSetting.run('is_onboarded', 'true');
  }

  // Seed exactly 3 primary financial accounts: Bank Account, Personal Spending, Cash
  const now = new Date().toISOString();
  const insertAccount = db.prepare(`
    INSERT OR IGNORE INTO accounts (id, name, type, balance_paise, color, icon, is_system, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 1. Bank Account (Tracks money in and out of bank, supports petrol expenses)
  insertAccount.run('acc-bank', 'Bank Account', 'bank', 0, '#0284c7', 'Building2', 1, now);
  // 2. Personal Spending (Food, shopping, personal needs - no spending limit or auto reset)
  insertAccount.run('acc-spending', 'Personal Spending', 'spending', 0, '#065F46', 'ShoppingBag', 1, now);
  // 3. Cash (Physical cash currently held)
  insertAccount.run('acc-cash', 'Cash', 'cash', 0, '#059669', 'Banknote', 1, now);

  // Safe Migration for existing data:
  // 1. Remove obsolete petrol budget setting
  db.prepare("DELETE FROM settings WHERE key = 'petrol_monthly_budget_paise'").run();

  // 2. Remove any spending limit or monthly budget on primary accounts
  db.prepare("DELETE FROM budgets WHERE linked_account_id IN ('acc-petrol', 'acc-spending', 'acc-bank', 'acc-cash') OR id = 'bgt-college-petrol'").run();

  // 3. Migrate legacy acc-petrol account -> acc-bank with cat-petrol
  const existingPetrolAcc = db.prepare("SELECT * FROM accounts WHERE id = 'acc-petrol'").get() as any;
  if (existingPetrolAcc) {
    // Reassign all transactions from acc-petrol to acc-bank
    db.prepare("UPDATE transactions SET account_id = 'acc-bank', category_id = COALESCE(category_id, 'cat-petrol') WHERE account_id = 'acc-petrol'").run();
    // Reassign transfers
    db.prepare("UPDATE transfers SET from_account_id = 'acc-bank' WHERE from_account_id = 'acc-petrol'").run();
    db.prepare("UPDATE transfers SET to_account_id = 'acc-bank' WHERE to_account_id = 'acc-petrol'").run();
    // If acc-petrol had any balance, move it to acc-bank
    if (existingPetrolAcc.balance_paise > 0) {
      db.prepare('UPDATE accounts SET balance_paise = balance_paise + ? WHERE id = ?').run(existingPetrolAcc.balance_paise, 'acc-bank');
    }
    // Delete acc-petrol
    db.prepare("DELETE FROM accounts WHERE id = 'acc-petrol'").run();
  }

  // 4. Migrate any existing Savings financial account to dedicated savings_records
  const existingSavingsAcc = db.prepare("SELECT * FROM accounts WHERE id = 'acc-savings' OR type = 'savings'").get() as any;
  if (existingSavingsAcc) {
    if (existingSavingsAcc.balance_paise > 0) {
      const existingMigrated = db.prepare("SELECT COUNT(*) as count FROM savings_records WHERE id = 'sav-migrated-initial'").get() as any;
      if (existingMigrated.count === 0) {
        const today = new Date().toISOString().split('T')[0];
        const nowIso = new Date().toISOString();
        db.prepare(`
          INSERT INTO savings_records (id, amount_paise, source_account_id, source_account_name, date, notes, created_at)
          VALUES ('sav-migrated-initial', ?, NULL, 'Initial Savings', ?, 'Migrated from previous savings account', ?)
        `).run(existingSavingsAcc.balance_paise, today, nowIso);
      }
    }

    // Check if any transactions or transfers reference this account
    const txCount = (db.prepare('SELECT COUNT(*) as count FROM transactions WHERE account_id = ?').get(existingSavingsAcc.id) as any).count;
    const trfCount = (db.prepare('SELECT COUNT(*) as count FROM transfers WHERE from_account_id = ? OR to_account_id = ?').get(existingSavingsAcc.id, existingSavingsAcc.id) as any).count;

    if (txCount === 0 && trfCount === 0) {
      db.prepare('DELETE FROM accounts WHERE id = ?').run(existingSavingsAcc.id);
    } else {
      // Archive account to preserve historical ledger FKs without displaying it as an active financial account
      db.prepare("UPDATE accounts SET type = 'archived_savings' WHERE id = ?").run(existingSavingsAcc.id);
    }
  }
}
