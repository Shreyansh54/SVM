import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineX, HiOutlineExclamation, HiOutlineFilter } from 'react-icons/hi';

export default function BatchesPage() {
  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterProduct, setFilterProduct] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState({
    product_id: '', batch_number: '', manufacturing_date: '', expiry_date: '',
    mrp: '', gst_percentage: '12', purchase_price: '', notes: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [bRes, pRes] = await Promise.all([api.get('/batches/'), api.get('/products/')]);
      setBatches(bRes.data); setProducts(pRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...form, product_id: parseInt(form.product_id),
        mrp: parseFloat(form.mrp), gst_percentage: parseFloat(form.gst_percentage),
        purchase_price: parseFloat(form.purchase_price || '0')
      };
      if (editing) {
        const { product_id, ...updateData } = data;
        await api.put(`/batches/${editing.id}`, updateData);
        toast.success('Batch updated');
      } else {
        await api.post('/batches/', data);
        toast.success('Batch created');
      }
      resetForm(); loadAll();
    } catch (err) { toast.error(err.response?.data?.detail || 'Error'); }
  };

  const resetForm = () => {
    setShowModal(false); setEditing(null);
    setForm({ product_id: '', batch_number: '', manufacturing_date: '', expiry_date: '', mrp: '', gst_percentage: '12', purchase_price: '', notes: '' });
  };

  const handleEdit = (b) => {
    setEditing(b);
    setForm({
      product_id: b.product_id, batch_number: b.batch_number,
      manufacturing_date: b.manufacturing_date, expiry_date: b.expiry_date,
      mrp: b.mrp, gst_percentage: b.gst_percentage,
      purchase_price: b.purchase_price, notes: b.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this batch? This only works if there are no stock/sales linked to it.')) return;
    try { await api.delete(`/batches/${id}`); toast.success('Deleted'); loadAll(); }
    catch (err) { toast.error(err.response?.data?.detail || 'Cannot delete'); }
  };

  const handleRecall = async (id) => {
    if (!confirm('⚠️ RECALL this batch? This action marks the batch as defective and prevents further sales.')) return;
    try { await api.put(`/batches/${id}/recall`); toast.success('Batch recalled!'); loadAll(); }
    catch (err) { toast.error('Recall failed'); }
  };

  const statusBadge = (status) => {
    const map = {
      active: 'badge-success',
      recalled: 'bg-red-500/20 text-red-300 px-2 py-0.5 rounded-lg text-xs font-medium',
      expired: 'bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded-lg text-xs font-medium',
    };
    return map[status] || 'badge-info';
  };

  const expiryBadge = (days) => {
    if (days === null || days === undefined) return null;
    if (days <= 0) return <span className="text-red-400 text-xs font-semibold">EXPIRED</span>;
    if (days <= 7) return <span className="text-red-400 text-xs font-semibold">⏰ {days}d left</span>;
    if (days <= 30) return <span className="text-amber-400 text-xs font-medium">📅 {days}d left</span>;
    if (days <= 90) return <span className="text-yellow-400 text-xs font-medium">{days}d left</span>;
    return <span className="text-emerald-400 text-xs">{days}d left</span>;
  };

  const filtered = batches.filter(b => {
    if (filterProduct && b.product_id !== parseInt(filterProduct)) return false;
    if (filterStatus && b.status !== filterStatus) return false;
    return true;
  });

  const stats = {
    total: batches.length,
    active: batches.filter(b => b.status === 'active').length,
    recalled: batches.filter(b => b.status === 'recalled').length,
    expired: batches.filter(b => b.status === 'expired').length,
    expiring30: batches.filter(b => b.status === 'active' && b.days_to_expiry !== null && b.days_to_expiry <= 30).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Batch Management</h1>
          <p className="text-sm text-gray-500 mt-1">Pharma batch tracking & compliance</p>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary flex items-center gap-2">
          <HiOutlinePlus className="w-4 h-4" /> New Batch
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'bg-blue-500/10 text-blue-400' },
          { label: 'Active', value: stats.active, color: 'bg-emerald-500/10 text-emerald-400' },
          { label: 'Expiring ≤30d', value: stats.expiring30, color: 'bg-amber-500/10 text-amber-400' },
          { label: 'Expired', value: stats.expired, color: 'bg-gray-500/10 text-gray-400' },
          { label: 'Recalled', value: stats.recalled, color: 'bg-red-500/10 text-red-400' },
        ].map((s, i) => (
          <div key={i} className="card text-center py-3">
            <p className={`text-2xl font-bold ${s.color.split(' ')[1]}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Product</label>
          <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)} className="select-field text-sm py-1.5">
            <option value="">All Products</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="select-field text-sm py-1.5">
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="recalled">Recalled</option>
          </select>
        </div>
        {(filterProduct || filterStatus) && (
          <button onClick={() => { setFilterProduct(''); setFilterStatus(''); }} className="text-xs text-[#4A6D71] hover:text-[#0A373A] underline pb-2">Clear</button>
        )}
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div> : (
        <div className="table-container">
          <table className="w-full">
            <thead><tr className="table-header">
              <th className="px-4 py-3 text-left">Batch #</th>
              <th className="px-4 py-3 text-left">Product</th>
              <th className="px-4 py-3 text-left">Mfg Date</th>
              <th className="px-4 py-3 text-left">Expiry</th>
              <th className="px-4 py-3 text-right">MRP (₹)</th>
              <th className="px-4 py-3 text-right">GST%</th>
              <th className="px-4 py-3 text-right">Purchase (₹)</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id} className={`table-row ${b.status === 'recalled' ? 'bg-red-500/5' : b.status === 'expired' ? 'bg-gray-500/5' : ''}`}>
                  <td className="px-4 py-3 font-mono font-semibold text-[#1A3D40] text-sm">{b.batch_number}</td>
                  <td className="px-4 py-3 text-gray-300 text-sm">{b.product_name}</td>
                  <td className="px-4 py-3 text-gray-400 text-sm">{b.manufacturing_date}</td>
                  <td className="px-4 py-3">
                    <div className="text-gray-400 text-sm">{b.expiry_date}</div>
                    {expiryBadge(b.days_to_expiry)}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-400 font-semibold text-sm">₹{b.mrp?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-400 text-sm">{b.gst_percentage}%</td>
                  <td className="px-4 py-3 text-right text-gray-400 text-sm">₹{b.purchase_price?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center"><span className={statusBadge(b.status)}>{b.status.toUpperCase()}</span></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {b.status === 'active' && (
                        <button onClick={() => handleRecall(b.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Recall Batch">
                          <HiOutlineExclamation className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleEdit(b)} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-400 hover:bg-primary-500/10 transition-all">
                        <HiOutlinePencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <HiOutlineTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan="9" className="px-4 py-12 text-center text-gray-500">No batches found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && createPortal(
        <div style={{position:'fixed',inset:0,zIndex:9999,backgroundColor:'rgba(10,55,58,0.4)',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'1rem',overflowY:'auto'}}>
          <div style={{width:'100%',maxWidth:'36rem',marginTop:'2rem',marginBottom:'2rem',background:'#FFFFFF',border:'1px solid #E1ECEB',borderRadius:'1rem',padding:'1.5rem',boxShadow:'0 25px 50px rgba(10,55,58,0.10)',backdropFilter:'blur(20px)'}}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[#1A3D40]">{editing ? 'Edit Batch' : 'Create New Batch'}</h2>
              <button onClick={resetForm} className="text-[#4A6D71] hover:text-[#0A373A]"><HiOutlineX className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editing && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Product *</label>
                  <select value={form.product_id} onChange={e => setForm({...form, product_id: e.target.value})} className="select-field" required>
                    <option value="">Select product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} — {p.category || 'Uncategorized'}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Batch Number *</label>
                  <input value={form.batch_number} onChange={e => setForm({...form, batch_number: e.target.value})} className="input-field font-mono" placeholder="e.g. BN-2026-0045" required />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Manufacturing Date *</label>
                  <input type="date" value={form.manufacturing_date} onChange={e => setForm({...form, manufacturing_date: e.target.value})} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Expiry Date *</label>
                  <input type="date" value={form.expiry_date} onChange={e => setForm({...form, expiry_date: e.target.value})} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">MRP (₹) *</label>
                  <input type="number" step="0.01" value={form.mrp} onChange={e => setForm({...form, mrp: e.target.value})} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">GST %</label>
                  <select value={form.gst_percentage} onChange={e => setForm({...form, gst_percentage: e.target.value})} className="select-field">
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Purchase Price (₹)</label>
                  <input type="number" step="0.01" value={form.purchase_price} onChange={e => setForm({...form, purchase_price: e.target.value})} className="input-field" placeholder="Cost price" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="input-field" placeholder="Supplier, storage conditions, etc." />
              </div>
              {/* Margin preview */}
              {form.mrp && form.purchase_price && parseFloat(form.purchase_price) > 0 && (
                <div className="bg-[#F0F6F6] rounded-xl p-3 border border-[#E1ECEB] text-sm">
                  <span className="text-gray-400">Profit margin: </span>
                  <span className={`font-semibold ${((parseFloat(form.mrp) - parseFloat(form.purchase_price)) / parseFloat(form.purchase_price) * 100) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {((parseFloat(form.mrp) - parseFloat(form.purchase_price)) / parseFloat(form.purchase_price) * 100).toFixed(1)}%
                  </span>
                  <span className="text-gray-500 ml-2">(₹{(parseFloat(form.mrp) - parseFloat(form.purchase_price)).toFixed(2)} per unit)</span>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">{editing ? 'Update' : 'Create'} Batch</button>
                <button type="button" onClick={resetForm} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
