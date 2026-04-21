"""Crop-specific weather sensitivity profiles for Sri Lankan spice crops.

Each profile contains:
- Bilingual names (si/en)
- Optimal and critical temperature ranges
- Humidity, wind, waterlog, and soil sensitivity data
- Per-alert-type bilingual messages
- Growth-stage-specific alerts
"""

CROP_WEATHER_PROFILES = {
    "black_pepper": {
        "name_si": "ගම්මිරිස්",
        "name_en": "Black Pepper",
        "optimal_temp_min": 20,
        "optimal_temp_max": 30,
        "critical_temp_low": 15,
        "critical_temp_high": 35,
        "humidity_optimal_min": 60,
        "humidity_optimal_max": 95,
        "wind_sensitive": True,
        "wind_threshold_kmh": 30,
        "waterlog_sensitive": True,
        "needs_dry_for_flowering": True,
        "soil_moisture_optimal": "high",
        "growth_stage_alerts": {
            "flowering": "heavy_rain reduces pollination — avoid irrigation",
            "harvesting": "dry weather needed for berry drying",
        },
        "alerts": {
            "heavy_rain": {
                "si": "දැඩි වැසි — ජලය බැස යාම පරීක්ෂා කරන්න. පාද කුණුවීම වැළැක්වීමට ජල මාර්ග පිරිසිදු කරන්න.",
                "en": "Heavy rain — check drainage. Clear waterways to prevent foot rot.",
            },
            "high_wind": {
                "si": "සුළං වේගය වැඩියි — පඳුරු ආධාරක පරීක්ෂා කරන්න",
                "en": "High wind — check vine supports",
            },
            "dry_spell": {
                "si": "දින 14 කට වඩා වියළි — වාරිමාර්ග යොදන්න",
                "en": "Dry >14 days — irrigate",
            },
            "heat_stress": {
                "si": "උෂ්ණත්වය ඉහළයි — දහවල් වරුවේ සෙවන සපයන්න",
                "en": "High temp — provide afternoon shade",
            },
        },
    },
    "cinnamon": {
        "name_si": "කුරුඳු",
        "name_en": "Cinnamon",
        "optimal_temp_min": 25,
        "optimal_temp_max": 32,
        "critical_temp_low": 15,
        "critical_temp_high": 38,
        "humidity_optimal_min": 70,
        "humidity_optimal_max": 80,
        "wind_sensitive": False,
        "sun_loving": True,
        "waterlog_sensitive": True,
        "needs_dry_for_peeling": True,
        "soil_moisture_optimal": "moderate",
        "growth_stage_alerts": {
            "harvesting": "dry weather essential for bark peeling quality",
        },
        "alerts": {
            "heavy_rain": {
                "si": "දැඩි වැසි — පොතු ගැලවීම කල් දමන්න",
                "en": "Heavy rain — delay bark peeling",
            },
            "dry_spell": {
                "si": "දිගු වියළි කාලය — වාරිමාර්ග යොදන්න, පොතු ගැලවීමට අපහසු වේ",
                "en": "Long dry spell — irrigate, bark will be hard to peel",
            },
            "humidity_high": {
                "si": "තෙතමනය වැඩියි — පත්‍ර පුල්ලි රෝගය වැළැක්වීමට වගා පරීක්ෂා කරන්න",
                "en": "High humidity — inspect for leaf spot disease",
            },
        },
    },
    "turmeric": {
        "name_si": "කහ",
        "name_en": "Turmeric",
        "optimal_temp_min": 20,
        "optimal_temp_max": 30,
        "critical_temp_low": 10,
        "critical_temp_high": 35,
        "humidity_optimal_min": 60,
        "humidity_optimal_max": 70,
        "shade_loving": True,
        "waterlog_sensitive": True,
        "soil_temp_optimal_min": 25,
        "soil_temp_optimal_max": 30,
        "soil_temp_critical_low": 17,
        "soil_moisture_optimal": "high",
        "growth_stage_alerts": {
            "seedling": "soil temp must be >25°C for sprouting",
            "harvesting": "leaves yellowing = ready to harvest",
        },
        "alerts": {
            "cold_soil": {
                "si": "පස් උෂ්ණත්වය අඩුයි (17°C ට අඩු) — අංකුරණය නතර වේ",
                "en": "Soil too cold (<17°C) — sprouting stops",
            },
            "hot_soil": {
                "si": "පස් උෂ්ණත්වය ඉහළයි (32°C ට වැඩි) — පටක හානිය",
                "en": "Soil too hot (>32°C) — tissue damage",
            },
            "heavy_rain": {
                "si": "දැඩි වැසි — ජලය හොඳින් බැස යන පස අවශ්‍යයි, මිට්ට කුණු වීම වැළැක්වීමට",
                "en": "Heavy rain — needs well-drained soil to prevent rhizome rot",
            },
            "heat_stress": {
                "si": "ඉහළ UV — සෙවන ප්‍රමාණවත් දැයි පරීක්ෂා කරන්න",
                "en": "High UV — check shade is adequate",
            },
        },
    },
    "ginger": {
        "name_si": "ඉඟුරු",
        "name_en": "Ginger",
        "optimal_temp_min": 20,
        "optimal_temp_max": 30,
        "critical_temp_low": 10,
        "critical_temp_high": 35,
        "humidity_optimal_min": 60,
        "humidity_optimal_max": 70,
        "shade_loving": True,
        "waterlog_sensitive": True,
        "soil_temp_optimal_min": 25,
        "soil_temp_optimal_max": 28,
        "soil_temp_critical_low": 17,
        "soil_moisture_optimal": "high",
        "growth_stage_alerts": {
            "seedling": "warm soil critical for sprouting — check soil temp",
            "vegetative": "consistent moisture needed for rhizome growth",
        },
        "alerts": {
            "cold_soil": {
                "si": "පස් උෂ්ණත්වය 17°C ට අඩු — අංකුරණය නතර වේ",
                "en": "Soil <17°C — sprouting stops",
            },
            "heavy_rain": {
                "si": "දැඩි වැසි — මෘදු කුණුවීම වැළැක්වීමට ජල මාර්ග පරීක්ෂා කරන්න",
                "en": "Heavy rain — check drainage to prevent soft rot",
            },
            "dry_spell": {
                "si": "දින 10 කට වඩා වියළි — මිට්ට වර්ධනයට වාරිමාර්ග අවශ්‍යයි",
                "en": "Dry >10 days — irrigate for rhizome growth",
            },
            "humidity_heat": {
                "si": "තෙතමනය + උෂ්ණත්වය ඉහළයි — බැක්ටීරියා මැලවීමේ අවදානම",
                "en": "High humidity + heat — bacterial wilt risk",
            },
        },
    },
    "cloves": {
        "name_si": "කරාබු නැටි",
        "name_en": "Cloves",
        "optimal_temp_min": 20,
        "optimal_temp_max": 30,
        "critical_temp_low": 15,
        "critical_temp_high": 35,
        "humidity_optimal_min": 60,
        "humidity_optimal_max": 80,
        "wind_sensitive": True,
        "wind_threshold_kmh": 40,
        "waterlog_sensitive": True,
        "needs_dry_for_flowering": True,
        "soil_moisture_optimal": "moderate",
        "growth_stage_alerts": {
            "flowering": "dry spell triggers flowering — don't irrigate",
            "harvesting": "pick buds before rain to preserve quality",
        },
        "alerts": {
            "heavy_rain": {
                "si": "වැසි — මල් මොට්ටු අස්වැන්න නෙලීම වහාම කරන්න, ගුණාත්මකභාවය පවත්වා ගැනීමට",
                "en": "Rain coming — harvest flower buds immediately to maintain quality",
            },
            "high_wind": {
                "si": "සුළං වේගය වැඩියි — අතු සහ මල් මොට්ටුවලට හානි විය හැක",
                "en": "High wind — may damage branches and flower buds",
            },
            "waterlog": {
                "si": "ජලය බැස යාම වැළැක්වීමට ජල මාර්ග පිරිසිදු කරන්න — මුල් කුණු වීම",
                "en": "Clear drainage — root rot risk",
            },
        },
    },
    "nutmeg": {
        "name_si": "සාදික්කා",
        "name_en": "Nutmeg",
        "optimal_temp_min": 20,
        "optimal_temp_max": 30,
        "critical_temp_low": 14,
        "critical_temp_high": 36,
        "humidity_optimal_min": 60,
        "humidity_optimal_max": 80,
        "wind_sensitive": True,
        "wind_threshold_kmh": 40,
        "waterlog_sensitive": True,
        "shade_loving_young": True,
        "soil_moisture_optimal": "moderate",
        "growth_stage_alerts": {
            "seedling": "young trees need shade and wind protection",
        },
        "alerts": {
            "high_wind": {
                "si": "සුළං වේගය වැඩියි — තරුණ ගස්වලට සුළං පරිවාරක අවශ්‍යයි",
                "en": "High wind — young trees need windbreaks",
            },
            "heavy_rain": {
                "si": "දැඩි වැසි — ගෙඩි පැලීමේදී දිලීර ආසාදන අවදානම",
                "en": "Heavy rain — fungal infection risk during fruit splitting",
            },
            "dry_spell": {
                "si": "වියළි කාලය — නොමේරූ ගෙඩි වැටීම වැළැක්වීමට වාරිමාර්ග",
                "en": "Dry spell — irrigate to prevent premature fruit drop",
            },
            "heat_stress": {
                "si": "UV ඉහළයි — තරුණ ගස්වලට සෙවන අවශ්‍යයි",
                "en": "High UV — young trees need shade",
            },
        },
    },
    "cardamom": {
        "name_si": "එනසාල්",
        "name_en": "Cardamom",
        "optimal_temp_min": 18,
        "optimal_temp_max": 30,
        "critical_temp_low": 10,
        "critical_temp_high": 35,
        "humidity_optimal_min": 60,
        "humidity_optimal_max": 80,
        "shade_requirement_pct": 60,
        "moisture_stress_sensitive": True,
        "waterlog_sensitive": True,
        "soil_moisture_optimal": "high",
        "growth_stage_alerts": {
            "flowering": "consistent moisture critical for panicle development",
            "harvesting": "harvest Sep-Jan, pick before fully ripe",
        },
        "alerts": {
            "dry_spell": {
                "si": "වියළි — දින 7-10 කට වරක් වාරිමාර්ග යොදන්න, කුඩිච්ච වේලීම වැළැක්වීමට",
                "en": "Dry — irrigate every 7-10 days to prevent panicle drying",
            },
            "heavy_rain": {
                "si": "දැඩි වැසි — අස්වැන්න කාලයේ (සැප්-ජන) කරල් ගුණාත්මකභාවයට බලපෑම",
                "en": "Heavy rain during harvest (Sep-Jan) — capsule quality affected",
            },
            "cold_stress": {
                "si": "සීතල — කරල්වලට හානි විය හැක",
                "en": "Cold — may damage capsules",
            },
        },
    },
    "mixed_spices": {
        "name_si": "මිශ්‍ර කුළුබඩු",
        "name_en": "Mixed Spices",
        "optimal_temp_min": 20,
        "optimal_temp_max": 30,
        "critical_temp_low": 15,
        "critical_temp_high": 35,
        "waterlog_sensitive": False,
        "soil_moisture_optimal": "moderate",
        "alerts": {
            "heavy_rain": {
                "si": "වැසි — වේළීම/ගබඩා කිරීම කල් දමන්න",
                "en": "Rain — delay drying/storage operations",
            },
            "humidity_high": {
                "si": "තෙතමනය ඉහළයි — ගබඩා පුස් අවදානම, වාතාශ්‍රය වැඩි කරන්න",
                "en": "High humidity — storage mold risk, improve ventilation",
            },
        },
    },
}


def get_crop_profile(crop_type: str) -> dict | None:
    """Return the weather profile for a given crop type."""
    return CROP_WEATHER_PROFILES.get(crop_type)


def get_all_crop_types() -> list[str]:
    """Return list of all supported crop types."""
    return list(CROP_WEATHER_PROFILES.keys())
