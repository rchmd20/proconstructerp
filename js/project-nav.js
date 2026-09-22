        // ===================================================================
        function initProjectSelector() {
            const sel = document.getElementById('projectSelect');
            sel.innerHTML = '';
            const visible = getVisibleProjects();
            if (visible.length === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'Belum ada proyek';
                sel.appendChild(opt);
                return;
            }
            visible.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = `${p.kode} - ${p.nama}`;
                if (p.id === activeProjectId) opt.selected = true;
                sel.appendChild(opt);
            });
        }

        function switchProject(pid) {
            // User hanya boleh berada pada 1 proyek yang telah ia gabung (tidak bisa pindah proyek lain).
            if (!isAdminUser()) return;
            activeProjectId = pid;
            localStorage.setItem('erp_active_project', activeProjectId);
            updateSidebarProjectInfo();
            renderActiveTabContent();
        }

        function updateSidebarProjectInfo() {
            const visible = getVisibleProjects();
            const proj = visible.find(p => p.id === activeProjectId) || visible[0];
            if (!proj) {
                document.getElementById('sidebarProjectTitle').innerText = 'Belum ada proyek';
                document.getElementById('sidebarProjectSub').innerText = '-';
                return;
            }
            document.getElementById('sidebarProjectTitle').innerText = proj.nama;
            document.getElementById('sidebarProjectSub').innerText = `${proj.kode} • ${proj.lokasi}`;
        }

        // Admin: buka form lengkap Tambah/Edit Proyek.
        // User: "Tambah Proyek" diganti fitur Gabung Proyek — hanya bisa input kode dari Admin.
        function openProjectModal(isEdit) {
            if (!isAdminUser()) {
                openUserJoinProjectModal(false);
                return;
            }
            document.getElementById('projectModal').classList.remove('hidden');
            if (isEdit) {
                document.getElementById('projModalTitle').innerText = 'Edit Proyek Aktif';
                const p = projects.find(x => x.id === activeProjectId);
                if (p) {
                    document.getElementById('pmKode').value = p.kode;
                    document.getElementById('pmNama').value = p.nama;
                    document.getElementById('pmLokasi').value = p.lokasi;
                    document.getElementById('pmOwner').value = p.owner;
                    document.getElementById('pmNilai').value = p.nilai;
                    document.getElementById('pmTglMulai').value = p.tglMulai;
                    document.getElementById('pmTglSelesai').value = p.tglSelesai;
                }
            } else {
                document.getElementById('projModalTitle').innerText = 'Input Proyek Baru';
                document.getElementById('projectForm').reset();
            }
        }

        function closeProjectModal() {
            document.getElementById('projectModal').classList.add('hidden');
        }

        let tempProjectLogo = '';
        function previewProjectLogo(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
                tempProjectLogo = evt.target.result;
                document.getElementById('pmLogoPreview').innerHTML = `<img src="${tempProjectLogo}" class="w-full h-full object-cover rounded-lg">`;
            };
            reader.readAsDataURL(file);
        }

        function handleProjectFormSubmit(e) {
            e.preventDefault();
            if (!isAdminUser()) {
                alert('Akses ditolak. Hanya Admin yang dapat membuat/mengedit proyek.');
                return;
            }
            const kode = document.getElementById('pmKode').value.trim();
            const nama = document.getElementById('pmNama').value.trim();
            const lokasi = document.getElementById('pmLokasi').value.trim();
            const owner = document.getElementById('pmOwner').value.trim();
            const nilai = parseFloat(document.getElementById('pmNilai').value) || 0;
            const tglMulai = document.getElementById('pmTglMulai').value;
            const tglSelesai = document.getElementById('pmTglSelesai').value;

            const existingIdx = projects.findIndex(p => p.id === activeProjectId && p.ownerId === currentUser.id);
            if (existingIdx !== -1 && document.getElementById('projModalTitle').innerText.includes('Edit')) {
                projects[existingIdx] = {
                    ...projects[existingIdx],
                    kode, nama, lokasi, owner, nilai, tglMulai, tglSelesai,
                    logo: tempProjectLogo || projects[existingIdx].logo
                };
            } else {
                const newId = 'PRJ-' + Date.now();
                projects.push({
                    id: newId, kode, nama, lokasi, owner, nilai, tglMulai, tglSelesai,
                    logo: tempProjectLogo, ppn: 11, pph: 2, ownerId: currentUser.id
                });
                activeProjectId = newId;
            }

            localStorage.setItem('erp_projects', JSON.stringify(projects));
            localStorage.setItem('erp_active_project', activeProjectId);
            closeProjectModal();
            initProjectSelector();
            updateSidebarProjectInfo();
            renderActiveTabContent();
        }

        function confirmDeleteProject() {
            if (!isAdminUser()) {
                alert('Akses ditolak. Hanya Admin yang dapat menghapus proyek.');
                return;
            }
            const owned = projects.filter(p => p.ownerId === currentUser.id);
            if (owned.length <= 1) {
                alert('Proyek minimal harus ada 1!');
                return;
            }
            if (confirm('Yakin ingin menghapus proyek aktif ini beserta seluruh datanya?')) {
                projects = projects.filter(p => p.id !== activeProjectId);
                const remaining = projects.filter(p => p.ownerId === currentUser.id);
                activeProjectId = remaining[0].id;
                localStorage.setItem('erp_projects', JSON.stringify(projects));
                localStorage.setItem('erp_active_project', activeProjectId);
                initProjectSelector();
                updateSidebarProjectInfo();
                renderActiveTabContent();
            }
        }

        // ===================================================================
        // GABUNG PROYEK (khusus akun User) — hanya input Kode Proyek dari Admin
        // ===================================================================
        function openUserJoinProjectModal(forced) {
            const modal = document.getElementById('userJoinProjectModal');
            if (!modal) return;
            document.getElementById('ujpKode').value = '';
            const closeBtn = document.getElementById('ujpCloseBtn');
            const cancelBtn = document.getElementById('ujpCancelBtn');
            const forcedNotice = document.getElementById('ujpForcedNotice');
            if (forced) {
                if (closeBtn) closeBtn.classList.add('hidden');
                if (cancelBtn) cancelBtn.classList.add('hidden');
                if (forcedNotice) forcedNotice.classList.remove('hidden');
            } else {
                if (closeBtn) closeBtn.classList.remove('hidden');
                if (cancelBtn) cancelBtn.classList.remove('hidden');
                if (forcedNotice) forcedNotice.classList.add('hidden');
            }
            modal.classList.remove('hidden');
        }

        function closeUserJoinProjectModal() {
            // Tidak boleh ditutup jika User belum tergabung di proyek manapun (mode wajib).
            if (currentUser && currentUser.role === 'User' && !currentUser.projectId) return;
            document.getElementById('userJoinProjectModal').classList.add('hidden');
        }

        function handleUserJoinProjectSubmit(e) {
            e.preventDefault();
            const kode = document.getElementById('ujpKode').value.trim();
            if (!kode) return;
            const matched = projects.find(p => p.kode.toLowerCase() === kode.toLowerCase());
            if (!matched) {
                alert('Kode proyek tidak ditemukan. Periksa kembali kode yang diberikan Admin Anda.');
                return;
            }
            currentUser.projectId = matched.id;
            const uIdx = users.findIndex(u => u.id === currentUser.id);
            if (uIdx !== -1) users[uIdx] = currentUser;
            localStorage.setItem('erp_users', JSON.stringify(users));
            sessionStorage.setItem('erp_current_user', JSON.stringify(currentUser));
            activeProjectId = matched.id;
            localStorage.setItem('erp_active_project', activeProjectId);
            document.getElementById('userJoinProjectModal').classList.add('hidden');
            initProjectSelector();
            updateSidebarProjectInfo();
            applyRoleBasedUI();
            startWorkspaceCloudSync(currentUser);
            renderActiveTabContent();
            alert(`Berhasil bergabung ke proyek "${matched.nama}".`);
        }

        // ===================================================================
        // NAVIGATION & TAB SWITCHING
        // ===================================================================
        function switchTab(tabId) {
            if (tabId === 'data-karyawan' && !isAdminUser()) {
                alert('Akses ditolak. Halaman Data Karyawan hanya tersedia untuk akun Admin.');
                tabId = 'rab';
            }
            if (tabId === 'absen-manual' && !isAdminUser()) {
                alert('Akses ditolak. Halaman Absen Manual hanya tersedia untuk akun Admin.');
                tabId = 'rab';
            }
            currentTab = tabId;
            // Sembunyikan SEMUA section lain secara ganda: lewat class "hidden" (Tailwind) DAN langsung lewat
            // style.display (inline, prioritas paling tinggi & tidak bergantung pada CSS eksternal selesai
            // dimuat/diproses). Ini mencegah 2 halaman tampil bertumpuk (mis. Laporan Mingguan & Opname
            // sekaligus) pada koneksi/HP yang lambat memuat CSS Tailwind dari CDN.
            document.querySelectorAll('.content-section').forEach(sec => {
                sec.classList.add('hidden');
                sec.style.display = 'none';
            });
            document.querySelectorAll('.nav-sub-item').forEach(btn => btn.classList.remove('active'));
            closeSidebarMobile();
            // Selalu mulai dari atas halaman saat berpindah menu
            const mainScrollArea = document.getElementById('mainContentArea') || document.scrollingElement || document.documentElement;
            if (mainScrollArea && typeof mainScrollArea.scrollTo === 'function') {
                mainScrollArea.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
            }
            window.scrollTo({ top: 0, behavior: 'auto' });

            // Kamera absensi HANYA boleh aktif di halaman Absen Masuk / Absen Keluar.
            // Begitu user pindah ke halaman manapun selain itu, kamera langsung dimatikan.
            const isAbsenCameraTab = (tabId === 'absen-masuk' || tabId === 'absen-keluar');
            if (!isAbsenCameraTab) {
                stopWebcamStream();
            }

            // Tampilkan HANYA 1 section yang aktif - juga lewat class & inline style sekaligus.
            const showSection = (id) => {
                const el = document.getElementById(id);
                if (el) { el.classList.remove('hidden'); el.style.display = ''; }
                return el;
            };

            if (tabId.startsWith('mat-')) {
                activeMaterialSub = tabId;
                materialEditContext = null;
                showSection('sec-material');
                const btn = document.getElementById('menu-' + tabId);
                if (btn) btn.classList.add('active');
                requestAnimationFrame(renderMaterialSection);
            } else if (tabId === 'pay-labarugi') {
                showSection('sec-pay-labarugi');
                const btn = document.getElementById('menu-' + tabId);
                if (btn) btn.classList.add('active');
                requestAnimationFrame(renderLabaRugi);
            } else if (tabId.startsWith('pay-')) {
                activePayKategori = tabId.replace('pay-', '');
                payEditContext = null;
                showSection('sec-pay');
                const btn = document.getElementById('menu-' + tabId);
                if (btn) btn.classList.add('active');
                requestAnimationFrame(renderPaySection);
            } else if (tabId === 'absen-daftar-hadir') {
                showSection('sec-absen-daftar-hadir');
                const btn = document.getElementById('menu-' + tabId);
                if (btn) btn.classList.add('active');
                requestAnimationFrame(renderDaftarHadir);
            } else if (tabId === 'absen-manual') {
                showSection('sec-absen-manual');
                const btn = document.getElementById('menu-' + tabId);
                if (btn) btn.classList.add('active');
                requestAnimationFrame(renderAbsenManualSection);
            } else if (tabId.startsWith('absen-')) {
                // Jika sedang mode edit foto tapi user berpindah ke jenis absen yang berbeda (Masuk <-> Keluar), batalkan mode edit
                if (typeof editingAbsenContext !== 'undefined' && editingAbsenContext && editingAbsenContext.isMasuk !== (tabId === 'absen-masuk')) {
                    cancelEditAbsenPhoto();
                }
                activeAbsenType = tabId;
                showSection('sec-absen');
                const btn = document.getElementById('menu-' + tabId);
                if (btn) btn.classList.add('active');
                renderAbsenSection();
                startWebcam(); // Baru dinyalakan di sini, khusus halaman Absen Masuk/Keluar
                refreshGpsAndAddress(); // Refresh lokasi & alamat terkini setiap kali halaman absen dibuka
            } else {
                showSection('sec-' + tabId);
                const btn = document.getElementById('menu-' + tabId);
                if (btn) btn.classList.add('active');
                // requestAnimationFrame: biarkan browser MELUKIS dulu perpindahan section & highlight menu
                // (yang ringan) sebelum menjalankan render tabel yang berat (loop banyak item/minggu, dsb) -
                // supaya klik menu terasa instan meresponnya, walau proses hitung tabelnya sendiri butuh
                // waktu yang kurang lebih sama seperti sebelumnya (bukan dipercepat, tapi terasa lebih responsif).
                requestAnimationFrame(renderActiveTabContent);
            }
        }

        function renderActiveTabContent() {
            if (currentTab === 'home') renderHomeDashboard();
            else if (currentTab === 'rab') renderRAB();
            else if (currentTab === 'rab-cco') renderRabCcoPage();
            else if (currentTab === 'lap-harian') renderLapHarian();
            else if (currentTab === 'lap-mingguan') renderLapMingguan();
            else if (currentTab === 'lap-bulanan') renderLapBulanan();
            else if (currentTab === 'time-schedule') renderTimeSchedule();
            else if (currentTab === 'action-plan') renderActionPlan();
            else if (currentTab === 'bq-estimasi') renderBackupQuantity();
            else if (currentTab === 'vol-cco') renderVolCcoPage();
            else if (currentTab === 'bq-opname') renderBqOpname();
            else if (currentTab === 'data-karyawan') renderEmployeeTable();
            else if (currentTab === 'user-profile') updateUserHeaderUI();
        }

        // ===================================================================
        // HOMEPAGE / BERANDA DASHBOARD
