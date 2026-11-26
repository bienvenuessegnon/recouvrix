#!/usr/bin/env python3
"""Génère public/sample_portefeuille_entree.pdf — données d'entrée démo BWAI."""

from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "sample_portefeuille_entree.pdf"
ART = Path("/opt/cursor/artifacts/sample_portefeuille_entree.pdf")


class InvoicePDF(FPDF):
    def __init__(self) -> None:
        super().__init__(format="A4")
        self.add_font("DejaVu", "", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
        self.add_font("DejaVu", "B", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
        self.add_font("DejaVuMono", "", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf")
        self.alias_nb_pages()
        self.set_auto_page_break(auto=True, margin=18)

    def header(self) -> None:
        self.set_fill_color(29, 78, 216)
        self.rect(0, 0, 210, 18, "F")
        self.set_text_color(255, 255, 255)
        self.set_font("DejaVu", "B", 11)
        self.set_xy(12, 5)
        self.cell(0, 8, "RECOUVRIX — Données d'entrée démo BWAI'2026")
        self.set_y(22)
        self.set_text_color(30, 30, 30)

    def footer(self) -> None:
        self.set_y(-15)
        self.set_font("DejaVu", "", 8)
        self.set_text_color(120, 120, 120)
        self.cell(
            0,
            10,
            f"Page {self.page_no()}/{{nb}}  |  Données fictives — usage hackathon uniquement",
            align="C",
        )


def main() -> None:
    pdf = InvoicePDF()
    usable = pdf.epw

    pdf.add_page()
    pdf.set_font("DejaVu", "B", 16)
    pdf.multi_cell(usable, 9, "Portefeuille de créances — fichier d'entrée")
    pdf.ln(2)
    pdf.set_font("DejaVu", "", 10)
    pdf.multi_cell(
        usable,
        5,
        "Utilisez ce document comme source d'entrée pour la démo Recouvrix "
        "(module Importation). Vous pouvez : (1) importer le CSV associé "
        "sample_creances.csv, (2) uploader ce PDF en mode PDF/IA, ou (3) "
        "ressaisir manuellement les lignes ci-dessous. Toutes les données "
        "sont fictives (PME béninoises).",
    )
    pdf.ln(3)

    pdf.set_font("DejaVu", "B", 11)
    pdf.multi_cell(usable, 7, "Champs attendus par Recouvrix")
    pdf.set_font("DejaVu", "", 9)
    for line in [
        "reference — identifiant unique de facture (ex. FAC-2026-0501)",
        "client_name — raison sociale du client",
        "client_contact — e-mail ou téléphone",
        "issue_date / due_date — format AAAA-MM-JJ",
        "amount — montant TTC en FCFA (XOF), sans séparateur de milliers",
        "currency — XOF",
    ]:
        pdf.multi_cell(usable, 5, f"• {line}")

    pdf.ln(3)
    pdf.set_font("DejaVu", "B", 11)
    pdf.multi_cell(usable, 7, "Lot à importer (5 nouvelles créances)")

    headers = ["Référence", "Client", "Contact", "Émission", "Échéance", "Montant"]
    cols = [28, 48, 42, 22, 22, 28]
    pdf.set_font("DejaVu", "B", 7)
    pdf.set_fill_color(241, 245, 249)
    for h, w in zip(headers, cols):
        pdf.cell(w, 7, h, border=1, fill=True)
    pdf.ln()

    rows = [
        ["FAC-2026-0501", "Entreprise Générale du Bénin SARL", "contact@egb-benin.bj", "2026-10-15", "2026-11-15", "1 850 000"],
        ["FAC-2026-0502", "Quincaillerie Moderne Cotonou", "achat@quincaillerie-moderne.bj", "2026-10-20", "2026-11-20", "3 200 000"],
        ["FAC-2026-0503", "Transport et Logistique Atlantique", "exploitation@tla-transit.bj", "2026-11-01", "2026-12-01", "2 450 000"],
        ["FAC-2026-0504", "Cabinet d'Études KPODEDJI", "kpodedi.etudes@gmail.com", "2026-11-05", "2026-12-05", "950 000"],
        ["FAC-2026-0505", "Boulangerie Pâtisserie La Joyeuse", "contact@lajoyeuse.bj", "2026-11-10", "2026-12-10", "680 000"],
    ]
    pdf.set_font("DejaVu", "", 6.5)
    for r in rows:
        for val, w in zip(r, cols):
            pdf.cell(w, 8, val, border=1)
        pdf.ln()

    pdf.ln(5)
    pdf.set_font("DejaVu", "B", 11)
    pdf.multi_cell(usable, 7, "Scénario démo jury (2 minutes)")
    pdf.set_font("DejaVu", "", 9)
    for step in [
        "1. Connexion gestionnaire → module Importation.",
        "2. Déposer sample_creances.csv OU ce PDF (sample_portefeuille_entree.pdf).",
        "3. Vérifier le mapping des colonnes, les doublons et les montants.",
        "4. Valider le lot → retour Tableau de bord (priorités / encours).",
        "5. Ouvrir une facture échue → préparer une relance Email/WhatsApp (validation humaine).",
    ]:
        pdf.multi_cell(usable, 5, step)

    invoices = [
        {
            "ref": "FAC-2026-0501",
            "client": "Entreprise Générale du Bénin SARL",
            "ifu_client": "3202000123456",
            "adresse": "Lot 214, Rue des Ambassades, Cotonou",
            "contact": "contact@egb-benin.bj  |  +229 01 97 11 22 33",
            "email": "contact@egb-benin.bj",
            "issue": "15/10/2026",
            "due": "15/11/2026",
            "issue_iso": "2026-10-15",
            "due_iso": "2026-11-15",
            "lines": [
                ("Prestation logistique entrepôt Q4", "1", "1 200 000", "1 200 000"),
                ("Frais de manutention et suivi", "1", "650 000", "650 000"),
            ],
            "total": "1 850 000",
            "amount_raw": "1850000",
        },
        {
            "ref": "FAC-2026-0502",
            "client": "Quincaillerie Moderne Cotonou",
            "ifu_client": "3202000987654",
            "adresse": "Avenue Steinmetz, Akpakpa, Cotonou",
            "contact": "achat@quincaillerie-moderne.bj  |  +229 01 96 44 55 66",
            "email": "achat@quincaillerie-moderne.bj",
            "issue": "20/10/2026",
            "due": "20/11/2026",
            "issue_iso": "2026-10-20",
            "due_iso": "2026-11-20",
            "lines": [
                ("Fourniture matériel chantier - lot A", "1", "2 400 000", "2 400 000"),
                ("Livraison sécurisée zone portuaire", "1", "800 000", "800 000"),
            ],
            "total": "3 200 000",
            "amount_raw": "3200000",
        },
        {
            "ref": "FAC-2026-0503",
            "client": "Transport et Logistique Atlantique",
            "ifu_client": "3202000556677",
            "adresse": "Zone Franche, Porto-Novo",
            "contact": "exploitation@tla-transit.bj  |  +229 01 95 33 44 55",
            "email": "exploitation@tla-transit.bj",
            "issue": "01/11/2026",
            "due": "01/12/2026",
            "issue_iso": "2026-11-01",
            "due_iso": "2026-12-01",
            "lines": [
                ("Affrètement camions 40T - 3 rotations", "3", "650 000", "1 950 000"),
                ("Assurance fret temporaire", "1", "500 000", "500 000"),
            ],
            "total": "2 450 000",
            "amount_raw": "2450000",
        },
    ]

    for inv in invoices:
        pdf.add_page()
        usable = pdf.epw
        pdf.set_font("DejaVu", "B", 14)
        pdf.multi_cell(usable, 8, "FACTURE COMMERCIALE (simulée)")
        pdf.set_font("DejaVu", "", 9)
        pdf.multi_cell(
            usable,
            5,
            "Émetteur : Alpha Logistique SA  ·  IFU 3201999000111  ·  Cotonou, Bénin",
        )
        pdf.multi_cell(
            usable,
            5,
            f"Mobile Money fictif : MTN +229 01 97 00 00 00  ·  Réf. à rappeler : {inv['ref']}",
        )
        pdf.ln(2)

        pdf.set_fill_color(241, 245, 249)
        pdf.set_font("DejaVu", "B", 10)
        pdf.cell(usable / 2, 8, f"N° {inv['ref']}", border=1, fill=True)
        pdf.cell(
            usable / 2,
            8,
            f"Émise le {inv['issue']}  ·  Échéance {inv['due']}",
            border=1,
            fill=True,
            new_x="LMARGIN",
            new_y="NEXT",
        )

        pdf.ln(2)
        pdf.set_font("DejaVu", "B", 10)
        pdf.multi_cell(usable, 6, "Client facturé")
        pdf.set_font("DejaVu", "", 9)
        for line in [inv["client"], f"IFU client : {inv['ifu_client']}", inv["adresse"], inv["contact"]]:
            pdf.multi_cell(usable, 5, line)
        pdf.ln(2)

        lw = [100, 20, 35, 35]
        pdf.set_font("DejaVu", "B", 8)
        pdf.set_fill_color(29, 78, 216)
        pdf.set_text_color(255, 255, 255)
        for h, w in zip(["Désignation", "Qté", "P.U. XOF", "Total XOF"], lw):
            pdf.cell(w, 7, h, border=1, fill=True)
        pdf.ln()
        pdf.set_text_color(30, 30, 30)
        pdf.set_font("DejaVu", "", 8)
        for des, qty, pu, tot in inv["lines"]:
            pdf.cell(lw[0], 7, des, border=1)
            pdf.cell(lw[1], 7, qty, border=1, align="C")
            pdf.cell(lw[2], 7, pu, border=1, align="R")
            pdf.cell(lw[3], 7, tot, border=1, align="R")
            pdf.ln()

        pdf.set_font("DejaVu", "B", 10)
        pdf.cell(155, 9, "TOTAL TTC (XOF)", border=1, align="R")
        pdf.cell(35, 9, inv["total"], border=1, align="R", new_x="LMARGIN", new_y="NEXT")

        pdf.ln(4)
        pdf.set_font("DejaVu", "B", 9)
        pdf.multi_cell(usable, 6, "Bloc machine-lisible pour extraction / saisie manuelle")
        pdf.set_font("DejaVuMono", "", 8)
        pdf.set_fill_color(248, 250, 252)
        block = (
            f"reference={inv['ref']}\n"
            f"client_name={inv['client']}\n"
            f"client_contact={inv['email']}\n"
            f"issue_date={inv['issue_iso']}\n"
            f"due_date={inv['due_iso']}\n"
            f"amount={inv['amount_raw']}\n"
            f"currency=XOF"
        )
        pdf.multi_cell(usable, 5, block, border=1, fill=True)
        pdf.ln(2)
        pdf.set_font("DejaVu", "", 8)
        pdf.set_text_color(100, 100, 100)
        pdf.multi_cell(
            usable,
            4,
            "Document fictif BWAI'2026. Paiements Mobile Money / virements exclusivement "
            "simulés. Ne pas utiliser comme pièce comptable réelle.",
        )
        pdf.set_text_color(30, 30, 30)

    pdf.add_page()
    usable = pdf.epw
    pdf.set_font("DejaVu", "B", 14)
    pdf.multi_cell(usable, 8, "Cas d'exception à saisir pendant la démo")
    pdf.set_font("DejaVu", "", 9)
    pdf.multi_cell(
        usable,
        5,
        "Ces lignes ne sont pas dans le CSV d'import. Utilisez-les pour montrer litige, "
        "promesse de paiement et seuil de validation humaine.",
    )
    pdf.ln(3)

    exceptions = [
        (
            "Litige livraison",
            "FAC-2026-0418 (déjà en base démo)",
            "Client SOGECOT conteste quantité livrée — suspendre relance jusqu'à instruction.",
        ),
        (
            "Gros montant",
            "FAC-2026-0502",
            "3 200 000 XOF > seuil 2 000 000 → validation humaine obligatoire avant envoi.",
        ),
        (
            "Promesse échue",
            "FAC-2026-0501",
            "Client a promis règlement le 10/11/2026 — non honorée → prioriser.",
        ),
        (
            "Paiement partiel simulé",
            "FAC-2026-0503",
            "Reçu MTN 850 000 XOF — solde restant 1 600 000 XOF.",
        ),
    ]
    pdf.set_font("DejaVu", "B", 8)
    pdf.set_fill_color(241, 245, 249)
    for h, w in zip(["Type", "Référence", "Action démo"], [35, 55, 100]):
        pdf.cell(w, 7, h, border=1, fill=True)
    pdf.ln()

    pdf.set_font("DejaVu", "", 7.5)
    for t, ref, action in exceptions:
        y = pdf.get_y()
        x = pdf.l_margin
        row_h = 16
        pdf.rect(x, y, 35, row_h)
        pdf.rect(x + 35, y, 55, row_h)
        pdf.rect(x + 90, y, 100, row_h)
        pdf.set_xy(x + 1, y + 2)
        pdf.multi_cell(33, 4, t)
        pdf.set_xy(x + 36, y + 2)
        pdf.multi_cell(53, 4, ref)
        pdf.set_xy(x + 91, y + 2)
        pdf.multi_cell(98, 4, action)
        pdf.set_xy(x, y + row_h)

    pdf.ln(8)
    pdf.set_font("DejaVu", "B", 11)
    pdf.multi_cell(usable, 7, "Fichiers compagnons")
    pdf.set_font("DejaVu", "", 9)
    pdf.multi_cell(
        usable,
        5,
        "• public/sample_creances.csv — import tabulaire (recommandé pour le parcours principal)\n"
        "• public/sample_portefeuille_entree.pdf — ce document (PDF + factures + cas d'exception)\n"
        "• docs/EXEMPLE_DONNE_TEST.md — scénario pas à pas",
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUT))
    ART.parent.mkdir(parents=True, exist_ok=True)
    ART.write_bytes(OUT.read_bytes())
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")
    print(f"Artifact {ART}")


if __name__ == "__main__":
    main()
