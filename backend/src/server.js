import http from 'node:http';
import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

import { app } from './app.js';
import { env } from './config/env.js';

let server = null;
let shutdownPromise = null;

/**
 * Determines whether this module is the directly executed CLI entrypoint.
 * Avoids environment sniffing (e.g. process.env.VITEST) and works reliably in ESM.
 * @returns {boolean}
 */
export const isMainModule = () => {
  if (!process.argv[1]) return false;
  try {
    const scriptPath = fs.realpathSync(path.resolve(process.argv[1]));
    const modulePath = fs.realpathSync(url.fileURLToPath(import.meta.url));
    return scriptPath === modulePath;
  } catch {
    return path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url);
  }
};

/**
 * Starts the HTTP server asynchronously with robust error handling for EADDRINUSE and other startup failures.
 * Attaches a post-startup error listener to handle runtime errors appropriately.
 * @param {number} [port=env.PORT]
 * @returns {Promise<http.Server>}
 */
export const startServer = (port = env.PORT) => {
  if (server && server.listening) {
    return Promise.reject(new Error('Server is already running'));
  }

  return new Promise((resolve, reject) => {
    const httpServer = http.createServer(app);

    // Asynchronous listener for startup errors (e.g. EADDRINUSE, EACCES)
    const onStartupError = (err) => {
      if (process.env.NODE_ENV !== 'test') {
        console.error(`[Server] Asynchronous startup failure on port ${port}:`, err);
      }
      reject(err);
    };

    httpServer.once('error', onStartupError);

    httpServer.listen(port, () => {
      // Remove temporary startup error handler
      httpServer.removeListener('error', onStartupError);

      // Attach runtime error handler for post-startup server errors
      httpServer.on('error', (err) => {
        if (process.env.NODE_ENV !== 'test') {
          console.error('[Server] Post-startup HTTP server error:', err);
        }
      });

      if (process.env.NODE_ENV !== 'test') {
        console.log(`[Server] CareerCompass API listening on port ${port} in ${env.NODE_ENV} mode`);
      }

      server = httpServer;
      resolve(httpServer);
    });
  });
};

/**
 * Gracefully shuts down the HTTP server.
 * Idempotent: repeated or concurrent calls return the same resolution.
 * Supports starting a server again after a completed shutdown.
 * Does NOT call process.exit() so it remains reusable in tests and embedding contexts.
 * @param {string} [signal='SIGTERM']
 * @returns {Promise<void>}
 */
export const shutdown = (signal = 'SIGTERM') => {
  // If a shutdown is already in progress, return the existing in-flight promise
  if (shutdownPromise) {
    return shutdownPromise;
  }

  // If no server exists or it is not listening, nothing to shut down
  if (!server || !server.listening) {
    server = null;
    return Promise.resolve();
  }

  if (process.env.NODE_ENV !== 'test') {
    console.log(`[Server] Received ${signal}. Closing HTTP server...`);
  }

  const currentServer = server;

  shutdownPromise = new Promise((resolve, reject) => {
    currentServer.close((err) => {
      server = null;
      shutdownPromise = null;

      if (err) {
        if (process.env.NODE_ENV !== 'test') {
          console.error('[Server] Error while closing HTTP server:', err);
        }
        return reject(err);
      }

      if (process.env.NODE_ENV !== 'test') {
        console.log('[Server] HTTP server closed cleanly.');
      }
      resolve();
    });
  });

  return shutdownPromise;
};

// Direct CLI execution handling: register signals and start server only when executed directly
if (isMainModule()) {
  const handleSignal = async (signal) => {
    try {
      await shutdown(signal);
      process.exit(0);
    } catch (err) {
      console.error(`[Server] Error during ${signal} shutdown:`, err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => handleSignal('SIGTERM'));
  process.on('SIGINT', () => handleSignal('SIGINT'));

  startServer().catch((err) => {
    console.error('[Server] Startup failed:', err);
    process.exit(1);
  });
}

export { server };
