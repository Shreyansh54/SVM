import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';

const parseUTCDateTime = (timestamp) => {
  if (!timestamp) return null;
  let dateStr = timestamp;
  if (typeof dateStr === 'string' && !dateStr.includes('Z') && !/\+\d{2}:?\d{2}$/.test(dateStr) && !/-\d{2}:?\d{2}$/.test(dateStr)) {
    dateStr = dateStr + 'Z';
  }
  return new Date(dateStr);
};

import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineX, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';

export default function StockPage() {
  const { isAdmin } = useAuth();
  const [stocks, setStocks] = useState([]);
  const [stockists, setStockists] = useState([]);
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
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
      if (editingId) {
        await api.put(`/stock/${editingId}`, { quantity: parseInt(form.quantity) });
        toast.success('Stock quantity updated');
      } else {
        const data = {
          stockist_id: parseInt(form.stockist_id), product_id: parseInt(form.product_id),
          quantity: parseInt(form.quantity),
          batch_id: form.batch_id ? parseInt(form.batch_id) : null
        };
        await api.post('/stock/add', data);
        toast.success('Stock added');
      }
      closeModal();
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this stock entry?')) return;
    try {
      await api.delete(`/stock/${id}`);
      toast.success('Stock deleted successfully');
      load();
    } catch (err) { toast.error('Failed to delete stock'); }
  };

  const openAddModal = () => {
    setEditingId(null);
    setForm({ stockist_id: '', product_id: '', batch_id: '', quantity: '' });
    setShowModal(true);
  };

  const openEditModal = (s) => {
    setEditingId(s.id);
    setForm({ 
      stockist_id: s.stockist_id.toString(), 
      product_id: s.product_id.toString(), 
      batch_id: s.batch_id ? s.batch_id.toString() : '', 
      quantity: s.quantity.toString() 
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm({ stockist_id: '', product_id: '', batch_id: '', quantity: '' });
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
        {isAdmin && (
          <button onClick={openAddModal} className="btn-primary flex items-center gap-2"><HiOutlinePlus className="w-4 h-4" /> Add Stock</button>
        )}
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stocks.map(s => (
            <div key={s.id} className={`card-hover relative group ${s.batch_status === 'recalled' ? 'border-red-500/30' : s.batch_status === 'expired' ? 'border-gray-500/30' : ''}`}>
              {/* Admin Actions overlay */}
              {isAdmin && (
                <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditModal(s)} className="p-1.5 bg-white/80 backdrop-blur rounded-lg text-primary-500 hover:bg-primary-50 transition-colors shadow-sm" title="Edit Quantity">
                    <HiOutlinePencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="p-1.5 bg-white/80 backdrop-blur rounded-lg text-red-500 hover:bg-red-50 transition-colors shadow-sm" title="Delete Stock">
                    <HiOutlineTrash className="w-4 h-4" />
                  </button>
                </div>
              )}
              
              <div className="flex items-start justify-between pr-16">
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
              {s.last_updated && <p className="text-xs text-gray-600 mt-2">Updated: {parseUTCDateTime(s.last_updated)?.toLocaleDateString()}</p>}
            </div>
          ))}
          {stocks.length === 0 && <div className="col-span-full text-center py-12 text-gray-500">No stock entries</div>}
        </div>
      )}

      {showModal && createPortal(
        <div style={{position:'fixed',inset:0,zIndex:9999,backgroundColor:'rgba(10,55,58,0.4)',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'1rem',overflowY:'auto'}}>
          <div style={{width:'100%',maxWidth:'28rem',marginTop:'2rem',marginBottom:'2rem',background:'#FFFFFF',border:'1px solid #E1ECEB',borderRadius:'1rem',padding:'1.5rem',boxShadow:'0 25px 50px rgba(10,55,58,0.10)',backdropFilter:'blur(20px)'}}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[#1A3D40]">{editingId ? 'Update Stock Quantity' : 'Add Stock'}</h2>
              <button onClick={closeModal} className="text-[#4A6D71] hover:text-[#0A373A]"><HiOutlineX className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Stockist</label>
                <select disabled={!!editingId} value={form.stockist_id} onChange={e => setForm({...form, stockist_id: e.target.value})} className={`select-field ${editingId ? 'bg-gray-50' : ''}`} required>
                  <option value="">Select stockist</option>{stockists.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Product</label>
                <select disabled={!!editingId} value={form.product_id} onChange={e => setForm({...form, product_id: e.target.value, batch_id: ''})} className={`select-field ${editingId ? 'bg-gray-50' : ''}`} required>
                  <option value="">Select product</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {form.product_id && (filteredBatches.length > 0 || editingId) && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Batch <span className="text-xs text-gray-600">(optional)</span></label>
                  <select disabled={!!editingId} value={form.batch_id} onChange={e => setForm({...form, batch_id: e.target.value})} className={`select-field ${editingId ? 'bg-gray-50' : ''}`}>
                    <option value="">No specific batch</option>
                    {filteredBatches.map(b => <option key={b.id} value={b.id}>{b.batch_number} — MRP ₹{b.mrp} | Exp: {b.expiry_date}</option>)}
                    {editingId && !filteredBatches.find(b => b.id == form.batch_id) && form.batch_id && (
                       <option value={form.batch_id}>Batch #{form.batch_id} (Currently selected)</option>
                    )}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Quantity</label>
                <input type="number" min="0" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} className="input-field" required />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">{editingId ? 'Save Changes' : 'Add Stock'}</button>
                <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
