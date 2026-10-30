// Vercel serverless entry point. Deliberately CommonJS: the Express app lives
// in the ESM "server" workspace ("type": "module"), so it is loaded with a
// dynamic import() at runtime instead of a require().
let appPromise = null;

function getApp() {
  if (!appPromise) {
    appPromise = import('../server/src/app.js');
  }
  return appPromise;
}

module.exports = async function handler(req, res) {
  try {
    const { default: app } = await getApp();
    await new Promise((resolve) => {
      app(req, res, resolve);
    });
  } catch (error) {
    console.error('[api] failed to initialize:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'API failed to initialize' });
    }
  }
};
