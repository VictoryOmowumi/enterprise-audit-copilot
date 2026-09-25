from fastembed import TextEmbedding

# We use BAAI/bge-base-en-v1.5 which natively generates 768-dimensional dense vectors
# It runs locally via ONNX Runtime without needing a GPU or OpenAI API key.
MODEL_NAME = "BAAI/bge-base-en-v1.5"
_model_instance = None

def get_embedding_model() -> TextEmbedding:
    global _model_instance
    if _model_instance is None:
        print(f"📦 Loading local embedding model: {MODEL_NAME}...")
        _model_instance = TextEmbedding(model_name=MODEL_NAME)
        print("✅ Embedding model ready.")
    return _model_instance

def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Takes a list of string chunks and returns a list of 768-dimensional float vectors.
    """
    model = get_embedding_model()
    # FastEmbed yields generator of numpy arrays
    embeddings = list(model.embed(texts))
    return [embedding.tolist() for embedding in embeddings]