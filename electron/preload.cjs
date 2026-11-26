const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld(
  'trucktapDesktop',
  Object.freeze({
    isDesktop: true,
    platform: process.platform,
    updates: {
      getStatus: () => ipcRenderer.invoke('updates:status'),
      check: () => ipcRenderer.invoke('updates:check'),
      setEntitlement: (payload) =>
        ipcRenderer.invoke('updates:set-entitlement', payload),
      download: () => ipcRenderer.invoke('updates:download'),
      install: () => ipcRenderer.invoke('updates:install'),
      onStatus: (callback) => {
        const listener = (_event, status) => callback(status)
        ipcRenderer.on('updates:status', listener)
        return () => ipcRenderer.removeListener('updates:status', listener)
      },
    },
  }),
)
