#!/usr/bin/env python3
import sys
import pytesseract
from PIL import Image
import os
import re
import openai
import uuid
import chromadb

# Set your OpenAI API key from environment variable
openai.api_key = os.getenv("OPENAI_API_KEY")

if len(sys.argv) != 3:
    print(f"Usage: {sys.argv[0]} <image_path> <output_txt_path>", file=sys.stderr)
    sys.exit(1)

image_path = sys.argv[1]
output_txt_path = sys.argv[2]

try:
    img = Image.open(image_path)
    text = pytesseract.image_to_string(img)
    # Clean up: keep only words and single spaces
    cleaned = re.sub(r'[^\w\s]', '', text)
    cleaned = re.sub(r'\s+', ' ', cleaned)
    cleaned = cleaned.strip()

    # Generate embedding using OpenAI (new API)
    if not openai.api_key:
        print("No OpenAI API key found in environment variable OPENAI_API_KEY", file=sys.stderr)
        sys.exit(2)
    response = openai.embeddings.create(
        input=[cleaned],
        model="text-embedding-ada-002"
    )
    embedding = response.data[0].embedding

    # Store in persistent ChromaDB
    client = chromadb.PersistentClient(path="data_processing/chroma_db")
    collection = client.get_or_create_collection("ocr_data")
    doc_id = str(uuid.uuid4())
    collection.add(
        embeddings=[embedding],
        documents=[cleaned],
        metadatas=[{"source": image_path}],
        ids=[doc_id]
    )
    print(f"OCR complete. Cleaned output embedded and stored in ChromaDB with id {doc_id}")

    # Delete the image file after OCR
    try:
        os.remove(image_path)
        print(f"Deleted screenshot: {image_path}")
    except Exception as del_err:
        print(f"Failed to delete screenshot: {image_path} - {del_err}", file=sys.stderr)
except Exception as e:
    print(f"Error during OCR: {e}", file=sys.stderr)
    sys.exit(2) 