"""Pure tests for the deterministic grounding guard."""

from grounding import (
    extract_availability_claims,
    extract_etb_amounts,
    ground_reply,
)
from quality_eval import run_quality_suite


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


def test_extracts_both_ends_of_an_etb_range():
    assert extract_etb_amounts("It costs ETB 800-2500.") == [800, 2500]
    assert extract_etb_amounts("Between 500 and 1,200 ETB.") == [500, 1200]


def test_extracts_single_etb_amounts_in_either_order():
    assert extract_etb_amounts("Only 250 ETB.") == [250]
    assert extract_etb_amounts("Only ETB 250.") == [250]


def test_extracts_availability_count_and_sold_out():
    assert extract_availability_claims("Only 3 spots left.") == ([3], False)
    assert extract_availability_claims("12 spots remaining") == ([12], False)
    assert extract_availability_claims("Only 3 spots for yoga.") == ([3], False)
    assert extract_availability_claims("It is sold out.") == ([], True)


def test_correct_provider_range_is_preserved():
    reply = "Bole Wellness Hub is listed at ETB 800-2500. Want details?"
    result = ground_reply(reply, provider=PROVIDER)
    assert result.violations == ()
    assert result.reply == reply


def test_invented_provider_price_is_replaced_with_canonical_listing():
    result = ground_reply(
        "Bole Wellness Hub costs only 100 ETB. Want details?",
        provider=PROVIDER,
    )
    assert result.violations == ("price",)
    assert "Bole Wellness Hub" in result.reply
    assert "ETB 800-2500" in result.reply
    assert "100 ETB" not in result.reply


def test_user_budget_is_not_treated_as_an_invented_price():
    reply = "Within your 500 ETB budget, Serenity Yoga Studio fits at ETB 500-1200."
    result = ground_reply(
        reply,
        provider=YOGA_PROVIDER,
        user_message="I have 500 ETB",
    )
    assert result.violations == ()
    assert result.reply == reply


def test_generic_budget_reply_without_selected_entity_is_left_alone():
    reply = "Many options are under 500 ETB. What is your neighbourhood?"
    result = ground_reply(reply)
    assert result.violations == ()
    assert result.reply == reply


def test_user_age_is_not_a_price_allowance():
    result = ground_reply(
        "The gym costs 25 ETB.",
        provider=PROVIDER,
        user_message="I am 25 and want a gym",
    )
    assert result.violations == ("price",)
    assert "ETB 800-2500" in result.reply


def test_time_and_headcount_are_not_budget_allowances():
    result = ground_reply(
        "That class costs 2 ETB.",
        event=EVENT,
        user_message="I want a class under 2 hours for 2 people",
    )
    assert result.violations == ("price",)
    assert "ETB 400" in result.reply

    result = ground_reply(
        "That class costs 50 ETB.",
        event=EVENT,
        user_message="I want a class under 50% of the usual price",
    )
    assert result.violations == ("price",)
    assert "ETB 400" in result.reply


def test_explicit_money_survives_the_non_money_filter():
    reply = "Within your 500 ETB budget, Weekend Restorative Yoga is 400 ETB."
    result = ground_reply(
        reply,
        event=EVENT,
        user_message="I have a budget of 500 ETB for under 2 hours",
    )
    assert result.violations == ()
    assert result.reply == reply


def test_correct_event_price_and_spots_are_preserved():
    reply = "Weekend Restorative Yoga is 400 ETB with 12 spots remaining."
    result = ground_reply(reply, event=EVENT)
    assert result.violations == ()
    assert result.reply == reply


def test_invented_event_price_and_spots_are_replaced():
    result = ground_reply(
        "Weekend Restorative Yoga is only 50 ETB with 2 spots left.",
        event=EVENT,
    )
    assert result.violations == ("price", "availability")
    assert "Weekend Restorative Yoga" in result.reply
    assert "ETB 400" in result.reply
    assert "12 spots remaining" in result.reply
    assert "50 ETB" not in result.reply
    assert "2 spots left" not in result.reply


def test_unverified_availability_without_an_event_is_rejected():
    result = ground_reply("I can hold a slot; only 3 spots available.")
    assert result.violations == ("availability",)
    assert "can't verify" in result.reply
    assert "3 spots" not in result.reply


def test_positive_availability_phrase_without_an_event_is_rejected():
    result = ground_reply("There are still spots available.")
    assert result.violations == ("availability",)
    assert "can't verify" in result.reply


def test_positive_availability_phrase_is_allowed_when_spots_remain():
    reply = "There are still spots available."
    result = ground_reply(reply, event=EVENT)
    assert result.violations == ()
    assert result.reply == reply


def test_positive_availability_phrase_is_rejected_when_sold_out():
    sold_out = dict(EVENT, spots_remaining=0)
    result = ground_reply("There are still spots available.", event=sold_out)
    assert result.violations == ("availability",)
    assert "0 spots remaining" in result.reply


def test_sold_out_claim_contradicts_a_listing_with_spots():
    result = ground_reply("The event is sold out.", event=EVENT)
    assert result.violations == ("availability",)
    assert "12 spots remaining" in result.reply


def test_sold_out_claim_is_allowed_at_zero_spots():
    sold_out = dict(EVENT, spots_remaining=0)
    reply = "The event is sold out."
    result = ground_reply(reply, event=sold_out)
    assert result.violations == ()
    assert result.reply == reply


def test_provider_without_numeric_price_cannot_gain_one():
    provider = {
        "id": "fb-006",
        "name": "Private Spa",
        "price_range": "Price on request",
    }
    result = ground_reply("Private Spa costs 300 ETB.", provider=provider)
    assert result.violations == ("price",)
    assert "Price on request" in result.reply
    assert "300 ETB" not in result.reply


def test_extracts_etb_with_colon_and_ethiopian_birr():
    assert extract_etb_amounts("It costs ETB: 800.") == [800]
    assert extract_etb_amounts("It costs 800 Ethiopian birr.") == [800]
    assert extract_etb_amounts("Between ETB 500 and ETB 1,200.") == [500, 1200]


def test_extracts_availability_with_tickets_and_spaces():
    assert extract_availability_claims("Only 3 tickets left.") == ([3], False)
    assert extract_availability_claims("8 spaces remaining") == ([8], False)
    assert extract_availability_claims("There are no spots available.") == ([], True)


def test_free_price_claim_is_rejected_against_a_paid_listing():
    result = ground_reply(
        "Bole Wellness Hub is free for first-time visitors.",
        provider=PROVIDER,
    )
    assert result.violations == ("price",)
    assert "ETB 800-2500" in result.reply
    assert "free" not in result.reply.lower()


def test_free_price_claim_is_rejected_against_a_paid_event():
    result = ground_reply(
        "Weekend Restorative Yoga is free.",
        event=EVENT,
    )
    assert result.violations == ("price",)
    assert "ETB 400" in result.reply


def test_free_price_claim_is_allowed_for_a_free_listing():
    free_event = dict(EVENT, price_etb=0)
    reply = "Weekend Restorative Yoga is free."
    result = ground_reply(reply, event=free_event)
    assert result.violations == ()
    assert result.reply == reply

    free_provider = {"id": "fb-free", "name": "Community Gym", "price_range": "Free"}
    reply = "Community Gym is free."
    result = ground_reply(reply, provider=free_provider)
    assert result.violations == ()
    assert result.reply == reply


def test_contracted_and_adjectival_free_claims_are_checked():
    for reply in (
        "It's free.",
        "That’s complimentary.",
        "Join the free yoga class.",
        "The studio offers free consultation.",
        "Complimentary access is included.",
    ):
        result = ground_reply(reply, provider=PROVIDER)
        assert result.violations == ("price",), reply
        assert "ETB 800-2500" in result.reply

    free_event = {"id": "fe-free", "service_name": "Community Yoga", "price_etb": 0}
    allowed = "It's free."
    result = ground_reply(allowed, event=free_event)
    assert result.violations == ()
    assert result.reply == allowed


def test_free_cancellation_is_not_mistaken_for_a_free_price():
    reply = "Bole Wellness Hub has a free cancellation policy."
    result = ground_reply(reply, provider=PROVIDER)
    assert result.violations == ()
    assert result.reply == reply


def test_for_free_and_free_entry_are_price_claims():
    for reply in (
        "You can join Bole Wellness Hub for free.",
        "Bole Wellness Hub offers free entry.",
    ):
        result = ground_reply(reply, provider=PROVIDER)
        assert result.violations == ("price",)
        assert "ETB 800-2500" in result.reply


def test_no_spots_available_is_not_a_positive_availability_claim():
    sold_out = dict(EVENT, spots_remaining=0)
    reply = "There are no spots available."
    result = ground_reply(reply, event=sold_out)
    assert result.violations == ()
    assert result.reply == reply


def test_no_available_spots_and_all_taken_are_sold_out_claims():
    assert extract_availability_claims("There are no available spots.") == ([], True)
    assert extract_availability_claims("There are not any spots.") == ([], True)
    assert extract_availability_claims("All tickets are taken.") == ([], True)

    result = ground_reply("There are no available spots.", event=EVENT)
    assert result.violations == ("availability",)
    assert "12 spots remaining" in result.reply


def test_booking_claims_are_rejected_even_when_spots_remain():
    result = ground_reply(
        "I can hold a slot for you at Weekend Restorative Yoga.",
        event=EVENT,
    )
    assert result.violations == ("availability",)
    assert "12 spots remaining" in result.reply
    assert "hold a slot" not in result.reply


def test_booking_confirmation_is_rejected_without_an_event():
    for reply in (
        "Your booking is confirmed.",
        "Your spot is reserved.",
    ):
        result = ground_reply(reply)
        assert result.violations == ("availability",)
        assert "can't verify" in result.reply


def test_offline_quality_suite_passes():
    results = run_quality_suite()
    failures = [
        (result.case.name, result.failures) for result in results if not result.passed
    ]
    assert not failures
