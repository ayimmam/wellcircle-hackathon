import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { applyForTrainerVerification, getTrainerVerificationStatus, uploadFile } from '../api/client';
import { showToast } from '../components/Toast';
import Icon from '../components/Icon';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';

const steps = ['Benefits', 'Certificate', 'Payment', 'Review'];

export default function TrainerVerification() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [certificate, setCertificate] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [status, setStatus] = useState(null);

  useTelegramBackButton(() => {
    if (!status && step > 0) {
      setStep(s => s - 1);
    } else {
      navigate(-1);
    }
  });
  const [uploading, setUploading] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getTrainerVerificationStatus().then(setStatus).catch(() => {});
  }, []);

  const upload = async (file, folder) => {
    if (!file) return;
    setUploading(folder);
    try {
      const result = await uploadFile(file, folder);
      if (folder === 'certificates') setCertificate({ ...result, name: file.name });
      else setReceipt({ ...result, name: file.name });
      showToast('Upload complete', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploading('');
    }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const result = await applyForTrainerVerification({
        certificate_url: certificate.url,
        certificate_public_id: certificate.public_id,
        payment_receipt_url: receipt.url,
        payment_receipt_public_id: receipt.public_id,
      });
      setStatus(result);
      showToast('Application submitted', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (status) {
    const rejected = status.status === 'rejected';
    return (
      <div className="page" id="trainer-verification-screen">
        <div className="page-heading">
          <button className="btn btn-icon btn-secondary" onClick={() => navigate(-1)} aria-label="Back"><Icon name="chevron-left" /></button>
          <h1>Trainer Verification</h1>
        </div>
        <div className={`profile-card verification-status ${status.status}`}>
          <div className="verification-status-icon">{status.status === 'approved' ? '✓' : status.status === 'pending' ? '…' : '!'}</div>
          <h2>{status.status === 'approved' ? 'You are a verified trainer' : status.status === 'pending' ? 'Application under review' : 'Application needs attention'}</h2>
          <p>{status.status === 'pending' ? 'We will notify you after an admin reviews your certificate and payment.' : status.rejection_reason || 'Your verified badge is active.'}</p>
          {status.expires_at && <p className="text-sm text-secondary">Valid until {new Date(status.expires_at).toLocaleDateString()}</p>}
          {rejected && <button className="btn btn-primary mt-16" onClick={() => { setStatus(null); setStep(0); }}>Apply again</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="page" id="trainer-verification-screen">
      <div className="page-heading">
        <button className="btn btn-icon btn-secondary" onClick={() => navigate(-1)} aria-label="Back"><Icon name="chevron-left" /></button>
        <h1>Become a Verified Trainer</h1>
      </div>
      <div className="step-indicator">{steps.map((label, index) => <span className={index <= step ? 'active' : ''} key={label}>{index + 1}<small>{label}</small></span>)}</div>

      {step === 0 && (
        <div className="profile-card">
          <h2 className="mb-8">Build trust with a verified badge</h2>
          <p className="text-secondary mb-16">Verified trainers receive a profile badge, discovery priority, and eligibility to monetize qualified circles.</p>
          <ul className="feature-list mb-16">
            <li>✓ Annual verification</li><li>✓ Certificate reviewed by Well Circle</li><li>✓ ETB 200 per year</li>
          </ul>
          <button className="btn btn-primary btn-block" onClick={() => setStep(1)}>Start application</button>
        </div>
      )}
      {step === 1 && (
        <UploadStep title="Upload your certificate" description="PDF, JPG or PNG, up to 10 MB." accept=".pdf,image/jpeg,image/png" result={certificate} busy={uploading === 'certificates'} onChange={file => upload(file, 'certificates')} onNext={() => setStep(2)} onBack={() => setStep(0)} />
      )}
      {step === 2 && (
        <UploadStep title="Upload payment receipt" description="Pay ETB 200 using the payment instructions, then upload a JPG or PNG receipt." accept="image/jpeg,image/png" result={receipt} busy={uploading === 'receipts'} onChange={file => upload(file, 'receipts')} onNext={() => setStep(3)} onBack={() => setStep(1)} />
      )}
      {step === 3 && (
        <div className="profile-card">
          <h2 className="mb-16">Review application</h2>
          <div className="confirmation-row"><span>Certificate</span><strong>{certificate?.name}</strong></div>
          <div className="confirmation-row"><span>Payment receipt</span><strong>{receipt?.name}</strong></div>
          <div className="confirmation-row"><span>Annual fee</span><strong>ETB 200</strong></div>
          <div className="flex gap-8 mt-16">
            <button className="btn btn-secondary" onClick={() => setStep(2)}>Back</button>
            <button className="btn btn-primary" disabled={submitting} onClick={submit}>{submitting ? 'Submitting…' : 'Submit application'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function UploadStep({ title, description, accept, result, busy, onChange, onNext, onBack }) {
  return (
    <div className="profile-card upload-step">
      <h2 className="mb-8">{title}</h2>
      <p className="text-secondary mb-16">{description}</p>
      <label className="file-drop">
        <input type="file" accept={accept} onChange={event => onChange(event.target.files?.[0])} />
        <span>{busy ? 'Uploading…' : result ? `✓ ${result.name}` : 'Choose file'}</span>
      </label>
      <div className="flex gap-8 mt-16">
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
        <button className="btn btn-primary" disabled={!result || busy} onClick={onNext}>Continue</button>
      </div>
    </div>
  );
}
