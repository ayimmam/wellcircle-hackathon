import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getProvider, createBooking, initiateTelebirr, initiateMpesa, getPaymentStatus } from '../api/client';
import { MOCK_TIME_SLOTS, getNextDays } from '../data/mock';
import { showToast } from '../components/Toast';

const STEP_LABELS = ['Service', 'Date & Time', 'Payment'];

export default function BookingFlow() {
  const { providerId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
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

  const days = getNextDays(7);

  useEffect(() => {
    if (!provider) {
      getProvider(providerId)
        .then(p => setProvider(p))
        .catch(() => navigate('/explore', { replace: true }))
        .finally(() => setLoading(false));
    }
  }, [providerId, provider, navigate]);

  // Pre-select if coming from provider detail with a service
  useEffect(() => {
    if (location.state?.selectedService) {
      setSelectedService(location.state.selectedService);
    }
  }, [location.state]);

  const canNext = () => {
    if (step === 0) return selectedService !== null;
    if (step === 1) return selectedDate !== null && selectedTime !== null;
    if (step === 2) return paymentMethod !== null && phoneNumber.trim().length >= 9;
    return false;
  };

  const handlePay = async () => {
    setPaymentStatus('processing');
    try {
      // 1. Create booking
      const bk = await createBooking({
        provider_id: providerId,
        service_name: selectedService.name,
        slot_datetime: `${selectedDate}T${selectedTime}:00Z`,
        amount_etb: selectedService.price,
        payment_method: paymentMethod,
        phone_number: phoneNumber
      });
      setBooking(bk);

      // 2. Initiate payment
      if (paymentMethod === 'telebirr') {
        await initiateTelebirr(bk.id);
      } else {
        await initiateMpesa(bk.id, phoneNumber);
      }

      // 3. Poll payment status
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const status = await getPaymentStatus(bk.id);
          if (status.payment_status === 'success') {
            clearInterval(poll);
            setPaymentStatus('success');
            setBooking(prev => ({ ...prev, ...status }));
            showToast('Payment confirmed! 🎉', '✅');
          } else if (status.payment_status === 'failed') {
            clearInterval(poll);
            setPaymentStatus('failed');
            showToast('Payment failed. Try again.', '❌');
          } else if (attempts > 20) {
            // 60 seconds timeout
            clearInterval(poll);
            setPaymentStatus('failed');
            showToast('Payment confirmation timed out.', '⏳');
          }
        } catch (err) {
          clearInterval(poll);
          setPaymentStatus('failed');
          showToast('Error checking payment status.', '❌');
        }
      }, 3000);
    } catch (err) {
      setPaymentStatus('failed');
      showToast(err.message || 'Payment initiation failed. Try again.', '❌');
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

  // ─── Confirmation Screen ─────────────────────────
  if (paymentStatus === 'success') {
    return (
      <div className="page" id="booking-confirmation-screen">
        <div className="booking-confirmation">
          <div className="confirmation-check">✓</div>
          <h2 className="confirmation-title">Booking Confirmed!</h2>
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
              <span className="confirmation-value">ETB {selectedService?.price?.toLocaleString()}</span>
            </div>
            <div className="confirmation-row">
              <span className="confirmation-label">Payment</span>
              <span className="confirmation-value" style={{ textTransform: 'capitalize' }}>{paymentMethod}</span>
            </div>
          </div>

          <div className="points-chip" style={{ margin: '0 auto 24px', display: 'inline-flex' }}>
            <span>🏆</span>
            <span>+50 Legacy Points (Phase 2)</span>
          </div>

          <button className="btn btn-primary btn-block" onClick={() => navigate('/home')} id="go-home-btn">
            Back to Home
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
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>Processing Payment...</h2>
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

  return (
    <div className="page" id="booking-flow-screen">
      {/* Header */}
      <div className="flex items-center gap-12 mb-20">
        <button className="btn btn-icon btn-secondary" onClick={() => step > 0 ? setStep(s => s - 1) : navigate(-1)}>
          ←
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
              <span className="booking-step-num">{i < step ? '✓' : i + 1}</span>
              <span>{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && <div className="booking-line" />}
          </div>
        ))}
      </div>

      {/* Step 0: Service Selection */}
      {step === 0 && (
        <div>
          <h2 className="section-title mb-12">Select a Service</h2>
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
          <h2 className="section-title mb-12">Pick a Date</h2>
          <div className="h-scroll mb-20" style={{ margin: '0 0 20px' }}>
            {days.map(day => (
              <button
                key={day.date}
                className={`chip ${selectedDate === day.date ? 'active' : ''}`}
                onClick={() => setSelectedDate(day.date)}
                style={{ minWidth: 80, flexDirection: 'column', padding: '10px 14px' }}
              >
                <span style={{ fontSize: '0.7rem' }}>{day.dayName}</span>
                <span style={{ fontWeight: 700 }}>{day.label}</span>
              </button>
            ))}
          </div>

          <h2 className="section-title mb-12">Pick a Time</h2>
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
          <h2 className="section-title mb-12">Payment Method</h2>

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
              <div className="confirmation-row" style={{ borderBottom: 'none' }}>
                <span className="confirmation-label" style={{ fontWeight: 700 }}>Total</span>
                <span className="confirmation-value" style={{ color: 'var(--accent)', fontSize: '1.1rem' }}>
                  ETB {selectedService?.price?.toLocaleString()}
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
              <span className="payment-method-icon">📱</span>
              <div>
                <div className="payment-method-name">Pay with Telebirr</div>
                <div className="payment-method-desc">Ethio Telecom mobile money</div>
              </div>
            </button>
            <button
              className={`payment-method ${paymentMethod === 'mpesa' ? 'selected' : ''}`}
              onClick={() => setPaymentMethod('mpesa')}
              id="payment-mpesa"
            >
              <span className="payment-method-icon">💳</span>
              <div>
                <div className="payment-method-name">Pay with M-Pesa</div>
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
            Next →
          </button>
        ) : (
          <button
            className="btn btn-primary btn-block btn-lg"
            onClick={handlePay}
            disabled={!canNext()}
            id="pay-btn"
          >
            💰 Pay ETB {selectedService?.price?.toLocaleString()}
          </button>
        )}
      </div>
    </div>
  );
}
