"""Central Document & Instrument Type Registry.

Single source of truth defining instrument types, document types, mandatory requirements,
allowed uploader roles, lifecycle stages, accepted formats, and OCR capabilities.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.db.enums import DocumentType, FDRStatus, InstrumentType, UserRole


@dataclass
class DocumentDefinition:
    """Specification of a document type in the portal."""

    doc_type: str
    label: str
    description: str
    applicable_instruments: list[str]
    is_required: dict[str, bool]  # e.g. {"FDR": True, "BANK_GUARANTEE": False}
    is_renewal_required: bool
    allowed_uploader_roles: list[str]
    allowed_statuses: list[str]
    accepted_mime_types: list[str]
    has_ocr_profile: bool
    ocr_extractable_fields: list[str] = field(default_factory=list)


# Central Registry of Document Types
DOCUMENT_DEFINITIONS: dict[str, DocumentDefinition] = {
    DocumentType.FDR_SCAN.value: DocumentDefinition(
        doc_type=DocumentType.FDR_SCAN.value,
        label="Original FDR Certificate",
        description="Scanned copy of the original Fixed Deposit Receipt issued jointly with AICTE.",
        applicable_instruments=[InstrumentType.FDR.value],
        is_required={InstrumentType.FDR.value: True, InstrumentType.BANK_GUARANTEE.value: False},
        is_renewal_required=False,
        allowed_uploader_roles=[UserRole.INSTITUTION.value, UserRole.ADMIN.value],
        allowed_statuses=[FDRStatus.SUBMITTED.value, FDRStatus.DISCREPANCY.value, FDRStatus.UNDER_SCRUTINY.value],
        accepted_mime_types=["application/pdf", "image/jpeg", "image/png"],
        has_ocr_profile=True,
        ocr_extractable_fields=[
            "fdr_number", "bank_name", "branch", "amount", "issue_date",
            "maturity_date", "interest_rate", "tenure"
        ],
    ),
    DocumentType.BANK_GUARANTEE_DOCUMENT.value: DocumentDefinition(
        doc_type=DocumentType.BANK_GUARANTEE_DOCUMENT.value,
        label="Original Bank Guarantee Document",
        description="Formal Bank Guarantee executed on non-judicial stamp paper in favor of AICTE.",
        applicable_instruments=[InstrumentType.BANK_GUARANTEE.value],
        is_required={InstrumentType.FDR.value: False, InstrumentType.BANK_GUARANTEE.value: True},
        is_renewal_required=False,
        allowed_uploader_roles=[UserRole.INSTITUTION.value, UserRole.ADMIN.value],
        allowed_statuses=[FDRStatus.SUBMITTED.value, FDRStatus.DISCREPANCY.value, FDRStatus.UNDER_SCRUTINY.value],
        accepted_mime_types=["application/pdf", "image/jpeg", "image/png"],
        has_ocr_profile=True,
        ocr_extractable_fields=[
            "guarantee_number", "issuing_bank", "branch", "amount",
            "issue_date", "maturity_date", "claim_expiry_date", "beneficiary_name"
        ],
    ),
    DocumentType.DEPOSIT_CONFIRMATION.value: DocumentDefinition(
        doc_type=DocumentType.DEPOSIT_CONFIRMATION.value,
        label="Bank Deposit Confirmation Slip",
        description="Confirmation slip or deposit advice issued by the bank confirming creation of deposit.",
        applicable_instruments=[InstrumentType.FDR.value],
        is_required={InstrumentType.FDR.value: True, InstrumentType.BANK_GUARANTEE.value: False},
        is_renewal_required=False,
        allowed_uploader_roles=[UserRole.INSTITUTION.value, UserRole.ADMIN.value],
        allowed_statuses=[FDRStatus.SUBMITTED.value, FDRStatus.DISCREPANCY.value, FDRStatus.UNDER_SCRUTINY.value],
        accepted_mime_types=["application/pdf", "image/jpeg", "image/png"],
        has_ocr_profile=True,
        ocr_extractable_fields=["fdr_number", "bank_name", "amount", "maturity_date"],
    ),
    DocumentType.BANK_LETTER.value: DocumentDefinition(
        doc_type=DocumentType.BANK_LETTER.value,
        label="Bank Confirmation & Lien Letter",
        description="Official letter on bank letterhead confirming joint holding, marking AICTE lien, and barring loans/advances.",
        applicable_instruments=[InstrumentType.FDR.value, InstrumentType.BANK_GUARANTEE.value],
        is_required={InstrumentType.FDR.value: False, InstrumentType.BANK_GUARANTEE.value: True},
        is_renewal_required=False,
        allowed_uploader_roles=[
            UserRole.INSTITUTION.value,
            UserRole.VERIFYING_OFFICER.value,
            UserRole.ADMIN.value,
        ],
        allowed_statuses=[
            FDRStatus.SUBMITTED.value,
            FDRStatus.UNDER_SCRUTINY.value,
            FDRStatus.DISCREPANCY.value,
            FDRStatus.VERIFIED.value,
            FDRStatus.ACTIVE.value,
        ],
        accepted_mime_types=["application/pdf", "image/jpeg", "image/png"],
        has_ocr_profile=True,
        ocr_extractable_fields=["reference_number", "bank_name", "amount", "maturity_date", "claim_expiry_date"],
    ),
    DocumentType.RENEWAL_CERTIFICATE.value: DocumentDefinition(
        doc_type=DocumentType.RENEWAL_CERTIFICATE.value,
        label="Renewal FDR / BG Extension Certificate",
        description="Certificate of renewal or bank guarantee amendment letter extending validity.",
        applicable_instruments=[InstrumentType.FDR.value, InstrumentType.BANK_GUARANTEE.value],
        is_required={InstrumentType.FDR.value: False, InstrumentType.BANK_GUARANTEE.value: False},
        is_renewal_required=True,
        allowed_uploader_roles=[UserRole.INSTITUTION.value, UserRole.ADMIN.value],
        allowed_statuses=[
            FDRStatus.EXPIRING.value,
            FDRStatus.MATURED.value,
            FDRStatus.RENEWED.value,
            FDRStatus.ACTIVE.value,
        ],
        accepted_mime_types=["application/pdf", "image/jpeg", "image/png"],
        has_ocr_profile=True,
        ocr_extractable_fields=[
            "reference_number", "bank_name", "amount", "issue_date",
            "maturity_date", "claim_expiry_date"
        ],
    ),
    DocumentType.CLOSURE.value: DocumentDefinition(
        doc_type=DocumentType.CLOSURE.value,
        label="Discharge & Release Certificate",
        description="Official closure and lien discharge order issued by AICTE upon approved release.",
        applicable_instruments=[InstrumentType.FDR.value, InstrumentType.BANK_GUARANTEE.value],
        is_required={InstrumentType.FDR.value: False, InstrumentType.BANK_GUARANTEE.value: False},
        is_renewal_required=False,
        allowed_uploader_roles=[UserRole.APPROVING_AUTHORITY.value, UserRole.ADMIN.value],
        allowed_statuses=[FDRStatus.RELEASED.value],
        accepted_mime_types=["application/pdf"],
        has_ocr_profile=False,
        ocr_extractable_fields=[],
    ),
    DocumentType.OTHER.value: DocumentDefinition(
        doc_type=DocumentType.OTHER.value,
        label="Other Supporting Document",
        description="Miscellaneous filings such as gazette notifications, trust deeds, or court orders.",
        applicable_instruments=[InstrumentType.FDR.value, InstrumentType.BANK_GUARANTEE.value],
        is_required={InstrumentType.FDR.value: False, InstrumentType.BANK_GUARANTEE.value: False},
        is_renewal_required=False,
        allowed_uploader_roles=[
            UserRole.INSTITUTION.value,
            UserRole.VERIFYING_OFFICER.value,
            UserRole.APPROVING_AUTHORITY.value,
            UserRole.ADMIN.value,
        ],
        allowed_statuses=[s.value for s in FDRStatus],
        accepted_mime_types=["application/pdf", "image/jpeg", "image/png"],
        has_ocr_profile=True,
        ocr_extractable_fields=["reference_number", "amount"],
    ),
}


class DocumentRegistry:
    """Helper facade for querying document and instrument rules."""

    @staticmethod
    def get_definition(doc_type: str | DocumentType) -> DocumentDefinition | None:
        key = doc_type.value if hasattr(doc_type, "value") else str(doc_type)
        return DOCUMENT_DEFINITIONS.get(key)

    @staticmethod
    def get_required_doc_types(
        instrument_type: str | InstrumentType, is_renewal: bool = False
    ) -> list[str]:
        itype = instrument_type.value if hasattr(instrument_type, "value") else str(instrument_type)
        if is_renewal:
            return [DocumentType.RENEWAL_CERTIFICATE.value]

        required = []
        for doc_key, defn in DOCUMENT_DEFINITIONS.items():
            if defn.is_required.get(itype, False):
                required.append(doc_key)
        return sorted(required)

    @staticmethod
    def is_doc_type_allowed(
        instrument_type: str | InstrumentType,
        doc_type: str | DocumentType,
        uploader_role: str | UserRole,
        status: str | FDRStatus,
    ) -> tuple[bool, str | None]:
        itype = instrument_type.value if hasattr(instrument_type, "value") else str(instrument_type)
        dtype = doc_type.value if hasattr(doc_type, "value") else str(doc_type)
        urole = uploader_role.value if hasattr(uploader_role, "value") else str(uploader_role)
        ustatus = status.value if hasattr(status, "value") else str(status)

        defn = DOCUMENT_DEFINITIONS.get(dtype)
        if not defn:
            return False, f"Unknown document type '{dtype}'"

        if itype not in defn.applicable_instruments:
            return False, f"Document type '{defn.label}' is not applicable to instrument type '{itype}'"

        if urole not in defn.allowed_uploader_roles:
            return False, f"Role '{urole}' is not authorized to upload document type '{defn.label}'"

        if ustatus not in defn.allowed_statuses:
            return False, f"Document type '{defn.label}' cannot be uploaded while instrument is in status '{ustatus}'"

        return True, None

    @staticmethod
    def get_api_metadata() -> dict[str, Any]:
        """Serialize complete registry for GET /meta/document-types."""
        instrument_types = [
            {
                "type": InstrumentType.FDR.value,
                "label": "Fixed Deposit Receipt (FDR)",
                "description": "Joint term deposit with AICTE Regional Officer at a scheduled commercial bank.",
                "required_documents": DocumentRegistry.get_required_doc_types(InstrumentType.FDR.value),
            },
            {
                "type": InstrumentType.BANK_GUARANTEE.value,
                "label": "Bank Guarantee (BG)",
                "description": "Irrevocable bank guarantee favoring AICTE with defined validity and claim period.",
                "required_documents": DocumentRegistry.get_required_doc_types(InstrumentType.BANK_GUARANTEE.value),
            },
        ]

        document_types = [
            {
                "code": defn.doc_type,
                "label": defn.label,
                "description": defn.description,
                "applicable_instruments": defn.applicable_instruments,
                "is_required": defn.is_required,
                "is_renewal_required": defn.is_renewal_required,
                "allowed_uploader_roles": defn.allowed_uploader_roles,
                "allowed_statuses": defn.allowed_statuses,
                "accepted_mime_types": defn.accepted_mime_types,
                "has_ocr_profile": defn.has_ocr_profile,
                "ocr_extractable_fields": defn.ocr_extractable_fields,
            }
            for defn in DOCUMENT_DEFINITIONS.values()
        ]

        return {
            "instrument_types": instrument_types,
            "document_types": document_types,
        }
