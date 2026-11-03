import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { io } from 'socket.io-client';
import jsPDF from "jspdf";
import {
  AlertTriangle,
  CheckCircle,
  Droplets,
  Pill,
  Download,
  Check,
  Send,
  Truck,
  MapPin,
  Route,
  Clock3,
  Radio,
  Zap,
  XCircle,
  Navigation,
  PackageCheck
} from 'lucide-react';


function StockEditor({ stock, setStock, socket, setStockUpdatedAt }) {
  const [campus, setCampus] = useState('Campus A');
  const [resource, setResource] = useState('water');
  const [value, setValue] = useState(String(Math.round(stock['Campus A'].water)));

  useEffect(() => {
    setValue(String(Math.round(stock[campus][resource])));
  }, [campus, resource, stock]);

  const save = () => {
    const numeric = Math.max(0, Number(value) || 0);
    setStock((prev) => ({
      ...prev,
      [campus]: { ...prev[campus], [resource]: numeric }
    }));
    setStockUpdatedAt(Date.now());
    socket?.emit('stock:update', { campus, resource, stock: numeric });
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <label className="text-slate-600 font-semibold">Campus</label>
          <select value={campus} onChange={(e) => setCampus(e.target.value)} className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded-lg">
            <option>Campus A</option><option>Campus B</option><option>Campus C</option>
          </select>
        </div>
        <div>
          <label className="text-slate-600 font-semibold">Resource</label>
          <select value={resource} onChange={(e) => setResource(e.target.value)} className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded-lg">
            <option value="water">water</option><option value="medicine">medicine</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <label className="text-slate-600 font-semibold">Current stock</label>
          <input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded-lg" />
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-2">
          <span className="text-slate-500">Live dashboard value</span>
          <div className="text-lg font-bold text-blue-700">{Math.round(stock[campus][resource])}</div>
        </div>
      </div>

      <button onClick={save} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-lg">
        Update live stock
      </button>
    </>
  );
}

export default function ResQFlowApp() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [isDisasterSimulated, setIsDisasterSimulated] = useState(false);
  const [transferApproved, setTransferApproved] = useState(false);
  const [requestRaised, setRequestRaised] = useState(false);
  const [donorOffered, setDonorOffered] = useState(false);
  const [roadBlocked, setRoadBlocked] = useState(false);
  const [routeStage, setRouteStage] = useState('normal');
  const [activeIncident, setActiveIncident] = useState([]);
  const [manualStage, setManualStage] = useState(0);
  const [showDisasterPicker, setShowDisasterPicker] = useState(false);
  const [selectedNeed, setSelectedNeed] = useState({ campus: 'Campus A', resource: 'water' });
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [transferStatus, setTransferStatus] = useState('idle');
  const [routeInfo, setRouteInfo] = useState({ distanceKm: 0, durationMin: 0 });
  const [showBlockReport, setShowBlockReport] = useState(false);
  const [blockReportText, setBlockReportText] = useState('Road blocked / traffic disruption');
  const [reportedRoad, setReportedRoad] = useState('Current delivery route');

  // Real-time fleet state. Vehicle positions come from the driver's phone GPS
  // through Socket.IO, not from a fake animation.
  const [socket, setSocket] = useState(null);
  const [vehicles, setVehicles] = useState({});
  const [fleetConnected, setFleetConnected] = useState(false);
  const [rerouteInfo, setRerouteInfo] = useState(null);
  const [roadReports, setRoadReports] = useState([]);

  // Sidebar form submissions
  const [campusStockUpdates, setCampusStockUpdates] = useState([]);
  const [requests, setRequests] = useState([]);
  const [donations, setDonations] = useState([]);
  const [vehicleRoutes, setVehicleRoutes] = useState({});
  const [requestFlows, setRequestFlows] = useState({});
  const [stock, setStock] = useState({
    'Campus A': { water: 30, medicine: 100 },
    'Campus B': { water: 59, medicine: 150 },
    'Campus C': { water: 31, medicine: 40 }
  });
  const [stockUpdatedAt, setStockUpdatedAt] = useState(Date.now());

  // Form state
  const [reqCamp, setReqCamp] = useState('Campus C');
  const [reqResource, setReqResource] = useState('medicine');
  const [reqQty, setReqQty] = useState('30');
  const [reqHours, setReqHours] = useState('4');

  const [donorName, setDonorName] = useState('Acme CSR');
  const [donorResource, setDonorResource] = useState('water');
  const [donorQty, setDonorQty] = useState('1000');
  const [donorCamp, setDonorCamp] = useState('Campus A');

  const [logs, setLogs] = useState([]);

  const disasterOptions = {
    'Campus A': { water: 'Water shortage', medicine: 'Medicine shortage' },
    'Campus B': { water: 'Water shortage', medicine: 'Medicine shortage' },
    'Campus C': { water: 'Water shortage', medicine: 'Medicine shortage' }
  };

  const campusLocations = {
    // Replace these demo coordinates with your real campus GPS coordinates.
    'Campus A': [12.9716, 77.5946],
    'Campus B': [12.9352, 77.6245],
    'Campus C': [12.9985, 77.6400]
  };

  useEffect(() => {
    const s = io('http://localhost:3001', { transports: ['websocket'] });
    setSocket(s);

    s.on('connect', () => setFleetConnected(true));
    s.on('disconnect', () => setFleetConnected(false));

    // The server is the source of truth for the fleet. Load its snapshot
    // on connect/reconnect so the dashboard and driver links share IDs.
    s.on('fleet:snapshot', (snapshot = []) => {
      setVehicles(Object.fromEntries(
        snapshot.map((vehicle) => [
          vehicle.vehicleId,
          { ...vehicle, lastSeen: vehicle.lastSeen || Date.now() }
        ])
      ));
    });

    s.on('driver:error', (error = {}) => {
      const message = error.message || 'The server rejected this dispatch.';
      console.error('ResQFlow server:', message);
      setActiveIncident((prev) => [...prev, `Dispatch error: ${message}`]);
    });

    s.on('vehicle:location', (vehicle) => {
      setVehicles((prev) => ({
        ...prev,
        [vehicle.vehicleId]: {
          ...prev[vehicle.vehicleId],
          ...vehicle,
          lastSeen: Date.now()
        }
      }));
    });

    s.on('vehicle:status', (vehicle) => {
      setVehicles((prev) => ({
        ...prev,
        [vehicle.vehicleId]: { ...prev[vehicle.vehicleId], ...vehicle, lastSeen: Date.now() }
      }));
    });

    s.on('road:report', (report) => {
      setRoadReports((prev) => [report, ...prev].slice(0, 10));
      setActiveIncident((prev) => [
        ...prev,
        `Public report: ${report.road} — ${report.type}`
      ]);
    });

    s.on('stock:update', (payload) => {
      if (payload?.campus && payload?.resource && payload?.stock != null) {
        setStock((prev) => ({
          ...prev,
          [payload.campus]: {
            ...prev[payload.campus],
            [payload.resource]: Number(payload.stock)
          }
        }));
        setStockUpdatedAt(Date.now());
      }
    });

    return () => {
      s.disconnect();
    };
  }, []);

  // Simulate normal consumption only; actual stock edits are persisted through the API/socket.
  useEffect(() => {
    const timer = setInterval(() => {
      setStock((prev) => {
        const next = Object.fromEntries(
          Object.entries(prev).map(([campus, values]) => ({
            [campus]: {
              water: Math.max(0, Number(values.water) - stockMeta[campus].consumptionWater / 60),
              medicine: Math.max(0, Number(values.medicine) - stockMeta[campus].consumptionMedicine / 60)
            }
          }))
        );
        return next;
      });
      setStockUpdatedAt(Date.now());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const routePlan = useMemo(() => {
    const need = selectedNeed.campus;
    if (need === 'Campus A') return { donor: 'Campus B', target: 'Campus A', label: 'B → A' };
    if (need === 'Campus C') return { donor: 'Campus B', target: 'Campus C', label: 'B → C' };
    return { donor: 'Campus A', target: 'Campus B', label: 'A → B' };
  }, [selectedNeed]);

  const stockMeta = {
    'Campus A': { reserveWater: 200, reserveMedicine: 20, consumptionWater: 5, consumptionMedicine: 1 },
    'Campus B': { reserveWater: 300, reserveMedicine: 30, consumptionWater: 4, consumptionMedicine: 1 },
    'Campus C': { reserveWater: 150, reserveMedicine: 10, consumptionWater: 5, consumptionMedicine: 2 }
  };

  const getCampusHours = (campus, resource) => {
    const units = Math.max(0, Number(stock[campus]?.[resource] ?? 0));
    const usePerHour = stockMeta[campus][resource === 'water' ? 'consumptionWater' : 'consumptionMedicine'];
    return Math.max(0, Math.floor(units / Math.max(1, usePerHour)));
  };

  const getCampusPercent = (campus, resource) => {
    const units = Number(stock[campus]?.[resource] ?? 0);
    const reserve = stockMeta[campus][resource === 'water' ? 'reserveWater' : 'reserveMedicine'];
    const target = Math.max(reserve * 3, 1);
    return Math.max(5, Math.min(100, Math.round((units / target) * 100)));
  };

  const getCampusStatus = (campus) => {
    if (!isDisasterSimulated || transferStatus === 'delivered' || selectedNeed.campus !== campus) return null;
    return selectedNeed.resource === 'water' ? 'WATER CRITICAL' : 'MEDICINE CRITICAL';
  };

  const alternateHub = Object.keys(campusLocations).find(
    (campus) => campus !== routePlan.donor && campus !== routePlan.target
  );

  const fetchRoute = async (points) => {
    setRouteLoading(true);
    try {
      const coords = points.map(([lat, lon]) => `${lon},${lat}`).join(';');
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`
      );
      if (!response.ok) throw new Error('Route service unavailable');
      const data = await response.json();
      const route = data?.routes?.[0];
      if (!route?.geometry?.coordinates?.length) throw new Error('No route returned');
      const result = {
        coords: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
        distanceKm: Number((route.distance / 1000).toFixed(1)),
        durationMin: Math.max(1, Math.ceil(route.duration / 60))
      };
      setRouteCoords(result.coords);
      setRouteInfo({ distanceKm: result.distanceKm, durationMin: result.durationMin });
      return result;
    } catch {
      const result = {
        coords: points,
        distanceKm: 12.2,
        durationMin: 15
      };
      setRouteCoords(result.coords);
      setRouteInfo({ distanceKm: result.distanceKm, durationMin: result.durationMin });
      return result;
    } finally {
      setRouteLoading(false);
    }
  };

  const runDisasterSimulation = async () => {
    setShowDisasterPicker(false);
    setIsDisasterSimulated(true);
    setTransferApproved(false);
    setTransferStatus('idle');
    setRouteInfo({ distanceKm: 0, durationMin: 0 });
    setRoadBlocked(false);
    setRouteStage('detecting');
    setManualStage(1);

    const needText = `${selectedNeed.resource === 'water' ? 'Water' : 'Medicine'} shortage detected at ${selectedNeed.campus}`;
    setActiveIncident([
      needText,
      `${routePlan.donor} selected as nearest available donor`,
      `Live road check started for ${routePlan.label}`
    ]);

    await fetchRoute([campusLocations[routePlan.donor], campusLocations[routePlan.target]]);

    setTimeout(() => {
      setRoadBlocked(true);
      setRouteStage('rerouting');
      setActiveIncident((prev) => [
        ...prev,
        `Road blockage detected on ${routePlan.label} — recalculating`
      ]);
    }, 900);

    setTimeout(async () => {
      setRouteStage('rerouted');
      setActiveIncident((prev) => [
        ...prev,
        `Alternate route found — vehicle rerouted to ${selectedNeed.campus}`
      ]);
      await fetchRoute([
        campusLocations[routePlan.donor],
        campusLocations[alternateHub],
        campusLocations[routePlan.target]
      ]);
    }, 1900);
  };

  const handleSimulateDisaster = () => setShowDisasterPicker(true);

  const handleResetDemo = () => {
    setRequestFlows({});
    setIsDisasterSimulated(false);
    setTransferApproved(false);
    setTransferStatus('idle');
    setRouteInfo({ distanceKm: 0, durationMin: 0 });
    setShowBlockReport(false);
    setBlockReportText('Road blocked / traffic disruption');
    setReportedRoad('Current delivery route');
    setRequestRaised(false);
    setDonorOffered(false);
    setRoadBlocked(false);
    setRouteStage('normal');
    setActiveIncident([]);
    setManualStage(0);
    setShowDisasterPicker(false);
    setRouteCoords([]);
    setVehicleRoutes({});
    setLogs([]);
  };

  const handleApproveTransfer = (type, customRequest = null) => {
    const campus = customRequest?.campus || selectedNeed.campus;
    const resource = customRequest?.resource || selectedNeed.resource;
    const quantity = customRequest?.quantity || (type === 'water' ? '2000' : '30');
    const donor = customRequest?.donor || (campus === 'Campus B' ? 'Campus A' : 'Campus B');
    const dispatchRoute = customRequest?.route?.length > 1 ? customRequest.route : routeCoords;
    const dispatchDistance = customRequest?.distanceKm ?? routeInfo.distanceKm;
    const dispatchDuration = customRequest?.durationMin ?? routeInfo.durationMin;

    // These IDs must match VALID_VEHICLES in resqflow-realtime-server.cjs
    // and the vehicle IDs used by DriverTracker.jsx.
    const vehiclePool = resource === 'water'
      ? ['tanker-1', 'tanker-2', 'tanker-3']
      : ['medical-van-1', 'medical-van-2'];

    const busyVehicleIds = new Set(
      Object.values(vehicles)
        .filter((vehicle) => vehicle.status === 'in_transit')
        .map((vehicle) => vehicle.vehicleId)
    );

    const vehicleId = vehiclePool.find((id) => !busyVehicleIds.has(id));

    if (!vehicleId) {
      window.alert(`All ${resource === 'water' ? 'water tankers' : 'medical vans'} are currently in transit. Wait for a vehicle to become available.`);
      return;
    }

    setTransferApproved(true);
    setTransferStatus('in_transit');
    setIsDisasterSimulated(true);
    setRouteStage('rerouted');
    setManualStage(2);
    setRoadBlocked(false);

    const vehicleNumber = vehicleId.split('-').pop();
    const vehicleName = resource === 'water'
      ? `Tanker ${vehicleNumber}`
      : `Medical Van ${vehicleNumber}`;

    const payload = {
      vehicleId,
      name: vehicleName,
      donor,
      target: campus,
      resource,
      quantity: Number(quantity) || 0,
      status: 'in_transit',
      lat: campusLocations[donor][0],
      lon: campusLocations[donor][1],
      etaMin: dispatchDuration || 15,
      distanceKm: dispatchDistance || 12.2,
      route: dispatchRoute?.length > 1 ? dispatchRoute : [
        campusLocations[donor],
        campusLocations[campus]
      ]
    };

    const currentRoute = dispatchRoute?.length > 1
      ? dispatchRoute
      : [campusLocations[donor], campusLocations[campus]];

    setVehicles((prev) => ({
      ...prev,
      [vehicleId]: {
        ...payload,
        lat: campusLocations[donor][0],
        lon: campusLocations[donor][1],
        etaMin: dispatchDuration || 15,
        progressPercent: 0,
        lastSeen: Date.now()
      }
    }));

    setVehicleRoutes((prev) => ({
      ...prev,
      [vehicleId]: {
        coords: currentRoute,
        distanceKm: dispatchDistance || 12.2,
        durationMin: dispatchDuration || 15,
        donor,
        target: campus
      }
    }));

    socket?.emit('dispatch:create', payload);

    const newLog = {
      id: Date.now(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      action: 'dispatch',
      transfer: `${Number(quantity).toLocaleString()} ${resource === 'water' ? 'L water' : 'units medicine'}: ${donor} -> ${campus}`
    };
    setLogs((prev) => [newLog, ...prev]);

    setActiveIncident((prev) => [
      ...prev,
      `Dispatch approved — ${vehicleName} (${vehicleId}) assigned. Waiting for driver's live GPS.`
    ]);

    return vehicleId;
  };

  const handleApproveRequest = async (approvedRequest) => {
    if (!approvedRequest || approvedRequest.status !== 'Pending') return;

    const { id, campus, resource, quantity } = approvedRequest;
    const donor = campus === 'Campus B' ? 'Campus A' : 'Campus B';
    const alternate = Object.keys(campusLocations).find(
      (name) => name !== donor && name !== campus
    );
    const normalPoints = [campusLocations[donor], campusLocations[campus]];
    const reroutePoints = alternate
      ? [campusLocations[donor], campusLocations[alternate], campusLocations[campus]]
      : normalPoints;

    setSelectedNeed({ campus, resource });
    setIsDisasterSimulated(true);
    setTransferApproved(false);
    setTransferStatus('idle');
    setRoadBlocked(false);
    setRouteStage('detecting');
    setManualStage(1);
    setRerouteInfo(null);
    setRequestRaised(true);
    setActiveTab('Requests');
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: 'Approved' } : r));
    setRequestFlows((prev) => ({
      ...prev,
      [id]: { stage: 'detecting', donor, alternate, coords: [], oldCoords: [], distanceKm: 0, durationMin: 0, vehicleId: null, error: null }
    }));
    setActiveIncident([
      `${resource === 'water' ? 'Water' : 'Medicine'} shortage detected at ${campus}`,
      `${donor} selected as donor`,
      `Live road check started for ${donor} → ${campus}`
    ]);

    try {
      // STEP 1 — fetch and display the actual normal road route.
      const normal = await fetchRoute(normalPoints);
      setRequestFlows((prev) => ({ ...prev, [id]: { ...prev[id], stage: 'route_found', coords: normal.coords, distanceKm: normal.distanceKm, durationMin: normal.durationMin } }));
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // STEP 2 — blockage simulation, then recalculate through the alternate hub.
      setRoadBlocked(true);
      setRouteStage('rerouting');
      setRequestFlows((prev) => ({ ...prev, [id]: { ...prev[id], stage: 'blocked', oldCoords: normal.coords } }));
      setActiveIncident((prev) => [...prev, `Road blockage detected on ${donor} → ${campus} — recalculating`]);
      await new Promise((resolve) => setTimeout(resolve, 900));

      const rerouted = await fetchRoute(reroutePoints);
      setRerouteInfo({ oldRoute: normal.coords, distanceKm: rerouted.distanceKm, durationMin: rerouted.durationMin, reason: `Road blockage detected. Alternate route selected${alternate ? ` via ${alternate}` : ''}.` });
      setRoadBlocked(false);
      setRouteStage('rerouted');
      setManualStage(2);
      setRequestFlows((prev) => ({ ...prev, [id]: { ...prev[id], stage: 'rerouted', coords: rerouted.coords, oldCoords: normal.coords, distanceKm: rerouted.distanceKm, durationMin: rerouted.durationMin } }));
      setActiveIncident((prev) => [...prev, `Alternate route calculated${alternate ? ` via ${alternate}` : ''} — dispatching vehicle`]);

      // STEP 3 — dispatch using the existing Socket.IO + driver GPS handler.
      const dispatchedVehicleId = handleApproveTransfer(resource, {
        campus, resource, quantity, donor,
        route: rerouted.coords,
        distanceKm: rerouted.distanceKm,
        durationMin: rerouted.durationMin
      });
      if (!dispatchedVehicleId) {
        setRequestFlows((prev) => ({ ...prev, [id]: { ...prev[id], stage: 'failed', error: 'No available vehicle. Please retry when one is free.' } }));
        setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: 'Pending' } : r));
        return;
      }

     const vehicleId = dispatchedVehicleId || vehicle?.vehicleId || (resource === 'water' ? ['tanker-1', 'tanker-2', 'tanker-3'] : ['medical-van-1', 'medical-van-2']).find((vid) => vehicleRoutes[vid]?.target === campus);
      setRequestFlows((prev) => ({ ...prev, [id]: { ...prev[id], stage: 'dispatched', vehicleId } }));
      setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: 'Dispatched', vehicleId } : r));
      setActiveIncident((prev) => [...prev, `Request approved — ${quantity} units of ${resource} dispatched to ${campus}`]);
    } catch (error) {
      setRequestFlows((prev) => ({ ...prev, [id]: { ...prev[id], stage: 'failed', error: error?.message || 'Workflow failed' } }));
      setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: 'Pending' } : r));
    }
  };

  const reportRoadBlock = async (e) => {
    e?.preventDefault();
    setShowBlockReport(false);

    const oldRoute = routeCoords;
    const report = {
      id: Date.now(),
      road: reportedRoad,
      type: blockReportText,
      reportedAt: new Date().toISOString(),
      status: 'confirmed_for_reroute'
    };

    setRoadReports((prev) => [report, ...prev].slice(0, 10));
    setRoadBlocked(true);
    setRouteStage('rerouting');
    setActiveIncident((prev) => [...prev, `Public road report received: ${reportedRoad} — ${blockReportText}`]);
    socket?.emit('road:report', report);

    setRouteLoading(true);
    try {
      const coords = [
        campusLocations[routePlan.donor],
        campusLocations[alternateHub],
        campusLocations[routePlan.target]
      ].map(([lat, lon]) => `${lon},${lat}`).join(';');

      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`
      );
      if (!response.ok) throw new Error('reroute unavailable');
      const data = await response.json();
      const route = data?.routes?.[0];
      const geometry = route?.geometry?.coordinates || [];
      const newRoute = geometry.map(([lon, lat]) => [lat, lon]);

      setRouteCoords(newRoute);
      const newDistance = Number((route.distance / 1000).toFixed(1));
      const newDuration = Math.max(1, Math.ceil(route.duration / 60));

      setRouteInfo({ distanceKm: newDistance, durationMin: newDuration });
      setRerouteInfo({
        oldRoute,
        distanceKm: newDistance,
        durationMin: newDuration,
        reason: `${blockReportText}. Alternate route selected via ${alternateHub}.`
      });

      const activeVehicleIds = Object.values(vehicles)
        .filter((vehicle) => vehicle.status === 'in_transit')
        .map((vehicle) => vehicle.vehicleId);

      setVehicleRoutes((prev) => {
        const next = { ...prev };
        activeVehicleIds.forEach((vehicleId) => {
          next[vehicleId] = {
            ...next[vehicleId],
            coords: newRoute,
            distanceKm: newDistance,
            durationMin: newDuration
          };
        });
        return next;
      });

      activeVehicleIds.forEach((vehicleId) => {
        socket?.emit('vehicle:reroute', {
          vehicleId,
          route: newRoute,
          etaMin: newDuration
        });
      });

      setRouteStage('rerouted');
      setActiveIncident((prev) => [
        ...prev,
        `ResQFlow redirected the vehicle via ${alternateHub} — new ETA ${newDuration} min`
      ]);
    } finally {
      setRouteLoading(false);
    }
  };

  const handleStockUpdate = (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const campus = form.get('campus');
    const resource = form.get('resource');
    const stockValue = Math.max(0, Number(form.get('stock')) || 0);
    const usage = Math.max(0, Number(form.get('usage')) || 0);
    setStock((prev) => ({ ...prev, [campus]: { ...prev[campus], [resource]: stockValue } }));
    setCampusStockUpdates((prev) => [{ id: Date.now(), campus, resource, stock: stockValue, usage, updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...prev]);
    setActiveIncident((prev) => [...prev, `Stock updated — ${campus}: ${stockValue} ${resource} available`]);
    socket?.emit('stock:update', { campus, resource, stock: stockValue });
  };

  const handleRaiseRequest = (e) => {
    e.preventDefault();
    const newRequest = { id: Date.now(), campus: reqCamp, resource: reqResource, quantity: reqQty, hours: reqHours, status: 'Pending', createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setRequests((prev) => [newRequest, ...prev]);
    setRequestRaised(true);
    setActiveIncident((prev) => [...prev, `Request raised — ${reqCamp} needs ${reqQty} units of ${reqResource} within ${reqHours} hours`]);
    setActiveTab('Requests');
  };

  const handleOfferDonation = (e) => {
    e.preventDefault();
    const newDonation = { id: Date.now(), donor: donorName, resource: donorResource, quantity: donorQty, campus: donorCamp, status: 'Accepted', createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setDonations((prev) => [newDonation, ...prev]);
    setDonorOffered(true);
    setActiveIncident((prev) => [...prev, `Donation offered — ${donorName} offered ${donorQty} units of ${donorResource} to ${donorCamp}`]);
  };

  const activeVehicle = Object.values(vehicles).find(
    (v) => v.target === selectedNeed.campus && v.status === 'in_transit'
  );
  const vehiclePosition = activeVehicle
    ? [Number(activeVehicle.lat), Number(activeVehicle.lon)]
    : campusLocations[routePlan.donor];
  const remainingMinutes = activeVehicle?.etaMin ?? routeInfo.durationMin ?? 15;
  const progressPercent = activeVehicle?.progressPercent ?? 0;
  const liveVehicleCount = Object.values(vehicles).filter((v) => v.status === 'in_transit').length;
  
const generatePDFReport = () => {
  const pdf = new jsPDF();
  let y = 20;

  const line = (text) => {
    const lines = pdf.splitTextToSize(String(text), 175);

    if (y + lines.length * 7 > 275) {
      pdf.addPage();
      y = 20;
    }

    pdf.text(lines, 15, y);
    y += lines.length * 7;
  };

  pdf.setFontSize(20);
  line("ResQFlow Disaster Response Report");

  pdf.setFontSize(10);
  line(`Generated: ${new Date().toLocaleString()}`);
  line(`Incident ID: ${currentIncidentId || "N/A"}`);
  line(`Simulation: ${isDisasterSimulated ? "Active" : "Inactive"}`);
  line("");

  pdf.setFontSize(14);
  line("Incident Details");

  pdf.setFontSize(10);
  line(`Affected Campus: ${selectedNeed.campus}`);
  line(`Resource: ${selectedNeed.resource}`);
  line(`Donor Campus: ${routePlan.donor}`);
  line(`Transfer Status: ${transferStatus}`);
  line(`Distance: ${routeInfo.distanceKm} km`);
  line(`ETA: ${routeInfo.durationMin} minutes`);
  line(`Road Block: ${roadBlocked ? "Yes" : "No"}`);
  line("");

  pdf.setFontSize(14);
  line("Campus Stock");

  pdf.setFontSize(10);
  Object.entries(stock).forEach(([campus, values]) => {
    line(`${campus}: Water ${values.water} | Medicine ${values.medicine}`);
  });

  line("");

  pdf.setFontSize(14);
  line("Decision Log");

  pdf.setFontSize(10);
  logs.forEach((log) => {
    line(`${log.time} | ${log.action} | ${log.transfer}`);
  });

  pdf.save("ResQFlow_Report.pdf");
};


  return (
    <div className="flex h-screen bg-slate-100 text-slate-800 font-sans overflow-hidden">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-60 bg-slate-900 text-white flex flex-col justify-between shrink-0">
        <div>
          <div className="p-4 border-b border-slate-800 flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Droplets className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">ResQFlow</h1>
              <p className="text-[11px] text-slate-400">Smart Response. Safer Lives.</p>
            </div>
          </div>

          <nav className="p-3 space-y-1 text-sm font-medium">
            {['Overview', 'Campuses', 'Requests', 'Donors', 'Reports'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-full text-left px-3.5 py-2.5 rounded-lg flex items-center justify-between transition ${
                  activeTab === tab 
                    ? 'bg-blue-600/20 text-blue-400 font-semibold border-l-4 border-blue-500' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span>{tab}</span>
                {tab === 'Overview' && (isDisasterSimulated && !transferApproved) && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500">
          AICTE IDEA Lab — IDEATHON 2026
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        
        {/* HEADER */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{activeTab}</h2>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
              <Clock3 className="w-3 h-3" />
              {isDisasterSimulated ? 'LIVE simulation • events updating' : 'Monitoring • Update: 17:29:20'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSimulateDisaster}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-sm flex items-center gap-1.5 transition cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4" /> Simulate disaster
            </button>
            <button
              onClick={handleResetDemo}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-semibold text-xs px-4 py-2.5 rounded-lg transition cursor-pointer"
            >
              Reset demo
            </button>
          </div>
        </header>

        {showDisasterPicker && (
          <div className="fixed inset-0 z-[5000] bg-slate-900/50 flex items-center justify-center p-4">
            <div className="relative z-[5001] bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Simulate a disaster</h3>
                  <p className="text-xs text-slate-500 mt-1">Choose exactly which campus is in need.</p>
                </div>
                <button onClick={() => setShowDisasterPicker(false)} className="text-slate-400 hover:text-slate-700 text-xl">×</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Campus in need</label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {Object.keys(disasterOptions).map((campus) => (
                      <button
                        key={campus}
                        onClick={() => setSelectedNeed((prev) => ({ ...prev, campus }))}
                        className={`p-3 rounded-xl border text-xs font-bold ${
                          selectedNeed.campus === campus
                            ? 'border-rose-500 bg-rose-50 text-rose-700'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                      >
                        {campus}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Resource shortage</label>
                  <select
                    value={selectedNeed.resource}
                    onChange={(e) => setSelectedNeed((prev) => ({ ...prev, resource: e.target.value }))}
                    className="w-full mt-2 p-3 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="water">Water shortage</option>
                    <option value="medicine">Medicine shortage</option>
                  </select>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
                  <b>{selectedNeed.campus}</b> will be marked as the incident location. ResQFlow will identify a donor campus, check the live road route, and recalculate if a road is blocked.
                </div>

                <button
                  onClick={runDisasterSimulation}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm py-3 rounded-xl"
                >
                  Start simulation
                </button>
              </div>
            </div>
          </div>
        )}

        {showBlockReport && (
          <div className="fixed inset-0 z-[3000] bg-slate-900/60 flex items-center justify-center p-4">
            <form onSubmit={reportRoadBlock} className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Report a road problem</h3>
                  <p className="text-xs text-slate-500 mt-1">Anyone at the campus can report a blockage so ResQFlow can recalculate the route.</p>
                </div>
                <button type="button" onClick={() => setShowBlockReport(false)} className="text-slate-400 hover:text-slate-700 text-xl">×</button>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Which road is affected?</label>
                <select value={reportedRoad} onChange={(e) => setReportedRoad(e.target.value)} className="w-full mt-2 p-3 bg-slate-50 border border-slate-300 rounded-lg text-sm">
                  <option>Current delivery route</option>
                  <option>Campus A ↔ Campus B</option>
                  <option>Campus B ↔ Campus C</option>
                  <option>Campus A ↔ Campus C</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">What did you observe?</label>
                <select value={blockReportText} onChange={(e) => setBlockReportText(e.target.value)} className="w-full mt-2 p-3 bg-slate-50 border border-slate-300 rounded-lg text-sm">
                  <option>Road blocked / traffic disruption</option>
                  <option>Flooded road</option>
                  <option>Accident / vehicle obstruction</option>
                  <option>Debris on road</option>
                  <option>Emergency road closure</option>
                </select>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <b>Current trip:</b> {routePlan.donor} → {selectedNeed.campus}. After submission, ResQFlow will mark the route as blocked, find an alternate road and update the ETA.
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowBlockReport(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-2.5 rounded-lg">Cancel</button>
                <button type="submit" className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs py-2.5 rounded-lg">Submit road report</button>
              </div>
            </form>
          </div>
        )}

        {/* BODY */}
        <main className="p-8 space-y-6">

          {/* OVERVIEW TAB */}
          {activeTab === 'Overview' && (
            <>
              {/* LIVE INCIDENT BANNER */}
              {isDisasterSimulated ? (
                <div className="p-4 bg-rose-50 border-l-4 border-rose-600 rounded-r-xl shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-rose-900 flex items-center gap-2">
                        <Radio className="w-4 h-4 animate-pulse" />
                        Multi-campus disaster mode active
                      </h3>
                      <p className="text-xs text-rose-700 mt-0.5">
                        {selectedNeed.campus} {selectedNeed.resource} shortage • {routePlan.donor} selected as donor • live route monitoring
                      </p>
                    </div>
                    <span className="text-[10px] font-bold uppercase bg-rose-600 text-white px-2.5 py-1 rounded-full">
                      LIVE
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 border-l-4 border-emerald-600 rounded-r-xl shadow-sm">
                  <h3 className="text-base font-bold text-emerald-900">
                    All campuses are covered.
                  </h3>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    ResQFlow monitors stock, incidents and routes continuously and flags shortages before they become critical.
                  </p>
                </div>
              )}

              {/* THREE CAMP CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Object.keys(stock).map((campus) => {
                  const status = getCampusStatus(campus);
                  const waterHours = getCampusHours(campus, 'water');
                  const medicineHours = getCampusHours(campus, 'medicine');
                  const waterPercent = getCampusPercent(campus, 'water');
                  const medicinePercent = getCampusPercent(campus, 'medicine');
                  const isAffected = selectedNeed.campus === campus && isDisasterSimulated && transferStatus !== 'delivered';

                  return (
                    <div key={campus} className={`bg-white p-5 rounded-xl border shadow-sm space-y-4 ${isAffected ? 'border-rose-300 ring-2 ring-rose-100' : 'border-slate-200'}`}>
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-800">{campus}</h4>
                        {status && (
                          <span className="bg-rose-100 text-rose-700 font-bold text-[9px] px-2 py-1 rounded-full">{status}</span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="flex items-center gap-1 text-slate-600"><Droplets className="w-3.5 h-3.5 text-blue-500" /> Water</span>
                          <span className="text-slate-400">Reserve {stockMeta[campus].reserveWater}</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900">{waterHours} <span className="text-xs font-normal text-slate-500">hours left</span></div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div className={`h-full ${isAffected && selectedNeed.resource === 'water' ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${waterPercent}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1 pt-2 border-t border-slate-100">
                        <div className="flex justify-between text-xs">
                          <span className="flex items-center gap-1 text-slate-600"><Pill className="w-3.5 h-3.5 text-emerald-500" /> Medicine</span>
                          <span className="text-slate-400">Reserve {stockMeta[campus].reserveMedicine}</span>
                        </div>
                        <div className="text-2xl font-bold text-slate-900">{medicineHours} <span className="text-xs font-normal text-slate-500">hours left</span></div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div className={`h-full ${isAffected && selectedNeed.resource === 'medicine' ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${medicinePercent}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* MAP & RECOMMENDED ACTIONS GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* MAP CARD */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <h4 className="font-bold text-slate-800 mb-3">Live map</h4>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg h-72 relative overflow-hidden">
                    <MapContainer
                      center={campusLocations[selectedNeed.campus]}
                      zoom={13}
                      scrollWheelZoom={true}
                      className="w-full h-full z-0"
                    >
                      <TileLayer
                        attribution='&copy; OpenStreetMap contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />

                      {Object.entries(campusLocations).map(([campus, position]) => (
                        <CircleMarker
                          key={campus}
                          center={position}
                          radius={selectedNeed.campus === campus && isDisasterSimulated ? 12 : 8}
                          pathOptions={{
                            color: selectedNeed.campus === campus && isDisasterSimulated ? '#dc2626' : '#2563eb',
                            fillColor: selectedNeed.campus === campus && isDisasterSimulated ? '#ef4444' : '#3b82f6',
                            fillOpacity: 0.9
                          }}
                        >
                          <Popup>
                            <b>{campus}</b><br />
                            {selectedNeed.campus === campus && isDisasterSimulated
                              ? `${selectedNeed.resource} shortage`
                              : 'Resource hub'}
                          </Popup>
                        </CircleMarker>
                      ))}

                      {Object.entries(vehicleRoutes).map(([vehicleId, trip]) => (
                        trip.coords?.length > 1 && (
                          <React.Fragment key={`route-${vehicleId}`}>
                            {roadBlocked && rerouteInfo?.oldRoute?.length > 1 && (
                              <Polyline
                                positions={rerouteInfo.oldRoute}
                                pathOptions={{ color: '#ef4444', weight: 4, dashArray: '8 10', opacity: 0.65 }}
                              />
                            )}
                            <Polyline
                              positions={trip.coords}
                              pathOptions={{
                                color: trip.target === selectedNeed.campus ? '#2563eb' : '#7c3aed',
                                weight: 6,
                                opacity: 0.9
                              }}
                            />
                            <CircleMarker center={trip.coords[0]} radius={5} pathOptions={{ color: '#059669', fillColor: '#34d399', fillOpacity: 1 }}>
                              <Popup><b>Dispatch start</b><br />{trip.donor} • {vehicleId}</Popup>
                            </CircleMarker>
                            <CircleMarker center={trip.coords[trip.coords.length - 1]} radius={6} pathOptions={{ color: '#dc2626', fillColor: '#f87171', fillOpacity: 1 }}>
                              <Popup><b>Delivery destination</b><br />{trip.target} • {vehicleId}</Popup>
                            </CircleMarker>
                          </React.Fragment>
                        )
                      ))}

                      {Object.values(vehicles).map((vehicle) => (
                        vehicle.lat != null && vehicle.lon != null && (
                          <CircleMarker
                            key={vehicle.vehicleId}
                            center={[Number(vehicle.lat), Number(vehicle.lon)]}
                            radius={9}
                            pathOptions={{
                              color: vehicle.status === 'in_transit' ? '#1d4ed8' : '#059669',
                              fillColor: vehicle.status === 'in_transit' ? '#60a5fa' : '#34d399',
                              fillOpacity: 1
                            }}
                          >
                            <Popup>
                              <b>🚚 {vehicle.name}</b><br />
                              {vehicle.status === 'in_transit' ? 'LIVE GPS • In transit' : vehicle.status}<br />
                              {vehicle.resource} • {vehicle.quantity} units/L<br />
                              ETA: {vehicle.etaMin ?? '—'} min<br />
                              Last GPS: {vehicle.lastSeen ? new Date(vehicle.lastSeen).toLocaleTimeString() : '—'}
                            </Popup>
                          </CircleMarker>
                        )
                      ))}
                    </MapContainer>

                    <div className="absolute top-3 left-3 z-[1000] bg-white/95 border rounded-lg px-3 py-2 text-[10px] shadow-sm">
                      <p className="font-bold text-slate-800">REAL ROAD MAP</p>
                      <p className="text-slate-500">OpenStreetMap + live route calculation</p>
                    </div>

                    {isDisasterSimulated && (
                      <div className="absolute bottom-3 left-3 right-3 z-[1000] bg-white/95 border rounded-lg px-3 py-2 text-[10px] shadow-sm">
                        <div className="flex justify-between items-center gap-3">
                          <span className="font-semibold">
                            {routeStage === 'detecting' && '⚡ Detecting incident...'}
                            {routeStage === 'rerouting' && '🔄 Road condition changed — recalculating...'}
                            {routeStage === 'rerouted' && (transferStatus === 'in_transit' ? `🚚 Vehicle en route to ${selectedNeed.campus}` : `✓ Alternate route active to ${selectedNeed.campus}`)}
                          </span>
                          {routeLoading && <span className="text-slate-500">Finding route...</span>}
                        </div>
                        {routeStage === 'rerouted' && (
                          <div className="mt-1 flex flex-wrap gap-3 text-slate-600">
                            <span><b>{routeInfo.distanceKm || '—'} km</b> route</span>
                            <span><b>{transferStatus === 'in_transit' ? remainingMinutes : routeInfo.durationMin || '—'} min</b> {transferStatus === 'in_transit' ? 'remaining' : 'estimated'}</span>
                            {transferStatus === 'in_transit' && <span><b>{progressPercent}%</b> complete</span>}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/90 text-white rounded-lg px-3 py-2 text-[10px] shadow-sm">
                      <b>{liveVehicleCount}</b> live vehicle{liveVehicleCount === 1 ? '' : 's'} • {fleetConnected ? 'GPS link connected' : 'GPS link offline'}
                    </div>

                    {rerouteInfo && roadBlocked && (
                      <div className="absolute top-16 left-3 z-[1000] bg-white/95 border border-amber-200 rounded-lg px-3 py-2 text-[10px] shadow-sm max-w-[250px]">
                        <p className="font-bold text-amber-800">↪ REROUTED AROUND BLOCK</p>
                        <p className="text-slate-600 mt-1">
                          New route: <b>{rerouteInfo.distanceKm} km</b> • <b>{rerouteInfo.durationMin} min</b>
                        </p>
                        <p className="text-slate-500 mt-0.5">{rerouteInfo.reason}</p>
                      </div>
                    )}

                    <button
                      onClick={() => setShowBlockReport(true)}
                      className="absolute top-3 right-3 z-[1000] bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg px-3 py-2 text-[10px] font-bold shadow-sm"
                    >
                      Report road block
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-2 flex justify-between gap-3">
                    <span>
                      Incident: <b>{selectedNeed.campus}</b> • {selectedNeed.resource} • Route: {routePlan.donor} → {selectedNeed.campus}
                      {routeInfo.distanceKm ? ` • ${routeInfo.distanceKm} km • ${routeInfo.durationMin} min` : ''}
                    </span>
                    {roadBlocked && <span className="font-semibold text-rose-600">Road block reported • alternate route active</span>}
                  </div>
                </div>

                {/* RECOMMENDED ACTIONS */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <h4 className="font-bold text-slate-800 mb-3">Recommended actions</h4>

                  {isDisasterSimulated && transferStatus === 'in_transit' ? (
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h5 className="font-bold text-slate-900 text-sm flex items-center gap-2"><Truck className="w-4 h-4 text-blue-600" /> Vehicle in transit</h5>
                          <p className="text-xs text-slate-600 mt-1">{routePlan.donor} ➔ {selectedNeed.campus} • live vehicle tracking</p>
                        </div>
                        <span className="bg-blue-100 text-blue-700 font-bold text-[10px] px-2 py-0.5 rounded">DISPATCHED</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white rounded-lg border p-3"><p className="text-[10px] text-slate-500">ETA</p><p className="text-xl font-bold text-blue-700">{remainingMinutes} min</p></div>
                        <div className="bg-white rounded-lg border p-3"><p className="text-[10px] text-slate-500">Progress</p><p className="text-xl font-bold text-slate-800">{progressPercent}%</p></div>
                        <div className="bg-white rounded-lg border p-3"><p className="text-[10px] text-slate-500">Route</p><p className="text-xl font-bold text-slate-800">{routeInfo.distanceKm} km</p></div>
                      </div>
                      <div className="bg-white border rounded-lg p-3 text-[11px] text-slate-600">
                        <b>Waiting staff view:</b> Vehicle is currently live on the map. Expected arrival in about <b>{remainingMinutes} minutes</b>. If a road is reported blocked, ResQFlow will recalculate the route and update the ETA.
                      </div>
                    </div>
                  ) : isDisasterSimulated && transferStatus === 'delivered' ? (
                    <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl text-center text-emerald-800">
                      <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                      <p className="font-bold text-sm">Delivery completed</p>
                      <p className="text-xs mt-1">Vehicle arrived at {selectedNeed.campus}. The resource transfer is complete.</p>
                    </div>
                  ) : isDisasterSimulated ? (
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h5 className="font-bold text-slate-900 text-sm">{selectedNeed.resource === 'water' ? 'Send 2,000 L of water' : 'Send 30 units of medicine'}</h5>
                          <p className="text-xs text-slate-600">
                          Route selected: {routePlan.donor} ➔ {selectedNeed.campus} • live road route
                        </p>
                        </div>
                        <span className="bg-rose-100 text-rose-700 font-bold text-[10px] px-2 py-0.5 rounded">Priority 01</span>
                      </div>

                      <div className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                        <p className="font-semibold text-slate-800">Why this transfer?</p>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                          <li>{selectedNeed.campus}'s {selectedNeed.resource} stock is projected to reach critical level.</li>
                          <li>{routePlan.donor} has sufficient reserve available for transfer.</li>
                          <li>{roadBlocked ? 'Road condition changed; ResQFlow recalculated the route automatically.' : 'Live road check completed; route is currently available.'}</li>
                        </ul>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveTransfer(selectedNeed.resource)}
                          disabled={routeStage !== 'rerouted' || routeLoading}
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> {routeStage !== 'rerouted' ? 'Waiting for route' : 'Approve & dispatch'}
                        </button>
                        <button className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-2 rounded-lg">Modify</button>
                        <button className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-2 rounded-lg">Decline</button>
                      </div>
                    </div>
                  ) : requestRaised && !transferApproved ? (
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h5 className="font-bold text-slate-900 text-sm">
  Send {reqQty} units of {reqResource}
</h5>
                          <p className="text-xs text-slate-600">{routePlan.donor} ➔ {selectedNeed.campus} • live road route</p>
                        </div>
                        <span className="bg-amber-100 text-amber-700 font-bold text-[10px] px-2 py-0.5 rounded">Priority 02</span>
                      </div>

                      <div className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                        <p className="font-semibold text-slate-800">Why this transfer?</p>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                          <li>{selectedNeed.campus} raised a critical request for {reqQty} units {reqResource} within {reqHours} hours.</li>
                          <li>{routePlan.donor} holds sufficient {reqResource} reserve for transfer.</li>
                        </ul>
                      </div>

                      <div className="flex gap-2">
                        <button
  onClick={handleApproveRequest}
  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center gap-1 cursor-pointer"
>
  <Check className="w-3.5 h-3.5" /> Approve
</button>
                        <button className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-2 rounded-lg">Modify</button>
                        <button className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-2 rounded-lg">Decline</button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-xl text-center text-emerald-800">
                      <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                      <p className="font-bold text-sm">Every need is covered. No transfers to approve.</p>
                    </div>
                  )}

                </div>

              </div>

              {/* LIVE FLEET TRACKING */}
              {isDisasterSimulated && (
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-bold text-slate-800 flex items-center gap-2"><Navigation className="w-4 h-4 text-blue-600" /> Live fleet tracking</h4>
                      <p className="text-[10px] text-slate-500">Real GPS comes from each driver's phone via the tracking page.</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${fleetConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {fleetConnected ? 'GPS SERVICE ONLINE' : 'GPS SERVICE OFFLINE'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.values(vehicles).length === 0 ? (
                      <div className="text-xs text-slate-500 bg-slate-50 border rounded-lg p-4">
                        No live vehicles yet. Approve a transfer, then open <b>DriverTracker.jsx</b> on the driver's phone and allow location access.
                      </div>
                    ) : Object.values(vehicles).map((vehicle) => (
                      <div key={vehicle.vehicleId} className="border rounded-xl p-4 bg-slate-50">
                        <div className="flex justify-between">
                          <div>
                            <p className="font-bold text-sm">{vehicle.name}</p>
                            <p className="text-[10px] text-slate-500">{vehicle.resource} • {vehicle.quantity}</p>
                          </div>
                          <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{vehicle.status}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                          <div className="bg-white border rounded-lg p-2"><span className="text-slate-400">ETA</span><br/><b>{vehicle.etaMin ?? '—'} min</b></div>
                          <div className="bg-white border rounded-lg p-2"><span className="text-slate-400">GPS</span><br/><b>{vehicle.lat != null ? 'LIVE' : 'WAITING'}</b></div>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2">
                          {vehicle.lat != null ? `${Number(vehicle.lat).toFixed(5)}, ${Number(vehicle.lon).toFixed(5)}` : 'Waiting for driver GPS…'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* LIVE INCIDENTS + MANUAL VS RESQFLOW */}
              {isDisasterSimulated && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-slate-900 text-white p-5 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold flex items-center gap-2"><Radio className="w-4 h-4 text-rose-400" /> Live incident feed</h4>
                      <span className="text-[9px] uppercase font-bold bg-rose-500 px-2 py-1 rounded-full animate-pulse">Live</span>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-auto">
                      {activeIncident.map((incident, index) => (
                        <div key={index} className="flex gap-2 text-[11px] border-b border-slate-800 pb-2">
                          <span className="text-slate-500 font-mono">now</span>
                          <span>{incident}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-slate-800">Manual response vs ResQFlow</h4>
                      <span className="text-[9px] text-slate-400">Illustrative prototype comparison</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Manual</p>
                        <p className="text-2xl font-bold text-slate-800">~45 min</p>
                        <p className="text-[10px] text-slate-500 mt-1">Phone calls → stock check → road check → transport</p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-[10px] font-bold text-blue-600 uppercase mb-2">ResQFlow</p>
                        <p className="text-2xl font-bold text-blue-700">~2 min</p>
                        <p className="text-[10px] text-blue-700 mt-1">Detect → prioritize → reroute → recommend</p>
                      </div>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-3">*Illustrative comparison for the prototype, not a measured real-world performance claim.</p>
                  </div>
                </div>
              )}

            </>
          )}

          {/* CAMPUSES TAB */}
          {activeTab === 'Campuses' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <form onSubmit={handleStockUpdate} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h4 className="font-bold text-slate-800">Update stock</h4>
                <p className="text-xs text-slate-400">Fill in ready stock, consumption rate and reserve.</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-600 font-semibold">Campus</label>
                    <select name="campus" className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded-lg">
                      <option>Campus A</option><option>Campus B</option><option>Campus C</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-600 font-semibold">Resource</label>
                    <select name="resource" className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded-lg">
                      <option value="water">water</option><option value="medicine">medicine</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-600 font-semibold">Stock now</label>
                    <input name="stock" type="number" min="0" placeholder="1000" required className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="text-slate-600 font-semibold">Use per hour</label>
                    <input name="usage" type="number" min="0" placeholder="25" required className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded-lg" />
                  </div>
                </div>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-lg cursor-pointer">Save stock update</button>
                {campusStockUpdates.length > 0 && (
                  <div className="space-y-2">
                    {campusStockUpdates.map((update) => (
                      <div key={update.id} className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs">
                        <div className="flex justify-between"><span className="font-bold text-emerald-800">✓ Stock updated</span><span className="text-emerald-600">{update.updatedAt}</span></div>
                        <p className="text-emerald-700 mt-1">{update.campus} • {update.resource} • {update.stock} available • {update.usage}/hour usage</p>
                      </div>
                    ))}
                  </div>
                )}
              </form>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <h4 className="font-bold text-slate-800">Vehicles</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div><p className="font-bold text-slate-800">Tanker 1 <span className="font-normal text-slate-500">at Campus B</span></p><p className="text-[11px] text-slate-400">Capacity 1,000</p></div>
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-semibold text-[10px]">Available</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div><p className="font-bold text-slate-800">Van 1 <span className="font-normal text-slate-500">at Campus A</span></p><p className="text-[11px] text-slate-400">Capacity 500</p></div>
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-semibold text-[10px]">Available</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          
{/* REQUESTS TAB */}
{activeTab === 'Requests' && (
  <div className="space-y-6">

    {/* Page intro */}
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h3 className="text-lg font-bold text-slate-900">
          Resource Requests
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Manage campus shortages and emergency resource requirements.
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs bg-blue-50 border border-blue-100 text-blue-700 px-3 py-2 rounded-lg">
        <Radio className="w-4 h-4" />
        Request management
      </div>
    </div>

    {/* Request statistics */}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex justify-between items-center">
          <p className="text-xs text-slate-500 font-medium">Total Requests</p>
          <PackageCheck className="w-4 h-4 text-blue-600" />
        </div>
        <p className="text-2xl font-bold text-slate-900 mt-2">
          {requests.length}
        </p>
        <p className="text-[10px] text-slate-400 mt-1">
          All submitted requests
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex justify-between items-center">
          <p className="text-xs text-slate-500 font-medium">Pending</p>
          <Clock3 className="w-4 h-4 text-amber-500" />
        </div>
        <p className="text-2xl font-bold text-amber-600 mt-2">
          {requests.filter(r => r.status === 'Pending').length}
        </p>
        <p className="text-[10px] text-slate-400 mt-1">
          Awaiting approval
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex justify-between items-center">
          <p className="text-xs text-slate-500 font-medium">Dispatched</p>
          <Truck className="w-4 h-4 text-emerald-600" />
        </div>
        <p className="text-2xl font-bold text-emerald-600 mt-2">
          {requests.filter(r => r.status === 'Dispatched').length}
        </p>
        <p className="text-[10px] text-slate-400 mt-1">
          Resources on the way
        </p>
      </div>

    </div>

    {/* Main layout */}
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

      {/* CREATE REQUEST */}
      <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

        <div className="bg-slate-50 border-b border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Send className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900">
                Raise a request
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Submit a resource requirement
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleRaiseRequest} className="p-5 space-y-5">

          <div>
            <label className="text-xs font-semibold text-slate-700">
              Requesting campus
            </label>
            <select
              value={reqCamp}
              onChange={e => setReqCamp(e.target.value)}
              className="w-full mt-2 p-3 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option>Campus A</option>
              <option>Campus B</option>
              <option>Campus C</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">
              Resource required
            </label>

            <div className="grid grid-cols-2 gap-3 mt-2">

              <button
                type="button"
                onClick={() => setReqResource('water')}
                className={`p-3 rounded-xl border text-left transition ${
                  reqResource === 'water'
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Droplets className="w-5 h-5 text-blue-500 mb-2" />
                <p className="text-sm font-bold text-slate-800">Water</p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Water supply
                </p>
              </button>

              <button
                type="button"
                onClick={() => setReqResource('medicine')}
                className={`p-3 rounded-xl border text-left transition ${
                  reqResource === 'medicine'
                    ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Pill className="w-5 h-5 text-emerald-600 mb-2" />
                <p className="text-sm font-bold text-slate-800">Medicine</p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Medical supplies
                </p>
              </button>

            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">

            <div>
              <label className="text-xs font-semibold text-slate-700">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                required
                value={reqQty}
                onChange={e => setReqQty(e.target.value)}
                className="w-full mt-2 p-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">
                Required within
              </label>
              <div className="relative mt-2">
                <input
                  type="number"
                  min="1"
                  required
                  value={reqHours}
                  onChange={e => setReqHours(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
                />
                <span className="absolute right-3 top-3 text-xs text-slate-400">
                  hrs
                </span>
              </div>
            </div>

          </div>

          {/* Request preview */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <p className="text-[10px] font-bold text-blue-600 uppercase">
              Request preview
            </p>
            <p className="text-sm font-semibold text-slate-800 mt-1">
              {reqCamp} requires {reqQty || 0} {reqResource}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Priority based on required delivery time: {reqHours || 0} hours
            </p>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-3 rounded-lg flex items-center justify-center gap-2 transition"
          >
            <Send className="w-4 h-4" />
            Submit resource request
          </button>

        </form>
      </div>

      {/* REQUEST HISTORY */}
      <div className="xl:col-span-3 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

        <div className="p-5 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h4 className="font-bold text-slate-900">
              Request history
            </h4>
            <p className="text-[11px] text-slate-500 mt-1">
              Track submitted resource requests
            </p>
          </div>

          <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full">
            {requests.length} records
          </span>
        </div>

        {requests.length === 0 ? (
          <div className="p-12 text-center">
            <div className="bg-slate-100 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4">
              <PackageCheck className="w-7 h-7 text-slate-400" />
            </div>
            <h5 className="font-semibold text-slate-700 text-sm">
              No requests submitted
            </h5>
            <p className="text-xs text-slate-400 mt-2">
              New campus requests will appear here.
            </p>
          </div>
        ) : (

          <div className="divide-y divide-slate-100">

            {requests.map(request => (

              <div key={request.id} className="p-5 hover:bg-slate-50/70 transition">

                <div className="flex justify-between items-start gap-3">

                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-lg ${
                      request.resource === 'water'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-emerald-100 text-emerald-600'
                    }`}>
                      {request.resource === 'water'
                        ? <Droplets className="w-5 h-5" />
                        : <Pill className="w-5 h-5" />
                      }
                    </div>

                    <div>
                      <h5 className="font-bold text-sm text-slate-800">
                        {request.campus}
                      </h5>
                      <p className="text-xs text-slate-500 mt-1 capitalize">
                        {request.resource} requirement
                      </p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                    request.status === 'Dispatched'
                      ? 'bg-emerald-100 text-emerald-700'
                      : request.status === 'Approved'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {request.status.toUpperCase()}
                  </span>

                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">

                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                    <p className="text-[10px] text-slate-400">Quantity</p>
                    <p className="font-bold text-slate-800 text-sm mt-1">
                      {Number(request.quantity).toLocaleString()} units
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                    <p className="text-[10px] text-slate-400">Required within</p>
                    <p className="font-bold text-slate-800 text-sm mt-1">
                      {request.hours} hours
                    </p>
                  </div>

                </div>

                
                  {/* REQUEST ACTIONS */}
{request.status === 'Pending' && (
  <button
    onClick={() => handleApproveRequest(request)}
    className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-3 rounded-lg flex items-center justify-center gap-2 transition"
  >
    <Truck className="w-4 h-4" />
    Approve & Dispatch
  </button>
)}

{requestFlows[request.id] && (
  <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3">
    <div className="flex items-center justify-between"><h5 className="text-xs font-bold text-indigo-900">⚡ RESPONSE WORKFLOW</h5><span className="text-[10px] font-bold text-indigo-600">LIVE PROCESS</span></div>
    {[
      ['detecting', 'Shortage detected & donor selected'],
      ['route_found', 'Live road route calculated'],
      ['blocked', 'Road blockage detected'],
      ['rerouted', 'Alternate route calculated'],
      ['dispatched', 'Vehicle dispatched']
    ].map(([stage, label], index) => {
      const stages = ['detecting', 'route_found', 'blocked', 'rerouted', 'dispatched'];
      const current = stages.indexOf(requestFlows[request.id].stage);
      const complete = current >= index;
      return <div key={stage} className="flex items-center gap-2 text-xs"><span className={`w-5 h-5 rounded-full flex items-center justify-center ${complete ? 'bg-emerald-500 text-white' : 'bg-white border text-slate-400'}`}>{complete ? '✓' : index + 1}</span><span className={complete ? 'text-emerald-800 font-semibold' : 'text-slate-500'}>{label}</span>{requestFlows[request.id].stage === stage && <span className="ml-auto text-[10px] text-indigo-600 font-bold">{stage === 'dispatched' ? 'DONE' : 'ACTIVE'}</span>}</div>;
    })}
    <div className="rounded-lg overflow-hidden border border-indigo-200 bg-white"><div className="px-3 py-2 text-[10px] font-bold text-slate-600">ACTUAL ROAD ROUTE</div><div className="h-48"><MapContainer center={campusLocations[request.campus]} zoom={12} scrollWheelZoom={false} className="w-full h-full"><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />{Object.entries(campusLocations).map(([name, point]) => <CircleMarker key={name} center={point} radius={name === request.campus ? 9 : 6} pathOptions={{color:name === request.campus ? '#dc2626':'#2563eb',fillOpacity:.9}}><Popup>{name}</Popup></CircleMarker>)}{requestFlows[request.id].oldCoords?.length > 1 && <Polyline positions={requestFlows[request.id].oldCoords} pathOptions={{color:'#ef4444',weight:4,dashArray:'7 8'}} />}{requestFlows[request.id].coords?.length > 1 && <Polyline positions={requestFlows[request.id].coords} pathOptions={{color:'#2563eb',weight:5}} />}</MapContainer></div></div>
    <div className="grid grid-cols-2 gap-2 text-xs"><div className="bg-white border rounded-lg p-2"><span className="text-slate-500">Distance</span><p className="font-bold">{requestFlows[request.id].distanceKm || '—'} km</p></div><div className="bg-white border rounded-lg p-2"><span className="text-slate-500">Route ETA</span><p className="font-bold">{requestFlows[request.id].durationMin || '—'} min</p></div></div>
    <p className="text-xs text-indigo-700">Donor: <b>{requestFlows[request.id].donor}</b> → {requestFlows[request.id].alternate} → {request.campus}</p>
    {requestFlows[request.id].stage === 'failed' && <p className="text-xs text-red-600">{requestFlows[request.id].error}</p>}
  </div>
)}

{request.status === 'Dispatched' && (() => {
  const vehicle = (request.vehicleId && vehicles[request.vehicleId]) || Object.values(vehicles).find(
    v => v.target === request.campus &&
         v.resource === request.resource &&
         v.status === 'in_transit'
  );

  const route = vehicle
    ? vehicleRoutes[vehicle.vehicleId]
    : null;

  return (
    <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">

      <div className="flex justify-between items-center">
        <h5 className="font-bold text-sm text-slate-900">
          🚚 {vehicle?.name || 'Vehicle dispatched'}
        </h5>
        <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded">
          IN TRANSIT
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">

        <div className="bg-white border rounded-lg p-3">
          <p className="text-[10px] text-slate-500">ETA</p>
          <p className="text-lg font-bold text-blue-700">
            {vehicle?.etaMin ?? route?.durationMin ?? '--'} min
          </p>
        </div>

        <div className="bg-white border rounded-lg p-3">
          <p className="text-[10px] text-slate-500">Distance</p>
          <p className="text-lg font-bold text-slate-800">
            {route?.distanceKm ?? '--'} km
          </p>
        </div>

        <div className="bg-white border rounded-lg p-3">
          <p className="text-[10px] text-slate-500">Progress</p>
          <p className="text-lg font-bold text-slate-800">
            {vehicle?.progressPercent ?? 0}%
          </p>
        </div>

      </div>

      <div className="bg-white rounded-lg border p-3 text-xs">
        <p className="font-semibold text-slate-700">
          GPS Status
        </p>
        <p className={`mt-1 font-bold ${
          vehicle?.lastSeen
            ? 'text-emerald-600'
            : 'text-amber-600'
        }`}>
          {vehicle?.lastSeen
            ? '● Vehicle assigned — GPS updates available'
            : '● Waiting for driver GPS'}
        </p>
      </div>

      <button
        onClick={() => setActiveTab('Overview')}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2"
      >
        <MapPin className="w-4 h-4" />
        View Live Vehicle on Map
      </button>

    </div>
  );
})()}
<div className="flex justify-between items-center mt-3 text-[10px] text-slate-400">
  
                  <span className="flex items-center gap-1">
                    <Clock3 className="w-3 h-3" />
                    {request.createdAt}
                  </span>
                  <span className="font-medium">
                    ID: {String(request.id).slice(-6)}
                  </span>
                </div>

              </div>

            ))}

          </div>

        )}

      </div>

    </div>

  </div>
)}
          {/* DONORS TAB */}
          {activeTab === 'Donors' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 max-w-xl">
              <h4 className="font-bold text-slate-800">Offer a donation</h4>
              <form onSubmit={handleOfferDonation} className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-600 font-semibold">Donor Name</label>
                  <input type="text" value={donorName} onChange={(e) => setDonorName(e.target.value)} className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded-lg" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-600 font-semibold">Resource</label>
                    <select value={donorResource} onChange={(e) => setDonorResource(e.target.value)} className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded-lg">
                      <option value="water">water</option>
                      <option value="medicine">medicine</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-600 font-semibold">Quantity</label>
                    <input type="text" value={donorQty} onChange={(e) => setDonorQty(e.target.value)} className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded-lg" />
                  </div>
                </div>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-lg cursor-pointer">
                  Offer donation
                </button>
              </form>
              {donations.length > 0 && (
                <div className="space-y-2">
                  {donations.map((donation) => (
                    <div key={donation.id} className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs">
                      <div className="flex justify-between"><span className="font-bold text-emerald-800">✓ Donation accepted</span><span className="text-emerald-600">{donation.createdAt}</span></div>
                      <p className="text-emerald-700 mt-1">{donation.donor} offered {donation.quantity} units of {donation.resource} to {donation.campus}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* REPORTS TAB */}
          {activeTab === 'Reports' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-slate-800">Decision log</h4>
                <button className="bg-slate-100 border border-slate-300 hover:bg-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 font-semibold cursor-pointer">
                  <Download className="w-3.5 h-3.5" /> Download CSV
                </button>
              </div>
              {logs.length === 0 ? (
                <p className="text-xs text-slate-400">No decisions recorded yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {logs.map((log) => (
                    <div key={log.id} className="py-2.5 flex items-center gap-3">
                      <span className="text-slate-400 font-mono text-[11px]">{log.time}</span>
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold text-[10px] uppercase">
                        {log.action}
                      </span>
                      <span className="font-semibold text-slate-800">{log.transfer}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </main>
      </div>

    </div>
  );
}