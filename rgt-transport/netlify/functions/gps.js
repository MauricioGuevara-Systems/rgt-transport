const PORTAL = 'https://portalv3.ontracking.com.mx';
const API = 'https://api.mx-1.ontracking.com.mx';
const GPS_USER = 'rgt.integracion';
const GPS_PASS = '123456';

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if(event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  const action = event.queryStringParameters?.action || 'vehiculos';
  try {
    // Step 1: Get CSRF token AND its cookies
    const csrfRes = await fetch(`${PORTAL}/api/auth/csrf`, { headers: {'Content-Type':'application/json'} });
    const csrfData = await csrfRes.json();
    // Collect cookies from CSRF response
    const csrfCookies = csrfRes.headers.getSetCookie ? csrfRes.headers.getSetCookie() : [];
    const cookies1 = csrfCookies.map(c => c.split(';')[0]).join('; ');

    // Step 2: Login sending CSRF cookies back
    const loginBody = new URLSearchParams({
      username: GPS_USER,
      password: GPS_PASS,
      csrfToken: csrfData.csrfToken || '',
      callbackUrl: `${PORTAL}/rastreo`,
      redirect: 'false'
    });
    const loginRes = await fetch(`${PORTAL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies1
      },
      body: loginBody.toString(),
      redirect: 'manual'
    });
    // Collect session cookies from login response
    const loginCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [];
    const cookies2 = [...csrfCookies, ...loginCookies].map(c => c.split(';')[0]).join('; ');

    // Step 3: Get session token
    const sessionRes = await fetch(`${PORTAL}/api/auth/session`, { headers: { 'Cookie': cookies2 } });
    const session = await sessionRes.json();
    const token = session?.accessToken || session?.token || '';
    if(!token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'No token', session }) };

    // Step 4: Call ONTracking API
    const endpoint = action === 'rastreo' ? `${API}/api/rastreo` : `${API}/api/vehiculos`;
    const dataRes = await fetch(endpoint, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await dataRes.json();
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
