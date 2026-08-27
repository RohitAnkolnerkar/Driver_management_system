import datetime
import io
import logging

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core.time_utils import get_now_ist_naive

logger = logging.getLogger(__name__)


def generate_payout_pdf(payment, driver) -> io.BytesIO:
    """
    Generates a beautifully styled PDF invoice statement using ReportLab
    and returns it as an in-memory BytesIO stream.
    """
    buffer = io.BytesIO()

    # Page settings: Letter size with 0.75 in (54 pt) margins
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54,
    )

    styles = getSampleStyleSheet()

    # Custom Palette
    primary_color = colors.HexColor("#06121f")  # Dark Slate Blue
    text_color = colors.HexColor("#1e293b")  # Charcoal Gray
    light_bg = colors.HexColor("#f8fafc")  # Very Light Gray
    success_color = colors.HexColor("#16a34a")  # Green
    warning_color = colors.HexColor("#ca8a04")  # Yellow/Brown

    # Custom Paragraph Styles
    title_style = ParagraphStyle(
        "InvoiceTitle",
        parent=styles["Heading1"],
        fontSize=24,
        leading=28,
        textColor=primary_color,
        spaceAfter=6,
    )

    subtitle_style = ParagraphStyle(
        "InvoiceSubtitle",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=15,
    )

    section_heading = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontSize=12,
        leading=16,
        textColor=primary_color,
        spaceBefore=10,
        spaceAfter=8,
        keepWithNext=True,
    )

    body_bold = ParagraphStyle(
        "BodyBold",
        parent=styles["Normal"],
        fontSize=9,
        leading=13,
        textColor=text_color,
        fontName="Helvetica-Bold",
    )

    body_normal = ParagraphStyle(
        "BodyNormal",
        parent=styles["Normal"],
        fontSize=9,
        leading=13,
        textColor=text_color,
    )

    elements = []

    # --- HEADER / BRAND SECTION ---
    elements.append(Paragraph("FleetFlow Operations", title_style))
    elements.append(Paragraph("Automated Payout Statement & Paystub", subtitle_style))

    # Horizontal line divider
    divider = Table([[""]], colWidths=[504])
    divider.setStyle(
        TableStyle(
            [
                ("LINEABOVE", (0, 0), (-1, -1), 1.5, primary_color),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    elements.append(divider)
    elements.append(Spacer(1, 10))

    # --- METADATA SECTION (Two Columns) ---
    month_name = datetime.date(2000, payment.month, 1).strftime("%B")
    status_label = payment.status.upper()
    status_text_color = success_color if payment.status == "paid" else warning_color

    status_style = ParagraphStyle(
        "StatusStyle", parent=body_bold, textColor=status_text_color
    )

    metadata_data = [
        [
            Paragraph("<b>STATEMENT DETAILS</b>", body_bold),
            Paragraph("<b>DRIVER PROFILE</b>", body_bold),
        ],
        [
            Paragraph(f"Statement ID: P-{payment.id:05d}", body_normal),
            Paragraph(f"Driver Name: {driver.name}", body_normal),
        ],
        [
            Paragraph(
                f"Statement Date: {datetime.date.today().strftime('%Y-%m-%d')}",
                body_normal,
            ),
            Paragraph(f"Phone Number: {driver.phone}", body_normal),
        ],
        [
            Paragraph(f"Billing Period: {month_name} {payment.year}", body_normal),
            Paragraph(f"License Number: {driver.license_number or 'N/A'}", body_normal),
        ],
        [
            Paragraph(
                f"Payment Method: {payment.payment_method or 'Bank Transfer'}",
                body_normal,
            ),
            Paragraph(f"Payment Status: <b>{status_label}</b>", status_style),
        ],
    ]

    # 252 width for each column to match 504 pt printable area width
    metadata_table = Table(metadata_data, colWidths=[252, 252])
    metadata_table.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("LINEBELOW", (0, 0), (-1, 0), 1, colors.HexColor("#e2e8f0")),
            ]
        )
    )

    elements.append(metadata_table)
    elements.append(Spacer(1, 20))

    # --- PAYOUT BREAKDOWN TABLE ---
    elements.append(Paragraph("Payout Earnings Breakdown", section_heading))

    table_headers = [
        Paragraph("<b>Description / Earnings Type</b>", body_bold),
        Paragraph(
            "<b>Amount</b>", ParagraphStyle("RightBold", parent=body_bold, alignment=2)
        ),
    ]

    # Format floats
    base_val = f"INR {payment.base_salary_paid:,.2f}"
    comm_val = f"INR {payment.commission_paid:,.2f}"
    bonus_val = f"INR {payment.bonus:,.2f}"
    ded_val = f"- INR {payment.deductions:,.2f}"
    net_val = f"INR {payment.total_paid:,.2f}"

    right_align = ParagraphStyle("RightNorm", parent=body_normal, alignment=2)
    right_bold = ParagraphStyle(
        "RightBoldNet",
        parent=body_bold,
        alignment=2,
        fontSize=10,
        textColor=primary_color,
    )
    desc_bold = ParagraphStyle(
        "DescBoldNet", parent=body_bold, fontSize=10, textColor=primary_color
    )

    table_rows = [
        [
            Paragraph("Base Driver Salary (Monthly Fixed Contract)", body_normal),
            Paragraph(base_val, right_align),
        ],
        [
            Paragraph(
                f"Trip Commission Earnings (at {driver.commission_percentage}% share)",
                body_normal,
            ),
            Paragraph(comm_val, right_align),
        ],
        [
            Paragraph("Performance Bonuses / Special Allowances", body_normal),
            Paragraph(bonus_val, right_align),
        ],
        [
            Paragraph("Statutory or Operational Deductions", body_normal),
            Paragraph(ded_val, right_align),
        ],
        [
            Paragraph("<b>NET DISBURSED AMOUNT</b>", desc_bold),
            Paragraph(net_val, right_bold),
        ],
    ]

    breakdown_data = [table_headers] + table_rows
    breakdown_table = Table(breakdown_data, colWidths=[384, 120])
    breakdown_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), light_bg),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("LINEBELOW", (0, 0), (-1, 0), 1, primary_color),
                ("LINEBELOW", (0, 1), (-1, 3), 0.5, colors.HexColor("#cbd5e1")),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f1f5f9")),
                ("LINEABOVE", (0, -1), (-1, -1), 1.5, primary_color),
                ("LINEBELOW", (0, -1), (-1, -1), 1.5, primary_color),
            ]
        )
    )

    elements.append(breakdown_table)
    elements.append(Spacer(1, 20))

    # --- NOTES / REMARKS ---
    if payment.note:
        elements.append(Paragraph("Manager's Statement Notes", section_heading))
        elements.append(Paragraph(payment.note, body_normal))
        elements.append(Spacer(1, 15))

    # --- SIGN-OFF FOOTER ---
    elements.append(Spacer(1, 30))
    now_str = get_now_ist_naive().strftime("%Y-%m-%d %H:%M:%S")
    footer_text = (
        f"This statement was generated electronically by FleetFlow System "
        f"on {now_str} IST. No signature required."
    )
    elements.append(
        Paragraph(
            footer_text,
            ParagraphStyle(
                "FooterText",
                parent=body_normal,
                fontSize=8,
                textColor=colors.HexColor("#94a3b8"),
                alignment=1,
            ),
        )
    )

    # Build Document
    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_trips_manifest_pdf(trips) -> io.BytesIO:
    """
    Generates a beautifully styled PDF document of trips manifest
    and returns it as an in-memory BytesIO stream.
    """
    buffer = io.BytesIO()

    # Page settings: Landscape Letter size to accommodate more columns
    from reportlab.lib.pagesizes import landscape

    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(letter),
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    # Custom Palette
    primary_color = colors.HexColor("#06121f")  # Dark Slate Blue
    text_color = colors.HexColor("#1e293b")  # Charcoal Gray
    light_bg = colors.HexColor("#f8fafc")  # Very Light Gray
    border_color = colors.HexColor("#e2e8f0")

    title_style = ParagraphStyle(
        "ManifestTitle",
        parent=styles["Heading1"],
        fontSize=20,
        leading=24,
        textColor=primary_color,
        spaceAfter=4,
    )

    subtitle_style = ParagraphStyle(
        "ManifestSubtitle",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=15,
    )

    cell_header_style = ParagraphStyle(
        "CellHeader",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
        textColor=colors.white,
        fontName="Helvetica-Bold",
    )

    cell_body_style = ParagraphStyle(
        "CellBody", parent=styles["Normal"], fontSize=7, leading=9, textColor=text_color
    )

    cell_body_bold = ParagraphStyle(
        "CellBodyBold",
        parent=styles["Normal"],
        fontSize=7,
        leading=9,
        textColor=text_color,
        fontName="Helvetica-Bold",
    )

    elements = []

    # Header Section
    elements.append(Paragraph("FleetFlow Operations", title_style))
    elements.append(
        Paragraph(
            (
                f"Trips Manifest Report — Generated on "
                f"{get_now_ist_naive().strftime('%Y-%m-%d %H:%M')}"
            ),
            subtitle_style,
        )
    )

    # Horizontal line divider
    divider = Table([[""]], colWidths=[720])
    divider.setStyle(
        TableStyle(
            [
                ("LINEABOVE", (0, 0), (-1, -1), 1.5, primary_color),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    elements.append(divider)
    elements.append(Spacer(1, 10))

    # Table headers
    headers = [
        Paragraph("Trip ID", cell_header_style),
        Paragraph("Driver", cell_header_style),
        Paragraph("Source", cell_header_style),
        Paragraph("Destination", cell_header_style),
        Paragraph("Distance (KM)", cell_header_style),
        Paragraph("Duration (Min)", cell_header_style),
        Paragraph("Est. Fare (INR)", cell_header_style),
        Paragraph("Priority", cell_header_style),
        Paragraph("Status", cell_header_style),
        Paragraph("Scheduled Date", cell_header_style),
    ]

    table_data = [headers]

    for t in trips:
        driver_name = t.driver.name if t.driver else "Unassigned"
        table_data.append(
            [
                Paragraph(str(t.id), cell_body_bold),
                Paragraph(driver_name, cell_body_style),
                Paragraph(t.source or "N/A", cell_body_style),
                Paragraph(t.destination or "N/A", cell_body_style),
                Paragraph(f"{t.distance_km or 0.0:.2f}", cell_body_style),
                Paragraph(str(t.duration_minutes or 0), cell_body_style),
                Paragraph(f"INR {t.estimated_fare or 0.0:.2f}", cell_body_style),
                Paragraph(t.priority.upper(), cell_body_bold),
                Paragraph(t.status.upper(), cell_body_bold),
                Paragraph(
                    t.scheduled_date.isoformat() if t.scheduled_date else "N/A",
                    cell_body_style,
                ),
            ]
        )

    # Landscape Letter has width 792. Printable area = 792 - 72 = 720 width.
    col_widths = [40, 75, 120, 120, 55, 55, 65, 50, 60, 80]

    manifest_table = Table(table_data, colWidths=col_widths, repeatRows=1)

    t_style = TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, 0), primary_color),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("GRID", (0, 0), (-1, -1), 0.5, border_color),
        ]
    )

    # Alternating row colors
    for i in range(1, len(table_data)):
        bg = light_bg if i % 2 == 0 else colors.white
        t_style.add("BACKGROUND", (0, i), (-1, i), bg)

    manifest_table.setStyle(t_style)
    elements.append(manifest_table)

    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_invoice_pdf(data: dict) -> io.BytesIO:
    """
    Generates a beautifully formatted PDF invoice statement for a completed dispatch
    and returns it as an in-memory BytesIO stream.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    primary_color = colors.HexColor("#1e293b")  # slate-800
    text_color = colors.HexColor("#334155")  # slate-700

    title_style = ParagraphStyle(
        "InvoiceTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        textColor=primary_color,
        spaceAfter=12,
    )

    subtitle_style = ParagraphStyle(
        "InvoiceSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=text_color,
    )

    header_style = ParagraphStyle(
        "InvoiceHeader",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=primary_color,
        spaceBefore=10,
        spaceAfter=6,
    )

    cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=text_color,
    )

    cell_bold_style = ParagraphStyle(
        "TableCellBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=primary_color,
    )

    elements = []

    # Title / Company block
    elements.append(Paragraph("DISPATCH FREIGHT INVOICE", title_style))
    elements.append(
        Paragraph(f"Invoice Number: {data['invoice_number']}", subtitle_style)
    )
    elements.append(Paragraph(f"Issue Date: {data['issue_date']}", subtitle_style))
    elements.append(Spacer(1, 15))

    # Bill To / Details layout table
    details_data = [
        [
            Paragraph("<b>CLIENT BILL TO:</b>", cell_bold_style),
            Paragraph("<b>DISPATCH DETAILS:</b>", cell_bold_style),
        ],
        [
            Paragraph(f"{data['client_name']}", cell_style),
            Paragraph(f"Trip ID: #{data['trip_id']}", cell_style),
        ],
        [Paragraph("", cell_style), Paragraph(f"Source: {data['source']}", cell_style)],
        [
            Paragraph("", cell_style),
            Paragraph(f"Destination: {data['destination']}", cell_style),
        ],
        [
            Paragraph("", cell_style),
            Paragraph(f"Vehicle Type: {data.get('vehicle_type') or 'N/A'}", cell_style),
        ],
        [
            Paragraph("", cell_style),
            Paragraph(f"Driver Name: {data.get('driver_name') or 'N/A'}", cell_style),
        ],
    ]

    details_table = Table(details_data, colWidths=[270, 270])
    details_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    elements.append(details_table)
    elements.append(Spacer(1, 20))

    # Line Items Table
    elements.append(Paragraph("TARIFF BREAKDOWN", header_style))
    table_headers = [
        Paragraph("<b>Description</b>", cell_bold_style),
        Paragraph("<b>Amount</b>", cell_bold_style),
    ]

    table_data = [table_headers]
    for item in data["line_items"]:
        table_data.append(
            [
                Paragraph(item["description"], cell_style),
                Paragraph(f"INR {item['amount']:.2f}", cell_style),
            ]
        )

    table_data.append(
        [
            Paragraph("<b>Subtotal</b>", cell_bold_style),
            Paragraph(f"<b>INR {data['subtotal']:.2f}</b>", cell_bold_style),
        ]
    )
    table_data.append(
        [
            Paragraph(f"GST ({data['tax_rate_percent']}%)", cell_style),
            Paragraph(f"INR {data['tax_amount']:.2f}", cell_style),
        ]
    )
    table_data.append(
        [
            Paragraph("<b>Total Amount Due</b>", cell_bold_style),
            Paragraph(f"<b>INR {data['total_amount']:.2f}</b>", cell_bold_style),
        ]
    )

    item_table = Table(table_data, colWidths=[400, 140])
    item_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("BACKGROUND", (0, -3), (-1, -1), colors.HexColor("#f8fafc")),
            ]
        )
    )
    elements.append(item_table)
    elements.append(Spacer(1, 20))

    # Electronic Proof of Delivery (e-POD) Section
    if data.get("pod"):
        pod_info = data["pod"]
        elements.append(Paragraph("ELECTRONIC PROOF OF DELIVERY (e-POD)", header_style))

        sig_flowable = Paragraph("<i>No digital signature image</i>", cell_style)
        if pod_info.get("signature_data"):
            try:
                import base64

                from reportlab.platypus import Image as RLImage

                sig_str = pod_info["signature_data"]
                if "," in sig_str:
                    sig_str = sig_str.split(",")[1]
                img_bytes = base64.b64decode(sig_str)
                img_buf = io.BytesIO(img_bytes)
                sig_flowable = RLImage(img_buf, width=140, height=50)
            except Exception as e:
                logger.warning(f"Failed to decode Base64 signature for PDF: {e}")

        pod_meta_text = (
            f"<b>Recipient:</b> {pod_info.get('recipient_name', 'N/A')}<br/>"
            f"<b>Phone:</b> {pod_info.get('recipient_phone') or 'N/A'}<br/>"
            f"<b>Delivered At:</b> {pod_info.get('delivered_at', 'N/A')}<br/>"
            f"<b>Verification:</b> <font color='#16a34a'><b>✔ OFFICIALLY VERIFIED POD</b></font>"
        )

        pod_table_data = [[Paragraph(pod_meta_text, cell_style), sig_flowable]]

        pod_table = Table(pod_table_data, colWidths=[360, 180])
        pod_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0fdf4")),
                    ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#bbf7d0")),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("PADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        elements.append(pod_table)
        elements.append(Spacer(1, 20))

    elements.append(
        Paragraph(
            "<b>Terms & Conditions:</b> Payment is due immediately upon manifest delivery verification. Thank you for your business.",
            subtitle_style,
        )
    )

    doc.build(elements)
    buffer.seek(0)
    return buffer
