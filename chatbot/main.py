import os
import re
import json
import uuid

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware

from auth import ChatIdentity, resolve_chat_identity
from experience import EXPIRED, FIRST_VISIT, RETURNING, build_welcome
from grounding import ground_reply
from profile import (
    ConsentRequiredError,
    clear_preferences,
    get_profile,
    normalize_display_name,
    normalize_preferences,
    remember_display_name,
    remember_name_from_message,
    save_preferences,
)

from config import (
    GROQ_MAX_TOKENS,
    GROQ_MODEL,
    groq_client,
    logger,
    supabase_client,
)
from data import (
    _event_cache,
    _normalize_optional_id,
    _provider_cache,
    _resolve_event,
    _resolve_provider,
    fetch_events,
    fetch_providers,
    get_events,
    get_providers,
)
from prompt import build_system_prompt
from models import (
    EVENT_PROMPT_FIELDS,
    FALLBACK_EVENTS,
    FALLBACK_PROVIDERS,
    PROMPT_FIELDS,
    ConciergeHistoryClearResponse,
    ConciergeProfileResponse,
    ConciergeProfileUpdate,
    ConciergeRequest,
    ConciergeResponse,
    ConciergeSessionResponse,
    WelcomePayload,
)
from memory import (
    SessionOwnershipError,
    append_session_turn,
    clear_session,
    get_session_state,
)

app = FastAPI(title="Well Circle Concierge - Production")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


@app.get("/ai/concierge/session", response_model=ConciergeSessionResponse)
def ai_concierge_session(
    session_id: str | None = Query(default=None, max_length=200),
    identity: ChatIdentity = Depends(resolve_chat_identity),
):
    """Return the authoritative welcome/history state for an opening chat.

    This endpoint deliberately does not call the language model and does not
    create or update a ``chat_memory`` row. Opening a widget is not a
    conversation turn, so it must never produce an unsolicited assistant reply.
    """
    resolved_session_id = (session_id or "").strip() or str(uuid.uuid4())
    chat_profile = get_profile(identity.owner_type, identity.owner_id)

    state = get_session_state(
        resolved_session_id,
        owner_type=identity.owner_type,
        owner_id=identity.owner_id,
    )
    if state.status == "forbidden":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This conversation belongs to another session",
        )

    if state.status == "active":
        experience = RETURNING
        history = state.messages
        memory_available = True
    elif state.status == "expired":
        experience = EXPIRED
        history = []
        memory_available = True
    elif state.status == "new":
        experience = FIRST_VISIT
        history = []
        memory_available = True
    else:
        # A database outage must not be presented as a first visit, because
        # that would repeat the full onboarding copy on every open.
        experience = RETURNING
        history = []
        memory_available = False

    welcome = build_welcome(experience, chat_profile.display_name)

    return ConciergeSessionResponse(
        session_id=resolved_session_id,
        experience=experience,
        welcome=(
            WelcomePayload(text=welcome.text, cards=list(welcome.cards))
            if welcome is not None
            else None
        ),
        history=history,
        profile_name=chat_profile.display_name,
        anonymous_token=identity.anonymous_token,
        memory_available=memory_available,
    )


@app.patch("/ai/concierge/profile", response_model=ConciergeProfileResponse)
def update_concierge_profile(
    req: ConciergeProfileUpdate,
    identity: ChatIdentity = Depends(resolve_chat_identity),
):
    """Persist a name/preferences only after explicit consent.

    Preferences survive conversation expiry because they live in
    ``chat_profile``, not ``chat_memory``. The client must send
    ``consent: true``; the server does not infer consent from an ordinary chat
    message for preference data.
    """
    if req.consent is not True:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Explicit consent is required to save profile preferences",
        )
    if req.display_name is None and req.preferences is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No profile fields were supplied",
        )

    # Validate every supplied field before writing anything, so an invalid
    # payload cannot leave a half-updated profile behind.
    name: str | None = None
    cleaned: dict | None = None

    if req.display_name is not None:
        name = normalize_display_name(req.display_name)
        if name is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The profile name is invalid",
            )

    if req.preferences is not None:
        cleaned = normalize_preferences(req.preferences)
        if cleaned is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The profile preferences are invalid",
            )

    if req.display_name is not None:
        # Stored on the chat profile only; the verified account's onboarding
        # name stays authoritative for signed-in users and is never modified.
        if remember_display_name(identity.owner_type, identity.owner_id, name) is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Profile storage is not available",
            )

    if req.preferences is not None:
        try:
            saved = save_preferences(
                identity.owner_type,
                identity.owner_id,
                cleaned,
                consent=True,
            )
        except ConsentRequiredError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Explicit consent is required to save profile preferences",
            ) from exc
        if saved is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Profile storage is not available",
            )

    current = get_profile(identity.owner_type, identity.owner_id)
    return ConciergeProfileResponse(
        display_name=current.display_name,
        preferences=current.preferences,
        consent_recorded=current.consent_recorded,
    )


@app.get("/ai/concierge/profile", response_model=ConciergeProfileResponse)
def read_concierge_profile(
    identity: ChatIdentity = Depends(resolve_chat_identity),
):
    """Read the caller's persistent profile for the settings panel.

    Same owner scoping as every other profile operation: the identity comes
    from the request credential, never from a client-supplied id.
    """
    current = get_profile(identity.owner_type, identity.owner_id)
    return ConciergeProfileResponse(
        display_name=current.display_name,
        preferences=current.preferences,
        consent_recorded=current.consent_recorded,
    )


@app.delete("/ai/concierge/preferences", response_model=ConciergeProfileResponse)
def delete_concierge_preferences(
    identity: ChatIdentity = Depends(resolve_chat_identity),
):
    """Delete saved preferences; keep the profile name and the consent grant.

    This is the settings-panel "delete saved preferences" action. It removes
    the stored preference data so none of it can ever be re-used; afterwards
    turning personalization's editor back on just means saving new ones.
    """
    if not clear_preferences(
        identity.owner_type, identity.owner_id, withdraw_consent=False
    ):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Profile storage is not available",
        )
    current = get_profile(identity.owner_type, identity.owner_id)
    return ConciergeProfileResponse(
        display_name=current.display_name,
        preferences=current.preferences,
        consent_recorded=current.consent_recorded,
    )


@app.delete("/ai/concierge/personalization", response_model=ConciergeProfileResponse)
def withdraw_concierge_personalization(
    identity: ChatIdentity = Depends(resolve_chat_identity),
):
    """Disable personalization by withdrawing consent.

    Withdrawal must not require consent, and it removes the stored preference
    data with it: afterwards no saved preference is used in any subsequent
    model prompt. The profile name is unaffected.
    """
    if not clear_preferences(
        identity.owner_type, identity.owner_id, withdraw_consent=True
    ):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Profile storage is not available",
        )
    current = get_profile(identity.owner_type, identity.owner_id)
    return ConciergeProfileResponse(
        display_name=current.display_name,
        preferences=current.preferences,
        consent_recorded=current.consent_recorded,
    )


@app.delete("/ai/concierge/history", response_model=ConciergeHistoryClearResponse)
def clear_concierge_history(
    session_id: str = Query(..., min_length=1, max_length=200),
    identity: ChatIdentity = Depends(resolve_chat_identity),
):
    """Delete this conversation's stored history for the caller's identity.

    Only the ``chat_memory`` row is affected; the persistent profile (name
    and preferences) lives in ``chat_profile`` and is never touched. A
    session id belonging to another identity or a legacy row simply does not
    match the owner filters and is left alone — the session id is a selector,
    not proof of ownership. Unowned store misses are idempotent: nothing to
    clear is a success.
    """
    try:
        clear_session(
            session_id,
            owner_type=identity.owner_type,
            owner_id=identity.owner_id,
        )
    except Exception as exc:
        logger.exception("Conversation clear failed for session %s", session_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not clear the conversation right now",
        ) from exc

    fresh_session_id = str(uuid.uuid4())
    return ConciergeHistoryClearResponse(
        cleared=True,
        session_id=fresh_session_id,
    )


FALLBACK_REPLY = (
    "I'm having trouble matching that request right now - try stating your "
    "health goal, budget, or neighbourhood."
)
VARIATION_RETRY_NOTE = (
    "Your previous reply would repeat an assistant message from earlier in "
    "this conversation almost word for word. Write a fresh reply that "
    "acknowledges the customer's latest message, varies the wording and the "
    "closing question, and follows the same wellness scope, data, and "
    "grounding rules. Do not invent providers, events, prices, or availability."
)
UNVERIFIED_EVENT_REPLY = (
    "I can't confirm that event from the current listings. Would you like me "
    "to look for a provider or another option?"
)

_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*\n?(.*?)\n?```", re.DOTALL | re.IGNORECASE)


def extract_json_object(text: str) -> dict | None:
    """Parse a JSON object from plain text or markdown-fenced model output."""
    if not text or not isinstance(text, str):
        return None

    stripped = text.strip()
    if not stripped:
        return None

    candidates = [stripped]

    fence_match = _JSON_FENCE_RE.search(stripped)
    if fence_match:
        candidates.insert(0, fence_match.group(1).strip())

    start = stripped.find("{")
    end = stripped.rfind("}")
    if start != -1 and end > start:
        candidates.append(stripped[start : end + 1])

    seen: set[str] = set()
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return parsed

    return None


def validate_concierge_payload(parsed: dict) -> bool:
    """Ensure the parsed model output matches the concierge response contract."""
    if not isinstance(parsed, dict):
        return False
    if "reply" not in parsed:
        return False
    reply = parsed.get("reply")
    if reply is not None and not isinstance(reply, str):
        return False
    return True


def _is_groq_api_error(exc: BaseException) -> bool:
    return type(exc).__module__.startswith("groq")


def _last_assistant_content(history) -> str | None:
    """Text of the newest assistant message in stored history, if any."""
    for entry in reversed(history or []):
        if isinstance(entry, dict) and entry.get("role") == "assistant":
            content = entry.get("content")
            if isinstance(content, str):
                return content
            break
    return None


def _extract_model_text(message) -> str:
    """Return assistant text from content, falling back to reasoning for OSS models."""
    content = getattr(message, "content", None)
    if content is not None and str(content).strip():
        return str(content).strip()

    reasoning = getattr(message, "reasoning", None)
    if reasoning is None and hasattr(message, "model_dump"):
        reasoning = message.model_dump().get("reasoning")
    if reasoning is not None and str(reasoning).strip():
        logger.info("Model returned empty content; attempting JSON extraction from reasoning")
        return str(reasoning).strip()

    return ""


@app.post("/ai/concierge", response_model=ConciergeResponse)
def ai_concierge(
    req: ConciergeRequest,
    identity: ChatIdentity = Depends(resolve_chat_identity),
):

    # Resolve or generate the session id for this conversation. Normalize the
    # same way as GET /session so a whitespace-only id cannot create a second
    # row that the client can never reopen.
    session_id = (req.session_id or "").strip() or str(uuid.uuid4())
    data_source = "unavailable"
    profile_name = None

    try:
        # Data-source failures should not turn a chat into a 500. The data
        # layer already returns fallback providers in normal failure paths;
        # these guards also cover unexpected shape/query exceptions.
        try:
            providers, data_source = get_providers()
        except Exception:
            logger.exception(
                "Provider retrieval raised — using local fallback dataset"
            )
            providers, data_source = FALLBACK_PROVIDERS, "fallback"

        try:
            events, _event_source = get_events()
        except Exception:
            logger.exception(
                "Event retrieval raised — continuing without event recommendations"
            )
            events = []

        chat_profile = get_profile(identity.owner_type, identity.owner_id)
        learned_name = remember_name_from_message(
            identity.owner_type, identity.owner_id, req.message
        )
        # A name stated in this message takes precedence over the stored one —
        # EXCEPT when the verified account's onboarding name is available: the
        # account profile is authoritative for signed-in users, and a
        # chat-stated name must never mask (or overwrite) it. Anonymous users
        # and users without an account name keep the existing behavior: a name
        # stated in this message wins over the remembered chat display_name,
        # since it is the user's most recent explicit input.
        if chat_profile.name_from_account:
            profile_name = chat_profile.display_name
        else:
            profile_name = learned_name or chat_profile.display_name

        system_prompt = build_system_prompt(
            providers,
            events,
            profile_name=profile_name,
            preferences=chat_profile.preferences,
        )

        # Server-side memory is authoritative. The client-supplied
        # is_first_message flag and history are intentionally not used to
        # validate or seed history; the server session id is the only key.
        # Ownership is checked before any stored history is exposed to the
        # model. A known session id belonging to another identity is a 403.
        memory_state = get_session_state(
            session_id,
            owner_type=identity.owner_type,
            owner_id=identity.owner_id,
        )
        if memory_state.status == "forbidden":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This conversation belongs to another session",
            )
        stored_history = memory_state.messages if memory_state.status == "active" else []

        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(stored_history)
        messages.append({"role": "user", "content": req.message})

        def generate_grounded_reply(extra_instruction: str | None = None):
            """One model call, then the full deterministic downstream pipeline.

            Raises the same ValueError model-failure sentinels (and groq API
            errors) as before; callers must keep handling those paths.
            """
            attempt_messages = (
                [messages[0]]
                + ([{"role": "system", "content": extra_instruction}]
                   if extra_instruction is not None else [])
                + messages[1:]
            )

            response = groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=attempt_messages,
                temperature=0.2,
                max_tokens=GROQ_MAX_TOKENS,
            )

            if not response.choices:
                logger.error("Model failure: Groq returned no choices (model=%s)", GROQ_MODEL)
                raise ValueError("model_no_choices")

            raw_content = _extract_model_text(response.choices[0].message)
            if not raw_content:
                logger.error("Model failure: Groq returned empty content (model=%s)", GROQ_MODEL)
                raise ValueError("model_empty_content")

            raw_text = raw_content
            parsed = extract_json_object(raw_text)
            if parsed is None:
                preview = raw_text[:200].replace("\n", " ")
                logger.error(
                    "JSON parsing failure: could not extract object from model output "
                    "(model=%s, preview=%r)",
                    GROQ_MODEL,
                    preview,
                )
                raise ValueError("json_parse_failed")

            if not validate_concierge_payload(parsed):
                logger.error(
                    "Response validation failure: missing or invalid required fields "
                    "(keys=%s, model=%s)",
                    sorted(parsed.keys()) if isinstance(parsed, dict) else type(parsed).__name__,
                    GROQ_MODEL,
                )
                raise ValueError("validation_failed")

            requested_event_id = _normalize_optional_id(parsed.get("event_id"))
            provider_id, provider_name = _resolve_provider(parsed, providers)
            event_id, event_name, event_provider_id = _resolve_event(parsed, events)

            reply = parsed.get("reply") or ""
            if not isinstance(reply, str) or not reply.strip():
                reply = FALLBACK_REPLY
            elif requested_event_id is not None and event_id is None:
                # The model tried to recommend an event that is absent from the
                # current dataset (for example because the event query failed).
                # Dropping only the id would leave an unverified event mentioned
                # in prose, so replace the whole reply with a deterministic
                # refusal.
                logger.warning(
                    "Model returned unverified event_id %r; replacing reply",
                    requested_event_id,
                )
                reply = UNVERIFIED_EVENT_REPLY

            # The model is not trusted with prices or availability either. If a
            # selected listing exists, explicit ETB amounts and "spots left"
            # claims must match that listing; otherwise replace the reply with
            # a deterministic listing-backed response.
            provider_row = next(
                (
                    provider
                    for provider in providers
                    if provider_id is not None
                    and str(provider.get("id")) == str(provider_id)
                ),
                None,
            )
            event_row = next(
                (
                    event
                    for event in events
                    if event_id is not None and str(event.get("id")) == str(event_id)
                ),
                None,
            )
            grounded = ground_reply(
                reply,
                provider=provider_row,
                event=event_row,
                user_message=req.message,
            )
            if grounded.violations:
                logger.warning(
                    "Grounding guard replaced reply for session %s (violations=%s)",
                    session_id,
                    ",".join(grounded.violations),
                )
            return (
                grounded.reply,
                provider_id,
                provider_name,
                event_id,
                event_name,
                event_provider_id,
            )

        reply, provider_id, provider_name, event_id, event_name, event_provider_id = (
            generate_grounded_reply()
        )

        # Anti-repetition backstop: a reply identical to the immediately
        # preceding assistant message feels robotic even when it is well
        # grounded. Bounded retry (at most one extra model call) with an
        # explicit variation instruction; if it fails or repeats again, the
        # original reply stands and nothing is invented.
        previous_reply = _last_assistant_content(stored_history)
        if (
            previous_reply is not None
            and reply.strip() == previous_reply.strip()
            and len(stored_history) > 0
        ):
            logger.info(
                "Reply repeated the previous assistant message for session %s — retrying with variation instruction",
                session_id,
            )
            try:
                retried = generate_grounded_reply(extra_instruction=VARIATION_RETRY_NOTE)
                if retried[0].strip() != reply.strip():
                    (
                        reply,
                        provider_id,
                        provider_name,
                        event_id,
                        event_name,
                        event_provider_id,
                    ) = retried
            except Exception as exc:
                if _is_groq_api_error(exc):
                    logger.exception("Variation retry Groq API failure (model=%s)", GROQ_MODEL)
                else:
                    logger.exception("Variation retry failed — keeping first reply")


        # Persist only after the assistant response has been validated. The
        # database appends only this turn and generates the activity timestamp
        # in the same locked operation. If the database read failed, do not risk
        # overwriting an unknown row with a conversation that was built without
        # its history.
        if memory_state.status == "unavailable":
            logger.warning(
                "Skipping conversation persistence for session %s because memory was unavailable",
                session_id,
            )
        else:
            expected_updated_at = (
                memory_state.updated_at
                if memory_state.status == "active"
                else None
            )
            try:
                append_result = append_session_turn(
                    session_id,
                    req.message,
                    reply,
                    owner_type=identity.owner_type,
                    owner_id=identity.owner_id,
                    expected_updated_at=expected_updated_at,
                )
            except SessionOwnershipError:
                # A concurrent request claimed this session id for another
                # identity after our read. Do not leak the reply or write.
                raise
            except Exception:
                # Memory must never turn a valid reply into a fallback.
                logger.exception(
                    "Conversation persistence raised for session %s", session_id
                )
                append_result = None

            if append_result is not None:
                if not append_result.persisted and supabase_client is not None:
                    logger.warning(
                        "Conversation memory was not persisted for session %s",
                        session_id,
                    )
                if append_result.stale_turn:
                    # Both turns are preserved, but this reply was generated
                    # from history that another concurrent turn changed first.
                    # The protocol has no turn sequence, so order is not rewritten.
                    logger.warning(
                        "Stale conversation turn appended for session %s", session_id
                    )

        return ConciergeResponse(
            reply=reply,
            provider_id=provider_id,
            provider_name=provider_name,
            event_id=event_id,
            event_name=event_name,
            event_provider_id=event_provider_id,
            data_source=data_source,
            session_id=session_id,
            anonymous_token=identity.anonymous_token,
            profile_name=profile_name,
        )

    except HTTPException:
        # Authentication, authorization, and ownership errors are decisions,
        # not model failures. Never convert them into a 200 fallback.
        raise
    except SessionOwnershipError as exc:
        logger.warning(
            "Conversation session %s is owned by another identity", session_id
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This conversation belongs to another session",
        ) from exc
    except ValueError as exc:
        if str(exc) not in (
            "model_no_choices",
            "model_empty_content",
            "json_parse_failed",
            "validation_failed",
        ):
            logger.exception("Unexpected validation error during AI processing")
    except Exception as exc:
        if _is_groq_api_error(exc):
            logger.exception("Groq API failure (model=%s)", GROQ_MODEL)
        else:
            logger.exception("Unexpected AI processing error")

    return ConciergeResponse(
        reply=FALLBACK_REPLY,
        provider_id=None,
        provider_name=None,
        event_id=None,
        event_name=None,
        event_provider_id=None,
        data_source=data_source,
        session_id=session_id,
        anonymous_token=identity.anonymous_token,
        profile_name=profile_name,
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
