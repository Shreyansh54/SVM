import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineDownload, HiOutlineX, HiOutlineTrash } from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';

const BLANK_LINE = { product_id: '', batch_id: '', quantity_sold: '', bonus_quantity: '0', discount_percentage: '0', applied_price_type: 'mrp' };

const BLANK_ORDER = {
  employee_id: '', sale_type: 'stockist', stockist_id: '', doctor_id: '',
  items: [{ ...BLANK_LINE }]
};

export default function SalesPage() {
  const { isAdmin, isManager, user } = useAuth();
  const canManage = isAdmin || isManager;

  const [sales, setSales] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [stockists, setStockists] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [order, setOrder] = useState(BLANK_ORDER);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const promises = [api.get('/sales/'), api.get('/stockists/'), api.get('/products/'), api.get('/batches/'), api.get('/doctors')];
      if (canManage) promises.push(api.get('/employees/'));
      const results = await Promise.all(promises);
      setSales(results[0].data); setStockists(results[1].data); setProducts(results[2].data);
      setBatches(results[3].data); setDoctors(results[4].data);
      if (canManage) setEmployees(results[5].data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const downloadInvoice = async (saleId, invoiceNumber) => {
    try {
      const token = localStorage.getItem('token');
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      const res = await fetch(`${apiBase}/invoices/${saleId}/pdf`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `Invoice_${invoiceNumber || saleId}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Invoice download failed'); }
  };

  // ── Item line helpers ──────────────────────────────────
  const updateItem = (idx, field, value) => {
    const items = order.items.map((it, i) => i === idx ? { ...it, [field]: value, ...(field === 'product_id' ? { batch_id: '' } : {}) } : it);
    setOrder(o => ({ ...o, items }));
  };

  const addLine = () => setOrder(o => ({ ...o, items: [...o.items, { ...BLANK_LINE }] }));

  const removeLine = (idx) => {
    if (order.items.length === 1) return;
    setOrder(o => ({ ...o, items: o.items.filter((_, i) => i !== idx) }));
  };

  // ── Live price preview per line (with 5% GST) ────────
  const GST_RATE = 5.0;
  const linePreview = (item) => {
    if (!item.product_id || !item.quantity_sold) return null;
    const product = products.find(p => p.id == item.product_id);
    if (!product) return null;
    let unitPrice = product[item.applied_price_type] || product.price; // fallback to generic price if tier is 0
    if (item.applied_price_type === 'mrp' && item.batch_id) {
      const b = batches.find(b => b.id == item.batch_id);
      if (b && b.mrp) unitPrice = b.mrp;
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

  const orderTotal = order.items.reduce((sum, it) => {
    const p = linePreview(it);
    return sum + (p ? p.total : 0);
  }, 0);

  const orderSubtotal = order.items.reduce((sum, it) => {
    const p = linePreview(it);
    return sum + (p ? p.subtotal : 0);
  }, 0);

  const orderGst = orderSubtotal * (GST_RATE / 100);

  // ── Submit ─────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const empId = canManage ? parseInt(order.employee_id) : user.employee_id;
    if (!empId) { toast.error('Please select an employee.'); return; }
    if (order.sale_type === 'stockist' && !order.stockist_id) { toast.error('Please select a stockist.'); return; }
    if (order.sale_type === 'doctor' && !order.doctor_id) { toast.error('Please select a doctor.'); return; }
    for (let i = 0; i < order.items.length; i++) {
      const it = order.items[i];
      if (!it.product_id) { toast.error(`Line ${i + 1}: Select a product.`); return; }
      if (!it.quantity_sold || parseInt(it.quantity_sold) <= 0) { toast.error(`Line ${i + 1}: Enter a valid quantity.`); return; }
    }

    setSubmitting(true);
    try {
      const payload = {
        employee_id: empId,
        sale_type: order.sale_type,
        stockist_id: order.sale_type === 'stockist' ? parseInt(order.stockist_id) : null,
        doctor_id: order.sale_type === 'doctor' ? parseInt(order.doctor_id) : null,
        items: order.items.map(it => ({
          product_id: parseInt(it.product_id),
          batch_id: it.batch_id ? parseInt(it.batch_id) : null,
          quantity_sold: parseInt(it.quantity_sold),
          bonus_quantity: parseInt(it.bonus_quantity) || 0,
          discount_percentage: parseFloat(it.discount_percentage) || 0,
          applied_price_type: it.applied_price_type || 'mrp'
        }))
      };
      await api.post('/sales/bulk', payload);
      toast.success(`Order of ${order.items.length} product(s) recorded!`);
      setShowModal(false);
      setOrder(BLANK_ORDER);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error recording order');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Group sales by sale_order_id for table display ────
  const groupedSales = (() => {
    const groups = [];
    const seen = new Set();
    for (const s of sales) {
      if (s.sale_order_id && seen.has(s.sale_order_id)) continue;
      if (s.sale_order_id) {
        seen.add(s.sale_order_id);
        const lines = sales.filter(x => x.sale_order_id === s.sale_order_id);
        groups.push({ isGroup: true, order_id: s.sale_order_id, lines });
      } else {
        groups.push({ isGroup: false, sale: s });
      }
    }
    return groups;
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="page-title">Sales</h1><p className="text-sm text-gray-500 mt-1">{sales.length} total line items</p></div>
        <button onClick={() => { setOrder(BLANK_ORDER); setShowModal(true); }} className="btn-primary flex items-center gap-2">
          <HiOutlinePlus className="w-4 h-4" /> New Order
        </button>
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div> : (
        <div className="table-container">
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
              <th className="px-4 py-3 text-right">Invoice</th>
            </tr></thead>
            <tbody>
              {groupedSales.map((group, gi) => {
                if (group.isGroup) {
                  const first = group.lines[0];
                  const groupTotal = group.lines.reduce((s, x) => s + x.total_amount, 0);
                  return [
                    // Order header row
                    <tr key={`hdr-${group.order_id}`} className="bg-[#E3EFEF]/60 border-b border-[#D5E5E4]">
                      <td className="px-4 py-2" colSpan={2}>
                        <span className="text-xs font-mono text-[#14A89C] font-semibold">{group.order_id}</span>
                        <span className="text-xs text-gray-500 ml-2">{first.date ? new Date(first.date).toLocaleDateString() : ''}</span>
                        <span className="ml-2 text-xs text-gray-500">{first.employee_name}</span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${first.sale_type === 'doctor' ? 'bg-purple-500/15 text-purple-500' : 'bg-blue-500/15 text-blue-500'}`}>
                          {first.sale_type === 'doctor' ? `Dr. ${first.doctor_name}` : first.stockist_name}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">{group.lines.length} products</td>
                      <td />
                      <td />
                      <td />
                      <td className="px-4 py-2 text-right text-sm font-bold text-emerald-500">₹{groupTotal.toLocaleString()}</td>
                      <td />
                    </tr>,
                    // Line item rows
                    ...group.lines.map((s, li) => (
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
                          {s.discount_percentage > 0 ? <span className="text-amber-400 text-sm">{s.discount_percentage}%</span> : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-2 text-right text-sm font-semibold text-emerald-400">₹{s.total_amount?.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right">
                          <button onClick={() => downloadInvoice(s.id, s.invoice_number)} className="p-1.5 rounded text-gray-400 hover:text-primary-400 transition-all" title="Download Invoice">
                            <HiOutlineDownload className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ];
                } else {
                  const s = group.sale;
                  return (
                    <tr key={s.id} className="table-row">
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-400">{s.date ? new Date(s.date).toLocaleDateString() : '—'}</div>
                        {s.invoice_number && <div className="text-xs text-primary-400 font-mono mt-0.5">{s.invoice_number}</div>}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#1A3D40]">{s.employee_name || `#${s.employee_id}`}</td>
                      <td className="px-4 py-3">
                        {s.sale_type === 'doctor' ? (
                          <div><span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-500/15 text-purple-400">Doctor</span><div className="text-xs text-gray-500 mt-0.5">{s.doctor_name}</div></div>
                        ) : (
                          <div><span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/15 text-blue-400">Stockist</span><div className="text-xs text-gray-500 mt-0.5">{s.stockist_name}</div></div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">{s.product_name}</td>
                      <td className="px-4 py-3 text-xs font-mono text-primary-400">{s.batch_number || '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {s.quantity_sold}
                        {s.bonus_quantity > 0 && <span className="text-xs text-emerald-400 ml-1">+{s.bonus_quantity} FREE</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {s.discount_percentage > 0 ? <span className="text-amber-400 text-sm font-semibold">{s.discount_percentage}%</span> : <span className="text-gray-600 text-sm">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-400">₹{s.total_amount?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => downloadInvoice(s.id, s.invoice_number)} className="p-1.5 rounded text-gray-400 hover:text-primary-400 transition-all" title="Download Invoice">
                          <HiOutlineDownload className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                }
              })}
              {sales.length === 0 && <tr><td colSpan="9" className="px-4 py-12 text-center text-gray-500">No sales recorded yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Multi-Product Order Modal ───────────────────── */}
      {showModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(10,55,58,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1rem', overflowY: 'auto' }}>
          <div style={{ width: '100%', maxWidth: '52rem', marginTop: '2rem', marginBottom: '2rem', background: '#FFFFFF', border: '1px solid #E1ECEB', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 25px 50px rgba(10,55,58,0.12)' }}>

            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-[#1A3D40]">New Sales Order</h2>
                <p className="text-xs text-[#4A6D71] mt-0.5">Add multiple products in one order/invoice</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-[#4A6D71] hover:text-[#0A373A]"><HiOutlineX className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* ── ORDER HEADER: Employee + Type + Party ── */}
              <div className="bg-[#F0F6F6] rounded-xl p-4 border border-[#E1ECEB] space-y-3">
                <p className="text-xs font-bold text-[#4A6D71] uppercase tracking-widest">Order Details</p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {canManage && (
                    <div>
                      <label className="block text-xs text-[#4A6D71] font-semibold mb-1">Employee (MR) *</label>
                      <select value={order.employee_id} onChange={e => setOrder(o => ({ ...o, employee_id: e.target.value }))} className="select-field text-sm" required={canManage}>
                        <option value="">Select employee</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-[#4A6D71] font-semibold mb-1">Sale Channel *</label>
                    <div className="flex gap-2">
                      <button type="button"
                        onClick={() => setOrder(o => ({ ...o, sale_type: 'stockist', doctor_id: '' }))}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${order.sale_type === 'stockist' ? 'bg-blue-500/20 text-blue-600 border-blue-500/40' : 'bg-white text-[#4A6D71] border-[#D5E5E4]'}`}>
                        🏪 Stockist
                      </button>
                      <button type="button"
                        onClick={() => setOrder(o => ({ ...o, sale_type: 'doctor', stockist_id: '' }))}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${order.sale_type === 'doctor' ? 'bg-purple-500/20 text-purple-600 border-purple-500/40' : 'bg-white text-[#4A6D71] border-[#D5E5E4]'}`}>
                        👨‍⚕️ Doctor
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-[#4A6D71] font-semibold mb-1">{order.sale_type === 'stockist' ? 'Stockist' : 'Doctor'} *</label>
                    {order.sale_type === 'stockist' ? (
                      <select value={order.stockist_id} onChange={e => setOrder(o => ({ ...o, stockist_id: e.target.value }))} className="select-field text-sm" required>
                        <option value="">Select stockist</option>
                        {stockists.map(s => <option key={s.id} value={s.id}>{s.name}{s.location ? ` (${s.location})` : ''}</option>)}
                      </select>
                    ) : (
                      <select value={order.doctor_id} onChange={e => setOrder(o => ({ ...o, doctor_id: e.target.value }))} className="select-field text-sm" required>
                        <option value="">Select doctor</option>
                        {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.name}{d.specialization ? ` — ${d.specialization}` : ''}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* ── PRODUCT LINES ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-[#4A6D71] uppercase tracking-widest">Product Lines</p>
                  <span className="text-xs text-[#14A89C] font-semibold bg-[#E3EFEF] px-2 py-0.5 rounded-full">{order.items.length} item(s)</span>
                </div>

                {/* Column headers */}
                <div className="grid gap-2 text-xs font-semibold text-[#4A6D71] uppercase tracking-wide px-1" style={{ gridTemplateColumns: '2fr 1fr 1.2fr 0.7fr 0.7fr 0.7fr 1fr 1.5rem' }}>
                  <span>Product</span><span>Price Tier</span><span>Batch</span><span>Qty</span><span>Free</span><span>Disc%</span><span className="text-right">Line Total</span><span />
                </div>

                {order.items.map((item, idx) => {
                  const prev = linePreview(item);
                  const filteredBatches = batches.filter(b => b.product_id == item.product_id && b.status === 'active');
                  return (
                    <div key={idx} className="border border-[#E1ECEB] rounded-xl p-3 bg-white space-y-2">
                      <div className="grid gap-2 items-center" style={{ gridTemplateColumns: '2fr 1fr 1.2fr 0.7fr 0.7fr 0.7fr 1fr 1.5rem' }}>
                        {/* Product */}
                        <select value={item.product_id} onChange={e => updateItem(idx, 'product_id', e.target.value)} className="select-field text-sm" required>
                          <option value="">Select product</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        {/* Price Type */}
                        <select value={item.applied_price_type} onChange={e => updateItem(idx, 'applied_price_type', e.target.value)} className="select-field text-sm font-semibold" required>
                          <option value="mrp">MRP</option>
                          <option value="pts">PTS</option>
                          <option value="prp">PRP</option>
                        </select>
                        {/* Batch */}
                        <select value={item.batch_id} onChange={e => updateItem(idx, 'batch_id', e.target.value)} className="select-field text-sm" disabled={!item.product_id || filteredBatches.length === 0}>
                          <option value="">No batch</option>
                          {filteredBatches.map(b => <option key={b.id} value={b.id}>{b.batch_number}</option>)}
                        </select>
                        {/* Qty */}
                        <input type="number" min="1" value={item.quantity_sold} onChange={e => updateItem(idx, 'quantity_sold', e.target.value)} className="input-field text-sm text-center" placeholder="Qty" required />
                        {/* Free */}
                        <input type="number" min="0" value={item.bonus_quantity} onChange={e => updateItem(idx, 'bonus_quantity', e.target.value)} className="input-field text-sm text-center" placeholder="0" />
                        {/* Discount */}
                        <input type="number" min="0" max="100" step="0.5" value={item.discount_percentage} onChange={e => updateItem(idx, 'discount_percentage', e.target.value)} className="input-field text-sm text-center" placeholder="0" />
                        {/* Line total */}
                        <div className="text-right text-sm font-semibold text-emerald-600">
                          {prev ? `₹${prev.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                        </div>
                        {/* Remove button */}
                        <button type="button" onClick={() => removeLine(idx)} disabled={order.items.length === 1}
                          className="text-gray-300 hover:text-red-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                          <HiOutlineTrash className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Per-line mini preview */}
                      {prev && (
                        <div className="flex flex-wrap gap-3 text-xs pl-1 pt-0.5">
                          {prev.discount > 0 && <span className="text-amber-500">📉 {prev.discount}% off → ₹{prev.discountedPrice.toFixed(2)}/unit</span>}
                          {prev.bonus > 0 && <span className="text-emerald-500">🎁 {prev.qty} billed + {prev.bonus} free</span>}
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

              {/* ── ORDER TOTAL with GST breakdown ── */}
              <div className="bg-gradient-to-r from-[#0A373A] to-[#14A89C] rounded-xl p-4 text-white space-y-2">
                <p className="text-xs text-white/70 font-semibold uppercase tracking-widest mb-2">Order Summary</p>
                <div className="flex justify-between text-sm text-white/80">
                  <span>Subtotal ({order.items.length} line{order.items.length > 1 ? 's' : ''})</span>
                  <span>₹{orderSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm text-orange-200">
                  <span>GST @ 5%</span>
                  <span>₹{orderGst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-white/20 pt-2">
                  <span>Grand Total (incl. GST)</span>
                  <span>₹{orderTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* ── Actions ── */}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={submitting} className="btn-primary flex-1 !py-3">
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</span>
                  ) : `Submit Order (${order.items.length} product${order.items.length > 1 ? 's' : ''})`}
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
