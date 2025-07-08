// Load environment variables from .env file before anything else
require('dotenv').config();
console.log('Environment variables loaded from .env file');
console.log('OPENAI_API_KEY available:', !!process.env.OPENAI_API_KEY);
if (!process.env.OPENAI_API_KEY) {
  console.warn('[DEBUG] No OPENAI_API_KEY found in .env file!');
}

import { app, BrowserWindow, ipcMain, screen } from 'electron';
import path from 'path';
const fetch = require('node-fetch');
const fs = require('fs');
const pathModule = require('path');
const { dialog, shell } = require('electron');
const child_process = require('child_process');
const { desktopCapturer } = require('electron');
const { spawn } = require('child_process');
const { spawnSync } = require('child_process');
// const { contextBridge, ipcRenderer, desktopCapturer } = require('electron');

const ICON_SIZE = 64;
const CHAT_WIDTH = 400;
const CHAT_HEIGHT = 500;
let overlayWindow: BrowserWindow | null = null;

// --- Background OCR State ---
let ocrPaused = false;
let ocrInterval: NodeJS.Timeout | null = null;
const ocrDir = path.resolve(__dirname, '../../../data_processing/OCR_files');
if (!fs.existsSync(ocrDir)) fs.mkdirSync(ocrDir, { recursive: true });

function getDefaultIconPosition() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return { x: width - ICON_SIZE - 20, y: height - ICON_SIZE - 20 };
}

function createOverlayWindow() {
  const { x, y } = getDefaultIconPosition();
  overlayWindow = new BrowserWindow({
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
      preload: path.join(__dirname, '../../../dist-electron/preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      // Enable screen capture APIs
      enableBlinkFeatures: 'DesktopCapture',
    },
  });
  overlayWindow.loadFile(path.resolve(__dirname, '../../../public/overlay.html'));
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setFocusable(false);
  overlayWindow.webContents.openDevTools({ mode: 'detach' }); // keep DevTools open for debugging

  // Enforce square window
  overlayWindow.on('will-resize', (event, newBounds) => {
    if (!overlayWindow) return;
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

ipcMain.on('expand-to-chat', () => {
  console.log('Received expand-to-chat event');
  if (!overlayWindow) return;
  
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const targetBounds = {
    width: CHAT_WIDTH,
    height: CHAT_HEIGHT,
    x: width - CHAT_WIDTH - 20,
    y: height - CHAT_HEIGHT - 40,
  };
  
  // Get current bounds
  const currentBounds = overlayWindow.getBounds();
  
  // Load the chat UI content immediately
  overlayWindow.setResizable(true);
  overlayWindow.setFocusable(true);
  overlayWindow.loadFile(path.resolve(__dirname, '../../../public/chat-overlay.html'));
  
  // Animate the transition
  const steps = 20;
  const stepDuration = 10; // milliseconds per step
  
  for (let i = 0; i <= steps; i++) {
    setTimeout(() => {
      if (!overlayWindow) return;
      
      const progress = i / steps;
      const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease-out cubic
      
      const newBounds = {
        width: Math.round(currentBounds.width + (targetBounds.width - currentBounds.width) * easeProgress),
        height: Math.round(currentBounds.height + (targetBounds.height - currentBounds.height) * easeProgress),
        x: Math.round(currentBounds.x + (targetBounds.x - currentBounds.x) * easeProgress),
        y: Math.round(currentBounds.y + (targetBounds.y - currentBounds.y) * easeProgress),
      };
      
      overlayWindow.setBounds(newBounds);
    }, i * stepDuration);
  }
});

ipcMain.on('collapse-to-icon', () => {
  console.log('Received collapse-to-icon event');
  if (!overlayWindow) return;
  
  const { x, y } = getDefaultIconPosition();
  const targetBounds = {
    width: ICON_SIZE,
    height: ICON_SIZE,
    x,
    y,
  };
  
  // Get current bounds
  const currentBounds = overlayWindow.getBounds();
  
  // Load the icon content immediately
  overlayWindow.setResizable(true);
  overlayWindow.setFocusable(false);
  overlayWindow.loadFile(path.resolve(__dirname, '../../../public/overlay.html'));
  
  // Animate the transition
  const steps = 20;
  const stepDuration = 10; // milliseconds per step
  
  for (let i = 0; i <= steps; i++) {
    setTimeout(() => {
      if (!overlayWindow) return;
      
      const progress = i / steps;
      const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease-out cubic
      
      const newBounds = {
        width: Math.round(currentBounds.width + (targetBounds.width - currentBounds.width) * easeProgress),
        height: Math.round(currentBounds.height + (targetBounds.height - currentBounds.height) * easeProgress),
        x: Math.round(currentBounds.x + (targetBounds.x - currentBounds.x) * easeProgress),
        y: Math.round(currentBounds.y + (targetBounds.y - currentBounds.y) * easeProgress),
      };
      
      overlayWindow.setBounds(newBounds);
    }, i * stepDuration);
  }
});

// --- OpenAI ChatGPT Integration ---
ipcMain.on('chat:send', async (event, msg, screenshotBase64: string | null) => {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    event.sender.send('chat:message', 'Error: OpenAI API key not set. Please add it to your .env file.');
    return;
  }
  try {
    // 1. Query ChromaDB for top 3 similar OCR entries
    const chromaResult = spawnSync(
      path.resolve(__dirname, '../../../data_processing/venv/bin/python'),
      [path.resolve(__dirname, '../../../data_processing/query_chroma.py'), msg],
      { encoding: 'utf-8' }
    );
    let context = '';
    if (chromaResult.status === 0 && chromaResult.stdout) {
      try {
        const topResults = JSON.parse(chromaResult.stdout);
        context = topResults.map((r: any, i: number) => `Context ${i+1}: ${r.text}`).join('\n');
      } catch (e) {
        console.error('Failed to parse ChromaDB output:', e, chromaResult.stdout);
      }
    } else {
      console.error('ChromaDB query failed:', chromaResult.stderr);
    }

    // 2. Build the prompt for the LLM
    let messages = [
      { role: 'system', content: 'You are a helpful assistant. Use the following context from the user\'s screen to answer their question.' },
    ];
    if (context) {
      messages.push({ role: 'system', content: context });
    }
    messages.push({ role: 'user', content: msg });

    // 3. Call OpenAI Chat API as before
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
    } else {
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
    if (data && data.error) {
      reply = `OpenAI Error: ${data.error.message || JSON.stringify(data.error)}`;
    } else {
      reply = data.choices?.[0]?.message?.content || 'No response from OpenAI.';
    }
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('chat:message', reply);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('chat:message', 'Error: ' + message);
    });
  }
});

ipcMain.on('move-window', (_event, x, y) => {
  if (overlayWindow) {
    overlayWindow.setPosition(Math.round(x), Math.round(y));
  }
});

ipcMain.handle('get-window-position', () => {
  if (overlayWindow) {
    const [x, y] = overlayWindow.getPosition();
    return { x, y };
  }
  return { x: 0, y: 0 };
});

function saveBase64PngToFile(base64: string, filePath: string) {
  const data = base64.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(filePath, data, 'base64');
}

function runOcrOnImage(imagePath: string, ocrOutputPath: string) {
  const py = spawn(path.resolve(__dirname, '../../../data_processing/venv/bin/python'), [path.resolve(__dirname, '../../../data_processing/ocr.py'), imagePath, ocrOutputPath]);
  py.stdout.on('data', (data: Buffer) => {
    console.log('[OCR Python]', data.toString());
  });
  py.stderr.on('data', (data: Buffer) => {
    console.error('[OCR Python ERROR]', data.toString());
  });
  py.on('close', (code: number) => {
    console.log(`[OCR Python] exited with code ${code}`);
  });
}

function startOcrInterval() {
  if (ocrInterval) clearInterval(ocrInterval);
  ocrInterval = setInterval(async () => {
    if (ocrPaused) return;
    // Take screenshot
    const primaryDisplay = screen.getPrimaryDisplay();
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: primaryDisplay.size.width,
        height: primaryDisplay.size.height
      }
    });
    if (!sources.length) return;
    let screenSource = sources[0];
    for (const source of sources) {
      if (source.display_id === `${primaryDisplay.id}`) {
        screenSource = source;
        break;
      }
    }
    const dataUrl = screenSource.thumbnail.toDataURL();
    if (!dataUrl || dataUrl.length < 10000) return;
    // Save screenshot
    const ts = Date.now();
    const imgPath = path.join(ocrDir, `background_${ts}.png`);
    saveBase64PngToFile(dataUrl, imgPath);
    console.log(`[Background OCR] Screenshot taken: ${imgPath}`);
    // OCR output path
    const ocrOutPath = path.join(ocrDir, `background_${ts}.txt`);
    // Warn if OCR script is missing
    const ocrScriptPath = path.resolve(__dirname, '../../../data_processing/ocr.py');
    if (!fs.existsSync(ocrScriptPath)) {
      console.warn(`[Background OCR] WARNING: OCR script not found at ${ocrScriptPath}`);
    }
    runOcrOnImage(imgPath, ocrOutPath);
  }, 10000); // 10 seconds
}

ipcMain.on('ocr:set-paused', (_event, paused: boolean) => {
  ocrPaused = paused;
  console.log('[Background OCR] Paused:', ocrPaused);
  if (!ocrPaused) {
    startOcrInterval();
  } else if (ocrInterval) {
    clearInterval(ocrInterval);
    ocrInterval = null;
  }
});

ipcMain.on('ocr:process-screenshot', (_event, screenshotBase64: string) => {
  // Save screenshot and process for OCR
  const ts = Date.now();
  const imgPath = path.join(ocrDir, `shared_${ts}.png`);
  saveBase64PngToFile(screenshotBase64, imgPath);
  const ocrOutPath = path.join(ocrDir, `shared_${ts}.txt`);
  runOcrOnImage(imgPath, ocrOutPath);
});

// Start background OCR on app ready
app.whenReady().then(() => {
  createOverlayWindow();
  if (!ocrPaused) startOcrInterval();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (overlayWindow === null) createOverlayWindow();
});

ipcMain.on('show-screen-permission-dialog', () => {
  dialog.showMessageBox({
    type: 'info',
    buttons: ['Open System Settings', 'Cancel'],
    title: 'Screen Recording Permission Needed',
    message: 'To capture your screen, please enable Screen Recording for this app in System Settings > Privacy & Security > Screen Recording.'
  }).then((result: Electron.MessageBoxReturnValue) => {
    if (result.response === 0) {
      // Open the correct System Settings pane on macOS
      child_process.exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"');
    }
  });
});

// Screenshot capture handlers
ipcMain.handle('capture-screenshot', async () => {
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: primaryDisplay.size.width,
        height: primaryDisplay.size.height
      }
    });
    
    if (sources.length === 0) return null;
    
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
  } catch (error) {
    console.error('Error capturing screenshot:', error);
    return null;
  }
});




