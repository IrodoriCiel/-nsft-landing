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
        renderChips();
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
            renderChips();
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
       lista que mantener a mano en la plantilla. */
    function renderChips() {
        const chipsEl = document.getElementById('nsft-chips');
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

    wireHero();
    wireScroll();

    const totalEl = document.getElementById('nsft-total');
    if (totalEl) countUp(totalEl);
})();
