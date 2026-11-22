const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld(
  'licenseConsole',
  Object.freeze({
    api: (payload) => ipcRenderer.invoke('console:api', payload),
    loadToken: () => ipcRenderer.invoke('console:token-load'),
    saveToken: (token) => ipcRenderer.invoke('console:token-save', token),
    clearToken: () => ipcRenderer.invoke('console:token-clear'),
    copyText: (text) => ipcRenderer.invoke('console:clipboard-write', text),
    exportCsv: (content, filename) =>
      ipcRenderer.invoke('console:export-csv', { content, filename }),
  }),
)
