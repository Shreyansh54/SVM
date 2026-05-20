import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import {
  HiOutlineUserGroup, HiOutlineCube, HiOutlineShoppingCart,
  HiOutlineCurrencyDollar, HiOutlineExclamation, HiOutlineTrendingUp,
  HiOutlineLightBulb, HiOutlineTrendingDown
} from 'react-icons/hi';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

export default function Dashboard() {
  const { user, isAdmin: isUserAdmin, isManager } = useAuth();
  const isAdmin = isUserAdmin || isManager;
  const [summary, setSummary] = useState(null);
  const [topEmployees, setTopEmployees] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [monthlySales, setMonthlySales] = useState([]);
  const [insights, setInsights] = useState([]);
  const [topMedicines, setTopMedicines] = useState([]);
  const [leastMedicines, setLeastMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [birthdays, setBirthdays] = useState({ today: [], upcoming: [] });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const promises = [
        api.get('/sales/monthly'),
        api.get('/dashboard/insights'),
        api.get('/dashboard/top-employee'),
      ];
      if (isAdmin) {
        promises.push(
          api.get('/dashboard/summary'),
          api.get('/dashboard/low-stock'),
          api.get('/dashboard/top-medicines'),
          api.get('/dashboard/least-medicines'),
        );
      }
      const results = await Promise.all(promises);
      setMonthlySales(results[0].data);
      setInsights(results[1].data);
      setTopEmployees(results[2].data);
      if (isAdmin) {
        setSummary(results[3].data);
        setLowStock(results[4].data);
        setTopMedicines(results[5].data);
        setLeastMedicines(results[6].data);
      }
      // Load birthdays for everyone
      const bRes = await api.get('/dashboard/birthdays');
      setBirthdays(bRes.data);
    } catch (err) { console.error('Dashboard load error:', err); }
    finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = isAdmin ? [
    { label: 'Total Employees', value: summary?.total_employees || 0, icon: HiOutlineUserGroup, color: 'from-[#0A373A] to-[#14A89C]', bg: 'bg-[#0A373A]/10' },
    { label: 'Total Medicines', value: summary?.total_products || 0, icon: HiOutlineCube, color: 'from-[#14A89C] to-teal-600', bg: 'bg-[#14A89C]/10' },
    { label: 'Total Sales', value: `₹${(summary?.total_sales_amount || 0).toLocaleString()}`, icon: HiOutlineCurrencyDollar, color: 'from-emerald-600 to-teal-600', bg: 'bg-emerald-500/10' },
    { label: 'Sales Count', value: summary?.total_sales_count || 0, icon: HiOutlineShoppingCart, color: 'from-amber-600 to-orange-500', bg: 'bg-amber-500/10' },
    { label: 'Stockists', value: summary?.total_stockists || 0, icon: HiOutlineTrendingUp, color: 'from-[#14A89C] to-emerald-500', bg: 'bg-[#14A89C]/10' },
    { label: 'Low Stock', value: summary?.low_stock_count || 0, icon: HiOutlineExclamation, color: 'from-red-600 to-rose-500', bg: 'bg-red-500/10' },
  ] : [];

  const salesChartData = {
    labels: monthlySales.map(s => s.month),
    datasets: [{
      label: 'Revenue', data: monthlySales.map(s => s.total_amount),
      fill: true, borderColor: '#49D7C4', backgroundColor: 'rgba(73, 215, 196, 0.1)',
      tension: 0.4, pointBackgroundColor: '#49D7C4', pointBorderColor: '#49D7C4', pointRadius: 4,
    }]
  };

  const topEmpChart = {
    labels: topEmployees.map(e => e.employee_name),
    datasets: [{
      label: 'Sales Amount', data: topEmployees.map(e => e.total_sales),
      backgroundColor: ['#0F7FA6', '#14C89E', '#11C5A3', '#49D7C4', '#a7f3d0'],
      borderRadius: 8, borderSkipped: false,
    }]
  };

  const topMedChart = {
    labels: topMedicines.map(m => m.medicine_name?.length > 15 ? m.medicine_name.substring(0, 15) + '…' : m.medicine_name),
    datasets: [{
      label: 'Qty Sold', data: topMedicines.map(m => m.total_qty_sold),
      backgroundColor: ['#14C89E', '#11C5A3', '#49D7C4', '#81e6d9', '#b2f5ea'],
      borderRadius: 8, borderSkipped: false,
    }]
  };

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#FFFFFF', titleColor: '#131033', bodyColor: '#6B7280',
        borderColor: '#E5E7EB', borderWidth: 1, cornerRadius: 12, padding: 12,
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#6B7280', font: { size: 11 } } },
      y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#6B7280', font: { size: 11 } } }
    }
  };

  const insightColors = {
    warning: 'border-amber-500/20 bg-amber-50/50', success: 'border-emerald-500/20 bg-emerald-50/50',
    info: 'border-[#0F7FA6]/20 bg-sky-50/50', danger: 'border-red-500/20 bg-red-50/50',
  };
  const insightTextColors = {
    warning: 'text-amber-600', success: 'text-emerald-600', info: 'text-[#0F7FA6]', danger: 'text-red-600',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          {isAdmin ? 'Overview of your business performance' : `Welcome back, ${user?.username}! Here's your summary.`}
        </p>
      </div>

      {/* 🎂 Birthday Widget */}
      {(birthdays.today.length > 0 || birthdays.upcoming.length > 0) && (
        <div className="space-y-3">
          {birthdays.today.map(emp => (
            <div key={emp.id} style={{
              background: 'linear-gradient(135deg, #0A373A 0%, #14A89C 60%, #0A373A 100%)',
              borderRadius: '16px', padding: '20px 24px',
              display: 'flex', alignItems: 'center', gap: '16px',
              boxShadow: '0 0 30px rgba(20,168,156,0.35)',
              position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ fontSize: '2.5rem', flexShrink: 0 }}>🎂</div>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#fff', fontWeight: '700', fontSize: '1rem', marginBottom: '2px' }}>
                  🎉 Happy Birthday, {emp.name}!
                </p>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem' }}>
                  SHREYANSH VOLLORA wishes you a wonderful birthday today! 🌟
                </p>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: '5rem', position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>✨</div>
            </div>
          ))}
          {birthdays.upcoming.length > 0 && (
            <div className="card" style={{ padding: '16px 20px' }}>
              <p className="text-sm font-semibold text-[#0A373A] mb-3">🎈 Upcoming Birthdays</p>
              <div className="space-y-2">
                {birthdays.upcoming.map(emp => (
                  <div key={emp.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '8px 12px', borderRadius: '10px',
                    background: '#F0F6F6', border: '1px solid #E1ECEB'
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>🎂</span>
                    <span className="text-sm font-medium text-[#1A3D40] flex-1">{emp.name}</span>
                    <span className="text-xs text-[#14A89C] font-semibold">
                      in {emp.days_until} day{emp.days_until > 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stat Cards */}
      {isAdmin && statCards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {statCards.map((card, i) => (
            <div key={i} className="stat-card" style={{ animationDelay: `${i * 60}ms` }}>
              <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 bg-gradient-to-r ${card.color} bg-clip-text`} style={{ color: 'transparent', WebkitBackgroundClip: 'text', backgroundImage: `linear-gradient(to right, var(--tw-gradient-stops))` }} />
              </div>
              <p className="text-2xl font-bold text-[#1A3D40] mt-1">{card.value}</p>
              <p className="text-xs text-[#5B7F83]">{card.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* AI Insights */}
      {insights.length > 0 && (
        <div className="card">
          <h2 className="section-title mb-4 flex items-center gap-2">
            <HiOutlineLightBulb className="w-5 h-5 text-amber-400" /> Smart Insights
            <span className="text-xs font-normal text-[#5B7F83] ml-2">AI-powered analysis</span>
          </h2>
          <div className="space-y-3">
            {insights.map((insight, i) => (
              <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${insightColors[insight.type] || insightColors.info}`}>
                <span className="text-xl mt-0.5">{insight.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${insightTextColors[insight.type] || 'text-blue-400'}`}>{insight.title}</p>
                  <p className="text-sm text-[#4A6D71] mt-0.5">{insight.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Row 1: Sales + Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="section-title mb-4">Sales Trend</h2>
          <div className="h-64">
            {monthlySales.length > 0 ? <Line data={salesChartData} options={chartOptions} /> :
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">No sales data yet</div>}
          </div>
        </div>
        <div className="card">
          <h2 className="section-title mb-4">Top Performers</h2>
          <div className="h-64">
            {topEmployees.length > 0 ? <Bar data={topEmpChart} options={chartOptions} /> :
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">No employee data yet</div>}
          </div>
        </div>
      </div>

      {/* Charts Row 2: Top Medicines + Least Selling */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Selling Medicines */}
          <div className="card">
            <h2 className="section-title mb-4 flex items-center gap-2">
              <HiOutlineTrendingUp className="w-5 h-5 text-emerald-400" /> Top Selling Medicines
            </h2>
            {topMedicines.length > 0 ? (
              <div>
                <div className="h-52 mb-4">
                  <Bar data={topMedChart} options={chartOptions} />
                </div>
                <div className="space-y-2">
                  {topMedicines.map((m, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-400 font-bold text-lg w-6 text-center">#{i + 1}</span>
                        <div>
                          <span className="text-sm font-medium text-[#1A3D40]">{m.medicine_name}</span>
                          {m.generic_name && <span className="text-xs text-[#5B7F83] ml-2 italic">{m.generic_name}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-emerald-600">{m.total_qty_sold} units</div>
                        <div className="text-xs text-[#5B7F83]">₹{m.total_revenue?.toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-500 text-sm">No sales data yet</div>
            )}
          </div>

          {/* Least Selling Medicines */}
          <div className="card">
            <h2 className="section-title mb-4 flex items-center gap-2">
              <HiOutlineTrendingDown className="w-5 h-5 text-red-400" /> Least Selling Medicines
            </h2>
            {leastMedicines.length > 0 ? (
              <div className="space-y-2">
                {leastMedicines.map((m, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl bg-red-500/5 border border-red-500/10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                        <span className="text-red-400 font-bold text-sm">{i + 1}</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-[#1A3D40]">{m.medicine_name}</span>
                        {m.manufacturer && <span className="text-xs text-[#5B7F83] ml-2">by {m.manufacturer}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      {m.total_qty_sold === 0 ? (
                        <span className="badge-danger">Zero Sales</span>
                      ) : (
                        <>
                          <div className="text-sm font-semibold text-red-600">{m.total_qty_sold} units</div>
                          <div className="text-xs text-[#5B7F83]">{m.order_count} order(s)</div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-gray-600 mt-2 italic">💡 Consider promotional offers or bundling these medicines to boost sales.</p>
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-500 text-sm">Add medicines to see analytics</div>
            )}
          </div>
        </div>
      )}

      {/* Low Stock Alerts */}
      {isAdmin && lowStock.length > 0 && (
        <div className="card border-red-500/20">
          <h2 className="section-title text-red-600 mb-4 flex items-center gap-2">
            <HiOutlineExclamation className="w-5 h-5" /> Low Stock Alerts (below 500 units)
          </h2>
          <div className="space-y-2">
            {lowStock.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl bg-red-500/5 border border-red-500/10">
                <div>
                  <span className="text-sm font-medium text-[#1A3D40]">{item.product_name}</span>
                  <span className="text-xs text-[#5B7F83] ml-2">at {item.stockist_name}</span>
                </div>
                <span className="badge-danger">{item.quantity} units</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
