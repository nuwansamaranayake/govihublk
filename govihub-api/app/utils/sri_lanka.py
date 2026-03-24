"""GoviHub Sri Lanka Reference Data — Districts, provinces, GN divisions."""

# All 25 districts with province mapping
DISTRICTS = {
    # Western Province
    "Colombo": "Western",
    "Gampaha": "Western",
    "Kalutara": "Western",
    # Central Province
    "Kandy": "Central",
    "Matale": "Central",
    "Nuwara Eliya": "Central",
    # Southern Province
    "Galle": "Southern",
    "Matara": "Southern",
    "Hambantota": "Southern",
    # Northern Province
    "Jaffna": "Northern",
    "Kilinochchi": "Northern",
    "Mannar": "Northern",
    "Mullaitivu": "Northern",
    "Vavuniya": "Northern",
    # Eastern Province
    "Batticaloa": "Eastern",
    "Ampara": "Eastern",
    "Trincomalee": "Eastern",
    # North Western Province
    "Kurunegala": "North Western",
    "Puttalam": "North Western",
    # North Central Province (pilot)
    "Anuradhapura": "North Central",
    "Polonnaruwa": "North Central",
    # Uva Province
    "Badulla": "Uva",
    "Monaragala": "Uva",
    # Sabaragamuwa Province
    "Ratnapura": "Sabaragamuwa",
    "Kegalle": "Sabaragamuwa",
}

# Pilot DS divisions — Anuradhapura
ANURADHAPURA_DS_DIVISIONS = [
    "Nuwaragam Palatha Central",
    "Nuwaragam Palatha East",
    "Mihintale",
    "Kekirawa",
    "Thalawa",
    "Rajanganaya",
    "Galenbindunuwewa",
    "Kahatagasdigiliya",
    "Kebithigollewa",
    "Medawachchiya",
    "Horowpothana",
    "Padaviya",
    "Nochchiyagama",
    "Ipalogama",
    "Thirappane",
    "Nachchadoowa",
    "Galnewa",
    "Palugaswewa",
    "Rambewa",
    "Thambuttegama",
    "Mahavilachchiya",
    "Palagala",
]

# Pilot DS divisions — Polonnaruwa
POLONNARUWA_DS_DIVISIONS = [
    "Polonnaruwa",
    "Kaduruwela",
    "Medirigiriya",
    "Hingurakgoda",
    "Lankapura",
    "Dimbulagala",
    "Thamankaduwa",
    "Elahera",
    "Welikanda",
]

# Major GN divisions for pilot
ANURADHAPURA_GN_DIVISIONS = [
    "Anuradhapura Town",
    "Mihintale Town",
    "Kekirawa Town",
    "Thalawa Town",
    "Kahatagasdigiliya Town",
    "Medawachchiya Town",
    "Thambuttegama Town",
    "Nochchiyagama Town",
    "Eppawala",
    "Galenbindunuwewa",
]

POLONNARUWA_GN_DIVISIONS = [
    "Polonnaruwa Town",
    "Kaduruwela Town",
    "Hingurakgoda Town",
    "Medirigiriya Town",
    "Welikanda Town",
    "Dimbulagala",
]


def get_province_for_district(district: str) -> str | None:
    """Get province name for a given district."""
    return DISTRICTS.get(district)


def get_districts_list() -> list[dict]:
    """Return all districts with their provinces."""
    return [
        {"name": name, "province": province}
        for name, province in sorted(DISTRICTS.items())
    ]
