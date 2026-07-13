import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { getProvider, createBooking, initiateTelebirr, initiateMpesa, getPaymentStatus } from '../api/client';
import { MOCK_TIME_SLOTS, getNextDays } from '../data/mock';
import { showToast } from '../components/Toast';
import Icon from '../components/Icon';
import usePolling from '../hooks/usePolling';
import { useTranslation } from 'react-i18next';
import { track } from '../analytics';
import { promoApplies, computeDiscountEtb } from '../utils/promo';

const STEP_LABELS = ['Service', 'Date & Time', 'Payment'];

export default function BookingFlow() {
  const { providerId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const eventId = searchParams.get('event_id') || location.state?.eventId || null;
  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState(location.state?.provider || null);
  const [loading, setLoading] = useState(!provider);

  // Form state
  const [selectedService, setSelectedService] = useState(location.state?.selectedService || null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [booking, setBooking] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null); // null | 'processing' | 'success' | 'failed'
  const pollAttemptsRef = useRef(0);

  const days = getNextDays(7);

  useEffect(() => {
    track('booking_start', {
      provider_id: providerId,
      event_id: eventId || undefined,
      // provider passed via state → user came from a card/detail; else deep link
      source: location.state?.selectedService ? 'service_row' : location.state?.provider ? 'book_now_card' : 'direct',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId]);

  useEffect(() => {
    // Always fetch the detail response even when a provider came via route
    // state: Explore cards carry the list shape, which lacks the per-user
    // `active_promotion.user_eligible` flag the pricing below depends on.
    getProvider(providerId)
      .then(p => setProvider(p))
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
  const subtotal = basePrice + platformFee;
  // Presale promo: the client only *predicts* the discount for display — the
  // backend re-derives eligibility and applies it to the booking; we always
  // send the undiscounted amount (see handlePay).
  const promo = promoApplies(provider?.active_promotion) ? provider.active_promotion : null;
  const predictedDiscount = promo ? computeDiscountEtb(subtotal, promo.discount_pct) : 0;
  const totalPrice = subtotal - predictedDiscount;
  // After creation, the booking row carries the server-applied promotion
  const appliedPromo = booking?.promotion || null;
  const paidTotal = appliedPromo ? subtotal - appliedPromo.discount_etb : subtotal;

  const canNext = () => {
    if (step === 0) return selectedService !== null;
    if (step === 1) return selectedDate !== null && selectedTime !== null;
    if (step === 2) return paymentMethod !== null && phoneNumber.trim().length >= 9;
    return false;
  };

  // F2: a booking is created before payment is confirmed, so a failed/timed-out
  // payment must NOT re-create the booking on retry — that produced duplicate
  // bookings for one purchase. Retry re-initiates payment against the same
  // booking.id instead of calling createBooking again.
  const initiatePaymentFor = async (bookingId) => {
    if (paymentMethod === 'telebirr') {
      await initiateTelebirr(bookingId);
    } else {
      await initiateMpesa(bookingId, phoneNumber);
    }
  };

  const handlePay = async () => {
    setPaymentStatus('processing');
    pollAttemptsRef.current = 0;
    try {
      const bk = await createBooking({
        provider_id: providerId,
        service_name: selectedService.name,
        slot_datetime: `${selectedDate}T${selectedTime}:00Z`,
        amount_etb: subtotal, // undiscounted — the backend applies any promo
        payment_method: paymentMethod,
        phone_number: phoneNumber,
        ...(eventId ? { event_id: eventId } : {}),
      });
      setBooking(bk);
      await initiatePaymentFor(bk.id);
      // usePolling below picks up payment-status polling now that
      // paymentStatus === 'processing' and booking.id is set.
    } catch (err) {
      setPaymentStatus('failed');
      showToast(err.message || 'Payment initiation failed. Try again.', '❌');
    }
  };

  const handleRetryPayment = async () => {
    if (!booking?.id) return handlePay();
    setPaymentStatus('processing');
    pollAttemptsRef.current = 0;
    try {
      await initiatePaymentFor(booking.id);
    } catch (err) {
      setPaymentStatus('failed');
      showToast(err.message || 'Payment retry failed. Try again.', '❌');
    }
  };

  // B4: was a raw setInterval that kept polling even if the tab was
  // backgrounded or the component unmounted mid-payment; usePolling pauses
  // in the background and cleans up on unmount automatically.
  usePolling(async () => {
    if (!booking?.id) return;
    pollAttemptsRef.current += 1;
    try {
      const status = await getPaymentStatus(booking.id);
      if (status.payment_status === 'success') {
        setPaymentStatus('success');
        setBooking(prev => ({ ...prev, ...status, promotion: prev?.promotion }));
        showToast('Payment confirmed! 🎉', '✅');
        track('booking_confirmed', {
          provider_id: providerId,
          service: selectedService?.name,
          amount_etb: booking?.amount_etb ?? totalPrice,
          payment_method: paymentMethod,
        });
        if (booking?.promotion) {
          track('promo_redeemed', {
            provider_id: providerId,
            promotion_id: booking.promotion.id,
            discount_pct: booking.promotion.discount_pct,
            discount_etb: booking.promotion.discount_etb,
          });
        }
      } else if (status.payment_status === 'failed') {
        setPaymentStatus('failed');
        showToast('Payment failed. Try again.', '❌');
      } else if (pollAttemptsRef.current > 20) {
        // 60 seconds timeout
        setPaymentStatus('failed');
        showToast('Payment confirmation timed out.', '⏳');
      }
    } catch (err) {
      setPaymentStatus('failed');
      showToast('Error checking payment status.', '❌');
    }
  }, 3000, paymentStatus === 'processing');

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

  // ─── Confirmation Screen ─────────────────────────
  if (paymentStatus === 'success') {
    return (
      <div className="page" id="booking-confirmation-screen">
        <div className="booking-confirmation">
          <div className="confirmation-check"><Icon name="check" size={28} strokeWidth={2.5} /></div>
          <h2 className="confirmation-title">{t('Booking Confirmed!')}</h2>
          <p className="confirmation-ref">
            Ref: {booking?.reference_number || booking?.id?.slice(0, 12)}
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
            <div className="confirmation-row">
              <span className="confirmation-label">Date</span>
              <span className="confirmation-value">{selectedDate}</span>
            </div>
            <div className="confirmation-row">
              <span className="confirmation-label">Time</span>
              <span className="confirmation-value">{selectedTime}</span>
            </div>
            <div className="confirmation-row">
              <span className="confirmation-label">Amount</span>
              <span className="confirmation-value">ETB {basePrice.toLocaleString()}</span>
            </div>
            <div className="confirmation-row">
              <span className="confirmation-label">Platform Fee (2%)</span>
              <span className="confirmation-value">ETB {platformFee.toLocaleString()}</span>
            </div>
            {appliedPromo && (
              <div className="confirmation-row">
                <span className="confirmation-label">🏷 {appliedPromo.headline} ({appliedPromo.discount_pct}%)</span>
                <span className="confirmation-value" style={{ color: 'var(--accent)' }}>
                  −ETB {appliedPromo.discount_etb.toLocaleString()}
                </span>
              </div>
            )}
            <div className="confirmation-row">
              <span className="confirmation-label" style={{ fontWeight: 700 }}>Total Paid</span>
              <span className="confirmation-value" style={{ fontWeight: 700 }}>ETB {paidTotal.toLocaleString()}</span>
            </div>
            <div className="confirmation-row">
              <span className="confirmation-label">Payment</span>
              <span className="confirmation-value" style={{ textTransform: 'capitalize' }}>{paymentMethod}</span>
            </div>
          </div>

          <div className="points-chip" style={{ margin: '0 auto 24px', display: 'inline-flex' }}>
            <Icon name="trophy" size={16} />
            <span>+50 Legacy Points (Phase 2)</span>
          </div>

          <button className="btn btn-primary btn-block" onClick={() => navigate('/home')} id="go-home-btn">
            {t('Back to Home')}
          </button>
        </div>
      </div>
    );
  }

  // ─── Processing Screen ───────────────────────────
  if (paymentStatus === 'processing') {
    return (
      <div className="page" id="payment-processing-screen">
        <div style={{ textAlign: 'center', paddingTop: 80 }}>
          <div className="splash-spinner" style={{ margin: '0 auto 24px' }} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>{t('Processing Payment...')}</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {paymentMethod === 'telebirr'
              ? 'Complete the payment on your Telebirr app'
              : 'Check your phone for the M-Pesa prompt'}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 16 }}>
            Polling for confirmation...
          </p>
        </div>
      </div>
    );
  }

  // ─── Failed / Timed-out Screen ───────────────────
  // F2: previously a failed/timed-out payment just toasted and fell back to
  // the step-2 form, where hitting Pay again called createBooking a second
  // time (duplicate booking) instead of retrying the existing one.
  if (paymentStatus === 'failed') {
    return (
      <div className="page" id="payment-failed-screen">
        <div style={{ textAlign: 'center', paddingTop: 80 }}>
          <div className="confirmation-check" style={{ background: 'var(--danger)' }}>
            <Icon name="x" size={28} strokeWidth={2.5} />
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: 16, marginBottom: 8 }}>
            {t('Payment Failed')}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 24, padding: '0 16px' }}>
            {booking
              ? t('Your booking is saved. Retry the payment to confirm it, or check its status in My Bookings.')
              : t('Something went wrong before your booking could be created. Please try again.')}
          </p>
          <button className="btn btn-primary btn-block" style={{ marginBottom: 12 }} onClick={handleRetryPayment} id="retry-payment-btn">
            {t('Retry Payment')}
          </button>
          <button className="btn btn-outline btn-block" onClick={() => navigate('/my-bookings')} id="view-my-bookings-btn">
            {t('View My Bookings')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page" id="booking-flow-screen">
      {/* Header */}
      <div className="flex items-center gap-12 mb-20">
        <button className="btn btn-icon btn-secondary" onClick={() => step > 0 ? setStep(s => s - 1) : navigate(-1)} aria-label="Go back">
          <Icon name="chevron-left" size={20} />
        </button>
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
          <div className="services-list">
            {provider.services?.map((service, i) => (
              <div
                key={i}
                className={`service-item ${selectedService?.name === service.name ? 'selected' : ''}`}
                onClick={() => setSelectedService(service)}
                id={`booking-service-${i}`}
              >
                <div>
                  <div className="service-name">{service.name}</div>
                  <div className="service-duration">{service.duration}</div>
                </div>
                <div className="service-price">ETB {service.price?.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Date & Time */}
      {step === 1 && (
        <div>
          <h2 className="section-title mb-12">{t('Pick a Date')}</h2>
          <div className="h-scroll mb-20" style={{ margin: '0 0 20px' }}>
            {days.map(day => (
              <button
                key={day.date}
                className={`chip date-chip ${selectedDate === day.date ? 'active' : ''}`}
                onClick={() => setSelectedDate(day.date)}
              >
                {day.dayName} {day.dayNumber}
              </button>
            ))}
          </div>

          <h2 className="section-title mb-12">{t('Pick a Time')}</h2>
          <div className="time-slots">
            {MOCK_TIME_SLOTS.map(slot => (
              <button
                key={slot}
                className={`time-slot ${selectedTime === slot ? 'selected' : ''}`}
                onClick={() => setSelectedTime(slot)}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Payment */}
      {step === 2 && (
        <div>
          <h2 className="section-title mb-12">{t('Payment Method')}</h2>

          {/* Order summary */}
          <div className="card mb-20">
            <div className="card-body">
              <div className="confirmation-row">
                <span className="confirmation-label">Service</span>
                <span className="confirmation-value">{selectedService?.name}</span>
              </div>
              <div className="confirmation-row">
                <span className="confirmation-label">Date & Time</span>
                <span className="confirmation-value">{selectedDate} at {selectedTime}</span>
              </div>
              <div className="confirmation-row">
                <span className="confirmation-label">Service Amount</span>
                <span className="confirmation-value">ETB {basePrice.toLocaleString()}</span>
              </div>
              <div className="confirmation-row" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <span className="confirmation-label">Platform Fee (2%)</span>
                <span className="confirmation-value">ETB {platformFee.toLocaleString()}</span>
              </div>
              {promo && (
                <div className="confirmation-row" id="promo-discount-row">
                  <span className="confirmation-label">🏷 {promo.headline} ({promo.discount_pct}%)</span>
                  <span className="confirmation-value" style={{ color: 'var(--accent)' }}>
                    −ETB {predictedDiscount.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="confirmation-row" style={{ borderBottom: 'none' }}>
                <span className="confirmation-label" style={{ fontWeight: 700 }}>{t('Total')}</span>
                <span className="confirmation-value" style={{ color: 'var(--accent)', fontSize: '1.1rem' }}>
                  ETB {totalPrice.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="payment-methods">
            <button
              className={`payment-method ${paymentMethod === 'telebirr' ? 'selected' : ''}`}
              onClick={() => setPaymentMethod('telebirr')}
              id="payment-telebirr"
            >
              <span className="payment-method-icon"><Icon name="smartphone" size={22} /></span>
              <div>
                <div className="payment-method-name">{t('Pay with Telebirr')}</div>
                <div className="payment-method-desc">Ethio Telecom mobile money</div>
              </div>
            </button>
            <button
              className={`payment-method ${paymentMethod === 'mpesa' ? 'selected' : ''}`}
              onClick={() => setPaymentMethod('mpesa')}
              id="payment-mpesa"
            >
              <span className="payment-method-icon"><Icon name="credit-card" size={22} /></span>
              <div>
                <div className="payment-method-name">{t('Pay with M-Pesa')}</div>
                <div className="payment-method-desc">Safaricom Daraja STK Push</div>
              </div>
            </button>
          </div>

          {paymentMethod && (
            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>
                {paymentMethod === 'telebirr' ? 'Phone Number (09XX)' : 'Phone Number (254XXX)'}
              </label>
              <input
                className="onboarding-input"
                placeholder={paymentMethod === 'telebirr' ? '0911234567' : '254712345678'}
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                type="tel"
                id="phone-input"
              />
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ marginTop: 24 }}>
        {step < 2 ? (
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
            onClick={handlePay}
            disabled={!canNext()}
            id="pay-btn"
          >
            <Icon name="coins" size={18} /> Pay ETB {totalPrice.toLocaleString()}
          </button>
        )}
      </div>
    </div>
  );
}
