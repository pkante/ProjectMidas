console.log('=== PRELOAD SCRIPT LOADED ===');
console.log('Node.js version:', process.versions.node);
console.log('Electron version:', process.versions.electron);

// Use require instead of import for Electron APIs in preload context
// console.log('Preload script path:', __filename);
console.log('Electron version:', process.versions.electron);

const { contextBridge, ipcRenderer } = require('electron');

console.log('=== ELECTRON APIS ===');
console.log('contextBridge:', typeof contextBridge);
console.log('ipcRenderer:', typeof ipcRenderer);
console.log('require("electron"):', typeof require('electron'));

contextBridge.exposeInMainWorld('electronAPI', {
  sendMessage: (msg: string, screenshotBase64?: string) => ipcRenderer.send('chat:send', msg, screenshotBase64),
  onMessage: (callback: (msg: string) => void) => {
    ipcRenderer.on('chat:message', (_event: any, msg: any) => callback(msg));
  },
  sendExpandToChat: () => ipcRenderer.send('expand-to-chat'),
  sendCollapseToIcon: () => ipcRenderer.send('collapse-to-icon'),
  moveWindow: (x: number, y: number) => ipcRenderer.send('move-window', x, y),
  getCurrentWindowPositionSync: async () => {
    return await ipcRenderer.invoke('get-window-position');
  },
  captureScreenshot: async () => {
    console.log('=== CAPTURE SCREENSHOT CALLED ===');
    try {
      const dataUrl = await ipcRenderer.invoke('capture-screenshot');
      console.log('Screenshot captured via IPC, result:', dataUrl ? 'success' : 'failed');
      return dataUrl;
    } catch (error) {
      console.error('Error capturing screenshot via IPC:', error);
      return null;
    }
  },
  // New APIs for background OCR
  setOcrPaused: (paused: boolean) => ipcRenderer.send('ocr:set-paused', paused),
  triggerOcrFromShareScreen: (screenshotBase64: string) => ipcRenderer.send('ocr:process-screenshot', screenshotBase64),
  // New API for dynamic resizing
  resizeWindow: (height: number) => ipcRenderer.send('resize-window', height),
});

// Preload script
window.addEventListener('DOMContentLoaded', () => {
  // Example: Replace text in HTML
  const replaceText = (selector: string, text: string) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };
  replaceText('info', 'Preload script loaded!');
});

console.log('Preload script loaded!');
console.log('typeof ipcRenderer:', typeof ipcRenderer);
console.log('typeof contextBridge:', typeof contextBridge); 