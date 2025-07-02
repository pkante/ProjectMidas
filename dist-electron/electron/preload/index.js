"use strict";
// Use require instead of import for Electron APIs in preload context
// console.log('Preload script path:', __filename);
console.log('Electron version:', process.versions.electron);
const { contextBridge, ipcRenderer, desktopCapturer, screen: electronScreen } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
    sendMessage: (msg, screenshotBase64) => ipcRenderer.send('chat:send', msg, screenshotBase64),
    onMessage: (callback) => {
        ipcRenderer.on('chat:message', (_event, msg) => callback(msg));
    },
    sendExpandToChat: () => ipcRenderer.send('expand-to-chat'),
    sendCollapseToIcon: () => ipcRenderer.send('collapse-to-icon'),
    moveWindow: (x, y) => ipcRenderer.send('move-window', x, y),
    getCurrentWindowPositionSync: async () => {
        return await ipcRenderer.invoke('get-window-position');
    },
    captureScreenshot: async () => {
        const primaryDisplay = electronScreen.getPrimaryDisplay();
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: {
                width: primaryDisplay.size.width,
                height: primaryDisplay.size.height
            }
        });
        if (sources.length === 0)
            return null;
        // Find the source that matches the primary display
        let screenSource = sources[0];
        for (const source of sources) {
            if (source.display_id === `${primaryDisplay.id}`) {
                screenSource = source;
                break;
            }
        }
        const dataUrl = screenSource.thumbnail.toDataURL();
        // Permission check: if screenshot is too small, likely permission issue
        if (!dataUrl || dataUrl.length < 10000) {
            ipcRenderer.send('show-screen-permission-dialog');
            return null;
        }
        return dataUrl;
    },
    captureAndSaveScreenshot: async () => {
        const dataUrl = await window.electronAPI.captureScreenshot();
        if (dataUrl) {
            ipcRenderer.send('save-debug-screenshot', dataUrl);
        }
        return dataUrl;
    },
});
// Preload script
window.addEventListener('DOMContentLoaded', () => {
    // Example: Replace text in HTML
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector);
        if (element)
            element.innerText = text;
    };
    replaceText('info', 'Preload script loaded!');
});
console.log('Preload script loaded!');
console.log('typeof electronScreen:', typeof electronScreen);
console.log('typeof desktopCapturer:', typeof desktopCapturer);
console.log('typeof ipcRenderer:', typeof ipcRenderer);
console.log('typeof contextBridge:', typeof contextBridge);
