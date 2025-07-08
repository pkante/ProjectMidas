import chromadb

client = chromadb.PersistentClient(path="data_processing/chroma_db")
collection = client.get_or_create_collection("ocr_data")

# Get all IDs in the collection
ids = collection.get()["ids"]
print(f"Total documents in ChromaDB: {len(ids)}")

# Fetch and print the first 3 documents
if ids:
    results = collection.get(ids=ids[:3])
    for i, doc in enumerate(results["documents"]):
        print(f"\nDocument {i+1}:")
        print("Text:", doc)
        print("Metadata:", results["metadatas"][i])
        print("ID:", results["ids"][i])
else:
    print("No documents found in ChromaDB.") 