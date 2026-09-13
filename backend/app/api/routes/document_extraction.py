from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Request, UploadFile, status

from app.config.document_config import MAX_DOCUMENT_SIZE_BYTES
from app.schemas.document_extraction import DocumentExtractionResponse
from app.services.document_extraction_service import (
    DocumentExtractionError,
    DocumentExtractionService,
    build_document_extraction_service,
)

router = APIRouter(prefix="/documents", tags=["Document Analyzer"])


def get_extraction_service(request: Request) -> DocumentExtractionService:
    service: DocumentExtractionService | None = getattr(request.app.state, "document_extraction_service", None)
    if service is None:
        service = build_document_extraction_service(MAX_DOCUMENT_SIZE_BYTES)
        request.app.state.document_extraction_service = service
    return service


@router.post(
    "/extract",
    response_model=DocumentExtractionResponse,
    status_code=status.HTTP_200_OK,
    summary="Extract prediction inputs from a project PDF",
    description=(
        "Reads the uploaded PDF with pdfplumber and maps its text and tables onto the "
        "ProjectRiskRequest fields by label. Every field is returned, with a null value when "
        "it could not be found and a low confidence when the match or unit is ambiguous. "
        "Nothing is stored; the review screen decides what reaches the model."
    ),
)
async def extract_document_fields(
    request: Request,
    file: UploadFile = File(..., description="A PDF project document (DPR, progress report, sanction note)"),
) -> DocumentExtractionResponse:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file must have a filename")
    if Path(file.filename).suffix.lower() != ".pdf":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF documents can be analysed")

    # Bounded read: stop as soon as the size limit is crossed instead of buffering the rest.
    chunks: list[bytes] = []
    size = 0
    try:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_DOCUMENT_SIZE_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File size exceeds maximum allowed limit of {MAX_DOCUMENT_SIZE_BYTES // (1024 * 1024) or 1} MB",
                )
            chunks.append(chunk)
    finally:
        await file.close()

    service = get_extraction_service(request)
    try:
        return service.extract(Path(file.filename).name, b"".join(chunks))
    except DocumentExtractionError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
