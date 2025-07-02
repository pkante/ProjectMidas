"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fetch = require('node-fetch');
const fs = require('fs');
const pathModule = require('path');
const { dialog, shell } = require('electron');
const child_process = require('child_process');
const { contextBridge, ipcRenderer, desktopCapturer } = require('electron');
const ICON_SIZE = 64;
const CHAT_WIDTH = 400;
const CHAT_HEIGHT = 500;
let overlayWindow = null;
function getDefaultIconPosition() {
    const { width, height } = electron_1.screen.getPrimaryDisplay().workAreaSize;
    return { x: width - ICON_SIZE - 20, y: height - ICON_SIZE - 20 };
}
function createOverlayWindow() {
    const { x, y } = getDefaultIconPosition();
    overlayWindow = new electron_1.BrowserWindow({
        width: ICON_SIZE,
        height: ICON_SIZE,
        x,
        y,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: true, // allow resizing the icon window
        hasShadow: false,
        skipTaskbar: true,
        webPreferences: {
            preload: path_1.default.join(__dirname, '../../../dist-electron/preload/index.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    overlayWindow.loadFile(path_1.default.resolve(__dirname, '../../../public/overlay.html'));
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    overlayWindow.setFocusable(false);
    overlayWindow.webContents.openDevTools({ mode: 'detach' }); // keep DevTools open for debugging
    // Enforce square window
    overlayWindow.on('will-resize', (event, newBounds) => {
        if (!overlayWindow)
            return;
        const size = Math.max(newBounds.width, newBounds.height);
        event.preventDefault();
        overlayWindow.setBounds({
            width: size,
            height: size,
            x: newBounds.x,
            y: newBounds.y,
        });
    });
}
electron_1.ipcMain.on('expand-to-chat', () => {
    console.log('Received expand-to-chat event');
    if (!overlayWindow)
        return;
    const { width, height } = electron_1.screen.getPrimaryDisplay().workAreaSize;
    overlayWindow.setBounds({
        width: CHAT_WIDTH,
        height: CHAT_HEIGHT,
        x: width - CHAT_WIDTH - 20,
        y: height - CHAT_HEIGHT - 40,
    });
    overlayWindow.setResizable(true);
    overlayWindow.setFocusable(true);
    overlayWindow.loadFile(path_1.default.resolve(__dirname, '../../../public/chat-overlay.html'));
});
electron_1.ipcMain.on('collapse-to-icon', () => {
    console.log('Received collapse-to-icon event');
    if (!overlayWindow)
        return;
    const { x, y } = getDefaultIconPosition();
    overlayWindow.setBounds({
        width: ICON_SIZE,
        height: ICON_SIZE,
        x,
        y,
    });
    overlayWindow.setResizable(true);
    overlayWindow.setFocusable(false);
    overlayWindow.loadFile(path_1.default.resolve(__dirname, '../../../public/overlay.html'));
});
// --- OpenAI ChatGPT Integration ---
electron_1.ipcMain.on('chat:send', async (event, msg, screenshotBase64) => {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
        event.sender.send('chat:message', 'Error: OpenAI API key not set.');
        return;
    }
    try {
        let messages = [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: msg },
        ];
        let data, reply;
        if (screenshotBase64) {
            // Save screenshot to disk for debugging
            const base64Data = screenshotBase64.replace(/^data:image\/png;base64,/, '');
            const debugPath = pathModule.join(__dirname, '../../screenshot-debug.png');
            fs.writeFileSync(debugPath, base64Data, 'base64');
            // Send screenshot as image to OpenAI vision endpoint
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                        { role: 'system', content: 'You are a helpful assistant.' },
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: msg },
                                { type: 'image_url', image_url: { "url": `data:image/png;base64,${base64Data}` } }
                            ]
                        }
                    ],
                    max_tokens: 512,
                }),
            });
            data = await response.json();
        }
        else {
            // Fallback to text-only
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages,
                    max_tokens: 512,
                }),
            });
            data = await response.json();
        }
        if (data.error) {
            reply = `OpenAI Error: ${data.error.message || JSON.stringify(data.error)}`;
        }
        else {
            reply = data.choices?.[0]?.message?.content || 'No response from OpenAI.';
        }
        electron_1.BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('chat:message', reply);
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        electron_1.BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('chat:message', 'Error: ' + message);
        });
    }
});
electron_1.ipcMain.on('move-window', (_event, x, y) => {
    if (overlayWindow) {
        overlayWindow.setPosition(Math.round(x), Math.round(y));
    }
});
electron_1.ipcMain.handle('get-window-position', () => {
    if (overlayWindow) {
        const [x, y] = overlayWindow.getPosition();
        return { x, y };
    }
    return { x: 0, y: 0 };
});
electron_1.app.whenReady().then(createOverlayWindow);
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
electron_1.app.on('activate', () => {
    if (overlayWindow === null)
        createOverlayWindow();
});
electron_1.ipcMain.on('show-screen-permission-dialog', () => {
    dialog.showMessageBox({
        type: 'info',
        buttons: ['Open System Settings', 'Cancel'],
        title: 'Screen Recording Permission Needed',
        message: 'To capture your screen, please enable Screen Recording for this app in System Settings > Privacy & Security > Screen Recording.'
    }).then((result) => {
        if (result.response === 0) {
            // Open the correct System Settings pane on macOS
            child_process.exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"');
        }
    });
});
electron_1.ipcMain.on('save-debug-screenshot', (_event, dataUrl) => {
    try {
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
        const debugDir = pathModule.join(__dirname, '../../debug-screens');
        if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir);
        }
        const filename = `screenshot-${Date.now()}.png`;
        const debugPath = pathModule.join(debugDir, filename);
        fs.writeFileSync(debugPath, base64Data, 'base64');
        console.log('Saved debug screenshot:', debugPath);
    }
    catch (err) {
        console.error('Failed to save debug screenshot:', err);
    }
});
