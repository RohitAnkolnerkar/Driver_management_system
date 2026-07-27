import React, { useState } from 'react';
import { ShieldCheck, Signature, FileText, CheckCircle2, AlertCircle, X } from 'lucide-react';

interface ProofOfDeliveryModalProps {
  tripId: number;
  tripSource: string;
  tripDestination: string;
  apiFetch: (url: string, options?: any) => Promise<any>;
  onClose: () => void;
  onSuccess: () => void;
}

export const ProofOfDeliveryModal: React.FC<ProofOfDeliveryModalProps> = ({
  tripId,
  tripSource,
  tripDestination,
  apiFetch,
  onClose,
  onSuccess
}) => {
  const [recipientName, setRecipientName] = useState('');
  const [signatureText, setSignatureText] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim()) {
      setError('Please enter recipient full name');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/trips/${tripId}/proof-of-delivery`, {
        method: 'POST',
        body: JSON.stringify({
          recipient_name: recipientName,
          recipient_signature: signatureText || 'Digital Signature Verified',
          delivery_notes: notes
        })
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record Proof of Delivery');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <form className="modal-content" onSubmit={handleSubmit} style={{ maxWidth: '520px', width: '90%' }}>
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-dim)', paddingBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={20} color="var(--accent-green)" />
              Proof of Delivery (PoD) Sign-Off
            </h3>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Dispatch #{tripId}: {tripSource} ➔ {tripDestination}
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: '6px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--accent-red)', fontSize: '13px', margin: '14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: '16px 0' }}>
          <div>
            <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Recipient Name *</label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="e.g. John Doe (Store Manager)"
              value={recipientName}
              onChange={e => setRecipientName(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Recipient Signature Initials / Code</label>
            <div style={{ position: 'relative' }}>
              <Signature size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '36px' }}
                placeholder="e.g. J.D. #9812"
                value={signatureText}
                onChange={e => setSignatureText(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Delivery Audit Notes (Optional)</label>
            <div style={{ position: 'relative' }}>
              <FileText size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              <textarea
                className="form-input"
                rows={2}
                style={{ paddingLeft: '36px' }}
                placeholder="Cargo condition, seal verification, unloading details..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="modal-actions" style={{ paddingTop: '16px', borderTop: '1px solid var(--border-dim)' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting} style={{ backgroundColor: 'var(--accent-green)', borderColor: 'var(--accent-green)' }}>
            <CheckCircle2 size={16} />
            {submitting ? 'Verifying...' : 'Submit & Complete Trip'}
          </button>
        </div>
      </form>
    </div>
  );
};
