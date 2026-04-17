(function () {
    const STORAGE_KEYS = {
        items: 'mi_sistema_items_inventory',
        rauda: 'mi_sistema_rauda_inventory',
        clients: 'mi_sistema_clients',
        caex: 'mi_sistema_caex_shipments',
        salesEncuentro: 'mi_sistema_sales_encuentro',
        salesMoto: 'mi_sistema_sales_moto',
        salesCaex: 'mi_sistema_sales_caex'
    };

    const TOKEN_LOCAL_KEY = 'webowneradmin_github_token_local';
    const TOKEN_SESSION_KEY = 'webowneradmin_github_token_session';
    const CONFIG_KEY = 'webowneradmin_github_sync_config';
    const META_KEY = 'webowneradmin_github_sync_meta';
    const DEFAULT_CONFIG = {
        owner: 'CatalogosHN',
        repo: 'INVOFICIAL',
        branch: 'main',
        path: 'data/webowneradmin-store.json',
        rememberToken: false
    };

    let initialized = false;
    let syncTimer = null;
    let syncInFlight = false;
    let toastHandler = null;
    let dataAppliedCallbacks = [];
    let statusText = 'Token pendiente. Tus datos siguen funcionando en este dispositivo.';
    let statusType = 'idle';

    function readJsonStorage(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function writeJsonStorage(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function readConfig() {
        return Object.assign({}, DEFAULT_CONFIG, readJsonStorage(CONFIG_KEY, {}) || {});
    }

    function getToken() {
        return localStorage.getItem(TOKEN_LOCAL_KEY) || sessionStorage.getItem(TOKEN_SESSION_KEY) || '';
    }

    function hasToken() {
        return Boolean(getToken().trim());
    }

    function saveToken(token, rememberToken) {
        const clean = String(token || '').trim();
        const config = readConfig();
        config.rememberToken = Boolean(rememberToken);
        writeJsonStorage(CONFIG_KEY, config);

        localStorage.removeItem(TOKEN_LOCAL_KEY);
        sessionStorage.removeItem(TOKEN_SESSION_KEY);

        if (clean) {
            if (rememberToken) {
                localStorage.setItem(TOKEN_LOCAL_KEY, clean);
            } else {
                sessionStorage.setItem(TOKEN_SESSION_KEY, clean);
            }
        }
        updatePanels();
    }

    function clearToken() {
        localStorage.removeItem(TOKEN_LOCAL_KEY);
        sessionStorage.removeItem(TOKEN_SESSION_KEY);
        const config = readConfig();
        config.rememberToken = false;
        writeJsonStorage(CONFIG_KEY, config);
        setMeta({ lastSyncText: 'Sin sincronizar todavía', lastSyncISO: '' });
        emitStatus('Token eliminado de este dispositivo.', 'idle');
        updatePanels();
    }

    function readMeta() {
        return readJsonStorage(META_KEY, { lastSyncText: 'Sin sincronizar todavía', lastSyncISO: '' }) || { lastSyncText: 'Sin sincronizar todavía', lastSyncISO: '' };
    }

    function setMeta(meta) {
        writeJsonStorage(META_KEY, Object.assign({}, readMeta(), meta || {}));
        updatePanels();
    }

    function formatNowText() {
        return new Date().toLocaleString('es-HN');
    }

    function emitStatus(message, type) {
        statusText = message || '';
        statusType = type || 'idle';
        updatePanels();
    }

    function notify(message) {
        if (typeof toastHandler === 'function') {
            toastHandler(message);
        }
    }

    function getRepoDescriptor() {
        const config = readConfig();
        return `${config.owner}/${config.repo} · ${config.path}`;
    }

    function authHeaders(token) {
        return {
            'Accept': 'application/vnd.github+json',
            'Authorization': 'Bearer ' + token,
            'X-GitHub-Api-Version': '2022-11-28'
        };
    }

    function getContentsUrl() {
        const config = readConfig();
        return `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${config.path}`;
    }

    function bytesToBase64(bytes) {
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
            const sub = bytes.subarray(i, i + chunk);
            binary += String.fromCharCode.apply(null, sub);
        }
        return btoa(binary);
    }

    function utf8ToBase64(text) {
        return bytesToBase64(new TextEncoder().encode(text));
    }

    function base64ToUtf8(base64) {
        const binary = atob(base64.replace(/\n/g, ''));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new TextDecoder().decode(bytes);
    }

    async function githubFetch(pathSuffix = '', options = {}) {
        const token = getToken().trim();
        if (!token) throw new Error('Primero guarda tu token de GitHub en este dispositivo.');
        const response = await fetch(getContentsUrl() + pathSuffix, {
            method: options.method || 'GET',
            headers: Object.assign({}, authHeaders(token), options.headers || {}),
            body: options.body,
            cache: 'no-store'
        });

        let data = null;
        try {
            data = await response.json();
        } catch (error) {
            data = null;
        }

        if (!response.ok) {
            const msg = data && (data.message || data.error) ? String(data.message || data.error) : `GitHub devolvió ${response.status}`;
            const error = new Error(msg);
            error.status = response.status;
            throw error;
        }

        return data;
    }

    function readLocalArray(key) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || '[]');
            return Array.isArray(value) ? value : [];
        } catch (error) {
            return [];
        }
    }

    function snapshotLocalData() {
        return {
            version: 1,
            app: 'WebOwnerAdmin',
            updatedAtISO: new Date().toISOString(),
            updatedAtText: formatNowText(),
            items: readLocalArray(STORAGE_KEYS.items),
            rauda: readLocalArray(STORAGE_KEYS.rauda),
            clients: readLocalArray(STORAGE_KEYS.clients),
            caex: readLocalArray(STORAGE_KEYS.caex),
            salesEncuentro: readLocalArray(STORAGE_KEYS.salesEncuentro),
            salesMoto: readLocalArray(STORAGE_KEYS.salesMoto),
            salesCaex: readLocalArray(STORAGE_KEYS.salesCaex)
        };
    }

    function applyRemotePayload(payload) {
        const safe = payload || {};
        Object.entries(STORAGE_KEYS).forEach(([name, storageKey]) => {
            const arr = Array.isArray(safe[name]) ? safe[name] : [];
            localStorage.setItem(storageKey, JSON.stringify(arr));
        });
    }

    function invokeDataApplied() {
        dataAppliedCallbacks.forEach(cb => {
            try { cb(); } catch (error) { console.warn(error); }
        });
        window.dispatchEvent(new CustomEvent('webowner-sync-data-applied'));
    }

    function buildCommitMessage(prefix) {
        return `${prefix} · ${new Date().toISOString()}`;
    }

    async function fetchRemoteFileMeta() {
        const config = readConfig();
        const query = `?ref=${encodeURIComponent(config.branch)}`;
        try {
            return await githubFetch(query);
        } catch (error) {
            if (error.status === 404) return null;
            throw error;
        }
    }

    async function loadRemoteData(options = {}) {
        emitStatus('Cargando datos desde GitHub...', 'loading');
        const remote = await fetchRemoteFileMeta();
        if (!remote) {
            emitStatus('Aún no existe archivo remoto. Usa “Guardar todo en nube” para crearlo.', 'idle');
            if (!options.silentMissing) notify('Aún no hay respaldo remoto creado.');
            return null;
        }

        const decoded = base64ToUtf8(remote.content || '');
        let payload = null;
        try {
            payload = JSON.parse(decoded);
        } catch (error) {
            throw new Error('El archivo remoto no contiene JSON válido.');
        }

        applyRemotePayload(payload);
        setMeta({
            lastSyncText: `Cargado desde GitHub · ${formatNowText()}`,
            lastSyncISO: new Date().toISOString(),
            remoteUpdatedAtISO: payload.updatedAtISO || '',
            remoteSha: remote.sha || ''
        });
        emitStatus('Datos cargados desde GitHub correctamente.', 'success');
        if (!options.silentSuccess) notify('Datos cargados desde GitHub.');
        invokeDataApplied();
        return payload;
    }

    async function pushLocalData(options = {}) {
        if (syncInFlight) return null;
        syncInFlight = true;
        emitStatus('Guardando datos en GitHub...', 'loading');
        try {
            const config = readConfig();
            const payload = snapshotLocalData();
            const remote = await fetchRemoteFileMeta();
            const body = {
                message: buildCommitMessage('WebOwnerAdmin sync'),
                content: utf8ToBase64(JSON.stringify(payload, null, 2)),
                branch: config.branch
            };
            if (remote && remote.sha) body.sha = remote.sha;
            const result = await githubFetch('', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            setMeta({
                lastSyncText: `Guardado en GitHub · ${formatNowText()}`,
                lastSyncISO: new Date().toISOString(),
                remoteUpdatedAtISO: payload.updatedAtISO,
                remoteSha: result && result.content ? result.content.sha : ''
            });
            emitStatus('Datos guardados en GitHub correctamente.', 'success');
            if (!options.silentSuccess) notify('Datos guardados en GitHub.');
            window.dispatchEvent(new CustomEvent('webowner-sync-data-pushed'));
            return result;
        } finally {
            syncInFlight = false;
        }
    }

    function queueAutoSync() {
        if (!initialized || !hasToken()) return;
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => {
            pushLocalData({ silentSuccess: true }).catch(error => {
                emitStatus(error.message || 'No se pudo guardar en GitHub.', 'error');
            });
        }, 900);
    }

    function bindPanel(panel) {
        if (!panel || panel.dataset.syncBound === '1') return;
        panel.dataset.syncBound = '1';

        const tokenInput = panel.querySelector('[data-sync-field="token"]');
        const rememberInput = panel.querySelector('[data-sync-field="remember"]');

        panel.querySelectorAll('[data-sync-action="toggle-token"]').forEach(button => {
            button.addEventListener('click', () => {
                if (!tokenInput) return;
                const show = tokenInput.type === 'password';
                tokenInput.type = show ? 'text' : 'password';
                button.innerHTML = `<i class="fas ${show ? 'fa-eye-slash' : 'fa-eye'}"></i>`;
            });
        });

        panel.querySelectorAll('[data-sync-action="save-config"]').forEach(button => {
            button.addEventListener('click', async () => {
                const token = tokenInput ? tokenInput.value.trim() : '';
                if (!token && !hasToken()) {
                    emitStatus('Escribe el token antes de guardarlo.', 'error');
                    return;
                }
                saveToken(token || getToken(), rememberInput && rememberInput.checked);
                emitStatus('Token listo en este dispositivo.', 'success');
                notify('Token preparado en este dispositivo.');
                try {
                    await loadRemoteData({ silentMissing: true, silentSuccess: true });
                } catch (error) {
                    emitStatus(error.message || 'No se pudo leer GitHub.', 'error');
                }
            });
        });

        panel.querySelectorAll('[data-sync-action="load-remote"]').forEach(button => {
            button.addEventListener('click', async () => {
                try {
                    await loadRemoteData();
                } catch (error) {
                    emitStatus(error.message || 'No se pudo cargar desde GitHub.', 'error');
                }
            });
        });

        panel.querySelectorAll('[data-sync-action="push-remote"]').forEach(button => {
            button.addEventListener('click', async () => {
                try {
                    await pushLocalData();
                } catch (error) {
                    emitStatus(error.message || 'No se pudo guardar en GitHub.', 'error');
                }
            });
        });

        panel.querySelectorAll('[data-sync-action="clear-token"]').forEach(button => {
            button.addEventListener('click', () => {
                if (tokenInput) tokenInput.value = '';
                if (rememberInput) rememberInput.checked = false;
                clearToken();
                notify('Token eliminado de este dispositivo.');
            });
        });
    }

    function updatePanels() {
        const config = readConfig();
        const token = getToken();
        const meta = readMeta();
        document.querySelectorAll('.github-sync-panel').forEach(panel => {
            bindPanel(panel);
            const tokenInput = panel.querySelector('[data-sync-field="token"]');
            const rememberInput = panel.querySelector('[data-sync-field="remember"]');
            const repoOutput = panel.querySelector('[data-sync-output="repo"]');
            const statusOutput = panel.querySelector('[data-sync-output="status"]');
            const lastSyncOutput = panel.querySelector('[data-sync-output="last-sync"]');
            const chipOutput = panel.querySelector('[data-sync-output="chip"]');

            if (tokenInput && document.activeElement !== tokenInput) tokenInput.value = token;
            if (rememberInput) rememberInput.checked = Boolean(config.rememberToken);
            if (repoOutput) repoOutput.textContent = getRepoDescriptor();
            if (statusOutput) statusOutput.textContent = statusText;
            if (lastSyncOutput) lastSyncOutput.textContent = meta.lastSyncText || 'Sin sincronizar todavía';
            if (chipOutput) {
                chipOutput.textContent = hasToken() ? (statusType === 'success' ? 'GitHub listo' : statusType === 'loading' ? 'Sincronizando...' : statusType === 'error' ? 'Revisar GitHub' : 'GitHub conectado') : 'Token pendiente';
                chipOutput.className = `sync-status-chip ${statusType}`;
                if (!hasToken()) chipOutput.className = 'sync-status-chip idle';
            }
        });
    }

    async function init(options = {}) {
        if (typeof options.onToast === 'function') toastHandler = options.onToast;
        if (typeof options.onDataApplied === 'function') dataAppliedCallbacks.push(options.onDataApplied);

        initialized = true;
        updatePanels();

        if (hasToken()) {
            try {
                await loadRemoteData({ silentSuccess: true, silentMissing: true });
            } catch (error) {
                emitStatus(error.message || 'No se pudo conectar con GitHub.', 'error');
            }
        } else {
            emitStatus('Token pendiente. Tus datos siguen funcionando en este dispositivo.', 'idle');
        }
    }

    window.WebOwnerSync = {
        init,
        queueAutoSync,
        loadRemoteData,
        pushLocalData,
        clearToken,
        getConfig: readConfig,
        hasToken,
        getToken
    };
})();
