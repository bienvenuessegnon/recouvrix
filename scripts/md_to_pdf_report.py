#!/usr/bin/env python3
"""Convertit les livrables Markdown BWAI en PDF propre (WeasyPrint)."""

from __future__ import annotations

import base64
import re
from pathlib import Path

import markdown
from weasyprint import HTML

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "docs" / "assets"
ART = Path("/opt/cursor/artifacts")


def data_uri(path: Path) -> str:
    mime = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    b64 = base64.b64encode(path.read_bytes()).decode()
    return f"data:{mime};base64,{b64}"


CSS = """
@page {
  size: A4;
  margin: 18mm 16mm 18mm 16mm;
  @bottom-center {
    content: "Page " counter(page) " / " counter(pages);
    font-family: "DejaVu Sans", sans-serif;
    font-size: 9pt;
    color: #94a3b8;
  }
}
html, body {
  font-family: "DejaVu Sans", "Liberation Sans", sans-serif;
  font-size: 10.5pt;
  line-height: 1.45;
  color: #1e293b;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14pt;
  padding-bottom: 8pt;
  border-bottom: 2px solid #1d4ed8;
}
.header img.bwai { height: 42px; }
.header img.mark { height: 36px; }
h1 {
  font-size: 18pt;
  color: #0f1d2e;
  margin: 0 0 8pt 0;
  line-height: 1.25;
}
h2 {
  font-size: 12.5pt;
  color: #1d4ed8;
  margin: 16pt 0 6pt 0;
  padding-left: 8pt;
  border-left: 4px solid #1d4ed8;
}
h3 {
  font-size: 11pt;
  color: #0f1d2e;
  margin: 10pt 0 4pt 0;
}
p { margin: 0 0 7pt 0; }
ul, ol { margin: 0 0 8pt 18pt; padding: 0; }
li { margin: 0 0 3pt 0; }
strong { color: #0f1d2e; }
hr {
  border: none;
  border-top: 1px solid #e2e8f0;
  margin: 12pt 0;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 8pt 0 12pt 0;
  font-size: 9.5pt;
  table-layout: fixed;
  word-wrap: break-word;
}
th, td {
  border: 1px solid #cbd5e1;
  padding: 6pt 7pt;
  vertical-align: top;
  text-align: left;
}
th {
  background: #f1f5f9;
  color: #0f1d2e;
  font-weight: 700;
}
td { background: #fff; }
.meta {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6pt;
  padding: 8pt 10pt;
  margin: 0 0 12pt 0;
}
.meta p { margin: 0 0 3pt 0; }
.footer-note {
  margin-top: 16pt;
  font-size: 9pt;
  color: #64748b;
  font-style: italic;
}
"""


def md_to_html_body(md_text: str) -> str:
    # Keep markdown tables / emphasis
    return markdown.markdown(
        md_text,
        extensions=["tables", "sane_lists", "fenced_code"],
    )


def wrap_document(title: str, body_html: str) -> str:
    bwai = data_uri(ASSETS / "bwai-logo.png")
    mark = data_uri(ASSETS / "recouvrix-mark.png")
    # Extract h1 from body if present, else use title
    body = body_html
    # Move first h1 outside meta styling
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>{title}</title>
  <style>{CSS}</style>
</head>
<body>
  <div class="header">
    <img class="bwai" src="{bwai}" alt="BWAI" />
    <img class="mark" src="{mark}" alt="Recouvrix" />
  </div>
  {body}
</body>
</html>
"""


def convert(md_path: Path, pdf_path: Path, title: str) -> None:
    md_text = md_path.read_text(encoding="utf-8")
    # Soften horizontal rules noise
    md_text = re.sub(r"\n---\n", "\n\n", md_text)
    body = md_to_html_body(md_text)
    # Wrap metadata block after h1: first paragraph group with strong labels
    html = wrap_document(title, body)
    HTML(string=html, base_url=str(ROOT)).write_pdf(str(pdf_path))
    print(f"Wrote {pdf_path} ({pdf_path.stat().st_size} bytes)")


def main() -> None:
    ART.mkdir(parents=True, exist_ok=True)
    jobs = [
        (ROOT / "docs" / "RAPPORT_BWAI2026.md", ROOT / "docs" / "RAPPORT_BWAI2026.pdf", "Rapport Recouvrix BWAI’2026"),
        (ROOT / "docs" / "FICHE_IA_BWAI2026.md", ROOT / "docs" / "FICHE_IA_BWAI2026.pdf", "Fiche IA Recouvrix BWAI’2026"),
    ]
    for md, pdf, title in jobs:
        convert(md, pdf, title)
        (ART / pdf.name).write_bytes(pdf.read_bytes())
        print(f"Artifact {ART / pdf.name}")


if __name__ == "__main__":
    main()
