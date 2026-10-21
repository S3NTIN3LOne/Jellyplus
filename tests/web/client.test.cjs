const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const source = fs.readFileSync('src/Jellyplus/Web/client.js', 'utf8');
const wait = (ms = 200) => new Promise(resolve => setTimeout(resolve, ms));

function fixture(markup, responses = {}, configure) {
    const dom = new JSDOM('<html><head></head><body>' + markup + '</body></html>', { url: 'http://localhost/web/index.html#/home', runScripts: 'outside-only' });
    const calls = [];
    const w = dom.window;
    w.document.querySelectorAll('.settingsContainer').forEach(n => {
        if (!n.querySelector('form')) n.innerHTML = '<form><button class="btnSave" type="submit">Save</button></form>';
    });
    const nativeCalls = [];
    const cards = { getCardsHtml(options) {
        nativeCalls.push({type:'cards',options});
        return options.items.map(item => {
            const card=w.document.createElement('a');card.className='card overflowPortrait';card.dataset.id=item.Id;card.dataset.type='Movie';
            card.href='#/details?id='+item.Id;const img=w.document.createElement('img');card.appendChild(img);
            const text=w.document.createElement('span');text.className='cardText';text.textContent=item.Name;card.appendChild(text);return card.outerHTML;
        }).join('');
    }, buildCards(items,options) {
        nativeCalls.push({type:'buildCards',items,options});
        options.itemsContainer.innerHTML=this.getCardsHtml({...options,items});
    }};
    const actions = { show(options) {
        nativeCalls.push({type:'actions',options});
        return new Promise((resolve,reject)=>{
            const sheet=w.document.createElement('div');sheet.className='native-sheet actionSheetContent';sheet.setAttribute('role','dialog');
            const title=w.document.createElement('h2');title.textContent=options.title;sheet.appendChild(title);
            options.items.forEach(item=>{const b=w.document.createElement('button');b.className='actionSheetMenuItem';b.textContent=item.name;b.onclick=()=>{sheet.remove();resolve(item.id)};sheet.appendChild(b)});
            const cancel=w.document.createElement('button');cancel.className='btnCloseActionSheet';cancel.textContent='Abbrechen';
            cancel.onclick=()=>{sheet.remove();reject(new Error('ActionSheet closed without resolving'))};sheet.appendChild(cancel);w.document.body.appendChild(sheet);
        });
    }};
    const requireNative = id => id==='cards'?{default:cards}:{default:actions};
    requireNative.m={cards:function(){/* getCardsHtml: */},actions:function(){/* ActionSheet closed without resolving */}};
    w.webpackChunk={push:chunk=>chunk[2](requireNative)};
    w.ApiClient = {
        getCurrentUserId: () => 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', accessToken: () => 'test-token', serverId: () => 'server',
        getUrl: path => 'http://localhost/' + path,
        getItem: async () => ({ CollectionType: 'movies' }),
        getItems: async (_user,options) => {
            nativeCalls.push({type:'getItems',options});
            return { Items: options.Ids ? options.Ids.split(',').map(id => ({Id:id, Name:responses.Seasonal?.Items?.find(i=>i.Id===id)?.Name || 'Test film'})) : [{ Id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' }] };
        }
    };
    w.fetch = async (url, options) => {
        const path = url.replace('http://localhost/Jellyplus/', '');
        calls.push({ path, options });
        const result = typeof responses[path] === 'function' ? await responses[path](options) : responses[path];
        return { ok: true, json: async () => result || (path === 'Settings' ? { Enabled: true, SeasonalRecommendations: true, ShuffleOpensDetails: true, Hidden: [] } : {}) };
    };
    if (configure) configure(w);
    w.eval(source);
    return { dom, w, calls, nativeCalls };
}

test('adds a profile preference and stores opt-in through an authenticated request', async () => {
    const { dom, w, calls } = fixture('<div id="languagePreferencesPage"><div class="settingsContainer"></div></div>');
    try {
        await wait();
        const input = w.document.querySelector('.jp-watch-toggle');
        assert.equal(input.checked, true);
        input.checked = false;
        input.dispatchEvent(new w.Event('change'));
        await wait();
        const request = calls.find(c => c.path === 'Preferences');
        assert.equal(request.options.method, 'PUT');
        assert.match(request.options.headers.Authorization, /Token="test-token"/);
        assert.equal(JSON.parse(request.options.body).enabled, false);
        assert.equal(w.document.querySelectorAll('.jp-preferences').length, 1);
        assert.ok(input.matches('[is="emby-checkbox"]'));
        assert.ok(input.closest('form'));
        assert.ok(input.closest('.checkboxContainer-withDescription'));
        assert.equal(input.closest('.jp-preferences').nextElementSibling.className,'btnSave');
    } finally { dom.window.close(); }
});

test('extends the native three-dot menu without replacing its actions', async () => {
    const { dom, w } = fixture('<div data-id="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" data-type="Movie"><button data-action="menu">More</button></div>');
    try {
        await wait();
        w.document.querySelector('button').click();
        const sheet = w.document.createElement('div');
        sheet.className = 'actionSheetContent';
        sheet.innerHTML = '<div><button class="actionSheetMenuItem">Play</button></div>';
        w.document.body.appendChild(sheet);
        await wait();
        assert.equal(sheet.querySelector('.actionSheetMenuItem').textContent, 'Play');
        assert.match(sheet.textContent, /Watch Together/);
        assert.match(sheet.textContent, /ausblenden/);
        assert.equal(sheet.querySelectorAll('.jp-menu').length, 1);
        assert.equal(sheet.querySelectorAll('.jp-menu .actionSheetMenuItem').length,2);
        assert.equal(sheet.querySelectorAll('.jp-menu .raised').length,0);
        assert.equal(sheet.querySelector('.jp-menu .material-icons').textContent,'');
    } finally { dom.window.close(); }
});

test('seasonal metadata uses the native card builder and scroller', async () => {
    const { dom, w, nativeCalls } = fixture('<div id="homeTab"><div class="sections"></div></div>', {
        Seasonal: { Title: 'Halloween', Items: [{ Id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', Name: '<img src=x onerror=alert(1)>' }] }
    });
    try {
        await wait(400);
        const card = w.document.querySelector('.jp-season .card');
        assert.ok(card);
        assert.match(card.href, /details\?id=/);
        assert.equal(card.querySelectorAll('img').length, 1);
        assert.equal(card.querySelector('span').textContent, '<img src=x onerror=alert(1)>');
        assert.ok(w.document.querySelector('.jp-season [is="emby-scroller"] .scrollSlider[is="emby-itemscontainer"]'));
        assert.equal(nativeCalls.find(c=>c.type==='cards').options.shape,'overflowPortrait');
        assert.equal(nativeCalls.find(c=>c.type==='getItems').options.EnableImages,true);
        assert.equal(nativeCalls.find(c=>c.type==='getItems').options.EnableImageTypes,'Primary,Backdrop,Thumb');
        assert.equal(nativeCalls.find(c=>c.type==='buildCards').options.itemsContainer,w.document.querySelector('.jp-season .itemsContainer'));
        assert.equal(w.document.querySelector('.jp-posters'),null);
    } finally { dom.window.close(); }
});

test('recommendations share the latest-media slot without shifting CSS sibling selectors', async () => {
    const { dom,w }=fixture('<style>.sections{display:flex;flex-direction:column}#live{order:1}#next{order:2}#latest{order:8}</style><div id="homeTab"><div class="sections"><div class="verticalSection" id="live">Live-TV</div><div class="verticalSection" id="next">Next Up</div><div id="latest"><a href="#/movies?section=latest">Latest</a></div></div></div>',{
        Seasonal:{Title:'Halloween',Items:[{Id:'bbbb',Name:'Film'}]}
    });
    try{
        await wait(400);const section=w.document.querySelector('.jp-season');
        assert.equal(section.parentElement.id,'latest');assert.equal(section.style.order,'');
        assert.equal(w.document.querySelector('.sections').children.length,3);
        assert.equal(w.document.querySelector('#latest').firstElementChild,section);
        w.document.querySelector('#latest').style.order='12';await wait(400);
        assert.equal(w.getComputedStyle(section.parentElement).order,'12');assert.equal(section.parentElement.id,'latest');
    }finally{dom.window.close()}
});

test('shuffle opens details and blocks the original playback handler', async () => {
    const { dom, w } = fixture('<button class="btnShuffle">Shuffle</button>');
    try {
        w.location.hash = '#/movies.html?topParentId=cccccccccccccccccccccccccccccccc';
        let played = false;
        w.document.querySelector('button').addEventListener('click', () => { played = true; });
        await wait();
        w.document.querySelector('button').click();
        await wait();
        assert.equal(played, false);
        assert.match(w.location.hash, /details\?id=bbbb/);
    } finally { dom.window.close(); }
});

test('React library shuffle opens details without invoking playback', async () => {
    const { dom, w } = fixture('<button title="Zufällig"><svg data-testid="ShuffleIcon"></svg></button>');
    try {
        w.location.hash = '#/movies?topParentId=cccccccccccccccccccccccccccccccc';
        let played = false;
        w.document.querySelector('button').addEventListener('click', () => { played = true; });
        await wait();
        w.document.querySelector('svg').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
        await wait();
        assert.equal(played, false);
        assert.match(w.location.hash, /details\?id=bbbb/);
    } finally { dom.window.close(); }
});

test('closes a native menu without a close button before opening profile selection', async () => {
    const { dom, w } = fixture('<div data-id="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" data-type="Movie"><button data-action="menu">More</button></div>', {
        'Profiles/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb': [{ Id: 'cccccccccccccccccccccccccccccccc', Username: 'Partner', Linked: false }]
    });
    try {
        await wait(); w.document.querySelector('button').click();
        const container = w.document.createElement('div');
        container.className = 'dialogContainer';
        container.innerHTML = '<div modal="modal"><div class="actionSheetContent"><div><button class="actionSheetMenuItem">Play</button></div></div></div>';
        let mouseDownTarget;
        container.addEventListener('mousedown', e => { mouseDownTarget = e.target; });
        container.addEventListener('click', e => {
            if (e.target === container && mouseDownTarget === container) {
                container.querySelector('[modal]').dispatchEvent(new w.Event('close'));
                container.remove();
            }
        });
        w.document.body.appendChild(container);
        await wait(); container.querySelector('.jp-menu button').click(); await wait();
        assert.equal(w.document.querySelector('.dialogContainer'), null);
        assert.match(w.document.querySelector('.native-sheet').textContent, /Partner/);
    } finally { dom.window.close(); }
});

test('hidden media selection uses Jellyfin action sheets and supports native cancellation', async () => {
    const { dom, w, nativeCalls } = fixture('<div id="languagePreferencesPage"><div class="settingsContainer"></div></div>', {
        Hidden: [{ Id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', Name: 'Testfilm' }]
    });
    try {
        await wait(); w.document.querySelector('.jp-preferences button').click(); await wait();
        assert.equal(nativeCalls.at(-1).type,'actions');
        assert.equal(nativeCalls.at(-1).options.title,'Ausgeblendete Medien');
        assert.equal(nativeCalls.at(-1).options.items[0].name,'Testfilm');
        w.document.querySelector('.native-sheet .btnCloseActionSheet').click();
        await wait();
        assert.equal(w.document.querySelector('.native-sheet'), null);
        assert.equal(w.document.querySelector('.jp-overlay'), null);
    } finally { dom.window.close(); }
});

test('Watch Together is absent when the profile has not opted in', async () => {
    const { dom, w } = fixture('<div data-id="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" data-type="Movie"><button data-action="menu">More</button></div>', {
        Settings: { Enabled: false, SeasonalRecommendations: false, Hidden: [] }
    });
    try {
        await wait(); w.document.querySelector('button').click();
        const sheet = w.document.createElement('div'); sheet.className = 'actionSheetContent';
        sheet.innerHTML = '<div><button class="actionSheetMenuItem">Play</button></div>';
        w.document.body.appendChild(sheet); await wait();
        assert.doesNotMatch(sheet.textContent, /Watch Together/);
        assert.match(sheet.textContent, /ausblenden/);
    } finally { dom.window.close(); }
});

test('hide persists first and removes a cached home card without reloading the page', async () => {
    const id = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    let hidden = false;
    const { dom, w, calls } = fixture('<div class="homePage"><div class="itemsContainer" data-monitor="videoplayback,markplayed"><div data-id="' + id + '" data-type="Movie"><button data-action="menu">More</button></div></div></div>', {
        Settings: () => ({ Enabled: false, SeasonalRecommendations: false, Hidden: hidden ? [id] : [] }),
        ['Hidden/' + id]: () => { hidden = true; return {}; },
        'Hidden/Resolve': () => [id]
    });
    let navigationErrors = 0;
    dom.virtualConsole.on('jsdomError', error => { if (/navigation/.test(error.message)) navigationErrors++; });
    try {
        await wait(); const card = w.document.querySelector('[data-type]'); card.querySelector('button').click();
        const sheet = w.document.createElement('div'); sheet.className = 'actionSheetContent';
        sheet.innerHTML = '<div><button class="actionSheetMenuItem">Play</button></div>';
        w.document.body.appendChild(sheet); await wait();
        sheet.querySelector('.jp-menu button').click(); await wait(400);
        assert.equal(hidden, true);
        assert.equal(card.classList.contains('jp-hidden'), true);
        assert.equal(navigationErrors, 0);
        assert.ok(calls.find(c => c.path === 'Hidden/Resolve'));
        const replacement = card.cloneNode(true); replacement.classList.remove('jp-hidden');
        card.replaceWith(replacement); await wait();
        assert.equal(replacement.classList.contains('jp-hidden'), true, 'cached re-render stays hidden');
    } finally { dom.window.close(); }
});

test('seasonal row supports TV home containers and retries transient failures', async () => {
    let attempts = 0;
    const { dom, w } = fixture('<div class="homePage"><div class="homeSectionsContainer"><div>Existing rows</div></div></div>', {
        Seasonal: () => { if (++attempts === 1) throw new Error('Temporary failure'); return { Title: 'Halloween', Items: [{Id: 'bbbb', Name: 'Metadata film'}] }; }
    });
    try {
        await wait(400); assert.equal(w.document.querySelector('.jp-season'), null);
        const now = w.Date.now(); w.Date.now = () => now + 16000;
        w.document.body.appendChild(w.document.createElement('div')); await wait(400);
        assert.equal(attempts, 2);
        assert.equal(w.document.querySelector('.homeSectionsContainer').lastChild.classList.contains('jp-season'), true);
    } finally { dom.window.close(); }
});

test('browser startup discovers an API client that becomes available after initial rendering', async () => {
    const { dom, w, calls } = fixture('<div id="languagePreferencesPage"><div class="settingsContainer"></div></div>', {}, w => {
        const client = w.ApiClient; delete w.ApiClient;
        setTimeout(() => { w.ApiClient = client; w.document.body.appendChild(w.document.createElement('div')); }, 250);
    });
    try {
        await wait(700);
        assert.ok(calls.find(c => c.path === 'Settings'));
        assert.ok(w.document.querySelector('.jp-preferences'));
    } finally { dom.window.close(); }
});

test('desktop loads the requested effects once while leaving CSS to the local theme', async () => {
    const { dom, w } = fixture('', {}, w => w.document.documentElement.classList.add('layout-desktop'));
    try {
        await wait();
        const script = w.document.querySelector('#jp-seasonal-effects');
        assert.equal(script.src, 'https://cdn.jsdelivr.net/gh/S3NTIN3LOne/jellyfin-elegantfin-tv@v0.1.13/desktop/ElegantFin-seasonal.js');
        const marker = w.document.querySelector('link[data-ef-seasonal-css]');
        assert.ok(marker);
        assert.equal(marker.hasAttribute('href'), false);
        w.document.body.appendChild(w.document.createElement('div')); await wait();
        assert.equal(w.document.querySelectorAll('#jp-seasonal-effects').length, 1);
    } finally { dom.window.close(); }
});

test('desktop seasonal script is not loaded in TV layout', async () => {
    const { dom, w } = fixture('', {}, w => w.document.documentElement.classList.add('layout-tv'));
    try { await wait(); assert.equal(w.document.querySelector('#jp-seasonal-effects'), null); }
    finally { dom.window.close(); }
});

test('recommendations follow next-up and resume immediately before desktop latest media', async () => {
    const { dom, w } = fixture('<div id="homeTab"><div class="sections"><div id="libraries" class="verticalSection"></div><div id="resume" class="verticalSection"></div><div id="next" class="verticalSection"></div><div id="latest"><div class="verticalSection"><a href="#/movies?section=latest">Latest</a></div></div></div></div>', {
        Seasonal: { Title: 'Halloween', Items: [{ Id: 'bbbb', Name: 'Film' }] }
    });
    try {
        await wait(400);
        const section = w.document.querySelector('.jp-season');
        assert.equal(section.parentElement.id, 'latest');
        assert.equal(section.parentElement.previousElementSibling.id, 'next');
        assert.equal(section.parentElement.firstElementChild,section);
    } finally { dom.window.close(); }
});

test('TV recommendations reposition when latest library rows arrive after the recommendation response', async () => {
    const { dom, w, calls } = fixture('<div class="homePage"><div class="homeSectionsContainer"><div class="verticalSection" id="resume"></div></div></div>', {
        Seasonal: { Title: 'Halloween', Items: [{ Id: 'bbbb', Name: 'Film' }] }
    });
    try {
        await wait(400);
        const latest = w.document.createElement('div'); latest.id = 'latest';
        latest.innerHTML = '<div class="verticalSection"><h2>Neu in Filme</h2><div class="itemsContainer"></div></div>';
        const home = w.document.querySelector('.homeSectionsContainer'); home.insertBefore(latest, home.firstChild);
        await wait(400);
        assert.equal(w.document.querySelector('.jp-season').parentElement.id, 'latest');
        assert.equal(calls.filter(c => c.path === 'Seasonal').length, 1);
    } finally { dom.window.close(); }
});

for (const feed of ['Als nächstes','Weiterschauen']) {
    test('hide menu label names only its source feed: '+feed,async()=>{
        const{dom,w}=fixture('<div class="homePage"><div class="verticalSection"><h2 class="sectionTitle">'+feed+'</h2><div class="itemsContainer" data-monitor="videoplayback,markplayed"><div data-id="bbbb" data-type="Episode"><button data-action="menu">More</button></div></div></div></div>');
        try{
            await wait();w.document.querySelector('button').click();
            const sheet=w.document.createElement('div');sheet.className='actionSheetContent';sheet.innerHTML='<button class="actionSheetMenuItem"><div class="actionSheetItemText">Play</div></button>';w.document.body.appendChild(sheet);await wait();
            const labels=[...sheet.querySelectorAll('.jp-menu .actionSheetItemText')].map(n=>n.textContent);
            assert.ok(labels.includes('Aus „'+feed+'“ ausblenden'));
            assert.equal(labels.some(s=>s.includes('und „')),false);
        }finally{dom.window.close()}
    });
}

test('live TV headers do not become the recommendation insertion target',async()=>{
    const{dom,w}=fixture('<div id="homeTab"><div class="sections"><div class="verticalSection" id="live"><a class="more sectionTitleTextButton" href="#/livetv">Live-TV</a></div><div id="latest"><div class="verticalSection"><a class="more sectionTitleTextButton" href="#/movies?topParentId=aaa">Latest</a></div></div></div></div>',{Seasonal:{Title:'Halloween',Items:[{Id:'bbbb',Name:'Film'}]}});
    try{await wait(400);assert.equal(w.document.querySelector('.jp-season').parentElement.id,'latest');assert.equal(w.document.querySelector('#live .jp-season'),null)}finally{dom.window.close()}
});
