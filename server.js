// server.js
const express = require('express');
require("dotenv").config(); // Ensure environment variables are loaded
const bodyParser = require('body-parser');
const session = require('express-session');
const app = express();
const port =  process.env.PORT || 3000;
const cors = require("cors");
const { Pool } = require("pg");

// PostgreSQL Database Connection (Now Uses `.env` + SSL for Render)
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false } // ✅ Required for Render PostgreSQL
});
// Middleware
app.use(cors());
app.use(express.json());

// In-memory store for period logs (each log is an object with id, userId, and date)
let periodLogs = [];
let nextLogId = 1;

// Global store for user permissions (for user "user123")
const globalUserPermissions = {
  "user123": {
    partnerPermission: false,
    doctorAccessUntil: null
  }
};

// ABAC policy function: returns true if the current user is allowed to perform an action.
function canAccess(user, action) {
  const now = new Date();
  if (user.role === 'user') return true;
  if (user.role === 'partner') {
    const permission = globalUserPermissions[user.linkedUserId];
    return permission && permission.partnerPermission === true;
  }
  if (user.role === 'doctor') {
    const permission = globalUserPermissions[user.linkedUserId];
    if (permission && permission.doctorAccessUntil) {
      return now <= new Date(permission.doctorAccessUntil);
    }
    return false;
  }
  return false;
}
app.get("/api/users", async (req, res) => {
  try {
 
      const result = await pool.query("SELECT * FROM users");
    //  console.log("++++++++++++ ", result.rows);
      res.json(result.rows);
  } catch (err) {
      console.error(err.message);
      res.status(500).send("Server Error");
  }
});
app.get("/api/patients", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM periods ORDER BY cycle_start DESC");
      //console.log("++++++++++++ ", result.rows);
      res.json(result.rows);
  } catch (err) {
      console.error("Database Query Error:", err); // Log detailed error
      res.status(500).json({ error: "Server Error", details: err.message });
  }
});

app.use(bodyParser.json());
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true
}));

// Serve static files from the public directory
app.use(express.static('public'));

// ---------- Authentication & Session Endpoints ----------

// Login endpoint with password support for user role.
app.post('/api/login', (req, res) => {
  const { role, password } = req.body;
  console.log( role,password);
  let userData = {  };

  if (role === 'user') {
    // Check password (in production, use hashing!)
    if (password != "user123") {
      return res.status(403).json({ error: 'Invalid password' });
    }
    userData = { ...userData, userId: 'user123' ,role:'user'};
    // Ensure global permission record exists
    if (!globalUserPermissions[userData.userId]) {
      globalUserPermissions[userData.userId] = { partnerPermission: false, doctorAccessUntil: null };
    }
  } else if (role === 'partner') {
    const linkedUserId = 'partner123';
    userData = { 
      ...userData, 
      partnerId: 'partner123', 
      linkedUserId, 
      role:'partner',
   //   partnerPermission: globalUserPermissions[linkedUserId].partnerPermission 
    };
  } else if (role === 'doctor') {
    if (password != "doc123") {
      return res.status(403).json({ error: 'Invalid password' });
    }
    const linkedUserId = 'doc123';
    userData = { 
      ...userData, 
      doctorId: 'doctor123', 
      role:'doctor',
      linkedUserId, 
      //doctorAccessUntil: globalUserPermissions[linkedUserId].doctorAccessUntil || 
        //new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString() 
    };
  }
  else if (role === 'admin') {
    if (password != "admin123") {
      return res.status(403).json({ error: 'Invalid password' });
    }
    const linkedUserId = 'admin123';
    userData = { 
      ...userData, 
      doctorId: 'admin123', 
      role:'admin',
      linkedUserId, 
      //doctorAccessUntil: globalUserPermissions[linkedUserId].doctorAccessUntil || 
        //new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString() 
    };
  }
  req.session.user = userData;
 
  res.json({ success: true, user: req.session.user });
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Update permissions endpoint (only available for the 'user' role)
app.post('/api/permissions', (req, res) => {
  const user = req.session.user;
  if (!user || user.role !== 'user') {
    return res.status(403).json({ error: 'Access denied' });
  }
  const { partnerPermission, doctorAccessUntil } = req.body;
  // Update the global permission store for the user
  globalUserPermissions[user.userId] = { partnerPermission, doctorAccessUntil };
  // Also update the session for the user
  req.session.user.partnerPermission = partnerPermission;
  req.session.user.doctorAccessUntil = doctorAccessUntil;
  res.json({ success: true, user: req.session.user });
});

// ---------- Period Logging Endpoints ----------

// Log period endpoint (only user can log periods)
app.post('/api/periods', (req, res) => {
  const user = req.session.user;
  console.log(`user`, user);
  if (!user || user.role !== 'user') {
    return res.status(403).json({ error: 'Only users can log periods' });
  }
  const { date } = req.body;
  const logEntry = { id: nextLogId++, userId: user.userId, date };
  periodLogs.push(logEntry);
  res.json({ success: true, log: logEntry });
});

// Edit period log endpoint (only user can edit their logs)
app.put('/api/periods/:id', (req, res) => {
  const user = req.session.user;
  if (!user || user.role !== 'user') {
    return res.status(403).json({ error: 'Only users can edit logs' });
  }
  const logId = parseInt(req.params.id);
  const { date } = req.body;
  const logEntry = periodLogs.find(log => log.id === logId && log.userId === user.userId);
  if (!logEntry) {
    return res.status(404).json({ error: 'Log not found' });
  }
  logEntry.date = date;
  res.json({ success: true, log: logEntry });
});

// Delete period log endpoint (only user can delete logs)
app.delete('/api/periods/:id', (req, res) => {
  const user = req.session.user;
  if (!user || user.role !== 'user') {
    return res.status(403).json({ error: 'Only users can delete logs' });
  }
  const logId = parseInt(req.params.id);
  const logIndex = periodLogs.findIndex(log => log.id === logId && log.userId === user.userId);
  if (logIndex === -1) {
    return res.status(404).json({ error: 'Log not found' });
  }
  periodLogs.splice(logIndex, 1);
  res.json({ success: true });
});

// Get period logs endpoint
app.get('/api/periods', (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(403).json({ error: 'Not logged in' });
  
  if (user.role === 'user') {
    // Return logs for the logged-in user.
    const logs = periodLogs.filter(log => log.userId === user.userId);
    return res.json({ logs });
  }
  if (user.role === 'partner' || user.role === 'doctor') {
    // Enforce permission: only return logs if permission is granted.
    if (!canAccess(user, 'view_logs')) {
      return res.status(403).json({ error: 'Access denied. User has not granted permission.' });
    }
    // Return logs for the linked user (simulate user123)
    const logs = periodLogs.filter(log => log.userId === user.linkedUserId);
    return res.json({ logs });
  }
  return res.status(403).json({ error: 'Access denied' });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
