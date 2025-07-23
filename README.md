# ProjectMidas

ProjectMidas is a live AI assistant that overlays your desktop, captures your screen, performs OCR (Optical Character Recognition), and augments your queries with context from your recent screen content. It leverages OpenAI's GPT-4o for chat and ChromaDB for persistent, semantic search over your screen's text history.

---

## Features

- **Desktop Overlay**: Floating icon and chat window overlay your desktop for quick access.
- **Live OCR**: Periodically captures your screen, extracts text, and stores it for semantic search.
- **Retrieval-Augmented Chat**: When you ask a question, ProjectMidas retrieves relevant context from your recent screen content and augments your query to GPT-4o.
- **Persistent Vector Store**: Uses ChromaDB to store and search OCR'd text with OpenAI embeddings.
- **Screenshot-to-Chat**: Send a screenshot directly to the assistant for vision-based answers.

---

## Quick Start

### 1. Prerequisites

- **Node.js** (v18+ recommended)
- **Python** (3.12 recommended)
- **pip** (Python package manager)
- **Tesseract OCR** (for pytesseract)
- **OpenAI API Key**

### 2. Clone the Repository

```bash
git clone <your-repo-url>
cd ProjectMidas
```

### 3. Install Node/Electron Dependencies

```bash
npm install
```

### 4. Set Up Python Environment for OCR & ChromaDB

```bash
cd data_processing
python3.12 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install pytesseract pillow openai chromadb
# If you don't have tesseract installed:
# On macOS: brew install tesseract
# On Ubuntu: sudo apt-get install tesseract-ocr
```

### 5. Set Up Environment Variables

Create a `.env` file in the project root with your OpenAI API key:

```
OPENAI_API_KEY=sk-...
```

### 6. Run the App

In the project root:

```bash
npm run build-all
npm start
```

This will build the Electron app and launch the overlay window.

---

## How It Works

1. **Overlay Window**: An always-on-top icon sits on your desktop. Click to expand to a chat window.
2. **Background OCR**: Every 10 seconds, the app captures your screen, runs OCR (via Python), and stores the cleaned text and its embedding in ChromaDB.
3. **Chat**: When you send a message, the app queries ChromaDB for the most relevant recent screen text, augments your prompt, and sends it to OpenAI's GPT-4o.
4. **Vision**: You can also send a screenshot directly to the assistant for multimodal (vision) answers.

---

## Python Scripts

- `ocr.py`: Runs OCR on a screenshot, generates an embedding, and stores it in ChromaDB.
- `query_chroma.py`: Given a query, retrieves the top 3 most similar OCR'd texts from ChromaDB.
- `inspect_chroma.py`: Utility to inspect the contents of the ChromaDB vector store.

---

## Directory Structure

- `electron/` — Main Electron app code (overlay, chat, window management)
- `data_processing/` — Python scripts for OCR and ChromaDB
- `public/` — HTML for overlay and chat windows
- `src/` — Frontend assets (if any)

---

## Troubleshooting

- **Screen Capture Permission (macOS):**
  - If screenshots are blank or too small, grant screen recording permission in System Settings > Privacy & Security > Screen Recording.
- **Tesseract Not Found:**
  - Ensure `tesseract` is installed and in your PATH.
- **Python Errors:**
  - Activate the virtual environment and ensure all Python dependencies are installed.
- **OpenAI API Key:**
  - Make sure your `.env` file is present and correct.

---

## Customization

- **OCR Frequency:**
  - Adjust the interval in `electron/main/index.ts` (`setInterval` in `startOcrInterval`).
- **ChromaDB Storage:**
  - Data is stored in `data_processing/chroma_db/`.

---

## License

MIT License

---

## Acknowledgments

- [OpenAI](https://openai.com/)
- [ChromaDB](https://www.trychroma.com/)
- [Electron](https://www.electronjs.org/)
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract)
