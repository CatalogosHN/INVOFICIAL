
        const STORAGE_KEYS = {
            items: 'mi_sistema_items_inventory',
            rauda: 'mi_sistema_rauda_inventory',
            clients: 'mi_sistema_clients',
            caex: 'mi_sistema_caex_shipments',
            salesEncuentro: 'mi_sistema_sales_encuentro',
            salesMoto: 'mi_sistema_sales_moto',
            salesCaex: 'mi_sistema_sales_caex'
        };

        function isMobileSidebarMode() {
            return window.innerWidth <= 991;
        }

        function setMenuState(isOpen) {
            const sidebar = document.getElementById('sidebar');
            const backdrop = document.getElementById('sidebarBackdrop');
            const fab = document.getElementById('mobileMenuFab');

            if (!sidebar) return;

            if (!isMobileSidebarMode()) {
                sidebar.classList.remove('active');
                backdrop?.classList.remove('show');
                fab?.classList.remove('is-hidden');
                document.body.classList.remove('menu-open');
                return;
            }

            sidebar.classList.toggle('active', Boolean(isOpen));
            backdrop?.classList.toggle('show', Boolean(isOpen));
            fab?.classList.toggle('is-hidden', Boolean(isOpen));
            document.body.classList.toggle('menu-open', Boolean(isOpen));
        }

        function openMenu() {
            setMenuState(true);
        }

        function closeMenu() {
            setMenuState(false);
        }

        function toggleMenu() {
            if (!isMobileSidebarMode()) return;
            const sidebar = document.getElementById('sidebar');
            setMenuState(!sidebar.classList.contains('active'));
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

        function formatPhones(phones) {
            return (phones || []).filter(Boolean).join(', ');
        }

        function renderEmptyState(containerId, message) {
            document.getElementById(containerId).innerHTML = `<div class="empty-state">${message}</div>`;
        }

        function renderDashboard() {
            const items = readStore(STORAGE_KEYS.items);
            const rauda = readStore(STORAGE_KEYS.rauda);
            const clients = readStore(STORAGE_KEYS.clients);
            const caex = readStore(STORAGE_KEYS.caex);
            const salesEncuentro = readStore(STORAGE_KEYS.salesEncuentro);
            const salesMoto = readStore(STORAGE_KEYS.salesMoto);
            const salesCaex = readStore(STORAGE_KEYS.salesCaex);

            document.getElementById('countItems').textContent = items.length;
            document.getElementById('countRauda').textContent = rauda.length;
            document.getElementById('countClients').textContent = clients.length;
            document.getElementById('countCaex').textContent = caex.length;
            document.getElementById('countSales').textContent = salesEncuentro.length + salesMoto.length + salesCaex.length;

            const lowStock = items.filter(item => Number(item.minStock || 0) > 0 && Number(item.stock || 0) <= Number(item.minStock || 0));
            if (!lowStock.length) {
                renderEmptyState('lowStockList', 'No hay productos con stock bajo por ahora.');
            } else {
                document.getElementById('lowStockList').innerHTML = lowStock.slice(0, 6).map(item => `
                    <div class="list-item-soft">
                        <div class="item-main">
                            <strong>${escapeHtml(item.name)}</strong>
                            <div class="item-muted">Stock actual: ${Number(item.stock || 0)} · Mínimo: ${Number(item.minStock || 0)}</div>
                        </div>
                        <span class="pill-badge pill-danger">Stock bajo</span>
                    </div>
                `).join('');
            }

            const recentClients = [...clients].sort((a, b) => new Date(b.createdAtISO || 0) - new Date(a.createdAtISO || 0)).slice(0, 6);
            if (!recentClients.length) {
                renderEmptyState('recentClientsList', 'Aún no hay clientes registrados.');
            } else {
                document.getElementById('recentClientsList').innerHTML = recentClients.map(client => `
                    <div class="list-item-soft">
                        <div class="item-main">
                            <strong>${escapeHtml(client.name)}</strong>
                            <div class="item-muted">${escapeHtml(formatPhones(client.phones)) || 'Sin teléfono'} · ${escapeHtml(client.department || '')}${client.town ? ' · ' + escapeHtml(client.town) : ''}</div>
                        </div>
                        <span class="pill-badge pill-success">Cliente</span>
                    </div>
                `).join('');
            }
        }

        function escapeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function setupResponsiveSidebar() {
            document.querySelectorAll('.navigation a[href]:not(.menu-toggle), .submenu button').forEach(link => {
                link.addEventListener('click', () => {
                    if (isMobileSidebarMode()) {
                        setTimeout(closeMenu, 120);
                    }
                });
            });

            window.addEventListener('resize', () => {
                setMenuState(false);
            });

            setMenuState(false);
        }

        document.querySelectorAll('.menu-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const parent = toggle.closest('.nav-item');
                parent.classList.toggle('open');
            });
        });

        document.querySelectorAll('.nav-item.has-sub').forEach(item => item.classList.add('open'));
        setupResponsiveSidebar();
        renderDashboard();
    