(function () {
    const STORAGE_KEY = 'mi_sistema_expenses';
    const MOBILE_BREAKPOINT = 991;

    let selectedPhoto = '';
    let removeCurrentPhoto = false;
    const nodes = {};

    function cacheNodes() {
        [
            'expenseForm',
            'expenseId',
            'expenseType',
            'expenseQuantity',
            'expenseProduct',
            'expenseDescription',
            'expenseUnitPrice',
            'expenseTotal',
            'expensePhoto',
            'photoPreview',
            'photoPickBtn',
            'photoClearBtn',
            'cancelEditBtn',
            'formTitle',
            'filterType',
            'filterMonth',
            'filterYear',
            'filterFrom',
            'filterTo',
            'applyFiltersBtn',
            'clearFiltersBtn',
            'expensesTableBody',
            'summaryTotal',
            'summaryPersonal',
            'summaryCompany',
            'summaryCount',
            'activeFilterLabel',
            'tableCountLabel',
            'detailModal',
            'modalTitle',
            'modalBody',
            'modalCloseBtn',
            'modalCloseBtn2',
            'toastSoft'
        ].forEach(id => {
            nodes[id] = document.getElementById(id);
        });
    }

    function isMobileSidebarMode() {
        return window.innerWidth <= MOBILE_BREAKPOINT;
    }

    function setMenuState(isOpen) {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebarBackdrop');
        const fab = document.getElementById('mobileMenuFab');

        if (!sidebar) return;

        if (!isMobileSidebarMode()) {
            sidebar.classList.remove('active');
            backdrop?.classList.remove('show');
            return;
        }

        sidebar.classList.toggle('active', Boolean(isOpen));
        backdrop?.classList.toggle('show', Boolean(isOpen));
        if (fab) fab.innerHTML = `<i class="fas fa-${isOpen ? 'times' : 'bars'}"></i>`;
    }

    window.openMenu = function () {
        setMenuState(true);
    };

    window.closeMenu = function () {
        setMenuState(false);
    };

    window.toggleMenu = function () {
        if (!isMobileSidebarMode()) return;
        const sidebar = document.getElementById('sidebar');
        setMenuState(!sidebar.classList.contains('active'));
    };

    function readStore() {
        try {
            const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            return Array.isArray(value) ? sortRecordsByDate(value) : [];
        } catch (error) {
            return [];
        }
    }

    function saveStore(list) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        if (window.WebOwnerSync) window.WebOwnerSync.queueAutoSync();
    }

    function sortRecordsByDate(list) {
        return [...list].sort((a, b) => {
            const aDate = new Date((a && (a.createdAtISO || a.createdAt)) || 0).getTime();
            const bDate = new Date((b && (b.createdAtISO || b.createdAt)) || 0).getTime();
            return bDate - aDate;
        });
    }

    function generateId(prefix = 'expense') {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return `${prefix}_${window.crypto.randomUUID()}`;
        }
        return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function nowText() {
        return new Date().toLocaleString('es-HN');
    }

    function toNumber(value) {
        return Number.parseFloat(value) || 0;
    }

    function formatNumber(value) {
        return Number(value || 0).toFixed(2);
    }

    function formatMoney(value) {
        return 'L ' + Number(value || 0).toFixed(2);
    }

    function formatDate(value) {
        if (!value) return '-';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return escapeHtml(value);
        return parsed.toLocaleString('es-HN');
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function readFileAsDataUrl(file) {
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

    function showToast(message) {
        nodes.toastSoft.textContent = message;
        nodes.toastSoft.classList.add('show');
        clearTimeout(showToast._timer);
        showToast._timer = setTimeout(() => nodes.toastSoft.classList.remove('show'), 2400);
    }

    function updatePhotoPreview(photo) {
        if (photo) {
            nodes.photoPreview.innerHTML = `<img src="${photo}" alt="Foto del producto">`;
            return;
        }
        nodes.photoPreview.innerHTML = '<div><i class="fas fa-camera"></i>Sin foto</div>';
    }

    function autoCalculateTotal() {
        const quantity = toNumber(nodes.expenseQuantity.value);
        const unitPrice = toNumber(nodes.expenseUnitPrice.value);
        if (quantity > 0 && unitPrice > 0) {
            nodes.expenseTotal.value = formatNumber(quantity * unitPrice);
        }
    }

    function getActiveFilters() {
        return {
            type: nodes.filterType.value,
            month: nodes.filterMonth.value,
            year: nodes.filterYear.value,
            from: nodes.filterFrom.value,
            to: nodes.filterTo.value
        };
    }

    function startOfDay(value) {
        const date = value instanceof Date ? value : new Date(value);
        return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    }

    function filterExpenses(list) {
        const filters = getActiveFilters();
        return list.filter(expense => {
            const created = new Date(expense.createdAtISO || expense.createdAt || 0);
            if (Number.isNaN(created.getTime())) return false;

            const typeOk = filters.type === 'all' || expense.type === filters.type;
            const monthOk = !filters.month || created.getMonth() + 1 === Number(filters.month);
            const yearOk = !filters.year || created.getFullYear() === Number(filters.year);
            const fromOk = !filters.from || startOfDay(created) >= startOfDay(filters.from + 'T00:00:00');
            const toOk = !filters.to || startOfDay(created) <= startOfDay(filters.to + 'T00:00:00');

            return typeOk && monthOk && yearOk && fromOk && toOk;
        });
    }

    function sumByType(list, type) {
        return list.reduce((total, expense) => {
            return expense.type === type ? total + Number(expense.total || 0) : total;
        }, 0);
    }

    function renderSummary(list) {
        const personal = sumByType(list, 'personal');
        const company = sumByType(list, 'empresa');
        const total = personal + company;

        nodes.summaryTotal.textContent = formatMoney(total);
        nodes.summaryPersonal.textContent = formatMoney(personal);
        nodes.summaryCompany.textContent = formatMoney(company);
        nodes.summaryCount.textContent = String(list.length);
        nodes.tableCountLabel.textContent = `${list.length} gasto${list.length === 1 ? '' : 's'}`;
    }

    function renderFilterLabel(count) {
        const filters = getActiveFilters();
        const parts = [];
        if (filters.type !== 'all') parts.push(filters.type === 'personal' ? 'Gastos Personales' : 'Gastos Empresa');
        if (filters.month) parts.push(nodes.filterMonth.options[nodes.filterMonth.selectedIndex].text);
        if (filters.year) parts.push(filters.year);
        if (filters.from || filters.to) parts.push(`${filters.from || 'Inicio'} a ${filters.to || 'Hoy'}`);
        nodes.activeFilterLabel.textContent = `${parts.length ? parts.join(' | ') : 'Mostrando todos'} (${count})`;
    }

    function renderTable(list) {
        if (!list.length) {
            nodes.expensesTableBody.innerHTML = `
                <tr>
                    <td colspan="9">
                        <div class="empty-state">No hay gastos para mostrar.</div>
                    </td>
                </tr>
            `;
            return;
        }

        nodes.expensesTableBody.innerHTML = list.map(expense => {
            const isCompany = expense.type === 'empresa';
            const typeLabel = isCompany ? 'Gastos Empresa' : 'Gastos Personales';
            const typeClass = isCompany ? 'pill-info' : 'pill-primary';
            const photo = expense.photo
                ? `<img src="${expense.photo}" class="thumb-mini" alt="Foto de ${escapeHtml(expense.product)}">`
                : '<span class="empty-thumb"><i class="fas fa-image"></i></span>';
            const unit = Number(expense.unitPrice || 0) > 0 ? formatMoney(expense.unitPrice) : '<span class="pill pill-warning">Manual</span>';
            const edited = expense.updatedAtISO ? formatDate(expense.updatedAtISO) : '<span class="muted-line">Sin edicion</span>';

            return `
                <tr>
                    <td>${photo}</td>
                    <td>
                        <strong>${escapeHtml(expense.product)}</strong>
                        <div class="muted-line">${escapeHtml(expense.description || '')}</div>
                    </td>
                    <td><span class="pill ${typeClass}">${typeLabel}</span></td>
                    <td>${formatNumber(expense.quantity)}</td>
                    <td>${unit}</td>
                    <td><strong>${formatMoney(expense.total)}</strong></td>
                    <td>${formatDate(expense.createdAtISO || expense.createdAt)}</td>
                    <td>${edited}</td>
                    <td>
                        <div class="actions-inline">
                            <button type="button" class="btn btn-info-soft btn-sm" data-action="view" data-id="${escapeHtml(expense.id)}">Ver</button>
                            <button type="button" class="btn btn-success-soft btn-sm" data-action="edit" data-id="${escapeHtml(expense.id)}">Editar</button>
                            <button type="button" class="btn btn-danger-soft btn-sm" data-action="delete" data-id="${escapeHtml(expense.id)}">Eliminar</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function render() {
        const filtered = filterExpenses(readStore());
        renderSummary(filtered);
        renderFilterLabel(filtered.length);
        renderTable(filtered);
    }

    function resetForm() {
        nodes.expenseForm.reset();
        nodes.expenseId.value = '';
        nodes.expenseQuantity.value = 1;
        selectedPhoto = '';
        removeCurrentPhoto = false;
        nodes.expensePhoto.value = '';
        nodes.formTitle.textContent = 'Nuevo gasto';
        nodes.cancelEditBtn.style.display = 'none';
        updatePhotoPreview('');
    }

    async function handleSubmit(event) {
        event.preventDefault();

        const list = readStore();
        const id = nodes.expenseId.value;
        const existing = list.find(item => item.id === id);
        const quantity = toNumber(nodes.expenseQuantity.value) || 1;
        const unitPrice = toNumber(nodes.expenseUnitPrice.value);
        const manualTotal = toNumber(nodes.expenseTotal.value);
        const total = unitPrice > 0 ? quantity * unitPrice : manualTotal;
        const photoFromInput = await readFileAsDataUrl(nodes.expensePhoto.files?.[0]);

        if (!nodes.expenseProduct.value.trim()) {
            showToast('Escribe el producto.');
            nodes.expenseProduct.focus();
            return;
        }

        if (total <= 0) {
            showToast('Ingresa un total valido.');
            nodes.expenseTotal.focus();
            return;
        }

        const photo = photoFromInput || selectedPhoto || (removeCurrentPhoto ? '' : existing?.photo || '');
        const payload = {
            id: existing ? existing.id : generateId(),
            type: nodes.expenseType.value,
            product: nodes.expenseProduct.value.trim(),
            description: nodes.expenseDescription.value.trim(),
            quantity,
            unitPrice,
            total,
            photo,
            createdAt: existing ? existing.createdAt : nowText(),
            createdAtISO: existing ? existing.createdAtISO : nowIso(),
            updatedAt: existing ? nowText() : '',
            updatedAtISO: existing ? nowIso() : ''
        };

        const next = existing
            ? list.map(item => item.id === existing.id ? payload : item)
            : [payload, ...list];

        saveStore(next);
        resetForm();
        render();
        showToast(existing ? 'Gasto actualizado.' : 'Gasto guardado.');
    }

    function editExpense(id) {
        const expense = readStore().find(item => item.id === id);
        if (!expense) return;

        nodes.expenseId.value = expense.id;
        nodes.expenseType.value = expense.type || 'personal';
        nodes.expenseQuantity.value = formatNumber(expense.quantity || 1);
        nodes.expenseProduct.value = expense.product || '';
        nodes.expenseDescription.value = expense.description || '';
        nodes.expenseUnitPrice.value = Number(expense.unitPrice || 0) > 0 ? formatNumber(expense.unitPrice) : '';
        nodes.expenseTotal.value = formatNumber(expense.total);
        selectedPhoto = expense.photo || '';
        removeCurrentPhoto = false;
        nodes.expensePhoto.value = '';
        nodes.formTitle.textContent = 'Editar gasto';
        nodes.cancelEditBtn.style.display = 'inline-block';
        updatePhotoPreview(selectedPhoto);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function deleteExpense(id) {
        const list = readStore();
        const expense = list.find(item => item.id === id);
        if (!expense) return;

        if (!confirm(`Eliminar gasto de "${expense.product}"?`)) return;

        saveStore(list.filter(item => item.id !== id));
        if (nodes.expenseId.value === id) resetForm();
        render();
        showToast('Gasto eliminado.');
    }

    function viewExpense(id) {
        const expense = readStore().find(item => item.id === id);
        if (!expense) return;

        const typeLabel = expense.type === 'empresa' ? 'Gastos Empresa' : 'Gastos Personales';
        nodes.modalTitle.textContent = expense.product || 'Detalle';
        nodes.modalBody.innerHTML = `
            <div class="detail-list">
                ${expense.photo ? `<div class="text-center"><img src="${expense.photo}" class="modal-photo" alt="Foto del producto"></div>` : ''}
                <div class="detail-row"><span class="detail-label">Seccion</span><div>${typeLabel}</div></div>
                <div class="detail-row"><span class="detail-label">Producto</span><div>${escapeHtml(expense.product)}</div></div>
                <div class="detail-row"><span class="detail-label">Descripcion</span><div>${escapeHtml(expense.description || '-')}</div></div>
                <div class="detail-row"><span class="detail-label">Cantidad</span><div>${formatNumber(expense.quantity)}</div></div>
                <div class="detail-row"><span class="detail-label">Precio unitario</span><div>${Number(expense.unitPrice || 0) > 0 ? formatMoney(expense.unitPrice) : 'Manual'}</div></div>
                <div class="detail-row"><span class="detail-label">Total gastado</span><div>${formatMoney(expense.total)}</div></div>
                <div class="detail-row"><span class="detail-label">Fecha ingresado</span><div>${formatDate(expense.createdAtISO || expense.createdAt)}</div></div>
                <div class="detail-row"><span class="detail-label">Ultima fecha de edicion</span><div>${expense.updatedAtISO ? formatDate(expense.updatedAtISO) : 'Sin edicion'}</div></div>
            </div>
        `;
        nodes.detailModal.classList.add('show');
    }

    function closeModal() {
        nodes.detailModal.classList.remove('show');
    }

    function clearFilters() {
        nodes.filterType.value = 'all';
        nodes.filterMonth.value = '';
        nodes.filterYear.value = '';
        nodes.filterFrom.value = '';
        nodes.filterTo.value = '';
        render();
    }

    function bindEvents() {
        document.querySelectorAll('.menu-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                toggle.closest('.nav-item').classList.toggle('open');
            });
        });

        document.querySelectorAll('.navigation a[href]:not(.menu-toggle)').forEach(link => {
            link.addEventListener('click', () => {
                if (isMobileSidebarMode()) setTimeout(window.closeMenu, 120);
            });
        });

        window.addEventListener('resize', () => setMenuState(false));
        nodes.expenseForm.addEventListener('submit', handleSubmit);
        nodes.cancelEditBtn.addEventListener('click', resetForm);
        nodes.expenseQuantity.addEventListener('input', autoCalculateTotal);
        nodes.expenseUnitPrice.addEventListener('input', autoCalculateTotal);
        nodes.photoPickBtn.addEventListener('click', () => nodes.expensePhoto.click());
        nodes.photoClearBtn.addEventListener('click', () => {
            selectedPhoto = '';
            removeCurrentPhoto = true;
            nodes.expensePhoto.value = '';
            updatePhotoPreview('');
        });
        nodes.expensePhoto.addEventListener('change', async () => {
            selectedPhoto = await readFileAsDataUrl(nodes.expensePhoto.files?.[0]);
            removeCurrentPhoto = false;
            updatePhotoPreview(selectedPhoto);
        });

        [
            nodes.filterType,
            nodes.filterMonth,
            nodes.filterYear,
            nodes.filterFrom,
            nodes.filterTo
        ].forEach(input => input.addEventListener('change', render));

        nodes.applyFiltersBtn.addEventListener('click', render);
        nodes.clearFiltersBtn.addEventListener('click', clearFilters);

        nodes.expensesTableBody.addEventListener('click', event => {
            const button = event.target.closest('[data-action]');
            if (!button) return;
            const action = button.dataset.action;
            const id = button.dataset.id;
            if (action === 'view') viewExpense(id);
            if (action === 'edit') editExpense(id);
            if (action === 'delete') deleteExpense(id);
        });

        nodes.modalCloseBtn.addEventListener('click', closeModal);
        nodes.modalCloseBtn2.addEventListener('click', closeModal);
        nodes.detailModal.addEventListener('click', event => {
            if (event.target.id === 'detailModal') closeModal();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeModal();
        });
    }

    function init() {
        cacheNodes();
        bindEvents();
        setMenuState(false);
        updatePhotoPreview('');
        render();

        window.addEventListener('webowner-sync-data-applied', render);

        if (window.WebOwnerSync) {
            window.WebOwnerSync.init({ onDataApplied: render, onToast: showToast });
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
