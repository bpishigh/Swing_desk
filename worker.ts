// Worker entry for the dashboard on Cloudflare Workers (static assets + one API route).
// Everything except /api/portfolio is served from the static site; /api/portfolio is handled here, and the handler checks the Cloudflare Access login itself.
import { handle } from './functions/api/portfolio.ts';

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/portfolio') return handle(request, env);
    return env.ASSETS.fetch(request);
  },
};
