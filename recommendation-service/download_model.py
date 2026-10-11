"""
Downloads the SEMANTIC matcher's embedding model (all-MiniLM-L6-v2, about
90 MB) into models/, so the service never downloads it while answering a
request.

Run once after installing requirements, locally and on Render (it is part of
the build command):

    python download_model.py
"""

from semantic import FastEmbedEmbedder


def main() -> None:
    embedder = FastEmbedEmbedder(allow_download=True)
    vector = embedder.embed(["machine learning"])[0]
    print(f"Embedding model ready ({vector.shape[0]} dimensions).")


if __name__ == "__main__":
    main()