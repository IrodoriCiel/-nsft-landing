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

    function setLang(lang) {
        const l = lang === 'en' ? 'en' : 'es';
        root.setAttribute('data-lang', l);
        html.setAttribute('lang', l);            // también para lectores y buscadores
        const q = document.getElementById('nsft-q');
        if (q) q.placeholder = PLACEHOLDER[l];
        save(LANG_KEY, l);
        renderChips('nsft-chips');
        renderCatalog();
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

        if (kind === 'lang') return setLang(root.getAttribute('data-lang') === 'es' ? 'en' : 'es');
        if (kind === 'theme') return setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
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
    function card(tool, color, en) {
        const idioma = en ? 'en' : 'es';
        const nota = tool.pvNota && tool.pvNota[idioma]
            ? `<div class="nsft-gal-dep"><span aria-hidden="true">!</span>${esc(tool.pvNota[idioma])}</div>`
            : '';
        const stage = tool.pv
            ? `<div class="nsft-gal-stage" data-pv="${esc(tool.pv)}"><div class="nsft-gal-skel"></div></div>`
            : '';
        return `
        <div class="nsft-gal-card" style="--gal:${color};">
          <div class="nsft-gal-body">
            <div class="nsft-gal-name">${esc(en ? tool.nameEn : tool.nameEs)}</div>
            <div class="nsft-gal-desc">${esc(en ? tool.descEn : tool.descEs)}</div>
            ${nota}
          </div>
          ${stage}
        </div>`;
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
        <div class="nsft-gal-grid">
          ${items.map((t) => card(t, group.color, en)).join('')}
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
            if (cat !== 'all' && t.group !== cat) return false;
            if (!needle) return true;
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
        link.href = 'previews.css' + pvSello();
        document.head.appendChild(link);
    }

    /** El paquete de dibujos de un idioma. Se pide una vez por idioma. */
    function pvCargaIdioma(lang) {
        if (pvPaquetes[lang]) return Promise.resolve(pvPaquetes[lang]);
        return new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = 'previews.' + lang + '.js' + pvSello();
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
        stage.innerHTML = '<button class="nsft-gal-replay" type="button" data-pv-replay ' +
            'title="' + esc(t.repetir) + '" aria-label="' + esc(t.repetir) + '">&#8635;</button>' +
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
        dibujo.style.width = '';

        const hueco = stage.clientWidth - PV_AIRE;
        if (!natural || hueco <= 0) return;
        /* El píxel de margen evita que un redondeo encoja un dibujo que ya
           cabía: encoger de menos no se nota, encoger sin necesidad sí. */
        if (natural > hueco + 1) dibujo.style.zoom = (hueco / natural).toFixed(4);
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
        }, { rootMargin: '0px 0px -10% 0px' });
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
     * Arranque
     * ------------------------------------------------------------------ */
    wireReveals();

    // Preferencia guardada > idioma del navegador > español.
    const navLang = (navigator.language || 'es').toLowerCase();
    setLang(read(LANG_KEY) || (navLang.startsWith('es') ? 'es' : 'en'));

    // El tema ya lo estampó el script de arranque del <head> para evitar el
    // parpadeo; aquí solo se replica en el contenedor.
    root.setAttribute('data-theme', html.getAttribute('data-theme') || 'light');
    // …y en el atributo del que cuelga el modo oscuro de los dibujos.
    html.setAttribute('data-nsft-theme', html.getAttribute('data-theme') || 'light');

    wireHero();
    wireScroll();
    pvArranca();

    const totalEl = document.getElementById('nsft-total');
    if (totalEl) countUp(totalEl);
})();
