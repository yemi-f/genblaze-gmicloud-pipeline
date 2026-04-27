"""File browser response model — flat listing of bucket contents.

Mirrors vibe-coding-starter-kit's FileMetadata shape so the web tree view
can reuse its rendering logic verbatim (size_human, content_type, folder, etc.).
"""

from datetime import datetime

from pydantic import BaseModel


class FileEntry(BaseModel):
    key: str
    filename: str
    folder: str
    size_bytes: int
    size_human: str
    content_type: str
    uploaded_at: datetime
