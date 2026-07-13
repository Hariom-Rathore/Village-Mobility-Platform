(async ()=>{
  try{
    const fetch = globalThis.fetch;
    const listingsRes = await fetch('http://localhost:8080/cars');
    const text = await listingsRes.text();
    const m = text.match(/\/cars\/([a-f0-9]{24})/i);
    if(!m){ console.error('No listing id'); process.exit(1);} const id = m[1];
    console.log('id',id);
    for (const path of [`/cars/book/${id}`, `/cars/${id}/book`]){
      const res = await fetch('http://localhost:8080' + path);
      console.log(path, '->', res.status);
      const body = await res.text();
      const hasPay = body.includes('Pay & Book') || body.includes('id="payBtn"');
      console.log(' HasPay?', hasPay, ' len:', body.length);
      require('fs').writeFileSync('scripts/last_'+path.replace(/\//g,'_')+'.html', body);
    }
    process.exit(0);
  }catch(e){ console.error(e); process.exit(2);} })();
