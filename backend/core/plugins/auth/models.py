from __future__ import annotations

from pydantic import BaseModel


class AuthUser(BaseModel):
    user_id: str

