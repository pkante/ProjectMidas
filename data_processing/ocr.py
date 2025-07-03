#!/usr/bin/env python3
import sys
import pytesseract
from PIL import Image
import os

if len(sys.argv) != 3:
    print(f"Usage: {sys.argv[0]} <image_path> <output_txt_path>", file=sys.stderr)
    sys.exit(1)

image_path = sys.argv[1]
output_txt_path = sys.argv[2]

try:
    img = Image.open(image_path)
    text = pytesseract.image_to_string(img)
    with open(output_txt_path, 'w', encoding='utf-8') as f:
        f.write(text)
    print(f"OCR complete. Output written to {output_txt_path}")
    # Delete the image file after OCR
    try:
        os.remove(image_path)
        print(f"Deleted screenshot: {image_path}")
    except Exception as del_err:
        print(f"Failed to delete screenshot: {image_path} - {del_err}", file=sys.stderr)
except Exception as e:
    print(f"Error during OCR: {e}", file=sys.stderr)
    sys.exit(2) 