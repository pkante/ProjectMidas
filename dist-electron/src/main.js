"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("./style.css");
const app = document.querySelector('#app');
if (app) {
    app.innerHTML = `
    <h1>Electron LLM Chat</h1>
    <div id="chat-window" style="height:300px;overflow-y:auto;border:1px solid #ccc;padding:8px;margin-bottom:8px;"></div>
    <form id="chat-form" style="display:flex;gap:8px;">
      <input id="chat-input" type="text" placeholder="Type a message..." style="flex:1;" autocomplete="off" />
      <button type="submit">Send</button>
    </form>
  `;
    const chatWindow = document.getElementById('chat-window');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    function appendMessage(sender, text) {
        const msgDiv = document.createElement('div');
        msgDiv.innerHTML = `<b>${sender}:</b> ${text}`;
        chatWindow.appendChild(msgDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
    // Send message
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const msg = chatInput.value.trim();
        if (msg) {
            appendMessage('You', msg);
            // If you want to connect to Electron API for chat, add that logic here
            chatInput.value = '';
        }
    });
}
