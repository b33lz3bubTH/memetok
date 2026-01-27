from __future__ import annotations

from typing import Any, Dict, Protocol


class IBus(Protocol):
    async def handle(self, payload: Dict[str, Any]) -> Any: ...

