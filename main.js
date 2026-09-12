const { app, BrowserWindow, ipcMain } = require('electron');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

let database;
const now = () => new Date().toISOString();
const fail = (message) => { throw new Error(message); };

app.setName('勘定大臣');
app.setPath('userData', path.join(app.getPath('appData'), 'kanjo-daijin'));

function openDatabase() {
  if (database) return database;
  const databasePath = path.join(app.getPath('userData'), 'kanjo-daijin.db');
  database = new Database(databasePath);
  database.pragma('foreign_keys = ON');
  database.exec(fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8'));
  return database;
}

function paymentAccountName(method) {
  return { '現金': '現金', '普通預金': '普通預金', 'クレジットカード': '未払金', 'その他': 'その他流動資産' }[method];
}

function paymentAccount(db, method) {
  const name = paymentAccountName(method);
  if (!name) fail('支払・入金方法が不正です。');
  const account = db.prepare('SELECT id, name FROM accounts WHERE name = ? AND is_active = 1').get(name);
  if (!account) fail(`「${name}」を有効な勘定科目として登録してください。`);
  return account;
}

function buildJournal(transaction, cashAccount) {
  const incoming = ['売上', '入金'].includes(transaction.type);
  return {
    debitAccountId: incoming ? cashAccount.id : transaction.accountId,
    creditAccountId: incoming ? transaction.accountId : cashAccount.id
  };
}

function registerHandlers() {
  ipcMain.handle('db:initialize', () => {
    openDatabase();
    return { initialized: true, databasePath: path.join(app.getPath('userData'), 'kanjo-daijin.db') };
  });

  ipcMain.handle('db:getAccounts', (_event, filters = {}) => {
    const db = openDatabase();
    const clauses = [];
    const params = [];
    if (filters.category) { clauses.push('category = ?'); params.push(filters.category); }
    if (!filters.includeInactive) clauses.push('is_active = 1');
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    return db.prepare(`SELECT id, code, name, category, display_order AS displayOrder, is_active AS active FROM accounts ${where} ORDER BY display_order, code`).all(...params);
  });

  ipcMain.handle('db:saveAccount', (_event, account) => {
    const db = openDatabase();
    const item = {
      id: Number(account.id) || null,
      code: String(account.code || '').trim(),
      name: String(account.name || '').trim(),
      category: String(account.category || ''),
      displayOrder: Number(account.displayOrder),
      active: account.active === false ? 0 : 1
    };
    if (!item.code || !item.name || !['資産', '負債', '収益', '費用'].includes(item.category) || !Number.isInteger(item.displayOrder)) fail('勘定科目の入力内容を確認してください。');
    try {
      const stamp = now();
      if (item.id) {
        const result = db.prepare('UPDATE accounts SET code = ?, name = ?, category = ?, display_order = ?, is_active = ?, updated_at = ? WHERE id = ?').run(item.code, item.name, item.category, item.displayOrder, item.active, stamp, item.id);
        if (!result.changes) fail('対象の勘定科目が見つかりません。');
        return { ...item, active: Boolean(item.active) };
      }
      const result = db.prepare('INSERT INTO accounts (code, name, category, display_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(item.code, item.name, item.category, item.displayOrder, item.active, stamp, stamp);
      return { ...item, id: Number(result.lastInsertRowid), active: Boolean(item.active) };
    } catch (error) {
      if (String(error.message).includes('UNIQUE constraint failed')) fail('同じ科目コードまたは科目名が既に登録されています。');
      throw error;
    }
  });

  ipcMain.handle('db:getTransactions', (_event, filters = {}) => {
    const db = openDatabase();
    const clauses = ['t.is_deleted = 0', 'j.is_deleted = 0'];
    const params = [];
    if (filters.from) { clauses.push('t.transaction_date >= ?'); params.push(filters.from); }
    if (filters.to) { clauses.push('t.transaction_date <= ?'); params.push(filters.to); }
    if (filters.accountId) { clauses.push('t.account_id = ?'); params.push(filters.accountId); }
    if (filters.type) { clauses.push('t.transaction_type = ?'); params.push(filters.type); }
    if (filters.partner) { clauses.push('t.partner_name LIKE ?'); params.push(`%${filters.partner}%`); }
    if (filters.description) { clauses.push('t.description LIKE ?'); params.push(`%${filters.description}%`); }
    return db.prepare(`SELECT t.id, t.transaction_date AS date, t.transaction_type AS type, t.amount, t.payment_method AS method, t.account_id AS accountId, account.name AS account, t.partner_name AS partner, t.description, t.memo, j.id AS journalId, debit.name AS debit, credit.name AS credit
      FROM transactions t
      JOIN journals j ON j.transaction_id = t.id
      JOIN accounts account ON account.id = t.account_id
      JOIN accounts debit ON debit.id = j.debit_account_id
      JOIN accounts credit ON credit.id = j.credit_account_id
      WHERE ${clauses.join(' AND ')} ORDER BY t.transaction_date DESC, t.id DESC`).all(...params);
  });

  ipcMain.handle('db:saveTransaction', (_event, transaction) => {
    const db = openDatabase();
    const item = {
      id: Number(transaction.id) || null,
      date: String(transaction.date || ''),
      type: String(transaction.type || ''),
      amount: Number(transaction.amount),
      method: String(transaction.method || ''),
      accountId: Number(transaction.accountId),
      partner: String(transaction.partner || '').trim(),
      description: String(transaction.description || '').trim(),
      memo: String(transaction.memo || '').trim()
    };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !['売上', '仕入', '経費', '入金', '出金', 'その他'].includes(item.type) || !Number.isInteger(item.amount) || item.amount <= 0 || !item.method || !item.accountId) fail('取引の必須項目または金額を確認してください。');
    const save = db.transaction(() => {
      const subject = db.prepare('SELECT id FROM accounts WHERE id = ? AND is_active = 1').get(item.accountId);
      if (!subject) fail('有効な勘定科目を選択してください。');
      const payment = paymentAccount(db, item.method);
      const journal = buildJournal(item, payment);
      const stamp = now();
      let transactionId = item.id;
      if (transactionId) {
        const result = db.prepare('UPDATE transactions SET transaction_date = ?, transaction_type = ?, amount = ?, payment_method = ?, account_id = ?, partner_name = ?, description = ?, memo = ?, updated_at = ? WHERE id = ? AND is_deleted = 0').run(item.date, item.type, item.amount, item.method, item.accountId, item.partner, item.description, item.memo, stamp, transactionId);
        if (!result.changes) fail('対象の取引が見つかりません。');
        db.prepare('UPDATE journals SET journal_date = ?, debit_account_id = ?, debit_amount = ?, credit_account_id = ?, credit_amount = ?, description = ?, updated_at = ?, is_deleted = 0 WHERE transaction_id = ?').run(item.date, journal.debitAccountId, item.amount, journal.creditAccountId, item.amount, item.description, stamp, transactionId);
      } else {
        const result = db.prepare('INSERT INTO transactions (transaction_date, transaction_type, amount, payment_method, account_id, partner_name, description, memo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(item.date, item.type, item.amount, item.method, item.accountId, item.partner, item.description, item.memo, stamp, stamp);
        transactionId = Number(result.lastInsertRowid);
        db.prepare('INSERT INTO journals (transaction_id, journal_date, debit_account_id, debit_amount, credit_account_id, credit_amount, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(transactionId, item.date, journal.debitAccountId, item.amount, journal.creditAccountId, item.amount, item.description, stamp, stamp);
      }
      return transactionId;
    });
    return { id: save() };
  });

  ipcMain.handle('db:deleteTransaction', (_event, id) => {
    const db = openDatabase();
    const deleteTransaction = db.transaction(() => {
      const stamp = now();
      const result = db.prepare('UPDATE transactions SET is_deleted = 1, updated_at = ? WHERE id = ? AND is_deleted = 0').run(stamp, Number(id));
      if (!result.changes) fail('対象の取引が見つかりません。');
      db.prepare('UPDATE journals SET is_deleted = 1, updated_at = ? WHERE transaction_id = ?').run(stamp, Number(id));
    });
    deleteTransaction();
    return { deleted: true };
  });

  ipcMain.handle('db:getMonthlySummary', (_event, year, month) => {
    const db = openDatabase();
    const target = `${Number(year)}-${String(month).padStart(2, '0')}`;
    return db.prepare(`WITH movements AS (
        SELECT debit_account_id AS account_id, debit_amount AS debit, 0 AS credit FROM journals WHERE is_deleted = 0 AND substr(journal_date, 1, 7) = ?
        UNION ALL
        SELECT credit_account_id AS account_id, 0 AS debit, credit_amount AS credit FROM journals WHERE is_deleted = 0 AND substr(journal_date, 1, 7) = ?
      )
      SELECT a.id AS accountId, a.name, SUM(m.debit) AS debit, SUM(m.credit) AS credit
      FROM movements m JOIN accounts a ON a.id = m.account_id
      GROUP BY a.id, a.name, a.display_order ORDER BY a.display_order, a.code`).all(target, target);
  });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.js') }
  });
  window.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  registerHandlers();
  openDatabase();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { if (database) database.close(); });
