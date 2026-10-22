/* Jelly+ for Jellyfin Web 12.2, desktop/mobile and TV layout. */
(function () {
    'use strict';
    if (window.__jellyplus) return;
    window.__jellyplus = true;
    var settings = null, user = null, pendingMenu = null, refreshing = false;
    var seasonKey = '', seasonLoading = false, observerQueued = false;
    var seasonRetryAt = 0, hiddenKey = '', hiddenLoading = false, hiddenResolved = [];
    var settingsRetryAt = 0, effectsRetryAt = 0;
    var nativeRequire = null, nativeModules = {};
    function nativeComponent(name) {
        if (nativeModules[name]) return nativeModules[name];
        if (!nativeRequire && window.webpackChunk && typeof window.webpackChunk.push === 'function') {
            // Jellyfin 12.2 bundles its UI modules. Reuse their existing exports;
            // no bundles or files are rewritten and no module numbers are fixed.
            window.webpackChunk.push([['jellyplus-native-ui'], {}, function (require) { nativeRequire = require; }]);
        }
        if (!nativeRequire || !nativeRequire.m) return null;
        var markers = { cards: 'getCardsHtml:', actions: 'ActionSheet closed without resolving',
            home: 'getDefaultSection:', preferences: 'displayPrefs.CustomPrefs' };
        var marker = markers[name];
        var ids = Object.keys(nativeRequire.m);
        for (var i = 0; i < ids.length; i++) {
            if (String(nativeRequire.m[ids[i]]).indexOf(marker) < 0) continue;
            var exports = nativeRequire(ids[i]);
            var candidates = [exports].concat(Object.keys(exports).map(function (key) { return exports[key]; }));
            var component = candidates.find(function (value) {
                if (!value) return false;
                if (name === 'cards') return typeof value.getCardsHtml === 'function';
                if (name === 'home') return typeof value.getDefaultSection === 'function' && typeof value.loadSections === 'function';
                if (name === 'preferences') return typeof value.get === 'function' && typeof value.setUserInfo === 'function' && typeof value.serverConfig === 'function';
                return typeof value.show === 'function';
            });
            if (component) { nativeModules[name] = component; return component; }
        }
        return null;
    }
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
                Authorization: 'MediaBrowser Client="Jellyplus", Device="Web", DeviceId="' + (current.deviceId ? current.deviceId() : 'jellyplus-web') + '", Version="0.1.6", Token="' + current.accessToken() + '"',
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
        var template = document.createElement('div');
        template.innerHTML = '<button is="emby-button" type="button" class="raised block"><span></span></button>';
        var node = template.firstElementChild;
        node.querySelector('span').textContent = text;
        node.addEventListener('click', function (e) {
            e.preventDefault(); e.stopPropagation();
            Promise.resolve().then(action).catch(showError);
        });
        return node;
    }
    async function choose(title, description, choices) {
        var sheet = nativeComponent('actions');
        if (!sheet) throw new Error('Jellyfins Menükomponente ist noch nicht verfügbar.');
        try {
            var id = await sheet.show({ title: title, text: description, showCancel: true,
                items: choices.map(function (choice, index) { return { id: String(index), name: choice.label }; }) });
            return choices[Number(id)] ? choices[Number(id)].value : null;
        } catch (error) {
            if (error && /closed without resolving/i.test(error.message)) return null;
            throw error;
        }
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
        var form = container.matches('form') ? container : container.querySelector('form');
        if (!form) return;
        var section = element('div', '', 'verticalSection verticalSection-extrabottompadding jp-preferences jp-owned');
        section.innerHTML = '<h2 class="sectionTitle">Jelly+</h2><div class="checkboxContainer checkboxContainer-withDescription">' +
            '<label><input type="checkbox" is="emby-checkbox" class="jp-watch-toggle"><span>Watch Together</span></label>' +
            '<div class="fieldDescription checkboxFieldDescription">Andere freigegebene Profile können dich pro Film oder Serie verknüpfen. Ausschalten entfernt deine Verknüpfungen.</div></div>';
        var toggle = section.querySelector('input'); toggle.checked = settings.enabled;
        toggle.addEventListener('change', async function () {
            toggle.disabled = true;
            try { await request('Preferences', 'PUT', { enabled: toggle.checked }); settingsRetryAt = 0; await refresh(); }
            catch (error) { toggle.checked = !toggle.checked; showError(error); }
            finally { toggle.disabled = false; }
        });
        section.appendChild(button('Ausgeblendete Medien verwalten', restore));
        var submit = form.querySelector('button[type="submit"], .btnSave');
        while (submit && submit.parentNode !== form) submit = submit.parentElement;
        form.insertBefore(section, submit);
    }
    function placeSeasonal(home, section) {
        if (document.documentElement.classList.contains('layout-tv')) {
            // TV headings have no latest-media links. Live TV uses the same
            // nested row structure, so resolve Jellyfin's configured slot.
            var sections = nativeComponent('home');
            var preferences = nativeComponent('preferences');
            var types = [];
            if (sections && preferences) {
                for (var index = 0; index < 10; index++) {
                    var type = preferences.get('homesection' + index) || sections.getDefaultSection(index);
                    types.push(type === 'folders' ? sections.getDefaultSection(0) : type);
                }
                // Jellyfin prepends a library row in TV mode if none is configured.
                if (types.indexOf('smalllibrarytiles') < 0 && types.indexOf('librarybuttons') < 0) types.unshift('smalllibrarytiles');
            }
            var slotIndex = types.indexOf('latestmedia');
            var tvLatest = slotIndex < 0 ? null : Array.prototype.find.call(home.children, function (slot) {
                return slot.classList.contains('section' + slotIndex);
            });
            if (tvLatest) {
                if (tvLatest.firstElementChild !== section) tvLatest.insertBefore(section, tvLatest.firstChild);
            } else if (section.parentNode !== home || section !== home.lastElementChild) home.appendChild(section);
            return;
        }
        var link = home.querySelector('a.more.sectionTitleTextButton[href*="topParentId"], a.more.sectionTitleTextButton[href*="parentId"], a[href*="section=latest"], a[href*="section%3Dlatest"], a[href*="/latest"]');
        var latest = link;
        while (latest && latest.parentNode !== home) latest = latest.parentElement;
        if (!latest) {
            latest = Array.prototype.find.call(home.children, function (slot) {
                return slot !== section && (slot.matches('[data-section="latest"], [data-section="latestmedia"]')
                    || (!slot.classList.contains('verticalSection') && slot.querySelector('.verticalSection .itemsContainer:not([data-monitor])')));
            });
        }
        // Share the existing latest-media slot. A new sibling would shift
        // nth-child selectors and create an independent flex/grid item.
        if (latest) {
            if (latest.firstElementChild !== section) latest.insertBefore(section, latest.firstChild);
        } else if (section.parentNode !== home) home.appendChild(section);
    }
    function loadSeasonalEffects() {
        var root = document.documentElement;
        if (!root.matches('.layout-desktop, .layout-mobile') || root.classList.contains('layout-tv')
            || window.ElegantFinSeasonal || document.querySelector('#jp-seasonal-effects') || Date.now() < effectsRetryAt) return;
        var source = 'https://cdn.jsdelivr.net/gh/S3NTIN3LOne/jellyfin-elegantfin-tv@v0.1.15/desktop/ElegantFin-seasonal.js';
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
        var feed = null;
        var row = card && card.closest('.itemsContainer');
        var section = row && row.closest('.verticalSection');
        if (section && row.getAttribute('data-monitor') && /videoplayback/.test(row.getAttribute('data-monitor'))) {
            feed = section.querySelector('a[href*="nextup"]') ? 'Als nächstes' : null;
            if (!feed && /(?:als n[aä]chstes|next up)/i.test((section.querySelector('.sectionTitle') || {}).textContent || '')) feed = 'Als nächstes';
            if (!feed) feed = 'Weiterschauen';
        }
        if (id && (!type || ['Movie', 'Series', 'Episode'].indexOf(type) >= 0)) pendingMenu = { id: id, at: Date.now(), feed: feed };
        else pendingMenu = null;
    }
    function extendMenu() {
        if (!pendingMenu || Date.now() - pendingMenu.at > 5000) return;
        var content = document.querySelector('.actionSheetContent');
        if (!content || content.querySelector('.jp-menu')) return;
        var nativeItem = content.querySelector('.actionSheetMenuItem');
        if (!nativeItem) return;
        var item = pendingMenu.id;
        var feed = pendingMenu.feed;
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
        function menuEntry(text, icon, action) {
            var entry = nativeItem.cloneNode(true);
            entry.removeAttribute('id'); entry.removeAttribute('data-id'); entry.removeAttribute('autofocus');
            var label = entry.querySelector('.actionSheetItemText, .listItemBodyText');
            if (!label) { entry.textContent = ''; label = element('div', '', 'listItemBody actionsheetListItemBody'); entry.appendChild(label); }
            label.textContent = text;
            var image = entry.querySelector('.actionsheetMenuItemIcon, .listItemIcon');
            if (!image) { image = document.createElement('span'); entry.insertBefore(image, entry.firstChild); }
            image.className = 'actionsheetMenuItemIcon listItemIcon listItemIcon-transparent material-icons ' + icon;
            image.textContent = ''; image.setAttribute('aria-hidden', 'true');
            entry.addEventListener('click', function (event) {
                event.preventDefault(); event.stopPropagation();
                Promise.resolve().then(closeNative).then(action).catch(showError);
            });
            return entry;
        }
        if (settings.enabled) {
            var watchButton = menuEntry('Watch Together', 'groups', async function () {
                if (settings && settings.enabled) return watch(item);
            });
            watchButton.classList.add('jp-watch');
            group.appendChild(watchButton);
        }
        var hidden = settings.hidden.some(function (id) { return idKey(id) === idKey(item); });
        var hideLabel = feed ? 'Aus „' + feed + '“ ausblenden' : 'Auf der Startseite ausblenden';
        group.appendChild(menuEntry(hidden ? 'Auf Startseite wieder anzeigen' : hideLabel, hidden ? 'visibility' : 'visibility_off', async function () {
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
        var renderer = nativeComponent('cards');
        if (!renderer) return;
        var requestUser = user;
        seasonLoading = true;
        try {
            var result = await request('Seasonal');
            if (!connected(home) || api().getCurrentUserId() !== requestUser || !settings || !settings.seasonalRecommendations) return;
            if (!result.items || !result.items.length) { seasonKey = key; seasonRetryAt = Date.now() + 60000; return; }
            var media = await api().getItems(requestUser, {
                Ids: result.items.map(function (item) { return item.id; }).join(','),
                Fields: 'PrimaryImageAspectRatio,MediaSourceCount', EnableTotalRecordCount: false,
                EnableImages: true, ImageTypeLimit: 1, EnableImageTypes: 'Primary,Backdrop,Thumb'
            });
            if (!connected(home) || api().getCurrentUserId() !== requestUser || !settings || !settings.seasonalRecommendations) return;
            var items = result.items.map(function (item) { return media.Items.find(function (m) { return idKey(m.Id) === idKey(item.id); }); }).filter(Boolean);
            if (!items.length) { seasonKey = key; seasonRetryAt = Date.now() + 60000; return; }
            var section = element('div', '', 'verticalSection jp-season jp-owned');
            section.innerHTML = '<div class="sectionTitleContainer sectionTitleContainer-cards padded-left"><h2 class="sectionTitle sectionTitle-cards"></h2></div>' +
                '<div is="emby-scroller" class="padded-top-focusscale padded-bottom-focusscale" data-centerfocus="true" data-hidescrollbar="true">' +
                '<div is="emby-itemscontainer" class="itemsContainer scrollSlider focuscontainer-x"></div></div>';
            section.querySelector('h2').textContent = result.title;
            placeSeasonal(home, section);
            var row = section.querySelector('.itemsContainer');
            row.fetchData = function () { return Promise.resolve(items); };
            function cardOptions(movies) {
                return { items: movies, serverId: api().serverId(), shape: 'overflowPortrait',
                    showTitle: true, showYear: true, centerText: true, lazy: true, overlayPlayButton: true,
                    showUnplayedIndicator: false, context: 'home' };
            }
            row.getItemsHtml = function (movies) {
                return renderer.getCardsHtml(cardOptions(movies));
            };
            row.parentContainer = section;
            // buildCards registers the native image loader even when the custom
            // items-container element has not finished upgrading yet (webOS).
            renderer.buildCards(items, Object.assign(cardOptions(items), { itemsContainer: row }));
            var scroller = section.querySelector('[is="emby-scroller"]');
            if (scroller.scroller) scroller.scroller.reload();
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
        new MutationObserver(function (changes) {
            if (changes.some(function (change) {
                return change.type === 'childList' || (change.target.parentElement && change.target.parentElement.matches('.sections, .homeSectionsContainer'));
            })) schedule();
        }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
        window.addEventListener('resize', schedule);
        document.addEventListener('load', schedule, true);
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
