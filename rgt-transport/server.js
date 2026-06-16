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

// Explicit root route — ensures index.html loads even if static middleware doesn't catch it
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/gps', async (req, res) => {
  const action = req.query.action || 'vehiculos';
  try {
    // Step 1: CSRF token
    const csrfRes = await fetch(`${PORTAL}/api/auth/csrf`, { headers: {'Content-Type':'application/json'} });
    const csrfData = await csrfRes.json();
    const csrfCookies = csrfRes.headers.getSetCookie ? csrfRes.headers.getSetCookie() : [];
    const cookies1 = csrfCookies.map(c => c.split(';')[0]).join('; ');
    console.log('[GPS] Step1 CSRF token:', csrfData.csrfToken ? 'OK' : 'MISSING', '| cookies:', csrfCookies.length);

    // Step 2: Login
    const loginBody = new URLSearchParams({ username:GPS_USER, password:GPS_PASS, csrfToken:csrfData.csrfToken||'', callbackUrl:`${PORTAL}/rastreo`, redirect:'false' });
    const loginRes = await fetch(`${PORTAL}/api/auth/callback/credentials`, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded','Cookie':cookies1}, body:loginBody.toString(), redirect:'manual' });
    const loginCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [];
    console.log('[GPS] Step2 Login status:', loginRes.status, '| new cookies:', loginCookies.length);

    // Step 3: Session
    const cookies2 = [...csrfCookies, ...loginCookies].map(c => c.split(';')[0]).join('; ');
    const sessionRes = await fetch(`${PORTAL}/api/auth/session`, { headers:{'Cookie':cookies2} });
    const session = await sessionRes.json();
    const token = session?.accessToken || session?.token || '';
    console.log('[GPS] Step3 Session status:', sessionRes.status, '| token found:', !!token, '| session keys:', Object.keys(session||{}));

    if(!token) return res.status(401).json({ error:'No token obtained from ONTracking', step:'session', loginStatus: loginRes.status, sessionStatus: sessionRes.status, session });

    // Step 4: Fetch vehicle/tracking data
    const endpoint = action==='rastreo' ? `${API}/api/rastreo` : `${API}/api/vehiculos`;
    const dataRes = await fetch(endpoint, { headers:{'Authorization':`Bearer ${token}`} });
    console.log('[GPS] Step4 Data fetch status:', dataRes.status, 'endpoint:', endpoint);
    if(!dataRes.ok){
      const errText = await dataRes.text();
      return res.status(dataRes.status).json({ error:'ONTracking API error', status: dataRes.status, body: errText.slice(0,300) });
    }
    const data = await dataRes.json();
    res.json(data);
  } catch(e) {
    console.error('[GPS] Exception:', e.message);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`RGT corriendo en puerto ${PORT}`));
