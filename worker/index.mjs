/**
 * NSFT — el Worker del sitio.
 *
 * Hasta el 2026-11-13 el sitio era sólo estático. Ahora sirve además UNA ruta:
 *
 *   GET /api/resenas  →  { rating, count, users, reviews[], updated }
 *
 * con las reseñas de la Chrome Web Store leídas en el momento (worker/resenas.mjs)
 * y guardadas en la caché del borde 6 horas: la web se pone al día sola sin
 * volver a publicarla, y la Store recibe como mucho unas pocas visitas al día.
 * Si la lectura falla, contesta 502 y la página se queda con la copia que
 * build.js escribió en el HTML.
 *
 * Todo lo demás son los archivos de `public/`: si una petición no casa con
 * ninguno llega aquí y se le devuelve lo que diga el servidor de estáticos
 * (su 404, sus redirecciones), igual que antes de haber Worker.
 *
 * La fuente vive en el repositorio de la extensión (landing-page/worker/) y la
 * copia `npm run landing:publish`, como el resto del sitio.
 */
import { leeResenas } from './resenas.mjs';

const RUTA = '/api/resenas';
const VIGENCIA = 6 * 60 * 60;   // segundos
/* Sube este número cuando cambie lo que devuelve la ruta (cuántas reseñas, qué
   campos): la caché del borde guarda la respuesta 6 horas por clave, y sin él
   la web seguiría recibiendo la forma vieja hasta que caducara. */
const FORMATO = 2;

export default {
    async fetch(req, env, ctx) {
        const url = new URL(req.url);
        if (url.pathname !== RUTA) return env.ASSETS.fetch(req);
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            return new Response('Method not allowed', { status: 405 });
        }

        const cache = caches.default;
        const clave = new Request(url.origin + RUTA + '?v=' + FORMATO, { method: 'GET' });
        const guardada = await cache.match(clave);
        if (guardada) return guardada;

        try {
            const datos = await leeResenas(fetch, { max: 30 });   // la portada se queda con 9; /reviews, todas
            const res = new Response(JSON.stringify(datos), {
                headers: {
                    'content-type': 'application/json; charset=utf-8',
                    'cache-control': 'public, max-age=' + VIGENCIA
                }
            });
            ctx.waitUntil(cache.put(clave, res.clone()));
            return res;
        } catch (e) {
            return new Response(JSON.stringify({ error: String(e && e.message || e) }), {
                status: 502,
                headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
            });
        }
    }
};
