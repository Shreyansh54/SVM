import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { 
  HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineX, 
  HiOutlineUpload, HiOutlineCollection, HiOutlineCurrencyRupee,
  HiOutlineChevronRight, HiOutlineTruck, HiOutlineHeart
} from 'react-icons/hi';

const MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
];

export default function EmployeesPage() {
  const today = new Date();
  const [employees, setEmployees] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', salary_per_month: '', joining_date: '', date_of_birth: '', role: 'employee', post: '' });
  const [loading, setLoading] = useState(true);
  const fileRef = useRef(null);

  // ── Collections panel state ──────────────────────────────
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [empCollections, setEmpCollections] = useState([]);
  const [colLoading, setColLoading] = useState(false);
  const [colMonth, setColMonth] = useState(today.getMonth() + 1);
  const [colYear, setColYear] = useState(today.getFullYear());
  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() - i);

  useEffect(() => { loadEmployees(); }, []);

  useEffect(() => {
    if (selectedEmp) loadEmpCollections(selectedEmp.id);
  }, [colMonth, colYear, selectedEmp]);

  const loadEmployees = async () => {
    try {
      const res = await api.get('/employees/');
      setEmployees(res.data);
    } catch (err) { toast.error('Failed to load employees'); }
    finally { setLoading(false); }
  };

  const loadEmpCollections = async (empId) => {
    setColLoading(true);
    try {
      const res = await api.get(`/collections/?employee_id=${empId}&month=${colMonth}&year=${colYear}`);
      setEmpCollections(res.data);
    } catch {
      toast.error('Failed to load collections for this employee.');
    } finally {
      setColLoading(false);
    }
  };

  const handleEmpRowClick = (emp) => {
    setSelectedEmp(emp);
    setEmpCollections([]);
    loadEmpCollections(emp.id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...form, salary_per_month: parseFloat(form.salary_per_month) };
      if (editing) {
        await api.put(`/employees/${editing.id}`, data);
        toast.success('Employee updated');
      } else {
        await api.post('/employees/', data);
        toast.success('Employee added');
      }
      setShowModal(false);
      setEditing(null);
      setForm({ name: '', email: '', phone: '', salary_per_month: '', joining_date: '', date_of_birth: '', role: 'employee', post: '', is_active: true });
      loadEmployees();
    } catch (err) { 
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail[0].msg : (detail || 'Error saving employee');
      toast.error(msg); 
    }
  };

  const handleEdit = (emp) => {
    setEditing(emp);
    setForm({ name: emp.name, email: emp.email, phone: emp.phone || '', salary_per_month: emp.salary_per_month, joining_date: emp.joining_date, date_of_birth: emp.date_of_birth || '', role: emp.role, post: emp.post || '', is_active: emp.is_active });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this employee?')) return;
    try {
      await api.delete(`/employees/${id}`);
      toast.success('Employee deleted');
      loadEmployees();
      if (selectedEmp?.id === id) setSelectedEmp(null);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to delete', { duration: 5000 }); }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      toast.loading('Uploading...', { id: 'upload' });
      const res = await api.post('/upload/employees', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(res.data.message, { id: 'upload' });
      if (res.data.errors?.length) res.data.errors.forEach(err => toast.error(err, { duration: 5000 }));
      loadEmployees();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed', { id: 'upload' });
    }
    e.target.value = '';
  };

  // ── Derived stats for selected employee ──────────────────
  const totalCollected = empCollections.reduce((s, c) => s + (c.amount || 0), 0);
  const stockistTotal = empCollections.filter(c => c.collection_type === 'stockist').reduce((s, c) => s + (c.amount || 0), 0);
  const doctorTotal = empCollections.filter(c => c.collection_type === 'doctor').reduce((s, c) => s + (c.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="text-sm text-gray-500 mt-1">{employees.length} total employees</p>
        </div>
        <div className="flex gap-2">
          <input type="file" ref={fileRef} onChange={handleUpload} accept=".xlsx,.xls" className="hidden" />
          <button onClick={() => fileRef.current.click()} className="btn-secondary flex items-center gap-2">
            <HiOutlineUpload className="w-4 h-4" /> Upload Excel
          </button>
          <button id="add-employee-btn" onClick={() => { setEditing(null); setForm({ name: '', email: '', phone: '', salary_per_month: '', joining_date: '', role: 'employee', post: '', is_active: true }); setShowModal(true); }} className="btn-primary flex items-center gap-2">
            <HiOutlinePlus className="w-4 h-4" /> Add Employee
          </button>
        </div>
      </div>

      {/* Excel format hint */}
      <div className="text-xs text-gray-600 bg-[#E3EFEF] rounded-lg px-4 py-2 border border-[#D5E5E4]">
        💡 <strong>Excel format:</strong> Name, Email, Phone, Salary, Joining Date (YYYY-MM-DD), Role
      </div>

      {/* Main layout: table + panel side by side when employee is selected */}
      <div className={`flex gap-5 items-start transition-all ${selectedEmp ? 'flex-col lg:flex-row' : ''}`}>

        {/* Employees Table */}
        <div className={selectedEmp ? 'w-full lg:w-1/2' : 'w-full'}>
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <div className="table-container">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="px-6 py-4 text-left">Name</th>
                    <th className="px-6 py-4 text-left">Post</th>
                    <th className="px-6 py-4 text-left">Email</th>
                    <th className="px-6 py-4 text-left">Phone</th>
                    <th className="px-6 py-4 text-left">Salary</th>
                    <th className="px-6 py-4 text-left">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr
                      key={emp.id}
                      className={`table-row cursor-pointer transition-all ${selectedEmp?.id === emp.id ? 'bg-[#E3EFEF]/60 border-l-2 border-l-[#14A89C]' : 'hover:bg-white/[0.03]'}`}
                      onClick={() => handleEmpRowClick(emp)}
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-[#1A3D40]">{emp.name}</div>
                      </td>
                      <td className="px-6 py-4">{emp.post ? <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-indigo-500/15 text-indigo-400">{emp.post}</span> : <span className="text-gray-600 text-xs">—</span>}</td>
                      <td className="px-6 py-4 text-gray-400 text-sm">{emp.email}</td>
                      <td className="px-6 py-4 text-gray-400 text-sm">{emp.phone || '—'}</td>
                      <td className="px-6 py-4 text-gray-300 text-sm">₹{emp.salary_per_month?.toLocaleString()}</td>
                      <td className="px-6 py-4">{emp.is_active ? <span className="badge-success">Active</span> : <span className="badge-danger">Inactive</span>}</td>
                      <td className="px-6 py-4 text-right space-x-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleEdit(emp)} className="text-gray-400 hover:text-primary-400 transition-colors"><HiOutlinePencil className="w-4 h-4 inline" /></button>
                        <button onClick={() => handleDelete(emp.id)} className="text-gray-400 hover:text-red-400 transition-colors"><HiOutlineTrash className="w-4 h-4 inline" /></button>
                      </td>
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr><td colSpan="7" className="px-6 py-12 text-center text-gray-500">No employees found. Add your first employee!</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Collections Panel ── */}
        {selectedEmp && (
          <div className="w-full lg:w-1/2 bg-white border border-[#E1ECEB] rounded-2xl shadow-sm overflow-hidden">
            {/* Panel Header */}
            <div className="bg-gradient-to-r from-[#0A373A] to-[#14A89C] px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-white/70 font-semibold uppercase tracking-widest">Collections</p>
                <h2 className="text-lg font-bold text-white mt-0.5 flex items-center gap-2">
                  <HiOutlineCollection className="w-5 h-5" /> {selectedEmp.name}
                </h2>
                <p className="text-xs text-white/60 mt-0.5">{selectedEmp.post || selectedEmp.role}</p>
              </div>
              <button onClick={() => setSelectedEmp(null)} className="text-white/60 hover:text-white transition-colors">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            {/* Month/Year Filter */}
            <div className="flex items-center gap-3 px-6 py-3 bg-[#F0F6F6] border-b border-[#E1ECEB]">
              <span className="text-xs font-semibold text-[#4A6D71]">Filter:</span>
              <select value={colMonth} onChange={e => setColMonth(parseInt(e.target.value))} className="rounded-lg border border-[#C6DAD8] bg-white px-2 py-1 text-xs text-[#1A3D40] outline-none focus:border-[#14A89C]">
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <select value={colYear} onChange={e => setColYear(parseInt(e.target.value))} className="rounded-lg border border-[#C6DAD8] bg-white px-2 py-1 text-xs text-[#1A3D40] outline-none focus:border-[#14A89C]">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* Summary Mini-Cards */}
            <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b border-[#E1ECEB]">
              <div className="text-center">
                <p className="text-xs text-[#4A6D71] font-semibold uppercase tracking-wide mb-1">Stockists</p>
                <p className="text-base font-bold text-[#0A373A]">₹{stockistTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-[#4A6D71] font-semibold uppercase tracking-wide mb-1">Doctors</p>
                <p className="text-base font-bold text-[#14A89C]">₹{doctorTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="text-center bg-gradient-to-br from-[#E3EFEF] to-white rounded-xl py-2 px-1">
                <p className="text-xs text-[#4A6D71] font-semibold uppercase tracking-wide mb-1">Total</p>
                <p className="text-base font-bold text-[#0A373A]">₹{totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            {/* Collections List */}
            <div className="overflow-y-auto" style={{ maxHeight: '380px' }}>
              {colLoading ? (
                <div className="flex justify-center py-10"><div className="w-7 h-7 border-2 border-[#14A89C] border-t-transparent rounded-full animate-spin" /></div>
              ) : empCollections.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">
                  <HiOutlineCollection className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  No collections recorded for {MONTHS.find(m => m.value === colMonth)?.label} {colYear}
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F8FAFA] border-b border-[#E1ECEB]">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-[#4A6D71] uppercase">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-[#4A6D71] uppercase">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-[#4A6D71] uppercase">Party</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-[#4A6D71] uppercase">Mode</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-[#4A6D71] uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empCollections.map(c => (
                      <tr key={c.id} className="border-b border-[#F0F6F6] hover:bg-[#F8FAFA] transition-colors">
                        <td className="px-4 py-2.5 text-xs font-mono text-gray-500">{c.date}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.collection_type === 'stockist' ? 'bg-cyan-500/10 text-cyan-700' : 'bg-teal-500/10 text-teal-700'}`}>
                            {c.collection_type === 'stockist' ? '🏭' : '👨‍⚕️'} {c.collection_type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs font-semibold text-[#1A3D40]">
                          {c.collection_type === 'stockist' ? c.stockist_name : c.doctor_name}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{c.payment_mode}</td>
                        <td className="px-4 py-2.5 text-right text-xs font-bold text-[#0A373A]">
                          ₹{c.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && createPortal(
        <div style={{position:'fixed',inset:0,zIndex:9999,backgroundColor:'rgba(10,55,58,0.4)',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'1rem',overflowY:'auto'}}>
          <div style={{width:'100%',maxWidth:'32rem',marginTop:'2rem',marginBottom:'2rem',background:'#FFFFFF',border:'1px solid #E1ECEB',borderRadius:'1rem',padding:'1.5rem',boxShadow:'0 25px 50px rgba(10,55,58,0.10)',backdropFilter:'blur(20px)'}}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[#1A3D40]">{editing ? 'Edit Employee' : 'Add Employee'}</h2>
              <button onClick={() => setShowModal(false)} className="text-[#4A6D71] hover:text-[#0A373A]"><HiOutlineX className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#4A6D71] font-semibold mb-1">Name</label>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm text-[#4A6D71] font-semibold mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm text-[#4A6D71] font-semibold mb-1">Phone</label>
                  <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm text-[#4A6D71] font-semibold mb-1">Monthly Salary</label>
                  <input type="number" value={form.salary_per_month} onChange={e => setForm({...form, salary_per_month: e.target.value})} className="input-field" required />
                </div>
                {!editing && (
                  <div>
                    <label className="block text-sm text-[#4A6D71] font-semibold mb-1">Joining Date</label>
                    <input type="date" value={form.joining_date} onChange={e => setForm({...form, joining_date: e.target.value})} className="input-field" required />
                  </div>
                )}
                <div>
                  <label className="block text-sm text-[#4A6D71] font-semibold mb-1">Date of Birth</label>
                  <input type="date" value={form.date_of_birth} onChange={e => setForm({...form, date_of_birth: e.target.value})} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm text-[#4A6D71] font-semibold mb-1">Role</label>
                  <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="select-field">
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="hr">HR</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[#4A6D71] font-semibold mb-1">Post / Designation</label>
                  <select value={form.post} onChange={e => setForm({...form, post: e.target.value})} className="select-field">
                    <option value="">Select post</option>
                    <option value="MR">MR (Medical Representative)</option>
                    <option value="ABM">ABM (Area Business Manager)</option>
                    <option value="RBM">RBM (Regional Business Manager)</option>
                    <option value="ZBM">ZBM (Zonal Business Manager)</option>
                    <option value="NSM">NSM (National Sales Manager)</option>
                    <option value="GM">GM (General Manager)</option>
                    <option value="VP">VP (Vice President)</option>
                    <option value="Executive">Executive</option>
                    <option value="Accountant">Accountant</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} className="w-4 h-4 rounded border-gray-600 bg-white text-[#14A89C] focus:ring-[#0A373A]/20" />
                <label htmlFor="is_active" className="text-sm text-[#4A6D71] font-semibold">Employee is active</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" className="btn-primary flex-1">Save</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
