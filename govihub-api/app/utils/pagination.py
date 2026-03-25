"""GoviHub Pagination — Generic pagination params and response wrapper."""

import math
from typing import Any, Generic, Optional, Sequence, TypeVar

from fastapi import Query
from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class PaginationParams:
    """Extract pagination parameters from query string."""

    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number"),
        size: int = Query(20, ge=1, le=100, description="Items per page"),
        sort: Optional[str] = Query(None, description="Sort field (prefix with - for desc)"),
    ):
        self.page = page
        self.size = size
        self.sort = sort

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.size


class PaginationMeta(BaseModel):
    """Pagination metadata."""

    page: int
    size: int
    total: int
    pages: int


class PaginatedResponse(BaseModel):
    """Generic paginated response wrapper."""

    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)

    data: list[Any]
    meta: PaginationMeta


def _serialize_item(item: Any) -> Any:
    """Convert SQLAlchemy model instances to dicts for JSON serialization."""
    if hasattr(item, "__table__"):
        # SQLAlchemy ORM model — convert to dict
        d = {}
        for col in item.__table__.columns:
            val = getattr(item, col.name, None)
            d[col.name] = str(val) if hasattr(val, "hex") else val  # UUID → str
        return d
    return item


def paginate(items: Sequence, total: int, params: PaginationParams) -> PaginatedResponse:
    """Create a paginated response."""
    return PaginatedResponse(
        data=[_serialize_item(i) for i in items],
        meta=PaginationMeta(
            page=params.page,
            size=params.size,
            total=total,
            pages=math.ceil(total / params.size) if params.size > 0 else 0,
        ),
    )
