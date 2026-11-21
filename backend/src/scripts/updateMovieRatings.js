import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../backend/.env') });

const uri = process.env.MONGODB_URI || 'mongodb+srv://admin:admin@cluster0.p7qsl.mongodb.net/movietix?retryWrites=true&w=majority';

async function run() {
  await mongoose.connect(uri);
  const Movie = mongoose.model('Movie', new mongoose.Schema({}, { strict: false }));
  
  await Movie.updateOne({ slug: 'dune-hanh-tinh-cat-phan-2' }, { $set: { rating: 4.9 } });
  await Movie.updateOne({ slug: 'mai' }, { $set: { rating: 4.8 } });
  await Movie.updateOne({ slug: 'deadpool-and-wolverine' }, { $set: { rating: 4.8 } });

  console.log('Successfully updated ratings for Dune 2 (4.9), Mai (4.8), Deadpool (4.8)!');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
