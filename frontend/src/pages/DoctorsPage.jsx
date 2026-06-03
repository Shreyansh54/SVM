import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineX, HiOutlineClipboardList, HiOutlineShoppingCart } from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';

export default function DoctorsPage() {
  const { isEmployee } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [products, setProducts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showPrescModal, setShowPrescModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [activeTab, setActiveTab] = useState('doctors');
  const [form, setForm] = useState({ name: '', specialization: '', hospital: '', phone: '', location: '', gstin: '' });
  const [prescForm, setPrescForm] = useState({ product_id: '', notes: '' });
  const [orderForm, setOrderForm] = useState({ doctor_id: '', employee_id: '', product_id: '', quantity: 1, notes: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, [isEmployee]);

  const loadAll = async () => {
    try {
      if (isEmployee) {
        const [dRes, pRes] = await Promise.all([
          api.get('/doctors'), api.get('/products/')
        ]);
        setDoctors(dRes.data); setProducts(pRes.data);
      } else {
        const [dRes, pRes, eRes, oRes] = await Promise.all([
          api.get('/doctors'), api.get('/products/'), api.get('/employees/'), api.get('/doctor-orders')
        ]);
        setDoctors(dRes.data); setProducts(pRes.data); setEmployees(eRes.data); setOrders(oRes.data);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadPrescriptions = async (doctorId) => {
    try {
      const res = await api.get(`/doctors/${doctorId}/prescriptions`);
      setPrescriptions(res.data);
    } catch { setPrescriptions([]); }
  };

  const handleSubmitDoctor = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await api.put(`/doctors/${editing.id}`, form); toast.success('Doctor updated'); }
      else { await api.post('/doctors', form); toast.success('Doctor added'); }
      setShowModal(false); setEditing(null);
      setForm({ name: '', specialization: '', hospital: '', phone: '', location: '', gstin: '' });
      loadAll();
    } catch (err) { toast.error(err.response?.data?.detail || 'Error'); }
  };

  const handleEdit = (d) => {
    setEditing(d);
    setForm({ name: d.name, specialization: d.specialization || '', hospital: d.hospital || '', phone: d.phone || '', location: d.location || '', gstin: d.gstin || '' });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this doctor and all related prescriptions/orders?')) return;
    try { await api.delete(`/doctors/${id}`); toast.success('Deleted'); loadAll(); }
    catch { toast.error('Failed'); }
  };

  const handlePrescription = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/doctors/${selectedDoctor.id}/prescriptions`, { product_id: parseInt(prescForm.product_id), notes: prescForm.notes });
      toast.success('Prescription added');
      setShowPrescModal(false); setPrescForm({ product_id: '', notes: '' });
      loadPrescriptions(selectedDoctor.id);
    } catch (err) { toast.error(err.response?.data?.detail || 'Error'); }
  };

  const handleOrder = async (e) => {
    e.preventDefault();
    try {
      await api.post('/doctor-orders', {
        doctor_id: parseInt(orderForm.doctor_id), employee_id: parseInt(orderForm.employee_id),
        product_id: parseInt(orderForm.product_id), quantity: parseInt(orderForm.quantity), notes: orderForm.notes
      });
      toast.success('Order recorded');
      setShowOrderModal(false); setOrderForm({ doctor_id: '', employee_id: '', product_id: '', quantity: 1, notes: '' });
      loadAll();
    } catch (err) { toast.error(err.response?.data?.detail || 'Error'); }
  };

  const tabs = isEmployee 
    ? [{ key: 'doctors', label: 'Doctors', icon: '🩺' }]
    : [
        { key: 'doctors', label: 'Doctors', icon: '🩺' },
        { key: 'prescriptions', label: 'Prescriptions', icon: '💊' },
        { key: 'orders', label: 'Doctor Orders', icon: '📋' },
      ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Doctors</h1>
          <p className="text-sm text-gray-500 mt-1">Manage doctors, prescriptions & orders</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'doctors' && (
            <button onClick={() => { setEditing(null); setForm({ name: '', specialization: '', hospital: '', phone: '', location: '', gstin: '' }); setShowModal(true); }} className="btn-primary flex items-center gap-2">
              <HiOutlinePlus className="w-4 h-4" /> Add Doctor
            </button>
          )}
          {activeTab === 'orders' && (
            <button onClick={() => setShowOrderModal(true)} className="btn-primary flex items-center gap-2">
              <HiOutlinePlus className="w-4 h-4" /> New Order
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#E3EFEF] p-1 rounded-xl w-fit">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-primary-600/20 text-primary-400' : 'text-gray-400 hover:text-gray-200'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div> : (
        <>
          {/* Doctors Tab */}
          {activeTab === 'doctors' && (
            <div className="table-container">
              <table className="w-full">
                <thead><tr className="table-header">
                  <th className="px-6 py-4 text-left">Name</th><th className="px-6 py-4 text-left">Specialization</th>
                  <th className="px-6 py-4 text-left">Hospital</th><th className="px-6 py-4 text-left">Phone</th>
                  <th className="px-6 py-4 text-left">Location</th>
                  <th className="px-6 py-4 text-left">GSTIN</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr></thead>
                <tbody>
                  {doctors.map(d => (
                    <tr key={d.id} className="table-row">
                      <td className="px-6 py-4 font-medium text-[#1A3D40]">{d.name}</td>
                      <td className="px-6 py-4 text-gray-400 text-sm">{d.specialization || '—'}</td>
                      <td className="px-6 py-4 text-gray-400 text-sm">{d.hospital || '—'}</td>
                      <td className="px-6 py-4 text-gray-400 text-sm">{d.phone || '—'}</td>
                      <td className="px-6 py-4 text-gray-400 text-sm">{d.location || '—'}</td>
                      <td className="px-6 py-4"><span className="font-mono text-xs text-primary-400 bg-primary-500/10 px-2 py-1 rounded">{d.gstin || 'Unregistered'}</span></td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {!isEmployee && (
                          <button onClick={() => { setSelectedDoctor(d); loadPrescriptions(d.id); setActiveTab('prescriptions'); }}
                            className="text-gray-400 hover:text-blue-400 transition-colors" title="View Prescriptions">
                            <HiOutlineClipboardList className="w-4 h-4 inline" />
                          </button>
                        )}
                        <button onClick={() => handleEdit(d)} className="text-gray-400 hover:text-primary-400 transition-colors">
                          <HiOutlinePencil className="w-4 h-4 inline" />
                        </button>
                        {!isEmployee && (
                          <button onClick={() => handleDelete(d.id)} className="text-gray-400 hover:text-red-400 transition-colors" title="Delete Doctor">
                            <HiOutlineTrash className="w-4 h-4 inline" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {doctors.length === 0 && <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">No doctors found</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* Prescriptions Tab */}
          {activeTab === 'prescriptions' && (
            <div className="space-y-4">
              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Select Doctor</label>
                    <select value={selectedDoctor?.id || ''} onChange={e => { const doc = doctors.find(d => d.id == e.target.value); setSelectedDoctor(doc); if (doc) loadPrescriptions(doc.id); }}
                      className="select-field max-w-md">
                      <option value="">Choose a doctor</option>
                      {doctors.map(d => <option key={d.id} value={d.id}>{d.name} — {d.specialization || 'General'}</option>)}
                    </select>
                  </div>
                  {selectedDoctor && (
                    <button onClick={() => { setPrescForm({ product_id: '', notes: '' }); setShowPrescModal(true); }} className="btn-primary flex items-center gap-2">
                      <HiOutlinePlus className="w-4 h-4" /> Add Prescription
                    </button>
                  )}
                </div>
              </div>
              {selectedDoctor && prescriptions.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {prescriptions.map(p => (
                    <div key={p.id} className="card-hover">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">💊</span>
                        <h3 className="font-semibold text-[#1A3D40]">{p.product_name}</h3>
                      </div>
                      {p.notes && <p className="text-sm text-gray-400">{p.notes}</p>}
                      <p className="text-xs text-gray-600 mt-2">{p.date ? new Date(p.date).toLocaleDateString() : ''}</p>
                    </div>
                  ))}
                </div>
              )}
              {selectedDoctor && prescriptions.length === 0 && (
                <div className="card text-center py-8 text-gray-500">No prescriptions for this doctor</div>
              )}
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <div className="table-container">
              <table className="w-full">
                <thead><tr className="table-header">
                  <th className="px-6 py-4 text-left">Date</th><th className="px-6 py-4 text-left">Doctor</th>
                  <th className="px-6 py-4 text-left">Employee</th><th className="px-6 py-4 text-left">Product</th>
                  <th className="px-6 py-4 text-right">Qty</th><th className="px-6 py-4 text-left">Notes</th>
                </tr></thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id} className="table-row">
                      <td className="px-6 py-4 text-sm text-gray-400">{o.date ? new Date(o.date).toLocaleDateString() : '—'}</td>
                      <td className="px-6 py-4 font-medium text-[#1A3D40]">{o.doctor_name || '—'}</td>
                      <td className="px-6 py-4 text-gray-300">{o.employee_name || '—'}</td>
                      <td className="px-6 py-4 text-gray-300">{o.product_name || '—'}</td>
                      <td className="px-6 py-4 text-right text-gray-300">{o.quantity}</td>
                      <td className="px-6 py-4 text-gray-400 text-sm">{o.notes || '—'}</td>
                    </tr>
                  ))}
                  {orders.length === 0 && <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">No orders recorded</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Doctor Modal */}
      {showModal && createPortal(
        <div style={{position:'fixed',inset:0,zIndex:9999,backgroundColor:'rgba(10,55,58,0.4)',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'1rem',overflowY:'auto'}}>
          <div style={{width:'100%',maxWidth:'32rem',marginTop:'2rem',marginBottom:'2rem',background:'#FFFFFF',border:'1px solid #E1ECEB',borderRadius:'1rem',padding:'1.5rem',boxShadow:'0 25px 50px rgba(10,55,58,0.10)',backdropFilter:'blur(20px)'}}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[#1A3D40]">{editing ? 'Edit' : 'Add'} Doctor</h2>
              <button onClick={() => setShowModal(false)} className="text-[#4A6D71] hover:text-[#0A373A]"><HiOutlineX className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmitDoctor} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-gray-400 mb-1">Name</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-field" required /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Specialization</label><input value={form.specialization} onChange={e => setForm({...form, specialization: e.target.value})} className="input-field" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Hospital</label><input value={form.hospital} onChange={e => setForm({...form, hospital: e.target.value})} className="input-field" /></div>
                <div><label className="block text-sm text-gray-400 mb-1">Phone</label><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="input-field" /></div>
              </div>
              <div><label className="block text-sm text-gray-400 mb-1">Location</label><input value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="input-field" /></div>
              <div><label className="block text-sm text-gray-400 mb-1">GSTIN (Optional)</label><input value={form.gstin} onChange={e => setForm({...form, gstin: e.target.value})} className="input-field uppercase font-mono" placeholder="22AAAAA0000A1Z5" /></div>
              <div className="flex gap-3 pt-2"><button type="submit" className="btn-primary flex-1">Save</button><button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button></div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Add Prescription Modal */}
      {showPrescModal && createPortal(
        <div style={{position:'fixed',inset:0,zIndex:9999,backgroundColor:'rgba(10,55,58,0.4)',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'1rem',overflowY:'auto'}}>
          <div style={{width:'100%',maxWidth:'28rem',marginTop:'2rem',marginBottom:'2rem',background:'#FFFFFF',border:'1px solid #E1ECEB',borderRadius:'1rem',padding:'1.5rem',boxShadow:'0 25px 50px rgba(10,55,58,0.10)',backdropFilter:'blur(20px)'}}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[#1A3D40]">Add Prescription for {selectedDoctor?.name}</h2>
              <button onClick={() => setShowPrescModal(false)} className="text-[#4A6D71] hover:text-[#0A373A]"><HiOutlineX className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handlePrescription} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Medicine (Product)</label>
                <select value={prescForm.product_id} onChange={e => setPrescForm({...prescForm, product_id: e.target.value})} className="select-field" required>
                  <option value="">Select medicine</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div><label className="block text-sm text-gray-400 mb-1">Notes</label><input value={prescForm.notes} onChange={e => setPrescForm({...prescForm, notes: e.target.value})} className="input-field" placeholder="Dosage, frequency, etc." /></div>
              <div className="flex gap-3 pt-2"><button type="submit" className="btn-primary flex-1">Add</button><button type="button" onClick={() => setShowPrescModal(false)} className="btn-secondary">Cancel</button></div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Create Order Modal */}
      {showOrderModal && createPortal(
        <div style={{position:'fixed',inset:0,zIndex:9999,backgroundColor:'rgba(10,55,58,0.4)',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'1rem',overflowY:'auto'}}>
          <div style={{width:'100%',maxWidth:'28rem',marginTop:'2rem',marginBottom:'2rem',background:'#FFFFFF',border:'1px solid #E1ECEB',borderRadius:'1rem',padding:'1.5rem',boxShadow:'0 25px 50px rgba(10,55,58,0.10)',backdropFilter:'blur(20px)'}}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[#1A3D40]">Record Doctor Order</h2>
              <button onClick={() => setShowOrderModal(false)} className="text-[#4A6D71] hover:text-[#0A373A]"><HiOutlineX className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleOrder} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Doctor</label>
                <select value={orderForm.doctor_id} onChange={e => setOrderForm({...orderForm, doctor_id: e.target.value})} className="select-field" required>
                  <option value="">Select doctor</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Employee (Who gave the order)</label>
                <select value={orderForm.employee_id} onChange={e => setOrderForm({...orderForm, employee_id: e.target.value})} className="select-field" required>
                  <option value="">Select employee</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Product</label>
                <select value={orderForm.product_id} onChange={e => setOrderForm({...orderForm, product_id: e.target.value})} className="select-field" required>
                  <option value="">Select product</option>{products.map(p => <option key={p.id} value={p.id}>{p.name} (₹{p.price})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Quantity</label>
                <input type="number" min="1" value={orderForm.quantity} onChange={e => setOrderForm({...orderForm, quantity: e.target.value})} className="input-field" required />
              </div>
              <div><label className="block text-sm text-gray-400 mb-1">Notes</label><input value={orderForm.notes} onChange={e => setOrderForm({...orderForm, notes: e.target.value})} className="input-field" /></div>
              <div className="flex gap-3 pt-2"><button type="submit" className="btn-primary flex-1">Record Order</button><button type="button" onClick={() => setShowOrderModal(false)} className="btn-secondary">Cancel</button></div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
