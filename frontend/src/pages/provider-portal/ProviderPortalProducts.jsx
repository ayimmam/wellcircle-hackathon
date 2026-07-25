import { useState, useEffect } from 'react';
import { useProviderPortalData } from '../../context/ProviderPortalDataContext';
import {
  getProviderProducts, createProviderProduct, getProviderRedemptions,
  updateProviderRedemptionStatus, getPriceSuggestion,
} from '../../api/client';
import { showToast } from '../../components/Toast';

const REDEMPTION_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered'];

export default function ProviderPortalProducts() {
  const { providerCategory } = useProviderPortalData();
  const [products, setProducts] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', type: 'digital', price_etb: '', quantity_in_stock: '10' });
  const [priceSuggestion, setPriceSuggestion] = useState(null);
  const [redemptionEdits, setRedemptionEdits] = useState({});
  const [updatingRedemptionId, setUpdatingRedemptionId] = useState(null);

  const reloadRedemptions = async () => {
    const r = await getProviderRedemptions();
    setRedemptions(r.redemptions || []);
  };

  useEffect(() => {
    Promise.all([getProviderProducts(), getProviderRedemptions()])
      .then(([p, r]) => {
        setProducts(p.products || []);
        setRedemptions(r.redemptions || []);
      })
      .catch(err => showToast(err.message || 'Could not load products', 'error'));
  }, []);

  const handleUpdateRedemption = async (redemptionId) => {
    const edit = redemptionEdits[redemptionId] || {};
    const status = edit.status || 'confirmed';
    setUpdatingRedemptionId(redemptionId);
    try {
      await updateProviderRedemptionStatus(redemptionId, status, edit.notes || null);
      showToast('Redemption updated', 'success');
      await reloadRedemptions();
    } catch (err) {
      showToast(err.message || 'Could not update redemption', 'error');
    } finally {
      setUpdatingRedemptionId(null);
    }
  };

  return (
    <div id="provider-portal-products">
      <div className="section-header">
        <h1 className="section-title" style={{ fontSize: '1.3rem' }}>Products</h1>
      </div>
      <div className="flex justify-between items-center mb-16">
        <p className="text-sm">Total: {products.length} | Active: {products.filter(p => p.is_active).length}</p>
        <button className="btn btn-primary btn-sm" onClick={() => { setPriceSuggestion(null); setShowCreate(true); }}>+ Create Product</button>
      </div>
      <div className="portal-grid-3 mb-24">
        {products.map(p => (
          <div key={p.id} className="card">
            <div className="card-body">
              <h3 className="card-title text-sm">{p.name}</h3>
              <p className="text-xs text-secondary">{p.type} | {p.price_etb} pts | Stock: {p.quantity_in_stock}</p>
              <span className={`badge ${p.is_active ? 'badge-success' : 'badge-muted'}`}>{p.is_active ? 'Active' : 'Inactive'}</span>
            </div>
          </div>
        ))}
      </div>

      {redemptions.length > 0 && (
        <>
          <h3 className="section-subtitle mb-12">Redeem Management</h3>
          <p className="text-xs text-secondary mb-12">
            Confirm, ship, or mark a redemption delivered — customers see the status update.
          </p>
          <div className="portal-grid-2">
            {redemptions.map(r => {
              const edit = redemptionEdits[r.id] || { status: r.delivery_status, notes: r.provider_notes || '' };
              const setEdit = (patch) => setRedemptionEdits(prev => ({ ...prev, [r.id]: { ...edit, ...patch } }));
              return (
                <div key={r.id} className="card mb-8">
                  <div className="card-body text-sm">
                    <div className="flex justify-between items-center mb-8">
                      <span>{r.user_name} → {r.redemption_code || r.product_name}</span>
                      <span className={`status-badge ${r.delivery_status}`}>{r.delivery_status}</span>
                    </div>
                    {r.delivery_address && (
                      <p className="text-xs text-secondary mb-8">Ships to: {r.delivery_address}</p>
                    )}
                    <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                      <select
                        className="input"
                        style={{ padding: '4px', width: 'auto' }}
                        value={edit.status}
                        onChange={e => setEdit({ status: e.target.value })}
                      >
                        {REDEMPTION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <input
                        className="input"
                        style={{ padding: '4px', flex: 1, minWidth: 120 }}
                        placeholder="Notes for customer (optional)"
                        value={edit.notes}
                        onChange={e => setEdit({ notes: e.target.value })}
                      />
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={updatingRedemptionId === r.id}
                        onClick={() => handleUpdateRedemption(r.id)}
                      >
                        {updatingRedemptionId === r.id ? '…' : 'Update'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="card-title mb-16">Create Product</h3>
            <div className="form-stack">
              <input className="input" placeholder="Name" value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} />
              <select className="input" value={newProduct.type} onChange={e => setNewProduct(p => ({ ...p, type: e.target.value }))}>
                <option value="digital">Digital</option>
                <option value="physical">Physical</option>
              </select>
              <input
                className="input"
                type="number"
                placeholder="Price (points)"
                value={newProduct.price_etb}
                onChange={e => setNewProduct(p => ({ ...p, price_etb: e.target.value }))}
                onFocus={() => {
                  if (priceSuggestion || !providerCategory) return;
                  getPriceSuggestion(providerCategory).then(setPriceSuggestion).catch(() => {});
                }}
              />
              {priceSuggestion?.has_comparables && (
                <button
                  type="button"
                  className="chip"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => setNewProduct(p => ({ ...p, price_etb: String(priceSuggestion.median) }))}
                >
                  {priceSuggestion.suggestion_text}
                </button>
              )}
              <input className="input" type="number" placeholder="Stock" value={newProduct.quantity_in_stock} onChange={e => setNewProduct(p => ({ ...p, quantity_in_stock: e.target.value }))} />
              <button className="btn btn-primary" onClick={async () => {
                try {
                  await createProviderProduct({
                    name: newProduct.name,
                    type: newProduct.type,
                    price_etb: parseInt(newProduct.price_etb, 10),
                    quantity_in_stock: parseInt(newProduct.quantity_in_stock, 10),
                  });
                  showToast('Product created', 'success');
                  setShowCreate(false);
                  const p = await getProviderProducts();
                  setProducts(p.products || []);
                } catch (err) { showToast(err.message, 'error'); }
              }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
