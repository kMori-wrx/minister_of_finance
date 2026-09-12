let accounts = [];
let editingId = null;
let selectedJournalId = null;
let selectedAccountId = null;
let accountCategory = '';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const yen = (n) => `¥${Number(n || 0).toLocaleString('ja-JP')}`;
const dateJP = (s) => String(s).replaceAll('-', '/');
const escapeHtml = (s) => String(s ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const currentYear = () => new Date().getFullYear();
const currentMonth = () => String(new Date().getMonth() + 1).padStart(2, '0');

function fillAccountSelects() {
  const active = accounts.filter((a) => a.active);
  $('#txAccount').innerHTML = ['<option value="">選択してください</option>', ...active.map((a) => `<option value="${a.id}">${escapeHtml(a.code)}　${escapeHtml(a.name)}</option>`)].join('');
  $('#filterAccount').innerHTML = '<option value="">すべて</option>' + active.map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
}
async function refreshAccounts() { accounts = await window.db.getAccounts({ includeInactive: true }); fillAccountSelects(); }
function configurePeriods() {
  $('#monthlyYear').innerHTML = `<option value="${currentYear()}">${currentYear()}</option>`;
  $('#monthlyMonth').value = currentMonth();
  $('#exportMonth').innerHTML = `<option value="${currentMonth()}">${currentYear()}年${Number(currentMonth())}月</option>`;
  $('#exportFrom').value = `${currentYear()}-${currentMonth()}-01`;
  $('#exportTo').value = today();
}
async function transactions(filters = {}) { return window.db.getTransactions(filters); }

async function showScreen(id) {
  $$('.screen').forEach((screen) => screen.classList.toggle('active', screen.id === id));
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.screen === id));
  const names = { dashboard: 'ダッシュボード', transaction: '取引入力', journal: '取引・仕訳一覧', monthly: '月次集計', accounts: '勘定科目マスタ', export: 'Excel出力' };
  $('#statusText').textContent = `${names[id]}を表示しています`;
  if (id === 'dashboard') await renderDashboard();
  if (id === 'journal') await renderJournal();
  if (id === 'monthly') await renderMonthly();
  if (id === 'accounts') await renderAccounts();
  if (id === 'export') await renderExportPreview();
}
async function renderDashboard() {
  const key = `${currentYear()}-${currentMonth()}`;
  const rows = await transactions({ from: `${key}-01`, to: today() });
  const sales = rows.filter((r) => r.type === '売上').reduce((n, r) => n + r.amount, 0);
  const expense = rows.filter((r) => ['経費', '仕入'].includes(r.type)).reduce((n, r) => n + r.amount, 0);
  $('#salesTotal').textContent = yen(sales); $('#expenseTotal').textContent = yen(expense); $('#profitTotal').textContent = yen(sales - expense);
  $('#profitRate').textContent = sales ? `${Math.round(((sales - expense) / sales) * 100)}%` : '0%'; $('#transactionCount').textContent = `${rows.length}件`;
  $('#recentTransactions').innerHTML = rows.slice(0, 5).map((r) => `<tr><td>${dateJP(r.date)}</td><td>${escapeHtml(r.type)}</td><td>${escapeHtml(r.description || '—')}</td><td class="right">${yen(r.amount)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">取引はまだ登録されていません。</td></tr>';
}
async function renderJournal() {
  const filters = { from: $('#filterFrom').value, to: $('#filterTo').value, accountId: Number($('#filterAccount').value) || undefined, type: $('#filterType').value, partner: $('#filterPartner').value.trim(), description: $('#filterDescription').value.trim() };
  const rows = await transactions(filters); $('#journalCount').textContent = `${rows.length}件`;
  $('#journalRows').innerHTML = rows.map((r) => `<tr data-id="${r.id}" class="${selectedJournalId === r.id ? 'selected' : ''}"><td class="selector"><span></span></td><td>${String(r.journalId).padStart(6, '0')}</td><td>${dateJP(r.date)}</td><td>${escapeHtml(r.type)}</td><td>${escapeHtml(r.debit)}</td><td class="right">${yen(r.amount)}</td><td>${escapeHtml(r.credit)}</td><td class="right">${yen(r.amount)}</td><td>${escapeHtml(r.partner || '—')}</td><td>${escapeHtml(r.description || '—')}</td></tr>`).join('') || '<tr><td colspan="10" class="empty">該当する取引はありません。</td></tr>';
  $$('#journalRows tr[data-id]').forEach((row) => row.addEventListener('click', () => { selectedJournalId = Number(row.dataset.id); renderJournal(); }));
}
async function renderMonthly() {
  const year = $('#monthlyYear').value, month = $('#monthlyMonth').value;
  $('#monthlyCaption').textContent = `${year}年${Number(month)}月 月次集計`;
  const rows = await window.db.getMonthlySummary(year, month);
  const totals = rows.reduce((sum, r) => ({ debit: sum.debit + Number(r.debit), credit: sum.credit + Number(r.credit) }), { debit: 0, credit: 0 });
  $('#monthlyRows').innerHTML = rows.map((r) => `<tr><td>${escapeHtml(r.name)}</td><td class="right">${Number(r.debit).toLocaleString()}</td><td class="right">${Number(r.credit).toLocaleString()}</td><td class="right">${Number(r.debit - r.credit).toLocaleString()}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">対象データがありません。</td></tr>';
  $('#monthlyTotals').innerHTML = `<tr><td>合計</td><td class="right">${totals.debit.toLocaleString()}</td><td class="right">${totals.credit.toLocaleString()}</td><td class="right">${(totals.debit - totals.credit).toLocaleString()}</td></tr>`;
}
async function renderAccounts() {
  await refreshAccounts();
  const rows = accounts.filter((a) => !accountCategory || a.category === accountCategory); $('#accountCount').textContent = `${rows.length}件`;
  $('#accountRows').innerHTML = rows.map((a) => `<tr data-id="${a.id}" class="${selectedAccountId === a.id ? 'selected' : ''} ${a.active ? '' : 'disabled-row'}"><td class="selector"><span></span></td><td>${escapeHtml(a.code)}</td><td>${escapeHtml(a.name)}</td><td>${escapeHtml(a.category)}</td><td class="right">${a.displayOrder}</td><td>${a.active ? '有効' : '無効'}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">勘定科目が未登録です。「新規追加」から登録してください。</td></tr>';
  $$('#accountRows tr[data-id]').forEach((row) => row.addEventListener('click', () => { selectedAccountId = Number(row.dataset.id); renderAccounts(); }));
}
function paymentAccount(method) { return { '現金': '現金', '普通預金': '普通預金', 'クレジットカード': '未払金', 'その他': 'その他流動資産' }[method] || '—'; }
function updatePreview() {
  const type = $('#txType').value, amount = Number($('#txAmount').value), payment = paymentAccount($('#txMethod').value);
  const subject = accounts.find((a) => a.id === Number($('#txAccount').value))?.name || '―', incoming = ['売上', '入金'].includes(type);
  const ready = type && amount > 0 && payment !== '—' && subject !== '―';
  $('#previewDebit').textContent = ready ? (incoming ? payment : subject) : '―'; $('#previewCredit').textContent = ready ? (incoming ? subject : payment) : '―';
  $('#previewDebitAmount').textContent = amount ? yen(amount) : '―'; $('#previewCreditAmount').textContent = amount ? yen(amount) : '―';
  $('#balanceStatus').textContent = ready ? '一致（登録可能）' : '入力待ち'; $('#balanceStatus').classList.toggle('ok', Boolean(ready));
}
function clearForm() {
  editingId = null; $('#transactionForm').reset(); $('#txDate').value = today(); $('#transactionTitle').textContent = '取引入力';
  $('#transactionSubtitle').textContent = accounts.some((a) => a.active) ? '取引内容を入力すると、仕訳を自動作成します。' : '先に勘定科目マスタを登録してください。';
  $('#editBadge').textContent = '新規登録'; $('#formError').textContent = ''; updatePreview();
}
function readForm() { return { id: editingId, date: $('#txDate').value, type: $('#txType').value, amount: Number($('#txAmount').value), method: $('#txMethod').value, accountId: Number($('#txAccount').value), partner: $('#txPartner').value.trim(), description: $('#txDescription').value.trim(), memo: $('#txMemo').value.trim() }; }
async function loadTransaction(id) {
  const row = (await transactions()).find((r) => r.id === id); if (!row) return;
  editingId = id; $('#txDate').value = row.date; $('#txType').value = row.type; $('#txAmount').value = row.amount; $('#txMethod').value = row.method; $('#txAccount').value = row.accountId; $('#txPartner').value = row.partner; $('#txDescription').value = row.description; $('#txMemo').value = row.memo;
  $('#transactionTitle').textContent = '取引編集'; $('#transactionSubtitle').textContent = `仕訳ID ${String(row.journalId).padStart(6, '0')} の元取引を編集します。保存時に仕訳も更新されます。`; $('#editBadge').textContent = `編集中：ID ${String(row.journalId).padStart(6, '0')}`; $('#formError').textContent = ''; updatePreview(); await showScreen('transaction');
}
async function saveTransaction() {
  const row = readForm();
  if (!row.date || !row.type || !Number.isInteger(row.amount) || row.amount <= 0 || !row.method || !row.accountId) { $('#formError').textContent = '必須項目をすべて入力し、金額には1円以上の整数を入力してください。'; return; }
  try { await window.db.saveTransaction(row); await refreshAccounts(); toast(editingId ? '取引と仕訳を更新しました。' : '取引を登録し、仕訳を自動生成しました。', 'success'); clearForm(); await renderDashboard(); } catch (error) { $('#formError').textContent = error.message; }
}
function modal(title, body, actions = []) {
  $('#modalTitle').textContent = title; $('#modalBody').innerHTML = body; $('#modalActions').innerHTML = '';
  actions.forEach((action) => { const button = document.createElement('button'); button.className = `btn ${action.className || ''}`; button.textContent = action.label; button.addEventListener('click', action.action); $('#modalActions').append(button); });
  $('#modal').classList.remove('hidden');
}
function closeModal() { $('#modal').classList.add('hidden'); }
let toastTimer;
function toast(message, type = '') { const el = $('#toast'); el.textContent = message; el.className = `toast ${type}`; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.className = 'toast hidden'; }, 2800); }
function downloadCsv(file, headers, rows) {
  const csv = '\ufeff' + [headers, ...rows].map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = file; link.click(); URL.revokeObjectURL(link.href); toast(`${file} を出力しました。`, 'success');
}
async function csvDownload(kind, scope = {}) {
  if (kind === 'monthly') { const year = scope.year || $('#monthlyYear').value, month = scope.month || $('#monthlyMonth').value, rows = await window.db.getMonthlySummary(year, month); downloadCsv(`月次集計_${year}-${month}.csv`, ['勘定科目', '借方合計', '貸方合計', '差額'], rows.map((r) => [r.name, r.debit, r.credit, r.debit - r.credit])); return; }
  const rows = await transactions(scope); downloadCsv('仕訳一覧.csv', ['仕訳ID', '取引日', '借方科目', '借方金額', '貸方科目', '貸方金額', '取引先', '摘要'], rows.map((r) => [r.journalId, dateJP(r.date), r.debit, r.amount, r.credit, r.amount, r.partner, r.description]));
}
async function renderExportPreview() {
  const type = $('#exportType').value; $('#exportMonthWrap').classList.toggle('hidden', type !== 'monthly'); let headers, rows;
  if (type === 'monthly') { const year = currentYear(), month = $('#exportMonth').value; headers = ['勘定科目', '借方合計', '貸方合計', '差額']; rows = (await window.db.getMonthlySummary(year, month)).map((r) => [r.name, yen(r.debit), yen(r.credit), yen(r.debit - r.credit)]); $('#exportPreviewMeta').textContent = `${year}年${Number(month)}月`; }
  else { headers = ['仕訳ID', '取引日', '借方科目', '借方金額', '貸方科目', '貸方金額', '取引先', '摘要']; rows = (await transactions({ from: $('#exportFrom').value, to: $('#exportTo').value })).slice(0, 8).map((r) => [r.journalId, dateJP(r.date), r.debit, yen(r.amount), r.credit, yen(r.amount), r.partner || '—', r.description || '—']); $('#exportPreviewMeta').textContent = `${rows.length}件を表示（最大8件）`; }
  $('#exportPreviewTable thead').innerHTML = `<tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>`; $('#exportPreviewTable tbody').innerHTML = rows.map((row) => `<tr>${row.map((v) => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${headers.length}" class="empty">対象データがありません。</td></tr>`;
}
function accountDialog(account) {
  const isNew = !account;
  modal(isNew ? '勘定科目の新規追加' : '勘定科目の編集', `<div class="account-dialog"><label>科目コード<input id="mCode" value="${escapeHtml(account?.code || '')}"></label><label>科目名<input id="mName" value="${escapeHtml(account?.name || '')}"></label><label>科目区分<select id="mCategory">${['資産', '負債', '収益', '費用'].map((c) => `<option ${account?.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label><label>表示順<input id="mOrder" type="number" min="0" value="${account?.displayOrder ?? accounts.length + 1}"></label></div>`, [{ label: 'キャンセル', action: closeModal }, { label: '保存', className: 'primary', action: async () => { try { await window.db.saveAccount({ id: account?.id, code: $('#mCode').value, name: $('#mName').value, category: $('#mCategory').value, displayOrder: Number($('#mOrder').value), active: account?.active ?? true }); closeModal(); await renderAccounts(); toast('勘定科目を保存しました。', 'success'); } catch (error) { toast(error.message, 'error'); } } }]);
}
async function init() {
  try { if (!window.db) throw new Error('このアプリは Electron から起動してください。'); await window.db.initialize(); configurePeriods(); await refreshAccounts(); clearForm(); await renderDashboard(); } catch (error) { $('#statusText').textContent = error.message; toast(error.message, 'error'); return; }
  $$('#sideNav .nav-item').forEach((b) => b.addEventListener('click', () => showScreen(b.dataset.screen))); $$('[data-go]').forEach((b) => b.addEventListener('click', () => showScreen(b.dataset.go)));
  ['#txType', '#txAmount', '#txMethod', '#txAccount'].forEach((s) => $(s).addEventListener('input', updatePreview)); $('#newTransaction').addEventListener('click', clearForm); $('#clearTransaction').addEventListener('click', clearForm); $('#saveTransaction').addEventListener('click', saveTransaction);
  $('#applySearch').addEventListener('click', renderJournal); $('#clearSearch').addEventListener('click', () => { $('#filterFrom').value = ''; $('#filterTo').value = ''; $('#filterAccount').value = ''; $('#filterType').value = ''; $('#filterPartner').value = ''; $('#filterDescription').value = ''; renderJournal(); });
  $('#editSelected').addEventListener('click', () => selectedJournalId ? loadTransaction(selectedJournalId) : toast('編集する取引を一覧から選択してください。', 'error'));
  $('#deleteSelected').addEventListener('click', async () => { const row = selectedJournalId && (await transactions()).find((r) => r.id === selectedJournalId); if (!row) { toast('削除する取引を一覧から選択してください。', 'error'); return; } modal('取引の削除', `<div class="modal-body">仕訳ID <b>${String(row.journalId).padStart(6, '0')}</b>「${escapeHtml(row.description || '摘要なし')}」を削除します。<br>対応する仕訳も一覧から除外されます。</div>`, [{ label: 'キャンセル', action: closeModal }, { label: '削除する', className: 'primary', action: async () => { try { await window.db.deleteTransaction(row.id); selectedJournalId = null; closeModal(); await renderJournal(); await renderDashboard(); toast('取引を削除しました。', 'success'); } catch (error) { toast(error.message, 'error'); } } }]); });
  $('#exportJournal').addEventListener('click', () => csvDownload('journal')); $('#runMonthly').addEventListener('click', renderMonthly); $('#runMonthly2').addEventListener('click', renderMonthly); $('#exportMonthly').addEventListener('click', () => csvDownload('monthly'));
  $$('#accountTabs button').forEach((b) => b.addEventListener('click', () => { accountCategory = b.dataset.category; $$('#accountTabs button').forEach((x) => x.classList.toggle('active', x === b)); renderAccounts(); })); $('#addAccount').addEventListener('click', () => accountDialog()); $('#editAccount').addEventListener('click', () => { const a = accounts.find((x) => x.id === selectedAccountId); a ? accountDialog(a) : toast('編集する勘定科目を選択してください。', 'error'); });
  $('#toggleAccount').addEventListener('click', async () => { const a = accounts.find((x) => x.id === selectedAccountId); if (!a) { toast('勘定科目を選択してください。', 'error'); return; } try { await window.db.saveAccount({ ...a, active: !a.active }); await renderAccounts(); toast(`「${a.name}」を${a.active ? '無効' : '有効'}にしました。`, 'success'); } catch (error) { toast(error.message, 'error'); } });
  $('#exportType').addEventListener('change', renderExportPreview); $('#previewExport').addEventListener('click', renderExportPreview); $('#downloadExport').addEventListener('click', () => $('#exportType').value === 'monthly' ? csvDownload('monthly', { year: currentYear(), month: $('#exportMonth').value }) : csvDownload('journal', { from: $('#exportFrom').value, to: $('#exportTo').value })); $('#modalClose').addEventListener('click', closeModal); $('#modal').addEventListener('click', (event) => { if (event.target === $('#modal')) closeModal(); });
}
document.addEventListener('DOMContentLoaded', init);
