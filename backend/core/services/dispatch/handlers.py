from __future__ import annotations

from fastapi import APIRouter, HTTPException

from core.services.cqrs.registry import UnknownBusError, registry
from core.services.dispatch.dtos import DispatchRequest


router = APIRouter(tags=["dispatch"])


@router.post("/dispatch")
async def dispatch(req: DispatchRequest):
    try:
        bus = registry.get(req.busName)
    except UnknownBusError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    return await bus.handle(req.payload)

