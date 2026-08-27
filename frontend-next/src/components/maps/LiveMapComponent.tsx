'use client';

import React, { useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';

interface VehicleLocation {
  id: number;
  lat: number;
  lng: number;
  label: string;
  driver: string;
  speedKm: number;
  status: string;
}

const DEFAULT_LOCATIONS: VehicleLocation[] = [
  { id: 1, lat: 19.076, lng: 72.8777, label: 'MH-12-PQ-8890', driver: 'Rajesh Kumar', speedKm: 68, status: 'EN_ROUTE' },
  { id: 2, lat: 12.9716, lng: 77.5946, label: 'KA-01-MJ-4321', driver: 'Vikram Singh', speedKm: 54, status: 'EN_ROUTE' },
  { id: 3, lat: 28.7041, lng: 77.1025, label: 'DL-01-AB-1234', driver: 'Amit Sharma', speedKm: 0, status: 'DISPATCHED' },
  { id: 4, lat: 21.1458, lng: 79.0882, label: 'HR-26-DQ-9911', driver: 'Suresh Patil', speedKm: 0, status: 'DELIVERED' },
];

export const LiveMapComponent: React.FC<{ height?: string }> = ({ height = 'h-96' }) => {
  const [mapState, setMapState] = useState<{
    L: any;
    ReactLeaflet: any;
  } | null>(null);

  useEffect(() => {
    Promise.all([import('leaflet'), import('react-leaflet')]).then(([leafletMod, reactLeafletMod]) => {
      setMapState({
        L: leafletMod.default || leafletMod,
        ReactLeaflet: reactLeafletMod,
      });
    });
  }, []);

  if (!mapState) {
    return (
      <div className={`w-full ${height} rounded-2xl glass-panel flex items-center justify-center text-slate-400 text-sm`}>
        Loading Live GPS Dark Map...
      </div>
    );
  }

  const { L, ReactLeaflet } = mapState;
  const { MapContainer, TileLayer, Marker, Popup, Polyline } = ReactLeaflet;

  // Custom marker icon
  const customIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: #3b82f6; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 12px #3b82f6;"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

  const routePolyline: [number, number][] = [
    [19.076, 72.8777],
    [20.0, 73.78],
    [21.1458, 79.0882],
    [28.7041, 77.1025],
  ];

  return (
    <div className={`w-full ${height} rounded-2xl overflow-hidden glass-panel border border-slate-800 relative z-10`}>
      <MapContainer
        center={[20.5937, 78.9629]}
        zoom={5}
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline positions={routePolyline} color="#3b82f6" weight={3} dashArray="6, 6" />
        {DEFAULT_LOCATIONS.map((loc) => (
          <Marker key={loc.id} position={[loc.lat, loc.lng]} icon={customIcon}>
            <Popup>
              <div className="p-1 space-y-1 text-xs">
                <div className="font-bold text-blue-400">{loc.label}</div>
                <div>Driver: <span className="font-semibold text-slate-200">{loc.driver}</span></div>
                <div>Speed: <span className="font-semibold text-emerald-400">{loc.speedKm} km/h</span></div>
                <div>Status: <span className="font-semibold uppercase text-amber-400">{loc.status}</span></div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default LiveMapComponent;
