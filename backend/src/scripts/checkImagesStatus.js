import https from 'https';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'backend/.env' });

import Movie from '../models/Movie.js';

function checkUrl(url) {
  return new Promise((resolve) => {
    if (!url) return resolve({ ok: false, status: 0 });
    try {
      https.get(url, (res) => {
        resolve({ ok: res.statusCode === 200, status: res.statusCode });
      }).on('error', (err) => {
        resolve({ ok: false, error: err.message });
      });
    } catch (e) {
      resolve({ ok: false, error: e.message });
    }
  });
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const movies = await Movie.find({});
  console.log(`Checking ${movies.length} movies...`);

  for (const m of movies) {
    const posterRes = await checkUrl(m.posterUrl);
    const bannerRes = await checkUrl(m.bannerUrl);
    console.log(`[${m.title}]`);
    console.log(`  - Poster (${m.posterUrl}): ${posterRes.ok ? '✓ OK (200)' : '❌ FAIL (' + (posterRes.status || posterRes.error) + ')'}`);
    console.log(`  - Banner (${m.bannerUrl}): ${bannerRes.ok ? '✓ OK (200)' : '❌ FAIL (' + (bannerRes.status || bannerRes.error) + ')'}`);
  }
  process.exit(0);
}

main();
