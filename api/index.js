// Vercel serverless entry point. Hands every /api request to the Express app,
// which (unlike src/index.js) exports without binding a port.
import app from '../server/src/app.js';

export default async function handler(req, res) {
  await new Promise((resolve) => {
    app(req, res, resolve);
  });
}
