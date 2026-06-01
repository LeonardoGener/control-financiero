const { contextBridge } = require('electron');

// Expose minimal info to renderer; localStorage works in the renderer by default.
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform
});
