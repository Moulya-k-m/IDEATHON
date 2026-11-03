import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export default function DriverTracker() {
  const [socket, setSocket] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [gpsStatus, setGpsStatus] = useState('Connecting...');
  const [location, setLocation] = useState(null);
  const [error, setError] = useState('');
  const [tracking, setTracking] = useState(false);
  const watchIdRef = useRef(null);
  const selectedVehicleIdRef = useRef('');

  // A phone can be permanently assigned to one dispatched vehicle.
  // Example: /driver?vehicle=vehicle-12345-ab12c
  const urlVehicleId = new URLSearchParams(window.location.search).get('vehicle');

  useEffect(() => {
    selectedVehicleIdRef.current = selectedVehicleId;
  }, [selectedVehicleId]);

  useEffect(() => {
    const s = io(window.location.origin, {
      transports: ['websocket'],
      path: '/socket.io'
    });

    setSocket(s);

    s.on('connect', () => {
      setGpsStatus(
        urlVehicleId
          ? 'Connected — waiting for assigned vehicle'
          : 'Connected — choose your assigned vehicle'
      );
    });

    s.on('connect_error', () => {
      setGpsStatus('Cannot connect to ResQFlow server');
    });

    s.on('disconnect', () => {
      setGpsStatus('Server disconnected');
    });

    s.on('driver:error', ({ message }) => {
      setTracking(false);
      setError(message || 'Driver registration failed.');
    });

    s.on('fleet:snapshot', (fleet) => {
      const list = (fleet || []).filter((v) => v.status === 'in_transit');

      if (urlVehicleId) {
        const assigned = list.find((v) => v.vehicleId === urlVehicleId);

        if (!assigned) {
          if (watchIdRef.current !== null) {
            navigator.geolocation?.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }

          setTracking(false);
          setVehicles([]);
          setSelectedVehicleId('');
          setLocation(null);
          setGpsStatus('Assigned vehicle is not currently dispatched');
          return;
        }

        setVehicles([assigned]);
        setSelectedVehicleId(assigned.vehicleId);
        return;
      }

      // Without a URL assignment, show the fleet so the driver can choose.
      setVehicles(list);

      if (list.length === 1) {
        setSelectedVehicleId(list[0].vehicleId);
      }
    });

    s.on('vehicle:status', (vehicle) => {
      // Assigned phones ignore other vehicles.
      if (urlVehicleId && vehicle.vehicleId !== urlVehicleId) return;

      if (vehicle.status !== 'in_transit') {
        setVehicles((prev) => prev.filter((v) => v.vehicleId !== vehicle.vehicleId));

        if (vehicle.vehicleId === urlVehicleId) {
          if (watchIdRef.current !== null) {
            navigator.geolocation?.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          setTracking(false);
          setLocation(null);
          setGpsStatus('Vehicle is no longer dispatched');
        }
        return;
      }

      setVehicles((prev) => {
        const exists = prev.some((v) => v.vehicleId === vehicle.vehicleId);
        return exists
          ? prev.map((v) => v.vehicleId === vehicle.vehicleId ? { ...v, ...vehicle } : v)
          : [...prev, vehicle];
      });

      if (urlVehicleId) {
        setSelectedVehicleId(urlVehicleId);
      }
    });

    s.on('vehicle:location', (vehicle) => {
      if (urlVehicleId && vehicle.vehicleId !== urlVehicleId) return;

      setVehicles((prev) => {
        const exists = prev.some((v) => v.vehicleId === vehicle.vehicleId);
        return exists
          ? prev.map((v) => v.vehicleId === vehicle.vehicleId ? { ...v, ...vehicle } : v)
          : [...prev, vehicle];
      });

      if (vehicle.vehicleId === selectedVehicleIdRef.current) {
        setLocation(vehicle);
      }
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
      }
      s.disconnect();
    };
  }, [urlVehicleId]);

  const selectedVehicle = vehicles.find(
    (v) => v.vehicleId === selectedVehicleId
  );

  const startTracking = () => {
    setError('');

    if (!socket?.connected) {
      setError('Realtime server is not connected.');
      return;
    }

    if (!selectedVehicle) {
      setError('Select the vehicle assigned to this phone first.');
      return;
    }

    if (!navigator.geolocation) {
      setError('This phone/browser does not support GPS.');
      return;
    }

    setTracking(true);
    setGpsStatus('Requesting GPS permission...');

    socket.emit('driver:register', {
      vehicleId: selectedVehicle.vehicleId,
      gpsOnline: true
    });

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const gps = {
          vehicleId: selectedVehicle.vehicleId,
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
          gpsOnline: true,
          status: 'in_transit',
          timestamp: Date.now()
        };

        setLocation(gps);
        setGpsStatus('LIVE GPS');
        socket.emit('vehicle:location', gps);
      },
      (err) => {
        setTracking(false);
        setGpsStatus('GPS error');
        setError(err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 15000
      }
    );
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setTracking(false);
    setGpsStatus('GPS stopped');

    if (selectedVehicleId) {
      socket?.emit('vehicle:status', {
        vehicleId: selectedVehicleId,
        gpsOnline: false
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-5">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white rounded-xl p-3 text-xl">🚚</div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">ResQFlow Driver Tracker</h1>
            <p className="text-sm text-slate-500">This phone sends real GPS to the response dashboard.</p>
          </div>
        </div>

        <div className={`mt-6 p-4 rounded-xl border ${
          gpsStatus === 'LIVE GPS' ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
        }`}>
          <p className="text-xs text-slate-500 font-semibold">GPS STATUS</p>
          <p className="text-lg font-bold mt-1">{gpsStatus}</p>
        </div>

        <div className="mt-5">
          <label className="text-xs font-semibold text-slate-700">Assigned vehicle</label>

          {vehicles.length === 0 ? (
            <div className="mt-2 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              No dispatched vehicle is assigned to this phone yet.
              <br />
              Approve a transfer on the ResQFlow dashboard first.
            </div>
          ) : urlVehicleId ? (
            <div className="mt-2 p-3 border border-blue-200 bg-blue-50 rounded-xl">
              <p className="font-bold text-blue-900">{selectedVehicle?.name}</p>
              <p className="text-xs text-blue-700 mt-1">
                {selectedVehicle?.donor} → {selectedVehicle?.target}
              </p>
            </div>
          ) : (
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              disabled={tracking}
              className="w-full mt-2 p-3 border border-slate-300 rounded-xl bg-white"
            >
              <option value="">Select your vehicle</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.vehicleId} value={vehicle.vehicleId}>
                  {vehicle.name} — {vehicle.resource} — {vehicle.target}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedVehicle && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
            <p className="font-bold text-blue-900">{selectedVehicle.name}</p>
            <p className="text-blue-700 mt-1">{selectedVehicle.donor} → {selectedVehicle.target}</p>
            <p className="text-xs text-blue-600 mt-1">
              {selectedVehicle.resource} • {selectedVehicle.quantity} • ETA {selectedVehicle.etaMin ?? '—'} min
            </p>
            <p className="text-[10px] text-blue-500 mt-2 break-all">
              Vehicle ID: {selectedVehicle.vehicleId}
            </p>
          </div>
        )}

        {location && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 font-semibold">CURRENT REAL GPS</p>
            <p className="text-lg font-bold text-emerald-700 mt-1">
              {location.lat.toFixed(6)}, {location.lon.toFixed(6)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Accuracy ±{Math.round(location.accuracy)} m</p>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <div className="mt-5 flex gap-3">
          {!tracking ? (
            <button
              onClick={startTracking}
              disabled={!selectedVehicleId}
              className="flex-1 bg-blue-600 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl"
            >
              Start Live GPS
            </button>
          ) : (
            <button
              onClick={stopTracking}
              className="flex-1 bg-rose-600 text-white font-bold py-3 rounded-xl"
            >
              Stop GPS
            </button>
          )}
        </div>

        <p className="text-[11px] text-slate-400 mt-4">
          Keep this page open while the vehicle is moving. The dashboard receives a new GPS position whenever the phone reports one.
        </p>
      </div>
    </div>
  );
}
