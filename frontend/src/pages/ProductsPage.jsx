import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineX, HiOutlineSearch, HiOutlineUpload } from 'react-icons/hi';

const SCHEDULE_TYPES = ['OTC', 'H', 'H1', 'X', 'G', 'Narcotic'];
const CATEGORIES = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Powder', 'Inhaler', 'Suspension', 'Gel', 'Cream', 'Other'];

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [viewDetail, setViewDetail] = useState(null);
  const INITIAL_FORM = {
    name: '', category: '', mrp: '', pts: '', prp: '', generic_name: '', 
    composition: '', dosage: '', packaging: '', manufacturer: '', schedule_type: '', hsn_code: ''
  };
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { const res = await api.get('/products/'); setProducts(res.data); }
    catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = { 
      ...form, 
      mrp: parseFloat(form.mrp || 0), 
      pts: parseFloat(form.pts || 0), 
      prp: parseFloat(form.prp || 0) 
    };
    try {
      if (editing) { await api.put(`/products/${editing.id}`, data); toast.success('Medicine updated'); }
      else { await api.post('/products/', data); toast.success('Medicine added'); }
      resetForm(); load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Error'); }
  };

  const resetForm = () => {
    setShowModal(false); setEditing(null);
    setForm(INITIAL_FORM);
  };

  const handleEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name, category: p.category || '', mrp: p.mrp || '', pts: p.pts || '', prp: p.prp || '',
      generic_name: p.generic_name || '', composition: p.composition || '',
      dosage: p.dosage || '', packaging: p.packaging || '', manufacturer: p.manufacturer || '', 
      schedule_type: p.schedule_type || '', hsn_code: p.hsn_code || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this medicine?')) return;
    try { await api.delete(`/products/${id}`); toast.success('Deleted'); load(); } catch { toast.error('Failed'); }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      toast.loading('Uploading...', { id: 'upload' });
      const res = await api.post('/upload/products', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(res.data.message, { id: 'upload' });
      if (res.data.errors?.length) res.data.errors.forEach(err => toast.error(err, { duration: 5000 }));
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed', { id: 'upload' });
    }
    e.target.value = '';
  };

  const scheduleColor = (s) => {
    const map = { 'H': 'bg-red-500/15 text-red-400', 'H1': 'bg-orange-500/15 text-orange-400', 'X': 'bg-red-600/20 text-red-300', 'G': 'bg-blue-500/15 text-blue-400', 'OTC': 'bg-emerald-500/15 text-emerald-400', 'J': 'bg-purple-500/15 text-purple-400', 'Narcotic': 'bg-red-900/20 text-red-500' };
    return map[s] || 'bg-gray-500/15 text-gray-400';
  };

  const filtered = products.filter(p => {
    if (filterCat && p.category !== filterCat) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.generic_name || '').toLowerCase().includes(q) ||
        (p.manufacturer || '').toLowerCase().includes(q) || (p.composition || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Medicine Database</h1>
          <p className="text-sm text-gray-500 mt-1">{products.length} medicines registered</p>
        </div>
        <div className="flex gap-2">
          <input type="file" ref={fileRef} onChange={handleUpload} accept=".xlsx,.xls" className="hidden" />
          <button onClick={() => fileRef.current.click()} className="btn-secondary flex items-center gap-2">
            <HiOutlineUpload className="w-4 h-4" /> Upload Excel
          </button>
          <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary flex items-center gap-2">
            <HiOutlinePlus className="w-4 h-4" /> Add Medicine
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-600 bg-[#E3EFEF] rounded-lg px-4 py-2 border border-[#D5E5E4]">
        💡 <strong>Excel format:</strong> Name, MRP, PTS, PRP, Category, Generic Name, Composition, Dosage, Packaging, Manufacturer, HSN Code, Schedule Type
      </div>

      <div className="flex gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, generic, manufacturer, composition..."
              className="input-field pl-10 text-sm" />
          </div>
        </div>
        <div>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="select-field text-sm py-2.5">
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div> : (
        <div className="table-container">
          <table className="w-full">
            <thead><tr className="table-header">
              <th className="px-4 py-3 text-left">Medicine</th>
              <th className="px-4 py-3 text-left">Generic Name</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-center">Schedule</th>
              <th className="px-4 py-3 text-right">MRP (₹)</th>
              <th className="px-4 py-3 text-right">PTS (₹)</th>
              <th className="px-4 py-3 text-right">PRP (₹)</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="table-row cursor-pointer hover:bg-white/[0.03]" onClick={() => setViewDetail(p)}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#1A3D40]">{p.name}</div>
                    {p.dosage && <div className="text-xs text-gray-500 mt-0.5">{p.dosage}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm italic">{p.generic_name || '—'}</td>
                  <td className="px-4 py-3">{p.category ? <span className="badge-info">{p.category}</span> : '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {p.schedule_type ? (
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${scheduleColor(p.schedule_type)}`}>
                        Sch-{p.schedule_type}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-[#1A3D40]">{p.mrp ? p.mrp.toFixed(2) : '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-[#1A3D40]">{p.pts ? p.pts.toFixed(2) : '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-[#1A3D40]">{p.prp ? p.prp.toFixed(2) : '—'}</td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <button onClick={() => handleEdit(p)} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-400 hover:bg-primary-500/10 transition-all"><HiOutlinePencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"><HiOutlineTrash className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan="8" className="px-4 py-12 text-center text-gray-500">No medicines found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail View Modal */}
      {viewDetail && createPortal(
        <div style={{position:'fixed',inset:0,zIndex:9999,backgroundColor:'rgba(10,55,58,0.4)',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'1rem',overflowY:'auto'}} onClick={() => setViewDetail(null)}>
          <div style={{width:'100%',maxWidth:'32rem',marginTop:'2rem',marginBottom:'2rem',background:'#FFFFFF',border:'1px solid #E1ECEB',borderRadius:'1rem',padding:'1.5rem',boxShadow:'0 25px 50px rgba(10,55,58,0.10)',backdropFilter:'blur(20px)'}} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#1A3D40]">Medicine Details</h2>
              <button onClick={() => setViewDetail(null)} className="text-[#4A6D71] hover:text-[#0A373A]"><HiOutlineX className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-700/20 flex items-center justify-center">
                  <span className="text-primary-400 font-bold text-lg">{viewDetail.name[0]}</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#1A3D40]">{viewDetail.name}</h3>
                </div>
                {viewDetail.schedule_type && (
                  <span className={`ml-auto px-3 py-1 rounded-xl text-xs font-bold ${scheduleColor(viewDetail.schedule_type)}`}>
                    Schedule {viewDetail.schedule_type}
                  </span>
                )}
              </div>
              {[
                ['Generic Name', viewDetail.generic_name],
                ['Composition', viewDetail.composition],
                ['Dosage', viewDetail.dosage],
                ['Category', viewDetail.category],
                ['Packaging', viewDetail.packaging],
                ['Manufacturer', viewDetail.manufacturer],
                ['HSN Code', viewDetail.hsn_code],
                ['MRP (₹)', viewDetail.mrp ? viewDetail.mrp.toFixed(2) : '—'],
                ['PTS (₹)', viewDetail.pts ? viewDetail.pts.toFixed(2) : '—'],
                ['PRP (₹)', viewDetail.prp ? viewDetail.prp.toFixed(2) : '—']
              ].map(([label, value]) => value ? (
                <div key={label} className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500">{label}</span>
                  <span className="text-sm text-[#1A3D40] font-medium text-right max-w-[60%]">{value}</span>
                </div>
              ) : null)}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setViewDetail(null); handleEdit(viewDetail); }} className="btn-primary flex-1">Edit</button>
              <button onClick={() => setViewDetail(null)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Create/Edit Modal */}
      {showModal && createPortal(
        <div style={{position:'fixed',inset:0,zIndex:9999,backgroundColor:'rgba(10,55,58,0.4)',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'1rem',overflowY:'auto'}}>
          <div style={{width:'100%',maxWidth:'42rem',marginTop:'2rem',marginBottom:'2rem',background:'#FFFFFF',border:'1px solid #E1ECEB',borderRadius:'1rem',padding:'1.5rem',boxShadow:'0 25px 50px rgba(10,55,58,0.10)',backdropFilter:'blur(20px)'}}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[#1A3D40]">{editing ? 'Edit' : 'Add'} Medicine</h2>
              <button onClick={resetForm} className="text-[#4A6D71] hover:text-[#0A373A]"><HiOutlineX className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Medicine Name *</label>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-field" placeholder="e.g. Paracetamol 500mg" required />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Generic Name</label>
                  <input value={form.generic_name} onChange={e => setForm({...form, generic_name: e.target.value})} className="input-field" placeholder="e.g. Paracetamol" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Category / Dosage Form</label>
                  <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="select-field">
                    <option value="">Select category</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Composition</label>
                  <input value={form.composition} onChange={e => setForm({...form, composition: e.target.value})} className="input-field" placeholder="e.g. Paracetamol IP 500mg + Caffeine 65mg" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Dosage</label>
                  <input value={form.dosage} onChange={e => setForm({...form, dosage: e.target.value})} className="input-field" placeholder="e.g. 500mg, 10ml, 5mg/ml" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Packaging</label>
                  <input value={form.packaging} onChange={e => setForm({...form, packaging: e.target.value})} className="input-field" placeholder="e.g. 10 Tablets/Strip, 100ml Bottle" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Manufacturer</label>
                  <input value={form.manufacturer} onChange={e => setForm({...form, manufacturer: e.target.value})} className="input-field" placeholder="e.g. Sun Pharma" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Drug Schedule</label>
                  <select value={form.schedule_type} onChange={e => setForm({...form, schedule_type: e.target.value})} className="select-field">
                    <option value="">Select schedule</option>
                    {SCHEDULE_TYPES.map(s => <option key={s} value={s}>{s === 'OTC' ? 'OTC (Over the Counter)' : `Schedule ${s}`}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">HSN Code</label>
                  <input value={form.hsn_code} onChange={e => setForm({...form, hsn_code: e.target.value})} className="input-field" placeholder="e.g. 30049099" />
                </div>
                <div className="col-span-2 pt-2 pb-1 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-[#1A3D40] tracking-wide uppercase">Pricing Tiers</h3>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">MRP (₹) *</label>
                  <input type="number" step="0.01" min="0" value={form.mrp} onChange={e => setForm({...form, mrp: e.target.value})} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">PTS (₹) <span className="text-xs text-gray-400">(Price to Stockist)</span> *</label>
                  <input type="number" step="0.01" min="0" value={form.pts} onChange={e => setForm({...form, pts: e.target.value})} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">PRP (₹) <span className="text-xs text-gray-400">(Price to Retailer/Purchaser)</span> *</label>
                  <input type="number" step="0.01" min="0" value={form.prp} onChange={e => setForm({...form, prp: e.target.value})} className="input-field" required />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">Save</button>
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
