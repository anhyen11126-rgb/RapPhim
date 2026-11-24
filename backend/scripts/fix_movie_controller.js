import { readFileSync, writeFileSync } from 'fs';

const p = 'd:/CDIO/movietix-project/backend/src/controllers/movieController.js';
let c = readFileSync(p, 'utf8');

// Fix 1: Remove same-month restriction in getMovieSchedule
const before = `const showtimes = localRelease && (date < localRelease || date.slice(0, 7) !== localRelease.slice(0, 7))`;
const after   = `const showtimes = localRelease && date < localRelease`;
if (!c.includes(before)) {
  console.error('PATTERN NOT FOUND in movieController.js');
  process.exit(1);
}
c = c.replace(before, after);
writeFileSync(p, c, 'utf8');
console.log('movieController month-filter bug fixed OK');
