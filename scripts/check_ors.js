const http = require('http');

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', err => reject(err));
  });
}

(async () => {
  try {
    const listingsHtml = await fetch('http://localhost:8080/cars');
    const m = listingsHtml.match(/\/cars\/book\/([a-fA-F0-9]{24})/);
    if (!m) return console.log('NO_LISTING_ID');
    const id = m[1];
    const bookHtml = await fetch('http://localhost:8080/cars/book/' + id);
    const marker = '<script type="application/json" id="booking-config">';
    const start = bookHtml.indexOf(marker);
    if (start === -1) return console.log('NO_BOOKING_CONFIG');
    const s = start + marker.length;
    const e = bookHtml.indexOf('</script>', s);
    const inner = bookHtml.substring(s, e).trim();
    let json = null;
    try {
      json = JSON.parse(inner);
    } catch (err) {
      return console.log('PARSE_ERROR', err.message);
    }
    console.log('ORS_KEY_STATUS:' + (json.orsKey && json.orsKey.length ? 'SET' : 'EMPTY'));
  } catch (e) {
    console.error('ERR', e.message);
    process.exit(1);
  }
})();
