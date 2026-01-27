from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any, Callable, Dict
from core.logger.logger import get_logger


logger = get_logger(__name__)


@dataclass
class EventBus:
    _queue: asyncio.Queue[Dict[str, Any]] = field(default_factory=asyncio.Queue)
    _worker_task: asyncio.Task[None] | None = None
    _running: bool = False
    _handlers: Dict[str, Callable[[Dict[str, Any]], Any]] = field(default_factory=dict)

    def register(self, event_type: str, handler: Callable[[Dict[str, Any]], Any]) -> None:
        self._handlers[event_type] = handler

    async def publish(self, event_type: str, payload: Dict[str, Any]) -> None:
        await self._queue.put({"type": event_type, "payload": payload})

    async def _worker(self) -> None:
        logger.info("event bus worker started")
        while self._running:
            try:
                event = await asyncio.wait_for(self._queue.get(), timeout=1.0)
                event_type = event.get("type")
                payload = event.get("payload", {})
                
                handler = self._handlers.get(event_type)
                if handler:
                    try:
                        if asyncio.iscoroutinefunction(handler):
                            await handler(payload)
                        else:
                            handler(payload)
                    except Exception as e:
                        logger.exception("event handler error event_type=%s", event_type)
                else:
                    logger.warning("no handler for event_type=%s", event_type)
                
                self._queue.task_done()
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.exception("event bus worker error: %s", e)
                self._queue.task_done()

    def start(self) -> None:
        if self._worker_task is None or self._worker_task.done():
            self._running = True
            self._worker_task = asyncio.create_task(self._worker())
            logger.info("event bus worker task started")

    async def stop(self) -> None:
        self._running = False
        if self._worker_task and not self._worker_task.done():
            await asyncio.sleep(0.1)
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        logger.info("event bus worker stopped")


_global_event_bus: EventBus | None = None


def get_event_bus() -> EventBus:
    global _global_event_bus
    if _global_event_bus is None:
        _global_event_bus = EventBus()
    return _global_event_bus
