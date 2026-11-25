from __future__ import annotations

import sqlite3
from pathlib import Path
import time

from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app.core.database import build_engine
from backend.app.core.migrations import run_alembic_upgrade
from backend.app.core.security import hash_password, utc_now_iso
from backend.app.main import create_app
from backend.app.models.organization import Organization
from backend.app.models.user import User


def _make_client(
    tmp_path: Path,
    *,
    db_name: str = "test_recouvrix.sqlite",
    session_ttl_seconds: int = 3600,
    simulate_ai_unavailable: bool = True,
    reference_date_override: str = "2026-11-25",
):
    db_file = tmp_path / db_name
    engine = build_engine(f"sqlite:///{db_file}")
    app = create_app(
        engine_override=engine,
        session_ttl_seconds=session_ttl_seconds,
        simulate_ai_unavailable=simulate_ai_unavailable,
        reference_date_override=reference_date_override,
    )
    return app, engine, db_file


def _bootstrap_and_login(client: TestClient) -> tuple[str, str]:
    boot = client.post(
        "/api/auth/bootstrap",
        json={"adminPassword": "AdminPass2026", "managerPassword": "ManagerPass2026"},
    )
    assert boot.status_code == 201, boot.text

    admin_login = client.post(
        "/api/auth/login",
        json={"email": "admin@recouvrix.demo", "password": "AdminPass2026"},
    )
    assert admin_login.status_code == 200
    manager_login = client.post(
        "/api/auth/login",
        json={"email": "gestionnaire@recouvrix.demo", "password": "ManagerPass2026"},
    )
    assert manager_login.status_code == 200
    return admin_login.json()["token"], manager_login.json()["token"]


def test_brownfield_migration_preserves_existing_data_and_passwords(tmp_path: Path) -> None:
    db_file = tmp_path / "legacy_node.sqlite"
    conn = sqlite3.connect(str(db_file))
    # Simule une base créée par les prompts 03-04 avant FastAPI/Alembic
    conn.executescript(
        """
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          full_name TEXT NOT NULL,
          role TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          is_demo INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_login_at TEXT
        );
        CREATE TABLE clients (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          contact_name TEXT,
          email TEXT,
          phone TEXT,
          preferred_channel TEXT NOT NULL DEFAULT 'EMAIL',
          created_at TEXT NOT NULL
        );
        CREATE TABLE invoices (
          id TEXT PRIMARY KEY,
          reference TEXT NOT NULL UNIQUE,
          client_id TEXT NOT NULL,
          issue_date TEXT NOT NULL,
          due_date TEXT NOT NULL,
          total_amount INTEGER NOT NULL,
          has_dispute INTEGER NOT NULL DEFAULT 0,
          dispute_reason TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE payments (
          id TEXT PRIMARY KEY,
          reference TEXT NOT NULL UNIQUE,
          invoice_id TEXT NOT NULL,
          client_id TEXT NOT NULL,
          amount INTEGER NOT NULL,
          status TEXT NOT NULL,
          payment_method TEXT,
          declared_at TEXT NOT NULL,
          confirmed_at TEXT,
          created_by TEXT
        );
        CREATE TABLE promises_to_pay (
          id TEXT PRIMARY KEY,
          invoice_id TEXT NOT NULL,
          client_id TEXT NOT NULL,
          promised_amount INTEGER NOT NULL,
          promised_date TEXT NOT NULL,
          status TEXT NOT NULL,
          note TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE reminders (
          id TEXT PRIMARY KEY,
          invoice_id TEXT NOT NULL,
          client_id TEXT NOT NULL,
          channel TEXT NOT NULL,
          status TEXT NOT NULL,
          scheduled_for TEXT NOT NULL,
          subject TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE activity_logs (
          id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'SECURITY',
          actor_user_id TEXT,
          actor_label TEXT NOT NULL,
          target_user_id TEXT,
          target_label TEXT,
          summary TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        """
    )
    pw_hash = hash_password("LegacyPass2026")
    conn.execute(
        "INSERT INTO users VALUES ('u-legacy', 'legacy@recouvrix.demo', 'Legacy Manager', 'MANAGER', ?, 1, 0, '2026-11-01T10:00:00Z', '2026-11-01T10:00:00Z', NULL)",
        (pw_hash,),
    )
    conn.execute(
        "INSERT INTO clients VALUES ('cli-leg', 'Entreprise Héritée SA', 'Jean Kpovi', 'jean@heritee.bj', '+229 01 90 00 00 01', 'WHATSAPP', '2026-11-01T10:00:00Z')"
    )
    conn.execute(
        "INSERT INTO invoices VALUES ('inv-leg', 'FAC-LEG-01', 'cli-leg', '2026-10-01', '2026-11-01', 1500000, 1, 'Facture contestée', '2026-10-01T00:00:00Z')"
    )
    conn.execute(
        "INSERT INTO payments VALUES ('pay-leg', 'PAY-LEG-01', 'inv-leg', 'cli-leg', 500000, 'CONFIRMED', 'Virement', '2026-11-05T10:00:00Z', '2026-11-06T10:00:00Z', 'legacy@recouvrix.demo')"
    )
    conn.commit()
    conn.close()

    engine = build_engine(f"sqlite:///{db_file}")
    app = create_app(engine_override=engine, simulate_ai_unavailable=True, reference_date_override="2026-11-25")
    with TestClient(app) as client:
        # L'utilisateur migré peut se connecter avec son ancien mot de passe scrypt
        login_res = client.post(
            "/api/auth/login",
            json={"email": "legacy@recouvrix.demo", "password": "LegacyPass2026"},
        )
        assert login_res.status_code == 200, login_res.text
        token = login_res.json()["token"]

        # Ses clients, factures, paiements, préférences et litiges sont conservés et backfillés
        detail = client.get("/api/clients/cli-leg", headers={"Authorization": f"Bearer {token}"})
        assert detail.status_code == 200, detail.text
        body = detail.json()
        assert body["name"] == "Entreprise Héritée SA"
        assert body["communicationPreferences"]["preferredChannel"] == "WHATSAPP"
        assert body["financial"]["totalBilled"] == 1500000
        assert body["financial"]["totalPaidConfirmed"] == 500000
        assert body["financial"]["remainingAmount"] == 1000000
        assert body["financial"]["globalStatus"] == "DISPUTE"
        assert len(body["disputes"]) == 1
    engine.dispose()


def test_clients_crud_financials_search_archive_and_persistence(tmp_path: Path) -> None:
    app, engine, db_file = _make_client(tmp_path)
    with TestClient(app) as client:
        admin_token, manager_token = _bootstrap_and_login(client)
        headers = {"Authorization": f"Bearer {manager_token}"}

        # 1. Liste initiale issue des données de démonstration
        res_list = client.get("/api/clients", headers=headers)
        assert res_list.status_code == 200
        list_data = res_list.json()
        assert list_data["total"] == 6

        # Vérifie que les paiements non confirmés ne réduisent pas le solde dû (cli-2: 1 850 000 FCFA, paiement RECEIPT_RECEIVED de 850 000 non déduit)
        cli2 = client.get("/api/clients/cli-2", headers=headers).json()
        assert cli2["financial"]["totalBilled"] == 1850000
        assert cli2["financial"]["totalPaidConfirmed"] == 0
        assert cli2["financial"]["remainingAmount"] == 1850000
        assert cli2["financial"]["pendingVerificationAmount"] == 850000
        assert cli2["financial"]["globalStatus"] == "OVERDUE"

        # 2. Création d'un nouveau client
        create_res = client.post(
            "/api/clients",
            headers=headers,
            json={
                "name": "Bénin Logistique Plus",
                "clientType": "COMPANY",
                "taxId": "IFU 3202210009911",
                "address": "Cadjèhoun, Cotonou",
                "contactName": "Hervé Dossou",
                "email": "compta@beninlogistique.bj",
                "phone": "+229 01 97 00 11 22",
                "secondaryContact": "Direction · +229 01 97 00 11 23",
                "communicationPreferences": {
                    "preferredChannel": "WHATSAPP",
                    "contactAllowed": True,
                    "contactHours": "Lun–Ven 08h30–16h30",
                    "restrictionsNote": "Envoyer les relevés en PDF.",
                },
            },
        )
        assert create_res.status_code == 201, create_res.text
        created = create_res.json()
        new_id = created["id"]
        assert created["name"] == "Bénin Logistique Plus"
        assert created["communicationPreferences"]["preferredChannel"] == "WHATSAPP"
        assert any(h["eventType"] == "CLIENT_CREATED" for h in created["history"])

        # Prévention des doublons
        dup_res = client.post(
            "/api/clients",
            headers=headers,
            json={"name": "  bénin logistique plus ", "clientType": "COMPANY"},
        )
        assert dup_res.status_code == 409

        # 3. Modification (coordonnées + préférences) et traçabilité
        patch_res = client.patch(
            f"/api/clients/{new_id}",
            headers=headers,
            json={
                "phone": "+229 01 96 99 88 77",
                "communicationPreferences": {
                    "preferredChannel": "EMAIL",
                    "contactAllowed": False,
                    "contactHours": "Matin uniquement",
                    "restrictionsNote": "Ne plus contacter par téléphone.",
                },
            },
        )
        assert patch_res.status_code == 200
        updated = patch_res.json()
        assert updated["phone"] == "+229 01 96 99 88 77"
        assert updated["communicationPreferences"]["preferredChannel"] == "EMAIL"
        assert updated["communicationPreferences"]["contactAllowed"] is False
        events = [h["eventType"] for h in updated["history"]]
        assert "CLIENT_CONTACT_UPDATED" in events
        assert "CLIENT_PREFERENCES_UPDATED" in events

        # 4. Recherche, filtrage et pagination
        search_res = client.get("/api/clients?search=Logistique", headers=headers)
        assert search_res.status_code == 200
        assert search_res.json()["total"] == 1

        dispute_res = client.get("/api/clients?status=DISPUTE", headers=headers)
        assert dispute_res.status_code == 200
        assert dispute_res.json()["total"] == 1
        assert dispute_res.json()["items"][0]["id"] == "cli-3"

        page_res = client.get("/api/clients?page=1&page_size=3", headers=headers)
        assert page_res.status_code == 200
        assert len(page_res.json()["items"]) == 3
        assert page_res.json()["totalPages"] >= 3

        # 5. Archivage d'un client possédant factures, paiements et historique (cli-4) -> tout est conservé
        arch_res = client.post("/api/clients/cli-4/archive", headers=headers)
        assert arch_res.status_code == 200
        archived_cli4 = arch_res.json()
        assert archived_cli4["isArchived"] is True
        assert archived_cli4["financial"]["globalStatus"] == "ARCHIVED"
        assert archived_cli4["financial"]["invoicesCount"] == 1
        assert archived_cli4["financial"]["totalPaidConfirmed"] == 1200000
        assert archived_cli4["financial"]["remainingAmount"] == 1800000
        assert any(h["eventType"] == "CLIENT_ARCHIVED" for h in archived_cli4["history"])

        # Hors liste active par défaut, visible dans le filtre ARCHIVED
        active_list = client.get("/api/clients", headers=headers).json()
        assert all(item["id"] != "cli-4" for item in active_list["items"])
        archived_list = client.get("/api/clients?status=ARCHIVED", headers=headers).json()
        assert any(item["id"] == "cli-4" for item in archived_list["items"])

        # Restauration
        rest_res = client.post("/api/clients/cli-4/restore", headers=headers)
        assert rest_res.status_code == 200
        assert rest_res.json()["isArchived"] is False

        # Contrôle d'autorisation : Gestionnaire bloqué sur /api/admin/users
        forbidden = client.get("/api/admin/users", headers=headers)
        assert forbidden.status_code == 403
        unauth = client.get("/api/clients")
        assert unauth.status_code == 401

        # Vérifie l'isolation Admin sur les logs (adminToken fonctionne)
        logs_res = client.get("/api/workspace/activity-logs", headers={"Authorization": f"Bearer {admin_token}"})
        assert logs_res.status_code == 200

    # 6. Persistance après redémarrage du moteur et de l'application FastAPI
    engine.dispose()
    restarted_engine = build_engine(f"sqlite:///{db_file}")
    restarted_app = create_app(engine_override=restarted_engine, simulate_ai_unavailable=True)
    with TestClient(restarted_app) as client2:
        login2 = client2.post(
            "/api/auth/login",
            json={"email": "gestionnaire@recouvrix.demo", "password": "ManagerPass2026"},
        )
        assert login2.status_code == 200
        tok2 = login2.json()["token"]
        persisted = client2.get("/api/clients?search=Logistique", headers={"Authorization": f"Bearer {tok2}"})
        assert persisted.status_code == 200
        assert persisted.json()["total"] == 1
        assert persisted.json()["items"][0]["name"] == "Bénin Logistique Plus"
    restarted_engine.dispose()


def test_organization_data_isolation_and_session_expiry(tmp_path: Path) -> None:
    app, engine, _ = _make_client(tmp_path, session_ttl_seconds=1)
    with TestClient(app) as client:
        _, manager_token = _bootstrap_and_login(client)

        # Crée un client dans org-default
        c1 = client.post(
            "/api/clients",
            headers={"Authorization": f"Bearer {manager_token}"},
            json={"name": "Client Organisation A", "clientType": "COMPANY"},
        )
        assert c1.status_code == 201
        org_a_client_id = c1.json()["id"]

        # Crée une deuxième organisation et un utilisateur rattaché directement en base
        from sqlalchemy.orm import sessionmaker

        SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
        with SessionLocal() as db:
            now = utc_now_iso()
            db.add(
                Organization(
                    id="org-b",
                    name="Organisation B",
                    slug="org-b",
                    currency="XOF",
                    default_payment_terms_days=30,
                    created_at=now,
                    updated_at=now,
                )
            )
            db.add(
                User(
                    id="user-org-b",
                    organization_id="org-b",
                    email="manager@org-b.bj",
                    full_name="Gestionnaire B",
                    role="MANAGER",
                    password_hash=hash_password("OrgBPass2026"),
                    is_active=1,
                    is_demo=0,
                    created_at=now,
                    updated_at=now,
                )
            )
            db.commit()

        login_b = client.post(
            "/api/auth/login",
            json={"email": "manager@org-b.bj", "password": "OrgBPass2026"},
        )
        assert login_b.status_code == 200
        token_b = login_b.json()["token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # L'organisation B ne voit aucun client de l'organisation A
        list_b = client.get("/api/clients", headers=headers_b)
        assert list_b.status_code == 200
        assert list_b.json()["total"] == 0

        # L'organisation B ne peut ni consulter, ni modifier, ni archiver le client de l'organisation A
        assert client.get(f"/api/clients/{org_a_client_id}", headers=headers_b).status_code == 404
        assert (
            client.patch(
                f"/api/clients/{org_a_client_id}",
                headers=headers_b,
                json={"name": "Tentative piratage"},
            ).status_code
            == 404
        )
        assert client.post(f"/api/clients/{org_a_client_id}/archive", headers=headers_b).status_code == 404

        # Vérifie l'expiration de session (TTL 1s)
        time.sleep(1.2)
        expired = client.get("/api/clients", headers=headers_b)
        assert expired.status_code == 401
    engine.dispose()


def test_dashboard_metrics_and_demo_lifecycle(tmp_path: Path) -> None:
    app, engine, _ = _make_client(tmp_path)
    with TestClient(app) as client:
        admin_token, manager_token = _bootstrap_and_login(client)
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        manager_headers = {"Authorization": f"Bearer {manager_token}"}

        # Tableau de bord gestionnaire avec données de démo
        dash_res = client.get("/api/dashboard?period=30", headers=manager_headers)
        assert dash_res.status_code == 200, dash_res.text
        dash = dash_res.json()
        assert dash["metrics"]["isEmpty"] is False
        assert dash["metrics"]["kpis"]["totalOpenReceivables"] > 0
        assert len(dash["metrics"]["priorities"]) >= 1
        assert dash["aiAdvisory"]["status"] == "unavailable"

        # Vue d'ensemble workspace
        ov_res = client.get("/api/workspace/overview", headers=admin_headers)
        assert ov_res.status_code == 200
        assert ov_res.json()["summary"]["activeUsers"] == 2

        # Gestionnaire ne peut pas vider la base de démo (réservé Admin)
        assert client.post("/api/demo/clear", headers=manager_headers).status_code == 403

        # Admin vide la base métier puis vérifie l'état vide
        clear_res = client.post("/api/demo/clear", headers=admin_headers)
        assert clear_res.status_code == 200
        empty_dash = client.get("/api/dashboard?period=7", headers=admin_headers).json()
        assert empty_dash["metrics"]["isEmpty"] is True
        assert client.get("/api/clients", headers=manager_headers).json()["total"] == 0

        # Admin réinjecte le portefeuille de présentation
        seed_res = client.post("/api/demo/seed", headers=admin_headers)
        assert seed_res.status_code == 200
        seeded_clients = client.get("/api/clients", headers=manager_headers).json()
        assert seeded_clients["total"] == 6
    engine.dispose()


def test_invoices_financial_statuses_and_dashboard_consistency(tmp_path: Path) -> None:
    """Cas 1, 2, 3, 4, 7, 11 + cohérence stricte Tableau de bord <-> Liste des factures."""
    app, engine, _ = _make_client(tmp_path, reference_date_override="2026-11-25")
    with TestClient(app) as client:
        _, manager_token = _bootstrap_and_login(client)
        headers = {"Authorization": f"Bearer {manager_token}"}

        inv_list_res = client.get("/api/invoices?page_size=50", headers=headers)
        assert inv_list_res.status_code == 200, inv_list_res.text
        inv_list = inv_list_res.json()
        by_id = {item["id"]: item for item in inv_list["items"]}

        # Cas 1 : facture non échue sans paiement (inv-6) -> UPCOMING, retard = 0
        inv6 = by_id["inv-6"]
        assert inv6["status"] == "UPCOMING"
        assert inv6["delayDays"] == 0
        assert inv6["confirmedPaidAmount"] == 0
        assert inv6["remainingAmount"] == 1650000

        # Cas 2 : facture échue sans paiement confirmé (inv-2, paiement RECEIPT_RECEIVED non déduit -> Cas 7)
        inv2 = by_id["inv-2"]
        assert inv2["status"] == "OVERDUE"
        assert inv2["delayDays"] > 0
        assert inv2["confirmedPaidAmount"] == 0
        assert inv2["pendingVerificationAmount"] == 850000
        assert inv2["remainingAmount"] == 1850000

        # Cas 3 : facture partiellement payée échue (inv-3) -> statut OVERDUE prioritaire + isPartiallyPaid = True
        inv3 = by_id["inv-3"]
        assert inv3["status"] == "OVERDUE"
        assert inv3["isOverdue"] is True
        assert inv3["isPartiallyPaid"] is True
        assert inv3["confirmedPaidAmount"] == 1200000
        assert inv3["remainingAmount"] == 1800000

        # Cas 4 & 11 : factures soldées (inv-7, inv-8 -> solde = 0, retard = 0, exclues des créances ouvertes)
        inv7 = by_id["inv-7"]
        assert inv7["status"] == "PAID"
        assert inv7["remainingAmount"] == 0
        assert inv7["delayDays"] == 0
        assert by_id["inv-8"]["status"] == "PAID"
        open_res = client.get("/api/invoices?status=OPEN&page_size=50", headers=headers).json()
        assert all(i["id"] not in ("inv-7", "inv-8") for i in open_res["items"])

        # Cohérence totale entre /api/dashboard et /api/invoices
        dash = client.get("/api/dashboard?period=30", headers=headers).json()
        assert dash["metrics"]["kpis"]["totalOpenReceivables"] == inv_list["summary"]["totalOpenAmount"]
        assert dash["metrics"]["kpis"]["overdueReceivables"] == inv_list["summary"]["totalOverdueAmount"]
        assert dash["metrics"]["counts"]["openInvoicesCount"] == inv_list["summary"]["openCount"]
        assert dash["metrics"]["counts"]["overdueInvoicesCount"] == inv_list["summary"]["overdueCount"]

        # Vérification des métadonnées non financières et archivage/restauration
        patch_meta = client.patch(
            "/api/invoices/inv-6",
            headers=headers,
            json={"description": "Contrat annuel approvisionnement Akpakpa"},
        )
        assert patch_meta.status_code == 200
        assert patch_meta.json()["description"] == "Contrat annuel approvisionnement Akpakpa"

        arch = client.post("/api/invoices/inv-6/archive", headers=headers)
        assert arch.status_code == 200
        assert arch.json()["isArchived"] is True
        active_after_arch = client.get("/api/invoices?page_size=50", headers=headers).json()
        assert all(i["id"] != "inv-6" for i in active_after_arch["items"])

        rest = client.post("/api/invoices/inv-6/restore", headers=headers)
        assert rest.status_code == 200
        assert rest.json()["isArchived"] is False
    engine.dispose()


def test_disputes_promises_credit_notes_and_idempotency(tmp_path: Path) -> None:
    """Cas 5, 6, 10, 12 + Idempotency-Key + aucune relance auto à la clôture d'un litige."""
    app, engine, _ = _make_client(tmp_path, reference_date_override="2026-11-25")
    with TestClient(app) as client:
        _, manager_token = _bootstrap_and_login(client)
        headers = {"Authorization": f"Bearer {manager_token}"}

        # Cas 5 : ouverture d'un litige sur inv-6 (idempotente), passage en instruction puis clôture
        detail_before = client.get("/api/invoices/inv-6", headers=headers).json()
        reminders_before = len(detail_before["reminders"])

        disp_headers = {**headers, "Idempotency-Key": "idem-disp-1"}
        d1 = client.post(
            "/api/invoices/inv-6/disputes",
            headers=disp_headers,
            json={"category": "PRICING_ERROR", "reason": "Remise contractuelle omise sur ligne 2"},
        )
        assert d1.status_code == 201, d1.text
        d1_replay = client.post(
            "/api/invoices/inv-6/disputes",
            headers=disp_headers,
            json={"category": "PRICING_ERROR", "reason": "Remise contractuelle omise sur ligne 2"},
        )
        assert d1_replay.status_code == 201
        assert len(d1_replay.json()["disputes"]) == 1
        assert d1.json()["status"] == "DISPUTE"
        assert d1.json()["remindersSuspended"] is True

        dispute_id = d1.json()["disputes"][0]["id"]
        d_review = client.patch(
            f"/api/invoices/inv-6/disputes/{dispute_id}",
            headers=headers,
            json={"status": "IN_REVIEW"},
        )
        assert d_review.status_code == 200
        assert d_review.json()["status"] == "DISPUTE"

        d_close = client.patch(
            f"/api/invoices/inv-6/disputes/{dispute_id}",
            headers=headers,
            json={"status": "RESOLVED", "resolutionNote": "Avoir émis en accord avec le client"},
        )
        assert d_close.status_code == 200
        closed_json = d_close.json()
        assert closed_json["hasDispute"] is False
        assert closed_json["remindersSuspended"] is False
        # Aucune relance automatique ne doit être créée lors de la clôture du litige
        assert len(closed_json["reminders"]) == reminders_before

        # Cas 6 : promesse partielle + alerte promesse dépassée + KEPT ne solde jamais la facture
        p_headers = {**headers, "Idempotency-Key": "idem-promise-1"}
        p1 = client.post(
            "/api/invoices/inv-6/promises",
            headers=p_headers,
            json={
                "promisedAmount": 400000,
                "promisedDate": "2026-11-20",
                "note": "Promesse de virement bancaire",
            },
        )
        assert p1.status_code == 201, p1.text
        p1_replay = client.post(
            "/api/invoices/inv-6/promises",
            headers=p_headers,
            json={"promisedAmount": 400000, "promisedDate": "2026-11-20"},
        )
        assert p1_replay.status_code == 201
        assert len(p1_replay.json()["promises"]) == 1

        p1_json = p1.json()
        # Promesse antérieure au 2026-11-25 sans règlement -> isOverdue = True et solde inchangé (1 650 000)
        assert p1_json["remainingAmount"] == 1650000
        assert p1_json["promises"][0]["isOverdue"] is True
        assert p1_json["status"] == "PROMISE"

        promise_id = p1_json["promises"][0]["id"]
        p_kept = client.patch(
            f"/api/invoices/inv-6/promises/{promise_id}",
            headers=headers,
            json={"status": "KEPT", "note": "Client affirme avoir exécuté l'ordre"},
        )
        assert p_kept.status_code == 200
        assert p_kept.json()["remainingAmount"] == 1650000
        assert p_kept.json()["status"] != "PAID"

        # Cas 10 & 12 : avoir en brouillon ne déduit rien ; avoir excessif refusé ; validation réduit le solde
        excess_cn = client.post(
            "/api/invoices/inv-6/credit-notes",
            headers=headers,
            json={
                "reference": "AV-EXCESS-1",
                "amount": 1700000,
                "reason": "Montant supérieur au solde",
                "validateNow": True,
            },
        )
        assert excess_cn.status_code == 400

        draft_cn = client.post(
            "/api/invoices/inv-6/credit-notes",
            headers={**headers, "Idempotency-Key": "idem-cn-1"},
            json={
                "reference": "AV-2026-001",
                "amount": 350000,
                "reason": "Remise exceptionnelle validée",
                "validateNow": False,
            },
        )
        assert draft_cn.status_code == 201, draft_cn.text
        assert draft_cn.json()["remainingAmount"] == 1650000
        assert draft_cn.json()["validatedCreditNotesAmount"] == 0

        cn_id = draft_cn.json()["creditNotes"][0]["id"]
        val_cn = client.post(
            f"/api/invoices/inv-6/credit-notes/{cn_id}/validate",
            headers={**headers, "Idempotency-Key": "idem-cn-val-1"},
        )
        assert val_cn.status_code == 200, val_cn.text
        assert val_cn.json()["validatedCreditNotesAmount"] == 350000
        assert val_cn.json()["remainingAmount"] == 1300000
        # Règlement partiel avant échéance (inv-6 due_date = 2026-12-05 > 2026-11-25) -> PARTIAL
        assert val_cn.json()["status"] == "PARTIAL"
    engine.dispose()


def test_payment_multi_allocation_guards_and_documents_and_isolation(tmp_path: Path) -> None:
    """Cas 7, 8, 9, 12, 13 + upload/téléchargement sécurisé des documents."""
    from sqlalchemy.orm import sessionmaker
    from backend.app.models.recovery import Invoice, Payment

    app, engine, _ = _make_client(tmp_path, reference_date_override="2026-11-25")
    with TestClient(app) as client:
        _, manager_token = _bootstrap_and_login(client)
        headers = {"Authorization": f"Bearer {manager_token}"}

        # Crée une deuxième facture ouverte pour cli-6 (inv-6b solde 900 000, en plus de inv-6 solde 1 650 000)
        # ainsi qu'un paiement DECLARED (non confirmé) et un paiement CONFIRMED de 1 950 000 FCFA non encore affecté
        SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
        with SessionLocal() as db:
            now = utc_now_iso()
            db.add(
                Invoice(
                    id="inv-6b",
                    organization_id="org-default",
                    reference="FAC-2026-0450",
                    client_id="cli-6",
                    import_id="imp-demo-org-default",
                    issue_date="2026-11-20",
                    due_date="2026-12-15",
                    total_amount=900000,
                    currency="XOF",
                    description="Complément marchandises Akpakpa",
                    has_dispute=0,
                    is_archived=0,
                    created_at=now,
                    updated_at=now,
                )
            )
            db.add(
                Payment(
                    id="pay-unconfirmed-cli6",
                    organization_id="org-default",
                    reference="PAY-DEC-601",
                    invoice_id=None,
                    client_id="cli-6",
                    amount=500000,
                    status="DECLARED",
                    payment_method="Virement",
                    declared_at=now,
                    created_by="gestionnaire@recouvrix.demo",
                    created_at=now,
                    updated_at=now,
                )
            )
            db.add(
                Payment(
                    id="pay-confirmed-cli6",
                    organization_id="org-default",
                    reference="PAY-CONF-602",
                    invoice_id=None,
                    client_id="cli-6",
                    amount=1950000,
                    status="CONFIRMED",
                    payment_method="Virement bancaire",
                    declared_at=now,
                    confirmed_at=now,
                    created_by="gestionnaire@recouvrix.demo",
                    created_at=now,
                    updated_at=now,
                )
            )
            # Autre organisation B pour test d'isolation strict (Cas 13)
            db.add(
                Organization(
                    id="org-b",
                    name="Organisation Externe B",
                    slug="org-ext-b",
                    currency="XOF",
                    default_payment_terms_days=30,
                    created_at=now,
                    updated_at=now,
                )
            )
            db.add(
                User(
                    id="user-org-b",
                    organization_id="org-b",
                    email="gestionnaire@org-b.bj",
                    full_name="Externe B",
                    role="MANAGER",
                    password_hash=hash_password("ExtBPass2026"),
                    is_active=1,
                    is_demo=0,
                    created_at=now,
                    updated_at=now,
                )
            )
            db.commit()

        # Cas 7 : un paiement non confirmé ne peut pas être affecté
        unconf_alloc = client.post(
            "/api/payments/pay-unconfirmed-cli6/allocate",
            headers=headers,
            json={"allocations": [{"invoiceId": "inv-6", "amount": 500000}]},
        )
        assert unconf_alloc.status_code == 400

        # Cas 12 : tentative d'affectation générant un solde négatif sur inv-6b (> 900 000) -> 400
        neg_alloc = client.post(
            "/api/payments/pay-confirmed-cli6/allocate",
            headers=headers,
            json={"allocations": [{"invoiceId": "inv-6b", "amount": 950000}]},
        )
        assert neg_alloc.status_code == 400

        # Cas 8 : affectation atomique d'un seul paiement confirmé (1 950 000) sur 2 factures de cli-6
        alloc_ok = client.post(
            "/api/payments/pay-confirmed-cli6/allocate",
            headers={**headers, "Idempotency-Key": "idem-alloc-1"},
            json={
                "allocations": [
                    {"invoiceId": "inv-6b", "amount": 900000},
                    {"invoiceId": "inv-6", "amount": 1050000},
                ]
            },
        )
        assert alloc_ok.status_code == 200, alloc_ok.text
        assert alloc_ok.json()["remainingUnallocated"] == 0

        inv6b_detail = client.get("/api/invoices/inv-6b", headers=headers).json()
        inv6_detail = client.get("/api/invoices/inv-6", headers=headers).json()
        assert inv6b_detail["remainingAmount"] == 0
        assert inv6b_detail["status"] == "PAID"
        assert inv6_detail["confirmedPaidAmount"] == 1050000
        assert inv6_detail["remainingAmount"] == 600000
        assert inv6_detail["status"] == "PARTIAL"

        # Cas 9 : tentative de double affectation -> 409
        double_alloc = client.post(
            "/api/payments/pay-confirmed-cli6/allocate",
            headers=headers,
            json={"allocations": [{"invoiceId": "inv-6", "amount": 100000}]},
        )
        assert double_alloc.status_code == 409

        # Upload & téléchargement sécurisé d'un document sur inv-6
        bad_ext = client.post(
            "/api/invoices/inv-6/documents",
            headers=headers,
            data={"docType": "ORIGINAL_INVOICE", "title": "Script interdit"},
            files={"file": ("payload.exe", b"MZ...", "application/octet-stream")},
        )
        assert bad_ext.status_code == 400

        good_doc = client.post(
            "/api/invoices/inv-6/documents",
            headers=headers,
            data={"docType": "ORIGINAL_INVOICE", "title": "Facture originale PDF"},
            files={"file": ("facture_0445.pdf", b"%PDF-1.4\n%Recouvrix test\n", "application/pdf")},
        )
        assert good_doc.status_code == 201, good_doc.text
        doc_id = good_doc.json()["documents"][0]["id"]

        dl_ok = client.get(f"/api/documents/{doc_id}/download", headers=headers)
        assert dl_ok.status_code == 200
        assert dl_ok.content.startswith(b"%PDF-1.4")

        # Cas 13 : isolation stricte inter-organisation
        login_b = client.post(
            "/api/auth/login",
            json={"email": "gestionnaire@org-b.bj", "password": "ExtBPass2026"},
        )
        assert login_b.status_code == 200
        headers_b = {"Authorization": f"Bearer {login_b.json()['token']}"}

        assert client.get("/api/invoices", headers=headers_b).json()["total"] == 0
        assert client.get("/api/invoices/inv-6", headers=headers_b).status_code == 404
        assert (
            client.patch(
                "/api/invoices/inv-6",
                headers=headers_b,
                json={"description": "Piratage"},
            ).status_code
            == 404
        )
        assert (
            client.post(
                "/api/invoices/inv-6/disputes",
                headers=headers_b,
                json={"category": "OTHER", "reason": "Tentative externe"},
            ).status_code
            == 404
        )
        assert (
            client.post(
                "/api/invoices/inv-6/promises",
                headers=headers_b,
                json={"promisedAmount": 10000, "promisedDate": "2026-12-01"},
            ).status_code
            == 404
        )
        assert (
            client.post(
                "/api/invoices/inv-6/credit-notes",
                headers=headers_b,
                json={"reference": "AV-EXT", "amount": 10000, "reason": "Tentative externe"},
            ).status_code
            == 404
        )
        assert client.get(f"/api/documents/{doc_id}/download", headers=headers_b).status_code == 404
        assert (
            client.post(
                "/api/payments/pay-confirmed-cli6/allocate",
                headers=headers_b,
                json={"allocations": [{"invoiceId": "inv-6", "amount": 1000}]},
            ).status_code
            == 404
        )
    engine.dispose()


