import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { HiOutlineCalculator } from 'react-icons/hi';

export default function SalaryPage() {
  const [employees, setEmployees] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [workingDays, setWorkingDays] = useState(22);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/employees/').then(r => { setEmployees(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedEmp) {
      api.get(`/salary/${selectedEmp}`).then(r => setSalaries(r.data)).catch(() => {});
    }
  }, [selectedEmp]);

  const calculateSalary = async () => {
    if (!selectedEmp) { toast.error('Select an employee'); return; }
    try {
      const res = await api.post('/salary/calculate', {
        employee_id: parseInt(selectedEmp), month, working_days: parseInt(workingDays)
      });
      toast.success(`Salary calculated: ₹${res.data.final_salary.toLocaleString()}`);
      api.get(`/salary/${selectedEmp}`).then(r => setSalaries(r.data));
    } catch (err) { toast.error(err.response?.data?.detail || 'Error'); }
  };

  return (
    <div className="space-y-6">
      <div><h1 className="page-title">Salary Management</h1><p className="text-sm text-gray-500 mt-1">Calculate and view salary records</p></div>

      {/* Calculator */}
      <div className="card">
        <h2 className="section-title mb-4">Salary Calculator</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Employee</label>
            <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} className="select-field">
              <option value="">Select</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Month</label>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Working Days</label>
            <input type="number" value={workingDays} onChange={e => setWorkingDays(e.target.value)} className="input-field" />
          </div>
          <div className="flex items-end">
            <button onClick={calculateSalary} className="btn-primary w-full flex items-center justify-center gap-2">
              <HiOutlineCalculator className="w-4 h-4" /> Calculate
            </button>
          </div>
        </div>
      </div>

      {/* Salary History */}
      {selectedEmp && (
        <div className="table-container">
          <table className="w-full">
            <thead><tr className="table-header">
              <th className="px-6 py-4 text-left">Month</th><th className="px-6 py-4 text-left">Employee</th>
              <th className="px-6 py-4 text-right">Base Salary</th><th className="px-6 py-4 text-right">Leaves</th>
              <th className="px-6 py-4 text-right">Final Salary</th>
            </tr></thead>
            <tbody>
              {salaries.map(s => (
                <tr key={s.id} className="table-row">
                  <td className="px-6 py-4 text-gray-300 font-medium">{s.month}</td>
                  <td className="px-6 py-4 text-gray-400">{s.employee_name || '—'}</td>
                  <td className="px-6 py-4 text-right text-gray-400">₹{s.base_salary?.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right"><span className={s.leaves_taken > 0 ? 'badge-warning' : 'badge-success'}>{s.leaves_taken} days</span></td>
                  <td className="px-6 py-4 text-right font-semibold text-emerald-400">₹{s.final_salary?.toLocaleString()}</td>
                </tr>
              ))}
              {salaries.length === 0 && <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-500">No salary records</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
