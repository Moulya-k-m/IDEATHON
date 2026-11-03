import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  RefreshCw,
  Truck,
  Wifi,
  WifiOff,
  Navigation,
  Radio,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

const VEHICLE_STORAGE_KEYS = [
  "vehicle",
  "vehicleId",
  "selectedVehicle",
  "driverVehicle",
  "resqflowVehicle",
  "resqflowDriver",
  "gpsVehicle",
  "activeVehicle",
];

function clearVehicleStorage() {
  try {
    VEHICLE_STORAGE_KEYS.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  } catch (error) {
    console.warn("Storage clear failed:", error);
  }
}

function clearVehicleFromUrl() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("vehicle");

    window.history.replaceState(
      {},
      "",
      url.pathname +
        (url.searchParams.toString()
          ? `?${url.searchParams.toString()}`
          : "") +
        url.hash
    );
  } catch (error) {
    console.warn("URL cleanup failed:", error);
  }
}

export default function DriverTracker() {
  // ==========================================================
  // VEHICLE FROM URL
  // ==========================================================

const params = new URLSearchParams(window.location.search);
const urlVehicle = params.get("vehicle") || "";

const [availableVehicles, setAvailableVehicles] = useState([]);
const [selectedVehicle, setSelectedVehicle] = useState("");
const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
// ==========================================================
// SOCKET
// ==========================================================

const [socketConnected, setSocketConnected] = useState(false);

// Automatically select the first dispatched vehicle
// when the driver opens /driver without ?vehicle=...
// ==========================================================
// VEHICLE AUTO-SELECTION
// ==========================================================

// Do NOT automatically select a vehicle from the fleet.
// The driver page should stay in WAITING state until:
// 1. A vehicle is explicitly assigned, or
// 2. /driver?vehicle=VEHICLE_ID is opened.

useEffect(() => {
  if (urlVehicle) {
    return;
  }

  // No URL vehicle = remain unassigned.
  if (!selectedVehicle) {
    setAssignment(null);
  }
}, [
  urlVehicle,
  selectedVehicle,
]);
  // ==========================================================
  // GPS
  // ==========================================================

  const [gpsOnline, setGpsOnline] = useState(false);
  const [gpsStarting, setGpsStarting] = useState(false);
  const [gpsError, setGpsError] = useState("");

  const [position, setPosition] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [speed, setSpeed] = useState(null);
  const [lastSent, setLastSent] = useState(null);

  // ==========================================================
  // ASSIGNMENT / UI
  // ==========================================================

  const [assignment, setAssignment] = useState(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // ==========================================================
  // REFS
  // ==========================================================

  const socketRef = useRef(null);
  const gpsWatchIdRef = useRef(null);

  const selectedVehicleRef = useRef(selectedVehicle);
  const gpsVehicleRef = useRef(null);
  const registeredVehicleRef = useRef(null);

  const availableVehiclesRef = useRef([]);

  const lastGpsSendRef = useRef(0);

  // ==========================================================
  // KEEP REFS UPDATED
  // ==========================================================

  useEffect(() => {
    selectedVehicleRef.current = selectedVehicle;
  }, [selectedVehicle]);

  useEffect(() => {
    availableVehiclesRef.current = availableVehicles;
  }, [availableVehicles]);

  // ==========================================================
  // STOP GPS
  // ==========================================================

  const stopGps = (notifyServer = true) => {
    if (gpsWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(
        gpsWatchIdRef.current
      );

      gpsWatchIdRef.current = null;
    }

    const vehicleId = gpsVehicleRef.current;

    if (
      notifyServer &&
      socketRef.current?.connected &&
      vehicleId
    ) {
      socketRef.current.emit(
        "vehicle:location",
        {
          vehicleId,
          gpsOnline: false,
          timestamp: Date.now(),
        }
      );
    }

    gpsVehicleRef.current = null;

    setGpsOnline(false);
    setGpsStarting(false);
  };

  // ==========================================================
  // LOCAL RESET
  // ==========================================================

  const clearEverythingLocally = () => {
    stopGps(false);

    registeredVehicleRef.current = null;
    selectedVehicleRef.current = "";

    setSelectedVehicle("");
    setAvailableVehicles([]);

    availableVehiclesRef.current = [];

    setAssignment(null);
    setPosition(null);
    setAccuracy(null);
    setSpeed(null);

    setGpsOnline(false);
    setGpsStarting(false);
    setGpsError("");
    setLastSent(null);

    setMessage(
      "Demo reset. Waiting for a new vehicle dispatch."
    );

    clearVehicleStorage();
    clearVehicleFromUrl();
  };

  // ==========================================================
  // SOCKET CONNECTION
  // ==========================================================

  useEffect(() => {
    console.log(
      "Connecting driver to:",
      window.location.origin
    );

    const socket = io(window.location.origin, {
      path: "/socket.io",

      transports: [
        "websocket",
        "polling",
      ],

      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
    });

    socketRef.current = socket;

    // --------------------------------------------------------
    // CONNECT
    // --------------------------------------------------------

    socket.on("connect", () => {
      console.log(
        "✅ RESQFLOW DRIVER SOCKET CONNECTED:",
        socket.id
      );

      setSocketConnected(true);
      setIsLoading(false);

      setMessage(
        "Server connected. Waiting for vehicle assignment..."
      );

      socket.emit("fleet:request");
    });

    // --------------------------------------------------------
    // CONNECT ERROR
    // --------------------------------------------------------

    socket.on("connect_error", (error) => {
      console.error(
        "❌ DRIVER SOCKET ERROR:",
        error
      );

      setSocketConnected(false);

      setMessage(
        "Cannot connect to ResQFlow server."
      );
    });

    // --------------------------------------------------------
    // DISCONNECT
    // --------------------------------------------------------

    socket.on("disconnect", () => {
      console.log(
        "❌ ResQFlow driver disconnected"
      );

      setSocketConnected(false);
      setGpsOnline(false);

      setMessage(
        "Connection lost. Reconnecting..."
      );
    });

    // ========================================================
    // FLEET SNAPSHOT
    // ========================================================


socket.on("fleet:snapshot", (fleet) => {
  console.log("📦 DRIVER FLEET SNAPSHOT:", fleet);

  const activeFleet = (fleet || []).filter(
    (vehicle) =>
      vehicle &&
      vehicle.vehicleId &&
      vehicle.status === "in_transit"
  );

  setAvailableVehicles(activeFleet);
  availableVehiclesRef.current = activeFleet;

  const currentId = selectedVehicleRef.current;

  // Keep selection only if vehicle is still dispatched
  if (
    currentId &&
    activeFleet.some(
      (vehicle) => vehicle.vehicleId === currentId
    )
  ) {
    return;
  }

  // Clear stale vehicle
  stopGps(false);

  setSelectedVehicle("");
  selectedVehicleRef.current = "";
  registeredVehicleRef.current = null;

  setAssignment(null);
  setPosition(null);
  setAccuracy(null);
  setSpeed(null);
  setGpsError("");
  setLastSent(null);

  clearVehicleFromUrl();
  setShowVehicleDropdown(false);

  setMessage(
    activeFleet.length > 0
      ? "Vehicles available. Select a dispatched vehicle."
      : "No dispatched vehicle yet. Approve a transfer from the dashboard."
  );
});


    // ========================================================
    // VEHICLE STATUS
    // ========================================================

// ========================================================
// VEHICLE STATUS
// ========================================================

socket.on("vehicle:status", (vehicle) => {
  if (!vehicle) return;

  const vehicleId = vehicle.vehicleId;
  const status = vehicle.status;
  const currentId = selectedVehicleRef.current;

  console.log("🚚 VEHICLE STATUS UPDATE:", vehicle);

  // Update fleet list
  setAvailableVehicles((prev) => {
    if (status !== "in_transit") {
      return prev.filter(
        (v) => v.vehicleId !== vehicleId
      );
    }

    const exists = prev.some(
      (v) => v.vehicleId === vehicleId
    );

    return exists
      ? prev.map((v) =>
          v.vehicleId === vehicleId
            ? { ...v, ...vehicle }
            : v
        )
      : [...prev, vehicle];
  });

  // Remove selected vehicle if it is no longer active
  if (
    currentId === vehicleId &&
    status !== "in_transit"
  ) {
    stopGps(false);

    setSelectedVehicle("");
    selectedVehicleRef.current = "";

    setAssignment(null);
    setPosition(null);
    setAccuracy(null);
    setSpeed(null);

    clearVehicleFromUrl();
    setShowVehicleDropdown(false);
    registeredVehicleRef.current = null;

    setMessage(
      `${vehicleId} is no longer in transit. Select another vehicle.`
    );
  }
}); 

    // ========================================================
    // DRIVER ASSIGNMENT
    // ========================================================

    socket.on("driver:assignment", (data) => {
  console.log("🚚 REAL DRIVER ASSIGNMENT:", data);

  if (!data || !data.vehicleId) return;

  // Ignore assignments for another vehicle
  if (
    selectedVehicleRef.current &&
    selectedVehicleRef.current !== data.vehicleId
  ) {
    return;
  }

  setAssignment(data);

  setSelectedVehicle(data.vehicleId);
  selectedVehicleRef.current = data.vehicleId;

  setMessage("Vehicle assigned. Starting GPS...");
});
    // ========================================================
    // DRIVER ERROR
    // ========================================================

    socket.on(
      "driver:error",
      (data) => {
        console.error(
          "Driver server error:",
          data
        );

        setMessage(
          data?.message ||
            "Driver connection error."
        );
      }
    );

    // ========================================================
    // RESET
    // ========================================================

    socket.on(
      "fleet:reset",
      () => {
        clearEverythingLocally();
      }
    );

    // ========================================================
    // CLEANUP
    // ========================================================

    return () => {
      if (
        gpsWatchIdRef.current !== null &&
        navigator.geolocation
      ) {
        navigator.geolocation.clearWatch(
          gpsWatchIdRef.current
        );

        gpsWatchIdRef.current = null;
      }

      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // ==========================================================
  // UPDATE URL + ASSIGNMENT
  // ==========================================================

  // ==========================================================
// UPDATE URL ONLY
// ==========================================================

useEffect(() => {
  if (!selectedVehicle) {
    return;
  }

  try {
    const url = new URL(window.location.href);

    url.searchParams.set("vehicle", selectedVehicle);

    window.history.replaceState(
      {},
      "",
      url.toString()
    );
  } catch (error) {
    console.warn("Could not update URL:", error);
  }
}, [selectedVehicle]);
  // ==========================================================
  // REGISTER DRIVER
  // ==========================================================

  useEffect(() => {
    if (
      !socketConnected ||
      !socketRef.current ||
      !selectedVehicle
    ) {
      return;
    }

    if (
      registeredVehicleRef.current ===
      selectedVehicle
    ) {
      return;
    }

    const vehicleExists =
      availableVehiclesRef.current.some(
        (vehicle) =>
          vehicle.vehicleId ===
          selectedVehicle
      );

    if (!vehicleExists) {
      return;
    }

    registeredVehicleRef.current =
      selectedVehicle;

    console.log(
      "📱 Registering driver:",
      selectedVehicle
    );

    socketRef.current.emit(
      "driver:register",
      {
        vehicleId:
          selectedVehicle,
      }
    );

    setMessage(
      "Driver connected. Requesting phone GPS..."
    );
  }, [
    socketConnected,
    selectedVehicle,
  ]);

  // ==========================================================
  // REAL PHONE GPS
  // ==========================================================

  useEffect(() => {
    if (
      !socketConnected ||
      !socketRef.current ||
      !selectedVehicle
    ) {
      return;
    }

    if (!navigator.geolocation) {
      setGpsError(
        "This browser does not support GPS."
      );

      return;
    }

    // --------------------------------------------------------
    // IMPORTANT: CHECK SECURE CONTEXT
    // --------------------------------------------------------

    if (!window.isSecureContext) {
      setGpsError(
        "Browser blocked GPS because this page is not a secure HTTPS page."
      );

      setGpsStarting(false);

      return;
    }

    // Prevent duplicate watcher
    if (
      gpsWatchIdRef.current !== null &&
      gpsVehicleRef.current ===
        selectedVehicle
    ) {
      return;
    }

    // Stop previous watcher
    if (
      gpsWatchIdRef.current !== null
    ) {
      navigator.geolocation.clearWatch(
        gpsWatchIdRef.current
      );

      gpsWatchIdRef.current = null;
    }

    gpsVehicleRef.current =
      selectedVehicle;

    setGpsStarting(true);
    setGpsOnline(false);
    setGpsError("");

    setMessage(
      "📍 Requesting precise location from this phone..."
    );

    console.log(
      "======================================"
    );

    console.log(
      "📍 STARTING PHONE GPS"
    );

    console.log(
      "Vehicle:",
      selectedVehicle
    );

    console.log(
      "Secure context:",
      window.isSecureContext
    );

    console.log(
      "Geolocation:",
      !!navigator.geolocation
    );

    console.log(
      "======================================"
    );

    // ========================================================
    // ASK FOR ONE LOCATION FIRST
    // ========================================================

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handleGpsPosition(pos);
      },
      (error) => {
        handleGpsError(error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000,
      }
    );

    // ========================================================
    // CONTINUOUS GPS
    // ========================================================

    const watchId =
      navigator.geolocation.watchPosition(
        (pos) => {
          handleGpsPosition(pos);
        },
        (error) => {
          handleGpsError(error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 1000,
          timeout: 20000,
        }
      );

    gpsWatchIdRef.current =
      watchId;

    // ========================================================
    // GPS POSITION HANDLER
    // ========================================================

    function handleGpsPosition(pos) {
      const {
        latitude,
        longitude,
        accuracy,
        speed,
      } = pos.coords;

      console.log(
        "📍 REAL PHONE GPS:",
        {
          latitude,
          longitude,
          accuracy,
          speed,
        }
      );

      // Ignore completely invalid coordinates
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        console.warn(
          "Invalid GPS coordinates"
        );

        return;
      }

      setPosition({
        lat: latitude,
        lon: longitude,
      });

      setAccuracy(
        accuracy ?? null
      );

      setSpeed(
        speed != null
          ? speed
          : null
      );

      setGpsOnline(true);
      setGpsStarting(false);
      setGpsError("");

      setMessage(
        "🟢 GPS LIVE — real phone location is being transmitted."
      );

      const now = Date.now();

      // Send at most once per second
      if (
        now -
          lastGpsSendRef.current <
        1000
      ) {
        return;
      }

      if (
        !socketRef.current ||
        !socketRef.current.connected
      ) {
        console.warn(
          "GPS received but socket is disconnected."
        );

        return;
      }

      const gpsPayload = {
        vehicleId:
          selectedVehicle,

        lat: latitude,

        lon: longitude,

        accuracy:
          accuracy ?? null,

        speed:
          speed != null
            ? speed
            : null,

        gpsOnline: true,

        timestamp: now,
      };

      console.log(
        "📡 SENDING REAL GPS TO SERVER:",
        gpsPayload
      );

      socketRef.current.emit(
        "vehicle:location",
        gpsPayload
      );

      lastGpsSendRef.current =
        now;

      setLastSent(
        new Date()
      );
    }

    // ========================================================
    // GPS ERROR HANDLER
    // ========================================================

    function handleGpsError(error) {
      console.error(
        "📍 GPS ERROR:",
        error
      );

      if (
        error.code ===
        error.PERMISSION_DENIED
      ) {
        setGpsOnline(false);
        setGpsStarting(false);

        setGpsError(
          "Location permission was denied. On your phone, allow Location permission for Chrome and enable Precise Location."
        );

        setMessage(
          "❌ Phone GPS permission is blocked."
        );

        return;
      }

      if (
        error.code ===
        error.POSITION_UNAVAILABLE
      ) {
        setGpsOnline(false);

        setGpsStarting(true);

        setGpsError(
          "Phone cannot currently get a GPS position. Turn ON phone Location and move outdoors/near a window."
        );

        setMessage(
          "📡 Searching for GPS satellites..."
        );

        return;
      }

      if (
        error.code ===
        error.TIMEOUT
      ) {
        setGpsOnline(false);

        setGpsStarting(true);

        setGpsError(
          "GPS is taking too long to get a fix. Keep Location ON and wait a few seconds."
        );

        setMessage(
          "📡 Still searching for GPS..."
        );

        return;
      }

      setGpsError(
        "Unable to read the phone's GPS location."
      );
    }

    // ========================================================
    // CLEANUP
    // ========================================================

    return () => {
      if (
        gpsWatchIdRef.current ===
        watchId
      ) {
        navigator.geolocation.clearWatch(
          watchId
        );

        gpsWatchIdRef.current =
          null;
      }
    };
  }, [
    socketConnected,
    selectedVehicle,
  ]);

  // ==========================================================
  // REFRESH
  // ==========================================================

  const refreshFleet = () => {
    if (
      socketRef.current?.connected
    ) {
      socketRef.current.emit(
        "fleet:request"
      );

      setMessage(
        "Refreshing vehicle assignment..."
      );
    }
  };

  // ==========================================================
  // STATUS
  // ==========================================================

  const gpsStatusText = gpsStarting
    ? "SEARCHING..."
    : gpsOnline
    ? "LIVE"
    : "WAITING";

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">

        {/* HEADER */}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">

          <div className="flex items-center gap-3">

            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg">
              <Truck size={25} />
            </div>

            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                ResQFlow Driver
              </h1>

              <p className="text-slate-400 text-sm">
                Live emergency vehicle tracking
              </p>
            </div>

          </div>

          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${
              socketConnected
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}
          >
            {socketConnected ? (
              <Wifi size={16} />
            ) : (
              <WifiOff size={16} />
            )}

            <span className="text-sm font-medium">
              {socketConnected
                ? "Server Connected"
                : "Connecting..."}
            </span>
          </div>

        </div>


{/* VEHICLE */}

<div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-5">

  <div className="flex items-center justify-between gap-3 mb-3">

    <div>
      <p className="text-sm text-slate-400">
        Assigned vehicle
      </p>

      <h2 className="text-lg font-semibold">
        Select vehicle
      </h2>
    </div>

    <button
      onClick={refreshFleet}
      className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 transition"
    >
      <RefreshCw size={18} />
    </button>

  </div>

  {availableVehicles.length > 0 ? (
    <>
      {!showVehicleDropdown ? (
        <button
          onClick={() => setShowVehicleDropdown(true)}
          className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl px-4 py-3 font-medium transition"
        >
          Select Your Vehicle
        </button>
      ) : (
        <select
          value={selectedVehicle}
          onChange={(e) => {
            stopGps(false);
            registeredVehicleRef.current = null;
            setSelectedVehicle(e.target.value);
            setShowVehicleDropdown(false);
          }}
          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500"
        >
          <option value="">Choose a vehicle...</option>

          {availableVehicles.map((vehicle) => (
            <option
              key={vehicle.vehicleId}
              value={vehicle.vehicleId}
            >
              {vehicle.name || vehicle.vehicleId}
            </option>
          ))}
        </select>
      )}
    </>
  ) : (
    <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 text-slate-400 text-sm">
      No dispatched vehicle is currently available.
    </div>
  )}

</div>


        {/* ASSIGNMENT */}
        {selectedVehicle && (

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-5">

          <div className="flex items-center gap-2 mb-4">
            <Truck
              size={18}
              className="text-blue-400"
            />

            <h2 className="font-semibold">
              Current Assignment
            </h2>
          </div>

          {assignment ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

              <div>
                <p className="text-xs text-slate-500">
                  Vehicle
                </p>

                <p className="font-semibold mt-1">
                  {assignment.name ||
                    assignment.vehicleId}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  From
                </p>

                <p className="font-semibold mt-1">
                  {assignment.donor || "—"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Destination
                </p>

                <p className="font-semibold mt-1">
                  {assignment.target || "—"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Resource
                </p>

                <p className="font-semibold mt-1 capitalize">
                  {assignment.resource || "—"}
                </p>
              </div>

            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Waiting for a vehicle dispatch...
            </p>
          )}

        </div>
        )}

        {/* GPS */}

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-5">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">

            <div className="flex items-center gap-3">

              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  gpsOnline
                    ? "bg-emerald-500/15 text-emerald-400"
                    : gpsStarting
                    ? "bg-amber-500/15 text-amber-400"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                <Navigation size={23} />
              </div>

              <div>
                <p className="text-sm text-slate-400">
                  GPS Tracking
                </p>

                <h2
                  className={`text-xl font-bold ${
                    gpsOnline
                      ? "text-emerald-400"
                      : gpsStarting
                      ? "text-amber-400"
                      : "text-slate-300"
                  }`}
                >
                  {gpsStatusText}
                </h2>
              </div>

            </div>

            {gpsOnline && (
              <div className="flex items-center gap-2 text-emerald-400 text-sm">
                <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
                Live location transmitting
              </div>
            )}

          </div>

          {/* SEARCHING */}

          {gpsStarting && !position && (
            <div className="mb-5 rounded-xl bg-amber-500/10 border border-amber-500/20 p-4">

              <div className="flex items-center gap-3">

                <div className="animate-spin">
                  <RefreshCw
                    size={18}
                    className="text-amber-400"
                  />
                </div>

                <div>
                  <p className="font-medium text-amber-300">
                    Finding your REAL phone location...
                  </p>

                  <p className="text-xs text-slate-400 mt-1">
                    Keep Location ON. Chrome is requesting a precise GPS fix.
                  </p>
                </div>

              </div>

            </div>
          )}

          {/* GPS DATA */}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-2">
                Latitude
              </p>

              <p className="font-mono text-sm">
                {position
                  ? position.lat.toFixed(6)
                  : "Waiting..."}
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-2">
                Longitude
              </p>

              <p className="font-mono text-sm">
                {position
                  ? position.lon.toFixed(6)
                  : "Waiting..."}
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-2">
                Accuracy
              </p>

              <p className="font-mono text-sm">
                {accuracy != null
                  ? `${Math.round(
                      accuracy
                    )} m`
                  : "Waiting..."}
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-2">
                Speed
              </p>

              <p className="font-mono text-sm">
                {speed != null
                  ? `${(
                      speed * 3.6
                    ).toFixed(1)} km/h`
                  : "—"}
              </p>
            </div>

          </div>

        </div>

        {/* GPS ERROR */}

        {gpsError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-5">

            <div className="flex items-start gap-3">

              <AlertCircle
                size={20}
                className="text-red-400 mt-0.5"
              />

              <div>

                <p className="font-medium text-red-300">
                  GPS issue
                </p>

                <p className="text-sm text-red-200/70 mt-1">
                  {gpsError}
                </p>

              </div>

            </div>

          </div>
        )}

        {/* SUCCESS */}

        {gpsOnline && position && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 mb-5">

            <div className="flex items-center gap-3">

              <CheckCircle2
                size={20}
                className="text-emerald-400"
              />

              <div>

                <p className="font-medium text-emerald-300">
                  GPS is LIVE
                </p>

                <p className="text-xs text-emerald-200/60 mt-1">
                  Real phone coordinates are being sent to the ResQFlow dashboard.
                </p>

              </div>

            </div>

          </div>
        )}

        {/* MESSAGE */}

        {message && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-5">

            <div className="flex items-center gap-3">

              <Radio
                size={18}
                className={
                  gpsOnline
                    ? "text-emerald-400"
                    : "text-blue-400"
                }
              />

              <p className="text-sm text-slate-300">
                {message}
              </p>

            </div>

          </div>
        )}

        {/* LAST UPDATE */}

        <div className="text-center text-xs text-slate-600 pb-5">
          {lastSent
            ? `Last GPS update: ${lastSent.toLocaleTimeString()}`
            : "Waiting for first GPS update..."}
        </div>

      </div>
    </div>
  );
}