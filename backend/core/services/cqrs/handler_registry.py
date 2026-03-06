from __future__ import annotations

from typing import Any, Awaitable, Callable, Dict, TypeAlias, TypeVar
from enum import Enum


Payload: TypeAlias = Dict[str, Any]
HandlerResult = TypeVar("HandlerResult")
HandlerCallable: TypeAlias = Callable[[Payload], Awaitable[Any] | Any]


class UnknownActionError(Exception):
    pass


class HandlerRegistry:
    def __init__(self) -> None:
        self._handlers: Dict[str, HandlerCallable] = {}

    def register(self, action: str | Enum, handler: HandlerCallable) -> None:
        action_key = action.value if isinstance(action, Enum) else action
        self._handlers[action_key] = handler

    def get(self, action: str | Enum) -> HandlerCallable:
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
