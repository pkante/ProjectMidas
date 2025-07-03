"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Load environment variables from .env file before anything else
require('dotenv').config();
console.log('Environment variables loaded from .env file');
console.log('OPENAI_API_KEY available:', !!process.env.OPENAI_API_KEY);
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fetch = require('node-fetch');
const fs = require('fs');
const pathModule = require('path');
const { dialog, shell } = require('electron');
const child_process = require('child_process');
const { desktopCapturer } = require('electron');
// const { contextBridge, ipcRenderer, desktopCapturer } = require('electron');
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
            webSecurity: true,
            allowRunningInsecureContent: false,
            experimentalFeatures: false,
            // Enable screen capture APIs
            enableBlinkFeatures: 'DesktopCapture',
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
    // Always load the API key from environment variables
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
        event.sender.send('chat:message', 'Error: OpenAI API key not set. Please add it to your .env file.');
        return;
    }
    try {
        let messages = [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: msg },
        ];
        let data, reply;
        if (screenshotBase64) {
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
                                { type: 'image_url', image_url: { "url": `data:image/png;base64,${screenshotBase64.replace(/^data:image\/png;base64,/, '')}` } }
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
// Screenshot capture handlers
electron_1.ipcMain.handle('capture-screenshot', async () => {
    try {
        const primaryDisplay = electron_1.screen.getPrimaryDisplay();
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
            console.log('Screenshot too small, likely permission issue');
            return null;
        }
        console.log('Screenshot captured successfully, size:', dataUrl.length);
        return dataUrl;
    }
    catch (error) {
        console.error('Error capturing screenshot:', error);
        return null;
    }
});
