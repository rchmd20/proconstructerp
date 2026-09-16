        // ===================================================================
        function exportProjectDataBackup() {
            const proj = projects.find(p => p.id === activeProjectId) || {};
            const backup = {
                appVersion: 'ProConstruct ERP v3.0',
                exportedBy: currentUser ? currentUser.email : null,
                exportedAt: new Date().toISOString(),
                project: proj,
                data: {
                    rab: rabData.filter(r => r.projId === activeProjectId),
                    lapHarian: lapHarianData.filter(l => { const r = rabData.find(x => x.id == l.pekerjaanId); return r && r.projId === activeProjectId; }),
                    lapHarianKendala: lapHarianKendalaData.filter(k => k.projId === activeProjectId),
                    lapMingguan: lapMingguanData.filter(l => l.projId === activeProjectId),
                    divSchedule: divScheduleData.filter(d => d.projId === activeProjectId),
                    kebutuhanMat: kebutuhanMatData.filter(d => d.projId === activeProjectId),
                    materialOrder: materialOrderData.filter(d => d.projId === activeProjectId),
                    materialMasuk: materialMasukData.filter(d => d.projId === activeProjectId),
                    materialKeluar: materialKeluarData.filter(d => d.projId === activeProjectId),
                    karyawan: karyawanData.filter(k => k.projId === activeProjectId),
                    absenMasuk: absenMasukData.filter(a => a.projId === activeProjectId),
                    absenKeluar: absenKeluarData.filter(a => a.projId === activeProjectId),
                    leave: leaveData.filter(l => l.projId === activeProjectId),
                    bqResults: bqResultsData,
                    bqOpname: bqOpnameData.filter(o => { const r = rabData.find(x => x.id == o.pekerjaanId); return r && r.projId === activeProjectId; }),
                    rabCcoList: rabCcoList.filter(c => c.projId === activeProjectId),
                    rabCcoItems: rabCcoItems.filter(c => c.projId === activeProjectId),
                    volCco: volCcoData.filter(c => c.projId === activeProjectId),
                    pay: payData.filter(c => c.projId === activeProjectId)
                }
            };
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `backup_${(proj.nama || 'proyek').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
        }

        function importProjectDataBackup(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
                try {
                    const backup = JSON.parse(evt.target.result);
                    if (!backup || !backup.project || !backup.data) { alert('File backup tidak valid.'); return; }

                    // Buat / timpa proyek tujuan berdasarkan id proyek dari file backup
                    // Kepemilikan (ownerId) proyek yang diimpor SELALU dipindah ke akun Admin yang sedang
                    // mengimpor — agar proyek ini pasti muncul di akun tujuan, bukan "hilang" karena ownerId
                    // masih milik akun lama (atau file lama sebelum fitur ownerId ada / kosong).
                    const importedProj = { ...backup.project, ownerId: currentUser ? currentUser.id : backup.project.ownerId };
                    const existingIdx = projects.findIndex(p => p.id === importedProj.id);
                    if (existingIdx !== -1) projects[existingIdx] = importedProj; else projects.push(importedProj);
                    localStorage.setItem('erp_projects', JSON.stringify(projects));

                    const pid = importedProj.id;
                    const mergeByProj = (arr, incoming, key) => {
                        const others = arr.filter(x => x[key] !== pid);
                        return [...others, ...(incoming || [])];
                    };
                    // Laporan Harian terhubung lewat pekerjaanId (RAB), bukan projId langsung -> ganti khusus per RAB proyek ini
                    const rabIdsProj = new Set((backup.data.rab || []).map(r => r.id));
                    lapHarianData = [...lapHarianData.filter(l => !rabIdsProj.has(l.pekerjaanId)), ...(backup.data.lapHarian || [])];
                    lapHarianKendalaData = mergeByProj(lapHarianKendalaData, backup.data.lapHarianKendala, 'projId');

                    rabData = mergeByProj(rabData, backup.data.rab, 'projId');
                    lapMingguanData = mergeByProj(lapMingguanData, backup.data.lapMingguan, 'projId');
                    divScheduleData = mergeByProj(divScheduleData, backup.data.divSchedule, 'projId');
                    kebutuhanMatData = mergeByProj(kebutuhanMatData, backup.data.kebutuhanMat, 'projId');
                    materialOrderData = mergeByProj(materialOrderData, backup.data.materialOrder, 'projId');
                    materialMasukData = mergeByProj(materialMasukData, backup.data.materialMasuk, 'projId');
                    materialKeluarData = mergeByProj(materialKeluarData, backup.data.materialKeluar, 'projId');
                    karyawanData = mergeByProj(karyawanData, backup.data.karyawan, 'projId');
                    absenMasukData = mergeByProj(absenMasukData, backup.data.absenMasuk, 'projId');
                    absenKeluarData = mergeByProj(absenKeluarData, backup.data.absenKeluar, 'projId');
                    leaveData = mergeByProj(leaveData, backup.data.leave, 'projId');
                    if (Array.isArray(backup.data.bqResults) && backup.data.bqResults.length) bqResultsData = backup.data.bqResults;
                    bqOpnameData = [...bqOpnameData.filter(o => !rabIdsProj.has(o.pekerjaanId)), ...(backup.data.bqOpname || [])];
                    rabCcoList = mergeByProj(rabCcoList, backup.data.rabCcoList, 'projId');
                    rabCcoItems = mergeByProj(rabCcoItems, backup.data.rabCcoItems, 'projId');
                    volCcoData = mergeByProj(volCcoData, backup.data.volCco, 'projId');
                    payData = mergeByProj(payData, backup.data.pay, 'projId');

                    localStorage.setItem('erp_rab', JSON.stringify(rabData));
                    localStorage.setItem('erp_lap_harian', JSON.stringify(lapHarianData));
                    localStorage.setItem('erp_lap_harian_kendala', JSON.stringify(lapHarianKendalaData));
                    localStorage.setItem('erp_lap_mingguan', JSON.stringify(lapMingguanData));
                    localStorage.setItem('erp_div_schedule', JSON.stringify(divScheduleData));
                    localStorage.setItem('erp_kebutuhan_mat', JSON.stringify(kebutuhanMatData));
                    localStorage.setItem('erp_mat_order', JSON.stringify(materialOrderData));
                    localStorage.setItem('erp_mat_masuk', JSON.stringify(materialMasukData));
                    localStorage.setItem('erp_mat_keluar', JSON.stringify(materialKeluarData));
                    localStorage.setItem('erp_karyawan', JSON.stringify(karyawanData));
                    localStorage.setItem('erp_absen_masuk', JSON.stringify(absenMasukData));
                    localStorage.setItem('erp_absen_keluar', JSON.stringify(absenKeluarData));
                    localStorage.setItem('erp_leave', JSON.stringify(leaveData));
                    localStorage.setItem('erp_bq_results', JSON.stringify(bqResultsData));
                    localStorage.setItem('erp_bq_opname', JSON.stringify(bqOpnameData));
                    localStorage.setItem('erp_rab_cco_list', JSON.stringify(rabCcoList));
                    localStorage.setItem('erp_rab_cco_items', JSON.stringify(rabCcoItems));
                    localStorage.setItem('erp_vol_cco', JSON.stringify(volCcoData));
                    localStorage.setItem('erp_pay', JSON.stringify(payData));

                    activeProjectId = pid;
                    localStorage.setItem('erp_active_project', activeProjectId);

                    alert(`Data proyek "${importedProj.nama}" berhasil diimpor & dimuat.`);
                    initProjectSelector();
                    updateSidebarProjectInfo();
                    renderActiveTabContent();
                } catch (err) {
                    alert('Gagal membaca file backup: ' + err.message);
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        }

        // ===================================================================
        // BACKUP SEMUA PROYEK DALAM 1 AKUN (EXPORT / IMPORT SEKALIGUS)
        // ===================================================================
        function exportAllProjectsDataBackup() {
            const backup = {
                appVersion: 'ProConstruct ERP v3.0',
                type: 'ALL_PROJECTS_BACKUP',
                exportedBy: currentUser ? currentUser.email : null,
                exportedAt: new Date().toISOString(),
                projects: projects,
                data: {
                    rab: rabData,
                    lapHarian: lapHarianData,
                    lapHarianKendala: lapHarianKendalaData,
                    lapMingguan: lapMingguanData,
                    divSchedule: divScheduleData,
                    kebutuhanMat: kebutuhanMatData,
                    materialOrder: materialOrderData,
                    materialMasuk: materialMasukData,
                    materialKeluar: materialKeluarData,
                    karyawan: karyawanData,
                    absenMasuk: absenMasukData,
                    absenKeluar: absenKeluarData,
                    leave: leaveData,
                    bqResults: bqResultsData,
                    bqOpname: bqOpnameData,
                    rabCcoList: rabCcoList,
                    rabCcoItems: rabCcoItems,
                    volCco: volCcoData,
                    pay: payData
                }
            };
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            const acc = currentUser ? currentUser.email.replace(/[^a-zA-Z0-9]/g, '_') : 'akun';
            a.download = `backup_semua_proyek_${acc}_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
        }

        function importAllProjectsDataBackup(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
                try {
                    const backup = JSON.parse(evt.target.result);
                    if (!backup || !Array.isArray(backup.projects) || !backup.data) { alert('File backup semua proyek tidak valid.'); return; }

                    if (!confirm(`File ini berisi ${backup.projects.length} proyek. Semua proyek tersebut akan dimuat / ditimpa ke akun ini. Lanjutkan?`)) return;

                    // Gabungkan daftar proyek (timpa yang id-nya sama, tambahkan yang baru)
                    // Kepemilikan (ownerId) SELALU dipindah ke akun Admin yang sedang mengimpor, apapun isi
                    // ownerId di file backup (baik itu kosong/tidak ada, maupun milik akun lain) — supaya semua
                    // proyek yang diimpor pasti langsung terlihat di akun ini, bukan tersembunyi.
                    backup.projects.forEach(p => {
                        const proj = { ...p, ownerId: currentUser ? currentUser.id : p.ownerId };
                        const idx = projects.findIndex(x => x.id === proj.id);
                        if (idx !== -1) projects[idx] = proj; else projects.push(proj);
                    });
                    localStorage.setItem('erp_projects', JSON.stringify(projects));

                    const importedProjIds = new Set(backup.projects.map(p => p.id));
                    const mergeAllByProj = (arr, incoming) => {
                        const others = arr.filter(x => !importedProjIds.has(x.projId));
                        return [...others, ...(incoming || [])];
                    };
                    const rabIdsImported = new Set((backup.data.rab || []).map(r => r.id));
                    lapHarianData = [...lapHarianData.filter(l => !rabIdsImported.has(l.pekerjaanId)), ...(backup.data.lapHarian || [])];
                    lapHarianKendalaData = mergeAllByProj(lapHarianKendalaData, backup.data.lapHarianKendala);

                    rabData = mergeAllByProj(rabData, backup.data.rab);
                    lapMingguanData = mergeAllByProj(lapMingguanData, backup.data.lapMingguan);
                    divScheduleData = mergeAllByProj(divScheduleData, backup.data.divSchedule);
                    kebutuhanMatData = mergeAllByProj(kebutuhanMatData, backup.data.kebutuhanMat);
                    materialOrderData = mergeAllByProj(materialOrderData, backup.data.materialOrder);
                    materialMasukData = mergeAllByProj(materialMasukData, backup.data.materialMasuk);
                    materialKeluarData = mergeAllByProj(materialKeluarData, backup.data.materialKeluar);
                    karyawanData = mergeAllByProj(karyawanData, backup.data.karyawan);
                    absenMasukData = mergeAllByProj(absenMasukData, backup.data.absenMasuk);
                    absenKeluarData = mergeAllByProj(absenKeluarData, backup.data.absenKeluar);
                    leaveData = mergeAllByProj(leaveData, backup.data.leave);
                    if (Array.isArray(backup.data.bqResults) && backup.data.bqResults.length) bqResultsData = backup.data.bqResults;
                    if (Array.isArray(backup.data.bqOpname)) bqOpnameData = backup.data.bqOpname;
                    rabCcoList = mergeAllByProj(rabCcoList, backup.data.rabCcoList);
                    rabCcoItems = mergeAllByProj(rabCcoItems, backup.data.rabCcoItems);
                    volCcoData = mergeAllByProj(volCcoData, backup.data.volCco);
                    payData = mergeAllByProj(payData, backup.data.pay);

                    localStorage.setItem('erp_rab', JSON.stringify(rabData));
                    localStorage.setItem('erp_lap_harian', JSON.stringify(lapHarianData));
                    localStorage.setItem('erp_lap_harian_kendala', JSON.stringify(lapHarianKendalaData));
                    localStorage.setItem('erp_lap_mingguan', JSON.stringify(lapMingguanData));
                    localStorage.setItem('erp_div_schedule', JSON.stringify(divScheduleData));
                    localStorage.setItem('erp_kebutuhan_mat', JSON.stringify(kebutuhanMatData));
                    localStorage.setItem('erp_mat_order', JSON.stringify(materialOrderData));
                    localStorage.setItem('erp_mat_masuk', JSON.stringify(materialMasukData));
                    localStorage.setItem('erp_mat_keluar', JSON.stringify(materialKeluarData));
                    localStorage.setItem('erp_karyawan', JSON.stringify(karyawanData));
                    localStorage.setItem('erp_absen_masuk', JSON.stringify(absenMasukData));
                    localStorage.setItem('erp_absen_keluar', JSON.stringify(absenKeluarData));
                    localStorage.setItem('erp_leave', JSON.stringify(leaveData));
                    localStorage.setItem('erp_bq_results', JSON.stringify(bqResultsData));
                    localStorage.setItem('erp_bq_opname', JSON.stringify(bqOpnameData));
                    localStorage.setItem('erp_rab_cco_list', JSON.stringify(rabCcoList));
                    localStorage.setItem('erp_rab_cco_items', JSON.stringify(rabCcoItems));
                    localStorage.setItem('erp_vol_cco', JSON.stringify(volCcoData));
                    localStorage.setItem('erp_pay', JSON.stringify(payData));

                    if (backup.projects.length > 0) {
                        activeProjectId = backup.projects[0].id;
                        localStorage.setItem('erp_active_project', activeProjectId);
                    }

                    alert(`Berhasil mengimpor ${backup.projects.length} proyek beserta seluruh datanya.`);
                    initProjectSelector();
                    updateSidebarProjectInfo();
                    renderActiveTabContent();
                } catch (err) {
                    alert('Gagal membaca file backup semua proyek: ' + err.message);
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        }

        // ===================================================================
        // EXPORT FUNCTIONS (EXCEL, PDF, WA TEXT) - COMPLETE & DETAILED
