import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineX } from 'react-icons/hi';

export default function StockPage() {
  const [stocks, setStocks] = useState([]);
  const [stockists, setStockists] = useState([]);
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ stockist_id: '', product_id: '', batch_id: '', quantity: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [skRes, stRes, pRes, bRes] = await Promise.all([
        api.get('/stock/'), api.get('/stockists/'), api.get('/products/'), api.get('/batches/')
      ]);
      setStocks(skRes.data); setStockists(stRes.data); setProducts(pRes.data); setBatches(bRes.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        stockist_id: parseInt(form.stockist_id), product_id: parseInt(form.product_id),
        quantity: parseInt(form.quantity),
        batch_id: form.batch_id ? parseInt(form.batch_id) : null
      };
      await api.post('/stock/add', data);
      toast.success('Stock added');
      setShowModal(false); setForm({ stockist_id: '', product_id: '', batch_id: '', quantity: '' }); load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Error'); }
  };

  const getStockLevel = (qty) => {
    if (qty < 100) return 'badge-danger';
    if (qty < 500) return 'badge-warning';
    return 'badge-success';
  };

  // Filter batches by selected product (only active ones)
  const filteredBatches = batches.filter(b => b.product_id == form.product_id && b.status === 'active');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="page-title">Stock Inventory</h1><p className="text-sm text-gray-500 mt-1">{stocks.length} stock entries</p></div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2"><HiOutlinePlus className="w-4 h-4" /> Add Stock</button>
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stocks.map(s => (
            <div key={s.id} className={`card-hover ${s.batch_status === 'recalled' ? 'border-red-500/30' : s.batch_status === 'expired' ? 'border-gray-500/30' : ''}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-[#1A3D40]">{s.product_name || `Product #${s.product_id}`}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{s.stockist_name || `Stockist #${s.stockist_id}`}</p>
                  {s.batch_number && (
                    <p className="text-xs text-primary-400 font-mono mt-1">
                      🏷️ {s.batch_number}
                      {s.batch_status === 'recalled' && <span className="ml-2 text-red-400 font-sans font-semibold">RECALLED</span>}
                      {s.batch_status === 'expired' && <span className="ml-2 text-gray-400 font-sans">EXPIRED</span>}
                    </p>
                  )}
                  {s.expiry_date && (
                    <p className="text-xs text-gray-500 mt-0.5">Exp: {s.expiry_date}</p>
                  )}
                </div>
                <span className={getStockLevel(s.quantity)}>{s.quantity} units</span>
              </div>
              <div className="mt-4 h-2 bg-[#E3EFEF] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${
                  s.quantity < 100 ? 'bg-red-500' : s.quantity < 500 ? 'bg-amber-500' : 'bg-emerald-500'
                }`} style={{ width: `${Math.min(100, (s.quantity / 1000) * 100)}%` }} />
              </div>
              {s.last_updated && <p className="text-xs text-gray-600 mt-2">Updated: {new Date(s.last_updated).toLocaleDateString()}</p>}
            </div>
          ))}
          {stocks.length === 0 && <div className="col-span-full text-center py-12 text-gray-500">No stock entries</div>}
        </div>
      )}

      {showModal && createPortal(
        <div style={{position:'fixed',inset:0,zIndex:9999,backgroundColor:'rgba(10,55,58,0.4)',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'1rem',overflowY:'auto'}}>
          <div style={{width:'100%',maxWidth:'28rem',marginTop:'2rem',marginBottom:'2rem',background:'#FFFFFF',border:'1px solid #E1ECEB',borderRadius:'1rem',padding:'1.5rem',boxShadow:'0 25px 50px rgba(10,55,58,0.10)',backdropFilter:'blur(20px)'}}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[#1A3D40]">Add Stock</h2>
              <button onClick={() => setShowModal(false)} className="text-[#4A6D71] hover:text-[#0A373A]"><HiOutlineX className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Stockist</label>
                <select value={form.stockist_id} onChange={e => setForm({...form, stockist_id: e.target.value})} className="select-field" required>
                  <option value="">Select stockist</option>{stockists.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Product</label>
                <select value={form.product_id} onChange={e => setForm({...form, product_id: e.target.value, batch_id: ''})} className="select-field" required>
                  <option value="">Select product</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {form.product_id && filteredBatches.length > 0 && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Batch <span className="text-xs text-gray-600">(optional)</span></label>
                  <select value={form.batch_id} onChange={e => setForm({...form, batch_id: e.target.value})} className="select-field">
                    <option value="">No specific batch</option>
                    {filteredBatches.map(b => <option key={b.id} value={b.id}>{b.batch_number} — MRP ₹{b.mrp} | Exp: {b.expiry_date}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Quantity</label>
                <input type="number" min="1" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} className="input-field" required />
              </div>
              <div className="flex gap-3 pt-2"><button type="submit" className="btn-primary flex-1">Add Stock</button><button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button></div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
