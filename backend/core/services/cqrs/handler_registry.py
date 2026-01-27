from __future__ import annotations

from typing import Any, Callable, Dict, Protocol
from enum import Enum


class UnknownActionError(Exception):
    pass


class HandlerRegistry:
    def __init__(self) -> None:
        self._handlers: Dict[str, Callable[[Dict[str, Any]], Any]] = {}

    def register(self, action: str | Enum, handler: Callable[[Dict[str, Any]], Any]) -> None:
        action_key = action.value if isinstance(action, Enum) else action
        self._handlers[action_key] = handler

    def get(self, action: str | Enum) -> Callable[[Dict[str, Any]], Any]:
        action_key = action.value if isinstance(action, Enum) else action
        handler = self._handlers.get(action_key)
        if not handler:
            raise UnknownActionError(f"unknown action: {action_key}")
        return handler

    def has(self, action: str | Enum) -> bool:
        action_key = action.value if isinstance(action, Enum) else action
        return action_key in self._handlers


query_registry = HandlerRegistry()
mutation_registry = HandlerRegistry()
