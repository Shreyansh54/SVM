import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { HiOutlineSearch, HiOutlineDocumentText, HiOutlineFilter, HiOutlineRefresh } from 'react-icons/hi';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/audit-logs/');
      setLogs(res.data);
    } catch (err) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getActionBadgeColor = (action) => {
    if (action.includes('LOGIN')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (action.includes('CREATE')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (action.includes('UPDATE')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (action.includes('DELETE')) return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (actionFilter === 'ALL') return matchesSearch;
    if (actionFilter === 'LOGIN') return matchesSearch && log.action.includes('LOGIN');
    if (actionFilter === 'EMPLOYEE') return matchesSearch && log.action.includes('EMPLOYEE');
    if (actionFilter === 'SALARY') return matchesSearch && log.action.includes('SALARY');
    if (actionFilter === 'ATTENDANCE') return matchesSearch && log.action.includes('ATTENDANCE');
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title text-[#1A3D40] text-2xl font-bold">System Audit Logs</h1>
          <p className="text-sm text-[#4A6D71] mt-1">Real-time tracking of administrative and system activities</p>
        </div>
        <button 
          onClick={fetchLogs} 
          disabled={loading}
          className="btn-secondary flex items-center gap-2 border-[#D5E5E4] hover:bg-[#E3EFEF]"
        >
          <HiOutlineRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Logs
        </button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl border border-[#E1ECEB] shadow-sm">
        {/* Search */}
        <div className="relative flex-1">
          <HiOutlineSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4A6D71] w-5 h-5" />
          <input 
            type="text" 
            placeholder="Search by User, Action or Details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-[#D5E5E4] focus:outline-none focus:ring-2 focus:ring-[#0A373A]/20 focus:border-[#0A373A] bg-[#F0F6F6]/30 text-[#1A3D40] text-sm"
          />
        </div>
        {/* Action Filter */}
        <div className="flex items-center gap-2">
          <HiOutlineFilter className="text-[#4A6D71] w-4 h-4" />
          <select 
            value={actionFilter} 
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-[#D5E5E4] focus:outline-none focus:ring-2 focus:ring-[#0A373A]/20 focus:border-[#0A373A] bg-white text-[#1A3D40] text-sm"
          >
            <option value="ALL">All Categories</option>
            <option value="LOGIN">User Logins</option>
            <option value="EMPLOYEE">Employees Admin</option>
            <option value="SALARY">Salary Calculations</option>
            <option value="ATTENDANCE">Attendance Tracking</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-[#E1ECEB] shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-2 border-[#0A373A] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[#4A6D71]">Fetching logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-20">
            <HiOutlineDocumentText className="w-12 h-12 text-[#4A6D71]/40 mx-auto mb-3" />
            <p className="text-base font-semibold text-[#1A3D40]">No Audit Logs Found</p>
            <p className="text-sm text-[#4A6D71] mt-1">Try resetting your search query or filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#E3EFEF] border-b border-[#D5E5E4]">
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#0A373A] uppercase tracking-wider">Timestamp</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#0A373A] uppercase tracking-wider">User</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#0A373A] uppercase tracking-wider">Action</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#0A373A] uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1ECEB]">
                {filteredLogs.map((log, index) => (
                  <tr key={log.id} className={index % 2 === 1 ? 'bg-[#F0F6F6]/20' : 'bg-white'}>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-[#4A6D71]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-[#1A3D40]">
                      {log.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getActionBadgeColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#4A6D71] max-w-lg truncate">
                      {log.details || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
