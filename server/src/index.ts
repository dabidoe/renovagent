import 'dotenv/config';
import { app } from './app.js';
import { connectDb } from './db.js';
import { env } from './env.js';

await connectDb();
app.listen(env.PORT, () => console.log(`Unpermitted API listening on :${env.PORT} (${env.NODE_ENV})`));
