import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { 
  HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineX, 
  HiOutlineDownload, HiOutlineTrendingUp, HiOutlineTruck, HiOutlineHeart, 
  HiOutlineCurrencyDollar, HiOutlineCollection, HiOutlineDocumentText
} from 'react-icons/hi';

export default function CollectionsPage() {
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';
  const [collections, setCollections] = useState([]);
  const [stockists, setStockists] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [employees, setEmployees] = useState([]);
  
  const [summary, setSummary] = useState({ total_stockist: 0, total_doctor: 0, grand_total: 0 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  // Month & Year Filter state (default to current month/year)
  const today = new Date();
  const [filterMonth, setFilterMonth] = useState(today.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(today.getFullYear());

  // Form State
  const [form, setForm] = useState({
    collection_type: 'stockist',
    stockist_id: '',
    doctor_id: '',
    employee_id: '',
    amount: '',
    payment_mode: 'UPI',
    date: today.toISOString().split('T')[0],
    remarks: ''
  });

  useEffect(() => {
    loadMetaData();
  }, []);

  useEffect(() => {
    loadCollections();
  }, [filterMonth, filterYear]);

  const loadMetaData = async () => {
    try {
      const [stRes, docRes, empRes] = await Promise.all([
        api.get('/stockists/'),
        api.get('/doctors/'),
        api.get('/employees/')
      ]);
      setStockists(stRes.data);
      setDoctors(docRes.data);
      setEmployees(empRes.data);
    } catch {
      toast.error('Failed to load stockist or doctor lists.');
    }
  };

  const loadCollections = async () => {
    setLoading(true);
    try {
      const [colsRes, sumRes] = await Promise.all([
        api.get(`/collections/?month=${filterMonth}&year=${filterYear}`),
        api.get(`/collections/summary?month=${filterMonth}&year=${filterYear}`)
      ]);
      setCollections(colsRes.data);
      setSummary(sumRes.data);
    } catch {
      toast.error('Failed to load collections data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.error('Please enter a valid collection amount.');
      return;
    }
    if (form.collection_type === 'stockist' && !form.stockist_id) {
      toast.error('Please select a stockist.');
      return;
    }
    if (form.collection_type === 'doctor' && !form.doctor_id) {
      toast.error('Please select a doctor.');
      return;
    }

    const payload = {
      collection_type: form.collection_type,
      amount: parseFloat(form.amount),
      payment_mode: form.payment_mode,
      date: form.date,
      remarks: form.remarks || null,
      employee_id: form.employee_id ? parseInt(form.employee_id) : null,
      stockist_id: form.collection_type === 'stockist' ? parseInt(form.stockist_id) : null,
      doctor_id: form.collection_type === 'doctor' ? parseInt(form.doctor_id) : null
    };

    try {
      if (editing) {
        await api.put(`/collections/${editing.id}`, payload);
        toast.success('Collection record updated!');
      } else {
        await api.post('/collections/', payload);
        toast.success('Collection recorded successfully!');
      }
      setShowModal(false);
      setEditing(null);
      resetForm();
      loadCollections();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error saving collection.');
    }
  };

  const resetForm = () => {
    setForm({
      collection_type: 'stockist',
      stockist_id: '',
      doctor_id: '',
      employee_id: '',
      amount: '',
      payment_mode: 'UPI',
      date: today.toISOString().split('T')[0],
      remarks: ''
    });
  };

  const handleEdit = (c) => {
    setEditing(c);
    setForm({
      collection_type: c.collection_type,
      stockist_id: c.stockist_id ? c.stockist_id.toString() : '',
      doctor_id: c.doctor_id ? c.doctor_id.toString() : '',
      employee_id: c.employee_id ? c.employee_id.toString() : '',
      amount: c.amount.toString(),
      payment_mode: c.payment_mode,
      date: c.date,
      remarks: c.remarks || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this collection record?')) return;
    try {
      await api.delete(`/collections/${id}`);
      toast.success('Record deleted.');
      loadCollections();
    } catch {
      toast.error('Failed to delete record.');
    }
  };

  const downloadFile = async (url, filename) => {
    try {
      toast.loading('Generating report...', { id: 'download' });
      const res = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([res.data]);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success('Report downloaded!', { id: 'download' });
    } catch (err) {
      toast.error('Failed to download report', { id: 'download' });
    }
  };

  const handleDownloadPDF = () => {
    downloadFile(`/collections/export/pdf?month=${filterMonth}&year=${filterYear}`, `collections_report_${filterMonth}_${filterYear}.pdf`);
  };

  const handleDownloadExcel = () => {
    downloadFile(`/collections/export/excel?month=${filterMonth}&year=${filterYear}`, `collections_report_${filterMonth}_${filterYear}.xlsx`);
  };

  const months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
    { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
    { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
  ];

  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() - i);

  return (
    <div className="space-y-6">
      
      {/* Header and Add Action */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Payment Collections</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isEmployee ? 'Your recorded payment collections' : 'Track and manage cash/UPI payments from stockists and doctors'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isEmployee && (
            <>
              <button onClick={handleDownloadExcel} className="btn-secondary flex items-center gap-2">
                <HiOutlineDownload className="w-4 h-4" /> Download Excel
              </button>
              <button onClick={handleDownloadPDF} className="btn-secondary flex items-center gap-2">
                <HiOutlineDocumentText className="w-4 h-4" /> Download PDF
              </button>
            </>
          )}
          <button onClick={() => { setEditing(null); resetForm(); setShowModal(true); }} className="btn-primary flex items-center gap-2">
            <HiOutlinePlus className="w-4 h-4" /> Record Collection
          </button>
        </div>
      </div>

      {/* Monthly Summary Cards — hidden for employees */}
      {!isEmployee && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Stockists Collections Card */}
        <div className="relative overflow-hidden bg-white border border-[#E1ECEB] rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#E3EFEF]/40 rounded-bl-full pointer-events-none flex items-center justify-center pl-6 pb-6">
            <HiOutlineTruck className="w-8 h-8 text-[#14A89C]/30" />
          </div>
          <p className="text-xs text-[#4A6D71] font-semibold uppercase tracking-widest">Stockists Collections</p>
          <h3 className="text-2xl font-bold text-[#0A373A] mt-2">Rs. {summary.total_stockist?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1 font-semibold">
            <HiOutlineTrendingUp className="w-3.5 h-3.5" /> Total money collected from distributors
          </p>
        </div>

        {/* Doctors Collections Card */}
        <div className="relative overflow-hidden bg-white border border-[#E1ECEB] rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#E3EFEF]/40 rounded-bl-full pointer-events-none flex items-center justify-center pl-6 pb-6">
            <HiOutlineHeart className="w-8 h-8 text-[#0A373A]/30" />
          </div>
          <p className="text-xs text-[#4A6D71] font-semibold uppercase tracking-widest">Doctors Collections</p>
          <h3 className="text-2xl font-bold text-[#14A89C] mt-2">Rs. {summary.total_doctor?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1 font-semibold">
            <HiOutlineTrendingUp className="w-3.5 h-3.5" /> Total money collected from clinics/doctors
          </p>
        </div>

        {/* Grand Total Collections Card (Glowing Gradient Accent) */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0A373A] to-[#14A89C] rounded-2xl p-6 shadow-lg text-white">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-full pointer-events-none flex items-center justify-center pl-6 pb-6">
            <HiOutlineCurrencyDollar className="w-8 h-8 text-white/30" />
          </div>
          <p className="text-xs text-white/80 font-semibold uppercase tracking-widest">Grand Total Collections</p>
          <h3 className="text-2xl font-bold text-white mt-2">Rs. {summary.grand_total?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          <p className="text-xs text-white/70 mt-1 font-semibold">
            💼 Consolidated collections for {months.find(m => m.value === filterMonth)?.label} {filterYear}
          </p>
        </div>

      </div>
      )}

      {/* Controls & Filter Bar */}
      <div className="bg-[#E3EFEF]/70 border border-[#D5E5E4] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-[#1A3D40]">Select Month:</label>
          <select 
            value={filterMonth} 
            onChange={e => setFilterMonth(parseInt(e.target.value))}
            className="rounded-lg border border-[#C6DAD8] bg-white px-3 py-1.5 text-sm text-[#1A3D40] outline-none focus:border-[#14A89C]"
          >
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select 
            value={filterYear} 
            onChange={e => setFilterYear(parseInt(e.target.value))}
            className="rounded-lg border border-[#C6DAD8] bg-white px-3 py-1.5 text-sm text-[#1A3D40] outline-none focus:border-[#14A89C]"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <p className="text-xs text-[#4A6D71] font-medium bg-white border border-[#D5E5E4] rounded-full px-4 py-1">
          Showing {collections.length} entries for this month
        </p>
      </div>

      {/* Main Collections Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#14A89C] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-6 py-4 text-left">Date</th>
                <th className="px-6 py-4 text-left">Type</th>
                <th className="px-6 py-4 text-left">Party Name</th>
                <th className="px-6 py-4 text-left">Collected By (MR)</th>
                <th className="px-6 py-4 text-left">Payment Mode</th>
                <th className="px-6 py-4 text-right">Amount (Rs.)</th>
                <th className="px-6 py-4 text-left">Remarks</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {collections.map(c => (
                <tr key={c.id} className="table-row">
                  <td className="px-6 py-4 font-mono text-xs text-[#1A3D40]">{c.date}</td>
                  <td className="px-6 py-4 text-sm font-semibold capitalize">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.collection_type === 'stockist' ? 'bg-cyan-500/10 text-cyan-700' : 'bg-teal-500/10 text-teal-700'}`}>
                      {c.collection_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-[#1A3D40]">
                    {c.collection_type === 'stockist' ? c.stockist_name : c.doctor_name}
                  </td>
                  <td className="px-6 py-4 text-sm text-[#4A6D71]">{c.employee_name || '—'}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-[#1A3D40]">{c.payment_mode}</td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-[#0A373A]">
                    Rs. {c.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{c.remarks || '—'}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {!isEmployee && (
                      <>
                        <button onClick={() => handleEdit(c)} className="text-gray-400 hover:text-[#14A89C]">
                          <HiOutlinePencil className="w-4 h-4 inline" />
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="text-gray-400 hover:text-red-600">
                          <HiOutlineTrash className="w-4 h-4 inline" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {collections.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-400">
                    No payment collections recorded for this month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Record/Edit Modal using React Portal */}
      {showModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(10,55,58,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1rem', overflowY: 'auto' }}>
          <div style={{ width: '100%', maxWidth: '32rem', marginTop: '2rem', marginBottom: '2rem', background: '#FFFFFF', border: '1px solid #E1ECEB', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 25px 50px rgba(10,55,58,0.10)', backdropFilter: 'blur(20px)' }}>
            
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[#1A3D40]">{editing ? 'Edit' : 'Record'} Payment Collection</h2>
              <button onClick={() => setShowModal(false)} className="text-[#4A6D71] hover:text-[#0A373A]"><HiOutlineX className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Collection Type Switcher */}
              <div>
                <label className="block text-sm text-[#4A6D71] font-semibold mb-1">Collection Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    type="button"
                    onClick={() => setForm({ ...form, collection_type: 'stockist', stockist_id: '', doctor_id: '' })}
                    className={`py-2 text-sm font-semibold rounded-lg border transition-colors ${form.collection_type === 'stockist' ? 'bg-[#0A373A] border-[#0A373A] text-white' : 'bg-white border-[#C6DAD8] text-[#4A6D71] hover:bg-[#F0F6F6]'}`}
                  >
                    Stockist Payment
                  </button>
                  <button 
                    type="button"
                    onClick={() => setForm({ ...form, collection_type: 'doctor', stockist_id: '', doctor_id: '' })}
                    className={`py-2 text-sm font-semibold rounded-lg border transition-colors ${form.collection_type === 'doctor' ? 'bg-[#14A89C] border-[#14A89C] text-white' : 'bg-white border-[#C6DAD8] text-[#4A6D71] hover:bg-[#F0F6F6]'}`}
                  >
                    Doctor Payment
                  </button>
                </div>
              </div>

              {/* Dynamic Party Selector based on Type */}
              {form.collection_type === 'stockist' ? (
                <div>
                  <label className="block text-sm text-[#4A6D71] font-semibold mb-1">Select Stockist</label>
                  <select 
                    value={form.stockist_id} 
                    onChange={e => setForm({ ...form, stockist_id: e.target.value })}
                    className="input-field"
                    required
                  >
                    <option value="">-- Choose Stockist --</option>
                    {stockists.map(s => <option key={s.id} value={s.id}>{s.name} ({s.location || 'No Location'})</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm text-[#4A6D71] font-semibold mb-1">Select Doctor</label>
                  <select 
                    value={form.doctor_id} 
                    onChange={e => setForm({ ...form, doctor_id: e.target.value })}
                    className="input-field"
                    required
                  >
                    <option value="">-- Choose Doctor --</option>
                    {doctors.map(d => <option key={d.id} value={d.id}>{d.name} ({d.specialization || 'Clinic'})</option>)}
                  </select>
                </div>
              )}

              {/* Collected By (MR / Employee) — hidden for employees, backend sets automatically */}
              {!isEmployee && (
                <div>
                  <label className="block text-sm text-[#4A6D71] font-semibold mb-1">Collected By (MR / Employee)</label>
                  <select 
                    value={form.employee_id} 
                    onChange={e => setForm({ ...form, employee_id: e.target.value })}
                    className="input-field"
                  >
                    <option value="">-- Select MR (Optional) --</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.post || e.role})</option>)}
                  </select>
                </div>
              )}

              {/* Amount & Mode Group */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#4A6D71] font-semibold mb-1">Amount Collected (Rs.)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={form.amount} 
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    className="input-field" 
                    placeholder="Enter amount"
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#4A6D71] font-semibold mb-1">Payment Mode</label>
                  <select 
                    value={form.payment_mode} 
                    onChange={e => setForm({ ...form, payment_mode: e.target.value })}
                    className="input-field"
                  >
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer (IMPS/NEFT)</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              {/* Collection Date */}
              <div>
                <label className="block text-sm text-[#4A6D71] font-semibold mb-1">Collection Date</label>
                <input 
                  type="date" 
                  value={form.date} 
                  onChange={e => setForm({ ...form, date: e.target.value })}
                  className="input-field" 
                  required 
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-sm text-[#4A6D71] font-semibold mb-1">Remarks / Reference Number</label>
                <textarea 
                  value={form.remarks} 
                  onChange={e => setForm({ ...form, remarks: e.target.value })}
                  className="input-field h-20 resize-none" 
                  placeholder="Transaction ID, Cheque number, etc."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  {editing ? 'Update Collection' : 'Record Collection'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>

            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
