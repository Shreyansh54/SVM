import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineX, HiOutlineUpload } from 'react-icons/hi';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', salary_per_month: '', joining_date: '', date_of_birth: '', role: 'employee', post: '' });
  const [loading, setLoading] = useState(true);
  const fileRef = useRef(null);

  useEffect(() => { loadEmployees(); }, []);

  const loadEmployees = async () => {
    try {
      const res = await api.get('/employees/');
      setEmployees(res.data);
    } catch (err) { toast.error('Failed to load employees'); }
    finally { setLoading(false); }
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
                <tr key={emp.id} className="table-row">
                  <td className="px-6 py-4 font-medium text-[#1A3D40]">{emp.name}</td>
                  <td className="px-6 py-4">{emp.post ? <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-indigo-500/15 text-indigo-400">{emp.post}</span> : <span className="text-gray-600 text-xs">—</span>}</td>
                  <td className="px-6 py-4 text-gray-400 text-sm">{emp.email}</td>
                  <td className="px-6 py-4 text-gray-400 text-sm">{emp.phone || '—'}</td>
                  <td className="px-6 py-4 text-gray-300 text-sm">₹{emp.salary_per_month?.toLocaleString()}</td>
                  <td className="px-6 py-4">{emp.is_active ? <span className="badge-success">Active</span> : <span className="badge-danger">Inactive</span>}</td>
                  <td className="px-6 py-4 text-right space-x-2">
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

      {/* Modal */}
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
