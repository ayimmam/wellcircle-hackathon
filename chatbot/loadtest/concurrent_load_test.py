#!/usr/bin/env python3
"""Isolated concurrent-user load test for the Circler concierge API.

Does NOT modify production code. Hits the live POST /ai/concierge endpoint
with realistic wellness queries and reports latency/error metrics.

Usage:
  python chatbot/loadtest/concurrent_load_test.py
  python chatbot/loadtest/concurrent_load_test.py --url https://well-circle-concierge.vercel.app/ai/concierge
  python chatbot/loadtest/concurrent_load_test.py --levels 1,5,10 --timeout 90
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Any
from urllib import error, request

DEFAULT_URL = "https://well-circle-concierge.vercel.app/ai/concierge"

QUERIES = [
    "Wellness events this week",
    "Affordable gyms around me",
    "Yoga classes this week",
    "Find a spa near Bole",
    "What wellness events are happening this week?",
]

FALLBACK_SNIPPET = "trouble matching"


@dataclass
class RequestResult:
    ok: bool
    latency_ms: float
    status: int | None = None
    error: str | None = None
    timed_out: bool = False
    has_reply: bool = False
    is_fallback: bool = False
    data_source: str | None = None


@dataclass
class LevelReport:
    concurrent_users: int
    total: int = 0
    successful: int = 0
    failed: int = 0
    timeouts: int = 0
    valid_replies: int = 0
    fallback_replies: int = 0
    latencies_ms: list[float] = field(default_factory=list)
    errors: dict[str, int] = field(default_factory=dict)
    wall_time_s: float = 0.0
    skipped: bool = False
    skip_reason: str | None = None

    @property
    def error_rate(self) -> float:
        return (self.failed / self.total * 100) if self.total else 0.0

    @property
    def timeout_rate(self) -> float:
        return (self.timeouts / self.total * 100) if self.total else 0.0

    @property
    def rps(self) -> float:
        return self.total / self.wall_time_s if self.wall_time_s > 0 else 0.0

    def percentile(self, p: float) -> float | None:
        if not self.latencies_ms:
            return None
        sorted_vals = sorted(self.latencies_ms)
        idx = min(len(sorted_vals) - 1, max(0, int(round((p / 100) * (len(sorted_vals) - 1)))))
        return sorted_vals[idx]

    def avg_ms(self) -> float | None:
        return statistics.mean(self.latencies_ms) if self.latencies_ms else None

    @property
    def non_fallback_replies(self) -> int:
        return max(0, self.successful - self.fallback_replies)

    @property
    def fallback_rate(self) -> float:
        return (self.fallback_replies / self.total * 100) if self.total else 0.0

    @property
    def reliable_success_rate(self) -> float:
        return (self.non_fallback_replies / self.total * 100) if self.total else 0.0

    def status_label(self) -> str:
        if self.skipped:
            return "SKIPPED"
        if self.error_rate >= 20 or self.timeout_rate >= 20:
            return "FAIL"
        if self.error_rate >= 5 or self.timeout_rate >= 5 or (self.percentile(95) or 0) > 30000:
            return "WARNING"
        return "PASS"


def _post_concierge(url: str, message: str, timeout_s: float) -> RequestResult:
    payload = json.dumps({"message": message, "history": []}).encode("utf-8")
    req = request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    start = time.perf_counter()
    try:
        with request.urlopen(req, timeout=timeout_s) as resp:
            body = resp.read().decode("utf-8")
            latency_ms = (time.perf_counter() - start) * 1000
            status = resp.status
            try:
                data = json.loads(body)
            except json.JSONDecodeError:
                return RequestResult(
                    ok=False,
                    latency_ms=latency_ms,
                    status=status,
                    error="invalid_json",
                )
            reply = data.get("reply") if isinstance(data, dict) else None
            has_reply = isinstance(reply, str) and bool(reply.strip())
            is_fallback = has_reply and FALLBACK_SNIPPET in reply.lower()
            return RequestResult(
                ok=status == 200 and has_reply,
                latency_ms=latency_ms,
                status=status,
                has_reply=has_reply,
                is_fallback=is_fallback,
                data_source=data.get("data_source") if isinstance(data, dict) else None,
            )
    except error.HTTPError as exc:
        latency_ms = (time.perf_counter() - start) * 1000
        return RequestResult(
            ok=False,
            latency_ms=latency_ms,
            status=exc.code,
            error=f"http_{exc.code}",
        )
    except TimeoutError:
        latency_ms = (time.perf_counter() - start) * 1000
        return RequestResult(ok=False, latency_ms=latency_ms, timed_out=True, error="timeout")
    except error.URLError as exc:
        latency_ms = (time.perf_counter() - start) * 1000
        reason = getattr(exc, "reason", exc)
        is_timeout = "timed out" in str(reason).lower()
        return RequestResult(
            ok=False,
            latency_ms=latency_ms,
            timed_out=is_timeout,
            error="timeout" if is_timeout else f"url_error:{reason}",
        )
    except Exception as exc:  # pragma: no cover - load test harness
        latency_ms = (time.perf_counter() - start) * 1000
        return RequestResult(ok=False, latency_ms=latency_ms, error=type(exc).__name__)


def run_level(url: str, concurrent_users: int, timeout_s: float) -> LevelReport:
    report = LevelReport(concurrent_users=concurrent_users, total=concurrent_users)
    messages = [QUERIES[i % len(QUERIES)] for i in range(concurrent_users)]

    wall_start = time.perf_counter()
    with ThreadPoolExecutor(max_workers=concurrent_users) as pool:
        futures = [
            pool.submit(_post_concierge, url, messages[i], timeout_s)
            for i in range(concurrent_users)
        ]
        for fut in as_completed(futures):
            result = fut.result()
            report.latencies_ms.append(result.latency_ms)
            if result.ok:
                report.successful += 1
                report.valid_replies += 1
                if result.is_fallback:
                    report.fallback_replies += 1
            else:
                report.failed += 1
                if result.timed_out:
                    report.timeouts += 1
                key = result.error or "unknown"
                report.errors[key] = report.errors.get(key, 0) + 1

    report.wall_time_s = time.perf_counter() - wall_start
    return report


def print_report(reports: list[LevelReport], url: str) -> None:
    print(f"\nTarget: {url}")
    print("\n| Concurrent Users | Total | OK | Failed | Error % | Avg ms | P50 ms | P95 ms | P99 ms | RPS | Timeouts | Fallback | Status |")
    print("|-----------------:|------:|---:|-------:|--------:|-------:|-------:|-------:|-------:|----:|---------:|---------:|--------|")
    for r in reports:
        if r.skipped:
            print(
                f"| {r.concurrent_users:>16} | — | — | — | — | — | — | — | — | — | — | — | SKIPPED ({r.skip_reason}) |"
            )
            continue
        avg = r.avg_ms()
        p50 = r.percentile(50)
        p95 = r.percentile(95)
        p99 = r.percentile(99)
        print(
            f"| {r.concurrent_users:>16} | {r.total} | {r.successful} | {r.failed} | "
            f"{r.error_rate:5.1f}% | {avg:6.0f} | {p50:6.0f} | {p95:6.0f} | {p99:6.0f} | "
            f"{r.rps:4.2f} | {r.timeouts:>8} | {r.fallback_replies:>8} | {r.status_label():<6} |"
        )
        if r.errors:
            print(f"  errors: {r.errors}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Circler concierge concurrent load test")
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--levels", default="1,5,10,25,50,100,250,500")
    parser.add_argument("--timeout", type=float, default=90.0, help="Per-request timeout (seconds)")
    parser.add_argument("--abort-error-rate", type=float, default=25.0, help="Stop after this error %")
    parser.add_argument("--tag", default="", help="Result file tag, e.g. production or local")
    parser.add_argument("--abort-fallback-rate", type=float, default=95.0, help="Stop after this fallback %")
    parser.add_argument("--cooldown", type=float, default=3.0, help="Seconds between levels")
    args = parser.parse_args()

    try:
        levels = [int(x.strip()) for x in args.levels.split(",") if x.strip()]
    except ValueError:
        print("Invalid --levels", file=sys.stderr)
        return 1

    # Warm-up
    print(f"Warming up {args.url} ...")
    warm = _post_concierge(args.url, QUERIES[0], args.timeout)
    if not warm.ok:
        print(f"Warm-up failed: status={warm.status} error={warm.error} — aborting.", file=sys.stderr)
        return 1
    print(f"Warm-up OK in {warm.latency_ms:.0f} ms (data_source={warm.data_source}, fallback={warm.is_fallback})")

    reports: list[LevelReport] = []
    for n in levels:
        print(f"\nRunning {n} concurrent users ...", flush=True)
        try:
            report = run_level(args.url, n, args.timeout)
        except Exception as exc:
            report = LevelReport(concurrent_users=n, skipped=True, skip_reason=str(exc))
            reports.append(report)
            break

        reports.append(report)
        print(
            f"  done: ok={report.successful}/{report.total} err={report.error_rate:.1f}% "
            f"fallback={report.fallback_rate:.1f}% non_fallback={report.non_fallback_replies} "
            f"avg={report.avg_ms():.0f}ms p95={report.percentile(95):.0f}ms rps={report.rps:.2f}",
            flush=True,
        )

        if report.error_rate >= args.abort_error_rate:
            print(f"  stopping: error rate {report.error_rate:.1f}% >= {args.abort_error_rate}%")
            remaining = [x for x in levels if x > n]
            for skipped in remaining:
                reports.append(
                    LevelReport(
                        concurrent_users=skipped,
                        skipped=True,
                        skip_reason=f"aborted after {n}-user level (error rate)",
                    )
                )
            break

        if (
            not report.skipped
            and report.fallback_rate >= args.abort_fallback_rate
            and report.concurrent_users >= 10
        ):
            print(
                f"  stopping: fallback rate {report.fallback_rate:.1f}% >= {args.abort_fallback_rate}%"
            )
            remaining = [x for x in levels if x > n]
            for skipped in remaining:
                reports.append(
                    LevelReport(
                        concurrent_users=skipped,
                        skipped=True,
                        skip_reason=f"aborted after {n}-user level (fallback rate)",
                    )
                )
            break

        if n != levels[-1]:
            time.sleep(args.cooldown)

    print_report(reports, args.url)

    prefix = f"{args.tag}_" if args.tag else ""
    out_path = f"chatbot/loadtest/{prefix}results_{int(time.time())}.json"
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(
            {
                "url": args.url,
                "timeout_s": args.timeout,
                "reports": [
                    {
                        "concurrent_users": r.concurrent_users,
                        "skipped": r.skipped,
                        "skip_reason": r.skip_reason,
                        "total": r.total,
                        "successful": r.successful,
                        "failed": r.failed,
                        "timeouts": r.timeouts,
                        "fallback_replies": r.fallback_replies,
                        "non_fallback_replies": r.non_fallback_replies,
                        "fallback_rate_pct": r.fallback_rate,
                        "reliable_success_rate_pct": r.reliable_success_rate,
                        "error_rate_pct": r.error_rate,
                        "timeout_rate_pct": r.timeout_rate,
                        "avg_ms": r.avg_ms(),
                        "p50_ms": r.percentile(50),
                        "p95_ms": r.percentile(95),
                        "p99_ms": r.percentile(99),
                        "rps": r.rps,
                        "wall_time_s": r.wall_time_s,
                        "errors": r.errors,
                        "status": r.status_label(),
                    }
                    for r in reports
                ],
            },
            fh,
            indent=2,
        )
    print(f"\nRaw results saved to {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
