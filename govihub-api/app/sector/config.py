"""GoviHub Sector Configuration — multi-tenant sector detection and config."""

SECTOR_CONFIG = {
    "spices": {
        "name": "GoviHub Spices",
        "tagline": "Sri Lanka's AI Spice Marketplace",
        "crop_types": [
            "black_pepper", "turmeric", "ginger", "cloves",
            "nutmeg", "cardamom", "cinnamon", "mixed_spices",
        ],
        "description": (
            "Connect with verified spice buyers across Sri Lanka. "
            "AI-powered crop diagnosis, fair price discovery, and smart "
            "farmer-buyer matching for pepper, turmeric, ginger, cloves, "
            "nutmeg, cardamom, and cinnamon."
        ),
    },
    "beta": {
        "name": "GoviHub",
        "tagline": "Sri Lanka's AI Farming Marketplace",
        "crop_types": None,  # None = all crops (no filter)
        "description": "AI-powered smart farming marketplace connecting farmers directly to buyers.",
    },
}


def get_sector_from_host(host: str) -> str:
    """Determine sector from request hostname."""
    if host and "spices" in host.lower():
        return "spices"
    return "beta"


def get_sector_config(sector: str) -> dict:
    """Return the config dict for the given sector."""
    return SECTOR_CONFIG.get(sector, SECTOR_CONFIG["beta"])
