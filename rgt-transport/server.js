const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

const PORTAL = 'https://portalv3.ontracking.com.mx';
const API = 'https://api.mx-1.ontracking.com.mx';
const GPS_USER = 'rgt.integracion';
const GPS_PASS = '123456';

// Serve static files from current directory
app.use(express.static(path.join(__dirname)));

app.get('/api/gps', async (req, res) => {
  const action = req.query.action || 'vehiculos';
  try {
    const csrfRes = await fetch(`${PORTAL}/api/auth/csrf`, { headers: {'Content-Type':'application/json'} });
    const csrfData = await csrfRes.json();
    const csrfCookies = csrfRes.headers.getSetCookie ? csrfRes.headers.getSetCookie() : [];
    const cookies1 = csrfCookies.map(c => c.split(';')[0]).join('; ');

    const loginBody = new URLSearchParams({ username:GPS_USER, password:GPS_PASS, csrfToken:csrfData.csrfToken||'', callbackUrl:`${PORTAL}/rastreo`, redirect:'false' });
    const loginRes = await fetch(`${PORTAL}/api/auth/callback/credentials`, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded','Cookie':cookies1}, body:loginBody.toString(), redirect:'manual' });
    const loginCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [];
    const cookies2 = [...csrfCookies, ...loginCookies].map(c => c.split(';')[0]).join('; ');

    const sessionRes = await fetch(`${PORTAL}/api/auth/session`, { headers:{'Cookie':cookies2} });
    const session = await sessionRes.json();
    const token = session?.accessToken || session?.token || '';
    if(!token) return res.status(401).json({ error:'No token', session });

    const endpoint = action==='rastreo' ? `${API}/api/rastreo` : `${API}/api/vehiculos`;
    const dataRes = await fetch(endpoint, { headers:{'Authorization':`Bearer ${token}`} });
    const data = await dataRes.json();
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`RGT corriendo en puerto ${PORT}`));
