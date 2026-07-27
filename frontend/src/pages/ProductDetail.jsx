import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProduct } from '../api/client';
import Icon from '../components/Icon';
import SmartImage from '../components/SmartImage';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProduct(id).then(setProduct).catch(() => navigate('/products')).finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading || !product) {
    return <div className="page"><div className="skeleton" style={{ height: 300 }} /></div>;
  }

  const images = product.images?.length ? product.images : product.image_url ? [product.image_url] : [];

  return (
    <div className="page">
      <button className="btn btn-icon btn-secondary mb-16" onClick={() => navigate(-1)} aria-label="Go back"><Icon name="chevron-left" size={20} /></button>

      {images.length > 0 && (
        <div className="product-carousel mb-16">
          <button className="carousel-btn" onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)}>◀</button>
          <SmartImage src={images[imgIdx]} alt={product.name} className="product-detail-img" width={430} priority />
          <button className="carousel-btn" onClick={() => setImgIdx(i => (i + 1) % images.length)}>▶</button>
        </div>
      )}

      <h1 className="section-title">{product.name}</h1>
      <p className="text-secondary mb-8">
        {product.provider?.name} • <span className="inline-icon-text"><Icon name="star" size={13} /> {product.provider?.rating || '—'}</span> • {product.provider?.location_text}
      </p>
      <p className="product-price-lg mb-16 inline-icon-text">{product.price_etb} Legacy Points <Icon name="leaf" size={16} /></p>

      <div className="card mb-16">
        <div className="card-body">
          <p>{product.description}</p>
          <div className="mt-12 text-sm">
            <p><strong>Type:</strong> {product.type === 'digital' ? 'Digital Voucher' : 'Physical Product'}</p>
            {product.expiry_date && <p><strong>Valid Until:</strong> {new Date(product.expiry_date).toLocaleDateString()}</p>}
            <p><strong>Limit:</strong> {product.max_redemptions_per_user} per user</p>
            {product.provider_instructions && (
              <p className="mt-8"><strong>Instructions:</strong> {product.provider_instructions}</p>
            )}
          </div>
        </div>
      </div>

      <button
        className="btn btn-primary btn-block mb-12"
        disabled={!product.quantity_in_stock}
        onClick={() => navigate(`/products/${id}/redeem`)}
      >
        Redeem for {product.price_etb} Points
      </button>
      {product.provider?.id && (
        <button className="btn btn-secondary btn-block" onClick={() => navigate(`/provider/${product.provider.id}`)}>
          View Studio Profile
        </button>
      )}
    </div>
  );
}
