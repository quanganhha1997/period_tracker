// server.js
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const app = express();
const port = 3000;

// In-memory store for period logs (each log is an object with a userId and date)
let periodLogs = [];

// ABAC policy function: returns true if the current user is allowed to perform an action.
function canAccess(user, action) {
  const now = new Date();
  // Users have full access.
  if (user.role === 'user') return true;
  // Partners can view logs only if their linked user has granted permission.
  if (user.role === 'partner') {
    return user.partnerPermission === true;
  }
  // Doctors can view logs if their access has not expired.
  if (user.role === 'doctor') {
    return user.doctorAccessUntil && now <= new Date(user.doctorAccessUntil);
  }
  return false;
}

app.use(bodyParser.json());
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true
}));

// Serve static files from the public directory
app.use(express.static('public'));

// ---------- Authentication & Session Endpoints ----------

// Login endpoint
app.post('/api/login', (req, res) => {
  const { role } = req.body;
  let userData = { role };

  if (role === 'user') {
    // For a user, we assign a fixed userId.
    userData = { ...userData, userId: 'user123' };
  } else if (role === 'partner') {
    // For partner, simulate a linked user (user123) with a default permission of false.
    userData = { ...userData, partnerId: 'partner123', linkedUserId: 'user123', partnerPermission: false };
  } else if (role === 'doctor') {
    // For doctor, simulate granted access until 24 hours from login.
    userData = { 
      ...userData, 
      doctorId: 'doctor123', 
      linkedUserId: 'user123', 
      doctorAccessUntil: new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString() 
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
// This lets a user grant a partner permission to view logs and set a new doctor access expiration.
app.post('/api/permissions', (req, res) => {
  const user = req.session.user;
  if (!user || user.role !== 'user') {
    return res.status(403).json({ error: 'Access denied' });
  }
  const { partnerPermission, doctorAccessUntil } = req.body;
  // In a real app, update the database; here we update the session.
  req.session.user.partnerPermission = partnerPermission;
  req.session.user.doctorAccessUntil = doctorAccessUntil;
  res.json({ success: true, user: req.session.user });
});

// ---------- Period Logging Endpoints ----------

// Endpoint to log a period (only users are allowed to log periods)
app.post('/api/periods', (req, res) => {
  const user = req.session.user;
  if (!user || user.role !== 'user') {
    return res.status(403).json({ error: 'Only users can log periods' });
  }
  const { date } = req.body;
  periodLogs.push({ userId: user.userId, date });
  res.json({ success: true });
});

// Endpoint to get period logs
app.get('/api/periods', (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(403).json({ error: 'Not logged in' });
  
  if (user.role === 'user') {
    // Return logs for the user.
    const logs = periodLogs.filter(log => log.userId === user.userId);
    return res.json({ logs });
  }
  if (user.role === 'partner' || user.role === 'doctor') {
    // Use the ABAC function to decide whether to allow access.
    if (!canAccess(user, 'view_logs')) {
      return res.status(403).json({ error: 'Access denied' });
    }
    // Return logs for the linked user (simulate user123).
    const logs = periodLogs.filter(log => log.userId === 'user123');
    return res.json({ logs });
  }
  res.status(403).json({ error: 'Access denied' });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});