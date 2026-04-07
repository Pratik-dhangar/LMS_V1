"""
Manual test script for session recording purge.

Usage:
  python scripts/test_recording_purge.py --dry-run
  python scripts/test_recording_purge.py --execute
  python scripts/test_recording_purge.py --execute --sample-size 10

This script validates purge behavior for both:
- TrainingSession recordings
- CoachAppointmentSession recordings
"""

import argparse
import asyncio
import logging
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import List

from sqlalchemy import select

# Ensure backend root is importable when running this script directly.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Import all models to avoid relationship resolution issues
import app.models  # noqa: F401
from app.db.session import AsyncSessionLocal
from app.models.coach_session_model import CoachAppointmentSession
from app.models.session_model import TrainingSession
from app.workers.recording_retention import cleanup_old_recordings


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@dataclass
class CandidateRecord:
    model_name: str
    id: int
    created_at: datetime
    recording_status: str
    recording_url: str


async def fetch_candidates(retention_days: int) -> List[CandidateRecord]:
    """Fetch sessions that should be purged based on created_at and recording state."""
    cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
    candidates: List[CandidateRecord] = []

    async with AsyncSessionLocal() as db:
        training_query = select(TrainingSession).where(
            TrainingSession.created_at < cutoff_date,
            TrainingSession.recording_url.isnot(None),
            TrainingSession.recording_status == "completed",
        )
        training_rows = (await db.execute(training_query)).scalars().all()

        coach_query = select(CoachAppointmentSession).where(
            CoachAppointmentSession.created_at < cutoff_date,
            CoachAppointmentSession.recording_url.isnot(None),
            CoachAppointmentSession.recording_status == "completed",
        )
        coach_rows = (await db.execute(coach_query)).scalars().all()

    for row in training_rows:
        candidates.append(
            CandidateRecord(
                model_name="TrainingSession",
                id=row.id,
                created_at=row.created_at,
                recording_status=row.recording_status,
                recording_url=row.recording_url,
            )
        )

    for row in coach_rows:
        candidates.append(
            CandidateRecord(
                model_name="CoachAppointmentSession",
                id=row.id,
                created_at=row.created_at,
                recording_status=row.recording_status,
                recording_url=row.recording_url,
            )
        )

    return candidates


def print_candidates(candidates: List[CandidateRecord], retention_days: int, sample_size: int) -> None:
    cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
    logger.info("=" * 70)
    logger.info("RECORDING PURGE CANDIDATES")
    logger.info("=" * 70)
    logger.info("Retention days: %s", retention_days)
    logger.info("Cutoff date (UTC): %s", cutoff_date.isoformat())
    logger.info("Total purge candidates: %s", len(candidates))

    if not candidates:
        return

    logger.info("Showing up to %s candidate rows:", sample_size)
    for row in candidates[:sample_size]:
        logger.info(
            "- %s id=%s created_at=%s status=%s url=%s",
            row.model_name,
            row.id,
            row.created_at,
            row.recording_status,
            row.recording_url,
        )


async def verify_post_state(before: List[CandidateRecord]) -> None:
    """Verify whether candidate rows were marked deleted and URL cleared."""
    training_ids = [r.id for r in before if r.model_name == "TrainingSession"]
    coach_ids = [r.id for r in before if r.model_name == "CoachAppointmentSession"]

    updated_ok = 0
    still_not_deleted = 0

    async with AsyncSessionLocal() as db:
        if training_ids:
            training_rows = (
                await db.execute(select(TrainingSession).where(TrainingSession.id.in_(training_ids)))
            ).scalars().all()
            for row in training_rows:
                if row.recording_url is None and row.recording_status == "deleted":
                    updated_ok += 1
                else:
                    still_not_deleted += 1
                    logger.warning(
                        "TrainingSession id=%s not fully purged yet (status=%s, url=%s)",
                        row.id,
                        row.recording_status,
                        row.recording_url,
                    )

        if coach_ids:
            coach_rows = (
                await db.execute(
                    select(CoachAppointmentSession).where(CoachAppointmentSession.id.in_(coach_ids))
                )
            ).scalars().all()
            for row in coach_rows:
                if row.recording_url is None and row.recording_status == "deleted":
                    updated_ok += 1
                else:
                    still_not_deleted += 1
                    logger.warning(
                        "CoachAppointmentSession id=%s not fully purged yet (status=%s, url=%s)",
                        row.id,
                        row.recording_status,
                        row.recording_url,
                    )

    logger.info("=" * 70)
    logger.info("POST-RUN VERIFICATION")
    logger.info("=" * 70)
    logger.info("Rows verified as purged: %s", updated_ok)
    logger.info("Rows still not purged: %s", still_not_deleted)


async def main(execute: bool, retention_days: int, sample_size: int) -> None:
    candidates_before = await fetch_candidates(retention_days=retention_days)
    print_candidates(candidates_before, retention_days=retention_days, sample_size=sample_size)

    if not execute:
        logger.info("DRY RUN COMPLETE: no deletion executed.")
        return

    logger.info("=" * 70)
    logger.info("RUNNING PURGE")
    logger.info("=" * 70)
    result = await cleanup_old_recordings()
    logger.info("Purge result: %s", result)

    await verify_post_state(candidates_before)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test session recording purge behavior.")
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument(
        "--dry-run",
        action="store_true",
        help="Only list records that would be purged (default mode).",
    )
    mode_group.add_argument(
        "--execute",
        action="store_true",
        help="Execute purge and verify DB post-state.",
    )
    parser.add_argument(
        "--retention-days",
        type=int,
        default=30,
        help="Retention threshold in days used by candidate preview.",
    )
    parser.add_argument(
        "--sample-size",
        type=int,
        default=20,
        help="Maximum candidate rows to print.",
    )

    args = parser.parse_args()
    run_execute = args.execute
    asyncio.run(main(execute=run_execute, retention_days=args.retention_days, sample_size=args.sample_size))
