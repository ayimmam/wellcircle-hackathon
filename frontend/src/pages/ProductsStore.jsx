import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProducts } from '../api/client';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon';
import SmartImage from '../components/SmartImage';
import { useTelegramBackButton } from '../hooks/useTelegramBackButton';
import { clickableDivProps } from '../utils/a11y';

export default function ProductsStore() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useTelegramBackButton(() => navigate('/home'));
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [inStock, setInStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    setLoading(true);
    getProducts({ search: search || undefined, type: type || undefined, in_stock_only: inStock })
      .then(res => setProducts(res.products || []))
      .finally(() => setLoading(false));
  }, [search, type, inStock]);

  const recommended = products.filter(p => p.is_recommended);
  const others = products.filter(p => !p.is_recommended);

  return (
    <div className="page">
      <h1 className="section-title mb-8">{t('Legacy Points Store')}</h1>
      <p className="text-secondary mb-16">{t('Your Balance:')} <strong className="inline-icon-text" style={{ color: 'var(--secondary)' }}>{user?.points_balance ?? 0} <Icon name="leaf" size={14} /> {t('pts')}</strong></p>

      <input className="input mb-12" placeholder={t("Search products...")} value={search} onChange={e => setSearch(e.target.value)} />
      <div className="flex gap-8 mb-16 flex-wrap">
        <select className="input" style={{ flex: 1 }} value={type} onChange={e => setType(e.target.value)}>
          <option value="">{t('All Types')}</option>
          <option value="digital">{t('Digital')}</option>
          <option value="physical">{t('Physical')}</option>
        </select>
        <label className="checkbox-row">
          <input type="checkbox" checked={inStock} onChange={e => setInStock(e.target.checked)} />
          <span>{t('In Stock')}</span>
        </label>
      </div>

      {loading ? (
        <div className="product-grid">
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 180 }} />)}
        </div>
      ) : (
        <>
          {recommended.length > 0 && (
            <>
              <h3 className="section-subtitle mb-12">{t('Recommended For You')}</h3>
              <div className="product-grid mb-24">
                {recommended.map(p => <ProductCard key={p.id} product={p} onClick={() => navigate(`/products/${p.id}`)} />)}
              </div>
            </>
          )}
          <h3 className="section-subtitle mb-12">{t('More Products')}</h3>
          <div className="product-grid">
            {(others.length ? others : products).length === 0 ? (
              <p className="text-secondary text-center" style={{ gridColumn: '1 / -1', padding: '24px 0' }}>
                {t('No products found. Try adjusting your filters.')}
              </p>
            ) : (
              (others.length ? others : products).map(p => (
                <ProductCard key={p.id} product={p} onClick={() => navigate(`/products/${p.id}`)} />
              ))
            )}
          </div>
        </>
      )}

      <button className="btn btn-secondary btn-block mt-16" onClick={() => navigate('/users/me/redemptions')}>
        {t('My Redemptions')}
      </button>
    </div>
  );
}

function ProductCard({ product, onClick }) {
  const { t } = useTranslation();
  return (
    <div className="product-card" aria-label={product.name} {...clickableDivProps(onClick)}>
      <SmartImage
        src={product.provider_cover_photo_url || product.image_url}
        alt={product.name}
        className="product-card-img"
        width={200}
      />
      <div className="product-card-body">
        <h4 className="product-card-title">{product.name}</h4>
        <p className="text-sm text-secondary">{product.provider_name}</p>
        <p className="product-card-price">{product.price_etb} {t('pts')}</p>
        <p className="text-xs text-secondary">
          {product.type === 'digital' ? t('Digital') : t('Physical')} | {product.is_in_stock ? `✓ ${t('In Stock')}` : t('Out of Stock')}
        </p>
      </div>
    </div>
  );
}
