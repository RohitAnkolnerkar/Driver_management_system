import logging
import re
from datetime import datetime
from typing import Any, List, Optional

import cv2
import numpy as np
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/fuel/receipt",
    tags=["receipt-ocr"],
)

# ---------------------------------------------------------------------------
# PaddleOCR engine
# ---------------------------------------------------------------------------

ocr_engine = None


def get_ocr_engine():
    """
    Lazy-load PaddleOCR.

    The first OCR request will be slower because the models are loaded into
    memory. Subsequent requests reuse the same engine.
    """
    global ocr_engine

    if ocr_engine is not None:
        return ocr_engine

    try:
        import os

        # Set these before importing PaddleOCR.
        os.environ["FLAGS_use_mkldnn"] = "0"
        os.environ["PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT"] = "0"

        from paddleocr import PaddleOCR

        logger.info("Initializing PaddleOCR engine...")

        ocr_engine = PaddleOCR(
            lang="en",
            enable_mkldnn=False,
        )

        logger.info("PaddleOCR engine initialized successfully.")

        return ocr_engine

    except Exception as exc:
        logger.exception(
            "Failed to initialize PaddleOCR engine: %s",
            exc,
        )
        ocr_engine = None
        return None


# ---------------------------------------------------------------------------
# Response model
# ---------------------------------------------------------------------------


class OCRResponse(BaseModel):
    station_name: Optional[str] = Field(
        None,
        description="Detected fuel station/company name",
    )

    liters: Optional[float] = Field(
        None,
        description="Extracted fuel quantity in liters",
    )

    price_per_liter: Optional[float] = Field(
        None,
        description="Extracted fuel price per liter",
    )

    total_amount: Optional[float] = Field(
        None,
        description="Extracted total receipt amount",
    )

    refuel_date: Optional[str] = Field(
        None,
        description="Extracted billing date",
    )

    confidence: float = Field(
        ...,
        description="Average PaddleOCR recognition confidence",
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def normalize_text(text: str) -> str:
    """
    Normalize common OCR formatting issues.
    """

    text = text.lower().strip()

    # 42,35 -> 42.35
    text = re.sub(
        r"(?<=\d),(?=\d)",
        ".",
        text,
    )

    # collapse excessive whitespace
    text = re.sub(r"\s+", " ", text)

    return text


def safe_float(value: str) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# PaddleOCR result extraction
# ---------------------------------------------------------------------------


def extract_ocr_data(result: Any) -> tuple[List[str], List[float]]:
    """
    Extract recognized text and confidence values from PaddleOCR.

    Supports the newer PaddleOCR/PaddleX result format as well as the
    traditional PaddleOCR result structure.
    """

    texts: List[str] = []
    scores: List[float] = []

    if not result:
        return texts, scores

    # ------------------------------------------------------------------
    # New PaddleOCR / PaddleX format
    # ------------------------------------------------------------------

    for page in result:

        page_data = None

        # Some PaddleOCR versions expose dictionary-like Result objects.
        try:
            if hasattr(page, "json"):
                page_json = page.json

                if callable(page_json):
                    page_json = page_json()

                if isinstance(page_json, dict):
                    page_data = page_json.get("res", page_json)

        except Exception:
            page_data = None

        # Direct dict support
        if page_data is None and isinstance(page, dict):
            page_data = page.get("res", page)

        if isinstance(page_data, dict):

            rec_texts = page_data.get("rec_texts", [])
            rec_scores = page_data.get("rec_scores", [])

            if rec_texts:

                for text in rec_texts:
                    if text is not None and str(text).strip():
                        texts.append(str(text).strip())

                for score in rec_scores:
                    try:
                        scores.append(float(score))
                    except (TypeError, ValueError):
                        pass

                continue

        # ------------------------------------------------------------------
        # Older PaddleOCR format
        #
        # [
        #   [
        #       [box, ("Indian Oil", 0.98)],
        #       [box, ("42.35 Ltr", 0.97)]
        #   ]
        # ]
        # ------------------------------------------------------------------

        if isinstance(page, (list, tuple)):

            for line in page:

                try:

                    if not isinstance(line, (list, tuple)):
                        continue

                    if len(line) < 2:
                        continue

                    recognition = line[1]

                    if not isinstance(recognition, (list, tuple)):
                        continue

                    if len(recognition) < 1:
                        continue

                    text = recognition[0]

                    if isinstance(text, str) and text.strip():

                        texts.append(text.strip())

                        if len(recognition) > 1:
                            try:
                                scores.append(float(recognition[1]))
                            except (TypeError, ValueError):
                                pass

                except Exception:
                    continue

    return texts, scores


# ---------------------------------------------------------------------------
# Station extraction
# ---------------------------------------------------------------------------


def extract_station(full_text: str) -> Optional[str]:

    if "indian oil" in full_text or "indianoil" in full_text or "iocl" in full_text:
        return "Indian Oil Corporation Ltd"

    if (
        "hindustan petroleum" in full_text
        or "hpcl" in full_text
        or "hp petrol" in full_text
    ):
        return "Hindustan Petroleum"

    if "bharat petroleum" in full_text or "bpcl" in full_text:
        return "Bharat Petroleum"

    if "shell" in full_text:
        return "Shell"

    if (
        "jio-bp" in full_text
        or "jio bp" in full_text
        or "reliance petroleum" in full_text
    ):
        return "Jio-bp"

    return None


# ---------------------------------------------------------------------------
# Date extraction
# ---------------------------------------------------------------------------


def extract_receipt_date(full_text: str) -> Optional[str]:

    patterns = [
        r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{4})\b",
        r"\b(\d{4}[/-]\d{1,2}[/-]\d{1,2})\b",
    ]

    for pattern in patterns:

        match = re.search(pattern, full_text)

        if not match:
            continue

        raw_date = match.group(1)

        formats = [
            "%d/%m/%Y",
            "%d-%m-%Y",
            "%Y/%m/%d",
            "%Y-%m-%d",
        ]

        for fmt in formats:

            try:
                parsed = datetime.strptime(
                    raw_date,
                    fmt,
                )

                return parsed.strftime("%Y-%m-%d")

            except ValueError:
                continue

    return None


# ---------------------------------------------------------------------------
# Fuel field parsing
# ---------------------------------------------------------------------------


def parse_receipt_text(texts: List[str]) -> dict:

    normalized = [normalize_text(text) for text in texts if text and text.strip()]

    full_text = " ".join(normalized)

    logger.info(
        "Normalized OCR text: %s",
        full_text,
    )

    station = extract_station(full_text)
    receipt_date = extract_receipt_date(full_text)

    liters: Optional[float] = None
    rate: Optional[float] = None
    total: Optional[float] = None

    # ------------------------------------------------------------------
    # Liters
    # ------------------------------------------------------------------

    liter_patterns = [
        # 42.35 L / Ltr / Litres
        r"\b(\d+(?:\.\d+)?)\s*(?:ltr|ltrs|liter|liters|litre|litres|lts|lt|l)\b",
        # Volume: 42.35
        r"(?:volume|qty|quantity|vol)\s*[:\-]?\s*(\d+(?:\.\d+)?)",
    ]

    for pattern in liter_patterns:

        match = re.search(
            pattern,
            full_text,
            re.IGNORECASE,
        )

        if match:

            value = safe_float(match.group(1))

            if value is not None and 0 < value < 1000:
                liters = value
                break

    # ------------------------------------------------------------------
    # Rate
    # ------------------------------------------------------------------

    rate_patterns = [
        r"(?:unit\s*price|rate|price)\s*[:\-]?\s*₹?\s*(\d+(?:\.\d+)?)",
        r"₹?\s*(\d+(?:\.\d+)?)\s*(?:/l|per\s*liter|per\s*litre)",
    ]

    for pattern in rate_patterns:

        match = re.search(
            pattern,
            full_text,
            re.IGNORECASE,
        )

        if match:

            value = safe_float(match.group(1))

            if value is not None and 50 <= value <= 200:
                rate = value
                break

    # ------------------------------------------------------------------
    # Total amount
    # ------------------------------------------------------------------

    total_patterns = [
        r"(?:total\s*amount|net\s*amount|grand\s*total|amount\s*paid)"
        r"\s*[:\-]?\s*₹?\s*(\d+(?:\.\d+)?)",
        r"(?:amount)\s*[:\-]?\s*₹?\s*(\d+(?:\.\d+)?)",
    ]

    for pattern in total_patterns:

        match = re.search(
            pattern,
            full_text,
            re.IGNORECASE,
        )

        if match:

            value = safe_float(match.group(1))

            if value is not None and value > 0:
                total = value
                break

    # ------------------------------------------------------------------
    # Collect decimal numbers for mathematical validation
    # ------------------------------------------------------------------

    candidates: List[float] = []

    for text in normalized:

        numbers = re.findall(
            r"\b\d+\.\d{1,2}\b",
            text,
        )

        for number in numbers:

            value = safe_float(number)

            if value is not None and value not in candidates:
                candidates.append(value)

    logger.info(
        "Numeric OCR candidates: %s",
        candidates,
    )

    # ------------------------------------------------------------------
    # Mathematical triangulation
    #
    # liters × rate ≈ total
    # ------------------------------------------------------------------

    best_triplet = None
    best_error = float("inf")

    for possible_liters in candidates:

        if not (1 <= possible_liters <= 1000):
            continue

        for possible_rate in candidates:

            if not (50 <= possible_rate <= 200):
                continue

            if possible_liters == possible_rate:
                continue

            expected_total = possible_liters * possible_rate

            for possible_total in candidates:

                if possible_total in (
                    possible_liters,
                    possible_rate,
                ):
                    continue

                if possible_total < 100:
                    continue

                error = abs(expected_total - possible_total)

                # percentage error
                percentage_error = (
                    error / possible_total if possible_total else float("inf")
                )

                if percentage_error <= 0.01 and error < best_error:

                    best_error = error

                    best_triplet = (
                        possible_liters,
                        possible_rate,
                        possible_total,
                    )

    if best_triplet:

        detected_liters, detected_rate, detected_total = best_triplet

        logger.info(
            "Mathematical OCR triplet found: " "liters=%s rate=%s total=%s",
            detected_liters,
            detected_rate,
            detected_total,
        )

        # Mathematical consistency is stronger than a loose label match.
        liters = detected_liters
        rate = detected_rate
        total = detected_total

    # ------------------------------------------------------------------
    # Calculate ONLY one missing value when the other two were actually
    # extracted.
    # ------------------------------------------------------------------

    if liters and rate and total is None:

        total = round(
            liters * rate,
            2,
        )

    elif liters and total and rate is None:

        calculated_rate = total / liters

        if 50 <= calculated_rate <= 200:
            rate = round(
                calculated_rate,
                2,
            )

    elif rate and total and liters is None:

        calculated_liters = total / rate

        if 0 < calculated_liters <= 1000:
            liters = round(
                calculated_liters,
                2,
            )

    return {
        "station_name": station,
        "liters": liters,
        "price_per_liter": rate,
        "total_amount": total,
        "refuel_date": receipt_date,
    }


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post(
    "/ocr",
    response_model=OCRResponse,
)
async def process_receipt_ocr(
    file: UploadFile = File(...),
):
    """
    Read a fuel receipt image using PaddleOCR and return structured
    fuel transaction information.
    """

    filename = (file.filename or "").lower()

    # ------------------------------------------------------------------
    # Validate extension
    # ------------------------------------------------------------------

    allowed_extensions = (
        ".png",
        ".jpg",
        ".jpeg",
    )

    if filename.endswith(".pdf"):

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "PDF OCR is not currently supported by this endpoint. "
                "Please upload the receipt as PNG, JPG, or JPEG."
            ),
        )

    if not filename.endswith(allowed_extensions):

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=("Unsupported file format. " "Please upload PNG, JPG, or JPEG."),
        )

    # ------------------------------------------------------------------
    # Read image
    # ------------------------------------------------------------------

    try:

        contents = await file.read()

        if not contents:

            raise ValueError("Uploaded file is empty.")

        image_array = np.frombuffer(
            contents,
            dtype=np.uint8,
        )

        image = cv2.imdecode(
            image_array,
            cv2.IMREAD_COLOR,
        )

        if image is None or image.size == 0:

            raise ValueError("OpenCV could not decode image.")

        logger.info(
            "Receipt image decoded: %sx%s",
            image.shape[1],
            image.shape[0],
        )

    except Exception as exc:

        logger.error(
            "Image decode failed: %s",
            exc,
        )

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not decode the uploaded receipt image.",
        )

    # ------------------------------------------------------------------
    # OCR
    # ------------------------------------------------------------------

    engine = get_ocr_engine()

    if engine is None:

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="PaddleOCR engine could not be initialized.",
        )

    try:

        # Newer PaddleOCR versions recommend predict().
        if hasattr(engine, "predict"):
            result = engine.predict(image)

        else:
            # Compatibility with older PaddleOCR versions.
            result = engine.ocr(image)

    except Exception as exc:

        logger.exception(
            "PaddleOCR prediction failed: %s",
            exc,
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OCR prediction failed.",
        )

    # ------------------------------------------------------------------
    # Extract PaddleOCR result
    # ------------------------------------------------------------------

    texts, scores = extract_ocr_data(result)

    logger.info(
        "Extracted OCR text lines: %s",
        texts,
    )

    logger.info(
        "OCR recognition scores: %s",
        scores,
    )

    if not texts:

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No readable text was detected on the receipt.",
        )

    # ------------------------------------------------------------------
    # Parse receipt
    # ------------------------------------------------------------------

    parsed = parse_receipt_text(texts)

    # ------------------------------------------------------------------
    # Real OCR confidence
    # ------------------------------------------------------------------

    if scores:

        confidence = round(
            sum(scores) / len(scores),
            4,
        )

    else:

        confidence = 0.0

    # ------------------------------------------------------------------
    # Logging
    # ------------------------------------------------------------------

    logger.info(
        "OCR parsed result: "
        "station=%s liters=%s rate=%s total=%s date=%s confidence=%.2f%%",
        parsed["station_name"],
        parsed["liters"],
        parsed["price_per_liter"],
        parsed["total_amount"],
        parsed["refuel_date"],
        confidence * 100,
    )

    # ------------------------------------------------------------------
    # Response
    # ------------------------------------------------------------------

    return OCRResponse(
        station_name=parsed["station_name"],
        liters=parsed["liters"],
        price_per_liter=parsed["price_per_liter"],
        total_amount=parsed["total_amount"],
        refuel_date=parsed["refuel_date"],
        confidence=confidence,
    )
