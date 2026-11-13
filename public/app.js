/**
 * NetSuite Full Tools — landing page.
 *
 * Toda la interactividad del sitio: idioma, tema, las pestañas de "Cómo se ve"
 * y el catálogo buscable. Sin dependencias ni frameworks.
 *
 * Los dos idiomas viven en el mismo HTML (data-l="es" / data-l="en") y el CSS
 * oculta el que no toca, así que cambiar de idioma es instantáneo y no hace
 * falta una segunda página que mantener.
 *
 * El catálogo NO se escribe aquí: build.js lo inyecta en index.html como
 * window.NSFT_CATALOG a partir de STORE_DESCRIPTION.md.
 */
(function () {
    'use strict';

    const html = document.documentElement;
    const root = document.getElementById('nsft-root');
    if (!root) return;

    const LANG_KEY = 'nsft-lang';
    // Carpeta raíz del sitio: la página inglesa vive en /en/.
    // Absoluta y calculada al cargar: el cambio de idioma reescribe la dirección (/ ⇄ /en/) sin recargar.
    const PV_BASE = new URL(/^\/en(\/|$)/.test(location.pathname) ? '../' : './', location.href).href;
    const THEME_KEY = 'nsft-theme';

    const save = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* incógnito */ } };
    const read = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };

    /* ------------------------------------------------------------------ *
     * Idioma
     * ------------------------------------------------------------------ */
    const PLACEHOLDER = {
        es: 'Busca entre las herramientas…',
        en: 'Search among the tools…'
    };

    /* Elemento que el visitante tiene delante: al cambiar de idioma se vuelve a
       colocar en el mismo sitio de la pantalla. Sin esto, todo lo que cambia
       de alto por encima (el catálogo se repinta, los textos miden distinto)
       empujaba la página y daba la sensación de que «se mueve». */
    function anclaVista() {
        const vh = innerHeight;
        const cands = document.querySelectorAll('#nsft-root section, #nsft-root h2, #nsft-root h3, .nsft-gal-card, #nsft-root p, footer');
        let best = null, bestTop = Infinity;
        cands.forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.height && r.top >= 0 && r.top < vh && r.top < bestTop) { best = el; bestTop = r.top; }
        });
        return best ? { el: best, top: bestTop } : null;
    }

    // Ruta de cada idioma: / en español, /en/ en inglés (como irodoriciel.dev).
    const rutaDe = (l) => (l === 'en' ? '/en/' : '/');
    const idiomaDeRuta = () => (/^\/en(\/|$)/.test(location.pathname) ? 'en' : (/^\/(index\.html)?$/.test(location.pathname) ? 'es' : null));

    function setLang(lang, opts) {
        const l = lang === 'en' ? 'en' : 'es';
        const ancla = opts && opts.ancla ? anclaVista() : null;
        if (location.protocol.startsWith('http') && rutaDe(l) !== location.pathname && idiomaDeRuta() !== null) {
            try { history.replaceState(null, '', rutaDe(l) + location.search + location.hash); } catch (e) { /* file:// */ }
        }
        root.setAttribute('data-lang', l);
        html.setAttribute('lang', l);            // también para lectores y buscadores
        const q = document.getElementById('nsft-q');
        if (q) q.placeholder = PLACEHOLDER[l];
        save(LANG_KEY, l);
        renderChips('nsft-chips');
        renderCatalog();
        if (ancla) {
            const corrige = () => { const d = ancla.el.getBoundingClientRect().top - ancla.top; if (Math.abs(d) > 1) scrollBy(0, d); };
            corrige();
            requestAnimationFrame(() => { corrige(); setTimeout(corrige, 120); });
        }
    }

    /* ------------------------------------------------------------------ *
     * Tema
     *
     * El sitio arranca en claro pase lo que pase: el tema del sistema no manda
     * aquí, igual que en la extensión. Si el visitante toca el botón, su
     * elección queda guardada y manda a partir de ese momento.
     * ------------------------------------------------------------------ */
    function setTheme(theme) {
        const t = theme === 'dark' ? 'dark' : 'light';
        root.setAttribute('data-theme', t);
        html.setAttribute('data-theme', t);
        /* Los dibujos traen su modo oscuro colgado del atributo
           data-nsft-theme, que es como lo hace la extensión entera. Se estampa
           aquí para que sigan al tema del sitio sin tocar ni una línea de su
           hoja de estilos. */
        html.setAttribute('data-nsft-theme', t);
        save(THEME_KEY, t);
    }

    /* ------------------------------------------------------------------ *
     * Acciones declaradas en el HTML: data-act="lang" | "theme" | "tab:ui" …
     * ------------------------------------------------------------------ */
    document.addEventListener('click', (ev) => {
        const el = ev.target.closest('[data-act]');
        if (!el) return;
        const [kind, value] = el.getAttribute('data-act').split(':');

        if (kind === 'lang') return setLang(root.getAttribute('data-lang') === 'es' ? 'en' : 'es', { ancla: true });
        if (kind === 'theme') return setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
        /* «Demo» abre la ventana de demos (empieza por el Asistente de IA y con
           ‹ › recorre los destacados), en vez de llevar al catálogo como el
           enlace de al lado. */
        if (kind === 'demo') {
            ev.preventDefault();
            if (root.getAttribute('data-cat') !== 'star' && !query) { root.setAttribute('data-cat', 'star'); renderChips('nsft-chips'); renderCatalog(); }
            return pvAbre('Asistente de IA');
        }
        if (kind === 'tab') return root.setAttribute('data-tab', value);
        if (kind === 'cat') {
            root.setAttribute('data-cat', value);
            renderChips('nsft-chips');
            renderCatalog();
        }
    });

    /* ------------------------------------------------------------------ *
     * Catálogo de herramientas
     * ------------------------------------------------------------------ */
    const catalog = window.NSFT_CATALOG || { groups: [], tools: [] };
    const listEl = document.getElementById('nsft-catalog');
    const emptyEl = document.getElementById('nsft-empty');
    const countEl = document.getElementById('nsft-count');
    const searchEl = document.getElementById('nsft-q');
    let query = '';
    let catalogPainted = false;

    const esc = (s) => String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    // Sin acentos y en minúsculas: buscar "codigo" debe encontrar "código".
    const fold = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const soft = (color, pct) => `color-mix(in oklab, ${color} ${pct}%, transparent)`;

    /* La ficha de una herramienta: nombre, descripción y —debajo— su vista
       previa animada, la misma que enseña el asistente de arranque de la
       extensión. Primero se lee qué hace y luego se ve; al revés, el dibujo
       obliga a adivinar.
       group.icon es el <svg> del panel equivalente del popup: va tal cual, sin
       escapar — lo pone build.js desde popup.html, no viene de fuera. */
    /* FICHA COMPACTA (2026-11-12). Antes cada ficha traía su dibujo animado
       debajo, y 118 dibujos eran decenas de pantallas de scroll. Ahora la
       ficha dice qué hace en una línea y el dibujo se abre al pulsarla, en un
       panel, sólo para quien lo quiere ver. */
    function card(tool, group, en) {
        const demo = tool.pv
            ? `<span class="nsft-tc-demo"><span data-l="es">Ver demo</span><span data-l="en">See demo</span> ▸</span>`
            : '';
        return `
        <button type="button" class="nsft-tc" data-tool="${esc(tool.nameEs)}" style="--gal:${group.color};"${tool.pv ? '' : ' data-sin-demo'}>
          <span class="nsft-tc-ic">${tool.icon || group.icon}</span>
          <span class="nsft-tc-tx">
            <b>${esc(en ? tool.nameEn : tool.nameEs)}</b>
            <span>${esc(en ? tool.descEn : tool.descEs)}</span>
            ${demo}
          </span>
        </button>`;
    }

    function groupBlock(group, items, en) {
        return `
      <div data-anim="up">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
          <span class="nsft-group-icon" style="width:36px;height:36px;border-radius:10px;display:grid;place-items:center;color:${group.color};background:${soft(group.color, 12)};border:1px solid ${soft(group.color, 22)};">${group.icon}</span>
          <h3 style="margin:0;font-size:20px;font-weight:800;letter-spacing:-.02em;color:${group.color};">${esc(en ? group.nameEn : group.nameEs)}</h3>
          <span style="font-size:11.5px;font-weight:800;font-variant-numeric:tabular-nums;color:${group.color};background:${soft(group.color, 12)};border-radius:99px;padding:3px 9px;">${items.length}</span>
          <span style="flex:1;height:1px;background:linear-gradient(90deg, ${soft(group.color, 12)}, transparent);"></span>
        </div>
        <div class="nsft-tc-grid">
          ${items.map((t) => card(t, group, en)).join('')}
        </div>
      </div>`;
    }

    /* Los chips salen de los mismos grupos que el catálogo, así que no hay
       lista que mantener a mano en la plantilla. */
    function renderChips(id) {
        const chipsEl = document.getElementById(id || 'nsft-chips');
        if (!chipsEl) return;
        const en = root.getAttribute('data-lang') === 'en';
        const active = root.getAttribute('data-cat');
        const all = `<button class="nsft-chip${active === 'all' ? ' is-on' : ''}" data-act="cat:all">` +
            `<span data-l="es">Todas</span><span data-l="en">All</span></button>`;
        chipsEl.innerHTML = all + catalog.groups.map((g) => `
          <button class="nsft-chip${active === g.id ? ' is-on' : ''}" data-act="cat:${g.id}" style="--chip:${g.color};color:${active === g.id ? '#fff' : 'var(--fg2)'};">
            <span style="display:inline-flex;color:${active === g.id ? '#fff' : g.color};">${g.icon}</span>
            <span>${esc(en ? g.nameEn : g.nameEs)}</span>
          </button>`).join('');
    }

    function renderCatalog() {
        if (!listEl) return;
        const en = root.getAttribute('data-lang') === 'en';
        const cat = root.getAttribute('data-cat');
        const needle = fold(query.trim());

        const matches = catalog.tools.filter((t) => {
            if (!needle) return cat === 'all' || t.group === cat;
            return fold(`${t.nameEs} ${t.nameEn} ${t.descEs} ${t.descEn}`).indexOf(needle) >= 0;
        });

        listEl.innerHTML = catalog.groups.map((g) => {
            const items = matches.filter((t) => t.group === g.id);
            return items.length ? groupBlock(g, items, en) : '';
        }).join('');

        // Los grupos entran al hacer scroll la primera vez; al filtrar o
        // buscar aparecen ya visibles, que esperar una animación en cada
        // pulsación se hace pesado.
        if (catalogPainted) {
            listEl.querySelectorAll('[data-anim]').forEach((el) => el.classList.add('is-in'));
        } else {
            observe(listEl);
            catalogPainted = true;
        }

        if (countEl) countEl.textContent = matches.length;
        if (emptyEl) emptyEl.hidden = matches.length > 0;

        /* Las fichas se repintan enteras a cada filtro y a cada tecla, así que
           los dibujos que había puestos se van con ellas: hay que volver a
           observar los nuevos. Si el paquete aún no ha llegado, esto no hace
           nada y ya lo hará `pvAsegura()` cuando llegue. */
        pvObserva();
    }

    if (searchEl) {
        searchEl.addEventListener('input', (ev) => {
            query = ev.target.value;
            renderCatalog();
        });
    }

    /* ------------------------------------------------------------------ *
     * Vistas previas animadas dentro del catálogo
     *
     * Los dibujos son los MISMOS que enseña el asistente de arranque de la
     * extensión: build.js ejecuta welcome_previews.js y cuelga cada uno de su
     * herramienta, así que la web no tiene maquetas propias que se queden
     * viejas ni una segunda lista de funciones que mantener.
     *
     * SÓLO LOS DE LOS INTERRUPTORES PRINCIPALES. Los dibujos de subopciones
     * —«abrir en panel lateral», «menú o botón», la paleta del workflow— se
     * quedan fuera: aquí se enseña qué hace cada herramienta, no cómo se afina,
     * que es la misma decisión que se tomó en el asistente de arranque.
     *
     * Tres decisiones que explican todo lo de abajo:
     *
     *   · SE CARGA AL LLEGAR. El CSS de los dibujos y el paquete del idioma
     *     pesan bastante; quien no baje hasta el catálogo no los pide. Se
     *     empiezan a traer un poco antes de que la sección aparezca.
     *   · EL DIBUJO SE INYECTA AL ASOMARSE, no al pintar la ficha. Sus
     *     animaciones corren UNA vez al aparecer el elemento: metiéndolos todos
     *     de golpe, los cien se reproducirían con la página aún arriba y el
     *     visitante sólo vería el último fotograma.
     *   · VOLVER A INYECTARLO ES VOLVER A REPRODUCIRLO. De ahí que repetir sea
     *     tan simple como pintar otra vez, sin tocar clases ni reiniciar nada.
     * ------------------------------------------------------------------ */
    const PV_T = {
        es: { repetir: 'Repetir la animación' },
        en: { repetir: 'Play again' }
    };

    /* El relleno del hueco, a los dos lados (14 px en styles.css). Se resta del
       ancho disponible antes de calcular cuánto hay que encoger el dibujo. */
    const PV_AIRE = 28;

    /* Tope de alto del dibujo, para que una fila no se dispare: las fichas se
       estiran a la altura de la más alta y una ventana entera de NetSuite dejaba
       a su compañera con un hueco enorme.

       Es ALTO y a propósito. Bajarlo encogería los dibujos que ya caben de
       ancho, y eso desharía justo lo que se ganó al pasar a dos columnas: aquí
       manda el ancho, y el tope sólo está para cortar los extremos. */
    const PV_ALTO = 420;

    /* Sello de contenido que pone build.js: cambia cuando cambia un dibujo, y
       es lo que deja cachear estos archivos para siempre sin servir uno viejo. */
    const pvSello = () => (window.NSFT_PV_V ? '?v=' + window.NSFT_PV_V : '');

    const pvPaquetes = {};      // idioma -> {clave: html}
    let pvCssPedido = false;
    let pvObs = null;

    /** El CSS de los dibujos, una sola vez y sólo si hace falta. */
    function pvCargaCss() {
        if (pvCssPedido) return;
        pvCssPedido = true;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = PV_BASE + 'previews.css' + pvSello();
        document.head.appendChild(link);
    }

    /** El paquete de dibujos de un idioma. Se pide una vez por idioma. */
    function pvCargaIdioma(lang) {
        if (pvPaquetes[lang]) return Promise.resolve(pvPaquetes[lang]);
        return new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = PV_BASE + 'previews.' + lang + '.js' + pvSello();
            s.onload = () => {
                /* Cada archivo deja su mapa en la misma variable; se guarda
                   enseguida para que el del otro idioma no lo pise. */
                pvPaquetes[lang] = window.NSFT_PV_HTML || {};
                resolve(pvPaquetes[lang]);
            };
            s.onerror = () => resolve(null);
            document.head.appendChild(s);
        });
    }

    /**
     * Mete el dibujo en su hueco.
     *
     * @param {boolean} animar  true = corre la animación; false = se pinta ya
     *   terminado y quieto.
     *
     * QUIETO POR DEFECTO, Y NO ES UN CAPRICHO. Las animaciones corren una sola
     * vez en cuanto el elemento existe, así que pintarlas al asomarse gastaba la
     * mitad de la rejilla antes de que nadie las mirara: al llegar, ya estaban
     * todas paradas. Ahora se pintan con `is-idle`, que fuerza duración cero y
     * las deja en su último fotograma —el estado «después», que es el que
     * cuenta algo—, y la animación de verdad corre al pasar el ratón.
     */
    function pvPinta(stage, animar) {
        const lang = root.getAttribute('data-lang') === 'en' ? 'en' : 'es';
        const mapa = pvPaquetes[lang];
        const clave = stage.getAttribute('data-pv');
        if (!mapa || !mapa[clave]) return;
        const t = PV_T[lang];
        stage.classList.toggle('is-idle', !animar);
        /* El botón lleva rótulo, no sólo el símbolo: además de repetir, es lo
           ÚNICO que avisa de que el dibujo se anima. Un aspa gris en una esquina
           no lo dice; «Repetir» sí. */
        stage.innerHTML = '<button class="nsft-gal-replay" type="button" data-pv-replay ' +
            'title="' + esc(t.repetir) + '"><span aria-hidden="true">&#8635;</span>' +
            esc(t.repetir) + '</button>' +
            mapa[clave];
        pvAjusta(stage);
    }

    /**
     * ENCOGE EL DIBUJO HASTA QUE QUEPA.
     *
     * Los dibujos vienen con anchos FIJOS en píxeles: están hechos para el panel
     * del asistente de arranque, que siempre mide lo mismo. En una rejilla, la
     * ficha mide lo que le toque según la ventana, así que los que no caben se
     * salían y la tarjeta los recortaba por la derecha — media ventana de
     * NetSuite cortada.
     *
     * Se mide el ancho natural y se aplica `zoom`, que ENCOGE DE VERDAD: a
     * diferencia de `transform: scale`, recalcula la maquetación, así que el
     * hueco se queda con el alto que corresponde y no sobra ni falta espacio
     * debajo. Sólo se encoge, nunca se agranda: un dibujo pequeño se queda a su
     * tamaño en vez de salir borroso.
     */
    function pvAjusta(stage) {
        const dibujo = stage.querySelector(':scope > :not(.nsft-gal-replay)');
        if (!dibujo) return;

        /* Medir el ancho NATURAL, no el que tiene puesto. El marco del dibujo es
           un bloque: ya viene del ancho de su hueco y recorta por dentro lo que
           no cabe —de ahí las ventanas de NetSuite cortadas por la derecha—, así
           que preguntarle `offsetWidth` devolvería siempre «cabe perfecto».
           Con `max-content` se le deja crecer un instante hasta lo que de verdad
           ocupan sus piezas, se apunta el número y se le devuelve lo suyo. */
        dibujo.style.zoom = '';
        dibujo.style.width = 'max-content';
        const natural = dibujo.offsetWidth;
        const naturalAlto = dibujo.offsetHeight;
        dibujo.style.width = '';

        const hueco = stage.clientWidth - PV_AIRE;
        if (!natural || hueco <= 0) return;

        /* Se encoge por lo que peor vaya, ancho o alto, y NUNCA se agranda: un
           dibujo pequeño a su tamaño se ve nítido; estirado, borroso. */
        const k = Math.min(1, hueco / natural, naturalAlto ? PV_ALTO / naturalAlto : 1);
        /* El uno por ciento de margen evita que un redondeo encoja un dibujo que
           ya cabía: encoger de menos no se nota, encoger sin necesidad sí. */
        if (k < 0.99) dibujo.style.zoom = k.toFixed(4);
    }

    /* Al cambiar el ancho de la ventana cambia el de las fichas, así que hay que
       volver a encoger. Se espera a que pare de moverse: reajustar cien dibujos
       en cada píxel de arrastre no lo aguanta nadie. */
    let _pvResize = null;
    addEventListener('resize', () => {
        clearTimeout(_pvResize);
        _pvResize = setTimeout(() => {
            if (!listEl) return;
            listEl.querySelectorAll('[data-pv]').forEach((st) => { if (st.firstChild) pvAjusta(st); });
        }, 160);
    }, { passive: true });

    /** Observa las fichas para poner el dibujo —quieto— cuando asoman. */
    function pvObserva() {
        if (!listEl) return;
        if (!('IntersectionObserver' in window)) {
            listEl.querySelectorAll('[data-pv]').forEach((el) => pvPinta(el, false));
            return;
        }
        if (!pvObs) {
            pvObs = new IntersectionObserver((entries) => {
                entries.forEach((e) => {
                    /* Una vez puesto, deja de vigilarse: el dibujo ya está y
                       quien manda a partir de ahí es el ratón. */
                    if (!e.isIntersecting) return;
                    pvPinta(e.target, false);
                    pvObs.unobserve(e.target);
                });
            }, { rootMargin: '120px 0px' });
        }
        listEl.querySelectorAll('[data-pv]').forEach((el) => pvObs.observe(el));
    }

    /* ------------------------------------------------------------------ *
     * Panel de la demo: el dibujo animado de una herramienta, al pulsarla.
     * Con ← → se pasa a la anterior o la siguiente de la lista visible.
     * ------------------------------------------------------------------ */
    let pvLista = [], pvIdx = -1, pvVolver = null;
    function pvPanel() {
        let m = document.getElementById('nsft-pvm');
        if (m) return m;
        m = document.createElement('div');
        m.id = 'nsft-pvm';
        m.className = 'nsft-pvm';
        m.hidden = true;
        m.innerHTML = `
          <div class="nsft-pvm-bg" data-pvm-close></div>
          <div class="nsft-pvm-box" role="dialog" aria-modal="true" aria-labelledby="nsft-pvm-t">
            <div class="nsft-pvm-hd">
              <span class="nsft-pvm-ic"></span>
              <div class="nsft-pvm-ti"><small></small><b id="nsft-pvm-t"></b></div>
              <button type="button" class="nsft-pvm-nav" data-pvm-step="-1" aria-label="Anterior">‹</button>
              <button type="button" class="nsft-pvm-nav" data-pvm-step="1" aria-label="Siguiente">›</button>
              <button type="button" class="nsft-pvm-x" data-pvm-close aria-label="Cerrar">✕</button>
            </div>
            <p class="nsft-pvm-desc"></p>
            <div class="nsft-pvm-nota"></div>
            <div class="nsft-gal-stage nsft-pvm-stage"></div>
          </div>`;
        document.body.appendChild(m);
        m.addEventListener('click', (ev) => {
            if (ev.target.closest('[data-pvm-close]')) return pvCierra();
            const paso = ev.target.closest('[data-pvm-step]');
            if (paso) return pvMuestra(pvIdx + Number(paso.getAttribute('data-pvm-step')));
            const rep = ev.target.closest('[data-pv-replay]');
            if (rep) pvPinta(rep.closest('[data-pv]'), true);
        });
        document.addEventListener('keydown', (ev) => {
            if (m.hidden) return;
            if (ev.key === 'Escape') pvCierra();
            if (ev.key === 'ArrowRight') pvMuestra(pvIdx + 1);
            if (ev.key === 'ArrowLeft') pvMuestra(pvIdx - 1);
        });
        return m;
    }
    function pvMuestra(idx) {
        if (!pvLista.length) return;
        pvIdx = (idx + pvLista.length) % pvLista.length;
        const tool = pvLista[pvIdx];
        const g = catalog.groups.find((x) => x.id === tool.group) || {};
        const en = root.getAttribute('data-lang') === 'en';
        const m = pvPanel();
        m.style.setProperty('--gal', g.color || 'var(--brand)');
        m.querySelector('.nsft-pvm-ic').innerHTML = tool.icon || g.icon || '';
        m.querySelector('.nsft-pvm-ti small').textContent = en ? g.nameEn : g.nameEs;
        m.querySelector('.nsft-pvm-ti b').textContent = en ? tool.nameEn : tool.nameEs;
        m.querySelector('.nsft-pvm-desc').textContent = en ? tool.descEn : tool.descEs;
        const nota = tool.pvNota && tool.pvNota[en ? 'en' : 'es'];
        const notaEl = m.querySelector('.nsft-pvm-nota');
        notaEl.textContent = nota || '';
        notaEl.hidden = !nota;
        const stage = m.querySelector('.nsft-pvm-stage');
        stage.setAttribute('data-pv', tool.pv || '');
        stage.innerHTML = '<div class="nsft-gal-skel"></div>';
        stage.hidden = !tool.pv;
        if (!tool.pv) return;
        pvCargaCss();
        const lang = en ? 'en' : 'es';
        pvCargaIdioma(lang).then(() => { if (pvLista[pvIdx] === tool) pvPinta(stage, true); });
    }
    function pvAbre(nombreEs) {
        const visibles = [...listEl.querySelectorAll('.nsft-tc')].map((b) => b.getAttribute('data-tool'));
        pvLista = visibles.map((n) => catalog.tools.find((t) => t.nameEs === n)).filter(Boolean);
        const m = pvPanel();
        pvVolver = document.activeElement;
        m.hidden = false;
        document.documentElement.classList.add('nsft-pvm-open');
        pvMuestra(Math.max(0, pvLista.findIndex((t) => t.nameEs === nombreEs)));
        m.querySelector('.nsft-pvm-x').focus();
    }
    function pvCierra() {
        const m = document.getElementById('nsft-pvm');
        if (!m) return;
        m.hidden = true;
        document.documentElement.classList.remove('nsft-pvm-open');
        if (pvVolver && pvVolver.focus) pvVolver.focus();
    }
    if (listEl) {
        listEl.addEventListener('click', (ev) => {
            const ficha = ev.target.closest('.nsft-tc');
            if (ficha) pvAbre(ficha.getAttribute('data-tool'));
        });
    }

    /* Repetir y animar: un solo escuchador para todo el catálogo, que las fichas
       se repintan enteras a cada filtro y a cada tecla del buscador. */
    if (listEl) {
        listEl.addEventListener('click', (ev) => {
            const repetir = ev.target.closest('[data-pv-replay]');
            if (repetir) pvPinta(repetir.closest('[data-pv]'), true);
        });

        /* LA ANIMACIÓN CORRE AL PASAR EL RATÓN POR LA FICHA. Se usa `mouseover`
           y no `mouseenter` porque hace falta que burbujee para escucharlo una
           sola vez aquí arriba; recordar cuál era la última ficha es lo que
           evita que se reproduzca otra vez al moverse por dentro de ella —el
           `mouseover` salta con cada hijo que se pisa—. Al salir al hueco entre
           fichas, `closest` devuelve null y la siguiente vez vuelve a correr. */
        let _ultima = null;
        listEl.addEventListener('mouseover', (ev) => {
            const ficha = ev.target.closest('.nsft-gal-card');
            if (ficha === _ultima) return;
            _ultima = ficha;
            if (!ficha) return;
            const stage = ficha.querySelector('[data-pv]');
            /* Sólo si el dibujo ya está puesto: si aún no ha llegado su turno,
               lo pondrá el observador —quieto— y el siguiente hover lo animará. */
            if (stage && stage.firstChild) pvPinta(stage, true);
        });
    }

    /**
     * Trae los dibujos del idioma activo y los pinta.
     * Al cambiar de idioma hay que traer SU paquete —los dibujos llevan dentro
     * los muebles de NetSuite traducidos— y volver a observar desde cero:
     * observar un elemento que ya lo estaba no dispara nada, y las fichas que
     * están a la vista tienen que repintarse.
     */
    function pvAsegura() {
        pvCargaCss();
        const lang = root.getAttribute('data-lang') === 'en' ? 'en' : 'es';
        if (pvPaquetes[lang]) { pvObserva(); return; }
        pvCargaIdioma(lang).then(() => {
            if (pvObs) pvObs.disconnect();
            pvObserva();
        });
    }

    /** Arranca al acercarse el catálogo: antes no se pide nada. */
    function pvArranca() {
        const seccion = document.getElementById('catalogo');
        if (!seccion) return;
        if (!('IntersectionObserver' in window)) return pvAsegura();
        const obs = new IntersectionObserver((entries) => {
            if (!entries.some((e) => e.isIntersecting)) return;
            obs.disconnect();
            pvAsegura();
        }, { rootMargin: '600px 0px' });
        obs.observe(seccion);
    }
    /* ------------------------------------------------------------------ *
     * Contador de herramientas de la cabecera
     * ------------------------------------------------------------------ */
    function countUp(el) {
        const target = parseInt(el.getAttribute('data-total'), 10) || 0;
        if (!target) return;
        if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
            el.textContent = target;
            return;
        }
        let i = 0;
        const timer = setInterval(() => {
            i += Math.max(1, Math.round((target - i) / 6));
            if (i >= target) { i = target; clearInterval(timer); }
            el.textContent = i;
        }, 45);
    }

    /* ------------------------------------------------------------------ *
     * Entradas al hacer scroll
     *
     * Sustituye a GSAP + ScrollTrigger + Lenis del prototipo: un
     * IntersectionObserver y transiciones CSS hacen lo mismo sin traerse
     * 250 KB de librerías a una página estática.
     * ------------------------------------------------------------------ */
    let io = null;

    function wireReveals() {
        if (!('IntersectionObserver' in window)) {
            document.querySelectorAll('[data-anim]').forEach((el) => el.classList.add('is-in'));
            return;
        }
        io = new IntersectionObserver((entries) => {
            // Los que entran en el mismo frame se escalonan: un grupo de
            // tarjetas aparece en cascada en vez de todas de golpe.
            const hits = entries.filter((e) => e.isIntersecting);
            hits.forEach((e, i) => {
                e.target.style.transitionDelay = `${Math.min(i, 8) * 70}ms`;
                e.target.classList.add('is-in');
                io.unobserve(e.target);
            });
        }, { rootMargin: '0px 0px -22% 0px' });
        observe(document);
    }

    // Sirve también para lo que pinta el JS después (el catálogo).
    function observe(scope) {
        scope.querySelectorAll('[data-anim]:not(.is-in)').forEach((el) => {
            if (io) io.observe(el);
            else el.classList.add('is-in');
        });
    }

    // El hero entra escalonado nada más cargar, sin esperar al scroll.
    function wireHero() {
        document.querySelectorAll('[data-hero-el]').forEach((el, i) => {
            el.style.animationDelay = `${i * 0.09}s`;
        });
    }

    /* ------------------------------------------------------------------ *
     * Barra de progreso y parallax
     *
     * Un único listener de scroll pasivo alimenta las dos cosas dentro del
     * mismo frame: nada de librerías ni de un rAF por efecto.
     * ------------------------------------------------------------------ */
    const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    function wireScroll() {
        const bar = document.getElementById('nsft-progress-bar');
        const layers = reduced ? [] : [...document.querySelectorAll('[data-parallax]')].map((el) => ({
            el,
            speed: parseFloat(el.getAttribute('data-parallax')) || 0,
            top: 0,
            h: 0
        }));
        if (!bar && !layers.length) return;

        let ticking = false;

        // La posición de reposo se mide UNA vez, sin transform aplicado: si se
        // leyera el rect en cada frame, el propio desplazamiento se realimentaría.
        const measure = () => {
            const y = window.pageYOffset;
            layers.forEach((l) => {
                l.el.style.transform = '';
                const r = l.el.getBoundingClientRect();
                l.top = r.top + y;
                l.h = r.height;
            });
        };

        const update = () => {
            ticking = false;
            const y = window.pageYOffset;
            const vh = window.innerHeight;

            if (bar) {
                const total = html.scrollHeight - html.clientHeight;
                bar.style.transform = `scaleX(${total > 0 ? Math.min(1, y / total) : 0})`;
            }

            layers.forEach((l) => {
                // Solo se mueve lo que está cerca del viewport.
                if (l.top + l.h < y - 300 || l.top > y + vh + 300) return;
                // Distancia al centro de la pantalla: 0 cuando la capa está
                // centrada, así el desplazamiento reparte hacia ambos lados.
                const center = (l.top + l.h / 2) - (y + vh / 2);
                l.el.style.transform = `translate3d(0, ${(-center * l.speed).toFixed(1)}px, 0)`;
            });
        };

        addEventListener('scroll', () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(update);
        }, { passive: true });
        addEventListener('resize', () => { measure(); update(); }, { passive: true });

        measure();
        update();
    }


    /* ------------------------------------------------------------------ *
     * Rediseño 2026-11-12: efectos de irodoriciel.dev y japan-pulse.com
     * con las piezas y colores del popup.
     *   · luz que sigue al puntero, botones magnéticos y tarjetas que se
     *     inclinan con un brillo bajo el ratón;
     *   · la línea que se escribe sola, la réplica animada del popup, las
     *     baldosas de categoría que flotan y la cinta de herramientas.
     * Nada de esto corre con «reducir movimiento».
     * ------------------------------------------------------------------ */
    /* Sin tarjeta gráfica (Chrome dibujando por software: «Basic Render
       Driver», SwiftShader, llvmpipe) los efectos pesados hacen la página
       torpe. Se detecta una vez y se apagan con la clase nsft-lite. */
    (function () {
        try {
            const gl = document.createElement('canvas').getContext('webgl');
            const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
            const r = gl ? String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : 'none';
            if (!gl || /basic render|swiftshader|llvmpipe|software/i.test(r)) html.classList.add('nsft-lite');
        } catch (e) { /* sin WebGL: se queda como está */ }
    })();
    const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const FINE = matchMedia('(pointer: fine)').matches;
    const CAT = (window.NSFT_CATALOG || { groups: [], tools: [] });
    const lang = () => root.getAttribute('data-lang') === 'en' ? 'en' : 'es';
    const nameOf = (t) => (lang() === 'en' ? (t.nameEn || t.name || t.nameEs) : (t.nameEs || t.name || t.nameEn)) || '';
    const groupOf = (id) => CAT.groups.find((g) => g.id === id) || { color: 'var(--brand)' };
    const toolGroup = (t) => t.group || t.cat || t.g;

    // Clases de efecto sobre lo que ya existe (y lo que se pinte después).
    function tagFx() {
        document.querySelectorAll('.nsft-btn:not(.nsft-btn-soon), .nsft-coffee-btn, .nsft-form').forEach((b) => b.classList.add('nsft-fx'));
        document.querySelectorAll('.nsft-coffee-btn').forEach((b) => b.classList.add('is-gold'));
        document.querySelectorAll('section [data-anim] a[target="_blank"][style*="padding:16px"]').forEach((b) => b.classList.add('nsft-fx', 'is-light'));
        document.querySelectorAll('.nsft-role, .nsft-gal-card, .nsft-pop-card').forEach((c) => c.classList.add('nsft-spot', 'nsft-tilt'));
    }

    function wireFx() {
        tagFx();
        new MutationObserver(tagFx).observe(document.getElementById('nsft-catalog') || root, { childList: true, subtree: true });
        if (!FINE || REDUCE) return;

    }

    // La línea que se escribe sola: nombres de herramientas, con el color de su categoría.
    function wireTyped() {
        const el = document.getElementById('nsft-typed');
        if (!el || !CAT.tools.length) return;
        const pick = CAT.tools.filter((t) => nameOf(t).length <= 34);
        let i = 0;
        const next = () => {
            const t = pick[(i++ * 7) % pick.length];
            el.parentNode.style.setProperty('--tc', groupOf(toolGroup(t)).color);
            return nameOf(t);
        };
        if (REDUCE) { el.textContent = next(); return; }
        let word = next(), n = 0, dir = 1;
        (function tick() {
            n += dir;
            el.textContent = word.slice(0, n);
            if (dir > 0 && n >= word.length) { dir = -1; return setTimeout(tick, 1500); }
            if (dir < 0 && n <= 0) { dir = 1; word = next(); return setTimeout(tick, 250); }
            setTimeout(tick, dir > 0 ? 55 : 28);
        })();
    }

    // Réplica del popup: tarjetas por categoría que se iluminan una tras otra
    // mientras el buscador «escribe» el nombre de la categoría.
    function wirePopup() {
        const grid = document.getElementById('nsft-pop-grid');
        const pop = document.getElementById('nsft-pop');
        const q = document.getElementById('nsft-pop-q');
        if (!grid || !CAT.groups.length) return;
        const count = (id) => CAT.tools.filter((t) => toolGroup(t) === id).length;
        const groups = CAT.groups.slice(0, 9);
        const TODOS_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect></svg>';
        const paint = () => {
            const todos = { id: 'all', color: '#2F7D5A', nameEs: 'Todos', nameEn: 'All', icon: TODOS_ICON };
            grid.innerHTML = [todos].concat(groups).map((g, k) => {
                const n = g.id === 'all' ? CAT.tools.length : count(g.id);
                return `<div class="nsft-pop-card" data-g="${g.id}" style="--c:${g.color};transition-delay:${(k * 0.06).toFixed(2)}s"><span class="ic">${g.icon}</span><div><b>${(lang() === 'en' ? g.nameEn : g.nameEs).split(' / ')[0]}</b><em>${n}<span> / ${n}</span></em></div></div>`;
            }).join('');
            tagFx();
        };
        paint();
        new MutationObserver(paint).observe(root, { attributes: true, attributeFilter: ['data-lang'] });
        const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) pop.classList.add('is-in'); }), { threshold: 0.2 });
        io.observe(pop);
        if (REDUCE || !q) return;
        let k = 0;
        (function cycle() {
            const g = groups[k++ % groups.length];
            const word = (lang() === 'en' ? g.nameEn : g.nameEs).split(/[ /]/)[0].toLowerCase();
            let n = 0;
            grid.querySelectorAll('.nsft-pop-card').forEach((c) => c.classList.remove('is-hit', 'is-dim'));
            (function type() {
                q.textContent = word.slice(0, ++n);
                if (n < word.length) return setTimeout(type, 90);
                grid.querySelectorAll('.nsft-pop-card').forEach((c) => c.classList.toggle(c.dataset.g === g.id ? 'is-hit' : 'is-dim', true));
                setTimeout(() => { q.textContent = ''; cycle(); }, 1700);
            })();
        })();
    }

    // Baldosas de categoría flotando alrededor del popup.
    function wireFloat() {
        const box = document.getElementById('nsft-float');
        if (!box || !CAT.groups.length) return;
        const spots = [[-2, 6, 62, -8], [86, -2, 52, 9], [92, 44, 58, -6], [-6, 58, 48, 7], [8, 92, 44, -10], [80, 88, 54, 6]];
        box.innerHTML = spots.map(([x, y, s, r], k) => {
            const g = CAT.groups[(k + 1) % CAT.groups.length];
            return `<span class="nsft-tile" style="left:${x}%;top:${y}%;--s:${s}px;--r:${r}deg;--c:${g.color};--d:${5 + k}s;--dl:-${k * 0.7}s">${g.icon}</span>`;
        }).join('');
    }

    // Una herramienta cada vez, al azar, con el color de su categoría.
    function wireTicker() {
        const slot = document.getElementById('nsft-rot'), cat = document.getElementById('nsft-rot-cat');
        if (!slot || !CAT.tools.length) return;
        // Barajado sin repetir hasta haber pasado por todas.
        let bolsa = [];
        const saca = () => {
            if (!bolsa.length) {
                bolsa = CAT.tools.slice();
                for (let i = bolsa.length - 1; i > 0; i--) { const r = Math.floor(Math.random() * (i + 1)); [bolsa[i], bolsa[r]] = [bolsa[r], bolsa[i]]; }
            }
            return bolsa.pop();
        };
        const muestra = () => {
            const t = saca(), g = groupOf(toolGroup(t));
            const el = document.createElement('span');
            el.className = 'nsft-rot-item';
            el.style.setProperty('--c', g.color);
            el.innerHTML = '<i></i>' + nameOf(t).replace(/[<&]/g, (c) => c === '<' ? '&lt;' : '&amp;');
            const viejo = slot.querySelector('.nsft-rot-item:not(.is-out)');
            if (viejo) { viejo.classList.add('is-out'); setTimeout(() => viejo.remove(), 450); }
            slot.appendChild(el);
            cat.style.setProperty('--c', g.color);
            cat.textContent = lang() === 'en' ? g.nameEn : g.nameEs;
        };
        muestra();
        if (REDUCE) return;
        let pausa = false;
        slot.parentNode.addEventListener('mouseenter', () => { pausa = true; });
        slot.parentNode.addEventListener('mouseleave', () => { pausa = false; });
        setInterval(() => { if (!pausa && !document.hidden) muestra(); }, 2200);
    }


    // Más animaciones: cabecera, menú, enlaces, títulos, píldoras, cascada y aro del puntero.
    function wireFx2() {
        const hero = document.querySelector('.nsft-hero');
        if (hero && 'IntersectionObserver' in window) {
            new IntersectionObserver((es) => es.forEach((e) => hero.classList.toggle('is-off', !e.isIntersecting))).observe(hero);
        }
        const hdr = root.querySelector(':scope > header');
        const nav = hdr && hdr.querySelector('nav');
        if (hdr) {
            hdr.classList.add('nsft-hdr');
            const onScroll = () => hdr.classList.toggle('is-scrolled', scrollY > 12);
            addEventListener('scroll', onScroll, { passive: true });
            onScroll();
            hdr.querySelectorAll('button[data-act], a[aria-label="GitHub"]').forEach((b) => b.classList.add('nsft-ibtn'));
            const cta = hdr.querySelector('a[href*="chromewebstore"]');
            if (cta) cta.classList.add('nsft-fx');
        }
        if (nav) nav.classList.add('nsft-nav');
        // Subrayado que se dibuja en los enlaces de texto.
        root.querySelectorAll('footer a, #faq a, .nsft-hero-lead a, section p a').forEach((a) => {
            if (!a.classList.contains('nsft-fx') && !a.classList.contains('nsft-irodev') && !a.querySelector('img')) a.classList.add('nsft-ul');
        });

        // Títulos que entran palabra a palabra.
        const splitWords = (el) => {
            if (el.dataset.split) return;
            el.dataset.split = 1;
            let i = 0;
            const walk = (node) => {
                [...node.childNodes].forEach((n) => {
                    if (n.nodeType === 3) {
                        const frag = document.createDocumentFragment();
                        n.textContent.split(/(\s+)/).forEach((w) => {
                            if (!w) return;
                            if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
                            const s = document.createElement('span');
                            s.className = 'nsft-w';
                            s.style.setProperty('--i', i++);
                            s.textContent = w;
                            frag.appendChild(s);
                        });
                        n.replaceWith(frag);
                    } else if (n.nodeType === 1 && !n.classList.contains('nsft-hero-title-grad')) {
                        walk(n);
                    } else if (n.nodeType === 1) {
                        // El trozo con degradado entra entero, como una palabra más.
                        n.classList.add('nsft-w');
                        n.style.setProperty('--i', i++);
                    }
                });
            };
            walk(el);
            el.classList.add('nsft-split');
        };
        const titles = [...root.querySelectorAll('h1, h2')].filter((h) => !h.closest('.nsft-pop'));
        titles.forEach(splitWords);
        const shine = [...root.querySelectorAll('.nsft-eyebrow')];
        if (REDUCE || !('IntersectionObserver' in window)) {
            titles.forEach((t) => t.classList.add('is-shown'));
        } else {
            const io = new IntersectionObserver((es) => es.forEach((e) => {
                if (!e.isIntersecting) return;
                e.target.classList.add(e.target.classList.contains('nsft-eyebrow') ? 'is-shine' : 'is-shown');
                io.unobserve(e.target);
            }), { threshold: 0, rootMargin: '0px 0px -28% 0px' });
            titles.concat(shine).forEach((el) => io.observe(el));
        }

        // Cascada: los hermanos de una rejilla aparecen uno tras otro.
        root.querySelectorAll('[data-anim]').forEach((el) => {
            const sibs = [...el.parentNode.children].filter((c) => c.hasAttribute('data-anim'));
            const k = sibs.indexOf(el);
            if (sibs.length > 1 && k > 0 && !el.style.transitionDelay) el.style.transitionDelay = Math.min(k * 90, 450) + 'ms';
        });

        // Las cifras saltan al terminar de contar.
        const total = document.getElementById('nsft-total');
        if (total) {
            const fin = total.dataset.total;
            const mo = new MutationObserver(() => {
                if (total.textContent === fin) { total.closest('.nsft-stat-num').classList.add('is-done'); mo.disconnect(); }
            });
            mo.observe(total, { childList: true, characterData: true, subtree: true });
        }

        // Sin nada que siga al puntero (2026-11-12): se probaron un halo, un aro
        // y varias estelas, y el ratón normal es lo que mejor queda.
    }

    /* ------------------------------------------------------------------ *
     * Arranque
     * ------------------------------------------------------------------ */
    wireReveals();

    // Preferencia guardada > idioma del navegador > español.
    const navLang = (navigator.language || 'es').toLowerCase();
    // La dirección manda (/en/ = inglés); en la portada sin idioma en la ruta,
    // la preferencia guardada y luego el idioma del navegador.
    setLang((/^\/en(\/|$)/.test(location.pathname) && 'en') || read(LANG_KEY) || (navLang.startsWith('es') ? 'es' : 'en'));

    // El tema ya lo estampó el script de arranque del <head> para evitar el
    // parpadeo; aquí solo se replica en el contenedor.
    root.setAttribute('data-theme', html.getAttribute('data-theme') || 'light');
    // …y en el atributo del que cuelga el modo oscuro de los dibujos.
    html.setAttribute('data-nsft-theme', html.getAttribute('data-theme') || 'light');

    wireHero();
    wireScroll();
    wireFx();
    wirePopup();
    wireFloat();
    wireTicker();
    wireFx2();

    const totalEl = document.getElementById('nsft-total');
    if (totalEl) countUp(totalEl);
})();
