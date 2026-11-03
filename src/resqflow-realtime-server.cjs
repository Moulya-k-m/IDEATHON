// ============================================================
// RESQFLOW REALTIME SERVER
// File: resqflow-realtime-server.cjs
// Run: node .\resqflow-realtime-server.cjs
// ============================================================

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

// ============================================================
// APP
// ============================================================

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

app.use(express.json());

const server = http.createServer(app);

// ============================================================
// SOCKET.IO
// ============================================================

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },

  transports: ["websocket", "polling"],

  pingInterval: 10000,
  pingTimeout: 20000,
});

// ============================================================
// CONSTANTS
// ============================================================

const PORT = 3001;

// ============================================================
// INITIAL STOCK
// ============================================================

const INITIAL_STOCK = {
  "Campus A": {
    water: 30,
    medicine: 100,
  },

  "Campus B": {
    water: 59,
    medicine: 150,
  },

  "Campus C": {
    water: 31,
    medicine: 40,
  },
};

let stock = JSON.parse(JSON.stringify(INITIAL_STOCK));

// ============================================================
// VEHICLES
// ============================================================

const VALID_VEHICLES = new Set([
  "tanker-1",
  "tanker-2",
  "tanker-3",
  "medical-van-1",
  "medical-van-2",
]);

const vehicles = new Map();

// ============================================================
// ROAD REPORTS
// ============================================================

const roadReports = new Map();

// ============================================================
// HELPERS
// ============================================================

function now() {
  return Date.now();
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function isValidVehicle(vehicleId) {
  return VALID_VEHICLES.has(vehicleId);
}

function broadcastFleet() {
  io.emit("fleet:snapshot", Array.from(vehicles.values()));
}

function broadcastRoadReports() {
  io.emit("road:snapshot", Array.from(roadReports.values()));
}

function broadcastStock() {
  io.emit("stock:snapshot", stock);
}

function resetFleet() {
  vehicles.clear();

  io.emit("fleet:reset");
  io.emit("fleet:snapshot", []);
}

function resetRoadReports() {
  roadReports.clear();

  io.emit("road:reset");
  io.emit("road:snapshot", []);
}

function resetStock() {
  stock = JSON.parse(JSON.stringify(INITIAL_STOCK));

  io.emit("stock:reset");
  io.emit("stock:snapshot", stock);
}

function getVehicle(vehicleId) {
  return vehicles.get(vehicleId) || null;
}

function isActiveDriver(vehicle, socketId) {
  if (!vehicle) {
    return false;
  }

  // If a driver is registered, only that socket can modify it.
  if (vehicle.socketId && vehicle.socketId !== socketId) {
    return false;
  }

  return true;
}

// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,

    service: "ResQFlow realtime server",

    time: new Date().toISOString(),

    vehicles: vehicles.size,

    roads: roadReports.size,

    stock,
  });
});

// ============================================================
// CURRENT STATE API
// ============================================================

app.get("/api/state", (req, res) => {
  res.json({
    vehicles: Array.from(vehicles.values()),

    roadReports: Array.from(roadReports.values()),

    stock,
  });
});

// ============================================================
// SOCKET CONNECTION
// ============================================================

io.on("connection", (socket) => {
  console.log("");
  console.log("==========================================");
  console.log("Socket connected");
  console.log("Socket ID:", socket.id);
  console.log("==========================================");

  // ========================================================
  // SEND CURRENT STATE TO NEW CLIENT
  // ========================================================

  socket.emit(
    "fleet:snapshot",
    Array.from(vehicles.values())
  );

  socket.emit("stock:snapshot", stock);

  socket.emit(
    "road:snapshot",
    Array.from(roadReports.values())
  );

  // ========================================================
  // FLEET REQUEST
  // ========================================================

  socket.on("fleet:request", () => {
    console.log(
      `Fleet requested by socket ${socket.id}`
    );

    socket.emit(
      "fleet:snapshot",
      Array.from(vehicles.values())
    );
  });

  // ========================================================
  // DEMO RESET
  // ========================================================

  socket.on("demo:reset", () => {
    console.log("");
    console.log("========== DEMO RESET ==========");

    resetFleet();

    resetRoadReports();

    resetStock();

    console.log("Demo reset complete");
  });

  // ========================================================
  // FLEET RESET
  // ========================================================

  socket.on("fleet:reset", () => {
    console.log(
      `Fleet reset requested by ${socket.id}`
    );

    resetFleet();
  });

  // ========================================================
  // ROAD RESET
  // ========================================================

  socket.on("road:reset", () => {
    console.log(
      `Road reset requested by ${socket.id}`
    );

    resetRoadReports();
  });

  // ========================================================
  // STOCK RESET
  // ========================================================

  socket.on("stock:reset", () => {
    console.log(
      `Stock reset requested by ${socket.id}`
    );

    resetStock();
  });

  // ========================================================
  // CREATE DISPATCH
  // ========================================================

  socket.on("dispatch:create", (payload = {}) => {
    console.log("");
    console.log("========== DISPATCH REQUEST ==========");
    console.log(payload);

    const vehicleId = payload.vehicleId;

    // ------------------------------------------------------
    // Validate vehicle
    // ------------------------------------------------------

    if (!isValidVehicle(vehicleId)) {
      console.log(
        "Invalid vehicle:",
        vehicleId
      );

      socket.emit("driver:error", {
        message:
          `Invalid vehicle "${vehicleId}".`,
      });

      return;
    }

    // ------------------------------------------------------
    // Prevent duplicate active dispatch
    // ------------------------------------------------------

    const existing = vehicles.get(vehicleId);

    if (
      existing &&
      existing.status === "in_transit"
    ) {
      console.log(
        `Vehicle ${vehicleId} is already in transit`
      );

      socket.emit("driver:error", {
        message:
          `Vehicle "${vehicleId}" is already in transit.`,
      });

      return;
    }

    // ------------------------------------------------------
    // Create vehicle
    // ------------------------------------------------------

    const vehicle = {
      ...payload,

      vehicleId,

      status: "in_transit",

      gpsOnline: false,

      driverConnected: false,

      socketId: null,

      lastSeen: now(),

      gpsTimestamp: null,

      lat: safeNumber(payload.lat, 0),

      lon: safeNumber(payload.lon, 0),

      speedKmh: 0,

      accuracyM: null,

      progressPercent: safeNumber(
        payload.progressPercent,
        0
      ),

      etaMin: safeNumber(
        payload.etaMin,
        0
      ),

      distanceKm: safeNumber(
        payload.distanceKm,
        0
      ),

      rerouted: false,

      rerouteReason: null,

      rerouteTimestamp: null,

      route: payload.route || null,

      createdAt: now(),
    };

    vehicles.set(vehicleId, vehicle);

    console.log(
      `Vehicle ${vehicleId} dispatched`
    );

    // ------------------------------------------------------
    // Notify everyone
    // ------------------------------------------------------

    io.emit("vehicle:status", vehicle);

    broadcastFleet();

    console.log(
      "Current vehicles:",
      Array.from(vehicles.keys())
    );
  });

  // ========================================================
  // DRIVER REGISTER
  // ========================================================

  socket.on(
    "driver:register",
    ({ vehicleId } = {}) => {
      console.log("");
      console.log("========== DRIVER REGISTER ==========");
      console.log(
        "Vehicle:",
        vehicleId
      );
      console.log(
        "Socket:",
        socket.id
      );

      // ----------------------------------------------------
      // Validate vehicle
      // ----------------------------------------------------

      if (!isValidVehicle(vehicleId)) {
        socket.emit("driver:error", {
          message:
            `Vehicle "${vehicleId}" is not a valid ResQFlow vehicle.`,
        });

        return;
      }

      // ----------------------------------------------------
      // Check dispatch
      // ----------------------------------------------------

      const vehicle = vehicles.get(vehicleId);

      if (!vehicle) {
        socket.emit("driver:error", {
          message:
            `Vehicle "${vehicleId}" has not been dispatched yet. Approve a transfer from the dashboard first.`,
        });

        return;
      }

      // ----------------------------------------------------
      // If another driver is connected
      // ----------------------------------------------------

      if (
        vehicle.socketId &&
        vehicle.socketId !== socket.id
      ) {
        console.log(
          `Replacing previous driver for ${vehicleId}`
        );
      }

      // ----------------------------------------------------
      // Register driver
      // ----------------------------------------------------

      const updatedVehicle = {
        ...vehicle,

        socketId: socket.id,

        driverConnected: true,

        lastSeen: now(),
      };

      vehicles.set(
        vehicleId,
        updatedVehicle
      );

      // ----------------------------------------------------
      // Tell driver its assignment
      // ----------------------------------------------------

      socket.emit(
        "driver:assignment",
        updatedVehicle
      );

      // ----------------------------------------------------
      // Tell dashboard
      // ----------------------------------------------------

      io.emit(
        "vehicle:status",
        updatedVehicle
      );

      broadcastFleet();

      console.log(
        `Driver registered successfully: ${vehicleId}`
      );
    }
  );

  // ========================================================
  // LIVE GPS LOCATION
  // ========================================================

  socket.on(
    "vehicle:location",
    (location = {}) => {
      const vehicleId =
        location.vehicleId;

      if (!isValidVehicle(vehicleId)) {
        return;
      }

      const current =
        vehicles.get(vehicleId);

      if (!current) {
        socket.emit("driver:error", {
          message:
            `Vehicle "${vehicleId}" is not currently dispatched.`,
        });

        return;
      }

      // ----------------------------------------------------
      // Only active driver may send GPS
      // ----------------------------------------------------

      if (
        current.socketId &&
        current.socketId !== socket.id
      ) {
        socket.emit("driver:error", {
          message:
            `You are not the active driver for ${vehicleId}.`,
        });

        return;
      }

      // ----------------------------------------------------
      // GPS coordinates
      // ----------------------------------------------------

      const lat = Number(
        location.lat
      );

      const lon = Number(
        location.lon
      );

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon)
      ) {
        console.warn(
          `Invalid GPS coordinates for ${vehicleId}:`,
          location
        );

        return;
      }

      // ----------------------------------------------------
      // Speed
      // Browser GPS speed is normally m/s
      // ----------------------------------------------------

      const speedMps =
        Number(location.speed);

      let speedKmh = 0;

      if (
        Number.isFinite(speedMps) &&
        speedMps >= 0
      ) {
        speedKmh =
          speedMps * 3.6;
      }

      // ----------------------------------------------------
      // Accuracy
      // ----------------------------------------------------

      const accuracy =
        Number(location.accuracy);

      const accuracyM =
        Number.isFinite(accuracy)
          ? accuracy
          : null;

      // ----------------------------------------------------
      // Progress
      // ----------------------------------------------------

      const progress =
        location.progressPercent !==
        undefined
          ? safeNumber(
              location.progressPercent,
              current.progressPercent || 0
            )
          : current.progressPercent || 0;

      // ----------------------------------------------------
      // ETA
      // ----------------------------------------------------

      const eta =
        location.etaMin !== undefined
          ? safeNumber(
              location.etaMin,
              current.etaMin
            )
          : current.etaMin;

      // ----------------------------------------------------
      // Update vehicle
      // ----------------------------------------------------

      const updatedVehicle = {
        ...current,

        lat,

        lon,

        accuracyM,

        speedKmh,

        gpsOnline: true,

        driverConnected: true,

        socketId: socket.id,

        lastSeen: now(),

        gpsTimestamp:
          location.timestamp ||
          now(),

        progressPercent:
          Math.max(
            0,
            Math.min(
              100,
              progress
            )
          ),

        etaMin:
          Math.max(
            0,
            eta
          ),
      };

      vehicles.set(
        vehicleId,
        updatedVehicle
      );

      // ----------------------------------------------------
      // LIVE GPS EVENT
      // ----------------------------------------------------

      io.emit(
        "vehicle:location",
        updatedVehicle
      );

      // ----------------------------------------------------
      // STATUS EVENT
      // ----------------------------------------------------

      io.emit(
        "vehicle:status",
        updatedVehicle
      );
    }
  );

  // ========================================================
  // DRIVER GPS OFFLINE
  // ========================================================

  socket.on(
    "driver:gps:offline",
    ({ vehicleId } = {}) => {
      if (!vehicleId) {
        return;
      }

      const current =
        vehicles.get(vehicleId);

      if (!current) {
        return;
      }

      // ----------------------------------------------------
      // Only active driver
      // ----------------------------------------------------

      if (
        current.socketId !== socket.id
      ) {
        return;
      }

      const updatedVehicle = {
        ...current,

        gpsOnline: false,

        driverConnected: true,

        lastSeen: now(),
      };

      vehicles.set(
        vehicleId,
        updatedVehicle
      );

      io.emit(
        "vehicle:status",
        updatedVehicle
      );

      broadcastFleet();

      console.log(
        `GPS offline: ${vehicleId}`
      );
    }
  );

  // ========================================================
  // VEHICLE STATUS
  // ========================================================

  socket.on(
    "vehicle:status",
    (payload = {}) => {
      const vehicleId =
        payload.vehicleId;

      if (!isValidVehicle(vehicleId)) {
        return;
      }

      const current =
        vehicles.get(vehicleId);

      if (!current) {
        return;
      }

      // ----------------------------------------------------
      // Only active driver may update status
      // ----------------------------------------------------

      if (
        current.socketId &&
        current.socketId !== socket.id
      ) {
        socket.emit("driver:error", {
          message:
            `You are not the active driver for ${vehicleId}.`,
        });

        return;
      }

      // ----------------------------------------------------
      // Only allow safe fields
      // ----------------------------------------------------

      const updates = {};

      const allowedFields = [
        "status",
        "progressPercent",
        "etaMin",
        "gpsOnline",
        "driverConnected",
      ];

      for (
        const field of allowedFields
      ) {
        if (
          payload[field] !==
          undefined
        ) {
          updates[field] =
            payload[field];
        }
      }

      // ----------------------------------------------------
      // Sanitize progress
      // ----------------------------------------------------

      if (
        updates.progressPercent !==
        undefined
      ) {
        updates.progressPercent =
          Math.max(
            0,
            Math.min(
              100,
              safeNumber(
                updates.progressPercent,
                current.progressPercent ||
                  0
              )
            )
          );
      }

      // ----------------------------------------------------
      // Sanitize ETA
      // ----------------------------------------------------

      if (
        updates.etaMin !==
        undefined
      ) {
        updates.etaMin =
          Math.max(
            0,
            safeNumber(
              updates.etaMin,
              current.etaMin
            )
          );
      }

      const updatedVehicle = {
        ...current,

        ...updates,

        vehicleId,

        lastSeen: now(),
      };

      // ----------------------------------------------------
      // If delivered/completed, keep record but update
      // ----------------------------------------------------

      vehicles.set(
        vehicleId,
        updatedVehicle
      );

      io.emit(
        "vehicle:status",
        updatedVehicle
      );

      broadcastFleet();
    }
  );

  // ========================================================
  // VEHICLE REROUTE
  // ========================================================

  socket.on(
    "vehicle:reroute",
    (payload = {}) => {
      const vehicleId =
        payload.vehicleId;

      if (!isValidVehicle(vehicleId)) {
        return;
      }

      const current =
        vehicles.get(vehicleId);

      if (!current) {
        return;
      }

      // ----------------------------------------------------
      // Reroute can be requested by dashboard OR driver.
      // Dashboard does not necessarily own socketId.
      // ----------------------------------------------------

      const updatedVehicle = {
        ...current,

        etaMin:
          payload.etaMin !==
          undefined
            ? Math.max(
                0,
                safeNumber(
                  payload.etaMin,
                  current.etaMin
                )
              )
            : current.etaMin,

        distanceKm:
          payload.distanceKm !==
          undefined
            ? Math.max(
                0,
                safeNumber(
                  payload.distanceKm,
                  current.distanceKm
                )
              )
            : current.distanceKm,

        rerouted: true,

        route:
          payload.route !==
          undefined
            ? payload.route
            : current.route,

        rerouteReason:
          payload.reason ||
          current.rerouteReason ||
          null,

        rerouteTimestamp:
          now(),

        lastSeen: now(),
      };

      vehicles.set(
        vehicleId,
        updatedVehicle
      );

      console.log("");
      console.log(
        `Vehicle rerouted: ${vehicleId}`
      );

      console.log(
        "Reason:",
        updatedVehicle.rerouteReason
      );

      console.log(
        "ETA:",
        updatedVehicle.etaMin
      );

      io.emit(
        "vehicle:reroute",
        updatedVehicle
      );

      io.emit(
        "vehicle:status",
        updatedVehicle
      );

      broadcastFleet();
    }
  );

  // ========================================================
  // ROAD REPORT
  // ========================================================

  socket.on(
    "road:report",
    (payload = {}) => {
      const reportId =
        payload.reportId ||
        `road-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}`;

      const report = {
        ...payload,

        reportId,

        status: "blocked",

        createdAt:
          payload.createdAt ||
          now(),

        updatedAt: now(),
      };

      roadReports.set(
        reportId,
        report
      );

      console.log("");
      console.log(
        "========== ROAD BLOCKED =========="
      );

      console.log(report);

      io.emit(
        "road:report",
        report
      );

      broadcastRoadReports();
    }
  );

  // ========================================================
  // ROAD CLEARED
  // ========================================================

  socket.on(
    "road:cleared",
    (payload = {}) => {
      const reportId =
        payload.reportId;

      if (!reportId) {
        return;
      }

      const current =
        roadReports.get(reportId);

      if (!current) {
        return;
      }

      const updatedReport = {
        ...current,

        status: "cleared",

        updatedAt: now(),
      };

      roadReports.set(
        reportId,
        updatedReport
      );

      console.log(
        `Road cleared: ${reportId}`
      );

      io.emit(
        "road:cleared",
        updatedReport
      );

      broadcastRoadReports();
    }
  );

  // ========================================================
  // STOCK UPDATE
  // ========================================================

  socket.on(
    "stock:update",
    (payload = {}) => {
      const campus =
        payload.campus;

      if (
        !campus ||
        !stock[campus]
      ) {
        return;
      }

      const current =
        stock[campus];

      const updated = {
        ...current,
      };

      // ----------------------------------------------------
      // Water
      // ----------------------------------------------------

      if (
        payload.water !==
        undefined
      ) {
        updated.water =
          Math.max(
            0,
            safeNumber(
              payload.water,
              current.water
            )
          );
      }

      // ----------------------------------------------------
      // Medicine
      // ----------------------------------------------------

      if (
        payload.medicine !==
        undefined
      ) {
        updated.medicine =
          Math.max(
            0,
            safeNumber(
              payload.medicine,
              current.medicine
            )
          );
      }

      // ----------------------------------------------------
      // Save
      // ----------------------------------------------------

      stock[campus] =
        updated;

      console.log(
        `Stock updated: ${campus}`,
        updated
      );

      // ----------------------------------------------------
      // Broadcast individual update
      // ----------------------------------------------------

      io.emit(
        "stock:update",
        {
          campus,

          ...updated,
        }
      );

      // ----------------------------------------------------
      // Broadcast full stock
      // ----------------------------------------------------

      io.emit(
        "stock:snapshot",
        stock
      );
    }
  );

  // ========================================================
  // DRIVER DISCONNECT
  // ========================================================

  socket.on(
    "disconnect",
    (reason) => {
      console.log("");
      console.log(
        "=========================================="
      );

      console.log(
        `Socket disconnected: ${socket.id}`
      );

      console.log(
        `Reason: ${reason}`
      );

      console.log(
        "=========================================="
      );

      // ----------------------------------------------------
      // Find vehicles belonging to this driver
      // ----------------------------------------------------

      let changed = false;

      for (
        const [
          vehicleId,
          vehicle,
        ] of vehicles.entries()
      ) {
        if (
          vehicle.socketId ===
          socket.id
        ) {
          const updatedVehicle = {
            ...vehicle,

            gpsOnline: false,

            driverConnected: false,

            socketId: null,

            lastSeen: now(),
          };

          vehicles.set(
            vehicleId,
            updatedVehicle
          );

          io.emit(
            "vehicle:status",
            updatedVehicle
          );

          console.log(
            `Driver disconnected from ${vehicleId}`
          );

          changed = true;
        }
      }

      if (changed) {
        broadcastFleet();
      }
    }
  );
});

// ============================================================
// SERVER ERROR HANDLING
// ============================================================

server.on("error", (error) => {
  console.error("");
  console.error(
    "=========================================="
  );
  console.error(
    "SERVER ERROR"
  );
  console.error(
    "=========================================="
  );
  console.error(error);
});

// ============================================================
// START SERVER
// ============================================================

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log("");
    console.log(
      "=========================================="
    );
    console.log(
      "        ResQFlow Realtime Server"
    );
    console.log(
      "=========================================="
    );
    console.log(
      ` HTTP API:  http://localhost:${PORT}`
    );
    console.log(
      ` Socket.IO: http://localhost:${PORT}`
    );
    console.log(
      " Listening: 0.0.0.0"
    );
    console.log(
      "=========================================="
    );
    console.log("");
    console.log(
      "Valid vehicles:"
    );
    console.log(
      " - tanker-1"
    );
    console.log(
      " - tanker-2"
    );
    console.log(
      " - tanker-3"
    );
    console.log(
      " - medical-van-1"
    );
    console.log(
      " - medical-van-2"
    );
    console.log(
      "=========================================="
    );
    console.log("");
  }
);