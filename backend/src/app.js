import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { env } from './config/env.js';
import apiRouter from './routes/index.js';
import { healthRoutes } from './routes/health.routes.js';
import { notFoundHandler } from './middleware/not-found.js';
import { errorHandler } from './middleware/error-handler.js';
import { AppError } from './utils/app-error.js';

const app = express();

// 1. Security Headers via Helmet
app.use(helmet());

// 2. Strict CORS Configuration (environment-controlled, no wildcard for credentialed API)
const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests with no origin header (e.g. server-to-server, mobile)
    if (!origin) return callback(null, true);

    if (env.corsOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Disallowed origins receive no Access-Control-Allow-Origin header
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key'],
};
app.use(cors(corsOptions));

// 3. Global API Rate Limiting
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new AppError('RATE_LIMIT_EXCEEDED', 'Too many requests, please try again later.', 429));
  },
});
app.use(limiter);

// 4. JSON Body Parsing with configurable size limit
app.use(express.json({ limit: env.BODY_LIMIT }));

// 5. API Routes
app.use('/api/v1', apiRouter);

// Root /health alias aligned with docs/api-contract.md §9 and docs/architecture.md §9
app.use('/health', healthRoutes);

// 6. Catch-all 404 Not Found Handler
app.use(notFoundHandler);

// 7. Centralized Error Handler (must be registered last)
app.use(errorHandler);

export { app };
export default app;

