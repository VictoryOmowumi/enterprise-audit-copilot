import os
import requests

MODEL_NAME = "BAAI/bge-base-en-v1.5"

def get_remote_embedding(text: str) -> list[float] | None:
    """
    Uses Hugging Face's Router Inference API.
    Consumes 0MB of container RAM.
    """
    hf_token = os.getenv("HF_TOKEN")
    if not hf_token:
        print("⚠️ HF_TOKEN not configured.")
        return None

    # Current Hugging Face Serverless Router API endpoint
    api_url = f"https://router.huggingface.co/hf-inference/models/{MODEL_NAME}"
    headers = {
        "Authorization": f"Bearer {hf_token}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(
            api_url, 
            headers=headers, 
            json={"inputs": text}, 
            timeout=10
        )
        if response.status_code == 200:
            result = response.json()
            # Normalize response shape: either [0.1, ...] or [[0.1, ...]]
            if isinstance(result, list):
                if len(result) > 0 and isinstance(result[0], list):
                    return result[0]
                return result
        else:
            print(f"⚠️ HF API returned status {response.status_code}: {response.text}")
    except Exception as e:
        print(f"⚠️ HF Remote embedding network error: {e}")
    return None

def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Generates embeddings via API on low-RAM containers,
    preventing OOM crashes from local model weights.
    """
    if not texts:
        return []

    # 1. Primary: Serverless remote inference (0 MB RAM)
    remote_vec = get_remote_embedding(texts[0])
    if remote_vec and isinstance(remote_vec, list) and len(remote_vec) == 768:
        return [remote_vec]

    # 2. Local fallback ONLY if explicitly enabled (e.g. local Docker with >2GB RAM)
    if os.getenv("ENABLE_LOCAL_EMBEDDINGS", "false").lower() == "true":
        from fastembed import TextEmbedding
        cache_path = os.getenv("FASTEMBED_CACHE_PATH", "/home/appuser/.cache/fastembed")
        model = TextEmbedding(model_name=MODEL_NAME, cache_dir=cache_path, threads=1)
        embeddings = list(model.embed(texts, batch_size=1))
        return [embedding.tolist() for embedding in embeddings]

    # 3. Memory protection: Return empty so retrieval falls back to PostgreSQL BM25
    print("🛡️ Memory protection: Skipping local FastEmbed on low-memory node.")
    return []