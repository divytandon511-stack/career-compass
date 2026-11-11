import http from 'node:http';
import { app } from './app.js';
import { env } from './config/env.js';

let server = null;
let isShuttingDown = false;

/**
 * Starts the HTTP server asynchronously with robust error handling for EADDRINUSE and other startup failures.
 * @param {number} [port=env.PORT]
 * @returns {Promise<http.Server>}
 */
export const startServer = (port = env.PORT) => {
  return new Promise((resolve, reject) => {
    const httpServer = http.createServer(app);

    // Asynchronous error handler for startup failures (e.g. EADDRINUSE, EACCES)
    httpServer.on('error', (err) => {
      if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
        console.error(`[Server] Asynchronous startup failure on port ${port}:`, err);
      }
      reject(err);
    });

    httpServer.listen(port, () => {
      if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
        console.log(`[Server] CareerCompass API listening on port ${port} in ${env.NODE_ENV} mode`);
      }
      server = httpServer;
      resolve(httpServer);
    });
  });
};

/**
 * Gracefully shuts down the HTTP server, preventing duplicate shutdown executions.
 * @param {string} [signal='SIGTERM']
 * @returns {Promise<void>}
 */
export const shutdown = (signal = 'SIGTERM') => {
  return new Promise((resolve) => {
    if (isShuttingDown) {
      return resolve();
    }
    isShuttingDown = true;

    if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
      console.log(`[Server] Received ${signal}. Closing HTTP server...`);
    }

    if (server && server.listening) {
      server.close((err) => {
        if (err) {
          if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
            console.error('[Server] Error while closing HTTP server:', err);
          }
          process.exit(1);
        }
        if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
          console.log('[Server] HTTP server closed cleanly.');
        }
        resolve();
      });
    } else {
      resolve();
    }
  });
};

process.on('SIGTERM', async () => {
  await shutdown('SIGTERM');
  process.exit(0);
});

process.on('SIGINT', async () => {
  await shutdown('SIGINT');
  process.exit(0);
});

// Auto-start when executed as the main application script (skipped in test runner)
if (!process.env.VITEST) {
  startServer().catch(() => {
    process.exit(1);
  });
}

export { server };
