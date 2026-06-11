import { useState, useEffect } from 'react';
import { getAdminProducts, getAdminRedemptions, updateProductStock, updateRedemptionStatus } from '../../api/client';
import { showToast } from '../../components/Toast';

const REDEMPTION_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered'];

export default function AdminProducts() {
  const [view, setView] = useState('products');
  const [products, setProducts] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [redemptionStatus, setRedemptionStatus] = useState('');
  const [stockModal, setStockModal] = useState(null);
  const [newStock, setNewStock] = useState('');
  const [loading, setLoading] = useState(true);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await getAdminProducts({ search: search || undefined, status });
      setProducts(res.products || []);
    } catch (err) {
      showToast(err.message, '❌');
    } finally {
      setLoading(false);
    }
  };

  const loadRedemptions = async () => {
    setLoading(true);
    try {
      const res = await getAdminRedemptions({
        status: redemptionStatus || undefined,
        per_page: 100,
      });
      setRedemptions(res.redemptions || []);
    } catch (err) {
      showToast(err.message, '❌');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'products') loadProducts();
    else loadRedemptions();
  }, [view, search, status, redemptionStatus]);

  const saveStock = async () => {
    try {
      await updateProductStock(stockModal.id, parseInt(newStock, 10));
      showToast('Stock updated', '✅');
      setStockModal(null);
      loadProducts();
    } catch (err) { showToast(err.message, '❌'); }
  };

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await updateRedemptionStatus(id, newStatus);
      showToast(`Status updated to ${newStatus}`, '✅');
      loadRedemptions();
    } catch (err) { showToast(err.message, '❌'); }
  };

  return (
    <div>
      <h2 className="section-title">Products & Redemptions</h2>
      <div className="admin-subtabs mb-16">
        <button className={`admin-subtab ${view === 'products' ? 'active' : ''}`} onClick={() => setView('products')}>Inventory</button>
        <button className={`admin-subtab ${view === 'redemptions' ? 'active' : ''}`} onClick={() => setView('redemptions')}>Redemptions</button>
      </div>

      {view === 'products' ? (
        <>
          <div className="flex gap-8 mb-16 flex-wrap">
            <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
            <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          {loading ? (
            <div className="skeleton" style={{ height: 200 }} />
          ) : (
            <div className="admin-card-list">
              {products.map(p => (
                <div key={p.id} className="card">
                  <div className="card-body">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="card-title">{p.name}</h3>
                        <p className="text-sm text-secondary">{p.provider_name} • {p.type}</p>
                        <p className="text-sm">{p.price_etb} pts • Stock: {p.quantity_in_stock} • Redeemed: {p.redemption_count}</p>
                      </div>
                      <span className={`badge ${p.is_active ? 'badge-success' : 'badge-muted'}`}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm mt-12"
                      onClick={() => { setStockModal(p); setNewStock(String(p.quantity_in_stock)); }}
                    >
                      Edit Stock
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex gap-8 mb-16">
            <select className="input" value={redemptionStatus} onChange={e => setRedemptionStatus(e.target.value)}>
              <option value="">All statuses</option>
              {REDEMPTION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {loading ? (
            <div className="skeleton" style={{ height: 200 }} />
          ) : redemptions.length === 0 ? (
            <p className="text-secondary">No redemptions yet.</p>
          ) : (
            <div className="admin-card-list">
              {redemptions.map(r => (
                <div key={r.id} className="card">
                  <div className="card-body">
                    <h3 className="card-title">{r.product_name}</h3>
                    <p className="text-sm text-secondary">{r.user_name} • {r.provider_name}</p>
                    <p className="text-sm">{r.points_spent} pts • {r.type} • {new Date(r.redeemed_at).toLocaleDateString()}</p>
                    {r.redemption_code && <p className="text-sm">Code: {r.redemption_code}</p>}
                    <div className="flex gap-8 mt-12 flex-wrap">
                      <span className="badge badge-muted">{r.delivery_status}</span>
                      {REDEMPTION_STATUSES.filter(s => s !== r.delivery_status).map(s => (
                        <button key={s} className="btn btn-secondary btn-sm" onClick={() => handleStatusUpdate(r.id, s)}>
                          Mark {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {stockModal && (
        <div className="modal-overlay" onClick={() => setStockModal(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="card-title mb-12">Adjust Stock</h3>
            <p className="text-sm mb-8">Product: {stockModal.name}</p>
            <p className="text-sm mb-16">Current Stock: {stockModal.quantity_in_stock}</p>
            <input className="input mb-16" type="number" min="0" value={newStock} onChange={e => setNewStock(e.target.value)} />
            <div className="flex gap-8">
              <button className="btn btn-primary" onClick={saveStock}>Save</button>
              <button className="btn btn-secondary" onClick={() => setStockModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
