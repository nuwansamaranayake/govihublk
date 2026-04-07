"""GoviHub Sector Router — Sector config endpoint."""

from fastapi import APIRouter, Request

from app.sector.config import get_sector_from_host, get_sector_config

router = APIRouter()


@router.get("/sector/config")
async def get_current_sector_config(request: Request):
    """Return sector configuration based on hostname."""
    host = request.headers.get("host", "")
    sector = get_sector_from_host(host)
    config = get_sector_config(sector)
    return {
        "sector": sector,
        "name": config["name"],
        "tagline": config["tagline"],
        "crop_types": config["crop_types"],
        "description": config["description"],
    }
