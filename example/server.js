// Test pages for the example app: node example/server.js
// Android emulator: also run adb reverse tcp:8080 tcp:8080
const http = require('http');

http
  .createServer((req, res) => {
    console.log(new Date().toISOString(), req.url);
    const { pathname, searchParams } = new URL(req.url, 'http://localhost');
    if (pathname === '/callback') {
      // A plain server redirect to the app's scheme, as most auth servers send it.
      res.writeHead(302, {
        Location: 'webauthexample://callback?code=a%2Bb%3Dc&state=xyz',
      });
      return res.end();
    }
    const delay = Number(searchParams.get('delay') ?? 0);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html><meta name="viewport" content="width=device-width">
<p>Returning to the app in ${delay} s, without a tap.</p>
<p><a href="/callback">Return now</a></p>
<script>setTimeout(() => location.href = '/callback', ${delay * 1000})</script>`);
  })
  .listen(8080, () => console.log('http://localhost:8080'));
