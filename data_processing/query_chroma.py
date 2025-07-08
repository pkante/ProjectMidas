import sys
import openai
import chromadb
import os
import json

# Set your OpenAI API key from environment variable
openai.api_key = os.getenv("OPENAI_API_KEY")

if len(sys.argv) < 2:
    print(f"Usage: {sys.argv[0]} <query>", file=sys.stderr)
    sys.exit(1)

query = ' '.join(sys.argv[1:])

# Generate embedding for the query
response = openai.embeddings.create(
    input=[query],
    model="text-embedding-ada-002"
)
query_embedding = response.data[0].embedding

# Connect to ChromaDB
client = chromadb.PersistentClient(path="data_processing/chroma_db")
collection = client.get_or_create_collection("ocr_data")

# Perform similarity search (top 3 results)
results = collection.query(
    query_embeddings=[query_embedding],
    n_results=3
)

# Prepare output
output = []
for i, doc in enumerate(results["documents"][0]):
    output.append({
        "text": doc,
        "metadata": results["metadatas"][0][i],
        "id": results["ids"][0][i],
        "distance": results["distances"][0][i]
    })

print(json.dumps(output, indent=2)) 