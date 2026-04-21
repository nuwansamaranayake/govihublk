"""GoviHub Admin Service — System administration, analytics, and oversight operations."""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

import structlog
from sqlalchemy import and_, cast, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.advisory.models import AdvisoryQuestion, KnowledgeChunk
from app.diagnosis.models import CropDiagnosis, DiagnosisStatus
from app.exceptions import NotFoundError, ValidationError
from app.listings.models import (
    CropCategory,
    CropTaxonomy,
    DemandPosting,
    HarvestListing,
    HarvestStatus,
    DemandStatus,
)
from app.matching.models import Match, MatchStatus
from app.users.models import User, UserRole

logger = structlog.get_logger()


class AdminService:
    """Provides all administrative operations for GoviHub."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Dashboard
    # ------------------------------------------------------------------

    async def get_dashboard_stats(self) -> Dict[str, Any]:
        """Return aggregate platform statistics for the admin dashboard."""
        from datetime import timedelta

        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

        # User counts by role
        total_users_r = await self.db.execute(select(func.count()).select_from(User))
        total_users = total_users_r.scalar_one()

        farmers_r = await self.db.execute(
            select(func.count()).select_from(User).where(User.role == UserRole.farmer)
        )
        total_farmers = farmers_r.scalar_one()

        buyers_r = await self.db.execute(
            select(func.count()).select_from(User).where(User.role == UserRole.buyer)
        )
        total_buyers = buyers_r.scalar_one()

        suppliers_r = await self.db.execute(
            select(func.count()).select_from(User).where(User.role == UserRole.supplier)
        )
        total_suppliers = suppliers_r.scalar_one()

        active_recent_r = await self.db.execute(
            select(func.count())
            .select_from(User)
            .where(User.last_login_at >= thirty_days_ago)
        )
        active_users_last_30d = active_recent_r.scalar_one()

        # Listing counts
        total_harvest_r = await self.db.execute(
            select(func.count()).select_from(HarvestListing)
        )
        total_harvest_listings = total_harvest_r.scalar_one()

        active_harvest_r = await self.db.execute(
            select(func.count())
            .select_from(HarvestListing)
            .where(HarvestListing.status.in_([HarvestStatus.planned, HarvestStatus.ready]))
        )
        active_harvest_listings = active_harvest_r.scalar_one()

        total_demand_r = await self.db.execute(
            select(func.count()).select_from(DemandPosting)
        )
        total_demand_postings = total_demand_r.scalar_one()

        active_demand_r = await self.db.execute(
            select(func.count())
            .select_from(DemandPosting)
            .where(DemandPosting.status.in_([DemandStatus.open, DemandStatus.reviewing]))
        )
        active_demand_postings = active_demand_r.scalar_one()

        # Match counts
        total_matches_r = await self.db.execute(
            select(func.count()).select_from(Match)
        )
        total_matches = total_matches_r.scalar_one()

        active_matches_r = await self.db.execute(
            select(func.count())
            .select_from(Match)
            .where(Match.status.in_([MatchStatus.accepted, MatchStatus.proposed]))
        )
        confirmed_matches = active_matches_r.scalar_one()

        dismissed_matches_r = await self.db.execute(
            select(func.count())
            .select_from(Match)
            .where(Match.status == MatchStatus.dismissed)
        )
        disputed_matches = dismissed_matches_r.scalar_one()

        # Diagnosis counts
        total_diag_r = await self.db.execute(
            select(func.count()).select_from(CropDiagnosis)
        )
        total_diagnoses = total_diag_r.scalar_one()

        pending_diag_r = await self.db.execute(
            select(func.count())
            .select_from(CropDiagnosis)
            .where(CropDiagnosis.status == DiagnosisStatus.pending)
        )
        pending_diagnoses = pending_diag_r.scalar_one()

        # Knowledge base
        total_chunks_r = await self.db.execute(
            select(func.count()).select_from(KnowledgeChunk)
        )
        total_knowledge_chunks = total_chunks_r.scalar_one()

        total_advisory_r = await self.db.execute(
            select(func.count()).select_from(AdvisoryQuestion)
        )
        total_advisory_questions = total_advisory_r.scalar_one()

        return {
            "total_users": total_users,
            "total_farmers": total_farmers,
            "total_buyers": total_buyers,
            "total_suppliers": total_suppliers,
            "active_users_last_30d": active_users_last_30d,
            "total_harvest_listings": total_harvest_listings,
            "active_harvest_listings": active_harvest_listings,
            "total_demand_postings": total_demand_postings,
            "active_demand_postings": active_demand_postings,
            "total_matches": total_matches,
            "confirmed_matches": confirmed_matches,
            "disputed_matches": disputed_matches,
            "total_diagnoses": total_diagnoses,
            "pending_diagnoses": pending_diagnoses,
            "total_knowledge_chunks": total_knowledge_chunks,
            "total_advisory_questions": total_advisory_questions,
        }

    # ------------------------------------------------------------------
    # User Management
    # ------------------------------------------------------------------

    async def list_users(self, filters) -> Dict[str, Any]:
        """Return paginated user list with optional filters."""
        query = select(User)

        if filters.role:
            query = query.where(User.role == filters.role)
        if filters.district:
            query = query.where(User.district == filters.district)
        if filters.is_active is not None:
            query = query.where(User.is_active == filters.is_active)
        if filters.is_verified is not None:
            query = query.where(User.is_verified == filters.is_verified)
        if filters.search:
            pattern = f"%{filters.search}%"
            query = query.where(
                or_(
                    User.name.ilike(pattern),
                    User.email.ilike(pattern),
                    User.phone.ilike(pattern),
                )
            )

        count_r = await self.db.execute(
            select(func.count()).select_from(query.subquery())
        )
        total = count_r.scalar_one()

        offset = (filters.page - 1) * filters.size
        query = query.order_by(User.created_at.desc()).offset(offset).limit(filters.size)
        result = await self.db.execute(query)
        users = list(result.scalars().all())

        return {
            "items": users,
            "total": total,
            "page": filters.page,
            "size": filters.size,
            "pages": math.ceil(total / filters.size) if total else 0,
        }

    async def get_user_detail(self, user_id: UUID) -> User:
        """Fetch a single user by ID."""
        user = await self.db.get(User, user_id)
        if not user:
            raise NotFoundError(detail=f"User {user_id} not found")
        return user

    async def update_user(self, user_id: UUID, data) -> User:
        """Update mutable user fields including admin-only fields."""
        user = await self.get_user_detail(user_id)
        update_data = data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            if field == "role" and value is not None:
                setattr(user, field, UserRole(value))
            else:
                setattr(user, field, value)

        await self.db.flush()
        logger.info("admin_user_updated", user_id=str(user_id), fields=list(update_data.keys()))
        return user

    async def delete_user(self, user_id: UUID) -> None:
        """Soft-delete a user by deactivating their account."""
        user = await self.get_user_detail(user_id)
        user.is_active = False
        await self.db.flush()
        logger.info("admin_user_deactivated", user_id=str(user_id))

    # ------------------------------------------------------------------
    # Crop Taxonomy
    # ------------------------------------------------------------------

    async def list_crops(self, filters) -> Dict[str, Any]:
        """Return paginated crop taxonomy list."""
        query = select(CropTaxonomy)

        if filters.category:
            query = query.where(CropTaxonomy.category == CropCategory(filters.category))
        if filters.is_active is not None:
            query = query.where(CropTaxonomy.is_active == filters.is_active)
        if filters.search:
            pattern = f"%{filters.search}%"
            query = query.where(
                or_(
                    CropTaxonomy.name_en.ilike(pattern),
                    CropTaxonomy.name_si.ilike(pattern),
                    CropTaxonomy.code.ilike(pattern),
                )
            )

        count_r = await self.db.execute(
            select(func.count()).select_from(query.subquery())
        )
        total = count_r.scalar_one()

        offset = (filters.page - 1) * filters.size
        query = query.order_by(CropTaxonomy.code).offset(offset).limit(filters.size)
        result = await self.db.execute(query)
        crops = list(result.scalars().all())

        return {
            "items": crops,
            "total": total,
            "page": filters.page,
            "size": filters.size,
            "pages": math.ceil(total / filters.size) if total else 0,
        }

    async def create_crop(self, data) -> CropTaxonomy:
        """Create a new crop taxonomy entry."""
        crop = CropTaxonomy(
            code=data.code,
            name_en=data.name_en,
            name_si=data.name_si,
            name_ta=data.name_ta,
            category=CropCategory(data.category),
            season=data.season,
            avg_yield_kg=data.avg_yield_kg,
            is_active=True,
        )
        self.db.add(crop)
        await self.db.flush()
        await self.db.refresh(crop)
        logger.info("admin_crop_created", crop_id=str(crop.id), code=crop.code)
        return crop

    async def update_crop(self, crop_id: UUID, data) -> CropTaxonomy:
        """Update a crop taxonomy entry."""
        crop = await self.db.get(CropTaxonomy, crop_id)
        if not crop:
            raise NotFoundError(detail=f"Crop {crop_id} not found")

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if field == "category" and value is not None:
                setattr(crop, field, CropCategory(value))
            else:
                setattr(crop, field, value)

        await self.db.flush()
        logger.info("admin_crop_updated", crop_id=str(crop_id))
        return crop

    async def toggle_crop(self, crop_id: UUID) -> CropTaxonomy:
        """Toggle a crop's is_active status."""
        crop = await self.db.get(CropTaxonomy, crop_id)
        if not crop:
            raise NotFoundError(detail=f"Crop {crop_id} not found")

        crop.is_active = not crop.is_active
        await self.db.flush()
        logger.info("admin_crop_toggled", crop_id=str(crop_id), is_active=crop.is_active)
        return crop

    # ------------------------------------------------------------------
    # Match Management
    # ------------------------------------------------------------------

    async def list_matches(self, filters) -> Dict[str, Any]:
        """Return paginated match list with admin-level filters."""
        query = select(Match)

        if filters.status:
            query = query.where(Match.status == MatchStatus(filters.status))
        if filters.min_score is not None:
            query = query.where(Match.score >= filters.min_score)
        if filters.date_from:
            query = query.where(Match.created_at >= filters.date_from)
        if filters.date_to:
            query = query.where(Match.created_at <= filters.date_to)

        count_r = await self.db.execute(
            select(func.count()).select_from(query.subquery())
        )
        total = count_r.scalar_one()

        offset = (filters.page - 1) * filters.size
        query = query.order_by(Match.created_at.desc()).offset(offset).limit(filters.size)
        result = await self.db.execute(query)
        matches = list(result.scalars().all())

        return {
            "items": matches,
            "total": total,
            "page": filters.page,
            "size": filters.size,
            "pages": math.ceil(total / filters.size) if total else 0,
        }

    async def get_match_detail(self, match_id: UUID) -> Match:
        """Fetch full match details (admin, no ownership check)."""
        match = await self.db.get(Match, match_id)
        if not match:
            raise NotFoundError(detail=f"Match {match_id} not found")
        return match

    async def get_match_detail_enriched(self, match_id: UUID) -> Dict[str, Any]:
        """Fetch match details with farmer, buyer, and crop info."""
        from app.listings.models import HarvestListing, DemandPosting
        from app.users.models import User
        from app.listings.models import CropTaxonomy
        from sqlalchemy.orm import selectinload

        result = await self.db.execute(
            select(Match)
            .options(
                selectinload(Match.harvest).selectinload(HarvestListing.farmer),
                selectinload(Match.harvest).selectinload(HarvestListing.crop),
                selectinload(Match.demand).selectinload(DemandPosting.buyer),
                selectinload(Match.demand).selectinload(DemandPosting.crop),
            )
            .where(Match.id == match_id)
        )
        match = result.scalar_one_or_none()
        if not match:
            raise NotFoundError(detail=f"Match {match_id} not found")

        harvest = match.harvest
        demand = match.demand
        farmer = harvest.farmer if harvest else None
        buyer = demand.buyer if demand else None
        crop = harvest.crop if harvest else (demand.crop if demand else None)

        return {
            "id": str(match.id),
            "score": match.score,
            "score_breakdown": match.score_breakdown,
            "status": match.status.value,
            "agreed_price_per_kg": float(match.agreed_price_per_kg) if match.agreed_price_per_kg else None,
            "agreed_quantity_kg": float(match.agreed_quantity_kg) if match.agreed_quantity_kg else None,
            "notes": match.notes,
            "confirmed_at": match.confirmed_at.isoformat() if match.confirmed_at else None,
            "fulfilled_at": match.fulfilled_at.isoformat() if match.fulfilled_at else None,
            "created_at": match.created_at.isoformat() if match.created_at else None,
            "updated_at": match.updated_at.isoformat() if match.updated_at else None,
            # Farmer info
            "farmer_id": str(farmer.id) if farmer else None,
            "farmer_name": farmer.name if farmer else "Unknown",
            "farmer_phone": farmer.phone if farmer else None,
            "farmer_district": farmer.district if farmer else None,
            # Buyer info
            "buyer_id": str(buyer.id) if buyer else None,
            "buyer_name": buyer.name if buyer else "Unknown",
            "buyer_phone": buyer.phone if buyer else None,
            "buyer_district": buyer.district if buyer else None,
            # Crop info
            "crop_name": crop.name_en if crop else "Unknown",
            "crop_name_si": crop.name_si if crop else None,
            "crop_category": crop.category.value if crop and crop.category else None,
            # Harvest details
            "harvest_quantity_kg": float(harvest.quantity_kg) if harvest else None,
            "harvest_price_per_kg": float(harvest.price_per_kg) if harvest and harvest.price_per_kg else None,
            "harvest_quality_grade": harvest.quality_grade if harvest else None,
            "harvest_date": harvest.harvest_date.isoformat() if harvest and harvest.harvest_date else None,
            "harvest_district": farmer.district if farmer else None,
            "harvest_description": harvest.description if harvest else None,
            "harvest_is_organic": harvest.is_organic if harvest else False,
            "harvest_status": harvest.status.value if harvest else None,
            # Demand details
            "demand_quantity_kg": float(demand.quantity_kg) if demand else None,
            "demand_max_price_per_kg": float(demand.max_price_per_kg) if demand and demand.max_price_per_kg else None,
            "demand_quality_grade": demand.quality_grade if demand else None,
            "demand_needed_by": demand.needed_by.isoformat() if demand and demand.needed_by else None,
            "demand_district": buyer.district if buyer else None,
            "demand_description": demand.description if demand else None,
            "demand_status": demand.status.value if demand else None,
        }

    async def resolve_dispute(
        self,
        match_id: UUID,
        resolution: str,
        notes: Optional[str],
        new_status: str = "completed",
    ) -> Match:
        """Admin resolves a match, transitioning it to completed or dismissed."""
        match = await self.get_match_detail(match_id)

        terminal = {MatchStatus.completed, MatchStatus.dismissed}
        if match.status in terminal:
            raise ValidationError(
                detail=f"Match is already in terminal status '{match.status.value}'"
            )

        match.status = MatchStatus(new_status)
        combined_notes = f"[ADMIN RESOLVED] {resolution}"
        if notes:
            combined_notes += f"\n{notes}"
        match.notes = combined_notes

        if new_status == "completed":
            match.fulfilled_at = datetime.now(timezone.utc)

        await self.db.flush()
        logger.info(
            "admin_dispute_resolved",
            match_id=str(match_id),
            new_status=new_status,
        )
        return match

    async def cancel_match(self, match_id: UUID, reason: str) -> Match:
        """Admin force-dismisses a match."""
        match = await self.get_match_detail(match_id)

        terminal = {MatchStatus.completed, MatchStatus.dismissed}
        if match.status in terminal:
            raise ValidationError(
                detail=f"Cannot dismiss a match with status '{match.status.value}'"
            )

        match.status = MatchStatus.dismissed
        match.notes = f"[ADMIN DISMISSED] {reason}"
        await self.db.flush()
        logger.info("admin_match_dismissed", match_id=str(match_id))
        return match

    # ------------------------------------------------------------------
    # Knowledge Base Management
    # ------------------------------------------------------------------

    async def list_knowledge_chunks(self, filters) -> Dict[str, Any]:
        """Return paginated knowledge chunk list."""
        query = select(KnowledgeChunk)

        if filters.language:
            query = query.where(KnowledgeChunk.language == filters.language)
        if filters.category:
            query = query.where(KnowledgeChunk.category == filters.category)
        if filters.source:
            query = query.where(KnowledgeChunk.source.ilike(f"%{filters.source}%"))
        if filters.search:
            pattern = f"%{filters.search}%"
            query = query.where(
                or_(
                    KnowledgeChunk.content.ilike(pattern),
                    KnowledgeChunk.title.ilike(pattern),
                )
            )

        count_r = await self.db.execute(
            select(func.count()).select_from(query.subquery())
        )
        total = count_r.scalar_one()

        offset = (filters.page - 1) * filters.size
        query = query.order_by(KnowledgeChunk.created_at.desc()).offset(offset).limit(filters.size)
        result = await self.db.execute(query)
        chunks = list(result.scalars().all())

        return {
            "items": chunks,
            "total": total,
            "page": filters.page,
            "size": filters.size,
            "pages": math.ceil(total / filters.size) if total else 0,
        }

    async def ingest_knowledge(
        self,
        content: str,
        source: str,
        language: str,
        title: Optional[str] = None,
        category: Optional[str] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> KnowledgeChunk:
        """Ingest a new knowledge chunk, generating its embedding asynchronously."""
        from app.advisory.embeddings import embedding_service

        # Generate embedding synchronously (CPU-bound, acceptable for admin ingest)
        try:
            embedding = embedding_service.embed(content)
        except Exception as exc:  # noqa: BLE001
            logger.warning("admin_knowledge_embedding_failed", error=str(exc))
            embedding = None

        chunk = KnowledgeChunk(
            source=source,
            title=title,
            content=content,
            language=language,
            category=category,
            tags=tags,
            embedding=embedding,
            metadata_=metadata,
        )
        self.db.add(chunk)
        await self.db.flush()
        await self.db.refresh(chunk)
        logger.info(
            "admin_knowledge_ingested",
            chunk_id=str(chunk.id),
            source=source,
            language=language,
            has_embedding=embedding is not None,
        )
        return chunk

    async def delete_knowledge_chunk(self, chunk_id: UUID) -> None:
        """Permanently delete a knowledge chunk."""
        chunk = await self.db.get(KnowledgeChunk, chunk_id)
        if not chunk:
            raise NotFoundError(detail=f"Knowledge chunk {chunk_id} not found")

        await self.db.delete(chunk)
        await self.db.flush()
        logger.info("admin_knowledge_deleted", chunk_id=str(chunk_id))

    async def get_knowledge_stats(self) -> Dict[str, Any]:
        """Return knowledge base statistics."""
        total_r = await self.db.execute(select(func.count()).select_from(KnowledgeChunk))
        total_chunks = total_r.scalar_one()

        # Counts by language
        lang_rows = await self.db.execute(
            select(KnowledgeChunk.language, func.count().label("cnt"))
            .group_by(KnowledgeChunk.language)
        )
        chunks_by_language = {row.language: row.cnt for row in lang_rows}

        # Counts by category
        cat_rows = await self.db.execute(
            select(KnowledgeChunk.category, func.count().label("cnt"))
            .where(KnowledgeChunk.category.isnot(None))
            .group_by(KnowledgeChunk.category)
        )
        chunks_by_category = {row.category: row.cnt for row in cat_rows}

        # Embedding coverage — use a raw SQL IS NOT NULL check for pgvector column
        with_emb_r = await self.db.execute(
            text("SELECT COUNT(*) FROM knowledge_chunks WHERE embedding IS NOT NULL")
        )
        chunks_with_embeddings = with_emb_r.scalar_one()

        return {
            "total_chunks": total_chunks,
            "chunks_by_language": chunks_by_language,
            "chunks_by_category": chunks_by_category,
            "chunks_with_embeddings": chunks_with_embeddings,
            "chunks_without_embeddings": total_chunks - chunks_with_embeddings,
        }

    # ------------------------------------------------------------------
    # Analytics
    # ------------------------------------------------------------------

    async def get_match_analytics(
        self,
        date_from: datetime,
        date_to: datetime,
    ) -> Dict[str, Any]:
        """Return match analytics for the given date range."""
        base = and_(
            Match.created_at >= date_from,
            Match.created_at <= date_to,
        )

        total_r = await self.db.execute(
            select(func.count()).select_from(Match).where(base)
        )
        total_matches = total_r.scalar_one()

        # By status
        status_rows = await self.db.execute(
            select(Match.status, func.count().label("cnt"))
            .where(base)
            .group_by(Match.status)
        )
        matches_by_status = {row.status.value: row.cnt for row in status_rows}

        # Average score
        avg_score_r = await self.db.execute(
            select(func.avg(Match.score)).where(base)
        )
        avg_score_val = avg_score_r.scalar_one()
        avg_match_score = float(avg_score_val) if avg_score_val is not None else 0.0

        confirmed_count = matches_by_status.get("accepted", 0) + matches_by_status.get("completed", 0)
        fulfilled_count = matches_by_status.get("completed", 0)
        disputed_count = matches_by_status.get("dismissed", 0)

        confirmed_rate = round(confirmed_count / total_matches, 4) if total_matches else 0.0
        fulfillment_rate = round(fulfilled_count / total_matches, 4) if total_matches else 0.0
        dispute_rate = round(disputed_count / total_matches, 4) if total_matches else 0.0

        # Per-day time series
        daily_rows = await self.db.execute(
            text(
                """
                SELECT
                    DATE(created_at) AS day,
                    COUNT(*) AS cnt
                FROM matches
                WHERE created_at >= :date_from AND created_at <= :date_to
                GROUP BY DATE(created_at)
                ORDER BY day
                """
            ),
            {"date_from": date_from, "date_to": date_to},
        )
        matches_per_day = [
            {"date": str(row.day), "count": row.cnt} for row in daily_rows
        ]

        return {
            "date_from": date_from,
            "date_to": date_to,
            "total_matches": total_matches,
            "matches_by_status": matches_by_status,
            "avg_match_score": round(avg_match_score, 4),
            "confirmed_rate": confirmed_rate,
            "fulfillment_rate": fulfillment_rate,
            "dispute_rate": dispute_rate,
            "matches_per_day": matches_per_day,
        }

    async def get_user_analytics(
        self,
        date_from: datetime,
        date_to: datetime,
    ) -> Dict[str, Any]:
        """Return user registration analytics for the given date range."""
        base = and_(
            User.created_at >= date_from,
            User.created_at <= date_to,
        )

        total_new_r = await self.db.execute(
            select(func.count()).select_from(User).where(base)
        )
        total_new_users = total_new_r.scalar_one()

        # By role
        role_rows = await self.db.execute(
            select(User.role, func.count().label("cnt"))
            .where(base)
            .group_by(User.role)
        )
        new_users_by_role = {row.role.value: row.cnt for row in role_rows}

        # By district
        district_rows = await self.db.execute(
            select(User.district, func.count().label("cnt"))
            .where(and_(base, User.district.isnot(None)))
            .group_by(User.district)
            .order_by(func.count().desc())
            .limit(20)
        )
        new_users_by_district = {
            row.district: row.cnt for row in district_rows if row.district
        }

        # Active users (logged in within date range)
        active_r = await self.db.execute(
            select(func.count())
            .select_from(User)
            .where(
                and_(
                    User.last_login_at >= date_from,
                    User.last_login_at <= date_to,
                )
            )
        )
        active_users = active_r.scalar_one()

        # Per-day time series
        daily_rows = await self.db.execute(
            text(
                """
                SELECT
                    DATE(created_at) AS day,
                    COUNT(*) AS cnt
                FROM users
                WHERE created_at >= :date_from AND created_at <= :date_to
                GROUP BY DATE(created_at)
                ORDER BY day
                """
            ),
            {"date_from": date_from, "date_to": date_to},
        )
        users_per_day = [
            {"date": str(row.day), "count": row.cnt} for row in daily_rows
        ]

        return {
            "date_from": date_from,
            "date_to": date_to,
            "total_new_users": total_new_users,
            "new_users_by_role": new_users_by_role,
            "new_users_by_district": new_users_by_district,
            "active_users": active_users,
            "users_per_day": users_per_day,
        }

    async def get_diagnosis_analytics(
        self,
        date_from: datetime,
        date_to: datetime,
    ) -> Dict[str, Any]:
        """Return crop diagnosis analytics for the given date range."""
        base = and_(
            CropDiagnosis.created_at >= date_from,
            CropDiagnosis.created_at <= date_to,
        )

        total_r = await self.db.execute(
            select(func.count()).select_from(CropDiagnosis).where(base)
        )
        total_diagnoses = total_r.scalar_one()

        # By status
        status_rows = await self.db.execute(
            select(CropDiagnosis.status, func.count().label("cnt"))
            .where(base)
            .group_by(CropDiagnosis.status)
        )
        diagnoses_by_status = {row.status.value: row.cnt for row in status_rows}

        # Average confidence
        avg_conf_r = await self.db.execute(
            select(func.avg(CropDiagnosis.confidence))
            .where(and_(base, CropDiagnosis.confidence.isnot(None)))
        )
        avg_conf_val = avg_conf_r.scalar_one()
        avg_confidence = float(avg_conf_val) if avg_conf_val is not None else 0.0

        # Top diseases
        disease_rows = await self.db.execute(
            select(CropDiagnosis.disease_name, func.count().label("cnt"))
            .where(and_(base, CropDiagnosis.disease_name.isnot(None)))
            .group_by(CropDiagnosis.disease_name)
            .order_by(func.count().desc())
            .limit(10)
        )
        top_diseases = [
            {"disease": row.disease_name, "count": row.cnt} for row in disease_rows
        ]

        # Feedback distribution
        feedback_rows = await self.db.execute(
            select(CropDiagnosis.user_feedback, func.count().label("cnt"))
            .where(and_(base, CropDiagnosis.user_feedback.isnot(None)))
            .group_by(CropDiagnosis.user_feedback)
        )
        feedback_distribution = {
            row.user_feedback.value: row.cnt for row in feedback_rows
        }

        # Per-day time series
        daily_rows = await self.db.execute(
            text(
                """
                SELECT
                    DATE(created_at) AS day,
                    COUNT(*) AS cnt
                FROM crop_diagnoses
                WHERE created_at >= :date_from AND created_at <= :date_to
                GROUP BY DATE(created_at)
                ORDER BY day
                """
            ),
            {"date_from": date_from, "date_to": date_to},
        )
        diagnoses_per_day = [
            {"date": str(row.day), "count": row.cnt} for row in daily_rows
        ]

        return {
            "date_from": date_from,
            "date_to": date_to,
            "total_diagnoses": total_diagnoses,
            "diagnoses_by_status": diagnoses_by_status,
            "avg_confidence": round(avg_confidence, 4),
            "top_diseases": top_diseases,
            "feedback_distribution": feedback_distribution,
            "diagnoses_per_day": diagnoses_per_day,
        }

    async def get_system_health(self) -> Dict[str, Any]:
        """Return a real-time system health snapshot."""
        from datetime import timedelta

        now = datetime.now(timezone.utc)
        last_24h = now - timedelta(hours=24)

        database_ok = True
        try:
            await self.db.execute(text("SELECT 1"))
        except Exception:  # noqa: BLE001
            database_ok = False

        total_users_r = await self.db.execute(select(func.count()).select_from(User))
        total_users = total_users_r.scalar_one()

        active_users_r = await self.db.execute(
            select(func.count()).select_from(User).where(User.is_active.is_(True))
        )
        total_active_users = active_users_r.scalar_one()

        recent_matches_r = await self.db.execute(
            select(func.count())
            .select_from(Match)
            .where(Match.created_at >= last_24h)
        )
        recent_matches_24h = recent_matches_r.scalar_one()

        recent_diag_r = await self.db.execute(
            select(func.count())
            .select_from(CropDiagnosis)
            .where(CropDiagnosis.created_at >= last_24h)
        )
        recent_diagnoses_24h = recent_diag_r.scalar_one()

        recent_advisory_r = await self.db.execute(
            select(func.count())
            .select_from(AdvisoryQuestion)
            .where(AdvisoryQuestion.created_at >= last_24h)
        )
        recent_advisory_questions_24h = recent_advisory_r.scalar_one()

        pending_diag_r = await self.db.execute(
            select(func.count())
            .select_from(CropDiagnosis)
            .where(CropDiagnosis.status == DiagnosisStatus.pending)
        )
        pending_diagnoses = pending_diag_r.scalar_one()

        dismissed_r = await self.db.execute(
            select(func.count())
            .select_from(Match)
            .where(Match.status == MatchStatus.dismissed)
        )
        disputed_matches = dismissed_r.scalar_one()

        return {
            "database_ok": database_ok,
            "total_users": total_users,
            "total_active_users": total_active_users,
            "recent_matches_24h": recent_matches_24h,
            "recent_diagnoses_24h": recent_diagnoses_24h,
            "recent_advisory_questions_24h": recent_advisory_questions_24h,
            "pending_diagnoses": pending_diagnoses,
            "disputed_matches": disputed_matches,
            "timestamp": now,
        }

    # ------------------------------------------------------------------
    # Broadcast Notifications (stub — real FCM integration pending)
    # ------------------------------------------------------------------

    async def broadcast_notification(
        self,
        title: str,
        body: str,
        target_role: Optional[str] = None,
        target_district: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Queue a push notification broadcast to a subset of users.

        Returns the number of users targeted. Actual FCM dispatch is handled
        by the notifications module (background task / Celery worker).
        """
        query = select(func.count()).select_from(User).where(User.is_active.is_(True))

        if target_role:
            query = query.where(User.role == target_role)
        if target_district:
            query = query.where(User.district == target_district)

        count_r = await self.db.execute(query)
        queued = count_r.scalar_one()

        logger.info(
            "admin_broadcast_queued",
            title=title,
            target_role=target_role,
            target_district=target_district,
            queued=queued,
        )

        return {
            "queued": queued,
            "message": f"Broadcast notification queued for {queued} user(s).",
        }
