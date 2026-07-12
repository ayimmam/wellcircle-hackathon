"""Load test for the Kuriftu pilot launch: ~200 concurrent users plus a
registration-surge spike, to validate Supabase free tier + the serverless
connection-pool fix (see app/database.py) before committing to it over a
MongoDB migration. See README.md in this directory for how/where to run it.

Usage (against local dev):
    TELEGRAM_BOT_TOKEN=... locust -f locustfile.py --host http://localhost:8000

Usage (headless, against a target, ramping to 200 users over 30s registration
surge then holding for 4 more minutes — the default shape below):
    TELEGRAM_BOT_TOKEN=... locust -f locustfile.py --host https://wellcircle-hackathon-backend.vercel.app \
        --headless --run-time 5m --csv=results
"""
import os
import random
import time

from locust import HttpUser, LoadTestShape, task, between

from telegram_signing import build_init_data

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
if not BOT_TOKEN:
    raise SystemExit(
        "TELEGRAM_BOT_TOKEN is required — without it, every /api/auth/telegram "
        "call gets a signature that fails validate_init_data() and the test "
        "just measures how fast the backend can reject requests, not real load. "
        "Use the same token as backend/.env's TELEGRAM_BOT_TOKEN (don't commit it)."
    )

TARGET_USERS = int(os.environ.get("LOAD_TEST_USERS", "200"))
SURGE_SECONDS = int(os.environ.get("LOAD_TEST_SURGE_SECONDS", "30"))
SUSTAIN_SECONDS = int(os.environ.get("LOAD_TEST_SUSTAIN_SECONDS", "240"))

INTEREST_CATEGORIES = ["yoga", "gym", "nutrition", "spa", "therapy", "running"]
EXERCISE_FREQUENCIES = ["never", "rarely", "sometimes", "regular", "daily"]


class WellCircleUser(HttpUser):
    """One simulated Mini App session: register (or re-auth), then browse —
    with a minority of sessions completing a full booking + payment cycle,
    mirroring the mix Monday's flow audit assumed (most users browse, few
    convert)."""

    wait_time = between(1, 4)  # gap between taps, roughly human

    def on_start(self):
        # Unique per session so every run genuinely exercises the
        # "create new user" path — this is what a registration surge is.
        self.telegram_id = random.randint(900_000_000, 999_999_999) * 10 + random.randint(0, 9)
        init_data = build_init_data(
            BOT_TOKEN,
            self.telegram_id,
            first_name=f"LoadTest{self.telegram_id % 10000}",
            username=f"loadtest_{self.telegram_id}",
        )

        with self.client.post(
            "/api/auth/telegram",
            json={"init_data": init_data},
            name="/api/auth/telegram [register]",
            catch_response=True,
        ) as resp:
            if resp.status_code != 200:
                resp.failure(f"auth failed: {resp.status_code} {resp.text[:200]}")
                self.token = None
                return
            resp.success()
            body = resp.json()
            self.token = body["token"]
            self.client.headers.update({"Authorization": f"Bearer {self.token}"})
            already_onboarded = body.get("user", {}).get("is_onboarded", False)

        if self.token and not already_onboarded:
            self.client.post(
                "/api/users/me/onboard",
                json={
                    "name": f"Load Test User {self.telegram_id % 10000}",
                    "interest_category": random.choice(INTEREST_CATEGORIES),
                    "exercise_frequency": random.choice(EXERCISE_FREQUENCIES),
                },
                name="/api/users/me/onboard",
            )

    @task(10)
    def browse_home(self):
        """Mirrors HomeScreen.jsx's parallel fetch on load."""
        if not self.token:
            return
        self.client.get("/api/providers", name="/api/providers")
        self.client.get("/api/communities", name="/api/communities")

    @task(5)
    def view_provider_detail(self):
        """Mirrors ExploreScreen -> ProviderDetail."""
        if not self.token:
            return
        resp = self.client.get("/api/providers", name="/api/providers")
        if resp.status_code != 200:
            return
        providers = resp.json().get("providers", [])
        if not providers:
            return
        provider = random.choice(providers)
        self.client.get(f"/api/providers/{provider['id']}", name="/api/providers/[id]")

    @task(1)
    def full_booking_flow(self):
        """Mirrors BookingFlow.jsx: create booking -> initiate payment -> poll status."""
        if not self.token:
            return
        resp = self.client.get("/api/providers", name="/api/providers")
        if resp.status_code != 200:
            return
        providers = [p for p in resp.json().get("providers", []) if p.get("services")]
        if not providers:
            return
        provider = random.choice(providers)
        service = random.choice(provider["services"])

        booking_resp = self.client.post(
            "/api/bookings",
            json={
                "provider_id": provider["id"],
                "service_name": service["name"],
                "slot_datetime": "2026-07-20T10:00:00Z",
                "amount_etb": service.get("price", 500),
                "payment_method": "telebirr",
                "phone_number": "0911234567",
            },
            name="/api/bookings [create]",
        )
        if booking_resp.status_code != 201:
            return
        booking_id = booking_resp.json()["id"]

        self.client.post(
            "/api/payments/telebirr/initiate",
            json={"booking_id": booking_id},
            name="/api/payments/telebirr/initiate",
        )

        # A couple of status polls, like the frontend's usePolling would do
        for _ in range(2):
            time.sleep(1)
            self.client.get(f"/api/payments/{booking_id}/status", name="/api/payments/[id]/status")


class RegistrationSurgeShape(LoadTestShape):
    """Two stages: a sharp ramp to TARGET_USERS within SURGE_SECONDS (a launch
    announcement spike hitting auth/onboard hardest via on_start), then a
    sustained hold at TARGET_USERS for SUSTAIN_SECONDS to see steady-state
    behavior once the surge settles."""

    def tick(self):
        run_time = self.get_run_time()
        total = SURGE_SECONDS + SUSTAIN_SECONDS
        if run_time > total:
            return None
        if run_time < SURGE_SECONDS:
            # Ramp fast: full target spawn rate compressed into SURGE_SECONDS
            spawn_rate = max(1, TARGET_USERS // SURGE_SECONDS)
            return (TARGET_USERS, spawn_rate)
        return (TARGET_USERS, max(1, TARGET_USERS // SURGE_SECONDS))
