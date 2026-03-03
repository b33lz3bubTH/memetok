import uvicorn

from config.config import settings


if __name__ == "__main__":
    is_dev = settings.environment == "development"
    uvicorn.run(
        "api.index:app",
        host="0.0.0.0",
        port=8000,
        reload=is_dev,
        workers=1 if is_dev else 4,
        timeout_keep_alive=5 if is_dev else 65,
        access_log=is_dev,
    )

