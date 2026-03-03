from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class UploaderCreateRequest(BaseModel):
    email: str
    name: Optional[str] = None


class UploaderDTO(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    status: str
    apiKey: Optional[str] = None
    createdAt: datetime


class ListUploadersResponse(BaseModel):
    items: List[UploaderDTO]
    total: int


class ApiKeyValidationRequest(BaseModel):
    email: str
    apiKey: str


class ApiKeyValidationResponse(BaseModel):
    isValid: bool
    uploaderId: Optional[str] = None
