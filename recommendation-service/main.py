from fastapi import FastAPI

app = FastAPI(title="CONTEXA Recommendation Service")


@app.get("/health")
def health_check():
    return {
        "success": True,
        "message": "CONTEXA recommendation service is running."
    }