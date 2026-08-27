'use client';

import dynamic from 'next/dynamic';

export const LiveMap = dynamic(() => import('./LiveMapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-96 rounded-2xl glass-panel flex items-center justify-center text-slate-400 text-sm">
      Initializing Live Vehicle Tracking Dark Map...
    </div>
  ),
});
