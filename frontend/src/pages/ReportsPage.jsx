import { useState, useEffect } from 'react';
import api from '../api';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { HiOutlineDownload } from 'react-icons/hi';
import toast from 'react-hot-toast';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

export default function ReportsPage() {
  const [monthlySales, setMonthlySales] = useState([]);
  const [topEmployees, setTopEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/sales/monthly'), api.get('/dashboard/top-employee'),
      api.get('/products/'), api.get('/sales/')
    ]).then(([mRes, tRes, pRes, sRes]) => {
      setMonthlySales(mRes.data); setTopEmployees(tRes.data);
      setProducts(pRes.data); setSales(sRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

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

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;

  const revenueChart = {
    labels: monthlySales.map(s => s.month),
    datasets: [{
      label: 'Revenue (₹)', data: monthlySales.map(s => s.total_amount),
      fill: true, borderColor: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.08)',
      tension: 0.4, pointRadius: 5, pointBackgroundColor: '#6366f1',
    }]
  };

  const salesCountChart = {
    labels: monthlySales.map(s => s.month),
    datasets: [{
      label: 'Transactions', data: monthlySales.map(s => s.total_count),
      backgroundColor: '#8b5cf6', borderRadius: 8, borderSkipped: false,
    }]
  };

  const productSales = {};
  sales.forEach(s => {
    const name = s.product_name || `#${s.product_id}`;
    productSales[name] = (productSales[name] || 0) + s.total_amount;
  });
  const productChart = {
    labels: Object.keys(productSales),
    datasets: [{
      data: Object.values(productSales),
      backgroundColor: ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#e879f9', '#f472b6', '#fb923c', '#34d399'],
      borderWidth: 0,
    }]
  };

  const empCompare = {
    labels: topEmployees.map(e => e.employee_name),
    datasets: [{
      label: 'Total Sales (₹)', data: topEmployees.map(e => e.total_sales),
      backgroundColor: topEmployees.map((_, i) => [`#6366f1`, `#8b5cf6`, `#a78bfa`, `#c4b5fd`, `#ddd6fe`][i]),
      borderRadius: 8, borderSkipped: false,
    }]
  };

  const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8', cornerRadius: 12, padding: 12, borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11 } } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 11 } } }
    }
  };

  const doughnutOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { color: '#94a3b8', padding: 12, usePointStyle: true, pointStyleWidth: 10, font: { size: 11 } } },
      tooltip: { backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8', cornerRadius: 12 }
    },
    cutout: '65%',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Business insights and performance metrics</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => downloadFile('/export/pdf/all', 'SHREYANSH_VOLLORA_Report.pdf')}
            className="btn-primary flex items-center gap-2">
            <HiOutlineDownload className="w-4 h-4" /> Download PDF
          </button>
          <button onClick={() => downloadFile('/export/excel/all', 'SHREYANSH_VOLLORA_Report.xlsx')}
            className="btn-secondary flex items-center gap-2">
            <HiOutlineDownload className="w-4 h-4" /> Download Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="section-title mb-4">Revenue Trend</h2>
          <div className="h-72">{monthlySales.length ? <Line data={revenueChart} options={chartOpts} /> : <div className="flex items-center justify-center h-full text-gray-500">No data</div>}</div>
        </div>

        <div className="card">
          <h2 className="section-title mb-4">Monthly Transactions</h2>
          <div className="h-72">{monthlySales.length ? <Bar data={salesCountChart} options={chartOpts} /> : <div className="flex items-center justify-center h-full text-gray-500">No data</div>}</div>
        </div>

        <div className="card">
          <h2 className="section-title mb-4">Product Sales Breakdown</h2>
          <div className="h-72">{Object.keys(productSales).length ? <Doughnut data={productChart} options={doughnutOpts} /> : <div className="flex items-center justify-center h-full text-gray-500">No data</div>}</div>
        </div>

        <div className="card">
          <h2 className="section-title mb-4">Employee Performance</h2>
          <div className="h-72">{topEmployees.length ? <Bar data={empCompare} options={chartOpts} /> : <div className="flex items-center justify-center h-full text-gray-500">No data</div>}</div>
        </div>
      </div>
    </div>
  );
}
