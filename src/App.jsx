import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Popup
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { io } from 'socket.io-client';
import { jsPDF } from "jspdf";
import DriverTracker from "./DriverTracker.jsx";
import {
  AlertTriangle,
  CheckCircle,
  Droplets,
  Pill,
  Download,
  Check,
  Truck,
  Clock3,
  Radio,
  Navigation
} from 'lucide-react';

/* =========================================================
   STOCK EDITOR
========================================================= */

function StockEditor({
  stock,
  setStock,
  socket,
  setStockUpdatedAt
}) {
  const [campus, setCampus] = useState('Campus A');
  const [resource, setResource] = useState('water');

  const [value, setValue] = useState(
    String(Math.round(stock?.['Campus A']?.water ?? 0))
  );

  useEffect(() => {
    setValue(
      String(
        Math.round(
          stock?.[campus]?.[resource] ?? 0
        )
      )
    );
  }, [campus, resource, stock]);

  const save = () => {
    const numeric = Math.max(0, Number(value) || 0);

    setStock((prev) => ({
      ...prev,
      [campus]: {
        ...prev[campus],
        [resource]: numeric
      }
    }));

    setStockUpdatedAt(Date.now());

    socket?.emit('stock:update', {
      campus,
      resource,
      stock: numeric
    });
  };

  return (
    <div className="space-y-3">

      <div>
        <label className="text-xs font-semibold text-slate-600">
          Campus
        </label>

        <select
          value={campus}
          onChange={(e) => setCampus(e.target.value)}
          className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
        >
          <option>Campus A</option>
          <option>Campus B</option>
          <option>Campus C</option>
        </select>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600">
          Resource
        </label>

        <select
          value={resource}
          onChange={(e) => setResource(e.target.value)}
          className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
        >
          <option value="water">Water</option>
          <option value="medicine">Medicine</option>
        </select>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600">
          Current stock
        </label>

        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-[10px] text-blue-600 font-semibold">
          LIVE DASHBOARD VALUE
        </p>

        <p className="text-xl font-bold text-blue-800 mt-1">
          {Math.round(stock?.[campus]?.[resource] ?? 0)}
        </p>

        <p className="text-[10px] text-blue-600 mt-1">
          {resource === 'water' ? 'Litres' : 'Units'}
        </p>
      </div>

      <button
        type="button"
        onClick={save}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2.5 rounded-lg"
      >
        Update stock
      </button>

    </div>
  );
}

/* =========================================================
   CONSTANTS
========================================================= */

const INITIAL_STOCK = {
  'Campus A': {
    water: 30,
    medicine: 100
  },

  'Campus B': {
    water: 59,
    medicine: 150
  },

  'Campus C': {
    water: 31,
    medicine: 40
  }
};

const STOCK_META = {
  'Campus A': {
    reserveWater: 200,
    reserveMedicine: 20,
    consumptionWater: 5,
    consumptionMedicine: 1
  },

  'Campus B': {
    reserveWater: 300,
    reserveMedicine: 30,
    consumptionWater: 4,
    consumptionMedicine: 1
  },

  'Campus C': {
    reserveWater: 150,
    reserveMedicine: 10,
    consumptionWater: 5,
    consumptionMedicine: 2
  }
};

const campusLocations = {
  'Campus A': [12.9716, 77.5946],
  'Campus B': [12.9352, 77.6245],
  'Campus C': [12.9985, 77.6400]
};

const disasterOptions = {
  'Campus A': {
    water: 'Water shortage',
    medicine: 'Medicine shortage'
  },

  'Campus B': {
    water: 'Water shortage',
    medicine: 'Medicine shortage'
  },

  'Campus C': {
    water: 'Water shortage',
    medicine: 'Medicine shortage'
  }
};

/* =========================================================
   VEHICLE POOLS
========================================================= */

const VEHICLE_POOLS = {
  water: [
    {
      vehicleId: 'tanker-1',
      name: 'Tanker 1'
    },
    {
      vehicleId: 'tanker-2',
      name: 'Tanker 2'
    },
    {
      vehicleId: 'tanker-3',
      name: 'Tanker 3'
    }
  ],

  medicine: [
    {
      vehicleId: 'medical-van-1',
      name: 'Medical Van 1'
    },
    {
      vehicleId: 'medical-van-2',
      name: 'Medical Van 2'
    }
  ]
};

/* =========================================================
   APP
========================================================= */

export default function ResQFlowApp() {
  if (window.location.pathname === "/driver") {
    return <DriverTracker />;
  }

  // EVERYTHING ELSE IN YOUR EXISTING DASHBOARD

  /* -------------------------------------------------------
     MAIN UI STATE
  ------------------------------------------------------- */

  const [activeTab, setActiveTab] =
    useState('Overview');

  const [isDisasterSimulated, setIsDisasterSimulated] =
    useState(false);

  const [transferApproved, setTransferApproved] =
    useState(false);

  const [transferStatus, setTransferStatus] =
    useState('idle');

  const [requestRaised, setRequestRaised] =
    useState(false);

  const [donorOffered, setDonorOffered] =
    useState(false);

  const [roadBlocked, setRoadBlocked] =
    useState(false);

  const [routeStage, setRouteStage] =
    useState('normal');

  const [activeIncident, setActiveIncident] =
    useState([]);

  const [manualStage, setManualStage] =
    useState(0);

  const [showDisasterPicker, setShowDisasterPicker] =
    useState(false);

  const [selectedNeed, setSelectedNeed] =
    useState({
      campus: 'Campus A',
      resource: 'water'
    });

  /* -------------------------------------------------------
     INCIDENT MANAGEMENT
  ------------------------------------------------------- */

  const [currentIncidentId, setCurrentIncidentId] =
    useState(null);

  const [incidents, setIncidents] =
    useState([]);

  /* -------------------------------------------------------
     ROUTING
  ------------------------------------------------------- */

  const [routeCoords, setRouteCoords] =
    useState([]);

  const [originalRouteCoords, setOriginalRouteCoords] =
    useState([]);

  const [routeLoading, setRouteLoading] =
    useState(false);

  const [routeInfo, setRouteInfo] =
    useState({
      distanceKm: 0,
      durationMin: 0
    });

  const [originalRouteInfo, setOriginalRouteInfo] =
    useState({
      distanceKm: 0,
      durationMin: 0
    });

  const [rerouteInfo, setRerouteInfo] =
    useState(null);

  const [vehicleRoutes, setVehicleRoutes] =
    useState({});

  /* -------------------------------------------------------
     ROAD REPORT
  ------------------------------------------------------- */

  const [showBlockReport, setShowBlockReport] =
    useState(false);

  const [blockReportText, setBlockReportText] =
    useState(
      'Road blocked / traffic disruption'
    );

  const [reportedRoad, setReportedRoad] =
    useState('Current delivery route');

  const [roadReports, setRoadReports] =
    useState([]);

  const [activeRoadReportId, setActiveRoadReportId] =
    useState(null);

  /* -------------------------------------------------------
     REALTIME
  ------------------------------------------------------- */

  const [socket, setSocket] =
    useState(null);

  const socketRef =
    useRef(null);

  const [vehicles, setVehicles] =
    useState({});

  const [fleetConnected, setFleetConnected] =
    useState(false);

  /* -------------------------------------------------------
     STOCK
  ------------------------------------------------------- */

  const [stock, setStock] =
    useState(() =>
      JSON.parse(
        JSON.stringify(INITIAL_STOCK)
      )
    );

  const [stockUpdatedAt, setStockUpdatedAt] =
    useState(Date.now());

  /* -------------------------------------------------------
     REQUEST
  ------------------------------------------------------- */

  const [reqCamp, setReqCamp] =
    useState('Campus C');

  const [reqResource, setReqResource] =
    useState('medicine');

  const [reqQty, setReqQty] =
    useState('30');

  const [reqHours, setReqHours] =
    useState('4');

  /* -------------------------------------------------------
     DONOR
  ------------------------------------------------------- */

  const [donorName, setDonorName] =
    useState('Acme CSR');

  const [donorResource, setDonorResource] =
    useState('water');

  const [donorQty, setDonorQty] =
    useState('1000');

  const [donorCamp, setDonorCamp] =
    useState('Campus A');

  /* -------------------------------------------------------
     LOGS
  ------------------------------------------------------- */

  const [logs, setLogs] =
    useState([]);

  /* -------------------------------------------------------
     NOTIFICATION DEDUP
  ------------------------------------------------------- */

  const notificationIds =
    useRef(new Set());

  const addIncidentNotification = (
    message,
    uniqueKey = null
  ) => {

    const key =
      uniqueKey ||
      `${message}-${Date.now()}`;

    if (notificationIds.current.has(key)) {
      return;
    }

    notificationIds.current.add(key);

    setActiveIncident((prev) => [
      ...prev,
      message
    ]);
  };

  /* =======================================================
     SOCKET CONNECTION
  ======================================================= */

  useEffect(() => {

    const s = io(
      window.location.origin,
      {
        path: '/socket.io',
        transports: [
          'websocket',
          'polling'
        ],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000
      }
    );

    socketRef.current = s;

    setSocket(s);

    s.on('connect', () => {
      console.log(
        'ResQFlow realtime connected'
      );

      setFleetConnected(true);
    });

    s.on('disconnect', () => {
      console.log(
        'ResQFlow realtime disconnected'
      );

      setFleetConnected(false);
    });

    /* -----------------------------------------------
       FLEET SNAPSHOT
    ------------------------------------------------ */

    s.on(
      'fleet:snapshot',
      (fleet) => {

        const next = {};

        (fleet || []).forEach(
          (vehicle) => {

            if (
              vehicle?.vehicleId &&
              vehicle.status ===
                'in_transit'
            ) {

              next[
                vehicle.vehicleId
              ] = vehicle;
            }

          }
        );

        setVehicles(next);
      }
    );

    /* -----------------------------------------------
       FLEET RESET
    ------------------------------------------------ */

    s.on(
      'fleet:reset',
      () => {

        setVehicles({});

        setVehicleRoutes({});

      }
    );

    /* -----------------------------------------------
       STOCK SNAPSHOT
    ------------------------------------------------ */

    s.on(
      'stock:snapshot',
      (snapshot) => {

        if (snapshot) {
          setStock(snapshot);
        }

        setStockUpdatedAt(
          Date.now()
        );
      }
    );

    /* -----------------------------------------------
       STOCK RESET
    ------------------------------------------------ */

    s.on(
      'stock:reset',
      (snapshot) => {

        setStock(
          snapshot ||
          JSON.parse(
            JSON.stringify(
              INITIAL_STOCK
            )
          )
        );

        setStockUpdatedAt(
          Date.now()
        );
      }
    );

    /* -----------------------------------------------
       VEHICLE LOCATION
    ------------------------------------------------ */

    s.on(
      'vehicle:location',
      (vehicle) => {

        if (
          !vehicle?.vehicleId ||
          vehicle.status !==
            'in_transit'
        ) {
          return;
        }

        setVehicles((prev) => ({
          ...prev,

          [vehicle.vehicleId]: {
            ...prev[
              vehicle.vehicleId
            ],
            ...vehicle,
            lastSeen: Date.now()
          }

        }));
      }
    );

    /* -----------------------------------------------
       VEHICLE STATUS
    ------------------------------------------------ */

    s.on(
      'vehicle:status',
      (vehicle) => {

        if (
          !vehicle?.vehicleId
        ) {
          return;
        }

        setVehicles((prev) => {

          if (
            vehicle.status !==
              'in_transit'
          ) {

            const next = {
              ...prev
            };

            delete next[
              vehicle.vehicleId
            ];

            return next;
          }

          return {

            ...prev,

            [vehicle.vehicleId]: {

              ...prev[
                vehicle.vehicleId
              ],

              ...vehicle,

              lastSeen:
                Date.now()

            }

          };

        });

      }
    );

    /* -----------------------------------------------
       ROAD REPORT
    ------------------------------------------------ */

    s.on(
      'road:report',
      (report) => {

        if (!report) {
          return;
        }

        setRoadReports((prev) => {

          if (
            prev.some(
              (item) =>
                item.id ===
                report.id
            )
          ) {
            return prev;
          }

          return [
            report,
            ...prev
          ].slice(0, 10);

        });

        setActiveRoadReportId(
          report.id
        );

        addIncidentNotification(
          `Public report: ${report.road} — ${report.type}`,
          `road-report-${report.id}`
        );

      }
    );

    /* -----------------------------------------------
       ROAD CLEARED
    ------------------------------------------------ */

    s.on(
      'road:cleared',
      ({ reportId }) => {

        setRoadReports(
          (prev) =>
            prev.filter(
              (item) =>
                item.id !==
                reportId
            )
        );

        setActiveRoadReportId(
          (current) =>
            current === reportId
              ? null
              : current
        );

      }
    );

    /* -----------------------------------------------
       STOCK UPDATE
    ------------------------------------------------ */

    s.on(
      'stock:update',
      (payload) => {

        if (
          payload?.campus &&
          payload?.resource &&
          payload?.stock != null
        ) {

          setStock((prev) => ({
            ...prev,

            [payload.campus]: {

              ...prev[
                payload.campus
              ],

              [payload.resource]:
                Number(
                  payload.stock
                )

            }

          }));

          setStockUpdatedAt(
            Date.now()
          );

        }

      }
    );

    return () => {

      s.disconnect();

      if (
        socketRef.current === s
      ) {
        socketRef.current =
          null;
      }

    };

  }, []);

  /* =======================================================
     NORMAL STOCK CONSUMPTION
  ======================================================= */

  useEffect(() => {

    const timer =
      setInterval(() => {

        setStock((prev) => {

          const next = {};

          Object.entries(
            prev
          ).forEach(
            ([campus, values]) => {

              next[campus] = {

                water:
                  Math.max(
                    0,
                    Number(
                      values.water
                    ) -
                    STOCK_META[
                      campus
                    ]
                      .consumptionWater /
                    60
                  ),

                medicine:
                  Math.max(
                    0,
                    Number(
                      values.medicine
                    ) -
                    STOCK_META[
                      campus
                    ]
                      .consumptionMedicine /
                    60
                  )

              };

            }
          );

          return next;

        });

        setStockUpdatedAt(
          Date.now()
        );

      }, 60000);

    return () =>
      clearInterval(timer);

  }, []);

  /* =======================================================
     ROUTE PLAN
  ======================================================= */

  const routePlan =
    useMemo(() => {

      const need =
        selectedNeed.campus;

      if (
        need ===
        'Campus A'
      ) {

        return {
          donor: 'Campus B',
          target: 'Campus A',
          label: 'B → A'
        };

      }

      if (
        need ===
        'Campus C'
      ) {

        return {
          donor: 'Campus B',
          target: 'Campus C',
          label: 'B → C'
        };

      }

      return {
        donor: 'Campus A',
        target: 'Campus B',
        label: 'A → B'
      };

    }, [selectedNeed]);

  /* =======================================================
     ALTERNATE HUB
  ======================================================= */

  const alternateHub =
    Object.keys(
      campusLocations
    ).find(
      (campus) =>
        campus !==
          routePlan.donor &&
        campus !==
          routePlan.target
    );

  /* =======================================================
     STOCK HELPERS
  ======================================================= */

  const getCampusHours = (
    campus,
    resource
  ) => {

    const current =
      Number(
        stock?.[campus]?.[
          resource
        ] ?? 0
      );

    const consumption =
      resource === 'water'
        ? STOCK_META[
            campus
          ].consumptionWater
        : STOCK_META[
            campus
          ].consumptionMedicine;

    if (
      consumption <= 0
    ) {
      return '∞';
    }

    return (
      current /
      consumption
    ).toFixed(1);
  };

  const getCampusPercent = (
    campus,
    resource
  ) => {

    const current =
      Number(
        stock?.[campus]?.[
          resource
        ] ?? 0
      );

    const reserve =
      resource === 'water'
        ? STOCK_META[
            campus
          ].reserveWater
        : STOCK_META[
            campus
          ].reserveMedicine;

    if (
      reserve <= 0
    ) {
      return 0;
    }

    return Math.min(
      100,
      Math.max(
        0,
        (current /
          reserve) *
          100
      )
    );

  };

  const getCampusStatus =
    (campus) => {

      if (
        !isDisasterSimulated
      ) {
        return null;
      }

      if (
        transferStatus ===
        'delivered'
      ) {
        return null;
      }

      if (
        selectedNeed.campus !==
        campus
      ) {
        return null;
      }

      return selectedNeed.resource ===
        'water'
        ? 'WATER CRITICAL'
        : 'MEDICINE CRITICAL';

    };

  const transferStatusIsDelivered =
    () =>
      transferStatus ===
      'delivered';

  /* =======================================================
     OSRM ROUTING
  ======================================================= */

  const fetchRoute = async (
    points,
    saveAsOriginal = false
  ) => {

    setRouteLoading(true);

    try {

      const coordinates =
        points
          .map(
            ([lat, lon]) =>
              `${lon},${lat}`
          )
          .join(';');

      const response =
        await fetch(
          `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`
        );

      if (
        !response.ok
      ) {
        throw new Error(
          'Routing service failed'
        );
      }

      const data =
        await response.json();

      const route =
        data?.routes?.[0];

      if (!route) {
        throw new Error(
          'No route found'
        );
      }

      const coords =
        route.geometry.coordinates.map(
          ([lon, lat]) => [
            lat,
            lon
          ]
        );

      const info = {
        distanceKm:
          Number(
            route.distance /
              1000
          ).toFixed(1),

        durationMin:
          Math.max(
            1,
            Math.round(
              route.duration /
                60
            )
          )
      };

      setRouteCoords(
        coords
      );

      setRouteInfo(
        info
      );

      if (
        saveAsOriginal
      ) {

        setOriginalRouteCoords(
          coords
        );

        setOriginalRouteInfo(
          info
        );

      }

      setRouteLoading(
        false
      );

      return {
        coords,
        ...info
      };

    } catch (error) {

      console.error(
        'OSRM route error:',
        error
      );

      const fallbackCoords =
        points;

      const fallbackInfo = {
        distanceKm: 12.2,
        durationMin: 15
      };

      setRouteCoords(
        fallbackCoords
      );

      setRouteInfo(
        fallbackInfo
      );

      if (
        saveAsOriginal
      ) {

        setOriginalRouteCoords(
          fallbackCoords
        );

        setOriginalRouteInfo(
          fallbackInfo
        );

      }

      setRouteLoading(
        false
      );

      return {
        coords:
          fallbackCoords,

        ...fallbackInfo
      };

    }

  };

  /* =======================================================
     SIMULATE DISASTER
  ======================================================= */

  const runDisasterSimulation =
    async () => {

      setShowDisasterPicker(
        false
      );

      /*
       * IMPORTANT:
       * Do NOT reset vehicles here.
       * This allows disaster #2 to coexist
       * with disaster #1.
       */

      const incidentId =
        `incident-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}`;

      setCurrentIncidentId(
        incidentId
      );

      setIsDisasterSimulated(
        true
      );

      setTransferApproved(
        false
      );

      setTransferStatus(
        'idle'
      );

      setRoadBlocked(
        false
      );

      setRouteStage(
        'detecting'
      );

      setRerouteInfo(
        null
      );

      setRoadReports(
        []
      );

      setActiveRoadReportId(
        null
      );

      setManualStage(
        1
      );

      setRouteInfo({
        distanceKm: 0,
        durationMin: 0
      });

      setOriginalRouteCoords(
        []
      );

      setOriginalRouteInfo({
        distanceKm: 0,
        durationMin: 0
      });

      const needText =
        `${
          selectedNeed.resource ===
          'water'
            ? 'Water'
            : 'Medicine'
        } shortage detected at ${
          selectedNeed.campus
        }`;

      const incidentRecord = {
        id: incidentId,
        campus:
          selectedNeed.campus,
        resource:
          selectedNeed.resource,
        donor:
          routePlan.donor,
        target:
          selectedNeed.campus,
        status: 'detected',
        vehicleId: null,
        createdAt:
          Date.now()
      };

      setIncidents(
        (prev) => [
          ...prev,
          incidentRecord
        ]
      );

      setActiveIncident(
        (prev) => [
          ...prev,

          needText,

          `${routePlan.donor} selected as nearest available donor`,

          `Checking live road route for ${routePlan.label}`
        ]
      );

      const result =
        await fetchRoute(
          [
            campusLocations[
              routePlan.donor
            ],

            campusLocations[
              routePlan.target
            ]
          ],
          true
        );

      setRouteStage(
        'ready'
      );

      addIncidentNotification(
        `Live road check completed — ${routePlan.label} is currently OPEN`,
        `${incidentId}-route-open`
      );

      addIncidentNotification(
        `Normal route ready — ${result.distanceKm} km • ${result.durationMin} min`,
        `${incidentId}-route-ready`
      );

    };

  const handleSimulateDisaster =
    () => {

      /*
       * IMPORTANT:
       * This ALWAYS opens the picker,
       * even if another disaster is active.
       */

      setShowDisasterPicker(
        true
      );

    };

  /* =======================================================
     GET NEXT FREE VEHICLE
  ======================================================= */

  const getAvailableVehicle =
    (resource) => {

      const pool =
        VEHICLE_POOLS[
          resource
        ] || [];

      for (
        const candidate of pool
      ) {

        const alreadyActive =
          Object.values(
            vehicles
          ).some(
            (vehicle) =>
              vehicle.vehicleId ===
                candidate.vehicleId &&
              vehicle.status ===
                'in_transit'
          );

        if (
          !alreadyActive
        ) {
          return candidate;
        }

      }

      return null;
    };

  /* =======================================================
     APPROVE TRANSFER
  ======================================================= */

  const handleApproveTransfer =
    (type) => {

      /*
       * Prevent duplicate dispatch
       * for THIS incident only.
       *
       * Another disaster is allowed.
       */

      const currentIncident =
        incidents.find(
          (incident) =>
            incident.id ===
            currentIncidentId
        );

      if (
        currentIncident?.vehicleId
      ) {

        addIncidentNotification(
          `${currentIncident.vehicleId} is already assigned to this incident.`,
          `${currentIncidentId}-duplicate-dispatch`
        );

        return;
      }

      /*
       * Find next available vehicle.
       */

      const availableVehicle =
        getAvailableVehicle(
          type
        );

      if (
        !availableVehicle
      ) {

        addIncidentNotification(
          `No ${type} vehicle is currently available.`,
          `${currentIncidentId}-no-vehicle`
        );

        return;
      }

      const vehicleId =
        availableVehicle.vehicleId;

      const vehicleName =
        availableVehicle.name;

      const quantity =
        type === 'water'
          ? 2000
          : 30;

      const payload = {

        vehicleId,

        name:
          vehicleName,

        donor:
          routePlan.donor,

        target:
          selectedNeed.campus,

        resource:
          selectedNeed.resource,

        quantity,

        status:
          'in_transit',

        distanceKm:
          routeInfo.distanceKm,

        etaMin:
          routeInfo.durationMin,

        gpsOnline:
          false,

        lat:
          campusLocations[
            routePlan.donor
          ][0],

        lon:
          campusLocations[
            routePlan.donor
          ][1],

        incidentId:
          currentIncidentId

      };

      /*
       * Update dashboard immediately.
       */

      setVehicles(
        (prev) => ({

          ...prev,

          [vehicleId]: {
            ...payload,
            lastSeen:
              Date.now()
          }

        })
      );

      /*
       * Save route for this vehicle.
       */

      setVehicleRoutes(
        (prev) => ({

          ...prev,

          [vehicleId]: {

            coords:
              routeCoords,

            distanceKm:
              routeInfo.distanceKm,

            durationMin:
              routeInfo.durationMin,

            donor:
              routePlan.donor,

            target:
              selectedNeed.campus,

            incidentId:
              currentIncidentId

          }

        })
      );

      /*
       * Update current incident.
       */

      setIncidents(
        (prev) =>
          prev.map(
            (incident) =>
              incident.id ===
              currentIncidentId
                ? {
                    ...incident,
                    vehicleId,
                    status:
                      'in_transit'
                  }
                : incident
          )
      );

      /*
       * Current incident state.
       */

      setTransferApproved(
        true
      );

      setTransferStatus(
        'in_transit'
      );

      setRouteStage(
        roadBlocked
          ? 'rerouted'
          : 'ready'
      );

      /*
       * Send to realtime server.
       */

      socketRef.current?.emit(
        'dispatch:create',
        payload
      );

      /*
       * Decision log.
       */

      const newLog = {

        id:
          Date.now(),

        time:
          new Date()
            .toLocaleTimeString(
              [],
              {
                hour:
                  '2-digit',

                minute:
                  '2-digit',

                second:
                  '2-digit'
              }
            ),

        action:
          'dispatch',

        transfer:
          `${
            type === 'water'
              ? '2,000 L water'
              : '30 units medicine'
          }: ${
            routePlan.donor
          } -> ${
            selectedNeed.campus
          } • ${vehicleName}`

      };

      setLogs(
        (prev) => [
          newLog,
          ...prev
        ]
      );

      addIncidentNotification(
        `Dispatch approved — ${vehicleName} assigned. Waiting for driver's live GPS.`,
        `${currentIncidentId}-dispatch-approved`
      );

    };

  /* =======================================================
     REPORT ROAD BLOCK
  ======================================================= */

  const reportRoadBlock =
    async (e) => {

      e?.preventDefault();

      if (
        !isDisasterSimulated
      ) {
        return;
      }

      if (
        roadBlocked
      ) {
        return;
      }

      const reportId =
        `road-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}`;

      const report = {

        id:
          reportId,

        incidentId:
          currentIncidentId,

        road:
          reportedRoad,

        type:
          blockReportText,

        reportedAt:
          Date.now()

      };

      setShowBlockReport(
        false
      );

      setRoadBlocked(
        true
      );

      setActiveRoadReportId(
        reportId
      );

      setRoadReports(
        (prev) => [
          report,
          ...prev
        ]
      );

      setRouteStage(
        'rerouting'
      );

      addIncidentNotification(
        `Road problem reported — ${reportedRoad}`,
        `${reportId}-notification`
      );

      socketRef.current?.emit(
        'road:report',
        report
      );

      try {

        const oldRoute =
          originalRouteCoords.length >
          1
            ? originalRouteCoords
            : routeCoords;

        const oldInfo =
          originalRouteInfo.distanceKm
            ? originalRouteInfo
            : routeInfo;

        const points = [

          campusLocations[
            routePlan.donor
          ],

          campusLocations[
            alternateHub
          ],

          campusLocations[
            routePlan.target
          ]

        ];

        const result =
          await fetchRoute(
            points,
            false
          );

        setRouteInfo({
          distanceKm:
            result.distanceKm,

          durationMin:
            result.durationMin
        });

        setRerouteInfo({

          oldRoute,

          oldDistanceKm:
            oldInfo.distanceKm,

          oldDurationMin:
            oldInfo.durationMin,

          distanceKm:
            result.distanceKm,

          durationMin:
            result.durationMin,

          reason:
            `Alternate route via ${alternateHub}`

        });

        setRouteStage(
          'rerouted'
        );

        /*
         * Update all active vehicles.
         */

        setVehicleRoutes(
          (prev) => {

            const next = {
              ...prev
            };

            Object.values(
              vehicles
            ).forEach(
              (vehicle) => {

                if (
                  vehicle.status !==
                  'in_transit'
                ) {
                  return;
                }

                next[
                  vehicle.vehicleId
                ] = {

                  ...(next[
                    vehicle.vehicleId
                  ] || {}),

                  coords:
                    result.coords,

                  distanceKm:
                    result.distanceKm,

                  durationMin:
                    result.durationMin,

                  donor:
                    vehicle.donor,

                  target:
                    vehicle.target,

                  incidentId:
                    vehicle.incidentId

                };

                socketRef.current?.emit(
                  'vehicle:reroute',
                  {
                    vehicleId:
                      vehicle.vehicleId,

                    distanceKm:
                      result.distanceKm,

                    etaMin:
                      result.durationMin,

                    incidentId:
                      vehicle.incidentId
                  }
                );

              }
            );

            return next;

          }
        );

        /*
         * Update dashboard vehicle ETA.
         */

        setVehicles(
          (prev) => {

            const next = {
              ...prev
            };

            Object.values(
              next
            ).forEach(
              (vehicle) => {

                if (
                  vehicle.status ===
                  'in_transit'
                ) {

                  next[
                    vehicle.vehicleId
                  ] = {

                    ...vehicle,

                    distanceKm:
                      result.distanceKm,

                    etaMin:
                      result.durationMin

                  };

                }

              }
            );

            return next;

          }
        );

        addIncidentNotification(
          `Reroute complete — alternate route via ${alternateHub} is active.`,
          `${reportId}-reroute-complete`
        );

      } catch (
        error
      ) {

        console.error(
          'Reroute failed:',
          error
        );

        setRouteCoords(
          originalRouteCoords
        );

        setRouteInfo(
          originalRouteInfo
        );

        setRoadBlocked(
          false
        );

        setRouteStage(
          'ready'
        );

        setRerouteInfo(
          null
        );

        setRoadReports(
          (prev) =>
            prev.filter(
              (item) =>
                item.id !==
                reportId
            )
        );

        setActiveRoadReportId(
          null
        );

        socketRef.current?.emit(
          'road:cleared',
          {
            reportId
          }
        );

        addIncidentNotification(
          'Reroute failed. Original route restored.',
          `${reportId}-reroute-failed`
        );

      }

    };

  /* =======================================================
     CLEAR ROAD REPORT
  ======================================================= */

  const clearRoadReport =
    (reportId) => {

      setRoadReports(
        (prev) =>
          prev.filter(
            (item) =>
              item.id !==
              reportId
          )
      );

      setActiveRoadReportId(
        (current) =>
          current === reportId
            ? null
            : current
      );

      setRoadBlocked(
        false
      );

      setRouteStage(
        transferApproved
          ? 'ready'
          : 'ready'
      );

      setRerouteInfo(
        null
      );

      if (
        originalRouteCoords.length >
        1
      ) {

        setRouteCoords(
          originalRouteCoords
        );

        setRouteInfo(
          originalRouteInfo
        );

        /*
         * Restore active vehicle
         * routes.
         */

        setVehicleRoutes(
          (prev) => {

            const next = {
              ...prev
            };

            Object.values(
              vehicles
            ).forEach(
              (vehicle) => {

                if (
                  vehicle.status ===
                  'in_transit'
                ) {

                  next[
                    vehicle.vehicleId
                  ] = {

                    ...(next[
                      vehicle.vehicleId
                    ] || {}),

                    coords:
                      originalRouteCoords,

                    distanceKm:
                      originalRouteInfo.distanceKm,

                    durationMin:
                      originalRouteInfo.durationMin

                  };

                }

              }
            );

            return next;

          }
        );

      }

      socketRef.current?.emit(
        'road:cleared',
        {
          reportId
        }
      );

      addIncidentNotification(
        'Road reopened. Normal route restored.',
        `${reportId}-cleared`
      );

    };

  /* =======================================================
     REQUEST / DONOR
  ======================================================= */

  const handleRaiseRequest =
    (e) => {

      e.preventDefault();

      setRequestRaised(
        true
      );

      setActiveTab(
        'Overview'
      );

      addIncidentNotification(
        `Request raised — ${reqQty} ${reqResource} needed at ${reqCamp}.`,
        `request-${reqCamp}-${reqResource}-${reqQty}`
      );

    };

  const handleOfferDonation =
    (e) => {

      e.preventDefault();

      setDonorOffered(
        true
      );

      addIncidentNotification(
        `${donorName} offered ${donorQty} ${donorResource}.`,
        `donation-${donorName}-${donorQty}-${donorResource}`
      );

    };

  /* =======================================================
     RESET DEMO
  ======================================================= */

  const handleResetDemo =
    () => {

      /*
       * Clear every local state.
       */

      setActiveTab(
        'Overview'
      );

      setIsDisasterSimulated(
        false
      );

      setTransferApproved(
        false
      );

      setTransferStatus(
        'idle'
      );

      setRequestRaised(
        false
      );

      setDonorOffered(
        false
      );

      setRoadBlocked(
        false
      );

      setRouteStage(
        'normal'
      );

      setActiveIncident(
        []
      );

      setManualStage(
        0
      );

      setShowDisasterPicker(
        false
      );

      setCurrentIncidentId(
        null
      );

      setIncidents(
        []
      );

      setSelectedNeed({
        campus:
          'Campus A',
        resource:
          'water'
      });

      setRouteCoords(
        []
      );

      setOriginalRouteCoords(
        []
      );

      setRouteLoading(
        false
      );

      setRouteInfo({
        distanceKm: 0,
        durationMin: 0
      });

      setOriginalRouteInfo({
        distanceKm: 0,
        durationMin: 0
      });

      setRerouteInfo(
        null
      );

      setVehicleRoutes(
        {}
      );

      setShowBlockReport(
        false
      );

      setBlockReportText(
        'Road blocked / traffic disruption'
      );

      setReportedRoad(
        'Current delivery route'
      );

      setRoadReports(
        []
      );

      setActiveRoadReportId(
        null
      );

      setVehicles(
        {}
      );

      setLogs(
        []
      );

      setStock(
        JSON.parse(
          JSON.stringify(
            INITIAL_STOCK
          )
        )
      );

      setStockUpdatedAt(
        Date.now()
      );

      notificationIds.current.clear();

      /*
       * Reset server state.
       */

      socketRef.current?.emit(
        'demo:reset'
      );

      socketRef.current?.emit(
        'fleet:reset'
      );

      socketRef.current?.emit(
        'road:reset'
      );

      socketRef.current?.emit(
        'stock:reset'
      );

    };

  /* =======================================================
     ACTIVE VEHICLE
  ======================================================= */

  const activeVehicle =
    Object.values(
      vehicles
    ).find(
      (v) =>
        v.incidentId ===
          currentIncidentId &&
        v.target ===
          selectedNeed.campus &&
        v.status ===
          'in_transit'
    ) ||
    Object.values(
      vehicles
    ).find(
      (v) =>
        v.target ===
          selectedNeed.campus &&
        v.status ===
          'in_transit'
    );

  const vehiclePosition =
    activeVehicle &&
    activeVehicle.lat != null &&
    activeVehicle.lon != null
      ? [
          Number(
            activeVehicle.lat
          ),
          Number(
            activeVehicle.lon
          )
        ]
      : campusLocations[
          routePlan.donor
        ];

  const remainingMinutes =
    activeVehicle?.etaMin ??
    routeInfo.durationMin ??
    15;

  const progressPercent =
    activeVehicle?.progressPercent ??
    0;

  const liveVehicleCount =
    Object.values(
      vehicles
    ).filter(
      (v) =>
        v.status ===
        'in_transit'
    ).length;

    

const generatePDFReport = () => {
  const pdf = new jsPDF("p", "mm", "a4");
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 15;
  const navy = [15, 23, 42];
  const blue = [37, 99, 235];
  const red = [220, 38, 38];
  const green = [5, 150, 105];
  const gray = [100, 116, 139];
  const light = [241, 245, 249];

  const allVehicles = Object.values(vehicles || {});
  const activeVehicles = allVehicles.filter(v => v.status === "in_transit");
  const dispatches = logs.filter(l =>
    String(l.action || "").toLowerCase().includes("dispatch")
  );

  const incidentId = currentIncidentId || "N/A";
  const generated = new Date();
  const status = isDisasterSimulated ? "ACTIVE" : "NORMAL";

  let y = 20;

  // Helpers
  const addPageIfNeeded = (height = 15) => {
    if (y + height > H - 23) {
      pdf.addPage();
      y = 22;
    }
  };

  const section = (title) => {
    addPageIfNeeded(20);
    pdf.setFillColor(...navy);
    pdf.roundedRect(M, y, W - 2 * M, 10, 2, 2, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(255, 255, 255);
    pdf.text(title.toUpperCase(), M + 4, y + 6.5);
    y += 16;
  };

  const field = (label, value) => {
    addPageIfNeeded(12);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...gray);
    pdf.text(label, M + 2, y);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...navy);
    const lines = pdf.splitTextToSize(
      String(value ?? "Not available"),
      W - 2 * M - 55
    );
    pdf.text(lines, M + 55, y);
    y += Math.max(7, lines.length * 5);
  };

  const table = (headers, rows, widths) => {
    const rowHeight = 9;
    const drawHeader = () => {
      pdf.setFillColor(...blue);
      pdf.rect(M, y - 4, W - 2 * M, rowHeight, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(255, 255, 255);
      let x = M + 3;
      headers.forEach((h, i) => {
        pdf.text(h, x, y + 2);
        x += widths[i];
      });
      y += rowHeight;
    };

    drawHeader();

    rows.forEach((row, index) => {
      const wrapped = row.map((v, i) =>
        pdf.splitTextToSize(String(v ?? "N/A"), widths[i] - 4)
      );
      const height = Math.max(9, ...wrapped.map(v => v.length * 4 + 4));

      addPageIfNeeded(height + 2);
      if (y === 22) drawHeader();

      if (index % 2 === 0) {
        pdf.setFillColor(...light);
        pdf.rect(M, y - 4, W - 2 * M, height, "F");
      }

      let x = M + 3;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(...navy);

      wrapped.forEach((cell, i) => {
        pdf.text(cell, x, y + 1);
        x += widths[i];
      });

      y += height;
    });
  };

  // Premium header
  pdf.setFillColor(...navy);
  pdf.rect(0, 0, W, 45, "F");
  pdf.setFillColor(...blue);
  pdf.rect(0, 0, 3, 45, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(25);
  pdf.setTextColor(255, 255, 255);
  pdf.text("ResQFlow", M, 20);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(203, 213, 225);
  pdf.text("EMERGENCY OPERATIONS & INCIDENT REPORT", M, 29);
  pdf.text("SMART RESPONSE. SAFER LIVES.", M, 36);

  pdf.setFontSize(8);
  pdf.text(generated.toLocaleString(), W - M, 20, { align: "right" });

  // Title
  y = 56;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(...navy);
  pdf.text("Incident Situation Report", M, y);

  y += 8;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...gray);
  pdf.text(`Incident Reference: ${incidentId}`, M, y);

  y += 13;

  // Status banner
  pdf.setFillColor(...(isDisasterSimulated ? red : green));
  pdf.roundedRect(M, y, W - 2 * M, 17, 3, 3, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(255, 255, 255);
  pdf.text(`INCIDENT STATUS: ${status}`, M + 5, y + 7);

  pdf.setFontSize(9);
  pdf.text(
    `TRANSFER: ${String(transferStatus || "N/A").toUpperCase()}`,
    M + 5,
    y + 13
  );

  y += 25;

  // Operational summary cards
  section("Operational Summary");

  const cards = [
    ["DISPATCHES", dispatches.length, blue],
    ["VEHICLES ACTIVE", activeVehicles.length, green],
    ["TOTAL VEHICLES", allVehicles.length, navy],
  ];

  const gap = 4;
  const cw = (W - 2 * M - gap * 2) / 3;

  cards.forEach((card, i) => {
    const x = M + i * (cw + gap);
    pdf.setFillColor(...light);
    pdf.roundedRect(x, y, cw, 22, 2, 2, "F");

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...gray);
    pdf.text(card[0], x + 4, y + 7);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.setTextColor(...card[2]);
    pdf.text(String(card[1]), x + 4, y + 17);
  });

  y += 30;

  // Incident information
  section("Incident Information");
  field("Incident ID", incidentId);
  field("Simulation Status", status);
  field("Road Condition", roadBlocked ? "Road blockage reported" : "No blockage reported");
  field("Transfer Status", transferStatus || "N/A");
  field("Report Generated", generated.toLocaleString());

  // Vehicle tracking
  section("Vehicle Tracking");

  if (allVehicles.length) {

table(
  ["VEHICLE", "STATUS", "SOURCE", "DESTINATION"],
  allVehicles.map((v, i) => {
    const vehicleName =
      v.name || v.vehicleName || v.id || `Vehicle ${i + 1}`;

    const dispatch = dispatches.find(log =>
      String(log.transfer || "").includes(vehicleName)
    );

    const transferText = dispatch?.transfer || "";

    const routeMatch = transferText.match(
      /:\s*(.*?)\s*->\s*(.*?)\s*[•|]/
    );

    return [
      vehicleName,
      String(v.status || "Unknown").replace(/_/g, " "),
      routeMatch?.[1] || "N/A",
      routeMatch?.[2] || "N/A",
    ];
  }),
  [35, 35, 48, W - 2 * M - 118]
);

  } else {
    field("Vehicles", "No vehicle records available");
  }

  // Dispatch history
  section("Dispatch & Resource Movement");

  if (dispatches.length) {
    table(
      ["TIME", "ACTION / RESOURCE", "TRANSFER DETAILS"],
      dispatches.map(l => [
        l.time || "N/A",
        l.action || "Dispatch",
        l.transfer || "N/A",
      ]),
      [28, 48, W - 2 * M - 76]
    );
  } else {
    field("Dispatch Records", "No dispatches recorded");
  }

  // Complete activity history
  section("Incident Activity Timeline");

  if (logs.length) {
    table(
      ["TIME", "EVENT", "DETAILS"],
      logs.map(l => [
        l.time || "N/A",
        l.action || "Activity",
        l.transfer || "No additional details",
      ]),
      [28, 45, W - 2 * M - 73]
    );
  } else {
    field("Activity", "No activity recorded");
  }

  // Closing summary
  section("Response Status");

  field("Incident", status);
  field("Resources Dispatched", dispatches.length);
  field("Vehicles Currently In Transit", activeVehicles.length);
  field("Road Blockage", roadBlocked ? "Reported" : "Not reported");

  y += 8;
  pdf.setFillColor(...navy);
  pdf.roundedRect(M, y, W - 2 * M, 18, 2, 2, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(255, 255, 255);
  pdf.text("ResQFlow", M + 4, y + 7);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(203, 213, 225);
  pdf.text("Coordinated Response. Better Prepared Communities.", M + 4, y + 13);

  // Page numbers
  const pages = pdf.internal.getNumberOfPages();

  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(226, 232, 240);
    pdf.line(M, H - 15, W - M, H - 15);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...gray);
    pdf.text("CONFIDENTIAL • OPERATIONAL REPORT", M, H - 9);
    pdf.text(`PAGE ${i} OF ${pages}`, W - M, H - 9, { align: "right" });
  }

  pdf.save(`ResQFlow_Incident_Report_${Date.now()}.pdf`);
};



  /* =======================================================
     RENDER
  ======================================================= */

  return (

    <div className="flex h-screen bg-slate-100 text-slate-800 font-sans overflow-hidden">

      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside className="w-60 bg-slate-900 text-white flex flex-col justify-between shrink-0">

        <div>

          <div className="px-5 py-5 border-b border-slate-800">

            <h1 className="text-xl font-black tracking-tight">
              ResQ<span className="text-blue-400">Flow</span>
            </h1>

            <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-widest">
              Disaster Response Network
            </p>

          </div>

          <nav className="p-3 space-y-1">

            {[
              'Overview',
              'Campuses',
              'Requests',
              'Donors',
              'Reports'
            ].map(
              (tab) => (

                <button
                  key={tab}
                  onClick={() =>
                    setActiveTab(
                      tab
                    )
                  }
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
                    activeTab ===
                    tab
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {tab}
                </button>

              )
            )}

          </nav>

        </div>

        <div className="p-4 border-t border-slate-800">

          <div className="flex items-center gap-2">

            <div
              className={`w-2 h-2 rounded-full ${
                fleetConnected
                  ? 'bg-emerald-400'
                  : 'bg-slate-500'
              }`}
            />

            <span className="text-[10px] text-slate-400">
              Realtime service{' '}
              {fleetConnected
                ? 'online'
                : 'offline'}
            </span>

          </div>

        </div>

      </aside>

      {/* =================================================
          MAIN
      ================================================= */}

      <div className="flex-1 flex flex-col overflow-y-auto">

        {/* HEADER */}

        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-[2000]">

          <div>

            <h2 className="font-bold text-lg text-slate-900">
              {activeTab}
            </h2>

            <p className="text-[10px] text-slate-400">

              {isDisasterSimulated
                ? 'LIVE simulation • events updating'
                : 'Monitoring • Update: live'}

            </p>

          </div>

          <div className="flex items-center gap-2">

            <button
              onClick={
                handleSimulateDisaster
              }
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5 shadow-sm"
            >

              <AlertTriangle className="w-3.5 h-3.5" />

              Simulate disaster

            </button>

            <button
              onClick={
                handleResetDemo
              }
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-lg"
            >
              Reset demo
            </button>

          </div>

        </header>

        {/* =================================================
            DISASTER PICKER
        ================================================= */}

        {showDisasterPicker && (

          <div className="fixed inset-0 z-[3000] bg-slate-900/60 flex items-center justify-center p-4">

            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 space-y-5">

              <div className="flex items-start justify-between">

                <div>

                  <h3 className="text-lg font-bold text-slate-900">
                    Simulate a disaster
                  </h3>

                  <p className="text-xs text-slate-500 mt-1">
                    Choose exactly which campus is in need.
                  </p>

                </div>

                <button
                  onClick={() =>
                    setShowDisasterPicker(
                      false
                    )
                  }
                  className="text-slate-400 hover:text-slate-700 text-xl"
                >
                  ×
                </button>

              </div>

              {isDisasterSimulated && (

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">

                  <b>
                    Existing disaster stays active.
                  </b>

                  {' '}

                  Starting another disaster will create a separate incident and a new available vehicle.

                </div>

              )}

              <div>

                <p className="text-xs font-bold text-slate-700 mb-2">
                  Select affected campus
                </p>

                <div className="grid grid-cols-3 gap-2">

                  {Object.keys(
                    campusLocations
                  ).map(
                    (campus) => (

                      <button
                        key={campus}
                        onClick={() =>
                          setSelectedNeed(
                            (prev) => ({
                              ...prev,
                              campus
                            })
                          )
                        }
                        className={`p-3 rounded-xl border text-xs font-bold ${
                          selectedNeed.campus ===
                          campus
                            ? 'bg-rose-50 border-rose-400 text-rose-700'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >

                        {campus}

                      </button>

                    )
                  )}

                </div>

              </div>

              <div>

                <p className="text-xs font-bold text-slate-700 mb-2">
                  Resource shortage
                </p>

                <select
                  value={
                    selectedNeed.resource
                  }
                  onChange={(e) =>
                    setSelectedNeed(
                      (prev) => ({
                        ...prev,
                        resource:
                          e.target.value
                      })
                    )
                  }
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                >

                  <option value="water">
                    Water shortage
                  </option>

                  <option value="medicine">
                    Medicine shortage
                  </option>

                </select>

              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">

                <b>
                  Selected:
                </b>

                {' '}

                {disasterOptions[
                  selectedNeed.campus
                ][
                  selectedNeed.resource
                ]}

                {' at '}

                {selectedNeed.campus}

                <br />

                Donor:

                {' '}

                {selectedNeed.campus ===
                'Campus B'
                  ? 'Campus A'
                  : 'Campus B'}

              </div>

              <div className="flex gap-2">

                <button
                  onClick={() =>
                    setShowDisasterPicker(
                      false
                    )
                  }
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-2.5 rounded-lg"
                >
                  Cancel
                </button>

                <button
                  onClick={
                    runDisasterSimulation
                  }
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs py-2.5 rounded-lg"
                >
                  Start simulation
                </button>

              </div>

            </div>

          </div>

        )}

        {/* =================================================
            ROAD REPORT MODAL
        ================================================= */}

        {showBlockReport && (

          <div className="fixed inset-0 z-[3000] bg-slate-900/60 flex items-center justify-center p-4">

            <form
              onSubmit={
                reportRoadBlock
              }
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4"
            >

              <div className="flex items-start justify-between">

                <div>

                  <h3 className="text-lg font-bold text-slate-900">
                    Report a road problem
                  </h3>

                  <p className="text-xs text-slate-500 mt-1">
                    Anyone at the campus can report a blockage so ResQFlow can recalculate the route.
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowBlockReport(
                      false
                    )
                  }
                  className="text-slate-400 hover:text-slate-700 text-xl"
                >
                  ×
                </button>

              </div>

              <div>

                <label className="text-xs font-semibold text-slate-700">
                  Which road is affected?
                </label>

                <select
                  value={
                    reportedRoad
                  }
                  onChange={(e) =>
                    setReportedRoad(
                      e.target.value
                    )
                  }
                  className="w-full mt-2 p-3 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                >

                  <option>
                    Current delivery route
                  </option>

                  <option>
                    Campus A ↔ Campus B
                  </option>

                  <option>
                    Campus B ↔ Campus C
                  </option>

                  <option>
                    Campus A ↔ Campus C
                  </option>

                </select>

              </div>

              <div>

                <label className="text-xs font-semibold text-slate-700">
                  What did you observe?
                </label>

                <select
                  value={
                    blockReportText
                  }
                  onChange={(e) =>
                    setBlockReportText(
                      e.target.value
                    )
                  }
                  className="w-full mt-2 p-3 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                >

                  <option>
                    Road blocked / traffic disruption
                  </option>

                  <option>
                    Flooded road
                  </option>

                  <option>
                    Accident / vehicle obstruction
                  </option>

                  <option>
                    Debris on road
                  </option>

                  <option>
                    Emergency road closure
                  </option>

                </select>

              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">

                <b>
                  Current trip:
                </b>

                {' '}

                {routePlan.donor}
                {' '}→{' '}
                {selectedNeed.campus}.

                {' '}

                After submission, ResQFlow will mark the route as blocked, find an alternate road and update the ETA.

              </div>

              <div className="flex gap-2">

                <button
                  type="button"
                  onClick={() =>
                    setShowBlockReport(
                      false
                    )
                  }
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-2.5 rounded-lg"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs py-2.5 rounded-lg"
                >
                  Submit road report
                </button>

              </div>

            </form>

          </div>

        )}

        {/* =================================================
            BODY
        ================================================= */}

        <main className="p-8 space-y-6">

          {/* =================================================
              OVERVIEW
          ================================================= */}

          {activeTab ===
            'Overview' && (

            <>

              {/* INCIDENT BANNER */}

              {isDisasterSimulated ? (

                <div className="p-4 bg-rose-50 border-l-4 border-rose-600 rounded-r-xl shadow-sm">

                  <div className="flex items-center justify-between gap-4">

                    <div>

                      <h3 className="text-base font-bold text-rose-900 flex items-center gap-2">

                        <Radio className="w-4 h-4 animate-pulse" />

                        Multi-campus disaster mode active

                      </h3>

                      <p className="text-xs text-rose-700 mt-0.5">

                        {selectedNeed.campus}
                        {' '}
                        {selectedNeed.resource}
                        {' '}shortage •{' '}
                        {routePlan.donor}
                        {' '}selected as donor • live route monitoring

                      </p>

                    </div>

                    <div className="flex items-center gap-2">

                      <span className="text-[10px] font-bold uppercase bg-blue-600 text-white px-2.5 py-1 rounded-full">
                        {incidents.length}{' '}
                        incident
                        {incidents.length ===
                        1
                          ? ''
                          : 's'}
                      </span>

                      <span className="text-[10px] font-bold uppercase bg-rose-600 text-white px-2.5 py-1 rounded-full">
                        LIVE
                      </span>

                    </div>

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

              {/* CAMPUS CARDS */}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {Object.keys(
                  stock
                ).map(
                  (campus) => {

                    const status =
                      getCampusStatus(
                        campus
                      );

                    const waterHours =
                      getCampusHours(
                        campus,
                        'water'
                      );

                    const medicineHours =
                      getCampusHours(
                        campus,
                        'medicine'
                      );

                    const waterPercent =
                      getCampusPercent(
                        campus,
                        'water'
                      );

                    const medicinePercent =
                      getCampusPercent(
                        campus,
                        'medicine'
                      );

                    const isAffected =
                      selectedNeed.campus ===
                        campus &&
                      isDisasterSimulated &&
                      transferStatus !==
                        'delivered';

                    return (

                      <div
                        key={campus}
                        className={`bg-white p-5 rounded-xl border shadow-sm space-y-4 ${
                          isAffected
                            ? 'border-rose-300 ring-2 ring-rose-100'
                            : 'border-slate-200'
                        }`}
                      >

                        <div className="flex items-center justify-between">

                          <h4 className="font-bold text-slate-800">
                            {campus}
                          </h4>

                          {status && (

                            <span className="bg-rose-100 text-rose-700 font-bold text-[9px] px-2 py-1 rounded-full">
                              {status}
                            </span>

                          )}

                        </div>

                        {/* WATER */}

                        <div className="space-y-1">

                          <div className="flex justify-between text-xs">

                            <span className="flex items-center gap-1 text-slate-600">

                              <Droplets className="w-3.5 h-3.5 text-blue-500" />

                              Water

                            </span>

                            <span className="text-slate-400">
                              Reserve{' '}
                              {
                                STOCK_META[
                                  campus
                                ].reserveWater
                              }
                            </span>

                          </div>

                          <div className="text-2xl font-bold text-slate-900">

                            {waterHours}

                            <span className="text-xs font-normal text-slate-500">
                              {' '}hours left
                            </span>

                          </div>

                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">

                            <div
                              className={`h-full ${
                                isAffected &&
                                selectedNeed.resource ===
                                  'water'
                                  ? 'bg-rose-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{
                                width: `${waterPercent}%`
                              }}
                            />

                          </div>

                        </div>

                        {/* MEDICINE */}

                        <div className="space-y-1 pt-2 border-t border-slate-100">

                          <div className="flex justify-between text-xs">

                            <span className="flex items-center gap-1 text-slate-600">

                              <Pill className="w-3.5 h-3.5 text-emerald-500" />

                              Medicine

                            </span>

                            <span className="text-slate-400">
                              Reserve{' '}
                              {
                                STOCK_META[
                                  campus
                                ].reserveMedicine
                              }
                            </span>

                          </div>

                          <div className="text-2xl font-bold text-slate-900">

                            {medicineHours}

                            <span className="text-xs font-normal text-slate-500">
                              {' '}hours left
                            </span>

                          </div>

                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">

                            <div
                              className={`h-full ${
                                isAffected &&
                                selectedNeed.resource ===
                                  'medicine'
                                  ? 'bg-rose-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{
                                width: `${medicinePercent}%`
                              }}
                            />

                          </div>

                        </div>

                      </div>

                    );

                  }
                )}

              </div>

              {/* MAP + ACTIONS */}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* MAP */}

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">

                  <h4 className="font-bold text-slate-800 mb-3">
                    Live map
                  </h4>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg h-72 relative overflow-hidden">

                    <MapContainer
                      center={
                        campusLocations[
                          selectedNeed.campus
                        ]
                      }
                      zoom={13}
                      scrollWheelZoom={true}
                      className="w-full h-full z-0"
                    >

                      <TileLayer
                        attribution="&copy; OpenStreetMap contributors"
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />

                      {/* CAMPUSES */}

                      {Object.entries(
                        campusLocations
                      ).map(
                        ([campus, position]) => (

                          <CircleMarker
                            key={campus}
                            center={position}
                            radius={
                              selectedNeed.campus ===
                                campus &&
                              isDisasterSimulated
                                ? 12
                                : 8
                            }
                            pathOptions={{
                              color:
                                selectedNeed.campus ===
                                  campus &&
                                isDisasterSimulated
                                  ? '#dc2626'
                                  : '#2563eb',

                              fillColor:
                                selectedNeed.campus ===
                                  campus &&
                                isDisasterSimulated
                                  ? '#ef4444'
                                  : '#3b82f6',

                              fillOpacity: 0.9
                            }}
                          >

                            <Popup>

                              <b>
                                {campus}
                              </b>

                              <br />

                              {selectedNeed.campus ===
                                campus &&
                              isDisasterSimulated
                                ? `${selectedNeed.resource} shortage`
                                : 'Resource hub'}

                            </Popup>

                          </CircleMarker>

                        )
                      )}

                      {/* NORMAL ROUTE */}

                      {routeCoords.length >
                        1 &&
                        !roadBlocked && (

                          <Polyline
                            positions={
                              routeCoords
                            }
                            pathOptions={{
                              color:
                                '#2563eb',
                              weight: 6,
                              opacity: 0.9
                            }}
                          />

                        )}

                      {/* OLD BLOCKED ROUTE */}

                      {roadBlocked &&
                        rerouteInfo?.oldRoute
                          ?.length > 1 && (

                          <Polyline
                            positions={
                              rerouteInfo.oldRoute
                            }
                            pathOptions={{
                              color:
                                '#ef4444',
                              weight: 5,
                              dashArray:
                                '8 10',
                              opacity:
                                0.85
                            }}
                          />

                        )}

                      {/* NEW ROUTE */}

                      {roadBlocked &&
                        routeCoords.length >
                          1 && (

                          <Polyline
                            positions={
                              routeCoords
                            }
                            pathOptions={{
                              color:
                                '#2563eb',
                              weight: 7,
                              opacity: 1
                            }}
                          />

                        )}

                      {/* BLOCK MARKER */}

                      {roadBlocked &&
                        rerouteInfo?.oldRoute
                          ?.length > 1 && (

                          <CircleMarker
                            center={
                              rerouteInfo.oldRoute[
                                Math.floor(
                                  rerouteInfo
                                    .oldRoute
                                    .length /
                                    2
                                )
                              ]
                            }
                            radius={9}
                            pathOptions={{
                              color:
                                '#b91c1c',
                              fillColor:
                                '#ef4444',
                              fillOpacity:
                                1
                            }}
                          >

                            <Popup>

                              <b>
                                🚧 ROAD BLOCK
                              </b>

                              <br />

                              {blockReportText}

                              <br />

                              Alternate route active

                            </Popup>

                          </CircleMarker>

                        )}

                      {/* LIVE VEHICLES */}

                      {Object.values(
                        vehicles
                      ).map(
                        (vehicle) => {

                          if (
                            vehicle.lat ==
                              null ||
                            vehicle.lon ==
                              null
                          ) {
                            return null;
                          }

                          return (

                            <CircleMarker
                              key={
                                vehicle.vehicleId
                              }
                              center={[
                                Number(
                                  vehicle.lat
                                ),
                                Number(
                                  vehicle.lon
                                )
                              ]}
                              radius={10}
                              pathOptions={{
                                color:
                                  '#1d4ed8',
                                fillColor:
                                  '#60a5fa',
                                fillOpacity:
                                  1
                              }}
                            >

                              <Popup>

                                <b>
                                  🚚{' '}
                                  {vehicle.name}
                                </b>

                                <br />

                                LIVE GPS • IN TRANSIT

                                <br />

                                {vehicle.resource}
                                {' • '}
                                {vehicle.quantity}

                                <br />

                                ETA:{' '}
                                {vehicle.etaMin ??
                                  '—'}{' '}
                                min

                                <br />

                                Accuracy:{' '}
                                {vehicle.accuracyM ??
                                  '—'}{' '}
                                m

                                <br />

                                Last GPS:{' '}
                                {vehicle.lastSeen
                                  ? new Date(
                                      vehicle.lastSeen
                                    ).toLocaleTimeString()
                                  : '—'}

                              </Popup>

                            </CircleMarker>

                          );

                        }
                      )}

                    </MapContainer>

                    {/* MAP LABEL */}

                    <div className="absolute top-3 left-3 z-[1000] bg-white/95 border rounded-lg px-3 py-2 text-[10px] shadow-sm">

                      <p className="font-bold text-slate-800">
                        REAL ROAD MAP
                      </p>

                      <p className="text-slate-500">
                        OpenStreetMap + live route calculation
                      </p>

                    </div>

                    {/* VEHICLE COUNT */}

                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/90 text-white rounded-lg px-3 py-2 text-[10px] shadow-sm">

                      <b>
                        {liveVehicleCount}
                      </b>

                      {' '}live vehicle
                      {liveVehicleCount ===
                      1
                        ? ''
                        : 's'}

                      {' • '}

                      {fleetConnected
                        ? 'GPS link connected'
                        : 'GPS link offline'}

                    </div>

                    {/* ROUTE STATUS */}

                    {isDisasterSimulated && (

                      <div className="absolute bottom-3 left-3 right-3 z-[1000] bg-white/95 border rounded-lg px-3 py-2 text-[10px] shadow-sm">

                        <div className="flex justify-between items-center gap-3">

                          <span className="font-semibold">

                            {routeStage ===
                              'detecting' &&
                              '⚡ Detecting incident...'}

                            {routeStage ===
                              'rerouting' &&
                              '🔄 Road condition changed — recalculating...'}

                            {routeStage ===
                              'ready' &&
                              transferStatus !==
                                'in_transit' &&
                              '✓ Road OPEN — normal route ready'}

                            {routeStage ===
                              'rerouted' &&
                              (
                                transferStatus ===
                                'in_transit'
                                  ? `🚚 Vehicle en route to ${selectedNeed.campus}`
                                  : `✓ Alternate route active to ${selectedNeed.campus}`
                              )}

                          </span>

                          {routeLoading && (

                            <span className="text-slate-500">
                              Finding route...
                            </span>

                          )}

                        </div>

                        {routeStage ===
                          'rerouted' && (

                          <div className="mt-1 flex flex-wrap gap-3 text-slate-600">

                            <span>
                              <b>
                                {routeInfo.distanceKm ||
                                  '—'}{' '}
                                km
                              </b>{' '}
                              route
                            </span>

                            <span>
                              <b>
                                {transferStatus ===
                                'in_transit'
                                  ? remainingMinutes
                                  : routeInfo.durationMin ||
                                    '—'}{' '}
                                min
                              </b>{' '}

                              {transferStatus ===
                              'in_transit'
                                ? 'remaining'
                                : 'estimated'}

                            </span>

                            {transferStatus ===
                              'in_transit' && (

                              <span>
                                <b>
                                  {progressPercent}%
                                </b>{' '}
                                complete
                              </span>

                            )}

                          </div>

                        )}

                      </div>

                    )}

                    {/* REROUTE INFO */}

                    {rerouteInfo &&
                      roadBlocked && (

                        <div className="absolute top-16 left-3 z-[1000] bg-white/95 border border-amber-200 rounded-lg px-3 py-2 text-[10px] shadow-sm max-w-[250px]">

                          <p className="font-bold text-amber-800">
                            ↪ REROUTED AROUND BLOCK
                          </p>

                          <p className="text-slate-600 mt-1">

                            New route:{' '}

                            <b>
                              {rerouteInfo.distanceKm}
                              {' '}km
                            </b>

                            {' • '}

                            <b>
                              {rerouteInfo.durationMin}
                              {' '}min
                            </b>

                          </p>

                          <p className="text-slate-500 mt-0.5">
                            {rerouteInfo.reason}
                          </p>

                        </div>

                      )}

                    {/* ROAD REPORT BUTTON */}

                    <button
                      onClick={() =>
                        setShowBlockReport(
                          true
                        )
                      }
                      disabled={
                        !isDisasterSimulated ||
                        roadBlocked
                      }
                      className="absolute top-3 right-3 z-[1000] bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-3 py-2 text-[10px] font-bold shadow-sm"
                    >
                      Report road block
                    </button>

                  </div>

                  <div className="text-[11px] text-slate-500 mt-2 flex justify-between gap-3">

                    <span>

                      Incident:{' '}
                      <b>
                        {selectedNeed.campus}
                      </b>

                      {' • '}

                      {selectedNeed.resource}

                      {' • Route: '}

                      {routePlan.donor}
                      {' → '}
                      {selectedNeed.campus}

                      {routeInfo.distanceKm
                        ? ` • ${routeInfo.distanceKm} km • ${routeInfo.durationMin} min`
                        : ''}

                    </span>

                    {roadBlocked ? (

                      <span className="font-semibold text-rose-600">
                        Road block reported • alternate route active
                      </span>

                    ) : (

                      <span className="font-semibold text-emerald-600">
                        Road OPEN • normal route active
                      </span>

                    )}

                  </div>

                </div>

                {/* =================================================
                    RECOMMENDED ACTIONS
                ================================================= */}

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">

                  <h4 className="font-bold text-slate-800 mb-3">
                    Recommended actions
                  </h4>

                  {isDisasterSimulated &&
                    transferStatus ===
                      'in_transit' ? (

                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl space-y-3">

                      <div className="flex justify-between items-start">

                        <div>

                          <h5 className="font-bold text-slate-900 text-sm flex items-center gap-2">

                            <Truck className="w-4 h-4 text-blue-600" />

                            Vehicle in transit

                          </h5>

                          <p className="text-xs text-slate-600 mt-1">

                            {routePlan.donor}
                            {' ➔ '}
                            {selectedNeed.campus}
                            {' • live vehicle tracking'}

                          </p>

                        </div>

                        <span className="bg-blue-100 text-blue-700 font-bold text-[10px] px-2 py-0.5 rounded">
                          DISPATCHED
                        </span>

                      </div>

                      <div className="grid grid-cols-3 gap-2">

                        <div className="bg-white rounded-lg border p-3">

                          <p className="text-[10px] text-slate-500">
                            ETA
                          </p>

                          <p className="text-xl font-bold text-blue-700">
                            {remainingMinutes} min
                          </p>

                        </div>

                        <div className="bg-white rounded-lg border p-3">

                          <p className="text-[10px] text-slate-500">
                            Progress
                          </p>

                          <p className="text-xl font-bold text-slate-800">
                            {progressPercent}%
                          </p>

                        </div>

                        <div className="bg-white rounded-lg border p-3">

                          <p className="text-[10px] text-slate-500">
                            Route
                          </p>

                          <p className="text-xl font-bold text-slate-800">
                            {routeInfo.distanceKm}
                            {' '}km
                          </p>

                        </div>

                      </div>

                      <div className="bg-white border rounded-lg p-3 text-[11px] text-slate-600">

                        <b>
                          Driver GPS:
                        </b>

                        {' '}

                        {activeVehicle?.gpsOnline
                          ? 'LIVE — driver phone is connected.'
                          : 'WAITING — select the assigned vehicle on the driver phone and allow location access.'}

                      </div>

                    </div>

                  ) : (

                    isDisasterSimulated ? (

                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">

                        <div className="flex justify-between items-start">

                          <div>

                            <h5 className="font-bold text-slate-900 text-sm">

                              {selectedNeed.resource ===
                              'water'
                                ? 'Send 2,000 L of water'
                                : 'Send 30 units of medicine'}

                            </h5>

                            <p className="text-xs text-slate-600">

                              Route selected:{' '}
                              {routePlan.donor}
                              {' ➔ '}
                              {selectedNeed.campus}
                              {' • live road route'}

                            </p>

                          </div>

                          <span className="bg-rose-100 text-rose-700 font-bold text-[10px] px-2 py-0.5 rounded">
                            Priority 01
                          </span>

                        </div>

                        <div className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200 space-y-1">

                          <p className="font-semibold text-slate-800">
                            Why this transfer?
                          </p>

                          <ul className="list-disc list-inside space-y-0.5 text-[11px]">

                            <li>
                              {selectedNeed.campus}'s{' '}
                              {selectedNeed.resource}
                              {' '}stock is projected to reach critical level.
                            </li>

                            <li>
                              {routePlan.donor}
                              {' '}has sufficient reserve available for transfer.
                            </li>

                            <li>
                              {roadBlocked
                                ? 'Road condition changed; ResQFlow recalculated the route automatically.'
                                : 'Live road check completed; route is currently available.'}
                            </li>

                          </ul>

                        </div>

                        <div className="flex gap-2">

                          <button
                            onClick={() =>
                              handleApproveTransfer(
                                selectedNeed.resource
                              )
                            }
                            disabled={
                              ![
                                'ready',
                                'rerouted'
                              ].includes(
                                routeStage
                              ) ||
                              routeLoading
                            }
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center gap-1"
                          >

                            <Check className="w-3.5 h-3.5" />

                            Approve & dispatch

                          </button>

                          <button
                            type="button"
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-2 rounded-lg"
                          >
                            Modify
                          </button>

                          <button
                            type="button"
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-2 rounded-lg"
                          >
                            Decline
                          </button>

                        </div>

                      </div>

                    ) : requestRaised ? (

                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">

                        <h5 className="font-bold text-slate-900 text-sm">
                          Send 30 units of medicine
                        </h5>

                        <p className="text-xs text-slate-600">
                          {routePlan.donor}
                          {' ➔ '}
                          {selectedNeed.campus}
                          {' • live road route'}
                        </p>

                        <button
                          onClick={() =>
                            handleApproveTransfer(
                              'medicine'
                            )
                          }
                          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-lg"
                        >
                          Approve
                        </button>

                      </div>

                    ) : (

                      <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-xl text-center text-emerald-800">

                        <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-2" />

                        <p className="font-bold text-sm">
                          Every need is covered. No transfers to approve.
                        </p>

                      </div>

                    )

                  )}

                </div>

              </div>

              {/* =================================================
                  ACTIVE ROAD REPORTS
              ================================================= */}

              {isDisasterSimulated && (

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">

                  <div className="flex items-center justify-between mb-4">

                    <div>

                      <h4 className="font-bold text-slate-800">
                        Active road reports
                      </h4>

                      <p className="text-[10px] text-slate-500 mt-1">
                        Reports can be cleared after the road is reopened.
                      </p>

                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                        roadReports.length > 0
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {roadReports.length}{' '}
                      active
                    </span>

                  </div>

                  {roadReports.length ===
                  0 ? (

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-500">
                      No active road reports.
                    </div>

                  ) : (

                    <div className="space-y-3">

                      {roadReports.map(
                        (report) => (

                          <div
                            key={
                              report.id
                            }
                            className="border border-rose-200 bg-rose-50 rounded-xl p-4"
                          >

                            <div className="flex items-start justify-between gap-4">

                              <div>

                                <div className="flex items-center gap-2">

                                  <span className="text-lg">
                                    🚧
                                  </span>

                                  <div>

                                    <p className="font-bold text-sm text-rose-900">
                                      {report.road}
                                    </p>

                                    <p className="text-[11px] text-rose-700">
                                      {report.type}
                                    </p>

                                  </div>

                                </div>

                                <p className="text-[10px] text-slate-500 mt-2">

                                  Reported at{' '}

                                  {new Date(
                                    report.reportedAt
                                  ).toLocaleTimeString()}

                                </p>

                              </div>

                              <span className="text-[9px] font-bold bg-rose-600 text-white px-2 py-1 rounded-full">
                                BLOCKED
                              </span>

                            </div>

                            <button
                              onClick={() =>
                                clearRoadReport(
                                  report.id
                                )
                              }
                              className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg"
                            >
                              ✓ Clear road block
                            </button>

                          </div>

                        )
                      )}

                    </div>

                  )}

                </div>

              )}

              {/* =================================================
                  LIVE FLEET TRACKING
              ================================================= */}

              {isDisasterSimulated && (

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">

                  <div className="flex items-center justify-between mb-4">

                    <div>

                      <h4 className="font-bold text-slate-800 flex items-center gap-2">

                        <Navigation className="w-4 h-4 text-blue-600" />

                        Live fleet tracking

                      </h4>

                      <p className="text-[10px] text-slate-500">
                        Real GPS comes directly from each assigned driver's phone. Multiple vehicles can be tracked simultaneously.
                      </p>

                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                        fleetConnected
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {fleetConnected
                        ? 'GPS SERVICE ONLINE'
                        : 'GPS SERVICE OFFLINE'}
                    </span>

                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">

                    {Object.values(
                      vehicles
                    ).length ===
                    0 ? (

                      <div className="text-xs text-slate-500 bg-slate-50 border rounded-lg p-4">

                        No live vehicles yet.

                        <br />

                        Approve a transfer, then select the assigned vehicle on the driver's phone and allow location access.

                      </div>

                    ) : (

                      Object.values(
                        vehicles
                      ).map(
                        (vehicle) => (

                          <div
                            key={
                              vehicle.vehicleId
                            }
                            className="border border-slate-200 rounded-xl p-4 bg-slate-50"
                          >

                            <div className="flex items-start justify-between gap-3">

                              <div>

                                <p className="font-bold text-sm text-slate-800 flex items-center gap-2">

                                  <Navigation className="w-4 h-4 text-blue-600" />

                                  {vehicle.name ||
                                    'Vehicle'}

                                </p>

                                <p className="text-[9px] text-slate-400 mt-1">
                                  ID:{' '}
                                  {vehicle.vehicleId}
                                </p>

                              </div>

                              <span
                                className={`text-[9px] font-bold px-2 py-1 rounded-full ${
                                  vehicle.status ===
                                  'in_transit'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >

                                {String(
                                  vehicle.status ||
                                    'READY'
                                )
                                  .replace(
                                    '_',
                                    ' '
                                  )
                                  .toUpperCase()}

                              </span>

                            </div>

                            <div className="mt-3 bg-white border rounded-lg p-3">

                              <p className="text-[9px] text-slate-400 uppercase font-bold">
                                Cargo
                              </p>

                              <p className="text-sm font-bold text-slate-800 mt-1">

                                {vehicle.resource ===
                                'water'
                                  ? '💧 Water'
                                  : vehicle.resource ===
                                    'medicine'
                                  ? '💊 Medicine'
                                  : '📦 Supplies'}

                              </p>

                              {vehicle.quantity !=
                                null && (

                                <p className="text-[10px] text-slate-500 mt-1">

                                  Quantity:{' '}
                                  {
                                    vehicle.quantity
                                  }

                                </p>

                              )}

                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-2">

                              <div className="bg-white border rounded-lg p-2">

                                <p className="text-[9px] text-slate-400 uppercase">
                                  From
                                </p>

                                <p className="text-xs font-bold text-slate-800 mt-1">
                                  {vehicle.donor ||
                                    '—'}
                                </p>

                              </div>

                              <div className="bg-white border rounded-lg p-2">

                                <p className="text-[9px] text-slate-400 uppercase">
                                  Destination
                                </p>

                                <p className="text-xs font-bold text-slate-800 mt-1">
                                  {vehicle.target ||
                                    '—'}
                                </p>

                              </div>

                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-2">

                              <div className="bg-white border rounded-lg p-2">

                                <p className="text-[9px] text-slate-400 uppercase">
                                  ETA
                                </p>

                                <p className="text-sm font-bold text-blue-700 mt-1">

                                  {vehicle.etaMin !=
                                  null
                                    ? `${vehicle.etaMin} min`
                                    : '—'}

                                </p>

                              </div>

                              <div className="bg-white border rounded-lg p-2">

                                <p className="text-[9px] text-slate-400 uppercase">
                                  Distance
                                </p>

                                <p className="text-sm font-bold text-slate-800 mt-1">

                                  {vehicle.distanceKm !=
                                  null
                                    ? `${vehicle.distanceKm} km`
                                    : '—'}

                                </p>

                              </div>

                            </div>

                            {/* GPS STATUS */}

                            <div className="mt-2 bg-white border rounded-lg p-3">

                              <div className="flex items-center justify-between">

                                <div>

                                  <p className="text-[9px] text-slate-400 uppercase">
                                    GPS Status
                                  </p>

                                  <p
                                    className={`text-sm font-bold mt-1 ${
                                      vehicle.gpsOnline
                                        ? 'text-emerald-600'
                                        : 'text-amber-600'
                                    }`}
                                  >

                                    {vehicle.gpsOnline
                                      ? '🟢 LIVE GPS'
                                      : '🟡 GPS WAITING'}

                                  </p>

                                </div>

                                <div className="text-right">

                                  <p className="text-[9px] text-slate-400 uppercase">
                                    Accuracy
                                  </p>

                                  <p className="text-sm font-bold text-slate-800 mt-1">

                                    {vehicle.gpsOnline &&
                                    vehicle.accuracyM !=
                                      null
                                      ? `±${vehicle.accuracyM} m`
                                      : '—'}

                                  </p>

                                </div>

                              </div>

                              {vehicle.lat !=
                                null &&
                              vehicle.lon !=
                                null ? (

                                <div className="mt-3 bg-slate-900 rounded-lg p-2">

                                  <p className="text-[9px] text-slate-400 uppercase">
                                    Live coordinates
                                  </p>

                                  <p className="text-[10px] text-emerald-300 font-mono mt-1">

                                    {Number(
                                      vehicle.lat
                                    ).toFixed(6)}

                                    {', '}

                                    {Number(
                                      vehicle.lon
                                    ).toFixed(6)}

                                  </p>

                                </div>

                              ) : (

                                <p className="text-[10px] text-slate-400 mt-2">
                                  Waiting for driver phone GPS…
                                </p>

                              )}

                            </div>

                          </div>

                        )
                      )

                    )}

                  </div>

                </div>

              )}

              {/* =================================================
                  LIVE INCIDENTS
              ================================================= */}

              {isDisasterSimulated && (

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  <div className="bg-slate-900 text-white p-5 rounded-xl shadow-sm">

                    <div className="flex items-center justify-between mb-4">

                      <h4 className="font-bold flex items-center gap-2">

                        <Radio className="w-4 h-4 text-rose-400" />

                        Live incident feed

                      </h4>

                      <span className="text-[9px] uppercase font-bold bg-rose-500 px-2 py-1 rounded-full">
                        Live
                      </span>

                    </div>

                    <div className="space-y-2 max-h-56 overflow-auto">

                      {activeIncident.length ===
                      0 ? (

                        <p className="text-[11px] text-slate-500">
                          Waiting for incident events...
                        </p>

                      ) : (

                        activeIncident.map(
                          (
                            incident,
                            index
                          ) => (

                            <div
                              key={
                                index
                              }
                              className="flex gap-2 text-[11px] border-b border-slate-800 pb-2"
                            >

                              <span className="text-slate-500 font-mono">
                                now
                              </span>

                              <span>
                                {incident}
                              </span>

                            </div>

                          )
                        )

                      )}

                    </div>

                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">

                    <div className="flex items-center justify-between mb-4">

                      <h4 className="font-bold text-slate-800">
                        Manual response vs ResQFlow
                      </h4>

                      <span className="text-[9px] text-slate-400">
                        Illustrative prototype comparison
                      </span>

                    </div>

                    <div className="grid grid-cols-2 gap-3">

                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">

                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">
                          Manual
                        </p>

                        <p className="text-2xl font-bold text-slate-800">
                          ~45 min
                        </p>

                        <p className="text-[10px] text-slate-500 mt-1">
                          Phone calls → stock check → road check → transport
                        </p>

                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">

                        <p className="text-[10px] font-bold text-blue-600 uppercase mb-2">
                          ResQFlow
                        </p>

                        <p className="text-2xl font-bold text-blue-700">
                          ~2 min
                        </p>

                        <p className="text-[10px] text-blue-700 mt-1">
                          Detect → prioritize → reroute → recommend
                        </p>

                      </div>

                    </div>

                    <p className="text-[9px] text-slate-400 mt-3">
                      *Illustrative comparison for the prototype, not a measured real-world performance claim.
                    </p>

                  </div>

                </div>

              )}

            </>

          )}

          {/* =================================================
              CAMPUSES
          ================================================= */}

          {activeTab ===
            'Campuses' && (

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">

                <h4 className="font-bold text-slate-800">
                  Update stock
                </h4>

                <p className="text-xs text-slate-400">
                  Fill in ready stock, consumption rate and reserve.
                </p>

                <StockEditor
                  stock={stock}
                  setStock={setStock}
                  socket={socket}
                  setStockUpdatedAt={
                    setStockUpdatedAt
                  }
                />

                <p className="text-[10px] text-slate-400">

                  Stock is dynamic: edits update the dashboard immediately and are broadcast to connected clients.

                  {' '}

                  Last local update:{' '}

                  {new Date(
                    stockUpdatedAt
                  ).toLocaleTimeString()}

                </p>

              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">

                <h4 className="font-bold text-slate-800">
                  Vehicles
                </h4>

                <div className="space-y-2 text-xs">

                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">

                    <div>

                      <p className="font-bold text-slate-800">
                        Tanker 1{' '}

                        <span className="font-normal text-slate-500">
                          at Campus B
                        </span>

                      </p>

                      <p className="text-[11px] text-slate-400">
                        Capacity 1,000
                      </p>

                    </div>

                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-semibold text-[10px]">
                      Available
                    </span>

                  </div>

                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">

                    <div>

                      <p className="font-bold text-slate-800">
                        Tanker 2{' '}

                        <span className="font-normal text-slate-500">
                          at Campus B
                        </span>

                      </p>

                      <p className="text-[11px] text-slate-400">
                        Capacity 1,000
                      </p>

                    </div>

                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-semibold text-[10px]">
                      Available
                    </span>

                  </div>

                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">

                    <div>

                      <p className="font-bold text-slate-800">
                        Tanker 3{' '}

                        <span className="font-normal text-slate-500">
                          at Campus B
                        </span>

                      </p>

                      <p className="text-[11px] text-slate-400">
                        Capacity 1,000
                      </p>

                    </div>

                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-semibold text-[10px]">
                      Available
                    </span>

                  </div>

                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">

                    <div>

                      <p className="font-bold text-slate-800">
                        Medical Van 1{' '}

                        <span className="font-normal text-slate-500">
                          at Campus A
                        </span>

                      </p>

                      <p className="text-[11px] text-slate-400">
                        Capacity 500
                      </p>

                    </div>

                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-semibold text-[10px]">
                      Available
                    </span>

                  </div>

                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">

                    <div>

                      <p className="font-bold text-slate-800">
                        Medical Van 2{' '}

                        <span className="font-normal text-slate-500">
                          at Campus A
                        </span>

                      </p>

                      <p className="text-[11px] text-slate-400">
                        Capacity 500
                      </p>

                    </div>

                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-semibold text-[10px]">
                      Available
                    </span>

                  </div>

                </div>

              </div>

            </div>

          )}

          {/* =================================================
              REQUESTS
          ================================================= */}

          {activeTab ===
            'Requests' && (

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 max-w-xl">

              <h4 className="font-bold text-slate-800">
                Raise a request
              </h4>

              <form
                onSubmit={
                  handleRaiseRequest
                }
                className="space-y-3 text-xs"
              >

                <div>

                  <label className="text-slate-600 font-semibold">
                    Campus
                  </label>

                  <select
                    value={
                      reqCamp
                    }
                    onChange={(e) =>
                      setReqCamp(
                        e.target.value
                      )
                    }
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded-lg"
                  >

                    <option>
                      Campus A
                    </option>

                    <option>
                      Campus B
                    </option>

                    <option>
                      Campus C
                    </option>

                  </select>

                </div>

                <div>

                  <label className="text-slate-600 font-semibold">
                    Resource
                  </label>

                  <select
                    value={
                      reqResource
                    }
                    onChange={(e) =>
                      setReqResource(
                        e.target.value
                      )
                    }
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded-lg"
                  >

                    <option value="medicine">
                      medicine
                    </option>

                    <option value="water">
                      water
                    </option>

                  </select>

                </div>

                <div className="grid grid-cols-2 gap-3">

                  <div>

                    <label className="text-slate-600 font-semibold">
                      Quantity needed
                    </label>

                    <input
                      type="text"
                      value={
                        reqQty
                      }
                      onChange={(e) =>
                        setReqQty(
                          e.target.value
                        )
                      }
                      className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded-lg"
                    />

                  </div>

                  <div>

                    <label className="text-slate-600 font-semibold">
                      Needed within (hours)
                    </label>

                    <input
                      type="text"
                      value={
                        reqHours
                      }
                      onChange={(e) =>
                        setReqHours(
                          e.target.value
                        )
                      }
                      className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded-lg"
                    />

                  </div>

                </div>

                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-lg"
                >
                  Raise request
                </button>

              </form>

            </div>

          )}

          {/* =================================================
              DONORS
          ================================================= */}

          {activeTab ===
            'Donors' && (

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 max-w-xl">

              <h4 className="font-bold text-slate-800">
                Offer a donation
              </h4>

              <form
                onSubmit={
                  handleOfferDonation
                }
                className="space-y-3 text-xs"
              >

                <div>

                  <label className="text-slate-600 font-semibold">
                    Donor Name
                  </label>

                  <input
                    type="text"
                    value={
                      donorName
                    }
                    onChange={(e) =>
                      setDonorName(
                        e.target.value
                      )
                    }
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded-lg"
                  />

                </div>

                <div className="grid grid-cols-2 gap-3">

                  <div>

                    <label className="text-slate-600 font-semibold">
                      Resource
                    </label>

                    <select
                      value={
                        donorResource
                      }
                      onChange={(e) =>
                        setDonorResource(
                          e.target.value
                        )
                      }
                      className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded-lg"
                    >

                      <option value="water">
                        water
                      </option>

                      <option value="medicine">
                        medicine
                      </option>

                    </select>

                  </div>

                  <div>

                    <label className="text-slate-600 font-semibold">
                      Quantity
                    </label>

                    <input
                      type="text"
                      value={
                        donorQty
                      }
                      onChange={(e) =>
                        setDonorQty(
                          e.target.value
                        )
                      }
                      className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded-lg"
                    />

                  </div>

                </div>

                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-lg"
                >
                  Offer donation
                </button>

              </form>

              {donorOffered && (

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-medium">

                  Accepted as intended: Campus A still needs water. Donation accepted as intended.

                </div>

              )}

            </div>

          )}

          {/* =================================================
              REPORTS
          ================================================= */}

          {activeTab ===
            'Reports' && (

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">

              <div className="flex justify-between items-center">

                <h4 className="font-bold text-slate-800">
                  Decision log
                </h4>

                
<button
  type="button"
  onClick={generatePDFReport}
  className="bg-slate-100 border border-slate-300 hover:bg-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 font-semibold"
>
  <Download className="w-3.5 h-3.5" />
  Generate PDF Report
</button>


              </div>

              {logs.length ===
              0 ? (

                <p className="text-xs text-slate-400">
                  No decisions recorded yet.
                </p>

              ) : (

                <div className="divide-y divide-slate-100 text-xs">

                  {logs.map(
                    (log) => (

                      <div
                        key={
                          log.id
                        }
                        className="py-2.5 flex items-center gap-3"
                      >

                        <span className="text-slate-400 font-mono text-[11px]">
                          {log.time}
                        </span>

                        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold text-[10px] uppercase">
                          {log.action}
                        </span>

                        <span className="font-semibold text-slate-800">
                          {log.transfer}
                        </span>

                      </div>

                    )
                  )}

                </div>

              )}

            </div>

          )}

        </main>

      </div>

    </div>

  );

}