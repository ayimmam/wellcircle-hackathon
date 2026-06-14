import json
import os
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from groq import Groq

from app.database import get_db
from sqlalchemy.orm import Session
from app.models.provider import Provider

router = APIRouter()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "fallback_placeholder")
groq_client = Groq(api_key=GROQ_API_KEY)

class ChatMessage(BaseModel):
    role: str
    content: str

class CirclerRequest(BaseModel):
    message: str
    is_first_message: bool = False
    history: List[ChatMessage] = []

class CirclerResponse(BaseModel):
    intro: str = ""
    reply: str
    provider_id: Optional[str] = None
    provider_name: Optional[str] = None
    data_source: str = "live"

@router.post("")
def ai_circler(req: CirclerRequest, db: Session = Depends(get_db)):
    if req.is_first_message:
        return CirclerResponse(
            intro="",
            reply="",
            provider_id=None,
            provider_name=None,
            data_source="n/a",
        )

    # Fetch live providers from DB
    providers_db = db.query(Provider).all()
    providers = []
    for p in providers_db:
        providers.append({
            "id": str(p.id),
            "name": p.name,
            "category": p.category,
            "description": p.description,
            "location_text": p.location_text,
        })
    data_source = "live" if providers else "fallback"

    system_prompt = (
        "You are Well Circle's wellness assistant, named Circler, for Addis Ababa. "
        "Your task is to provide expert, empathetic advice first, and helpful service recommendations second.\n\n"
        "INTENT-BASED LOGIC:\n"
        "1. ADVISORY INTENT (Weight, Pain, Stress): Provide a scientifically-backed, actionable tip first. "
        "If you have a relevant provider from the list, suggest them. If no provider fits, set the provider fields to null.\n"
        "2. SEARCH INTENT (Gyms, Yoga, Spas): Direct the user to the best-match provider from the list immediately.\n\n"
        "ABSOLUTE RULES:\n"
        "1. REPLY MUST BE 2-3 SENTENCES MAX. No fluff, no 'Hello', no 'I am an AI'.\n"
        "2. If the user's issue has no clear provider match, set 'provider_id' and 'provider_name' to null (JSON null, not a string).\n"
        "3. ACCURACY: The 'provider_id' and 'provider_name' MUST exactly match a provider from the 'Available Providers' list. Do not invent providers.\n"
        "4. OUTPUT ONLY RAW JSON. NO MARKDOWN. NO CODE FENCES.\n"
        'REQUIRED FORMAT: {"reply": "<Advice + optional recommendation>", "provider_id": <id string or null>, "provider_name": <name string or null>}\n\n'
        f"Available Providers: {json.dumps(providers)}"
    )

    try:
        MAX_HISTORY_TURNS = 6
        trimmed_history = req.history[-MAX_HISTORY_TURNS:]

        messages = [{"role": "system", "content": system_prompt}]
        for turn in trimmed_history:
            if turn.role in ("user", "assistant"):
                messages.append({"role": turn.role, "content": turn.content})
        messages.append({"role": "user", "content": req.message})

        response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            response_format={"type": "json_object"},
            messages=messages,
            temperature=0.2,
        )

        raw_text = response.choices[0].message.content.strip()
        parsed = json.loads(raw_text)

        valid_ids = {p["id"] for p in providers}
        provider_id = parsed.get("provider_id")
        provider_name = parsed.get("provider_name")

        if provider_id is not None and provider_id not in valid_ids:
            provider_id = None
            provider_name = None

        return CirclerResponse(
            intro="",
            reply=parsed.get("reply", ""),
            provider_id=provider_id,
            provider_name=provider_name,
            data_source=data_source,
        )

    except (json.JSONDecodeError, Exception) as e:
        print(f"AI processing error: {str(e)}")
        return CirclerResponse(
            intro="",
            reply="I'm having trouble matching that request right now - try stating your health goal, budget, or neighbourhood.",
            provider_id=None,
            provider_name=None,
            data_source=data_source,
        )
