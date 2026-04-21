"""GoviHub Models — Import all models for Alembic discovery."""

from app.auth.models import GoogleAccount, RefreshToken
from app.users.models import BuyerProfile, FarmerProfile, SupplierProfile, User
from app.listings.models import CropTaxonomy, DemandPosting, HarvestListing
from app.matching.models import Match
from app.diagnosis.models import CropDiagnosis
from app.advisory.models import AdvisoryQuestion, KnowledgeChunk
from app.marketplace.models import SupplyListing
from app.notifications.models import Notification, NotificationPreference
from app.alerts.models import PriceHistory, WeatherCache
from app.weather.models import FarmerCropSelection, WeatherAlert
from app.ads.models import Advertisement, AdEvent

__all__ = [
    "RefreshToken",
    "GoogleAccount",
    "User",
    "FarmerProfile",
    "BuyerProfile",
    "SupplierProfile",
    "CropTaxonomy",
    "HarvestListing",
    "DemandPosting",
    "Match",
    "CropDiagnosis",
    "KnowledgeChunk",
    "AdvisoryQuestion",
    "SupplyListing",
    "Notification",
    "NotificationPreference",
    "PriceHistory",
    "WeatherCache",
    "FarmerCropSelection",
    "WeatherAlert",
    "Advertisement",
    "AdEvent",
]
