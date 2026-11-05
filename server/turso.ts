import { createClient, Client } from '@libsql/client';
import { db } from './db.js';

let tursoClient: Client | null = null;
let syncTimeout: NodeJS.Timeout | null = null;

export function getTursoClient(): Client | null {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    return null;
  }

  if (!tursoClient) {
    // Normalize URL: ensure https:// or libsql:// is preserved
    tursoClient = createClient({
      url: url.trim(),
      authToken: authToken.trim(),
    });
  }

  return tursoClient;
}

/**
 * Initialize Turso on server boot:
 * 1. Checks if Turso credentials exist.
 * 2. Creates the necessary tables on Turso if not present.
 * 3. Restores data from Turso into the local SQLite database if Turso has records.
 * 4. Or seeds Turso from local SQLite if Turso is empty.
 */
export async function initTursoSync(): Promise<void> {
  const client = getTursoClient();
  if (!client) {
    console.log('[Turso] No TURSO_DATABASE_URL / TURSO_AUTH_TOKEN detected. Running in local SQLite mode.');
    return;
  }

  try {
    console.log('[Turso] Connecting to cloud database...');

    // 1. Ensure master sync table and core schema exist on Turso
    await client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS rupee_sync (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        balance_paise INTEGER NOT NULL DEFAULT 0,
        color TEXT NOT NULL DEFAULT '#0ea5e9',
        icon TEXT NOT NULL DEFAULT 'Wallet',
        is_system INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'expense',
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
        period TEXT NOT NULL DEFAULT 'monthly',
        start_date TEXT NOT NULL,
        end_date TEXT,
        is_paused INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
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
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS transfers (
        id TEXT PRIMARY KEY,
        from_account_id TEXT NOT NULL,
        to_account_id TEXT NOT NULL,
        amount_paise INTEGER NOT NULL,
        date TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        account_id TEXT NOT NULL,
        amount_paise INTEGER NOT NULL,
        category_id TEXT,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        merchant TEXT,
        notes TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS petrol_logs (
        id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL,
        litres REAL,
        price_per_litre REAL,
        odometer_km INTEGER,
        fuel_station TEXT,
        full_tank INTEGER DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS savings_records (
        id TEXT PRIMARY KEY,
        amount_paise INTEGER NOT NULL,
        source_account_id TEXT,
        source_account_name TEXT NOT NULL,
        date TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // 2. Check if Turso has an existing master snapshot
    const syncRow = await client.execute({
      sql: 'SELECT data, updated_at FROM rupee_sync WHERE id = ?',
      args: ['master'],
    });

    if (syncRow.rows.length > 0 && syncRow.rows[0].data) {
      const backupJson = JSON.parse(syncRow.rows[0].data as string);
      console.log(`[Turso] Found cloud backup dated ${syncRow.rows[0].updated_at}. Restoring into local database...`);
      restoreLocalFromBackup(backupJson);
      console.log('[Turso] Cloud restore complete! Local database is fully synchronized.');
    } else {
      console.log('[Turso] Cloud database is empty. Performing initial upload from local database...');
      await pushLocalToTurso();
      console.log('[Turso] Initial cloud sync complete!');
    }
  } catch (err: any) {
    console.error('[Turso] Sync initialization error:', err.message);
  }
}

/**
 * Restore local SQLite database from a JSON backup snapshot
 */
function restoreLocalFromBackup(backup: any) {
  if (!backup || !backup.accounts) return;

  db.exec('PRAGMA foreign_keys = OFF;');
  try {
    db.exec(`
      DELETE FROM savings_records;
      DELETE FROM petrol_logs;
      DELETE FROM transactions;
      DELETE FROM transfers;
      DELETE FROM income_allocations;
      DELETE FROM incomes;
      DELETE FROM budgets;
      DELETE FROM categories;
      DELETE FROM accounts;
      DELETE FROM settings;
    `);

    const insAcc = db.prepare('INSERT INTO accounts (id, name, type, balance_paise, color, icon, is_system, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const a of backup.accounts || []) {
      insAcc.run(a.id, a.name, a.type, a.balance_paise, a.color, a.icon, a.is_system, a.created_at);
    }

    const insCat = db.prepare('INSERT INTO categories (id, name, type, icon, color, is_system) VALUES (?, ?, ?, ?, ?, ?)');
    for (const c of backup.categories || []) {
      insCat.run(c.id, c.name, c.type, c.icon, c.color, c.is_system);
    }

    const insBgt = db.prepare('INSERT INTO budgets (id, name, linked_account_id, category_id, amount_paise, period, start_date, end_date, is_paused, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const b of backup.budgets || []) {
      insBgt.run(b.id, b.name, b.linked_account_id, b.category_id, b.amount_paise, b.period, b.start_date, b.end_date, b.is_paused, b.created_at);
    }

    const insInc = db.prepare('INSERT INTO incomes (id, amount_paise, source, date, description, allocated_paise, unallocated_paise, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const inc of backup.incomes || []) {
      insInc.run(inc.id, inc.amount_paise, inc.source, inc.date, inc.description, inc.allocated_paise, inc.unallocated_paise, inc.created_at);
    }

    const insIa = db.prepare('INSERT INTO income_allocations (id, income_id, account_id, amount_paise, created_at) VALUES (?, ?, ?, ?, ?)');
    for (const ia of backup.income_allocations || []) {
      insIa.run(ia.id, ia.income_id, ia.account_id, ia.amount_paise, ia.created_at);
    }

    const insTrf = db.prepare('INSERT INTO transfers (id, from_account_id, to_account_id, amount_paise, date, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const t of backup.transfers || []) {
      insTrf.run(t.id, t.from_account_id, t.to_account_id, t.amount_paise, t.date, t.note, t.created_at);
    }

    const insTx = db.prepare('INSERT INTO transactions (id, type, account_id, amount_paise, category_id, date, description, merchant, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const tx of backup.transactions || []) {
      insTx.run(tx.id, tx.type, tx.account_id, tx.amount_paise, tx.category_id, tx.date, tx.description, tx.merchant, tx.notes, tx.created_at);
    }

    const insPl = db.prepare('INSERT INTO petrol_logs (id, transaction_id, litres, price_per_litre, odometer_km, fuel_station, full_tank, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const p of backup.petrol_logs || []) {
      insPl.run(p.id, p.transaction_id, p.litres, p.price_per_litre, p.odometer_km, p.fuel_station, p.full_tank, p.notes, p.created_at);
    }

    const insSr = db.prepare('INSERT INTO savings_records (id, amount_paise, source_account_id, source_account_name, date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const s of backup.savings_records || []) {
      insSr.run(s.id, s.amount_paise, s.source_account_id, s.source_account_name, s.date, s.notes, s.created_at);
    }

    const insSet = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    for (const st of backup.settings || []) {
      insSet.run(st.key, st.value);
    }
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }
}

/**
 * Dump current local SQLite state into a structured JSON backup
 */
export function getLocalSnapshot(): any {
  return {
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
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Push current local SQLite state to Turso cloud
 */
export async function pushLocalToTurso(): Promise<void> {
  const client = getTursoClient();
  if (!client) return;

  try {
    const snapshot = getLocalSnapshot();
    const jsonStr = JSON.stringify(snapshot);
    const now = new Date().toISOString();

    // 1. Save master snapshot
    await client.execute({
      sql: `
        INSERT INTO rupee_sync (id, data, updated_at)
        VALUES ('master', ?, ?)
        ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
      `,
      args: [jsonStr, now],
    });

    // 2. Also populate Turso's SQL tables so they are visible in Turso web UI
    const batchStatements: any[] = [
      { sql: 'DELETE FROM savings_records;' },
      { sql: 'DELETE FROM petrol_logs;' },
      { sql: 'DELETE FROM transactions;' },
      { sql: 'DELETE FROM transfers;' },
      { sql: 'DELETE FROM income_allocations;' },
      { sql: 'DELETE FROM incomes;' },
      { sql: 'DELETE FROM budgets;' },
      { sql: 'DELETE FROM categories;' },
      { sql: 'DELETE FROM accounts;' },
      { sql: 'DELETE FROM settings;' },
    ];

    for (const a of snapshot.accounts) {
      batchStatements.push({
        sql: 'INSERT INTO accounts (id, name, type, balance_paise, color, icon, is_system, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        args: [a.id, a.name, a.type, a.balance_paise, a.color, a.icon, a.is_system, a.created_at],
      });
    }

    for (const c of snapshot.categories) {
      batchStatements.push({
        sql: 'INSERT INTO categories (id, name, type, icon, color, is_system) VALUES (?, ?, ?, ?, ?, ?)',
        args: [c.id, c.name, c.type, c.icon, c.color, c.is_system],
      });
    }

    for (const b of snapshot.budgets) {
      batchStatements.push({
        sql: 'INSERT INTO budgets (id, name, linked_account_id, category_id, amount_paise, period, start_date, end_date, is_paused, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [b.id, b.name, b.linked_account_id, b.category_id, b.amount_paise, b.period, b.start_date, b.end_date, b.is_paused, b.created_at],
      });
    }

    for (const inc of snapshot.incomes) {
      batchStatements.push({
        sql: 'INSERT INTO incomes (id, amount_paise, source, date, description, allocated_paise, unallocated_paise, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        args: [inc.id, inc.amount_paise, inc.source, inc.date, inc.description, inc.allocated_paise, inc.unallocated_paise, inc.created_at],
      });
    }

    for (const ia of snapshot.income_allocations) {
      batchStatements.push({
        sql: 'INSERT INTO income_allocations (id, income_id, account_id, amount_paise, created_at) VALUES (?, ?, ?, ?, ?)',
        args: [ia.id, ia.income_id, ia.account_id, ia.amount_paise, ia.created_at],
      });
    }

    for (const t of snapshot.transfers) {
      batchStatements.push({
        sql: 'INSERT INTO transfers (id, from_account_id, to_account_id, amount_paise, date, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [t.id, t.from_account_id, t.to_account_id, t.amount_paise, t.date, t.note, t.created_at],
      });
    }

    for (const tx of snapshot.transactions) {
      batchStatements.push({
        sql: 'INSERT INTO transactions (id, type, account_id, amount_paise, category_id, date, description, merchant, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [tx.id, tx.type, tx.account_id, tx.amount_paise, tx.category_id, tx.date, tx.description, tx.merchant, tx.notes, tx.created_at],
      });
    }

    for (const p of snapshot.petrol_logs) {
      batchStatements.push({
        sql: 'INSERT INTO petrol_logs (id, transaction_id, litres, price_per_litre, odometer_km, fuel_station, full_tank, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [p.id, p.transaction_id, p.litres, p.price_per_litre, p.odometer_km, p.fuel_station, p.full_tank, p.notes, p.created_at],
      });
    }

    for (const s of snapshot.savings_records) {
      batchStatements.push({
        sql: 'INSERT INTO savings_records (id, amount_paise, source_account_id, source_account_name, date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [s.id, s.amount_paise, s.source_account_id, s.source_account_name, s.date, s.notes, s.created_at],
      });
    }

    for (const st of snapshot.settings) {
      batchStatements.push({
        sql: 'INSERT INTO settings (key, value) VALUES (?, ?)',
        args: [st.key, st.value],
      });
    }

    // Execute batch on Turso
    await client.batch(batchStatements, 'write');
    console.log(`[Turso] Successfully synchronized ${snapshot.transactions.length} transactions and balances to Turso.`);
  } catch (err: any) {
    console.error('[Turso] Error syncing to cloud:', err.message);
  }
}

/**
 * Schedule a debounced sync to Turso (waits 500ms after last write)
 */
export function scheduleTursoSync(): void {
  if (!getTursoClient()) return;

  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  syncTimeout = setTimeout(() => {
    pushLocalToTurso().catch(e => console.error('[Turso] Background sync error:', e));
  }, 500);
}
