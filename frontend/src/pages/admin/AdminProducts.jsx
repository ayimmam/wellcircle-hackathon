import { useState, useEffect } from 'react';
import { getAdminProducts, updateProductStock } from '../../api/client';
import { showToast } from '../../components/Toast';

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [stockModal, setStockModal] = useState(null);
  const [newStock, setNewStock] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
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

  useEffect(() => { load(); }, [search, status]);

  const saveStock = async () => {
    try {
      await updateProductStock(stockModal.id, parseInt(newStock, 10));
      showToast('Stock updated', '✅');
      setStockModal(null);
      load();
    } catch (err) { showToast(err.message, '❌'); }
  };

  return (
    <div>
      <h2 className="section-title">Products Inventory</h2>
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
