const accounts = [
  ['1000','現金','資産',1,true],['1010','普通預金','資産',2,true],['1020','売掛金','資産',3,true],['1090','その他流動資産','資産',4,true],['2000','買掛金','負債',10,true],['2010','未払金','負債',11,true],['2100','借入金','負債',12,true],['4000','売上','収益',20,true],['5000','仕入','費用',30,true],['5100','給料','費用',31,true],['5200','通信費','費用',32,true],['5300','消耗品費','費用',33,true],['5400','旅費交通費','費用',34,true],['5500','水道光熱費','費用',35,true],['5600','地代家賃','費用',36,true],['5700','支払手数料','費用',37,true],['5900','その他経費','費用',39,true]
].map(([code,name,category,order,active])=>({code,name,category,order,active}));

let transactions = [
  {id:10,date:'2026-09-10',type:'経費',amount:18000,method:'普通預金',account:'地代家賃',partner:'○○不動産',description:'9月分事務所家賃',memo:''},
  {id:9,date:'2026-09-09',type:'売上',amount:158000,method:'普通預金',account:'売上',partner:'株式会社青葉',description:'Web制作代金',memo:''},
  {id:8,date:'2026-09-08',type:'経費',amount:5280,method:'クレジットカード',account:'通信費',partner:'モバイル通信',description:'携帯電話料金',memo:''},
  {id:7,date:'2026-09-06',type:'入金',amount:50000,method:'普通預金',account:'売掛金',partner:'株式会社中央',description:'売掛金入金',memo:''},
  {id:6,date:'2026-09-05',type:'経費',amount:1200,method:'現金',account:'旅費交通費',partner:'JR東日本',description:'電車代',memo:''},
  {id:5,date:'2026-09-04',type:'売上',amount:85000,method:'現金',account:'売上',partner:'山本商店',description:'商品売上',memo:''},
  {id:4,date:'2026-09-03',type:'仕入',amount:42000,method:'普通預金',account:'仕入',partner:'東亜物産',description:'商品仕入',memo:''},
  {id:3,date:'2026-09-02',type:'売上',amount:10000,method:'現金',account:'売上',partner:'',description:'商品売上',memo:''},
  {id:2,date:'2026-09-01',type:'経費',amount:1000,method:'現金',account:'消耗品費',partner:'文具センター',description:'事務用品購入',memo:''},
  {id:1,date:'2026-08-28',type:'経費',amount:3300,method:'普通預金',account:'通信費',partner:'クラウドサービス',description:'月額利用料',memo:''}
];
let editingId=null, selectedJournalId=null, selectedAccountCode=null, accountCategory='';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const yen = n => `¥${Number(n||0).toLocaleString('ja-JP')}`;
const escapeHtml = s => String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function journalFor(t){
  const incoming=['売上','入金'].includes(t.type); const debit=incoming?t.method:t.account; const credit=incoming?t.account:t.method;
  return {...t,debit,credit};
}
function fillAccountSelects(){
  const opts=['<option value="">選択してください</option>',...accounts.filter(a=>a.active).map(a=>`<option value="${a.name}">${a.code}　${a.name}</option>`)].join('');
  $('#txAccount').innerHTML=opts; $('#filterAccount').innerHTML='<option value="">すべて</option>'+accounts.filter(a=>a.active).map(a=>`<option value="${a.name}">${a.name}</option>`).join('');
}
function showScreen(id){
  $$('.screen').forEach(x=>x.classList.toggle('active',x.id===id)); $$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.screen===id));
  const names={dashboard:'ダッシュボード',transaction:'取引入力',journal:'取引・仕訳一覧',monthly:'月次集計',accounts:'勘定科目マスタ',export:'Excel出力'};
  $('#statusText').textContent=`${names[id]}を表示しています`;
  if(id==='dashboard')renderDashboard(); if(id==='journal')renderJournal(); if(id==='monthly')renderMonthly(); if(id==='accounts')renderAccounts(); if(id==='export')renderExportPreview();
}
function renderDashboard(){
  const month=transactions.filter(t=>t.date.startsWith('2026-09')); const sales=month.filter(t=>t.type==='売上').reduce((s,t)=>s+t.amount,0); const expense=month.filter(t=>['経費','仕入'].includes(t.type)).reduce((s,t)=>s+t.amount,0);
  $('#salesTotal').textContent=yen(sales); $('#expenseTotal').textContent=yen(expense); $('#profitTotal').textContent=yen(sales-expense); $('#profitRate').textContent=sales?`${Math.round((sales-expense)/sales*100)}%`:'0%'; $('#transactionCount').textContent=`${month.length}件`;
  $('#recentTransactions').innerHTML=transactions.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id).slice(0,5).map(t=>`<tr><td>${dateJP(t.date)}</td><td><span class="type-label ${t.type}">${t.type}</span></td><td>${escapeHtml(t.description)}</td><td class="right">${yen(t.amount)}</td></tr>`).join('');
}
function dateJP(s){return s.replaceAll('-','/');}
function renderJournal(){
  const from=$('#filterFrom').value, to=$('#filterTo').value, acct=$('#filterAccount').value, type=$('#filterType').value, partner=$('#filterPartner').value.trim(), desc=$('#filterDescription').value.trim();
  const rows=transactions.filter(t=>(!from||t.date>=from)&&(!to||t.date<=to)&&(!acct||t.account===acct)&&(!type||t.type===type)&&(!partner||t.partner.includes(partner))&&(!desc||t.description.includes(desc))).sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
  $('#journalCount').textContent=`${rows.length}件`;
  $('#journalRows').innerHTML=rows.map(t=>{const j=journalFor(t);return `<tr data-id="${t.id}" class="${selectedJournalId===t.id?'selected':''}"><td class="selector"><span></span></td><td>${String(t.id).padStart(6,'0')}</td><td>${dateJP(t.date)}</td><td>${t.type}</td><td>${j.debit}</td><td class="right">${yen(t.amount)}</td><td>${j.credit}</td><td class="right">${yen(t.amount)}</td><td>${escapeHtml(t.partner||'—')}</td><td>${escapeHtml(t.description||'—')}</td></tr>`}).join('') || `<tr><td colspan="10" class="empty">該当する取引はありません。</td></tr>`;
  $$('#journalRows tr[data-id]').forEach(r=>r.addEventListener('click',()=>{selectedJournalId=Number(r.dataset.id);renderJournal();}));
}
function renderMonthly(){
  const ym=`${$('#monthlyYear').value}-${$('#monthlyMonth').value}`; $('#monthlyCaption').textContent=`${Number($('#monthlyYear').value)}年${Number($('#monthlyMonth').value)}月 月次集計`;
  const map={}; accounts.filter(a=>a.active).forEach(a=>map[a.name]={debit:0,credit:0}); transactions.filter(t=>t.date.startsWith(ym)).forEach(t=>{const j=journalFor(t);if(map[j.debit])map[j.debit].debit+=t.amount;if(map[j.credit])map[j.credit].credit+=t.amount;});
  const entries=Object.entries(map).filter(([,v])=>v.debit||v.credit); const totals=entries.reduce((s,[,v])=>({debit:s.debit+v.debit,credit:s.credit+v.credit}),{debit:0,credit:0});
  $('#monthlyRows').innerHTML=entries.map(([name,v])=>`<tr><td>${name}</td><td class="right">${v.debit.toLocaleString()}</td><td class="right">${v.credit.toLocaleString()}</td><td class="right">${(v.debit-v.credit).toLocaleString()}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">対象データがありません。</td></tr>';
  $('#monthlyTotals').innerHTML=`<tr><td>合計</td><td class="right">${totals.debit.toLocaleString()}</td><td class="right">${totals.credit.toLocaleString()}</td><td class="right">${(totals.debit-totals.credit).toLocaleString()}</td></tr>`;
}
function renderAccounts(){
  const rows=accounts.filter(a=>!accountCategory||a.category===accountCategory); $('#accountCount').textContent=`${rows.length}件`;
  $('#accountRows').innerHTML=rows.map(a=>`<tr data-code="${a.code}" class="${selectedAccountCode===a.code?'selected':''} ${a.active?'':'disabled-row'}"><td class="selector"><span></span></td><td>${a.code}</td><td>${a.name}</td><td>${a.category}</td><td class="right">${a.order}</td><td><span class="flag ${a.active?'on':'off'}">${a.active?'有効':'無効'}</span></td></tr>`).join('');
  $$('#accountRows tr[data-code]').forEach(r=>r.addEventListener('click',()=>{selectedAccountCode=r.dataset.code;renderAccounts();}));
}
function updatePreview(){
  const type=$('#txType').value, amount=Number($('#txAmount').value), method=$('#txMethod').value, account=$('#txAccount').value;
  let debit='―',credit='―'; if(type&&method&&account){({debit,credit}=journalFor({type,method,account}));}
  $('#previewDebit').textContent=debit; $('#previewCredit').textContent=credit; $('#previewDebitAmount').textContent=amount?yen(amount):'―'; $('#previewCreditAmount').textContent=amount?yen(amount):'―';
  const ready=type&&amount>0&&method&&account; $('#balanceStatus').textContent=ready?'一致（登録可能）':'入力待ち'; $('#balanceStatus').classList.toggle('ok',!!ready);
}
function readForm(){return {id:editingId||Math.max(0,...transactions.map(t=>t.id))+1,date:$('#txDate').value,type:$('#txType').value,amount:Number($('#txAmount').value),method:$('#txMethod').value,account:$('#txAccount').value,partner:$('#txPartner').value.trim(),description:$('#txDescription').value.trim(),memo:$('#txMemo').value.trim()};}
function clearForm(){editingId=null;$('#transactionForm').reset();$('#txDate').value='2026-09-12'; $('#transactionTitle').textContent='取引入力';$('#transactionSubtitle').textContent='取引内容を入力すると、仕訳を自動作成します。';$('#editBadge').textContent='新規登録';$('#formError').textContent='';updatePreview();}
function loadTransaction(id){const t=transactions.find(t=>t.id===id);if(!t)return;editingId=id;$('#txDate').value=t.date;$('#txType').value=t.type;$('#txAmount').value=t.amount;$('#txMethod').value=t.method;$('#txAccount').value=t.account;$('#txPartner').value=t.partner;$('#txDescription').value=t.description;$('#txMemo').value=t.memo;$('#transactionTitle').textContent='取引編集';$('#transactionSubtitle').textContent=`仕訳ID ${String(id).padStart(6,'0')} の元取引を編集します。保存時に仕訳も更新されます。`;$('#editBadge').textContent=`編集中：ID ${String(id).padStart(6,'0')}`;$('#formError').textContent='';updatePreview();showScreen('transaction');}
function saveTransaction(){const t=readForm();if(!t.date||!t.type||!t.amount||t.amount<=0||!t.method||!t.account){$('#formError').textContent='必須項目をすべて入力し、金額には1円以上を入力してください。';return} if(editingId){transactions=transactions.map(x=>x.id===editingId?t:x);toast('取引と仕訳を更新しました。','success');}else{transactions.unshift(t);toast('取引を登録し、仕訳を自動生成しました。','success');} clearForm();renderDashboard();}
function modal(title,body,actions=[]){$('#modalTitle').textContent=title;$('#modalBody').innerHTML=body;$('#modalActions').innerHTML='';actions.forEach(a=>{const b=document.createElement('button');b.className=`btn ${a.className||''}`;b.textContent=a.label;b.addEventListener('click',a.action);$('#modalActions').append(b)});$('#modal').classList.remove('hidden')}
function closeModal(){$('#modal').classList.add('hidden')}
let toastTimer;function toast(msg,type=''){const t=$('#toast');t.textContent=msg;t.className=`toast ${type}`;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.className='toast hidden',2800)}
function selectedTransaction(){return transactions.find(t=>t.id===selectedJournalId)}
function csvDownload(kind, scope={}){let headers,rows,file;if(kind==='monthly'){const ym=scope.month||`${$('#monthlyYear').value}-${$('#monthlyMonth').value}`;const map={};accounts.forEach(a=>map[a.name]={d:0,c:0});transactions.filter(t=>t.date.startsWith(ym)).forEach(t=>{const j=journalFor(t);if(map[j.debit])map[j.debit].d+=t.amount;if(map[j.credit])map[j.credit].c+=t.amount});headers=['勘定科目','借方合計','貸方合計','差額'];rows=Object.entries(map).filter(([,v])=>v.d||v.c).map(([n,v])=>[n,v.d,v.c,v.d-v.c]);file=`月次集計_${ym}.csv`;}else{headers=['仕訳ID','取引日','借方科目','借方金額','貸方科目','貸方金額','取引先','摘要'];rows=transactions.filter(t=>(!scope.from||t.date>=scope.from)&&(!scope.to||t.date<=scope.to)).slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id).map(t=>{const j=journalFor(t);return[t.id,dateJP(t.date),j.debit,t.amount,j.credit,t.amount,t.partner,t.description]});file='仕訳一覧.csv'}const csv='\ufeff'+[headers,...rows].map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=file;a.click();URL.revokeObjectURL(a.href);toast(`${file} を出力しました。`,'success')}
function renderExportPreview(){const type=$('#exportType').value;$('#exportMonthWrap').classList.toggle('hidden',type!=='monthly');let headers,rows;if(type==='journal'){const from=$('#exportFrom').value,to=$('#exportTo').value;headers=['仕訳ID','取引日','借方科目','借方金額','貸方科目','貸方金額','取引先','摘要'];rows=transactions.filter(t=>(!from||t.date>=from)&&(!to||t.date<=to)).slice(0,8).map(t=>{const j=journalFor(t);return[t.id,dateJP(t.date),j.debit,yen(t.amount),j.credit,yen(t.amount),t.partner||'—',t.description]});$('#exportPreviewMeta').textContent=`${rows.length}件を表示（最大8件）`;}else{const ym=`2026-${$('#exportMonth').value}`;headers=['勘定科目','借方合計','貸方合計','差額'];const map={};accounts.forEach(a=>map[a.name]={d:0,c:0});transactions.filter(t=>t.date.startsWith(ym)).forEach(t=>{const j=journalFor(t);if(map[j.debit])map[j.debit].d+=t.amount;if(map[j.credit])map[j.credit].c+=t.amount});rows=Object.entries(map).filter(([,v])=>v.d||v.c).map(([n,v])=>[n,yen(v.d),yen(v.c),yen(v.d-v.c)]);$('#exportPreviewMeta').textContent=`2026年${Number($('#exportMonth').value)}月`;}$('#exportPreviewTable thead').innerHTML=`<tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr>`;$('#exportPreviewTable tbody').innerHTML=rows.map(r=>`<tr>${r.map(v=>`<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${headers.length}" class="empty">対象データがありません。</td></tr>`}
function accountDialog(account){const isNew=!account;modal(isNew?'勘定科目の新規追加':'勘定科目の編集',`<div class="account-dialog"><label>科目コード<input id="mCode" value="${account?.code||''}"></label><label>科目名<input id="mName" value="${account?.name||''}"></label><label>科目区分<select id="mCategory">${['資産','負債','収益','費用'].map(c=>`<option ${account?.category===c?'selected':''}>${c}</option>`).join('')}</select></label><label>表示順<input id="mOrder" type="number" value="${account?.order||accounts.length+1}"></label></div>`,[{label:'キャンセル',action:closeModal},{label:'保存',className:'primary',action:()=>{const item={code:$('#mCode').value.trim(),name:$('#mName').value.trim(),category:$('#mCategory').value,order:Number($('#mOrder').value),active:account?.active??true};if(!item.code||!item.name){toast('科目コードと科目名を入力してください。','error');return}if(isNew){if(accounts.some(a=>a.code===item.code)){toast('同じ科目コードが既に存在します。','error');return}accounts.push(item)}else{Object.assign(account,item)}closeModal();fillAccountSelects();renderAccounts();toast('勘定科目を保存しました。','success')}}]);}

function init(){fillAccountSelects();clearForm();renderDashboard();
  $$('#sideNav .nav-item').forEach(b=>b.addEventListener('click',()=>showScreen(b.dataset.screen)));$$('[data-go]').forEach(b=>b.addEventListener('click',()=>showScreen(b.dataset.go)));
  ['#txType','#txAmount','#txMethod','#txAccount'].forEach(s=>$(s).addEventListener('input',updatePreview));$('#newTransaction').addEventListener('click',clearForm);$('#clearTransaction').addEventListener('click',clearForm);$('#saveTransaction').addEventListener('click',saveTransaction);
  $('#applySearch').addEventListener('click',renderJournal);$('#clearSearch').addEventListener('click',()=>{$('#filterFrom').value='';$('#filterTo').value='';$('#filterAccount').value='';$('#filterType').value='';$('#filterPartner').value='';$('#filterDescription').value='';renderJournal()});
  $('#editSelected').addEventListener('click',()=>selectedJournalId?loadTransaction(selectedJournalId):toast('編集する取引を一覧から選択してください。','error'));$('#deleteSelected').addEventListener('click',()=>{const t=selectedTransaction();if(!t){toast('削除する取引を一覧から選択してください。','error');return}modal('取引の削除',`<div class="modal-body">仕訳ID <b>${String(t.id).padStart(6,'0')}</b>「${escapeHtml(t.description)}」を削除します。<br>この操作により、対応する仕訳も一覧から除外されます。</div>`,[{label:'キャンセル',action:closeModal},{label:'削除する',className:'primary',action:()=>{transactions=transactions.filter(x=>x.id!==t.id);selectedJournalId=null;closeModal();renderJournal();renderDashboard();toast('取引を削除しました。','success')}}])});$('#exportJournal').addEventListener('click',()=>csvDownload('journal'));
  $('#runMonthly').addEventListener('click',renderMonthly);$('#runMonthly2').addEventListener('click',renderMonthly);$('#exportMonthly').addEventListener('click',()=>csvDownload('monthly'));
  $$('#accountTabs button').forEach(b=>b.addEventListener('click',()=>{accountCategory=b.dataset.category;$$('#accountTabs button').forEach(x=>x.classList.toggle('active',x===b));renderAccounts()}));$('#addAccount').addEventListener('click',()=>accountDialog());$('#editAccount').addEventListener('click',()=>{const a=accounts.find(a=>a.code===selectedAccountCode);a?accountDialog(a):toast('編集する勘定科目を選択してください。','error')});$('#toggleAccount').addEventListener('click',()=>{const a=accounts.find(a=>a.code===selectedAccountCode);if(!a){toast('勘定科目を選択してください。','error');return}a.active=!a.active;fillAccountSelects();renderAccounts();toast(`「${a.name}」を${a.active?'有効':'無効'}にしました。`,'success')});
  $('#exportType').addEventListener('change',renderExportPreview);$('#previewExport').addEventListener('click',renderExportPreview);$('#downloadExport').addEventListener('click',()=>{const type=$('#exportType').value;csvDownload(type==='monthly'?'monthly':'journal',type==='monthly'?{month:`2026-${$('#exportMonth').value}`}:{from:$('#exportFrom').value,to:$('#exportTo').value})});$('#modalClose').addEventListener('click',closeModal);$('#modal').addEventListener('click',e=>{if(e.target===$('#modal'))closeModal()});
}
document.addEventListener('DOMContentLoaded',init);
