#!/usr/bin/env python3
"""Génère docs/Recouvrix_Pitch_BWAI2026.pdf — diaporama sparse pour demain."""

from pathlib import Path

from fpdf import FPDF
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "docs" / "assets"
OUT = ROOT / "docs" / "Recouvrix_Pitch_BWAI2026.pdf"
ART = Path("/opt/cursor/artifacts/Recouvrix_Pitch_BWAI2026.pdf")

# 16:9 landscape (mm)
W, H = 297, 167
MARGIN = 16

COBALT = (29, 78, 216)
NAVY = (15, 29, 46)
INK = (30, 41, 59)
MUTED = (100, 116, 139)
SOFT = (241, 245, 249)
WHITE = (255, 255, 255)
SUCCESS = (5, 150, 105)
WARN = (217, 119, 6)


class Deck(FPDF):
    def __init__(self) -> None:
        # format=(width, height) in portrait mode → true 16:9 landscape canvas
        super().__init__(orientation="P", unit="mm", format=(W, H))
        self.set_auto_page_break(auto=False)
        self.add_font("DejaVu", "", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
        self.add_font("DejaVu", "B", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
        self.bwai = str(ASSETS / "bwai-logo.png")
        self.mark = str(ASSETS / "recouvrix-mark.png")

    def _bg(self, color=WHITE) -> None:
        self.set_fill_color(*color)
        self.rect(0, 0, W, H, "F")

    def _footer_bar(self, page_label: str) -> None:
        self.set_fill_color(*SOFT)
        self.rect(0, H - 12, W, 12, "F")
        self.set_text_color(*MUTED)
        self.set_font("DejaVu", "", 8)
        self.set_xy(MARGIN, H - 9.5)
        self.cell(120, 5, "BWAI'2026  ·  Cas 1 — Recouvrement  ·  bwai-ifri-uac.bj")
        self.set_xy(W - MARGIN - 60, H - 9.5)
        self.cell(60, 5, page_label, align="R")

    def _title(self, text: str, y: float = 28) -> None:
        self.set_xy(MARGIN, y)
        self.set_text_color(*NAVY)
        self.set_font("DejaVu", "B", 28)
        self.multi_cell(W - 2 * MARGIN, 12, text)

    def _subtitle(self, text: str, y: float | None = None) -> None:
        if y is not None:
            self.set_y(y)
        self.set_x(MARGIN)
        self.set_text_color(*MUTED)
        self.set_font("DejaVu", "", 13)
        self.multi_cell(W - 2 * MARGIN, 7, text)

    def _accent_line(self, y: float = 22) -> None:
        self.set_fill_color(*COBALT)
        self.rect(MARGIN, y, 28, 2.2, "F")


def draw_cover(pdf: Deck) -> None:
    pdf.add_page()
    pdf._bg(NAVY)
    # soft cobalt wash
    pdf.set_fill_color(29, 78, 216)
    pdf.rect(0, 0, 8, H, "F")

    # logos
    pdf.image(pdf.bwai, x=MARGIN, y=14, h=28)
    pdf.image(pdf.mark, x=W - MARGIN - 28, y=14, h=28)

    pdf.set_xy(MARGIN, 55)
    pdf.set_text_color(147, 197, 253)
    pdf.set_font("DejaVu", "", 12)
    pdf.cell(0, 8, "Benin Workshop on Artificial Intelligence  ·  BWAI'2026")

    pdf.set_xy(MARGIN, 70)
    pdf.set_text_color(*WHITE)
    pdf.set_font("DejaVu", "B", 42)
    pdf.cell(0, 16, "RECOUVRIX")

    pdf.set_xy(MARGIN, 90)
    pdf.set_font("DejaVu", "", 18)
    pdf.set_text_color(226, 232, 240)
    pdf.multi_cell(210, 9, "Le cockpit intelligent du recouvrement\npour les PME béninoises.")

    pdf.set_xy(MARGIN, 118)
    pdf.set_font("DejaVu", "B", 12)
    pdf.set_text_color(147, 197, 253)
    pdf.cell(0, 7, "Cas pratique 1  —  Relances justes, au bon moment")

    pdf.set_xy(MARGIN, H - 22)
    pdf.set_font("DejaVu", "", 9)
    pdf.set_text_color(148, 163, 184)
    pdf.cell(0, 5, "Prototype de démonstration  ·  IA assistée + validation humaine")


def draw_problem(pdf: Deck) -> None:
    pdf.add_page()
    pdf._bg()
    pdf._accent_line()
    pdf._title("Le coût invisible du suivi manuel")
    pdf._subtitle("Excel, papier, WhatsApp… et la trésorerie qui glisse.")

    cards = [
        ("Retards", "Relances trop tardives\nou oubliées"),
        ("Chaos", "Infos dispersées entre\ndevis, reçus et messages"),
        ("Erreurs", "Facture déjà payée\nou litige ignoré"),
    ]
    x0, y0, cw, ch, gap = MARGIN, 68, 82, 52, 8
    for i, (title, body) in enumerate(cards):
        x = x0 + i * (cw + gap)
        pdf.set_fill_color(*SOFT)
        pdf.rect(x, y0, cw, ch, style="F", round_corners=True, corner_radius=4)
        pdf.set_xy(x + 8, y0 + 10)
        pdf.set_font("DejaVu", "B", 16)
        pdf.set_text_color(*COBALT)
        pdf.cell(cw - 16, 8, title)
        pdf.set_xy(x + 8, y0 + 24)
        pdf.set_font("DejaVu", "", 12)
        pdf.set_text_color(*INK)
        pdf.multi_cell(cw - 16, 6, body)
    pdf._footer_bar("02 / 09")


def draw_solution(pdf: Deck) -> None:
    pdf.add_page()
    pdf._bg()
    pdf._accent_line()
    pdf._title("Recouvrix, en une phrase")
    pdf._subtitle("Prioriser. Relancer. Encaisser. Sans perdre l’humain.")

    points = [
        ("1", "Portefeuille unifié", "Clients, factures, litiges, paiements"),
        ("2", "Priorités claires", "Ancienneté · solde · historique"),
        ("3", "Relance assistée", "Email / WhatsApp simulés + validation"),
    ]
    y = 68
    for num, title, body in points:
        pdf.set_fill_color(*COBALT)
        pdf.ellipse(MARGIN, y, 12, 12, "F")
        pdf.set_xy(MARGIN, y + 2.5)
        pdf.set_text_color(*WHITE)
        pdf.set_font("DejaVu", "B", 11)
        pdf.cell(12, 7, num, align="C")
        pdf.set_xy(MARGIN + 18, y)
        pdf.set_text_color(*NAVY)
        pdf.set_font("DejaVu", "B", 16)
        pdf.cell(100, 7, title)
        pdf.set_xy(MARGIN + 18, y + 8)
        pdf.set_text_color(*MUTED)
        pdf.set_font("DejaVu", "", 12)
        pdf.cell(180, 6, body)
        y += 26
    pdf._footer_bar("03 / 09")


def draw_case(pdf: Deck) -> None:
    pdf.add_page()
    pdf._bg()
    pdf._accent_line()
    pdf._title("Notre choix : Cas 1")
    pdf._subtitle("Recouvrement automatique des factures impayées")

    pdf.set_fill_color(*SOFT)
    pdf.rect(MARGIN, 62, W - 2 * MARGIN, 70, style="F", round_corners=True, corner_radius=5)

    left = [
        "Importer un portefeuille",
        "Calculer soldes & retards",
        "Prioriser les dossiers",
    ]
    right = [
        "Préparer des relances graduées",
        "Bloquer litiges & gros montants",
        "Tracer chaque décision",
    ]
    pdf.set_font("DejaVu", "B", 13)
    pdf.set_text_color(*NAVY)
    pdf.set_xy(MARGIN + 12, 74)
    pdf.cell(100, 7, "Socle métier")
    pdf.set_xy(W / 2 + 4, 74)
    pdf.cell(100, 7, "Maîtrise humaine")

    pdf.set_font("DejaVu", "", 12)
    pdf.set_text_color(*INK)
    for i, t in enumerate(left):
        pdf.set_xy(MARGIN + 12, 90 + i * 10)
        pdf.cell(110, 7, f"→  {t}")
    for i, t in enumerate(right):
        pdf.set_xy(W / 2 + 4, 90 + i * 10)
        pdf.cell(120, 7, f"→  {t}")
    pdf._footer_bar("04 / 09")


def draw_journey(pdf: Deck) -> None:
    pdf.add_page()
    pdf._bg()
    pdf._accent_line()
    pdf._title("Le parcours démo")
    pdf._subtitle("Quatre gestes. Zéro jargon.")

    steps = [
        ("Import", "CSV / PDF\ncontrôlé"),
        ("Priorités", "Dossiers\ncritiques"),
        ("Relance", "Brouillon IA\n+ validation"),
        ("Encaissement", "Preuve →\nquittance"),
    ]
    cw = 58
    gap = 8
    total = 4 * cw + 3 * gap
    x0 = (W - total) / 2
    y0 = 70
    for i, (title, body) in enumerate(steps):
        x = x0 + i * (cw + gap)
        pdf.set_fill_color(*COBALT if i % 2 == 0 else NAVY)
        pdf.rect(x, y0, cw, 58, style="F", round_corners=True, corner_radius=4)
        pdf.set_xy(x + 4, y0 + 10)
        pdf.set_text_color(*WHITE)
        pdf.set_font("DejaVu", "B", 14)
        pdf.cell(cw - 8, 8, f"{i + 1}. {title}", align="C")
        pdf.set_xy(x + 4, y0 + 26)
        pdf.set_font("DejaVu", "", 11)
        pdf.multi_cell(cw - 8, 6, body, align="C")
        if i < 3:
            pdf.set_fill_color(*SOFT)
            pdf.rect(x + cw + 1.5, y0 + 27, gap - 3, 3, "F")
    pdf._footer_bar("05 / 09")


def draw_ai(pdf: Deck) -> None:
    pdf.add_page()
    pdf._bg()
    pdf._accent_line()
    pdf._title("IA qui assiste. Code qui garantit.")
    pdf._subtitle("Pas d’hallucination sur les montants.")

    # two columns
    mid = W / 2
    pdf.set_fill_color(239, 246, 255)
    pdf.rect(MARGIN, 62, mid - MARGIN - 6, 72, style="F", round_corners=True, corner_radius=5)
    pdf.set_fill_color(236, 253, 245)
    pdf.rect(mid + 2, 62, mid - MARGIN - 6, 72, style="F", round_corners=True, corner_radius=5)

    pdf.set_xy(MARGIN + 10, 72)
    pdf.set_font("DejaVu", "B", 15)
    pdf.set_text_color(*COBALT)
    pdf.cell(100, 8, "L’IA suggère")
    pdf.set_font("DejaVu", "", 12)
    pdf.set_text_color(*INK)
    for line in ["Priorités du jour", "Ton & message de relance", "Canal Email / WhatsApp"]:
        pdf.set_x(MARGIN + 10)
        pdf.cell(120, 8, f"•  {line}", new_x="LMARGIN", new_y="NEXT")

    pdf.set_xy(mid + 12, 72)
    pdf.set_font("DejaVu", "B", 15)
    pdf.set_text_color(*SUCCESS)
    pdf.cell(100, 8, "Le moteur calcule")
    pdf.set_y(80)
    pdf.set_font("DejaVu", "", 12)
    pdf.set_text_color(*INK)
    for line in ["Soldes & retards exacts", "Doublons & idempotence", "Seuils → validation humaine"]:
        pdf.set_x(mid + 12)
        pdf.cell(120, 8, f"•  {line}", new_x="LMARGIN", new_y="NEXT")
    pdf._footer_bar("06 / 09")


def draw_impact(pdf: Deck) -> None:
    pdf.add_page()
    pdf._bg()
    pdf._accent_line()
    pdf._title("Ce que le jury doit retenir")
    pdf._subtitle("Des preuves métier, pas du spectacle.")

    metrics = [
        ("−70 %", "temps de suivi\nrépétitif"),
        ("0", "relance injustifiée\nsur litige / payé"),
        ("100 %", "actions tracées\n& rejouables"),
    ]
    cw = 82
    gap = 8
    x0 = MARGIN
    for i, (big, small) in enumerate(metrics):
        x = x0 + i * (cw + gap)
        pdf.set_fill_color(*SOFT)
        pdf.rect(x, 68, cw, 58, style="F", round_corners=True, corner_radius=5)
        pdf.set_xy(x, 78)
        pdf.set_font("DejaVu", "B", 32)
        pdf.set_text_color(*COBALT)
        pdf.cell(cw, 14, big, align="C")
        pdf.set_xy(x + 8, 98)
        pdf.set_font("DejaVu", "", 12)
        pdf.set_text_color(*INK)
        pdf.multi_cell(cw - 16, 6, small, align="C")
    pdf._footer_bar("07 / 09")


def draw_demo(pdf: Deck) -> None:
    pdf.add_page()
    pdf._bg()
    pdf._accent_line()
    pdf._title("Démonstration live")
    pdf._subtitle("Créer un compte → importer → prioriser → relancer")

    pdf.set_fill_color(*NAVY)
    pdf.rect(MARGIN, 62, W - 2 * MARGIN, 68, style="F", round_corners=True, corner_radius=5)

    lines = [
        "1. Connexion  ·  créez votre compte en 20 secondes",
        "2. Importation  ·  sample_creances.csv ou PDF d’entrée",
        "3. Tableau de bord  ·  priorités du jour visibles",
        "4. Relances  ·  brouillon IA, validation humaine, Mobile Money fictif",
    ]
    pdf.set_text_color(*WHITE)
    pdf.set_font("DejaVu", "", 13)
    y = 72
    for line in lines:
        pdf.set_xy(MARGIN + 14, y)
        pdf.cell(W - 2 * MARGIN - 28, 10, line)
        y += 12
    pdf._footer_bar("08 / 09")


def draw_thanks(pdf: Deck) -> None:
    pdf.add_page()
    pdf._bg(NAVY)
    pdf.set_fill_color(*COBALT)
    pdf.rect(0, 0, 8, H, "F")

    pdf.image(pdf.bwai, x=MARGIN, y=18, h=26)
    pdf.image(pdf.mark, x=W - MARGIN - 26, y=18, h=26)

    pdf.set_xy(MARGIN, 60)
    pdf.set_text_color(*WHITE)
    pdf.set_font("DejaVu", "B", 36)
    pdf.cell(0, 14, "Merci.")

    pdf.set_xy(MARGIN, 80)
    pdf.set_font("DejaVu", "", 16)
    pdf.set_text_color(203, 213, 225)
    pdf.multi_cell(220, 8, "Place à la démo.\nDes questions ?")

    pdf.set_xy(MARGIN, 115)
    pdf.set_font("DejaVu", "B", 12)
    pdf.set_text_color(147, 197, 253)
    pdf.cell(0, 7, "BWAI  ·  IFRI / UAC  ·  bwai-ifri-uac.bj")

    pdf.set_xy(MARGIN, H - 22)
    pdf.set_font("DejaVu", "", 9)
    pdf.set_text_color(148, 163, 184)
    pdf.cell(0, 5, "Recouvrix  —  prototype hackathon, paiements simulés")


def main() -> None:
    # ensure logos exist / trim BWAI for size if needed
    bwai = Image.open(ASSETS / "bwai-logo.png")
    if max(bwai.size) > 900:
        bwai.thumbnail((900, 900), Image.Resampling.LANCZOS)
        bwai.save(ASSETS / "bwai-logo.png")

    pdf = Deck()
    draw_cover(pdf)
    draw_problem(pdf)
    draw_solution(pdf)
    draw_case(pdf)
    draw_journey(pdf)
    draw_ai(pdf)
    draw_impact(pdf)
    draw_demo(pdf)
    draw_thanks(pdf)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUT))
    ART.parent.mkdir(parents=True, exist_ok=True)
    ART.write_bytes(OUT.read_bytes())
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")
    print(f"Artifact {ART}")


if __name__ == "__main__":
    main()
