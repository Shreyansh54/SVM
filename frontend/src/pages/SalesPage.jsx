import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineDownload, HiOutlineX } from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';

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
  const [form, setForm] = useState({
    employee_id: '', sale_type: 'stockist', stockist_id: '', doctor_id: '',
    product_id: '', batch_id: '', quantity_sold: '', bonus_quantity: '0', discount_percentage: '0'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const promises = [api.get('/sales/'), api.get('/stockists/'), api.get('/products/'), api.get('/batches/'), api.get('/doctors')];
      if (canManage) {
        promises.push(api.get('/employees/'));
      }
      const results = await Promise.all(promises);
      setSales(results[0].data); setStockists(results[1].data); setProducts(results[2].data);
      setBatches(results[3].data); setDoctors(results[4].data);
      if (canManage) {
        setEmployees(results[5].data);
      }
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const downloadInvoice = async (saleId, invoiceNumber) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:8000/api/invoices/${saleId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to download');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice_${invoiceNumber || saleId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Invoice download failed');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const empId = canManage ? parseInt(form.employee_id) : user.employee_id;
      const data = {
        employee_id: empId,
        sale_type: form.sale_type,
        product_id: parseInt(form.product_id),
        quantity_sold: parseInt(form.quantity_sold),
        bonus_quantity: parseInt(form.bonus_quantity || '0'),
        batch_id: form.batch_id ? parseInt(form.batch_id) : null,
        discount_percentage: parseFloat(form.discount_percentage || '0'),
      };
      if (form.sale_type === 'stockist') {
        data.stockist_id = parseInt(form.stockist_id);
        data.doctor_id = null;
      } else {
        data.doctor_id = parseInt(form.doctor_id);
        data.stockist_id = null;
      }
      await api.post('/sales/', data);
      toast.success('Sale recorded!');
      setShowModal(false);
      setForm({ employee_id: '', sale_type: 'stockist', stockist_id: '', doctor_id: '', product_id: '', batch_id: '', quantity_sold: '', bonus_quantity: '0', discount_percentage: '0' });
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Error'); }
  };

  const filteredBatches = batches.filter(b => b.product_id == form.product_id && b.status === 'active');

  // Estimate total for preview
  const getPreviewTotal = () => {
    if (!form.quantity_sold || !form.product_id) return null;
    const product = products.find(p => p.id == form.product_id);
    if (!product) return null;
    let unitPrice = product.price;
    if (form.batch_id) {
      const batch = batches.find(b => b.id == form.batch_id);
      if (batch) unitPrice = batch.mrp;
    }
    const discount = parseFloat(form.discount_percentage || '0');
    const discountedPrice = unitPrice * (1 - discount / 100);
    const total = parseInt(form.quantity_sold) * discountedPrice;
    const bonus = parseInt(form.bonus_quantity || '0');
    return { unitPrice, discountedPrice, total, discount, bonus };
  };

  const preview = getPreviewTotal();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="page-title">Sales</h1><p className="text-sm text-gray-500 mt-1">{sales.length} total transactions</p></div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2"><HiOutlinePlus className="w-4 h-4" /> New Sale</button>
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div> : (
        <div className="table-container">
          <table className="w-full">
            <thead><tr className="table-header">
              <th className="px-4 py-3 text-left">Date / Invoice</th>
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
              {sales.map(s => (
                <tr key={s.id} className="table-row">
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-400">{s.date ? new Date(s.date).toLocaleDateString() : '—'}</div>
                    {s.invoice_number && <div className="text-xs text-primary-400 font-mono mt-0.5">{s.invoice_number}</div>}
                  </td>
                  <td className="px-4 py-3 font-medium text-[#1A3D40]">{s.employee_name || `#${s.employee_id}`}</td>
                  <td className="px-4 py-3">
                    {s.sale_type === 'doctor' ? (
                      <div>
                        <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-purple-500/15 text-purple-400">Doctor</span>
                        <div className="text-xs text-gray-500 mt-0.5">{s.doctor_name || ''}</div>
                      </div>
                    ) : (
                      <div>
                        <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-blue-500/15 text-blue-400">Stockist</span>
                        <div className="text-xs text-gray-500 mt-0.5">{s.stockist_name || ''}</div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-sm">{s.product_name || `#${s.product_id}`}</td>
                  <td className="px-4 py-3 text-primary-400 font-mono text-xs">{s.batch_number || '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {s.quantity_sold}
                    {s.bonus_quantity > 0 && (
                      <span className="text-xs text-emerald-400 ml-1">+{s.bonus_quantity} FREE</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.discount_percentage > 0 ? (
                      <span className="text-amber-400 text-sm font-semibold">{s.discount_percentage}%</span>
                    ) : <span className="text-gray-600 text-sm">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-400">₹{s.total_amount?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => downloadInvoice(s.id, s.invoice_number)} 
                            className="p-1.5 rounded-lg text-gray-400 hover:text-primary-400 hover:bg-primary-500/10 transition-all" title="Download Invoice">
                      <HiOutlineDownload className="w-5 h-5 inline" />
                    </button>
                  </td>
                </tr>
              ))}
              {sales.length === 0 && <tr><td colSpan="9" className="px-4 py-12 text-center text-gray-500">No sales recorded</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* New Sale Modal */}
      {showModal && createPortal(
        <div style={{position:'fixed',inset:0,zIndex:9999,backgroundColor:'rgba(10,55,58,0.4)',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'1rem',overflowY:'auto'}}>
          <div style={{width:'100%',maxWidth:'32rem',marginTop:'2rem',marginBottom:'2rem',background:'#FFFFFF',border:'1px solid #E1ECEB',borderRadius:'1rem',padding:'1.5rem',boxShadow:'0 25px 50px rgba(10,55,58,0.10)',backdropFilter:'blur(20px)'}}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[#1A3D40]">Record New Sale</h2>
              <button onClick={() => setShowModal(false)} className="text-[#4A6D71] hover:text-[#0A373A]"><HiOutlineX className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Sale Type Toggle */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Sale Channel *</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setForm({...form, sale_type: 'stockist', doctor_id: '', discount_percentage: '0'})}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      form.sale_type === 'stockist'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                        : 'bg-[#E3EFEF] text-[#4A6D71] border border-[#D5E5E4] hover:border-[#14A89C]'
                    }`}>
                    🏪 To Stockist
                  </button>
                  <button type="button" onClick={() => setForm({...form, sale_type: 'doctor', stockist_id: ''})}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      form.sale_type === 'doctor'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                        : 'bg-[#E3EFEF] text-[#4A6D71] border border-[#D5E5E4] hover:border-[#14A89C]'
                    }`}>
                    👨‍⚕️ Direct to Doctor
                  </button>
                </div>
              </div>

              {canManage && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Employee</label>
                  <select value={form.employee_id} onChange={e => setForm({...form, employee_id: e.target.value})} className="select-field" required>
                    <option value="">Select employee</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
              )}

              {/* Stockist or Doctor selector */}
              {form.sale_type === 'stockist' ? (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Stockist *</label>
                  <select value={form.stockist_id} onChange={e => setForm({...form, stockist_id: e.target.value})} className="select-field" required>
                    <option value="">Select stockist</option>
                    {stockists.map(s => <option key={s.id} value={s.id}>{s.name} {s.location ? `(${s.location})` : ''}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Doctor *</label>
                  <select value={form.doctor_id} onChange={e => setForm({...form, doctor_id: e.target.value})} className="select-field" required>
                    <option value="">Select doctor</option>
                    {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.name} {d.specialization ? `— ${d.specialization}` : ''}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-400 mb-1">Product</label>
                <select value={form.product_id} onChange={e => setForm({...form, product_id: e.target.value, batch_id: ''})} className="select-field" required>
                  <option value="">Select product</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (₹{p.price})</option>)}
                </select>
              </div>

              {isAdmin && form.product_id && filteredBatches.length > 0 && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Batch <span className="text-xs text-gray-600">(optional)</span></label>
                  <select value={form.batch_id} onChange={e => setForm({...form, batch_id: e.target.value})} className="select-field">
                    <option value="">No batch (use product price)</option>
                    {filteredBatches.map(b => <option key={b.id} value={b.id}>{b.batch_number} — MRP ₹{b.mrp} | Exp: {b.expiry_date}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Quantity *</label>
                  <input type="number" min="1" value={form.quantity_sold} onChange={e => setForm({...form, quantity_sold: e.target.value})} className="input-field" required />
                </div>

                {/* Discount field - shown for doctor sales */}
                {form.sale_type === 'doctor' && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Discount %</label>
                    <input type="number" min="0" max="100" step="0.5" value={form.discount_percentage}
                      onChange={e => setForm({...form, discount_percentage: e.target.value})} className="input-field" placeholder="0" />
                  </div>
                )}
              </div>

              {/* Bonus Quantity - doctor sales only */}
              {form.sale_type === 'doctor' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Bonus Quantity <span className="text-xs text-gray-600">(free units)</span></label>
                  <input type="number" min="0" value={form.bonus_quantity}
                    onChange={e => setForm({...form, bonus_quantity: e.target.value})} className="input-field" placeholder="0" />
                  <p className="text-xs text-gray-600 mt-1">💊 These units go for FREE to the doctor (not charged)</p>
                </div>
              )}

              {/* Price Preview */}
              {preview && (
                <div className="bg-[#F0F6F6] rounded-xl p-3 border border-[#E1ECEB] space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Unit Price:</span>
                    <span className="text-gray-300">₹{preview.unitPrice.toFixed(2)}</span>
                  </div>
                  {preview.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-amber-400">After {preview.discount}% discount:</span>
                      <span className="text-amber-400">₹{preview.discountedPrice.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-semibold border-t border-white/5 pt-1 mt-1">
                    <span className="text-gray-400">Charged ({form.quantity_sold} × ₹{preview.discountedPrice.toFixed(2)}):</span>
                    <span className="text-emerald-400 text-base">₹{preview.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  {preview.bonus > 0 && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-emerald-400">🎁 Total delivered:</span>
                      <span className="text-emerald-400 font-semibold">{parseInt(form.quantity_sold) + preview.bonus} units ({form.quantity_sold} paid + {preview.bonus} free)</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">Record Sale</button>
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
