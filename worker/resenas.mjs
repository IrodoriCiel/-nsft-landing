/**
 * NSFT — las reseñas de la Chrome Web Store, leídas de su página pública.
 *
 * Lo usan DOS sitios, y por eso vive en un módulo aparte:
 *   - el Worker del sitio (worker/index.mjs), que contesta /api/resenas y así
 *     la web se pone al día sola, sin volver a publicarla;
 *   - build.js, que guarda una copia (resenas.json) y la escribe en el HTML:
 *     es lo que se ve sin JavaScript, lo que leen los buscadores y el respaldo
 *     si la Store cambia su página y la lectura en vivo falla.
 *
 * La Store no tiene API de reseñas: se lee el HTML de /reviews. Sus clases son
 * ofuscadas y cambian, así que NO se buscan por clase sino por lo que dice el
 * marcado y es estable: `aria-label="5 out of 5 stars"`, el nombre dentro del
 * <h3>, la fecha en texto y el párrafo de la reseña.
 *
 * Y la página filtra por idioma: con `hl=en` salen las escritas en inglés, con
 * `hl=es` las de español, con `hl=pt` las de portugués… (medido el 2026-11-13).
 * Se leen seis idiomas y se juntan; las marcas de estrellas y fechas cambian con
 * el idioma, así que se leen sin depender de él.
 */

const BASE = 'https://chromewebstore.google.com/detail/netsuite-full-tools/fgldkomofdfcmkccjgalihlollndjmcc/reviews';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

/* La reseña del propio autor no se enseña: en una web suya sería
   autopromoción. */
const EXCLUIR = /garc[ií]a figueroa/i;

/* Abreviaturas de mes en los idiomas que se leen (en, es, pt, it, fr, de),
   ya sin acentos ni puntos. */
const MESES = {
    jan: 0, ene: 0, gen: 0, janv: 0, jän: 0,
    feb: 1, fev: 1, fevr: 1,
    mar: 2, mars: 2, mrz: 2, mär: 2,
    apr: 3, abr: 3, avr: 3,
    may: 4, mai: 4, mag: 4,
    jun: 5, giu: 5, juin: 5,
    jul: 6, lug: 6, juil: 6,
    aug: 7, ago: 7, aout: 7,
    sep: 8, sept: 8, set: 8,
    oct: 9, out: 9, ott: 9, okt: 9,
    nov: 10,
    dec: 11, dic: 11, dez: 11
};

function desescapa(s) {
    return String(s || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
        .trim();
}

/* La fecha en cualquiera de esos idiomas → «2026-10-28»:
   «Oct 28, 2026», «29 oct 2026», «6 de ago. de 2026», «21. Sept. 2026». */
function fecha(txt) {
    const t = String(txt || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // sin acentos (escapes, nunca literales)
        .replace(/\./g, ' ').replace(/\bde\b/g, ' ').replace(/,/g, ' ')   // ni puntos, ni el «de» de pt/es, ni comas
        .replace(/\s+/g, ' ').trim();
    const mes = (w) => (w in MESES ? MESES[w] : (w.slice(0, 4) in MESES ? MESES[w.slice(0, 4)] : MESES[w.slice(0, 3)]));
    let m = /^([a-z]+) (\d{1,2}) (\d{4})$/.exec(t);
    if (m && mes(m[1]) != null) return iso(+m[3], mes(m[1]), +m[2]);
    m = /^(\d{1,2}) ([a-z]+) (\d{4})$/.exec(t);
    if (m && mes(m[2]) != null) return iso(+m[3], mes(m[2]), +m[1]);
    return '';
}
function iso(y, mo, d) {
    return y + '-' + String(mo + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

export function analiza(html, lang) {
    const out = [];
    const secciones = String(html).match(/<section\b[^>]*>[\s\S]*?<\/section>/g) || [];
    secciones.forEach((sec) => {
        // «5 out of 5 stars», «5 de 5 estrellas», «5 su 5 stelle»…: el primer número.
        const est = /role="img"[^>]*aria-label="(\d)\D[^"]*"|aria-label="(\d)\D[^"]*"[^>]*role="img"/.exec(sec);
        const nombre = /<h3\b[^>]*>\s*<span\b[^>]*>([\s\S]*?)<\/span>/.exec(sec);
        if (!est || !nombre) return;   // no es una reseña
        // La fecha: el primer <span> tras el bloque de estrellas del <h3>.
        const f = /aria-label="\d\D[^"]*"[\s\S]*?<\/svg><\/div><\/div><\/div>\s*<span\b[^>]*>([^<]{4,30})<\/span>/.exec(sec);
        const texto = /<p\b[^>]*>\s*<span\b[^>]*>([\s\S]*?)<\/span>\s*<\/p>/.exec(sec);
        const r = {
            name: desescapa(nombre[1]),
            stars: +(est[1] || est[2]),
            date: f ? fecha(desescapa(f[1])) : '',
            text: texto ? desescapa(texto[1]) : '',
            lang
        };
        if (r.name && !EXCLUIR.test(r.name)) out.push(r);
    });
    return out;
}

/* La media, las valoraciones y los usuarios, de la cabecera de la ficha. */
function resumen(html) {
    const media = /Average rating ([\d.]+) out of 5/.exec(html) || /Valoración media: ([\d.,]+) de 5/.exec(html);
    const total = /([\d.,]+) ratings?\b/.exec(html);
    const usuarios = /([\d.,]+\+?) users\b/.exec(html);
    const num = (s) => +String(s).replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.');
    return {
        rating: media ? num(media[1]) : null,
        count: total ? num(total[1]) : null,
        users: usuarios ? num(usuarios[1]) : null
    };
}

/**
 * Lee la Store y devuelve
 *   { rating, count, users, reviews: [{ name, stars, date, text, lang }], updated }
 * con las reseñas de 4 y 5 estrellas que traen texto, de la más nueva a la más
 * vieja. `fetchFn` es el `fetch` del entorno (Worker o Node 18+).
 */
export async function leeResenas(fetchFn, opts) {
    const max = (opts && opts.max) || 12;
    const pide = (hl) => fetchFn(BASE + '?hl=' + hl, {
        headers: { 'user-agent': UA, 'accept-language': hl }
    }).then((r) => {
        if (!r.ok) throw new Error('Store ' + hl + ': HTTP ' + r.status);
        return r.text();
    });
    const IDIOMAS = ['en', 'es', 'pt', 'it', 'fr', 'de'];
    const paginas = await Promise.all(IDIOMAS.map((hl) => pide(hl).catch(() => '')));
    const en = paginas[0];
    if (!en) throw new Error('la Store no contestó');

    const cab = resumen(en);
    if (cab.rating == null || cab.count == null) {
        throw new Error('la Store no trajo la valoración media: ¿cambió su página?');
    }

    const vistas = new Set();
    const reviews = [].concat(...paginas.map((h, i) => analiza(h, IDIOMAS[i])))
        .filter((r) => r.stars >= 4 && r.text.length >= 3)
        .filter((r) => {
            const k = r.name + '|' + r.text;
            if (vistas.has(k)) return false;
            vistas.add(k);
            return true;
        })
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    /* Primero las que cuentan algo —«Excelente extensión» a secas no le dice
       nada a quien llega—, de la más nueva a la más vieja; las cortas sólo
       rellenan si faltan. */
    const LARGA = 40;
    const ordenadas = reviews.filter((r) => r.text.length >= LARGA)
        .concat(reviews.filter((r) => r.text.length < LARGA))
        .slice(0, max);
    reviews.length = 0;
    reviews.push(...ordenadas);

    if (!reviews.length) throw new Error('la Store no trajo ninguna reseña: ¿cambió su página?');
    return Object.assign(cab, { reviews, updated: new Date().toISOString() });
}
