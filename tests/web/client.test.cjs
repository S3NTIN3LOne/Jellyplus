const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const source = fs.readFileSync('src/Jellyplus/Web/client.js', 'utf8');
const wait = (ms = 200) => new Promise(resolve => setTimeout(resolve, ms));

function fixture(markup, responses = {}) {
    const dom = new JSDOM('<html><head></head><body>' + markup + '</body></html>', { url: 'http://localhost/web/index.html#/home', runScripts: 'outside-only' });
    const calls = [];
    const w = dom.window;
    w.ApiClient = {
        getCurrentUserId: () => 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', accessToken: () => 'test-token', serverId: () => 'server',
        getUrl: path => 'http://localhost/' + path,
        getItem: async () => ({ CollectionType: 'movies' }),
        getItems: async () => ({ Items: [{ Id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' }] })
    };
    w.fetch = async (url, options) => {
        const path = url.replace('http://localhost/Jellyplus/', '');
        calls.push({ path, options });
        return { ok: true, json: async () => responses[path] || (path === 'Settings' ? { Enabled: true, SeasonalRecommendations: true, ShuffleOpensDetails: true, Hidden: [] } : {}) };
    };
    w.eval(source);
    return { dom, w, calls };
}

test('adds a profile preference and stores opt-in through an authenticated request', async () => {
    const { dom, w, calls } = fixture('<div id="languagePreferencesPage"><div class="settingsContainer"></div></div>');
    try {
        await wait();
        const input = w.document.querySelector('.jp-toggle input');
        assert.equal(input.checked, true);
        input.checked = false;
        input.dispatchEvent(new w.Event('change'));
        await wait();
        const request = calls.find(c => c.path === 'Preferences');
        assert.equal(request.options.method, 'PUT');
        assert.match(request.options.headers.Authorization, /Token="test-token"/);
        assert.equal(JSON.parse(request.options.body).enabled, false);
        assert.equal(w.document.querySelectorAll('.jp-preferences').length, 1);
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
    } finally { dom.window.close(); }
});

test('seasonal metadata is rendered as text and cards navigate to details', async () => {
    const { dom, w } = fixture('<div id="homeTab"><div class="sections"></div></div>', {
        Seasonal: { Title: 'Halloween', Items: [{ Id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', Name: '<img src=x onerror=alert(1)>' }] }
    });
    try {
        await wait(400);
        const card = w.document.querySelector('.jp-poster');
        assert.ok(card);
        assert.match(card.href, /details\?id=/);
        assert.equal(card.querySelectorAll('img').length, 1);
        assert.equal(card.querySelector('span').textContent, '<img src=x onerror=alert(1)>');
    } finally { dom.window.close(); }
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
        assert.match(w.document.querySelector('.jp-dialog').textContent, /Partner/);
    } finally { dom.window.close(); }
});

test('remote arrow keys and back keep dialogs operable', async () => {
    const { dom, w } = fixture('<div id="languagePreferencesPage"><div class="settingsContainer"></div></div>', {
        Hidden: [{ Id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', Name: 'Testfilm' }]
    });
    try {
        await wait(); w.document.querySelector('.jp-preferences button').click(); await wait();
        const buttons = w.document.querySelectorAll('.jp-dialog button');
        assert.equal(w.document.activeElement, buttons[0]);
        w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        assert.equal(w.document.activeElement, buttons[1]);
        w.document.dispatchEvent(new w.KeyboardEvent('keydown', { keyCode: 461, bubbles: true }));
        await wait();
        assert.equal(w.document.querySelector('.jp-overlay'), null);
    } finally { dom.window.close(); }
});
