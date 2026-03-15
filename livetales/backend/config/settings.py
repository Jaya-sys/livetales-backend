"""App configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Google AI
    google_api_key: str = ""
    google_genai_use_vertexai: str = "FALSE"
    google_cloud_project: str = ""
    google_cloud_location: str = "us-central1"

    # App
    app_env: str = "development"
    log_level: str = "DEBUG"
    cors_origins: str = "http://localhost:3000"

    # Features
    enable_imagen: bool = True
    enable_veo: bool = False

    # GCS (needed for Veo video generation)
    gcs_bucket: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
