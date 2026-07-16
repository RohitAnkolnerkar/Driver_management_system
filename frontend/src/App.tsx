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
  Copy,
  Clock,
  Search,
  Filter,
  CheckCircle2,
  ListRestart,
  Compass,
  RefreshCw,
  BarChart2,
  TrendingUp,
  Building,
  Printer,
  Download,
  Fuel
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
  const [signUpPhone, setSignUpPhone] = useState('');

  // Tab State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'trips' | 'drivers' | 'alerts' | 'profile' | 'map' | 'performance' | 'payments' | 'vehicles' | 'fuel' | 'reconciliation'>('dashboard');

  // Payments State
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentsFilterDriver, setPaymentsFilterDriver] = useState('');
  const [paymentsFilterYear, setPaymentsFilterYear] = useState(new Date().getFullYear().toString());
  const [paymentsFilterMonth, setPaymentsFilterMonth] = useState((new Date().getMonth() + 1).toString());
  const [paymentsFilterStatus, setPaymentsFilterStatus] = useState('');
  const [generatingPayout, setGeneratingPayout] = useState(false);
  const [showPayModal, setShowPayModal] = useState<any>(null);
  const [payoutBonus, setPayoutBonus] = useState('0');
  const [payoutDeductions, setPayoutDeductions] = useState('0');
  const [payoutMethod, setPayoutMethod] = useState('Bank Transfer');
  const [payoutNote, setPayoutNote] = useState('');

  // Business Entities State
  const [drivers, setDrivers] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [myDriverProfile, setMyDriverProfile] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [scorecards, setScorecards] = useState<any[]>([]);
  const [scorecardYear, setScorecardYear] = useState<number>(new Date().getFullYear());
  const [scorecardMonth, setScorecardMonth] = useState<number>(new Date().getMonth() + 1);
  const [scorecardLoading, setScorecardLoading] = useState(false);

  // Loading & Action states
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals & Forms State
  const [editingFuelLog, setEditingFuelLog] = useState<any | null>(null);
  const [dispatcherFuelLogData, setDispatcherFuelLogData] = useState({
    driver_id: '',
    liters_refueled: '',
    cost: '',
    odometer: '',
    trip_id: '',
  });
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
    email: '',
    base_salary: '0',
    commission_percentage: '100',
    vehicle_id: ''
  });
  const [showDriverCredentials, setShowDriverCredentials] = useState<any>(null);

  const [assigningTripId, setAssigningTripId] = useState<number | null>(null);
  const [assignDriverId, setAssignDriverId] = useState('');
  const [assignVehicleId, setAssignVehicleId] = useState('');
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  const [transitioningTrip, setTransitioningTrip] = useState<{ id: number; action: 'start' | 'complete' } | null>(null);
  const [transitionNote, setTransitionNote] = useState('');
  const [transitionOdometer, setTransitionOdometer] = useState('');

  const [viewingTripHistory, setViewingTripHistory] = useState<number | null>(null);
  const [tripHistoryLogs, setTripHistoryLogs] = useState<any[]>([]);

  const [editingDriverStatus, setEditingDriverStatus] = useState<number | null>(null);
  const [driverNewStatus, setDriverNewStatus] = useState('available');
  const [driverStatusNote, setDriverStatusNote] = useState('');
  const [editDriverName, setEditDriverName] = useState('');
  const [editDriverPhone, setEditDriverPhone] = useState('');
  const [editDriverLicense, setEditDriverLicense] = useState('');
  const [editDriverExpiry, setEditDriverExpiry] = useState('');
  const [editDriverBaseSalary, setEditDriverBaseSalary] = useState('0');
  const [editDriverCommissionPercentage, setEditDriverCommissionPercentage] = useState('100');
  const [editDriverVehicleId, setEditDriverVehicleId] = useState('');
  const [cancellingTripId, setCancellingTripId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  // Arrival confirmation state
  const [arrivalTripId, setArrivalTripId] = useState<number | null>(null);
  const [arrivalDestination, setArrivalDestination] = useState<string>('');
  const confirmedArrivalTrips = useRef<Set<number>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Safety inspection states
  const [showInspectionTripId, setShowInspectionTripId] = useState<number | null>(null);
  const [inspectionBrakes, setInspectionBrakes] = useState(true);
  const [inspectionTires, setInspectionTires] = useState(true);
  const [inspectionLights, setInspectionLights] = useState(true);
  const [inspectionSteering, setInspectionSteering] = useState(true);
  const [inspectionFluids, setInspectionFluids] = useState(true);
  const [inspectionNotes, setInspectionNotes] = useState('');

  const [profileUpdates, setProfileUpdates] = useState({
    username: '',
    email: '',
    password: ''
  });

  // Map Tracking States
  const [selectedMapTripId, setSelectedMapTripId] = useState<number | null>(null);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(Date.now() / 1000);

  // Route Playback States
  const [playbackTripId, setPlaybackTripId] = useState<number | null>(null);
  const [playbackHistory, setPlaybackHistory] = useState<any[]>([]);
  const [playbackIndex, setPlaybackIndex] = useState<number>(0);
  const [isPlaybackPlaying, setIsPlaybackPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [performanceSubTab, setPerformanceSubTab] = useState<'leaderboard' | 'analytics' | 'scorecard'>('leaderboard');

  // Fuel Logging States
  const [fuelRefueled, setFuelRefueled] = useState('');
  const [fuelCost, setFuelCost] = useState('');
  const [fuelOdometer, setFuelOdometer] = useState('');
  const [fuelTripId, setFuelTripId] = useState('');
  const [fuelLogs, setFuelLogs] = useState<any[]>([]);
  const [fuelAnalytics, setFuelAnalytics] = useState<any | null>(null);
  const [isPersonalTwoWheeler, setIsPersonalTwoWheeler] = useState(false);
  const [dispatcherPersonalTwoWheeler, setDispatcherPersonalTwoWheeler] = useState(false);

  // Workshop & Utilization States
  const [completingMaintenanceLog, setCompletingMaintenanceLog] = useState<any | null>(null);
  const [completeMaintenanceData, setCompleteMaintenanceData] = useState({ cost: '0', description: '', next_service_due_odometer: '' });
  const [utilizationAnalytics, setUtilizationAnalytics] = useState<any[]>([]);
  const [utilizationPeriod, setUtilizationPeriod] = useState<number>(30);
  const [utilizationLoading, setUtilizationLoading] = useState<boolean>(false);
  const [vehiclesSubTab, setVehiclesSubTab] = useState<'registry' | 'utilization'>('registry');
  const [dieselRates, setDieselRates] = useState<any>(null);
  const [selectedDieselCity, setSelectedDieselCity] = useState('Mumbai');
  const [dispatcherDieselCity, setDispatcherDieselCity] = useState('Mumbai');
  const [editDieselCity, setEditDieselCity] = useState('Mumbai');

  // Vehicle & Maintenance States
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [myVehicle, setMyVehicle] = useState<any | null>(null);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehicleData, setNewVehicleData] = useState({
    make: '',
    model: '',
    year: new Date().getFullYear().toString(),
    license_plate: '',
    odometer_km: '0',
    status: 'active'
  });
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);
  const [showLogMaintenance, setShowLogMaintenance] = useState<any | null>(null);
  const [newMaintenanceData, setNewMaintenanceData] = useState({
    service_type: 'oil_change',
    description: '',
    cost: '0',
    odometer_at_service: '',
    next_service_due_odometer: ''
  });
  const [viewingMaintenanceLogs, setViewingMaintenanceLogs] = useState<any | null>(null);
  const [maintenanceHistory, setMaintenanceHistory] = useState<any[]>([]);

  const fetchVehicles = async () => {
    try {
      const data = await apiFetch('/vehicles/');
      setVehicles(data);
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/vehicles/', {
        method: 'POST',
        body: JSON.stringify({
          make: newVehicleData.make,
          model: newVehicleData.model,
          year: parseInt(newVehicleData.year),
          license_plate: newVehicleData.license_plate,
          odometer_km: parseFloat(newVehicleData.odometer_km),
          status: newVehicleData.status
        })
      });
      showSuccess("Vehicle created successfully!");
      setShowAddVehicle(false);
      setNewVehicleData({
        make: '',
        model: '',
        year: new Date().getFullYear().toString(),
        license_plate: '',
        odometer_km: '0',
        status: 'active'
      });
      fetchVehicles();
      loadData();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleUpdateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle) return;
    try {
      await apiFetch(`/vehicles/${editingVehicle.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          make: editingVehicle.make,
          model: editingVehicle.model,
          year: parseInt(editingVehicle.year),
          license_plate: editingVehicle.license_plate,
          odometer_km: parseFloat(editingVehicle.odometer_km),
          status: editingVehicle.status
        })
      });
      showSuccess("Vehicle updated successfully!");
      setEditingVehicle(null);
      fetchVehicles();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleDeleteVehicle = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this vehicle? This will unassign it from any drivers.")) return;
    try {
      await apiFetch(`/vehicles/${id}`, { method: 'DELETE' });
      showSuccess("Vehicle deleted successfully!");
      fetchVehicles();
      loadData();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const fetchMaintenanceHistory = async (vehicleId: number) => {
    try {
      const data = await apiFetch(`/vehicles/${vehicleId}/maintenance`);
      setMaintenanceHistory(data);
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleLogMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showLogMaintenance) return;
    try {
      const payload: any = {
        service_type: newMaintenanceData.service_type,
        description: newMaintenanceData.description || null,
        cost: parseFloat(newMaintenanceData.cost || '0'),
        odometer_at_service: parseFloat(newMaintenanceData.odometer_at_service),
      };
      if (newMaintenanceData.next_service_due_odometer) {
        payload.next_service_due_odometer = parseFloat(newMaintenanceData.next_service_due_odometer);
      }

      await apiFetch(`/vehicles/${showLogMaintenance.id}/maintenance`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showSuccess("Maintenance logged successfully!");
      setShowLogMaintenance(null);
      setNewMaintenanceData({
        service_type: 'oil_change',
        description: '',
        cost: '0',
        odometer_at_service: '',
        next_service_due_odometer: ''
      });
      fetchVehicles();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleCompleteMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingMaintenanceLog) return;
    try {
      await apiFetch(`/vehicles/maintenance/${completingMaintenanceLog.id}/complete`, {
        method: 'PATCH',
        body: JSON.stringify({
          cost: parseFloat(completeMaintenanceData.cost || '0'),
          description: completeMaintenanceData.description || null,
          next_service_due_odometer: completeMaintenanceData.next_service_due_odometer ? parseFloat(completeMaintenanceData.next_service_due_odometer) : null
        })
      });
      showSuccess("Maintenance completed and vehicle returned to service!");
      setCompletingMaintenanceLog(null);
      setCompleteMaintenanceData({ cost: '0', description: '', next_service_due_odometer: '' });
      fetchVehicles();
      loadData();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const fetchUtilizationAnalytics = async () => {
    if (!currentUser) return;
    if (currentUser.role !== 'admin' && currentUser.role !== 'dispatcher') return;
    setUtilizationLoading(true);
    try {
      const data = await apiFetch(`/vehicles/utilization-analytics?period_days=${utilizationPeriod}`);
      setUtilizationAnalytics(data);
    } catch (err: any) {
      console.error("Failed to fetch utilization analytics:", err);
    } finally {
      setUtilizationLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'vehicles' && (currentUser?.role === 'admin' || currentUser?.role === 'dispatcher')) {
      fetchUtilizationAnalytics();
    }
  }, [activeTab, utilizationPeriod, currentUser]);

  const fetchDieselRates = async () => {
    try {
      const data = await apiFetch('/fuel/diesel-rate');
      setDieselRates(data);
    } catch (err: any) {
      console.error("Failed to fetch diesel rates:", err);
    }
  };

  const fetchFuelLogs = async () => {
    try {
      const logs = await apiFetch('/fuel/fuel-logs');
      setFuelLogs(logs);
      fetchDieselRates();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const fetchFuelAnalytics = async () => {
    try {
      const data = await apiFetch('/fuel/fleet-fuel-analytics');
      setFuelAnalytics(data);
    } catch (err: any) {
      showError(err.message);
    }
  };

  const VEHICLE_FUEL_RATES: { [key: string]: number } = {
    light_van: 7.0,
    cargo_truck: 12.0,
    semi_trailer: 32.0,
    electric_truck: 20.0,
  };

  const getDriverEfficiencyData = () => {
    const driverDataMap: { [key: number]: { logs: any[], driver: any } } = {};
    drivers.forEach(d => {
      driverDataMap[d.id] = { logs: [], driver: d };
    });
    
    fuelLogs.forEach(log => {
      if (driverDataMap[log.driver_id]) {
        driverDataMap[log.driver_id].logs.push(log);
      }
    });

    const efficiencyList: any[] = [];

    Object.keys(driverDataMap).forEach(key => {
      const driverId = parseInt(key);
      const { logs, driver } = driverDataMap[driverId];
      if (logs.length === 0) return;

      const sortedLogs = [...logs].sort((a, b) => a.odometer - b.odometer);
      
      let totalDistance = 0;
      let totalLiters = 0;
      
      for (let i = 0; i < sortedLogs.length; i++) {
        const currentLog = sortedLogs[i];
        let prevOdometer = 0;
        if (i === 0) {
          const expected = VEHICLE_FUEL_RATES[driver.vehicle_type || 'cargo_truck'] || 12.0;
          prevOdometer = Math.max(0, currentLog.odometer - (currentLog.liters_refueled / expected) * 100);
        } else {
          prevOdometer = sortedLogs[i - 1].odometer;
        }
        
        const dist = currentLog.odometer - prevOdometer;
        if (dist > 0) {
          totalDistance += dist;
          totalLiters += currentLog.liters_refueled;
        }
      }

      if (totalDistance > 0) {
        const actualRate = (totalLiters / totalDistance) * 100;
        const expectedRate = VEHICLE_FUEL_RATES[driver.vehicle_type || 'cargo_truck'] || 12.0;
        efficiencyList.push({
          driverName: driver.name,
          vehicleType: driver.vehicle_type || 'cargo_truck',
          actualRate: parseFloat(actualRate.toFixed(2)),
          expectedRate: parseFloat(expectedRate.toFixed(2)),
          totalLiters: totalLiters,
          totalDistance: totalDistance
        });
      }
    });

    return efficiencyList.slice(0, 5);
  };

  const getFuelSpendHistory = () => {
    const sorted = [...fuelLogs]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(-10);
    return sorted.map(log => ({
      date: new Date(log.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      cost: log.cost,
      liters: log.liters_refueled,
    }));
  };


  const handleLogFuelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await apiFetch('/fuel/fuel-logs', {
        method: 'POST',
        body: JSON.stringify({
          liters_refueled: parseFloat(fuelRefueled),
          cost: parseFloat(fuelCost),
          odometer: parseFloat(fuelOdometer),
          trip_id: parseInt(fuelTripId),
          is_personal_two_wheeler: isPersonalTwoWheeler,
        })
      });
      showSuccess(result.is_personal_two_wheeler 
        ? "Personal refuel logged successfully. This will be deducted from your next pay statement!" 
        : "Refueling log saved successfully!");
      setFuelRefueled('');
      setFuelCost('');
      setFuelOdometer('');
      setFuelTripId('');
      setIsPersonalTwoWheeler(false);

      if (myDriverProfile && !result.is_personal_two_wheeler) {
        setMyDriverProfile({
          ...myDriverProfile,
          odometer_km: result.odometer
        });
        if (myDriverProfile.vehicle_id) {
          const vData = await apiFetch(`/vehicles/${myDriverProfile.vehicle_id}`);
          setMyVehicle(vData);
        }
      }

      if (result.is_flagged_fraud) {
        showError(`Warning: Transaction flagged for audit: ${result.fraud_reason}`);
      }
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleStartEditFuelLog = (log: any) => {
    setEditingFuelLog({ ...log });
    if (log.trip_id && dieselRates && dieselRates.cities) {
      const trip = trips.find(t => t.id === log.trip_id);
      if (trip) {
        const foundCity = Object.keys(dieselRates.cities).find(city => 
          trip.source.toLowerCase().includes(city.toLowerCase()) || 
          trip.destination.toLowerCase().includes(city.toLowerCase())
        );
        if (foundCity) {
          setEditDieselCity(foundCity);
          return;
        }
      }
    }
    setEditDieselCity('Mumbai');
  };

  const handleUpdateFuelLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFuelLog) return;
    try {
      await apiFetch(`/fuel/fuel-logs/${editingFuelLog.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          liters_refueled: parseFloat(editingFuelLog.liters_refueled),
          cost: parseFloat(editingFuelLog.cost),
          odometer: parseFloat(editingFuelLog.odometer),
          is_flagged_fraud: editingFuelLog.is_flagged_fraud,
          fraud_reason: editingFuelLog.fraud_reason || null,
          trip_id: editingFuelLog.trip_id ? parseInt(editingFuelLog.trip_id) : null,
        }),
      });
      showSuccess("Fuel log updated successfully!");
      setEditingFuelLog(null);
      fetchFuelLogs();
      fetchFuelAnalytics();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleDispatcherLogFuelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await apiFetch('/fuel/fuel-logs', {
        method: 'POST',
        body: JSON.stringify({
          driver_id: parseInt(dispatcherFuelLogData.driver_id),
          liters_refueled: parseFloat(dispatcherFuelLogData.liters_refueled),
          cost: parseFloat(dispatcherFuelLogData.cost),
          odometer: parseFloat(dispatcherFuelLogData.odometer),
          trip_id: parseInt(dispatcherFuelLogData.trip_id),
          is_personal_two_wheeler: dispatcherPersonalTwoWheeler,
        })
      });
      showSuccess(result.is_personal_two_wheeler 
        ? "Personal refuel logged successfully. This will be deducted from the driver's payout." 
        : "Refueling log submitted successfully on behalf of driver!");
      setDispatcherFuelLogData({
        driver_id: '',
        liters_refueled: '',
        cost: '',
        odometer: '',
        trip_id: '',
      });
      setDispatcherPersonalTwoWheeler(false);
      fetchFuelLogs();
      fetchFuelAnalytics();

      if (result.is_flagged_fraud) {
        showError(`Warning: Transaction flagged for audit: ${result.fraud_reason}`);
      }
    } catch (err: any) {
      showError(err.message);
    }
  };

  // Real-time animation ticker for the live map
  useEffect(() => {
    if (activeTab !== 'map') return;
    const timer = setInterval(() => {
      setCurrentTimeSec(Date.now() / 1000);
    }, 200);
    return () => clearInterval(timer);
  }, [activeTab]);

  // Playback timer ticker
  useEffect(() => {
    if (!playbackTripId || !isPlaybackPlaying || playbackHistory.length === 0) return;

    const intervalMs = Math.max(50, 1000 / playbackSpeed);

    const timer = setInterval(() => {
      setPlaybackIndex(prev => {
        if (prev >= playbackHistory.length - 1) {
          setIsPlaybackPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [playbackTripId, isPlaybackPlaying, playbackHistory, playbackSpeed]);

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

    // Request browser notification permission once for arrival alerts
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const handleSuccess = async (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      try {
        const res = await apiFetch('/drivers/location', {
          method: 'POST',
          body: JSON.stringify({ latitude, longitude })
        });
        // Check for geofence arrival signal
        if (
          res.near_destination &&
          res.active_trip_id &&
          !confirmedArrivalTrips.current.has(res.active_trip_id)
        ) {
          // Mark so we only prompt once per trip arrival
          confirmedArrivalTrips.current.add(res.active_trip_id);
          setArrivalTripId(res.active_trip_id);
          setArrivalDestination(res.active_trip_destination || 'your destination');
          // Also fire an OS-level browser notification if permitted
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('You have arrived!', {
              body: `Did you complete the trip to ${res.active_trip_destination || 'your destination'}?`,
              icon: '/favicon.ico',
            });
          }
        }
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

    // Check if in Playback Mode
    if (playbackTripId && playbackHistory.length > 0) {
      const latlngs = playbackHistory.map(pt => [pt.latitude, pt.longitude]);

      const routePolyline = L.polyline(latlngs, {
        color: '#00f2fe',
        weight: 4,
        opacity: 0.8
      }).addTo(map);
      markersRef.current.push(routePolyline);

      const startPt = playbackHistory[0];
      const endPt = playbackHistory[playbackHistory.length - 1];

      const startMarker = L.circleMarker([startPt.latitude, startPt.longitude], {
        radius: 6,
        fillColor: '#10b981',
        color: '#fff',
        weight: 1.5,
        fillOpacity: 1
      }).bindTooltip("Start Location", { direction: 'top' }).addTo(map);
      markersRef.current.push(startMarker);

      const endMarker = L.circleMarker([endPt.latitude, endPt.longitude], {
        radius: 6,
        fillColor: '#ef4444',
        color: '#fff',
        weight: 1.5,
        fillOpacity: 1
      }).bindTooltip("Destination Location", { direction: 'top' }).addTo(map);
      markersRef.current.push(endMarker);

      const currentPt = playbackHistory[playbackIndex];
      if (currentPt) {
        const vehicleMarker = L.circleMarker([currentPt.latitude, currentPt.longitude], {
          radius: 9,
          fillColor: '#6366f1',
          color: '#fff',
          weight: 2,
          fillOpacity: 1
        }).bindTooltip(
          `Vehicle Playback #${playbackTripId} (${playbackIndex + 1}/${playbackHistory.length})`,
          { permanent: true, direction: 'right', className: 'map-tooltip' }
        ).addTo(map);
        markersRef.current.push(vehicleMarker);

        map.panTo([currentPt.latitude, currentPt.longitude]);
      }
      return;
    }

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
  }, [activeTab, trips, drivers, selectedMapTripId, currentTimeSec, playbackTripId, playbackHistory, playbackIndex]);

  // Filter toolbar states
  const [tripStatusFilter, setTripStatusFilter] = useState('');
  const [tripSearchFilter, setTripSearchFilter] = useState('');
  const [tripDateAfter, setTripDateAfter] = useState('');
  const [tripDateBefore, setTripDateBefore] = useState('');
  const [tripSourceCompanyFilter, setTripSourceCompanyFilter] = useState('');
  const [tripDestinationCompanyFilter, setTripDestinationCompanyFilter] = useState('');
  const [printingTrip, setPrintingTrip] = useState<any | null>(null);

  // Auto-login / fetch profiles on startup
  useEffect(() => {
    if (token) {
      loadUserProfile();
    }
  }, [token]);

  // Load everything when authenticated user changes or filters update
  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [
    currentUser,
    activeTab,
    tripStatusFilter,
    tripSearchFilter,
    tripDateAfter,
    tripDateBefore,
    tripSourceCompanyFilter,
    tripDestinationCompanyFilter
  ]);

  // Auto-refresh: reload data every 30 seconds when toggle is ON
  useEffect(() => {
    if (!autoRefresh || !currentUser) return;
    const interval = setInterval(() => {
      loadData();
      setLastRefreshed(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, currentUser]);

  // Establish WebSocket connection for real-time updates (dispatchers/admins only)
  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'dispatcher' && currentUser.role !== 'admin')) return;

    const token = localStorage.getItem('token');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}/ws/dispatch?token=${token}`;

    let socket: WebSocket;
    let reconnectTimeout: any;

    const connect = () => {
      console.log("Connecting to WebSocket updates...");
      socket = new WebSocket(wsUrl);

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'location_update') {
            // Update drivers list dynamically so Leaflet map moves instantly
            setDrivers(prevDrivers =>
              prevDrivers.map(d =>
                d.id === data.driver_id
                  ? {
                    ...d,
                    current_latitude: data.latitude,
                    current_longitude: data.longitude,
                    status: data.status,
                    last_location_update: new Date().toISOString()
                  }
                  : d
              )
            );
          } else if (data.type === 'trip_status_update') {
            // Update trips list dynamically
            setTrips(prevTrips =>
              prevTrips.map(t =>
                t.id === data.trip_id
                  ? { ...t, status: data.status, driver_id: data.driver_id }
                  : t
              )
            );
            // Reload all data (alerts, dashboard tiles, payouts) when a trip status changes
            loadData();
          }
        } catch (err) {
          console.error("WebSocket message processing error:", err);
        }
      };

      socket.onclose = () => {
        console.warn("WebSocket disconnected, reconnecting in 5 seconds...");
        reconnectTimeout = setTimeout(connect, 5000);
      };

      socket.onerror = (err) => {
        console.error("WebSocket error:", err);
        socket.close();
      };
    };

    connect();

    return () => {
      if (socket) socket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [currentUser]);

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
          if (profile.vehicle_id) {
            const vData = await apiFetch(`/vehicles/${profile.vehicle_id}`);
            setMyVehicle(vData);
          } else {
            setMyVehicle(null);
          }
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
          role: signUpRole,
          phone: signUpRole === 'driver' ? signUpPhone : undefined
        })
      });
      showSuccess("Account registered successfully! Please log in.");
      setLoginUsername(signUpUsername);
      setSignUpUsername('');
      setSignUpEmail('');
      setSignUpPassword('');
      setSignUpPhone('');
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

        // Fetch leaderboard
        const lb = await apiFetch('/drivers/leaderboard');
        setLeaderboard(lb);

        // Fetch scorecards for current month
        try {
          const sc = await apiFetch(`/drivers/scorecard?year=${new Date().getFullYear()}&month=${new Date().getMonth() + 1}`);
          setScorecards(sc);
        } catch (_) { /* no data yet */ }

        // Fetch vehicles
        const vehiclesList = await apiFetch('/vehicles/');
        setVehicles(vehiclesList);
      }

      if (currentUser.role === 'driver') {
        try {
          const profile = await apiFetch('/drivers/profile/me');
          setMyDriverProfile(profile);
          if (profile.vehicle_id) {
            const vData = await apiFetch(`/vehicles/${profile.vehicle_id}`);
            setMyVehicle(vData);
          } else {
            setMyVehicle(null);
          }
        } catch (e) {
          console.log("No driver profile linked to this user");
        }
      }

      // Fetch trips (drivers can only list their own on the backend automatically)
      let tripUrl = '/trips/?limit=100';
      if (tripStatusFilter) tripUrl += `&status=${tripStatusFilter}`;
      if (tripSearchFilter) tripUrl += `&q=${tripSearchFilter}`;
      if (tripDateAfter) tripUrl += `&created_after=${new Date(tripDateAfter).toISOString()}`;
      if (tripDateBefore) tripUrl += `&created_before=${new Date(tripDateBefore).toISOString()}`;
      if (tripSourceCompanyFilter) tripUrl += `&source_company=${encodeURIComponent(tripSourceCompanyFilter)}`;
      if (tripDestinationCompanyFilter) tripUrl += `&destination_company=${encodeURIComponent(tripDestinationCompanyFilter)}`;

      const tripsList = await apiFetch(tripUrl);
      setTrips(tripsList);

      // Fetch monthly payments
      if (currentUser.role === 'admin' || currentUser.role === 'dispatcher') {
        if (activeTab === 'payments') {
          let payUrl = '/drivers/payments?';
          if (paymentsFilterDriver) payUrl += `driver_id=${paymentsFilterDriver}&`;
          if (paymentsFilterYear) payUrl += `year=${paymentsFilterYear}&`;
          if (paymentsFilterMonth) payUrl += `month=${paymentsFilterMonth}&`;
          if (paymentsFilterStatus) payUrl += `status=${paymentsFilterStatus}&`;
          const paymentsData = await apiFetch(payUrl);
          setPayments(paymentsData);
        }
      } else if (currentUser.role === 'driver' && activeTab === 'payments') {
        let profileId = myDriverProfile?.id;
        if (!profileId) {
          try {
            const profile = await apiFetch('/drivers/profile/me');
            setMyDriverProfile(profile);
            profileId = profile.id;
          } catch (e) {
            console.log("No profile found");
          }
        }
        if (profileId) {
          const paymentsData = await apiFetch(`/drivers/${profileId}/payments`);
          setPayments(paymentsData);
        }
      }
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

  // Matchmaking recommendations fetch
  useEffect(() => {
    if (assigningTripId) {
      const fetchRecommendations = async () => {
        setLoadingRecs(true);
        try {
          const recs = await apiFetch(`/trips/${assigningTripId}/match-recommendations`);
          setRecommendations(recs);
        } catch (err: any) {
          showError(err.message);
        } finally {
          setLoadingRecs(false);
        }
      };
      fetchRecommendations();
    } else {
      setRecommendations([]);
    }
  }, [assigningTripId]);

  const handleSmartMatch = async () => {
    if (!assigningTripId) return;
    try {
      const res = await apiFetch(`/trips/${assigningTripId}/smart-match`, {
        method: 'POST'
      });
      showSuccess(res.message);
      setAssigningTripId(null);
      loadData();
    } catch (err: any) {
      showError(err.message);
    }
  };

  // Business Action: Assign Driver (manual)
  const handleManualAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignDriverId || !assigningTripId) return;
    try {
      const payload: any = { driver_id: parseInt(assignDriverId) };
      if (assignVehicleId) {
        payload.vehicle_id = parseInt(assignVehicleId);
      }
      await apiFetch(`/trips/${assigningTripId}/assign`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      showSuccess("Driver assigned successfully!");
      setAssigningTripId(null);
      setAssignDriverId('');
      setAssignVehicleId('');
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
      if (newTripData.duration_minutes) payload.duration_minutes = Math.round(parseFloat(newTripData.duration_minutes) * 60);
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
      const payload: any = { note: transitionNote || undefined };
      if (transitioningTrip.action === 'complete' && transitionOdometer) {
        payload.odometer = parseFloat(transitionOdometer);
      }
      const res = await apiFetch(`/trips/${transitioningTrip.id}/${transitioningTrip.action}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      if (res && res.warning) {
        showSuccess(`Trip completed successfully!\n ${res.warning}`);
      } else {
        showSuccess(`Trip ${transitioningTrip.action === 'start' ? 'started' : 'completed'} successfully!`);
      }
      setTransitioningTrip(null);
      setTransitionNote('');
      setTransitionOdometer('');
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

  const handlePlaybackRoute = async (tripId: number) => {
    try {
      const history = await apiFetch(`/trips/${tripId}/location-history`);
      if (!history || history.length === 0) {
        showError("No location coordinates recorded for this trip yet.");
        return;
      }
      setPlaybackTripId(tripId);
      setPlaybackHistory(history);
      setPlaybackIndex(0);
      setIsPlaybackPlaying(false);
      setPlaybackSpeed(1);
      setSelectedMapTripId(tripId);
      setActiveTab('map');
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
          note: driverStatusNote || undefined,
          base_salary: parseFloat(editDriverBaseSalary || '0'),
          commission_percentage: parseFloat(editDriverCommissionPercentage || '100'),
          vehicle_id: editDriverVehicleId ? parseInt(editDriverVehicleId) : null
        })
      });
      showSuccess("Driver profile updated successfully!");
      setEditingDriverStatus(null);
      setDriverStatusNote('');
      setEditDriverName('');
      setEditDriverPhone('');
      setEditDriverLicense('');
      setEditDriverExpiry('');
      setEditDriverBaseSalary('0');
      setEditDriverCommissionPercentage('100');
      setEditDriverVehicleId('');
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

  // Business Action: Copy Trip Summary to Clipboard
  const handleCopyTripSummary = (trip: any) => {
    const durationHrs = trip.duration_hours !== undefined && trip.duration_hours !== null ? trip.duration_hours : (trip.duration_minutes ? (trip.duration_minutes / 60).toFixed(1) : 'N/A');
    const driverText = trip.driver_name ? `Driver: ${trip.driver_name}` : 'Driver: Unassigned';
    const fareText = trip.estimated_fare !== null && trip.estimated_fare !== undefined ? `Estimated Fare: ₹${trip.estimated_fare}` : 'Estimated Fare: N/A';
    const summary = `📋 Dispatch #${trip.id}: ${trip.source} ➔ ${trip.destination}\n• Status: ${trip.status.toUpperCase()}\n• ${driverText}\n• ${fareText}\n• Distance: ${trip.distance_km || 'N/A'} km | Duration: ${durationHrs} hours`;
    navigator.clipboard.writeText(summary);
    showSuccess(`Trip #${trip.id} summary copied to clipboard!`);
  };

  // Business Action: Print Trip Manifest Detail Sheet
  const handlePrintSingleTrip = (trip: any) => {
    setPrintingTrip(trip);
    setTimeout(() => {
      window.print();
      setPrintingTrip(null);
    }, 150);
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
        license_expiry: newDriverData.license_expiry ? new Date(newDriverData.license_expiry).toISOString() : undefined,
        base_salary: parseFloat(newDriverData.base_salary || '0'),
        commission_percentage: parseFloat(newDriverData.commission_percentage || '100'),
        vehicle_id: newDriverData.vehicle_id ? parseInt(newDriverData.vehicle_id) : null
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
        email: '',
        base_salary: '0',
        commission_percentage: '100',
        vehicle_id: ''
      });
      loadData();
    } catch (e: any) {
      showError(e.message);
    }
  };

  // Business Action: Generate monthly payment record
  const handleGeneratePayout = async (driverId: number, year: number, month: number) => {
    setGeneratingPayout(true);
    try {
      await apiFetch(`/drivers/${driverId}/payments/generate?year=${year}&month=${month}`, {
        method: 'POST'
      });
      showSuccess("Monthly payment record generated successfully!");
      loadData();
    } catch (e: any) {
      showError(e.message);
    } finally {
      setGeneratingPayout(false);
    }
  };

  // Business Action: Settle/Pay driver payment
  const handleSubmitPayoutSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPayModal) return;
    try {
      await apiFetch(`/drivers/payments/${showPayModal.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'paid',
          bonus: parseFloat(payoutBonus || '0'),
          deductions: parseFloat(payoutDeductions || '0'),
          payment_method: payoutMethod,
          note: payoutNote || undefined
        })
      });
      showSuccess("Payment processed successfully!");
      setShowPayModal(null);
      setPayoutBonus('0');
      setPayoutDeductions('0');
      setPayoutNote('');
      loadData();
    } catch (e: any) {
      showError(e.message);
    }
  };

  // Business Action: Delete payment record
  const handleDeletePayment = async (paymentId: number) => {
    if (!window.confirm("Are you sure you want to delete this payment record?")) return;
    try {
      await apiFetch(`/drivers/payments/${paymentId}`, {
        method: 'DELETE'
      });
      showSuccess("Payment record deleted successfully!");
      loadData();
    } catch (e: any) {
      showError(e.message);
    }
  };

  // Export trip manifest history to CSV (Excel compatible)
  const handleExportTripsCSV = async () => {
    try {
      let exportUrl = '/trips/export?';
      if (tripStatusFilter) exportUrl += `status=${tripStatusFilter}&`;
      if (tripSearchFilter) exportUrl += `q=${tripSearchFilter}&`;
      if (tripDateAfter) exportUrl += `created_after=${new Date(tripDateAfter).toISOString()}&`;
      if (tripDateBefore) exportUrl += `created_before=${new Date(tripDateBefore).toISOString()}&`;
      if (tripSourceCompanyFilter) exportUrl += `source_company=${encodeURIComponent(tripSourceCompanyFilter)}&`;
      if (tripDestinationCompanyFilter) exportUrl += `destination_company=${encodeURIComponent(tripDestinationCompanyFilter)}&`;

      const token = localStorage.getItem('token');
      const response = await fetch(exportUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error("Failed to export trips CSV");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trips_manifest_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      showError(err.message);
    }
  };

  // Export trip manifest history to PDF
  const handleExportTripsPDF = async () => {
    try {
      let exportUrl = '/trips/export-pdf?';
      if (tripStatusFilter) exportUrl += `status=${tripStatusFilter}&`;
      if (tripSearchFilter) exportUrl += `q=${tripSearchFilter}&`;
      if (tripDateAfter) exportUrl += `created_after=${new Date(tripDateAfter).toISOString()}&`;
      if (tripDateBefore) exportUrl += `created_before=${new Date(tripDateBefore).toISOString()}&`;
      if (tripSourceCompanyFilter) exportUrl += `source_company=${encodeURIComponent(tripSourceCompanyFilter)}&`;
      if (tripDestinationCompanyFilter) exportUrl += `destination_company=${encodeURIComponent(tripDestinationCompanyFilter)}&`;

      const token = localStorage.getItem('token');
      const response = await fetch(exportUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error("Failed to export trips PDF");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trips_manifest_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      showError(err.message);
    }
  };

  // Export monthly payment records to CSV
  const handleExportCSV = async () => {
    try {
      let exportUrl = '/drivers/payments/export?';
      if (paymentsFilterDriver) exportUrl += `driver_id=${paymentsFilterDriver}&`;
      if (paymentsFilterYear) exportUrl += `year=${paymentsFilterYear}&`;
      if (paymentsFilterMonth) exportUrl += `month=${paymentsFilterMonth}&`;
      if (paymentsFilterStatus) exportUrl += `status=${paymentsFilterStatus}&`;

      const token = localStorage.getItem('token');
      const response = await fetch(exportUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error("Failed to export CSV report");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payments_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      showError(err.message);
    }
  };

  // Download a single payment receipt statement as PDF
  const handleDownloadInvoice = async (paymentId: number) => {
    try {
      const invoiceUrl = `/drivers/payments/${paymentId}/invoice`;
      const token = localStorage.getItem('token');
      const response = await fetch(invoiceUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error("Failed to download PDF invoice");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `paystub_statement_${paymentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      showError(err.message);
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

            {signUpRole === 'driver' && (
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">Phone Number *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={signUpPhone}
                  onChange={e => setSignUpPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                />
              </div>
            )}

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
  const durationVal = Math.round((parseFloat(newTripData.duration_minutes) || 0) * 60);
  const recommendedFare = (distanceVal > 0 || durationVal > 0)
    ? Math.round((40.0 + distanceVal * 12.0 + durationVal * 1.5) * 100) / 100
    : 0;

  const isDispatcher = currentUser.role === 'admin' || currentUser.role === 'dispatcher';
  const isDriver = currentUser.role === 'driver';

  return (
    <>
      <div className="app-container no-print">
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
                <li>
                  <div
                    className={`nav-item ${activeTab === 'vehicles' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab('vehicles');
                      fetchVehicles();
                    }}
                  >
                    <Truck size={18} />
                    Vehicles
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

            {isDispatcher && (
              <>
                <li>
                  <div
                    className={`nav-item ${activeTab === 'performance' ? 'active' : ''}`}
                    onClick={() => setActiveTab('performance')}
                  >
                    <BarChart2 size={18} />
                    Performance
                  </div>
                </li>
                <li>
                  <div
                    className={`nav-item ${activeTab === 'fuel' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab('fuel');
                      fetchFuelLogs();
                      fetchFuelAnalytics();
                    }}
                  >
                    <Fuel size={18} />
                    Fuel & ESG
                  </div>
                </li>
                <li>
                  <div
                    className={`nav-item ${activeTab === 'reconciliation' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab('reconciliation');
                      loadData();
                    }}
                  >
                    <Shield size={18} />
                    Financial Audits
                  </div>
                </li>

              </>
            )}

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
            <li>
              <div
                className={`nav-item ${activeTab === 'payments' ? 'active' : ''}`}
                onClick={() => setActiveTab('payments')}
              >
                <TrendingUp size={18} />
                Payments
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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

              {/* Manual refresh button */}
              <button
                onClick={() => { loadData(); setLastRefreshed(new Date()); }}
                className="btn btn-secondary btn-sm"
                title="Refresh data now"
                style={{ padding: '6px 10px', gap: '5px' }}
              >
                <RefreshCw size={13} />
                Refresh
              </button>

              {/* Auto-refresh toggle */}
              <button
                onClick={() => { setAutoRefresh(v => !v); if (!autoRefresh) setLastRefreshed(new Date()); }}
                className="btn btn-sm"
                title={autoRefresh ? 'Auto-refresh is ON (every 30s) — click to disable' : 'Enable auto-refresh (every 30s)'}
                style={{
                  padding: '6px 10px',
                  gap: '5px',
                  backgroundColor: autoRefresh ? 'rgba(69,242,72,0.12)' : 'var(--surface-2)',
                  border: autoRefresh ? '1px solid rgba(69,242,72,0.35)' : '1px solid var(--border)',
                  color: autoRefresh ? 'var(--accent-green)' : 'var(--text-secondary)',
                  fontWeight: autoRefresh ? 600 : 400,
                  transition: 'all 0.2s',
                }}
              >
                <span style={{
                  display: 'inline-block',
                  width: '7px', height: '7px',
                  borderRadius: '50%',
                  backgroundColor: autoRefresh ? 'var(--accent-green)' : 'var(--text-secondary)',
                  boxShadow: autoRefresh ? '0 0 6px var(--accent-green)' : 'none',
                  animation: autoRefresh ? 'pulse 1.5s infinite' : 'none',
                }} />
                {autoRefresh ? 'Live · 30s' : 'Auto-refresh'}
              </button>

              {lastRefreshed && (
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Updated {lastRefreshed.toLocaleTimeString()}
                </span>
              )}

              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Role: <strong style={{ color: '#fff', textTransform: 'uppercase' }}>{currentUser.role}</strong>
              </span>
            </div>
          </div>

          {/* View Layout Container */}
          <div className="workspace-area">

            {/* TAB 1: DASHBOARD (ADMIN & DISPATCHER ONLY) */}
            {activeTab === 'dashboard' && isDispatcher && (() => {
              const expiredLicensesCount = drivers.filter(driver => driver.license_expiry && new Date(driver.license_expiry) < new Date()).length;
              return (
                <div>
                  {/* Expired License Warning Alert Banner */}
                  {expiredLicensesCount > 0 && (
                    <div className="alert alert-warning" style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: 'var(--accent-red)',
                      padding: '12px 20px',
                      borderRadius: '8px',
                      marginBottom: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <AlertTriangle size={16} />
                      <span style={{ fontSize: '13px', fontWeight: 500 }}>
                        Fleet Alert: {expiredLicensesCount} driver{expiredLicensesCount > 1 ? 's have' : ' has'} an expired license! Please update their profile to enable dispatches.
                      </span>
                      <button onClick={() => setActiveTab('drivers')} className="btn btn-secondary" style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: '11px', color: 'var(--accent-red)', borderColor: 'rgba(239, 68, 68, 0.2)', backgroundColor: 'transparent' }}>
                        Manage Drivers
                      </button>
                    </div>
                  )}

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
                                    <div style={{ fontSize: '12px' }}>{trip.distance_km || 'N/A'} km | {trip.duration_hours !== undefined && trip.duration_hours !== null ? `${trip.duration_hours} hrs` : (trip.duration_minutes ? `${(trip.duration_minutes / 60).toFixed(1)} hrs` : 'N/A')}</div>
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
              );
            })()}

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
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span className={`badge badge-${driver.status}`} style={{ width: 'fit-content' }}>
                                  {driver.status.replace('_', ' ')}
                                </span>
                                {driver.active_hours_last_24h !== undefined && driver.active_hours_last_24h > 0 && (
                                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                    Active 24h: {driver.active_hours_last_24h.toFixed(1)} hrs
                                    {driver.active_hours_last_24h > 8.0 && (
                                      <span className="expiry-indicator expiry-red" style={{ marginLeft: '6px', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                        <AlertTriangle size={10} /> Fatigue Lockout
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
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
                                  setEditDriverBaseSalary(driver.base_salary !== undefined ? driver.base_salary.toString() : '0');
                                  setEditDriverCommissionPercentage(driver.commission_percentage !== undefined ? driver.commission_percentage.toString() : '100');
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

            {/* TAB: VEHICLES (ADMIN & DISPATCHER ONLY) */}
            {activeTab === 'vehicles' && isDispatcher && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                {/* Metrics Header Grid */}
                <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                    <div style={{ fontSize: '20px' }}>🚚</div>
                    <div className="metric-label">Total Fleet Vehicles</div>
                    <div className="metric-value" style={{ color: 'var(--accent-cyan)', fontSize: '22px' }}>
                      {vehicles.length}
                    </div>
                  </div>

                  <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                    <div style={{ fontSize: '20px' }}>🟢</div>
                    <div className="metric-label">Active / Available</div>
                    <div className="metric-value" style={{ color: 'var(--accent-green)', fontSize: '22px' }}>
                      {vehicles.filter(v => v.status === 'active').length}
                    </div>
                  </div>

                  <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                    <div style={{ fontSize: '20px' }}>🛠️</div>
                    <div className="metric-label">In Maintenance</div>
                    <div className="metric-value" style={{ color: 'var(--accent-amber)', fontSize: '22px' }}>
                      {vehicles.filter(v => v.status === 'maintenance').length}
                    </div>
                  </div>

                  <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px', border: vehicles.some(v => v.is_service_overdue) ? '1px solid var(--accent-red)' : vehicles.some(v => v.next_service_due_odometer && (v.next_service_due_odometer - v.odometer_km <= 500)) ? '1px solid var(--status-amber)' : '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '20px' }}>⚠️</div>
                    <div className="metric-label">Service Overdue / Soon</div>
                    <div className="metric-value" style={{ display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '22px' }}>
                      <span style={{ color: vehicles.some(v => v.is_service_overdue) ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
                        {vehicles.filter(v => v.is_service_overdue).length}
                      </span>
                      {vehicles.some(v => v.next_service_due_odometer && (v.next_service_due_odometer - v.odometer_km <= 500) && !v.is_service_overdue) && (
                        <span style={{ fontSize: '12px', color: 'var(--status-amber)' }}>
                          (+{vehicles.filter(v => v.next_service_due_odometer && (v.next_service_due_odometer - v.odometer_km <= 500) && !v.is_service_overdue).length} soon)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Vehicles Navigation Sub-Tabs */}
                <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '8px' }}>
                  <button
                    onClick={() => setVehiclesSubTab('registry')}
                    className={`btn ${vehiclesSubTab === 'registry' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '13px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    🚚 Vehicle Registry Directory
                  </button>
                  <button
                    onClick={() => setVehiclesSubTab('utilization')}
                    className={`btn ${vehiclesSubTab === 'utilization' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '13px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    📊 Fleet Downtime & Utilization Dashboard
                  </button>
                </div>

                {vehiclesSubTab === 'registry' && (
                  <div className="content-panel">
                  <div className="panel-header">
                    <h2 className="panel-title">
                      <Truck size={20} color="var(--accent-cyan)" />
                      Fleet Vehicles Registry
                    </h2>
                    <button onClick={() => setShowAddVehicle(true)} className="btn btn-primary btn-sm">
                      <Plus size={16} />
                      Add Vehicle
                    </button>
                  </div>

                  <div className="table-container">
                    <table className="dashboard-table">
                      <thead>
                        <tr>
                          <th>Vehicle Details</th>
                          <th>License Plate</th>
                          <th>Odometer Reading</th>
                          <th>Status</th>
                          <th>Assigned Driver</th>
                          <th>Service Alert</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vehicles.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                              No vehicles found in registry. Click "Add Vehicle" to register one.
                            </td>
                          </tr>
                        ) : (
                          vehicles.map(v => (
                            <tr key={v.id}>
                              <td>
                                <div style={{ fontWeight: 600, color: '#fff' }}>{v.make} {v.model}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ID: {v.id} | Year: {v.year}</div>
                              </td>
                              <td>
                                <code style={{ fontSize: '13px', color: 'var(--accent-cyan)', backgroundColor: 'rgba(0,242,254,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                                  {v.license_plate}
                                </code>
                              </td>
                              <td>{v.odometer_km?.toLocaleString()} km</td>
                              <td>
                                <span className={`badge badge-${v.status === 'active' ? 'available' : v.status === 'maintenance' ? 'assigned' : 'inactive'}`}>
                                  {v.status}
                                </span>
                              </td>
                              <td>
                                {v.assigned_driver_name ? (
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <strong style={{ color: '#fff' }}>{v.assigned_driver_name}</strong>
                                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>ID: {v.assigned_driver_id}</span>
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Unassigned</span>
                                )}
                              </td>
                              <td>
                                {v.is_service_overdue ? (
                                  <span className="expiry-indicator expiry-red" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <AlertTriangle size={12} />
                                    Service Overdue (Due: {v.next_service_due_odometer?.toLocaleString()} km)
                                  </span>
                                ) : v.next_service_due_odometer && (v.next_service_due_odometer - v.odometer_km <= 500) ? (
                                  <span className="expiry-indicator expiry-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <AlertTriangle size={12} />
                                    Warning: Service Due Soon ({Math.round(v.next_service_due_odometer - v.odometer_km)} km left)
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--accent-green)', fontSize: '12px', fontWeight: 500 }}>
                                    ✓ Clear (Next due: {v.next_service_due_odometer?.toLocaleString()} km)
                                  </span>
                                )}
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    onClick={() => {
                                      setNewMaintenanceData({
                                        service_type: 'oil_change',
                                        description: '',
                                        cost: '0',
                                        odometer_at_service: v.odometer_km.toString(),
                                        next_service_due_odometer: (v.odometer_km + 5000).toString()
                                      });
                                      setShowLogMaintenance(v);
                                    }}
                                    className="btn btn-secondary btn-sm"
                                    title="Log Maintenance"
                                  >
                                    🛠️ Service
                                  </button>
                                  <button
                                    onClick={() => {
                                      setViewingMaintenanceLogs(v);
                                      fetchMaintenanceHistory(v.id);
                                    }}
                                    className="btn btn-secondary btn-sm"
                                    title="View Service History"
                                  >
                                    📋 History
                                  </button>
                                  {v.status === 'maintenance' && (
                                    <button
                                      onClick={async () => {
                                        try {
                                          const logs = await apiFetch(`/vehicles/${v.id}/maintenance`);
                                          const openLog = logs.find((l: any) => l.completed_at === null);
                                          if (openLog) {
                                            setCompleteMaintenanceData({
                                              cost: openLog.cost ? openLog.cost.toString() : '0',
                                              description: openLog.description || '',
                                              next_service_due_odometer: (v.odometer_km + 5000).toString()
                                            });
                                            setCompletingMaintenanceLog(openLog);
                                          } else {
                                            showError("No open maintenance logs found for this vehicle!");
                                          }
                                        } catch (err: any) {
                                          showError(err.message);
                                        }
                                      }}
                                      className="btn btn-primary btn-sm"
                                      style={{ backgroundColor: 'var(--accent-green)', color: '#000', border: 'none', fontWeight: 600 }}
                                      title="Complete Workshop Service"
                                    >
                                      ✓ Complete
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setEditingVehicle(v)}
                                    className="btn btn-secondary btn-icon-only"
                                    title="Edit Vehicle"
                                  >
                                    <Edit size={13} />
                                  </button>
                                  {currentUser.role === 'admin' && (
                                    <button
                                      onClick={() => handleDeleteVehicle(v.id)}
                                      className="btn btn-secondary btn-icon-only"
                                      style={{ color: 'var(--accent-red)' }}
                                      title="Delete Vehicle"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                )}

                {vehiclesSubTab === 'utilization' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Period Selector and Filter Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', padding: '16px 20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '15px', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={16} color="var(--accent-cyan)" /> Asset Operational Hours & Downtime Metrics
                        </h3>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Calculated in real-time across active trips and service logs</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>Select Audit Window:</span>
                        <div className="btn-group" style={{ display: 'flex', gap: '4px' }}>
                          {[7, 30, 90].map(days => (
                            <button
                              key={days}
                              type="button"
                              onClick={() => setUtilizationPeriod(days)}
                              className={`btn btn-sm ${utilizationPeriod === days ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ padding: '4px 10px', fontSize: '12px' }}
                            >
                              {days} Days
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Summary cards specifically for selected period */}
                    {(() => {
                      const totalVehiclesVal = utilizationAnalytics.length;
                      const avgUtilRate = totalVehiclesVal > 0 
                        ? Math.round(utilizationAnalytics.reduce((acc, curr) => acc + curr.utilization_rate, 0) / totalVehiclesVal)
                        : 0;
                      const totalMileage = utilizationAnalytics.reduce((acc, curr) => acc + curr.mileage_accumulated, 0);
                      const totalDowntime = utilizationAnalytics.reduce((acc, curr) => acc + curr.downtime_hours, 0);

                      return (
                        <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                          <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px', backgroundColor: 'rgba(0, 242, 254, 0.02)' }}>
                            <div className="metric-label">Average Fleet Utilization</div>
                            <div className="metric-value" style={{ color: 'var(--accent-cyan)', fontSize: '24px' }}>{avgUtilRate}%</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Target threshold: &gt; 40%</div>
                          </div>
                          <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                            <div className="metric-label">Distance Accumulated (Period)</div>
                            <div className="metric-value" style={{ color: 'var(--accent-green)', fontSize: '24px' }}>{totalMileage.toLocaleString()} km</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Fleet wear & tire degradation indicator</div>
                          </div>
                          <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                            <div className="metric-label">Workshop Downtime Hours</div>
                            <div className="metric-value" style={{ color: 'var(--accent-amber)', fontSize: '24px' }}>{totalDowntime.toFixed(1)} hrs</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Planned/unplanned vehicle repairs</div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Left/Right Split: Alarms and main detailed table */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '20px', alignItems: 'start' }}>
                      {/* Left: Wear & Idle warnings list */}
                      <div className="content-panel" style={{ padding: '16px', margin: 0, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                        <h4 style={{ margin: '0 0 16px 0', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                          ⚠️ Fleet Risk Assessment
                        </h4>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-red)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <AlertTriangle size={12} /> High-Wear Warnings
                            </div>
                            {utilizationAnalytics.filter(v => v.wear_alert_level === 'high').length === 0 ? (
                              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', padding: '6px 8px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                                ✓ No high wear concerns.
                              </div>
                            ) : (
                              utilizationAnalytics.filter(v => v.wear_alert_level === 'high').map(v => (
                                <div key={v.vehicle_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '6px', marginBottom: '6px' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#fff' }}>{v.make} ({v.license_plate})</span>
                                  <span style={{ fontSize: '10px', color: 'var(--accent-red)', fontWeight: 600 }}>{v.mileage_accumulated} km</span>
                                </div>
                              ))
                            )}
                          </div>

                          <div>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-amber)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <AlertTriangle size={12} /> Under-Utilized Assets
                            </div>
                            {utilizationAnalytics.filter(v => v.utilization_rate < 15).length === 0 ? (
                              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', padding: '6px 8px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                                ✓ All assets active.
                              </div>
                            ) : (
                              utilizationAnalytics.filter(v => v.utilization_rate < 15).map(v => (
                                <div key={v.vehicle_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', backgroundColor: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.15)', borderRadius: '6px', marginBottom: '6px' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#fff' }}>{v.make} ({v.license_plate})</span>
                                  <span style={{ fontSize: '10px', color: 'var(--accent-amber)', fontWeight: 600 }}>{v.utilization_rate}% Util</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Asset utilization table */}
                      <div className="content-panel" style={{ padding: '20px', margin: 0 }}>
                        <h4 style={{ margin: '0 0 16px 0', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                          Asset Breakdown List
                        </h4>
                        
                        <div className="table-container">
                          <table className="dashboard-table">
                            <thead>
                              <tr>
                                <th>Vehicle</th>
                                <th>Active Hours</th>
                                <th>Downtime Hours</th>
                                <th>Idle Hours</th>
                                <th>Hours Distribution</th>
                                <th>Util %</th>
                                <th>Wear Level</th>
                              </tr>
                            </thead>
                            <tbody>
                              {utilizationLoading ? (
                                <tr>
                                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                                    Recalculating fleet utilization...
                                  </td>
                                </tr>
                              ) : utilizationAnalytics.length === 0 ? (
                                <tr>
                                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                                    No assets found in dashboard.
                                  </td>
                                </tr>
                              ) : (
                                utilizationAnalytics.map(v => {
                                  const total = v.active_hours + v.downtime_hours + v.idle_hours;
                                  const activePct = total > 0 ? (v.active_hours / total) * 100 : 0;
                                  const downPct = total > 0 ? (v.downtime_hours / total) * 100 : 0;
                                  const idlePct = total > 0 ? (v.idle_hours / total) * 100 : 0;

                                  return (
                                    <tr key={v.vehicle_id}>
                                      <td>
                                        <div style={{ fontWeight: 600, color: '#fff' }}>{v.make} {v.model}</div>
                                        <code style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>{v.license_plate}</code>
                                      </td>
                                      <td>{v.active_hours.toFixed(1)}h</td>
                                      <td style={{ color: v.downtime_hours > 0 ? 'var(--accent-amber)' : 'var(--text-secondary)' }}>{v.downtime_hours.toFixed(1)}h</td>
                                      <td>{v.idle_hours.toFixed(1)}h</td>
                                      <td>
                                        {/* CSS Stacked Progress Bar */}
                                        <div style={{ display: 'flex', height: '8px', width: '120px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                                          <div style={{ width: `${activePct}%`, backgroundColor: 'var(--accent-cyan)' }} title={`Active: ${v.active_hours}h (${Math.round(activePct)}%)`} />
                                          <div style={{ width: `${downPct}%`, backgroundColor: 'var(--accent-amber)' }} title={`Downtime: ${v.downtime_hours}h (${Math.round(downPct)}%)`} />
                                          <div style={{ width: `${idlePct}%`, backgroundColor: 'rgba(255,255,255,0.1)' }} title={`Idle: ${v.idle_hours}h (${Math.round(idlePct)}%)`} />
                                        </div>
                                      </td>
                                      <td style={{ fontWeight: 600, color: v.utilization_rate >= 40 ? 'var(--accent-green)' : v.utilization_rate >= 20 ? 'var(--accent-cyan)' : 'var(--accent-amber)' }}>
                                        {v.utilization_rate}%
                                      </td>
                                      <td>
                                        <span className={`badge`} style={{
                                          backgroundColor: v.wear_alert_level === 'high' ? 'rgba(239,68,68,0.12)' : v.wear_alert_level === 'medium' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
                                          color: v.wear_alert_level === 'high' ? 'var(--accent-red)' : v.wear_alert_level === 'medium' ? 'var(--accent-amber)' : 'var(--accent-green)',
                                          fontSize: '11px',
                                          padding: '2px 8px',
                                          borderRadius: '4px'
                                        }}>
                                          {v.wear_alert_level}
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
                    </div>
                  </div>
                )}
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building size={14} color="var(--text-secondary)" />
                    <input
                      type="text"
                      placeholder="Source Company..."
                      className="form-input"
                      style={{ width: '150px', padding: '6px 12px', fontSize: '13px' }}
                      value={tripSourceCompanyFilter}
                      onChange={e => setTripSourceCompanyFilter(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building size={14} color="var(--text-secondary)" />
                    <input
                      type="text"
                      placeholder="Dest Company..."
                      className="form-input"
                      style={{ width: '150px', padding: '6px 12px', fontSize: '13px' }}
                      value={tripDestinationCompanyFilter}
                      onChange={e => setTripDestinationCompanyFilter(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                    <button onClick={loadData} className="btn btn-secondary btn-sm">
                      Apply Filters
                    </button>
                    <button onClick={handleExportTripsCSV} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Printer size={13} />
                      Export Excel/CSV
                    </button>
                    <button onClick={handleExportTripsPDF} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Download size={13} />
                      Export PDF
                    </button>
                    <button onClick={() => window.print()} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Printer size={13} />
                      Print Manifest
                    </button>
                  </div>
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
                              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                                ID: {trip.id} | <strong>From client:</strong> {trip.source_company || 'Standard'} | <strong>To client:</strong> {trip.destination_company || 'Standard'} | fare: ₹{trip.estimated_fare || 'N/A'}
                              </div>
                              {trip.pre_trip_inspection && (
                                <div style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  color: trip.pre_trip_inspection.is_safe ? 'var(--accent-green)' : 'var(--accent-red)',
                                  marginTop: '4px',
                                  fontWeight: 500,
                                  backgroundColor: trip.pre_trip_inspection.is_safe ? 'rgba(69,242,72,0.06)' : 'rgba(239,68,68,0.06)',
                                  border: `1px solid ${trip.pre_trip_inspection.is_safe ? 'rgba(69,242,72,0.15)' : 'rgba(239,68,68,0.15)'}`,
                                  padding: '2px 8px',
                                  borderRadius: '4px'
                                }}>
                                  <Shield size={11} />
                                  <span>Safety: {trip.pre_trip_inspection.is_safe ? 'PASS' : 'FAIL'}</span>
                                </div>
                              )}
                              {(() => {
                                if (!dieselRates || !dieselRates.cities) return null;
                                let srcPrice: number | null = null;
                                let destPrice: number | null = null;
                                for (const [city, price] of Object.entries(dieselRates.cities)) {
                                  if (trip.source.toLowerCase().includes(city.toLowerCase())) {
                                    srcPrice = price as number;
                                  }
                                  if (trip.destination.toLowerCase().includes(city.toLowerCase())) {
                                    destPrice = price as number;
                                  }
                                }
                                if (srcPrice && destPrice && srcPrice !== destPrice) {
                                  const diff = Math.abs(srcPrice - destPrice);
                                  const isSrcCheaper = srcPrice < destPrice;
                                  return (
                                    <div style={{ fontSize: '11px', color: 'var(--accent-green)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 500 }}>
                                      <span>💡</span>
                                      <span>Fuel advice: Refuel at {isSrcCheaper ? 'source' : 'destination'} (Save ₹{diff.toFixed(2)}/L)</span>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </td>
                            <td>
                              <div style={{ fontSize: '12px' }}>{trip.distance_km || 'N/A'} km | {trip.duration_hours !== undefined && trip.duration_hours !== null ? `${trip.duration_hours} hrs` : (trip.duration_minutes ? `${(trip.duration_minutes / 60).toFixed(1)} hrs` : 'N/A')}</div>
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
                                  {trip.vehicle_license_plate && (
                                    <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', marginTop: '4px', fontWeight: 500 }}>
                                      Vehicle: {trip.vehicle_license_plate}
                                    </div>
                                  )}
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

                                {trip.status === 'assigned' && trip.arrived_at_source_time && (
                                  <span className="expiry-indicator expiry-green" style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 6px' }}>
                                    ✓ Arrived at Source
                                  </span>
                                )}

                                {trip.delay_risk && (
                                  <span className="expiry-indicator expiry-red" style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 6px' }}>
                                    ⚠️ Delay Risk
                                  </span>
                                )}

                                {/* Interactive Driver Actions */}
                                {trip.status === 'assigned' && (isDispatcher || (isDriver && myDriverProfile?.id === trip.driver_id)) && (
                                  <>
                                    {!trip.pre_trip_inspection ? (
                                      <button onClick={() => setShowInspectionTripId(trip.id)} className="btn btn-sm" style={{ padding: '3px 8px', fontSize: '10px', backgroundColor: 'var(--accent-amber)', color: '#000', fontWeight: 600 }}>
                                        <Shield size={10} style={{ marginRight: '3px', display: 'inline' }} />
                                        Safety Check
                                      </button>
                                    ) : !trip.pre_trip_inspection.is_safe ? (
                                      <span className="expiry-indicator expiry-red" style={{ fontSize: '10px', padding: '2px 6px', fontWeight: 600 }}>
                                        ❌ Unsafe / Failed
                                      </span>
                                    ) : (
                                      <button onClick={() => setTransitioningTrip({ id: trip.id, action: 'start' })} className="btn btn-success btn-sm" style={{ padding: '3px 8px', fontSize: '10px' }}>
                                        <Play size={10} />
                                        Start Trip
                                      </button>
                                    )}
                                  </>
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
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => handleViewHistory(trip.id)} className="btn btn-secondary btn-sm" style={{ padding: '4px 8px', fontSize: '11px' }}>
                                  <Clipboard size={12} />
                                  Logs
                                </button>
                                <button onClick={() => handleCopyTripSummary(trip)} className="btn btn-secondary btn-sm" style={{ padding: '4px 8px', fontSize: '11px' }} title="Copy Dispatch Summary">
                                  <Copy size={12} />
                                  Copy
                                </button>
                                <button onClick={() => handlePrintSingleTrip(trip)} className="btn btn-secondary btn-sm" style={{ padding: '4px 8px', fontSize: '11px' }} title="Print Trip Manifest">
                                  <Printer size={12} />
                                  Print
                                </button>
                                {(trip.status === 'completed' || trip.status === 'started') && (
                                  <button onClick={() => handlePlaybackRoute(trip.id)} className="btn btn-secondary btn-sm" style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--accent-cyan)', border: '1px solid rgba(0, 242, 254, 0.2)' }} title="Playback Route History">
                                    <Play size={12} />
                                    Playback
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: PERFORMANCE (ADMIN & DISPATCHER ONLY) */}
            {activeTab === 'performance' && isDispatcher && (
              <div className="content-panel">
                <div className="panel-header">
                  <h2 className="panel-title">
                    <BarChart2 size={20} color="var(--accent-cyan)" />
                    Driver Performance Leaderboard
                  </h2>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Ranked by total earnings — all completed trips
                  </span>
                </div>

                {leaderboard.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                    <BarChart2 size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
                    <p>No completed trips yet. Performance data will appear once drivers complete dispatches.</p>
                  </div>
                ) : (
                  <>
                    {/* Performance Sub-Navigation Tabs */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border-dim)', paddingBottom: '12px' }}>
                      <button
                        onClick={() => setPerformanceSubTab('leaderboard')}
                        className={`btn ${performanceSubTab === 'leaderboard' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 16px' }}
                      >
                        🏆 Earnings Leaderboard
                      </button>
                      <button
                        onClick={() => setPerformanceSubTab('analytics')}
                        className={`btn ${performanceSubTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 16px' }}
                      >
                        📊 Performance Analytics
                      </button>
                      <button
                        onClick={async () => {
                          setPerformanceSubTab('scorecard');
                          setScorecardLoading(true);
                          try {
                            const sc = await apiFetch(`/drivers/scorecard?year=${scorecardYear}&month=${scorecardMonth}`);
                            setScorecards(sc);
                          } finally {
                            setScorecardLoading(false);
                          }
                        }}
                        className={`btn ${performanceSubTab === 'scorecard' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 16px' }}
                      >
                        🎯 KPI Scorecards
                      </button>
                    </div>

                    {performanceSubTab === 'leaderboard' && (
                      <>
                        {/* Top 3 Podium Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                          {leaderboard.slice(0, 3).map((driver, idx) => {
                            const medals = ['🥇', '🥈', '🥉'];
                            const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                            const glows = [
                              'rgba(255,215,0,0.15)',
                              'rgba(192,192,192,0.1)',
                              'rgba(205,127,50,0.1)',
                            ];
                            return (
                              <div key={driver.driver_id} style={{
                                background: `linear-gradient(145deg, var(--surface-1) 60%, ${glows[idx]})`,
                                border: `1px solid ${colors[idx]}33`,
                                borderRadius: '12px',
                                padding: '20px',
                                position: 'relative',
                                overflow: 'hidden',
                              }}>
                                {/* Rank glow bar */}
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, transparent, ${colors[idx]}, transparent)` }} />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                                  <span style={{ fontSize: '28px' }}>{medals[idx]}</span>
                                  <div>
                                    <div style={{ fontWeight: 700, color: '#fff', fontSize: '14px' }}>{driver.name}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{driver.phone}</div>
                                  </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px' }}>
                                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px' }}>TRIPS</div>
                                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-cyan)' }}>{driver.completed_trips}</div>
                                  </div>
                                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px' }}>
                                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px' }}>EARNINGS</div>
                                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-green)' }}>₹{driver.total_earnings.toFixed(0)}</div>
                                  </div>
                                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px', gridColumn: '1 / -1' }}>
                                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px' }}>AVG FARE / TRIP</div>
                                    <div style={{ fontSize: '15px', fontWeight: 600, color: colors[idx] }}>₹{driver.average_fare.toFixed(2)}</div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Full Rankings Table */}
                        {leaderboard.length > 3 && (
                          <>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <TrendingUp size={14} />
                              Full Standings
                            </div>
                            <div className="table-container">
                              <table className="dashboard-table">
                                <thead>
                                  <tr>
                                    <th>Rank</th>
                                    <th>Driver</th>
                                    <th>Trips Completed</th>
                                    <th>Total Earnings</th>
                                    <th>Avg Fare / Trip</th>
                                    <th>Earnings Bar</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {leaderboard.map((driver, idx) => {
                                    const maxEarnings = leaderboard[0]?.total_earnings || 1;
                                    const pct = Math.round((driver.total_earnings / maxEarnings) * 100);
                                    return (
                                      <tr key={driver.driver_id}>
                                        <td>
                                          <span style={{ fontWeight: 700, color: idx < 3 ? ['#FFD700', '#C0C0C0', '#CD7F32'][idx] : 'var(--text-secondary)', fontSize: '14px' }}>
                                            #{idx + 1}
                                          </span>
                                        </td>
                                        <td>
                                          <div style={{ fontWeight: 600, color: '#fff' }}>{driver.name}</div>
                                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{driver.phone}</div>
                                        </td>
                                        <td>
                                          <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{driver.completed_trips}</span>
                                        </td>
                                        <td>
                                          <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>₹{driver.total_earnings.toFixed(2)}</span>
                                        </td>
                                        <td>₹{driver.average_fare.toFixed(2)}</td>
                                        <td style={{ minWidth: '120px' }}>
                                          <div style={{ background: 'var(--surface-2)', borderRadius: '4px', overflow: 'hidden', height: '8px' }}>
                                            <div style={{
                                              height: '100%',
                                              width: `${pct}%`,
                                              background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-green))',
                                              borderRadius: '4px',
                                              transition: 'width 0.6s ease',
                                            }} />
                                          </div>
                                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '3px' }}>{pct}%</div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {performanceSubTab === 'analytics' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Charts Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>

                          {/* CHART 1: On-Time / Safety Compliance Rating */}
                          <div style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-dim)', borderRadius: '12px', padding: '20px' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              🛡️ Safety & Compliance Score
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                              {leaderboard.map(driver => {
                                const score = driver.on_time_rate || 100;
                                let barColor = 'var(--accent-green)';
                                if (score < 75) barColor = 'var(--accent-red)';
                                else if (score < 85) barColor = 'var(--accent-amber)';

                                return (
                                  <div key={driver.driver_id}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                                      <span style={{ fontWeight: 500, color: '#fff' }}>{driver.name}</span>
                                      <span style={{ fontWeight: 600, color: barColor }}>{score.toFixed(1)}% Score</span>
                                    </div>
                                    <div style={{ height: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${score}%`, backgroundColor: barColor, borderRadius: '4px', transition: 'width 0.6s ease' }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* CHART 2: Average Speed */}
                          <div style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-dim)', borderRadius: '12px', padding: '20px' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              ⚡ Average Transit Speed
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                              {leaderboard.map(driver => {
                                const speed = driver.average_speed_kmh || 0;
                                const speedPct = Math.min(100, (speed / 100) * 100);

                                return (
                                  <div key={driver.driver_id}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                                      <span style={{ fontWeight: 500, color: '#fff' }}>{driver.name}</span>
                                      <span style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{speed.toFixed(1)} km/h</span>
                                    </div>
                                    <div style={{ height: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${speedPct}%`, background: 'linear-gradient(90deg, var(--accent-cyan), #00f2fe)', borderRadius: '4px', transition: 'width 0.6s ease' }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* CHART 3: Workload */}
                          <div style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-dim)', borderRadius: '12px', padding: '20px' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              🛣️ Workload: Distance & Hours
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                              {leaderboard.map(driver => {
                                const distance = driver.total_distance_km || 0;
                                const hours = (driver.total_duration_minutes || 0) / 60;
                                const maxDist = Math.max(...leaderboard.map(d => d.total_distance_km || 1), 10);
                                const distPct = Math.min(100, (distance / maxDist) * 100);

                                return (
                                  <div key={driver.driver_id}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                                      <span style={{ fontWeight: 500, color: '#fff' }}>{driver.name}</span>
                                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                        <strong style={{ color: 'var(--accent-amber)' }}>{distance.toFixed(1)} km</strong> ({hours.toFixed(1)} hrs)
                                      </span>
                                    </div>
                                    <div style={{ height: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${distPct}%`, backgroundColor: 'var(--accent-amber)', borderRadius: '4px', transition: 'width 0.6s ease' }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {performanceSubTab === 'scorecard' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Period Selector */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--surface-1)', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--border-dim)' }}>
                          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>📅 Period:</span>
                          <select
                            value={scorecardYear}
                            onChange={e => setScorecardYear(Number(e.target.value))}
                            style={{ background: 'var(--surface-2)', color: '#fff', border: '1px solid var(--border-dim)', borderRadius: '6px', padding: '6px 10px', fontSize: '13px' }}
                          >
                            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                          </select>
                          <select
                            value={scorecardMonth}
                            onChange={e => setScorecardMonth(Number(e.target.value))}
                            style={{ background: 'var(--surface-2)', color: '#fff', border: '1px solid var(--border-dim)', borderRadius: '6px', padding: '6px 10px', fontSize: '13px' }}
                          >
                            {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                              <option key={i+1} value={i+1}>{m}</option>
                            ))}
                          </select>
                          <button
                            onClick={async () => {
                              setScorecardLoading(true);
                              try {
                                const sc = await apiFetch(`/drivers/scorecard?year=${scorecardYear}&month=${scorecardMonth}`);
                                setScorecards(sc);
                              } finally { setScorecardLoading(false); }
                            }}
                            className="btn btn-primary btn-sm"
                            style={{ padding: '6px 16px', fontSize: '13px' }}
                          >
                            {scorecardLoading ? 'Loading…' : '🔄 Load Scorecards'}
                          </button>
                          {scorecards.length > 0 && (
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                              {scorecards.length} driver{scorecards.length !== 1 ? 's' : ''} with activity this period
                            </span>
                          )}
                        </div>

                        {scorecardLoading ? (
                          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
                            <p>Computing scorecards…</p>
                          </div>
                        ) : scorecards.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
                            <p>No driver activity found for this period. Try a different month.</p>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {scorecards.map((sc: any, idx: number) => {
                              const scoreColor = sc.overall_score >= 90 ? '#22c55e' : sc.overall_score >= 75 ? 'var(--accent-cyan)' : sc.overall_score >= 60 ? 'var(--accent-amber)' : sc.overall_score >= 40 ? 'orange' : 'var(--accent-red)';
                              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                              return (
                                <div key={sc.driver_id} style={{
                                  background: 'var(--surface-1)',
                                  border: `1px solid ${idx < 3 ? scoreColor + '44' : 'var(--border-dim)'}`,
                                  borderRadius: '12px',
                                  overflow: 'hidden',
                                }}>
                                  {/* Header */}
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-dim)', background: idx < 3 ? `linear-gradient(90deg, ${scoreColor}11, transparent)` : undefined }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                      {medal && <span style={{ fontSize: '24px' }}>{medal}</span>}
                                      <div>
                                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '15px' }}>{sc.name}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{sc.phone} · ID {sc.driver_id}</div>
                                      </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                      <div style={{ fontSize: '28px', fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{sc.overall_score}</div>
                                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>OVERALL SCORE /100</div>
                                    </div>
                                  </div>

                                  {/* Score Bar */}
                                  <div style={{ height: '4px', background: 'var(--surface-2)' }}>
                                    <div style={{ height: '100%', width: `${sc.overall_score}%`, background: `linear-gradient(90deg, ${scoreColor}, ${scoreColor}88)`, transition: 'width 0.8s ease' }} />
                                  </div>

                                  {/* KPI Grid */}
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1px', background: 'var(--border-dim)' }}>
                                    {[
                                      { label: 'Completion Rate', value: `${sc.completion_rate}%`, color: sc.completion_rate >= 85 ? '#22c55e' : sc.completion_rate >= 70 ? 'var(--accent-amber)' : 'var(--accent-red)', icon: '✅' },
                                      { label: 'On-Time Pickup', value: `${sc.on_time_pickup_rate}%`, color: sc.on_time_pickup_rate >= 85 ? '#22c55e' : sc.on_time_pickup_rate >= 70 ? 'var(--accent-amber)' : 'var(--accent-red)', icon: '⏱️' },
                                      { label: 'Audit Pass Rate', value: `${sc.audit_pass_rate}%`, color: sc.audit_pass_rate >= 90 ? '#22c55e' : sc.audit_pass_rate >= 75 ? 'var(--accent-amber)' : 'var(--accent-red)', icon: '🔍' },
                                      { label: 'Fatigue Incidents', value: sc.fatigue_incidents, color: sc.fatigue_incidents === 0 ? '#22c55e' : sc.fatigue_incidents <= 2 ? 'var(--accent-amber)' : 'var(--accent-red)', icon: '😴' },
                                      { label: 'Trips Completed', value: sc.completed_trips, color: 'var(--accent-cyan)', icon: '🚗' },
                                      { label: 'Flagged Trips', value: sc.flagged_trips, color: sc.flagged_trips === 0 ? '#22c55e' : 'var(--accent-red)', icon: '🚩' },
                                      { label: 'Total Earnings', value: `₹${sc.total_earnings.toLocaleString('en-IN', {maximumFractionDigits: 0})}`, color: 'var(--accent-green)', icon: '💰' },
                                      { label: 'Distance Covered', value: `${sc.total_distance_km.toFixed(1)} km`, color: 'var(--accent-amber)', icon: '🛣️' },
                                    ].map(kpi => (
                                      <div key={kpi.label} style={{ background: 'var(--surface-1)', padding: '14px 16px' }}>
                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{kpi.icon} {kpi.label}</div>
                                        <div style={{ fontSize: '18px', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Incentive Recommendation */}
                                  <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: sc.bonus_recommendation > 0 ? 'rgba(34,197,94,0.08)' : sc.deduction_recommendation > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)' }}>
                                    <span style={{ fontSize: '13px', color: sc.bonus_recommendation > 0 ? '#22c55e' : sc.deduction_recommendation > 0 ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
                                      {sc.incentive_note}
                                    </span>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginLeft: '16px', flexShrink: 0 }}>
                                      {sc.bonus_recommendation > 0 && (
                                        <span style={{ fontWeight: 700, color: '#22c55e', fontSize: '14px' }}>+₹{sc.bonus_recommendation.toLocaleString('en-IN', {maximumFractionDigits: 0})}</span>
                                      )}
                                      {sc.deduction_recommendation > 0 && (
                                        <span style={{ fontWeight: 700, color: 'var(--accent-red)', fontSize: '14px' }}>−₹{sc.deduction_recommendation.toLocaleString('en-IN', {maximumFractionDigits: 0})}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Summary Stats Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginTop: '28px' }}>
                      {[
                        { label: 'Total Drivers Ranked', value: leaderboard.length, color: 'var(--accent-cyan)', icon: '👥' },
                        { label: 'Total Trips Completed', value: leaderboard.reduce((s: number, d: any) => s + d.completed_trips, 0), color: 'var(--accent-blue)', icon: '🚗' },
                        { label: 'Total Fleet Distance', value: `${leaderboard.reduce((s: number, d: any) => s + (d.total_distance_km || 0), 0).toFixed(1)} km`, color: 'var(--accent-amber)', icon: '🛣️' },
                        { label: 'Fleet Avg Speed', value: `${(leaderboard.length ? (leaderboard.reduce((s: number, d: any) => s + (d.average_speed_kmh || 0), 0) / leaderboard.length) : 0).toFixed(1)} km/h`, color: 'var(--accent-cyan)', icon: '⚡' },
                        { label: 'Fleet Safety Score', value: `${(leaderboard.length ? (leaderboard.reduce((s: number, d: any) => s + (d.on_time_rate || 100), 0) / leaderboard.length) : 100).toFixed(1)}%`, color: 'var(--accent-green)', icon: '🛡️' },
                        { label: 'Total Fleet Earnings', value: `₹${leaderboard.reduce((s: number, d: any) => s + d.total_earnings, 0).toFixed(0)}`, color: 'var(--accent-green)', icon: '💰' },
                      ].map(stat => (
                        <div key={stat.label} className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                          <div style={{ fontSize: '18px' }}>{stat.icon}</div>
                          <div className="metric-label">{stat.label}</div>
                          <div className="metric-value" style={{ color: stat.color, fontSize: '20px' }}>{stat.value}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
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
                            <div className="detail-row">
                              <span className="detail-label">Odometer Reading</span>
                              <span className="detail-val" style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                                {myDriverProfile.odometer_km ? `${myDriverProfile.odometer_km.toFixed(1)} km` : '0.0 km'}
                              </span>
                            </div>
                            {myVehicle ? (
                              <>
                                <div className="detail-row" style={{ borderTop: '1px dashed var(--border-dim)', paddingTop: '10px', marginTop: '10px' }}>
                                  <span className="detail-label">Assigned Vehicle</span>
                                  <span className="detail-val" style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                                    {myVehicle.make} {myVehicle.model}
                                  </span>
                                </div>
                                <div className="detail-row">
                                  <span className="detail-label">License Plate</span>
                                  <span className="detail-val"><code>{myVehicle.license_plate}</code></span>
                                </div>
                                <div className="detail-row">
                                  <span className="detail-label">Vehicle Odometer</span>
                                  <span className="detail-val">{myVehicle.odometer_km?.toLocaleString()} km</span>
                                </div>
                                <div className="detail-row">
                                  <span className="detail-label">Service Status</span>
                                  <span className="detail-val">
                                    {myVehicle.is_service_overdue ? (
                                      <span className="expiry-indicator expiry-red" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <AlertTriangle size={12} />
                                        Service Overdue (Due: {myVehicle.next_service_due_odometer?.toLocaleString()} km)
                                      </span>
                                    ) : myVehicle.next_service_due_odometer && (myVehicle.next_service_due_odometer - myVehicle.odometer_km <= 500) ? (
                                      <span className="expiry-indicator expiry-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <AlertTriangle size={12} />
                                        Warning: Service Due Soon ({Math.round(myVehicle.next_service_due_odometer - myVehicle.odometer_km)} km left)
                                      </span>
                                    ) : (
                                      <span style={{ color: 'var(--accent-green)', fontWeight: 500 }}>
                                        ✓ Clear (Next due: {myVehicle.next_service_due_odometer?.toLocaleString()} km)
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <div className="detail-row" style={{ borderTop: '1px dashed var(--border-dim)', paddingTop: '10px', marginTop: '10px' }}>
                                <span className="detail-label">Assigned Vehicle</span>
                                <span className="detail-val" style={{ color: 'var(--text-secondary)' }}>None Assigned</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                          No active driver profile is linked to this account yet. Please ask an admin to link your user ID.
                        </div>
                      )}
                    </div>

                    {myDriverProfile && (
                      <div className="content-panel">
                        <div className="panel-header">
                          <h2 className="panel-title" style={{ color: 'var(--accent-cyan)' }}>
                            <Fuel size={20} />
                            Log Fuel Station Receipt
                          </h2>
                        </div>
                        <form onSubmit={handleLogFuelSubmit}>
                          <div className="form-group">
                            <label className="form-label">Associated Trip ID *</label>
                            <input
                              type="number"
                              className="form-input"
                              value={fuelTripId}
                              onChange={e => {
                                const val = e.target.value;
                                setFuelTripId(val);
                                if (val) {
                                  const trip = trips.find(t => t.id === parseInt(val));
                                  if (trip) {
                                    if (trip.driver_id !== myDriverProfile.id) {
                                      showError(`Warning: Trip #${val} is assigned to a different driver (${trip.driver_name || `Driver #${trip.driver_id}`}).`);
                                    } else {
                                      setFuelOdometer(myDriverProfile.odometer_km ? myDriverProfile.odometer_km.toString() : '');
                                    }
                                    if (dieselRates && dieselRates.cities) {
                                      const foundCity = Object.keys(dieselRates.cities).find(city => 
                                        trip.source.toLowerCase().includes(city.toLowerCase()) || 
                                        trip.destination.toLowerCase().includes(city.toLowerCase())
                                      );
                                      if (foundCity) {
                                        setSelectedDieselCity(foundCity);
                                        if (fuelRefueled) {
                                          const cityRate = dieselRates.cities[foundCity] || dieselRates.national_average || 97.83;
                                          setFuelCost((parseFloat(fuelRefueled) * cityRate).toFixed(2));
                                        }
                                      }
                                    }
                                  }
                                }
                              }}
                              required
                              placeholder="e.g. 1"
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Fuel Refueled (Liters / kWh) *</label>
                            <input
                              type="number"
                              step="0.01"
                              className="form-input"
                              value={fuelRefueled}
                              onChange={e => {
                                const liters = e.target.value;
                                setFuelRefueled(liters);
                                if (liters && dieselRates) {
                                  const cityRate = selectedDieselCity === 'national_average'
                                    ? (dieselRates.national_average || 97.83)
                                    : (dieselRates.cities[selectedDieselCity] || dieselRates.national_average || 97.83);
                                  setFuelCost((parseFloat(liters) * cityRate).toFixed(2));
                                }
                              }}
                              required
                              placeholder="e.g. 45.50"
                            />
                          </div>
                          {dieselRates && (
                            <div className="form-group">
                              <label className="form-label">Diesel Pricing City (India)</label>
                              <select
                                className="form-select"
                                value={selectedDieselCity}
                                onChange={e => {
                                  const city = e.target.value;
                                  setSelectedDieselCity(city);
                                  if (fuelRefueled) {
                                    const cityRate = city === 'national_average'
                                      ? (dieselRates.national_average || 97.83)
                                      : (dieselRates.cities[city] || dieselRates.national_average || 97.83);
                                    setFuelCost((parseFloat(fuelRefueled) * cityRate).toFixed(2));
                                  }
                                }}
                              >
                                <option value="national_average">National Average (₹{dieselRates.national_average?.toFixed(2)})</option>
                                {Object.entries(dieselRates.cities).map(([name, price]: any) => (
                                  <option key={name} value={name}>{name} (₹{price.toFixed(2)})</option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div className="form-group">
                            <label className="form-label">Receipt Cost (₹) *</label>
                            <input
                              type="number"
                              step="0.01"
                              className="form-input"
                              value={fuelCost}
                              onChange={e => setFuelCost(e.target.value)}
                              required
                              placeholder="e.g. 4200.00"
                            />
                            {dieselRates && fuelRefueled && (
                              <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', marginTop: '4px', display: 'block' }}>
                                Calculated using {selectedDieselCity === 'national_average' ? 'National Average' : selectedDieselCity} rate: ₹{((selectedDieselCity === 'national_average' ? dieselRates.national_average : dieselRates.cities[selectedDieselCity]) || 97.83).toFixed(2)}/L
                              </span>
                            )}
                          </div>

                          <div className="form-group" style={{ marginBottom: '20px' }}>
                            <label className="form-label">Current Odometer (km)</label>
                            <input
                              type="number"
                              step="0.1"
                              className="form-input"
                              value={fuelOdometer}
                              onChange={e => setFuelOdometer(e.target.value)}
                              required
                              placeholder={`Must exceed ${myDriverProfile.odometer_km ? myDriverProfile.odometer_km.toFixed(1) : 0} km`}
                            />
                          </div>
                          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <input
                              type="checkbox"
                              id="is_personal_two_wheeler_driver"
                              checked={isPersonalTwoWheeler}
                              onChange={e => setIsPersonalTwoWheeler(e.target.checked)}
                            />
                            <label htmlFor="is_personal_two_wheeler_driver" className="form-label" style={{ margin: 0, cursor: 'pointer', fontSize: '13px' }}>
                              🏍️ Personal Two-Wheeler Refuel (Deduct from Salary)
                            </label>
                          </div>
                          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                            Submit Refueling Receipt
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB: FUEL & ESG COMPLIANCE (ADMIN & DISPATCHER ONLY) */}
            {activeTab === 'fuel' && isDispatcher && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                {/* Analytics Header Metrics */}
                <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                    <div style={{ fontSize: '20px' }}>⛽</div>
                    <div className="metric-label">Total Fuel Expenditure</div>
                    <div className="metric-value" style={{ color: 'var(--accent-green)', fontSize: '22px' }}>
                      ₹{fuelAnalytics ? fuelAnalytics.total_fuel_cost.toLocaleString() : '0.00'}
                    </div>
                  </div>

                  <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                    <div style={{ fontSize: '20px' }}>🧪</div>
                    <div className="metric-label">Total Fuel Refueled</div>
                    <div className="metric-value" style={{ color: 'var(--accent-cyan)', fontSize: '22px' }}>
                      {fuelAnalytics ? fuelAnalytics.total_liters.toFixed(1) : '0.0'} L
                    </div>
                  </div>

                  <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                    <div style={{ fontSize: '20px' }}>📊</div>
                    <div className="metric-label">Fuel Cost per Kilometer</div>
                    <div className="metric-value" style={{ color: 'var(--accent-blue)', fontSize: '22px' }}>
                      ₹{fuelAnalytics ? fuelAnalytics.avg_cost_per_km.toFixed(2) : '0.00'}/km
                    </div>
                  </div>

                  <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                    <div style={{ fontSize: '20px' }}>🌱</div>
                    <div className="metric-label">Fleet Carbon Footprint</div>
                    <div className="metric-value" style={{ color: 'var(--accent-green)', fontSize: '22px' }}>
                      {fuelAnalytics ? fuelAnalytics.total_carbon_emissions_kg.toFixed(1) : '0.0'} kg CO₂
                    </div>
                  </div>

                  <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px', border: fuelAnalytics?.active_fraud_alerts_count > 0 ? '1px solid var(--accent-red)' : '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '20px' }}>⚠️</div>
                    <div className="metric-label">Active Audit Fraud Alerts</div>
                    <div className="metric-value" style={{ color: fuelAnalytics?.active_fraud_alerts_count > 0 ? 'var(--accent-red)' : 'var(--text-secondary)', fontSize: '22px' }}>
                      {fuelAnalytics ? fuelAnalytics.active_fraud_alerts_count : '0'}
                    </div>
                  </div>
                </div>

                {/* Two-Column Grid: Environmental Impact & Dispatcher Fuel Receipt Logger */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                  
                  {/* ESG carbon footprint visual bar graph (CSS only) */}
                  <div className="content-panel" style={{ padding: '20px', margin: 0 }}>
                    <div className="panel-header" style={{ marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🌳 Environmental Impact & Decarbonization Index
                      </h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', alignItems: 'center' }}>
                      <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-dim)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>🌎</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Decarbonization Index</div>
                        <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent-green)', margin: '4px 0' }}>
                          {(() => {
                            const dieselEmissions = trips.filter(t => t.status === 'completed').reduce((sum, t) => {
                              return sum + (t.distance_km || 0) * 0.31;
                            }, 0);
                            const actualEmissions = fuelAnalytics?.total_carbon_emissions_kg || 0;
                            if (dieselEmissions === 0) return '100%';
                            const offsetPercent = Math.max(0, 100 - (actualEmissions / dieselEmissions) * 100);
                            return `${offsetPercent.toFixed(1)}% Offset`;
                          })()}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Savings compared to standard cargo truck fleet.</div>
                      </div>

                      <div>
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Standard Fleet Diesel Baseline</span>
                            <strong style={{ color: '#fff' }}>
                              {trips.filter(t => t.status === 'completed').reduce((sum, t) => sum + (t.distance_km || 0) * 0.31, 0).toFixed(1)} kg
                            </strong>
                          </div>
                          <div style={{ height: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: '100%', backgroundColor: '#a1a1aa' }} />
                          </div>
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Our Actual Fleet Emissions</span>
                            <strong style={{ color: 'var(--accent-green)' }}>
                              {fuelAnalytics ? fuelAnalytics.total_carbon_emissions_kg.toFixed(1) : '0.0'} kg
                            </strong>
                          </div>
                          <div style={{ height: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${Math.min(100, ((fuelAnalytics?.total_carbon_emissions_kg || 0) / (trips.filter(t => t.status === 'completed').reduce((sum, t) => sum + (t.distance_km || 0) * 0.31, 0) || 1)) * 100)}%`,
                              backgroundColor: 'var(--accent-green)'
                            }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Interstate Diesel Price Advisor Card */}
                  <div className="content-panel" style={{ padding: '20px', margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div className="panel-header" style={{ marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        💡 Interstate Diesel Price Advisor
                      </h3>
                    </div>
                    {dieselRates ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', justifyContent: 'space-between' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--accent-green)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                              🟢 Cheapest Cities
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {Object.entries(dieselRates.cities)
                                .sort((a: any, b: any) => a[1] - b[1])
                                .slice(0, 3)
                                .map(([city, price]: any) => (
                                  <div key={city} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>{city}</span>
                                    <strong style={{ color: '#fff' }}>₹{price.toFixed(2)}</strong>
                                  </div>
                                ))}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--accent-red)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                              🔴 Most Expensive
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {Object.entries(dieselRates.cities)
                                .sort((a: any, b: any) => b[1] - a[1])
                                .slice(0, 3)
                                .map(([city, price]: any) => (
                                  <div key={city} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>{city}</span>
                                    <strong style={{ color: '#fff' }}>₹{price.toFixed(2)}</strong>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>

                        {(() => {
                          const sortedCities: any = Object.entries(dieselRates.cities).sort((a: any, b: any) => a[1] - b[1]);
                          if (sortedCities.length < 2) return null;
                          const cheapest = sortedCities[0];
                          const dearest = sortedCities[sortedCities.length - 1];
                          const diff = dearest[1] - cheapest[1];
                          return (
                            <div style={{ 
                              backgroundColor: 'rgba(0, 242, 254, 0.03)', 
                              border: '1px dashed rgba(0, 242, 254, 0.15)', 
                              borderRadius: '6px', 
                              padding: '10px 12px', 
                              fontSize: '11.5px', 
                              color: 'var(--text-secondary)',
                              marginTop: '8px'
                            }}>
                              💡 Refueling <strong>200L</strong> in <span style={{ color: 'var(--accent-green)' }}>{cheapest[0]}</span> instead of <span style={{ color: 'var(--accent-red)' }}>{dearest[0]}</span> saves approximately <strong style={{ color: 'var(--accent-cyan)' }}>₹{Math.round(diff * 200).toLocaleString()}</strong>!
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '12px', padding: '16px 0' }}>
                        Loading pricing advisor statistics...
                      </div>
                    )}
                  </div>

                  {/* Form: Log Fuel Receipt on Behalf of a Driver */}
                  <div className="content-panel" style={{ padding: '20px', margin: 0 }}>
                    <div className="panel-header" style={{ marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--accent-cyan)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        ⛽ Log Fuel Receipt on Behalf of a Driver
                      </h3>
                    </div>
                    <form onSubmit={handleDispatcherLogFuelSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '11px' }}>Select Driver *</label>
                          <select
                            className="form-select"
                            style={{ height: '36px', padding: '0 8px', fontSize: '13px' }}
                            required
                            value={dispatcherFuelLogData.driver_id}
                            onChange={e => setDispatcherFuelLogData({ ...dispatcherFuelLogData, driver_id: e.target.value })}
                          >
                            <option value="">-- Select Driver --</option>
                            {drivers.map(d => (
                              <option key={d.id} value={d.id}>
                                {d.name} ({d.phone})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '11px' }}>Trip ID *</label>
                          <input
                            type="number"
                            className="form-input"
                            style={{ height: '36px', fontSize: '13px' }}
                            required
                            placeholder="e.g. 42"
                            value={dispatcherFuelLogData.trip_id}
                            onChange={e => {
                              const val = e.target.value;
                              let updatedData = { ...dispatcherFuelLogData, trip_id: val };
                              if (val) {
                                const trip = trips.find(t => t.id === parseInt(val));
                                if (trip && trip.driver_id) {
                                  updatedData.driver_id = trip.driver_id.toString();
                                  const driver = drivers.find(d => d.id === trip.driver_id);
                                  if (driver) {
                                    updatedData.odometer = driver.odometer_km ? driver.odometer_km.toString() : '';
                                  }
                                }
                                if (trip && dieselRates && dieselRates.cities) {
                                  const foundCity = Object.keys(dieselRates.cities).find(city => 
                                    trip.source.toLowerCase().includes(city.toLowerCase()) || 
                                    trip.destination.toLowerCase().includes(city.toLowerCase())
                                  );
                                  if (foundCity) {
                                    setDispatcherDieselCity(foundCity);
                                    if (dispatcherFuelLogData.liters_refueled) {
                                      const cityRate = dieselRates.cities[foundCity] || dieselRates.national_average || 97.83;
                                      updatedData.cost = (parseFloat(dispatcherFuelLogData.liters_refueled) * cityRate).toFixed(2);
                                    }
                                  }
                                }
                              }
                              setDispatcherFuelLogData(updatedData);
                            }}
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '11px' }}>Odometer Reading (km) *</label>
                          <input
                            type="number"
                            step="0.1"
                            className="form-input"
                            style={{ height: '36px', fontSize: '13px' }}
                            required
                            placeholder="e.g. 1500"
                            value={dispatcherFuelLogData.odometer}
                            onChange={e => setDispatcherFuelLogData({ ...dispatcherFuelLogData, odometer: e.target.value })}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: dieselRates ? '1fr 1.2fr 1fr' : '1fr 1fr', gap: '12px' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '11px' }}>Fuel Refueled (Liters) *</label>
                          <input
                            type="number"
                            step="0.01"
                            className="form-input"
                            style={{ height: '36px', fontSize: '13px' }}
                            required
                            placeholder="e.g. 45.2"
                            value={dispatcherFuelLogData.liters_refueled}
                            onChange={e => {
                              const liters = e.target.value;
                              let updatedData = { ...dispatcherFuelLogData, liters_refueled: liters };
                              if (liters && dieselRates) {
                                const cityRate = dispatcherDieselCity === 'national_average'
                                  ? (dieselRates.national_average || 97.83)
                                  : (dieselRates.cities[dispatcherDieselCity] || dieselRates.national_average || 97.83);
                                updatedData.cost = (parseFloat(liters) * cityRate).toFixed(2);
                              }
                              setDispatcherFuelLogData(updatedData);
                            }}
                          />
                        </div>
                        {dieselRates && (
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '11px' }}>Diesel Pricing City (India)</label>
                            <select
                              className="form-select"
                              style={{ height: '36px', padding: '0 8px', fontSize: '13px' }}
                              value={dispatcherDieselCity}
                              onChange={e => {
                                const city = e.target.value;
                                setDispatcherDieselCity(city);
                                if (dispatcherFuelLogData.liters_refueled) {
                                  const cityRate = city === 'national_average'
                                    ? (dieselRates.national_average || 97.83)
                                    : (dieselRates.cities[city] || dieselRates.national_average || 97.83);
                                  const calculatedCost = (parseFloat(dispatcherFuelLogData.liters_refueled) * cityRate).toFixed(2);
                                  setDispatcherFuelLogData(prev => ({ ...prev, cost: calculatedCost }));
                                }
                              }}
                            >
                              <option value="national_average">National Average (₹{dieselRates.national_average?.toFixed(2)})</option>
                              {Object.entries(dieselRates.cities).map(([name, price]: any) => (
                                <option key={name} value={name}>{name} (₹{price.toFixed(2)})</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '11px' }}>Receipt Cost (₹) *</label>
                          <input
                            type="number"
                            step="0.01"
                            className="form-input"
                            style={{ height: '36px', fontSize: '13px' }}
                            required
                            placeholder="e.g. 4000"
                            value={dispatcherFuelLogData.cost}
                            onChange={e => setDispatcherFuelLogData({ ...dispatcherFuelLogData, cost: e.target.value })}
                          />
                          {dieselRates && dispatcherFuelLogData.liters_refueled && (
                            <span style={{ fontSize: '10px', color: 'var(--accent-cyan)', marginTop: '2px', display: 'block' }}>
                              Using {dispatcherDieselCity === 'national_average' ? 'Average' : dispatcherDieselCity}: ₹{((dispatcherDieselCity === 'national_average' ? dieselRates.national_average : dieselRates.cities[dispatcherDieselCity]) || 97.83).toFixed(2)}/L
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', alignSelf: 'flex-start' }}>
                        <input
                          type="checkbox"
                          id="is_personal_two_wheeler_dispatcher"
                          checked={dispatcherPersonalTwoWheeler}
                          onChange={e => setDispatcherPersonalTwoWheeler(e.target.checked)}
                        />
                        <label htmlFor="is_personal_two_wheeler_dispatcher" className="form-label" style={{ margin: 0, cursor: 'pointer', fontSize: '13px' }}>
                          🏍️ Personal Two-Wheeler Refuel (Deduct from Driver's Payout)
                        </label>
                      </div>

                      <button type="submit" className="btn btn-primary" style={{ marginTop: '8px', alignSelf: 'flex-end', height: '36px', padding: '0 16px', fontSize: '13px' }}>
                        Submit Refueling Log
                      </button>
                    </form>
                  </div>
                </div>

                {/* Visual Charts Grid: Expenditure & Efficiency */}
                {(() => {
                  const spendHistory = getFuelSpendHistory();
                  const hasSpendHistory = spendHistory.length > 0;
                  
                  let linePath = "";
                  let areaPath = "";
                  const points: { x: number, y: number, label: string, cost: number, liters: number }[] = [];
                  
                  if (hasSpendHistory) {
                    const width = 500;
                    const height = 180;
                    const paddingLeft = 55;
                    const paddingRight = 20;
                    const paddingTop = 20;
                    const paddingBottom = 30;
                    
                    const chartWidth = width - paddingLeft - paddingRight;
                    const chartHeight = height - paddingTop - paddingBottom;
                    
                    const costs = spendHistory.map(h => h.cost);
                    const maxCost = Math.max(...costs) * 1.15;
                    const minCost = 0;
                    const costRange = maxCost - minCost || 1;
                    
                    spendHistory.forEach((pt, i) => {
                      const x = paddingLeft + (spendHistory.length > 1 ? i * (chartWidth / (spendHistory.length - 1)) : chartWidth / 2);
                      const y = height - paddingBottom - ((pt.cost - minCost) / costRange) * chartHeight;
                      points.push({ x, y, label: pt.date, cost: pt.cost, liters: pt.liters });
                    });
                    
                    if (points.length > 0) {
                      linePath = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");
                      areaPath = `M ${points[0].x} ${height - paddingBottom} ` + points.map(p => `L ${p.x} ${p.y}`).join(" ") + ` L ${points[points.length - 1].x} ${height - paddingBottom} Z`;
                    }
                  }

                  const efficiencyData = getDriverEfficiencyData();
                  const hasEfficiencyData = efficiencyData.length > 0;

                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>
                      
                      {/* Chart 1: Expenditure Trend */}
                      <div className="content-panel" style={{ padding: '20px', margin: 0 }}>
                        <div className="panel-header" style={{ marginBottom: '16px' }}>
                          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            📈 Fuel Expenditure Trend (Last 10 Refuels)
                          </h3>
                        </div>
                        {hasSpendHistory ? (
                          <div style={{ position: 'relative' }}>
                            <svg viewBox="0 0 500 180" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                              <defs>
                                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.3"/>
                                  <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.0"/>
                                </linearGradient>
                              </defs>
                              
                              {/* Grid lines */}
                              {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                                const y = 20 + ratio * 130;
                                const costs = spendHistory.map(h => h.cost);
                                const maxCost = Math.max(...costs) * 1.15;
                                const gridVal = maxCost - ratio * maxCost;
                                return (
                                  <g key={index}>
                                    <line x1="55" y1={y} x2="480" y2={y} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                                    <text x="50" y={y + 3} fill="var(--text-secondary)" fontSize="9" textAnchor="end">
                                      ₹{Math.round(gridVal)}
                                    </text>
                                  </g>
                                );
                              })}
                              
                              {/* Shaded Area */}
                              {areaPath && <path d={areaPath} fill="url(#areaGrad)" />}
                              
                              {/* Line */}
                              {linePath && <path d={linePath} fill="none" stroke="var(--accent-cyan)" strokeWidth="2.5" />}
                              
                              {/* Tooltip points */}
                              {points.map((pt, index) => (
                                <g key={index} className="chart-dot-group" style={{ cursor: 'pointer' }}>
                                  <circle cx={pt.x} cy={pt.y} r="4" fill="var(--accent-cyan)" />
                                  <circle cx={pt.x} cy={pt.y} r="8" fill="var(--accent-cyan)" opacity="0" className="hover-pulse" style={{ transition: 'opacity 0.2s' }} />
                                  <title>
                                    {pt.label} &#10;
                                    Refueled: {pt.liters.toFixed(1)} L &#10;
                                    Cost: ₹{pt.cost.toLocaleString()}
                                  </title>
                                  <text x={pt.x} y={170} fill="var(--text-secondary)" fontSize="9" textAnchor="middle">
                                    {pt.label}
                                  </text>
                                </g>
                              ))}
                            </svg>
                            <style>{`
                              .chart-dot-group:hover circle:last-of-type {
                                opacity: 0.3 !important;
                              }
                            `}</style>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                            No fuel data available to plot trends.
                          </div>
                        )}
                      </div>

                      {/* Chart 2: Driver Fuel Economy */}
                      <div className="content-panel" style={{ padding: '20px', margin: 0 }}>
                        <div className="panel-header" style={{ marginBottom: '16px' }}>
                          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            📊 Fuel Economy by Driver (Actual vs. Expected L/100km)
                          </h3>
                        </div>
                        {hasEfficiencyData ? (
                          <div>
                            <div style={{ display: 'flex', gap: '16px', fontSize: '11px', marginBottom: '12px', justifyContent: 'flex-end' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                                <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '2px' }} />
                                Expected (Standard)
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                                <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: 'var(--accent-green)', borderRadius: '2px' }} />
                                Actual (Within Limit)
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                                <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: 'var(--accent-red)', borderRadius: '2px' }} />
                                Actual (Inefficient)
                              </span>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              {(() => {
                                const list = getDriverEfficiencyData();
                                const maxRate = Math.max(...list.map(d => Math.max(d.actualRate, d.expectedRate)), 25);
                                return list.map((item, index) => {
                                  const expWidth = `${(item.expectedRate / maxRate) * 100}%`;
                                  const actWidth = `${(item.actualRate / maxRate) * 100}%`;
                                  const isInefficient = item.actualRate > item.expectedRate;
                                  
                                  return (
                                    <div key={index} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: '12px' }}>
                                      <div style={{ fontSize: '12px', fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.driverName}
                                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{item.vehicleType.replace('_', ' ')}</div>
                                      </div>
                                      
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
                                        {/* Expected Bar */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <div style={{ flex: 1, height: '8px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: expWidth, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '4px' }} />
                                          </div>
                                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', width: '45px', textAlign: 'right' }}>
                                            {item.expectedRate.toFixed(1)} L
                                          </span>
                                        </div>
                                        
                                        {/* Actual Bar */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <div style={{ flex: 1, height: '8px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{
                                              height: '100%',
                                              width: actWidth,
                                              backgroundColor: isInefficient ? 'var(--accent-red)' : 'var(--accent-green)',
                                              borderRadius: '4px',
                                              boxShadow: isInefficient ? '0 0 8px rgba(239, 68, 68, 0.4)' : 'none'
                                            }} />
                                          </div>
                                          <span style={{ fontSize: '10px', fontWeight: 600, color: isInefficient ? 'var(--accent-red)' : 'var(--accent-green)', width: '45px', textAlign: 'right' }}>
                                            {item.actualRate.toFixed(1)} L
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                            No driver fuel efficiency records found.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Fuel Logs & Auditing Panel */}
                <div className="content-panel">
                  <div className="panel-header">
                    <h3 className="panel-title" style={{ color: '#fff' }}>
                      <Fuel size={18} color="var(--accent-cyan)" />
                      Fuel Card Transactions & Security Audits
                    </h3>
                  </div>

                  <div className="table-container">
                    <table className="dashboard-table">
                      <thead>
                        <tr>
                          <th>Date & Time</th>
                          <th>Driver</th>
                          <th>Trip ID</th>
                          <th>Odometer</th>
                          <th>Refueled Vol</th>
                          <th>Receipt Cost</th>
                          <th>Security Audit Status</th>
                          {isDispatcher && <th>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {fuelLogs.length === 0 ? (
                          <tr>
                            <td colSpan={isDispatcher ? 8 : 7} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                              No fuel card transactions recorded yet.
                            </td>
                          </tr>
                        ) : (
                          fuelLogs.map(log => {
                            const driverName = drivers.find(d => d.id === log.driver_id)?.name || `Driver #${log.driver_id}`;
                            return (
                              <tr key={log.id} style={{ borderLeft: log.is_personal_two_wheeler ? '4px solid var(--accent-amber)' : log.is_flagged_fraud ? '4px solid var(--accent-red)' : 'none' }}>
                                <td>{new Date(log.created_at).toLocaleString()}</td>
                                <td>{driverName}</td>
                                <td>{log.trip_id ? `#${log.trip_id}` : 'N/A'}</td>
                                <td>{log.odometer.toFixed(1)} km</td>
                                <td>{log.liters_refueled.toFixed(2)} L</td>
                                <td>₹{log.cost.toFixed(2)}</td>
                                <td>
                                  {log.is_personal_two_wheeler ? (
                                    <span style={{ color: 'var(--accent-amber)', fontSize: '12px', fontWeight: 600 }}>
                                      🏍️ Personal Two-Wheeler (Salary Deduction)
                                    </span>
                                  ) : log.is_flagged_fraud ? (
                                    <span style={{ color: 'var(--accent-red)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                                      ⚠️ Flagged: {log.fraud_reason}
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--accent-green)', fontSize: '12px', fontWeight: 600 }}>
                                      ✓ Verified Compliant
                                    </span>
                                  )}
                                </td>
                                {isDispatcher && (
                                  <td>
                                    <button
                                      className="btn btn-secondary"
                                      style={{ padding: '4px 8px', fontSize: '12px' }}
                                      onClick={() => handleStartEditFuelLog(log)}
                                    >
                                      Edit / Audit
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* TAB: RECONCILIATION & FINANCIAL AUDITS */}
            {activeTab === 'reconciliation' && isDispatcher && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Header card with summary stats */}
                {(() => {
                  const completedTrips = trips.filter(t => t.status === 'completed');
                  const flaggedTrips = completedTrips.filter(t => t.payout_status === 'hold_audit');
                  const releasedTrips = completedTrips.filter(t => t.payout_status === 'approved');
                  const pendingTrips = completedTrips.filter(t => t.payout_status === 'pending');

                  return (
                    <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                      <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                        <div style={{ fontSize: '20px' }}>⚖️</div>
                        <div className="metric-label">Audited Trips</div>
                        <div className="metric-value" style={{ color: '#fff', fontSize: '22px' }}>
                          {completedTrips.length}
                        </div>
                      </div>
                      
                      <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px', border: flaggedTrips.length > 0 ? '1px solid var(--accent-red)' : '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '20px' }}>🔒</div>
                        <div className="metric-label">Payouts on Hold</div>
                        <div className="metric-value" style={{ color: flaggedTrips.length > 0 ? 'var(--accent-red)' : 'var(--text-secondary)', fontSize: '22px' }}>
                          {flaggedTrips.length}
                        </div>
                      </div>

                      <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                        <div style={{ fontSize: '20px' }}>⏳</div>
                        <div className="metric-label">Pending Release</div>
                        <div className="metric-value" style={{ color: 'var(--accent-cyan)', fontSize: '22px' }}>
                          {pendingTrips.length}
                        </div>
                      </div>

                      <div className="metric-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                        <div style={{ fontSize: '20px' }}>💸</div>
                        <div className="metric-label">Released Earnings</div>
                        <div className="metric-value" style={{ color: 'var(--accent-green)', fontSize: '22px' }}>
                          {releasedTrips.length}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Main reconciliation panel */}
                <div className="content-panel">
                  <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <h3 className="panel-title" style={{ color: '#fff', margin: 0 }}>
                      <AlertTriangle size={18} color="var(--accent-red)" />
                      Mileage & Payout Reconciliation Board
                    </h3>
                  </div>

                  <div className="table-container">
                    <table className="dashboard-table">
                      <thead>
                        <tr>
                          <th>Trip ID</th>
                          <th>Driver</th>
                          <th>Planned Dist</th>
                          <th>GPS Dist</th>
                          <th>Odometer Dist</th>
                          <th>Audit Result</th>
                          <th>Payout Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const completedTrips = trips.filter(t => t.status === 'completed');
                          if (completedTrips.length === 0) {
                            return (
                              <tr>
                                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                                  No completed trips have been recorded yet to audit.
                                </td>
                              </tr>
                            );
                          }

                          return completedTrips.map(trip => {
                            const driverName = drivers.find(d => d.id === trip.driver_id)?.name || `Driver #${trip.driver_id}`;
                            const isFlagged = trip.payout_status === 'hold_audit';
                            
                            let auditBadge = <span style={{ color: 'var(--accent-green)', fontSize: '11px', fontWeight: 600 }}>✓ Passed</span>;
                            if (trip.audit_status === 'failed_gps_divergence') {
                              auditBadge = <span style={{ color: 'var(--accent-red)', fontSize: '11px', fontWeight: 600 }}>⚠️ Route Detour (&gt;20%)</span>;
                            } else if (trip.audit_status === 'failed_odo_mismatch') {
                              auditBadge = <span style={{ color: 'var(--accent-red)', fontSize: '11px', fontWeight: 600 }}>⚠️ Odo Discrepancy</span>;
                            }

                            let payoutBadge = <span style={{ color: 'var(--accent-cyan)', fontSize: '11px', fontWeight: 600 }}>Pending Release</span>;
                            if (trip.payout_status === 'hold_audit') {
                              payoutBadge = <span style={{ color: 'var(--accent-red)', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>🔒 Hold (Audit)</span>;
                            } else if (trip.payout_status === 'approved') {
                              payoutBadge = <span style={{ color: 'var(--accent-green)', fontSize: '11px', fontWeight: 600 }}>✓ Released</span>;
                            } else if (trip.payout_status === 'rejected') {
                              payoutBadge = <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 600 }}>✗ Rejected</span>;
                            }

                            const handlePayoutAction = async (action: 'approve' | 'reject') => {
                              try {
                                const res = await apiFetch(`/trips/${trip.id}/payout-action`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ action })
                                });
                                showSuccess(res.message);
                                loadData();
                              } catch (err: any) {
                                showError(err.message);
                              }
                            };

                            return (
                              <tr key={trip.id} style={{ borderLeft: isFlagged ? '4px solid var(--accent-red)' : 'none' }}>
                                <td>#{trip.id}</td>
                                <td>{driverName}</td>
                                <td>{trip.distance_km ? `${trip.distance_km.toFixed(1)} km` : 'N/A'}</td>
                                <td>{trip.gps_distance_km !== null ? `${trip.gps_distance_km.toFixed(1)} km` : 'N/A'}</td>
                                <td>{trip.odo_distance_km !== null ? `${trip.odo_distance_km.toFixed(1)} km` : 'N/A'}</td>
                                <td>{auditBadge}</td>
                                <td>{payoutBadge}</td>
                                <td>
                                  {(trip.payout_status === 'hold_audit' || trip.payout_status === 'pending') ? (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                      <button
                                        className="btn btn-primary"
                                        style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: 'var(--accent-green)', border: 'none' }}
                                        onClick={() => handlePayoutAction('approve')}
                                      >
                                        Approve
                                      </button>
                                      <button
                                        className="btn btn-secondary"
                                        style={{ padding: '4px 8px', fontSize: '11px', borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }}
                                        onClick={() => handlePayoutAction('reject')}
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Settled</span>
                                  )}
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* TAB: PAYMENTS */}
            {activeTab === 'payments' && (

              <div className="content-panel">
                <div className="panel-header">
                  <h2 className="panel-title">
                    <TrendingUp size={20} color="var(--accent-cyan)" />
                    {isDispatcher ? "Monthly Driver Payouts Manager" : "My Earnings & Payouts History"}
                  </h2>
                  {isDispatcher && (
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Configure, calculate, and issue monthly payouts
                    </span>
                  )}
                </div>

                {isDispatcher ? (
                  <>
                    {/* GENERATE PAYOUT PANEL */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', backgroundColor: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', marginBottom: '24px', border: '1px solid var(--border-color)' }}>
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: 0 }}>Generate New Monthly Payout Draft</h3>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
                        <div className="form-group" style={{ margin: 0, minWidth: '200px' }}>
                          <label className="form-label">Driver</label>
                          <select
                            className="form-select"
                            value={paymentsFilterDriver}
                            onChange={e => setPaymentsFilterDriver(e.target.value)}
                          >
                            <option value="">-- Select Driver --</option>
                            {drivers.map(d => (
                              <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group" style={{ margin: 0, width: '100px' }}>
                          <label className="form-label">Year</label>
                          <select
                            className="form-select"
                            value={paymentsFilterYear}
                            onChange={e => setPaymentsFilterYear(e.target.value)}
                          >
                            <option value="2026">2026</option>
                            <option value="2027">2027</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ margin: 0, width: '120px' }}>
                          <label className="form-label">Month</label>
                          <select
                            className="form-select"
                            value={paymentsFilterMonth}
                            onChange={e => setPaymentsFilterMonth(e.target.value)}
                          >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                              <option key={m} value={m}>{new Date(2020, m - 1).toLocaleString('default', { month: 'long' })}</option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={() => {
                            if (!paymentsFilterDriver) {
                              alert("Please select a driver first!");
                              return;
                            }
                            handleGeneratePayout(
                              parseInt(paymentsFilterDriver),
                              parseInt(paymentsFilterYear),
                              parseInt(paymentsFilterMonth)
                            );
                          }}
                          className="btn btn-primary"
                          disabled={generatingPayout || !paymentsFilterDriver}
                        >
                          {generatingPayout ? "Calculating..." : "Generate Payout Draft"}
                        </button>
                      </div>
                    </div>

                    {/* PAYMENTS FILTER TOOLBAR */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', backgroundColor: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--border-color)', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Filter size={14} color="var(--text-secondary)" />
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>Filters:</span>
                      </div>

                      <div className="form-group" style={{ margin: 0, width: '140px' }}>
                        <select
                          className="form-select font-sm"
                          value={paymentsFilterStatus}
                          onChange={e => setPaymentsFilterStatus(e.target.value)}
                        >
                          <option value="">All Statuses</option>
                          <option value="pending">Pending</option>
                          <option value="paid">Paid</option>
                        </select>
                      </div>
                      <button onClick={handleExportCSV} className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto', marginRight: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Printer size={14} /> Export CSV Reports
                      </button>
                      <button onClick={loadData} className="btn btn-secondary btn-sm">
                        <RefreshCw size={14} /> Refresh Data
                      </button>
                    </div>

                    {/* PAYMENTS TABLE */}
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Driver Name</th>
                            <th>Period</th>
                            <th>Base Salary</th>
                            <th>Commission</th>
                            <th>Bonus</th>
                            <th>Deductions</th>
                            <th>Total Payout</th>
                            <th>Status</th>
                            <th>Processed At</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.length === 0 ? (
                            <tr>
                              <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                                No payment records found for the selected filters.
                              </td>
                            </tr>
                          ) : (
                            payments.map(p => {
                              const driverObj = drivers.find(d => d.id === p.driver_id);
                              return (
                                <tr key={p.id}>
                                  <td style={{ fontWeight: 600 }}>{driverObj ? driverObj.name : `Driver ID: ${p.driver_id}`}</td>
                                  <td>{new Date(2020, p.month - 1).toLocaleString('default', { month: 'short' })} {p.year}</td>
                                  <td>₹{parseFloat(p.base_salary_paid).toFixed(2)}</td>
                                  <td>₹{parseFloat(p.commission_paid).toFixed(2)}</td>
                                  <td>₹{parseFloat(p.bonus).toFixed(2)}</td>
                                  <td>₹{parseFloat(p.deductions).toFixed(2)}</td>
                                  <td style={{ fontWeight: 700, color: 'var(--accent-green)' }}>₹{parseFloat(p.total_paid).toFixed(2)}</td>
                                  <td>
                                    <span className={`badge badge-${p.status === 'paid' ? 'completed' : 'assigned'}`}>
                                      {p.status}
                                    </span>
                                  </td>
                                  <td>{p.paid_at ? new Date(p.paid_at).toLocaleString() : '—'}</td>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      {p.status === 'pending' ? (
                                        <>
                                          <button
                                            onClick={() => {
                                              setShowPayModal(p);
                                              setPayoutBonus(p.bonus.toString());
                                              setPayoutDeductions(p.deductions.toString());
                                              setPayoutMethod('Bank Transfer');
                                              setPayoutNote(p.note || '');
                                            }}
                                            className="btn btn-primary btn-sm"
                                            style={{ padding: '4px 8px', fontSize: '11px' }}
                                          >
                                            Settle/Pay
                                          </button>
                                          {currentUser.role === 'admin' && (
                                            <button
                                              onClick={() => handleDeletePayment(p.id)}
                                              className="btn btn-secondary btn-sm"
                                              style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--accent-red)' }}
                                            >
                                              Delete
                                            </button>
                                          )}
                                        </>
                                      ) : (
                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                          Paid via {p.payment_method || 'UPI'}
                                        </span>
                                      )}
                                      <button
                                        onClick={() => handleDownloadInvoice(p.id)}
                                        className="btn btn-secondary btn-sm"
                                        style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                        title="Download Invoice PDF"
                                      >
                                        <Printer size={12} /> Paystub
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  /* DRIVER VIEW */
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Period</th>
                          <th>Base Salary</th>
                          <th>Commission Earned</th>
                          <th>Bonus</th>
                          <th>Deductions</th>
                          <th>Net Payout</th>
                          <th>Payment Status</th>
                          <th>Payment Date</th>
                          <th>Method</th>
                          <th>Notes</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.length === 0 ? (
                          <tr>
                            <td colSpan={11} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                              No past payments recorded yet.
                            </td>
                          </tr>
                        ) : (
                          payments.map(p => (
                            <tr key={p.id}>
                              <td style={{ fontWeight: 600 }}>{new Date(2020, p.month - 1).toLocaleString('default', { month: 'long' })} {p.year}</td>
                              <td>₹{parseFloat(p.base_salary_paid).toFixed(2)}</td>
                              <td>₹{parseFloat(p.commission_paid).toFixed(2)}</td>
                              <td>₹{parseFloat(p.bonus).toFixed(2)}</td>
                              <td>₹{parseFloat(p.deductions).toFixed(2)}</td>
                              <td style={{ fontWeight: 700, color: 'var(--accent-green)' }}>₹{parseFloat(p.total_paid).toFixed(2)}</td>
                              <td>
                                <span className={`badge badge-${p.status === 'paid' ? 'completed' : 'assigned'}`}>
                                  {p.status}
                                </span>
                              </td>
                              <td>{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '—'}</td>
                              <td>{p.payment_method || '—'}</td>
                              <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{p.note || '—'}</td>
                              <td>
                                <button
                                  onClick={() => handleDownloadInvoice(p.id)}
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  title="Download Invoice PDF"
                                >
                                  <Printer size={12} /> Paystub
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
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
                      {!playbackTripId && selectedTrip && (() => {
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

                      {/* Playback HUD Overlay Card */}
                      {playbackTripId && playbackHistory.length > 0 && (
                        <div style={{
                          position: 'absolute',
                          bottom: '20px',
                          left: '20px',
                          right: '20px',
                          backgroundColor: 'rgba(24,24,27,0.96)',
                          backdropFilter: 'blur(10px)',
                          border: '1px solid var(--accent-cyan)',
                          borderRadius: '12px',
                          padding: '16px 20px',
                          boxShadow: '0 15px 35px -5px rgba(0,0,0,0.7)',
                          zIndex: 1000,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontSize: '10px', color: 'var(--accent-cyan)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                ROUTE HISTORICAL PLAYBACK
                              </span>
                              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', margin: '2px 0 0 0' }}>
                                Trip #{playbackTripId} GPS Route Playback
                              </h3>
                            </div>
                            <button
                              onClick={() => {
                                setPlaybackTripId(null);
                                setPlaybackHistory([]);
                                setIsPlaybackPlaying(false);
                              }}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--accent-red)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                            >
                              Exit Playback
                            </button>
                          </div>

                          {/* Scrubber Timeline Slider */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', minWidth: '40px' }}>
                              {playbackIndex + 1}/{playbackHistory.length}
                            </span>
                            <input
                              type="range"
                              min={0}
                              max={playbackHistory.length - 1}
                              value={playbackIndex}
                              onChange={e => setPlaybackIndex(parseInt(e.target.value))}
                              style={{ flexGrow: 1, accentColor: 'var(--accent-cyan)', cursor: 'pointer', height: '6px', borderRadius: '3px' }}
                            />
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', minWidth: '120px', textAlign: 'right' }}>
                              {playbackHistory[playbackIndex] ? new Date(playbackHistory[playbackIndex].recorded_at).toLocaleTimeString() : '—'}
                            </span>
                          </div>

                          {/* Action Control Buttons */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <button
                              onClick={() => setIsPlaybackPlaying(!isPlaybackPlaying)}
                              className="btn btn-primary"
                              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px', fontSize: '13px' }}
                            >
                              {isPlaybackPlaying ? 'Pause' : 'Play Route'}
                            </button>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Speed:</span>
                              <select
                                className="form-select"
                                style={{ width: '80px', padding: '4px 8px', fontSize: '12px' }}
                                value={playbackSpeed}
                                onChange={e => setPlaybackSpeed(parseFloat(e.target.value))}
                              >
                                <option value="1">1x</option>
                                <option value="2">2x</option>
                                <option value="5">5x</option>
                                <option value="10">10x</option>
                              </select>
                            </div>

                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {playbackHistory[playbackIndex] && (
                                <>
                                  <span>Lat: {playbackHistory[playbackIndex].latitude.toFixed(5)}</span>
                                  <span>Lng: {playbackHistory[playbackIndex].longitude.toFixed(5)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
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
                  <label className="form-label">Duration (hours)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    value={newTripData.duration_minutes}
                    onChange={e => setNewTripData({ ...newTripData, duration_minutes: e.target.value })}
                    placeholder="e.g. 1.5"
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
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => {
                    setAssigningTripId(null);
                    setAssignDriverId('');
                    setAssignVehicleId('');
                  }}
                >
                  <X size={20} />
                </button>
              </div>


              {/* Recommendations Section */}
              <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-cyan)' }}>🧠 Smart Match Recommendations</span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '4px 10px', fontSize: '11px', backgroundColor: 'var(--accent-cyan)', color: '#000', border: 'none', fontWeight: 600 }}
                    onClick={handleSmartMatch}
                    disabled={loadingRecs || recommendations.length === 0}
                  >
                    Auto-Assign Best Match
                  </button>
                </div>

                {loadingRecs ? (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Calculating compatibility scores...</div>
                ) : recommendations.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>No suitable recommended drivers found.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {recommendations.map((rec, index) => {
                      let scoreColor = 'var(--accent-green)';
                      if (rec.score < 60) scoreColor = 'var(--accent-red)';
                      else if (rec.score < 80) scoreColor = 'var(--accent-cyan)';

                      return (
                        <div key={rec.driver_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px' }}>
                          <div style={{ flex: 1, marginRight: '8px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>
                              {index + 1}. {rec.driver_name} 
                              <span style={{ marginLeft: '8px', color: scoreColor, fontSize: '11px', fontWeight: 600 }}>{rec.score}% Match</span>
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {rec.reasons.join(' • ')}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '3px 8px', fontSize: '10px', height: 'fit-content' }}
                            onClick={async () => {
                              try {
                                const payload: any = { driver_id: rec.driver_id };
                                await apiFetch(`/trips/${assigningTripId}/assign`, {
                                  method: 'PATCH',
                                  body: JSON.stringify(payload)
                                });
                                showSuccess(`Assigned ${rec.driver_name} successfully!`);
                                setAssigningTripId(null);
                                loadData();
                              } catch (err: any) {
                                showError(err.message);
                              }
                            }}
                          >
                            Assign
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
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

              <div className="form-group" style={{ marginBottom: '28px' }}>
                <label className="form-label">Select Vehicle (Optional Override)</label>
                <select
                  className="form-select"
                  value={assignVehicleId}
                  onChange={e => setAssignVehicleId(e.target.value)}
                >
                  <option value="">-- Default (Driver's Assigned Vehicle) --</option>
                  {vehicles.filter(v => v.status === 'active').map(vehicle => {
                    const isOverdue = vehicle.is_service_overdue;
                    const remaining = vehicle.next_service_due_odometer ? (vehicle.next_service_due_odometer - vehicle.odometer_km) : null;
                    const isSoon = remaining !== null && remaining <= 500 && remaining > 0 && !isOverdue;
                    const labelSuffix = isOverdue 
                      ? ' - ⚠️ OVERDUE (Blocked)' 
                      : isSoon 
                        ? ` - ⚠️ DUE SOON (${Math.round(remaining)} km left)` 
                        : '';
                    return (
                      <option key={vehicle.id} value={vehicle.id} disabled={isOverdue}>
                        {vehicle.make} {vehicle.model} ({vehicle.license_plate}){labelSuffix}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setAssigningTripId(null);
                    setAssignDriverId('');
                    setAssignVehicleId('');
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MODAL: PRE-TRIP SAFETY INSPECTION */}
        {showInspectionTripId !== null && (
          <div className="modal-overlay">
            <form className="modal-content" onSubmit={async (e) => {
              e.preventDefault();
              try {
                const res = await apiFetch(`/trips/${showInspectionTripId}/inspection`, {
                  method: 'POST',
                  body: JSON.stringify({
                    brakes_passed: inspectionBrakes,
                    tires_passed: inspectionTires,
                    lights_passed: inspectionLights,
                    steering_passed: inspectionSteering,
                    fluids_passed: inspectionFluids,
                    notes: inspectionNotes || null
                  })
                });
                if (res.is_safe) {
                  showSuccess("Pre-trip safety inspection passed! You can now start the trip.");
                } else {
                  showError("Safety inspection failed! The vehicle has been put in maintenance.");
                }
                setShowInspectionTripId(null);
                setInspectionBrakes(true);
                setInspectionTires(true);
                setInspectionLights(true);
                setInspectionSteering(true);
                setInspectionFluids(true);
                setInspectionNotes('');
                loadData();
              } catch (err: any) {
                showError(err.message);
              }
            }} style={{ width: '480px' }}>
              <div className="modal-header">
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={20} color="var(--accent-cyan)" /> Pre-Trip Safety Inspection
                </h3>
                <button type="button" className="modal-close" onClick={() => setShowInspectionTripId(null)}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.4 }}>
                Please confirm that the vehicle is in safe operating condition. If any safety checks fail, the vehicle will be flagged for maintenance and starting the trip will be blocked.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                {[
                  { id: 'brakes', label: 'Brakes Inspection', desc: 'Brake pads, response time, fluid level', state: inspectionBrakes, setter: setInspectionBrakes },
                  { id: 'tires', label: 'Tires & Wheels', desc: 'Tread depth, tire pressure, no visible damage', state: inspectionTires, setter: setInspectionTires },
                  { id: 'lights', label: 'Lights & Indicators', desc: 'Headlights, brake lights, turn signals functioning', state: inspectionLights, setter: setInspectionLights },
                  { id: 'steering', label: 'Steering System', desc: 'No play, steering wheel alignment', state: inspectionSteering, setter: setInspectionSteering },
                  { id: 'fluids', label: 'Fluids & Leaks', desc: 'Engine oil, coolant, wash fluid level', state: inspectionFluids, setter: setInspectionFluids }
                ].map((item) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-dim)' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: '14px' }}>{item.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{item.desc}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: item.state ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {item.state ? 'PASSED' : 'FAILED'}
                      </span>
                      <button
                        type="button"
                        onClick={() => item.setter(!item.state)}
                        style={{
                          width: '42px',
                          height: '24px',
                          borderRadius: '12px',
                          backgroundColor: item.state ? 'rgba(69,242,72,0.15)' : 'rgba(239,68,68,0.15)',
                          border: `1px solid ${item.state ? 'var(--accent-green)' : 'var(--accent-red)'}`,
                          position: 'relative',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          padding: 0
                        }}
                      >
                        <div style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          backgroundColor: item.state ? 'var(--accent-green)' : 'var(--accent-red)',
                          position: 'absolute',
                          top: '3px',
                          left: item.state ? '21px' : '3px',
                          transition: 'all 0.2s'
                        }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="form-group" style={{ marginBottom: '28px' }}>
                <label className="form-label">Inspection Notes / Discrepancies</label>
                <textarea
                  className="form-textarea"
                  value={inspectionNotes}
                  onChange={e => setInspectionNotes(e.target.value)}
                  placeholder="Describe any issues or notes about the vehicle condition..."
                  rows={2}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowInspectionTripId(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{
                  backgroundColor: (inspectionBrakes && inspectionTires && inspectionLights && inspectionSteering && inspectionFluids) ? 'var(--accent-cyan)' : 'var(--accent-red)',
                  border: 'none',
                  color: '#000',
                  fontWeight: 600
                }}>
                  Submit Inspection Report
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

              {transitioningTrip.action === 'complete' && (
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Ending Odometer Reading (km) *</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    required
                    value={transitionOdometer}
                    onChange={e => setTransitionOdometer(e.target.value)}
                    placeholder="e.g. 5200.5"
                  />
                </div>
              )}

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

              <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="form-label">Base Salary (INR/Month)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={editDriverBaseSalary}
                    onChange={e => setEditDriverBaseSalary(e.target.value)}
                    required
                    min="0"
                  />
                </div>
                <div>
                  <label className="form-label">Commission Rate (%)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={editDriverCommissionPercentage}
                    onChange={e => setEditDriverCommissionPercentage(e.target.value)}
                    required
                    min="0"
                    max="100"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Assigned Vehicle</label>
                <select
                  className="form-select"
                  value={editDriverVehicleId}
                  onChange={e => setEditDriverVehicleId(e.target.value)}
                >
                  <option value="">-- No Vehicle Assigned --</option>
                  {vehicles.map(vehicle => {
                    const isOverdue = vehicle.is_service_overdue;
                    const remaining = vehicle.next_service_due_odometer ? (vehicle.next_service_due_odometer - vehicle.odometer_km) : null;
                    const isSoon = remaining !== null && remaining <= 500 && remaining > 0 && !isOverdue;
                    const labelSuffix = isOverdue 
                      ? ' - ⚠️ OVERDUE' 
                      : isSoon 
                        ? ` - ⚠️ DUE SOON (${Math.round(remaining)} km left)` 
                        : '';
                    return (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.make} {vehicle.model} ({vehicle.license_plate}){labelSuffix}
                      </option>
                    );
                  })}
                </select>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Base Salary (INR/Month) *</label>
                  <input
                    type="number"
                    className="form-input"
                    required
                    value={newDriverData.base_salary}
                    onChange={e => setNewDriverData({ ...newDriverData, base_salary: e.target.value })}
                    placeholder="e.g. 20000"
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Commission Rate (%) *</label>
                  <input
                    type="number"
                    className="form-input"
                    required
                    value={newDriverData.commission_percentage}
                    onChange={e => setNewDriverData({ ...newDriverData, commission_percentage: e.target.value })}
                    placeholder="e.g. 70"
                    min="0"
                    max="100"
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

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Assign Initial Vehicle (Optional)</label>
                <select
                  className="form-select"
                  value={newDriverData.vehicle_id}
                  onChange={e => setNewDriverData({ ...newDriverData, vehicle_id: e.target.value })}
                >
                  <option value="">-- No Vehicle Assigned --</option>
                  {vehicles.map(vehicle => {
                    const isOverdue = vehicle.is_service_overdue;
                    const remaining = vehicle.next_service_due_odometer ? (vehicle.next_service_due_odometer - vehicle.odometer_km) : null;
                    const isSoon = remaining !== null && remaining <= 500 && remaining > 0 && !isOverdue;
                    const labelSuffix = isOverdue 
                      ? ' - ⚠️ OVERDUE' 
                      : isSoon 
                        ? ` - ⚠️ DUE SOON (${Math.round(remaining)} km left)` 
                        : '';
                    return (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.make} {vehicle.model} ({vehicle.license_plate}){labelSuffix}
                      </option>
                    );
                  })}
                </select>
              </div>

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

        {/* MODAL: EDIT FUEL LOG */}
        {editingFuelLog && (
          <div className="modal-overlay">
            <form className="modal-content" onSubmit={handleUpdateFuelLog} style={{ width: '480px' }}>
              <div className="modal-header">
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff' }}>Edit / Resolve Fuel Log Entry</h3>
                <button type="button" className="modal-close" onClick={() => setEditingFuelLog(null)}>
                  <X size={20} />
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">Trip ID</label>
                <input
                  type="number"
                  className="form-input"
                  value={editingFuelLog.trip_id || ''}
                  onChange={e => setEditingFuelLog({ ...editingFuelLog, trip_id: e.target.value })}
                  placeholder="e.g. 1"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Fuel Refueled (Liters / kWh) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  required
                  value={editingFuelLog.liters_refueled}
                  onChange={e => {
                    const liters = e.target.value;
                    let updatedLog = { ...editingFuelLog, liters_refueled: liters };
                    if (liters && dieselRates) {
                      const cityRate = editDieselCity === 'national_average'
                        ? (dieselRates.national_average || 97.83)
                        : (dieselRates.cities[editDieselCity] || dieselRates.national_average || 97.83);
                      updatedLog.cost = (parseFloat(liters) * cityRate).toFixed(2);
                    }
                    setEditingFuelLog(updatedLog);
                  }}
                />
              </div>

              {dieselRates && (
                <div className="form-group">
                  <label className="form-label">Diesel Pricing City (India)</label>
                  <select
                    className="form-select"
                    value={editDieselCity}
                    onChange={e => {
                      const city = e.target.value;
                      setEditDieselCity(city);
                      if (editingFuelLog.liters_refueled && dieselRates) {
                        const cityRate = city === 'national_average'
                          ? (dieselRates.national_average || 97.83)
                          : (dieselRates.cities[city] || dieselRates.national_average || 97.83);
                        const calculatedCost = (parseFloat(editingFuelLog.liters_refueled) * cityRate).toFixed(2);
                        setEditingFuelLog((prev: any) => ({ ...prev, cost: calculatedCost }));
                      }
                    }}
                  >
                    <option value="national_average">National Average (₹{dieselRates.national_average?.toFixed(2)})</option>
                    {Object.entries(dieselRates.cities).map(([name, price]: any) => (
                      <option key={name} value={name}>{name} (₹{price.toFixed(2)})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Total Cost (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  required
                  value={editingFuelLog.cost}
                  onChange={e => setEditingFuelLog({ ...editingFuelLog, cost: e.target.value })}
                />
                {dieselRates && editingFuelLog.liters_refueled && (
                  <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', marginTop: '4px', display: 'block' }}>
                    Calculated using {editDieselCity === 'national_average' ? 'National Average' : editDieselCity} rate: ₹{((editDieselCity === 'national_average' ? dieselRates.national_average : dieselRates.cities[editDieselCity]) || 97.83).toFixed(2)}/L
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Odometer Reading (km)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-input"
                  required
                  value={editingFuelLog.odometer}
                  onChange={e => setEditingFuelLog({ ...editingFuelLog, odometer: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Security Audit Status</label>
                <select
                  className="form-select"
                  value={editingFuelLog.is_flagged_fraud ? 'true' : 'false'}
                  onChange={e => setEditingFuelLog({ ...editingFuelLog, is_flagged_fraud: e.target.value === 'true' })}
                >
                  <option value="false">✓ Verified Compliant</option>
                  <option value="true">⚠️ Flagged Fraud</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Audit Note / Fraud Reason</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  value={editingFuelLog.fraud_reason || ''}
                  onChange={e => setEditingFuelLog({ ...editingFuelLog, fraud_reason: e.target.value })}
                  placeholder="Explain resolution or reasoning for fraud flag..."
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingFuelLog(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
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
        {/* MODAL: SETTLE / PAY OUT DRIVER PAYMENT */}
        {showPayModal !== null && (
          <div className="modal-overlay">
            <form className="modal-content" onSubmit={handleSubmitPayoutSettle} style={{ width: '480px' }}>
              <div className="modal-header">
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff' }}>Settle Driver Monthly Payout</h3>
                <button type="button" className="modal-close" onClick={() => setShowPayModal(null)}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Driver:</span>
                  <strong style={{ color: '#fff' }}>{drivers.find(d => d.id === showPayModal.driver_id)?.name || `Driver ID: ${showPayModal.driver_id}`}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Period:</span>
                  <strong style={{ color: '#fff' }}>{new Date(2020, showPayModal.month - 1).toLocaleString('default', { month: 'long' })} {showPayModal.year}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Calculated Payout:</span>
                  <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>₹{(parseFloat(showPayModal.base_salary_paid) + parseFloat(showPayModal.commission_paid)).toFixed(2)}</span>
                </div>
              </div>

              <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="form-label">Bonus (Add)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={payoutBonus}
                    onChange={e => setPayoutBonus(e.target.value)}
                    required
                    min="0"
                  />
                </div>
                <div>
                  <label className="form-label">Deductions (Subtract)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={payoutDeductions}
                    onChange={e => setPayoutDeductions(e.target.value)}
                    required
                    min="0"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select
                  className="form-select"
                  value={payoutMethod}
                  onChange={e => setPayoutMethod(e.target.value)}
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '28px' }}>
                <label className="form-label">Notes / Remarks</label>
                <textarea
                  className="form-textarea"
                  value={payoutNote}
                  onChange={e => setPayoutNote(e.target.value)}
                  placeholder="E.g., Salary + Commission settled..."
                  rows={2}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Net Payout: </span>
                  <strong style={{ color: 'var(--accent-green)', fontSize: '16px' }}>
                    ₹{(parseFloat(showPayModal.base_salary_paid) + parseFloat(showPayModal.commission_paid) + parseFloat(payoutBonus || '0') - parseFloat(payoutDeductions || '0')).toFixed(2)}
                  </strong>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowPayModal(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Confirm Payment
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* MODAL: ARRIVAL CONFIRMATION (DRIVER) */}
        {arrivalTripId !== null && (
          <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="modal-content" style={{ width: '440px', textAlign: 'center' }}>
              {/* Arrival animation header */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(69,242,72,0.12), rgba(0,212,255,0.08))',
                borderRadius: '12px 12px 0 0',
                padding: '28px 24px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                marginBottom: '24px',
              }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📍</div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>
                  You've Arrived!
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                  You are near <strong style={{ color: 'var(--accent-cyan)' }}>{arrivalDestination}</strong>.
                  Did you complete this trip?
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', padding: '0 24px 24px', justifyContent: 'center' }}>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '12px', fontSize: '14px' }}
                  onClick={() => {
                    // Driver says not yet — dismiss without completing
                    confirmedArrivalTrips.current.delete(arrivalTripId!);
                    setArrivalTripId(null);
                    setArrivalDestination('');
                  }}
                >
                  Not Yet
                </button>
                <button
                  className="btn btn-success"
                  style={{ flex: 1, padding: '12px', fontSize: '14px', fontWeight: 600, backgroundColor: 'var(--accent-green)', border: 'none', color: '#000' }}
                  onClick={async () => {
                    try {
                      const res = await apiFetch(`/trips/${arrivalTripId}/complete`, { method: 'PATCH' });
                      if (res && res.warning) {
                        showSuccess(`Trip completed successfully!\n⚠️ ${res.warning}`);
                      } else {
                        showSuccess('Trip completed successfully!');
                      }
                      setArrivalTripId(null);
                      setArrivalDestination('');
                      loadData();
                    } catch (e: any) {
                      showError(e.message);
                    }
                  }}
                >
                  Yes, Complete Trip
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: COMPLETE WORKSHOP MAINTENANCE */}
        {completingMaintenanceLog !== null && (
          <div className="modal-overlay">
            <form className="modal-content" onSubmit={handleCompleteMaintenanceSubmit} style={{ width: '460px' }}>
              <div className="modal-header">
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ⚙️ Complete Workshop Service & Release
                </h3>
                <button type="button" className="modal-close" onClick={() => setCompletingMaintenanceLog(null)}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-dim)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Service Type:</span>
                <div style={{ fontWeight: 600, color: '#fff', fontSize: '14.5px', textTransform: 'uppercase' }}>
                  {completingMaintenanceLog.service_type.replace('_', ' ')}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Opened: {new Date(completingMaintenanceLog.service_date).toLocaleString()}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Final Service Cost (INR) *</label>
                <input
                  type="number"
                  className="form-input"
                  required
                  value={completeMaintenanceData.cost}
                  onChange={e => setCompleteMaintenanceData({ ...completeMaintenanceData, cost: e.target.value })}
                  min="0"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Next Service Due (Odometer km)</label>
                <input
                  type="number"
                  className="form-input"
                  value={completeMaintenanceData.next_service_due_odometer}
                  onChange={e => setCompleteMaintenanceData({ ...completeMaintenanceData, next_service_due_odometer: e.target.value })}
                  placeholder="e.g. 15000"
                  min="0"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">Final Resolution Summary / Description</label>
                <textarea
                  className="form-textarea"
                  value={completeMaintenanceData.description}
                  onChange={e => setCompleteMaintenanceData({ ...completeMaintenanceData, description: e.target.value })}
                  placeholder="Provide details of works completed, parts replaced..."
                  rows={3}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setCompletingMaintenanceLog(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--accent-green)', color: '#000', border: 'none', fontWeight: 600 }}>
                  ✓ Submit Completion & Release Asset
                </button>
              </div>
            </form>
          </div>
        )}

      </div>

      {/* PRINT LAYOUT: SINGLE TRIP MANIFEST DETAIL SHEET */}
      {printingTrip !== null && (
        <div className="printable-single-trip print-only" style={{ padding: '28px', fontFamily: 'Arial, sans-serif', color: '#000', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '24px' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dispatch Trip Manifest Sheet</h1>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#444' }}>Trip ID: <strong>#{printingTrip.id}</strong></p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '12px' }}>Printed: {new Date().toLocaleString()}</p>
              <p style={{ margin: '4px 0 0', fontSize: '13px', fontWeight: 'bold' }}>Priority: {printingTrip.priority.toUpperCase()}</p>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
            <tbody>
              <tr>
                <td style={{ fontWeight: 'bold', width: '35%', padding: '10px', border: '1px solid #000', backgroundColor: '#f9f9f9', color: '#000' }}>Source Client/Company</td>
                <td style={{ padding: '10px', border: '1px solid #000', color: '#000' }}>{printingTrip.source_company || 'Standard client'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #000', backgroundColor: '#f9f9f9', color: '#000' }}>Source Address</td>
                <td style={{ padding: '10px', border: '1px solid #000', color: '#000' }}>{printingTrip.source}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #000', backgroundColor: '#f9f9f9', color: '#000' }}>Destination Client/Company</td>
                <td style={{ padding: '10px', border: '1px solid #000', color: '#000' }}>{printingTrip.destination_company || 'Standard client'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #000', backgroundColor: '#f9f9f9', color: '#000' }}>Destination Address</td>
                <td style={{ padding: '10px', border: '1px solid #000', color: '#000' }}>{printingTrip.destination}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #000', backgroundColor: '#f9f9f9', color: '#000' }}>Route Distance</td>
                <td style={{ padding: '10px', border: '1px solid #000', color: '#000' }}>{printingTrip.distance_km ? `${printingTrip.distance_km} km` : 'N/A'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #000', backgroundColor: '#f9f9f9', color: '#000' }}>Route Estimated Duration</td>
                <td style={{ padding: '10px', border: '1px solid #000', color: '#000' }}>{printingTrip.duration_hours !== undefined && printingTrip.duration_hours !== null ? `${printingTrip.duration_hours} hours` : (printingTrip.duration_minutes ? `${(printingTrip.duration_minutes / 60).toFixed(1)} hours` : 'N/A')}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #000', backgroundColor: '#f9f9f9', color: '#000' }}>Estimated Fare</td>
                <td style={{ padding: '10px', border: '1px solid #000', fontWeight: 'bold', color: '#000' }}>₹{printingTrip.estimated_fare || '0'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #000', backgroundColor: '#f9f9f9', color: '#000' }}>Scheduled Date</td>
                <td style={{ padding: '10px', border: '1px solid #000', color: '#000' }}>{printingTrip.scheduled_date ? new Date(printingTrip.scheduled_date).toLocaleString() : 'Immediate/Ad-hoc'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #000', backgroundColor: '#f9f9f9', color: '#000' }}>Current Dispatch Status</td>
                <td style={{ padding: '10px', border: '1px solid #000', fontWeight: 'bold', textTransform: 'uppercase', color: '#000' }}>{printingTrip.status}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #000', backgroundColor: '#f9f9f9', color: '#000' }}>Assigned Driver</td>
                <td style={{ padding: '10px', border: '1px solid #000', fontWeight: 'bold', color: '#000' }}>{printingTrip.driver_name || 'Unassigned'}</td>
              </tr>
              {printingTrip.driver_phone && (
                <tr>
                  <td style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #000', backgroundColor: '#f9f9f9', color: '#000' }}>Driver Contact Phone</td>
                  <td style={{ padding: '10px', border: '1px solid #000', color: '#000' }}>{printingTrip.driver_phone}</td>
                </tr>
              )}
              {printingTrip.cancel_reason && (
                <tr>
                  <td style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #000', backgroundColor: '#f9f9f9', color: '#000' }}>Cancellation Reason</td>
                  <td style={{ padding: '10px', border: '1px solid #000', color: 'red' }}>{printingTrip.cancel_reason}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div style={{ borderTop: '1px solid #ccc', paddingTop: '20px', marginTop: '40px', fontSize: '11px', color: '#666', textAlign: 'center' }}>
            DriveBoard Logistics Dispatcher System | Please keep this document inside the delivery vehicle.
          </div>
        </div>
      )}

      {/* PRINT LAYOUT: FULL FILTERED MANIFEST LIST */}
      {printingTrip === null && (
        <div className="printable-manifest print-only" style={{ padding: '28px', fontFamily: 'Arial, sans-serif', color: '#000', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '24px' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold' }}>Dispatch Trip Manifest</h1>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#555' }}>
                Active Filters:
                {tripSourceCompanyFilter && ` Source Company: "${tripSourceCompanyFilter}" |`}
                {tripDestinationCompanyFilter && ` Dest Company: "${tripDestinationCompanyFilter}" |`}
                {tripStatusFilter && ` Status: "${tripStatusFilter}"`}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '12px' }}>Printed: {new Date().toLocaleString()}</p>
              <p style={{ margin: '4px 0 0', fontSize: '13px', fontWeight: 'bold' }}>Total Dispatches: {trips.length}</p>
            </div>
          </div>

          <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left', backgroundColor: '#f2f2f2', color: '#000' }}>ID</th>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left', backgroundColor: '#f2f2f2', color: '#000' }}>Route Details</th>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left', backgroundColor: '#f2f2f2', color: '#000' }}>Clients/Companies</th>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left', backgroundColor: '#f2f2f2', color: '#000' }}>Driver</th>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left', backgroundColor: '#f2f2f2', color: '#000' }}>Status & Scheduled</th>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left', backgroundColor: '#f2f2f2', color: '#000' }}>Fare</th>
              </tr>
            </thead>
            <tbody>
              {trips.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ border: '1px solid #000', padding: '16px', textAlign: 'center', color: '#000' }}>No dispatches match the search filters.</td>
                </tr>
              ) : (
                trips.map(t => (
                  <tr key={t.id}>
                    <td style={{ border: '1px solid #000', padding: '8px', color: '#000' }}>{t.id}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', color: '#000' }}>
                      <strong style={{ fontSize: '13px' }}>{t.source} → {t.destination}</strong>
                      <div style={{ fontSize: '11px', color: '#555' }}>{t.distance_km} km | {t.duration_hours !== undefined && t.duration_hours !== null ? `${t.duration_hours} hrs` : (t.duration_minutes ? `${(t.duration_minutes / 60).toFixed(1)} hrs` : 'N/A')}</div>
                    </td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontSize: '12px', color: '#000' }}>
                      <div><strong>From:</strong> {t.source_company || 'Standard client'}</div>
                      <div><strong>To:</strong> {t.destination_company || 'Standard client'}</div>
                    </td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontSize: '12px', color: '#000' }}>
                      {t.driver_name ? (
                        <>
                          <div><strong>{t.driver_name}</strong></div>
                          <div>{t.driver_phone}</div>
                        </>
                      ) : (
                        <em style={{ color: '#666' }}>Unassigned</em>
                      )}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontSize: '12px', color: '#000' }}>
                      <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{t.status}</div>
                      {t.scheduled_date && <div style={{ fontSize: '11px' }}>{new Date(t.scheduled_date).toLocaleString()}</div>}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold', color: '#000' }}>₹{t.estimated_fare || '0'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: ADD VEHICLE */}
      {showAddVehicle && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleCreateVehicle} style={{ width: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff' }}>Add New Fleet Vehicle</h3>
              <button type="button" className="modal-close" onClick={() => setShowAddVehicle(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Make *</label>
              <input
                type="text"
                className="form-input"
                required
                value={newVehicleData.make}
                onChange={e => setNewVehicleData({ ...newVehicleData, make: e.target.value })}
                placeholder="e.g. Tata, Mahindra, Ashok Leyland"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Model *</label>
              <input
                type="text"
                className="form-input"
                required
                value={newVehicleData.model}
                onChange={e => setNewVehicleData({ ...newVehicleData, model: e.target.value })}
                placeholder="e.g. Prima, Blazo, Dost"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Year *</label>
                <input
                  type="number"
                  className="form-input"
                  required
                  value={newVehicleData.year}
                  onChange={e => setNewVehicleData({ ...newVehicleData, year: e.target.value })}
                  placeholder="e.g. 2024"
                />
              </div>

              <div className="form-group">
                <label className="form-label">License Plate *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={newVehicleData.license_plate}
                  onChange={e => setNewVehicleData({ ...newVehicleData, license_plate: e.target.value.toUpperCase() })}
                  placeholder="e.g. MH-12-PQ-1234"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Initial Odometer (km)</label>
                <input
                  type="number"
                  className="form-input"
                  value={newVehicleData.odometer_km}
                  onChange={e => setNewVehicleData({ ...newVehicleData, odometer_km: e.target.value })}
                  placeholder="e.g. 0"
                  min="0"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={newVehicleData.status}
                  onChange={e => setNewVehicleData({ ...newVehicleData, status: e.target.value })}
                >
                  <option value="active">Active (Available)</option>
                  <option value="maintenance">In Maintenance</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddVehicle(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Vehicle
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: EDIT VEHICLE */}
      {editingVehicle && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleUpdateVehicle} style={{ width: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff' }}>Edit Vehicle Specs & Status</h3>
              <button type="button" className="modal-close" onClick={() => setEditingVehicle(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Make *</label>
              <input
                type="text"
                className="form-input"
                required
                value={editingVehicle.make}
                onChange={e => setEditingVehicle({ ...editingVehicle, make: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Model *</label>
              <input
                type="text"
                className="form-input"
                required
                value={editingVehicle.model}
                onChange={e => setEditingVehicle({ ...editingVehicle, model: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Year *</label>
                <input
                  type="number"
                  className="form-input"
                  required
                  value={editingVehicle.year}
                  onChange={e => setEditingVehicle({ ...editingVehicle, year: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">License Plate *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={editingVehicle.license_plate}
                  onChange={e => setEditingVehicle({ ...editingVehicle, license_plate: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Odometer (km)</label>
                <input
                  type="number"
                  className="form-input"
                  value={editingVehicle.odometer_km}
                  onChange={e => setEditingVehicle({ ...editingVehicle, odometer_km: e.target.value })}
                  min="0"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={editingVehicle.status}
                  onChange={e => setEditingVehicle({ ...editingVehicle, status: e.target.value })}
                >
                  <option value="active">Active (Available)</option>
                  <option value="maintenance">In Maintenance</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditingVehicle(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: LOG MAINTENANCE */}
      {showLogMaintenance && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleLogMaintenanceSubmit} style={{ width: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff' }}>Log Service & Maintenance</h3>
              <button type="button" className="modal-close" onClick={() => setShowLogMaintenance(null)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-dim)' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Vehicle:</span>
              <div style={{ fontWeight: 600, color: '#fff', fontSize: '14px' }}>
                {showLogMaintenance.make} {showLogMaintenance.model} ({showLogMaintenance.license_plate})
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Service Type *</label>
              <select
                className="form-select"
                value={newMaintenanceData.service_type}
                onChange={e => setNewMaintenanceData({ ...newMaintenanceData, service_type: e.target.value })}
              >
                <option value="oil_change">Oil Change</option>
                <option value="tire_rotation">Tire Rotation</option>
                <option value="brakes">Brake Servicing</option>
                <option value="engine">Engine Tuning</option>
                <option value="repair">General Repair</option>
                <option value="inspection">Safety Inspection</option>
                <option value="other">Other / Custom</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Cost (INR) *</label>
              <input
                type="number"
                className="form-input"
                required
                value={newMaintenanceData.cost}
                onChange={e => setNewMaintenanceData({ ...newMaintenanceData, cost: e.target.value })}
                min="0"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Odometer at Service (km) *</label>
                <input
                  type="number"
                  className="form-input"
                  required
                  value={newMaintenanceData.odometer_at_service}
                  onChange={e => setNewMaintenanceData({ ...newMaintenanceData, odometer_at_service: e.target.value })}
                  min="0"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Next Service Due (km)</label>
                <input
                  type="number"
                  className="form-input"
                  value={newMaintenanceData.next_service_due_odometer}
                  onChange={e => setNewMaintenanceData({ ...newMaintenanceData, next_service_due_odometer: e.target.value })}
                  placeholder="e.g. Odometer + 10000"
                  min="0"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">Service Description</label>
              <textarea
                className="form-textarea"
                value={newMaintenanceData.description}
                onChange={e => setNewMaintenanceData({ ...newMaintenanceData, description: e.target.value })}
                placeholder="Details of repair, parts replaced, notes..."
                rows={3}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowLogMaintenance(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Log
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: VIEW MAINTENANCE HISTORY */}
      {viewingMaintenanceLogs && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '650px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff' }}>Service History Registry</h3>
              <button type="button" className="modal-close" onClick={() => setViewingMaintenanceLogs(null)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-dim)', flexShrink: 0 }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Vehicle:</span>
              <div style={{ fontWeight: 600, color: '#fff', fontSize: '15px' }}>
                {viewingMaintenanceLogs.make} {viewingMaintenanceLogs.model} ({viewingMaintenanceLogs.license_plate})
              </div>
            </div>

            <div style={{ flexGrow: 1, overflowY: 'auto', marginBottom: '20px' }}>
              {maintenanceHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  No service logs recorded for this vehicle.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {maintenanceHistory.map(log => (
                    <div key={log.id} style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-dim)', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span className="badge" style={{ backgroundColor: 'rgba(0,242,254,0.08)', color: 'var(--accent-cyan)', textTransform: 'uppercase', fontSize: '11px', padding: '3px 8px' }}>
                          {log.service_type.replace('_', ' ')}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {new Date(log.service_date).toLocaleDateString()}
                        </span>
                      </div>

                      {log.description && (
                        <p style={{ fontSize: '13px', color: '#fff', margin: '0 0 12px 0', lineHeight: 1.4 }}>
                          {log.description}
                        </p>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', borderTop: '1px dashed var(--border-dim)', paddingTop: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <div>Cost: <strong style={{ color: 'var(--accent-green)' }}>₹{log.cost.toLocaleString()}</strong></div>
                        <div>Odometer: <strong style={{ color: '#fff' }}>{log.odometer_at_service.toLocaleString()} km</strong></div>
                        {log.next_service_due_odometer && (
                          <div>Next Due: <strong style={{ color: 'var(--accent-amber)' }}>{log.next_service_due_odometer.toLocaleString()} km</strong></div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-dim)', paddingTop: '16px', flexShrink: 0 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setViewingMaintenanceLogs(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
