"""Report generation and export endpoints."""

from __future__ import annotations

import io
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import clock
from app.core.config import get_settings
from app.core.dependencies import get_current_user
from app.db.enums import UserRole
from app.db.models.user import User
from app.db.session import get_session
from app.services.audit_service import AuditService
from app.services.reports.registry import get_report, list_reports_for_user

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/")
async def list_reports(
    current_user: User = Depends(get_current_user),
):
    """List all reports accessible to the current user role."""
    return list_reports_for_user(current_user)


@router.get("/{report_type}")
async def generate_report(
    report_type: str,
    request: Request,
    format: str = Query(default="json", pattern="^(json|csv|xlsx|pdf)$"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Generate and export a report in JSON, CSV, XLSX, or PDF format."""
    settings = get_settings()

    # RBAC role constraints
    if current_user.role == UserRole.INSTITUTION:
        if report_type != "my-instruments":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Institution users may only access the 'my-instruments' report",
            )
    else:
        if report_type == "my-instruments":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The 'my-instruments' report is for INSTITUTION users. Use 'institution-statement'.",
            )

    report = get_report(report_type)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report type '{report_type}' not found",
        )

    if format not in report.supported_formats:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Format '{format}' not supported for '{report_type}'. Supported: {report.supported_formats}",
        )

    # Extract all query params except 'format'
    params = dict(request.query_params)
    params.pop("format", None)

    rows, fieldnames, is_truncated = await report.fetch_data(
        session=session,
        user=current_user,
        params=params,
        max_rows=settings.REPORT_MAX_ROWS,
    )

    # Write audit log for every export (scrubbing sensitive payloads)
    await AuditService.record(
        session=session,
        actor_id=current_user.id,
        action="report_exported",
        entity_type="report",
        entity_id=None,
        payload={
            "report_type": report_type,
            "format": format,
            "filters": params,
            "row_count": len(rows),
            "is_truncated": is_truncated,
        },
    )
    await session.commit()

    headers = {
        "X-Report-Truncated": "true" if is_truncated else "false",
        "X-Total-Rows": str(len(rows)),
    }

    if format == "json":
        return {
            "report_type": report_type,
            "title": report.title,
            "generated_at": clock.now().isoformat(),
            "is_truncated": is_truncated,
            "total_rows": len(rows),
            "headers": fieldnames,
            "data": rows,
        }

    elif format == "csv":
        csv_stream = report.to_csv_stream(rows, fieldnames)
        headers["Content-Disposition"] = f'attachment; filename="{report_type}.csv"'
        return StreamingResponse(
            csv_stream,
            media_type="text/csv; charset=utf-8",
            headers=headers,
        )

    elif format == "xlsx":
        xlsx_bytes = report.to_xlsx(
            title=report.title,
            rows=rows,
            fieldnames=fieldnames,
            user=current_user,
            params=params,
            is_truncated=is_truncated,
        )
        headers["Content-Disposition"] = f'attachment; filename="{report_type}.xlsx"'
        return Response(
            content=xlsx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers=headers,
        )

    elif format == "pdf":
        pdf_bytes = report.to_pdf(
            title=report.title,
            rows=rows,
            fieldnames=fieldnames,
            user=current_user,
            params=params,
        )
        headers["Content-Disposition"] = f'attachment; filename="{report_type}.pdf"'
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers=headers,
        )
