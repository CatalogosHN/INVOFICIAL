        const STORAGE_KEYS = {
            items: 'mi_sistema_items_inventory',
            rauda: 'mi_sistema_rauda_inventory',
            clients: 'mi_sistema_clients',
            caex: 'mi_sistema_caex_shipments',
            salesEncuentro: 'mi_sistema_sales_encuentro',
            salesMoto: 'mi_sistema_sales_moto',
            salesCaex: 'mi_sistema_sales_caex'
        };

        let tempCaexLineItems = [];
        const evidenceUploadState = {};
        const MONEY_FORMATTER = new Intl.NumberFormat('es-HN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        const editState = {
            items: null,
            rauda: null,
            client: null,
            caex: null,
            encuentro: null,
            moto: null,
            ventaCaex: null
        };
        const uploadRemoveFlags = {
            itemsPhoto: false,
            raudaPhoto: false,
            caexReceipt: false
        };

        function isMobileView() {
            return window.innerWidth <= 991;
        }

        function setFabState() {
            const fab = document.getElementById('mobileMenuFab');
            const sidebar = document.getElementById('sidebar');
            const backdrop = document.getElementById('sidebarBackdrop');
            if (!fab || !sidebar || !backdrop) return;
            const open = sidebar.classList.contains('active');
            fab.classList.toggle('is-open', open);
            fab.innerHTML = `<i class="fas ${open ? 'fa-times' : 'fa-bars'}"></i>`;
            backdrop.classList.toggle('show', open && isMobileView());
            document.body.classList.toggle('menu-open', open && isMobileView());
        }

        function openMenu() {
            document.getElementById('sidebar').classList.add('active');
            setFabState();
        }

        function closeMenu() {
            document.getElementById('sidebar').classList.remove('active');
            setFabState();
        }

        function toggleMenu() {
            document.getElementById('sidebar').classList.toggle('active');
            setFabState();
        }

        function sortRecordsByDate(list) {
            if (!Array.isArray(list)) return [];
            return [...list].sort((a, b) => {
                const aDate = getSortableDate(a);
                const bDate = getSortableDate(b);
                return bDate - aDate;
            });
        }

        function readStore(key) {
            try {
                const value = JSON.parse(localStorage.getItem(key)) || [];
                return Array.isArray(value) ? sortRecordsByDate(value) : [];
            } catch (error) {
                return [];
            }
        }

        function saveStore(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                if (window.WebOwnerSync) window.WebOwnerSync.queueAutoSync();
                return true;
            } catch (error) {
                console.error('No se pudo guardar en localStorage:', error);
                const isQuota = error && (error.name === 'QuotaExceededError' || error.code === 22 || error.code === 1014);
                const msg = isQuota
                    ? 'No se pudo guardar porque la imagen pesaba demasiado. Ahora la página comprime las fotos; intenta quitar esa foto y volverla a pegar/subir.'
                    : 'No se pudo guardar el registro. Revisa la consola para más detalle.';
                if (typeof showToast === 'function') showToast(msg);
                alert(msg);
                throw error;
            }
        }

        function generateId(prefix = 'id') {
            if (window.crypto && typeof window.crypto.randomUUID === 'function') {
                return `${prefix}_${window.crypto.randomUUID()}`;
            }
            return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        }

        function nowText() {
            return new Date().toLocaleString('es-HN');
        }

        function nowIso() {
            return new Date().toISOString();
        }

        function todayDateValue() {
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            return now.toISOString().slice(0, 10);
        }

        function parseLocalDate(value) {
            if (!value) return null;
            if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
                return new Date(`${value}T00:00:00`);
            }
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        function normalizeRecordDate(value) {
            return String(value || '').trim() || todayDateValue();
        }

        function formatDateOnly(value) {
            if (!value) return '-';
            const parsed = parseLocalDate(value);
            if (!parsed) return escapeHtml(value);
            return parsed.toLocaleDateString('es-HN');
        }

        function getRecordDateValue(record) {
            return record?.recordDate || record?.eventDate || record?.saleDate || record?.expenseDate || record?.createdAtISO || record?.createdAt || '';
        }

        function getRecordDateText(record) {
            return record?.recordDateText || formatDateOnly(getRecordDateValue(record));
        }

        function getCaptureText(record) {
            return record?.receivedAt || record?.createdAt || '-';
        }

        function getSortableDate(record) {
            const parsed = parseLocalDate(getRecordDateValue(record));
            return parsed ? parsed.getTime() : 0;
        }

        function makeDateMeta(recordDateValue) {
            const recordDate = normalizeRecordDate(recordDateValue);
            const receivedAt = nowText();
            const receivedAtISO = nowIso();
            return {
                recordDate,
                recordDateText: formatDateOnly(recordDate),
                receivedAt,
                receivedAtISO,
                createdAt: receivedAt,
                createdAtISO: receivedAtISO
            };
        }


        function formatDateInput(value) {
            const parsed = parseLocalDate(value);
            if (!parsed) return todayDateValue();
            const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
            return local.toISOString().slice(0, 10);
        }

        function makePersistedMeta(existing, recordDateValue, editLabel = 'Registro editado') {
            const dateMeta = makeDateMeta(recordDateValue);
            if (!existing) return dateMeta;
            const editedAt = nowText();
            const editedAtISO = nowIso();
            const previousHistory = Array.isArray(existing.editHistory) ? existing.editHistory : [];
            return {
                recordDate: dateMeta.recordDate,
                recordDateText: dateMeta.recordDateText,
                receivedAt: existing.receivedAt || existing.createdAt || dateMeta.receivedAt,
                receivedAtISO: existing.receivedAtISO || existing.createdAtISO || dateMeta.receivedAtISO,
                createdAt: existing.createdAt || existing.receivedAt || dateMeta.createdAt,
                createdAtISO: existing.createdAtISO || existing.receivedAtISO || dateMeta.createdAtISO,
                updatedAt: editedAt,
                updatedAtISO: editedAtISO,
                editCount: Number(existing.editCount || 0) + 1,
                editHistory: previousHistory.concat([{ at: editedAt, atISO: editedAtISO, action: editLabel }])
            };
        }

        function editBadge(record) {
            if (!record || !record.updatedAt) return '';
            const count = Number(record.editCount || 1);
            return `<div class="mt-1"><span class="pill pill-warning">Editado${count > 1 ? ' x' + count : ''}</span></div>`;
        }

        function renderAuditRows(record) {
            if (!record || !record.updatedAt) {
                return '<div class="detail-row"><span class="detail-label">Ediciones</span><div>Sin ediciones</div></div>';
            }
            const count = Number(record.editCount || 1);
            return `
                <div class="detail-row"><span class="detail-label">Última edición</span><div>${escapeHtml(record.updatedAt)}</div></div>
                <div class="detail-row"><span class="detail-label">Cantidad de ediciones</span><div>${count}</div></div>
            `;
        }

        function setSubmitButtonText(formId, text) {
            const form = document.getElementById(formId);
            const button = form ? form.querySelector('button[type="submit"]') : null;
            if (button) button.innerHTML = text;
        }

        function ensureCancelButton(formId, sectionKey) {
            const form = document.getElementById(formId);
            if (!form || document.getElementById(`${formId}CancelEdit`)) return;
            const submit = form.querySelector('button[type="submit"]');
            if (!submit) return;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = `${formId}CancelEdit`;
            btn.className = 'btn btn-outline-soft btn-block mt-2';
            btn.style.display = 'none';
            btn.innerHTML = '<i class="fas fa-times mr-1"></i>Cancelar edición';
            btn.addEventListener('click', () => cancelEdit(sectionKey));
            submit.insertAdjacentElement('afterend', btn);
        }

        function setCancelVisible(formId, visible) {
            const btn = document.getElementById(`${formId}CancelEdit`);
            if (btn) btn.style.display = visible ? 'block' : 'none';
        }

        function scrollToSection(id) {
            const section = document.getElementById(id);
            if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (isMobileView()) closeMenu();
        }

        function resetItemsForm() {
            document.getElementById('itemsForm').reset();
            clearUploadSelection('itemsPhoto', false);
            clearEvidenceUpload('itemsPhotos', false);
            editState.items = null;
            setSubmitButtonText('itemsForm', 'Guardar en Items');
            setCancelVisible('itemsForm', false);
            applyDefaultRecordDates();
        }

        function resetRaudaForm() {
            document.getElementById('raudaForm').reset();
            clearUploadSelection('raudaPhoto', false);
            clearEvidenceUpload('raudaPhotos', false);
            editState.rauda = null;
            setSubmitButtonText('raudaForm', 'Guardar en Rauda');
            setCancelVisible('raudaForm', false);
            applyDefaultRecordDates();
        }

        function resetClientForm() {
            document.getElementById('clientsForm').reset();
            clearEvidenceUpload('clientPhotos', false);
            editState.client = null;
            setSubmitButtonText('clientsForm', 'Guardar cliente');
            setCancelVisible('clientsForm', false);
            applyDefaultRecordDates();
        }

        function resetCaexForm() {
            document.getElementById('caexForm').reset();
            clearUploadSelection('caexReceipt', false);
            clearEvidenceUpload('caexPhotos', false);
            editState.caex = null;
            document.getElementById('caexModeExisting').checked = true;
            updateCaexMode();
            setSubmitButtonText('caexForm', 'Guardar envío CAEX');
            setCancelVisible('caexForm', false);
            applyDefaultRecordDates();
        }

        function resetEncuentroForm() {
            document.getElementById('encuentroForm').reset();
            clearEvidenceUpload('encuentroPhotos', false);
            editState.encuentro = null;
            setSubmitButtonText('encuentroForm', 'Guardar venta Encuentro');
            setCancelVisible('encuentroForm', false);
            applyDefaultRecordDates();
        }

        function resetMotoForm() {
            document.getElementById('motoForm').reset();
            clearEvidenceUpload('motoPhotos', false);
            editState.moto = null;
            setSubmitButtonText('motoForm', 'Guardar venta Moto');
            setCancelVisible('motoForm', false);
            applyDefaultRecordDates();
        }

        function resetVentaCaexForm() {
            document.getElementById('ventaCaexForm').reset();
            editState.ventaCaex = null;
            tempCaexLineItems = [];
            clearEvidenceUpload('ventaCaexPhotos', false);
            updatePaymentMode();
            renderTempLineItems();
            setSubmitButtonText('ventaCaexForm', 'Guardar venta CAEX');
            setCancelVisible('ventaCaexForm', false);
            applyDefaultRecordDates();
            renderVentaCaexClientInfo();
        }

        function cancelEdit(sectionKey) {
            if (sectionKey === 'items') resetItemsForm();
            if (sectionKey === 'rauda') resetRaudaForm();
            if (sectionKey === 'client') resetClientForm();
            if (sectionKey === 'caex') resetCaexForm();
            if (sectionKey === 'encuentro') resetEncuentroForm();
            if (sectionKey === 'moto') resetMotoForm();
            if (sectionKey === 'ventaCaex') resetVentaCaexForm();
            showToast('Edición cancelada.');
        }

        function applyDefaultRecordDates() {
            [
                'itemsRecordDate',
                'raudaRecordDate',
                'clientRecordDate',
                'caexRecordDate',
                'encuentroRecordDate',
                'motoRecordDate',
                'ventaCaexRecordDate'
            ].forEach(id => {
                const input = document.getElementById(id);
                if (input && !input.value) input.value = todayDateValue();
            });
        }


        function escapeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function roundMoney(value) {
            const number = Number(String(value ?? '').replace(/,/g, ''));
            if (!Number.isFinite(number)) return 0;
            return Math.round((number + Number.EPSILON) * 100) / 100;
        }

        function formatMoney(value) {
            if (value === '' || value === null || value === undefined) return '-';
            const number = roundMoney(value);
            return 'L ' + MONEY_FORMATTER.format(number);
        }

        function moneyInputValue(value) {
            if (value === '' || value === null || value === undefined || Number.isNaN(Number(value))) return '';
            return roundMoney(value).toFixed(2);
        }

        function readMoneyValue(inputId) {
            const input = document.getElementById(inputId);
            return roundMoney(input ? input.value : 0);
        }

        function paymentTotal(payment) {
            if (!payment) return 0;
            return payment.fullPrepaid
                ? roundMoney(payment.fullAmount || 0)
                : roundMoney(roundMoney(payment.advance || 0) + roundMoney(payment.payOnDelivery || 0));
        }

        function getPhones(phone1, phone2, phone3) {
            return [phone1, phone2, phone3].map(v => (v || '').trim()).filter(Boolean);
        }

        function readFileAsRawDataUrl(file) {
            return new Promise(resolve => {
                if (!file) {
                    resolve('');
                    return;
                }
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ''));
                reader.onerror = () => resolve('');
                reader.readAsDataURL(file);
            });
        }

        function loadImageFromDataUrl(dataUrl) {
            return new Promise(resolve => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = () => resolve(null);
                image.src = dataUrl;
            });
        }

        async function fileToDataUrl(file, options = {}) {
            if (!file) return '';
            const type = String(file.type || '').toLowerCase();
            const raw = await readFileAsRawDataUrl(file);
            if (!raw || !type.startsWith('image/')) return raw;

            const maxSize = Number(options.maxSize || 1280);
            const quality = Number(options.quality || 0.76);
            const image = await loadImageFromDataUrl(raw);
            if (!image || !image.width || !image.height) return raw;

            let width = image.width;
            let height = image.height;
            const scale = Math.min(1, maxSize / Math.max(width, height));
            width = Math.max(1, Math.round(width * scale));
            height = Math.max(1, Math.round(height * scale));

            try {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d', { alpha: false });
                ctx.drawImage(image, 0, 0, width, height);
                const compressed = canvas.toDataURL('image/jpeg', quality);
                return compressed && compressed.length < raw.length ? compressed : raw;
            } catch (error) {
                console.warn('No se pudo comprimir la imagen, se usará original.', error);
                return raw;
            }
        }

        function openUploadPicker(inputId) {
            const mainId = String(inputId || '').replace('Camera', '');
            if (mainId) window.__lastFocusedUploader = mainId;
            const input = document.getElementById(inputId);
            if (input) input.click();
        }

        function setInputFile(input, file) {
            if (!input || !file) return;
            try {
                const transfer = new DataTransfer();
                transfer.items.add(file);
                input.files = transfer.files;
            } catch (error) {
                console.warn('No se pudo asignar el archivo al input.', error);
            }
        }

        function updateUploadPreview(mainInputId, file) {
            const preview = document.getElementById(mainInputId + 'Preview');
            const img = document.getElementById(mainInputId + 'PreviewImg');
            const icon = document.getElementById(mainInputId + 'PreviewIcon');
            const name = document.getElementById(mainInputId + 'PreviewName');

            if (!preview || !img || !icon || !name) return;

            if (!file) {
                preview.classList.remove('show');
                img.style.display = 'none';
                icon.style.display = 'none';
                img.removeAttribute('src');
                name.textContent = 'Sin archivo';
                return;
            }

            preview.classList.add('show');
            name.textContent = file.name || 'Archivo seleccionado';

            if ((file.type || '').startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = () => {
                    img.src = String(reader.result || '');
                    img.style.display = 'block';
                    icon.style.display = 'none';
                };
                reader.onerror = () => {
                    img.style.display = 'none';
                    icon.innerHTML = '<i class="fas fa-image"></i>';
                    icon.style.display = 'inline-flex';
                };
                reader.readAsDataURL(file);
            } else {
                img.style.display = 'none';
                icon.innerHTML = '<i class="fas fa-file-pdf"></i>';
                icon.style.display = 'inline-flex';
            }
        }

        function clearUploadSelection(mainInputId, markRemoved = true) {
            if (Object.prototype.hasOwnProperty.call(uploadRemoveFlags, mainInputId)) {
                uploadRemoveFlags[mainInputId] = Boolean(markRemoved);
            }
            const mainInput = document.getElementById(mainInputId);
            const cameraInput = document.getElementById(mainInputId + 'Camera');
            if (mainInput) mainInput.value = '';
            if (cameraInput) cameraInput.value = '';
            updateUploadPreview(mainInputId, null);
        }

        function clearUpload(mainInputId) {
            clearUploadSelection(mainInputId, true);
        }

        function showExistingUploadPreview(mainInputId, source, label = 'Archivo actual') {
            if (Object.prototype.hasOwnProperty.call(uploadRemoveFlags, mainInputId)) {
                uploadRemoveFlags[mainInputId] = false;
            }
            const preview = document.getElementById(mainInputId + 'Preview');
            const img = document.getElementById(mainInputId + 'PreviewImg');
            const icon = document.getElementById(mainInputId + 'PreviewIcon');
            const name = document.getElementById(mainInputId + 'PreviewName');
            if (!preview || !img || !icon || !name) return;
            if (!source) {
                clearUploadSelection(mainInputId, false);
                return;
            }
            preview.classList.add('show');
            name.textContent = label;
            if (/^data:image\//.test(source) || /\.(png|jpe?g|webp|gif)$/i.test(source)) {
                img.src = source;
                img.style.display = 'block';
                icon.style.display = 'none';
            } else {
                img.style.display = 'none';
                img.removeAttribute('src');
                icon.innerHTML = '<i class="fas fa-file"></i>';
                icon.style.display = 'inline-flex';
            }
        }

        function handleSmartUploadFile(mainInputId, file, fromPaste = false) {
            if (!file) return;
            const mainInput = document.getElementById(mainInputId);
            if (!mainInput) return;
            if (Object.prototype.hasOwnProperty.call(uploadRemoveFlags, mainInputId)) {
                uploadRemoveFlags[mainInputId] = false;
            }
            setInputFile(mainInput, file);
            updateUploadPreview(mainInputId, file);
            if (fromPaste) {
                showToast('Imagen pegada correctamente.');
            }
        }

        function setupSmartUploader(mainInputId, options = {}) {
            const zone = document.getElementById(mainInputId + 'Zone');
            const mainInput = document.getElementById(mainInputId);
            const cameraInput = document.getElementById(mainInputId + 'Camera');
            const wrapper = document.getElementById((options.wrapperId || mainInputId + 'Uploader'));

            if (!zone || !mainInput || !wrapper) return;

            const acceptedPaste = options.acceptedPaste || 'image';

            zone.addEventListener('click', () => {
                window.__lastFocusedUploader = mainInputId;
                zone.focus();
                wrapper.classList.add('is-focus');
                openUploadPicker(mainInputId);
            });

            zone.addEventListener('focus', () => {
                window.__lastFocusedUploader = mainInputId;
                wrapper.classList.add('is-focus');
            });
            zone.addEventListener('blur', () => wrapper.classList.remove('is-focus'));

            zone.addEventListener('dragover', event => {
                event.preventDefault();
                zone.classList.add('dragover');
            });

            zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
            zone.addEventListener('drop', event => {
                event.preventDefault();
                zone.classList.remove('dragover');
                const file = event.dataTransfer?.files?.[0];
                if (!file) return;
                if (acceptedPaste === 'image' && !(file.type || '').startsWith('image/')) {
                    showToast('Aquí solo se permiten imágenes.');
                    return;
                }
                handleSmartUploadFile(mainInputId, file, false);
            });

            zone.addEventListener('paste', event => {
                const items = Array.from(event.clipboardData?.items || []);
                const imageItem = items.find(item => (item.type || '').startsWith('image/'));
                if (!imageItem) {
                    if (acceptedPaste === 'image') showToast('No se detectó imagen para pegar.');
                    return;
                }
                event.preventDefault();
                const file = imageItem.getAsFile();
                if (file) {
                    const ext = (file.type || 'image/png').split('/')[1] || 'png';
                    const renamed = new File([file], `pegado-${Date.now()}.${ext}`, { type: file.type || 'image/png' });
                    handleSmartUploadFile(mainInputId, renamed, true);
                }
            });

            mainInput.addEventListener('change', () => updateUploadPreview(mainInputId, mainInput.files?.[0] || null));
            if (cameraInput) {
                cameraInput.addEventListener('change', () => {
                    const file = cameraInput.files?.[0];
                    if (!file) return;
                    handleSmartUploadFile(mainInputId, file, false);
                    cameraInput.value = '';
                });
            }
        }

        function evidenceState(inputId) {
            if (!evidenceUploadState[inputId]) {
                evidenceUploadState[inputId] = { files: [], existing: [], removed: false };
            }
            return evidenceUploadState[inputId];
        }

        function normalizePhotos(record) {
            if (!record) return [];
            const photos = [];
            if (Array.isArray(record.photos)) photos.push(...record.photos);
            if (Array.isArray(record.attachments)) photos.push(...record.attachments);
            return photos.filter(Boolean);
        }

        function countPhotos(record) {
            return normalizePhotos(record).length + (record && record.photo ? 1 : 0) + (record && record.receipt ? 1 : 0);
        }

        function photoCountBadge(record) {
            const count = countPhotos(record);
            return count ? `<div class="mt-1"><span class="pill pill-info"><i class="fas fa-images mr-1"></i>${count} foto${count === 1 ? '' : 's'}</span></div>` : '';
        }

        function renderPhotoGallery(photos, title = 'Fotos guardadas') {
            const clean = (photos || []).filter(Boolean);
            if (!clean.length) return '';
            return `
                <div class="detail-row">
                    <span class="detail-label">${escapeHtml(title)}</span>
                    <div class="evidence-gallery">
                        ${clean.map((photo, index) => `<a href="${photo}" target="_blank" rel="noopener noreferrer"><img src="${photo}" alt="Foto ${index + 1}"></a>`).join('')}
                    </div>
                </div>
            `;
        }

        function renderEvidencePreview(inputId) {
            const state = evidenceState(inputId);
            const preview = document.getElementById(inputId + 'Preview');
            const list = document.getElementById(inputId + 'PreviewList');
            if (!preview || !list) return;

            const existing = state.removed ? [] : state.existing;
            const files = state.files || [];
            if (!existing.length && !files.length) {
                preview.classList.remove('show');
                list.innerHTML = '';
                return;
            }

            preview.classList.add('show');
            const existingHtml = existing.map((src, index) => `
                <div class="evidence-thumb">
                    <img src="${src}" alt="Foto guardada ${index + 1}">
                    <span>Guardada</span>
                </div>
            `).join('');
            const filesHtml = files.map((file, index) => `
                <div class="evidence-thumb">
                    <span class="evidence-thumb-icon"><i class="fas fa-image"></i></span>
                    <span>${escapeHtml(file.name || `Nueva foto ${index + 1}`)}</span>
                </div>
            `).join('');
            list.innerHTML = existingHtml + filesHtml;
        }

        function appendEvidenceFiles(inputId, fileList, fromPaste = false) {
            const files = Array.from(fileList || []).filter(file => (file.type || '').startsWith('image/'));
            if (!files.length) {
                showToast('Aquí solo se permiten imágenes.');
                return;
            }
            const state = evidenceState(inputId);
            state.files = state.files.concat(files).slice(0, 12);
            state.removed = false;
            renderEvidencePreview(inputId);
            showToast(fromPaste ? 'Imagen pegada correctamente.' : 'Imagen agregada correctamente.');
        }

        function clearEvidenceUpload(inputId, markRemoved = true) {
            const state = evidenceState(inputId);
            state.files = [];
            state.existing = markRemoved ? [] : (state.existing || []);
            state.removed = Boolean(markRemoved);
            const mainInput = document.getElementById(inputId);
            const cameraInput = document.getElementById(inputId + 'Camera');
            if (mainInput) mainInput.value = '';
            if (cameraInput) cameraInput.value = '';
            renderEvidencePreview(inputId);
        }

        function showExistingEvidence(inputId, photos) {
            const state = evidenceState(inputId);
            state.files = [];
            state.existing = (photos || []).filter(Boolean);
            state.removed = false;
            renderEvidencePreview(inputId);
        }

        async function buildPhotosPayload(inputId, existingRecord) {
            const state = evidenceState(inputId);
            const existing = state.removed ? [] : (state.existing && state.existing.length ? state.existing : normalizePhotos(existingRecord));
            const newPhotos = [];
            for (const file of state.files || []) {
                const dataUrl = await fileToDataUrl(file, { maxSize: 1100, quality: 0.74 });
                if (dataUrl) newPhotos.push(dataUrl);
            }
            return existing.concat(newPhotos).filter(Boolean).slice(0, 12);
        }

        function evidenceUploaderMarkup(inputId, title, hint) {
            return `
                <div class="form-group evidence-uploader-wrap" id="${inputId}Uploader">
                    <label>${escapeHtml(title)}</label>
                    <div class="smart-upload">
                        <div class="smart-upload-head">
                            <div>
                                <div class="smart-upload-title">Agregar 1 o más fotos</div>
                                <div class="smart-upload-hint">${escapeHtml(hint || 'Puedes pegar con Ctrl + V, seleccionar varias imágenes o usar cámara.')}</div>
                            </div>
                            <div class="smart-upload-actions">
                                <button type="button" class="btn btn-outline-soft btn-sm" onclick="openUploadPicker('${inputId}')"><i class="fas fa-images mr-1"></i>Archivos</button>
                                <button type="button" class="btn btn-info-soft btn-sm" onclick="openUploadPicker('${inputId}Camera')"><i class="fas fa-camera mr-1"></i>Cámara</button>
                                <button type="button" class="btn btn-danger-soft btn-sm" onclick="clearEvidenceUpload('${inputId}')"><i class="fas fa-times mr-1"></i>Quitar</button>
                            </div>
                        </div>
                        <div class="smart-upload-zone" id="${inputId}Zone" tabindex="0">
                            <div>
                                <i class="fas fa-cloud-upload-alt"></i>
                                <strong>Pega o selecciona fotos</strong>
                                <span>Sirve para guardar evidencia, capturas, referencias del pedido o coordinación.</span>
                            </div>
                        </div>
                        <input type="file" id="${inputId}" accept="image/*" multiple hidden>
                        <input type="file" id="${inputId}Camera" accept="image/*" capture="environment" hidden>
                        <div class="smart-upload-preview" id="${inputId}Preview">
                            <div class="evidence-preview-list" id="${inputId}PreviewList"></div>
                        </div>
                    </div>
                </div>
            `;
        }

        function injectEvidenceUploader(formId, inputId, title, hint) {
            const form = document.getElementById(formId);
            if (!form || document.getElementById(inputId + 'Uploader')) return;
            const submit = form.querySelector('button[type="submit"]');
            if (!submit) return;
            submit.insertAdjacentHTML('beforebegin', evidenceUploaderMarkup(inputId, title, hint));
        }

        function setupEvidenceUploader(inputId) {
            const zone = document.getElementById(inputId + 'Zone');
            const mainInput = document.getElementById(inputId);
            const cameraInput = document.getElementById(inputId + 'Camera');
            const wrapper = document.getElementById(inputId + 'Uploader');
            if (!zone || !mainInput || !wrapper || wrapper.dataset.bound === '1') return;
            wrapper.dataset.bound = '1';

            zone.addEventListener('click', () => {
                window.__lastFocusedUploader = inputId;
                zone.focus();
                mainInput.click();
            });
            zone.addEventListener('dragover', event => {
                event.preventDefault();
                zone.classList.add('dragover');
            });
            zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
            zone.addEventListener('drop', event => {
                event.preventDefault();
                zone.classList.remove('dragover');
                appendEvidenceFiles(inputId, event.dataTransfer?.files || []);
            });
            zone.addEventListener('paste', event => {
                const items = Array.from(event.clipboardData?.items || []);
                const imageItems = items.filter(item => (item.type || '').startsWith('image/'));
                if (!imageItems.length) return;
                event.preventDefault();
                const files = imageItems.map((item, index) => {
                    const file = item.getAsFile();
                    if (!file) return null;
                    const ext = (file.type || 'image/png').split('/')[1] || 'png';
                    return new File([file], `pegado-${Date.now()}-${index + 1}.${ext}`, { type: file.type || 'image/png' });
                }).filter(Boolean);
                appendEvidenceFiles(inputId, files, true);
            });
            mainInput.addEventListener('change', () => {
                appendEvidenceFiles(inputId, mainInput.files || []);
                mainInput.value = '';
            });
            if (cameraInput) {
                cameraInput.addEventListener('change', () => {
                    appendEvidenceFiles(inputId, cameraInput.files || []);
                    cameraInput.value = '';
                });
            }
        }

        function injectOptionalMoneyField(formId, beforeInputId, inputId, label) {
            if (document.getElementById(inputId)) return;
            const beforeInput = document.getElementById(beforeInputId);
            const group = beforeInput ? beforeInput.closest('.form-group') : null;
            if (!group) return;
            group.insertAdjacentHTML('beforebegin', `
                <div class="form-group">
                    <label>${escapeHtml(label)}</label>
                    <input type="number" class="form-control money-input" id="${inputId}" min="0" step="0.01" placeholder="0.00">
                    <div class="muted-line">Opcional. Si lo llenas, el resumen calcula ganancia real: venta - costo.</div>
                </div>
            `);
        }

        function setupMoneyInputs() {
            document.querySelectorAll('input[type="number"][step="0.01"], .money-input').forEach(input => {
                input.setAttribute('inputmode', 'decimal');
                input.addEventListener('blur', () => {
                    if (input.value !== '') input.value = moneyInputValue(input.value);
                });
            });
        }

        function setupExtraFormFields() {
            injectEvidenceUploader('itemsForm', 'itemsPhotos', 'Fotos extra / evidencia', 'Opcional: guarda más fotos del producto o capturas de referencia.');
            injectEvidenceUploader('raudaForm', 'raudaPhotos', 'Fotos extra / evidencia', 'Opcional: guarda más fotos del producto o capturas de referencia.');
            injectEvidenceUploader('clientsForm', 'clientPhotos', 'Fotos del cliente / evidencia', 'Opcional: capturas de chat, ubicación o referencias del cliente.');
            injectEvidenceUploader('caexForm', 'caexPhotos', 'Fotos extra del envío', 'Opcional: capturas, etiquetas, ubicación o más comprobantes.');
            injectEvidenceUploader('encuentroForm', 'encuentroPhotos', 'Fotos de la venta / coordinación', 'Opcional: captura del pedido, producto o punto de encuentro.');
            injectEvidenceUploader('motoForm', 'motoPhotos', 'Fotos de la venta / coordinación', 'Opcional: captura del pedido, producto, mapa o dirección.');
            injectEvidenceUploader('ventaCaexForm', 'ventaCaexPhotos', 'Fotos de venta CAEX / coordinación', 'Opcional: captura del pedido, pago, productos o guía.');

            ['itemsPhotos', 'raudaPhotos', 'clientPhotos', 'caexPhotos', 'encuentroPhotos', 'motoPhotos', 'ventaCaexPhotos'].forEach(setupEvidenceUploader);
            injectOptionalMoneyField('encuentroForm', 'encuentroTotal', 'encuentroCost', 'Costo inversión de esta venta');
            injectOptionalMoneyField('motoForm', 'motoTotal', 'motoCost', 'Costo inversión de esta venta');
            setupMoneyInputs();
        }

        function getDateRangeFromSummaryFilters() {
            const mode = document.getElementById('summaryFilterMode')?.value || 'month';
            if (mode === 'range') {
                const from = document.getElementById('summaryFromDate')?.value || todayDateValue();
                const to = document.getElementById('summaryToDate')?.value || from;
                return { from, to };
            }
            const month = document.getElementById('summaryMonth')?.value || todayDateValue().slice(0, 7);
            return { from: `${month}-01`, to: lastDayOfMonth(month) };
        }

        function lastDayOfMonth(monthValue) {
            const [year, month] = String(monthValue || todayDateValue().slice(0, 7)).split('-').map(Number);
            const date = new Date(year, month, 0);
            const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
            return local.toISOString().slice(0, 10);
        }

        function isRecordInRange(record, range) {
            const date = normalizeRecordDate(getRecordDateValue(record));
            return date >= range.from && date <= range.to;
        }

        function getVentaCaexCost(record) {
            if (Number(record?.cost || 0) > 0) return roundMoney(record.cost);
            return roundMoney((record?.items || []).reduce((sum, item) => sum + Number(item.lineCost || (Number(item.unitCost || 0) * Number(item.units || 0)) || 0), 0));
        }

        function getSaleProfit(record, type) {
            if (Number.isFinite(Number(record?.profit))) return roundMoney(record.profit);
            if (type === 'caex') return roundMoney(paymentTotal(record.payment) - getVentaCaexCost(record));
            return roundMoney(Number(record?.total || 0) - Number(record?.cost || 0));
        }

        function updateSummaryFilterMode() {
            const mode = document.getElementById('summaryFilterMode')?.value || 'month';
            const monthBox = document.getElementById('summaryMonthBox');
            const rangeBox = document.getElementById('summaryRangeBox');
            if (monthBox) monthBox.style.display = mode === 'month' ? '' : 'none';
            if (rangeBox) rangeBox.style.display = mode === 'range' ? '' : 'none';
        }

        function renderBusinessSummary() {
            const panel = document.getElementById('businessSummaryPanel');
            if (!panel) return;
            const range = getDateRangeFromSummaryFilters();
            const items = readStore(STORAGE_KEYS.items);
            const rauda = readStore(STORAGE_KEYS.rauda);
            const invested = items.concat(rauda).reduce((sum, item) => sum + Number(item.cost || 0) * Number(item.stock || 0), 0);
            const encuentro = readStore(STORAGE_KEYS.salesEncuentro).filter(record => isRecordInRange(record, range));
            const moto = readStore(STORAGE_KEYS.salesMoto).filter(record => isRecordInRange(record, range));
            const caex = readStore(STORAGE_KEYS.salesCaex).filter(record => isRecordInRange(record, range));
            const soldEncuentro = encuentro.reduce((sum, record) => sum + Number(record.total || 0), 0);
            const soldMoto = moto.reduce((sum, record) => sum + Number(record.total || 0), 0);
            const soldCaex = caex.reduce((sum, record) => sum + paymentTotal(record.payment), 0);
            const totalSold = roundMoney(soldEncuentro + soldMoto + soldCaex);
            const totalProfit = roundMoney(
                encuentro.reduce((sum, record) => sum + getSaleProfit(record, 'encuentro'), 0) +
                moto.reduce((sum, record) => sum + getSaleProfit(record, 'moto'), 0) +
                caex.reduce((sum, record) => sum + getSaleProfit(record, 'caex'), 0)
            );
            const totalShipments = encuentro.length + moto.length + caex.length;

            const setText = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            };
            setText('businessInvested', formatMoney(invested));
            setText('businessSold', formatMoney(totalSold));
            setText('businessProfit', formatMoney(totalProfit));
            setText('businessShipments', String(totalShipments));
            setText('businessMotoCount', String(moto.length));
            setText('businessCaexCount', String(caex.length));
            setText('businessEncuentroCount', String(encuentro.length));
            setText('businessRangeText', `${formatDateOnly(range.from)} - ${formatDateOnly(range.to)}`);
        }

        function initBusinessSummaryControls() {
            const month = document.getElementById('summaryMonth');
            const from = document.getElementById('summaryFromDate');
            const to = document.getElementById('summaryToDate');
            if (month && !month.value) month.value = todayDateValue().slice(0, 7);
            if (from && !from.value) from.value = `${todayDateValue().slice(0, 7)}-01`;
            if (to && !to.value) to.value = todayDateValue();
            ['summaryFilterMode', 'summaryMonth', 'summaryFromDate', 'summaryToDate'].forEach(id => {
                const input = document.getElementById(id);
                if (input) input.addEventListener('change', () => {
                    updateSummaryFilterMode();
                    renderBusinessSummary();
                });
            });
            const refresh = document.getElementById('summaryRefreshBtn');
            if (refresh) refresh.addEventListener('click', renderBusinessSummary);
            updateSummaryFilterMode();
            renderBusinessSummary();
        }

        function showToast(message) {
            const toast = document.getElementById('toastSoft');
            toast.textContent = message;
            toast.classList.add('show');
            clearTimeout(showToast._timer);
            showToast._timer = setTimeout(() => toast.classList.remove('show'), 2400);
        }

        function renderEmptyRow(colspan, text) {
            return `<tr><td colspan="${colspan}"><div class="empty-state">${text}</div></td></tr>`;
        }

        function getAllInventories() {
            return {
                items: readStore(STORAGE_KEYS.items),
                rauda: readStore(STORAGE_KEYS.rauda)
            };
        }

        function renderSummary() {
            const items = readStore(STORAGE_KEYS.items);
            const rauda = readStore(STORAGE_KEYS.rauda);
            const clients = readStore(STORAGE_KEYS.clients);
            const caex = readStore(STORAGE_KEYS.caex);
            const sales = readStore(STORAGE_KEYS.salesEncuentro).length + readStore(STORAGE_KEYS.salesMoto).length + readStore(STORAGE_KEYS.salesCaex).length;

            document.getElementById('summaryItems').textContent = items.length;
            document.getElementById('summaryRauda').textContent = rauda.length;
            document.getElementById('summaryClients').textContent = clients.length;
            document.getElementById('summaryCaex').textContent = caex.length;
            document.getElementById('summarySales').textContent = sales;
            renderBusinessSummary();

            const lowStock = items.filter(item => Number(item.minStock || 0) > 0 && Number(item.stock || 0) <= Number(item.minStock || 0));
            const alertBox = document.getElementById('lowStockAlert');

            if (!lowStock.length) {
                alertBox.classList.remove('show');
                alertBox.innerHTML = '';
                return;
            }

            alertBox.classList.add('show');
            alertBox.innerHTML = `
                <strong><i class="fas fa-exclamation-triangle mr-2"></i>Stock bajo detectado en Items</strong>
                <div class="mt-2">${lowStock.map(item => `${escapeHtml(item.name)} (${Number(item.stock || 0)} / mínimo ${Number(item.minStock || 0)})`).join(' · ')}</div>
            `;
        }

                function renderInventoryTables() {
            const items = readStore(STORAGE_KEYS.items);
            const rauda = readStore(STORAGE_KEYS.rauda);

            const itemsBody = document.getElementById('itemsTableBody');
            if (!items.length) {
                itemsBody.innerHTML = renderEmptyRow(9, 'No hay productos guardados en Items.');
            } else {
                itemsBody.innerHTML = items.map(item => {
                    const low = Number(item.minStock || 0) > 0 && Number(item.stock || 0) <= Number(item.minStock || 0);
                    return `
                        <tr>
                            <td>${item.photo ? `<img src="${item.photo}" alt="Foto" class="thumb-mini">` : '<span class="pill pill-info">Sin foto</span>'}</td>
                            <td><strong>${escapeHtml(item.name)}</strong>${editBadge(item)}${photoCountBadge(item)}</td>
                            <td>${Number(item.stock || 0)}</td>
                            <td>${formatMoney(item.cost)}</td>
                            <td>${Number(item.minStock || 0)}</td>
                            <td>${escapeHtml(getRecordDateText(item))}</td>
                            <td>${escapeHtml(getCaptureText(item))}${editBadge(item)}</td>
                            <td><span class="pill ${low ? 'pill-warning' : 'pill-success'}">${low ? 'Stock bajo' : 'Disponible'}</span></td>
                            <td>
                                <div class="actions-inline">
                                    <button class="btn btn-info-soft btn-sm" onclick="viewInventoryRecord('items','${item.id}')">Ver</button>
                                    <button class="btn btn-success-soft btn-sm" onclick="editInventoryRecord('items','${item.id}')">Editar</button>
                                    <button class="btn btn-danger-soft btn-sm" onclick="deleteInventoryRecord('items','${item.id}')">Eliminar</button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
            }

            const raudaBody = document.getElementById('raudaTableBody');
            if (!rauda.length) {
                raudaBody.innerHTML = renderEmptyRow(7, 'No hay productos guardados en Rauda.');
            } else {
                raudaBody.innerHTML = rauda.map(item => `
                    <tr>
                        <td>${item.photo ? `<img src="${item.photo}" alt="Foto" class="thumb-mini">` : '<span class="pill pill-info">Sin foto</span>'}</td>
                        <td><strong>${escapeHtml(item.name)}</strong>${editBadge(item)}${photoCountBadge(item)}</td>
                        <td>${Number(item.stock || 0)}</td>
                        <td>${formatMoney(item.cost)}</td>
                        <td>${escapeHtml(getRecordDateText(item))}</td>
                        <td>${escapeHtml(getCaptureText(item))}${editBadge(item)}</td>
                        <td>
                            <div class="actions-inline">
                                <button class="btn btn-info-soft btn-sm" onclick="viewInventoryRecord('rauda','${item.id}')">Ver</button>
                                <button class="btn btn-success-soft btn-sm" onclick="editInventoryRecord('rauda','${item.id}')">Editar</button>
                                <button class="btn btn-danger-soft btn-sm" onclick="deleteInventoryRecord('rauda','${item.id}')">Eliminar</button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            }
        }

                function renderClientsTable() {
            const clients = readStore(STORAGE_KEYS.clients);
            const body = document.getElementById('clientsTableBody');

            if (!clients.length) {
                body.innerHTML = renderEmptyRow(7, 'No hay clientes registrados todavía.');
                return;
            }

            body.innerHTML = clients.map(client => `
                <tr>
                    <td><strong>${escapeHtml(client.name)}</strong>${editBadge(client)}${photoCountBadge(client)}</td>
                    <td>
                        <div class="phone-tags">
                            ${(client.phones || []).map(phone => `<span class="phone-tag">${escapeHtml(phone)}</span>`).join('') || '<span class="pill pill-info">Sin teléfono</span>'}
                        </div>
                    </td>
                    <td>${escapeHtml(client.department || '-')}</td>
                    <td>${escapeHtml(client.town || '-')}</td>
                    <td>${escapeHtml(getRecordDateText(client))}</td>
                    <td>${escapeHtml(getCaptureText(client))}${editBadge(client)}</td>
                    <td>
                        <div class="actions-inline">
                            <button class="btn btn-info-soft btn-sm" onclick="viewClientRecord('${client.id}')">Ver</button>
                            <button class="btn btn-success-soft btn-sm" onclick="editClientRecord('${client.id}')">Editar</button>
                            <button class="btn btn-danger-soft btn-sm" onclick="deleteClientRecord('${client.id}')">Eliminar</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }

        function renderCaexSelects() {
            const clients = readStore(STORAGE_KEYS.clients);
            const caexShipments = readStore(STORAGE_KEYS.caex);

            const clientSelect = document.getElementById('caexClientSelect');
            if (!clients.length) {
                clientSelect.innerHTML = '<option value="">No hay clientes registrados</option>';
            } else {
                clientSelect.innerHTML = clients.map(client => `
                    <option value="${client.id}">${escapeHtml(client.name)} · ${escapeHtml(client.department || '')}${client.town ? ' / ' + escapeHtml(client.town) : ''}</option>
                `).join('');
            }

            const caexClientSelect = document.getElementById('ventaCaexClientSelect');
            if (!caexShipments.length) {
                caexClientSelect.innerHTML = '<option value="">No hay clientes en CAEX Envíos</option>';
                document.getElementById('ventaCaexClientInfo').innerHTML = '<div class="pill pill-warning">Primero guarda un envío en CAEX Envíos.</div>';
            } else {
                caexClientSelect.innerHTML = caexShipments.map(shipment => `
                    <option value="${shipment.id}">${escapeHtml(shipment.client.name)} · ${escapeHtml(shipment.client.department || '')}${shipment.client.town ? ' / ' + escapeHtml(shipment.client.town) : ''}</option>
                `).join('');
                renderVentaCaexClientInfo();
            }
        }

                function renderCaexTable() {
            const records = readStore(STORAGE_KEYS.caex);
            const body = document.getElementById('caexTableBody');

            if (!records.length) {
                body.innerHTML = renderEmptyRow(8, 'No hay envíos CAEX guardados todavía.');
                return;
            }

            body.innerHTML = records.map(record => `
                <tr>
                    <td><strong>${escapeHtml(record.client.name)}</strong>${editBadge(record)}${photoCountBadge(record)}</td>
                    <td>
                        <div class="phone-tags">
                            ${(record.client.phones || []).map(phone => `<span class="phone-tag">${escapeHtml(phone)}</span>`).join('') || '<span class="pill pill-info">Sin teléfono</span>'}
                        </div>
                    </td>
                    <td>${escapeHtml(record.client.department || '-')}</td>
                    <td>${escapeHtml(record.client.town || '-')}</td>
                    <td>${record.receipt ? `<button class="btn btn-info-soft btn-sm" onclick="viewCaexReceipt('${record.id}')">Ver</button>` : '<span class="pill pill-info">Sin archivo</span>'}</td>
                    <td>${escapeHtml(getRecordDateText(record))}</td>
                    <td>${escapeHtml(getCaptureText(record))}${editBadge(record)}</td>
                    <td>
                        <div class="actions-inline">
                            <button class="btn btn-info-soft btn-sm" onclick="viewCaexRecord('${record.id}')">Ver</button>
                            <button class="btn btn-success-soft btn-sm" onclick="editCaexRecord('${record.id}')">Editar</button>
                            <button class="btn btn-danger-soft btn-sm" onclick="deleteCaexRecord('${record.id}')">Eliminar</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }

                function renderEncuentroTable() {
            const records = readStore(STORAGE_KEYS.salesEncuentro);
            const body = document.getElementById('encuentroTableBody');

            if (!records.length) {
                body.innerHTML = renderEmptyRow(7, 'No hay ventas de encuentro registradas.');
                return;
            }

            body.innerHTML = records.map(record => `
                <tr>
                    <td><strong>${escapeHtml(record.product)}</strong>${editBadge(record)}${photoCountBadge(record)}</td>
                    <td>${escapeHtml(record.time)}</td>
                    <td>${escapeHtml(record.phone)}</td>
                    <td>${formatMoney(record.total)}</td>
                    <td>${escapeHtml(getRecordDateText(record))}</td>
                    <td>${escapeHtml(getCaptureText(record))}${editBadge(record)}</td>
                    <td>
                        <div class="actions-inline">
                            <button class="btn btn-info-soft btn-sm" onclick="viewSimpleSale('encuentro','${record.id}')">Ver</button>
                            <button class="btn btn-success-soft btn-sm" onclick="editSimpleSale('encuentro','${record.id}')">Editar</button>
                            <button class="btn btn-danger-soft btn-sm" onclick="deleteSimpleSale('encuentro','${record.id}')">Eliminar</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }

                function renderMotoTable() {
            const records = readStore(STORAGE_KEYS.salesMoto);
            const body = document.getElementById('motoTableBody');

            if (!records.length) {
                body.innerHTML = renderEmptyRow(8, 'No hay ventas de moto registradas.');
                return;
            }

            body.innerHTML = records.map(record => `
                <tr>
                    <td><strong>${escapeHtml(record.product)}</strong>${editBadge(record)}${photoCountBadge(record)}</td>
                    <td>${escapeHtml(record.address)}</td>
                    <td>${escapeHtml(record.time)}</td>
                    <td>${escapeHtml(record.phone)}</td>
                    <td>${formatMoney(record.total)}</td>
                    <td>${escapeHtml(getRecordDateText(record))}</td>
                    <td>${escapeHtml(getCaptureText(record))}${editBadge(record)}</td>
                    <td>
                        <div class="actions-inline">
                            <button class="btn btn-info-soft btn-sm" onclick="viewSimpleSale('moto','${record.id}')">Ver</button>
                            <button class="btn btn-success-soft btn-sm" onclick="editSimpleSale('moto','${record.id}')">Editar</button>
                            <button class="btn btn-danger-soft btn-sm" onclick="deleteSimpleSale('moto','${record.id}')">Eliminar</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }

        function renderVentaCaexClientInfo() {
            const id = document.getElementById('ventaCaexClientSelect').value;
            const records = readStore(STORAGE_KEYS.caex);
            const found = records.find(record => record.id === id);
            const info = document.getElementById('ventaCaexClientInfo');

            if (!found) {
                info.innerHTML = '<div class="pill pill-warning">Selecciona un cliente de CAEX Envíos.</div>';
                return;
            }

            info.innerHTML = `
                <div class="subpanel">
                    <div class="hero-inline">
                        <span class="pill pill-info">Cliente seleccionado</span>
                        <strong>${escapeHtml(found.client.name)}</strong>
                    </div>
                    <div class="mt-3">
                        <div class="detail-list">
                            <div class="detail-row">
                                <span class="detail-label">Teléfonos</span>
                                <div>${(found.client.phones || []).map(phone => `<span class="phone-tag">${escapeHtml(phone)}</span>`).join(' ') || '-'}</div>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Ubicación</span>
                                <div>${escapeHtml(found.client.department || '')}${found.client.town ? ' · ' + escapeHtml(found.client.town) : ''}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        function renderLineProductOptions() {
            const inventoryType = document.getElementById('lineInventoryType').value;
            const inventory = readStore(inventoryType === 'items' ? STORAGE_KEYS.items : STORAGE_KEYS.rauda);
            const select = document.getElementById('lineProductSelect');

            if (!inventory.length) {
                select.innerHTML = '<option value="">No hay productos</option>';
                return;
            }

            select.innerHTML = inventory.map(item => `
                <option value="${item.id}">${escapeHtml(item.name)} · Stock ${Number(item.stock || 0)}</option>
            `).join('');
        }

        function renderTempLineItems() {
            const box = document.getElementById('ventaCaexLineItems');

            if (!tempCaexLineItems.length) {
                box.innerHTML = '<div class="pill pill-info">Aún no has agregado productos a esta venta.</div>';
                return;
            }

            box.innerHTML = tempCaexLineItems.map(item => `
                <div class="line-item-row">
                    <div>
                        <strong>${escapeHtml(item.productName)}</strong>
                        <div class="text-muted small">Inventario: ${item.inventoryType === 'items' ? 'Items' : 'Rauda'} · Unidades: ${Number(item.units)} · Costo: ${formatMoney(item.lineCost || (Number(item.unitCost || 0) * Number(item.units || 0)))}</div>
                    </div>
                    <button type="button" class="btn btn-danger-soft btn-sm" onclick="removeTempLineItem('${item.uid}')">Quitar</button>
                </div>
            `).join('');
        }

                function renderVentaCaexTable() {
            const records = readStore(STORAGE_KEYS.salesCaex);
            const body = document.getElementById('ventaCaexTableBody');

            if (!records.length) {
                body.innerHTML = renderEmptyRow(6, 'No hay ventas CAEX registradas.');
                return;
            }

            body.innerHTML = records.map(record => `
                <tr>
                    <td><strong>${escapeHtml(record.client.name)}</strong>${editBadge(record)}${photoCountBadge(record)}</td>
                    <td>${record.items.map(item => `${escapeHtml(item.productName)} (${Number(item.units)})`).join('<br>')}</td>
                    <td>${record.payment.fullPrepaid ? `Pago total anticipado: ${formatMoney(record.payment.fullAmount)}` : `Anticipo: ${formatMoney(record.payment.advance)}<br>Paga al recibir: ${formatMoney(record.payment.payOnDelivery)}`}<br><span class="pill pill-success">Ganancia ${formatMoney(getSaleProfit(record, 'caex'))}</span></td>
                    <td>${escapeHtml(getRecordDateText(record))}</td>
                    <td>${escapeHtml(getCaptureText(record))}${editBadge(record)}</td>
                    <td>
                        <div class="actions-inline">
                            <button class="btn btn-info-soft btn-sm" onclick="viewVentaCaexRecord('${record.id}')">Ver</button>
                            <button class="btn btn-success-soft btn-sm" onclick="editVentaCaexRecord('${record.id}')">Editar</button>
                            <button class="btn btn-danger-soft btn-sm" onclick="deleteVentaCaexRecord('${record.id}')">Eliminar</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }

        function refreshEverything() {
            renderSummary();
            renderInventoryTables();
            renderClientsTable();
            renderCaexSelects();
            renderCaexTable();
            renderEncuentroTable();
            renderMotoTable();
            renderLineProductOptions();
            renderTempLineItems();
            renderVentaCaexTable();
            applyActiveSection();
        }

        async function handleItemsFormSubmit(event) {
            event.preventDefault();
            const items = readStore(STORAGE_KEYS.items);
            const existing = editState.items ? items.find(item => item.id === editState.items) : null;
            const dateMeta = makePersistedMeta(existing, document.getElementById('itemsRecordDate').value, 'Producto Items editado');
            const newPhoto = await fileToDataUrl(document.getElementById('itemsPhoto').files[0]);
            const photos = await buildPhotosPayload('itemsPhotos', existing);
            const payload = {
                id: existing ? existing.id : generateId('item'),
                name: document.getElementById('itemsName').value.trim(),
                stock: Number(document.getElementById('itemsStock').value),
                cost: readMoneyValue('itemsCost'),
                minStock: Number(document.getElementById('itemsMin').value),
                photo: newPhoto || (uploadRemoveFlags.itemsPhoto ? '' : existing?.photo || ''),
                photos,
                ...dateMeta
            };
            const next = existing ? items.map(item => item.id === existing.id ? payload : item) : items.concat(payload);
            saveStore(STORAGE_KEYS.items, next);
            resetItemsForm();
            refreshEverything();
            showToast(existing ? 'Producto Items actualizado.' : 'Producto guardado en Items.');
        }

        async function handleRaudaFormSubmit(event) {
            event.preventDefault();
            const rauda = readStore(STORAGE_KEYS.rauda);
            const existing = editState.rauda ? rauda.find(item => item.id === editState.rauda) : null;
            const dateMeta = makePersistedMeta(existing, document.getElementById('raudaRecordDate').value, 'Producto Rauda editado');
            const newPhoto = await fileToDataUrl(document.getElementById('raudaPhoto').files[0]);
            const photos = await buildPhotosPayload('raudaPhotos', existing);
            const payload = {
                id: existing ? existing.id : generateId('rauda'),
                name: document.getElementById('raudaName').value.trim(),
                stock: Number(document.getElementById('raudaStock').value),
                cost: readMoneyValue('raudaCost'),
                photo: newPhoto || (uploadRemoveFlags.raudaPhoto ? '' : existing?.photo || ''),
                photos,
                ...dateMeta
            };
            const next = existing ? rauda.map(item => item.id === existing.id ? payload : item) : rauda.concat(payload);
            saveStore(STORAGE_KEYS.rauda, next);
            resetRaudaForm();
            refreshEverything();
            showToast(existing ? 'Producto Rauda actualizado.' : 'Producto guardado en Rauda.');
        }

        async function handleClientsFormSubmit(event) {
            event.preventDefault();
            const clients = readStore(STORAGE_KEYS.clients);
            const existing = editState.client ? clients.find(client => client.id === editState.client) : null;
            const dateMeta = makePersistedMeta(existing, document.getElementById('clientRecordDate').value, 'Cliente editado');
            const photos = await buildPhotosPayload('clientPhotos', existing);
            const payload = {
                id: existing ? existing.id : generateId('client'),
                name: document.getElementById('clientName').value.trim(),
                department: document.getElementById('clientDepartment').value.trim(),
                town: document.getElementById('clientTown').value.trim(),
                phones: getPhones(
                    document.getElementById('clientPhone1').value,
                    document.getElementById('clientPhone2').value,
                    document.getElementById('clientPhone3').value
                ),
                photos,
                ...dateMeta
            };
            const next = existing ? clients.map(client => client.id === existing.id ? payload : client) : clients.concat(payload);
            saveStore(STORAGE_KEYS.clients, next);
            if (existing) propagateClientUpdate(payload);
            resetClientForm();
            refreshEverything();
            showToast(existing ? 'Cliente actualizado.' : 'Cliente guardado correctamente.');
        }

        async function handleCaexFormSubmit(event) {
            event.preventDefault();

            const mode = document.querySelector('input[name="caexMode"]:checked').value;
            const clients = readStore(STORAGE_KEYS.clients);
            const caexRecords = readStore(STORAGE_KEYS.caex);
            const existing = editState.caex ? caexRecords.find(record => record.id === editState.caex) : null;
            const shipmentDateMeta = makePersistedMeta(existing, document.getElementById('caexRecordDate').value, 'Envío CAEX editado');
            let clientData = null;

            if (mode === 'existing') {
                const selectedClientId = document.getElementById('caexClientSelect').value;
                clientData = clients.find(client => client.id === selectedClientId) || null;
                if (!clientData) {
                    showToast('Primero selecciona un cliente existente.');
                    return;
                }
            } else {
                const name = document.getElementById('caexName').value.trim();
                const department = document.getElementById('caexDepartment').value.trim();
                const town = document.getElementById('caexTown').value.trim();
                const phones = getPhones(
                    document.getElementById('caexPhone1').value,
                    document.getElementById('caexPhone2').value,
                    document.getElementById('caexPhone3').value
                );

                if (!name || !department || !town || !phones.length) {
                    showToast('Completa los datos del nuevo cliente para CAEX.');
                    return;
                }

                const existingClient = existing?.client?.id ? clients.find(client => client.id === existing.client.id) : null;
                const clientDateMeta = makePersistedMeta(existingClient, document.getElementById('caexRecordDate').value, 'Cliente editado desde CAEX');
                clientData = {
                    id: existingClient ? existingClient.id : generateId('client'),
                    name,
                    department,
                    town,
                    phones,
                    ...clientDateMeta
                };

                if (existingClient) {
                    saveStore(STORAGE_KEYS.clients, clients.map(client => client.id === existingClient.id ? clientData : client));
                } else {
                    clients.push(clientData);
                    saveStore(STORAGE_KEYS.clients, clients);
                }
            }

            const newReceipt = await fileToDataUrl(document.getElementById('caexReceipt').files[0]);
            const photos = await buildPhotosPayload('caexPhotos', existing);
            const payload = {
                id: existing ? existing.id : generateId('caex'),
                client: {
                    id: clientData.id,
                    name: clientData.name,
                    department: clientData.department,
                    town: clientData.town,
                    phones: [...(clientData.phones || [])]
                },
                receipt: newReceipt || (uploadRemoveFlags.caexReceipt ? '' : existing?.receipt || ''),
                photos,
                ...shipmentDateMeta
            };

            const next = existing ? caexRecords.map(record => record.id === existing.id ? payload : record) : caexRecords.concat(payload);
            saveStore(STORAGE_KEYS.caex, next);
            resetCaexForm();
            refreshEverything();
            showToast(existing ? 'Envío CAEX actualizado.' : 'Envío CAEX guardado correctamente.');
        }

        async function handleEncuentroSubmit(event) {
            event.preventDefault();
            const records = readStore(STORAGE_KEYS.salesEncuentro);
            const existing = editState.encuentro ? records.find(record => record.id === editState.encuentro) : null;
            const dateMeta = makePersistedMeta(existing, document.getElementById('encuentroRecordDate').value, 'Venta encuentro editada');
            const total = readMoneyValue('encuentroTotal');
            const cost = readMoneyValue('encuentroCost');
            const photos = await buildPhotosPayload('encuentroPhotos', existing);
            const payload = {
                id: existing ? existing.id : generateId('encuentro'),
                product: document.getElementById('encuentroProduct').value.trim(),
                time: document.getElementById('encuentroTime').value.trim(),
                phone: document.getElementById('encuentroPhone').value.trim(),
                total,
                cost,
                profit: roundMoney(total - cost),
                photos,
                ...dateMeta
            };
            const next = existing ? records.map(record => record.id === existing.id ? payload : record) : records.concat(payload);
            saveStore(STORAGE_KEYS.salesEncuentro, next);
            resetEncuentroForm();
            refreshEverything();
            showToast(existing ? 'Venta de encuentro actualizada.' : 'Venta de encuentro guardada.');
        }

        async function handleMotoSubmit(event) {
            event.preventDefault();
            const records = readStore(STORAGE_KEYS.salesMoto);
            const existing = editState.moto ? records.find(record => record.id === editState.moto) : null;
            const dateMeta = makePersistedMeta(existing, document.getElementById('motoRecordDate').value, 'Venta moto editada');
            const total = readMoneyValue('motoTotal');
            const cost = readMoneyValue('motoCost');
            const photos = await buildPhotosPayload('motoPhotos', existing);
            const payload = {
                id: existing ? existing.id : generateId('moto'),
                product: document.getElementById('motoProduct').value.trim(),
                address: document.getElementById('motoAddress').value.trim(),
                time: document.getElementById('motoTime').value.trim(),
                phone: document.getElementById('motoPhone').value.trim(),
                total,
                cost,
                profit: roundMoney(total - cost),
                photos,
                ...dateMeta
            };
            const next = existing ? records.map(record => record.id === existing.id ? payload : record) : records.concat(payload);
            saveStore(STORAGE_KEYS.salesMoto, next);
            resetMotoForm();
            refreshEverything();
            showToast(existing ? 'Venta de moto actualizada.' : 'Venta de moto guardada.');
        }

        function addTempLineItem() {
            const inventoryType = document.getElementById('lineInventoryType').value;
            const productId = document.getElementById('lineProductSelect').value;
            const units = Number(document.getElementById('lineUnits').value);

            if (!productId || units <= 0) {
                showToast('Selecciona un producto y unidades válidas.');
                return;
            }

            const inventory = readStore(inventoryType === 'items' ? STORAGE_KEYS.items : STORAGE_KEYS.rauda);
            const product = inventory.find(item => item.id === productId);

            if (!product) {
                showToast('No se encontró el producto seleccionado.');
                return;
            }

            if (units > Number(product.stock || 0)) {
                showToast('No hay suficiente stock para esa cantidad.');
                return;
            }

            tempCaexLineItems.push({
                uid: generateId('line'),
                inventoryType,
                productId,
                productName: product.name,
                units,
                unitCost: roundMoney(product.cost || 0),
                lineCost: roundMoney(Number(product.cost || 0) * Number(units || 0))
            });

            renderTempLineItems();
            document.getElementById('lineUnits').value = 1;
            showToast('Producto agregado a la venta CAEX.');
        }

        function removeTempLineItem(uid) {
            tempCaexLineItems = tempCaexLineItems.filter(item => item.uid !== uid);
            renderTempLineItems();
        }

        function updatePaymentMode() {
            const checked = document.getElementById('caexFullPrepaid').checked;
            document.getElementById('partialPaymentFields').classList.toggle('hidden-panel', checked);
            document.getElementById('fullPaymentField').classList.toggle('hidden-panel', !checked);

            if (checked) {
                document.getElementById('caexPayOnDelivery').value = '';
                document.getElementById('caexAdvanceAmount').value = '';
            } else {
                document.getElementById('caexFullAmount').value = '';
            }
        }

        function updateCaexMode() {
            const mode = document.querySelector('input[name="caexMode"]:checked').value;
            document.getElementById('caexExistingPanel').classList.toggle('hidden-panel', mode !== 'existing');
            document.getElementById('caexNewPanel').classList.toggle('hidden-panel', mode !== 'new');
        }

        function applyStockReduction(itemsToReduce) {
            const itemsInventory = readStore(STORAGE_KEYS.items);
            const raudaInventory = readStore(STORAGE_KEYS.rauda);

            for (const line of itemsToReduce) {
                const inventoryArray = line.inventoryType === 'items' ? itemsInventory : raudaInventory;
                const found = inventoryArray.find(item => item.id === line.productId);
                if (!found) {
                    return { ok: false, message: `El producto ${line.productName} ya no existe.` };
                }
                if (Number(found.stock || 0) < Number(line.units || 0)) {
                    return { ok: false, message: `No hay suficiente stock para ${line.productName}.` };
                }
            }

            for (const line of itemsToReduce) {
                const inventoryArray = line.inventoryType === 'items' ? itemsInventory : raudaInventory;
                const found = inventoryArray.find(item => item.id === line.productId);
                found.stock = Number(found.stock || 0) - Number(line.units || 0);
            }

            saveStore(STORAGE_KEYS.items, itemsInventory);
            saveStore(STORAGE_KEYS.rauda, raudaInventory);
            return { ok: true };
        }


        function adjustStockForVentaCaexEdit(previousItems, nextItems) {
            const itemsInventory = readStore(STORAGE_KEYS.items);
            const raudaInventory = readStore(STORAGE_KEYS.rauda);
            const pickInventory = type => type === 'items' ? itemsInventory : raudaInventory;

            (previousItems || []).forEach(line => {
                const found = pickInventory(line.inventoryType).find(item => item.id === line.productId);
                if (found) found.stock = Number(found.stock || 0) + Number(line.units || 0);
            });

            for (const line of nextItems || []) {
                const found = pickInventory(line.inventoryType).find(item => item.id === line.productId);
                if (!found) return { ok: false, message: `El producto ${line.productName} ya no existe.` };
                if (Number(found.stock || 0) < Number(line.units || 0)) {
                    return { ok: false, message: `No hay suficiente stock para ${line.productName}.` };
                }
            }

            (nextItems || []).forEach(line => {
                const found = pickInventory(line.inventoryType).find(item => item.id === line.productId);
                found.stock = Number(found.stock || 0) - Number(line.units || 0);
            });

            saveStore(STORAGE_KEYS.items, itemsInventory);
            saveStore(STORAGE_KEYS.rauda, raudaInventory);
            return { ok: true };
        }

        async function handleVentaCaexSubmit(event) {
            event.preventDefault();

            const shipmentId = document.getElementById('ventaCaexClientSelect').value;
            const shipment = readStore(STORAGE_KEYS.caex).find(record => record.id === shipmentId);
            const sales = readStore(STORAGE_KEYS.salesCaex);
            const existing = editState.ventaCaex ? sales.find(record => record.id === editState.ventaCaex) : null;

            if (!shipment) {
                showToast('Selecciona un cliente desde CAEX Envíos.');
                return;
            }

            if (!tempCaexLineItems.length) {
                showToast('Agrega al menos un producto a la venta CAEX.');
                return;
            }

            const fullPrepaid = document.getElementById('caexFullPrepaid').checked;
            const payOnDelivery = document.getElementById('caexPayOnDelivery').value;
            const advanceAmount = document.getElementById('caexAdvanceAmount').value;
            const fullAmount = document.getElementById('caexFullAmount').value;

            if (fullPrepaid) {
                if (fullAmount === '') {
                    showToast('Ingresa el total pagado anticipado.');
                    return;
                }
            } else {
                if (payOnDelivery === '' && advanceAmount === '') {
                    showToast('Ingresa el monto anticipado, el pago al recibir o marca pago total anticipado.');
                    return;
                }
            }

            const nextItems = tempCaexLineItems.map(item => ({
                inventoryType: item.inventoryType,
                productId: item.productId,
                productName: item.productName,
                units: Number(item.units),
                unitCost: roundMoney(item.unitCost || 0),
                lineCost: roundMoney(item.lineCost || (Number(item.unitCost || 0) * Number(item.units || 0)))
            }));

            const stockResult = existing
                ? adjustStockForVentaCaexEdit(existing.items || [], nextItems)
                : applyStockReduction(nextItems);
            if (!stockResult.ok) {
                showToast(stockResult.message);
                return;
            }

            const dateMeta = makePersistedMeta(existing, document.getElementById('ventaCaexRecordDate').value, 'Venta CAEX editada');
            const photos = await buildPhotosPayload('ventaCaexPhotos', existing);
            const saleTotal = fullPrepaid ? readMoneyValue('caexFullAmount') : roundMoney(readMoneyValue('caexPayOnDelivery') + readMoneyValue('caexAdvanceAmount'));
            const saleCost = roundMoney(nextItems.reduce((sum, item) => sum + Number(item.lineCost || 0), 0));
            const payload = {
                id: existing ? existing.id : generateId('salecaex'),
                shipmentId,
                client: shipment.client,
                items: nextItems,
                total: saleTotal,
                cost: saleCost,
                profit: roundMoney(saleTotal - saleCost),
                photos,
                payment: fullPrepaid
                    ? {
                        fullPrepaid: true,
                        fullAmount: readMoneyValue('caexFullAmount')
                    }
                    : {
                        fullPrepaid: false,
                        payOnDelivery: readMoneyValue('caexPayOnDelivery'),
                        advance: readMoneyValue('caexAdvanceAmount')
                    },
                ...dateMeta
            };

            const next = existing ? sales.map(record => record.id === existing.id ? payload : record) : sales.concat(payload);
            saveStore(STORAGE_KEYS.salesCaex, next);

            resetVentaCaexForm();
            refreshEverything();
            showToast(existing ? 'Venta CAEX actualizada y stock corregido.' : 'Venta CAEX guardada y stock actualizado.');
        }


        function propagateClientUpdate(clientData) {
            const updateClientCopy = copy => copy && copy.id === clientData.id
                ? { id: clientData.id, name: clientData.name, department: clientData.department, town: clientData.town, phones: [...(clientData.phones || [])] }
                : copy;
            const caex = readStore(STORAGE_KEYS.caex).map(record => Object.assign({}, record, { client: updateClientCopy(record.client) }));
            const salesCaex = readStore(STORAGE_KEYS.salesCaex).map(record => Object.assign({}, record, { client: updateClientCopy(record.client) }));
            saveStore(STORAGE_KEYS.caex, caex);
            saveStore(STORAGE_KEYS.salesCaex, salesCaex);
        }

        function editInventoryRecord(type, id) {
            const key = type === 'items' ? STORAGE_KEYS.items : STORAGE_KEYS.rauda;
            const record = readStore(key).find(item => item.id === id);
            if (!record) return;
            if (type === 'items') {
                editState.items = id;
                document.getElementById('itemsRecordDate').value = formatDateInput(record.recordDate || record.createdAtISO || record.createdAt);
                document.getElementById('itemsName').value = record.name || '';
                document.getElementById('itemsStock').value = Number(record.stock || 0);
                document.getElementById('itemsCost').value = moneyInputValue(record.cost || 0);
                document.getElementById('itemsMin').value = Number(record.minStock || 0);
                showExistingUploadPreview('itemsPhoto', record.photo, 'Foto actual');
                showExistingEvidence('itemsPhotos', normalizePhotos(record));
                setSubmitButtonText('itemsForm', '<i class="fas fa-save mr-1"></i>Actualizar Items');
                setCancelVisible('itemsForm', true);
                scrollToSection('inventario-items');
            } else {
                editState.rauda = id;
                document.getElementById('raudaRecordDate').value = formatDateInput(record.recordDate || record.createdAtISO || record.createdAt);
                document.getElementById('raudaName').value = record.name || '';
                document.getElementById('raudaStock').value = Number(record.stock || 0);
                document.getElementById('raudaCost').value = moneyInputValue(record.cost || 0);
                showExistingUploadPreview('raudaPhoto', record.photo, 'Foto actual');
                showExistingEvidence('raudaPhotos', normalizePhotos(record));
                setSubmitButtonText('raudaForm', '<i class="fas fa-save mr-1"></i>Actualizar Rauda');
                setCancelVisible('raudaForm', true);
                scrollToSection('inventario-rauda');
            }
            showToast('Modo edición activado. Revisa y guarda los cambios.');
        }

        function editClientRecord(id) {
            const record = readStore(STORAGE_KEYS.clients).find(item => item.id === id);
            if (!record) return;
            editState.client = id;
            document.getElementById('clientRecordDate').value = formatDateInput(record.recordDate || record.createdAtISO || record.createdAt);
            document.getElementById('clientName').value = record.name || '';
            document.getElementById('clientDepartment').value = record.department || '';
            document.getElementById('clientTown').value = record.town || '';
            const phones = record.phones || [];
            document.getElementById('clientPhone1').value = phones[0] || '';
            document.getElementById('clientPhone2').value = phones[1] || '';
            document.getElementById('clientPhone3').value = phones[2] || '';
            showExistingEvidence('clientPhotos', normalizePhotos(record));
            setSubmitButtonText('clientsForm', '<i class="fas fa-save mr-1"></i>Actualizar cliente');
            setCancelVisible('clientsForm', true);
            scrollToSection('clientes-crear');
            showToast('Modo edición de cliente activado.');
        }

        function editCaexRecord(id) {
            const record = readStore(STORAGE_KEYS.caex).find(item => item.id === id);
            if (!record) return;
            editState.caex = id;
            document.getElementById('caexRecordDate').value = formatDateInput(record.recordDate || record.createdAtISO || record.createdAt);
            const clientExists = readStore(STORAGE_KEYS.clients).some(client => client.id === record.client.id);
            if (clientExists) {
                document.getElementById('caexModeExisting').checked = true;
                updateCaexMode();
                document.getElementById('caexClientSelect').value = record.client.id;
            } else {
                document.getElementById('caexModeNew').checked = true;
                updateCaexMode();
                document.getElementById('caexName').value = record.client.name || '';
                document.getElementById('caexDepartment').value = record.client.department || '';
                document.getElementById('caexTown').value = record.client.town || '';
                const phones = record.client.phones || [];
                document.getElementById('caexPhone1').value = phones[0] || '';
                document.getElementById('caexPhone2').value = phones[1] || '';
                document.getElementById('caexPhone3').value = phones[2] || '';
            }
            showExistingUploadPreview('caexReceipt', record.receipt, 'Comprobante actual');
            showExistingEvidence('caexPhotos', normalizePhotos(record));
            setSubmitButtonText('caexForm', '<i class="fas fa-save mr-1"></i>Actualizar envío CAEX');
            setCancelVisible('caexForm', true);
            scrollToSection('caex-crear');
            showToast('Modo edición de envío CAEX activado.');
        }

        function editSimpleSale(type, id) {
            const key = type === 'encuentro' ? STORAGE_KEYS.salesEncuentro : STORAGE_KEYS.salesMoto;
            const record = readStore(key).find(item => item.id === id);
            if (!record) return;
            if (type === 'encuentro') {
                editState.encuentro = id;
                document.getElementById('encuentroRecordDate').value = formatDateInput(record.recordDate || record.createdAtISO || record.createdAt);
                document.getElementById('encuentroProduct').value = record.product || '';
                document.getElementById('encuentroTime').value = record.time || '';
                document.getElementById('encuentroPhone').value = record.phone || '';
                document.getElementById('encuentroTotal').value = moneyInputValue(record.total || 0);
                document.getElementById('encuentroCost').value = moneyInputValue(record.cost || 0);
                showExistingEvidence('encuentroPhotos', normalizePhotos(record));
                setSubmitButtonText('encuentroForm', '<i class="fas fa-save mr-1"></i>Actualizar venta Encuentro');
                setCancelVisible('encuentroForm', true);
                scrollToSection('ventas-encuentro');
            } else {
                editState.moto = id;
                document.getElementById('motoRecordDate').value = formatDateInput(record.recordDate || record.createdAtISO || record.createdAt);
                document.getElementById('motoProduct').value = record.product || '';
                document.getElementById('motoAddress').value = record.address || '';
                document.getElementById('motoTime').value = record.time || '';
                document.getElementById('motoPhone').value = record.phone || '';
                document.getElementById('motoTotal').value = moneyInputValue(record.total || 0);
                document.getElementById('motoCost').value = moneyInputValue(record.cost || 0);
                showExistingEvidence('motoPhotos', normalizePhotos(record));
                setSubmitButtonText('motoForm', '<i class="fas fa-save mr-1"></i>Actualizar venta Moto');
                setCancelVisible('motoForm', true);
                scrollToSection('ventas-moto');
            }
            showToast('Modo edición de venta activado.');
        }

        function editVentaCaexRecord(id) {
            const record = readStore(STORAGE_KEYS.salesCaex).find(item => item.id === id);
            if (!record) return;
            editState.ventaCaex = id;
            document.getElementById('ventaCaexRecordDate').value = formatDateInput(record.recordDate || record.createdAtISO || record.createdAt);
            renderCaexSelects();
            document.getElementById('ventaCaexClientSelect').value = record.shipmentId || '';
            renderVentaCaexClientInfo();
            tempCaexLineItems = (record.items || []).map(item => Object.assign({}, item, { uid: generateId('line') }));
            renderTempLineItems();
            document.getElementById('caexFullPrepaid').checked = Boolean(record.payment?.fullPrepaid);
            updatePaymentMode();
            document.getElementById('caexFullAmount').value = record.payment?.fullPrepaid ? moneyInputValue(record.payment.fullAmount || 0) : '';
            document.getElementById('caexPayOnDelivery').value = record.payment?.fullPrepaid ? '' : moneyInputValue(record.payment?.payOnDelivery || 0);
            document.getElementById('caexAdvanceAmount').value = record.payment?.fullPrepaid ? '' : moneyInputValue(record.payment?.advance || 0);
            showExistingEvidence('ventaCaexPhotos', normalizePhotos(record));
            setSubmitButtonText('ventaCaexForm', '<i class="fas fa-save mr-1"></i>Actualizar venta CAEX');
            setCancelVisible('ventaCaexForm', true);
            scrollToSection('ventas-caex');
            showToast('Modo edición de venta CAEX activado. Al guardar se corrige el stock.');
        }

        function deleteInventoryRecord(type, id) {
            const key = type === 'items' ? STORAGE_KEYS.items : STORAGE_KEYS.rauda;
            let list = readStore(key);
            list = list.filter(item => item.id !== id);
            saveStore(key, list);
            refreshEverything();
            showToast('Producto eliminado.');
        }

        function deleteClientRecord(id) {
            let clients = readStore(STORAGE_KEYS.clients);
            clients = clients.filter(client => client.id !== id);
            saveStore(STORAGE_KEYS.clients, clients);
            refreshEverything();
            showToast('Cliente eliminado.');
        }

        function deleteCaexRecord(id) {
            let records = readStore(STORAGE_KEYS.caex);
            records = records.filter(record => record.id !== id);
            saveStore(STORAGE_KEYS.caex, records);
            refreshEverything();
            showToast('Envío CAEX eliminado.');
        }

        function deleteSimpleSale(type, id) {
            const key = type === 'encuentro' ? STORAGE_KEYS.salesEncuentro : STORAGE_KEYS.salesMoto;
            let records = readStore(key);
            records = records.filter(record => record.id !== id);
            saveStore(key, records);
            refreshEverything();
            showToast('Venta eliminada.');
        }

        function deleteVentaCaexRecord(id) {
            let records = readStore(STORAGE_KEYS.salesCaex);
            records = records.filter(record => record.id !== id);
            saveStore(STORAGE_KEYS.salesCaex, records);
            refreshEverything();
            showToast('Venta CAEX eliminada.');
        }

        function openModal(title, html) {
            document.getElementById('modalTitle').textContent = title;
            document.getElementById('modalBody').innerHTML = html;
            document.getElementById('detailModal').classList.add('show');
        }

        function closeModal() {
            document.getElementById('detailModal').classList.remove('show');
        }

        function viewInventoryRecord(type, id) {
            const key = type === 'items' ? STORAGE_KEYS.items : STORAGE_KEYS.rauda;
            const record = readStore(key).find(item => item.id === id);
            if (!record) return;

            openModal(
                `Detalle · ${record.name}`,
                `
                <div class="detail-list">
                    ${record.photo ? `<div class="text-center"><img src="${record.photo}" class="thumb-preview" alt="Foto"></div>` : ''}
                    ${renderPhotoGallery(normalizePhotos(record), 'Fotos extra')}
                    <div class="detail-row"><span class="detail-label">Producto</span><div>${escapeHtml(record.name)}</div></div>
                    <div class="detail-row"><span class="detail-label">Stock</span><div>${Number(record.stock || 0)}</div></div>
                    <div class="detail-row"><span class="detail-label">Costo inversión</span><div>${formatMoney(record.cost)}</div></div>
                    ${type === 'items' ? `<div class="detail-row"><span class="detail-label">Mínimo</span><div>${Number(record.minStock || 0)}</div></div>` : ''}
                    <div class="detail-row"><span class="detail-label">Fecha ingreso</span><div>${escapeHtml(getRecordDateText(record))}</div></div>
                    <div class="detail-row"><span class="detail-label">Recibido en web</span><div>${escapeHtml(getCaptureText(record))}</div></div>
                    ${renderPhotoGallery(normalizePhotos(record), 'Fotos / evidencia')}
                    ${renderAuditRows(record)}
                </div>
                `
            );
        }

        function viewClientRecord(id) {
            const record = readStore(STORAGE_KEYS.clients).find(item => item.id === id);
            if (!record) return;

            openModal(
                `Cliente · ${record.name}`,
                `
                <div class="detail-list">
                    <div class="detail-row"><span class="detail-label">Nombre</span><div>${escapeHtml(record.name)}</div></div>
                    <div class="detail-row"><span class="detail-label">Teléfonos</span><div>${(record.phones || []).map(phone => `<span class="phone-tag">${escapeHtml(phone)}</span>`).join(' ')}</div></div>
                    <div class="detail-row"><span class="detail-label">Departamento</span><div>${escapeHtml(record.department)}</div></div>
                    <div class="detail-row"><span class="detail-label">Poblado</span><div>${escapeHtml(record.town)}</div></div>
                    ${renderPhotoGallery(normalizePhotos(record), 'Fotos / evidencia')}
                    <div class="detail-row"><span class="detail-label">Fecha registro</span><div>${escapeHtml(getRecordDateText(record))}</div></div>
                    <div class="detail-row"><span class="detail-label">Recibido en web</span><div>${escapeHtml(getCaptureText(record))}</div></div>
                    ${renderAuditRows(record)}
                </div>
                `
            );
        }

        function viewCaexRecord(id) {
            const record = readStore(STORAGE_KEYS.caex).find(item => item.id === id);
            if (!record) return;

            openModal(
                `CAEX · ${record.client.name}`,
                `
                <div class="detail-list">
                    <div class="detail-row"><span class="detail-label">Cliente</span><div>${escapeHtml(record.client.name)}</div></div>
                    <div class="detail-row"><span class="detail-label">Teléfonos</span><div>${(record.client.phones || []).map(phone => `<span class="phone-tag">${escapeHtml(phone)}</span>`).join(' ')}</div></div>
                    <div class="detail-row"><span class="detail-label">Departamento</span><div>${escapeHtml(record.client.department || '-')}</div></div>
                    <div class="detail-row"><span class="detail-label">Poblado</span><div>${escapeHtml(record.client.town || '-')}</div></div>
                    <div class="detail-row"><span class="detail-label">Comprobante</span><div>${record.receipt ? '<span class="pill pill-success">Archivo cargado</span>' : '<span class="pill pill-info">Sin archivo</span>'}</div></div>
                    ${renderPhotoGallery(normalizePhotos(record), 'Fotos extra del envío')}
                    <div class="detail-row"><span class="detail-label">Fecha envío</span><div>${escapeHtml(getRecordDateText(record))}</div></div>
                    <div class="detail-row"><span class="detail-label">Recibido en web</span><div>${escapeHtml(getCaptureText(record))}</div></div>
                    ${renderAuditRows(record)}
                </div>
                `
            );
        }

        function viewCaexReceipt(id) {
            const record = readStore(STORAGE_KEYS.caex).find(item => item.id === id);
            if (!record || !record.receipt) return;

            const isImage = /^data:image\//.test(record.receipt) || /\.(png|jpe?g|webp|gif)$/i.test(record.receipt);
            openModal(
                `Comprobante · ${record.client.name}`,
                isImage
                    ? `<div class="text-center"><img src="${record.receipt}" alt="Comprobante" style="max-width:100%; border-radius: 1rem;"></div>`
                    : `<div class="detail-row"><span class="detail-label">Archivo</span><a href="${record.receipt}" target="_blank" rel="noopener noreferrer">Abrir comprobante</a></div>`
            );
        }

        function viewSimpleSale(type, id) {
            const key = type === 'encuentro' ? STORAGE_KEYS.salesEncuentro : STORAGE_KEYS.salesMoto;
            const record = readStore(key).find(item => item.id === id);
            if (!record) return;

            const extraRow = type === 'moto'
                ? `<div class="detail-row"><span class="detail-label">Dirección</span><div>${escapeHtml(record.address)}</div></div>`
                : '';

            openModal(
                `Venta · ${type === 'encuentro' ? 'Encuentro' : 'Moto'}`,
                `
                <div class="detail-list">
                    <div class="detail-row"><span class="detail-label">Producto</span><div>${escapeHtml(record.product)}</div></div>
                    ${extraRow}
                    <div class="detail-row"><span class="detail-label">Hora de entrega</span><div>${escapeHtml(record.time)}</div></div>
                    <div class="detail-row"><span class="detail-label">Teléfono</span><div>${escapeHtml(record.phone)}</div></div>
                    <div class="detail-row"><span class="detail-label">Total</span><div>${formatMoney(record.total)}</div></div>
                    <div class="detail-row"><span class="detail-label">Costo inversión</span><div>${formatMoney(record.cost || 0)}</div></div>
                    <div class="detail-row"><span class="detail-label">Ganancia</span><div>${formatMoney(getSaleProfit(record, type))}</div></div>
                    ${renderPhotoGallery(normalizePhotos(record), 'Fotos / evidencia')}
                    <div class="detail-row"><span class="detail-label">Fecha venta</span><div>${escapeHtml(getRecordDateText(record))}</div></div>
                    <div class="detail-row"><span class="detail-label">Recibido en web</span><div>${escapeHtml(getCaptureText(record))}</div></div>
                    ${renderAuditRows(record)}
                </div>
                `
            );
        }

        function viewVentaCaexRecord(id) {
            const record = readStore(STORAGE_KEYS.salesCaex).find(item => item.id === id);
            if (!record) return;

            openModal(
                `Venta CAEX · ${record.client.name}`,
                `
                <div class="detail-list">
                    <div class="detail-row"><span class="detail-label">Cliente</span><div>${escapeHtml(record.client.name)}</div></div>
                    <div class="detail-row"><span class="detail-label">Teléfonos</span><div>${(record.client.phones || []).map(phone => `<span class="phone-tag">${escapeHtml(phone)}</span>`).join(' ')}</div></div>
                    <div class="detail-row"><span class="detail-label">Productos</span><div>${record.items.map(item => `${escapeHtml(item.productName)} · ${Number(item.units)} unidad(es) · ${item.inventoryType === 'items' ? 'Items' : 'Rauda'}`).join('<br>')}</div></div>
                    <div class="detail-row"><span class="detail-label">Pago</span><div>${record.payment.fullPrepaid ? `Pago total anticipado: ${formatMoney(record.payment.fullAmount)}` : `Anticipo: ${formatMoney(record.payment.advance)}<br>Paga al recibir: ${formatMoney(record.payment.payOnDelivery)}`}</div></div>
                    <div class="detail-row"><span class="detail-label">Total vendido</span><div>${formatMoney(paymentTotal(record.payment))}</div></div>
                    <div class="detail-row"><span class="detail-label">Costo productos</span><div>${formatMoney(getVentaCaexCost(record))}</div></div>
                    <div class="detail-row"><span class="detail-label">Ganancia</span><div>${formatMoney(getSaleProfit(record, 'caex'))}</div></div>
                    ${renderPhotoGallery(normalizePhotos(record), 'Fotos / evidencia')}
                    <div class="detail-row"><span class="detail-label">Fecha venta</span><div>${escapeHtml(getRecordDateText(record))}</div></div>
                    <div class="detail-row"><span class="detail-label">Recibido en web</span><div>${escapeHtml(getCaptureText(record))}</div></div>
                    ${renderAuditRows(record)}
                </div>
                `
            );
        }

        function applyActiveSection() {
            const hash = window.location.hash.replace('#', '');
            if (!hash) {
                document.querySelectorAll('.submenu a').forEach(link => link.classList.remove('active-sub'));
                return;
            }

            document.querySelectorAll('.submenu a').forEach(link => {
                link.classList.toggle('active-sub', link.dataset.section === hash);
            });
        }

        document.querySelectorAll('.menu-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                toggle.closest('.nav-item').classList.toggle('open');
            });
        });

        document.querySelectorAll('.submenu a').forEach(link => {
            link.addEventListener('click', () => {
                setTimeout(applyActiveSection, 80);
                if (isMobileView()) closeMenu();
            });
        });

        document.getElementById('itemsForm').addEventListener('submit', handleItemsFormSubmit);
        document.getElementById('raudaForm').addEventListener('submit', handleRaudaFormSubmit);
        document.getElementById('clientsForm').addEventListener('submit', handleClientsFormSubmit);
        document.getElementById('caexForm').addEventListener('submit', handleCaexFormSubmit);
        document.getElementById('encuentroForm').addEventListener('submit', handleEncuentroSubmit);
        document.getElementById('motoForm').addEventListener('submit', handleMotoSubmit);
        document.getElementById('ventaCaexForm').addEventListener('submit', handleVentaCaexSubmit);

        document.querySelectorAll('input[name="caexMode"]').forEach(input => input.addEventListener('change', updateCaexMode));
        document.getElementById('lineInventoryType').addEventListener('change', renderLineProductOptions);
        document.getElementById('addLineItemBtn').addEventListener('click', addTempLineItem);
        document.getElementById('caexFullPrepaid').addEventListener('change', updatePaymentMode);
        document.getElementById('ventaCaexClientSelect').addEventListener('change', renderVentaCaexClientInfo);

        document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
        document.getElementById('modalCloseBtn2').addEventListener('click', closeModal);
        document.getElementById('detailModal').addEventListener('click', event => {
            if (event.target.id === 'detailModal') closeModal();
        });

        window.addEventListener('hashchange', applyActiveSection);
        window.addEventListener('resize', setFabState);
        const backdrop = document.getElementById('sidebarBackdrop');
        if (backdrop) backdrop.addEventListener('click', closeMenu);

        setupExtraFormFields();
        initBusinessSummaryControls();

        ensureCancelButton('itemsForm', 'items');
        ensureCancelButton('raudaForm', 'rauda');
        ensureCancelButton('clientsForm', 'client');
        ensureCancelButton('caexForm', 'caex');
        ensureCancelButton('encuentroForm', 'encuentro');
        ensureCancelButton('motoForm', 'moto');
        ensureCancelButton('ventaCaexForm', 'ventaCaex');

        setupSmartUploader('itemsPhoto');
        setupSmartUploader('raudaPhoto');
        setupSmartUploader('caexReceipt', { acceptedPaste: 'image', wrapperId: 'caexReceiptUploader' });

        setFabState();
        applyDefaultRecordDates();
        updateCaexMode();
        updatePaymentMode();
        refreshEverything();

        window.addEventListener('webowner-sync-data-applied', () => {
            refreshEverything();
        });

        if (window.WebOwnerSync) {
            window.WebOwnerSync.init({ onDataApplied: refreshEverything, onToast: showToast });
        }
    
