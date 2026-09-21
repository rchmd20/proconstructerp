        // ===================================================================
        // Filter opsi karyawan pada form Catat Izin/Sakit/Cuti berdasarkan pencarian
        function filterDhLeaveKaryawanOptions() {
            const query = document.getElementById('dhLeaveKaryawanSearch').value.toLowerCase();
            const select = document.getElementById('dhLeaveKaryawan');
            if (!select) return;
            Array.from(select.options).forEach(opt => {
                opt.style.display = opt.textContent.toLowerCase().includes(query) ? '' : 'none';
            });
        }

        function handleDhLeaveSubmit(e) {
            e.preventDefault();
            if (!canUserEdit()) { alert('Akses ditolak. Admin telah menonaktifkan izin edit akun Anda untuk proyek ini.'); return; }
            leaveData.push({
                id: Date.now(), projId: activeProjectId,
                nama: document.getElementById('dhLeaveKaryawan').value,
                tanggal: document.getElementById('dhLeaveTanggal').value,
                jenis: document.getElementById('dhLeaveJenis').value,
                ket: document.getElementById('dhLeaveKet').value.trim()
            });
            localStorage.setItem('erp_leave', JSON.stringify(leaveData));
            document.getElementById('formDhLeave').reset();
            renderDaftarHadir();
        }

        // Helper: hitung rekap kehadiran 1 bulan (YYYY-MM) untuk seluruh karyawan proyek aktif
        // Setiap karyawan juga menyertakan breakdown per tanggal (days[]) selain total.
        function buildDaftarHadirRekap(bulanStr) {
            // Admin melihat rekap seluruh karyawan proyek; akun User hanya melihat rekap dirinya sendiri.
            const projKaryawan = getVisibleKaryawanForDaftarHadir();
            const projMasuk = absenMasukData.filter(a => a.projId === activeProjectId && a.tanggal && a.tanggal.startsWith(bulanStr));
            const projKeluar = absenKeluarData.filter(a => a.projId === activeProjectId && a.tanggal && a.tanggal.startsWith(bulanStr));
            const projLeave = leaveData.filter(l => l.projId === activeProjectId && l.tanggal && l.tanggal.startsWith(bulanStr));

            const [y, m] = bulanStr.split('-').map(Number);
            const jumlahHari = new Date(y, m, 0).getDate();

            return projKaryawan.map(k => {
                const masukList = projMasuk.filter(a => a.nama === k.nama);
                const keluarList = projKeluar.filter(a => a.nama === k.nama);
                const leaveList = projLeave.filter(l => l.nama === k.nama);

                let jamHadir = 0, jamLembur = 0, hariLembur = 0;
                const days = [];
                for (let d = 1; d <= jumlahHari; d++) {
                    const tgl = `${bulanStr}-${String(d).padStart(2, '0')}`;
                    const masuk = masukList.find(a => a.tanggal === tgl);
                    const leave = leaveList.find(l => l.tanggal === tgl);
                    let dayInfo = { tgl, d, jenis: null, jamKerja: 0, jamLembur: 0 };

                    if (masuk) {
                        const keluar = keluarList.find(a => a.tanggal === tgl);
                        dayInfo.jenis = 'Hadir';
                        if (masuk.manual && keluar) {
                            // Absen Manual (diinput Admin lewat halaman Absen Manual): Jam Kerja Normal &
                            // Lembur mengikuti NILAI YANG DIINPUT ADMIN SECARA EKSPLISIT (sudah dikurangi
                            // Istirahat), BUKAN dihitung ulang dari selisih mentah Masuk-Pulang seperti absen
                            // kamera - supaya Admin punya kendali penuh atas jam istirahat & lembur.
                            const jamNormalManual = Number(keluar.manualJamNormal) || 0;
                            const lemburManual = Number(keluar.manualJamLembur) || 0;
                            jamHadir += jamNormalManual;
                            dayInfo.jamKerja = jamNormalManual;
                            dayInfo.jamLembur = lemburManual;
                            dayInfo.hariValue = 1;
                            dayInfo.manual = true;
                            if (lemburManual > 0) { jamLembur += lemburManual; hariLembur++; }
                        } else if (keluar && keluar.ts > masuk.ts) {
                            // Absen masuk & absen keluar lengkap -> dihitung normal (maks 8 jam, sisanya lembur)
                            const jamKerjaHariIni = (keluar.ts - masuk.ts) / (1000 * 60 * 60);
                            const jamNormal = Math.min(jamKerjaHariIni, 8);
                            const lembur = Math.max(0, jamKerjaHariIni - 8);
                            jamHadir += jamNormal;
                            dayInfo.jamKerja = jamNormal;
                            dayInfo.jamLembur = lembur;
                            dayInfo.hariValue = 1;
                            if (lembur > 0) { jamLembur += lembur; hariLembur++; }
                        } else {
                            // Tidak ada absen pulang (atau waktu tidak valid) -> dinyatakan masuk setengah hari
                            const jamNormal = 4;
                            jamHadir += jamNormal;
                            dayInfo.setengahHari = true;
                            dayInfo.jamKerja = jamNormal;
                            dayInfo.jamLembur = 0;
                            dayInfo.hariValue = 0.5;
                        }
                    } else if (leave) {
                        dayInfo.jenis = leave.jenis; // Izin / Sakit / Cuti
                    }
                    days.push(dayInfo);
                }
                const hariHadir = days.reduce((sum, d) => sum + (d.hariValue || 0), 0);

                const izin = leaveList.filter(l => l.jenis === 'Izin').length;
                const sakit = leaveList.filter(l => l.jenis === 'Sakit').length;
                const cuti = leaveList.filter(l => l.jenis === 'Cuti').length;

                return {
                    nama: k.nama,
                    jabatan: k.jabatan || '-',
                    days,
                    hariHadir: hariHadir % 1 === 0 ? hariHadir.toFixed(0) : hariHadir.toFixed(1),
                    jamHadir: jamHadir.toFixed(1),
                    hariLembur, jamLembur: jamLembur.toFixed(1),
                    izin, sakit, cuti
                };
            });
        }

        // Badge singkat untuk 1 sel hari pada tabel rekap kehadiran
        function dhDayCellHtml(dayInfo) {
            if (dayInfo.jenis === 'Hadir') {
                if (dayInfo.setengahHari) {
                    return `<div class="text-amber-400 font-bold" title="Tidak absen pulang - dihitung masuk setengah hari">H½</div><div class="text-[9px] text-slate-400">${dayInfo.jamKerja.toFixed(1)}j</div>`;
                }
                const lemburTxt = dayInfo.jamLembur > 0 ? `<div class="text-[9px] text-amber-400">+${dayInfo.jamLembur.toFixed(1)}j</div>` : '';
                const manualTxt = dayInfo.manual ? `<div class="text-[8px] text-amber-300" title="Diinput manual oleh Admin">manual</div>` : '';
                return `<div class="text-emerald-400 font-bold">H</div><div class="text-[9px] text-slate-400">${dayInfo.jamKerja.toFixed(1)}j</div>${lemburTxt}${manualTxt}`;
            } else if (dayInfo.jenis === 'Izin') {
                return `<div class="text-sky-400 font-bold">I</div>`;
            } else if (dayInfo.jenis === 'Sakit') {
                return `<div class="text-rose-400 font-bold">S</div>`;
            } else if (dayInfo.jenis === 'Cuti') {
                return `<div class="text-purple-400 font-bold">C</div>`;
            }
            return `<div class="text-slate-600">-</div>`;
        }

        // Karyawan yang boleh dilihat pada halaman Daftar Hadir: Admin melihat seluruh karyawan proyek,
        // akun User hanya melihat data dirinya sendiri (dicocokkan dari nama akun dengan nama karyawan).
        // Diurutkan berdasarkan Jabatan (abjad) lalu Nama (abjad) di dalam jabatan yang sama, supaya rekap
        // kehadiran bulanan berkelompok rapi per jabatan dan mudah dicari.
        function getVisibleKaryawanForDaftarHadir() {
            const list = karyawanData.filter(k => k.projId === activeProjectId);
            const myName = ((currentUser && currentUser.name) || '').trim().toLowerCase();
            const visible = isAdminUser() ? list : list.filter(k => (k.nama || '').trim().toLowerCase() === myName);
            return visible.slice().sort((a, b) => {
                const jabA = (a.jabatan || '').trim().toLowerCase();
                const jabB = (b.jabatan || '').trim().toLowerCase();
                if (jabA !== jabB) return jabA.localeCompare(jabB, 'id');
                return (a.nama || '').trim().toLowerCase().localeCompare((b.nama || '').trim().toLowerCase(), 'id');
            });
        }

        function renderDaftarHadir() {
            // Populate select karyawan untuk form izin/sakit/cuti (mengikuti hak akses lihat daftar hadir)
            const karyawanSelect = document.getElementById('dhLeaveKaryawan');
            if (karyawanSelect) {
                karyawanSelect.innerHTML = getVisibleKaryawanForDaftarHadir()
                    .map(k => `<option value="${k.nama}">${k.nama}</option>`).join('');
            }
            const searchInput = document.getElementById('dhLeaveKaryawanSearch');
            if (searchInput) searchInput.value = '';

            const bulanInput = document.getElementById('dhFilterBulan');
            if (bulanInput && !bulanInput.value) {
                bulanInput.value = new Date().toISOString().slice(0, 7);
            }
            const bulanStr = bulanInput ? bulanInput.value : new Date().toISOString().slice(0, 7);
            const [y, m] = bulanStr.split('-').map(Number);
            const jumlahHari = new Date(y, m, 0).getDate();

            const rekap = buildDaftarHadirRekap(bulanStr);

            // Header dinamis: Nama Karyawan | tanggal 1..N | kolom total
            const head = document.getElementById('dhRekapTableHead');
            if (head) {
                let dayHeaders = '';
                for (let d = 1; d <= jumlahHari; d++) dayHeaders += `<th class="p-1 text-center font-mono">${d}</th>`;
                head.innerHTML = `
                    <tr>
                        <th class="p-3 sticky left-0 bg-[#1c2541]">Nama Karyawan</th>
                        ${dayHeaders}
                        <th class="p-3 text-center">Hari Hadir</th>
                        <th class="p-3 text-center">Jam Hadir</th>
                        <th class="p-3 text-center">Hari Lembur</th>
                        <th class="p-3 text-center">Jam Lembur</th>
                        <th class="p-3 text-center">Izin</th>
                        <th class="p-3 text-center">Sakit</th>
                        <th class="p-3 text-center">Cuti</th>
                    </tr>
                `;
            }

            const tbody = document.getElementById('dhRekapTableBody');
            tbody.innerHTML = '';

            if (rekap.length === 0) {
                tbody.innerHTML = `<tr><td colspan="${jumlahHari + 8}" class="p-6 text-center text-slate-500">Belum ada data karyawan pada proyek ini.</td></tr>`;
                return;
            }

            rekap.forEach(r => {
                let dayCells = '';
                r.days.forEach(d => { dayCells += `<td class="p-1 text-center align-top">${dhDayCellHtml(d)}</td>`; });
                tbody.innerHTML += `
                    <tr class="hover:bg-slate-800/50 transition">
                        <td class="p-3 font-bold text-white sticky left-0 bg-[#0f172a]">${escapeHtml(r.nama)}<div class="text-[10px] font-normal text-sky-400">${escapeHtml(r.jabatan)}</div></td>
                        ${dayCells}
                        <td class="p-3 font-mono text-emerald-400 text-center">${r.hariHadir} hari</td>
                        <td class="p-3 font-mono text-center">${r.jamHadir} jam</td>
                        <td class="p-3 font-mono text-amber-400 text-center">${r.hariLembur} hari</td>
                        <td class="p-3 font-mono text-center">${r.jamLembur} jam</td>
                        <td class="p-3 font-mono text-sky-400 text-center">${r.izin}</td>
                        <td class="p-3 font-mono text-rose-400 text-center">${r.sakit}</td>
                        <td class="p-3 font-mono text-purple-400 text-center">${r.cuti}</td>
                    </tr>
                `;
            });
        }

        // Export Excel & PDF Daftar Hadir - lihat getDaftarHadirExportDataset() di bawah (mesin export bersama)
        function getDaftarHadirExportDataset() {
            const bulanInput = document.getElementById('dhFilterBulan');
            const bulanStr = (bulanInput && bulanInput.value) || new Date().toISOString().slice(0, 7);
            const [y, m] = bulanStr.split('-').map(Number);
            const jumlahHari = new Date(y, m, 0).getDate();
            const bulanLabel = new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
            const rekap = buildDaftarHadirRekap(bulanStr);

            // Kode singkat per hari: H = Hadir, H½ = Hadir setengah hari (lupa absen pulang), I/S/C = Izin/Sakit/Cuti
            const dayCellText = (d) => {
                if (d.jenis === 'Hadir') return d.setengahHari ? 'H½' : 'H';
                if (d.jenis) return d.jenis.charAt(0);
                return '-';
            };

            const columns = [{ header: 'Nama Karyawan', key: 'nama', width: 20 }, { header: 'Jabatan', key: 'jabatan', width: 16 }];
            for (let d = 1; d <= jumlahHari; d++) columns.push({ header: String(d), key: 'd' + d, width: 4 });
            columns.push(
                { header: 'Hari Hadir', key: 'hariHadir' }, { header: 'Jam Hadir', key: 'jamHadir' },
                { header: 'Hari Lembur', key: 'hariLembur' }, { header: 'Jam Lembur', key: 'jamLembur' },
                { header: 'Izin', key: 'izin', width: 6 }, { header: 'Sakit', key: 'sakit', width: 6 }, { header: 'Cuti', key: 'cuti', width: 6 }
            );
            const rows = rekap.map(r => {
                const obj = { nama: r.nama, jabatan: r.jabatan, hariHadir: r.hariHadir, jamHadir: r.jamHadir, hariLembur: r.hariLembur, jamLembur: r.jamLembur, izin: r.izin, sakit: r.sakit, cuti: r.cuti };
                r.days.forEach((d, idx) => { obj['d' + (idx + 1)] = dayCellText(d); });
                return obj;
            });
            return { title: `Daftar Hadir - ${bulanLabel}`, columns, rows, orientation: 'landscape', subtitle: `Periode: ${bulanLabel}  |  H=Hadir, H½=Hadir 1/2 hari, I=Izin, S=Sakit, C=Cuti` };
        }

        function exportDaftarHadirExcel() {
            const proj = projects.find(p => p.id === activeProjectId) || { nama: 'Proyek' };
            const ds = getDaftarHadirExportDataset();
            exportProfessionalExcel(ds.title, ds.columns, ds.rows, `${ds.title.replace(/[\\\/\?\*\[\]:]/g, ' ')}_${proj.nama}.xlsx`, { subtitle: ds.subtitle });
        }

        function exportDaftarHadirPdf() {
            const proj = projects.find(p => p.id === activeProjectId) || { nama: 'Proyek' };
            const ds = getDaftarHadirExportDataset();
            exportProfessionalPdf(ds.title, ds.columns, ds.rows, `${ds.title.replace(/[\\\/\?\*\[\]:]/g, ' ')}_${proj.nama}.pdf`, { orientation: ds.orientation, subtitle: ds.subtitle });
        }

        // Karyawan Management
        function renderEmployeeTable() {
            const tbody = document.getElementById('employeeTableBody');
            tbody.innerHTML = '';
            const projEmps = karyawanData.filter(e => e.projId === activeProjectId);

            if (projEmps.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-500">Belum ada data karyawan.</td></tr>`;
                return;
            }

            projEmps.forEach(emp => {
                const isAdmin = currentUser && currentUser.role === 'Admin';
                const editBtn = isAdmin ? `<button onclick="editEmployee(${emp.id})" class="bg-sky-600/20 hover:bg-sky-600 text-sky-400 hover:text-white p-1.5 rounded transition mr-1"><i class="fa-solid fa-pen text-xs"></i></button>` : '';
                const deleteBtn = isAdmin ? `<button onclick="deleteEmployee(${emp.id})" class="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white p-1.5 rounded transition"><i class="fa-solid fa-trash-can text-xs"></i></button>` : `<span class="text-slate-600 text-[10px]" title="Hanya Admin yang dapat mengubah/menghapus data karyawan"><i class="fa-solid fa-lock"></i></span>`;
                tbody.innerHTML += `
                    <tr class="hover:bg-slate-800/50 transition">
                        <td class="p-3"><div class="w-9 h-9 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center font-bold">${emp.photo ? `<img src="${emp.photo}" class="w-full h-full object-cover">` : escapeHtml(emp.nama).substring(0,2)}</div></td>
                        <td class="p-3 font-bold text-white">${escapeHtml(emp.nama)}</td>
                        <td class="p-3 text-sky-400">${escapeHtml(emp.jabatan)}</td>
                        <td class="p-3 font-mono">${escapeHtml(emp.hp) || '-'}</td>
                        <td class="p-3 text-slate-400">${escapeHtml(emp.email) || '-'}</td>
                        <td class="p-3"><span class="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">${escapeHtml(emp.status)}</span></td>
                        <td class="p-3 text-center">
                            ${editBtn}${deleteBtn}
                        </td>
                    </tr>
                `;
            });
        }

        function openEmployeeModal(isEdit, id) {
            if (!isAdminUser()) {
                alert('Akses ditolak. Hanya Admin yang memiliki akses ke Data Karyawan.');
                return;
            }
            document.getElementById('employeeModal').classList.remove('hidden');
            document.getElementById('employeeForm').reset();
            document.getElementById('empPhotoPreview').innerHTML = `<i class="fa-solid fa-user text-2xl"></i>`;
            tempEmpPhoto = '';
            document.getElementById('empEditId').value = '';
            document.getElementById('empModalTitle').innerText = 'Tambah Karyawan Baru';

            if (isEdit && id) {
                const emp = karyawanData.find(e => e.id == id);
                if (!emp) return;
                document.getElementById('empModalTitle').innerText = 'Edit Data Karyawan';
                document.getElementById('empEditId').value = emp.id;
                document.getElementById('empNama').value = emp.nama || '';
                document.getElementById('empJabatan').value = emp.jabatan || '';
                document.getElementById('empHp').value = emp.hp || '';
                document.getElementById('empStatus').value = emp.status || 'Tetap';
                document.getElementById('empEmail').value = emp.email || '';
                document.getElementById('empTglMasuk').value = emp.tglMasuk || '';
                tempEmpPhoto = emp.photo || '';
                if (emp.photo) document.getElementById('empPhotoPreview').innerHTML = `<img src="${emp.photo}" class="w-full h-full object-cover rounded-full">`;
            }
        }

        // Hanya Admin yang boleh mengedit data karyawan
        function editEmployee(id) {
            if (!currentUser || currentUser.role !== 'Admin') {
                alert('Akses ditolak. Hanya Admin yang dapat mengedit data karyawan.');
                return;
            }
            openEmployeeModal(true, id);
        }

        function closeEmployeeModal() {
            document.getElementById('employeeModal').classList.add('hidden');
        }

        let tempEmpPhoto = '';
        function previewEmployeePhoto(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
                tempEmpPhoto = evt.target.result;
                document.getElementById('empPhotoPreview').innerHTML = `<img src="${tempEmpPhoto}" class="w-full h-full object-cover rounded-full">`;
            };
            reader.readAsDataURL(file);
        }

        function removeEmployeePhoto() {
            tempEmpPhoto = '';
            document.getElementById('empPhotoPreview').innerHTML = `<i class="fa-solid fa-user text-2xl"></i>`;
        }

        function handleEmployeeFormSubmit(e) {
            e.preventDefault();
            const editId = document.getElementById('empEditId').value;
            const payload = {
                nama: document.getElementById('empNama').value.trim(),
                jabatan: document.getElementById('empJabatan').value.trim(),
                hp: document.getElementById('empHp').value.trim(),
                email: document.getElementById('empEmail').value.trim(),
                status: document.getElementById('empStatus').value,
                tglMasuk: document.getElementById('empTglMasuk').value,
                photo: tempEmpPhoto
            };

            if (editId) {
                // Edit hanya boleh dilakukan oleh Admin
                if (!currentUser || currentUser.role !== 'Admin') {
                    alert('Akses ditolak. Hanya Admin yang dapat mengedit data karyawan.');
                    return;
                }
                const idx = karyawanData.findIndex(e => e.id == editId);
                if (idx !== -1) karyawanData[idx] = { ...karyawanData[idx], ...payload };
            } else {
                if (!isAdminUser()) {
                    alert('Akses ditolak. Hanya Admin yang dapat menambah data karyawan.');
                    return;
                }
                karyawanData.push({ id: Date.now(), projId: activeProjectId, ...payload });
            }
            localStorage.setItem('erp_karyawan', JSON.stringify(karyawanData));
            closeEmployeeModal();
            renderEmployeeTable();
            initDropdowns();
        }

        function deleteEmployee(id) {
            if (!currentUser || currentUser.role !== 'Admin') {
                alert('Akses ditolak. Hanya Admin yang dapat menghapus data karyawan.');
                return;
            }
            if (confirm('Hapus data karyawan ini?')) {
                karyawanData = karyawanData.filter(e => e.id != id);
                localStorage.setItem('erp_karyawan', JSON.stringify(karyawanData));
                renderEmployeeTable();
                initDropdowns();
            }
        }

        function handleUserPhotoUpload(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
                if (currentUser) {
                    currentUser.photo = evt.target.result;
                    sessionStorage.setItem('erp_current_user', JSON.stringify(currentUser));
                    const uIdx = users.findIndex(u => u.id === currentUser.id);
                    if (uIdx !== -1) {
                        users[uIdx].photo = currentUser.photo;
                        localStorage.setItem('erp_users', JSON.stringify(users));
                    }
                    updateUserHeaderUI();
                }
            };
            reader.readAsDataURL(file);
        }

        function handleUserProfileSubmit(e) {
            e.preventDefault();
            if (!currentUser) return;
            currentUser.name = document.getElementById('profInputName').value.trim();
            currentUser.position = document.getElementById('profInputPosition').value.trim();
            currentUser.phone = document.getElementById('profInputPhone').value.trim();
            const newPass = document.getElementById('profInputPassword').value.trim();
            if (newPass) currentUser.pass = newPass;

            sessionStorage.setItem('erp_current_user', JSON.stringify(currentUser));
            const uIdx = users.findIndex(u => u.id === currentUser.id);
            if (uIdx !== -1) {
                users[uIdx] = currentUser;
                localStorage.setItem('erp_users', JSON.stringify(users));
            }
            updateUserHeaderUI();
            alert('Profil berhasil diperbarui!');
        }

        function openAdminApprovalModal() {
            document.getElementById('adminApprovalModal').classList.remove('hidden');
            const tbody = document.getElementById('userApprovalTableBody');
            tbody.innerHTML = '';
            // Admin hanya melihat permintaan akun User yang kode proyeknya cocok dengan proyek miliknya sendiri,
            // atau yang sudah tertaut ke salah satu proyeknya — agar data akun Admin lain tidak tercampur.
            const myKodes = projects.filter(p => p.ownerId === currentUser.id).map(p => p.kode);
            const myProjectIds = projects.filter(p => p.ownerId === currentUser.id).map(p => p.id);
            const relevantUsers = users.filter(u =>
                u.role === 'User' && (
                    (u.adminKode && myKodes.includes(u.adminKode)) ||
                    (u.projectId && myProjectIds.includes(u.projectId))
                )
            );

            if (relevantUsers.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-500">Belum ada permintaan/akun User untuk proyek Anda.</td></tr>`;
                return;
            }

            relevantUsers.forEach(u => {
                const canEdit = u.canEdit !== false; // default true (belum pernah diubah Admin)
                const editBadge = u.status === 'Approved'
                    ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold ${canEdit ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}">${canEdit ? 'Aktif' : 'Nonaktif'}</span>`
                    : `<span class="text-slate-600">-</span>`;
                const toggleBtn = u.status === 'Approved'
                    ? `<button onclick="toggleUserCanEdit('${u.id}')" class="${canEdit ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white px-2 py-1 rounded text-[10px] font-bold" title="${canEdit ? 'Nonaktifkan izin edit' : 'Aktifkan izin edit'}">${canEdit ? 'Nonaktifkan' : 'Aktifkan'}</button>`
                    : '';
                tbody.innerHTML += `
                    <tr class="hover:bg-slate-800/50 transition">
                        <td class="p-2 font-bold text-white">${escapeHtml(u.name)}</td>
                        <td class="p-2 font-mono text-slate-300">${escapeHtml(u.email)}</td>
                        <td class="p-2 text-sky-400">${escapeHtml(u.position)}</td>
                        <td class="p-2">${escapeHtml(u.role)}</td>
                        <td class="p-2 font-mono text-amber-400">${escapeHtml(u.adminKode) || '-'}</td>
                        <td class="p-2"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${u.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}">${u.status}</span></td>
                        <td class="p-2">${editBadge}</td>
                        <td class="p-2 text-center">
                            <div class="flex items-center justify-center gap-1 flex-wrap">
                                ${u.status === 'Pending' ? `<button onclick="approveUser('${u.id}')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded text-[10px] font-bold">Setujui</button>` : toggleBtn}
                                <button onclick="deleteUserAccount('${u.id}')" class="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white px-2 py-1 rounded text-[10px] font-bold" title="Hapus akun User ini">Hapus</button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }

        function closeAdminApprovalModal() {
            document.getElementById('adminApprovalModal').classList.add('hidden');
        }

        // Aktifkan/nonaktifkan izin edit data operasional proyek (Laporan Harian, Material, Time Schedule,
        // Absensi, dsb) untuk 1 akun User tertentu. Hanya berlaku untuk akun User yang tertaut ke proyek Admin ini.
        function toggleUserCanEdit(id) {
            if (!isAdminUser()) return;
            const myKodes = projects.filter(p => p.ownerId === currentUser.id).map(p => p.kode);
            const myProjectIds = projects.filter(p => p.ownerId === currentUser.id).map(p => p.id);
            const u = users.find(x => x.id === id);
            if (!u || u.role !== 'User') return;
            const isMine = (u.adminKode && myKodes.includes(u.adminKode)) || (u.projectId && myProjectIds.includes(u.projectId));
            if (!isMine) { alert('Akun ini bukan bagian dari proyek Anda.'); return; }

            u.canEdit = !(u.canEdit !== false); // toggle, default awal true
            localStorage.setItem('erp_users', JSON.stringify(users));
            openAdminApprovalModal();
        }

        // Hapus akun User dari proyek Admin. Tidak bisa menghapus akun Admin, dan hanya bisa menghapus
        // akun User yang memang tertaut ke salah satu proyek milik Admin yang sedang login.
        function deleteUserAccount(id) {
            const u = users.find(x => x.id === id);
            if (!u) return;
            if (u.role === 'Admin') { alert('Akun Admin tidak dapat dihapus dari sini.'); return; }
            if (isAdminUser()) {
                const myKodes = projects.filter(p => p.ownerId === currentUser.id).map(p => p.kode);
                const myProjectIds = projects.filter(p => p.ownerId === currentUser.id).map(p => p.id);
                const isMine = (u.adminKode && myKodes.includes(u.adminKode)) || (u.projectId && myProjectIds.includes(u.projectId));
                if (!isMine) { alert('Akun ini bukan bagian dari proyek Anda.'); return; }
            } else {
                return;
            }
            if (!confirm(`Hapus akun "${u.name}" (${u.email}) dari proyek ini? Tindakan ini tidak dapat dibatalkan.`)) return;

            users = users.filter(x => x.id !== id);
            localStorage.setItem('erp_users', JSON.stringify(users));
            openAdminApprovalModal();
            checkAdminPendingCount();
        }

        function approveUser(id) {
            const u = users.find(x => x.id === id);
            if (u) {
                u.status = 'Approved';
                // Tautkan User ke proyek Admin yang menyetujui, sesuai kode proyek yang ia masukkan saat daftar.
                if (u.role === 'User' && !u.projectId) {
                    const matched = projects.find(p => p.ownerId === currentUser.id && p.kode === u.adminKode);
                    if (matched) u.projectId = matched.id;
                }
                // Otomatis tambahkan akun User yang baru disetujui ke Data Karyawan proyek terkait,
                // supaya langsung muncul di list Karyawan dan bisa diedit Admin (jabatan, status, dsb),
                // termasuk untuk dipilih pada absensi. userId dipakai agar tidak dobel jika disetujui ulang.
                if (u.role === 'User' && u.projectId) {
                    const alreadyKaryawan = karyawanData.some(k => k.userId === u.id && k.projId === u.projectId);
                    if (!alreadyKaryawan) {
                        karyawanData.push({
                            id: Date.now(),
                            projId: u.projectId,
                            userId: u.id,
                            nama: u.name,
                            jabatan: u.position || '',
                            hp: u.phone || '',
                            email: u.email || '',
                            status: 'Tetap',
                            tglMasuk: new Date().toISOString().split('T')[0],
                            photo: u.photo || ''
                        });
                        localStorage.setItem('erp_karyawan', JSON.stringify(karyawanData));
                    }
                }
                localStorage.setItem('erp_users', JSON.stringify(users));
                openAdminApprovalModal();
                checkAdminPendingCount();
            }
        }

        // ===================================================================
        // BACKUP DATA PROYEK (EXPORT / IMPORT LENGKAP PER AKUN/PROYEK)
