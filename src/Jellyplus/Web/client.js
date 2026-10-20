/* Jelly+ for Jellyfin Web 12.2 (legacy desktop and TV layout). No external scripts. */
(function () {
    'use strict';
    if (window.__jellyplus) return;
    window.__jellyplus = true;
    var settings = null, user = null, pendingMenu = null, refreshing = false;
    var seasonKey = '', seasonLoading = false, observerQueued = false;
    var api = function () { return window.ApiClient; };
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
                Authorization: 'MediaBrowser Client="Jellyplus", Device="Web", DeviceId="' + (current.deviceId ? current.deviceId() : 'jellyplus-web') + '", Version="0.1.0", Token="' + current.accessToken() + '"',
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
                if (previous && previous.isConnected) previous.focus();
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
        if (!nextUser) { settings = null; user = null; seasonKey = ''; document.querySelectorAll('.jp-owned').forEach(function (n) { n.remove(); }); return; }
        if (user !== nextUser) {
            settings = null; seasonKey = ''; pendingMenu = null;
            document.querySelectorAll('.jp-owned').forEach(function (n) { n.remove(); });
        }
        user = nextUser;
        refreshing = true;
        try {
            var loaded = await request('Settings');
            if (api().getCurrentUserId() === nextUser) settings = loaded;
            if (settings && !settings.seasonalRecommendations) document.querySelectorAll('.jp-season').forEach(function (n) { n.remove(); });
        } catch (error) { settings = null; console.warn('[Jelly+]', error); }
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
        window.location.reload();
    }
    async function restore() {
        var items = await request('Hidden');
        var selected = await choose('Ausgeblendete Medien', 'Serie oder Film wieder auf der Startseite zulassen.', items.map(function (i) { return { label: i.name, value: i.id }; }));
        if (selected) { await request('Hidden/' + selected, 'DELETE'); await refresh(); }
    }
    function preferences() {
        var container = document.querySelector('#languagePreferencesPage .settingsContainer');
        if (!container || container.querySelector('.jp-preferences')) return;
        var section = element('section', '', 'jp-preferences jp-owned');
        section.appendChild(element('h2', 'Jelly+'));
        var label = element('label', '', 'jp-toggle');
        var toggle = document.createElement('input'); toggle.type = 'checkbox'; toggle.checked = settings.enabled;
        label.appendChild(toggle); label.appendChild(document.createTextNode(' Watch Together'));
        toggle.addEventListener('change', async function () {
            toggle.disabled = true;
            try { await request('Preferences', 'PUT', { enabled: toggle.checked }); await refresh(); }
            catch (error) { toggle.checked = !toggle.checked; showError(error); }
            finally { toggle.disabled = false; }
        });
        section.appendChild(label);
        section.appendChild(element('p', 'Andere freigegebene Profile können dich pro Film oder Serie verknüpfen. Ausschalten entfernt deine Verknüpfungen.'));
        section.appendChild(button('Ausgeblendete Medien verwalten', restore));
        container.appendChild(section);
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
        group.appendChild(button('Watch Together', async function () { await closeNative(); return watch(item); }));
        var hidden = settings.hidden.some(function (id) { return idKey(id) === idKey(item); });
        group.appendChild(button(hidden ? 'Auf Startseite wieder anzeigen' : 'Aus „Als nächstes“ und „Weiterschauen“ ausblenden', async function () {
            await closeNative();
            if (hidden) return request('Hidden/' + item, 'DELETE').then(function () { window.location.reload(); });
            return hide(item);
        }));
        nativeItem.parentNode.appendChild(group);
    }
    async function seasonal() {
        var home = document.querySelector('#homeTab .sections');
        if (!home || !settings.seasonalRecommendations || seasonLoading || home.querySelector('.jp-season')) return;
        var key = user + ':' + new Date().toDateString();
        if (seasonKey === key) return;
        seasonLoading = true;
        try {
            var result = await request('Seasonal');
            if (!result.items.length) { seasonKey = key; return; }
            if (!home.isConnected || api().getCurrentUserId() !== user) return;
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
            section.appendChild(row); home.appendChild(section);
        } catch (error) { console.warn('[Jelly+] Saisonale Empfehlungen:', error); seasonKey = key; }
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
            if (!settings || !api() || api().getCurrentUserId() !== user) return;
            preferences(); extendMenu(); seasonal();
        }, 100);
    }
    function start() {
        var style = element('style');
        style.textContent = '.jp-overlay{position:fixed;inset:0;z-index:100000;background:#000b;display:flex;align-items:center;justify-content:center}.jp-dialog{background:#202020;color:white;max-width:44em;width:85%;max-height:85vh;overflow:auto;padding:2em;border-radius:.6em}.jp-button{display:block;margin:.7em 0;padding:1em;white-space:normal;text-align:left}.jp-button:focus,.jp-poster:focus,.jp-toggle:focus-within{outline:3px solid #00a4dc;outline-offset:3px}.jp-posters{display:flex;gap:1em;overflow-x:auto;padding:.5em .3em 1.5em}.jp-poster{flex:0 0 10em;color:inherit;text-decoration:none}.jp-poster img{width:100%;height:15em;object-fit:cover;border-radius:.4em}.jp-poster span{display:block;margin-top:.5em}.jp-preferences{margin:2em 0}.jp-toggle{display:block;padding:1em 0}.jp-toggle input{width:1.3em;height:1.3em}.jp-menu{padding:.5em 1em}';
        document.head.appendChild(style);
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
        setInterval(refresh, 15000);
        refresh();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
