import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Well Circle Concierge - Production")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ENVIRONMENT VARIABLES ---
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not GROQ_API_KEY or not SUPABASE_URL or not SUPABASE_KEY:
    print("⚠️  WARNING: Missing environment configuration variables!")

# --- CLIENT INITIALIZATION ---
groq_client = Groq(api_key=GROQ_API_KEY or "fallback_placeholder")

try:
    supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"⚠️  Supabase client init failed: {str(e)}")
    supabase_client = None


# --- LOCAL FALLBACK DATASET ---
FALLBACK_PROVIDERS = [
    {
        "id": "fb-001",
        "name": "Bole Wellness Hub",
        "category": "gym",
        "description": "Modern gym with personal training and group classes.",
        "location_text": "Bole, Addis Ababa",
        "price_range": "ETB 800-2500",
        "rating": 4.6,
    },
    {
        "id": "fb-002",
        "name": "Serenity Yoga Studio",
        "category": "yoga",
        "description": "Calm, beginner-friendly yoga studio with daily sessions.",
        "location_text": "Kazanchis, Addis Ababa",
        "price_range": "ETB 500-1200",
        "rating": 4.8,
    },
    {
        "id": "fb-003",
        "name": "NutriLife Consulting",
        "category": "nutrition",
        "description": "Affordable nutrition planning and weight management coaching.",
        "location_text": "CMC, Addis Ababa",
        "price_range": "ETB 400-1000",
        "rating": 4.5,
    },
    {
        "id": "fb-004",
        "name": "Spa Oasis Addis",
        "category": "spa",
        "description": "Relaxing massage and spa treatments in a tranquil setting.",
        "location_text": "Bole, Addis Ababa",
        "price_range": "ETB 600-2000",
        "rating": 4.7,
    },
    {
        "id": "fb-005",
        "name": "Mindful Therapy Center",
        "category": "therapy",
        "description": "Licensed therapists offering individual counseling sessions.",
        "location_text": "Sarbet, Addis Ababa",
        "price_range": "ETB 700-1800",
        "rating": 4.9,
    },
]


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ConciergeRequest(BaseModel):
    message: str
    is_first_message: bool = False
    history: list[ChatMessage] = []  # prior turns in this session, oldest first


class ConciergeResponse(BaseModel):
    intro: str = ""
    reply: str
    provider_id: str | None = None
    provider_name: str | None = None
    data_source: str = "unknown"  # "live" or "fallback"


@app.get("/")
def health():
    db_status = "not_configured"
    if supabase_client:
        try:
            supabase_client.table("providers").select("id").limit(1).execute()
            db_status = "live"
        except Exception:
            db_status = "unreachable_using_fallback"
    return {
        "status": "ok",
        "service": "well-circle-concierge",
        "database": db_status,
    }


def fetch_providers():
    if supabase_client is not None:
        try:
            db_response = supabase_client.table("providers").select("*").execute()
            if db_response.data:
                return db_response.data, "live"
            print("Supabase returned 0 providers, using fallback dataset.")
            return FALLBACK_PROVIDERS, "fallback"
        except Exception as e:
            print(f"Supabase Fetch Error (using fallback): {str(e)}")
            return FALLBACK_PROVIDERS, "fallback"
    else:
        print("Supabase client not initialized, using fallback dataset.")
        return FALLBACK_PROVIDERS, "fallback"


def get_onboarding_intro() -> str:
    return (
        "Welcome to Well Circle — Addis Ababa's wellness ecosystem.\n\n"
        "• AI Concierge: Tell me your goal, budget, or neighbourhood and I'll match you instantly.\n"
        "• Circles: Join accountability groups, post daily wins, and track your squad's streaks.\n"
        "• Pay Direct: Book and pay via Telebirr or M-Pesa — no redirects.\n\n"
        "Try: \"Affordable gym near Bole\" · \"Stress relief under 800 ETB\" · \"Nutritionist in CMC\""
    )


@app.post("/ai/concierge", response_model=ConciergeResponse)
def ai_concierge(req: ConciergeRequest):

    # 1. First Message Check - frontend handles its own welcome, backend stays silent
    if req.is_first_message:
        return ConciergeResponse(
            intro="",
            reply="",
            provider_id=None,
            provider_name=None,
            data_source="n/a",
        )

    # 2. Hybrid fetch: live Supabase with automatic fallback
    providers, data_source = fetch_providers()

    # 3. System prompt — Advice-First, Concierge Logic
    system_prompt = (
        "You are Well Circle's wellness concierge for Addis Ababa. "
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
            print(f"AI returned unknown provider_id '{provider_id}', nulling it out.")
            provider_id = None
            provider_name = None

        return ConciergeResponse(
            intro="",
            reply=parsed.get("reply", ""),
            provider_id=provider_id,
            provider_name=provider_name,
            data_source=data_source,
        )

    except (json.JSONDecodeError, Exception) as e:
        print(f"AI processing error: {str(e)}")
        return ConciergeResponse(
            intro="",
            reply="I'm having trouble matching that request right now - try stating your health goal, budget, or neighbourhood.",
            provider_id=None,
            provider_name=None,
            data_source=data_source,
        )


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)