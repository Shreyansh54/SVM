import { useState, useEffect, useMemo } from 'react';
import api from '../api';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  HiOutlineDownload, HiOutlineChartBar, HiOutlineCalendar,
  HiOutlineFlag, HiOutlinePlus, HiOutlineTrash, HiOutlinePencil,
  HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlineCheck,
  HiOutlineTrendingUp
} from 'react-icons/hi';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler
);

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const FULL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const PALETTE = [
  '#14A89C','#0A373A','#6366f1','#f59e0b','#10b981','#ef4444',
  '#8b5cf6','#06b6d4','#f97316','#84cc16','#ec4899','#14b8a6'
];

const chartOpts = (currency = false) => ({
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { color: '#4A6D71', padding: 16, usePointStyle: true, pointStyleWidth: 10, font: { size: 11 } } },
    tooltip: {
      backgroundColor: '#fff', titleColor: '#0A373A', bodyColor: '#4A6D71',
      borderColor: '#E1ECEB', borderWidth: 1, cornerRadius: 12, padding: 12,
      callbacks: currency ? { label: ctx => ` ₹${ctx.parsed.y?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` } : {}
    }
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#4A6D71', font: { size: 11 } } },
    y: {
      grid: { color: 'rgba(0,0,0,0.05)' }, ticks: {
        color: '#4A6D71', font: { size: 11 },
        callback: currency ? v => '₹' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v) : undefined
      }
    }
  }
});

const currentYearMonth = () => {
  const n = new Date();
  return { year: n.getFullYear(), month: n.getMonth() + 1 };
};

function pct(actual, target) {
  if (!target || target <= 0) return null;
  return Math.min(100, (actual / target) * 100);
}

function PctBar({ value }) {
  if (value === null) return <span className="text-xs text-gray-400">No target</span>;
  const color = value >= 80 ? '#10b981' : value >= 50 ? '#f59e0b' : '#ef4444';
  const emoji = value >= 80 ? '🟢' : value >= 50 ? '🟡' : '🔴';
  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold whitespace-nowrap" style={{ color }}>{emoji} {value.toFixed(0)}%</span>
    </div>
  );
}

export default function ReportsPage() {
  const { isAdmin, isManager } = useAuth();
  const canManage = isAdmin || isManager;

  const [tab, setTab] = useState('monthly');
  const [loading, setLoading] = useState(true);

  // ── Monthly tab state ────────────────────────────────
  const [monthlyData, setMonthlyData]   = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(null); // null = all months

  // ── Weekly tab state ─────────────────────────────────
  const [weeklyData, setWeeklyData]     = useState([]);
  const [weekCount, setWeekCount]       = useState(8);
  const [focusEmployee, setFocusEmployee] = useState('all');

  // ── Targets tab state ────────────────────────────────
  const [targets, setTargets]           = useState([]);
  const [employees, setEmployees]       = useState([]);
  const [targetForm, setTargetForm]     = useState({
    employee_id: '', period_type: 'monthly', period_key: '', target_amount: ''
  });
  const [targetPeriodMode, setTargetPeriodMode] = useState('monthly');

  // ── Legacy charts (original tab) ────────────────────
  const [monthlySales, setMonthlySales] = useState([]);
  const [topEmployees, setTopEmployees] = useState([]);
  const [sales, setSales]               = useState([]);

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (tab === 'monthly') loadMonthly(); }, [tab, selectedYear]);
  useEffect(() => { if (tab === 'weekly') loadWeekly(); }, [tab, weekCount]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [mRes, tRes, empRes, sRes, tgRes] = await Promise.all([
        api.get('/sales/monthly'),
        api.get('/dashboard/top-employee'),
        canManage ? api.get('/employees/') : Promise.resolve({ data: [] }),
        api.get('/sales/'),
        api.get('/dashboard/targets'),
      ]);
      setMonthlySales(mRes.data);
      setTopEmployees(tRes.data);
      setEmployees(empRes.data);
      setSales(sRes.data);
      setTargets(tgRes.data);
      // also pre-load monthly
      const emRes = await api.get(`/dashboard/employee-monthly?year=${new Date().getFullYear()}`);
      setMonthlyData(emRes.data);
      const ewRes = await api.get(`/dashboard/employee-weekly?weeks=${weekCount}`);
      setWeeklyData(ewRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadMonthly = async () => {
    try {
      const res = await api.get(`/dashboard/employee-monthly?year=${selectedYear}`);
      setMonthlyData(res.data);
    } catch {}
  };

  const loadWeekly = async () => {
    try {
      const res = await api.get(`/dashboard/employee-weekly?weeks=${weekCount}`);
      setWeeklyData(res.data);
    } catch {}
  };

  const downloadFile = async (url, filename) => {
    try {
      toast.loading('Generating report...', { id: 'dl' });
      const res = await api.get(url, { responseType: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([res.data]));
      link.download = filename; link.click();
      URL.revokeObjectURL(link.href);
      toast.success('Downloaded!', { id: 'dl' });
    } catch { toast.error('Download failed', { id: 'dl' }); }
  };

  // ── Monthly chart data ───────────────────────────────
  const { monthlyChartData, monthlyTableRows } = useMemo(() => {
    const filtered = selectedMonth
      ? monthlyData.filter(r => r.period_key === `${selectedYear}-${String(selectedMonth).padStart(2,'0')}`)
      : monthlyData;

    const empIds = [...new Set(filtered.map(r => r.employee_id))];
    const empNames = {};
    filtered.forEach(r => { empNames[r.employee_id] = r.employee_name; });

    if (selectedMonth) {
      // Single month: bar per employee
      const labels = empIds.map(id => empNames[id]);
      const amounts = empIds.map(id => {
        const row = filtered.find(r => r.employee_id === id);
        return row ? row.total_amount : 0;
      });
      const targetAmounts = empIds.map(id => {
        const row = filtered.find(r => r.employee_id === id);
        return row?.target_amount || null;
      });
      return {
        monthlyChartData: {
          labels,
          datasets: [
            {
              label: 'Actual Sales (₹)',
              data: amounts,
              backgroundColor: empIds.map((_, i) => PALETTE[i % PALETTE.length]),
              borderRadius: 8, borderSkipped: false
            },
            ...(targetAmounts.some(Boolean) ? [{
              label: 'Target (₹)',
              data: targetAmounts.map(t => t || 0),
              backgroundColor: 'rgba(239,68,68,0.15)',
              borderColor: '#ef4444',
              borderWidth: 2,
              borderRadius: 8,
              borderSkipped: false,
              type: 'bar'
            }] : [])
          ]
        },
        monthlyTableRows: filtered
      };
    }

    // All months: grouped bar, one dataset per employee
    const allMonthKeys = [...new Set(filtered.map(r => r.period_key))].sort();
    const labels = allMonthKeys.map(k => {
      const [y, m] = k.split('-');
      return `${MONTHS[parseInt(m)-1]} ${y}`;
    });

    const datasets = empIds.map((empId, i) => ({
      label: empNames[empId],
      data: allMonthKeys.map(mk => {
        const row = filtered.find(r => r.employee_id === empId && r.period_key === mk);
        return row ? row.total_amount : 0;
      }),
      backgroundColor: PALETTE[i % PALETTE.length],
      borderRadius: 6, borderSkipped: false,
    }));

    return {
      monthlyChartData: { labels, datasets },
      monthlyTableRows: filtered
    };
  }, [monthlyData, selectedYear, selectedMonth]);

  // ── Weekly chart data ────────────────────────────────
  const { weeklyChartData, weeklyTableRows, weekLabelsAll, weekTotals } = useMemo(() => {
    const filtered = focusEmployee === 'all'
      ? weeklyData
      : weeklyData.filter(r => r.employee_id === parseInt(focusEmployee));

    const empIds = [...new Set(weeklyData.map(r => r.employee_id))];
    const empNames = {};
    weeklyData.forEach(r => { empNames[r.employee_id] = r.employee_name; });

    const allWeeks = [...new Set(weeklyData.map(r => r.period_key))].sort();
    const weekLabelMap = {};
    weeklyData.forEach(r => { weekLabelMap[r.period_key] = r.week_label; });

    // Total sales per week (all employees)
    const totalsMap = {};
    weeklyData.forEach(r => {
      totalsMap[r.period_key] = (totalsMap[r.period_key] || 0) + r.total_amount;
    });

    const labels = allWeeks.map(k => weekLabelMap[k] || k);

    let datasets;
    if (focusEmployee === 'all') {
      // Stacked bars per employee
      datasets = empIds.map((empId, i) => ({
        label: empNames[empId],
        data: allWeeks.map(wk => {
          const row = weeklyData.find(r => r.employee_id === empId && r.period_key === wk);
          return row ? row.total_amount : 0;
        }),
        backgroundColor: PALETTE[i % PALETTE.length],
        borderRadius: 4,
        stack: 'emp',
      }));
    } else {
      const empName = empNames[parseInt(focusEmployee)] || 'Employee';
      const empRows = filtered;
      datasets = [{
        label: `${empName} — Sales (₹)`,
        data: allWeeks.map(wk => {
          const row = empRows.find(r => r.period_key === wk);
          return row ? row.total_amount : 0;
        }),
        backgroundColor: '#14A89C',
        borderRadius: 8,
      }];
      // Add target line if available
      const hasTargets = empRows.some(r => r.target_amount);
      if (hasTargets) {
        datasets.push({
          label: 'Target (₹)',
          data: allWeeks.map(wk => {
            const row = empRows.find(r => r.period_key === wk);
            return row?.target_amount || 0;
          }),
          type: 'line',
          borderColor: '#ef4444',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 4,
          pointBackgroundColor: '#ef4444',
          tension: 0.3,
        });
      }
    }

    return {
      weeklyChartData: { labels, datasets },
      weeklyTableRows: filtered,
      weekLabelsAll: allWeeks,
      weekTotals: totalsMap
    };
  }, [weeklyData, focusEmployee]);

  // ── Target form helpers ──────────────────────────────
  const currentPeriodKey = (type) => {
    const n = new Date();
    if (type === 'monthly') return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
    // ISO 8601 week — matches Python date.isocalendar()
    const d = new Date(n); d.setHours(0,0,0,0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNo = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return `${d.getFullYear()}-W${String(weekNo).padStart(2,'0')}`;
  };

  const handleSetTarget = async (e) => {
    e.preventDefault();
    if (!targetForm.employee_id || !targetForm.period_key || !targetForm.target_amount) {
      toast.error('Fill all fields'); return;
    }
    try {
      await api.post('/dashboard/targets', {
        employee_id: parseInt(targetForm.employee_id),
        period_type: targetForm.period_type,
        period_key: targetForm.period_key,
        target_amount: parseFloat(targetForm.target_amount),
      });
      toast.success('Target saved!');
      setTargetForm({ employee_id: '', period_type: 'monthly', period_key: '', target_amount: '' });
      const res = await api.get('/dashboard/targets');
      setTargets(res.data);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to save target'); }
  };

  const handleDeleteTarget = async (id) => {
    if (!window.confirm('Delete this target?')) return;
    try {
      await api.delete(`/dashboard/targets/${id}`);
      toast.success('Target deleted');
      setTargets(prev => prev.filter(t => t.id !== id));
    } catch { toast.error('Failed to delete target'); }
  };

  // ── Target completion for current month + week ───────
  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  // Standard ISO 8601 week number — matches Python's date.isocalendar()
  // Works by finding the nearest Thursday (ISO weeks always start on Monday,
  // and the week that contains Thursday is week 1).
  const { isoWeekNum, isoWeekYear } = (() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    // Shift to nearest Thursday: current weekday + offset so Monday=0
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    // Jan 4 is always in ISO week 1
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    );
    return { isoWeekNum: weekNum, isoWeekYear: d.getFullYear() };
  })();
  const thisWeekNum = isoWeekNum;
  const thisWeekKey = `${isoWeekYear}-W${String(isoWeekNum).padStart(2,'0')}`;

  const completionRows = useMemo(() => {
    const allEmpIds = [...new Set([
      ...monthlyData.map(r => r.employee_id),
      ...weeklyData.map(r => r.employee_id),
      ...targets.map(t => t.employee_id)
    ])];
    const empNamesAll = {};
    [...monthlyData, ...weeklyData].forEach(r => { empNamesAll[r.employee_id] = r.employee_name; });
    targets.forEach(t => { if (t.employee_name) empNamesAll[t.employee_id] = t.employee_name; });

    return allEmpIds.map(empId => {
      const monthRow  = monthlyData.find(r => r.employee_id === empId && r.period_key === thisMonthKey);
      const weekRow   = weeklyData.find(r => r.employee_id === empId && r.period_key === thisWeekKey);
      const monthTgt  = targets.find(t => t.employee_id === empId && t.period_type === 'monthly' && t.period_key === thisMonthKey);
      const weekTgt   = targets.find(t => t.employee_id === empId && t.period_type === 'weekly'  && t.period_key === thisWeekKey);
      return {
        empId,
        empName: empNamesAll[empId] || `Employee #${empId}`,
        monthActual:  monthRow?.total_amount  || 0,
        monthTarget:  monthTgt?.target_amount || null,
        weekActual:   weekRow?.total_amount   || 0,
        weekTarget:   weekTgt?.target_amount  || null,
      };
    });
  }, [monthlyData, weeklyData, targets, thisMonthKey, thisWeekKey]);

  // ── Legacy overview data ─────────────────────────────
  const productSales = {};
  sales.forEach(s => {
    const n = s.product_name || `#${s.product_id}`;
    productSales[n] = (productSales[n] || 0) + s.total_amount;
  });

  const TABS = [
    { id: 'monthly', label: 'Monthly Performance', icon: HiOutlineCalendar },
    { id: 'weekly',  label: 'Weekly Performance',  icon: HiOutlineChartBar },
    { id: 'targets', label: 'Targets',             icon: HiOutlineFlag },
    { id: 'overview',label: 'Overview',            icon: HiOutlineTrendingUp },
  ];

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Employee performance, targets & business insights</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => downloadFile('/export/pdf/all', 'SV_Report.pdf')} className="btn-primary flex items-center gap-2">
            <HiOutlineDownload className="w-4 h-4" /> PDF
          </button>
          <button onClick={() => downloadFile('/export/excel/all', 'SV_Report.xlsx')} className="btn-secondary flex items-center gap-2">
            <HiOutlineDownload className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F0F6F6] p-1 rounded-xl w-fit">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t.id
                  ? 'bg-white text-[#0A373A] shadow-sm'
                  : 'text-[#4A6D71] hover:text-[#0A373A]'
              }`}>
              <Icon className="w-4 h-4" />{t.label}
            </button>
          );
        })}
      </div>

      {/* ══════════════ MONTHLY TAB ══════════════════════════ */}
      {tab === 'monthly' && (
        <div className="space-y-5">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedYear(y => y - 1)}
                className="p-2 rounded-lg border border-[#D5E5E4] hover:bg-[#F0F6F6] transition-all">
                <HiOutlineChevronLeft className="w-4 h-4 text-[#4A6D71]" />
              </button>
              <span className="font-bold text-[#0A373A] text-lg w-16 text-center">{selectedYear}</span>
              <button onClick={() => setSelectedYear(y => y + 1)} disabled={selectedYear >= new Date().getFullYear()}
                className="p-2 rounded-lg border border-[#D5E5E4] hover:bg-[#F0F6F6] transition-all disabled:opacity-30">
                <HiOutlineChevronRight className="w-4 h-4 text-[#4A6D71]" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setSelectedMonth(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${!selectedMonth ? 'bg-[#0A373A] text-white border-transparent' : 'border-[#D5E5E4] text-[#4A6D71] hover:bg-[#F0F6F6]'}`}>
                All Months
              </button>
              {MONTHS.map((m, i) => (
                <button key={i} onClick={() => setSelectedMonth(i + 1)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${selectedMonth === i+1 ? 'bg-[#14A89C] text-white border-transparent' : 'border-[#D5E5E4] text-[#4A6D71] hover:bg-[#F0F6F6]'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div className="card">
            <h2 className="section-title mb-1">
              {selectedMonth ? `${FULL_MONTHS[selectedMonth-1]} ${selectedYear} — Employee Sales` : `${selectedYear} — Monthly Employee Sales`}
            </h2>
            <p className="text-xs text-[#4A6D71] mb-4">Revenue per employee {selectedMonth ? 'vs target' : 'across all months'}</p>
            <div className="h-80">
              {monthlyChartData.datasets?.length
                ? <Bar data={monthlyChartData} options={chartOpts(true)} />
                : <div className="flex items-center justify-center h-full text-gray-400 text-sm">No sales data for this period</div>}
            </div>
          </div>

          {/* Table */}
          <div className="table-container">
            <table className="w-full">
              <thead><tr className="table-header">
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Period</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3 text-right">Orders</th>
                <th className="px-4 py-3 text-right">Target</th>
                <th className="px-4 py-3 text-right">Achievement</th>
              </tr></thead>
              <tbody>
                {monthlyTableRows.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No data for selected period</td></tr>
                )}
                {[...monthlyTableRows].sort((a,b) => b.total_amount - a.total_amount).map((r, i) => {
                  const p = pct(r.total_amount, r.target_amount);
                  return (
                    <tr key={i} className="table-row">
                      <td className="px-4 py-3 font-semibold text-[#0A373A]">{r.employee_name}</td>
                      <td className="px-4 py-3 text-sm text-[#4A6D71]">{r.period_key}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">₹{r.total_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500">{r.order_count}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500">
                        {r.target_amount ? `₹${r.target_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right"><PctBar value={p} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════ WEEKLY TAB ═══════════════════════════ */}
      {tab === 'weekly' && (
        <div className="space-y-5">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#4A6D71]">Show last</span>
              {[4, 8, 12].map(n => (
                <button key={n} onClick={() => setWeekCount(n)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${weekCount === n ? 'bg-[#0A373A] text-white border-transparent' : 'border-[#D5E5E4] text-[#4A6D71] hover:bg-[#F0F6F6]'}`}>
                  {n} weeks
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#4A6D71]">Employee</span>
              <select value={focusEmployee} onChange={e => setFocusEmployee(e.target.value)} className="select-field text-sm">
                <option value="all">All Employees (stacked)</option>
                {[...new Set(weeklyData.map(r => r.employee_id))].map(id => {
                  const r = weeklyData.find(x => x.employee_id === id);
                  return <option key={id} value={id}>{r?.employee_name || `#${id}`}</option>;
                })}
              </select>
            </div>
          </div>

          {/* Weekly totals summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {weekLabelsAll.slice(-4).map(wk => {
              const wRow = weeklyData.find(r => r.period_key === wk);
              const lbl  = wRow?.week_label || wk;
              const total = weekTotals[wk] || 0;
              return (
                <div key={wk} className="bg-white border border-[#E1ECEB] rounded-xl p-4">
                  <p className="text-xs text-[#4A6D71] font-semibold">{lbl}</p>
                  <p className="text-lg font-bold text-[#0A373A] mt-1">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                  <p className="text-[10px] text-gray-400">Total revenue</p>
                </div>
              );
            })}
          </div>

          {/* Chart */}
          <div className="card">
            <h2 className="section-title mb-1">Weekly Sales {focusEmployee !== 'all' ? '— ' + (weeklyData.find(r => r.employee_id === parseInt(focusEmployee))?.employee_name || '') : ''}</h2>
            <p className="text-xs text-[#4A6D71] mb-4">{focusEmployee === 'all' ? 'Stacked revenue per employee per week' : 'Individual week-by-week performance vs target'}</p>
            <div className="h-80">
              {weeklyData.length
                ? <Bar data={weeklyChartData} options={{ ...chartOpts(true), scales: { ...chartOpts(true).scales, x: { ...chartOpts(true).scales.x, stacked: focusEmployee === 'all' }, y: { ...chartOpts(true).scales.y, stacked: focusEmployee === 'all' } } }} />
                : <div className="flex items-center justify-center h-full text-gray-400 text-sm">No weekly data</div>}
            </div>
          </div>

          {/* Weekly table */}
          <div className="table-container">
            <table className="w-full">
              <thead><tr className="table-header">
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Week</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3 text-right">Orders</th>
                <th className="px-4 py-3 text-right">Target</th>
                <th className="px-4 py-3 text-right">Achievement</th>
              </tr></thead>
              <tbody>
                {weeklyTableRows.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No data</td></tr>
                )}
                {[...weeklyTableRows].sort((a,b) => b.period_key.localeCompare(a.period_key) || b.total_amount - a.total_amount).map((r, i) => {
                  const p = pct(r.total_amount, r.target_amount);
                  return (
                    <tr key={i} className="table-row">
                      <td className="px-4 py-3 font-semibold text-[#0A373A]">{r.employee_name}</td>
                      <td className="px-4 py-3 text-sm text-[#4A6D71]">{r.week_label}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">₹{r.total_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500">{r.order_count}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500">
                        {r.target_amount ? `₹${r.target_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right"><PctBar value={p} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════ TARGETS TAB ══════════════════════════ */}
      {tab === 'targets' && (
        <div className="space-y-6">
          {/* Target completion dashboard (current period) */}
          <div className="card">
            <h2 className="section-title mb-1">Current Period Achievement</h2>
            <p className="text-xs text-[#4A6D71] mb-4">
              {FULL_MONTHS[now.getMonth()]} {now.getFullYear()} (monthly) · Week {thisWeekNum} (weekly)
            </p>
            <div className="table-container border-0 shadow-none p-0">
              <table className="w-full">
                <thead><tr className="table-header">
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-right">This Month</th>
                  <th className="px-4 py-3 text-right">Monthly Target</th>
                  <th className="px-4 py-3 text-center">Monthly %</th>
                  <th className="px-4 py-3 text-right">This Week</th>
                  <th className="px-4 py-3 text-right">Weekly Target</th>
                  <th className="px-4 py-3 text-center">Weekly %</th>
                </tr></thead>
                <tbody>
                  {completionRows.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No data yet — add sales and set targets</td></tr>
                  )}
                  {completionRows.map((r, i) => (
                    <tr key={i} className="table-row">
                      <td className="px-4 py-3 font-semibold text-[#0A373A]">{r.empName}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">₹{r.monthActual.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500">
                        {r.monthTarget ? `₹${r.monthTarget.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3"><div className="flex justify-center"><PctBar value={pct(r.monthActual, r.monthTarget)} /></div></td>
                      <td className="px-4 py-3 text-right font-bold text-blue-600">₹{r.weekActual.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500">
                        {r.weekTarget ? `₹${r.weekTarget.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3"><div className="flex justify-center"><PctBar value={pct(r.weekActual, r.weekTarget)} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Set target form (admin/manager only) */}
          {canManage && (
            <div className="card">
              <h2 className="section-title mb-4 flex items-center gap-2">
                <HiOutlinePlus className="w-5 h-5 text-[#14A89C]" /> Set / Update Target
              </h2>
              <form onSubmit={handleSetTarget} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold text-[#4A6D71] mb-1">Employee *</label>
                  <select value={targetForm.employee_id} onChange={e => setTargetForm(f => ({...f, employee_id: e.target.value}))} className="select-field text-sm" required>
                    <option value="">Select employee</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A6D71] mb-1">Period Type *</label>
                  <div className="flex gap-2 h-[38px]">
                    {['monthly','weekly'].map(pt => (
                      <button key={pt} type="button"
                        onClick={() => setTargetForm(f => ({...f, period_type: pt, period_key: currentPeriodKey(pt)}))}
                        className={`flex-1 rounded-lg text-xs font-bold border transition-all ${targetForm.period_type === pt ? 'bg-[#14A89C]/20 text-[#0A373A] border-[#14A89C]/40' : 'bg-white text-[#4A6D71] border-[#D5E5E4]'}`}>
                        {pt === 'monthly' ? '📅 Monthly' : '📆 Weekly'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A6D71] mb-1">
                    {targetForm.period_type === 'monthly' ? 'Month (YYYY-MM) *' : 'Week (YYYY-W30) *'}
                  </label>
                  <input type="text"
                    value={targetForm.period_key}
                    onChange={e => setTargetForm(f => ({...f, period_key: e.target.value}))}
                    placeholder={targetForm.period_type === 'monthly' ? '2025-07' : '2025-W30'}
                    className="input-field text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A6D71] mb-1">Target Amount (₹) *</label>
                  <input type="number" min="0" step="100"
                    value={targetForm.target_amount}
                    onChange={e => setTargetForm(f => ({...f, target_amount: e.target.value}))}
                    placeholder="e.g. 150000"
                    className="input-field text-sm"
                    required
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-4 flex gap-3">
                  <button type="submit" className="btn-primary flex items-center gap-2 px-6">
                    <HiOutlineCheck className="w-4 h-4" /> Save Target
                  </button>
                  <button type="button"
                    onClick={() => setTargetForm(f => ({...f, period_key: currentPeriodKey(f.period_type)}))}
                    className="btn-secondary text-sm">
                    Use Current Period
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* All saved targets list */}
          <div className="table-container">
            <div className="px-4 py-3 border-b border-[#E1ECEB]">
              <h3 className="font-bold text-[#0A373A] text-sm">All Saved Targets</h3>
            </div>
            <table className="w-full">
              <thead><tr className="table-header">
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Period</th>
                <th className="px-4 py-3 text-right">Target (₹)</th>
                {canManage && <th className="px-4 py-3 text-right">Action</th>}
              </tr></thead>
              <tbody>
                {targets.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">No targets set yet</td></tr>
                )}
                {targets.map(t => (
                  <tr key={t.id} className="table-row">
                    <td className="px-4 py-3 font-semibold text-[#0A373A]">{t.employee_name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${t.period_type === 'monthly' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {t.period_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#4A6D71] font-mono">{t.period_key}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#0A373A]">₹{t.target_amount.toLocaleString('en-IN')}</td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleDeleteTarget(t.id)}
                          className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all">
                          <HiOutlineTrash className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════ OVERVIEW TAB (legacy) ═══════════════ */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="section-title mb-4">Revenue Trend</h2>
            <div className="h-72">
              {monthlySales.length
                ? <Line data={{ labels: monthlySales.map(s => s.month), datasets: [{ label: 'Revenue (₹)', data: monthlySales.map(s => s.total_amount), fill: true, borderColor: '#14A89C', backgroundColor: 'rgba(20,168,156,0.08)', tension: 0.4, pointRadius: 5, pointBackgroundColor: '#14A89C' }] }} options={chartOpts(true)} />
                : <div className="flex items-center justify-center h-full text-gray-400 text-sm">No data</div>}
            </div>
          </div>

          <div className="card">
            <h2 className="section-title mb-4">Monthly Transactions</h2>
            <div className="h-72">
              {monthlySales.length
                ? <Bar data={{ labels: monthlySales.map(s => s.month), datasets: [{ label: 'Transactions', data: monthlySales.map(s => s.total_count), backgroundColor: '#0A373A', borderRadius: 8, borderSkipped: false }] }} options={chartOpts()} />
                : <div className="flex items-center justify-center h-full text-gray-400 text-sm">No data</div>}
            </div>
          </div>

          <div className="card">
            <h2 className="section-title mb-4">Product Sales Breakdown</h2>
            <div className="h-72">
              {Object.keys(productSales).length
                ? <Doughnut data={{ labels: Object.keys(productSales), datasets: [{ data: Object.values(productSales), backgroundColor: PALETTE, borderWidth: 0 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#4A6D71', padding: 12, usePointStyle: true, font: { size: 11 } } }, tooltip: { backgroundColor: '#fff', titleColor: '#0A373A', bodyColor: '#4A6D71', borderColor: '#E1ECEB', borderWidth: 1, cornerRadius: 12 } }, cutout: '65%' }} />
                : <div className="flex items-center justify-center h-full text-gray-400 text-sm">No data</div>}
            </div>
          </div>

          <div className="card">
            <h2 className="section-title mb-4">Top Performers (All-Time)</h2>
            <div className="h-72">
              {topEmployees.length
                ? <Bar data={{ labels: topEmployees.map(e => e.employee_name), datasets: [{ label: 'Total Sales (₹)', data: topEmployees.map(e => e.total_sales), backgroundColor: PALETTE, borderRadius: 8, borderSkipped: false }] }} options={chartOpts(true)} />
                : <div className="flex items-center justify-center h-full text-gray-400 text-sm">No data</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
