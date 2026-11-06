import { Router } from 'express';
import { db } from './db.js';
import { ai, getLiveFinancialContext, PERSONAS } from './gemini.js';

export const apiRouter = Router();

// Helper to get start and end dates for a month YYYY-MM
function getMonthBounds(monthStr?: string) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-indexed

  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
    const parts = monthStr.split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
  }

  const startDate = new Date(year, month, 1).toISOString().split('T')[0];
  const nextMonthFirst = new Date(year, month + 1, 1);
  const endDate = new Date(nextMonthFirst.getTime() - 86400000).toISOString().split('T')[0];
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  return { startDate, endDate, monthKey, year, month };
}

// Format paise to float currency for display/reports if needed
function paiseToInr(paise: number): number {
  return paise / 100;
}

// -------------------------------------------------------------
// GET /api/bootstrap
// Returns full state needed for the UI
// -------------------------------------------------------------
apiRouter.get('/bootstrap', (req, res) => {
  try {
    const monthQuery = typeof req.query.month === 'string' ? req.query.month : undefined;
    const { startDate, endDate, monthKey } = getMonthBounds(monthQuery);

    // Accounts (only active financial accounts: Bank Account, Personal Spending, Cash, and custom)
    const accounts = db.prepare("SELECT * FROM accounts WHERE type IN ('bank', 'spending', 'cash', 'custom') ORDER BY created_at ASC").all() as any[];

    // Categories
    const categories = db.prepare('SELECT * FROM categories ORDER BY type, name ASC').all() as any[];

    // Budgets (excluding any legacy account spending limits)
    const budgets = db.prepare("SELECT * FROM budgets WHERE is_paused = 0 AND (linked_account_id IS NULL OR linked_account_id NOT IN ('acc-bank', 'acc-spending', 'acc-cash', 'acc-petrol'))").all() as any[];

    // Settings
    const settingsRows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    settingsRows.forEach(row => {
      settings[row.key] = row.value;
    });

    // Unallocated income total
    const unallocatedStmt = db.prepare('SELECT COALESCE(SUM(unallocated_paise), 0) as total FROM incomes');
    const unallocatedPaise = ((unallocatedStmt.get() as any).total) || 0;

    // Monthly totals:
    // Income received in month:
    const monthlyIncomeStmt = db.prepare(`
      SELECT COALESCE(SUM(amount_paise), 0) as total
      FROM incomes
      WHERE date >= ? AND date <= ?
    `);
    const monthlyIncomePaise = (monthlyIncomeStmt.get(startDate, endDate) as any).total || 0;

    // Expenses in month:
    const monthlyExpenseStmt = db.prepare(`
      SELECT COALESCE(SUM(amount_paise), 0) as total
      FROM transactions
      WHERE type = 'expense' AND date >= ? AND date <= ?
    `);
    const monthlyExpensePaise = (monthlyExpenseStmt.get(startDate, endDate) as any).total || 0;

    // Total money across all financial accounts:
    const totalBalanceStmt = db.prepare("SELECT COALESCE(SUM(balance_paise), 0) as total FROM accounts WHERE type IN ('bank', 'spending', 'cash', 'custom')");
    const totalAccountBalancePaise = (totalBalanceStmt.get() as any).total || 0;
    const totalMoneyPaise = totalAccountBalancePaise + unallocatedPaise;

    // Savings from dedicated savings_records:
    const savingsStmt = db.prepare('SELECT COALESCE(SUM(amount_paise), 0) as total FROM savings_records');
    const totalSavingsPaise = (savingsStmt.get() as any).total || 0;

    const savingsByAccountStmt = db.prepare(`
      SELECT source_account_name, COALESCE(SUM(amount_paise), 0) as total_paise, COUNT(*) as count
      FROM savings_records
      GROUP BY source_account_name
      ORDER BY total_paise DESC
    `);
    const savingsByAccount = savingsByAccountStmt.all() as any[];
    const savingsRecords = db.prepare('SELECT * FROM savings_records ORDER BY date DESC, created_at DESC LIMIT 20').all() as any[];

    // Primary account balances
    const bankAcc = accounts.find((a: any) => a.type === 'bank');
    const spendingAcc = accounts.find((a: any) => a.type === 'spending');
    const cashAcc = accounts.find((a: any) => a.type === 'cash');
    const availableBankPaise = bankAcc ? bankAcc.balance_paise : 0;
    const availableSpendingPaise = spendingAcc ? spendingAcc.balance_paise : 0;
    const availableCashPaise = cashAcc ? cashAcc.balance_paise : 0;

    // Calculate budget utilization for categories if any exist
    const budgetListWithStats = budgets.map((b: any) => {
      let spentPaise = 0;
      if (b.category_id) {
        const stmt = db.prepare(`
          SELECT COALESCE(SUM(amount_paise), 0) as spent
          FROM transactions
          WHERE type = 'expense' AND category_id = ? AND date >= ? AND date <= ?
        `);
        spentPaise = (stmt.get(b.category_id, startDate, endDate) as any).spent || 0;
      }
      const remainingPaise = b.amount_paise - spentPaise;
      const percentage = b.amount_paise > 0 ? (spentPaise / b.amount_paise) * 100 : 0;
      const isExceeded = spentPaise > b.amount_paise;
      const exceededByPaise = isExceeded ? spentPaise - b.amount_paise : 0;

      return {
        ...b,
        spent_paise: spentPaise,
        remaining_paise: remainingPaise,
        percentage: Number(percentage.toFixed(1)),
        is_exceeded: isExceeded,
        exceeded_by_paise: exceededByPaise,
      };
    });

    // Account stats for this month
    // Both College Petrol and Personal Spending have the same 3 financial metrics:
    // 1. Current Balance (balance_paise)
    // 2. Spent This Month (monthly_spent_paise)
    // 3. Available Money (available_money_paise = balance_paise)
    const accountsWithStats = accounts.map((acc: any) => {
      // Calculate monthly spent
      const spentStmt = db.prepare(`
        SELECT COALESCE(SUM(amount_paise), 0) as spent
        FROM transactions
        WHERE type = 'expense' AND account_id = ? AND date >= ? AND date <= ?
      `);
      const spentPaise = (spentStmt.get(acc.id, startDate, endDate) as any).spent || 0;

      return {
        ...acc,
        monthly_spent_paise: spentPaise,
        available_money_paise: acc.balance_paise,
        budget: null, // Strictly no monthly spending limit or budget progress
      };
    });

    // Recent 10 transactions
    const recentTxStmt = db.prepare(`
      SELECT t.*, a.name as account_name, a.color as account_color, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      ORDER BY t.date DESC, t.created_at DESC
      LIMIT 10
    `);
    const recentTransactions = recentTxStmt.all();

    // Category breakdown for current month
    const categoryBreakdownStmt = db.prepare(`
      SELECT c.id, c.name, c.color, c.icon, COALESCE(SUM(t.amount_paise), 0) as total_paise
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.type = 'expense' AND t.date >= ? AND t.date <= ?
      GROUP BY c.id
      ORDER BY total_paise DESC
    `);
    const categoryBreakdown = categoryBreakdownStmt.all(startDate, endDate);

    // Petrol specific monthly summary (Petrol is an expense category tracked across accounts)
    const petrolSpentStmt = db.prepare(`
      SELECT COALESCE(SUM(t.amount_paise), 0) as spent, COUNT(t.id) as count
      FROM transactions t
      WHERE (t.category_id = 'cat-petrol' OR t.category_id IN (SELECT id FROM categories WHERE name LIKE '%Petrol%'))
        AND t.type = 'expense' AND t.date >= ? AND t.date <= ?
    `);
    const petrolStats = petrolSpentStmt.get(startDate, endDate) as any;
    const petrolLitresStmt = db.prepare(`
      SELECT COALESCE(SUM(litres), 0) as litres
      FROM petrol_logs
      WHERE date >= ? AND date <= ?
    `);
    const petrolLitres = (petrolLitresStmt.get(startDate, endDate) as any).litres || 0;

    res.json({
      month: monthKey,
      startDate,
      endDate,
      summary: {
        totalMoneyPaise,
        totalAccountBalancePaise,
        unallocatedPaise,
        totalSavingsPaise,
        availableSpendingPaise,
        availableBankPaise,
        availableCashPaise,
        availablePetrolPaise: 0,
        monthlyIncomePaise,
        monthlyExpensePaise,
      },
      savings: {
        totalSavedPaise: totalSavingsPaise,
        byAccount: savingsByAccount,
        records: savingsRecords,
      },
      accounts: accountsWithStats,
      budgets: budgetListWithStats,
      categories,
      settings,
      recentTransactions,
      categoryBreakdown,
      petrolOverview: {
        spentPaise: petrolStats.spent || 0,
        txCount: petrolStats.count || 0,
        litres: petrolLitres,
      }
    });
  } catch (err: any) {
    console.error('Error in /api/bootstrap:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// ACCOUNTS CRUD
// -------------------------------------------------------------
apiRouter.get('/accounts', (req, res) => {
  try {
    const accounts = db.prepare("SELECT * FROM accounts WHERE type IN ('bank', 'spending', 'cash', 'custom') ORDER BY created_at ASC").all();
    res.json(accounts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/accounts', (req, res) => {
  try {
    const { name, type, color, icon, initialBalancePaise = 0 } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Account name is required' });
    }

    if (type === 'savings') {
      return res.status(400).json({ error: 'Savings is a dedicated reference section, not a financial account' });
    }

    const id = `acc-${Date.now()}`;
    const now = new Date().toISOString();
    const balance = parseInt(initialBalancePaise, 10) || 0;

    db.exec('BEGIN TRANSACTION');
    try {
      db.prepare(`
        INSERT INTO accounts (id, name, type, balance_paise, color, icon, is_system, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?)
      `).run(id, name.trim(), type || 'custom', balance, color || '#6366f1', icon || 'Wallet', now);

      if (balance > 0) {
        // Record starting balance transaction as direct deposit
        db.prepare(`
          INSERT INTO transactions (id, type, account_id, amount_paise, date, description, created_at)
          VALUES (?, 'direct_deposit', ?, ?, ?, 'Initial Balance', ?)
        `).run(`tx-init-${Date.now()}`, id, balance, now.split('T')[0], now);
      }

      db.exec('COMMIT');
      res.json({ success: true, id });
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/accounts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, icon } = req.body;
    
    db.exec('BEGIN TRANSACTION');
    try {
      db.prepare(`
        UPDATE accounts
        SET name = COALESCE(?, name),
            color = COALESCE(?, color),
            icon = COALESCE(?, icon)
        WHERE id = ?
      `).run(name?.trim() ?? null, color ?? null, icon ?? null, id);

      db.exec('COMMIT');
      res.json({ success: true });
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/accounts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as any;
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    if (account.is_system) {
      return res.status(400).json({ error: 'Primary accounts (College Petrol and Personal Spending) cannot be deleted' });
    }
    if (account.balance_paise > 0) {
      return res.status(400).json({ error: `Cannot delete account with remaining balance of ₹${(account.balance_paise / 100).toFixed(2)}. Please transfer or spend the balance first.` });
    }

    db.exec('BEGIN TRANSACTION');
    try {
      db.prepare('DELETE FROM budgets WHERE linked_account_id = ?').run(id);
      db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
      db.exec('COMMIT');
      res.json({ success: true });
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Close out allocation for an account: sweeps all unused allocated money to Savings
apiRouter.post('/accounts/:id/close-allocation', (req, res) => {
  try {
    const { id } = req.params;
    const { notes, date } = req.body;
    const account = db.prepare("SELECT * FROM accounts WHERE id = ? AND type IN ('bank', 'spending', 'cash', 'custom')").get(id) as any;
    if (!account) {
      return res.status(404).json({ error: 'Financial account not found' });
    }
    if (account.balance_paise <= 0) {
      return res.status(400).json({ error: `Cannot close allocation: ${account.name} has no unused balance remaining to save.` });
    }

    const unusedPaise = account.balance_paise;
    const today = date || new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();
    const savId = `sav-${Date.now()}`;
    const txId = `tx-sav-${Date.now()}`;
    const defaultNote = notes?.trim() || `Unused ${account.name} allocation swept to savings`;

    db.exec('BEGIN TRANSACTION');
    try {
      // 1. Reset account balance to 0
      db.prepare('UPDATE accounts SET balance_paise = 0 WHERE id = ?').run(id);

      // 2. Insert into savings_records (adds to Savings total)
      db.prepare(`
        INSERT INTO savings_records (id, amount_paise, source_account_id, source_account_name, date, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(savId, unusedPaise, account.id, account.name, today, defaultNote, nowIso);

      // 3. Record transaction on account ledger as savings_sweep (NOT an expense, NOT income)
      db.prepare(`
        INSERT INTO transactions (id, type, account_id, amount_paise, date, description, notes, created_at)
        VALUES (?, 'savings_sweep', ?, ?, ?, ?, ?, ?)
      `).run(txId, account.id, unusedPaise, today, `Allocation closed -> Moved to Savings`, defaultNote, nowIso);

      db.exec('COMMIT');
      res.json({ success: true, savedPaise: unusedPaise, accountName: account.name });
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Directly add money to an account (supports both direct addition of already recorded money and new income)
apiRouter.post('/accounts/:id/add-money', (req, res) => {
  try {
    const { id } = req.params;
    const { amountPaise, isNewIncome = false, source = 'Direct Addition', description, date } = req.body;
    const parsedAmount = parseInt(amountPaise, 10);
    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Valid positive amount is required' });
    }

    const account = db.prepare("SELECT * FROM accounts WHERE id = ? AND type IN ('bank', 'spending', 'cash', 'custom')").get(id) as any;
    if (!account) {
      return res.status(404).json({ error: 'Financial account not found' });
    }

    const today = date || new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    db.exec('BEGIN TRANSACTION');
    try {
      if (isNewIncome) {
        // Create income record and allocate directly to this account
        const incId = `inc-${Date.now()}`;
        db.prepare(`
          INSERT INTO incomes (id, amount_paise, source, date, description, allocated_paise, unallocated_paise, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?)
        `).run(incId, parsedAmount, source.trim(), today, description?.trim() || null, parsedAmount, nowIso);

        db.prepare(`
          INSERT INTO income_allocations (id, income_id, account_id, amount_paise, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(`alloc-${Date.now()}`, incId, id, parsedAmount, nowIso);

        db.prepare('UPDATE accounts SET balance_paise = balance_paise + ? WHERE id = ?')
          .run(parsedAmount, id);

        db.prepare(`
          INSERT INTO transactions (id, type, account_id, amount_paise, date, description, related_income_id, created_at)
          VALUES (?, 'income_allocation', ?, ?, ?, ?, ?, ?)
        `).run(`tx-inc-${Date.now()}`, id, parsedAmount, today, `Income: ${source}${description ? ' - ' + description : ''}`, incId, nowIso);
      } else {
        // Direct addition of already recorded money: avoids double counting income!
        db.prepare('UPDATE accounts SET balance_paise = balance_paise + ? WHERE id = ?')
          .run(parsedAmount, id);

        const desc = description?.trim() || `Added funds to ${account.name} (Direct / already recorded)`;
        db.prepare(`
          INSERT INTO transactions (id, type, account_id, amount_paise, date, description, created_at)
          VALUES (?, 'direct_deposit', ?, ?, ?, ?, ?)
        `).run(`tx-dep-${Date.now()}`, id, parsedAmount, today, desc, nowIso);
      }

      db.exec('COMMIT');
      res.json({ success: true, newBalancePaise: account.balance_paise + parsedAmount });
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Manually set available balance for an account
apiRouter.post('/accounts/:id/set-balance', (req, res) => {
  try {
    const { id } = req.params;
    const { targetBalancePaise, notes } = req.body;
    const newBalance = parseInt(targetBalancePaise, 10);
    if (isNaN(newBalance) || newBalance < 0) {
      return res.status(400).json({ error: 'Valid non-negative balance is required' });
    }

    const account = db.prepare("SELECT * FROM accounts WHERE id = ? AND type IN ('bank', 'spending', 'cash', 'custom')").get(id) as any;
    if (!account) {
      return res.status(404).json({ error: 'Financial account not found' });
    }

    const diff = newBalance - account.balance_paise;
    const today = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    db.exec('BEGIN TRANSACTION');
    try {
      db.prepare('UPDATE accounts SET balance_paise = ? WHERE id = ?').run(newBalance, id);

      if (diff !== 0) {
        const desc = notes?.trim() || `Balance adjusted from ₹${(account.balance_paise / 100).toFixed(2)} to ₹${(newBalance / 100).toFixed(2)}`;
        db.prepare(`
          INSERT INTO transactions (id, type, account_id, amount_paise, date, description, notes, created_at)
          VALUES (?, 'balance_adjustment', ?, ?, ?, ?, ?, ?)
        `).run(`tx-adj-${Date.now()}`, id, Math.abs(diff), today, desc, notes?.trim() || null, nowIso);
      }

      db.exec('COMMIT');
      res.json({ success: true, balancePaise: newBalance });
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// DEDICATED SAVINGS REFERENCE ENDPOINT
// -------------------------------------------------------------
apiRouter.get('/savings', (req, res) => {
  try {
    const totalStmt = db.prepare('SELECT COALESCE(SUM(amount_paise), 0) as total FROM savings_records');
    const totalSavedPaise = (totalStmt.get() as any).total || 0;

    const byAccountStmt = db.prepare(`
      SELECT source_account_name, COALESCE(SUM(amount_paise), 0) as total_paise, COUNT(*) as count
      FROM savings_records
      GROUP BY source_account_name
      ORDER BY total_paise DESC
    `);
    const byAccount = byAccountStmt.all();

    const recordsStmt = db.prepare('SELECT * FROM savings_records ORDER BY date DESC, created_at DESC');
    const records = recordsStmt.all();

    res.json({
      totalSavedPaise,
      byAccount,
      records
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// TRANSACTIONS CRUD (Expenses & Table Filters)
// -------------------------------------------------------------
apiRouter.get('/transactions', (req, res) => {
  try {
    const { accountId, type, categoryId, startDate, endDate, minAmount, maxAmount, search, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT t.*, a.name as account_name, a.color as account_color,
             c.name as category_name, c.icon as category_icon, c.color as category_color,
             pl.litres, pl.price_per_litre, pl.odometer, pl.fuel_station
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN petrol_logs pl ON pl.transaction_id = t.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (accountId) {
      query += ` AND t.account_id = ?`;
      params.push(accountId);
    }
    if (type) {
      query += ` AND t.type = ?`;
      params.push(type);
    }
    if (categoryId) {
      query += ` AND t.category_id = ?`;
      params.push(categoryId);
    }
    if (startDate) {
      query += ` AND t.date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND t.date <= ?`;
      params.push(endDate);
    }
    if (minAmount) {
      query += ` AND t.amount_paise >= ?`;
      params.push(parseInt(minAmount as string, 10));
    }
    if (maxAmount) {
      query += ` AND t.amount_paise <= ?`;
      params.push(parseInt(maxAmount as string, 10));
    }
    if (search && typeof search === 'string' && search.trim()) {
      query += ` AND (t.description LIKE ? OR t.merchant LIKE ? OR t.notes LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ` ORDER BY t.date DESC, t.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit as string, 10), parseInt(offset as string, 10));

    const transactions = db.prepare(query).all(...params);
    res.json(transactions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Record an expense
apiRouter.post('/transactions/expense', (req, res) => {
  try {
    const {
      accountId,
      amountPaise,
      categoryId,
      date,
      description,
      merchant,
      notes,
      allowOverdraft = false,
      petrolDetails // optional: { litres, pricePerLitre, odometer, fuelStation }
    } = req.body;

    if (!accountId || !amountPaise || amountPaise <= 0 || !description || !date) {
      return res.status(400).json({ error: 'Account, positive amount, description, and date are required' });
    }

    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as any;
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Check overdraft
    const parsedAmount = parseInt(amountPaise, 10);
    if (account.balance_paise < parsedAmount && !allowOverdraft) {
      const settingsOverdraft = db.prepare("SELECT value FROM settings WHERE key = 'allow_overdraft'").get() as any;
      if (settingsOverdraft?.value !== 'true') {
        return res.status(400).json({
          error: 'INSUFFICIENT_BALANCE',
          message: `Insufficient funds! Current balance in ${account.name} is ₹${(account.balance_paise / 100).toFixed(2)}, but expense is ₹${(parsedAmount / 100).toFixed(2)}.`,
          currentBalancePaise: account.balance_paise,
          deficitPaise: parsedAmount - account.balance_paise,
        });
      }
    }

    const txId = `tx-exp-${Date.now()}`;
    const now = new Date().toISOString();

    db.exec('BEGIN TRANSACTION');
    try {
      // 1. Deduct from account balance
      db.prepare('UPDATE accounts SET balance_paise = balance_paise - ? WHERE id = ?')
        .run(parsedAmount, accountId);

      // 2. Insert transaction
      db.prepare(`
        INSERT INTO transactions (id, type, account_id, amount_paise, category_id, date, description, merchant, notes, created_at)
        VALUES (?, 'expense', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(txId, accountId, parsedAmount, categoryId || null, date, description.trim(), merchant?.trim() || null, notes?.trim() || null, now);

      // 3. Insert petrol log if provided or if petrol category
      if (petrolDetails) {
        db.prepare(`
          INSERT INTO petrol_logs (id, transaction_id, expense_paise, litres, price_per_litre, odometer, fuel_station, date, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          `petrol-${Date.now()}`,
          txId,
          parsedAmount,
          petrolDetails.litres ? parseFloat(petrolDetails.litres) : null,
          petrolDetails.pricePerLitre ? parseFloat(petrolDetails.pricePerLitre) : null,
          petrolDetails.odometer ? parseFloat(petrolDetails.odometer) : null,
          petrolDetails.fuelStation?.trim() || null,
          date,
          notes?.trim() || null,
          now
        );
      }

      db.exec('COMMIT');
      res.json({ success: true, transactionId: txId });
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Edit a transaction
apiRouter.put('/transactions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { amountPaise, categoryId, date, description, merchant, notes, accountId } = req.body;

    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as any;
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    db.exec('BEGIN TRANSACTION');
    try {
      if (tx.type === 'expense') {
        const newAmount = parseInt(amountPaise, 10);
        const targetAccountId = accountId || tx.account_id;

        // Revert old account deduction
        db.prepare('UPDATE accounts SET balance_paise = balance_paise + ? WHERE id = ?')
          .run(tx.amount_paise, tx.account_id);

        // Apply new deduction
        db.prepare('UPDATE accounts SET balance_paise = balance_paise - ? WHERE id = ?')
          .run(newAmount, targetAccountId);

        // Update transaction
        db.prepare(`
          UPDATE transactions
          SET account_id = ?,
              amount_paise = ?,
              category_id = ?,
              date = ?,
              description = ?,
              merchant = ?,
              notes = ?
          WHERE id = ?
        `).run(targetAccountId, newAmount, categoryId || null, date, description.trim(), merchant?.trim() || null, notes?.trim() || null, id);

        // Update petrol log if exists
        db.prepare('UPDATE petrol_logs SET expense_paise = ?, date = ? WHERE transaction_id = ?')
          .run(newAmount, date, id);
      } else {
        // Just update metadata for transfer/income allocations
        db.prepare(`
          UPDATE transactions
          SET date = COALESCE(?, date),
              description = COALESCE(?, description),
              notes = COALESCE(?, notes)
          WHERE id = ?
        `).run(date ?? null, description?.trim() ?? null, notes?.trim() ?? null, id);
      }

      db.exec('COMMIT');
      res.json({ success: true });
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a transaction (atomic balance reversal)
apiRouter.delete('/transactions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as any;
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    db.exec('BEGIN TRANSACTION');
    try {
      if (tx.type === 'expense') {
        // Reverse expense: add back balance
        db.prepare('UPDATE accounts SET balance_paise = balance_paise + ? WHERE id = ?')
          .run(tx.amount_paise, tx.account_id);
        db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
      } else if (tx.type === 'income_allocation') {
        // Reverse allocation: subtract balance from account and return to unallocated
        db.prepare('UPDATE accounts SET balance_paise = balance_paise - ? WHERE id = ?')
          .run(tx.amount_paise, tx.account_id);
        if (tx.related_income_id) {
          db.prepare(`
            UPDATE incomes
            SET allocated_paise = allocated_paise - ?,
                unallocated_paise = unallocated_paise + ?
            WHERE id = ?
          `).run(tx.amount_paise, tx.amount_paise, tx.related_income_id);
        }
        db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
      } else if (tx.type === 'transfer_out' || tx.type === 'transfer_in') {
        if (tx.related_transfer_id) {
          const transfer = db.prepare('SELECT * FROM transfers WHERE id = ?').get(tx.related_transfer_id) as any;
          if (transfer) {
            // Revert sender balance (+ amount)
            db.prepare('UPDATE accounts SET balance_paise = balance_paise + ? WHERE id = ?')
              .run(transfer.amount_paise, transfer.from_account_id);
            // Revert receiver balance (- amount)
            db.prepare('UPDATE accounts SET balance_paise = balance_paise - ? WHERE id = ?')
              .run(transfer.amount_paise, transfer.to_account_id);
            // Delete related transactions and transfer
            db.prepare('DELETE FROM transactions WHERE related_transfer_id = ?').run(transfer.id);
            db.prepare('DELETE FROM transfers WHERE id = ?').run(transfer.id);
          }
        }
      } else if (tx.type === 'savings_sweep') {
        // Reverse savings sweep: return swept funds back to the account and remove from savings records
        db.prepare('UPDATE accounts SET balance_paise = balance_paise + ? WHERE id = ?')
          .run(tx.amount_paise, tx.account_id);
        const record = db.prepare('SELECT id FROM savings_records WHERE source_account_id = ? AND amount_paise = ? ORDER BY created_at DESC LIMIT 1').get(tx.account_id, tx.amount_paise) as any;
        if (record) {
          db.prepare('DELETE FROM savings_records WHERE id = ?').run(record.id);
        }
        db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
      } else if (tx.type === 'direct_deposit' || tx.type === 'balance_adjustment') {
        db.prepare('UPDATE accounts SET balance_paise = balance_paise - ? WHERE id = ?')
          .run(tx.amount_paise, tx.account_id);
        db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
      }

      db.exec('COMMIT');
      res.json({ success: true });
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// INCOME & MONEY ALLOCATION
// -------------------------------------------------------------
apiRouter.get('/incomes', (req, res) => {
  try {
    const incomes = db.prepare('SELECT * FROM incomes ORDER BY date DESC, created_at DESC').all() as any[];
    const allocations = db.prepare(`
      SELECT ia.*, a.name as account_name, a.color as account_color
      FROM income_allocations ia
      JOIN accounts a ON ia.account_id = a.id
    `).all() as any[];

    const result = incomes.map(inc => ({
      ...inc,
      allocations: allocations.filter(a => a.income_id === inc.id)
    }));
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Record new income and optionally allocate it across accounts
apiRouter.post('/incomes', (req, res) => {
  try {
    const {
      amountPaise,
      source,
      date,
      description,
      allocations = [] // array of { accountId: string, amountPaise: number }
    } = req.body;

    const totalIncomePaise = parseInt(amountPaise, 10);
    if (!totalIncomePaise || totalIncomePaise <= 0 || !source || !date) {
      return res.status(400).json({ error: 'Valid income amount, source, and date are required' });
    }

    // Verify allocations do not exceed income
    let allocatedTotal = 0;
    for (const alloc of allocations) {
      const aAmt = parseInt(alloc.amountPaise, 10);
      if (aAmt > 0) allocatedTotal += aAmt;
    }

    if (allocatedTotal > totalIncomePaise) {
      return res.status(400).json({
        error: `Sum of allocated amounts (₹${(allocatedTotal / 100).toFixed(2)}) cannot exceed total income (₹${(totalIncomePaise / 100).toFixed(2)})`
      });
    }

    const unallocatedPaise = totalIncomePaise - allocatedTotal;
    const incomeId = `inc-${Date.now()}`;
    const now = new Date().toISOString();

    db.exec('BEGIN TRANSACTION');
    try {
      // 1. Insert income record
      db.prepare(`
        INSERT INTO incomes (id, amount_paise, source, date, description, allocated_paise, unallocated_paise, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(incomeId, totalIncomePaise, source.trim(), date, description?.trim() || null, allocatedTotal, unallocatedPaise, now);

      // 2. Process allocations
      for (const alloc of allocations) {
        const aAmt = parseInt(alloc.amountPaise, 10);
        if (aAmt > 0) {
          const allocId = `alloc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          
          // Insert allocation record
          db.prepare(`
            INSERT INTO income_allocations (id, income_id, account_id, amount_paise, created_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(allocId, incomeId, alloc.accountId, aAmt, now);

          // Update destination account balance
          db.prepare('UPDATE accounts SET balance_paise = balance_paise + ? WHERE id = ?')
            .run(aAmt, alloc.accountId);

          // Record transaction on account
          const txDesc = `Income: ${source}${description ? ' - ' + description : ''}`;
          db.prepare(`
            INSERT INTO transactions (id, type, account_id, amount_paise, date, description, related_income_id, created_at)
            VALUES (?, 'income_allocation', ?, ?, ?, ?, ?, ?)
          `).run(`tx-inc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, alloc.accountId, aAmt, date, txDesc, incomeId, now);
        }
      }

      db.exec('COMMIT');
      res.json({ success: true, incomeId, allocatedTotal, unallocatedPaise });
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Allocate remaining unallocated funds from an existing income
apiRouter.post('/incomes/:id/allocate', (req, res) => {
  try {
    const { id } = req.params;
    const { allocations = [] } = req.body; // array of { accountId: string, amountPaise: number }

    const income = db.prepare('SELECT * FROM incomes WHERE id = ?').get(id) as any;
    if (!income) {
      return res.status(404).json({ error: 'Income record not found' });
    }

    let allocatingTotal = 0;
    for (const alloc of allocations) {
      const aAmt = parseInt(alloc.amountPaise, 10);
      if (aAmt > 0) allocatingTotal += aAmt;
    }

    if (allocatingTotal <= 0) {
      return res.status(400).json({ error: 'Must allocate a positive amount' });
    }

    if (allocatingTotal > income.unallocated_paise) {
      return res.status(400).json({
        error: `Cannot allocate ₹${(allocatingTotal / 100).toFixed(2)}; only ₹${(income.unallocated_paise / 100).toFixed(2)} is available to allocate from this income.`
      });
    }

    const now = new Date().toISOString();
    const today = now.split('T')[0];

    db.exec('BEGIN TRANSACTION');
    try {
      db.prepare(`
        UPDATE incomes
        SET allocated_paise = allocated_paise + ?,
            unallocated_paise = unallocated_paise - ?
        WHERE id = ?
      `).run(allocatingTotal, allocatingTotal, id);

      for (const alloc of allocations) {
        const aAmt = parseInt(alloc.amountPaise, 10);
        if (aAmt > 0) {
          const allocId = `alloc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          db.prepare(`
            INSERT INTO income_allocations (id, income_id, account_id, amount_paise, created_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(allocId, id, alloc.accountId, aAmt, now);

          db.prepare('UPDATE accounts SET balance_paise = balance_paise + ? WHERE id = ?')
            .run(aAmt, alloc.accountId);

          const txDesc = `Allocated from: ${income.source}`;
          db.prepare(`
            INSERT INTO transactions (id, type, account_id, amount_paise, date, description, related_income_id, created_at)
            VALUES (?, 'income_allocation', ?, ?, ?, ?, ?, ?)
          `).run(`tx-inc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, alloc.accountId, aAmt, today, txDesc, id, now);
        }
      }

      db.exec('COMMIT');
      res.json({ success: true });
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// TRANSFERS BETWEEN ACCOUNTS
// -------------------------------------------------------------
apiRouter.get('/transfers', (req, res) => {
  try {
    const transfers = db.prepare(`
      SELECT t.*, fa.name as from_account_name, fa.color as from_account_color,
             ta.name as to_account_name, ta.color as to_account_color
      FROM transfers t
      JOIN accounts fa ON t.from_account_id = fa.id
      JOIN accounts ta ON t.to_account_id = ta.id
      ORDER BY t.date DESC, t.created_at DESC
    `).all();
    res.json(transfers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/transfers', (req, res) => {
  try {
    const { fromAccountId, toAccountId, amountPaise, date, note, allowOverdraft = false } = req.body;
    const parsedAmount = parseInt(amountPaise, 10);

    if (!fromAccountId || !toAccountId || !parsedAmount || parsedAmount <= 0 || !date) {
      return res.status(400).json({ error: 'Source, destination, positive amount, and date are required' });
    }

    if (fromAccountId === toAccountId) {
      return res.status(400).json({ error: 'Source and destination accounts must be different' });
    }

    const fromAccount = db.prepare('SELECT * FROM accounts WHERE id = ?').get(fromAccountId) as any;
    const toAccount = db.prepare('SELECT * FROM accounts WHERE id = ?').get(toAccountId) as any;

    if (!fromAccount || !toAccount) {
      return res.status(404).json({ error: 'One or both accounts not found' });
    }

    // Overdraft check on source account
    if (fromAccount.balance_paise < parsedAmount && !allowOverdraft) {
      const settingsOverdraft = db.prepare("SELECT value FROM settings WHERE key = 'allow_overdraft'").get() as any;
      if (settingsOverdraft?.value !== 'true') {
        return res.status(400).json({
          error: 'INSUFFICIENT_BALANCE',
          message: `Cannot transfer ₹${(parsedAmount / 100).toFixed(2)}. ${fromAccount.name} only has ₹${(fromAccount.balance_paise / 100).toFixed(2)}.`,
          currentBalancePaise: fromAccount.balance_paise,
          deficitPaise: parsedAmount - fromAccount.balance_paise
        });
      }
    }

    const transferId = `trf-${Date.now()}`;
    const now = new Date().toISOString();

    db.exec('BEGIN TRANSACTION');
    try {
      // 1. Decrease fromAccount balance
      db.prepare('UPDATE accounts SET balance_paise = balance_paise - ? WHERE id = ?')
        .run(parsedAmount, fromAccountId);

      // 2. Increase toAccount balance
      db.prepare('UPDATE accounts SET balance_paise = balance_paise + ? WHERE id = ?')
        .run(parsedAmount, toAccountId);

      // 3. Record transfer
      db.prepare(`
        INSERT INTO transfers (id, from_account_id, to_account_id, amount_paise, date, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(transferId, fromAccountId, toAccountId, parsedAmount, date, note?.trim() || null, now);

      // 4. Record 2 matching transactions for history
      const descOut = `Transfer to ${toAccount.name}${note ? ' (' + note + ')' : ''}`;
      db.prepare(`
        INSERT INTO transactions (id, type, account_id, amount_paise, date, description, notes, related_transfer_id, created_at)
        VALUES (?, 'transfer_out', ?, ?, ?, ?, ?, ?, ?)
      `).run(`tx-to-${Date.now()}`, fromAccountId, parsedAmount, date, descOut, note?.trim() || null, transferId, now);

      const descIn = `Transfer from ${fromAccount.name}${note ? ' (' + note + ')' : ''}`;
      db.prepare(`
        INSERT INTO transactions (id, type, account_id, amount_paise, date, description, notes, related_transfer_id, created_at)
        VALUES (?, 'transfer_in', ?, ?, ?, ?, ?, ?, ?)
      `).run(`tx-ti-${Date.now()}`, toAccountId, parsedAmount, date, descIn, note?.trim() || null, transferId, now);

      db.exec('COMMIT');
      res.json({ success: true, transferId });
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// BUDGETS CRUD
// -------------------------------------------------------------
apiRouter.get('/budgets', (req, res) => {
  try {
    const monthQuery = typeof req.query.month === 'string' ? req.query.month : undefined;
    const { startDate, endDate } = getMonthBounds(monthQuery);

    const budgets = db.prepare(`
      SELECT b.*, a.name as account_name, c.name as category_name
      FROM budgets b
      LEFT JOIN accounts a ON b.linked_account_id = a.id
      LEFT JOIN categories c ON b.category_id = c.id
      ORDER BY b.created_at ASC
    `).all() as any[];

    const budgetsWithStats = budgets.map(b => {
      let spentPaise = 0;
      if (b.linked_account_id) {
        const stmt = db.prepare(`
          SELECT COALESCE(SUM(amount_paise), 0) as spent
          FROM transactions
          WHERE type = 'expense' AND account_id = ? AND date >= ? AND date <= ?
        `);
        spentPaise = (stmt.get(b.linked_account_id, startDate, endDate) as any).spent || 0;
      } else if (b.category_id) {
        const stmt = db.prepare(`
          SELECT COALESCE(SUM(amount_paise), 0) as spent
          FROM transactions
          WHERE type = 'expense' AND category_id = ? AND date >= ? AND date <= ?
        `);
        spentPaise = (stmt.get(b.category_id, startDate, endDate) as any).spent || 0;
      }
      const remainingPaise = b.amount_paise - spentPaise;
      const percentage = b.amount_paise > 0 ? (spentPaise / b.amount_paise) * 100 : 0;
      const isExceeded = spentPaise > b.amount_paise;
      const exceededByPaise = isExceeded ? spentPaise - b.amount_paise : 0;

      return {
        ...b,
        spent_paise: spentPaise,
        remaining_paise: remainingPaise,
        percentage: Number(percentage.toFixed(1)),
        is_exceeded: isExceeded,
        exceeded_by_paise: exceededByPaise,
      };
    });

    res.json(budgetsWithStats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/budgets', (req, res) => {
  try {
    const { name, linkedAccountId, categoryId, amountPaise, period = 'monthly', startDate, endDate } = req.body;
    const parsedAmount = parseInt(amountPaise, 10);

    if (!name || !parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Budget name and positive amount are required' });
    }

    if (!linkedAccountId && !categoryId) {
      return res.status(400).json({ error: 'Budget must be linked to either an account or a category' });
    }

    // Check duplicate
    if (linkedAccountId) {
      const existing = db.prepare('SELECT id FROM budgets WHERE linked_account_id = ? AND is_paused = 0').get(linkedAccountId);
      if (existing) {
        return res.status(400).json({ error: 'A budget is already linked to this account. Please edit the existing budget instead.' });
      }
    }

    const id = `bgt-${Date.now()}`;
    const now = new Date().toISOString();
    const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO budgets (id, name, linked_account_id, category_id, amount_paise, period, start_date, end_date, is_paused, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(id, name.trim(), linkedAccountId || null, categoryId || null, parsedAmount, period, start, endDate || null, now);

    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/budgets/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, amountPaise, isPaused, period, startDate, endDate } = req.body;

    const parsedAmount = amountPaise ? parseInt(amountPaise, 10) : undefined;

    db.prepare(`
      UPDATE budgets
      SET name = COALESCE(?, name),
          amount_paise = COALESCE(?, amount_paise),
          is_paused = COALESCE(?, is_paused),
          period = COALESCE(?, period),
          start_date = COALESCE(?, start_date),
          end_date = COALESCE(?, end_date)
      WHERE id = ?
    `).run(name?.trim() ?? null, parsedAmount ?? null, isPaused !== undefined ? (isPaused ? 1 : 0) : null, period ?? null, startDate ?? null, endDate ?? null, id);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/budgets/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM budgets WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// PETROL TRACKER & LOGS
// -------------------------------------------------------------
apiRouter.get('/petrol/logs', (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT pl.*, t.description, t.merchant, a.name as account_name
      FROM petrol_logs pl
      JOIN transactions t ON pl.transaction_id = t.id
      JOIN accounts a ON t.account_id = a.id
      ORDER BY pl.date DESC, pl.created_at DESC
    `).all();

    // Stats
    const totalSpentStmt = db.prepare('SELECT COALESCE(SUM(expense_paise), 0) as total FROM petrol_logs');
    const totalSpentPaise = (totalSpentStmt.get() as any).total || 0;

    const litresStmt = db.prepare('SELECT COALESCE(SUM(litres), 0) as total_litres FROM petrol_logs WHERE litres > 0');
    const totalLitres = (litresStmt.get() as any).total_litres || 0;

    const avgPriceStmt = db.prepare('SELECT AVG(price_per_litre) as avg_price FROM petrol_logs WHERE price_per_litre > 0');
    const avgPrice = (avgPriceStmt.get() as any).avg_price || 0;

    res.json({
      logs,
      stats: {
        totalSpentPaise,
        totalLitres: Number(totalLitres.toFixed(2)),
        avgPricePerLitre: Number(avgPrice.toFixed(2)),
        totalRefuels: logs.length
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// MONTHLY REPORTS & ANALYTICS
// -------------------------------------------------------------
apiRouter.get('/reports/monthly', (req, res) => {
  try {
    const monthQuery = typeof req.query.month === 'string' ? req.query.month : undefined;
    const { startDate, endDate, monthKey } = getMonthBounds(monthQuery);

    // Monthly Income
    const incomeStmt = db.prepare(`
      SELECT COALESCE(SUM(amount_paise), 0) as total
      FROM incomes
      WHERE date >= ? AND date <= ?
    `);
    const incomePaise = (incomeStmt.get(startDate, endDate) as any).total || 0;

    // Monthly Expenses
    const expenseStmt = db.prepare(`
      SELECT COALESCE(SUM(amount_paise), 0) as total
      FROM transactions
      WHERE type = 'expense' AND date >= ? AND date <= ?
    `);
    const expensePaise = (expenseStmt.get(startDate, endDate) as any).total || 0;

    // Savings added this month (from dedicated savings records)
    const savingsRecordStmt = db.prepare(`
      SELECT COALESCE(SUM(amount_paise), 0) as total
      FROM savings_records
      WHERE date >= ? AND date <= ?
    `);
    const savingsAddedPaise = (savingsRecordStmt.get(startDate, endDate) as any).total || 0;

    // Category breakdown
    const categoryBreakdown = db.prepare(`
      SELECT c.id, c.name, c.color, c.icon, COALESCE(SUM(t.amount_paise), 0) as total_paise
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.type = 'expense' AND t.date >= ? AND t.date <= ?
      GROUP BY c.id
      ORDER BY total_paise DESC
    `).all(startDate, endDate);

    // Account breakdown
    const accountBreakdown = db.prepare(`
      SELECT a.id, a.name, a.color, a.type, COALESCE(SUM(t.amount_paise), 0) as total_paise
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE t.type = 'expense' AND t.date >= ? AND t.date <= ?
      GROUP BY a.id
      ORDER BY total_paise DESC
    `).all(startDate, endDate);

    // Daily spending trend for this month
    const dailySpending = db.prepare(`
      SELECT date, COALESCE(SUM(amount_paise), 0) as amount_paise
      FROM transactions
      WHERE type = 'expense' AND date >= ? AND date <= ?
      GROUP BY date
      ORDER BY date ASC
    `).all(startDate, endDate);

    // Monthly comparison: last 6 months trend
    const sixMonthsTrend = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bounds = getMonthBounds(mStr);
      
      const inc = (db.prepare('SELECT COALESCE(SUM(amount_paise), 0) as total FROM incomes WHERE date >= ? AND date <= ?').get(bounds.startDate, bounds.endDate) as any).total || 0;
      const exp = (db.prepare("SELECT COALESCE(SUM(amount_paise), 0) as total FROM transactions WHERE type = 'expense' AND date >= ? AND date <= ?").get(bounds.startDate, bounds.endDate) as any).total || 0;
      const pet = (db.prepare("SELECT COALESCE(SUM(t.amount_paise), 0) as total FROM transactions t WHERE (t.category_id = 'cat-petrol' OR t.category_id IN (SELECT id FROM categories WHERE name LIKE '%Petrol%')) AND t.type = 'expense' AND t.date >= ? AND t.date <= ?").get(bounds.startDate, bounds.endDate) as any).total || 0;

      sixMonthsTrend.push({
        month: mStr,
        label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        incomePaise: inc,
        expensePaise: exp,
        petrolPaise: pet,
        netSavingsPaise: inc - exp
      });
    }

    res.json({
      month: monthKey,
      incomePaise,
      expensePaise,
      savingsAddedPaise,
      netFlowPaise: incomePaise - expensePaise,
      categoryBreakdown,
      accountBreakdown,
      dailySpending,
      sixMonthsTrend
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Dedicated Petrol Report (expenses, litres, stations; no spending limits or caps)
apiRouter.get('/reports/petrol', (req, res) => {
  try {
    const monthQuery = typeof req.query.month === 'string' ? req.query.month : undefined;
    const { startDate, endDate, monthKey } = getMonthBounds(monthQuery);

    // Monthly petrol transactions
    const txRows = db.prepare(`
      SELECT t.*, a.name as account_name, a.color as account_color,
             pl.litres, pl.price_per_litre, pl.odometer, pl.fuel_station
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN petrol_logs pl ON pl.transaction_id = t.id
      WHERE (t.category_id = 'cat-petrol' OR t.category_id IN (SELECT id FROM categories WHERE name LIKE '%Petrol%'))
        AND t.type = 'expense' AND t.date >= ? AND t.date <= ?
      ORDER BY t.date ASC
    `).all(startDate, endDate) as any[];

    const totalSpentPaise = txRows.reduce((acc, t) => acc + t.amount_paise, 0);
    const count = txRows.length;
    const avgExpensePaise = count > 0 ? Math.round(totalSpentPaise / count) : 0;

    // Total litres and fuel stations visited
    let totalLitres = 0;
    const stations: Record<string, number> = {};
    txRows.forEach(t => {
      if (t.litres) totalLitres += t.litres;
      if (t.fuel_station) {
        stations[t.fuel_station] = (stations[t.fuel_station] || 0) + 1;
      }
    });

    res.json({
      month: monthKey,
      totalSpentPaise,
      count,
      avgExpensePaise,
      totalLitres: Number(totalLitres.toFixed(2)),
      stationVisits: stations,
      transactions: txRows
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// CSV & JSON BACKUP EXPORT / RESTORE
// -------------------------------------------------------------
apiRouter.get('/export/csv', (req, res) => {
  try {
    const transactions = db.prepare(`
      SELECT t.date, t.type, a.name as account_name, c.name as category_name,
             t.amount_paise, t.description, t.merchant, t.notes
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      ORDER BY t.date DESC, t.created_at DESC
    `).all() as any[];

    let csv = 'Date,Type,Account,Category,Amount (INR),Description,Merchant,Notes\n';
    transactions.forEach(t => {
      const amountInr = (t.amount_paise / 100).toFixed(2);
      const clean = (val: any) => `"${(val || '').toString().replace(/"/g, '""')}"`;
      csv += `${t.date},${t.type},${clean(t.account_name)},${clean(t.category_name)},${amountInr},${clean(t.description)},${clean(t.merchant)},${clean(t.notes)}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="rupee_transactions.csv"');
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/export/backup', (req, res) => {
  try {
    const backupData = {
      accounts: db.prepare('SELECT * FROM accounts').all(),
      categories: db.prepare('SELECT * FROM categories').all(),
      budgets: db.prepare('SELECT * FROM budgets').all(),
      incomes: db.prepare('SELECT * FROM incomes').all(),
      income_allocations: db.prepare('SELECT * FROM income_allocations').all(),
      transfers: db.prepare('SELECT * FROM transfers').all(),
      transactions: db.prepare('SELECT * FROM transactions').all(),
      petrol_logs: db.prepare('SELECT * FROM petrol_logs').all(),
      savings_records: db.prepare('SELECT * FROM savings_records').all(),
      settings: db.prepare('SELECT * FROM settings').all(),
      exportedAt: new Date().toISOString()
    };
    res.json(backupData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/import/backup', (req, res) => {
  try {
    const backup = req.body;
    if (!backup || !backup.accounts || !backup.transactions) {
      return res.status(400).json({ error: 'Invalid backup file structure' });
    }

    db.exec('BEGIN TRANSACTION');
    try {
      // Clear current data
      db.exec(`
        DELETE FROM savings_records;
        DELETE FROM petrol_logs;
        DELETE FROM transactions;
        DELETE FROM transfers;
        DELETE FROM income_allocations;
        DELETE FROM incomes;
        DELETE FROM budgets;
        DELETE FROM accounts;
      `);

      // Restore accounts
      const insAcc = db.prepare(`
        INSERT INTO accounts (id, name, type, balance_paise, color, icon, is_system, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const a of backup.accounts) {
        insAcc.run(a.id, a.name, a.type, a.balance_paise, a.color, a.icon, a.is_system, a.created_at);
      }

      // Restore budgets
      const insBgt = db.prepare(`
        INSERT INTO budgets (id, name, linked_account_id, category_id, amount_paise, period, start_date, end_date, is_paused, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const b of backup.budgets || []) {
        insBgt.run(b.id, b.name, b.linked_account_id, b.category_id, b.amount_paise, b.period, b.start_date, b.end_date, b.is_paused, b.created_at);
      }

      // Restore incomes
      const insInc = db.prepare(`
        INSERT INTO incomes (id, amount_paise, source, date, description, allocated_paise, unallocated_paise, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const inc of backup.incomes || []) {
        insInc.run(inc.id, inc.amount_paise, inc.source, inc.date, inc.description, inc.allocated_paise, inc.unallocated_paise, inc.created_at);
      }

      // Restore income_allocations
      const insIa = db.prepare(`
        INSERT INTO income_allocations (id, income_id, account_id, amount_paise, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const ia of backup.income_allocations || []) {
        insIa.run(ia.id, ia.income_id, ia.account_id, ia.amount_paise, ia.created_at);
      }

      // Restore transfers
      const insTrf = db.prepare(`
        INSERT INTO transfers (id, from_account_id, to_account_id, amount_paise, date, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const tr of backup.transfers || []) {
        insTrf.run(tr.id, tr.from_account_id, tr.to_account_id, tr.amount_paise, tr.date, tr.note, tr.created_at);
      }

      // Restore transactions
      const insTx = db.prepare(`
        INSERT INTO transactions (id, type, account_id, amount_paise, category_id, date, description, merchant, notes, related_transfer_id, related_income_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const tx of backup.transactions || []) {
        insTx.run(tx.id, tx.type, tx.account_id, tx.amount_paise, tx.category_id, tx.date, tx.description, tx.merchant, tx.notes, tx.related_transfer_id, tx.related_income_id, tx.created_at);
      }

      // Restore petrol_logs
      const insPl = db.prepare(`
        INSERT INTO petrol_logs (id, transaction_id, expense_paise, litres, price_per_litre, odometer, fuel_station, date, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const pl of backup.petrol_logs || []) {
        insPl.run(pl.id, pl.transaction_id, pl.expense_paise, pl.litres, pl.price_per_litre, pl.odometer, pl.fuel_station, pl.date, pl.notes, pl.created_at);
      }

      // Restore savings_records
      const insSav = db.prepare(`
        INSERT INTO savings_records (id, amount_paise, source_account_id, source_account_name, date, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const sav of backup.savings_records || []) {
        insSav.run(sav.id, sav.amount_paise, sav.source_account_id, sav.source_account_name, sav.date, sav.notes, sav.created_at);
      }

      db.exec('COMMIT');
      res.json({ success: true, count: backup.transactions.length });
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// SETTINGS & SEED / RESET
// -------------------------------------------------------------
apiRouter.post('/settings', (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'Setting key is required' });

    db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, String(value));

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Full reset (start completely clean with ₹0 balance on primary accounts, no budgets)
apiRouter.post('/reset', (req, res) => {
  try {
    db.exec('BEGIN TRANSACTION');
    try {
      db.exec(`
        DELETE FROM savings_records;
        DELETE FROM petrol_logs;
        DELETE FROM transactions;
        DELETE FROM transfers;
        DELETE FROM income_allocations;
        DELETE FROM incomes;
        DELETE FROM budgets;
        DELETE FROM accounts;
      `);

      const now = new Date().toISOString();

      // Re-seed system accounts with 0 balance
      const insertAccount = db.prepare(`
        INSERT INTO accounts (id, name, type, balance_paise, color, icon, is_system, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertAccount.run('acc-bank', 'Bank Account', 'bank', 0, '#0284c7', 'Building2', 1, now);
      insertAccount.run('acc-spending', 'Personal Spending', 'spending', 0, '#065F46', 'ShoppingBag', 1, now);
      insertAccount.run('acc-cash', 'Cash', 'cash', 0, '#059669', 'Banknote', 1, now);

      db.prepare("UPDATE settings SET value = 'true' WHERE key = 'is_onboarded'").run();

      db.exec('COMMIT');
      res.json({ success: true });
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Optional Demo Seed (Student scenario: IT income ₹5,000 allocated ₹2,000 Petrol & ₹3,000 Personal Spending, expenses, no monthly budget limits)
apiRouter.post('/demo/seed', (req, res) => {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    db.exec('BEGIN TRANSACTION');
    try {
      // 1. Reset
      db.exec(`
        DELETE FROM savings_records;
        DELETE FROM petrol_logs;
        DELETE FROM transactions;
        DELETE FROM transfers;
        DELETE FROM income_allocations;
        DELETE FROM incomes;
        DELETE FROM budgets;
        DELETE FROM accounts;
      `);

      const nowIso = now.toISOString();

      // Accounts: exactly Bank Account, Personal Spending, and Cash
      const insertAccount = db.prepare(`
        INSERT INTO accounts (id, name, type, balance_paise, color, icon, is_system, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertAccount.run('acc-bank', 'Bank Account', 'bank', 0, '#0284c7', 'Building2', 1, nowIso);
      insertAccount.run('acc-spending', 'Personal Spending', 'spending', 0, '#065F46', 'ShoppingBag', 1, nowIso);
      insertAccount.run('acc-cash', 'Cash', 'cash', 0, '#059669', 'Banknote', 1, nowIso);

      // Scenario Step 1: Receive ₹5,000 from IT work into Bank Account
      const incId = `inc-demo-1`;
      db.prepare(`
        INSERT INTO incomes (id, amount_paise, source, date, description, allocated_paise, unallocated_paise, created_at)
        VALUES (?, 500000, 'IT work', ?, 'Freelance Web Project Payment', 500000, 0, ?)
      `).run(incId, firstDay, nowIso);

      // Allocate to Bank Account
      db.prepare(`
        INSERT INTO income_allocations (id, income_id, account_id, amount_paise, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(`alloc-acc-bank`, incId, 'acc-bank', 500000, nowIso);

      db.prepare('UPDATE accounts SET balance_paise = balance_paise + 500000 WHERE id = ?').run('acc-bank');

      db.prepare(`
        INSERT INTO transactions (id, type, account_id, amount_paise, date, description, related_income_id, created_at)
        VALUES (?, 'income_allocation', 'acc-bank', 500000, ?, 'Income: IT work (Bank Account)', ?, ?)
      `).run(`tx-inc-bank`, firstDay, incId, nowIso);

      // Scenario Step 2: Transfer ₹3,000 from Bank Account to Personal Spending
      const trfId = `trf-demo-1`;
      db.prepare('UPDATE accounts SET balance_paise = balance_paise - 300000 WHERE id = ?').run('acc-bank');
      db.prepare('UPDATE accounts SET balance_paise = balance_paise + 300000 WHERE id = ?').run('acc-spending');
      db.prepare(`
        INSERT INTO transfers (id, from_account_id, to_account_id, amount_paise, date, note, created_at)
        VALUES (?, 'acc-bank', 'acc-spending', 300000, ?, 'Monthly Personal Spending Allocation', ?)
      `).run(trfId, today, nowIso);
      db.prepare(`
        INSERT INTO transactions (id, type, account_id, amount_paise, date, description, related_transfer_id, created_at)
        VALUES ('tx-demo-trf-out', 'transfer_out', 'acc-bank', 300000, ?, 'Transfer to Personal Spending', ?, ?)
      `).run(today, trfId, nowIso);
      db.prepare(`
        INSERT INTO transactions (id, type, account_id, amount_paise, date, description, related_transfer_id, created_at)
        VALUES ('tx-demo-trf-in', 'transfer_in', 'acc-spending', 300000, ?, 'Transfer from Bank Account', ?, ?)
      `).run(today, trfId, nowIso);

      // Scenario Step 3: Record ₹350 petrol expense against Bank Account (Petrol category)
      const pet1TxId = `tx-demo-pet1`;
      db.prepare('UPDATE accounts SET balance_paise = balance_paise - 35000 WHERE id = ?').run('acc-bank');
      db.prepare(`
        INSERT INTO transactions (id, type, account_id, amount_paise, category_id, date, description, merchant, created_at)
        VALUES (?, 'expense', 'acc-bank', 35000, 'cat-petrol', ?, 'Weekly Commute Refuel', 'Indian Oil', ?)
      `).run(pet1TxId, today, nowIso);
      db.prepare(`
        INSERT INTO petrol_logs (id, transaction_id, expense_paise, litres, price_per_litre, odometer, fuel_station, date, notes, created_at)
        VALUES (?, ?, 35000, 3.40, 102.94, 14250, 'Indian Oil Highway', ?, 'Full tank commute', ?)
      `).run('pet-demo-1', pet1TxId, today, nowIso);

      // Scenario Step 4: Record ₹500 personal shopping expense against Personal Spending
      const shopTxId = `tx-demo-shop`;
      db.prepare('UPDATE accounts SET balance_paise = balance_paise - 50000 WHERE id = ?').run('acc-spending');
      db.prepare(`
        INSERT INTO transactions (id, type, account_id, amount_paise, category_id, date, description, merchant, created_at)
        VALUES (?, 'expense', 'acc-spending', 50000, 'cat-shopping', ?, 'Stationery & Study Material', 'Stationery Mart', ?)
      `).run(shopTxId, today, nowIso);

      db.prepare("UPDATE settings SET value = 'true' WHERE key = 'is_onboarded'").run();

      db.exec('COMMIT');
      res.json({ success: true });
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// GEMINI CHATBOT & AI ENDPOINTS
// -------------------------------------------------------------

apiRouter.get('/gemini/personas', (req, res) => {
  res.json({
    personas: [
      {
        id: 'advisor',
        name: 'Personal Financial Advisor',
        description: 'Comprehensive advice on accounts, college petrol limits, and independent savings.',
        suggestedPrompts: [
          'How is my overall financial health looking this month?',
          'How much money can I safely spend on non-essentials?',
          'Can you explain why my savings are excluded from available spending?',
          'What is the best way to allocate my next income of ₹5,000?',
        ],
      },
      {
        id: 'budget_coach',
        name: 'College Budget Coach',
        description: 'Practical, high-energy coaching to prevent overspending and grow savings.',
        suggestedPrompts: [
          'How can I cut down on unnecessary canteen expenses?',
          'Give me a game plan to save an extra ₹1,000 this month.',
          'Am I spending too much on weekends?',
        ],
      },
      {
        id: 'petrol_auditor',
        name: 'College Petrol Auditor',
        description: 'Deep dive into fuel efficiency, price per litre, and the ₹2,000 monthly petrol cap.',
        suggestedPrompts: [
          'Am I on track to stay within my ₹2,000 petrol budget?',
          'How many days until my petrol budget resets?',
          'Analyze my recent fuel efficiency and station logs.',
        ],
      },
      {
        id: 'complex_analyst',
        name: 'Quantitative Scenario Analyst',
        description: 'In-depth multi-month forecasts, emergency fund sizing, and trade-off simulations.',
        suggestedPrompts: [
          'Model my net worth trajectory over the next 6 months.',
          'Simulate a scenario where my petrol expense increases by ₹500/month.',
          'Provide a quantitative comparison between my income rate and burn rate.',
        ],
      },
    ],
  });
});

apiRouter.post('/gemini/chat', async (req, res) => {
  try {
    const {
      messages,
      model,
      persona = 'advisor',
      taskComplexity = 'general',
      includeFinancialContext = true,
    } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server. Please check your environment secrets.',
      });
    }

    // Model selection based on requirements:
    // - gemini-4-argon for particularly complex tasks
    // - gemini-3.8-flash for general tasks
    // - gemini-3.1-flash-lite for tasks that should happen fast
    let targetModel = 'gemini-3.8-flash';
    if (model) {
      targetModel = model;
    } else if (taskComplexity === 'complex' || persona === 'complex_analyst') {
      targetModel = 'gemini-4-argon';
    } else if (taskComplexity === 'fast') {
      targetModel = 'gemini-3.1-flash-lite';
    }

    // Construct system instruction combining role persona and real-time financial context
    const personaInstruction = PERSONAS[persona] || PERSONAS.advisor;
    const context = includeFinancialContext ? getLiveFinancialContext() : '';
    const fullSystemInstruction = `${personaInstruction}\n\n${context}`;

    // Format multi-turn conversation contents
    const contents = messages.map((m: any) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.text || m.content || '') }],
    }));

    const response = await ai.models.generateContent({
      model: targetModel,
      contents,
      config: {
        systemInstruction: fullSystemInstruction,
      },
    });

    const replyText = response.text || 'I analyzed your request, but could not produce a response.';

    res.json({
      reply: replyText,
      modelUsed: targetModel,
      persona,
    });
  } catch (err: any) {
    console.error('Gemini chat error:', err);
    let errorMsg = err?.message || 'Failed to generate response from Gemini AI';
    try {
      const parsed = JSON.parse(errorMsg);
      if (parsed.error?.message) {
        errorMsg = parsed.error.message;
      }
    } catch (e) {}
    res.status(500).json({
      error: errorMsg,
    });
  }
});

apiRouter.post('/gemini/quick-insight', async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        insight: 'Add your GEMINI_API_KEY to unlock instant AI financial insights.',
        modelUsed: 'none',
      });
    }

    const context = getLiveFinancialContext();
    // Fast task using gemini-3.1-flash-lite
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: 'Provide a snappy 2-sentence executive summary of the user financial position, highlighting their petrol budget status and savings buffer.',
      config: {
        systemInstruction: `You are an elite personal finance AI assistant for Rupee. ${context}`,
      },
    });

    res.json({
      insight: response.text || 'Financial snapshot compiled.',
      modelUsed: 'gemini-3.1-flash-lite',
    });
  } catch (err: any) {
    console.error('Gemini quick insight error:', err);
    res.status(500).json({ error: err.message });
  }
});
