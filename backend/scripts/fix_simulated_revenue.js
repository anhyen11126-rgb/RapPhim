import { readFileSync, writeFileSync } from 'fs';

const p = 'd:/CDIO/movietix-project/backend/src/services/statisticsService.js';
let c = readFileSync(p, 'utf8');

let changed = 0;

// Fix 1: verifiedRevenue — include SIMULATED
const old1 = `const verifiedRevenue = booking => booking.paymentStatus === 'VERIFIED' ? booking.totalAmount || 0 : 0;`;
const new1 = `const verifiedRevenue = booking => ['VERIFIED', 'SIMULATED'].includes(booking.paymentStatus) ? booking.totalAmount || 0 : 0;`;
if (c.includes(old1)) { c = c.replace(old1, new1); changed++; console.log('✅ Fix 1: verifiedRevenue'); }
else { console.error('❌ Fix 1 NOT FOUND'); }

// Fix 2: verifiedRefund — include SIMULATED
const old2 = `const verifiedRefund = booking => booking.refundStatus === 'REFUNDED' && booking.paymentStatus === 'VERIFIED'`;
const new2 = `const verifiedRefund = booking => booking.refundStatus === 'REFUNDED' && ['VERIFIED', 'SIMULATED'].includes(booking.paymentStatus)`;
if (c.includes(old2)) { c = c.replace(old2, new2); changed++; console.log('✅ Fix 2: verifiedRefund'); }
else { console.error('❌ Fix 2 NOT FOUND'); }

// Fix 3: resolveBookingSplit — include SIMULATED
const old3 = `    if (booking.paymentStatus !== 'VERIFIED') return { ticketRev: 0, concessionRev: 0 };`;
const new3 = `    if (!['VERIFIED', 'SIMULATED'].includes(booking.paymentStatus)) return { ticketRev: 0, concessionRev: 0 };`;
if (c.includes(old3)) { c = c.replace(old3, new3); changed++; console.log('✅ Fix 3: resolveBookingSplit'); }
else { console.error('❌ Fix 3 NOT FOUND'); }

// Fix 4: profitKnown check — also allow SIMULATED to unlock profit display
const old4 = `    const profitKnown = currentBookings.some(order => order.paymentStatus === 'VERIFIED') && currentExpen`;
const new4 = `    const profitKnown = currentBookings.some(order => ['VERIFIED', 'SIMULATED'].includes(order.paymentStatus)) && currentExpen`;
if (c.includes(old4)) { c = c.replace(old4, new4); changed++; console.log('✅ Fix 4: profitKnown (overview)'); }
else { console.log('⚠️  Fix 4 skipped (pattern not matched exactly, may differ)'); }

// Fix 5: profitKnown check in revenue tab
const old5 = `    const profitKnown = bookings.some(order => order.paymentStatus === 'VERIFIED') && expenses.length > 0;`;
const new5 = `    const profitKnown = bookings.some(order => ['VERIFIED', 'SIMULATED'].includes(order.paymentStatus)) && expenses.length > 0;`;
if (c.includes(old5)) { c = c.replace(old5, new5); changed++; console.log('✅ Fix 5: profitKnown (revenue tab)'); }
else { console.log('⚠️  Fix 5 skipped (pattern not matched exactly)'); }

writeFileSync(p, c, 'utf8');
console.log(`\nDone. ${changed} fixes applied to statisticsService.js`);
