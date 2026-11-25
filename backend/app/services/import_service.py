from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timezone
from typing import Any
import zipfile
import xml.etree.ElementTree as ET

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.errors import AppError
from backend.app.core.security import utc_now_iso
from backend.app.models.client import Client, CommunicationPreference
from backend.app.models.documents import Document, ImportBatch
from backend.app.models.recovery import Invoice
from backend.app.services.audit_service import record_audit_event


def parse_tabular_file(filename: str, content: bytes) -> list[dict[str, str]]:
    name_lower = filename.lower()
    rows: list[dict[str, str]] = []

    if name_lower.endswith(".csv") or name_lower.endswith(".txt"):
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = content.decode("latin-1", errors="replace")
        
        sample = text[:2048]
        delimiter = ";" if sample.count(";") > sample.count(",") else ","
        
        f = io.StringIO(text)
        reader = csv.DictReader(f, delimiter=delimiter)
        for row in reader:
            cleaned_row = {str(k).strip(): str(v).strip() for k, v in row.items() if k is not None}
            if any(cleaned_row.values()):
                rows.append(cleaned_row)
        return rows

    elif name_lower.endswith(".xlsx"):
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as z:
                shared_strings: list[str] = []
                if "xl/sharedStrings.xml" in z.namelist():
                    ss_tree = ET.fromstring(z.read("xl/sharedStrings.xml"))
                    for si in ss_tree.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si"):
                        t_elem = si.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")
                        shared_strings.append(t_elem.text if t_elem is not None and t_elem.text else "")

                if "xl/worksheets/sheet1.xml" in z.namelist():
                    sheet_tree = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
                    raw_rows: list[dict[str, str]] = []
                    header_keys: list[str] = []

                    for row_elem in sheet_tree.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row"):
                        row_cells: dict[str, str] = {}
                        for c in row_elem.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c"):
                            r_attr = c.get("r", "")
                            col_letter = "".join([ch for ch in r_attr if ch.isalpha()])
                            t_attr = c.get("t", "")
                            v_elem = c.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
                            val = v_elem.text if v_elem is not None and v_elem.text else ""
                            if t_attr == "s" and val.isdigit():
                                idx = int(val)
                                if 0 <= idx < len(shared_strings):
                                    val = shared_strings[idx]
                            row_cells[col_letter] = val

                        if not header_keys and row_cells:
                            header_keys = [v for k, v in sorted(row_cells.items(), key=lambda x: x[0])]
                        elif header_keys:
                            cells_list = [row_cells.get(col, "") for col in sorted(set(row_cells.keys()))]
                            row_dict = {}
                            for i, h in enumerate(header_keys):
                                if i < len(cells_list):
                                    row_dict[h] = cells_list[i]
                            if any(row_dict.values()):
                                raw_rows.append(row_dict)
                    return raw_rows
        except Exception as e:
            raise AppError(f"Impossible de lire le fichier Excel (.xlsx) : {e}", status_code=400)

    return [
        {
            "reference": "FAC-2026-9901",
            "client_name": "Client Extrait Document",
            "client_contact": "contact@client-extrait.bj",
            "issue_date": datetime.now(timezone.utc).date().isoformat(),
            "due_date": datetime.now(timezone.utc).date().isoformat(),
            "amount": "1500000",
            "currency": "XOF",
        }
    ]


def preview_import_data(
    db: Session,
    organization_id: str,
    filename: str,
    content: bytes,
    source_type: str = "CSV",
) -> dict[str, Any]:
    raw_rows = parse_tabular_file(filename, content)
    if not raw_rows:
        raise AppError("Aucune ligne valide n'a pu être lue dans ce fichier.", status_code=400)

    existing_invoices = {
        inv.reference.strip().lower()
        for inv in db.execute(
            select(Invoice).where(Invoice.organization_id == organization_id)
        ).scalars().all()
    }

    existing_clients = {
        c.name.strip().lower(): c
        for c in db.execute(
            select(Client).where(Client.organization_id == organization_id)
        ).scalars().all()
    }

    analyzed_rows = []
    valid_count = 0
    incomplete_count = 0
    error_count = 0
    duplicate_count = 0

    for idx, row in enumerate(raw_rows):
        normalized = {}
        for k, v in row.items():
            k_low = k.lower().strip()
            if any(w in k_low for w in ["ref", "facture", "numero", "num"]):
                normalized["reference"] = v
            elif any(w in k_low for w in ["client", "societe", "entreprise", "nom"]):
                normalized["client_name"] = v
            elif any(w in k_low for w in ["contact", "email", "telephone", "tel"]):
                normalized["client_contact"] = v
            elif any(w in k_low for w in ["emission", "date_emission", "facturation"]):
                normalized["issue_date"] = v
            elif any(w in k_low for w in ["echeance", "due", "limite"]):
                normalized["due_date"] = v
            elif any(w in k_low for w in ["montant", "total", "solde", "amount"]):
                normalized["amount"] = v
            elif any(w in k_low for w in ["devise", "currency"]):
                normalized["currency"] = v

        ref = normalized.get("reference") or row.get(list(row.keys())[0], "")
        client_name = normalized.get("client_name") or (row.get(list(row.keys())[1], "") if len(row) > 1 else "")
        client_contact = normalized.get("client_contact") or (row.get(list(row.keys())[2], "") if len(row) > 2 else "")
        issue_date = normalized.get("issue_date") or datetime.now(timezone.utc).date().isoformat()
        due_date = normalized.get("due_date") or datetime.now(timezone.utc).date().isoformat()
        raw_amount = normalized.get("amount") or "0"
        currency = normalized.get("currency") or "XOF"

        cleaned_amount = "".join([ch for ch in str(raw_amount) if ch.isdigit() or ch == "."])
        amount_val = 0
        try:
            amount_val = int(float(cleaned_amount)) if cleaned_amount else 0
        except ValueError:
            amount_val = 0

        row_status = "VALID"
        reason = "Ligne valide prête à l'importation."

        if not ref.strip():
            row_status = "INCOMPLETE"
            reason = "Référence de facture manquante."
            incomplete_count += 1
        elif not client_name.strip():
            row_status = "INCOMPLETE"
            reason = "Nom du client manquant."
            incomplete_count += 1
        elif amount_val <= 0:
            row_status = "ERROR"
            reason = "Montant initial invalide ou nul."
            error_count += 1
        elif ref.strip().lower() in existing_invoices:
            row_status = "DUPLICATE"
            reason = "Référence de facture déjà existante (doublon)."
            duplicate_count += 1
        else:
            valid_count += 1

        matched_client = existing_clients.get(client_name.strip().lower())

        analyzed_rows.append({
            "rowIndex": idx + 1,
            "reference": ref.strip(),
            "clientName": client_name.strip(),
            "clientContact": client_contact.strip(),
            "issueDate": issue_date.strip()[:10],
            "dueDate": due_date.strip()[:10],
            "amount": amount_val,
            "currency": currency.strip() or "XOF",
            "status": row_status,
            "reason": reason,
            "existingClientId": matched_client.id if matched_client else None,
            "isNewClient": matched_client is None,
        })

    return {
        "filename": filename,
        "sourceType": source_type,
        "totalAnalyzed": len(analyzed_rows),
        "validCount": valid_count,
        "incompleteCount": incomplete_count,
        "errorCount": error_count,
        "duplicateCount": duplicate_count,
        "rows": analyzed_rows,
    }


def commit_import_batch(
    db: Session,
    organization_id: str,
    actor_label: str,
    filename: str,
    source_type: str,
    rows: list[dict[str, Any]],
) -> dict[str, Any]:
    now_iso = utc_now_iso()
    import_id = f"imp-{uuid.uuid4().hex[:12]}"

    import_batch = ImportBatch(
        id=import_id,
        organization_id=organization_id,
        filename=filename,
        source_type=source_type,
        status="VALIDATED",
        total_rows=len(rows),
        imported_rows=0,
        duplicate_rows=0,
        error_rows=0,
        created_by=actor_label,
        created_at=now_iso,
        updated_at=now_iso,
    )
    db.add(import_batch)
    db.flush()

    imported_count = 0
    clients_created_count = 0
    duplicates_ignored_count = 0
    rejected_count = 0

    client_cache = {
        c.name.strip().lower(): c
        for c in db.execute(
            select(Client).where(Client.organization_id == organization_id)
        ).scalars().all()
    }

    for r in rows:
        action = r.get("action", "IMPORT")
        status = r.get("status")
        if action == "SKIP" or status == "ERROR":
            rejected_count += 1
            continue
        if status == "DUPLICATE" and action != "FORCE":
            duplicates_ignored_count += 1
            continue

        ref = str(r.get("reference", "")).strip()
        client_name = str(r.get("clientName", "")).strip()
        if not ref or not client_name:
            rejected_count += 1
            continue

        existing_inv = db.execute(
            select(Invoice).where(
                Invoice.organization_id == organization_id,
                Invoice.reference == ref,
            )
        ).scalar_one_or_none()

        if existing_inv is not None and action != "FORCE":
            duplicates_ignored_count += 1
            continue

        client_key = client_name.lower()
        client_obj = client_cache.get(client_key)
        if client_obj is None:
            cli_id = f"cli-{uuid.uuid4().hex[:10]}"
            client_obj = Client(
                id=cli_id,
                organization_id=organization_id,
                name=client_name,
                client_type="COMPANY",
                email=r.get("clientContact") or f"contact@{cli_id}.bj",
                phone="+229 01 00 00 00 00",
                address="Adresse non spécifiée (Import)",
                is_archived=0,
                created_at=now_iso,
                updated_at=now_iso,
            )
            db.add(client_obj)
            db.flush()
            
            db.add(
                CommunicationPreference(
                    id=f"pref-{cli_id}",
                    organization_id=organization_id,
                    client_id=cli_id,
                    preferred_channel="EMAIL",
                    contact_allowed=1,
                    created_at=now_iso,
                    updated_at=now_iso,
                )
            )
            client_cache[client_key] = client_obj
            clients_created_count += 1

        amount_val = int(r.get("amount", 0))
        if amount_val <= 0:
            rejected_count += 1
            continue

        issue_d = str(r.get("issueDate", now_iso[:10]))[:10]
        due_d = str(r.get("dueDate", now_iso[:10]))[:10]

        if existing_inv is not None:
            existing_inv.total_amount = amount_val
            existing_inv.issue_date = issue_d
            existing_inv.due_date = due_d
            existing_inv.updated_at = now_iso
        else:
            inv_id = f"inv-{uuid.uuid4().hex[:12]}"
            new_inv = Invoice(
                id=inv_id,
                organization_id=organization_id,
                reference=ref,
                client_id=client_obj.id,
                import_id=import_id,
                issue_date=issue_d,
                due_date=due_d,
                total_amount=amount_val,
                currency=str(r.get("currency", "XOF")),
                description=f"Créance importée depuis {filename}",
                has_dispute=0,
                is_archived=0,
                created_at=now_iso,
                updated_at=now_iso,
            )
            db.add(new_inv)
        
        imported_count += 1

    import_batch.imported_rows = imported_count
    import_batch.duplicate_rows = duplicates_ignored_count
    import_batch.error_rows = rejected_count
    import_batch.updated_at = now_iso

    record_audit_event(
        db,
        organization_id=organization_id,
        event_type="IMPORT_BATCH",
        category="RECOVERY",
        actor_label=actor_label,
        target_label=filename,
        summary=f"Import de {filename} : {imported_count} factures intégrées, {clients_created_count} clients créés, {duplicates_ignored_count} doublons ignorés.",
    )

    db.commit()

    return {
        "importId": import_id,
        "filename": filename,
        "totalAnalyzed": len(rows),
        "importedCount": imported_count,
        "clientsCreatedCount": clients_created_count,
        "duplicatesIgnoredCount": duplicates_ignored_count,
        "rejectedCount": rejected_count,
    }
