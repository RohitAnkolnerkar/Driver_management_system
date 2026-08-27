'use client';

import React, { useState } from 'react';
import { FileCheck, UploadCloud, CheckCircle2, ShieldCheck, FileText } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { OcrUploaderModal } from '@/components/modals/OcrUploaderModal';
import { INITIAL_POD_DOCS } from '@/lib/mockData';
import { PodDocument } from '@/lib/types';

export default function PodPage() {
  const [podDocs, setPodDocs] = useState<PodDocument[]>(INITIAL_POD_DOCS);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);

  const handleOcrComplete = (extracted: any) => {
    const newDoc: PodDocument = {
      id: podDocs.length + 1,
      trip_id: 101,
      document_type: extracted.document_type || 'Fuel Receipt / POD',
      file_url: '/scanned_pod.pdf',
      parsed_text: extracted.parsed_fields ? extracted.parsed_fields.join(' | ') : 'Gross Weight Verified',
      ocr_confidence: extracted.ocr_confidence || 97,
      receiver_name: 'FastAPI OCR Auto-Parsed',
      receiver_signature: true,
      status: 'VERIFIED',
      uploaded_at: 'Just now',
    };
    setPodDocs([newDoc, ...podDocs]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-emerald-400" />
            Proof of Delivery (POD) & Automated OCR Hub
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Automated image & PDF receipt extraction, consignee signature parsing, and invoice generation.
          </p>
        </div>

        <button
          onClick={() => setIsOcrModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 shrink-0"
        >
          <UploadCloud className="w-4 h-4" /> Upload Document & Run OCR
        </button>
      </div>

      {/* Document Gallery Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {podDocs.map((doc) => (
          <div key={doc.id} className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <span className="font-bold text-slate-100 text-sm">Trip #{doc.trip_id} - {doc.document_type}</span>
              </div>
              <StatusBadge status={doc.status} />
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between font-medium text-slate-300">
                <span>Receiver:</span>
                <span className="font-bold text-slate-100">{doc.receiver_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>OCR Confidence:</span>
                <span className="text-emerald-400 font-extrabold">{doc.ocr_confidence}%</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Uploaded:</span>
                <span>{doc.uploaded_at}</span>
              </div>
            </div>

            {doc.parsed_text && (
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-300">
                <span className="text-slate-400 block text-[10px] uppercase tracking-wider mb-0.5">Parsed OCR Content:</span>
                {doc.parsed_text}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* OCR Modal */}
      <OcrUploaderModal
        isOpen={isOcrModalOpen}
        onClose={() => setIsOcrModalOpen(false)}
        onOcrComplete={handleOcrComplete}
      />
    </div>
  );
}
