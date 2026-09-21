        // ===================================================================
        // INITIAL STATE & STORAGE MANAGEMENT
        // ===================================================================
        
        let projects = JSON.parse(localStorage.getItem('erp_projects')) || [
            {
                id: 'PRJ-01',
                kode: 'PRJ-2026-01',
                nama: 'Pembangunan Gedung Perkantoran 5 Lantai',
                lokasi: 'Makassar',
                owner: 'PT. Pembangunan Sejahtera',
                nilai: 1500000000,
                tglMulai: '2026-01-01',
                tglSelesai: '2026-06-30',
                logo: '',
                ppn: 11,
                pph: 2,
                ownerId: 'USR-01' // Pemilik proyek (Admin). Dipakai agar akun baru tidak melihat data akun demo/admin lain.
            }
        ];

        let activeProjectId = localStorage.getItem('erp_active_project') || 'PRJ-01';

        let users = JSON.parse(localStorage.getItem('erp_users')) || [
            {
                id: 'USR-01',
                name: 'Administrator Proyek',
                email: 'ertwenty',
                pass: 'twentyer',
                role: 'Admin',
                position: 'Project Manager',
                phone: '081234567890',
                status: 'Approved',
                photo: ''
            }
        ];

        // Sesi login memakai sessionStorage (bukan localStorage) agar setiap aplikasi benar-benar
        // ditutup (tab/app ditutup) lalu dibuka kembali, pengguna WAJIB login ulang dari halaman Login.
        let currentUser = JSON.parse(sessionStorage.getItem('erp_current_user')) || null;

        let rabData = JSON.parse(localStorage.getItem('erp_rab')) || [
            { id: 1, projId: 'PRJ-01', noDiv: 'DIV-01', div: 'Pekerjaan Persiapan', sub: 'Pembersihan Lahan', rincian: 'Pembersihan Rumput & Semak', satuan: 'm2', volume: 500, harga: 15000 },
            { id: 2, projId: 'PRJ-01', noDiv: 'DIV-01', div: 'Pekerjaan Persiapan', sub: 'Pagar Pengaman', rincian: 'Pemasangan Pagar Seng', satuan: 'm1', volume: 120, harga: 150000 },
            { id: 3, projId: 'PRJ-01', noDiv: 'DIV-02', div: 'Pekerjaan Pondasi', sub: 'Galian Tanah', rincian: 'Galian Pondasi Footplat', satuan: 'm3', volume: 150, harga: 85000 }
        ];

        let lapHarianData = JSON.parse(localStorage.getItem('erp_lap_harian')) || [];
        // Kendala & Notulen: terpisah dari input pekerjaan, 1x input per tanggal per proyek, bisa diedit.
        let lapHarianKendalaData = JSON.parse(localStorage.getItem('erp_lap_harian_kendala')) || [];
        let lapMingguanData = JSON.parse(localStorage.getItem('erp_lap_mingguan')) || [];
        let divScheduleData = JSON.parse(localStorage.getItem('erp_div_schedule')) || [];
        let kebutuhanMatData = JSON.parse(localStorage.getItem('erp_kebutuhan_mat')) || [
            { id: 1, projId: 'PRJ-01', nama: 'Semen Gresik 50kg', satuan: 'Sak', volume: 200, harga: 68000, supplier: 'TB Sinar Jaya' },
            { id: 2, projId: 'PRJ-01', nama: 'Besi Beton Ø12mm', satuan: 'Batang', volume: 150, harga: 95000, supplier: 'TB Baja Utama' }
        ];

        let materialOrderData = JSON.parse(localStorage.getItem('erp_mat_order')) || [];
        let materialMasukData = JSON.parse(localStorage.getItem('erp_mat_masuk')) || [];
        let materialKeluarData = JSON.parse(localStorage.getItem('erp_mat_keluar')) || [];
        let karyawanData = JSON.parse(localStorage.getItem('erp_karyawan')) || [
            { id: 1, projId: 'PRJ-01', nama: 'Budi Santoso', jabatan: 'Mandor Struktur', hp: '08123456789', email: 'budi@gmail.com', status: 'Tetap', tglMasuk: '2026-01-05', photo: '' },
            { id: 2, projId: 'PRJ-01', nama: 'Andi Pratama', jabatan: 'Tukang Batu', hp: '08198765432', email: 'andi@gmail.com', status: 'Kontrak', tglMasuk: '2026-01-10', photo: '' }
        ];
        let absenMasukData = JSON.parse(localStorage.getItem('erp_absen_masuk')) || [];
        let absenKeluarData = JSON.parse(localStorage.getItem('erp_absen_keluar')) || [];
        let leaveData = JSON.parse(localStorage.getItem('erp_leave')) || []; // Izin / Sakit / Cuti
        let bqResultsData = JSON.parse(localStorage.getItem('erp_bq_results')) || [];
        // Data Opname Lapangan (Backup Quantity > Opname): tiap baris = 1 hitungan opname untuk 1 item pekerjaan RAB
        let bqOpnameData = JSON.parse(localStorage.getItem('erp_bq_opname')) || [];
        // Daftar CCO (Contract Change Order/adendum) per proyek: { id, projId, nomor, tanggal, keterangan }
        let rabCcoList = JSON.parse(localStorage.getItem('erp_rab_cco_list')) || [];
        // Baris perubahan per CCO: { id, projId, ccoId, refId, tipe: 'ubah'|'baru'|'hilang', ...field RAB, justifikasi, order }
        let rabCcoItems = JSON.parse(localStorage.getItem('erp_rab_cco_items')) || [];
        // Rincian hasil hitung ulang volume per item pekerjaan acuan pada tiap CCO (metode sama seperti Opname)
        let volCcoData = JSON.parse(localStorage.getItem('erp_vol_cco')) || [];
        // Penanda kombinasi (item pekerjaan, minggu) yang SUDAH PERNAH disentuh user - diisi manual, hasil
        // salinan otomatis dari minggu lalu, ATAU baris terakhirnya sengaja dihapus sampai kosong. Dipakai
        // supaya fitur "salin otomatis dari minggu lalu" tidak menghidupkan kembali baris yang memang sengaja
        // dihapus user sampai kosong (kalau hanya mengandalkan "apakah minggu ini masih ada barisnya", minggu
        // yang barusan dikosongkan lewat hapus akan dianggap "belum pernah diisi" dan disalin ulang lagi).
        let bqOpnameTouchedWeeks = JSON.parse(localStorage.getItem('erp_bq_opname_touched')) || [];

        // ===================================================================
        // FIREBASE CLOUD SYNC — supaya data terbagi & tersinkron di semua device/pengguna
        // ===================================================================
        // Semua logika aplikasi TETAP membaca/menulis dari variabel & localStorage seperti biasa
        // (tidak ada refactor besar). Lapisan ini hanya "mencerminkan" nilai localStorage ke
        // Firestore, dan sebaliknya menerapkan perubahan dari perangkat lain ke localStorage +
        // variabel di memori, lalu me-render ulang tampilan. Login/otentikasi APLIKASI tetap
        // pakai sistem akun sendiri (email/password custom) seperti sebelumnya — Firebase Auth
        // di sini hanya dipakai secara anonim di belakang layar agar Firestore Security Rules
        // bisa mensyaratkan "harus sudah terautentikasi" tanpa mengubah alur login yang ada.
        const firebaseConfig = {
            apiKey: "AIzaSyCnJcW7hnd37mcli4WtuknrlrcIrkAnicU",
            authDomain: "proconstruct-erp.firebaseapp.com",
            projectId: "proconstruct-erp",
            storageBucket: "proconstruct-erp.firebasestorage.app",
            messagingSenderId: "432558806812",
            appId: "1:432558806812:web:024d81ac1c59859ca78cd9",
            measurementId: "G-GSWLM44JX8"
        };
        let cloudDb = null;
        let cloudReady = false;

        // Tampilkan pesan error sinkronisasi cloud langsung di layar (bukan cuma di console),
        // supaya masalah "akun tidak sinkron lintas device" bisa langsung diketahui akar penyebabnya.
        function showCloudSyncError(context, err) {
            console.error(context, err);
            const code = err && err.code ? err.code : '';
            let hint = '';
            if (code === 'auth/operation-not-allowed') {
                hint = 'Aktifkan "Anonymous" di Firebase Console > Authentication > Sign-in method.';
            } else if (code === 'permission-denied' || /insufficient permissions/i.test(err && err.message || '')) {
                hint = 'Perbaiki Firestore Security Rules agar mengizinkan akses untuk user terautentikasi (allow read, write: if request.auth != null;).';
            } else if (code === 'unavailable' || code === 'auth/network-request-failed') {
                hint = 'Periksa koneksi internet perangkat ini.';
            } else if (/firestore has not been used|database.*not.*exist/i.test(err && err.message || '')) {
                hint = 'Buat Firestore Database (Native mode) di Firebase Console untuk project ini.';
            } else {
                hint = 'Buka Console (F12) untuk detail teknis, atau cek pengaturan Firebase Console.';
            }
            const text = `Sinkronisasi cloud gagal (${context}): ${(err && err.message) || 'Tidak diketahui'}. ${hint}`;
            const banner = document.getElementById('cloudSyncBanner');
            const banterText = document.getElementById('cloudSyncBannerText');
            if (banner && banterText) {
                banterText.innerText = text;
                banner.classList.remove('hidden');
            }
        }

        try {
            firebase.initializeApp(firebaseConfig);
            cloudDb = firebase.firestore();
            firebase.auth().signInAnonymously().catch(err => showCloudSyncError('Login Anonim ke Firebase', err));
            firebase.auth().onAuthStateChanged(u => { cloudReady = !!u; if (u) startGlobalCloudSync(); });
        } catch (err) {
            showCloudSyncError('Inisialisasi Firebase', err);
        }

        // Kunci localStorage yang bersifat GLOBAL (dipakai lintas semua workspace: daftar akun & daftar proyek)
        const CLOUD_GLOBAL_FIELD = { erp_users: 'users', erp_projects: 'projects' };
        // Kunci localStorage yang bersifat PER-WORKSPACE (data operasional 1 admin/perusahaan)
        const CLOUD_WORKSPACE_FIELD = {
            erp_rab: 'rab', erp_lap_harian: 'lapHarian', erp_lap_harian_kendala: 'lapHarianKendala',
            erp_lap_mingguan: 'lapMingguan', erp_div_schedule: 'divSchedule', erp_kebutuhan_mat: 'kebutuhanMat',
            erp_mat_order: 'materialOrder', erp_mat_masuk: 'materialMasuk', erp_mat_keluar: 'materialKeluar',
            erp_karyawan: 'karyawan',
            erp_leave: 'leave', erp_bq_results: 'bqResults', erp_bq_opname: 'bqOpname',
            erp_rab_cco_list: 'rabCcoList', erp_rab_cco_items: 'rabCcoItems', erp_vol_cco: 'volCco', erp_pay: 'pay'
        };
        // erp_absen_masuk & erp_absen_keluar SENGAJA TIDAK dimasukkan ke CLOUD_WORKSPACE_FIELD di atas.
        // Kedua data ini memuat FOTO (base64) yang bisa besar, sehingga kalau digabung jadi 1 field string
        // raksasa di dalam 1 dokumen workspace (bersama RAB, laporan, dst), total ukuran dokumen sangat mudah
        // melewati batas keras Firestore: 1 dokumen maksimal 1.048.576 byte (1 MiB) - persis penyebab error
        // "Document ... cannot be written because its size ... exceeds the maximum allowed size of 1,048,576 bytes".
        // Sebagai gantinya, tiap record absen disimpan sebagai 1 DOKUMEN TERPISAH di dalam SUB-COLLECTION
        // workspaces/{wsId}/absenMasuk/{id} & workspaces/{wsId}/absenKeluar/{id) - lihat
        // CLOUD_WORKSPACE_SUBCOLLECTION, pushAbsenRecordToCloud(), dan startAbsenSubcollectionSync() di bawah.
        const CLOUD_WORKSPACE_SUBCOLLECTION = {
            erp_absen_masuk: { sub: 'absenMasuk', getArray: () => absenMasukData },
            erp_absen_keluar: { sub: 'absenKeluar', getArray: () => absenKeluarData }
        };
        let cloudWorkspaceId = null;
        let cloudWorkspaceUnsub = null;
        let cloudGlobalUnsub = null;
        let cloudApplyingRemote = false; // true selagi menerapkan data dari cloud, agar tidak ter-push balik (loop)
        let cloudPushTimers = {};

        // Tulis ulang variabel-variabel data di memori dari localStorage (dipanggil setelah menerima update dari cloud)
        function reloadAppDataFromLocalStorage(keys) {
            keys.forEach(k => {
                switch (k) {
                    case 'erp_projects': projects = JSON.parse(localStorage.getItem(k)) || []; break;
                    case 'erp_users': users = JSON.parse(localStorage.getItem(k)) || []; break;
                    case 'erp_rab': rabData = JSON.parse(localStorage.getItem(k)) || []; break;
                    case 'erp_lap_harian': lapHarianData = JSON.parse(localStorage.getItem(k)) || []; break;
                    case 'erp_lap_harian_kendala': lapHarianKendalaData = JSON.parse(localStorage.getItem(k)) || []; break;
                    case 'erp_lap_mingguan': lapMingguanData = JSON.parse(localStorage.getItem(k)) || []; break;
                    case 'erp_div_schedule': divScheduleData = JSON.parse(localStorage.getItem(k)) || []; break;
                    case 'erp_kebutuhan_mat': kebutuhanMatData = JSON.parse(localStorage.getItem(k)) || []; break;
                    case 'erp_mat_order': materialOrderData = JSON.parse(localStorage.getItem(k)) || []; break;
                    case 'erp_mat_masuk': materialMasukData = JSON.parse(localStorage.getItem(k)) || []; break;
                    case 'erp_mat_keluar': materialKeluarData = JSON.parse(localStorage.getItem(k)) || []; break;
                    case 'erp_karyawan': karyawanData = JSON.parse(localStorage.getItem(k)) || []; break;
                    case 'erp_absen_masuk': absenMasukData = JSON.parse(localStorage.getItem(k)) || []; break;
                    case 'erp_absen_keluar': absenKeluarData = JSON.parse(localStorage.getItem(k)) || []; break;
                    case 'erp_leave': leaveData = JSON.parse(localStorage.getItem(k)) || []; break;
                    case 'erp_bq_results': bqResultsData = JSON.parse(localStorage.getItem(k)) || []; break;
                    case 'erp_bq_opname': bqOpnameData = JSON.parse(localStorage.getItem(k)) || []; break;
                    case 'erp_bq_opname_touched': bqOpnameTouchedWeeks = JSON.parse(localStorage.getItem(k)) || []; break;
                    case 'erp_rab_cco_list': rabCcoList = JSON.parse(localStorage.getItem(k)) || []; break;
                    case 'erp_rab_cco_items': rabCcoItems = JSON.parse(localStorage.getItem(k)) || []; break;
                    case 'erp_vol_cco': volCcoData = JSON.parse(localStorage.getItem(k)) || []; break;
                    case 'erp_pay': payData = JSON.parse(localStorage.getItem(k)) || []; break;
                }
            });
            // Jika sesi sedang login, refresh currentUser dari daftar users terbaru (mis. status approval berubah)
            if (currentUser) {
                const fresh = users.find(u => u.id === currentUser.id);
                if (fresh) { currentUser = fresh; sessionStorage.setItem('erp_current_user', JSON.stringify(currentUser)); }
            }
            if (typeof renderActiveTabContent === 'function' && currentUser) {
                try {
                    updateSidebarProjectInfo();
                    initProjectSelector();
                    if (typeof checkAdminPendingCount === 'function') checkAdminPendingCount();
                    renderActiveTabContent();
                } catch (err) { /* halaman tertentu mungkin belum siap render, aman diabaikan */ }
            }
        }

        function workspaceIdForUser(user) {
            if (!user) return null;
            if (user.role === 'Admin') return String(user.id);
            const proj = projects.find(p => p.id === user.projectId);
            return proj ? String(proj.ownerId) : null;
        }

        // Gabungkan array JSON dari cloud & lokal berdasarkan 'id' (bukan timpa mentah).
        // Ini mencegah data yang baru dibuat di device ini (tapi belum sempat terkirim ke cloud
        // karena delay/izin/koneksi) hilang tertimpa saat versi lama dari cloud diterima kembali.
        function mergeJsonArraysById(remoteJson, localJson) {
            let remoteArr, localArr;
            try { remoteArr = JSON.parse(remoteJson); } catch (e) { remoteArr = []; }
            try { localArr = JSON.parse(localJson); } catch (e) { localArr = []; }
            if (!Array.isArray(remoteArr)) remoteArr = [];
            if (!Array.isArray(localArr)) localArr = [];
            const map = new Map();
            remoteArr.forEach(item => { if (item && item.id != null) map.set(item.id, item); });
            localArr.forEach(item => { if (item && item.id != null && !map.has(item.id)) map.set(item.id, item); });
            return JSON.stringify(Array.from(map.values()));
        }

        // Dorong 1 key localStorage GLOBAL (users/projects) ke Firestore (debounced)
        function pushGlobalKeyToCloud(key) {
            if (!cloudDb || !cloudReady || cloudApplyingRemote) return;
            const field = CLOUD_GLOBAL_FIELD[key];
            if (!field) return;
            clearTimeout(cloudPushTimers['g_' + key]);
            cloudPushTimers['g_' + key] = setTimeout(() => {
                cloudDb.collection('global').doc('main').set({ [field]: localStorage.getItem(key) || '[]' }, { merge: true })
                    .catch(err => showCloudSyncError('Kirim data akun/proyek ke cloud', err));
            }, 400);
        }

        // Dorong 1 key localStorage PER-WORKSPACE ke Firestore (debounced)
        function pushWorkspaceKeyToCloud(key) {
            if (!cloudDb || !cloudReady || cloudApplyingRemote || !cloudWorkspaceId) return;
            const field = CLOUD_WORKSPACE_FIELD[key];
            if (!field) return;
            clearTimeout(cloudPushTimers['w_' + key]);
            cloudPushTimers['w_' + key] = setTimeout(() => {
                cloudDb.collection('workspaces').doc(cloudWorkspaceId).set({ [field]: localStorage.getItem(key) || '[]' }, { merge: true })
                    .catch(err => showCloudSyncError('Kirim data proyek ke cloud', err));
            }, 400);
        }

        // Dorong 1 RECORD absensi (Absen Masuk/Keluar, termasuk foto) sebagai 1 dokumen terpisah di sub-collection,
        // BUKAN digabung ke field raksasa di dokumen workspace utama. Ini yang mencegah error "document size exceeds
        // 1 MiB" pada Firestore ketika jumlah foto absensi terus bertambah banyak.
        function pushAbsenRecordToCloud(localKey, record) {
            if (!cloudDb || !cloudReady || !cloudWorkspaceId || !record || record.id == null) return;
            const conf = CLOUD_WORKSPACE_SUBCOLLECTION[localKey];
            if (!conf) return;
            cloudDb.collection('workspaces').doc(cloudWorkspaceId).collection(conf.sub).doc(String(record.id)).set(record)
                .catch(err => showCloudSyncError('Kirim data absensi ke cloud', err));
        }

        let cloudAbsenUnsubs = [];
        const _migratedAbsenWorkspaces = new Set();

        // Dengarkan perubahan sub-collection Absen Masuk/Keluar secara realtime, & lakukan migrasi 1x untuk
        // membersihkan field lama (absenMasuk/absenKeluar) yang mungkin masih tersimpan sebagai field raksasa
        // di dokumen workspace utama dari versi aplikasi sebelumnya, serta memastikan data lokal saat ini juga
        // sudah tersalin ke sub-collection cloud (aman dijalankan berkali-kali/idempotent).
        function startAbsenSubcollectionSync(wsId) {
            stopAbsenSubcollectionSync();
            if (!cloudDb || !wsId) return;
            const mainDocRef = cloudDb.collection('workspaces').doc(wsId);

            if (!_migratedAbsenWorkspaces.has(wsId)) {
                _migratedAbsenWorkspaces.add(wsId);
                mainDocRef.get().then(snap => {
                    if (!snap.exists) return;
                    const data = snap.data();
                    const cleanup = {};
                    if (typeof data.absenMasuk === 'string') cleanup.absenMasuk = firebase.firestore.FieldValue.delete();
                    if (typeof data.absenKeluar === 'string') cleanup.absenKeluar = firebase.firestore.FieldValue.delete();
                    if (Object.keys(cleanup).length) {
                        mainDocRef.update(cleanup).catch(err => console.warn('Gagal membersihkan field absensi lama di dokumen workspace:', err));
                    }
                }).catch(err => console.warn('Gagal memeriksa dokumen workspace untuk migrasi absensi:', err));

                Object.keys(CLOUD_WORKSPACE_SUBCOLLECTION).forEach(localKey => {
                    const conf = CLOUD_WORKSPACE_SUBCOLLECTION[localKey];
                    conf.getArray().forEach(rec => {
                        if (rec && rec.id != null) {
                            mainDocRef.collection(conf.sub).doc(String(rec.id)).set(rec, { merge: true })
                                .catch(err => console.warn('Gagal migrasi record absensi ke sub-collection:', err));
                        }
                    });
                });
            }

            Object.keys(CLOUD_WORKSPACE_SUBCOLLECTION).forEach(localKey => {
                const conf = CLOUD_WORKSPACE_SUBCOLLECTION[localKey];
                const unsub = mainDocRef.collection(conf.sub).onSnapshot(snap => {
                    let changed = false;
                    snap.docChanges().forEach(change => {
                        const rec = change.doc.data();
                        const arr = conf.getArray();
                        const idx = arr.findIndex(x => x.id == rec.id);
                        if (change.type === 'removed') {
                            if (idx > -1) { arr.splice(idx, 1); changed = true; }
                        } else {
                            if (idx > -1) { arr[idx] = rec; } else { arr.push(rec); }
                            changed = true;
                        }
                    });
                    if (changed) {
                        cloudApplyingRemote = true;
                        localStorage.setItem(localKey, JSON.stringify(conf.getArray()));
                        cloudApplyingRemote = false;
                        reloadAppDataFromLocalStorage([localKey]);
                    }
                }, err => showCloudSyncError('Menerima data absensi dari cloud', err));
                cloudAbsenUnsubs.push(unsub);
            });
        }

        function stopAbsenSubcollectionSync() {
            cloudAbsenUnsubs.forEach(unsub => { if (unsub) unsub(); });
            cloudAbsenUnsubs = [];
        }

        // Dengarkan perubahan GLOBAL (users & projects) secara realtime — dimulai sejak app dibuka (sebelum login),
        // supaya login/registrasi selalu memakai data terbaru dari semua perangkat.
        function startGlobalCloudSync() {
            if (cloudGlobalUnsub || !cloudDb) return;
            cloudGlobalUnsub = cloudDb.collection('global').doc('main').onSnapshot(snap => {
                if (!snap.exists) {
                    // Belum ada data di cloud sama sekali → unggah data lokal saat ini (mis. akun demo) sebagai data awal
                    cloudDb.collection('global').doc('main').set({
                        users: localStorage.getItem('erp_users') || '[]',
                        projects: localStorage.getItem('erp_projects') || '[]'
                    }, { merge: true }).catch(err => showCloudSyncError('Inisialisasi data akun/proyek di cloud', err));
                    return;
                }
                const data = snap.data();
                const changedKeys = [];
                const keysNeedingHeal = [];
                cloudApplyingRemote = true;
                Object.keys(CLOUD_GLOBAL_FIELD).forEach(key => {
                    const field = CLOUD_GLOBAL_FIELD[key];
                    if (typeof data[field] === 'string' && localStorage.getItem(key) !== data[field]) {
                        const merged = mergeJsonArraysById(data[field], localStorage.getItem(key));
                        localStorage.setItem(key, merged);
                        changedKeys.push(key);
                        if (merged !== data[field]) keysNeedingHeal.push(key);
                    }
                });
                cloudApplyingRemote = false;
                if (changedKeys.length) reloadAppDataFromLocalStorage(changedKeys);
                // Kalau ada data lokal (mis. akun baru) yang tidak ada di cloud, kirim balik versi gabungan
                // ke cloud supaya cloud "sembuh" dan device lain juga menerima data yang sempat tertinggal ini.
                keysNeedingHeal.forEach(k => pushGlobalKeyToCloud(k));
            }, err => showCloudSyncError('Menerima data akun/proyek dari cloud', err));
        }

        // Dengarkan perubahan data PER-WORKSPACE secara realtime — dimulai setelah user login & workspace diketahui.
        function startWorkspaceCloudSync(user) {
            stopWorkspaceCloudSync();
            const wsId = workspaceIdForUser(user);
            cloudWorkspaceId = wsId;
            if (!wsId || !cloudDb) return;
            startAbsenSubcollectionSync(wsId);
            cloudWorkspaceUnsub = cloudDb.collection('workspaces').doc(wsId).onSnapshot(snap => {
                if (!snap.exists) {
                    // Workspace baru (mis. Admin baru daftar) → unggah data lokal saat ini sebagai data awal
                    const initPayload = {};
                    Object.keys(CLOUD_WORKSPACE_FIELD).forEach(key => { initPayload[CLOUD_WORKSPACE_FIELD[key]] = localStorage.getItem(key) || '[]'; });
                    cloudDb.collection('workspaces').doc(wsId).set(initPayload, { merge: true }).catch(err => showCloudSyncError('Inisialisasi data proyek di cloud', err));
                    return;
                }
                const data = snap.data();
                const changedKeys = [];
                const keysNeedingHeal = [];
                cloudApplyingRemote = true;
                Object.keys(CLOUD_WORKSPACE_FIELD).forEach(key => {
                    const field = CLOUD_WORKSPACE_FIELD[key];
                    if (typeof data[field] === 'string' && localStorage.getItem(key) !== data[field]) {
                        const merged = mergeJsonArraysById(data[field], localStorage.getItem(key));
                        localStorage.setItem(key, merged);
                        changedKeys.push(key);
                        if (merged !== data[field]) keysNeedingHeal.push(key);
                    }
                });
                cloudApplyingRemote = false;
                if (changedKeys.length) reloadAppDataFromLocalStorage(changedKeys);
                keysNeedingHeal.forEach(k => pushWorkspaceKeyToCloud(k));
            }, err => showCloudSyncError('Menerima data proyek dari cloud', err));
        }

        function stopWorkspaceCloudSync() {
            if (cloudWorkspaceUnsub) { cloudWorkspaceUnsub(); cloudWorkspaceUnsub = null; }
            stopAbsenSubcollectionSync();
            cloudWorkspaceId = null;
        }

        // Dipakai di SETIAP alur yang perlu keluar dari sesi Firebase Auth saat ini lalu masuk lagi secara
        // anonim (logout, batal verifikasi email, gagal login, selesai registrasi, dsb). SEBELUM sign-out,
        // listener realtime (global users/projects & workspace) SENGAJA dihentikan & referensinya di-null-kan
        // dulu - kalau tidak, listener yang masih aktif akan menerima error "Missing or insufficient
        // permissions" persis pada saat auth sempat kosong di antara signOut() & signInAnonymously() (itulah
        // sebabnya error itu muncul tepat saat tombol Logout dipencet), DAN karena Firestore SDK tidak
        // otomatis mencoba ulang listener yang sudah error, sinkronisasi cloud akan mati permanen untuk sisa
        // sesi kalau referensi lamanya tidak dibersihkan. Dengan cloudGlobalUnsub di-null-kan di sini,
        // onAuthStateChanged akan otomatis memanggil startGlobalCloudSync() lagi begitu sign-in anonim baru
        // selesai, sehingga sinkronisasi pulih normal tanpa perlu reload halaman.
        async function reauthAnonymously() {
            if (cloudGlobalUnsub) { cloudGlobalUnsub(); cloudGlobalUnsub = null; }
            stopWorkspaceCloudSync();
            cloudReady = false;
            try { await firebase.auth().signOut(); } catch (e) {}
            try { await firebase.auth().signInAnonymously(); } catch (e) {}
        }

        // Setiap ada localStorage.setItem, otomatis dorong ke Firestore bila key terkait termasuk yang disinkron.
        // Tidak ada satupun kode lain di aplikasi ini yang perlu diubah — cukup "sadap" di titik ini.
        const _origLocalStorageSetItem = localStorage.setItem.bind(localStorage);
        localStorage.setItem = function(key, value) {
            _origLocalStorageSetItem(key, value);
            if (CLOUD_GLOBAL_FIELD[key]) pushGlobalKeyToCloud(key);
            if (CLOUD_WORKSPACE_FIELD[key]) pushWorkspaceKeyToCloud(key);
        };

        let currentTab = 'home';
        let homeBudgetChartInstance = null;
        let activeMaterialSub = 'mat-kebutuhan';
        // ==== LAPORAN KEUANGAN ====
        let activePayKategori = 'subkon'; // subkon|tenaga|material|karyawan|termin|investor
        let payEditContext = null; // id baris yang sedang diedit, null = mode tambah baru
        let payData = JSON.parse(localStorage.getItem('erp_pay')) || [];
        // { id, projId, kategori, tanggal, nama, uraian, jumlah, metodeBayar, keterangan }
        const PAY_KATEGORI = {
            subkon: { label: 'Pembayaran Subkontraktor', namaLabel: 'Nama Subkontraktor', namaPlaceholder: 'CV Karya Beton', uraianLabel: 'Uraian Pekerjaan', arah: 'keluar', icon: 'fa-people-roof' },
            tenaga: { label: 'Pembayaran Tenaga (Upah)', namaLabel: 'Nama Mandor / Kelompok Kerja', namaPlaceholder: 'Mandor Slamet', uraianLabel: 'Uraian Pekerjaan', arah: 'keluar', icon: 'fa-helmet-safety' },
            material: { label: 'Pembayaran Material', namaLabel: 'Nama Toko / Supplier', namaPlaceholder: 'TB Sinar Jaya', uraianLabel: 'Uraian Material', arah: 'keluar', icon: 'fa-truck-field' },
            karyawan: { label: 'Pembayaran Karyawan (Gaji)', namaLabel: 'Nama Karyawan', namaPlaceholder: 'Budi Santoso', uraianLabel: 'Uraian (Gaji Bulan/Posisi)', arah: 'keluar', icon: 'fa-id-badge' },
            termin: { label: 'Pembayaran Termin (dari Owner)', namaLabel: 'Termin Ke-', namaPlaceholder: 'Termin 1 (Uang Muka)', uraianLabel: 'Uraian Termin', arah: 'masuk', icon: 'fa-hand-holding-dollar' },
            investor: { label: 'Pembayaran Investor', namaLabel: 'Nama Investor', namaPlaceholder: 'PT Modal Sejahtera', uraianLabel: 'Uraian (Modal/Investasi)', arah: 'masuk', icon: 'fa-sack-dollar' }
        };
        let materialEditContext = null; // { type: 'kebutuhan'|'order'|'masuk'|'keluar', id } - null jika sedang mode tambah baru
        let activeAbsenType = 'absen-masuk';
        let webcamStream = null;
        let currentFacingMode = 'user'; // 'user' = kamera depan, 'environment' = kamera belakang (untuk absen masuk & keluar Android)
        let gpsCoordinates = '-5.1476, 119.4327 (Makassar)';
        let currentGpsLat = -5.1476;
        let currentGpsLng = 119.4327;
        let currentGpsAccuracy = null;
        let currentAddressText = 'Mencari alamat...';

        // Excel Import Temp State
        let tempExcelWorkbook = null;
        let tempExcelSheetNames = [];

        // ===================================================================
        // ROLE & MULTI-TENANT PROJECT VISIBILITY HELPERS
        // ===================================================================
        // Hanya Admin yang punya akses penuh (edit RAB, kelola karyawan, kelola proyek).
        function isAdminUser() {
            return !!(currentUser && currentUser.role === 'Admin');
        }

        // Izin edit data operasional proyek (Laporan Harian, Material, Time Schedule, Absensi, dsb) untuk akun User.
        // Admin selalu boleh edit. Akun User hanya boleh edit selama Admin belum menonaktifkan izinnya (canEdit !== false).
        function canUserEdit() {
            if (!currentUser) return false;
            if (currentUser.role === 'Admin') return true;
            return currentUser.canEdit !== false;
        }

        // Proyek yang boleh dilihat oleh akun yang sedang login:
        // - Admin hanya melihat proyek miliknya sendiri (ownerId === id Admin tsb).
        // - User hanya melihat 1 proyek yang telah ia gabung (sesuai kode dari Admin).
        // Ini mencegah data proyek/akun demo ikut terlihat pada akun yang baru daftar.
        function getVisibleProjects() {
            if (!currentUser) return [];
            if (currentUser.role === 'Admin') {
                return projects.filter(p => p.ownerId === currentUser.id);
            }
            return projects.filter(p => p.id === currentUser.projectId);
        }

        // Membuat 1 proyek kosong (tanpa data RAB/karyawan/laporan) untuk Admin yang baru pertama kali login
        // dan belum memiliki proyek sama sekali, supaya aplikasi tetap bisa berjalan tanpa mewarisi data demo.
        function createStarterProjectFor(user) {
            const uniqueSuffix = Date.now().toString().slice(-6);
            return {
                id: 'PRJ-' + Date.now(),
                kode: 'PRJ-' + uniqueSuffix,
                nama: 'Proyek Baru - ' + (user.name || 'Admin'),
                lokasi: '',
                owner: '',
                nilai: 0,
                tglMulai: '',
                tglSelesai: '',
                logo: '',
                ppn: 11,
                pph: 2,
                ownerId: user.id
            };
        }

        // Menentukan activeProjectId yang benar untuk akun yang sedang login, agar setiap akun
        // hanya melihat proyek & datanya sendiri (bukan proyek/data akun lain, termasuk akun demo).
        function resolveActiveProjectForCurrentUser() {
            if (!currentUser) return;
            if (currentUser.role === 'Admin') {
                let owned = projects.filter(p => p.ownerId === currentUser.id);
                if (owned.length === 0) {
                    const starter = createStarterProjectFor(currentUser);
                    projects.push(starter);
                    localStorage.setItem('erp_projects', JSON.stringify(projects));
                    owned = [starter];
                }
                if (!owned.some(p => p.id === activeProjectId)) {
                    activeProjectId = owned[0].id;
                }
            } else {
                if (currentUser.projectId && projects.some(p => p.id === currentUser.projectId)) {
                    activeProjectId = currentUser.projectId;
                } else {
                    activeProjectId = null;
                }
            }
            localStorage.setItem('erp_active_project', activeProjectId || '');
        }

        // ===================================================================
        // INITIALIZATION ON LOAD
        // ===================================================================
        window.addEventListener('DOMContentLoaded', () => {
            checkAuthStatus();
            initProjectSelector();
            updateSidebarProjectInfo();
            initDropdowns();
            renderActiveTabContent();
            // Kamera TIDAK dinyalakan otomatis di sini lagi — hanya dinyalakan saat user
            // benar-benar membuka halaman Absen Masuk / Absen Keluar (lihat switchTab()).
            initGpsLocation();
            initSidebarState();
            initUniformDateInputClick();
            // Isi tahun berjalan pada teks Copyright (login modal & sidebar)
            const thisYear = new Date().getFullYear();
            ['copyrightYearLogin', 'copyrightYearSidebar'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = thisYear;
            });
        });

        // ===================================================================
        // INPUT TANGGAL SERAGAM: klik di mana saja pada kotak input tanggal (bukan hanya ikon
        // kalender kecil di kanan) langsung membuka popup kalender bawaan browser, di SELURUH
        // halaman/menu, termasuk input tanggal yang baru dibuat lewat JS (delegasi event di document).
        // ===================================================================
        function initUniformDateInputClick() {
            document.addEventListener('click', (e) => {
                const el = e.target.closest('input[type="date"]');
                if (!el || el.disabled || el.readOnly) return;
                if (typeof el.showPicker === 'function') {
                    try { el.showPicker(); } catch (err) { /* diabaikan: mis. belum ada user gesture */ }
                }
            });
        }

        // ===================================================================
        // SIDEBAR HIDE / UNHIDE (Desktop: collapse, Mobile: slide-over drawer)
        // ===================================================================
        function initSidebarState() {
            // Di layar HP, sidebar defaultnya tersembunyi (overlay) agar konten utama tidak terpotong.
            // Di layar desktop, ingat preferensi terakhir user (hide/unhide).
            const aside = document.getElementById('mainSidebar');
            if (!aside) return;
            const collapsed = localStorage.getItem('erp_sidebar_collapsed') === '1';
            if (collapsed) aside.classList.add('sidebar-collapsed');
        }

        function toggleSidebar() {
            const aside = document.getElementById('mainSidebar');
            const backdrop = document.getElementById('sidebarBackdrop');
            if (!aside) return;
            const isDesktop = window.innerWidth >= 768;
            if (isDesktop) {
                const nowCollapsed = aside.classList.toggle('sidebar-collapsed');
                localStorage.setItem('erp_sidebar_collapsed', nowCollapsed ? '1' : '0');
            } else {
                const nowOpen = aside.classList.toggle('sidebar-open');
                if (backdrop) backdrop.classList.toggle('active', nowOpen);
            }
        }

        function closeSidebarMobile() {
            const aside = document.getElementById('mainSidebar');
            const backdrop = document.getElementById('sidebarBackdrop');
            if (aside) aside.classList.remove('sidebar-open');
            if (backdrop) backdrop.classList.remove('active');
        }

        function checkAuthStatus() {
            if (!currentUser) {
                document.getElementById('authModal').classList.remove('hidden');
            } else {
                document.getElementById('authModal').classList.add('hidden');
                resolveActiveProjectForCurrentUser();
                updateUserHeaderUI();
                applyRoleBasedUI();
                checkAdminPendingCount();
                initProjectSelector();
                updateSidebarProjectInfo();
                startWorkspaceCloudSync(currentUser);
                if (currentUser.role === 'User' && !currentUser.projectId) {
                    openUserJoinProjectModal(true);
                }
            }
        }

        function toggleAuthTab(tab) {
            hideLoginError();
            const unverifiedBox = document.getElementById('unverifiedEmailBox');
            if (unverifiedBox) unverifiedBox.classList.add('hidden');
            if (tab === 'login') {
                document.getElementById('formLogin').classList.remove('hidden');
                document.getElementById('formRegister').classList.add('hidden');
                document.getElementById('btnTabLogin').className = 'flex-1 py-3 text-center border-b-2 border-amber-500 text-amber-400';
                document.getElementById('btnTabRegister').className = 'flex-1 py-3 text-center text-slate-400 hover:text-white';
            } else {
                document.getElementById('formLogin').classList.add('hidden');
                document.getElementById('formRegister').classList.remove('hidden');
                document.getElementById('btnTabRegister').className = 'flex-1 py-3 text-center border-b-2 border-purple-500 text-purple-400';
                document.getElementById('btnTabLogin').className = 'flex-1 py-3 text-center text-slate-400 hover:text-white';
            }
        }

        // Terjemahkan kode error Firebase Auth menjadi pesan Bahasa Indonesia yang mudah dipahami.
        function mapFirebaseAuthError(err) {
            const code = err && err.code;
            switch (code) {
                case 'auth/email-already-in-use': return 'Email ini sudah terdaftar di sistem. Silakan login, atau gunakan email lain.';
                case 'auth/invalid-email': return 'Format email tidak valid.';
                case 'auth/weak-password': return 'Kata sandi terlalu lemah, minimal 6 karakter.';
                case 'auth/user-not-found': return 'Akun tidak ditemukan. Periksa kembali Email Anda, atau daftar akun baru.';
                case 'auth/wrong-password': return 'Kata sandi salah. Silakan coba lagi.';
                case 'auth/invalid-credential': return 'Email atau kata sandi salah.';
                case 'auth/too-many-requests': return 'Terlalu banyak percobaan gagal. Silakan coba lagi beberapa saat lagi.';
                case 'auth/network-request-failed': return 'Gagal terhubung ke server. Periksa koneksi internet Anda.';
                case 'auth/operation-not-allowed': return 'Login Email/Password belum diaktifkan di Firebase Console (Authentication > Sign-in method).';
                default: return (err && err.message) ? err.message : 'Terjadi kesalahan. Silakan coba lagi.';
            }
        }

        function setBtnLoading(btn, loading, html) {
            if (!btn) return;
            btn.disabled = loading;
            btn.innerHTML = html;
        }

        function showUnverifiedBox(email) {
            document.getElementById('formLogin').classList.add('hidden');
            const box = document.getElementById('unverifiedEmailBox');
            document.getElementById('unverifiedEmailText').innerText = email;
            box.classList.remove('hidden');
        }

        async function cancelUnverifiedFlow() {
            document.getElementById('unverifiedEmailBox').classList.add('hidden');
            document.getElementById('formLogin').classList.remove('hidden');
            await reauthAnonymously();
        }

        // Dipanggil setelah email dipastikan terverifikasi (baik langsung saat login, maupun setelah "Cek Lagi").
        // Melakukan pengecekan status approval Admin, lalu masuk ke aplikasi.
        async function finishLoginFlow(email) {
            const foundEmail = users.find(u => u.email === email);
            if (!foundEmail) {
                showLoginError('Email terverifikasi, namun data akun tidak ditemukan di sistem. Hubungi Admin.');
                document.getElementById('unverifiedEmailBox').classList.add('hidden');
                document.getElementById('formLogin').classList.remove('hidden');
                await reauthAnonymously();
                return;
            }
            if (foundEmail.status !== 'Approved' && foundEmail.role !== 'Admin') {
                document.getElementById('unverifiedEmailBox').classList.add('hidden');
                document.getElementById('formLogin').classList.remove('hidden');
                showLoginError('Email berhasil diverifikasi. Namun akun Anda masih menunggu persetujuan Admin / Project Manager.');
                await reauthAnonymously();
                return;
            }
            if (!foundEmail.emailVerified) {
                foundEmail.emailVerified = true;
                localStorage.setItem('erp_users', JSON.stringify(users));
            }
            document.getElementById('unverifiedEmailBox').classList.add('hidden');
            document.getElementById('formLogin').classList.remove('hidden');
            currentUser = foundEmail;
            sessionStorage.setItem('erp_current_user', JSON.stringify(currentUser));
            document.getElementById('authModal').classList.add('hidden');
            resolveActiveProjectForCurrentUser();
            updateUserHeaderUI();
            applyRoleBasedUI();
            checkAdminPendingCount();
            initProjectSelector();
            updateSidebarProjectInfo();
            startWorkspaceCloudSync(currentUser);
            initDropdowns();
            currentTab = 'home';
            switchTab('home');
            if (currentUser.role === 'User' && !currentUser.projectId) {
                openUserJoinProjectModal(true);
            }
        }

        async function recheckEmailVerification() {
            const u = firebase.auth().currentUser;
            if (!u) {
                document.getElementById('unverifiedEmailBox').classList.add('hidden');
                document.getElementById('formLogin').classList.remove('hidden');
                showLoginError('Sesi kadaluarsa, silakan login ulang.');
                return;
            }
            const btn = document.getElementById('btnRecheckVerify');
            setBtnLoading(btn, true, '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Mengecek...');
            try {
                await u.reload();
                if (u.emailVerified) {
                    await finishLoginFlow(u.email);
                } else {
                    alert('Email belum terverifikasi. Buka link di email Anda (cek juga folder Spam/Promosi), lalu coba lagi.');
                }
            } catch (err) {
                alert(mapFirebaseAuthError(err));
            } finally {
                setBtnLoading(btn, false, '<i class="fa-solid fa-rotate mr-1"></i> Sudah Verifikasi? Cek Lagi');
            }
        }

        async function resendVerificationEmail() {
            const u = firebase.auth().currentUser;
            if (!u) {
                document.getElementById('unverifiedEmailBox').classList.add('hidden');
                document.getElementById('formLogin').classList.remove('hidden');
                showLoginError('Sesi kadaluarsa, silakan login ulang.');
                return;
            }
            const btn = document.getElementById('btnResendVerify');
            setBtnLoading(btn, true, '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Mengirim...');
            try {
                await u.sendEmailVerification();
                alert('Email verifikasi terkirim ulang ke ' + u.email + '. Cek folder Masuk/Spam.');
            } catch (err) {
                alert(mapFirebaseAuthError(err));
            } finally {
                setBtnLoading(btn, false, '<i class="fa-solid fa-paper-plane mr-1"></i> Kirim Ulang Email Verifikasi');
            }
        }

        function showLoginError(message) {
            const box = document.getElementById('loginErrorBox');
            document.getElementById('loginErrorText').innerText = message;
            box.classList.remove('hidden');
        }

        function hideLoginError() {
            document.getElementById('loginErrorBox').classList.add('hidden');
        }

        // Toggle lihat/sembunyikan kata sandi pada input password manapun (Login & Daftar).
        function togglePasswordVisibility(inputId, btn) {
            const input = document.getElementById(inputId);
            if (!input) return;
            const icon = btn.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                if (icon) { icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); }
            } else {
                input.type = 'password';
                if (icon) { icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
            }
        }

        function hideRegPasswordError() {
            const box = document.getElementById('regPasswordError');
            if (box) box.classList.add('hidden');
        }

        async function handleLoginSubmit(e) {
            e.preventDefault();
            hideLoginError();
            const email = document.getElementById('loginEmail').value.trim();
            const pass = document.getElementById('loginPassword').value.trim();
            if (!email || !pass) return;

            const btn = document.getElementById('btnLoginSubmit');
            setBtnLoading(btn, true, '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Memeriksa akun...');
            try {
                // Login kini memakai Firebase Authentication (email/password) yang sesungguhnya,
                // supaya emailVerified benar-benar tervalidasi oleh Firebase (bukan sekadar field lokal).
                const cred = await firebase.auth().signInWithEmailAndPassword(email, pass);
                await cred.user.reload();
                if (!cred.user.emailVerified) {
                    showUnverifiedBox(email);
                    return;
                }
                await finishLoginFlow(email);
            } catch (err) {
                showLoginError(mapFirebaseAuthError(err));
            } finally {
                setBtnLoading(btn, false, '<i class="fa-solid fa-right-to-bracket mr-1"></i> Masuk Ke Aplikasi');
            }
        }

        async function handleRegisterSubmit(e) {
            e.preventDefault();
            const role = document.getElementById('regRole').value;
            const name = document.getElementById('regName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const position = document.getElementById('regPosition').value.trim();
            const phone = document.getElementById('regPhone').value.trim();
            const pass = document.getElementById('regPassword').value.trim();
            const passConfirm = document.getElementById('regPasswordConfirm').value.trim();
            const adminKode = document.getElementById('regAdminKode').value.trim();

            if (pass !== passConfirm) {
                const box = document.getElementById('regPasswordError');
                if (box) box.classList.remove('hidden');
                document.getElementById('regPasswordConfirm').focus();
                return;
            }
            if (pass.length < 6) {
                alert('Kata sandi minimal 6 karakter (syarat Firebase Authentication).');
                return;
            }
            if (users.some(u => u.email === email)) {
                alert('Email/Username sudah terdaftar!');
                return;
            }

            const btn = document.getElementById('btnRegisterSubmit');
            setBtnLoading(btn, true, '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Mendaftarkan...');
            try {
                // Registrasi kini membuat akun Firebase Authentication (email/password) yang sesungguhnya,
                // agar Firebase bisa mengirim email verifikasi asli via sendEmailVerification().
                const cred = await firebase.auth().createUserWithEmailAndPassword(email, pass);
                await cred.user.sendEmailVerification();

                const newUser = {
                    id: 'USR-' + Date.now(),
                    uid: cred.user.uid,
                    name, email, pass, role, position, phone,
                    adminKode: adminKode || null, // Kode proyek Admin tujuan, untuk fitur hubungkan Admin <-> User baru
                    status: role === 'Admin' ? 'Approved' : 'Pending',
                    canEdit: true, // Izin edit data operasional proyek; bisa dinonaktifkan Admin kapan saja
                    emailVerified: false,
                    photo: ''
                };

                users.push(newUser);
                localStorage.setItem('erp_users', JSON.stringify(users));

                if (role !== 'Admin' && adminKode) {
                    // Karena aplikasi berjalan lokal per-perangkat (tanpa server), permintaan gabung
                    // diunduh sebagai file JSON agar bisa dikirim manual (WA/email) ke Admin,
                    // lalu Admin meng-importnya lewat "Import Permintaan User" di modal Persetujuan.
                    const joinRequest = { id: newUser.id, name, email, pass, role, position, phone, adminKode, requestedAt: new Date().toISOString() };
                    const blob = new Blob([JSON.stringify(joinRequest, null, 2)], { type: 'application/json' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `permintaan_akun_${email}.json`;
                    a.click();
                    alert(`Registrasi berhasil! Kami sudah mengirim email verifikasi ke ${email} — buka dan klik link-nya terlebih dahulu.\n\nFile "Permintaan Akun" otomatis terunduh — kirim file ini ke Admin proyek (via WA/Email) agar Admin bisa meng-importnya dan menyetujui akun Anda setelah email diverifikasi.`);
                } else {
                    alert(role === 'Admin'
                        ? `Registrasi Admin berhasil! Kami sudah mengirim email verifikasi ke ${email} — buka dan klik link-nya sebelum login.`
                        : `Registrasi berhasil! Kami sudah mengirim email verifikasi ke ${email} — buka dan klik link-nya, lalu tunggu persetujuan Admin.`);
                }

                // Kembalikan sesi ke anonim (bukan akun baru ini) supaya user diarahkan ke layar login seperti biasa.
                await reauthAnonymously();
                toggleAuthTab('login');
            } catch (err) {
                alert(mapFirebaseAuthError(err));
            } finally {
                setBtnLoading(btn, false, '<i class="fa-solid fa-user-plus mr-1"></i> Daftar Akun Baru');
            }
        }

        // Admin: import file "Permintaan Akun" yang dikirim oleh User baru, lalu masukkan ke daftar Pending
        function handleImportJoinRequest(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
                try {
                    const req = JSON.parse(evt.target.result);
                    if (users.some(u => u.email === req.email)) {
                        alert('User dengan email tersebut sudah ada di daftar akun.');
                        return;
                    }
                    users.push({
                        id: req.id || ('USR-' + Date.now()),
                        name: req.name, email: req.email, pass: req.pass, role: req.role || 'User',
                        position: req.position, phone: req.phone, adminKode: req.adminKode || null,
                        status: 'Pending', canEdit: true, photo: ''
                    });
                    localStorage.setItem('erp_users', JSON.stringify(users));
                    alert(`Permintaan akun dari ${req.name} berhasil diimpor. Silakan setujui di daftar Persetujuan Akun.`);
                    openAdminApprovalModal();
                } catch (err) {
                    alert('File permintaan akun tidak valid.');
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        }

        async function handleLogout() {
            currentUser = null;
            sessionStorage.removeItem('erp_current_user');
            await reauthAnonymously();
            checkAuthStatus();
        }

        function updateUserHeaderUI() {
            if (!currentUser) return;
            document.getElementById('headerUserName').innerText = currentUser.name;
            document.getElementById('headerUserRole').innerText = currentUser.position + ' (' + currentUser.role + ')';
            const avatar = document.getElementById('headerUserAvatar');
            if (currentUser.photo) {
                avatar.innerHTML = `<img src="${currentUser.photo}" class="w-full h-full object-cover">`;
            } else {
                avatar.innerText = currentUser.name.substring(0, 2).toUpperCase();
            }

            if (currentUser.role === 'Admin') {
                document.getElementById('btnAdminApproval').classList.remove('hidden');
            } else {
                document.getElementById('btnAdminApproval').classList.add('hidden');
            }

            // Sync user profile section
            document.getElementById('profInputName').value = currentUser.name;
            document.getElementById('profInputPosition').value = currentUser.position;
            document.getElementById('profInputEmail').value = currentUser.email;
            document.getElementById('profInputPhone').value = currentUser.phone;
            document.getElementById('profNameTitle').innerText = currentUser.name;
            document.getElementById('profRoleTitle').innerText = currentUser.position;
            const profDataAcc = document.getElementById('profDataProjectAccount');
            if (profDataAcc) profDataAcc.innerText = currentUser.email;
            const bigAv = document.getElementById('profAvatarBig');
            if (currentUser.photo) {
                bigAv.innerHTML = `<img src="${currentUser.photo}" class="w-full h-full object-cover">`;
            } else {
                bigAv.innerText = currentUser.name.substring(0, 2).toUpperCase();
            }
        }

        // Menyembunyikan/mengunci fitur-fitur yang hanya boleh diakses Admin (full akses),
        // sedangkan akun User hanya mendapat akses terbatas / lihat-saja.
        function applyRoleBasedUI() {
            if (!currentUser) return;
            const admin = isAdminUser();

            // --- Kelola Proyek: hanya Admin yang boleh edit/hapus proyek ---
            const btnEditProject = document.getElementById('btnEditProject');
            const btnDeleteProject = document.getElementById('btnDeleteProject');
            if (btnEditProject) btnEditProject.classList.toggle('hidden', !admin);
            if (btnDeleteProject) btnDeleteProject.classList.toggle('hidden', !admin);
            const btnAddProjectLabel = document.getElementById('btnAddProjectLabel');
            if (btnAddProjectLabel) btnAddProjectLabel.innerText = admin ? 'Proyek Baru' : 'Gabung Proyek';

            // --- Halaman RAB: User hanya boleh melihat & export, tidak boleh edit ---
            const rabFormCard = document.getElementById('rabFormCard');
            const btnRabImportExcel = document.getElementById('btnRabImportExcel');
            const rabReadOnlyNotice = document.getElementById('rabReadOnlyNotice');
            const rabPpnInput = document.getElementById('rabPpnInput');
            const rabPphInput = document.getElementById('rabPphInput');
            const rabTambahanLabel = document.getElementById('rabTambahanLabel');
            const rabTambahanPersen = document.getElementById('rabTambahanPersen');
            if (rabFormCard) rabFormCard.classList.toggle('hidden', !admin);
            if (btnRabImportExcel) btnRabImportExcel.classList.toggle('hidden', !admin);
            if (rabReadOnlyNotice) rabReadOnlyNotice.classList.toggle('hidden', admin);
            if (rabPpnInput) rabPpnInput.disabled = !admin;
            if (rabPphInput) rabPphInput.disabled = !admin;
            if (rabTambahanLabel) rabTambahanLabel.disabled = !admin;
            if (rabTambahanPersen) rabTambahanPersen.disabled = !admin;

            // --- Halaman RAB CCO: User hanya boleh melihat, tidak boleh tambah/ubah/hapus CCO ---
            const rabCcoReadOnlyNotice = document.getElementById('rabCcoReadOnlyNotice');
            const btnAddRabCco = document.getElementById('btnAddRabCco');
            const btnDeleteRabCco = document.getElementById('btnDeleteRabCco');
            const btnSaveRabCco = document.getElementById('btnSaveRabCco');
            const btnAddRabCcoBaru = document.getElementById('btnAddRabCcoBaru');
            if (rabCcoReadOnlyNotice) rabCcoReadOnlyNotice.classList.toggle('hidden', admin);
            if (btnAddRabCco) btnAddRabCco.classList.toggle('hidden', !admin);
            if (btnDeleteRabCco) btnDeleteRabCco.classList.toggle('hidden', !admin);
            if (btnSaveRabCco) btnSaveRabCco.classList.toggle('hidden', !admin);
            if (btnAddRabCcoBaru) btnAddRabCcoBaru.classList.toggle('hidden', !admin);

            // --- Laporan Keuangan: User hanya boleh melihat, tidak boleh tambah/ubah/hapus pembayaran ---
            const payReadOnlyNotice = document.getElementById('payReadOnlyNotice');
            const payFormBox = document.getElementById('payFormBox');
            if (payReadOnlyNotice) payReadOnlyNotice.classList.toggle('hidden', admin);
            if (payFormBox) payFormBox.classList.toggle('hidden', !admin);

            // --- Data Karyawan: halaman ini hanya ada untuk Admin ---
            const menuKaryawan = document.getElementById('menu-data-karyawan');
            if (menuKaryawan) menuKaryawan.classList.toggle('hidden', !admin);
            // Jika akun User sedang berada di halaman Data Karyawan (mis. sesi lama), alihkan ke RAB.
            if (!admin && currentTab === 'data-karyawan') {
                switchTab('rab');
            }

            // --- Absen Manual: halaman ini hanya ada untuk Admin ---
            const menuAbsenManual = document.getElementById('menu-absen-manual');
            if (menuAbsenManual) menuAbsenManual.classList.toggle('hidden', !admin);
            // Jika akun User sedang berada di halaman Absen Manual (mis. sesi lama), alihkan ke RAB.
            if (!admin && currentTab === 'absen-manual') {
                switchTab('rab');
            }
        }

        function checkAdminPendingCount() {
            if (!currentUser) return;
            const myKodes = projects.filter(p => p.ownerId === currentUser.id).map(p => p.kode);
            const pending = users.filter(u => u.role === 'User' && u.status === 'Pending' && u.adminKode && myKodes.includes(u.adminKode)).length;
            document.getElementById('pendingUserBadge').innerText = pending;
        }

        // ===================================================================
        // PROJECT MANAGEMENT
