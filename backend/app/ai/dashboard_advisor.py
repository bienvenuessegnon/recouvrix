from __future__ import annotations

import json
import time
from typing import Any

from google import genai
from google.genai import types
from pydantic import BaseModel

from backend.app.core.config import get_settings
from backend.app.core.security import utc_now_iso


class _AiPriorityAdviceItem(BaseModel):
    invoiceReference: str
    justification: str
    recommendedAction: str


class _AiAdvisoryPayload(BaseModel):
    executiveSummary: str
    items: list[_AiPriorityAdviceItem]


_CACHE_TTL_SECONDS = 300.0
_cached_entry: tuple[str, float, dict[str, Any]] | None = None


def clear_ai_advisor_cache() -> None:
    global _cached_entry
    _cached_entry = None


def _build_fingerprint(priorities: list[dict[str, Any]]) -> str:
    return "|".join(
        f"{p['id']}:{p['invoiceReference']}:{p['remainingAmount']}:{p['delayDays']}:{p['kind']}"
        for p in priorities
    )


def generate_dashboard_ai_advisory(
    priorities: list[dict[str, Any]],
    *,
    force_refresh: bool = False,
    simulate_unavailable: bool = False,
) -> dict[str, Any]:
    global _cached_entry

    if not priorities:
        return {
            "status": "not_needed",
            "items": [],
            "message": "Aucune créance prioritaire à analyser pour le moment.",
        }

    if simulate_unavailable:
        return {
            "status": "unavailable",
            "items": [],
            "message": "L’assistance IA est temporairement indisponible. Les priorités ci-dessous restent classées selon les règles financières déterministes.",
        }

    api_key = get_settings().gemini_api_key
    if not api_key or api_key == "MY_GEMINI_API_KEY":
        return {
            "status": "unavailable",
            "items": [],
            "message": "L’assistance IA est temporairement indisponible. Les priorités ci-dessous restent classées selon les règles financières déterministes.",
        }

    fingerprint = _build_fingerprint(priorities)
    if (
        not force_refresh
        and _cached_entry is not None
        and _cached_entry[0] == fingerprint
        and _cached_entry[1] > time.time()
    ):
        return _cached_entry[2]

    try:
        client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(headers={"User-Agent": "aistudio-build"}),
        )

        compact_input = [
            {
                "client": item["clientName"],
                "facture": item["invoiceReference"],
                "typePriorite": item["kind"],
                "soldeRestantFCFA": item["remainingAmount"],
                "paiementEnAttenteFCFA": item.get("pendingAmount", 0),
                "joursRetard": item["delayDays"],
                "motifFactuel": item["reason"],
            }
            for item in priorities[:5]
        ]

        response = client.models.generate_content(
            model="gemini-4-hydrogen",
            contents=(
                "Analyse ces dossiers prioritaires de recouvrement (montants en FCFA) "
                "et propose une synthèse concise pour le gestionnaire :\n"
                + json.dumps(compact_input, ensure_ascii=False)
            ),
            config=types.GenerateContentConfig(
                system_instruction=(
                    "Tu es un assistant de pilotage du recouvrement pour la plateforme Recouvrix. "
                    "Réponds uniquement en français professionnel et sobre. "
                    "Ne modifie jamais et n’invente jamais aucun montant, référence de facture ou date. "
                    "Explique concrètement pourquoi chaque dossier demande une attention immédiate et quelle action humaine préparer. "
                    "Garde executiveSummary à 2 phrases maximum."
                ),
                response_mime_type="application/json",
                response_schema=_AiAdvisoryPayload,
            ),
        )

        raw_text = (response.text or "").strip()
        parsed = json.loads(raw_text)
        valid_items = [
            {
                "invoiceReference": str(item["invoiceReference"]),
                "justification": str(item["justification"]),
                "recommendedAction": str(item["recommendedAction"]),
            }
            for item in parsed.get("items", [])
            if isinstance(item, dict)
            and isinstance(item.get("invoiceReference"), str)
            and isinstance(item.get("justification"), str)
            and isinstance(item.get("recommendedAction"), str)
        ]

        state: dict[str, Any] = {
            "status": "available",
            "modelUsed": "gemini-4-hydrogen",
            "generatedAt": utc_now_iso(),
            "executiveSummary": parsed.get("executiveSummary"),
            "items": valid_items,
        }
        _cached_entry = (fingerprint, time.time() + _CACHE_TTL_SECONDS, state)
        return state
    except Exception:
        return {
            "status": "unavailable",
            "items": [],
            "message": "L’assistance IA est temporairement indisponible. Les priorités ci-dessous restent classées selon les règles financières déterministes.",
        }
