import PromotionForm from '../../components/PromotionForm';

export default function ProviderPortalPromotions() {
  return (
    <div id="provider-portal-promotions" style={{ maxWidth: 480 }}>
      <div className="section-header">
        <h1 className="section-title" style={{ fontSize: '1.3rem' }}>Presale & Promotions</h1>
      </div>
      <p className="text-sm mb-12" style={{ color: 'var(--text-secondary)' }}>
        Active promotions show on your Explore card and provider page. Presale
        discounts are applied automatically when an eligible guest books.
      </p>
      <PromotionForm />
    </div>
  );
}
