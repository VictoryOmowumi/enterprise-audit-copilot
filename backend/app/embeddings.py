import os
from fastembed import TextEmbedding

# We keep 768 dimensions so all pgvector schemas remain valid
MODEL_NAME = "BAAI/bge-base-en-v1.5"
_model_instance = None

def get_embedding_model() -> TextEmbedding:
    global _model_instance
    if _model_instance is None:
        cache_path = os.getenv("FASTEMBED_CACHE_PATH", "/home/appuser/.cache/fastembed")
        print(f"📦 Loading local embedding model: {MODEL_NAME} (cache: {cache_path})...")
        # threads=1 and lazy loading keeps peak RAM below 200MB
        _model_instance = TextEmbedding(
            model_name=MODEL_NAME, 
            cache_dir=cache_path, 
            threads=1
        )
        print("✅ Embedding model ready.")
    return _model_instance

def generate_embeddings(texts: list[str]) -> list[list[float]]:
    model = get_embedding_model()
    # Batch size of 1 avoids allocating memory for multiple vectors simultaneously
    embeddings = list(model.embed(texts, batch_size=1))
    return [embedding.tolist() for embedding in embeddings]