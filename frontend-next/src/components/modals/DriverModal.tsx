'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Driver } from '@/lib/types';

interface DriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  driver?: Driver | null;
  onSave: (driverData: Partial<Driver>) => void;
}

export const DriverModal: React.FC<DriverModalProps> = ({
  isOpen,
  onClose,
  driver,
  onSave,
}) => {
  const [name, setName] = useState(driver?.name || '');
  const [phone, setPhone] = useState(driver?.phone || '');
  const [licenseNumber, setLicenseNumber] = useState(driver?.license_number || '');
  const [status, setStatus] = useState(driver?.status || 'active');
  const [experienceYears, setExperienceYears] = useState(driver?.experience_years || 3);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: driver?.id,
      name,
      phone,
      license_number: licenseNumber,
      status: status as any,
      experience_years: experienceYears,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={driver ? '✏️ Edit Driver Credentials' : '➕ Register New Driver'}>
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block text-slate-400 mb-1 font-semibold">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2.5 rounded-xl glass-input"
            placeholder="e.g. Ramesh Chandra"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full p-2.5 rounded-xl glass-input"
              placeholder="+91 98765 00000"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Commercial License #</label>
            <input
              type="text"
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              className="w-full p-2.5 rounded-xl glass-input"
              placeholder="DL-04202100099"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full p-2.5 rounded-xl glass-input"
            >
              <option value="active" className="bg-slate-900">Active</option>
              <option value="on_duty" className="bg-slate-900">On Duty</option>
              <option value="off_duty" className="bg-slate-900">Off Duty</option>
              <option value="suspended" className="bg-slate-900">Suspended</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Driving Experience (Years)</label>
            <input
              type="number"
              value={experienceYears}
              onChange={(e) => setExperienceYears(Number(e.target.value))}
              className="w-full p-2.5 rounded-xl glass-input"
              required
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 glass-panel"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/20"
          >
            Save Driver Profile
          </button>
        </div>
      </form>
    </Modal>
  );
};
