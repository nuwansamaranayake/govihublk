"""GoviHub Pagination — Generic pagination params and response wrapper."""

import math
from typing import Any, Generic, Optional, Sequence, TypeVar

from fastapi import Query
from pydantic import BaseModel

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

    data: list[Any]
    meta: PaginationMeta


def paginate(items: Sequence, total: int, params: PaginationParams) -> PaginatedResponse:
    """Create a paginated response."""
    return PaginatedResponse(
        data=list(items),
        meta=PaginationMeta(
            page=params.page,
            size=params.size,
            total=total,
            pages=math.ceil(total / params.size) if params.size > 0 else 0,
        ),
    )
