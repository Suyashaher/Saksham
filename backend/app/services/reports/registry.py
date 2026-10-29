"""Report registry singleton mapping report slugs to report handler classes."""

from __future__ import annotations

from typing import Type

from app.db.enums import UserRole
from app.db.models.user import User
from app.services.reports.base import BaseReport
from app.services.reports.generators import (
    CasesNeedingInterventionReport,
    InstitutionStatementReport,
    MissingDocumentsReport,
    MyInstrumentsReport,
    PendingVerificationsReport,
    ReleasePipelineReport,
    RenewalHistoryReport,
    UpcomingMaturitiesReport,
)

REPORT_REGISTRY: dict[str, Type[BaseReport]] = {
    PendingVerificationsReport.slug: PendingVerificationsReport,
    UpcomingMaturitiesReport.slug: UpcomingMaturitiesReport,
    MissingDocumentsReport.slug: MissingDocumentsReport,
    CasesNeedingInterventionReport.slug: CasesNeedingInterventionReport,
    ReleasePipelineReport.slug: ReleasePipelineReport,
    InstitutionStatementReport.slug: InstitutionStatementReport,
    RenewalHistoryReport.slug: RenewalHistoryReport,
    MyInstrumentsReport.slug: MyInstrumentsReport,
}


def get_report(slug: str) -> BaseReport | None:
    """Retrieve an instantiated report generator by slug."""
    cls = REPORT_REGISTRY.get(slug)
    if cls:
        return cls()
    return None


def list_reports_for_user(user: User) -> list[dict]:
    """Return list of reports accessible to the given user role."""
    accessible = []
    for slug, report_cls in REPORT_REGISTRY.items():
        if user.role == UserRole.INSTITUTION:
            # Institution users only get my-instruments
            if slug != MyInstrumentsReport.slug:
                continue
        else:
            # Officers/Admin get all except the institution-specific view
            if slug == MyInstrumentsReport.slug:
                continue

        accessible.append(
            {
                "slug": slug,
                "title": report_cls.title,
                "description": report_cls.description,
                "supported_formats": report_cls.supported_formats,
            }
        )
    return accessible
