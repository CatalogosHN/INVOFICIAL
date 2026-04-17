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

        function toggleMenu() {
            document.getElementById('sidebar').classList.toggle('active');
        }

        function sortRecordsByDate(list) {
            if (!Array.isArray(list)) return [];
            return [...list].sort((a, b) => {
                const aDate = new Date((a && (a.createdAtISO || a.updatedAtISO || a.createdAt || a.updatedAt)) || 0).getTime();
                const bDate = new Date((b && (b.createdAtISO || b.updatedAtISO || b.createdAt || b.updatedAt)) || 0).getTime();
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
            localStorage.setItem(key, JSON.stringify(value));
            if (window.WebOwnerSync) window.WebOwnerSync.queueAutoSync();
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

        function escapeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function formatMoney(value) {
            if (value === '' || value === null || value === undefined) return '-';
            return 'L ' + Number(value || 0).toFixed(2);
        }

        function getPhones(phone1, phone2, phone3) {
            return [phone1, phone2, phone3].map(v => (v || '').trim()).filter(Boolean);
        }

        function fileToDataUrl(file) {
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

        function openUploadPicker(inputId) {
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

        function clearUploadSelection(mainInputId) {
            const mainInput = document.getElementById(mainInputId);
            const cameraInput = document.getElementById(mainInputId + 'Camera');
            if (mainInput) mainInput.value = '';
            if (cameraInput) cameraInput.value = '';
            updateUploadPreview(mainInputId, null);
        }

        function handleSmartUploadFile(mainInputId, file, fromPaste = false) {
            if (!file) return;
            const mainInput = document.getElementById(mainInputId);
            if (!mainInput) return;
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
                zone.focus();
                wrapper.classList.add('is-focus');
            });

            zone.addEventListener('focus', () => wrapper.classList.add('is-focus'));
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
                itemsBody.innerHTML = renderEmptyRow(7, 'No hay productos guardados en Items.');
            } else {
                itemsBody.innerHTML = items.map(item => {
                    const low = Number(item.minStock || 0) > 0 && Number(item.stock || 0) <= Number(item.minStock || 0);
                    return `
                        <tr>
                            <td>${item.photo ? `<img src="${item.photo}" alt="Foto" class="thumb-mini">` : '<span class="pill pill-info">Sin foto</span>'}</td>
                            <td><strong>${escapeHtml(item.name)}</strong></td>
                            <td>${Number(item.stock || 0)}</td>
                            <td>${formatMoney(item.cost)}</td>
                            <td>${Number(item.minStock || 0)}</td>
                            <td><span class="pill ${low ? 'pill-warning' : 'pill-success'}">${low ? 'Stock bajo' : 'Disponible'}</span></td>
                            <td>
                                <div class="actions-inline">
                                    <button class="btn btn-info-soft btn-sm" onclick="viewInventoryRecord('items','${item.id}')">Ver</button>
                                    <button class="btn btn-danger-soft btn-sm" onclick="deleteInventoryRecord('items','${item.id}')">Eliminar</button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
            }

            const raudaBody = document.getElementById('raudaTableBody');
            if (!rauda.length) {
                raudaBody.innerHTML = renderEmptyRow(5, 'No hay productos guardados en Rauda.');
            } else {
                raudaBody.innerHTML = rauda.map(item => `
                    <tr>
                        <td>${item.photo ? `<img src="${item.photo}" alt="Foto" class="thumb-mini">` : '<span class="pill pill-info">Sin foto</span>'}</td>
                        <td><strong>${escapeHtml(item.name)}</strong></td>
                        <td>${Number(item.stock || 0)}</td>
                        <td>${formatMoney(item.cost)}</td>
                        <td>
                            <div class="actions-inline">
                                <button class="btn btn-info-soft btn-sm" onclick="viewInventoryRecord('rauda','${item.id}')">Ver</button>
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
                body.innerHTML = renderEmptyRow(6, 'No hay clientes registrados todavía.');
                return;
            }

            body.innerHTML = clients.map(client => `
                <tr>
                    <td><strong>${escapeHtml(client.name)}</strong></td>
                    <td>
                        <div class="phone-tags">
                            ${(client.phones || []).map(phone => `<span class="phone-tag">${escapeHtml(phone)}</span>`).join('') || '<span class="pill pill-info">Sin teléfono</span>'}
                        </div>
                    </td>
                    <td>${escapeHtml(client.department || '-')}</td>
                    <td>${escapeHtml(client.town || '-')}</td>
                    <td>${escapeHtml(client.createdAt || '-')}</td>
                    <td>
                        <div class="actions-inline">
                            <button class="btn btn-info-soft btn-sm" onclick="viewClientRecord('${client.id}')">Ver</button>
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
                body.innerHTML = renderEmptyRow(7, 'No hay envíos CAEX guardados todavía.');
                return;
            }

            body.innerHTML = records.map(record => `
                <tr>
                    <td><strong>${escapeHtml(record.client.name)}</strong></td>
                    <td>
                        <div class="phone-tags">
                            ${(record.client.phones || []).map(phone => `<span class="phone-tag">${escapeHtml(phone)}</span>`).join('') || '<span class="pill pill-info">Sin teléfono</span>'}
                        </div>
                    </td>
                    <td>${escapeHtml(record.client.department || '-')}</td>
                    <td>${escapeHtml(record.client.town || '-')}</td>
                    <td>${record.receipt ? `<button class="btn btn-info-soft btn-sm" onclick="viewCaexReceipt('${record.id}')">Ver</button>` : '<span class="pill pill-info">Sin archivo</span>'}</td>
                    <td>${escapeHtml(record.createdAt || '-')}</td>
                    <td>
                        <div class="actions-inline">
                            <button class="btn btn-info-soft btn-sm" onclick="viewCaexRecord('${record.id}')">Ver</button>
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
                body.innerHTML = renderEmptyRow(6, 'No hay ventas de encuentro registradas.');
                return;
            }

            body.innerHTML = records.map(record => `
                <tr>
                    <td><strong>${escapeHtml(record.product)}</strong></td>
                    <td>${escapeHtml(record.time)}</td>
                    <td>${escapeHtml(record.phone)}</td>
                    <td>${formatMoney(record.total)}</td>
                    <td>${escapeHtml(record.createdAt)}</td>
                    <td>
                        <div class="actions-inline">
                            <button class="btn btn-info-soft btn-sm" onclick="viewSimpleSale('encuentro','${record.id}')">Ver</button>
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
                body.innerHTML = renderEmptyRow(6, 'No hay ventas de moto registradas.');
                return;
            }

            body.innerHTML = records.map(record => `
                <tr>
                    <td><strong>${escapeHtml(record.product)}</strong></td>
                    <td>${escapeHtml(record.address)}</td>
                    <td>${escapeHtml(record.time)}</td>
                    <td>${escapeHtml(record.phone)}</td>
                    <td>${formatMoney(record.total)}</td>
                    <td>
                        <div class="actions-inline">
                            <button class="btn btn-info-soft btn-sm" onclick="viewSimpleSale('moto','${record.id}')">Ver</button>
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
                        <div class="text-muted small">Inventario: ${item.inventoryType === 'items' ? 'Items' : 'Rauda'} · Unidades: ${Number(item.units)}</div>
                    </div>
                    <button type="button" class="btn btn-danger-soft btn-sm" onclick="removeTempLineItem('${item.uid}')">Quitar</button>
                </div>
            `).join('');
        }

        function renderVentaCaexTable() {
            const records = readStore(STORAGE_KEYS.salesCaex);
            const body = document.getElementById('ventaCaexTableBody');

            if (!records.length) {
                body.innerHTML = renderEmptyRow(5, 'No hay ventas CAEX registradas.');
                return;
            }

            body.innerHTML = records.map(record => `
                <tr>
                    <td><strong>${escapeHtml(record.client.name)}</strong></td>
                    <td>${record.items.map(item => `${escapeHtml(item.productName)} (${Number(item.units)})`).join('<br>')}</td>
                    <td>${record.payment.fullPrepaid ? `Pago total anticipado: ${formatMoney(record.payment.fullAmount)}` : `Anticipo: ${formatMoney(record.payment.advance)}<br>Paga al recibir: ${formatMoney(record.payment.payOnDelivery)}`}</td>
                    <td>${escapeHtml(record.createdAt)}</td>
                    <td>
                        <div class="actions-inline">
                            <button class="btn btn-info-soft btn-sm" onclick="viewVentaCaexRecord('${record.id}')">Ver</button>
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
            items.push({
                id: generateId('item'),
                name: document.getElementById('itemsName').value.trim(),
                stock: Number(document.getElementById('itemsStock').value),
                cost: Number(document.getElementById('itemsCost').value),
                minStock: Number(document.getElementById('itemsMin').value),
                photo: await fileToDataUrl(document.getElementById('itemsPhoto').files[0]),
                createdAt: nowText(),
                createdAtISO: nowIso()
            });
            saveStore(STORAGE_KEYS.items, items);
            event.target.reset();
            clearUploadSelection('itemsPhoto');
            refreshEverything();
            showToast('Producto guardado en Items.');
        }

        async function handleRaudaFormSubmit(event) {
            event.preventDefault();
            const rauda = readStore(STORAGE_KEYS.rauda);
            rauda.push({
                id: generateId('rauda'),
                name: document.getElementById('raudaName').value.trim(),
                stock: Number(document.getElementById('raudaStock').value),
                cost: Number(document.getElementById('raudaCost').value),
                photo: await fileToDataUrl(document.getElementById('raudaPhoto').files[0]),
                createdAt: nowText(),
                createdAtISO: nowIso()
            });
            saveStore(STORAGE_KEYS.rauda, rauda);
            event.target.reset();
            clearUploadSelection('raudaPhoto');
            refreshEverything();
            showToast('Producto guardado en Rauda.');
        }

        function handleClientsFormSubmit(event) {
            event.preventDefault();
            const clients = readStore(STORAGE_KEYS.clients);
            clients.push({
                id: generateId('client'),
                name: document.getElementById('clientName').value.trim(),
                department: document.getElementById('clientDepartment').value.trim(),
                town: document.getElementById('clientTown').value.trim(),
                phones: getPhones(
                    document.getElementById('clientPhone1').value,
                    document.getElementById('clientPhone2').value,
                    document.getElementById('clientPhone3').value
                ),
                createdAt: nowText(),
                createdAtISO: nowIso()
            });
            saveStore(STORAGE_KEYS.clients, clients);
            event.target.reset();
            refreshEverything();
            showToast('Cliente guardado correctamente.');
        }

        async function handleCaexFormSubmit(event) {
            event.preventDefault();

            const mode = document.querySelector('input[name="caexMode"]:checked').value;
            const clients = readStore(STORAGE_KEYS.clients);
            const caexRecords = readStore(STORAGE_KEYS.caex);
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

                clientData = {
                    id: generateId('client'),
                    name,
                    department,
                    town,
                    phones,
                    createdAt: nowText(),
                    createdAtISO: nowIso()
                };

                clients.push(clientData);
                saveStore(STORAGE_KEYS.clients, clients);
            }

            caexRecords.push({
                id: generateId('caex'),
                client: {
                    id: clientData.id,
                    name: clientData.name,
                    department: clientData.department,
                    town: clientData.town,
                    phones: [...(clientData.phones || [])]
                },
                receipt: await fileToDataUrl(document.getElementById('caexReceipt').files[0]),
                createdAt: nowText(),
                createdAtISO: nowIso()
            });

            saveStore(STORAGE_KEYS.caex, caexRecords);
            event.target.reset();
            clearUploadSelection('caexReceipt');
            document.getElementById('caexModeExisting').checked = true;
            updateCaexMode();
            refreshEverything();
            showToast('Envío CAEX guardado correctamente.');
        }

        function handleEncuentroSubmit(event) {
            event.preventDefault();
            const records = readStore(STORAGE_KEYS.salesEncuentro);
            records.push({
                id: generateId('encuentro'),
                product: document.getElementById('encuentroProduct').value.trim(),
                time: document.getElementById('encuentroTime').value.trim(),
                phone: document.getElementById('encuentroPhone').value.trim(),
                total: Number(document.getElementById('encuentroTotal').value),
                createdAt: nowText(),
                createdAtISO: nowIso()
            });
            saveStore(STORAGE_KEYS.salesEncuentro, records);
            event.target.reset();
            refreshEverything();
            showToast('Venta de encuentro guardada.');
        }

        function handleMotoSubmit(event) {
            event.preventDefault();
            const records = readStore(STORAGE_KEYS.salesMoto);
            records.push({
                id: generateId('moto'),
                product: document.getElementById('motoProduct').value.trim(),
                address: document.getElementById('motoAddress').value.trim(),
                time: document.getElementById('motoTime').value.trim(),
                phone: document.getElementById('motoPhone').value.trim(),
                total: Number(document.getElementById('motoTotal').value),
                createdAt: nowText(),
                createdAtISO: nowIso()
            });
            saveStore(STORAGE_KEYS.salesMoto, records);
            event.target.reset();
            refreshEverything();
            showToast('Venta de moto guardada.');
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
                units
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

        function handleVentaCaexSubmit(event) {
            event.preventDefault();

            const shipmentId = document.getElementById('ventaCaexClientSelect').value;
            const shipment = readStore(STORAGE_KEYS.caex).find(record => record.id === shipmentId);

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

            const stockResult = applyStockReduction(tempCaexLineItems);
            if (!stockResult.ok) {
                showToast(stockResult.message);
                return;
            }

            const sales = readStore(STORAGE_KEYS.salesCaex);
            sales.push({
                id: generateId('salecaex'),
                shipmentId,
                client: shipment.client,
                items: tempCaexLineItems.map(item => ({
                    inventoryType: item.inventoryType,
                    productId: item.productId,
                    productName: item.productName,
                    units: Number(item.units)
                })),
                payment: fullPrepaid
                    ? {
                        fullPrepaid: true,
                        fullAmount: Number(fullAmount || 0)
                    }
                    : {
                        fullPrepaid: false,
                        payOnDelivery: Number(payOnDelivery || 0),
                        advance: Number(advanceAmount || 0)
                    },
                createdAt: nowText(),
                createdAtISO: nowIso()
            });

            saveStore(STORAGE_KEYS.salesCaex, sales);

            tempCaexLineItems = [];
            event.target.reset();
            updatePaymentMode();
            renderTempLineItems();
            refreshEverything();
            showToast('Venta CAEX guardada y stock actualizado.');
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
                    <div class="detail-row"><span class="detail-label">Producto</span><div>${escapeHtml(record.name)}</div></div>
                    <div class="detail-row"><span class="detail-label">Stock</span><div>${Number(record.stock || 0)}</div></div>
                    <div class="detail-row"><span class="detail-label">Costo inversión</span><div>${formatMoney(record.cost)}</div></div>
                    ${type === 'items' ? `<div class="detail-row"><span class="detail-label">Mínimo</span><div>${Number(record.minStock || 0)}</div></div>` : ''}
                    <div class="detail-row"><span class="detail-label">Fecha</span><div>${escapeHtml(record.createdAt || '-')}</div></div>
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
                    <div class="detail-row"><span class="detail-label">Fecha</span><div>${escapeHtml(record.createdAt || '-')}</div></div>
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
                    <div class="detail-row"><span class="detail-label">Fecha</span><div>${escapeHtml(record.createdAt)}</div></div>
                </div>
                `
            );
        }

        function viewCaexReceipt(id) {
            const record = readStore(STORAGE_KEYS.caex).find(item => item.id === id);
            if (!record || !record.receipt) return;

            const isImage = /^data:image\//.test(record.receipt);
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
                    <div class="detail-row"><span class="detail-label">Fecha</span><div>${escapeHtml(record.createdAt)}</div></div>
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
                    <div class="detail-row"><span class="detail-label">Fecha</span><div>${escapeHtml(record.createdAt)}</div></div>
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

        setupSmartUploader('itemsPhoto');
        setupSmartUploader('raudaPhoto');
        setupSmartUploader('caexReceipt', { acceptedPaste: 'image', wrapperId: 'caexReceiptUploader' });

        updateCaexMode();
        updatePaymentMode();
        refreshEverything();

        window.addEventListener('webowner-sync-data-applied', () => {
            refreshEverything();
        });

        if (window.WebOwnerSync) {
            window.WebOwnerSync.init({ onDataApplied: refreshEverything, onToast: showToast });
        }
    
