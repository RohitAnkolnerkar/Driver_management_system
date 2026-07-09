import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  User, 
  Truck, 
  MapPin, 
  Calendar, 
  AlertTriangle, 
  LogOut, 
  Plus, 
  Trash2, 
  Edit, 
  X, 
  XCircle,
  Play, 
  Clipboard, 
  Clock, 
  Search,
  Filter,
  CheckCircle2,
  ListRestart,
  Compass
} from 'lucide-react';

// API Fetch helper that includes Auth token
const apiFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };
  
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Request failed with status ${response.status}`);
  }
  return response.json();
};

export default function App() {
  // Auth state
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [signUpUsername, setSignUpUsername] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpRole, setSignUpRole] = useState('dispatcher');

  // Tab State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'trips' | 'drivers' | 'alerts' | 'profile' | 'map'>('dashboard');

  // Business Entities State
  const [drivers, setDrivers] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [myDriverProfile, setMyDriverProfile] = useState<any>(null);

  // Loading & Action states
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals & Forms State
  const [showCreateTrip, setShowCreateTrip] = useState(false);
  const [newTripData, setNewTripData] = useState({
    source: '',
    destination: '',
    source_company: '',
    destination_company: '',
    distance_km: '',
    duration_minutes: '',
    estimated_fare: '',
    is_regular: false,
    scheduled_date: '',
    priority: 'normal'
  });

  const [showAddDriver, setShowAddDriver] = useState(false);
  const [newDriverData, setNewDriverData] = useState({
    name: '',
    phone: '',
    license_number: '',
    license_expiry: '',
    enable_login: false,
    username: '',
    password: '',
    email: ''
  });
  const [showDriverCredentials, setShowDriverCredentials] = useState<any>(null);

  const [assigningTripId, setAssigningTripId] = useState<number | null>(null);
  const [assignDriverId, setAssignDriverId] = useState('');

  const [transitioningTrip, setTransitioningTrip] = useState<{ id: number; action: 'start' | 'complete' } | null>(null);
  const [transitionNote, setTransitionNote] = useState('');

  const [viewingTripHistory, setViewingTripHistory] = useState<number | null>(null);
  const [tripHistoryLogs, setTripHistoryLogs] = useState<any[]>([]);

  const [editingDriverStatus, setEditingDriverStatus] = useState<number | null>(null);
  const [driverNewStatus, setDriverNewStatus] = useState('available');
  const [driverStatusNote, setDriverStatusNote] = useState('');
  const [editDriverName, setEditDriverName] = useState('');
  const [editDriverPhone, setEditDriverPhone] = useState('');
  const [editDriverLicense, setEditDriverLicense] = useState('');
  const [editDriverExpiry, setEditDriverExpiry] = useState('');
  const [cancellingTripId, setCancellingTripId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const [profileUpdates, setProfileUpdates] = useState({
    username: '',
    email: '',
    password: ''
  });

  // Map Tracking States
  const [selectedMapTripId, setSelectedMapTripId] = useState<number | null>(null);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(Date.now() / 1000);

  // Real-time animation ticker for the live map
  useEffect(() => {
    if (activeTab !== 'map') return;
    const timer = setInterval(() => {
      setCurrentTimeSec(Date.now() / 1000);
    }, 200);
    return () => clearInterval(timer);
  }, [activeTab]);

  // Leaflet Map Reference
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // Watch driver's physical GPS location
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'driver') return;
    
    if (!navigator.geolocation) {
      console.warn("Geolocation is not supported by this browser.");
      return;
    }

    const handleSuccess = async (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      try {
        await apiFetch('/drivers/location', {
          method: 'POST',
          body: JSON.stringify({ latitude, longitude })
        });
        loadData();
      } catch (err) {
        console.error("Failed to push driver GPS coordinates:", err);
      }
    };

    const handleError = (error: GeolocationPositionError) => {
      console.warn("Geolocation error: " + error.message);
    };

    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [currentUser]);

  // Leaflet Map rendering integration
  useEffect(() => {
    if (activeTab !== 'map') return;
    
    const L = (window as any).L;
    if (!L) return;

    const container = document.getElementById('leaflet-map');
    if (!container) return;

    if (!mapRef.current) {
      mapRef.current = L.map('leaflet-map').setView([18.9, 73.2], 9);
      
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const activeDispatches = trips.filter(t => t.status === 'started' || t.status === 'assigned');
    const selectedTrip = trips.find(t => t.id === selectedMapTripId) || (activeDispatches.length > 0 ? activeDispatches[0] : null);

    const locations = new Map<string, { lat: number, lng: number }>();
    trips.forEach(t => {
      if (t.source && t.source_latitude && t.source_longitude) {
        locations.set(t.source, { lat: t.source_latitude, lng: t.source_longitude });
      }
      if (t.destination && t.destination_latitude && t.destination_longitude) {
        locations.set(t.destination, { lat: t.destination_latitude, lng: t.destination_longitude });
      }
    });

    locations.forEach((coord, name) => {
      const isEndpointOfSelected = selectedTrip && (selectedTrip.source === name || selectedTrip.destination === name);
      
      const circleMarker = L.circleMarker([coord.lat, coord.lng], {
        radius: isEndpointOfSelected ? 7 : 4,
        fillColor: isEndpointOfSelected ? '#6366f1' : '#a1a1aa',
        color: '#18181b',
        weight: 1.5,
        opacity: 1,
        fillOpacity: 1
      }).bindTooltip(name, { permanent: true, direction: 'top', className: 'map-tooltip' });
      
      circleMarker.addTo(map);
      markersRef.current.push(circleMarker);
    });

    activeDispatches.forEach(t => {
      if (t.source_latitude && t.source_longitude && t.destination_latitude && t.destination_longitude) {
        const isSel = selectedTrip?.id === t.id;
        const line = L.polyline([
          [t.source_latitude, t.source_longitude],
          [t.destination_latitude, t.destination_longitude]
        ], {
          color: isSel ? '#6366f1' : 'rgba(99,102,241,0.25)',
          weight: isSel ? 3.5 : 2,
          dashArray: '5, 5'
        }).addTo(map);
        markersRef.current.push(line);
      }
    });

    activeDispatches.forEach(t => {
      const driverObj = drivers.find(d => d.id === t.driver_id);
      
      let lat = t.source_latitude;
      let lng = t.source_longitude;
      let isSimulated = true;

      if (driverObj && driverObj.current_latitude && driverObj.current_longitude) {
        lat = driverObj.current_latitude;
        lng = driverObj.current_longitude;
        isSimulated = false;
      } else if (t.status === 'started' && t.start_time && t.source_latitude && t.destination_latitude) {
        const elapsed = currentTimeSec - new Date(t.start_time).getTime() / 1000;
        const durationSec = (t.duration_minutes || 30) * 60;
        const progress = Math.min(Math.max(elapsed / durationSec, 0), 1);
        lat = t.source_latitude + (t.destination_latitude - t.source_latitude) * progress;
        lng = t.source_longitude + (t.destination_longitude - t.source_longitude) * progress;
      }

      if (lat && lng) {
        const isSel = selectedTrip?.id === t.id;
        const driverMarker = L.circleMarker([lat, lng], {
          radius: 8,
          fillColor: isSel ? '#00f2fe' : '#6366f1',
          color: '#fff',
          weight: 1.5,
          opacity: 1,
          fillOpacity: 1
        }).bindTooltip(
          `Driver: ${t.driver_name || 'Assigned'} ${isSimulated ? '(Simulated GPS)' : '(Live GPS)'}`,
          { direction: 'right' }
        );

        driverMarker.addTo(map);
        markersRef.current.push(driverMarker);

        driverMarker.on('click', () => {
          setSelectedMapTripId(t.id);
        });
      }
    });

    if (selectedTrip && selectedTrip.source_latitude && selectedTrip.source_longitude) {
      map.panTo([selectedTrip.source_latitude, selectedTrip.source_longitude]);
    }
  }, [activeTab, trips, drivers, selectedMapTripId, currentTimeSec]);

  // Filter toolbar states
  const [tripStatusFilter, setTripStatusFilter] = useState('');
  const [tripSearchFilter, setTripSearchFilter] = useState('');
  const [tripDateAfter, setTripDateAfter] = useState('');
  const [tripDateBefore, setTripDateBefore] = useState('');

  // Auto-login / fetch profiles on startup
  useEffect(() => {
    if (token) {
      loadUserProfile();
    }
  }, [token]);

  // Load everything when authenticated user changes
  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser, activeTab]);

  const loadUserProfile = async () => {
    try {
      const user = await apiFetch('/users/me');
      setCurrentUser(user);
      setProfileUpdates({ username: user.username, email: user.email, password: '' });
      
      // If role is driver, fetch their session driver profile
      if (user.role === 'driver') {
        setActiveTab('profile');
        try {
          const profile = await apiFetch('/drivers/profile/me');
          setMyDriverProfile(profile);
        } catch (e: any) {
          console.log("No associated driver record found for this user");
        }
      }
    } catch (e: any) {
      handleLogout();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const formData = new URLSearchParams();
      formData.append('username', loginUsername);
      formData.append('password', loginPassword);

      const res = await fetch('/auth/token', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error("Invalid username or password");
      const data = await res.json();
      localStorage.setItem('token', data.access_token);
      setToken(data.access_token);
    } catch (e: any) {
      setAuthError(e.message);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      await apiFetch('/users/', {
        method: 'POST',
        body: JSON.stringify({
          username: signUpUsername,
          email: signUpEmail,
          password: signUpPassword,
          role: signUpRole
        })
      });
      showSuccess("Account registered successfully! Please log in.");
      setLoginUsername(signUpUsername);
      setSignUpUsername('');
      setSignUpEmail('');
      setSignUpPassword('');
      setIsSignUp(false);
    } catch (e: any) {
      setAuthError(e.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setCurrentUser(null);
    setDrivers([]);
    setTrips([]);
    setAlerts([]);
    setDashboardStats(null);
    setMyDriverProfile(null);
  };

  const loadData = async () => {
    try {
      if (currentUser.role === 'admin' || currentUser.role === 'dispatcher') {
        // Fetch stats
        const stats = await apiFetch('/drivers/dashboard/summary');
        setDashboardStats(stats);

        // Fetch alerts
        const alertsData = await apiFetch('/drivers/alerts/expired');
        setAlerts(alertsData);

        // Fetch drivers
        const driversList = await apiFetch('/drivers/?limit=100');
        setDrivers(driversList);
      }

      // Fetch trips (drivers can only list their own on the backend automatically)
      let tripUrl = '/trips/?limit=100';
      if (tripStatusFilter) tripUrl += `&status=${tripStatusFilter}`;
      if (tripSearchFilter) tripUrl += `&q=${tripSearchFilter}`;
      if (tripDateAfter) tripUrl += `&created_after=${new Date(tripDateAfter).toISOString()}`;
      if (tripDateBefore) tripUrl += `&created_before=${new Date(tripDateBefore).toISOString()}`;

      const tripsList = await apiFetch(tripUrl);
      setTrips(tripsList);
    } catch (e: any) {
      showError(e.message);
    }
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 5000);
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  // Business Action: Auto-Assign Trip
  const handleAutoAssign = async (tripId: number) => {
    try {
      const res = await apiFetch(`/trips/${tripId}/auto-assign`, { method: 'PATCH' });
      showSuccess(`Successfully auto-assigned driver ${res.driver_name}!`);
      loadData();
    } catch (e: any) {
      showError(e.message);
    }
  };

  // Business Action: Assign Driver (manual)
  const handleManualAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignDriverId || !assigningTripId) return;
    try {
      await apiFetch(`/trips/${assigningTripId}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ driver_id: parseInt(assignDriverId) })
      });
      showSuccess("Driver assigned successfully!");
      setAssigningTripId(null);
      setAssignDriverId('');
      loadData();
    } catch (e: any) {
      showError(e.message);
    }
  };

  // Business Action: Create Trip
  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        source: newTripData.source,
        destination: newTripData.destination,
        priority: newTripData.priority,
        is_regular: newTripData.is_regular
      };
      if (newTripData.source_company) payload.source_company = newTripData.source_company;
      if (newTripData.destination_company) payload.destination_company = newTripData.destination_company;
      if (newTripData.distance_km) payload.distance_km = parseFloat(newTripData.distance_km);
      if (newTripData.duration_minutes) payload.duration_minutes = parseInt(newTripData.duration_minutes);
      if (newTripData.estimated_fare) payload.estimated_fare = parseFloat(newTripData.estimated_fare);
      if (newTripData.scheduled_date) payload.scheduled_date = new Date(newTripData.scheduled_date).toISOString();

      await apiFetch('/trips/', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      showSuccess("Trip created successfully!");
      setShowCreateTrip(false);
      setNewTripData({
        source: '',
        destination: '',
        source_company: '',
        destination_company: '',
        distance_km: '',
        duration_minutes: '',
        estimated_fare: '',
        is_regular: false,
        scheduled_date: '',
        priority: 'normal'
      });
      loadData();
    } catch (e: any) {
      showError(e.message);
    }
  };

  // Business Action: Trip status note transitions (start/complete)
  const handleTripTransitionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transitioningTrip) return;
    try {
      await apiFetch(`/trips/${transitioningTrip.id}/${transitioningTrip.action}`, {
        method: 'PATCH',
        body: JSON.stringify({ note: transitionNote || undefined })
      });
      showSuccess(`Trip ${transitioningTrip.action === 'start' ? 'started' : 'completed'} successfully!`);
      setTransitioningTrip(null);
      setTransitionNote('');
      loadData();
    } catch (e: any) {
      showError(e.message);
    }
  };

  // Business Action: View History logs
  const handleViewHistory = async (tripId: number) => {
    try {
      const logs = await apiFetch(`/trips/${tripId}/history`);
      setTripHistoryLogs(logs);
      setViewingTripHistory(tripId);
    } catch (e: any) {
      showError(e.message);
    }
  };

  // Business Action: Update Driver Profile & Status (with custom notes parameter)
  const handleDriverStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriverStatus) return;
    try {
      await apiFetch(`/drivers/${editingDriverStatus}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editDriverName,
          phone: editDriverPhone,
          license_number: editDriverLicense,
          license_expiry: editDriverExpiry ? new Date(editDriverExpiry).toISOString() : null,
          status: driverNewStatus,
          note: driverStatusNote || undefined
        })
      });
      showSuccess("Driver profile updated successfully!");
      setEditingDriverStatus(null);
      setDriverStatusNote('');
      setEditDriverName('');
      setEditDriverPhone('');
      setEditDriverLicense('');
      setEditDriverExpiry('');
      loadData();
    } catch (e: any) {
      showError(e.message);
    }
  };

  // Business Action: Cancel Trip Dispatch
  const handleCancelTripSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingTripId) return;
    try {
      await apiFetch(`/trips/${cancellingTripId}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({
          reason: cancelReason || undefined
        })
      });
      showSuccess("Trip cancelled successfully!");
      setCancellingTripId(null);
      setCancelReason('');
      loadData();
    } catch (e: any) {
      showError(e.message);
    }
  };

  // Business Action: Delete Driver
  const handleDeleteDriver = async (driverId: number) => {
    if (!window.confirm("Are you sure you want to delete this driver?")) return;
    try {
      await apiFetch(`/drivers/${driverId}`, { method: 'DELETE' });
      showSuccess("Driver deleted successfully!");
      loadData();
    } catch (e: any) {
      showError(e.message);
    }
  };

  // Business Action: Create Driver Profile
  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: newDriverData.name,
        phone: newDriverData.phone,
        license_number: newDriverData.license_number,
        license_expiry: newDriverData.license_expiry ? new Date(newDriverData.license_expiry).toISOString() : undefined
      };

      if (newDriverData.enable_login) {
        if (!newDriverData.username || !newDriverData.password) {
          throw new Error("Username and Password are required if login is enabled");
        }
        payload.username = newDriverData.username;
        payload.password = newDriverData.password;
        if (newDriverData.email) payload.email = newDriverData.email;
      }

      const res = await apiFetch('/drivers/', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      showSuccess("Driver created successfully!");
      setShowAddDriver(false);
      
      // If user account was created, show credentials modal
      if (res.username && res.password) {
        setShowDriverCredentials({
          username: res.username,
          password: res.password,
          name: res.name
        });
      }

      setNewDriverData({
        name: '',
        phone: '',
        license_number: '',
        license_expiry: '',
        enable_login: false,
        username: '',
        password: '',
        email: ''
      });
      loadData();
    } catch (e: any) {
      showError(e.message);
    }
  };

  // Business Action: Update User account settings
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {};
      if (profileUpdates.username) payload.username = profileUpdates.username;
      if (profileUpdates.email) payload.email = profileUpdates.email;
      if (profileUpdates.password) payload.password = profileUpdates.password;

      await apiFetch('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      showSuccess("Account updated successfully!");
      
      // If username changed, update localStorage token & profile session context
      if (profileUpdates.username !== currentUser.username) {
        // Need to log in again or re-fetch token since payload changes
        showSuccess("Account updated. Please log in with your new credentials.");
        handleLogout();
      } else {
        loadUserProfile();
      }
    } catch (e: any) {
      showError(e.message);
    }
  };

  // Render Login Card
  if (!token || !currentUser) {
    return (
      <div className="login-screen">
        {isSignUp ? (
          <form className="login-card" onSubmit={handleSignUp}>
            <div className="login-logo">
              DRIVER<span>BOARD</span>
            </div>
            <div className="login-subtitle">Create a New Dispatcher or Driver Account</div>
            
            {authError && (
              <div style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '20px', border: '1px solid rgba(239,68,68,0.3)' }}>
                {authError}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Username *</label>
              <input 
                type="text" 
                className="form-input" 
                required
                value={signUpUsername} 
                onChange={e => setSignUpUsername(e.target.value)} 
                placeholder="e.g. rohit123"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input 
                type="email" 
                className="form-input" 
                required
                value={signUpEmail} 
                onChange={e => setSignUpEmail(e.target.value)} 
                placeholder="e.g. rohit@example.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password (min 8 chars) *</label>
              <input 
                type="password" 
                className="form-input" 
                required
                value={signUpPassword} 
                onChange={e => setSignUpPassword(e.target.value)} 
                placeholder="••••••••"
              />
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">Account Role *</label>
              <select 
                className="form-select"
                value={signUpRole}
                onChange={e => setSignUpRole(e.target.value)}
              >
                <option value="admin">Admin</option>
                <option value="dispatcher">Dispatcher</option>
                <option value="driver">Driver</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', padding: '14px', marginBottom: '16px' }}>
              Register Account
            </button>

            <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Already have an account?{' '}
              <span onClick={() => { setIsSignUp(false); setAuthError(''); }} style={{ color: 'var(--accent-cyan)', cursor: 'pointer', fontWeight: 600 }}>
                Sign In
              </span>
            </div>
          </form>
        ) : (
          <form className="login-card" onSubmit={handleLogin}>
            <div className="login-logo">
              DRIVER<span>BOARD</span>
            </div>
            <div className="login-subtitle">Premium Dispatch & Management Dashboard</div>
            
            {authError && (
              <div style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '20px', border: '1px solid rgba(239,68,68,0.3)' }}>
                {authError}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Username</label>
              <input 
                type="text" 
                className="form-input" 
                required
                value={loginUsername} 
                onChange={e => setLoginUsername(e.target.value)} 
                placeholder="e.g. admin"
              />
            </div>

            <div className="form-group" style={{ marginBottom: '32px' }}>
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="form-input" 
                required
                value={loginPassword} 
                onChange={e => setLoginPassword(e.target.value)} 
                placeholder="••••••••"
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', padding: '14px', marginBottom: '16px' }}>
              Sign In
            </button>

            <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Don't have an account?{' '}
              <span onClick={() => { setIsSignUp(true); setAuthError(''); }} style={{ color: 'var(--accent-cyan)', cursor: 'pointer', fontWeight: 600 }}>
                Sign Up
              </span>
            </div>
          </form>
        )}
      </div>
    );
  }

  const distanceVal = parseFloat(newTripData.distance_km) || 0;
  const durationVal = parseInt(newTripData.duration_minutes) || 0;
  const recommendedFare = (distanceVal > 0 || durationVal > 0)
    ? Math.round((40.0 + distanceVal * 12.0 + durationVal * 1.5) * 100) / 100
    : 0;

  const isDispatcher = currentUser.role === 'admin' || currentUser.role === 'dispatcher';
  const isDriver = currentUser.role === 'driver';

  return (
    <div className="app-container">
      {/* Sidebar Layout */}
      <div className="sidebar">
        <div className="brand">
          <Truck size={24} color="#66fcf1" />
          <span>DRIVE</span>BOARD
        </div>

        <ul className="nav-links">
          {isDispatcher && (
            <>
              <li>
                <div 
                  className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                  onClick={() => setActiveTab('dashboard')}
                >
                  <Shield size={18} />
                  Dashboard
                </div>
              </li>
              <li>
                <div 
                  className={`nav-item ${activeTab === 'alerts' ? 'active' : ''}`}
                  onClick={() => setActiveTab('alerts')}
                >
                  <AlertTriangle size={18} />
                  Alerts {alerts.length > 0 && <span style={{ backgroundColor: 'var(--accent-red)', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', marginLeft: 'auto', fontWeight: 'bold' }}>{alerts.length}</span>}
                </div>
              </li>
              <li>
                <div 
                  className={`nav-item ${activeTab === 'drivers' ? 'active' : ''}`}
                  onClick={() => setActiveTab('drivers')}
                >
                  <User size={18} />
                  Drivers
                </div>
              </li>
            </>
          )}

          <li>
            <div 
              className={`nav-item ${activeTab === 'trips' ? 'active' : ''}`}
              onClick={() => setActiveTab('trips')}
            >
              <MapPin size={18} />
              Trips
            </div>
          </li>

          <li>
            <div 
              className={`nav-item ${activeTab === 'map' ? 'active' : ''}`}
              onClick={() => setActiveTab('map')}
            >
              <Compass size={18} />
              Live Map
            </div>
          </li>

          <li>
            <div 
              className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <Clock size={18} />
              My Profile
            </div>
          </li>
        </ul>

        <div className="nav-footer">
          <div className="user-snippet">
            <div className="avatar">
              {currentUser.username.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 600, color: '#fff', fontSize: '13px' }}>{currentUser.username}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{currentUser.role}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="main-content">
        {/* Top Sticky Header */}
        <div className="header-bar">
          <h1 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: 'normal', margin: 0 }}>
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Workspace
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {successMsg && (
              <div style={{ backgroundColor: 'rgba(69,242,72,0.1)', color: 'var(--accent-green)', border: '1px solid rgba(69,242,72,0.2)', padding: '8px 16px', borderRadius: '6px', fontSize: '12px' }}>
                {successMsg}
              </div>
            )}
            {errorMsg && (
              <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--accent-red)', border: '1px solid rgba(239,68,68,0.2)', padding: '8px 16px', borderRadius: '6px', fontSize: '12px' }}>
                {errorMsg}
              </div>
            )}
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Role Badge: <strong style={{ color: '#fff', textTransform: 'uppercase' }}>{currentUser.role}</strong>
            </span>
          </div>
        </div>

        {/* View Layout Container */}
        <div className="workspace-area">

          {/* TAB 1: DASHBOARD (ADMIN & DISPATCHER ONLY) */}
          {activeTab === 'dashboard' && isDispatcher && (
            <div>
              {/* Metric Card Widgets */}
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-label">Active Drivers</div>
                  <div className="metric-value">{dashboardStats?.total_drivers || 0}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Available Idle</div>
                  <div className="metric-value" style={{ color: 'var(--accent-green)' }}>{dashboardStats?.available_drivers || 0}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Drivers On Trip</div>
                  <div className="metric-value" style={{ color: 'var(--accent-blue)' }}>{dashboardStats?.on_trip_drivers || 0}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Active Dispatches</div>
                  <div className="metric-value" style={{ color: 'var(--accent-cyan)' }}>{dashboardStats?.active_trips || 0}</div>
                </div>
              </div>

              <div className="layout-split">
                {/* Dispatch Queue Section */}
                <div className="content-panel">
                  <div className="panel-header">
                    <h2 className="panel-title">
                      <Clock size={20} color="var(--accent-cyan)" />
                      Smart Dispatch Queue
                    </h2>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Created / Unassigned Trips</span>
                  </div>

                  <div className="table-container">
                    <table className="dashboard-table">
                      <thead>
                        <tr>
                          <th>Trip</th>
                          <th>Details</th>
                          <th>Priority</th>
                          <th>Dispatcher Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trips.filter(t => t.status === 'created').length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                              All dispatches assigned! No unassigned trips remaining.
                            </td>
                          </tr>
                        ) : (
                          trips.filter(t => t.status === 'created').map(trip => (
                            <tr key={trip.id}>
                              <td>
                                <div style={{ fontWeight: 600, color: '#fff' }}>{trip.source} → {trip.destination}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ID: {trip.id} | fare: ₹{trip.estimated_fare || 'N/A'}</div>
                              </td>
                              <td>
                                <div style={{ fontSize: '12px' }}>{trip.distance_km || 'N/A'} km | {trip.duration_minutes || 'N/A'} mins</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{trip.source_company || 'Standard client'}</div>
                              </td>
                              <td>
                                <span className={`badge`} style={{ 
                                  backgroundColor: trip.priority === 'urgent' ? 'rgba(239,68,68,0.12)' : trip.priority === 'high' ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.05)',
                                  color: trip.priority === 'urgent' ? 'var(--accent-red)' : trip.priority === 'high' ? 'var(--accent-amber)' : 'var(--text-secondary)'
                                }}>
                                  {trip.priority}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button onClick={() => handleAutoAssign(trip.id)} className="btn btn-primary btn-sm">
                                    <ListRestart size={14} />
                                    Auto-Assign
                                  </button>
                                  <button onClick={() => setAssigningTripId(trip.id)} className="btn btn-secondary btn-sm">
                                    Manual Selection
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Expiry Warning Sidebar Metric Card */}
                <div className="content-panel" style={{ background: 'linear-gradient(to bottom, #1f2833, #151c24)' }}>
                  <div className="panel-header" style={{ marginBottom: '16px' }}>
                    <h2 className="panel-title" style={{ color: 'var(--accent-amber)' }}>
                      <AlertTriangle size={20} />
                      License Expiry Alerts
                    </h2>
                  </div>

                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
                    We have found <strong style={{ color: '#fff' }}>{alerts.length}</strong> driver(s) whose commercial licenses are expired or expiring within 30 days.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {alerts.slice(0, 3).map(driver => {
                      const expired = new Date(driver.license_expiry) < new Date();
                      return (
                        <div key={driver.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                          <div>
                            <div style={{ fontWeight: 600, color: '#fff' }}>{driver.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Exp: {new Date(driver.license_expiry).toLocaleDateString()}</div>
                          </div>
                          <span className={`expiry-indicator ${expired ? 'expiry-red' : 'expiry-amber'}`}>
                            {expired ? 'Expired' : 'Expiring'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {alerts.length > 0 && (
                    <button onClick={() => setActiveTab('alerts')} className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: '20px', justifyContent: 'center' }}>
                      View All Alerts
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ALERTS (ADMIN & DISPATCHER ONLY) */}
          {activeTab === 'alerts' && isDispatcher && (
            <div className="content-panel">
              <div className="alerts-banner">
                <AlertTriangle size={24} color="var(--accent-amber)" />
                <div>
                  <h3 style={{ fontWeight: 600, color: '#fff', fontSize: '15px' }}>License Expired or Expiring Within 30 Days</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Assignments are blocked for drivers whose licenses have passed their expiration date. Please update their credentials.
                  </p>
                </div>
              </div>

              <div className="table-container">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Driver Name</th>
                      <th>Phone Number</th>
                      <th>License Number</th>
                      <th>Expiration Date</th>
                      <th>Alert Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                          No license warnings. All driver credentials active!
                        </td>
                      </tr>
                    ) : (
                      alerts.map(driver => {
                        const expired = new Date(driver.license_expiry) < new Date();
                        return (
                          <tr key={driver.id}>
                            <td style={{ fontWeight: 600, color: '#fff' }}>{driver.name}</td>
                            <td>{driver.phone}</td>
                            <td><code>{driver.license_number || 'N/A'}</code></td>
                            <td>{new Date(driver.license_expiry).toLocaleDateString()}</td>
                            <td>
                              <span className={`expiry-indicator ${expired ? 'expiry-red' : 'expiry-amber'}`} style={{ display: 'inline-flex' }}>
                                <AlertTriangle size={12} />
                                {expired ? 'Critical: Expired' : 'Warning: Expiring'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: DRIVERS (ADMIN & DISPATCHER ONLY) */}
          {activeTab === 'drivers' && isDispatcher && (
            <div className="content-panel">
              <div className="panel-header">
                <h2 className="panel-title">
                  <User size={20} color="var(--accent-cyan)" />
                  Commercial Drivers Directory
                </h2>
                <button onClick={() => setShowAddDriver(true)} className="btn btn-primary btn-sm">
                  <Plus size={16} />
                  Add Driver
                </button>
              </div>

              <div className="table-container">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Driver details</th>
                      <th>Availability status</th>
                      <th>License status</th>
                      <th>Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map(driver => {
                      const expired = driver.license_expiry ? new Date(driver.license_expiry) < new Date() : false;
                      const expiringSoon = driver.license_expiry ? (new Date(driver.license_expiry) >= new Date() && new Date(driver.license_expiry) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) : false;

                      return (
                        <tr key={driver.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: '#fff' }}>{driver.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ID: {driver.id} | Phone: {driver.phone}</div>
                          </td>
                          <td>
                            <span className={`badge badge-${driver.status}`}>
                              {driver.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td>
                            {driver.license_expiry ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '13px' }}>{new Date(driver.license_expiry).toLocaleDateString()}</span>
                                {expired && <span className="expiry-indicator expiry-red">Expired</span>}
                                {expiringSoon && <span className="expiry-indicator expiry-amber">Expiring</span>}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)' }}>None registered</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => {
                                setEditingDriverStatus(driver.id);
                                setDriverNewStatus(driver.status);
                                setEditDriverName(driver.name);
                                setEditDriverPhone(driver.phone || '');
                                setEditDriverLicense(driver.license_number || '');
                                setEditDriverExpiry(driver.license_expiry ? driver.license_expiry.split('T')[0] : '');
                              }} className="btn btn-secondary btn-icon-only" title="Edit Profile & Status">
                                <Edit size={14} />
                              </button>
                              {currentUser.role === 'admin' && (
                                <button onClick={() => handleDeleteDriver(driver.id)} className="btn btn-secondary btn-icon-only" style={{ color: 'var(--accent-red)' }} title="Delete Driver">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: TRIPS */}
          {activeTab === 'trips' && (
            <div className="content-panel">
              <div className="panel-header">
                <h2 className="panel-title">
                  <MapPin size={20} color="var(--accent-cyan)" />
                  Dispatch Trip Manifest
                </h2>
                {isDispatcher && (
                  <button onClick={() => setShowCreateTrip(true)} className="btn btn-primary btn-sm">
                    <Plus size={16} />
                    Schedule New Trip
                  </button>
                )}
              </div>

              {/* Filters toolbar */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', backgroundColor: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', marginBottom: '24px', border: '1px solid var(--border-color)', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Search size={14} color="var(--text-secondary)" />
                  <input 
                    type="text" 
                    placeholder="Search locations..." 
                    className="form-input" 
                    style={{ width: '180px', padding: '6px 12px', fontSize: '13px' }}
                    value={tripSearchFilter}
                    onChange={e => setTripSearchFilter(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Filter size={14} color="var(--text-secondary)" />
                  <select 
                    className="form-select" 
                    style={{ width: '150px', padding: '6px 12px', fontSize: '13px' }}
                    value={tripStatusFilter}
                    onChange={e => setTripStatusFilter(e.target.value)}
                  >
                    <option value="">All Statuses</option>
                    <option value="created">Created</option>
                    <option value="assigned">Assigned</option>
                    <option value="started">Started</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span>Created after:</span>
                  <input 
                    type="date" 
                    className="form-input" 
                    style={{ width: '130px', padding: '6px', fontSize: '12px' }}
                    value={tripDateAfter}
                    onChange={e => setTripDateAfter(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span>Before:</span>
                  <input 
                    type="date" 
                    className="form-input" 
                    style={{ width: '130px', padding: '6px', fontSize: '12px' }}
                    value={tripDateBefore}
                    onChange={e => setTripDateBefore(e.target.value)}
                  />
                </div>

                <button onClick={loadData} className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }}>
                  Apply Filters
                </button>
              </div>

              <div className="table-container">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Trip Info</th>
                      <th>Metrics</th>
                      <th>Driver assigned</th>
                      <th>Dispatch status</th>
                      <th>Audit Trail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                          No trips matching the criteria were found.
                        </td>
                      </tr>
                    ) : (
                      trips.map(trip => (
                        <tr key={trip.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: '#fff' }}>{trip.source} → {trip.destination}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              ID: {trip.id} | {trip.source_company || 'Standard'} client | fare: ₹{trip.estimated_fare || 'N/A'}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontSize: '12px' }}>{trip.distance_km || 'N/A'} km | {trip.duration_minutes || 'N/A'} mins</div>
                            {trip.scheduled_date && (
                              <div style={{ fontSize: '11px', color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <Calendar size={10} />
                                {new Date(trip.scheduled_date).toLocaleString()}
                              </div>
                            )}
                          </td>
                          <td>
                            {trip.driver_name ? (
                              <div>
                                <div style={{ fontWeight: 500, color: '#fff' }}>{trip.driver_name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{trip.driver_phone}</div>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontStyle: 'italic' }}>Unassigned</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                              <span className={`badge badge-${trip.status}`}>
                                {trip.status}
                              </span>

                              {/* Interactive Driver Actions */}
                              {trip.status === 'assigned' && (isDispatcher || (isDriver && myDriverProfile?.id === trip.driver_id)) && (
                                <button onClick={() => setTransitioningTrip({ id: trip.id, action: 'start' })} className="btn btn-success btn-sm" style={{ padding: '3px 8px', fontSize: '10px' }}>
                                  <Play size={10} />
                                  Start Trip
                                </button>
                              )}
                              {trip.status === 'started' && (isDispatcher || (isDriver && myDriverProfile?.id === trip.driver_id)) && (
                                <button onClick={() => setTransitioningTrip({ id: trip.id, action: 'complete' })} className="btn btn-primary btn-sm" style={{ padding: '3px 8px', fontSize: '10px' }}>
                                  <CheckCircle2 size={10} />
                                  Complete
                                </button>
                              )}
                              {(trip.status === 'created' || trip.status === 'assigned') && isDispatcher && (
                                <button onClick={() => setCancellingTripId(trip.id)} className="btn btn-secondary btn-sm" style={{ padding: '3px 8px', fontSize: '10px', color: 'var(--accent-red)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                  <XCircle size={10} />
                                  Cancel Trip
                                </button>
                              )}
                            </div>
                          </td>
                          <td>
                            <button onClick={() => handleViewHistory(trip.id)} className="btn btn-secondary btn-sm" style={{ padding: '4px 8px', fontSize: '11px' }}>
                              <Clipboard size={12} />
                              Logs
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: MY PROFILE */}
          {activeTab === 'profile' && (
            <div className="layout-split">
              {/* Account Settings Forms */}
              <div className="content-panel">
                <div className="panel-header">
                  <h2 className="panel-title">
                    <User size={20} color="var(--accent-cyan)" />
                    User Settings
                  </h2>
                </div>

                <form onSubmit={handleUpdateProfile}>
                  <div className="form-group">
                    <label className="form-label">Username</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={profileUpdates.username} 
                      onChange={e => setProfileUpdates({ ...profileUpdates, username: e.target.value })} 
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      value={profileUpdates.email} 
                      onChange={e => setProfileUpdates({ ...profileUpdates, email: e.target.value })} 
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '28px' }}>
                    <label className="form-label">New Password (leave empty to keep current)</label>
                    <input 
                      type="password" 
                      className="form-input" 
                      value={profileUpdates.password} 
                      onChange={e => setProfileUpdates({ ...profileUpdates, password: e.target.value })} 
                      placeholder="••••••••"
                    />
                  </div>

                  <button type="submit" className="btn btn-primary">
                    Save Details
                  </button>
                </form>
              </div>

              {/* Linked Driver profile Details (Driver role only) */}
              {isDriver && (
                <div className="content-panel">
                  <div className="panel-header">
                    <h2 className="panel-title" style={{ color: 'var(--accent-green)' }}>
                      <Truck size={20} />
                      Commercial Driver License
                    </h2>
                  </div>

                  {myDriverProfile ? (
                    <div>
                      <div className="details-overlay">
                        <div className="detail-row">
                          <span className="detail-label">Name</span>
                          <span className="detail-val">{myDriverProfile.name}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Status</span>
                          <span className="detail-val">
                            <span className={`badge badge-${myDriverProfile.status}`}>
                              {myDriverProfile.status}
                            </span>
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Phone</span>
                          <span className="detail-val">{myDriverProfile.phone}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">License Number</span>
                          <span className="detail-val"><code>{myDriverProfile.license_number}</code></span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Expiration Date</span>
                          <span className="detail-val">
                            {myDriverProfile.license_expiry ? (
                              new Date(myDriverProfile.license_expiry).toLocaleDateString()
                            ) : (
                              'N/A'
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                      No active driver profile is linked to this account yet. Please ask an admin to link your user ID.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB: LIVE MAP */}
          {activeTab === 'map' && (() => {
            const activeDispatches = trips.filter(t => t.status === 'started' || t.status === 'assigned');
            const selectedTrip = trips.find(t => t.id === selectedMapTripId) || (activeDispatches.length > 0 ? activeDispatches[0] : null);
            
            const mapLocations = new Set<string>();
            trips.forEach(t => {
              if (t.source) mapLocations.add(t.source);
              if (t.destination) mapLocations.add(t.destination);
            });
            if (mapLocations.size === 0) {
              mapLocations.add("Mumbai HQ Terminal");
              mapLocations.add("Pune Logistics Hub");
              mapLocations.add("Nashik Distribution Port");
              mapLocations.add("Goa Warehousing Dock");
            }

            return (
              <div className="content-panel" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
                <div className="panel-header" style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-dim)', flexShrink: 0 }}>
                  <h2 className="panel-title">
                    <Compass size={20} color="var(--accent-cyan)" className="animate-spin" style={{ animationDuration: '6s' }} />
                    Live Operations Map & Fleet Radar
                  </h2>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Auto-updating active dispatches and vehicle coordinates
                  </span>
                </div>

                <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
                  {/* Left Column: Dispatch Radar Tracker */}
                  <div style={{ width: '320px', borderRight: '1px solid var(--border-dim)', display: 'flex', flexDirection: 'column', flexShrink: 0, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-dim)' }}>
                      <h4 style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                        Active Tracker ({activeDispatches.length})
                      </h4>
                    </div>

                    <div style={{ flexGrow: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {activeDispatches.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                          No active dispatches currently moving. Go to the <strong>Trips</strong> tab and click <strong>Start</strong> on an assigned dispatch to see live tracking.
                        </div>
                      ) : (
                        activeDispatches.map(trip => {
                          const isSel = selectedTrip?.id === trip.id;
                          let progress = 0;
                          if (trip.status === 'started' && trip.start_time) {
                            const elapsed = currentTimeSec - new Date(trip.start_time).getTime() / 1000;
                            const durationSec = (trip.duration_minutes || 30) * 60;
                            progress = Math.min(Math.max((elapsed / durationSec) * 100, 0), 100);
                          }
                          return (
                            <div 
                              key={trip.id}
                              onClick={() => setSelectedMapTripId(trip.id)}
                              style={{
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid ' + (isSel ? 'var(--accent)' : 'var(--border-dim)'),
                                backgroundColor: isSel ? 'rgba(99,102,241,0.04)' : 'var(--bg-card)',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>DISPATCH #{trip.id}</span>
                                <span className={`badge badge-${trip.status}`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                                  {trip.status}
                                </span>
                              </div>

                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <span>{trip.source}</span>
                                <span style={{ color: 'var(--text-secondary)' }}>➔</span>
                                <span>{trip.destination}</span>
                              </div>

                              {trip.driver_name && (
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                  Driver: <strong style={{ color: 'var(--text-main)' }}>{trip.driver_name}</strong>
                                </div>
                              )}

                              {trip.status === 'started' && (
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                    <span>Transit Progress</span>
                                    <span>{Math.round(progress)}%</span>
                                  </div>
                                  <div style={{ height: '4px', backgroundColor: 'var(--border-dim)', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${progress}%`, backgroundColor: 'var(--accent-cyan)', borderRadius: '2px', transition: 'width 0.2s linear' }} />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Right Column: Dynamic SVG Radar Map */}
                  <div style={{ flexGrow: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#09090b' }}>
                    <style>{`
                      .map-tooltip {
                        background-color: #18181b !important;
                        color: #e4e4e7 !important;
                        border: 1px solid #27272a !important;
                        border-radius: 6px !important;
                        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5) !important;
                        font-family: inherit !important;
                        font-size: 10px !important;
                        padding: 4px 8px !important;
                      }
                      .leaflet-container {
                        background: #09090b !important;
                      }
                      .leaflet-tooltip-top:before {
                        border-top-color: #27272a !important;
                      }
                    `}</style>

                    <div id="leaflet-map" style={{ width: '100%', height: '100%', minHeight: '400px' }} />

                    {/* Bottom Right Detail Overlay Card */}
                    {selectedTrip && (() => {
                      let progress = 0;
                      let remainingString = 'Calculating...';
                      if (selectedTrip.status === 'started' && selectedTrip.start_time) {
                        const elapsed = currentTimeSec - new Date(selectedTrip.start_time).getTime() / 1000;
                        const durationSec = (selectedTrip.duration_minutes || 30) * 60;
                        progress = Math.min(Math.max((elapsed / durationSec) * 100, 0), 100);
                        
                        const remainingSec = Math.max(durationSec - elapsed, 0);
                        if (remainingSec > 0) {
                          const m = Math.floor(remainingSec / 60);
                          const s = Math.floor(remainingSec % 60);
                          remainingString = `${m}m ${s}s remaining`;
                        } else {
                          remainingString = 'Arriving / Complete';
                        }
                      } else if (selectedTrip.status === 'assigned') {
                        remainingString = 'Waiting to start';
                      }

                      return (
                        <div style={{
                          position: 'absolute',
                          bottom: '20px',
                          right: '20px',
                          width: '320px',
                          backgroundColor: 'rgba(24,24,27,0.95)',
                          backdropFilter: 'blur(8px)',
                          border: '1px solid var(--border-dim)',
                          borderRadius: '8px',
                          padding: '16px',
                          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ color: '#fff', fontSize: '14px' }}>Dispatch Tracker Details</strong>
                            <span className={`badge badge-${selectedTrip.status}`} style={{ fontSize: '10px' }}>
                              {selectedTrip.status}
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ROUTE</div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                              {selectedTrip.source} ➔ {selectedTrip.destination}
                            </div>
                          </div>

                          {selectedTrip.driver_name && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid var(--border-dim)', paddingTop: '8px' }}>
                              <div>
                                <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>ASSIGNED DRIVER</div>
                                <div style={{ fontSize: '12px', color: '#fff', fontWeight: 600 }}>{selectedTrip.driver_name}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>CONTACT PHONE</div>
                                <div style={{ fontSize: '12px', color: '#fff', fontWeight: 600 }}>{selectedTrip.driver_phone || 'None'}</div>
                              </div>
                            </div>
                          )}

                          <div style={{ borderTop: '1px solid var(--border-dim)', paddingTop: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                              <span>ESTIMATED TIME</span>
                              <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{remainingString}</span>
                            </div>
                            {selectedTrip.status === 'started' && (
                              <div style={{ height: '4px', backgroundColor: 'var(--border-dim)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${progress}%`, backgroundColor: 'var(--accent-cyan)' }} />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })()}

        </div>
      </div>

      {/* MODAL: CREATE TRIP */}
      {showCreateTrip && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleCreateTrip}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff' }}>Schedule New Dispatch</h3>
              <button type="button" className="modal-close" onClick={() => setShowCreateTrip(false)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Source *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required
                  value={newTripData.source} 
                  onChange={e => setNewTripData({ ...newTripData, source: e.target.value })} 
                  placeholder="Starting Location"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Destination *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required
                  value={newTripData.destination} 
                  onChange={e => setNewTripData({ ...newTripData, destination: e.target.value })} 
                  placeholder="Ending Location"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Source Client</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={newTripData.source_company} 
                  onChange={e => setNewTripData({ ...newTripData, source_company: e.target.value })} 
                  placeholder="Company Name"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Destination Client</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={newTripData.destination_company} 
                  onChange={e => setNewTripData({ ...newTripData, destination_company: e.target.value })} 
                  placeholder="Company Name"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Distance (km)</label>
                <input 
                  type="number" 
                  step="0.1"
                  className="form-input" 
                  value={newTripData.distance_km} 
                  onChange={e => setNewTripData({ ...newTripData, distance_km: e.target.value })} 
                  placeholder="e.g. 12.5"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Duration (minutes)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={newTripData.duration_minutes} 
                  onChange={e => setNewTripData({ ...newTripData, duration_minutes: e.target.value })} 
                  placeholder="e.g. 45"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Scheduled Date/Time</label>
                <input 
                  type="datetime-local" 
                  className="form-input" 
                  value={newTripData.scheduled_date} 
                  onChange={e => setNewTripData({ ...newTripData, scheduled_date: e.target.value })} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Fare Price (INR) {recommendedFare > 0 && `(Rec: ₹${recommendedFare})`}</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="form-input" 
                  value={newTripData.estimated_fare} 
                  onChange={e => setNewTripData({ ...newTripData, estimated_fare: e.target.value })} 
                  placeholder={recommendedFare > 0 ? `${recommendedFare}` : "e.g. 500"}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select 
                  className="form-select"
                  value={newTripData.priority}
                  onChange={e => setNewTripData({ ...newTripData, priority: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '28px' }}>
                <input 
                  type="checkbox" 
                  id="is_regular"
                  checked={newTripData.is_regular}
                  onChange={e => setNewTripData({ ...newTripData, is_regular: e.target.checked })}
                />
                <label htmlFor="is_regular" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>Recurring Route</label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreateTrip(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Schedule Dispatch
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: MANUAL DRIVER SELECTION */}
      {assigningTripId !== null && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleManualAssign}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff' }}>Assign Driver Manual Override</h3>
              <button type="button" className="modal-close" onClick={() => setAssigningTripId(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="form-group" style={{ marginBottom: '28px' }}>
              <label className="form-label">Select Driver</label>
              <select 
                className="form-select" 
                required
                value={assignDriverId} 
                onChange={e => setAssignDriverId(e.target.value)}
              >
                <option value="">-- Select an available driver --</option>
                {drivers.filter(d => d.status === 'available').map(driver => {
                  const expired = driver.license_expiry ? new Date(driver.license_expiry) < new Date() : false;
                  return (
                    <option key={driver.id} value={driver.id} disabled={expired}>
                      {driver.name} ({driver.phone}) {expired ? '[BLOCKED: EXPIRED LICENSE]' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setAssigningTripId(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Confirm Assignment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: TRIP TRANSITION NOTES */}
      {transitioningTrip !== null && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleTripTransitionSubmit}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', textTransform: 'capitalize' }}>
                {transitioningTrip.action} Dispatch Notes
              </h3>
              <button type="button" className="modal-close" onClick={() => setTransitioningTrip(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="form-group" style={{ marginBottom: '28px' }}>
              <label className="form-label">Transition Note (Optional)</label>
              <textarea 
                className="form-textarea" 
                value={transitionNote} 
                onChange={e => setTransitionNote(e.target.value)}
                placeholder={transitioningTrip.action === 'start' ? "e.g. starting shift, moderate traffic expected..." : "e.g. delivered cargo cleanly at dock 4..."}
                rows={3}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setTransitioningTrip(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" style={{ textTransform: 'capitalize' }}>
                Confirm {transitioningTrip.action}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: EDIT DRIVER PROFILE & STATUS */}
      {editingDriverStatus !== null && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleDriverStatusSubmit} style={{ width: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff' }}>Edit Driver Profile & Status</h3>
              <button type="button" className="modal-close" onClick={() => setEditingDriverStatus(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input 
                type="text" 
                className="form-input" 
                value={editDriverName} 
                onChange={e => setEditDriverName(e.target.value)} 
                required 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input 
                type="text" 
                className="form-input" 
                value={editDriverPhone} 
                onChange={e => setEditDriverPhone(e.target.value)} 
                required 
              />
            </div>

            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="form-label">License Number</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={editDriverLicense} 
                  onChange={e => setEditDriverLicense(e.target.value)} 
                  required 
                />
              </div>
              <div>
                <label className="form-label">License Expiry</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={editDriverExpiry} 
                  onChange={e => setEditDriverExpiry(e.target.value)} 
                  required 
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Availability Status</label>
              <select 
                className="form-select"
                value={driverNewStatus}
                onChange={e => setDriverNewStatus(e.target.value)}
              >
                <option value="available">Available (Idle)</option>
                <option value="on_trip">On Trip</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '28px' }}>
              <label className="form-label">Status Change Note (Optional)</label>
              <textarea 
                className="form-textarea" 
                value={driverStatusNote} 
                onChange={e => setDriverStatusNote(e.target.value)}
                placeholder="Reason for status change..."
                rows={2}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditingDriverStatus(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: TRIP CANCELLATION REASON */}
      {cancellingTripId !== null && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleCancelTripSubmit} style={{ width: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff' }}>Cancel Trip Dispatch</h3>
              <button type="button" className="modal-close" onClick={() => { setCancellingTripId(null); setCancelReason(''); }}>
                <X size={20} />
              </button>
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">Reason for Cancellation</label>
              <textarea 
                className="form-textarea" 
                value={cancelReason} 
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Please specify why this trip is being cancelled (e.g. customer request, no driver available...)"
                rows={3}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setCancellingTripId(null); setCancelReason(''); }}>
                Keep Trip
              </button>
              <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--accent-red)', border: 'none' }}>
                Cancel Trip
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: TRIP HISTORY LOGS */}
      {viewingTripHistory !== null && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '600px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff' }}>Dispatch Audit History</h3>
              <button type="button" className="modal-close" onClick={() => setViewingTripHistory(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="timeline" style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '8px' }}>
              {tripHistoryLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                  No history records logged for this dispatch.
                </div>
              ) : (
                tripHistoryLogs.map(log => (
                  <div key={log.id} className="timeline-item">
                    <div className="timeline-point" />
                    <div className="timeline-content">
                      <span className="timeline-time">{new Date(log.changed_at).toLocaleString()}</span>
                      <span className="timeline-text">Status changed to <strong style={{ color: 'var(--accent-cyan)' }}>{log.status.toUpperCase()}</strong></span>
                      {log.note && <span className="timeline-note">“ {log.note} ”</span>}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '28px' }}>
              <button className="btn btn-secondary" onClick={() => setViewingTripHistory(null)}>
                Close Overlay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD DRIVER */}
      {showAddDriver && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleCreateDriver} style={{ width: '500px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff' }}>Add New Driver Profile</h3>
              <button type="button" className="modal-close" onClick={() => setShowAddDriver(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input 
                type="text" 
                className="form-input" 
                required
                value={newDriverData.name} 
                onChange={e => setNewDriverData({ ...newDriverData, name: e.target.value })} 
                placeholder="e.g. John Doe"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input 
                type="text" 
                className="form-input" 
                required
                value={newDriverData.phone} 
                onChange={e => setNewDriverData({ ...newDriverData, phone: e.target.value })} 
                placeholder="e.g. +91 9876543210"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">License Number *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required
                  value={newDriverData.license_number} 
                  onChange={e => setNewDriverData({ ...newDriverData, license_number: e.target.value })} 
                  placeholder="e.g. DL-142023001"
                />
              </div>

              <div className="form-group">
                <label className="form-label">License Expiry Date *</label>
                <input 
                  type="date" 
                  className="form-input" 
                  required
                  value={newDriverData.license_expiry} 
                  onChange={e => setNewDriverData({ ...newDriverData, license_expiry: e.target.value })} 
                />
              </div>
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', marginBottom: '16px' }}>
              <input 
                type="checkbox" 
                id="enable_login"
                checked={newDriverData.enable_login}
                onChange={e => {
                  const checked = e.target.checked;
                  let autoUser = newDriverData.username;
                  let autoPass = newDriverData.password;
                  if (checked && !autoUser) {
                    const baseUser = newDriverData.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                    autoUser = baseUser ? `${baseUser}_driver` : 'driver_' + Math.floor(1000 + Math.random() * 9000);
                    autoPass = 'Driver@' + Math.floor(100000 + Math.random() * 900000);
                  }
                  setNewDriverData({ 
                    ...newDriverData, 
                    enable_login: checked,
                    username: autoUser,
                    password: autoPass
                  });
                }}
              />
              <label htmlFor="enable_login" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>
                Enable Driver Login Account
              </label>
            </div>

            {newDriverData.enable_login && (
              <div style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-dim)', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Username *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required={newDriverData.enable_login}
                    value={newDriverData.username} 
                    onChange={e => setNewDriverData({ ...newDriverData, username: e.target.value })} 
                    placeholder="Username for login"
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Password *</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      required={newDriverData.enable_login}
                      value={newDriverData.password} 
                      onChange={e => setNewDriverData({ ...newDriverData, password: e.target.value })} 
                      placeholder="Password"
                    />
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        const pass = 'Driver@' + Math.floor(100000 + Math.random() * 900000);
                        setNewDriverData({ ...newDriverData, password: pass });
                      }}
                      style={{ flexShrink: 0 }}
                    >
                      Regenerate
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Email (Optional)</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    value={newDriverData.email} 
                    onChange={e => setNewDriverData({ ...newDriverData, email: e.target.value })} 
                    placeholder="driver@example.com"
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddDriver(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Driver Profile
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: DRIVER CREDENTIALS SUCCESS SCREEN */}
      {showDriverCredentials && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '450px', textAlign: 'center', padding: '32px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(16,185,129,0.15)', color: 'var(--status-green)', marginBottom: '20px' }}>
              <CheckCircle2 size={32} />
            </div>

            <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>Driver Account Active</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', marginBottom: '24px' }}>
              Login credentials generated for driver <strong>{showDriverCredentials.name}</strong>. Copy these credentials to share them.
            </p>

            <div style={{ backgroundColor: 'var(--bg-space)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-dim)', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Username</div>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px', fontFamily: 'monospace' }}>{showDriverCredentials.username}</div>
              </div>
              
              <div style={{ borderTop: '1px solid var(--border-dim)', paddingTop: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Password</div>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px', fontFamily: 'monospace' }}>{showDriverCredentials.password}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  navigator.clipboard.writeText(`Driver Credentials:\nUsername: ${showDriverCredentials.username}\nPassword: ${showDriverCredentials.password}`);
                  alert("Copied to clipboard!");
                }}
              >
                Copy Credentials
              </button>
              <button className="btn btn-primary" onClick={() => setShowDriverCredentials(null)}>
                Done & Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
