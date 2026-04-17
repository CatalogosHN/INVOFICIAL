(function () {
    const AUTH_STORAGE_KEY = 'webowneradmin_auth_session';
    const CONFIG = Object.assign({
        appName: 'WebOwnerAdmin',
        ownerid: 'RZsbvRZczd',
        version: '1.0',
        apiUrl: 'https://keyauth.win/api/1.3/',
        redirectAfterLogin: 'index.html',
        appDisplayName: 'Panel Inventario',
        fingerprintSalt: 'PanelInventario'
    }, window.KEYAUTH_CONFIG || {});

    const currentPage = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const isLoginPage = currentPage === 'login.html';

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function configReady() {
        return Boolean(CONFIG.ownerid && !/PON_TU_OWNERID/i.test(CONFIG.ownerid));
    }

    function readSession() {
        try {
            return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null');
        } catch (error) {
            return null;
        }
    }

    function writeSession(session) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    }

    function clearSession() {
        localStorage.removeItem(AUTH_STORAGE_KEY);
    }

    function redirectToLogin(extra = '') {
        const next = encodeURIComponent(location.pathname.split('/').pop() || 'index.html');
        location.href = 'login.html?next=' + next + (extra ? '&' + extra : '');
    }

    async function sha256(text) {
        const data = new TextEncoder().encode(text);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function buildCanvasFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 280;
            canvas.height = 80;
            ctx.textBaseline = 'top';
            ctx.font = '16px Arial';
            ctx.fillStyle = '#6f67f6';
            ctx.fillRect(10, 10, 120, 28);
            ctx.fillStyle = '#10163A';
            ctx.fillText(CONFIG.appName + '|' + navigator.userAgent, 14, 14);
            ctx.strokeStyle = '#28c76f';
            ctx.strokeRect(8, 8, 180, 36);
            return canvas.toDataURL();
        } catch (error) {
            return 'canvas-unavailable';
        }
    }

    async function getDeviceFingerprint() {
        const cacheKey = AUTH_STORAGE_KEY + '_fingerprint_cache';
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) return cached;

        const parts = [
            CONFIG.fingerprintSalt,
            navigator.userAgent || '',
            navigator.platform || '',
            (navigator.languages || []).join(','),
            Intl.DateTimeFormat().resolvedOptions().timeZone || '',
            screen.width + 'x' + screen.height,
            String(screen.colorDepth || ''),
            String(window.devicePixelRatio || ''),
            String(navigator.hardwareConcurrency || ''),
            String(navigator.deviceMemory || ''),
            String(navigator.maxTouchPoints || ''),
            buildCanvasFingerprint()
        ];

        const hash = await sha256(parts.join('|'));
        const fingerprint = 'WEB-' + hash.slice(0, 32).toUpperCase();
        sessionStorage.setItem(cacheKey, fingerprint);
        return fingerprint;
    }

    async function callKeyAuth(params) {
        const url = CONFIG.apiUrl + (CONFIG.apiUrl.includes('?') ? '&' : '?') + new URLSearchParams(params).toString();
        const response = await fetch(url, {
            method: 'GET',
            cache: 'no-store',
            credentials: 'omit',
            headers: { 'Accept': 'application/json' }
        });

        let data = null;
        try {
            data = await response.json();
        } catch (error) {
            throw new Error('KeyAuth no devolvió JSON válido.');
        }

        if (!response.ok) {
            throw new Error(data && data.message ? data.message : 'Error HTTP ' + response.status);
        }

        return data;
    }

    async function initializeKeyAuth() {
        return await callKeyAuth({
            type: 'init',
            ver: CONFIG.version || '1.0',
            name: CONFIG.appName,
            ownerid: CONFIG.ownerid
        });
    }

    function normalizeKeyAuthMessage(message) {
        const raw = String(message || '').trim();
        if (!raw) return 'No se pudo completar el acceso.';
        if (/hwid/i.test(raw)) return 'Esta licencia ya quedó enlazada a otro dispositivo o navegador.';
        if (/invalid/i.test(raw)) return 'La key no es válida.';
        return raw;
    }

    function maskKey(key) {
        const value = String(key || '').trim();
        if (value.length <= 8) return value;
        return value.slice(0, 4) + '••••' + value.slice(-4);
    }

    async function loginWithLicense(key) {
        if (!configReady()) {
            throw new Error('Falta configurar ownerid en keyauth-config.js');
        }

        const cleanKey = String(key || '').trim();
        if (!cleanKey) {
            throw new Error('Ingresa una key válida.');
        }

        const hwid = await getDeviceFingerprint();
        const initData = await initializeKeyAuth();
        if (!initData || !initData.success || !initData.sessionid) {
            throw new Error(normalizeKeyAuthMessage(initData && initData.message));
        }

        const loginData = await callKeyAuth({
            type: 'license',
            key: cleanKey,
            sessionid: initData.sessionid,
            name: CONFIG.appName,
            ownerid: CONFIG.ownerid,
            hwid: hwid,
            code: ''
        });

        if (!loginData.success) {
            throw new Error(normalizeKeyAuthMessage(loginData.message));
        }

        const session = {
            appName: CONFIG.appName,
            ownerid: CONFIG.ownerid,
            hwid: hwid,
            keyMasked: maskKey(cleanKey),
            rawKeyLength: cleanKey.length,
            loginAt: new Date().toISOString(),
            sessionid: initData.sessionid,
            info: loginData.info || {},
            nonce: loginData.nonce || ''
        };

        writeSession(session);
        return session;
    }

    async function validateCurrentSession() {
        const session = readSession();
        if (!session) return null;
        if (session.ownerid !== CONFIG.ownerid || session.appName !== CONFIG.appName) {
            clearSession();
            return null;
        }

        const currentFingerprint = await getDeviceFingerprint();
        if (session.hwid !== currentFingerprint) {
            clearSession();
            return null;
        }

        return session;
    }

    function buildAuthWidget(session) {
        const mount = document.getElementById('authWidgetMount');
        if (!mount || !session) return;

        const username = session.info && session.info.username ? session.info.username : 'Licencia activa';
        const hwidShort = String(session.hwid || '').slice(-8);
        mount.innerHTML = `
            <div class="auth-widget">
                <span class="auth-pill-soft"><i class="fas fa-shield-alt"></i> KeyAuth activo</span>
                <div class="auth-widget-info">
                    <div class="auth-widget-title">${escapeHtml(username)}</div>
                    <div class="auth-widget-meta">Key ${escapeHtml(session.keyMasked || '')} · HWID ${escapeHtml(hwidShort)}</div>
                </div>
                <button type="button" class="auth-logout-btn" id="authLogoutBtn"><i class="fas fa-sign-out-alt mr-1"></i>Salir</button>
            </div>
        `;

        const logoutBtn = document.getElementById('authLogoutBtn');
        if (logoutBtn) logoutBtn.addEventListener('click', logout);
    }

    function markReady() {
        document.body.classList.remove('auth-checking');
        document.body.classList.add('auth-ready');
    }

    async function protectPage() {
        const session = await validateCurrentSession();
        if (!session) {
            redirectToLogin();
            return;
        }
        buildAuthWidget(session);
        markReady();
    }

    function getNextPage() {
        const params = new URLSearchParams(location.search);
        const next = params.get('next') || CONFIG.redirectAfterLogin || 'index.html';
        return /login\.html/i.test(next) ? 'index.html' : next;
    }

    function setLoginStatus(message, type) {
        const status = document.getElementById('loginStatus');
        if (!status) return;
        status.textContent = message || '';
        status.className = 'login-status' + (type ? ' ' + type : '');
        status.style.display = message ? 'block' : 'none';
    }

    function fillLoginMeta() {
        const appNameNode = document.getElementById('loginAppName');
        if (appNameNode) appNameNode.textContent = CONFIG.appDisplayName || CONFIG.appName;
        const appSubtitle = document.getElementById('loginSubtitle');
        if (appSubtitle) {
            appSubtitle.textContent = configReady()
                ? 'Acceso con key única y bloqueo por dispositivo.'
                : 'Completa ownerid en keyauth-config.js para activar KeyAuth.';
        }
        const appMeta = document.getElementById('loginMeta');
        if (appMeta) {
            appMeta.textContent = 'App: ' + CONFIG.appName + ' · Versión: ' + (CONFIG.version || '1.0');
        }
    }

    async function handleLoginSubmit(event) {
        event.preventDefault();
        const input = document.getElementById('licenseKeyInput');
        const button = document.getElementById('loginSubmitBtn');
        const key = input ? input.value.trim() : '';

        if (!key) {
            setLoginStatus('Ingresa tu key.', 'error');
            return;
        }

        try {
            if (button) {
                button.disabled = true;
                button.innerHTML = '<span class="spinner-mini"></span> Verificando...';
            }
            setLoginStatus('');
            await loginWithLicense(key);
            setLoginStatus('Acceso correcto. Redirigiendo...', 'success');
            setTimeout(() => {
                location.href = getNextPage();
            }, 500);
        } catch (error) {
            setLoginStatus(error.message || 'No se pudo iniciar sesión.', 'error');
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = 'Entrar al panel <i class="fas fa-arrow-right ml-2"></i>';
            }
        }
    }

    async function initLoginPage() {
        fillLoginMeta();
        const session = await validateCurrentSession();
        if (session) {
            location.href = getNextPage();
            return;
        }
        const form = document.getElementById('licenseLoginForm');
        if (form) form.addEventListener('submit', handleLoginSubmit);
        markReady();
    }

    function logout() {
        clearSession();
        redirectToLogin('logout=1');
    }

    window.WebOwnerAuth = {
        loginWithLicense,
        validateCurrentSession,
        getDeviceFingerprint,
        logout
    };

    document.addEventListener('DOMContentLoaded', function () {
        if (isLoginPage) {
            initLoginPage().catch(function (error) {
                setLoginStatus(error.message || 'Error al preparar el login.', 'error');
                markReady();
            });
        } else {
            protectPage().catch(function () {
                redirectToLogin();
            });
        }
    });
})();