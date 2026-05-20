import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineX, HiOutlineUpload } from 'react-icons/hi';

export default function StockistsPage() {
  const [stockists, setStockists] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', location: '', contact_person: '', phone: '', gstin: '' });
  const [loading, setLoading] = useState(true);
  const fileRef = useRef(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { const res = await api.get('/stockists/'); setStockists(res.data); }
    catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await api.put(`/stockists/${editing.id}`, form); toast.success('Updated'); }
      else { await api.post('/stockists/', form); toast.success('Added'); }
      setShowModal(false); setEditing(null); setForm({ name: '', location: '', contact_person: '', phone: '', gstin: '' }); load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Error'); }
  };

  const handleEdit = (s) => { setEditing(s); setForm({ name: s.name, location: s.location || '', contact_person: s.contact_person || '', phone: s.phone || '', gstin: s.gstin || '' }); setShowModal(true); };

  const handleDelete = async (id) => {
    if (!confirm('Delete?')) return;
    try { await api.delete(`/stockists/${id}`); toast.success('Deleted'); load(); } catch { toast.error('Failed'); }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      toast.loading('Uploading...', { id: 'upload' });
      const res = await api.post('/upload/stockists', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(res.data.message, { id: 'upload' });
      if (res.data.errors?.length) res.data.errors.forEach(err => toast.error(err, { duration: 5000 }));
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed', { id: 'upload' });
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="page-title">Stockists</h1><p className="text-sm text-gray-500 mt-1">{stockists.length} stockists</p></div>
        <div className="flex gap-2">
          <input type="file" ref={fileRef} onChange={handleUpload} accept=".xlsx,.xls" className="hidden" />
          <button onClick={() => fileRef.current.click()} className="btn-secondary flex items-center gap-2">
            <HiOutlineUpload className="w-4 h-4" /> Upload Excel
          </button>
          <button onClick={() => { setEditing(null); setForm({ name: '', location: '', contact_person: '', phone: '', gstin: '' }); setShowModal(true); }} className="btn-primary flex items-center gap-2"><HiOutlinePlus className="w-4 h-4" /> Add Stockist</button>
        </div>
      </div>

      {/* Excel format hint */}
      <div className="text-xs text-gray-600 bg-[#E3EFEF] rounded-lg px-4 py-2 border border-[#D5E5E4]">
        💡 <strong>Excel format:</strong> Name, Location, Contact Person, Phone
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div> : (
        <div className="table-container">
          <table className="w-full">
            <thead><tr className="table-header">
              <th className="px-6 py-4 text-left">Name</th><th className="px-6 py-4 text-left">Location</th>
              <th className="px-6 py-4 text-left">GSTIN</th>
              <th className="px-6 py-4 text-left">Contact Person</th><th className="px-6 py-4 text-left">Phone</th><th className="px-6 py-4 text-right">Actions</th>
            </tr></thead>
            <tbody>
              {stockists.map(s => (
                <tr key={s.id} className="table-row">
                  <td className="px-6 py-4 font-medium text-[#1A3D40]">{s.name}</td>
                  <td className="px-6 py-4 text-gray-400 text-sm">{s.location || '—'}</td>
                  <td className="px-6 py-4"><span className="font-mono text-xs text-primary-400 bg-primary-500/10 px-2 py-1 rounded">{s.gstin || 'Unregistered'}</span></td>
                  <td className="px-6 py-4 text-gray-400 text-sm">{s.contact_person || '—'}</td>
                  <td className="px-6 py-4 text-gray-400 text-sm">{s.phone || '—'}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => handleEdit(s)} className="text-gray-400 hover:text-primary-400"><HiOutlinePencil className="w-4 h-4 inline" /></button>
                    <button onClick={() => handleDelete(s.id)} className="text-gray-400 hover:text-red-400"><HiOutlineTrash className="w-4 h-4 inline" /></button>
                  </td>
                </tr>
              ))}
              {stockists.length === 0 && <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">No stockists found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showModal && createPortal(
        <div style={{position:'fixed',inset:0,zIndex:9999,backgroundColor:'rgba(10,55,58,0.4)',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'1rem',overflowY:'auto'}}>
          <div style={{width:'100%',maxWidth:'32rem',marginTop:'2rem',marginBottom:'2rem',background:'#FFFFFF',border:'1px solid #E1ECEB',borderRadius:'1rem',padding:'1.5rem',boxShadow:'0 25px 50px rgba(10,55,58,0.10)',backdropFilter:'blur(20px)'}}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[#1A3D40]">{editing ? 'Edit' : 'Add'} Stockist</h2>
              <button onClick={() => setShowModal(false)} className="text-[#4A6D71] hover:text-[#0A373A]"><HiOutlineX className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-sm text-gray-400 mb-1">Name</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-field" required /></div>
              <div><label className="block text-sm text-gray-400 mb-1">GSTIN</label><input value={form.gstin} onChange={e => setForm({...form, gstin: e.target.value})} className="input-field uppercase font-mono" placeholder="22AAAAA0000A1Z5" /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Location</label><input value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="input-field" /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Contact Person</label><input value={form.contact_person} onChange={e => setForm({...form, contact_person: e.target.value})} className="input-field" /></div>
              <div><label className="block text-sm text-gray-400 mb-1">Phone</label><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="input-field" /></div>
              <div className="flex gap-3 pt-2"><button type="submit" className="btn-primary flex-1">Save</button><button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button></div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
