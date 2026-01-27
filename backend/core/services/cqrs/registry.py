from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict

from core.services.cqrs.contracts import IBus


class UnknownBusError(Exception):
    pass


@dataclass
class BusRegistry:
    _buses: Dict[str, IBus]

    def __init__(self) -> None:
        self._buses = {}

    def register(self, name: str, bus: IBus) -> None:
        self._buses[name] = bus

    def get(self, name: str) -> IBus:
        bus = self._buses.get(name)
        if not bus:
            raise UnknownBusError(f"unknown bus: {name}")
        return bus


registry = BusRegistry()

