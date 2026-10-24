from semantic import FastEmbedEmbedder


def main() -> None:
    embedder = FastEmbedEmbedder(allow_download=True)
    vector = embedder.embed(["machine learning"])[0]
    print(f"Embedding model ready ({vector.shape[0]} dimensions).")


if __name__ == "__main__":
    main()