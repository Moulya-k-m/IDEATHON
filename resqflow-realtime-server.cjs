const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// --------------------------------------------------
// LIVE VEHICLES
// --------------------------------------------------

const vehicles = new Map();

// --------------------------------------------------
// LIVE CAMPUS STOCK
// --------------------------------------------------

const stock = {
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

// --------------------------------------------------
// SOCKET CONNECTION
// --------------------------------------------------

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Send current vehicles
  socket.emit("fleet:snapshot", [...vehicles.values()]);

  // Send current stock
  socket.emit("stock:snapshot", stock);

  // ------------------------------------------------
  // DRIVER REGISTER
  // ------------------------------------------------

  socket.on("driver:register", (vehicle) => {
    const existing = vehicles.get(vehicle.vehicleId) || {};

    const updated = {
      ...existing,
      ...vehicle,
      socketId: socket.id,
      gpsOnline: true,
      lastSeen: Date.now(),
    };

    vehicles.set(vehicle.vehicleId, updated);

    console.log(
      `Driver registered: ${vehicle.name} (${vehicle.vehicleId})`
    );

    io.emit("vehicle:status", updated);
  });

  // ------------------------------------------------
  // REAL GPS LOCATION
  // ------------------------------------------------

  socket.on("vehicle:location", (location) => {
    const existing =
      vehicles.get(location.vehicleId) || {};

    const updated = {
      ...existing,
      ...location,
      gpsOnline: true,
      lastSeen: Date.now(),
    };

    vehicles.set(location.vehicleId, updated);

    console.log(
      `GPS ${location.vehicleId}: ${location.lat}, ${location.lon}`
    );

    // Send REAL GPS position to every dashboard
    io.emit("vehicle:location", updated);
  });

  // ------------------------------------------------
  // DISPATCH VEHICLE
  // ------------------------------------------------

  socket.on("dispatch:create", (dispatch) => {
    const existing =
      vehicles.get(dispatch.vehicleId) || {};

    const updated = {
      ...existing,
      ...dispatch,
      status: "in_transit",
      lastSeen: Date.now(),
    };

    vehicles.set(dispatch.vehicleId, updated);

    console.log(
      `Vehicle dispatched: ${dispatch.vehicleId}`
    );

    io.emit("vehicle:status", updated);
  });

  // ------------------------------------------------
  // REROUTE VEHICLE
  // ------------------------------------------------

  socket.on("vehicle:reroute", (data) => {
    const vehicle = vehicles.get(data.vehicleId);

    if (!vehicle) {
      console.log(
        `Vehicle not found: ${data.vehicleId}`
      );
      return;
    }

    const updated = {
      ...vehicle,

      route: data.route,

      etaMin: data.etaMin,

      rerouted: true,

      rerouteReason:
        data.reason || "Road blockage",

      lastSeen: Date.now(),
    };

    vehicles.set(data.vehicleId, updated);

    console.log(
      `Vehicle ${data.vehicleId} rerouted. New ETA: ${data.etaMin} min`
    );

    io.emit("vehicle:status", updated);
  });

  // ------------------------------------------------
  // ROAD BLOCK REPORT
  // ------------------------------------------------

  socket.on("road:report", (report) => {
    console.log("");
    console.log("================================");
    console.log("ROAD BLOCK REPORT");
    console.log("================================");
    console.log(report);
    console.log("================================");
    console.log("");

    // Send report to all dashboards
    io.emit("road:report", report);
  });

  // ------------------------------------------------
  // UPDATE STOCK
  // ------------------------------------------------

  socket.on("stock:update", (payload) => {
    const campus = stock[payload.campus];

    if (!campus) {
      console.log(
        `Unknown campus: ${payload.campus}`
      );
      return;
    }

    if (
      payload.resource !== "water" &&
      payload.resource !== "medicine"
    ) {
      console.log(
        `Unknown resource: ${payload.resource}`
      );
      return;
    }

    const newStock = Number(payload.stock);

    if (Number.isNaN(newStock)) {
      console.log("Invalid stock value");
      return;
    }

    stock[payload.campus][payload.resource] =
      newStock;

    console.log(
      `Stock updated: ${payload.campus} ${payload.resource} = ${newStock}`
    );

    io.emit("stock:update", {
      campus: payload.campus,
      resource: payload.resource,
      stock: newStock,
    });
  });

  // ------------------------------------------------
  // DRIVER DISCONNECTED
  // ------------------------------------------------

  socket.on("disconnect", () => {
    console.log(
      "Client disconnected:",
      socket.id
    );

    for (const [
      vehicleId,
      vehicle,
    ] of vehicles.entries()) {
      if (vehicle.socketId === socket.id) {
        const updated = {
          ...vehicle,
          gpsOnline: false,
          lastSeen: Date.now(),
        };

        vehicles.set(vehicleId, updated);

        io.emit(
          "vehicle:status",
          updated
        );
      }
    }
  });
});

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    server: "ResQFlow Realtime Server",
    connectedVehicles: vehicles.size,
    timestamp: new Date().toISOString(),
  });
});

// --------------------------------------------------
// VEHICLES API
// --------------------------------------------------

app.get("/api/vehicles", (req, res) => {
  res.json([...vehicles.values()]);
});

// --------------------------------------------------
// STOCK API
// --------------------------------------------------

app.get("/api/stock", (req, res) => {
  res.json(stock);
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

const PORT = 3001;

server.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("========================================");
  console.log("       ResQFlow Realtime Server");
  console.log("========================================");
  console.log("");
  console.log(`Server running on port ${PORT}`);
  console.log("");
  console.log("Local:");
  console.log(`http://localhost:${PORT}`);
  console.log("");
  console.log("Health check:");
  console.log(
    `http://localhost:${PORT}/api/health`
  );
  console.log("");
  console.log("Waiting for vehicle GPS...");
  console.log("");
});