"""Closure letter PDF generation and verification service."""

from __future__ import annotations

import hashlib
import io
import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import clock
from app.core.config import get_settings
from app.db.models.document import Document
from app.db.models.institution import Institution
from app.db.models.instrument import Instrument
from app.db.models.release import ReleaseRequest
from app.db.models.user import User
from app.services.document_service import DocumentService

if TYPE_CHECKING:
    pass


class ClosureService:
    """Service to create, store and verify release closure documents."""

    @staticmethod
    def compute_verification_code(
        closure_reference: str,
        instrument_id: uuid.UUID,
        request_id: uuid.UUID,
        approver_id: uuid.UUID,
        approved_at: datetime,
    ) -> str:
        """Compute SHA-256 verification hash over decision parameters."""
        raw = f"{closure_reference}:{instrument_id}:{request_id}:{approver_id}:{approved_at.isoformat()}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    @staticmethod
    async def generate_closure_reference(session: AsyncSession) -> str:
        """Generate sequence-safe unique reference AICTE-FDR-REL-YYYY-NNNNNN."""
        current_year = clock.today().year
        stmt = (
            select(func.count(ReleaseRequest.id))
            .where(ReleaseRequest.closure_document_id.is_not(None))
        )
        count_res = await session.execute(stmt)
        seq = (count_res.scalar() or 0) + 1
        return f"AICTE-FDR-REL-{current_year}-{seq:06d}"

    @classmethod
    async def create_closure_document(
        cls,
        session: AsyncSession,
        instrument: Instrument,
        release_request: ReleaseRequest,
        institution: Institution,
        approver: User,
        document_service: DocumentService,
    ) -> tuple[Document, str, str]:
        """Generate and store an encrypted closure document PDF in MinIO.

        Returns (document, closure_reference, verification_code).
        Caller is responsible for committing the session.
        """
        settings = get_settings()
        now = clock.now()
        closure_ref = await cls.generate_closure_reference(session)
        verification_code = cls.compute_verification_code(
            closure_reference=closure_ref,
            instrument_id=instrument.id,
            request_id=release_request.id,
            approver_id=approver.id,
            approved_at=now,
        )

        pdf_bytes = cls._build_pdf(
            closure_reference=closure_ref,
            verification_code=verification_code,
            instrument=instrument,
            release_request=release_request,
            institution=institution,
            approver=approver,
            approved_at=now,
            portal_url=settings.PORTAL_URL,
        )

        filename = f"{closure_ref}.pdf"

        # Upload encrypted PDF through document service
        doc = await document_service.upload(
            session=session,
            instrument_id=instrument.id,
            file_bytes=pdf_bytes,
            content_type="application/pdf",
            filename=filename,
            doc_type="CLOSURE",
            uploaded_by=approver.id,
        )

        return doc, closure_ref, verification_code

    @classmethod
    def _build_pdf(
        cls,
        closure_reference: str,
        verification_code: str,
        instrument: Instrument,
        release_request: ReleaseRequest,
        institution: Institution,
        approver: User,
        approved_at: datetime,
        portal_url: str,
    ) -> bytes:
        """Render the formal AICTE release certificate with ReportLab."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=0.75 * inch,
            rightMargin=0.75 * inch,
            topMargin=0.75 * inch,
            bottomMargin=0.75 * inch,
        )

        styles = getSampleStyleSheet()
        primary_color = colors.HexColor("#1B365D")
        accent_color = colors.HexColor("#C28212")
        text_color = colors.HexColor("#222222")

        header_style = ParagraphStyle(
            "AICTE_Header",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=15,
            leading=18,
            alignment=1,
            textColor=primary_color,
        )
        sub_header_style = ParagraphStyle(
            "AICTE_SubHeader",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            leading=13,
            alignment=1,
            textColor=colors.dimgrey,
        )
        title_style = ParagraphStyle(
            "AICTE_Title",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=16,
            alignment=1,
            textColor=accent_color,
            spaceAfter=15,
        )
        body_style = ParagraphStyle(
            "AICTE_Body",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            leading=15,
            textColor=text_color,
        )
        meta_label_style = ParagraphStyle(
            "MetaLabel",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            textColor=primary_color,
        )
        meta_val_style = ParagraphStyle(
            "MetaVal",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=text_color,
        )
        code_style = ParagraphStyle(
            "VerificationCode",
            parent=styles["Normal"],
            fontName="Courier",
            fontSize=8,
            leading=10,
            alignment=1,
            textColor=colors.dimgrey,
        )

        story = []

        # 1. Header
        story.append(Paragraph("ALL INDIA COUNCIL FOR TECHNICAL EDUCATION", header_style))
        story.append(Paragraph("Nelson Mandela Marg, Vasant Kunj, New Delhi — 110070", sub_header_style))
        story.append(Spacer(1, 10))
        story.append(HRFlowable(width="100%", thickness=1.5, color=primary_color, spaceAfter=12))

        # 2. Title
        story.append(Paragraph("CERTIFICATE OF RELEASE / DISCHARGE OF SECURITY DEPOSIT", title_style))

        # 3. Reference & Date
        ref_table = Table(
            [
                [
                    Paragraph(f"<b>Certificate Ref:</b> {closure_reference}", body_style),
                    Paragraph(f"<b>Issue Date:</b> {approved_at.strftime('%d-%b-%Y')}", body_style),
                ]
            ],
            colWidths=[3.5 * inch, 3.5 * inch],
        )
        ref_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
        story.append(ref_table)
        story.append(Spacer(1, 12))

        # 4. Details Box
        masked_ref = instrument.reference_number
        if len(masked_ref) > 6:
            masked_ref = masked_ref[:3] + "..." + masked_ref[-4:]

        amount_str = f"{Decimal(instrument.amount):,.2f}"

        data = [
            [Paragraph("Institution Name", meta_label_style), Paragraph(institution.name, meta_val_style)],
            [Paragraph("AICTE Permanent ID", meta_label_style), Paragraph(institution.aicte_id, meta_val_style)],
            [Paragraph("State / Region", meta_label_style), Paragraph(institution.state, meta_val_style)],
            [Paragraph("Instrument Reference", meta_label_style), Paragraph(masked_ref, meta_val_style)],
            [Paragraph("Issuing Bank & Branch", meta_label_style), Paragraph(f"{instrument.issuing_bank} ({instrument.branch or 'Main'})", meta_val_style)],
            [Paragraph("Deposit Amount", meta_label_style), Paragraph(f"INR {amount_str}", meta_val_style)],
            [Paragraph("Issue & Maturity Dates", meta_label_style), Paragraph(f"{instrument.issue_date} to {instrument.maturity_date}", meta_val_style)],
            [Paragraph("Action Authorized", meta_label_style), Paragraph(f"{release_request.request_type.value} of Security Deposit", meta_val_style)],
        ]

        table = Table(data, colWidths=[2.2 * inch, 4.8 * inch])
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8F9FA")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D3D3D3")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E5E5")),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        story.append(table)
        story.append(Spacer(1, 15))

        # 5. Certification Statement
        statement = (
            "This is to certify that the aforementioned institution has satisfactorily complied with "
            "the statutory regulatory requirements and norms laid down in the AICTE Approval Process Handbook. "
            "The lien marked in favor of the All India Council for Technical Education on the said Fixed Deposit Receipt / "
            "Security Deposit is hereby unconditionally released. The issuing bank is authorized to discharge / refund "
            "the instrument proceeds to the account of the institution."
        )
        story.append(Paragraph(statement, body_style))
        story.append(Spacer(1, 20))

        # 6. Approver Sign-off
        sign_table = Table(
            [
                [
                    "",
                    Paragraph(
                        f"<b>Digitally Approved By:</b><br/>"
                        f"{approver.name or approver.email}<br/>"
                        f"Role: {approver.role.value}<br/>"
                        f"Date: {approved_at.strftime('%d-%b-%Y %H:%M:%S IST')}",
                        body_style,
                    ),
                ]
            ],
            colWidths=[4.0 * inch, 3.0 * inch],
        )
        sign_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
        story.append(sign_table)
        story.append(Spacer(1, 25))

        # 7. Verification Stamp / Footer
        story.append(HRFlowable(width="100%", thickness=0.75, color=colors.HexColor("#D3D3D3"), spaceAfter=8))
        story.append(Paragraph(f"<b>Tamper-Proof Verification Code (SHA-256):</b><br/>{verification_code}", code_style))
        story.append(Spacer(1, 4))
        story.append(
            Paragraph(
                f"Verify this certificate online at: {portal_url}/closure/verify/{closure_reference}",
                ParagraphStyle("VerifyLink", parent=styles["Normal"], fontSize=8, alignment=1, textColor=primary_color),
            )
        )

        doc.build(story)
        return buffer.getvalue()
