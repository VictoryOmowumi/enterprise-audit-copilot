import os
import requests
from fastembed import TextEmbedding

MODEL_NAME = "BAAI/bge-base-en-v1.5"
_model_instance = None

def get_remote_embedding(text: str) -> list[float] | None:
    """
    Uses Hugging Face Free Inference API if token is provided.
    Consumes 0MB container RAM.
    """
    hf_token = os.getenv("HF_TOKEN")
    if not hf_token:
        return None

    api_url = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{MODEL_NAME}"
    headers = {"Authorization": f"Bearer {hf_token}"}
    try:
        response = requests.post(api_url, headers=headers, json={"inputs": text}, timeout=10)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        print(f"⚠️ Remote embedding failed, falling back: {e}")
    return None

def get_embedding_model() -> TextEmbedding:
    global _model_instance
    if _model_instance is None:
        cache_path = os.getenv("FASTEMBED_CACHE_PATH", "/home/appuser/.cache/fastembed")
        print(f"📦 Loading local embedding model: {MODEL_NAME} (cache: {cache_path})...")
        _model_instance = TextEmbedding(model_name=MODEL_NAME, cache_dir=cache_path, threads=1)
        print("✅ Embedding model ready.")
    return _model_instance

def generate_embeddings(texts: list[str]) -> list[list[float]]:
    # 1. Try free zero-RAM API first if configured
    if len(texts) == 1:
        remote_vec = get_remote_embedding(texts[0])
        if remote_vec and isinstance(remote_vec, list):
            return [remote_vec]

    # 2. Local fallback
    model = get_embedding_model()
    embeddings = list(model.embed(texts, batch_size=1))
    return [embedding.tolist() for embedding in embeddings]