const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld(
  'trucktapDesktop',
  Object.freeze({
    isDesktop: true,
    platform: process.platform,
  }),
)
