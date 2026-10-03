import express from 'express';
import { apiRouter } from '../src/server/routes.ts';

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mount API routes
app.use('/api', apiRouter);

// Root fallback for serverless
export default app;
