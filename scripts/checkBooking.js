(async ()=>{
  try{
    const fetch = globalThis.fetch;
    const listingsRes = await fetch('http://localhost:8080/cars');
    if(!listingsRes.ok){ console.error('Listings fetch failed', listingsRes.status); process.exit(1);} 
    const listingsHtml = await listingsRes.text();
    const m = listingsHtml.match(/\/cars\/([a-f0-9]{24})/i);
    if(!m){ console.error('No listing id found'); console.log(listingsHtml.slice(0,800)); process.exit(2);} 
    const id = m[1];
    console.log('Found listing id', id);
    const bookRes = await fetch(`http://localhost:8080/cars/book/${id}`);
    console.log('Book page status', bookRes.status);
    const bookHtml = await bookRes.text();
    const hasPayBtn = bookHtml.includes('id="payBtn"') || bookHtml.includes('Pay & Book');
    const hasRzp = bookHtml.includes('checkout.razorpay.com/v1/checkout.js') || bookHtml.includes('Razorpay');
    console.log('Has pay button?', hasPayBtn);
    console.log('Has razorpay script?', hasRzp);
    console.log('Booking page length:', bookHtml.length);
    // write full HTML to file for inspection
    const fs = require('fs');
    fs.writeFileSync('scripts/booking_page.html', bookHtml);
    console.log('Wrote scripts/booking_page.html for inspection');
    process.exit(0);
  }catch(e){ console.error('Error:', e); process.exit(3);} 
})();
