import React, { useEffect, useState } from 'react';
import { FileText, Printer, CheckCircle2, Clock, X } from 'lucide-react';

interface InvoiceLineItem {
  description: string;
  amount: number;
}

interface TripInvoice {
  invoice_number: string;
  issue_date: string;
  trip_id: number;
  source: string;
  destination: string;
  client_name: string;
  vehicle_type?: string;
  driver_name?: string;
  distance_km: number;
  line_items: InvoiceLineItem[];
  subtotal: number;
  tax_rate_percent: number;
  tax_amount: number;
  total_amount: number;
  payment_status: string;
}

interface TripInvoiceViewerProps {
  tripId: number;
  apiFetch: (url: string, options?: any) => Promise<any>;
  onClose: () => void;
}

export const TripInvoiceViewer: React.FC<TripInvoiceViewerProps> = ({
  tripId,
  apiFetch,
  onClose
}) => {
  const [invoice, setInvoice] = useState<TripInvoice | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoice();
  }, [tripId]);

  const fetchInvoice = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/trips/${tripId}/invoice`);
      setInvoice(data);
    } catch (err: any) {
      setError(err.message || 'Failed to generate trip invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/trips/${tripId}/invoice/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("Failed to download PDF invoice");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice_trip_${tripId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '640px', width: '90%', padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-dim)', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={24} color="var(--accent-cyan)" />
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0 }}>Tax Freight Invoice</h3>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {invoice ? invoice.invoice_number : `Trip #${tripId}`}
              </div>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Generating Tax Invoice...</div>
        ) : error ? (
          <div style={{ color: 'var(--accent-red)', padding: '20px', textAlign: 'center' }}>{error}</div>
        ) : invoice ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', backgroundColor: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-dim)' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Billed To</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{invoice.client_name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Route: {invoice.source} ➔ {invoice.destination}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Invoice Status</div>
                <span className={`badge badge-${invoice.payment_status === 'paid' ? 'completed' : 'assigned'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                  {invoice.payment_status === 'paid' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                  {invoice.payment_status.toUpperCase()}
                </span>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Date: {invoice.issue_date}</div>
              </div>
            </div>

            {/* Line items table */}
            <table className="dashboard-table" style={{ fontSize: '13px' }}>
              <thead>
                <tr>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {invoice.line_items.map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.description}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{item.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ marginLeft: 'auto', width: '240px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-dim)', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <span>Subtotal</span>
                <span>₹{invoice.subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <span>GST Tax ({invoice.tax_rate_percent}%)</span>
                <span>₹{invoice.tax_amount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 700, color: '#fff', borderTop: '1px solid var(--border-dim)', paddingTop: '8px' }}>
                <span>Total Amount</span>
                <span style={{ color: 'var(--accent-green)' }}>₹{invoice.total_amount.toFixed(2)}</span>
              </div>
            </div>

            {/* Print button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Printer size={15} /> Print Tax Invoice
              </button>
              <button type="button" className="btn btn-primary" onClick={handleDownloadPDF} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={15} /> Download PDF
              </button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
