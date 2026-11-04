import { Router } from 'express';
import { db } from './db.js';

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

    // Accounts
    const accounts = db.prepare('SELECT * FROM accounts ORDER BY created_at ASC').all() as any[];

    // Categories
    const categories = db.prepare('SELECT * FROM categories ORDER BY type, name ASC').all() as any[];

    // Budgets
    const budgets = db.prepare('SELECT * FROM budgets WHERE is_paused = 0').all() as any[];

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

    // Total money across all accounts:
    const totalBalanceStmt = db.prepare('SELECT COALESCE(SUM(balance_paise), 0) as total FROM accounts');
    const totalAccountBalancePaise = (totalBalanceStmt.get() as any).total || 0;
    const totalMoneyPaise = totalAccountBalancePaise + unallocatedPaise;

    // Savings balance:
    const savingsStmt = db.prepare("SELECT COALESCE(SUM(balance_paise), 0) as total FROM accounts WHERE type = 'savings'");
    const totalSavingsPaise = (savingsStmt.get() as any).total || 0;

    // Available spending money (accounts other than savings)
    const availableSpendingPaise = totalAccountBalancePaise - totalSavingsPaise;

    // Calculate budget utilization for accounts and categories
    const budgetListWithStats = budgets.map((b: any) => {
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

    // Account stats for this month
    const accountsWithStats = accounts.map((acc: any) => {
      // Find budget for this account if any
      const budget = budgetListWithStats.find((b: any) => b.linked_account_id === acc.id);
      
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
        budget: budget || null,
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

    // Petrol specific monthly summary
    const petrolSpentStmt = db.prepare(`
      SELECT COALESCE(SUM(t.amount_paise), 0) as spent, COUNT(t.id) as count
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE a.type = 'petrol' AND t.type = 'expense' AND t.date >= ? AND t.date <= ?
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
        monthlyIncomePaise,
        monthlyExpensePaise,
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
    const accounts = db.prepare('SELECT * FROM accounts ORDER BY created_at ASC').all();
    res.json(accounts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/accounts', (req, res) => {
  try {
    const { name, type, color, icon, initialBalancePaise = 0, budgetPaise } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Account name is required' });
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
        // Record starting balance transaction as income allocation
        const incId = `inc-init-${Date.now()}`;
        db.prepare(`
          INSERT INTO incomes (id, amount_paise, source, date, description, allocated_paise, unallocated_paise, created_at)
          VALUES (?, ?, 'Initial Balance', ?, 'Initial Account Balance', ?, 0, ?)
        `).run(incId, balance, now.split('T')[0], balance, now);

        db.prepare(`
          INSERT INTO transactions (id, type, account_id, amount_paise, date, description, related_income_id, created_at)
          VALUES (?, 'income_allocation', ?, ?, ?, 'Initial Balance', ?, ?)
        `).run(`tx-init-${Date.now()}`, id, balance, now.split('T')[0], incId, now);
      }

      if (budgetPaise && budgetPaise > 0) {
        const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        db.prepare(`
          INSERT INTO budgets (id, name, linked_account_id, amount_paise, period, start_date, is_paused, created_at)
          VALUES (?, ?, ?, ?, 'monthly', ?, 0, ?)
        `).run(`bgt-${Date.now()}`, `${name.trim()} Monthly Budget`, id, parseInt(budgetPaise, 10), firstDay, now);
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
    const { name, color, icon, monthlyBudgetPaise } = req.body;
    
    db.exec('BEGIN TRANSACTION');
    try {
      db.prepare(`
        UPDATE accounts
        SET name = COALESCE(?, name),
            color = COALESCE(?, color),
            icon = COALESCE(?, icon)
        WHERE id = ?
      `).run(name?.trim() ?? null, color ?? null, icon ?? null, id);

      if (monthlyBudgetPaise !== undefined) {
        const existingBudget = db.prepare('SELECT id FROM budgets WHERE linked_account_id = ?').get(id) as any;
        if (existingBudget) {
          if (monthlyBudgetPaise > 0) {
            db.prepare('UPDATE budgets SET amount_paise = ? WHERE id = ?').run(parseInt(monthlyBudgetPaise, 10), existingBudget.id);
          } else {
            db.prepare('DELETE FROM budgets WHERE id = ?').run(existingBudget.id);
          }
        } else if (monthlyBudgetPaise > 0) {
          const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
          db.prepare(`
            INSERT INTO budgets (id, name, linked_account_id, amount_paise, period, start_date, is_paused, created_at)
            VALUES (?, ?, ?, ?, 'monthly', ?, 0, ?)
          `).run(`bgt-${Date.now()}`, `${name || 'Account'} Monthly Budget`, id, parseInt(monthlyBudgetPaise, 10), firstDay, new Date().toISOString());
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

apiRouter.delete('/accounts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as any;
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    if (account.is_system) {
      return res.status(400).json({ error: 'System accounts (College Petrol, Personal Spending, Savings) cannot be deleted' });
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

    // Savings added this month (income allocations to savings accounts + transfers into savings)
    const savingsAllocStmt = db.prepare(`
      SELECT COALESCE(SUM(t.amount_paise), 0) as total
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE a.type = 'savings' AND (t.type = 'income_allocation' OR t.type = 'transfer_in')
        AND t.date >= ? AND t.date <= ?
    `);
    const savingsAddedPaise = (savingsAllocStmt.get(startDate, endDate) as any).total || 0;

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
      const pet = (db.prepare("SELECT COALESCE(SUM(t.amount_paise), 0) as total FROM transactions t JOIN accounts a ON t.account_id = a.id WHERE a.type = 'petrol' AND t.type = 'expense' AND t.date >= ? AND t.date <= ?").get(bounds.startDate, bounds.endDate) as any).total || 0;

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

// Dedicated Petrol Report
apiRouter.get('/reports/petrol', (req, res) => {
  try {
    const monthQuery = typeof req.query.month === 'string' ? req.query.month : undefined;
    const { startDate, endDate, monthKey } = getMonthBounds(monthQuery);

    const petrolBudgetRow = db.prepare("SELECT amount_paise FROM budgets WHERE linked_account_id = 'acc-petrol' AND is_paused = 0").get() as any;
    const petrolBudgetPaise = petrolBudgetRow ? petrolBudgetRow.amount_paise : 200000;

    // Monthly petrol transactions
    const txRows = db.prepare(`
      SELECT t.*, pl.litres, pl.price_per_litre, pl.odometer, pl.fuel_station
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      LEFT JOIN petrol_logs pl ON pl.transaction_id = t.id
      WHERE a.type = 'petrol' AND t.type = 'expense' AND t.date >= ? AND t.date <= ?
      ORDER BY t.date ASC
    `).all(startDate, endDate) as any[];

    const totalSpentPaise = txRows.reduce((acc, t) => acc + t.amount_paise, 0);
    const count = txRows.length;
    const avgExpensePaise = count > 0 ? Math.round(totalSpentPaise / count) : 0;
    const remainingBudgetPaise = petrolBudgetPaise - totalSpentPaise;
    const isExceeded = totalSpentPaise > petrolBudgetPaise;
    const overrunPaise = isExceeded ? totalSpentPaise - petrolBudgetPaise : 0;

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
      budgetPaise: petrolBudgetPaise,
      totalSpentPaise,
      count,
      avgExpensePaise,
      remainingBudgetPaise,
      isExceeded,
      overrunPaise,
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
    res.setHeader('Content-Disposition', 'attachment; filename="my_money_manager_transactions.csv"');
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

    // If updating petrol budget, also sync the College Petrol budget record
    if (key === 'petrol_monthly_budget_paise') {
      const budgetPaise = parseInt(value, 10);
      if (budgetPaise > 0) {
        db.prepare("UPDATE budgets SET amount_paise = ? WHERE linked_account_id = 'acc-petrol'")
          .run(budgetPaise);
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Full reset (start completely clean with ₹0 balance on initial accounts)
apiRouter.post('/reset', (req, res) => {
  try {
    db.exec('BEGIN TRANSACTION');
    try {
      db.exec(`
        DELETE FROM petrol_logs;
        DELETE FROM transactions;
        DELETE FROM transfers;
        DELETE FROM income_allocations;
        DELETE FROM incomes;
        DELETE FROM budgets;
        DELETE FROM accounts;
      `);

      const now = new Date().toISOString();
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

      // Re-seed system accounts with 0 balance
      const insertAccount = db.prepare(`
        INSERT INTO accounts (id, name, type, balance_paise, color, icon, is_system, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertAccount.run('acc-petrol', 'College Petrol', 'petrol', 0, '#f59e0b', 'Fuel', 1, now);
      insertAccount.run('acc-spending', 'Personal Spending', 'spending', 0, '#0ea5e9', 'ShoppingBag', 1, now);
      insertAccount.run('acc-savings', 'Savings', 'savings', 0, '#10b981', 'PiggyBank', 1, now);

      db.prepare(`
        INSERT INTO budgets (id, name, linked_account_id, category_id, amount_paise, period, start_date, is_paused, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('bgt-college-petrol', 'College Petrol Monthly Budget', 'acc-petrol', 'cat-petrol', 200000, 'monthly', firstDayOfMonth, 0, now);

      db.prepare("UPDATE settings SET value = 'false' WHERE key = 'is_onboarded'").run();

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

// Optional Demo Seed (Student scenario: IT income ₹5,000 allocated, petrol expense ₹650, shopping ₹500, canteen ₹150, transfer ₹200)
apiRouter.post('/demo/seed', (req, res) => {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    db.exec('BEGIN TRANSACTION');
    try {
      // 1. Reset
      db.exec(`
        DELETE FROM petrol_logs;
        DELETE FROM transactions;
        DELETE FROM transfers;
        DELETE FROM income_allocations;
        DELETE FROM incomes;
        DELETE FROM budgets;
        DELETE FROM accounts;
      `);

      const nowIso = now.toISOString();

      // Accounts
      const insertAccount = db.prepare(`
        INSERT INTO accounts (id, name, type, balance_paise, color, icon, is_system, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertAccount.run('acc-petrol', 'College Petrol', 'petrol', 0, '#f59e0b', 'Fuel', 1, nowIso);
      insertAccount.run('acc-spending', 'Personal Spending', 'spending', 0, '#0ea5e9', 'ShoppingBag', 1, nowIso);
      insertAccount.run('acc-savings', 'Savings', 'savings', 0, '#10b981', 'PiggyBank', 1, nowIso);

      // College Petrol budget: ₹2,000/month
      db.prepare(`
        INSERT INTO budgets (id, name, linked_account_id, category_id, amount_paise, period, start_date, is_paused, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('bgt-college-petrol', 'College Petrol Monthly Budget', 'acc-petrol', 'cat-petrol', 200000, 'monthly', firstDay, 0, nowIso);

      // Scenario Step 1: Receive ₹5,000 from IT work
      // Allocate ₹2,000 to College Petrol, ₹2,000 to Personal Spending, ₹1,000 to Savings
      const incId = `inc-demo-1`;
      db.prepare(`
        INSERT INTO incomes (id, amount_paise, source, date, description, allocated_paise, unallocated_paise, created_at)
        VALUES (?, 500000, 'IT work', ?, 'Freelance Web Project Payment', 500000, 0, ?)
      `).run(incId, firstDay, nowIso);

      // Allocations
      const allocs = [
        { accId: 'acc-petrol', amt: 200000, note: 'Monthly petrol fuel fund' },
        { accId: 'acc-spending', amt: 200000, note: 'Personal monthly expenses' },
        { accId: 'acc-savings', amt: 100000, note: 'Savings reserve' },
      ];
      for (const a of allocs) {
        db.prepare(`
          INSERT INTO income_allocations (id, income_id, account_id, amount_paise, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(`alloc-${a.accId}`, incId, a.accId, a.amt, nowIso);

        db.prepare('UPDATE accounts SET balance_paise = balance_paise + ? WHERE id = ?')
          .run(a.amt, a.accId);

        db.prepare(`
          INSERT INTO transactions (id, type, account_id, amount_paise, date, description, related_income_id, created_at)
          VALUES (?, 'income_allocation', ?, ?, ?, ?, ?, ?)
        `).run(`tx-inc-${a.accId}`, a.accId, a.amt, firstDay, `Income: IT work (${a.note})`, incId, nowIso);
      }

      // Scenario Step 2: Record ₹300 petrol expense (and a ₹350 refuel earlier in week)
      // First refuel ₹350
      const pet1TxId = `tx-demo-pet1`;
      db.prepare('UPDATE accounts SET balance_paise = balance_paise - 35000 WHERE id = ?').run('acc-petrol');
      db.prepare(`
        INSERT INTO transactions (id, type, account_id, amount_paise, category_id, date, description, merchant, created_at)
        VALUES (?, 'expense', 'acc-petrol', 35000, 'cat-petrol', ?, 'Weekly College Commute Refuel', 'Indian Oil', ?)
      `).run(pet1TxId, today, nowIso);
      db.prepare(`
        INSERT INTO petrol_logs (id, transaction_id, expense_paise, litres, price_per_litre, odometer, fuel_station, date, notes, created_at)
        VALUES (?, ?, 35000, 3.40, 102.94, 14250, 'Indian Oil Highway', ?, 'Full tank commute', ?)
      `).run('pet-demo-1', pet1TxId, today, nowIso);

      // Second refuel ₹300
      const pet2TxId = `tx-demo-pet2`;
      db.prepare('UPDATE accounts SET balance_paise = balance_paise - 30000 WHERE id = ?').run('acc-petrol');
      db.prepare(`
        INSERT INTO transactions (id, type, account_id, amount_paise, category_id, date, description, merchant, created_at)
        VALUES (?, 'expense', 'acc-petrol', 30000, 'cat-petrol', ?, 'Mid-week Petrol Refill', 'Bharat Petroleum', ?)
      `).run(pet2TxId, today, nowIso);
      db.prepare(`
        INSERT INTO petrol_logs (id, transaction_id, expense_paise, litres, price_per_litre, odometer, fuel_station, date, notes, created_at)
        VALUES (?, ?, 30000, 2.91, 103.00, 14380, 'Bharat Petroleum Campus', ?, 'Refuel before exam commute', ?)
      `).run('pet-demo-2', pet2TxId, today, nowIso);

      // Scenario Step 3: Record ₹500 personal shopping expense
      const shopTxId = `tx-demo-shop`;
      db.prepare('UPDATE accounts SET balance_paise = balance_paise - 50000 WHERE id = ?').run('acc-spending');
      db.prepare(`
        INSERT INTO transactions (id, type, account_id, amount_paise, category_id, date, description, merchant, created_at)
        VALUES (?, 'expense', 'acc-spending', 50000, 'cat-shopping', ?, 'College Notebooks & Stationery', 'College Book Stall', ?)
      `).run(shopTxId, today, nowIso);

      // Scenario Step 4: Transfer ₹200 from Personal Spending to College Petrol
      const trfId = `trf-demo-1`;
      db.prepare('UPDATE accounts SET balance_paise = balance_paise - 20000 WHERE id = ?').run('acc-spending');
      db.prepare('UPDATE accounts SET balance_paise = balance_paise + 20000 WHERE id = ?').run('acc-petrol');
      db.prepare(`
        INSERT INTO transfers (id, from_account_id, to_account_id, amount_paise, date, note, created_at)
        VALUES (?, 'acc-spending', 'acc-petrol', 20000, ?, 'Extra petrol buffer for college fest', ?)
      `).run(trfId, today, nowIso);
      db.prepare(`
        INSERT INTO transactions (id, type, account_id, amount_paise, date, description, related_transfer_id, created_at)
        VALUES ('tx-demo-trf-out', 'transfer_out', 'acc-spending', 20000, ?, 'Transfer to College Petrol (Extra petrol buffer)', ?, ?)
      `).run(today, trfId, nowIso);
      db.prepare(`
        INSERT INTO transactions (id, type, account_id, amount_paise, date, description, related_transfer_id, created_at)
        VALUES ('tx-demo-trf-in', 'transfer_in', 'acc-petrol', 20000, ?, 'Transfer from Personal Spending (Extra petrol buffer)', ?, ?)
      `).run(today, trfId, nowIso);

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
