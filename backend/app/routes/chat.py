from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

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

@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    last_user = next((m.content for m in reversed(req.messages) if m.role == "user"), "")
    actions: list[ChatAction] = []

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
