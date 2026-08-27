import React, { useRef, useState, useEffect } from 'react';
import { CheckCircle, X, RotateCcw, PenTool, Phone, User, FileText, AlertCircle } from 'lucide-react';

interface ProofOfDeliveryModalProps {
  trip: any;
  isOpen: boolean;
  onClose: () => void;
  onSubmitSuccess: () => void;
  apiFetch: (endpoint: string, options?: RequestInit) => Promise<any>;
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

export const ProofOfDeliveryModal: React.FC<ProofOfDeliveryModalProps> = ({
  trip,
  isOpen,
  onClose,
  onSubmitSuccess,
  apiFetch,
  showSuccess,
  showError,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f172a'; // slate-900 canvas bg
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#38bdf8'; // bright cyan stroke
      }
      setHasSigned(false);
    }
  }, [isOpen]);

  if (!isOpen || !trip) return null;

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasSigned(true);

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    setHasSigned(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim()) {
      showError('Please enter recipient name.');
      return;
    }
    if (!hasSigned || !canvasRef.current) {
      showError('Please capture recipient digital signature.');
      return;
    }

    setSubmitting(true);
    try {
      const signatureDataUrl = canvasRef.current.toDataURL('image/png');
      await apiFetch(`/trips/${trip.id}/pod`, {
        method: 'POST',
        body: JSON.stringify({
          recipient_name: recipientName,
          recipient_phone: recipientPhone || null,
          signature_data: signatureDataUrl,
          delivery_notes: deliveryNotes || null,
        }),
      });

      showSuccess(`Electronic Proof of Delivery verified! Trip #${trip.id} completed.`);
      onSubmitSuccess();
      onClose();
    } catch (err: any) {
      showError(err.message || 'Failed to submit Proof of Delivery');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#1e293b',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '520px',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0f172a'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8'
            }}>
              <PenTool size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#f8fafc' }}>
                Electronic Proof of Delivery (e-POD)
              </h3>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Trip #{trip.id} ({trip.source} → {trip.destination})
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', color: '#94a3b8', marginBottom: '6px', fontWeight: 500 }}>
              Recipient Name *
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
              <input
                type="text"
                required
                placeholder="e.g. Rahul Sharma (Warehouse Mgr)"
                value={recipientName}
                onChange={e => setRecipientName(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '10px 12px 10px 38px',
                  color: '#f8fafc',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', color: '#94a3b8', marginBottom: '6px', fontWeight: 500 }}>
              Recipient Phone (Optional)
            </label>
            <div style={{ position: 'relative' }}>
              <Phone size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
              <input
                type="text"
                placeholder="+91 98765 43210"
                value={recipientPhone}
                onChange={e => setRecipientPhone(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '10px 12px 10px 38px',
                  color: '#f8fafc',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Canvas Signature Pad */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12.5px', color: '#94a3b8', fontWeight: 500 }}>
                Customer Digital Signature *
              </label>
              <button
                type="button"
                onClick={clearSignature}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f43f5e',
                  fontSize: '11.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <RotateCcw size={12} /> Clear
              </button>
            </div>
            <div style={{
              borderRadius: '8px',
              border: hasSigned ? '1px solid #38bdf8' : '1px dashed #475569',
              overflow: 'hidden',
              touchAction: 'none'
            }}>
              <canvas
                ref={canvasRef}
                width={470}
                height={150}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                style={{ cursor: 'crosshair', display: 'block', width: '100%', height: '150px' }}
              />
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', textAlign: 'center' }}>
              Draw signature above using finger or mouse.
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', color: '#94a3b8', marginBottom: '6px', fontWeight: 500 }}>
              Delivery Condition / Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Cargo received intact in 100% good condition."
              value={deliveryNotes}
              onChange={e => setDeliveryNotes(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '10px 12px',
                color: '#f8fafc',
                fontSize: '13px',
                outline: 'none',
                resize: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: '1px solid #334155',
                backgroundColor: 'transparent',
                color: '#94a3b8',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#10b981',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: submitting ? 0.7 : 1
              }}
            >
              <CheckCircle size={16} />
              {submitting ? 'Verifying...' : 'Submit e-POD & Complete Trip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
