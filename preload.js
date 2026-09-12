const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('db', {
  initialize: () => ipcRenderer.invoke('db:initialize'),
  getAccounts: (filters) => ipcRenderer.invoke('db:getAccounts', filters),
  saveAccount: (account) => ipcRenderer.invoke('db:saveAccount', account),
  getTransactions: (filters) => ipcRenderer.invoke('db:getTransactions', filters),
  saveTransaction: (transaction) => ipcRenderer.invoke('db:saveTransaction', transaction),
  deleteTransaction: (id) => ipcRenderer.invoke('db:deleteTransaction', id),
  getMonthlySummary: (year, month) => ipcRenderer.invoke('db:getMonthlySummary', year, month)
});
