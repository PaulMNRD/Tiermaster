// Dev server proxy. API_PROXY_TARGET lets docker-compose.dev.yml point it at the api container.
const target = process.env.API_PROXY_TARGET ?? 'http://localhost:3226';

export default {
  '/api': { target, secure: false, changeOrigin: false },
  '/ws': { target, secure: false, ws: true },
};
