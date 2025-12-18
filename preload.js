const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),
    on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args))
});
