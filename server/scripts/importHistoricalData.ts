import { db, initDatabase } from '../db.js';
import { scheduleTursoSync } from '../turso.js';

interface RawExpense {
  date: string; // YYYY-MM-DD
  description: string;
  amountINR: number;
  categoryId: string;
}

const HISTORICAL_EXPENSES: RawExpense[] = [
  // July 2026 (2 items, ₹350)
  { date: '2026-07-24', description: 'Haircut', amountINR: 100, categoryId: 'cat-health' },
  { date: '2026-07-26', description: 'Charging Cable', amountINR: 250, categoryId: 'cat-shopping' },

  // August 2026 (7 items, ₹1,179)
  { date: '2026-08-08', description: 'Keychain', amountINR: 50, categoryId: 'cat-shopping' },
  { date: '2026-08-16', description: 'Sabudana', amountINR: 50, categoryId: 'cat-food' },
  { date: '2026-08-19', description: 'Medicines', amountINR: 260, categoryId: 'cat-health' },
  { date: '2026-08-21', description: 'Bowling', amountINR: 220, categoryId: 'cat-other' },
  { date: '2026-08-23', description: 'Lock Fitting', amountINR: 200, categoryId: 'cat-services' },
  { date: '2026-08-29', description: 'Recharge', amountINR: 299, categoryId: 'cat-subscriptions' },
  { date: '2026-08-30', description: 'Prasad (Aithor)', amountINR: 100, categoryId: 'cat-food' },

  // September 2026 (17 items, ₹2,384)
  { date: '2026-09-01', description: 'Tempered Glass', amountINR: 100, categoryId: 'cat-shopping' },
  { date: '2026-09-01', description: 'Clg', amountINR: 115, categoryId: 'cat-education' },
  { date: '2026-09-05', description: 'Agora Parking', amountINR: 20, categoryId: 'cat-travel' },
  { date: '2026-09-07', description: 'Bowling', amountINR: 220, categoryId: 'cat-other' },
  { date: '2026-09-10', description: 'Spotify', amountINR: 69, categoryId: 'cat-subscriptions' },
  { date: '2026-09-10', description: 'Abhay (SIH)', amountINR: 225, categoryId: 'cat-education' },
  { date: '2026-09-10', description: 'Clg (SIH)', amountINR: 30, categoryId: 'cat-education' },
  { date: '2026-09-11', description: 'Clg (SIH)', amountINR: 280, categoryId: 'cat-education' },
  { date: '2026-09-11', description: 'Fruits', amountINR: 30, categoryId: 'cat-food' },
  { date: '2026-09-16', description: 'Janva Cycle Puncture', amountINR: 30, categoryId: 'cat-services' },
  { date: '2026-09-17', description: 'Pav Bhaji', amountINR: 150, categoryId: 'cat-food' },
  { date: '2026-09-18', description: 'Haircut', amountINR: 250, categoryId: 'cat-health' },
  { date: '2026-09-18', description: 'Jet Spray', amountINR: 200, categoryId: 'cat-services' },
  { date: '2026-09-21', description: 'Abhay', amountINR: 60, categoryId: 'cat-other' },
  { date: '2026-09-22', description: 'Recharge', amountINR: 299, categoryId: 'cat-subscriptions' },
  { date: '2026-09-27', description: 'Istra', amountINR: 56, categoryId: 'cat-services' },
  { date: '2026-09-29', description: 'Bike Wiring', amountINR: 200, categoryId: 'cat-services' },

  // October 2026 (14 items, ₹2,615)
  { date: '2026-10-02', description: 'Diet Coke', amountINR: 50, categoryId: 'cat-food' },
  { date: '2026-10-04', description: 'Bike Service', amountINR: 600, categoryId: 'cat-services' },
  { date: '2026-10-07', description: 'Clg', amountINR: 60, categoryId: 'cat-education' },
  { date: '2026-10-09', description: 'Clg', amountINR: 40, categoryId: 'cat-education' },
  { date: '2026-10-10', description: 'Spotify', amountINR: 69, categoryId: 'cat-subscriptions' },
  { date: '2026-10-12', description: 'Water Bottle', amountINR: 20, categoryId: 'cat-food' },
  { date: '2026-10-18', description: 'Milan Ganthiya', amountINR: 50, categoryId: 'cat-food' },
  { date: '2026-10-19', description: 'Yash Chavda', amountINR: 299, categoryId: 'cat-other' },
  { date: '2026-10-20', description: 'Lemoson', amountINR: 37, categoryId: 'cat-food' },
  { date: '2026-10-19', description: 'Bike Clutch Assembly Fitting', amountINR: 400, categoryId: 'cat-services' },
  { date: '2026-10-25', description: 'Bike', amountINR: 450, categoryId: 'cat-services' },
  { date: '2026-10-28', description: 'Activa Tyre Fitting', amountINR: 200, categoryId: 'cat-services' },
  { date: '2026-10-29', description: 'Medicines', amountINR: 60, categoryId: 'cat-health' },
  { date: '2026-10-27', description: 'Clg', amountINR: 130, categoryId: 'cat-education' },
];

export async function runHistoricalImport() {
  console.log('[Import] Initializing database...');
  initDatabase();

  const nowIso = new Date().toISOString();

  // 1. Verify Personal Spending account exists
  const spendingAcc = db.prepare("SELECT * FROM accounts WHERE id = 'acc-spending'").get() as any;
  if (!spendingAcc) {
    throw new Error("Personal Spending account (acc-spending) does not exist in the database!");
  }

  console.log('[Import] Personal Spending account confirmed:', spendingAcc.name);

  // 2. Import 40 Historical Expenses
  const insertTxStmt = db.prepare(`
    INSERT INTO transactions (id, type, account_id, amount_paise, category_id, date, description, notes, created_at)
    VALUES (?, 'expense', 'acc-spending', ?, ?, ?, ?, 'Historical import from handwritten notebook', ?)
  `);

  const checkTxStmt = db.prepare('SELECT id FROM transactions WHERE id = ?');
  let expensesAdded = 0;
  let totalExpensePaise = 0;

  const monthTotals: Record<string, { count: number; totalPaise: number }> = {
    '2026-07': { count: 0, totalPaise: 0 },
    '2026-08': { count: 0, totalPaise: 0 },
    '2026-09': { count: 0, totalPaise: 0 },
    '2026-10': { count: 0, totalPaise: 0 },
  };

  db.exec('BEGIN TRANSACTION');
  try {
    for (let i = 0; i < HISTORICAL_EXPENSES.length; i++) {
      const exp = HISTORICAL_EXPENSES[i];
      const amountPaise = Math.round(exp.amountINR * 100);
      const cleanSlug = exp.description.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const txId = `tx-hist-${exp.date.replace(/-/g, '')}-${cleanSlug}-${amountPaise}-${i + 1}`;

      // Check duplicate
      const existing = checkTxStmt.get(txId);
      if (!existing) {
        insertTxStmt.run(txId, amountPaise, exp.categoryId, exp.date, exp.description, nowIso);
        expensesAdded++;
        totalExpensePaise += amountPaise;

        const mKey = exp.date.substring(0, 7);
        if (monthTotals[mKey]) {
          monthTotals[mKey].count++;
          monthTotals[mKey].totalPaise += amountPaise;
        }

        // Deduct from Personal Spending balance
        db.prepare('UPDATE accounts SET balance_paise = balance_paise - ? WHERE id = ?').run(amountPaise, 'acc-spending');
      }
    }

    // 3. Record 2 Income Transactions (kept 100% unallocated)
    const incomeRecords = [
      {
        id: 'inc-hist-vandan',
        source: 'Vandan',
        amountINR: 4200,
        amountPaise: 420000,
        date: '2026-11-06',
        description: 'Actual received date unknown; recorded on 06/11/2026',
      },
      {
        id: 'inc-hist-misc',
        source: 'Miscellaneous',
        amountINR: 1000,
        amountPaise: 100000,
        date: '2026-11-06',
        description: 'Actual received date unknown; recorded on 06/11/2026',
      },
    ];

    let incomesAdded = 0;
    let totalIncomePaise = 0;
    const insertIncStmt = db.prepare(`
      INSERT INTO incomes (id, amount_paise, source, date, description, allocated_paise, unallocated_paise, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `);
    const checkIncStmt = db.prepare('SELECT id FROM incomes WHERE id = ?');

    for (const inc of incomeRecords) {
      const existingInc = checkIncStmt.get(inc.id);
      if (!existingInc) {
        insertIncStmt.run(inc.id, inc.amountPaise, inc.source, inc.date, inc.description, inc.amountPaise, nowIso);
        incomesAdded++;
        totalIncomePaise += inc.amountPaise;
      }
    }

    db.exec('COMMIT');

    console.log(`[Import] Successfully imported ${expensesAdded} expenses (total ₹${(totalExpensePaise / 100).toFixed(2)})`);
    console.log(`[Import] Successfully created ${incomesAdded} unallocated incomes (total ₹${(totalIncomePaise / 100).toFixed(2)})`);

    console.log('\n--- MONTH-WISE EXPENSE SUMMARY ---');
    for (const [mKey, stats] of Object.entries(monthTotals)) {
      console.log(`- ${mKey}: ${stats.count} transactions, ₹${(stats.totalPaise / 100).toFixed(2)} (${stats.totalPaise} paise)`);
    }

    // Schedule sync to Turso cloud
    scheduleTursoSync();

    return {
      expensesAdded,
      totalExpensePaise,
      incomesAdded,
      totalIncomePaise,
      monthTotals,
    };
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('[Import] Failed to import:', err);
    throw err;
  }
}

if (process.argv[1]?.includes('importHistoricalData')) {
  runHistoricalImport().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
