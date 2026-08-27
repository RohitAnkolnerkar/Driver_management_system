'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Truck, User, MapPin, Weight, DollarSign, CheckCircle2 } from 'lucide-react';
import { Driver, Vehicle } from '@/lib/types';

interface IntelligentDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  drivers: Driver[];
  vehicles: Vehicle[];
  onDispatch: (data: { driverId: number; vehicleId: number; origin: string; destination: string; freightRate: number }) => void;
}

export const IntelligentDispatchModal: React.FC<IntelligentDispatchModalProps> = ({
  isOpen,
  onClose,
  drivers,
  vehicles,
  onDispatch,
}) => {
  const [selectedDriver, setSelectedDriver] = useState<number>(drivers[0]?.id || 1);
  const [selectedVehicle, setSelectedVehicle] = useState<number>(vehicles[0]?.id || 1);
  const [origin, setOrigin] = useState('Mumbai Port Terminal Hub');
  const [destination, setDestination] = useState('Delhi Freight Hub');
  const [freightRate, setFreightRate] = useState(85000);
  const [cargoWeight, setCargoWeight] = useState(24000);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onDispatch({
      driverId: selectedDriver,
      vehicleId: selectedVehicle,
      origin,
      destination,
      freightRate,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🚚 Intelligent Fleet Dispatch Engine">
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
          <span>AI Matchmaker: Selected driver and vehicle have optimal compliance & safety score.</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-400 mb-1 font-semibold flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-blue-400" /> Assign Driver
            </label>
            <select
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(Number(e.target.value))}
              className="w-full p-2.5 rounded-xl glass-input focus:outline-none"
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id} className="bg-slate-900 text-slate-100">
                  {d.name} ({d.status}) - Score: {d.safety_score || 95}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold flex items-center gap-1">
              <Truck className="w-3.5 h-3.5 text-indigo-400" /> Assign Vehicle
            </label>
            <select
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(Number(e.target.value))}
              className="w-full p-2.5 rounded-xl glass-input focus:outline-none"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id} className="bg-slate-900 text-slate-100">
                  {v.license_plate} - {v.make} ({v.capacity_tons}T)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-400 mb-1 font-semibold flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Pickup Location
            </label>
            <input
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="w-full p-2.5 rounded-xl glass-input"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-rose-400" /> Dropoff Location
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full p-2.5 rounded-xl glass-input"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-400 mb-1 font-semibold flex items-center gap-1">
              <Weight className="w-3.5 h-3.5 text-amber-400" /> Cargo Weight (Kg)
            </label>
            <input
              type="number"
              value={cargoWeight}
              onChange={(e) => setCargoWeight(Number(e.target.value))}
              className="w-full p-2.5 rounded-xl glass-input"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Agreed Freight Rate (₹)
            </label>
            <input
              type="number"
              value={freightRate}
              onChange={(e) => setFreightRate(Number(e.target.value))}
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
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-blue-500/20"
          >
            Dispatch Trip Now
          </button>
        </div>
      </form>
    </Modal>
  );
};
