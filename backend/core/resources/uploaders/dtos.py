from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from core.plugins.auth.models import AuthUser


class AuthContextDTO(BaseModel):
    authenticated: bool = False
    user: Optional[AuthUser] = None
    headers: dict[str, str] = Field(default_factory=dict)
    is_super_admin: bool = False


class UploadersPayloadDTO(BaseModel):
    auth: AuthContextDTO = Field(default_factory=AuthContextDTO, alias="__auth")
    email: Optional[str] = None


class UploaderCreateRequest(BaseModel):
    email: str
    name: Optional[str] = None


class UploaderStatusUpdateRequest(BaseModel):
    uploaderId: str = Field(min_length=1)
    status: str = Field(min_length=1)


class UploaderIdRequest(BaseModel):
    uploaderId: str = Field(min_length=1)


class ApiKeyValidationRequest(BaseModel):
    email: str = Field(min_length=1)
    apiKey: str = Field(min_length=1)


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


class ApiKeyValidationResponse(BaseModel):
    isValid: bool
    uploaderId: Optional[str] = None
