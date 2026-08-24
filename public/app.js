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
        renderChips('nsft-pv-chips');
        renderCatalog();
        renderGallery();
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
            renderChips('nsft-pv-chips');
            renderCatalog();
            renderGallery();
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

    // group.icon es el <svg> del panel equivalente del popup: va tal cual, sin
    // escapar — lo pone build.js desde popup.html, no viene de fuera.
    function card(tool, color, en) {
        return `
        <div style="border:1px solid var(--line);border-left:3px solid ${color};border-radius:12px;background:var(--surface);padding:14px 16px;box-shadow:var(--shadowSm);display:flex;flex-direction:column;gap:5px;">
          <div style="font-size:14.5px;font-weight:700;letter-spacing:-.01em;line-height:1.25;">${esc(en ? tool.nameEn : tool.nameEs)}</div>
          <div style="font-size:12.5px;color:var(--muted);line-height:1.45;">${esc(en ? tool.descEn : tool.descEs)}</div>
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
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:12px;">
          ${items.map((t) => card(t, group.color, en)).join('')}
        </div>
      </div>`;
    }

    /* Los chips salen de los mismos grupos que el catálogo, así que no hay
       lista que mantener a mano en la plantilla. Se pintan en DOS sitios —la
       galería y el catálogo— y los dos escriben el mismo `data-cat`: elegir
       una categoría arriba filtra también la lista de abajo, que es lo que
       espera cualquiera que haya visto una sola taxonomía. */
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
    }

    if (searchEl) {
        searchEl.addEventListener('input', (ev) => {
            query = ev.target.value;
            renderCatalog();
        });
    }

    /* ------------------------------------------------------------------ *
     * Galería de vistas previas
     *
     * Los dibujos son los MISMOS que enseña el asistente de arranque de la
     * extensión: build.js ejecuta welcome_previews.js y deja aquí el resultado,
     * así que la web no tiene maquetas propias que se queden viejas.
     *
     * Tres decisiones que explican todo lo de abajo:
     *
     *   · SE CARGA AL LLEGAR. El CSS de los dibujos y el paquete del idioma
     *     pesan medio mega en crudo; quien no baje hasta aquí no los pide. Se
     *     empiezan a traer un poco antes de que la sección entre en pantalla.
     *   · EL DIBUJO SE INYECTA AL ASOMARSE, no al pintar la tarjeta. Sus
     *     animaciones corren UNA vez al aparecer el elemento: metiéndolos todos
     *     de golpe, las cien se reproducirían con la página aún arriba y el
     *     visitante sólo vería el último fotograma.
     *   · VOLVER A INYECTARLO ES VOLVER A REPRODUCIRLO. De ahí que repetir sea
     *     tan simple como pintar otra vez, sin tocar clases ni reiniciar nada.
     * ------------------------------------------------------------------ */
    const PV = window.NSFT_PV_DATA || [];
    const pvGrid = document.getElementById('nsft-pv-grid');
    const pvCountEl = document.getElementById('nsft-pv-count');
    const pvFallback = document.getElementById('nsft-pv-fallback');

    const PV_T = {
        es: { principal: 'Principal', repetir: 'Repetir la animación' },
        en: { principal: 'Main', repetir: 'Play again' }
    };

    const pvPaquetes = {};      // idioma -> {clave: html}
    let pvCssPedido = false;
    let pvPintada = false;
    let pvObs = null;

    /** El CSS de los dibujos, una sola vez y sólo si hace falta. */
    function pvCargaCss() {
        if (pvCssPedido) return;
        pvCssPedido = true;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'previews.css';
        document.head.appendChild(link);
    }

    /** El paquete de dibujos de un idioma. Se pide una vez por idioma. */
    function pvCargaIdioma(lang) {
        if (pvPaquetes[lang]) return Promise.resolve(pvPaquetes[lang]);
        return new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = 'previews.' + lang + '.js';
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

    function pvPinta(stage) {
        const lang = root.getAttribute('data-lang') === 'en' ? 'en' : 'es';
        const mapa = pvPaquetes[lang];
        const clave = stage.getAttribute('data-pv');
        if (!mapa || !mapa[clave]) return;
        const t = PV_T[lang];
        stage.innerHTML = '<button class="nsft-gal-replay" type="button" data-pv-replay ' +
            'title="' + esc(t.repetir) + '" aria-label="' + esc(t.repetir) + '">&#8635;</button>' +
            mapa[clave];
    }

    /** Observa las tarjetas para inyectar el dibujo cuando asoman. */
    function pvObserva() {
        if (!('IntersectionObserver' in window)) {
            pvGrid.querySelectorAll('[data-pv]').forEach(pvPinta);
            return;
        }
        if (!pvObs) {
            pvObs = new IntersectionObserver((entries) => {
                entries.forEach((e) => { if (e.isIntersecting) pvPinta(e.target); });
            }, { rootMargin: '120px 0px' });
        }
        pvGrid.querySelectorAll('[data-pv]').forEach((el) => pvObs.observe(el));
    }

    function pvTarjeta(ficha, color, en) {
        const idioma = en ? 'en' : 'es';
        const t = PV_T[idioma];
        const textos = ficha[idioma] || ficha.es;
        const variantes = ficha.variantes || [];
        const pestanas = variantes.length
            ? '<div class="nsft-gal-tabs">' +
                '<button type="button" class="nsft-gal-tab is-on" data-pv-tab="' + esc(ficha.key) + '">' + esc(t.principal) + '</button>' +
                variantes.map((v) => '<button type="button" class="nsft-gal-tab" data-pv-tab="' + esc(v.key) + '">' +
                    esc(v[idioma] || v.es) + '</button>').join('') +
              '</div>'
            : '';
        /* El aviso de que una función depende de otra viene del propio
           asistente: si allí se dice, aquí también, que prometer algo que no
           funciona solo es peor que no enseñarlo. */
        const nota = textos.nota
            ? '<div class="nsft-gal-dep"><span aria-hidden="true">!</span>' + esc(textos.nota) + '</div>'
            : '';
        return '<article class="nsft-gal-card" data-anim="up" style="--gal:' + color + ';">' +
            '<div class="nsft-gal-stage" data-pv="' + esc(ficha.key) + '"><div class="nsft-gal-skel"></div></div>' +
            '<div class="nsft-gal-body">' +
              '<div class="nsft-gal-name">' + esc(textos.nombre) + '</div>' +
              '<div class="nsft-gal-desc">' + esc(textos.desc) + '</div>' +
              nota +
              pestanas +
            '</div></article>';
    }

    function renderGallery() {
        if (!pvGrid) return;
        if (!PV.length) {
            if (pvFallback) pvFallback.hidden = false;
            return;
        }
        const en = root.getAttribute('data-lang') === 'en';
        const cat = root.getAttribute('data-cat');
        const colores = {};
        catalog.groups.forEach((g) => { colores[g.id] = g.color; });

        /* Al cambiar de idioma con la galería ya cargada hay que traer SU
           paquete: los dibujos llevan dentro los muebles de NetSuite traducidos.
           Se vuelve a observar desde cero —desconectando primero— porque volver
           a observar un elemento que ya lo estaba no dispara nada, y las
           tarjetas que están a la vista tienen que repintarse. */
        const idioma = en ? 'en' : 'es';
        if (pvCssPedido && !pvPaquetes[idioma]) {
            pvCargaIdioma(idioma).then(() => {
                if (pvObs) pvObs.disconnect();
                pvObserva();
            });
        }

        const fichas = PV.filter((f) => cat === 'all' || f.cat === cat);
        pvGrid.innerHTML = fichas
            .map((f) => pvTarjeta(f, colores[f.cat] || 'var(--brand)', en))
            .join('');
        if (pvCountEl) {
            /* Se cuentan los DIBUJOS, no las tarjetas: las variantes también
               son dibujos y es lo que promete el rótulo de al lado. */
            pvCountEl.textContent = fichas.reduce((n, f) => n + 1 + (f.variantes ? f.variantes.length : 0), 0);
        }

        // Las tarjetas entran con el mismo efecto que el resto de la página;
        // al filtrar ya salen puestas, como hace el catálogo.
        if (pvPintada) {
            pvGrid.querySelectorAll('[data-anim]').forEach((el) => el.classList.add('is-in'));
        } else {
            observe(pvGrid);
            pvPintada = true;
        }
        pvObserva();
    }

    /* Repetir y cambiar de variante: un solo escuchador para toda la rejilla,
       que las tarjetas se repintan enteras a cada filtro. */
    if (pvGrid) {
        pvGrid.addEventListener('click', (ev) => {
            const repetir = ev.target.closest('[data-pv-replay]');
            if (repetir) return pvPinta(repetir.closest('[data-pv]'));

            const pestana = ev.target.closest('[data-pv-tab]');
            if (!pestana) return;
            const tarjeta = pestana.closest('.nsft-gal-card');
            const stage = tarjeta && tarjeta.querySelector('[data-pv]');
            if (!stage) return;
            tarjeta.querySelectorAll('[data-pv-tab]').forEach((b) => b.classList.remove('is-on'));
            pestana.classList.add('is-on');
            stage.setAttribute('data-pv', pestana.getAttribute('data-pv-tab'));
            pvPinta(stage);
        });
    }

    /** Arranca la galería cuando la sección se acerca: antes no se pide nada. */
    function pvArranca() {
        const seccion = document.getElementById('vistazo');
        if (!seccion || !PV.length) { renderGallery(); return; }

        const traer = () => {
            pvCargaCss();
            const lang = root.getAttribute('data-lang') === 'en' ? 'en' : 'es';
            pvCargaIdioma(lang).then((mapa) => {
                if (!mapa && pvFallback) pvFallback.hidden = false;
                renderGallery();
            });
        };

        if (!('IntersectionObserver' in window)) return traer();
        const obs = new IntersectionObserver((entries) => {
            if (!entries.some((e) => e.isIntersecting)) return;
            obs.disconnect();
            traer();
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
