import os
import unicodedata
from pathlib import Path
from urllib.parse import quote

import asyncpg

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://c2:c2@db:5432/c2")
RECON_LINK_PREFIX = "/map/uav-recon/"
HQ_LAT = 48.247165
HQ_LON = 39.950965

class ChatMessage(BaseModel):
    role: str  # "user" | "assistant" | "system"
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]

class ChatAction(BaseModel):
    type: str
    payload: dict = {}

class ChatResponse(BaseModel):
    reply: str
    actions: list[ChatAction] = []


def normalize_text(raw: str) -> str:
    lowered = raw.lower().strip()
    without_accents = "".join(
        ch for ch in unicodedata.normalize("NFKD", lowered) if not unicodedata.combining(ch)
    )
    return " ".join(without_accents.split())


def is_recon_list_request(normalized: str) -> bool:
    return (
        "liste des drones" in normalized
        and "observer la zone" in normalized
        and "pc" in normalized
    )


def is_recon_mission_order_request(normalized: str) -> bool:
    return (
        "ordre de demande de reconnaissance" in normalized
        and "rus-hq-comint" in normalized
        and "drone selectionne" in normalized
    )


def is_watch_new_drone_data_request(normalized: str) -> bool:
    return "regarder nouvelle donnee" in normalized and "uav-rec" in normalized


def is_confirm_hq_enemy_request(normalized: str) -> bool:
    return (
        "confirmation" in normalized
        and "rus-hq-comint" in normalized
        and ("ennemi" in normalized or "enemy" in normalized)
    )


async def list_recon_drones_sorted_by_hq_distance() -> list[tuple[str, float]]:
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        rows = await conn.fetch(
            """
            SELECT
              name,
              ST_DistanceSphere(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS distance_m
            FROM units
            WHERE unit_type = 'UAS_RECON'
            ORDER BY distance_m ASC, created_at DESC
            LIMIT 12
            """,
            HQ_LON,
            HQ_LAT,
        )
        return [(str(row["name"]), float(row["distance_m"])) for row in rows]
    finally:
        await conn.close()


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    last_user = next((m.content for m in reversed(req.messages) if m.role == "user"), "")
    actions: list[ChatAction] = []
    normalized = normalize_text(last_user)

    if is_recon_mission_order_request(normalized):
        return ChatResponse(
            reply="Ordre de mission généré pour le drone de reconnaissance sélectionné.",
            actions=[
                ChatAction(
                    type="draft_recon_order",
                    payload={
                        "title": "ORDRE DE MISSION – DRONE DE RECONNAISSANCE",
                        "situation": (
                            "Forces ennemies susceptibles d’occuper la zone urbaine au sud de OBJ BRAVO.\n"
                            "Présomption d’un poste de commandement tactique ennemi.\n"
                            "Unités amies en progression vers l’est."
                        ),
                        "mission": (
                            "Le détachement drone du GTIA exécute une mission de reconnaissance aérienne\n"
                            "afin de confirmer ou infirmer la présence d’un poste de commandement ennemi\n"
                            "dans la zone délimitée par les points MGRS :\n\n"
                            "31U BT 12345 67890\n\n"
                            "31U BT 12500 68000\n\n"
                            "31U BT 12600 67800\n\n"
                            "31U BT 12400 67650\n\n"
                            "À partir de 14h30, durée 45 minutes."
                        ),
                        "execution": (
                            "Effet recherché : Détection PC ennemi\n\n"
                            "Identifier :\n\n"
                            "Bâtiment avec activité permanente\n\n"
                            "Antennes satellitaires\n\n"
                            "Climatisation industrielle\n\n"
                            "Véhicules stationnés type PC\n\n"
                            "Mesures de protection périmétrique\n\n"
                            "Mode d’action :\n\n"
                            "Insertion par axe nord-ouest\n\n"
                            "Altitude 300 m AGL\n\n"
                            "Maintien hors portée MANPADS estimée\n\n"
                            "Transmission flux temps réel vers PC\n\n"
                            "Compte rendu :\n\n"
                            "Format SALUTE\n\n"
                            "Transmission immédiate si contact visuel confirmé"
                        ),
                        "soutien": (
                            "Autonomie drone : 1h30\n\n"
                            "Plan de relève si panne : drone 2 en alerte 15 min\n\n"
                            "Couverture guerre électronique amie active"
                        ),
                        "commandement_transmissions": (
                            "Contrôle opérationnel : PC GTIA\n\n"
                            "Fréquence primaire : 45.250 MHz\n\n"
                            "Liaison data : canal sécurisé ALPHA-3\n\n"
                            "Indicatif drone : FALCON 21"
                        ),
                    },
                )
            ],
        )

    if is_watch_new_drone_data_request(normalized):
        return ChatResponse(
            reply=(
                "RUS-HQ-COMINT\n"
                "Origin : IMINT\n"
                "Position : [48.247165, 39.950965]\n"
                'Résumé : "Plusieur bâtiments détectés avec de nombreux véhicules militaire et des antennes satellites."\n\n'
                "Vidéo : [analytics_of_drone_view](/media/overfit_data_v3_h264.mp4)"
            ),
            actions=[],
        )

    if is_confirm_hq_enemy_request(normalized):
        return ChatResponse(
            reply="Confirmation reçue. RUS-HQ-COMINT est maintenant marqué ENEMY.",
            actions=[ChatAction(type="confirm_hq_enemy", payload={"name": "RUS-HQ-COMINT"})],
        )

    if "rus-hq-comint" in normalized:
        configured_url = os.getenv("COMINT_VIDEO_URL", "/media/airbushlt_rus_trs_trad.mkv")
        if configured_url.startswith("/home/"):
            # Convert a local filesystem path into the served media endpoint.
            configured_url = f"/media/{Path(configured_url).name}"
        video_url = configured_url
        return ChatResponse(
            reply=(
                "RUS-HQ-COMINT\n"
                "Origin : intercep COMINT\n"
                "Position : [48.247165, 39.950965]\n\n"
                f"Analyse : [intercept_communication]({video_url})\n"
                "Résumé :\n"
                "Mention de BMP touché sur la route 13-292, demande de support hélicoptère et tanks"
            ),
            actions=[],
        )

    if is_recon_list_request(normalized):
        try:
            drones = await list_recon_drones_sorted_by_hq_distance()
        except Exception:
            drones = []
        if not drones:
            return ChatResponse(
                reply="Voici la liste des drones de RECONNAISSANCE disponibles :\nAucun UAS - Recon disponible.",
                actions=[],
            )

        entries = [
            f"- [{name} ({distance_m / 1000:.1f} km)]({RECON_LINK_PREFIX}{quote(name, safe='')})"
            for name, distance_m in drones
        ]
        return ChatResponse(
            reply=(
                "Voici la liste des drones de RECONNAISSANCE disponibles :\n"
                + "\n".join(entries)
            ),
            actions=[],
        )

    if "drone" in last_user.lower():
        actions.append(
            ChatAction(
                type="suggest_uav",
                payload={
                    "uavs": [
                        {"name": "UAV-ALPHA", "status": "available", "range_km": 80},
                        {"name": "UAV-BRAVO", "status": "tasked", "range_km": 120},
                    ]
                },
            )
        )

    if "place" in last_user.lower() or "unité" in last_user.lower():
        actions.append(
            ChatAction(
                type="place_unit",
                payload={
                    "side": "FRIEND",
                    "kind": "INFANTRY",
                    "lat": 48.8566,
                    "lng": 2.3522,
                    "label": "UNIT-MOCK",
                },
            )
        )

    return ChatResponse(
        reply=f"(mock) Reçu: {last_user}\nJe peux aussi renvoyer des actions (place_unit, suggest_uav, ...).",
        actions=actions,
    )
