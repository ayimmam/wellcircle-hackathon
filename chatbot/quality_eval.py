"""Offline response-quality evaluation for concierge grounding.

Run directly without pytest or any third-party package:

    python chatbot/quality_eval.py

The suite exercises the deterministic price/availability guard with scripted
model replies. It is intentionally fixture-based: a real model call would make
the result non-deterministic and would require credentials. The same cases are
also exercised through the FastAPI endpoint in the pytest suite when those
dependencies are installed.
"""

from __future__ import annotations

from dataclasses import dataclass

from grounding import ground_reply


PROVIDER = {
    "id": "fb-001",
    "name": "Bole Wellness Hub",
    "price_range": "ETB 800-2500",
}
YOGA_PROVIDER = {
    "id": "fb-002",
    "name": "Serenity Yoga Studio",
    "price_range": "ETB 500-1200",
}
EVENT = {
    "id": "fe-002",
    "provider_id": "fb-002",
    "service_name": "Weekend Restorative Yoga",
    "price_etb": 400,
    "spots_remaining": 12,
}
SOLD_OUT_EVENT = {
    "id": "fe-003",
    "provider_id": "fb-002",
    "service_name": "Full Moon Yoga",
    "price_etb": 300,
    "spots_remaining": 0,
}
ON_REQUEST_PROVIDER = {
    "id": "fb-006",
    "name": "Private Spa",
    "price_range": "Price on request",
}
FREE_PROVIDER = {
    "id": "fb-free",
    "name": "Community Gym",
    "price_range": "Free",
}
FREE_EVENT = {
    "id": "fe-free",
    "provider_id": "fb-free",
    "service_name": "Community Yoga",
    "price_etb": 0,
    "spots_remaining": 5,
}


@dataclass(frozen=True)
class QualityCase:
    name: str
    reply: str
    expected_violations: tuple[str, ...]
    provider: dict | None = None
    event: dict | None = None
    user_message: str = ""
    required_substrings: tuple[str, ...] = ()
    forbidden_substrings: tuple[str, ...] = ()


CASES = (
    QualityCase(
        name="correct provider range is preserved",
        reply="Bole Wellness Hub is listed at ETB 800-2500. Want details?",
        provider=PROVIDER,
        expected_violations=(),
    ),
    QualityCase(
        name="invented provider price is replaced",
        reply="Bole Wellness Hub costs only 100 ETB. Want details?",
        provider=PROVIDER,
        expected_violations=("price",),
        required_substrings=("Bole Wellness Hub", "ETB 800-2500"),
        forbidden_substrings=("100 ETB",),
    ),
    QualityCase(
        name="user's own budget is not treated as invented",
        reply="Within your 500 ETB budget, Serenity Yoga Studio fits at ETB 500-1200.",
        provider=YOGA_PROVIDER,
        user_message="I have 500 ETB",
        expected_violations=(),
    ),
    QualityCase(
        name="correct event price and spots are preserved",
        reply="Weekend Restorative Yoga is 400 ETB with 12 spots remaining.",
        event=EVENT,
        expected_violations=(),
    ),
    QualityCase(
        name="invented event price is replaced",
        reply="Weekend Restorative Yoga is only 50 ETB.",
        event=EVENT,
        expected_violations=("price",),
        required_substrings=("Weekend Restorative Yoga", "ETB 400"),
        forbidden_substrings=("50 ETB",),
    ),
    QualityCase(
        name="invented availability count is replaced",
        reply="Only 2 spots left for Weekend Restorative Yoga.",
        event=EVENT,
        expected_violations=("availability",),
        required_substrings=("12 spots remaining",),
        forbidden_substrings=("only 2 spots", "2 spots left"),
    ),
    QualityCase(
        name="unverified availability without an event is rejected",
        reply="I can hold a slot; only 3 spots available.",
        expected_violations=("availability",),
        required_substrings=("can't verify",),
    ),
    QualityCase(
        name="positive availability phrase without an event is rejected",
        reply="There are still spots available.",
        expected_violations=("availability",),
        required_substrings=("can't verify",),
    ),
    QualityCase(
        name="positive availability phrase is allowed when spots remain",
        reply="There are still spots available.",
        event=EVENT,
        expected_violations=(),
    ),
    QualityCase(
        name="positive availability phrase is rejected when sold out",
        reply="There are still spots available.",
        event=SOLD_OUT_EVENT,
        expected_violations=("availability",),
        required_substrings=("0 spots remaining", "sold out"),
    ),
    QualityCase(
        name="generic budget sentence with no selected listing is preserved",
        reply="Many options are under 500 ETB. What is your neighbourhood?",
        expected_violations=(),
    ),
    QualityCase(
        name="user age is not reused as a price",
        reply="Bole Wellness Hub costs 25 ETB.",
        provider=PROVIDER,
        user_message="I am 25 and want a gym",
        expected_violations=("price",),
        required_substrings=("ETB 800-2500",),
        forbidden_substrings=("25 ETB",),
    ),
    QualityCase(
        name="sold-out claim contradicts positive spots",
        reply="The event is sold out.",
        event=EVENT,
        expected_violations=("availability",),
        required_substrings=("12 spots remaining",),
    ),
    QualityCase(
        name="sold-out claim is allowed when spots_remaining is zero",
        reply="Full Moon Yoga is sold out.",
        event=SOLD_OUT_EVENT,
        expected_violations=(),
    ),
    QualityCase(
        name="provider without numeric price cannot gain one",
        reply="Private Spa costs 300 ETB.",
        provider=ON_REQUEST_PROVIDER,
        expected_violations=("price",),
        required_substrings=("Price on request",),
        forbidden_substrings=("300 ETB",),
    ),
    QualityCase(
        name="free claim is rejected against a paid provider",
        reply="Bole Wellness Hub is free for first-time visitors.",
        provider=PROVIDER,
        expected_violations=("price",),
        required_substrings=("ETB 800-2500",),
        forbidden_substrings=("is free",),
    ),
    QualityCase(
        name="free claim is allowed for a free listing",
        reply="Community Gym is free.",
        provider=FREE_PROVIDER,
        expected_violations=(),
    ),
    QualityCase(
        name="zero-price event is allowed to be described as free",
        reply="Community Yoga is free.",
        event=FREE_EVENT,
        expected_violations=(),
    ),
    QualityCase(
        name="free cancellation is not a price claim",
        reply="Bole Wellness Hub has a free cancellation policy.",
        provider=PROVIDER,
        expected_violations=(),
    ),
    QualityCase(
        name="no spots available is not a positive availability claim",
        reply="There are no spots available.",
        event=SOLD_OUT_EVENT,
        expected_violations=(),
    ),
    QualityCase(
        name="reservation claim is not allowed by listing availability",
        reply="I can hold a slot for you at Weekend Restorative Yoga.",
        event=EVENT,
        expected_violations=("availability",),
        required_substrings=("12 spots remaining",),
        forbidden_substrings=("hold a slot",),
    ),
    QualityCase(
        name="etb with colon is still checked",
        reply="Bole Wellness Hub costs ETB: 100.",
        provider=PROVIDER,
        expected_violations=("price",),
        required_substrings=("ETB 800-2500",),
    ),
    QualityCase(
        name="ethiopian birr is still checked",
        reply="Bole Wellness Hub costs 100 Ethiopian birr.",
        provider=PROVIDER,
        expected_violations=("price",),
        required_substrings=("ETB 800-2500",),
        forbidden_substrings=("100 Ethiopian birr",),
    ),
)


@dataclass(frozen=True)
class QualityResult:
    case: QualityCase
    violations: tuple[str, ...]
    reply: str
    passed: bool
    failures: tuple[str, ...]


def run_quality_suite(cases: tuple[QualityCase, ...] = CASES) -> list[QualityResult]:
    results: list[QualityResult] = []
    for case in cases:
        grounded = ground_reply(
            case.reply,
            provider=case.provider,
            event=case.event,
            user_message=case.user_message,
        )
        failures: list[str] = []
        if grounded.violations != case.expected_violations:
            failures.append(
                f"violations {grounded.violations!r} != {case.expected_violations!r}"
            )
        for text in case.required_substrings:
            if text not in grounded.reply:
                failures.append(f"missing {text!r}")
        for text in case.forbidden_substrings:
            if text in grounded.reply:
                failures.append(f"found forbidden {text!r}")
        results.append(
            QualityResult(
                case=case,
                violations=grounded.violations,
                reply=grounded.reply,
                passed=not failures,
                failures=tuple(failures),
            )
        )
    return results


def main() -> int:
    results = run_quality_suite()
    for result in results:
        status = "PASS" if result.passed else "FAIL"
        print(f"[{status}] {result.case.name}")
        if not result.passed:
            for failure in result.failures:
                print(f"       {failure}")
    passed = sum(result.passed for result in results)
    print(f"\n{passed}/{len(results)} response-quality cases passed")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
