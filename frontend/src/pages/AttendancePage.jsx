import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineX } from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';

export default function AttendancePage() {
  const { user, isAdmin } = useAuth();
  const isPrivileged = isAdmin || user?.role === 'hr';
  
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ employee_id: '', date: '', status: 'present' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isPrivileged) {
      // Admin and HR can see all employees
      api.get('/employees/').then(r => { setEmployees(r.data); setLoading(false); }).catch(() => setLoading(false));
    } else {
      // Employees and managers see only themselves
      if (user?.employee_id) {
        setSelectedEmp(String(user.employee_id));
        setEmployees([{ id: user.employee_id, name: user.username }]);
      }
      setLoading(false);
    }
  }, [isPrivileged]);

  useEffect(() => {
    if (selectedEmp) {
      api.get(`/attendance/${selectedEmp}`).then(r => setRecords(r.data)).catch(() => {});
    }
  }, [selectedEmp]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const empId = isPrivileged ? parseInt(form.employee_id) : user.employee_id;
      await api.post('/attendance/', { ...form, employee_id: empId });
      toast.success('Attendance marked');
      setShowModal(false);
      const checkEmp = isPrivileged ? selectedEmp : String(user.employee_id);
      if (checkEmp == (isPrivileged ? form.employee_id : user.employee_id)) {
        api.get(`/attendance/${checkEmp}`).then(r => setRecords(r.data));
      }
    } catch (err) { toast.error(err.response?.data?.detail || 'Error'); }
  };

  const statusColors = {
    present: 'badge-success',
    absent: 'badge-danger',
    'half-day': 'badge-warning'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title text-[#1A3D40] text-2xl font-bold">Attendance</h1>
          <p className="text-sm text-[#4A6D71] mt-1">Track employee attendance</p>
        </div>
        <button onClick={() => { 
          setForm({ 
            employee_id: isPrivileged ? '' : String(user?.employee_id || ''), 
            date: new Date().toISOString().split('T')[0], 
            status: 'present' 
          }); 
          setShowModal(true); 
        }} className="btn-primary flex items-center gap-2">
          <HiOutlinePlus className="w-4 h-4" /> Mark Attendance
        </button>
      </div>

      {isPrivileged && (
        <div className="card bg-white p-6 rounded-2xl border border-[#E1ECEB] shadow-sm">
          <label className="block text-sm text-[#4A6D71] font-semibold mb-2">Select Employee</label>
          <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} className="select-field max-w-md">
            <option value="">Choose an employee</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      )}

      {selectedEmp && (
        <div className="table-container bg-white rounded-2xl border border-[#E1ECEB] shadow-sm overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#E3EFEF] border-b border-[#D5E5E4] text-[#0A373A]">
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1ECEB]">
              {records.map((r, idx) => (
                <tr key={r.id} className={idx % 2 === 1 ? 'bg-[#F0F6F6]/20' : 'bg-white'}>
                  <td className="px-6 py-4 text-sm font-semibold text-[#4A6D71]">
                    {new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                      r.status === 'present' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      r.status === 'absent' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan="2" className="px-6 py-12 text-center text-sm font-medium text-[#4A6D71]">
                    No records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && createPortal(
        <div style={{position:'fixed',inset:0,zIndex:9999,backgroundColor:'rgba(10,55,58,0.4)',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'1rem',overflowY:'auto'}}>
          <div style={{width:'100%',maxWidth:'28rem',marginTop:'2rem',marginBottom:'2rem',background:'#FFFFFF',border:'1px solid #E1ECEB',borderRadius:'1rem',padding:'1.5rem',boxShadow:'0 25px 50px rgba(10,55,58,0.10)',backdropFilter:'blur(20px)'}}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[#1A3D40]">Mark Attendance</h2>
              <button onClick={() => setShowModal(false)} className="text-[#4A6D71] hover:text-[#0A373A]">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isPrivileged ? (
                <div>
                  <label className="block text-sm text-[#4A6D71] font-semibold mb-1">Employee</label>
                  <select value={form.employee_id} onChange={e => setForm({...form, employee_id: e.target.value})} className="select-field" required>
                    <option value="">Select</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm text-[#4A6D71] font-semibold mb-1">Employee</label>
                  <input value={user?.username || ''} disabled className="input-field opacity-60" />
                </div>
              )}
              <div>
                <label className="block text-sm text-[#4A6D71] font-semibold mb-1">Date</label>
                <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm text-[#4A6D71] font-semibold mb-1">Status</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="select-field">
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="half-day">Half Day</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
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
