import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import { useTelegramHeaderColor } from '../hooks/useTelegramHeaderColor';
import { getProvider, createBooking } from '../api/client';
import { MOCK_TIME_SLOTS, getNextDays } from '../data/mock';
import { showToast } from '../components/Toast';
import Icon from '../components/Icon';
import { useTranslation } from 'react-i18next';
import { track } from '../analytics';
import { promoApplies, computeDiscountEtb, expiryLabel } from '../utils/promo';
import { useAuth } from '../context/AuthContext';
import { effectiveTimeFormat, formatSlot } from '../utils/timeFormat';
import PhoneInput from '../components/PhoneInput';
import { parsePhone } from '../utils/phone';
import { clickableDivProps } from '../utils/a11y';

const STEP_LABELS = ['Service', 'Date & Time', 'Confirm'];

export default function BookingFlow() {
  const { providerId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const { user, updateProfile } = useAuth();
  const timeFormat = effectiveTimeFormat(user);
  const eventId = searchParams.get('event_id') || location.state?.eventId || null;
  const [step, setStep] = useState(0);

  const handleBack = useCallback(() => {
    if (step > 0) setStep(s => s - 1);
    else navigate(-1);
  }, [step, navigate]);
  const { isAvailable: nativeBack } = useTelegramBackButton(handleBack);
  useTelegramHeaderColor('#000000');
  const [provider, setProvider] = useState(location.state?.provider || null);
  const [loading, setLoading] = useState(!provider);

  // Form state
  const [selectedService, setSelectedService] = useState(location.state?.selectedService || null);
  // Multi-day booking: pick several days for the same service — each becomes
  // its own booking. `timeMode` decides whether they share one time
  // ('same', the classic behavior) or each has its own ('perDay').
  const [selectedDates, setSelectedDates] = useState([]);
  const [selectedTime, setSelectedTime] = useState(null); // used when timeMode !== 'perDay'
  const [timeMode, setTimeMode] = useState(null); // null | 'same' | 'perDay'
  const [perDayTimes, setPerDayTimes] = useState({}); // { 'YYYY-MM-DD': '09:00' }
  const [perDayPickerDate, setPerDayPickerDate] = useState(null);
  // Multi-day modal: 'ask-multi' -> "book multiple days?"; 'ask-timeMode' -> "same time on all days?"
  const [multiDayModalStage, setMultiDayModalStage] = useState(null);
  const [pendingNewDay, setPendingNewDay] = useState(null);

  // No in-app payment: our team calls this number to confirm the booking
  // and collect payment in person (see docs/API_CONTRACT.md's pay_on_site note).
  const [phoneResult, setPhoneResult] = useState({ valid: false, e164: null });
  const [booking, setBooking] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Kuriftu gap analysis (Jul 15): some services aren't booked in-app at all —
  // no fixed slots, no upfront payment. Selecting one skips straight to a
  // contact screen instead of the date/payment steps.
  const [showContact, setShowContact] = useState(false);

  const days = getNextDays(7);
  const dayLabel = (dateStr) => {
    const d = days.find(x => x.date === dateStr);
    return d ? `${d.dayName} ${d.dayNumber}` : dateStr;
  };

  useEffect(() => {
    track('booking_start', {
      provider_id: providerId,
      event_id: eventId || undefined,
      // provider passed via state → user came from a card/detail; else deep link
      source: location.state?.selectedService ? 'service_row' : location.state?.provider ? 'book_now_card' : 'direct',
      anchored: promoApplies(provider?.active_promotion) || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId]);

  useEffect(() => {
    // Always fetch the detail response even when a provider came via route
    // state: Explore cards carry the list shape, which lacks the per-user
    // `active_promotion.user_eligible` flag the pricing below depends on.
    getProvider(providerId)
      .then(p => {
        if (p.is_coming_soon) {
          showToast("This provider isn't taking bookings yet.");
          navigate(`/provider/${providerId}`, { replace: true });
          return;
        }
        setProvider(p);
      })
      .catch(() => {
        // keep the route-state copy if the refresh fails; bail out only when
        // there is nothing at all to render
        if (!location.state?.provider) navigate('/explore', { replace: true });
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, navigate]);

  // Pre-select if coming from provider detail or featured event
  useEffect(() => {
    if (location.state?.selectedService) {
      setSelectedService(location.state.selectedService);
    }
  }, [location.state]);

  useEffect(() => {
    if (!showContact) return;
    track('booking_contact_requested', {
      provider_id: providerId,
      service: selectedService?.name,
      has_phone: Boolean(provider?.contact_phone),
      has_email: Boolean(provider?.contact_email),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showContact]);

  useEffect(() => {
    if (selectedService || !eventId || !provider?.services?.length) return;
    const match = provider.services.find(s => s.name === location.state?.eventServiceName);
    if (match) {
      setSelectedService(match);
      return;
    }
    if (location.state?.eventServiceName && location.state?.eventPrice) {
      setSelectedService({ name: location.state.eventServiceName, price: location.state.eventPrice });
    }
  }, [eventId, provider, selectedService, location.state]);

  const basePrice = selectedService?.price || 0;
  const platformFee = Math.round(basePrice * 0.02);
  const subtotal = basePrice + platformFee; // per day
  const numDays = selectedDates.length || 1;
  const totalSubtotal = subtotal * numDays;
  // Presale promo: the client only *predicts* the discount for display — the
  // backend re-derives eligibility and applies it to the booking; we always
  // send the undiscounted per-day amount (see handleConfirm). The discount only
  // ever applies to the first day (a "first visit" promo covering every day
  // of a multi-day booking wouldn't match its own terms).
  const promo = promoApplies(provider?.active_promotion) ? provider.active_promotion : null;
  const predictedDiscount = promo ? computeDiscountEtb(subtotal, promo.discount_pct) : 0;
  const totalPrice = totalSubtotal - predictedDiscount;
  // After creation, the booking row carries the server-applied promotion +
  // combined total across every day (see BookingResponse.total_amount_etb)
  const appliedPromo = booking?.promotion || null;
  const paidTotal = booking?.total_amount_etb ?? (appliedPromo ? totalSubtotal - appliedPromo.discount_etb : totalSubtotal);

  const sortedDates = [...selectedDates].sort();
  const timeFor = (date) => (timeMode === 'perDay' ? perDayTimes[date] : selectedTime);
  // Per-line "date · time" pairs for the summary/confirmation screens.
  const dateTimeLines = () => sortedDates.map(d => ({ date: d, time: timeFor(d) }));

  const toggleDate = (date) => {
    if (eventId) {
      // An event has one fixed date — no multi-select for event bookings;
      // the multi-day modal must never appear for them.
      setSelectedDates([date]);
      return;
    }
    if (selectedDates.includes(date)) {
      setSelectedDates(prev => prev.filter(d => d !== date));
      setPerDayTimes(prev => {
        const next = { ...prev };
        delete next[date];
        return next;
      });
      // Deselecting down to one day resets nothing — mode/times are kept.
      return;
    }
    // The modal only appears the FIRST time the selection grows past one day
    // in this session; subsequent extra days follow the already-chosen mode.
    if (selectedDates.length >= 1 && timeMode === null) {
      setPendingNewDay(date);
      setMultiDayModalStage('ask-multi');
      return;
    }
    const next = [...selectedDates, date];
    setSelectedDates(next);
    if (timeMode === 'perDay') setPerDayPickerDate(date);
  };

  const closeMultiDayModal = () => {
    setMultiDayModalStage(null);
    setPendingNewDay(null);
  };

  const resolveKeepJustNew = () => {
    setSelectedDates([pendingNewDay]);
    setPerDayTimes({});
    closeMultiDayModal();
  };

  const resolveMultiYes = () => setMultiDayModalStage('ask-timeMode');

  const resolveTimeModeSame = () => {
    setTimeMode('same');
    setSelectedDates(prev => [...prev, pendingNewDay]);
    closeMultiDayModal();
  };

  const resolveTimeModePerDay = () => {
    setTimeMode('perDay');
    const nextSelected = [...selectedDates, pendingNewDay].sort();
    setSelectedDates(nextSelected);
    setPerDayPickerDate(nextSelected.find(d => !perDayTimes[d]) || nextSelected[0]);
    closeMultiDayModal();
  };

  const canNext = () => {
    if (step === 0) return selectedService !== null;
    if (step === 1) {
      if (selectedDates.length === 0) return false;
      if (timeMode === 'perDay') return selectedDates.every(d => perDayTimes[d]);
      return selectedTime !== null;
    }
    if (step === 2) return phoneResult.valid;
    return false;
  };

  // No in-app payment gateway: the booking is created `pending` and our team
  // calls `phoneResult.e164` to confirm the slot — payment is collected in
  // person then, not through the app (see docs/API_CONTRACT.md's pay_on_site note).
  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const [primaryDate, ...extraDates] = sortedDates;
      const primaryTime = timeFor(primaryDate);
      const bk = await createBooking({
        provider_id: providerId,
        service_name: selectedService.name,
        slot_datetime: `${primaryDate}T${primaryTime}:00Z`,
        amount_etb: subtotal, // per-day, undiscounted — the backend applies any promo
        payment_method: 'pay_on_site',
        phone_number: phoneResult.e164,
        ...(eventId ? { event_id: eventId } : {}),
        ...(extraDates.length > 0
          ? { additional_slot_datetimes: extraDates.map(d => `${d}T${timeFor(d)}:00Z`) }
          : {}),
      });
      setBooking(bk);
      setConfirmed(true);
      track('booking_confirmed', {
        provider_id: providerId,
        service: selectedService?.name,
        amount_etb: bk?.total_amount_etb ?? totalPrice,
        days: numDays,
      });
      if (bk?.promotion) {
        track('promo_redeemed', {
          provider_id: providerId,
          promotion_id: bk.promotion.id,
          discount_pct: bk.promotion.discount_pct,
          discount_etb: bk.promotion.discount_etb,
        });
      }
      // Save the phone number to the profile for next time — best-effort,
      // never blocks or fails the booking, and only when it actually changed.
      if (phoneResult.e164 && phoneResult.e164 !== user?.phone_number) {
        updateProfile({ phone_number: phoneResult.e164 }).catch(() => {});
      }
    } catch (err) {
      showToast(err.message || 'Could not confirm booking. Try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !provider) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 24, width: '60%', marginBottom: 24 }} />
        {[1,2,3].map(i => (
          <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8 }} />
        ))}
      </div>
    );
  }

  // ─── Direct-Contact Screen ────────────────────────
  // Some providers/services (Kuriftu's standalone wellness offerings) aren't
  // booked online at all — the guest contacts them directly, there's no
  // deposit, and payment happens on-site after the service.
  if (showContact) {
    const hasPhone = Boolean(provider.contact_phone);
    const hasEmail = Boolean(provider.contact_email);
    return (
      <div className="page" id="booking-contact-screen">
        <div className="flex items-center gap-12 mb-20">
          <button className="btn btn-icon btn-secondary" onClick={() => setShowContact(false)} aria-label="Go back">
            <Icon name="chevron-left" size={20} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Book Directly with {provider.name}</h1>
          </div>
        </div>

        <div className="card mb-20">
          <div className="card-body">
            <div className="confirmation-row">
              <span className="confirmation-label">Service</span>
              <span className="confirmation-value">{selectedService?.name}</span>
            </div>
            <div className="confirmation-row" style={{ borderBottom: 'none' }}>
              <span className="confirmation-label">Price</span>
              <span className="confirmation-value">ETB {selectedService?.price?.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
          {t("This service isn't booked through the app — contact {{name}} directly to schedule. No deposit is needed; payment is collected on-site after your visit.", { name: provider.name })}
        </p>

        {hasPhone && (
          // Plain tel: anchor — Telegram's in-app WebView hands non-http(s)
          // schemes to the OS dialer natively; no Telegram SDK call needed
          // (WebApp.openLink() is http(s)-only and would reject a tel: link).
          <a
            className="btn btn-primary btn-block mb-12"
            href={`tel:${provider.contact_phone.replace(/[^\d+]/g, '')}`}
            onClick={() => track('booking_contact_clicked', { provider_id: providerId, method: 'phone' })}
            id="contact-call-btn"
          >
            <Icon name="smartphone" size={18} /> {t('Call')} {provider.contact_phone}
          </a>
        )}
        {hasEmail && (
          <a
            className={`btn btn-block ${hasPhone ? 'btn-outline' : 'btn-primary'}`}
            href={`mailto:${provider.contact_email}?subject=${encodeURIComponent(`Booking: ${selectedService?.name || ''}`)}`}
            onClick={() => track('booking_contact_clicked', { provider_id: providerId, method: 'email' })}
            id="contact-email-btn"
          >
            <Icon name="message-circle" size={18} /> {t('Email')} {provider.contact_email}
          </a>
        )}
        {!hasPhone && !hasEmail && (
          <div className="empty-state">
            <div className="empty-state-text">
              {t('Contact details for this provider are not available yet — check My Bookings or Explore for updates.')}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Confirmation Screen ─────────────────────────
  if (confirmed) {
    return (
      <div className="page" id="booking-confirmation-screen">
        <div className="booking-confirmation">
          <div className="confirmation-check"><Icon name="check" size={28} strokeWidth={2.5} /></div>
          <h2 className="confirmation-title">{t('Booking Request Sent!')}</h2>
          <p className="confirmation-ref">
            Ref: {booking?.reference_number || booking?.id?.slice(0, 12)}
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 auto 16px', maxWidth: 320 }}>
            {t("Our team will call you at {{phone}} to confirm your slot. No payment is needed now — you'll pay {{name}} directly once it's confirmed.", { phone: phoneResult.e164, name: provider.name })}
          </p>
          <div className="confirmation-details">
            <div className="confirmation-row">
              <span className="confirmation-label">Provider</span>
              <span className="confirmation-value">{provider.name}</span>
            </div>
            <div className="confirmation-row">
              <span className="confirmation-label">Service</span>
              <span className="confirmation-value">{selectedService?.name}</span>
            </div>
            {timeMode === 'perDay' ? (
              <div className="confirmation-row" style={{ alignItems: 'flex-start' }}>
                <span className="confirmation-label">{t('Dates & Times')}</span>
                <span className="confirmation-value" style={{ textAlign: 'right' }}>
                  {dateTimeLines().map(({ date, time }) => (
                    <span key={date} style={{ display: 'block' }}>{dayLabel(date)} · {formatSlot(time, timeFormat)}</span>
                  ))}
                </span>
              </div>
            ) : (
              <>
                <div className="confirmation-row">
                  <span className="confirmation-label">{numDays > 1 ? 'Dates' : 'Date'}</span>
                  <span className="confirmation-value">{sortedDates.join(', ')}</span>
                </div>
                <div className="confirmation-row">
                  <span className="confirmation-label">Time</span>
                  <span className="confirmation-value">{formatSlot(selectedTime, timeFormat)}</span>
                </div>
              </>
            )}
            <div className="confirmation-row">
              <span className="confirmation-label">
                Amount{numDays > 1 ? ` (× ${numDays} days)` : ''}
              </span>
              <span className="confirmation-value">ETB {(basePrice * numDays).toLocaleString()}</span>
            </div>
            <div className="confirmation-row">
              <span className="confirmation-label">
                Platform Fee (2%){numDays > 1 ? ` (× ${numDays} days)` : ''}
              </span>
              <span className="confirmation-value">ETB {(platformFee * numDays).toLocaleString()}</span>
            </div>
            {appliedPromo && (
              <div className="confirmation-row">
                <span className="confirmation-label flex items-center gap-4">
                  <Icon name="ticket" size={13} /> {appliedPromo.headline} ({appliedPromo.discount_pct}%)
                </span>
                <span className="confirmation-value" style={{ color: 'var(--accent)' }}>
                  −ETB {appliedPromo.discount_etb.toLocaleString()}
                </span>
              </div>
            )}
            <div className="confirmation-row">
              <span className="confirmation-label" style={{ fontWeight: 700 }}>{t('Total (pay on-site)')}</span>
              <span className="confirmation-value" style={{ fontWeight: 700 }}>ETB {paidTotal.toLocaleString()}</span>
            </div>
          </div>

          {provider.contact_phone && (
            <a
              className="btn btn-outline btn-block"
              href={`tel:${provider.contact_phone.replace(/[^\d+]/g, '')}`}
              onClick={() => track('booking_contact_clicked', { provider_id: providerId, method: 'phone', source: 'request_sent' })}
              id="call-provider-now-btn"
              style={{ marginBottom: 12 }}
            >
              <Icon name="smartphone" size={16} /> {t('Or call {{name}} to confirm now', { name: provider.name })}
            </a>
          )}

          <button className="btn btn-primary btn-block" onClick={() => navigate('/my-bookings')} id="view-my-bookings-btn" style={{ marginBottom: 12 }}>
            {t('View My Bookings')}
          </button>
          <button className="btn btn-outline btn-block" onClick={() => navigate('/home')} id="go-home-btn">
            {t('Back to Home')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page" id="booking-flow-screen">
      {/* Header */}
      <div className="flex items-center gap-12 mb-20">
        {!nativeBack && (
          <button className="btn btn-icon btn-secondary" onClick={handleBack} aria-label="Go back">
            <Icon name="chevron-left" size={20} />
          </button>
        )}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Book at {provider.name}</h1>
        </div>
      </div>

      {/* Step indicators */}
      <div className="booking-steps mb-24">
        {STEP_LABELS.map((label, i) => (
          <div key={i} style={{ display: 'contents' }}>
            <div className={`booking-step-dot ${i === step ? 'active' : i < step ? 'done' : ''}`}>
              <span className="booking-step-num">
                {i < step ? <Icon name="check" size={12} strokeWidth={2.5} /> : i + 1}
              </span>
              <span>{t(label)}</span>
            </div>
            {i < STEP_LABELS.length - 1 && <div className="booking-line" />}
          </div>
        ))}
      </div>

      {/* Step 0: Service Selection */}
      {step === 0 && (
        <div>
          <h2 className="section-title mb-12">{t('Select a Service')}</h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
            {t('You only pay after using the service — no upfront payment.')}
          </p>
          <div className="services-list">
            {provider.services?.map((service, i) => (
              <div
                key={i}
                className={`service-item ${selectedService?.name === service.name ? 'selected' : ''}`}
                {...clickableDivProps(() => setSelectedService(service))}
                aria-label={service.name}
                id={`booking-service-${i}`}
              >
                <div>
                  <div className="service-name">{service.name}</div>
                  <div className="service-duration">
                    {service.duration}
                    {service.booking_method === 'phone' && (
                      <span className="inline-icon-text" style={{ marginLeft: 8, color: 'var(--text-tertiary)' }}>
                        <Icon name="smartphone" size={11} /> {t('Book directly')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="service-price">
                  {service.price != null ? `ETB ${service.price.toLocaleString()}` : t('Price on enquiry')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Date & Time */}
      {step === 1 && (
        <div>
          <h2 className="section-title mb-12">
            {t('Pick a Date')}
            {!eventId && (
              <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: 8 }}>
                {t('— tap to select multiple days')}
              </span>
            )}
          </h2>
          <div className="h-scroll mb-20" style={{ margin: '0 0 20px' }}>
            {days.map(day => (
              <button
                key={day.date}
                className={`chip date-chip ${selectedDates.includes(day.date) ? 'active' : ''}`}
                onClick={() => toggleDate(day.date)}
                id={`date-chip-${day.date}`}
              >
                {day.dayName} {day.dayNumber}
              </button>
            ))}
          </div>

          {timeMode === 'perDay' ? (
            <>
              <h2 className="section-title mb-12">
                {t('Pick a time — Day {{n}} of {{total}}: {{day}}', {
                  n: sortedDates.indexOf(perDayPickerDate) + 1,
                  total: sortedDates.length,
                  day: dayLabel(perDayPickerDate),
                })}
              </h2>
              <div className="flex gap-8 mb-12" style={{ flexWrap: 'wrap' }}>
                {sortedDates.map(d => (
                  <button
                    key={d}
                    className={`chip ${perDayPickerDate === d ? 'active' : ''}`}
                    onClick={() => setPerDayPickerDate(d)}
                    id={`perday-chip-${d}`}
                  >
                    {dayLabel(d)}{perDayTimes[d] ? ` · ${formatSlot(perDayTimes[d], timeFormat)}` : ''}
                  </button>
                ))}
              </div>
              <div className="time-slots">
                {MOCK_TIME_SLOTS.map(slot => (
                  <button
                    key={slot}
                    id={`time-slot-${slot}`}
                    className={`time-slot ${perDayTimes[perDayPickerDate] === slot ? 'selected' : ''}`}
                    onClick={() => {
                      setPerDayTimes(prev => ({ ...prev, [perDayPickerDate]: slot }));
                      const nextWithoutTime = sortedDates.find(d => d !== perDayPickerDate && !perDayTimes[d]);
                      if (nextWithoutTime) setPerDayPickerDate(nextWithoutTime);
                    }}
                  >
                    {formatSlot(slot, timeFormat)}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2 className="section-title mb-12">{t('Pick a Time')}</h2>
              <div className="time-slots">
                {MOCK_TIME_SLOTS.map(slot => (
                  <button
                    key={slot}
                    id={`time-slot-${slot}`}
                    className={`time-slot ${selectedTime === slot ? 'selected' : ''}`}
                    onClick={() => setSelectedTime(slot)}
                  >
                    {formatSlot(slot, timeFormat)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 2: Confirm */}
      {step === 2 && (
        <div style={{ paddingBottom: 260 }}>
          <h2 className="section-title mb-12">{t('Review & Confirm')}</h2>

          {/* Order summary */}
          <div className="card mb-20">
            <div className="card-body">
              <div className="confirmation-row">
                <span className="confirmation-label">Service</span>
                <span className="confirmation-value">{selectedService?.name}</span>
              </div>
              {timeMode === 'perDay' ? (
                <div className="confirmation-row" style={{ alignItems: 'flex-start' }}>
                  <span className="confirmation-label">{t('Dates & Times')}</span>
                  <span className="confirmation-value" style={{ textAlign: 'right' }}>
                    {dateTimeLines().map(({ date, time }) => (
                      <span key={date} style={{ display: 'block' }}>{dayLabel(date)} · {formatSlot(time, timeFormat)}</span>
                    ))}
                  </span>
                </div>
              ) : (
                <div className="confirmation-row">
                  <span className="confirmation-label">{numDays > 1 ? 'Dates & Time' : 'Date & Time'}</span>
                  <span className="confirmation-value">
                    {sortedDates.join(', ')} at {formatSlot(selectedTime, timeFormat)}
                  </span>
                </div>
              )}
              <div className="confirmation-row">
                <span className="confirmation-label">
                  Service Amount{numDays > 1 ? ` (× ${numDays} days)` : ''}
                </span>
                <span className="confirmation-value">ETB {(basePrice * numDays).toLocaleString()}</span>
              </div>
              <div className="confirmation-row" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <span className="confirmation-label">
                  Platform Fee (2%){numDays > 1 ? ` (× ${numDays} days)` : ''}
                </span>
                <span className="confirmation-value">ETB {(platformFee * numDays).toLocaleString()}</span>
              </div>
              {promo && (
                <div className="confirmation-row" id="promo-discount-row">
                  <span className="confirmation-label">
                    <span className="flex items-center gap-4" style={{ display: 'inline-flex' }}>
                      <Icon name="ticket" size={13} /> {promo.headline} ({promo.discount_pct}%)
                    </span>
                    {numDays > 1 && (
                      <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                        {t('Applied to your first day only')}
                      </span>
                    )}
                    {expiryLabel(promo.valid_until) && (
                      <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                        {expiryLabel(promo.valid_until)}
                      </span>
                    )}
                  </span>
                  <span className="confirmation-value" style={{ color: 'var(--accent)' }}>
                    −ETB {predictedDiscount.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="confirmation-row" style={{ borderBottom: 'none' }}>
                <span className="confirmation-label" style={{ fontWeight: 700 }}>{t('Total')}</span>
                <span className="confirmation-value" style={{ color: 'var(--accent)', fontSize: '1.1rem' }}>
                  {promo && predictedDiscount > 0 && (
                    <s style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontSize: '0.85rem', marginRight: 8 }} id="anchor-price">
                      ETB {totalSubtotal.toLocaleString()}
                    </s>
                  )}
                  ETB {totalPrice.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <p className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 12, marginBottom: 16 }}>
            {t('No payment now. Our team will call you to confirm, and you pay {{name}} directly then.', { name: provider.name })}
          </p>

          <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>
            {t('Type your phone number so {{name}} can contact you', { name: provider.name })}
          </label>
          <PhoneInput value={parsePhone(user?.phone_number)} onChange={setPhoneResult} />
        </div>
      )}

      {/* Actions */}
      <div style={{ marginTop: 24 }}>
        {step === 0 && selectedService?.booking_method === 'phone' ? (
          <button
            className="btn btn-primary btn-block"
            onClick={() => setShowContact(true)}
            disabled={!canNext()}
            id="booking-continue-contact-btn"
          >
            {t('Continue')} <Icon name="chevron-right" size={18} />
          </button>
        ) : step < 2 ? (
          <button
            className="btn btn-primary btn-block"
            onClick={() => setStep(s => s + 1)}
            disabled={!canNext()}
            id="booking-next-btn"
          >
            {t('Next')} <Icon name="chevron-right" size={18} />
          </button>
        ) : (
          <button
            className="btn btn-primary btn-block btn-lg"
            onClick={handleConfirm}
            disabled={!canNext() || submitting}
            id="confirm-booking-btn"
          >
            {submitting && <span className="btn-spinner" aria-hidden="true" />}
            {t('Send Booking Request')}
          </button>
        )}
      </div>

      {/* Multi-day modal — local overlay, no portal needed */}
      {multiDayModalStage && (
        <div
          id="multi-day-modal"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24,
          }}
        >
          <div className="card" style={{ maxWidth: 340, width: '100%' }}>
            <div className="card-body">
              {multiDayModalStage === 'ask-multi' ? (
                <>
                  <h3 className="card-title mb-16">{t('Book multiple days?')}</h3>
                  <button className="btn btn-primary btn-block mb-8" onClick={resolveMultiYes} id="multiday-yes-btn">
                    {t('Yes, multiple days')}
                  </button>
                  <button className="btn btn-outline btn-block" onClick={resolveKeepJustNew} id="multiday-no-btn">
                    {t('No — keep just {{day}}', { day: dayLabel(pendingNewDay) })}
                  </button>
                </>
              ) : (
                <>
                  <h3 className="card-title mb-16">{t('Same time on all days?')}</h3>
                  <button className="btn btn-primary btn-block mb-8" onClick={resolveTimeModeSame} id="multiday-same-time-btn">
                    {t('Same time')}
                  </button>
                  <button className="btn btn-outline btn-block" onClick={resolveTimeModePerDay} id="multiday-different-times-btn">
                    {t('Different times')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
