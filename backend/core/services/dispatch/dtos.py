from __future__ import annotations

from typing import Any, Dict, Literal

from pydantic import BaseModel, Field


DispatchType = Literal["query", "command"]


class DispatchRequest(BaseModel):
    type: DispatchType
    busName: str = Field(min_length=1)
    payload: Dict[str, Any] = Field(default_factory=dict)

