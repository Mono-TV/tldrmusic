"""
Cloud Storage Interface for TLDR Music
Handles uploading and deleting OG images to Google Cloud Storage
"""

import os
from abc import ABC, abstractmethod
from typing import Optional
from io import BytesIO
import asyncio


class CloudStorage(ABC):
    """Abstract base class for cloud storage"""

    @abstractmethod
    async def upload(self, data: bytes, path: str, content_type: str = "image/png") -> str:
        """Upload file and return public URL"""
        pass

    @abstractmethod
    async def delete(self, path: str) -> bool:
        """Delete file by path"""
        pass

    @abstractmethod
    def get_public_url(self, path: str) -> str:
        """Get public URL for a path"""
        pass


class GCSStorage(CloudStorage):
    """Google Cloud Storage implementation"""

    def __init__(self):
        self.bucket_name = os.getenv("GCS_BUCKET_NAME", "tldrmusic-og-images")
        self.project_id = os.getenv("GCP_PROJECT_ID")
        self._client = None
        self._bucket = None

    def _get_client(self):
        """Lazy load GCS client"""
        if self._client is None:
            from google.cloud import storage
            self._client = storage.Client(project=self.project_id)
            self._bucket = self._client.bucket(self.bucket_name)
        return self._client, self._bucket

    async def upload(self, data: bytes, path: str, content_type: str = "image/png") -> str:
        """Upload file to GCS and return public URL"""
        def _upload():
            _, bucket = self._get_client()
            blob = bucket.blob(path)
            blob.upload_from_string(data, content_type=content_type)
            # Make the blob publicly accessible
            blob.make_public()
            return blob.public_url

        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        url = await loop.run_in_executor(None, _upload)
        return url

    async def delete(self, path: str) -> bool:
        """Delete file from GCS"""
        def _delete():
            try:
                _, bucket = self._get_client()
                blob = bucket.blob(path)
                blob.delete()
                return True
            except Exception:
                return False

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _delete)

    def get_public_url(self, path: str) -> str:
        """Get public URL for a GCS path"""
        return f"https://storage.googleapis.com/{self.bucket_name}/{path}"


class LocalStorage(CloudStorage):
    """
    Local filesystem storage for development/testing
    Stores files in a local directory and serves via the API
    """

    def __init__(self):
        self.base_path = os.getenv("LOCAL_STORAGE_PATH", "/tmp/og-images")
        self.base_url = os.getenv("LOCAL_STORAGE_URL", "http://localhost:8000/og-images")
        # Ensure directory exists
        os.makedirs(self.base_path, exist_ok=True)

    async def upload(self, data: bytes, path: str, content_type: str = "image/png") -> str:
        """Save file locally and return URL"""
        full_path = os.path.join(self.base_path, path)

        # Ensure parent directory exists
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        def _write():
            with open(full_path, 'wb') as f:
                f.write(data)

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _write)

        return self.get_public_url(path)

    async def delete(self, path: str) -> bool:
        """Delete file from local storage"""
        full_path = os.path.join(self.base_path, path)

        def _delete():
            try:
                if os.path.exists(full_path):
                    os.remove(full_path)
                return True
            except Exception:
                return False

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _delete)

    def get_public_url(self, path: str) -> str:
        """Get URL for local file"""
        return f"{self.base_url}/{path}"


# Singleton storage instance
_storage: Optional[CloudStorage] = None


def get_storage() -> CloudStorage:
    """Factory function to get appropriate storage backend"""
    global _storage

    if _storage is None:
        storage_type = os.getenv("STORAGE_BACKEND", "local")

        if storage_type == "gcs":
            _storage = GCSStorage()
        else:
            # Default to local storage for development
            _storage = LocalStorage()

    return _storage


def url_to_path(url: str) -> Optional[str]:
    """Extract storage path from a URL"""
    if not url:
        return None

    # Handle GCS URLs
    if "storage.googleapis.com" in url:
        # URL format: https://storage.googleapis.com/bucket/path
        parts = url.split("storage.googleapis.com/")
        if len(parts) > 1:
            # Remove bucket name from path
            path_with_bucket = parts[1]
            path_parts = path_with_bucket.split("/", 1)
            if len(path_parts) > 1:
                return path_parts[1]

    # Handle local URLs
    if "/og-images/" in url:
        parts = url.split("/og-images/")
        if len(parts) > 1:
            return parts[1]

    return None
