/* Jelly+ for Jellyfin Web 12.2, desktop/mobile and TV layout. */
(function () {
    'use strict';
    if (window.__jellyplus) return;
    window.__jellyplus = true;
    var settings = null, user = null, pendingMenu = null, refreshing = false;
    var seasonKey = '', seasonLoading = false, observerQueued = false;
    var seasonRetryAt = 0, hiddenKey = '', hiddenLoading = false, hiddenResolved = [];
    var settingsRetryAt = 0, effectsRetryAt = 0;
    var connected = function (node) { return node && document.documentElement.contains(node); };
    var api = function () {
        return window.ApiClient || (window.connectionManager && typeof window.connectionManager.currentApiClient === 'function'
            ? window.connectionManager.currentApiClient() : null);
    };
    var idKey = function (id) { return String(id || '').replace(/-/g, '').toLowerCase(); };
    var normalize = function (value) {
        if (Array.isArray(value)) return value.map(normalize);
        if (value && typeof value === 'object') {
            var output = {};
            Object.keys(value).forEach(function (key) { output[key.charAt(0).toLowerCase() + key.slice(1)] = normalize(value[key]); });
            return output;
        }
        return value;
    };
    async function request(path, method, body) {
        var current = api();
        if (!current || !current.getCurrentUserId()) throw new Error('Bitte zuerst anmelden.');
        var response = await fetch(current.getUrl('Jellyplus/' + path), {
            method: method || 'GET',
            headers: {
                Authorization: 'MediaBrowser Client="Jellyplus", Device="Web", DeviceId="' + (current.deviceId ? current.deviceId() : 'jellyplus-web') + '", Version="0.1.2", Token="' + current.accessToken() + '"',
                'Content-Type': 'application/json'
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            cache: 'no-store'
        });
        var result = normalize(await response.json().catch(function () { return {}; }));
        if (!response.ok) throw new Error(result.message || ('Jelly+: Anfrage fehlgeschlagen (' + response.status + ').'));
        return result;
    }
    function element(tag, text, className) {
        var node = document.createElement(tag);
        if (text) node.textContent = text;
        if (className) node.className = className;
        return node;
    }
    function button(text, action) {
        var node = element('button', text, 'emby-button raised jp-button');
        node.type = 'button';
        node.addEventListener('click', function (e) {
            e.preventDefault(); e.stopPropagation();
            Promise.resolve().then(action).catch(showError);
        });
        return node;
    }
    function choose(title, description, choices) {
        return new Promise(function (resolve) {
            var previous = document.activeElement;
            var overlay = element('div', '', 'jp-overlay');
            var panel = element('div', '', 'jp-dialog');
            panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
            panel.setAttribute('aria-label', title);
            panel.appendChild(element('h2', title));
            if (description) panel.appendChild(element('p', description));
            function close(value) {
                document.removeEventListener('keydown', keys, true);
                overlay.remove();
                if (connected(previous)) previous.focus();
                resolve(value);
            }
            choices.concat([{ label: 'Schließen', value: null }]).forEach(function (choice) {
                panel.appendChild(button(choice.label, function () { close(choice.value); }));
            });
            function keys(e) {
                var buttons = Array.prototype.slice.call(panel.querySelectorAll('button'));
                var index = buttons.indexOf(document.activeElement);
                if (e.key === 'Escape' || e.key === 'BrowserBack' || e.keyCode === 461) { e.preventDefault(); e.stopImmediatePropagation(); close(null); }
                else if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Tab'].indexOf(e.key) >= 0) {
                    e.preventDefault(); e.stopImmediatePropagation();
                    var delta = e.key === 'ArrowUp' || e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey) ? -1 : 1;
                    buttons[(index + delta + buttons.length) % buttons.length].focus();
                }
            }
            document.addEventListener('keydown', keys, true);
            overlay.appendChild(panel); document.body.appendChild(overlay);
            panel.querySelector('button').focus();
        });
    }
    function showError(error) { return choose('Jelly+', error.message || String(error), []); }
    function details(id) {
        window.location.hash = '#/details?id=' + encodeURIComponent(id) + '&serverId=' + encodeURIComponent(api().serverId());
    }
    async function refresh() {
        if (refreshing) return;
        var current = api();
        var nextUser = current && current.getCurrentUserId();
        if (nextUser === user && Date.now() < settingsRetryAt) return;
        if (!nextUser) { settings = null; user = null; seasonKey = ''; document.querySelectorAll('.jp-owned').forEach(function (n) { n.remove(); }); return; }
        if (user !== nextUser) {
            settings = null; seasonKey = ''; seasonRetryAt = 0; hiddenKey = ''; pendingMenu = null;
            document.querySelectorAll('.jp-owned').forEach(function (n) { n.remove(); });
        }
        user = nextUser;
        refreshing = true;
        settingsRetryAt = Date.now() + 1000;
        try {
            var loaded = await request('Settings');
            if (api().getCurrentUserId() === nextUser) settings = loaded;
            if (settings && !settings.enabled) document.querySelectorAll('.jp-watch').forEach(function (n) { n.remove(); });
            if (settings && !settings.seasonalRecommendations) document.querySelectorAll('.jp-season').forEach(function (n) { n.remove(); });
        } catch (error) { settings = null; settingsRetryAt = Date.now() + 5000; console.warn('[Jelly+]', error); }
        finally { refreshing = false; schedule(); }
    }
    function summary(list) {
        var watched = list.filter(function (p) { return p.played; }).length;
        var started = list.filter(function (p) { return p.position > 0 && !p.played; });
        return watched + ' gesehen, ' + started.length + ' begonnen' + (list.length === 1 ? ', Position ' + Math.floor(list[0].position / 600000000) + ' Min.' : '');
    }
    async function watch(item) {
        if (!settings.enabled) {
            await choose('Watch Together', 'Aktiviere Watch Together zuerst unter Profil → Wiedergabe.', []);
            return;
        }
        var profiles = await request('Profiles/' + item);
        var selected = await choose('Watch Together', 'Profil auswählen. Beide Profile müssen die Funktion aktiviert haben.', profiles.map(function (p) {
            return { label: p.username + (p.linked ? ' · verknüpft' : ''), value: p };
        }));
        if (!selected) return;
        if (selected.linked) {
            var remove = await choose('Verknüpfung mit ' + selected.username, 'Bereits übertragener Fortschritt bleibt erhalten. Weitere Verknüpfungen können die Profile weiterhin verbinden.', [{ label: 'Verknüpfung entfernen', value: true }]);
            if (remove) await request('Links/' + item + '/' + selected.id, 'DELETE');
            return;
        }
        var preview = await request('Links/' + item + '/Preview/' + selected.id);
        var explanation = preview.conflict ? 'Die Fortschritte unterscheiden sich. Welcher soll übernommen werden?' : 'Welcher Fortschritt soll als Ausgangspunkt dienen?';
        if (preview.members > 2) explanation += ' Die Auswahl gilt für alle ' + preview.members + ' verbundenen Profile.';
        var source = await choose('Fortschritt übernehmen', explanation, [
            { label: 'Mein Profil: ' + summary(preview.yours), value: user },
            { label: selected.username + ': ' + summary(preview.theirs), value: selected.id }
        ]);
        if (!source) return;
        await request('Links/' + item, 'POST', { other: selected.id, source: source, revision: preview.revision });
        await choose('Watch Together', 'Die Profile sind verknüpft. Fortschritt wird ab jetzt in beide Richtungen geteilt.', []);
    }
    async function hide(item) {
        await request('Hidden/' + item, 'POST');
        hiddenKey = ''; settingsRetryAt = 0;
        await refresh();
        await applyHidden();
    }
    async function restore() {
        var items = await request('Hidden');
        var selected = await choose('Ausgeblendete Medien', 'Serie oder Film wieder auf der Startseite zulassen.', items.map(function (i) { return { label: i.name, value: i.id }; }));
        if (selected) { await request('Hidden/' + selected, 'DELETE'); hiddenKey = ''; settingsRetryAt = 0; await refresh(); await applyHidden(); }
    }
    async function applyHidden() {
        if (!settings || hiddenLoading) return;
        var cards = Array.prototype.slice.call(document.querySelectorAll(
            '.homePage .itemsContainer[data-monitor*="videoplayback"] [data-id][data-type], #homeTab .itemsContainer[data-monitor*="videoplayback"] [data-id][data-type]'));
        if (!settings.hidden.length) {
            cards.forEach(function (card) { card.classList.remove('jp-hidden'); });
            hiddenKey = '';
            return;
        }
        var ids = cards.map(function (card) { return card.getAttribute('data-id'); });
        var key = user + ':' + settings.hidden.join(',') + ':' + ids.join(',');
        if (!ids.length) return;
        if (key === hiddenKey) { paintHidden(cards, hiddenResolved); return; }
        var requestUser = user;
        hiddenLoading = true;
        try {
            var hidden = [];
            for (var start = 0; start < ids.length; start += 200) {
                hidden = hidden.concat(await request('Hidden/Resolve', 'POST', ids.slice(start, start + 200)));
            }
            if (user !== requestUser || api().getCurrentUserId() !== requestUser) return;
            hiddenResolved = hidden.map(idKey);
            paintHidden(cards, hiddenResolved);
            hiddenKey = key;
        } catch (error) { console.warn('[Jelly+] Ausblenden:', error); }
        finally { hiddenLoading = false; }
    }
    function paintHidden(cards, keys) {
        cards.forEach(function (card) {
                var remove = keys.indexOf(idKey(card.getAttribute('data-id'))) >= 0;
                if (remove && card.contains(document.activeElement)) {
                    var next = cards.find(function (c) { return keys.indexOf(idKey(c.getAttribute('data-id'))) < 0; });
                    var focus = next && next.querySelector('a,button,[tabindex]');
                    if (focus) focus.focus();
                    else { var home = document.querySelector('.headerHomeButton'); if (home) home.focus(); }
                }
                card.classList.toggle('jp-hidden', remove);
        });
    }
    function preferences() {
        var container = document.querySelector('#languagePreferencesPage .settingsContainer, #languagePreferencesPage form, [data-jellyplus-playback-settings]');
        if (!container || container.querySelector('.jp-preferences')) return;
        var section = element('section', '', 'jp-preferences jp-owned');
        section.appendChild(element('h2', 'Jelly+'));
        var label = element('label', '', 'jp-toggle');
        var toggle = document.createElement('input'); toggle.type = 'checkbox'; toggle.checked = settings.enabled;
        label.appendChild(toggle); label.appendChild(document.createTextNode(' Watch Together'));
        toggle.addEventListener('change', async function () {
            toggle.disabled = true;
            try { await request('Preferences', 'PUT', { enabled: toggle.checked }); settingsRetryAt = 0; await refresh(); }
            catch (error) { toggle.checked = !toggle.checked; showError(error); }
            finally { toggle.disabled = false; }
        });
        section.appendChild(label);
        section.appendChild(element('p', 'Andere freigegebene Profile können dich pro Film oder Serie verknüpfen. Ausschalten entfernt deine Verknüpfungen.'));
        section.appendChild(button('Ausgeblendete Medien verwalten', restore));
        container.appendChild(section);
    }
    function placeSeasonal(home, section) {
        // Desktop links explicitly identify the latest feed; TV renders nested
        // library sections inside the same section slot, without those links.
        var link = home.querySelector('a[href*="section=latest"], a[href*="section%3Dlatest"], a[href*="/latest"]');
        var latest = link;
        while (latest && latest.parentNode !== home) latest = latest.parentElement;
        if (!latest) {
            latest = Array.prototype.find.call(home.children, function (slot) {
                return slot !== section && (slot.matches('[data-section="latest"], [data-section="latestmedia"]')
                    || (!slot.classList.contains('verticalSection') && slot.querySelector('.verticalSection .itemsContainer:not([data-monitor])')));
            });
        }
        // Without a latest feed, preserve the user's preceding home sections.
        if (latest) {
            if (section.nextElementSibling !== latest) home.insertBefore(section, latest);
        } else if (section.parentNode !== home) home.appendChild(section);
    }
    function loadSeasonalEffects() {
        var root = document.documentElement;
        if (!root.matches('.layout-desktop, .layout-mobile') || root.classList.contains('layout-tv')
            || window.ElegantFinSeasonal || document.querySelector('#jp-seasonal-effects') || Date.now() < effectsRetryAt) return;
        var source = 'https://cdn.jsdelivr.net/gh/S3NTIN3LOne/jellyfin-elegantfin-tv@v0.1.13/desktop/ElegantFin-seasonal.js';
        if (Array.prototype.some.call(document.scripts, function (script) { return script.src === source; })) return;
        // The local theme already supplies the CSS. This is the opt-out marker
        // understood by ElegantFin-seasonal.js; it has no URL and loads no CSS.
        if (!document.querySelector('link[data-ef-seasonal-css]')) {
            var marker = document.createElement('link');
            marker.setAttribute('data-ef-seasonal-css', '');
            marker.setAttribute('data-jp-theme-css', '');
            document.head.appendChild(marker);
        }
        var script = document.createElement('script');
        script.id = 'jp-seasonal-effects'; script.src = source; script.async = true;
        script.onerror = function () { script.remove(); effectsRetryAt = Date.now() + 60000; console.warn('[Jelly+] Seasonal effects could not be loaded.'); };
        document.head.appendChild(script);
    }
    function captureMenu(target) {
        var card = target && target.closest && target.closest('[data-id][data-type]');
        var id = card && card.getAttribute('data-id');
        var type = card && card.getAttribute('data-type');
        if (!id) {
            var route = window.location.hash;
            var match = /[?&]id=([a-f0-9-]+)/i.exec(route);
            if (match && /details/i.test(route)) id = match[1];
        }
        if (id && (!type || ['Movie', 'Series', 'Episode'].indexOf(type) >= 0)) pendingMenu = { id: id, at: Date.now() };
        else pendingMenu = null;
    }
    function extendMenu() {
        if (!pendingMenu || Date.now() - pendingMenu.at > 5000) return;
        var content = document.querySelector('.actionSheetContent');
        if (!content || content.querySelector('.jp-menu')) return;
        var nativeItem = content.querySelector('.actionSheetMenuItem');
        if (!nativeItem) return;
        var item = pendingMenu.id;
        var group = element('div', '', 'jp-menu jp-owned');
        function closeNative() {
            pendingMenu = null;
            var dialog = content.closest('[modal], [role="dialog"], .dialog, .focuscontainer');
            var container = content.closest('.dialogContainer');
            if (!dialog) return Promise.resolve();
            return new Promise(function (resolve, reject) {
                var timeout = setTimeout(function () { reject(new Error('Das Medienmenü konnte nicht geschlossen werden.')); }, 3000);
                dialog.addEventListener('close', function () { clearTimeout(timeout); resolve(); }, { once: true });
                var close = dialog.querySelector('.btnCloseActionSheet');
                if (close) close.click();
                else if (container) {
                    container.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    container.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                }
            });
        }
        if (settings.enabled) {
            var watchButton = button('Watch Together', async function () {
                await closeNative();
                if (settings && settings.enabled) return watch(item);
            });
            watchButton.classList.add('jp-watch');
            group.appendChild(watchButton);
        }
        var hidden = settings.hidden.some(function (id) { return idKey(id) === idKey(item); });
        group.appendChild(button(hidden ? 'Auf Startseite wieder anzeigen' : 'Aus „Als nächstes“ und „Weiterschauen“ ausblenden', async function () {
            await closeNative();
            if (hidden) { await request('Hidden/' + item, 'DELETE'); hiddenKey = ''; settingsRetryAt = 0; await refresh(); return applyHidden(); }
            return hide(item);
        }));
        nativeItem.parentNode.appendChild(group);
    }
    async function seasonal() {
        var home = document.querySelector('#homeTab .sections, #homeTab.homeSectionsContainer, .homePage .homeSectionsContainer, .homePage .sections');
        if (!home || !settings.seasonalRecommendations) return;
        var existing = home.querySelector('.jp-season');
        if (existing) { placeSeasonal(home, existing); return; }
        if (seasonLoading) return;
        var key = user + ':' + new Date().toDateString();
        if (Date.now() < seasonRetryAt && seasonKey === key) return;
        var requestUser = user;
        seasonLoading = true;
        try {
            var result = await request('Seasonal');
            if (!connected(home) || api().getCurrentUserId() !== requestUser || !settings || !settings.seasonalRecommendations) return;
            if (!result.items || !result.items.length) { seasonKey = key; seasonRetryAt = Date.now() + 60000; return; }
            var section = element('section', '', 'verticalSection jp-season jp-owned padded-left padded-right');
            section.appendChild(element('h2', result.title, 'sectionTitle'));
            var row = element('div', '', 'jp-posters');
            result.items.forEach(function (item) {
                var card = element('a', '', 'jp-poster');
                card.href = '#/details?id=' + encodeURIComponent(item.id) + '&serverId=' + encodeURIComponent(api().serverId());
                var image = document.createElement('img');
                image.alt = ''; image.loading = 'lazy';
                image.src = api().getUrl('Items/' + item.id + '/Images/Primary', { maxWidth: 300, quality: 85 });
                card.appendChild(image); card.appendChild(element('span', item.name)); row.appendChild(card);
            });
            row.addEventListener('keydown', function (e) {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                var card = e.target.closest('.jp-poster');
                var next = card && (e.key === 'ArrowLeft' ? card.previousElementSibling : card.nextElementSibling);
                if (next) { e.preventDefault(); e.stopPropagation(); next.focus(); next.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
            });
            section.appendChild(row);
            placeSeasonal(home, section);
            seasonKey = ''; seasonRetryAt = 0;
        } catch (error) { console.warn('[Jelly+] Saisonale Empfehlungen:', error); seasonKey = key; seasonRetryAt = Date.now() + 15000; }
        finally { seasonLoading = false; }
    }
    async function shuffle(target) {
        var params = new URLSearchParams(window.location.hash.split('?')[1] || '');
        var parent = params.get('topParentId') || params.get('parentId');
        if (!parent) throw new Error('Diese Bibliotheksansicht wird für Zufällig noch nicht unterstützt.');
        target.disabled = true;
        try {
            var library = await api().getItem(user, parent);
            var types = library.CollectionType === 'tvshows' ? 'Episode' : library.CollectionType === 'music' ? 'Audio' : 'Movie,Video';
            var result = await api().getItems(user, { ParentId: parent, Recursive: true, IncludeItemTypes: types, SortBy: 'Random', Limit: 1, EnableTotalRecordCount: false });
            if (result.Items && result.Items.length) details(result.Items[0].Id);
            else await choose('Zufällig', 'Keine passenden Medien gefunden.', []);
        } finally { target.disabled = false; }
    }
    function schedule() {
        if (observerQueued) return;
        observerQueued = true;
        setTimeout(function () {
            observerQueued = false;
            loadSeasonalEffects();
            if (!api()) return;
            if (!settings || api().getCurrentUserId() !== user) { refresh(); return; }
            preferences(); extendMenu(); seasonal(); applyHidden();
        }, 100);
    }
    function start() {
        var style = element('style');
        style.textContent = '.jp-overlay{position:fixed;inset:0;z-index:100000;background:#000b;display:flex;align-items:center;justify-content:center}.jp-dialog{background:#202020;color:white;max-width:44em;width:85%;max-height:85vh;overflow:auto;padding:2em;border-radius:.6em}.jp-button{display:block;margin:.7em 0;padding:1em;white-space:normal;text-align:left}.jp-button:focus,.jp-poster:focus,.jp-toggle:focus-within{outline:3px solid #00a4dc;outline-offset:3px}.jp-posters{display:flex;gap:1em;overflow-x:auto;padding:.5em .3em 1.5em}.jp-poster{flex:0 0 10em;color:inherit;text-decoration:none}.jp-poster img{width:100%;height:15em;object-fit:cover;border-radius:.4em}.jp-poster span{display:block;margin-top:.5em}.jp-preferences{margin:2em 0}.jp-toggle{display:block;padding:1em 0}.jp-toggle input{width:1.3em;height:1.3em}.jp-menu{padding:.5em 1em}';
        document.head.appendChild(style);
        var hiddenStyle = element('style');
        hiddenStyle.textContent = '.jp-hidden{display:none!important}';
        document.head.appendChild(hiddenStyle);
        document.addEventListener('click', function (e) {
            if (e.target.closest('.jp-owned, .jp-overlay')) return;
            var shuffleButton = e.target.closest('.btnShuffle');
            var candidate = e.target.closest('button');
            if (!shuffleButton && candidate && candidate.querySelector('[data-testid="ShuffleIcon"]')
                && /[?&](topParentId|parentId)=/i.test(window.location.hash)) shuffleButton = candidate;
            if (shuffleButton && settings && settings.shuffleOpensDetails) {
                e.preventDefault(); e.stopImmediatePropagation(); shuffle(shuffleButton).catch(showError); return;
            }
            if (e.target.closest('[data-action="menu"], .btnMoreCommands, .btnMore, .btnCardOptions')) captureMenu(e.target);
        }, true);
        document.addEventListener('contextmenu', function (e) { captureMenu(e.target); }, true);
        document.addEventListener('keydown', function (e) { if (e.keyCode === 457 || e.key === 'ContextMenu') captureMenu(document.activeElement); }, true);
        new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
        window.addEventListener('hashchange', function () { pendingMenu = null; seasonKey = ''; refresh(); });
        window.addEventListener('focus', refresh);
        document.addEventListener('viewshow', function () { refresh(); schedule(); }, true);
        document.addEventListener('pageshow', function () { refresh(); schedule(); }, true);
        var bootstrap = setInterval(function () {
            schedule();
            if (settings) clearInterval(bootstrap);
        }, 1000);
        setInterval(refresh, 15000);
        refresh();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
