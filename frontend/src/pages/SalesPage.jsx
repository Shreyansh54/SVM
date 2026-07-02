import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';
import toast from 'react-hot-toast';
import {
  HiOutlinePlus, HiOutlineDownload, HiOutlineX, HiOutlineTrash,
  HiOutlinePencil, HiOutlineChevronDown, HiOutlineChevronUp,
  HiOutlineCalendar, HiOutlineFilter
} from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';

const today = () => new Date().toISOString().slice(0, 10);

const BLANK_LINE = {
  product_id: '', batch_id: '', quantity_sold: '', bonus_quantity: '0',
  discount_percentage: '0', applied_price_type: 'mrp', manual_price: ''
};

const BLANK_ORDER = {
  employee_id: '', sale_type: 'stockist', stockist_id: '', doctor_id: '',
  sale_date: today(),
  items: [{ ...BLANK_LINE }]
};

// ── Month label helper ───────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const monthLabel = (key) => {
  // key = "2025-06"
  const [y, m] = key.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
};

export default function SalesPage() {
  const { isAdmin, isManager, user } = useAuth();
  const canManage = isAdmin || isManager;

  const [sales, setSales]         = useState([]);
  const [employees, setEmployees] = useState([]);
  const [stockists, setStockists] = useState([]);
  const [doctors, setDoctors]     = useState([]);
  const [products, setProducts]   = useState([]);
  const [batches, setBatches]     = useState([]);
  const [loading, setLoading]     = useState(true);

  // New-order modal
  const [showModal, setShowModal]             = useState(false);
  const [order, setOrder]                     = useState(BLANK_ORDER);
  const [submitting, setSubmitting]           = useState(false);
  const [doctorSearch, setDoctorSearch]       = useState('');
  const [showDoctorDropdown, setShowDoctorDropdown] = useState(false);

  // Month view state
  const [selectedMonth, setSelectedMonth] = useState('all');   // "all" or "YYYY-MM"
  const [collapsedMonths, setCollapsedMonths] = useState({});  // { "2025-06": true }

  // Edit modal
  const [editSale, setEditSale]           = useState(null);
  const [editForm, setEditForm]           = useState({});
  const [editSubmitting, setEditSubmitting] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const promises = [
        api.get('/sales/'), api.get('/stockists/'), api.get('/products/'),
        api.get('/batches/'), api.get('/doctors')
      ];
      if (canManage) promises.push(api.get('/employees/'));
      const results = await Promise.all(promises);
      setSales(results[0].data);
      setStockists(results[1].data);
      setProducts(results[2].data);
      setBatches(results[3].data);
      setDoctors(results[4].data);
      if (canManage) setEmployees(results[5].data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  // ── Invoice download ─────────────────────────────────
  const downloadInvoice = async (saleId, invoiceNumber) => {
    try {
      const token = localStorage.getItem('token');
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      const res = await fetch(`${apiBase}/invoices/${saleId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Invoice_${invoiceNumber || saleId}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Invoice download failed'); }
  };

  // ── Permission helper ────────────────────────────────
  const canEditSale = (s) => canManage || s.employee_id === user?.employee_id;

  // ── Delete handlers ──────────────────────────────────
  const handleDeleteSale = async (saleId) => {
    if (!window.confirm('Delete this sale? Stock will be restored for stockist sales.')) return;
    try {
      await api.delete(`/sales/${saleId}`);
      toast.success('Sale deleted and stock restored.');
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to delete sale'); }
  };

  const handleDeleteOrder = async (saleOrderId) => {
    if (!window.confirm(`Delete the entire order "${saleOrderId}"? All line items and stock will be restored.`)) return;
    try {
      await api.delete(`/sales/order/${saleOrderId}`);
      toast.success('Order deleted and stock restored.');
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to delete order'); }
  };

  // ── Edit handlers ────────────────────────────────────
  const openEdit = (s) => {
    setEditSale(s);
    setEditForm({
      quantity_sold: s.quantity_sold,
      bonus_quantity: s.bonus_quantity || 0,
      discount_percentage: s.discount_percentage || 0,
      batch_id: s.batch_id || '',
      applied_price_type: 'mrp',
      manual_price: '',
    });
  };
  const closeEdit = () => { setEditSale(null); setEditForm({}); };

  const editBatches = editSale
    ? batches.filter(b => b.product_id === editSale.product_id && b.status === 'active')
    : [];

  const editPreview = () => {
    if (!editSale) return null;
    const product = products.find(p => p.id === editSale.product_id);
    if (!product) return null;
    const pt = editForm.applied_price_type || 'mrp';
    let unitPrice;
    if (pt === 'manual') {
      unitPrice = parseFloat(editForm.manual_price || 0);
      if (!unitPrice) return null;
    } else if (pt === 'mrp' && editForm.batch_id) {
      const b = batches.find(b => b.id == editForm.batch_id);
      unitPrice = (b && b.mrp) ? b.mrp : product.mrp || product.price;
    } else {
      unitPrice = product[pt] || product.price;
    }
    const discount = parseFloat(editForm.discount_percentage || 0);
    const qty = parseInt(editForm.quantity_sold || 0);
    if (qty <= 0) return null;
    const subtotal = qty * unitPrice * (1 - discount / 100);
    const gst = editSale.gst_rate ?? 5.0;
    const total = subtotal * (1 + gst / 100);
    return { unitPrice, discount, qty, subtotal, gst, total };
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editSale) return;
    const qty = parseInt(editForm.quantity_sold);
    if (!qty || qty <= 0) { toast.error('Quantity must be greater than 0'); return; }
    if (editForm.applied_price_type === 'manual' && (!editForm.manual_price || parseFloat(editForm.manual_price) <= 0)) {
      toast.error('Enter a valid manual price'); return;
    }
    setEditSubmitting(true);
    try {
      await api.put(`/sales/${editSale.id}`, {
        quantity_sold: qty,
        bonus_quantity: parseInt(editForm.bonus_quantity) || 0,
        discount_percentage: parseFloat(editForm.discount_percentage) || 0,
        batch_id: editForm.batch_id ? parseInt(editForm.batch_id) : null,
        applied_price_type: editForm.applied_price_type || 'mrp',
        manual_price: editForm.applied_price_type === 'manual' ? parseFloat(editForm.manual_price) : null,
      });
      toast.success('Sale updated!');
      closeEdit(); load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to update sale'); }
    finally { setEditSubmitting(false); }
  };

  // ── New-order line helpers ───────────────────────────
  const updateItem = (idx, field, value) => {
    const items = order.items.map((it, i) =>
      i === idx ? { ...it, [field]: value, ...(field === 'product_id' ? { batch_id: '' } : {}) } : it
    );
    setOrder(o => ({ ...o, items }));
  };
  const addLine    = () => setOrder(o => ({ ...o, items: [...o.items, { ...BLANK_LINE }] }));
  const removeLine = (idx) => {
    if (order.items.length === 1) return;
    setOrder(o => ({ ...o, items: o.items.filter((_, i) => i !== idx) }));
  };

  const GST_RATE = 5.0;
  const linePreview = (item) => {
    if (!item.product_id || !item.quantity_sold) return null;
    const product = products.find(p => p.id == item.product_id);
    if (!product) return null;
    let unitPrice;
    if (item.applied_price_type === 'manual') {
      unitPrice = parseFloat(item.manual_price || 0);
      if (!unitPrice) return null;
    } else {
      unitPrice = product[item.applied_price_type] || product.price;
      if (item.applied_price_type === 'mrp' && item.batch_id) {
        const b = batches.find(b => b.id == item.batch_id);
        if (b && b.mrp) unitPrice = b.mrp;
      }
    }
    const discount = parseFloat(item.discount_percentage || 0);
    const discountedPrice = unitPrice * (1 - discount / 100);
    const qty = parseInt(item.quantity_sold || 0);
    const bonus = parseInt(item.bonus_quantity || 0);
    const subtotal = qty * discountedPrice;
    const gstAmount = subtotal * (GST_RATE / 100);
    const total = subtotal + gstAmount;
    return { unitPrice, discountedPrice, subtotal, gstAmount, total, discount, bonus, qty };
  };

  const orderSubtotal = order.items.reduce((s, it) => { const p = linePreview(it); return s + (p ? p.subtotal : 0); }, 0);
  const orderGst      = orderSubtotal * (GST_RATE / 100);
  const orderTotal    = orderSubtotal + orderGst;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const empId = canManage ? parseInt(order.employee_id) : user.employee_id;
    if (!empId) { toast.error('Please select an employee.'); return; }
    if (order.sale_type === 'stockist' && !order.stockist_id) { toast.error('Please select a stockist.'); return; }
    if (order.sale_type === 'doctor'   && !order.doctor_id)   { toast.error('Please select a doctor.'); return; }
    for (let i = 0; i < order.items.length; i++) {
      const it = order.items[i];
      if (!it.product_id) { toast.error(`Line ${i + 1}: Select a product.`); return; }
      if (!it.quantity_sold || parseInt(it.quantity_sold) <= 0) { toast.error(`Line ${i + 1}: Enter a valid quantity.`); return; }
      if (it.applied_price_type === 'manual' && (!it.manual_price || parseFloat(it.manual_price) <= 0)) {
        toast.error(`Line ${i + 1}: Enter a valid manual price.`); return;
      }
    }
    setSubmitting(true);
    try {
      await api.post('/sales/bulk', {
        employee_id: empId,
        sale_type: order.sale_type,
        stockist_id: order.sale_type === 'stockist' ? parseInt(order.stockist_id) : null,
        doctor_id:   order.sale_type === 'doctor'   ? parseInt(order.doctor_id)   : null,
        sale_date: order.sale_date || null,
        items: order.items.map(it => ({
          product_id:          parseInt(it.product_id),
          batch_id:            it.batch_id ? parseInt(it.batch_id) : null,
          quantity_sold:       parseInt(it.quantity_sold),
          bonus_quantity:      parseInt(it.bonus_quantity) || 0,
          discount_percentage: parseFloat(it.discount_percentage) || 0,
          applied_price_type:  it.applied_price_type || 'mrp',
          manual_price:        it.applied_price_type === 'manual' ? parseFloat(it.manual_price) : null,
        }))
      });
      toast.success(`Order recorded for ${order.sale_date || 'today'}!`);
      setShowModal(false); setOrder(BLANK_ORDER);
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Error recording order'); }
    finally { setSubmitting(false); }
  };

  // ── Group sales by sale_order_id ─────────────────────
  const groupedSales = useMemo(() => {
    const groups = [];
    const seen = new Set();
    for (const s of sales) {
      if (s.sale_order_id && seen.has(s.sale_order_id)) continue;
      if (s.sale_order_id) {
        seen.add(s.sale_order_id);
        const lines = sales.filter(x => x.sale_order_id === s.sale_order_id);
        groups.push({ isGroup: true, order_id: s.sale_order_id, lines, date: s.date });
      } else {
        groups.push({ isGroup: false, sale: s, date: s.date });
      }
    }
    return groups;
  }, [sales]);

  // ── Build month buckets ──────────────────────────────
  const { monthKeys, buckets } = useMemo(() => {
    const bkts = {};
    for (const g of groupedSales) {
      const d = g.date ? new Date(g.date) : new Date();
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!bkts[key]) bkts[key] = [];
      bkts[key].push(g);
    }
    // Sort months newest first
    const keys = Object.keys(bkts).sort((a, b) => b.localeCompare(a));
    return { monthKeys: keys, buckets: bkts };
  }, [groupedSales]);

  // Dropdown options for month filter
  const monthOptions = monthKeys;

  // Which month buckets to render
  const visibleMonthKeys = selectedMonth === 'all' ? monthKeys : monthKeys.filter(k => k === selectedMonth);

  const toggleMonth = (key) =>
    setCollapsedMonths(prev => ({ ...prev, [key]: !prev[key] }));

  // Monthly revenue for a bucket
  const monthRevenue = (groups) =>
    groups.reduce((sum, g) => {
      if (g.isGroup) return sum + g.lines.reduce((s, l) => s + (l.total_amount || 0), 0);
      return sum + (g.sale.total_amount || 0);
    }, 0);

  const monthOrderCount = (groups) =>
    groups.reduce((n, g) => n + (g.isGroup ? 1 : 1), 0);

  const ep = editPreview();

  // ── Render rows for a single group entry ────────────
  const renderGroup = (group, gi) => {
    if (group.isGroup) {
      const first = group.lines[0];
      const groupTotal = group.lines.reduce((s, x) => s + x.total_amount, 0);
      const canDeleteGroup = canManage || group.lines.every(l => l.employee_id === user?.employee_id);
      return [
        <tr key={`hdr-${group.order_id}`} className="bg-[#E3EFEF]/60 border-b border-[#D5E5E4]">
          <td className="px-4 py-2" colSpan={2}>
            <span className="text-xs font-mono text-[#14A89C] font-semibold">{group.order_id}</span>
            <span className="text-xs text-gray-500 ml-2">{first.date ? new Date(first.date).toLocaleDateString('en-IN') : ''}</span>
            <span className="ml-2 text-xs text-gray-500">{first.employee_name}</span>
          </td>
          <td className="px-4 py-2">
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${first.sale_type === 'doctor' ? 'bg-purple-500/15 text-purple-500' : 'bg-blue-500/15 text-blue-500'}`}>
              {first.sale_type === 'doctor' ? `Dr. ${first.doctor_name}` : first.stockist_name}
            </span>
          </td>
          <td className="px-4 py-2 text-xs text-gray-500">{group.lines.length} products</td>
          <td /><td /><td />
          <td className="px-4 py-2 text-right text-sm font-bold text-emerald-500">₹{groupTotal.toLocaleString('en-IN')}</td>
          <td className="px-4 py-2 text-right">
            {canDeleteGroup && (
              <button onClick={() => handleDeleteOrder(group.order_id)}
                className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all" title="Delete entire order">
                <HiOutlineTrash className="w-4 h-4" />
              </button>
            )}
          </td>
        </tr>,
        ...group.lines.map((s) => (
          <tr key={s.id} className="table-row border-l-4 border-l-[#14A89C]/20">
            <td className="px-4 py-2 pl-8">
              <span className="text-xs font-mono text-gray-500">{s.invoice_number}</span>
            </td>
            <td className="px-4 py-2 text-sm text-gray-400">—</td>
            <td className="px-4 py-2 text-sm text-gray-400">—</td>
            <td className="px-4 py-2 text-sm font-medium text-[#1A3D40]">{s.product_name}</td>
            <td className="px-4 py-2 text-xs font-mono text-primary-400">{s.batch_number || '—'}</td>
            <td className="px-4 py-2 text-right text-sm text-gray-300">
              {s.quantity_sold}
              {s.bonus_quantity > 0 && <span className="text-xs text-emerald-400 ml-1">+{s.bonus_quantity} FREE</span>}
            </td>
            <td className="px-4 py-2 text-right">
              {s.discount_percentage > 0
                ? <span className="text-amber-400 text-sm">{s.discount_percentage}%</span>
                : <span className="text-gray-600">—</span>}
            </td>
            <td className="px-4 py-2 text-right text-sm font-semibold text-emerald-400">₹{s.total_amount?.toLocaleString('en-IN')}</td>
            <td className="px-4 py-2 text-right">
              <div className="flex items-center justify-end gap-1">
                <button onClick={() => downloadInvoice(s.id, s.invoice_number)}
                  className="p-1.5 rounded text-gray-400 hover:text-primary-400 transition-all" title="Download Invoice">
                  <HiOutlineDownload className="w-4 h-4" />
                </button>
                {canEditSale(s) && (<>
                  <button onClick={() => openEdit(s)}
                    className="p-1.5 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-all" title="Edit sale">
                    <HiOutlinePencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteSale(s.id)}
                    className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all" title="Delete sale">
                    <HiOutlineTrash className="w-4 h-4" />
                  </button>
                </>)}
              </div>
            </td>
          </tr>
        ))
      ];
    } else {
      const s = group.sale;
      return (
        <tr key={s.id} className="table-row">
          <td className="px-4 py-3">
            <div className="text-sm text-gray-400">{s.date ? new Date(s.date).toLocaleDateString('en-IN') : '—'}</div>
            {s.invoice_number && <div className="text-xs text-primary-400 font-mono mt-0.5">{s.invoice_number}</div>}
          </td>
          <td className="px-4 py-3 font-medium text-[#1A3D40]">{s.employee_name || `#${s.employee_id}`}</td>
          <td className="px-4 py-3">
            {s.sale_type === 'doctor'
              ? <div><span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-500/15 text-purple-400">Doctor</span><div className="text-xs text-gray-500 mt-0.5">{s.doctor_name}</div></div>
              : <div><span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/15 text-blue-400">Stockist</span><div className="text-xs text-gray-500 mt-0.5">{s.stockist_name}</div></div>}
          </td>
          <td className="px-4 py-3 text-sm text-gray-300">{s.product_name}</td>
          <td className="px-4 py-3 text-xs font-mono text-primary-400">{s.batch_number || '—'}</td>
          <td className="px-4 py-3 text-right text-gray-300">
            {s.quantity_sold}
            {s.bonus_quantity > 0 && <span className="text-xs text-emerald-400 ml-1">+{s.bonus_quantity} FREE</span>}
          </td>
          <td className="px-4 py-3 text-right">
            {s.discount_percentage > 0
              ? <span className="text-amber-400 text-sm font-semibold">{s.discount_percentage}%</span>
              : <span className="text-gray-600 text-sm">—</span>}
          </td>
          <td className="px-4 py-3 text-right font-semibold text-emerald-400">₹{s.total_amount?.toLocaleString('en-IN')}</td>
          <td className="px-4 py-3 text-right">
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => downloadInvoice(s.id, s.invoice_number)}
                className="p-1.5 rounded text-gray-400 hover:text-primary-400 transition-all" title="Download Invoice">
                <HiOutlineDownload className="w-5 h-5" />
              </button>
              {canEditSale(s) && (<>
                <button onClick={() => openEdit(s)}
                  className="p-1.5 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-all" title="Edit sale">
                  <HiOutlinePencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDeleteSale(s.id)}
                  className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all" title="Delete sale">
                  <HiOutlineTrash className="w-4 h-4" />
                </button>
              </>)}
            </div>
          </td>
        </tr>
      );
    }
  };

  return (
    <div className="space-y-6">

      {/* ── Page header ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Sales</h1>
          <p className="text-sm text-gray-500 mt-1">{sales.length} total line items across {monthKeys.length} month{monthKeys.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Month filter */}
          <div className="relative flex items-center gap-2">
            <HiOutlineFilter className="w-4 h-4 text-[#4A6D71]" />
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="select-field text-sm pr-8 min-w-[160px]"
            >
              <option value="all">All months</option>
              {monthOptions.map(k => (
                <option key={k} value={k}>{monthLabel(k)}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => { setOrder({ ...BLANK_ORDER, sale_date: today() }); setDoctorSearch(''); setShowModal(true); }}
            className="btn-primary flex items-center gap-2"
          >
            <HiOutlinePlus className="w-4 h-4" /> New Order
          </button>
        </div>
      </div>

      {loading
        ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
        : (
          <div className="space-y-4">
            {visibleMonthKeys.length === 0 && (
              <div className="table-container"><div className="px-4 py-12 text-center text-gray-500">No sales recorded yet</div></div>
            )}

            {visibleMonthKeys.map(monthKey => {
              const groups = buckets[monthKey];
              const rev    = monthRevenue(groups);
              const cnt    = monthOrderCount(groups);
              const isCollapsed = !!collapsedMonths[monthKey];

              return (
                <div key={monthKey} className="rounded-2xl overflow-hidden border border-[#D5E5E4] shadow-sm">

                  {/* ── Month header bar ── */}
                  <button
                    onClick={() => toggleMonth(monthKey)}
                    className="w-full flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-[#0A373A] to-[#1a5a5f] text-white hover:from-[#0c3f43] hover:to-[#1e6468] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <HiOutlineCalendar className="w-5 h-5 text-[#14A89C]" />
                      <span className="font-bold text-base tracking-wide">{monthLabel(monthKey)}</span>
                      <span className="text-white/60 text-sm">{cnt} order{cnt !== 1 ? 's' : ''} · {sales.filter(s => {
                        const d = s.date ? new Date(s.date) : new Date();
                        const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                        return k === monthKey;
                      }).length} line item{sales.filter(s => { const d = s.date ? new Date(s.date) : new Date(); const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; return k === monthKey; }).length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs text-white/60 uppercase tracking-widest">Revenue</div>
                        <div className="text-lg font-bold text-emerald-300">₹{rev.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                      </div>
                      {isCollapsed
                        ? <HiOutlineChevronDown className="w-5 h-5 text-white/70" />
                        : <HiOutlineChevronUp   className="w-5 h-5 text-white/70" />}
                    </div>
                  </button>

                  {/* ── Sales table for this month ── */}
                  {!isCollapsed && (
                    <div className="table-container rounded-none border-0">
                      <table className="w-full">
                        <thead><tr className="table-header">
                          <th className="px-4 py-3 text-left">Date / Order</th>
                          <th className="px-4 py-3 text-left">Employee</th>
                          <th className="px-4 py-3 text-left">Channel</th>
                          <th className="px-4 py-3 text-left">Product</th>
                          <th className="px-4 py-3 text-left">Batch</th>
                          <th className="px-4 py-3 text-right">Qty</th>
                          <th className="px-4 py-3 text-right">Discount</th>
                          <th className="px-4 py-3 text-right">Amount</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr></thead>
                        <tbody>
                          {groups.map((g, gi) => renderGroup(g, gi))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      }

      {/* ── Edit Sale Modal ──────────────────────────────── */}
      {editSale && createPortal(
        <div style={{ position:'fixed', inset:0, zIndex:9999, backgroundColor:'rgba(10,55,58,0.45)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
          <div style={{ width:'100%', maxWidth:'36rem', background:'#FFFFFF', border:'1px solid #E1ECEB', borderRadius:'1rem', padding:'1.5rem', boxShadow:'0 25px 50px rgba(10,55,58,0.15)' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-[#1A3D40]">Edit Sale</h2>
                <p className="text-xs text-[#4A6D71] mt-0.5 font-mono">{editSale.invoice_number}</p>
              </div>
              <button onClick={closeEdit} className="text-[#4A6D71] hover:text-[#0A373A]"><HiOutlineX className="w-5 h-5" /></button>
            </div>

            <div className="bg-[#F0F6F6] border border-[#E1ECEB] rounded-xl p-3 mb-5">
              <p className="text-xs font-bold text-[#4A6D71] uppercase tracking-widest mb-2">Sale Details (read-only)</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-[#4A6D71]">Product</span><span className="font-semibold text-[#0A373A]">{editSale.product_name}</span>
                <span className="text-[#4A6D71]">Employee</span><span className="font-semibold text-[#0A373A]">{editSale.employee_name || `#${editSale.employee_id}`}</span>
                <span className="text-[#4A6D71]">Channel</span><span className="font-semibold text-[#0A373A] capitalize">{editSale.sale_type === 'doctor' ? `Doctor — ${editSale.doctor_name}` : `Stockist — ${editSale.stockist_name}`}</span>
                <span className="text-[#4A6D71]">Date</span><span className="font-semibold text-[#0A373A]">{editSale.date ? new Date(editSale.date).toLocaleDateString('en-IN') : '—'}</span>
              </div>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#4A6D71] mb-1">Batch</label>
                  <select value={editForm.batch_id} onChange={e => setEditForm(f => ({ ...f, batch_id: e.target.value }))} className="select-field text-sm" disabled={editBatches.length === 0}>
                    <option value="">No batch</option>
                    {editBatches.map(b => <option key={b.id} value={b.id}>{b.batch_number}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A6D71] mb-1">Price Tier</label>
                  <select value={editForm.applied_price_type} onChange={e => setEditForm(f => ({ ...f, applied_price_type: e.target.value }))} className="select-field text-sm font-semibold">
                    <option value="mrp">MRP</option><option value="pts">PTS</option><option value="ptr">PTR</option>
                    {editSale.sale_type === 'doctor' && <option value="manual">Manual</option>}
                  </select>
                </div>
              </div>
              {editForm.applied_price_type === 'manual' && (
                <div>
                  <label className="block text-xs font-semibold text-[#4A6D71] mb-1">Manual Price (₹/unit) *</label>
                  <input type="number" min="0" step="0.01" value={editForm.manual_price} onChange={e => setEditForm(f => ({ ...f, manual_price: e.target.value }))} className="input-field text-sm" placeholder="Enter price per unit" required />
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#4A6D71] mb-1">Quantity *</label>
                  <input type="number" min="1" value={editForm.quantity_sold} onChange={e => setEditForm(f => ({ ...f, quantity_sold: e.target.value }))} className="input-field text-sm text-center" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A6D71] mb-1">Free Units</label>
                  <input type="number" min="0" value={editForm.bonus_quantity} onChange={e => setEditForm(f => ({ ...f, bonus_quantity: e.target.value }))} className="input-field text-sm text-center" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#4A6D71] mb-1">Discount %</label>
                  <input type="number" min="0" max="100" step="0.5" value={editForm.discount_percentage} onChange={e => setEditForm(f => ({ ...f, discount_percentage: e.target.value }))} className="input-field text-sm text-center" />
                </div>
              </div>
              {ep && (
                <div className="bg-gradient-to-r from-[#0A373A] to-[#14A89C] rounded-xl p-4 text-white space-y-1.5">
                  <p className="text-xs text-white/70 font-semibold uppercase tracking-widest mb-2">Updated Total Preview</p>
                  <div className="flex justify-between text-sm text-white/80"><span>Unit price</span><span>₹{ep.unitPrice?.toFixed(2)}</span></div>
                  {ep.discount > 0 && <div className="flex justify-between text-sm text-amber-200"><span>Discount ({ep.discount}%)</span><span>-₹{(ep.unitPrice * ep.discount / 100).toFixed(2)}</span></div>}
                  <div className="flex justify-between text-sm text-white/80"><span>Subtotal ({ep.qty} units)</span><span>₹{ep.subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm text-orange-200"><span>GST @ {ep.gst}%</span><span>₹{(ep.subtotal * ep.gst / 100).toFixed(2)}</span></div>
                  <div className="flex justify-between text-base font-bold border-t border-white/20 pt-2"><span>New Total</span><span>₹{ep.total.toFixed(2)}</span></div>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={editSubmitting} className="btn-primary flex-1 !py-3">
                  {editSubmitting ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</span> : 'Save Changes'}
                </button>
                <button type="button" onClick={closeEdit} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── New Order Modal ──────────────────────────────── */}
      {showModal && createPortal(
        <div style={{ position:'fixed', inset:0, zIndex:9999, backgroundColor:'rgba(10,55,58,0.45)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'1rem', overflowY:'auto' }}>
          <div style={{ width:'100%', maxWidth:'52rem', marginTop:'2rem', marginBottom:'2rem', background:'#FFFFFF', border:'1px solid #E1ECEB', borderRadius:'1rem', padding:'1.5rem', boxShadow:'0 25px 50px rgba(10,55,58,0.12)' }}>

            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-[#1A3D40]">New Sales Order</h2>
                <p className="text-xs text-[#4A6D71] mt-0.5">Add multiple products in one order/invoice</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-[#4A6D71] hover:text-[#0A373A]"><HiOutlineX className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* ORDER HEADER */}
              <div className="bg-[#F0F6F6] rounded-xl p-4 border border-[#E1ECEB] space-y-3">
                <p className="text-xs font-bold text-[#4A6D71] uppercase tracking-widest">Order Details</p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Sale Date */}
                  <div>
                    <label className="block text-xs text-[#4A6D71] font-semibold mb-1">
                      <HiOutlineCalendar className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                      Sale Date *
                    </label>
                    <input
                      type="date"
                      value={order.sale_date}
                      max={today()}
                      onChange={e => setOrder(o => ({ ...o, sale_date: e.target.value }))}
                      className="input-field text-sm"
                      required
                    />
                    {order.sale_date !== today() && (
                      <p className="text-[10px] text-amber-600 mt-0.5 font-semibold">📅 Back-dated entry</p>
                    )}
                  </div>

                  {/* Employee */}
                  {canManage && (
                    <div>
                      <label className="block text-xs text-[#4A6D71] font-semibold mb-1">Employee (MR) *</label>
                      <select value={order.employee_id} onChange={e => setOrder(o => ({ ...o, employee_id: e.target.value }))} className="select-field text-sm" required={canManage}>
                        <option value="">Select employee</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Sale Channel */}
                  <div>
                    <label className="block text-xs text-[#4A6D71] font-semibold mb-1">Sale Channel *</label>
                    <div className="flex gap-2 h-[38px]">
                      <button type="button" onClick={() => { setOrder(o => ({ ...o, sale_type:'stockist', doctor_id:'' })); setDoctorSearch(''); }}
                        className={`flex-1 rounded-lg text-xs font-bold border transition-all ${order.sale_type === 'stockist' ? 'bg-blue-500/20 text-blue-600 border-blue-500/40' : 'bg-white text-[#4A6D71] border-[#D5E5E4]'}`}>
                        🏪 Stockist
                      </button>
                      <button type="button" onClick={() => { setOrder(o => ({ ...o, sale_type:'doctor', stockist_id:'' })); setDoctorSearch(''); }}
                        className={`flex-1 rounded-lg text-xs font-bold border transition-all ${order.sale_type === 'doctor' ? 'bg-purple-500/20 text-purple-600 border-purple-500/40' : 'bg-white text-[#4A6D71] border-[#D5E5E4]'}`}>
                        👨‍⚕️ Doctor
                      </button>
                    </div>
                  </div>

                  {/* Party */}
                  <div>
                    <label className="block text-xs text-[#4A6D71] font-semibold mb-1">{order.sale_type === 'stockist' ? 'Stockist *' : 'Doctor *'}</label>
                    {order.sale_type === 'stockist' ? (
                      <select value={order.stockist_id} onChange={e => setOrder(o => ({ ...o, stockist_id: e.target.value }))} className="select-field text-sm" required>
                        <option value="">Select stockist</option>
                        {stockists.map(s => <option key={s.id} value={s.id}>{s.name}{s.location ? ` (${s.location})` : ''}</option>)}
                      </select>
                    ) : (
                      <div className="relative">
                        <input type="text" placeholder="Type to search doctor..." value={doctorSearch}
                          onFocus={() => setShowDoctorDropdown(true)}
                          onChange={e => { setDoctorSearch(e.target.value); setShowDoctorDropdown(true); if (!e.target.value) setOrder(o => ({ ...o, doctor_id:'' })); }}
                          className="input-field pr-10 text-sm" required={!order.doctor_id} />
                        {doctorSearch && (
                          <button type="button" onClick={() => { setOrder(o => ({ ...o, doctor_id:'' })); setDoctorSearch(''); setShowDoctorDropdown(true); }}
                            className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
                        )}
                        <button type="button" onClick={() => setShowDoctorDropdown(!showDoctorDropdown)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A6D71] text-xs">{showDoctorDropdown ? '▲' : '▼'}</button>
                        {showDoctorDropdown && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => { setShowDoctorDropdown(false); const d = doctors.find(d => d.id == order.doctor_id); setDoctorSearch(d ? `Dr. ${d.name}` : ''); }} />
                            <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-[#E1ECEB] rounded-xl shadow-xl divide-y divide-[#E1ECEB]">
                              {(() => {
                                const filtered = doctors.filter(d =>
                                  d.name.toLowerCase().includes(doctorSearch.toLowerCase()) ||
                                  (d.specialization && d.specialization.toLowerCase().includes(doctorSearch.toLowerCase())) ||
                                  (d.hospital && d.hospital.toLowerCase().includes(doctorSearch.toLowerCase()))
                                );
                                if (filtered.length === 0) return <div className="p-3 text-sm text-gray-500 text-center">No doctors found</div>;
                                return filtered.map(d => (
                                  <button key={d.id} type="button"
                                    onClick={() => { setOrder(o => ({ ...o, doctor_id: d.id.toString() })); setDoctorSearch(`Dr. ${d.name}`); setShowDoctorDropdown(false); }}
                                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#F0F6F6] transition-colors ${order.doctor_id == d.id ? 'bg-[#E3EFEF] text-[#0A373A] font-semibold' : 'text-[#1A3D40]'}`}>
                                    <div className="font-medium">Dr. {d.name}</div>
                                    <div className="text-[10px] text-gray-500 mt-0.5">{d.specialization || 'Clinic'}{d.hospital ? ` — ${d.hospital}` : ''}</div>
                                  </button>
                                ));
                              })()}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* PRODUCT LINES */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-[#4A6D71] uppercase tracking-widest">Product Lines</p>
                  <span className="text-xs text-[#14A89C] font-semibold bg-[#E3EFEF] px-2 py-0.5 rounded-full">{order.items.length} item(s)</span>
                </div>
                <div className="hidden sm:grid gap-2 text-xs font-semibold text-[#4A6D71] uppercase tracking-wide px-1" style={{ gridTemplateColumns:'2fr 1fr 1.2fr 0.7fr 0.7fr 0.7fr 1fr 1.5rem' }}>
                  <span>Product</span><span>Price Tier</span><span>Batch</span><span>Qty</span><span>Free</span><span>Disc%</span><span className="text-right">Line Total</span><span />
                </div>

                {order.items.map((item, idx) => {
                  const prev = linePreview(item);
                  const filteredBatches = batches.filter(b => b.product_id == item.product_id && b.status === 'active');
                  return (
                    <div key={idx} className="border border-[#E1ECEB] rounded-xl p-3 bg-white space-y-2">
                      {/* Desktop */}
                      <div className="hidden sm:grid gap-2 items-center" style={{ gridTemplateColumns:'2fr 1fr 1.2fr 0.7fr 0.7fr 0.7fr 1fr 1.5rem' }}>
                        <select value={item.product_id} onChange={e => updateItem(idx,'product_id',e.target.value)} className="select-field text-sm" required>
                          <option value="">Select product</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <select value={item.applied_price_type} onChange={e => updateItem(idx,'applied_price_type',e.target.value)} className="select-field text-sm font-semibold" required>
                          <option value="mrp">MRP</option><option value="pts">PTS</option><option value="ptr">PTR</option>
                          {order.sale_type === 'doctor' && <option value="manual">Manual</option>}
                        </select>
                        <select value={item.batch_id} onChange={e => updateItem(idx,'batch_id',e.target.value)} className="select-field text-sm" disabled={!item.product_id || filteredBatches.length === 0}>
                          <option value="">No batch</option>
                          {filteredBatches.map(b => <option key={b.id} value={b.id}>{b.batch_number}</option>)}
                        </select>
                        <input type="number" min="1" value={item.quantity_sold} onChange={e => updateItem(idx,'quantity_sold',e.target.value)} className="input-field text-sm text-center" placeholder="Qty" required />
                        <input type="number" min="0" value={item.bonus_quantity} onChange={e => updateItem(idx,'bonus_quantity',e.target.value)} className="input-field text-sm text-center" placeholder="0" />
                        <input type="number" min="0" max="100" step="0.5" value={item.discount_percentage} onChange={e => updateItem(idx,'discount_percentage',e.target.value)} className="input-field text-sm text-center" placeholder="0" />
                        <div className="text-right text-sm font-semibold text-emerald-600">{prev ? `₹${prev.total.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—'}</div>
                        <button type="button" onClick={() => removeLine(idx)} disabled={order.items.length === 1} className="text-gray-300 hover:text-red-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                          <HiOutlineTrash className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Mobile */}
                      <div className="flex flex-col gap-3 sm:hidden">
                        <div>
                          <label className="block text-[10px] font-bold text-[#4A6D71] uppercase tracking-wider mb-1">Product *</label>
                          <select value={item.product_id} onChange={e => updateItem(idx,'product_id',e.target.value)} className="select-field text-sm" required>
                            <option value="">Select product</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-[#4A6D71] uppercase tracking-wider mb-1">Price Tier *</label>
                            <select value={item.applied_price_type} onChange={e => updateItem(idx,'applied_price_type',e.target.value)} className="select-field text-sm font-semibold" required>
                              <option value="mrp">MRP</option><option value="pts">PTS</option><option value="ptr">PTR</option>
                              {order.sale_type === 'doctor' && <option value="manual">Manual</option>}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-[#4A6D71] uppercase tracking-wider mb-1">Batch</label>
                            <select value={item.batch_id} onChange={e => updateItem(idx,'batch_id',e.target.value)} className="select-field text-sm" disabled={!item.product_id || filteredBatches.length === 0}>
                              <option value="">No batch</option>
                              {filteredBatches.map(b => <option key={b.id} value={b.id}>{b.batch_number}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div><label className="block text-[10px] font-bold text-[#4A6D71] uppercase tracking-wider mb-1">Qty *</label><input type="number" min="1" value={item.quantity_sold} onChange={e => updateItem(idx,'quantity_sold',e.target.value)} className="input-field text-sm text-center" required /></div>
                          <div><label className="block text-[10px] font-bold text-[#4A6D71] uppercase tracking-wider mb-1">Free</label><input type="number" min="0" value={item.bonus_quantity} onChange={e => updateItem(idx,'bonus_quantity',e.target.value)} className="input-field text-sm text-center" /></div>
                          <div><label className="block text-[10px] font-bold text-[#4A6D71] uppercase tracking-wider mb-1">Disc%</label><input type="number" min="0" max="100" step="0.5" value={item.discount_percentage} onChange={e => updateItem(idx,'discount_percentage',e.target.value)} className="input-field text-sm text-center" /></div>
                        </div>
                        <div className="flex items-center justify-between border-t border-[#E1ECEB] pt-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-[#4A6D71] font-semibold">Line Total:</span>
                            <span className="text-sm font-bold text-emerald-600">{prev ? `₹${prev.total.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—'}</span>
                          </div>
                          <button type="button" onClick={() => removeLine(idx)} disabled={order.items.length === 1} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-xs font-bold">
                            <HiOutlineTrash className="w-3.5 h-3.5" /> Remove
                          </button>
                        </div>
                      </div>

                      {/* Manual price */}
                      {item.applied_price_type === 'manual' && (
                        <div className="flex items-center gap-3 px-1 pt-0.5">
                          <label className="text-xs font-semibold text-[#4A6D71] whitespace-nowrap">💰 Manual Price (₹/unit)</label>
                          <input type="number" min="0" step="0.01" value={item.manual_price} onChange={e => updateItem(idx,'manual_price',e.target.value)} className="input-field text-sm w-40" placeholder="Enter price per unit" required />
                          {item.manual_price && parseFloat(item.manual_price) > 0 && <span className="text-xs text-[#14A89C] font-semibold">₹{parseFloat(item.manual_price).toFixed(2)}/unit</span>}
                        </div>
                      )}

                      {/* Per-line preview */}
                      {prev && (
                        <div className="flex flex-wrap gap-3 text-xs pl-1 pt-0.5">
                          {prev.discount > 0 && <span className="text-amber-500">📉 {prev.discount}% off → ₹{prev.discountedPrice.toFixed(2)}/unit</span>}
                          {prev.bonus  > 0 && <span className="text-emerald-500">🎁 {prev.qty} billed + {prev.bonus} free</span>}
                          <span className="text-gray-400">Subtotal: ₹{prev.subtotal.toFixed(2)}</span>
                          <span className="text-orange-400 font-semibold">+GST 5%: ₹{prev.gstAmount.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                <button type="button" onClick={addLine}
                  className="w-full py-2.5 rounded-xl border-2 border-dashed border-[#C6DAD8] text-[#4A6D71] text-sm font-semibold hover:border-[#14A89C] hover:text-[#14A89C] hover:bg-[#F0F6F6] transition-all flex items-center justify-center gap-2">
                  <HiOutlinePlus className="w-4 h-4" /> Add Another Product
                </button>
              </div>

              {/* ORDER TOTAL */}
              <div className="bg-gradient-to-r from-[#0A373A] to-[#14A89C] rounded-xl p-4 text-white space-y-2">
                <p className="text-xs text-white/70 font-semibold uppercase tracking-widest mb-2">Order Summary</p>
                <div className="flex justify-between text-sm text-white/80">
                  <span>Subtotal ({order.items.length} line{order.items.length > 1 ? 's' : ''})</span>
                  <span>₹{orderSubtotal.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                </div>
                <div className="flex justify-between text-sm text-orange-200">
                  <span>GST @ 5%</span><span>₹{orderGst.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-white/20 pt-2">
                  <span>Grand Total (incl. GST)</span>
                  <span>₹{orderTotal.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={submitting} className="btn-primary flex-1 !py-3">
                  {submitting
                    ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</span>
                    : `Submit Order (${order.items.length} product${order.items.length > 1 ? 's' : ''})`}
                </button>
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
