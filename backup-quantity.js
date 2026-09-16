        // Setiap item pekerjaan RAB (judul: rincian, satuan, volume) dapat memiliki
        // banyak baris hitungan opname (segmen/ruangan/posisi) PER MINGGU, masing-masing dengan
        // metode input sendiri (volume/luas/panjang/satuan, memakai koefisien), serta
        // bertipe Tambah atau Kurang (deduction). Baris bisa diedit, dihapus, & diurutkan naik/turun.
        // Rincian hasil opname ditampilkan sebagai daftar SELURUH item pekerjaan RAB (No/Divisi/Sub/Rincian)
        // per minggu terpilih, sehingga terlihat mana yang sudah/belum diopname. Hasil opname bersih per
        // minggu otomatis disinkronkan ke Laporan Mingguan (lapMingguanData) berdasarkan rabId + mingguKe.
        // ===================================================================
        let bqOpnameSelectedPekerjaanId = null; // item RAB yang sedang dibuka detail opname-nya (null = daftar saja)
        let bqOpnameSelectedMinggu = 'Minggu 1';
        let bqOpEditRowId = null;

        const BQ_OPNAME_METODE = {
            plt: {
                label: 'Jumlah × Panjang × Lebar × Tinggi/Tebal × Koefisien (Volume Balok/Kotak)',
                fields: ['jumlah', 'panjang', 'lebar', 'tinggi', 'koefisien'],
                labels: { jumlah: 'Jumlah', panjang: 'Panjang (m)', lebar: 'Lebar (m)', tinggi: 'Tinggi/Tebal (m)', koefisien: 'Koefisien' }
            },
            pl: {
                label: 'Jumlah × Panjang × Lebar × Koefisien (Luas Persegi/Segiempat)',
                fields: ['jumlah', 'panjang', 'lebar', 'koefisien'],
                labels: { jumlah: 'Jumlah', panjang: 'Panjang (m)', lebar: 'Lebar (m)', koefisien: 'Koefisien' }
            },
            p: {
                label: 'Jumlah × Panjang × Koefisien (Panjang / Keliling Lurus)',
                fields: ['jumlah', 'panjang', 'koefisien'],
                labels: { jumlah: 'Jumlah', panjang: 'Panjang (m)', koefisien: 'Koefisien' }
            },
            jml: {
                label: 'Jumlah × Koefisien (Satuan / Unit / Titik)',
                fields: ['jumlah', 'koefisien'],
                labels: { jumlah: 'Jumlah (unit/titik/buah)', koefisien: 'Koefisien' }
            },
            langsung: {
                label: 'Volume / Nilai Langsung (Manual) × Koefisien',
                fields: ['jumlah', 'koefisien'],
                labels: { jumlah: 'Nilai / Volume Terukur', koefisien: 'Koefisien' }
            },
            // ==== Metode bentuk BULAT/LINGKARAN (kolom bulat, pipa, bore pile, dsb) ====
            bulatLuas: {
                label: 'Jumlah × (π/4 × Diameter²) × Koefisien (Luas Penampang Bulat)',
                fields: ['jumlah', 'diameter', 'koefisien'],
                labels: { jumlah: 'Jumlah', diameter: 'Diameter (m)', koefisien: 'Koefisien' },
                calc: v => (v.jumlah || 0) * (Math.PI / 4) * Math.pow(v.diameter || 0, 2) * (v.koefisien ?? 1),
                formula: row => `${formatAngka(row.jumlah)} × (π/4 × ${formatAngka(row.diameter)}²) × ${formatAngka(row.koefisien)}`
            },
            bulatVolume: {
                label: 'Jumlah × (π/4 × Diameter²) × Tinggi × Koefisien (Volume Tabung/Kolom Bulat/Bore Pile)',
                fields: ['jumlah', 'diameter', 'tinggi', 'koefisien'],
                labels: { jumlah: 'Jumlah', diameter: 'Diameter (m)', tinggi: 'Tinggi/Kedalaman (m)', koefisien: 'Koefisien' },
                calc: v => (v.jumlah || 0) * (Math.PI / 4) * Math.pow(v.diameter || 0, 2) * (v.tinggi || 0) * (v.koefisien ?? 1),
                formula: row => `${formatAngka(row.jumlah)} × (π/4 × ${formatAngka(row.diameter)}²) × ${formatAngka(row.tinggi)} × ${formatAngka(row.koefisien)}`
            },
            bulatKeliling: {
                label: 'Jumlah × (π × Diameter) × Koefisien (Keliling Lingkaran)',
                fields: ['jumlah', 'diameter', 'koefisien'],
                labels: { jumlah: 'Jumlah', diameter: 'Diameter (m)', koefisien: 'Koefisien' },
                calc: v => (v.jumlah || 0) * Math.PI * (v.diameter || 0) * (v.koefisien ?? 1),
                formula: row => `${formatAngka(row.jumlah)} × (π × ${formatAngka(row.diameter)}) × ${formatAngka(row.koefisien)}`
            },
            bulatSelimut: {
                label: 'Jumlah × (π × Diameter) × Tinggi × Koefisien (Luas Selimut Tabung/Kolom Bulat - mis. cat/plester)',
                fields: ['jumlah', 'diameter', 'tinggi', 'koefisien'],
                labels: { jumlah: 'Jumlah', diameter: 'Diameter (m)', tinggi: 'Tinggi (m)', koefisien: 'Koefisien' },
                calc: v => (v.jumlah || 0) * Math.PI * (v.diameter || 0) * (v.tinggi || 0) * (v.koefisien ?? 1),
                formula: row => `${formatAngka(row.jumlah)} × (π × ${formatAngka(row.diameter)}) × ${formatAngka(row.tinggi)} × ${formatAngka(row.koefisien)}`
            },
            // ==== Metode bentuk TRAPESIUM (galian tanah/saluran/timbunan berkemiringan) ====
            trapesium: {
                label: 'Jumlah × ((Lebar Atas + Lebar Bawah)/2) × Tinggi × Panjang × Koefisien (Volume Trapesium - Galian/Saluran)',
                fields: ['jumlah', 'lebarAtas', 'lebarBawah', 'tinggi', 'panjang', 'koefisien'],
                labels: { jumlah: 'Jumlah', lebarAtas: 'Lebar Atas (m)', lebarBawah: 'Lebar Bawah (m)', tinggi: 'Tinggi/Kedalaman (m)', panjang: 'Panjang (m)', koefisien: 'Koefisien' },
                calc: v => (v.jumlah || 0) * (((v.lebarAtas || 0) + (v.lebarBawah || 0)) / 2) * (v.tinggi || 0) * (v.panjang || 0) * (v.koefisien ?? 1),
                formula: row => `${formatAngka(row.jumlah)} × ((${formatAngka(row.lebarAtas)}+${formatAngka(row.lebarBawah)})/2) × ${formatAngka(row.tinggi)} × ${formatAngka(row.panjang)} × ${formatAngka(row.koefisien)}`
            },
            // ==== Metode bentuk SEGITIGA (atap pelana, talud, dsb) ====
            segitiga: {
                label: 'Jumlah × (0.5 × Alas × Tinggi) × Panjang × Koefisien (Volume Segitiga - Atap/Talud)',
                fields: ['jumlah', 'alas', 'tinggi', 'panjang', 'koefisien'],
                labels: { jumlah: 'Jumlah', alas: 'Alas (m)', tinggi: 'Tinggi (m)', panjang: 'Panjang (m)', koefisien: 'Koefisien' },
                calc: v => (v.jumlah || 0) * 0.5 * (v.alas || 0) * (v.tinggi || 0) * (v.panjang || 0) * (v.koefisien ?? 1),
                formula: row => `${formatAngka(row.jumlah)} × (0.5×${formatAngka(row.alas)}×${formatAngka(row.tinggi)}) × ${formatAngka(row.panjang)} × ${formatAngka(row.koefisien)}`
            },
            // ==== Metode BERAT (besi beton, pipa, baja profil - dihitung dari berat per meter) ====
            berat: {
                label: 'Jumlah × Panjang × Berat per Meter × Koefisien (Berat - Besi/Pipa/Baja)',
                fields: ['jumlah', 'panjang', 'beratSatuan', 'koefisien'],
                labels: { jumlah: 'Jumlah (batang)', panjang: 'Panjang (m)', beratSatuan: 'Berat per Meter (kg/m)', koefisien: 'Koefisien' },
                calc: v => (v.jumlah || 0) * (v.panjang || 0) * (v.beratSatuan || 0) * (v.koefisien ?? 1),
                formula: row => `${formatAngka(row.jumlah)} × ${formatAngka(row.panjang)} × ${formatAngka(row.beratSatuan)} kg/m × ${formatAngka(row.koefisien)}`
            }
        };
        const BQ_OPNAME_ALL_FIELDS = ['jumlah', 'panjang', 'lebar', 'tinggi', 'diameter', 'lebarAtas', 'lebarBawah', 'alas', 'beratSatuan', 'koefisien'];
        const BQ_OPNAME_FIELD_ICON = {
            jumlah: 'fa-hashtag', panjang: 'fa-ruler-horizontal', lebar: 'fa-ruler-vertical', tinggi: 'fa-cube',
            diameter: 'fa-circle-notch', lebarAtas: 'fa-ruler-vertical', lebarBawah: 'fa-ruler-vertical',
            alas: 'fa-ruler-horizontal', beratSatuan: 'fa-weight-hanging', koefisien: 'fa-percent'
        };

        // Menampilkan input field sesuai metode yang dipilih (field yang tidak relevan disembunyikan, bukan dihapus, agar nilai tidak hilang saat ganti-ganti metode)
        function renderBqOpnameFormFields() {
            const metode = document.getElementById('bqOpMetode').value;
            const cfg = BQ_OPNAME_METODE[metode];
            const container = document.getElementById('bqOpFieldsContainer');
            if (!container) return;
            if (!container.dataset.built) {
                container.innerHTML = BQ_OPNAME_ALL_FIELDS.map(f => `
                    <div id="bqOpWrap_${f}">
                        <label class="block text-slate-400 mb-1"><i class="fa-solid ${BQ_OPNAME_FIELD_ICON[f]} mr-1 text-amber-400"></i><span id="bqOpLabel_${f}">${f}</span></label>
                        <input type="number" step="any" id="bqOp_${f}" value="${f === 'koefisien' ? '1' : ''}" class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-white">
                    </div>
                `).join('');
                container.dataset.built = '1';
            }
            BQ_OPNAME_ALL_FIELDS.forEach(f => {
                const wrap = document.getElementById('bqOpWrap_' + f);
                const input = document.getElementById('bqOp_' + f);
                if (!wrap || !input) return;
                if (cfg.fields.includes(f)) {
                    wrap.classList.remove('hidden');
                    document.getElementById('bqOpLabel_' + f).innerText = cfg.labels[f] || f;
                    input.required = true;
                } else {
                    wrap.classList.add('hidden');
                    input.required = false;
                }
            });
            updateBqOpnameFormulaPreview();
        }

        function bqOpnameReadFormValues() {
            const metode = document.getElementById('bqOpMetode').value;
            const cfg = BQ_OPNAME_METODE[metode];
            const vals = {};
            BQ_OPNAME_ALL_FIELDS.forEach(f => {
                const input = document.getElementById('bqOp_' + f);
                vals[f] = input ? (parseFloat(input.value) || 0) : 0;
            });
            return { metode, cfg, vals };
        }

        // Hitung volume 1 baris opname sesuai metode. Metode dengan rumus khusus (bukan sekadar perkalian
        // lurus semua field, mis. bentuk bulat/lingkaran, trapesium, segitiga, berat) memakai cfg.calc();
        // metode lama (persegi/balok/panjang/satuan/manual) tetap memakai perkalian generik seperti semula.
        function computeBqOpnameVolume(metode, vals) {
            const cfg = BQ_OPNAME_METODE[metode];
            if (!cfg) return 0;
            if (typeof cfg.calc === 'function') return cfg.calc(vals);
            let result = 1;
            cfg.fields.forEach(f => { result *= (Number(vals[f]) || 0); });
            return result;
        }

        function bqOpnameFormulaText(row) {
            const cfg = BQ_OPNAME_METODE[row.metode];
            if (!cfg) return '';
            const lhs = typeof cfg.formula === 'function' ? cfg.formula(row) : cfg.fields.map(f => `${formatAngka(row[f])}`).join(' × ');
            return `${lhs} = <span class="font-bold text-white">${formatAngka(row.volume)}</span>`;
        }

        function updateBqOpnameFormulaPreview() {
            const el = document.getElementById('bqOpFormulaPreview');
            if (!el) return;
            const { metode, vals } = bqOpnameReadFormValues();
            const volume = computeBqOpnameVolume(metode, vals);
            const rab = rabData.find(r => r.id == bqOpnameSelectedPekerjaanId);
            let html = `Hasil Volume: ${formatAngka(volume)} ${rab ? rab.satuan : ''}`;

            // Peringatan real-time (sebelum baris ini disimpan): kalau tipe & angka yang sedang diketik akan
            // membuat total volume opname item ini melebihi Volume Kontrak RAB, tampilkan catatan peringatan
            // di bawah preview supaya user langsung sadar sebelum menekan tombol simpan.
            if (rab && rab.volume > 0) {
                const tipeSel = document.getElementById('bqOpTipe');
                const tipe = tipeSel ? tipeSel.value : 'tambah';
                const weekNum = parseInt((bqOpnameSelectedMinggu || '').replace(/\D/g, ''), 10) || 1;
                const volLalu = bqOpnameNetVolumeCumulative(bqOpnameSelectedPekerjaanId, weekNum);
                const siblingRows = bqOpnameData.filter(o => o.pekerjaanId == bqOpnameSelectedPekerjaanId && o.mingguKe === bqOpnameSelectedMinggu && o.id !== bqOpEditRowId);
                const editingRow = bqOpEditRowId ? bqOpnameData.find(o => o.id === bqOpEditRowId) : null;
                const simulatedRow = editingRow ? { ...editingRow, tipe, volume } : { tipe, volume };
                const volIniSimulasi = [...siblingRows, simulatedRow].reduce((a, r) => a + bqOpnameRowNetContribution(r), 0);
                const volKumSimulasi = volLalu + volIniSimulasi;
                if (volKumSimulasi > rab.volume + 0.0001) {
                    const selisih = volKumSimulasi - rab.volume;
                    html += `<div class="text-red-400 font-sans mt-1"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Peringatan: total volume opname akan jadi ${formatAngka(volKumSimulasi)} ${rab.satuan}, melebihi Volume Kontrak RAB (${formatAngka(rab.volume)} ${rab.satuan}) sebesar ${formatAngka(selisih)} ${rab.satuan}.</div>`;
                }
            }
            el.innerHTML = html;
        }

        // Buka area detail input opname untuk 1 item pekerjaan RAB tertentu, pada minggu yang sedang dipilih.
        function openBqOpnameDetail(rabId) {
            bqOpnameSelectedPekerjaanId = rabId;
            bqOpEditRowId = null;
            const detailArea = document.getElementById('bqOpDetailArea');
            detailArea.classList.remove('hidden');
            document.getElementById('formBqOpname').reset();
            document.getElementById('bqOpEditId').value = '';
            cancelBqOpnameEdit();
            renderBqOpnameFormFields();
            // Sinkronkan seluruh rantai minggu 2 s/d minggu terpilih, supaya baris hasil salinan yang belum
            // diedit selalu mengikuti kondisi terbaru dari minggu-minggu sebelumnya.
            bqOpnameReconcileChain(rabId, bqOpnameSelectedMinggu);
            renderBqOpnameDetail();
            renderBqOpnameMaster();
            detailArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // Tutup area detail & kembali ke daftar rincian per item pekerjaan.
        function closeBqOpnameDetail() {
            bqOpnameSelectedPekerjaanId = null;
            bqOpEditRowId = null;
            document.getElementById('bqOpDetailArea').classList.add('hidden');
        }

        // Kontribusi bersih 1 baris opname terhadap "Opname Minggu Ini". Untuk baris yang DIKETIK MANUAL
        // minggu ini (bukan hasil salin), kontribusinya = nilai baris itu sendiri (Tambah positif, Kurang
        // negatif) - seperti biasa. Untuk baris hasil SALINAN OTOMATIS dari minggu lalu, kontribusinya HANYA
        // SELISIH antara nilai sekarang dengan nilai asli saat disalin (`disalinBaselineNet`) - jadi selama
        // baris salinan itu belum diubah sama sekali, kontribusinya 0 (tidak perlu dihapus manual satu-satu
        // supaya "Opname Minggu Ini" balik ke 0). Begitu nilainya diedit (ditambah/dikurangi/diganti tipe),
        // hanya bagian PERUBAHANNYA yang otomatis masuk sebagai progres opname minggu ini.
        function bqOpnameRowNetContribution(row) {
            const currentNet = (row.tipe === 'kurang' ? -1 : 1) * (Number(row.volume) || 0);
            if (row.disalinDariMinggu && typeof row.disalinBaselineNet === 'number') {
                return currentNet - row.disalinBaselineNet;
            }
            return currentNet;
        }

        // Total opname bersih (Tambah - Kurang, sudah memperhitungkan aturan baris salinan di atas)
        // untuk 1 item pekerjaan RAB pada 1 minggu tertentu.
        function bqOpnameNetVolumeForWeek(rabId, mingguKe) {
            const rows = bqOpnameData.filter(o => o.pekerjaanId == rabId && o.mingguKe === mingguKe);
            return rows.reduce((a, c) => a + bqOpnameRowNetContribution(c), 0);
        }

        // Total opname bersih kumulatif untuk 1 item pekerjaan RAB dari Minggu 1 s/d sebelum `beforeWeekNum`
        // (beforeWeekNum tidak diikutkan). Kalau beforeWeekNum tidak diisi, hitung SELURUH minggu.
        // Dihitung dengan MENJUMLAHKAN bqOpnameNetVolumeForWeek tiap minggu (bukan menjumlah baris mentah),
        // supaya baris hasil salin-otomatis (lihat bqOpnameReconcileCarriedRows) tidak ikut terhitung dobel -
        // karena baris salinan yang belum diedit sudah otomatis bernilai kontribusi 0 di minggu asalnya.
        function bqOpnameNetVolumeCumulative(rabId, beforeWeekNum) {
            // Minggu 1 tidak punya "minggu sebelumnya", jadi Volume/Opname Minggu Lalu WAJIB 0 -
            // berapa pun/apa pun data opname yang ada, tidak boleh ada yang dihitung sebagai "sebelum Minggu 1".
            if (beforeWeekNum !== undefined && beforeWeekNum <= 1) return 0;
            const weekNumsWithData = new Set();
            bqOpnameData.forEach(o => {
                if (o.pekerjaanId != rabId) return;
                const wk = parseInt((o.mingguKe || '').replace(/\D/g, ''), 10);
                // Baris opname dengan minggu tidak valid/kosong tidak dianggap milik minggu manapun,
                // jadi tidak boleh ikut ke-hitung sebagai volume "minggu lalu".
                if (!wk || wk < 1) return;
                if (beforeWeekNum !== undefined && wk >= beforeWeekNum) return;
                weekNumsWithData.add(wk);
            });
            let total = 0;
            weekNumsWithData.forEach(wk => { total += bqOpnameNetVolumeForWeek(rabId, `Minggu ${wk}`); });
            return total;
        }

        // Cari minggu TERDEKAT sebelum `weekNum` (tidak harus persis weekNum-1, bisa lompat kalau ada minggu
        // yang dilewati) yang SUDAH punya baris opname untuk 1 item pekerjaan RAB tertentu. Dipakai untuk fitur
        // "lanjutkan dari minggu lalu" supaya tetap bisa menemukan data terakhir walau user melompati minggu.
        function bqOpnameFindPrevWeekWithData(rabId, weekNum) {
            for (let w = weekNum - 1; w >= 1; w--) {
                if (bqOpnameData.some(o => o.pekerjaanId == rabId && o.mingguKe === `Minggu ${w}`)) return w;
            }
            return null;
        }

        // Kunci penanda 1 kombinasi (item pekerjaan, minggu) di bqOpnameTouchedWeeks.
        function bqOpnameWeekKey(rabId, mingguKe) { return `${rabId}::${mingguKe}`; }

        // Tandai 1 kombinasi (item pekerjaan, minggu) sebagai "sudah pernah disentuh" (dipakai utk riwayat,
        // tidak lagi menggerbangi sinkronisasi carry - lihat bqOpnameReconcileCarriedRows di bawah).
        function bqOpnameMarkWeekTouched(rabId, mingguKe) {
            const key = bqOpnameWeekKey(rabId, mingguKe);
            if (!bqOpnameTouchedWeeks.includes(key)) {
                bqOpnameTouchedWeeks.push(key);
                localStorage.setItem('erp_bq_opname_touched', JSON.stringify(bqOpnameTouchedWeeks));
            }
        }

        function bqOpnameIsWeekTouched(rabId, mingguKe) {
            if (bqOpnameData.some(o => o.pekerjaanId == rabId && o.mingguKe === mingguKe)) return true;
            return bqOpnameTouchedWeeks.includes(bqOpnameWeekKey(rabId, mingguKe));
        }

        // Sinkronkan baris hasil-salinan (yang BELUM PERNAH DIEDIT sama sekali) pada 1 minggu, supaya selalu
        // mengikuti kondisi TERBARU dari minggu sebelumnya terdekat - inilah perbaikan utamanya: dulu
        // penyalinan cuma terjadi SEKALI (saat minggu itu pertama dibuka), jadi kalau minggu sebelumnya
        // diubah/ditambah/dikurangi BELAKANGAN, minggu-minggu sesudahnya tidak ikut update. Sekarang setiap
        // minggu dibuka, baris salinannya di-refresh ulang dari sumbernya:
        //  - Baris di minggu sebelumnya yang BELUM punya salinan di minggu ini -> disalin sekarang (baru).
        //  - Baris salinan di minggu ini yang SUMBER-nya berubah & baris itu SENDIRI belum pernah diedit ->
        //    ikut diperbarui otomatis (id baris tetap sama, tidak dibuat baris baru).
        //  - Baris salinan di minggu ini yang sumbernya sudah DIHAPUS di minggu sebelumnya & baris itu
        //    SENDIRI belum pernah diedit -> ikut terhapus otomatis.
        //  - Baris yang SUDAH DIEDIT (nilainya sudah beda dari saat pertama disalin) ATAU baris yang diketik
        //    manual (bukan hasil salinan) TIDAK PERNAH disentuh oleh sinkronisasi ini - tetap seperti apa
        //    adanya, supaya perubahan yang sengaja dibuat khusus untuk minggu itu tidak hilang/tertimpa.
        function bqOpnameReconcileCarriedRows(rabId, mingguKe) {
            const weekNum = parseInt((mingguKe || '').replace(/\D/g, ''), 10) || 1;
            if (weekNum <= 1) return false; // Minggu 1 tidak punya minggu sebelumnya untuk disinkron
            const prevWeekNum = bqOpnameFindPrevWeekWithData(rabId, weekNum);
            const sourceRows = prevWeekNum !== null
                ? bqOpnameData.filter(o => o.pekerjaanId == rabId && o.mingguKe === `Minggu ${prevWeekNum}`)
                : [];
            let changed = false;

            // 1) Perbarui baris salinan yang belum diedit, atau salin baris baru dari sumber yang belum ada di sini
            sourceRows.forEach((src, idx) => {
                let mirrorIdx = bqOpnameData.findIndex(o => o.pekerjaanId == rabId && o.mingguKe === mingguKe && o.sourceRowId === src.id);
                // PENTING (perbaikan bug duplikat): baris hasil salinan dari versi sebelum fitur sinkronisasi
                // berantai ini ada, belum punya penanda `sourceRowId` sama sekali. Kalau hanya dicocokkan
                // lewat sourceRowId, baris lama itu tidak akan pernah "ketemu" sebagai salinan yang sudah ada
                // - akibatnya baris baru terus dibuat lagi di atasnya setiap kali halaman dibuka, jadi
                // dobel/tergandakan. Jadi kalau pencocokan by sourceRowId gagal, dicoba lagi dicocokkan lewat
                // kombinasi "berasal dari minggu yang sama" + "nama segmen sama persis" (case-insensitive) -
                // begitu ketemu, baris lama itu langsung diberi sourceRowId supaya ke depannya stabil & tidak
                // pernah dobel lagi.
                if (mirrorIdx === -1) {
                    mirrorIdx = bqOpnameData.findIndex(o => o.pekerjaanId == rabId && o.mingguKe === mingguKe && !o.sourceRowId
                        && o.disalinDariMinggu === prevWeekNum
                        && (o.segmen || '').toString().trim().toLowerCase() === (src.segmen || '').toString().trim().toLowerCase());
                    if (mirrorIdx !== -1) { bqOpnameData[mirrorIdx].sourceRowId = src.id; changed = true; }
                }
                if (mirrorIdx !== -1) {
                    const mirror = bqOpnameData[mirrorIdx];
                    const belumDiedit = Math.abs(bqOpnameRowNetContribution(mirror)) < 0.0001;
                    if (belumDiedit) {
                        const baselineNet = (src.tipe === 'kurang' ? -1 : 1) * (Number(src.volume) || 0);
                        const sama = mirror.segmen === src.segmen && mirror.tipe === src.tipe && mirror.metode === src.metode
                            && Math.abs((mirror.volume || 0) - (src.volume || 0)) < 0.0001 && (mirror.catatan || '') === (src.catatan || '');
                        if (!sama) {
                            bqOpnameData[mirrorIdx] = {
                                ...mirror,
                                segmen: src.segmen, tipe: src.tipe, metode: src.metode,
                                jumlah: src.jumlah, panjang: src.panjang, lebar: src.lebar, tinggi: src.tinggi,
                                diameter: src.diameter, lebarAtas: src.lebarAtas, lebarBawah: src.lebarBawah,
                                alas: src.alas, beratSatuan: src.beratSatuan, koefisien: src.koefisien,
                                volume: src.volume, catatan: src.catatan,
                                disalinDariMinggu: prevWeekNum, disalinBaselineNet: baselineNet
                            };
                            changed = true;
                        }
                    }
                } else {
                    const baselineNet = (src.tipe === 'kurang' ? -1 : 1) * (Number(src.volume) || 0);
                    bqOpnameData.push({
                        ...src,
                        id: Date.now() + idx + Math.random(),
                        order: idx + 1,
                        mingguKe: mingguKe,
                        sourceRowId: src.id,
                        disalinDariMinggu: prevWeekNum,
                        disalinBaselineNet: baselineNet
                    });
                    changed = true;
                }
            });

            // 1.5) Bersihkan duplikat LAMA (peninggalan dari sebelum fitur sourceRowId ada): kalau di minggu
            // ini ternyata ada LEBIH DARI SATU baris untuk minggu-sumber & nama segmen yang sama persis, dan
            // semuanya masih pristine/belum diedit, cuma SATU yang dipertahankan (diutamakan yang sudah resmi
            // ditandai sourceRowId dari langkah di atas) - sisanya dihapus supaya tidak dobel.
            const dupGroups = {};
            bqOpnameData.forEach(o => {
                if (o.pekerjaanId != rabId || o.mingguKe !== mingguKe || o.disalinDariMinggu !== prevWeekNum) return;
                if (Math.abs(bqOpnameRowNetContribution(o)) >= 0.0001) return; // sudah diedit -> jangan disentuh
                const key = (o.segmen || '').toString().trim().toLowerCase();
                (dupGroups[key] = dupGroups[key] || []).push(o);
            });
            const idsToRemove = new Set();
            Object.values(dupGroups).forEach(group => {
                if (group.length <= 1) return;
                const keep = group.find(o => o.sourceRowId) || group[0];
                group.forEach(o => { if (o !== keep) idsToRemove.add(o.id); });
            });
            if (idsToRemove.size > 0) {
                bqOpnameData = bqOpnameData.filter(o => !idsToRemove.has(o.id));
                changed = true;
            }

            // 2) Hapus baris salinan yang sumbernya sudah tidak ada lagi di minggu sebelumnya,
            //    TAPI hanya kalau baris itu sendiri belum pernah diedit sama sekali di minggu ini.
            const sourceIds = new Set(sourceRows.map(s => s.id));
            const before = bqOpnameData.length;
            bqOpnameData = bqOpnameData.filter(o => {
                if (o.pekerjaanId != rabId || o.mingguKe !== mingguKe || !o.sourceRowId) return true;
                const belumDiedit = Math.abs(bqOpnameRowNetContribution(o)) < 0.0001;
                return !(belumDiedit && !sourceIds.has(o.sourceRowId));
            });
            if (bqOpnameData.length !== before) changed = true;

            if (changed) {
                localStorage.setItem('erp_bq_opname', JSON.stringify(bqOpnameData));
                syncOpnameToLapMingguan(rabId, mingguKe);
            }
            return changed;
        }

        // Jalankan sinkronisasi berantai dari Minggu 2 s/d minggu yang sedang dituju, secara berurutan -
        // supaya perubahan di Minggu 1 ikut merambat ke Minggu 2, lalu hasil Minggu 2 yang sudah ter-update
        // ikut merambat ke Minggu 3, dan seterusnya, sampai minggu yang sedang dibuka benar-benar mengikuti
        // kondisi TERBARU dari seluruh rantai minggu sebelumnya (bukan cuma minggu tepat sebelumnya saja).
        function bqOpnameReconcileChain(rabId, uptoMingguKe) {
            const uptoWeekNum = parseInt((uptoMingguKe || '').replace(/\D/g, ''), 10) || 1;
            let anyChanged = false;
            for (let w = 2; w <= uptoWeekNum; w++) {
                if (bqOpnameReconcileCarriedRows(rabId, `Minggu ${w}`)) anyChanged = true;
            }
            return anyChanged;
        }

        // Sinkronkan hasil opname bersih 1 item pekerjaan pada 1 minggu ke Laporan Mingguan (upsert
        // berdasarkan rabId + mingguKe), supaya "Volume Minggu Ini" pada Laporan Mingguan otomatis
        // mengikuti hasil opname lapangan tanpa perlu input ulang manual.
        function syncOpnameToLapMingguan(rabId, mingguKe) {
            // Presisi penuh (tidak dibulatkan 2 desimal) supaya Bobot/Kurva S/Progress yang memakai
            // angka ini di halaman lain tetap sesuai dengan input asli, bukan angka yang sudah dipotong.
            const volumeBersih = bqOpnameNetVolumeForWeek(rabId, mingguKe);
            let entry = lapMingguanData.find(l => l.rabId == rabId && l.mingguKe === mingguKe);
            if (entry) {
                entry.volume = volumeBersih;
            } else {
                lapMingguanData.push({ id: Date.now() + Math.random(), projId: activeProjectId, rabId, mingguKe, volume: volumeBersih, keterangan: '' });
            }
            localStorage.setItem('erp_lap_mingguan', JSON.stringify(lapMingguanData));
            if (typeof currentTab !== 'undefined' && currentTab === 'lap-mingguan') renderLapMingguan();
        }

        function renderBqOpnameJudulInfo() {
            const infoEl = document.getElementById('bqOpJudulInfo');
            if (!infoEl) return;
            const rab = rabData.find(r => r.id == bqOpnameSelectedPekerjaanId);
            if (!rab) { infoEl.innerHTML = ''; return; }
            const selectedWeekNum = parseInt((bqOpnameSelectedMinggu || '').replace(/\D/g, ''), 10) || 1;
            const volLalu = bqOpnameNetVolumeCumulative(bqOpnameSelectedPekerjaanId, selectedWeekNum);
            const volIni = bqOpnameNetVolumeForWeek(bqOpnameSelectedPekerjaanId, bqOpnameSelectedMinggu);
            const volKum = volLalu + volIni;
            const selisih = volKum - rab.volume;
            const selisihColor = Math.abs(selisih) < 0.0001 ? 'text-emerald-400' : (selisih > 0 ? 'text-amber-300' : 'text-red-400');
            infoEl.innerHTML = `
                <div class="bg-[#0b132b] border border-slate-700 rounded-xl p-3 space-y-1">
                    <div class="text-white font-bold text-xs">[${rab.noDiv || '-'}] ${rab.div || ''} &raquo; ${rab.sub} &mdash; ${rab.rincian}</div>
                    <div class="text-amber-300 font-semibold text-[11px]"><i class="fa-solid fa-calendar-week mr-1"></i>${bqOpnameSelectedMinggu}</div>
                    <div class="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                        <span>Satuan: <span class="font-bold text-white">${rab.satuan}</span></span>
                        <span>Volume RAB: <span class="font-bold text-white">${formatAngka(rab.volume)} ${rab.satuan}</span></span>
                        <span>Opname Minggu Lalu: <span class="font-bold text-slate-300">${formatAngka(volLalu)} ${rab.satuan}</span></span>
                        <span>Opname Minggu Ini: <span class="font-bold text-amber-300">${formatAngka(volIni)} ${rab.satuan}</span></span>
                        <span>Opname Komulatif: <span class="font-bold text-sky-300">${formatAngka(volKum)} ${rab.satuan}</span></span>
                        <span>Selisih thd RAB: <span class="font-bold ${selisihColor}">${selisih > 0 ? '+' : ''}${formatAngka(selisih)} ${rab.satuan}</span></span>
                    </div>
                </div>`;
        }

        function handleBqOpnameSubmit(e) {
            e.preventDefault();
            if (!bqOpnameSelectedPekerjaanId) { alert('Pilih item pekerjaan RAB terlebih dahulu.'); return; }
            const { metode, vals } = bqOpnameReadFormValues();
            const volume = computeBqOpnameVolume(metode, vals);
            const segmen = document.getElementById('bqOpSegmen').value.trim();
            const tipe = document.getElementById('bqOpTipe').value;
            const catatan = document.getElementById('bqOpCatatan').value.trim();

            // Simpan volume hasil hitungan APA ADANYA (presisi penuh, tidak dibulatkan ke 2 desimal),
            // supaya rumus lain yang mengambil nilai ini (kumulatif, Laporan Mingguan, Bobot, Kurva S,
            // dll) memakai angka yang benar-benar sesuai input, bukan angka yang sudah terpotong jadi
            // 2 desimal seperti yang ditampilkan di tabel. Pembulatan 2 desimal HANYA untuk tampilan
            // (lihat formatAngka), tidak untuk data yang disimpan/dipakai hitung lebih lanjut.
            const rowValues = { segmen, tipe, metode, ...vals, catatan, volume: volume, mingguKe: bqOpnameSelectedMinggu };

            // PERINGATAN: kalau total volume opname (kumulatif s/d minggu ini, TERMASUK baris yang baru
            // disimpan ini) ternyata melebihi Volume Kontrak pada RAB item terkait, user diberi peringatan
            // dulu dan diminta konfirmasi - supaya kesalahan input (mis. salah ketik, satuan tertukar, atau
            // memang kelebihan volume riil di lapangan) tetap ketahuan sebelum datanya tersimpan, tapi tidak
            // memblokir total kalau memang user yakin ingin tetap menyimpannya (mis. ada pekerjaan tambah).
            const rabItemCek = rabData.find(r => r.id == bqOpnameSelectedPekerjaanId);
            if (rabItemCek && rabItemCek.volume > 0) {
                const weekNumCek = parseInt((bqOpnameSelectedMinggu || '').replace(/\D/g, ''), 10) || 1;
                const volLaluCek = bqOpnameNetVolumeCumulative(bqOpnameSelectedPekerjaanId, weekNumCek);
                const siblingRowsCek = bqOpnameData.filter(o => o.pekerjaanId == bqOpnameSelectedPekerjaanId && o.mingguKe === bqOpnameSelectedMinggu && o.id !== bqOpEditRowId);
                const volIniSimulasi = [...siblingRowsCek, rowValues].reduce((a, r) => a + bqOpnameRowNetContribution(r), 0);
                const volKumSimulasi = volLaluCek + volIniSimulasi;
                if (volKumSimulasi > rabItemCek.volume + 0.0001) {
                    const selisih = volKumSimulasi - rabItemCek.volume;
                    const lanjutkan = confirm(
                        `⚠️ PERINGATAN: Total volume opname untuk item ini akan menjadi ${formatAngka(volKumSimulasi)} ${rabItemCek.satuan}, ` +
                        `MELEBIHI Volume Kontrak RAB sebesar ${formatAngka(rabItemCek.volume)} ${rabItemCek.satuan} ` +
                        `(kelebihan ${formatAngka(selisih)} ${rabItemCek.satuan}).\n\nTetap simpan data ini?`
                    );
                    if (!lanjutkan) return;
                }
            }

            if (bqOpEditRowId) {
                const idx = bqOpnameData.findIndex(o => o.id === bqOpEditRowId);
                if (idx !== -1) bqOpnameData[idx] = { ...bqOpnameData[idx], ...rowValues };
            } else {
                const siblingOrders = bqOpnameData.filter(o => o.pekerjaanId == bqOpnameSelectedPekerjaanId && o.mingguKe === bqOpnameSelectedMinggu).map(o => o.order || 0);
                const nextOrder = siblingOrders.length ? Math.max(...siblingOrders) + 1 : 1;
                bqOpnameData.push({ id: Date.now(), pekerjaanId: bqOpnameSelectedPekerjaanId, order: nextOrder, ...rowValues });
            }
            localStorage.setItem('erp_bq_opname', JSON.stringify(bqOpnameData));
            bqOpnameMarkWeekTouched(bqOpnameSelectedPekerjaanId, bqOpnameSelectedMinggu);
            syncOpnameToLapMingguan(bqOpnameSelectedPekerjaanId, bqOpnameSelectedMinggu);
            cancelBqOpnameEdit();
            renderBqOpnameDetail();
        }

        function editBqOpnameRow(id) {
            const row = bqOpnameData.find(o => o.id === id);
            if (!row) return;
            bqOpEditRowId = id;
            document.getElementById('bqOpEditId').value = id;
            document.getElementById('bqOpSegmen').value = row.segmen;
            document.getElementById('bqOpTipe').value = row.tipe;
            document.getElementById('bqOpMetode').value = row.metode;
            renderBqOpnameFormFields();
            BQ_OPNAME_ALL_FIELDS.forEach(f => {
                const input = document.getElementById('bqOp_' + f);
                if (input) input.value = (row[f] !== undefined && row[f] !== null) ? row[f] : (f === 'koefisien' ? 1 : '');
            });
            document.getElementById('bqOpCatatan').value = row.catatan || '';
            updateBqOpnameFormulaPreview();

            document.getElementById('bqOpFormTitle').innerText = 'Edit Baris Perhitungan Opname';
            const submitBtn = document.getElementById('bqOpSubmitBtn');
            submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> Simpan Perubahan';
            document.getElementById('bqOpCancelBtn').classList.remove('hidden');
            document.getElementById('formBqOpname').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        function cancelBqOpnameEdit() {
            bqOpEditRowId = null;
            const form = document.getElementById('formBqOpname');
            if (form) form.reset();
            document.getElementById('bqOpEditId').value = '';
            document.getElementById('bqOpTipe').value = 'tambah';
            document.getElementById('bqOpMetode').value = 'plt';
            renderBqOpnameFormFields();
            const titleEl = document.getElementById('bqOpFormTitle');
            if (titleEl) titleEl.innerText = '2. Input Perhitungan Opname';
            const submitBtn = document.getElementById('bqOpSubmitBtn');
            if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-plus mr-1"></i> Tambah Baris Opname';
            const cancelBtn = document.getElementById('bqOpCancelBtn');
            if (cancelBtn) cancelBtn.classList.add('hidden');
        }

        function deleteBqOpnameRow(id) {
            if (!confirm('Hapus baris hasil opname ini?')) return;
            const row = bqOpnameData.find(o => o.id === id);
            bqOpnameData = bqOpnameData.filter(o => o.id !== id);
            localStorage.setItem('erp_bq_opname', JSON.stringify(bqOpnameData));
            if (row) {
                // Tandai minggu ini sebagai "sudah pernah disentuh" WALAUPUN sekarang jadi kosong, supaya
                // fitur salin-otomatis dari minggu lalu tidak menghidupkan kembali baris yang baru saja
                // sengaja dihapus user.
                bqOpnameMarkWeekTouched(row.pekerjaanId, row.mingguKe);
                syncOpnameToLapMingguan(row.pekerjaanId, row.mingguKe);
            }
            renderBqOpnameDetail();
        }

        // Naik/turun urutan baris opname (tukar nilai 'order' dengan baris tetangga dalam pekerjaan & minggu yang sama)
        function moveBqOpnameRow(id, direction) {
            const siblings = bqOpnameData.filter(o => o.pekerjaanId == bqOpnameSelectedPekerjaanId && o.mingguKe === bqOpnameSelectedMinggu).sort((a, b) => (a.order || 0) - (b.order || 0));
            const idx = siblings.findIndex(o => o.id === id);
            if (idx === -1) return;
            const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (targetIdx < 0 || targetIdx >= siblings.length) return;
            const a = siblings[idx], b = siblings[targetIdx];
            const tmpOrder = a.order;
            const realIdxA = bqOpnameData.findIndex(o => o.id === a.id);
            const realIdxB = bqOpnameData.findIndex(o => o.id === b.id);
            bqOpnameData[realIdxA].order = b.order;
            bqOpnameData[realIdxB].order = tmpOrder;
            localStorage.setItem('erp_bq_opname', JSON.stringify(bqOpnameData));
            renderBqOpnameDetail();
        }

        function renderBqOpnameTable() {
            const tbody = document.getElementById('bqOpnameTableBody');
            if (!tbody) return;
            const rows = bqOpnameData.filter(o => o.pekerjaanId == bqOpnameSelectedPekerjaanId && o.mingguKe === bqOpnameSelectedMinggu).sort((a, b) => (a.order || 0) - (b.order || 0));
            const rab = rabData.find(r => r.id == bqOpnameSelectedPekerjaanId);
            if (rows.length === 0) {
                tbody.innerHTML = `<tr><td colspan="10" class="p-6 text-center text-slate-500">Belum ada hasil opname untuk item pekerjaan ini pada ${bqOpnameSelectedMinggu}.</td></tr>`;
            } else {
                tbody.innerHTML = rows.map((row, idx) => {
                    // Kategori Tambah/Kurang digabung langsung ke kolom Volume (tanda +/- & warna), tidak lagi
                    // jadi kolom terpisah - supaya list lebih ringkas & angkanya langsung terbaca satu kesatuan.
                    const tipeTag = row.tipe === 'kurang'
                        ? '<span class="px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 text-[9px] font-bold ml-1.5 align-middle">KURANG</span>'
                        : '<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold ml-1.5 align-middle">TAMBAH</span>';
                    const carriedBadge = row.disalinDariMinggu
                        ? `<div class="mt-1"><span class="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[9px] font-bold whitespace-nowrap"><i class="fa-solid fa-clock-rotate-left mr-1"></i>Disalin dari Minggu ${row.disalinDariMinggu}</span></div>`
                        : '';
                    // Kontribusi baris ini terhadap "Opname Minggu Ini": baris baru = penuh, baris salinan
                    // yang belum diubah = 0, baris salinan yang sudah diedit = hanya selisih perubahannya.
                    const kontribusi = bqOpnameRowNetContribution(row);
                    let kontribusiNote = '';
                    if (row.disalinDariMinggu) {
                        if (Math.abs(kontribusi) < 0.0001) {
                            kontribusiNote = `<div class="text-[9px] text-slate-500 mt-0.5">Belum ada perubahan minggu ini (kontribusi 0)</div>`;
                        } else {
                            kontribusiNote = `<div class="text-[9px] ${kontribusi > 0 ? 'text-emerald-400' : 'text-red-400'} mt-0.5">Kontribusi minggu ini: ${kontribusi > 0 ? '+' : ''}${formatAngka(kontribusi)} ${rab ? rab.satuan : ''}</div>`;
                        }
                    }
                    return `
                        <tr>
                            <td class="p-3">${idx + 1}</td>
                            <td class="p-3 font-mono font-bold text-amber-400">${rab ? (rab.noDiv || '-') : '-'}</td>
                            <td class="p-3 font-semibold text-white">${rab ? (rab.div || '-') : '-'}</td>
                            <td class="p-3">${rab ? rab.sub : '-'}</td>
                            <td class="p-3 text-slate-400">${rab ? (rab.rincian || '') : '-'}</td>
                            <td class="p-3 font-medium text-white">${escapeHtml(row.segmen)}${carriedBadge}</td>
                            <td class="p-3 text-[11px] text-slate-400">${BQ_OPNAME_METODE[row.metode] ? BQ_OPNAME_METODE[row.metode].label : ''}<br>${bqOpnameFormulaText(row)}</td>
                            <td class="p-3 font-mono font-bold ${row.tipe === 'kurang' ? 'text-red-400' : 'text-emerald-400'}">${row.tipe === 'kurang' ? '-' : '+'}${formatAngka(row.volume)} ${rab ? rab.satuan : ''}${tipeTag}${kontribusiNote}</td>
                            <td class="p-3 text-[11px] text-slate-400">${escapeHtml(row.catatan) || '-'}</td>
                            <td class="p-3">
                                <div class="flex items-center justify-center gap-1.5">
                                    <button onclick="moveBqOpnameRow(${row.id}, 'up')" ${idx === 0 ? 'disabled' : ''} class="text-slate-400 hover:text-amber-400 disabled:opacity-20 disabled:cursor-not-allowed transition" title="Naik"><i class="fa-solid fa-arrow-up"></i></button>
                                    <button onclick="moveBqOpnameRow(${row.id}, 'down')" ${idx === rows.length - 1 ? 'disabled' : ''} class="text-slate-400 hover:text-amber-400 disabled:opacity-20 disabled:cursor-not-allowed transition" title="Turun"><i class="fa-solid fa-arrow-down"></i></button>
                                    <button onclick="editBqOpnameRow(${row.id})" class="text-sky-400 hover:text-sky-300 transition" title="Edit"><i class="fa-solid fa-pen"></i></button>
                                    <button onclick="deleteBqOpnameRow(${row.id})" class="text-red-400 hover:text-red-300 transition" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                                </div>
                            </td>
                        </tr>`;
                }).join('');
            }

            const summaryEl = document.getElementById('bqOpnameSummary');
            if (summaryEl) {
                const kontribusiRows = rows.map(r => bqOpnameRowNetContribution(r));
                const totalTambah = kontribusiRows.filter(v => v > 0).reduce((a, c) => a + c, 0);
                const totalKurang = kontribusiRows.filter(v => v < 0).reduce((a, c) => a + Math.abs(c), 0);
                const totalBersih = totalTambah - totalKurang;
                const satuan = rab ? rab.satuan : '';
                const volLalu = bqOpnameNetVolumeCumulative(bqOpnameSelectedPekerjaanId, parseInt((bqOpnameSelectedMinggu || '').replace(/\D/g, ''), 10) || 1);
                summaryEl.innerHTML = `
                    <h3 class="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-700 pb-2 mb-3">Ringkasan Opname &mdash; ${bqOpnameSelectedMinggu}</h3>
                    <div class="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                        <div class="bg-[#0b132b] rounded-xl p-3"><div class="text-slate-400 text-[10px] uppercase">Total Tambah</div><div class="font-bold text-emerald-400 text-sm">${formatAngka(totalTambah)} ${satuan}</div></div>
                        <div class="bg-[#0b132b] rounded-xl p-3"><div class="text-slate-400 text-[10px] uppercase">Total Kurang</div><div class="font-bold text-red-400 text-sm">${formatAngka(totalKurang)} ${satuan}</div></div>
                        <div class="bg-[#0b132b] rounded-xl p-3"><div class="text-slate-400 text-[10px] uppercase">Opname Bersih Minggu Ini</div><div class="font-bold text-amber-300 text-sm">${formatAngka(totalBersih)} ${satuan}</div></div>
                        <div class="bg-[#0b132b] rounded-xl p-3"><div class="text-slate-400 text-[10px] uppercase">Opname Komulatif</div><div class="font-bold text-sky-300 text-sm">${formatAngka(volLalu + totalBersih)} ${satuan}</div></div>
                        <div class="bg-[#0b132b] rounded-xl p-3"><div class="text-slate-400 text-[10px] uppercase">Volume RAB</div><div class="font-bold text-white text-sm">${formatAngka(rab ? rab.volume : 0)} ${satuan}</div></div>
                    </div>`;
            }
        }

        // Render area detail (form input + tabel rincian segmen + ringkasan) untuk item pekerjaan yang
        // sedang dibuka pada bqOpDetailArea. Dipanggil setiap ada perubahan data opname/minggu.
        function renderBqOpnameDetail() {
            // Jika pekerjaan yang sedang dipilih bukan milik proyek aktif (mis. setelah ganti proyek), reset pilihan
            if (bqOpnameSelectedPekerjaanId) {
                const rabCheck = rabData.find(r => r.id == bqOpnameSelectedPekerjaanId);
                if (!rabCheck || rabCheck.projId !== activeProjectId) bqOpnameSelectedPekerjaanId = null;
            }
            if (bqOpnameSelectedPekerjaanId) {
                document.getElementById('bqOpDetailArea').classList.remove('hidden');
                renderBqOpnameJudulInfo();
                renderBqOpnameTable();
                const metodeSel = document.getElementById('bqOpMetode');
                if (metodeSel && !metodeSel.value) metodeSel.value = 'plt';
                renderBqOpnameFormFields();
                // Live preview volume saat mengetik
                BQ_OPNAME_ALL_FIELDS.forEach(f => {
                    const input = document.getElementById('bqOp_' + f);
                    if (input && !input.dataset.bound) { input.addEventListener('input', updateBqOpnameFormulaPreview); input.dataset.bound = '1'; }
                });
            } else {
                document.getElementById('bqOpDetailArea').classList.add('hidden');
            }
        }

        // Ketika minggu opname diganti dari dropdown filter: render ulang daftar master, dan jika sedang
        // ada item yang dibuka detailnya, ikut render ulang detail-nya sesuai minggu baru.
        function handleBqOpMingguChange() {
            const sel = document.getElementById('bqOpFilterMingguSelect');
            bqOpnameSelectedMinggu = sel ? sel.value : 'Minggu 1';
            if (bqOpnameSelectedPekerjaanId) {
                // Sinkronkan rantai minggu 2 s/d minggu yang baru dipilih, supaya baris salinan yang belum
                // diedit ikut mengikuti perubahan terbaru dari minggu-minggu sebelumnya.
                bqOpnameReconcileChain(bqOpnameSelectedPekerjaanId, bqOpnameSelectedMinggu);
            }
            renderBqOpnameMaster();
            if (bqOpnameSelectedPekerjaanId) {
                cancelBqOpnameEdit();
                renderBqOpnameDetail();
            }
        }

        // Render daftar (master list) SELURUH item pekerjaan RAB proyek aktif, dikelompokkan per Divisi
        // (sama seperti RAB/Laporan Mingguan), menampilkan status opname minggu lalu/ini/komulatif serta
        // status sudah/belum diopname, supaya cepat diketahui item mana yang belum dicek di lapangan.
        function renderBqOpnameMaster() {
            const mingguSel = document.getElementById('bqOpFilterMingguSelect');
            const searchEl = document.getElementById('bqOpSearchInput');
            const periodeLabelEl = document.getElementById('bqOpPeriodeLabel');
            const tbody = document.getElementById('bqOpnameMasterTableBody');
            if (!tbody) return;

            const proj = projects.find(p => p.id === activeProjectId) || {};

            if (mingguSel) {
                const curVal = mingguSel.value || bqOpnameSelectedMinggu || 'Minggu 1';
                mingguSel.innerHTML = '';
                for (let i = 1; i <= 12; i++) {
                    const range = getWeekDateRangeDetailed(i, proj.tglMulai, proj.tglSelesai);
                    const opt = document.createElement('option');
                    opt.value = `Minggu ${i}`;
                    opt.textContent = range ? `Minggu ${i} (${range.labelShort})` : `Minggu ${i}`;
                    if (`Minggu ${i}` === curVal) opt.selected = true;
                    mingguSel.appendChild(opt);
                }
                bqOpnameSelectedMinggu = mingguSel.value;
            }
            const selectedMinggu = bqOpnameSelectedMinggu;
            const selectedWeekNum = parseInt((selectedMinggu || '').replace(/\D/g, ''), 10) || 1;

            if (periodeLabelEl) {
                const rangeDetailed = getWeekDateRangeDetailed(selectedWeekNum, proj.tglMulai, proj.tglSelesai);
                periodeLabelEl.innerHTML = rangeDetailed
                    ? `<i class="fa-solid fa-calendar-days mr-1"></i>Periode: <span class="text-amber-300 font-semibold">${rangeDetailed.labelFull}</span>`
                    : `<i class="fa-solid fa-calendar-days mr-1"></i>Tanggal Mulai Proyek belum diatur, periode tanggal tidak dapat dihitung.`;
            }

            const projRAB = rabData.filter(r => r.projId === activeProjectId);
            const subtotal = projRAB.reduce((acc, cur) => acc + (cur.volume * cur.harga), 0);
            const query = searchEl ? searchEl.value.trim().toLowerCase() : '';
            const displayRAB = query
                ? projRAB.filter(r => [r.noDiv, r.div, r.sub, r.rincian, r.satuan].some(v => (v || '').toString().toLowerCase().includes(query)))
                : projRAB;

            tbody.innerHTML = '';
            if (displayRAB.length === 0) {
                tbody.innerHTML = `<tr><td colspan="12" class="p-6 text-center text-slate-500">${projRAB.length === 0 ? 'Belum ada data RAB / Pekerjaan.' : 'Tidak ada item yang cocok dengan pencarian.'}</td></tr>`;
            } else {
                const divGroups = [];
                const divGroupMap = new Map();
                displayRAB.forEach(item => {
                    const key = (item.noDiv || '-') + '||' + (item.div || '-');
                    if (!divGroupMap.has(key)) {
                        const group = { noDiv: item.noDiv, div: item.div, items: [] };
                        divGroupMap.set(key, group);
                        divGroups.push(group);
                    }
                    divGroupMap.get(key).items.push(item);
                });
                divGroups.sort((ga, gb) => compareDivisionKey(ga.noDiv, gb.noDiv));

                let no = 0, sudahCount = 0, belumCount = 0, sumBobotIni = 0, sumBobotKum = 0;
                divGroups.forEach(group => {
                    group.items.forEach(item => {
                        no++;
                        const bobotItemRab = subtotal > 0 ? ((item.volume * item.harga) / subtotal) * 100 : 0;
                        const volLalu = bqOpnameNetVolumeCumulative(item.id, selectedWeekNum);
                        const volIni = bqOpnameNetVolumeForWeek(item.id, selectedMinggu);
                        const volKum = volLalu + volIni;
                        const sudahDiopname = bqOpnameData.some(o => o.pekerjaanId == item.id);
                        if (sudahDiopname) sudahCount++; else belumCount++;
                        sumBobotIni += subtotal > 0 ? (volIni * item.harga / subtotal) * 100 : 0;
                        sumBobotKum += subtotal > 0 ? (volKum * item.harga / subtotal) * 100 : 0;

                        const statusBadge = sudahDiopname
                            ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold whitespace-nowrap"><i class="fa-solid fa-circle-check mr-1"></i>Sudah Diopname</span>'
                            : '<span class="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-bold whitespace-nowrap"><i class="fa-solid fa-circle-exclamation mr-1"></i>Belum Diopname</span>';

                        const tr = document.createElement('tr');
                        tr.className = 'hover:bg-slate-800/50 transition';
                        tr.innerHTML = `
                            <td class="p-3">${no}</td>
                            <td class="p-3 font-mono font-bold text-amber-400">${item.noDiv || '-'}</td>
                            <td class="p-3 font-semibold text-white">${item.div || '-'}</td>
                            <td class="p-3">${item.sub}</td>
                            <td class="p-3 text-slate-400">${item.rincian || ''}</td>
                            <td class="p-3 font-mono">${item.satuan}</td>
                            <td class="p-3 font-mono">${formatAngka(item.volume)}</td>
                            <td class="p-3 font-mono text-slate-400">${formatAngka(volLalu)}</td>
                            <td class="p-3 font-mono font-bold text-amber-300">${formatAngka(volIni)}</td>
                            <td class="p-3 font-mono font-bold text-sky-300">${formatAngka(volKum)}</td>
                            <td class="p-3">${statusBadge}</td>
                            <td class="p-3 text-center">
                                <button onclick="openBqOpnameDetail(${item.id})" class="bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold px-3 py-1.5 rounded-lg transition whitespace-nowrap">
                                    <i class="fa-solid fa-ruler-combined mr-1"></i>Detail Opname
                                </button>
                            </td>
                        `;
                        tbody.appendChild(tr);
                    });
                });

                document.getElementById('bqOpSumTotalItem').innerText = displayRAB.length;
                document.getElementById('bqOpSumSudah').innerText = sudahCount;
                document.getElementById('bqOpSumBelum').innerText = belumCount;
                document.getElementById('bqOpSumBobotIni').innerText = sumBobotIni.toFixed(2) + ' %';
                document.getElementById('bqOpSumBobotKum').innerText = sumBobotKum.toFixed(2) + ' %';
            }
        }

        // Entry point render halaman Opname: render daftar master, lalu render detail jika sedang terbuka.
        function renderBqOpname() {
            renderBqOpnameMaster();
            renderBqOpnameDetail();
        }

        // Susunan data untuk Export Excel halaman Opname
        function buildBqOpnameExportRows() {
            return bqOpnameData
                .filter(o => { const r = rabData.find(x => x.id == o.pekerjaanId); return r && r.projId === activeProjectId; })
                .sort((a, b) => (a.pekerjaanId - b.pekerjaanId) || ((parseInt((a.mingguKe || '').replace(/\D/g, ''), 10) || 0) - (parseInt((b.mingguKe || '').replace(/\D/g, ''), 10) || 0)) || ((a.order || 0) - (b.order || 0)))
                .map(o => {
                    const rab = rabData.find(r => r.id == o.pekerjaanId) || {};
                    return {
                        'No/Div': rab.noDiv || '', 'Divisi': rab.div || '', 'Sub Pekerjaan': rab.sub || '',
                        'Rincian': rab.rincian || '', 'Satuan': rab.satuan || '', 'Volume RAB': rab.volume || 0,
                        'Minggu Ke': o.mingguKe || '', 'Segmen/Ruangan/Posisi': o.segmen, 'Tipe': o.tipe === 'kurang' ? 'Kurang' : 'Tambah',
                        'Metode': BQ_OPNAME_METODE[o.metode] ? BQ_OPNAME_METODE[o.metode].label : o.metode,
                        'Jumlah': o.jumlah || '', 'Panjang': o.panjang || '', 'Lebar': o.lebar || '', 'Tinggi/Tebal': o.tinggi || '',
                        'Koefisien': o.koefisien || '', 'Volume Hasil': o.volume, 'Catatan': o.catatan || ''
                    };
                });
        }

        // Versi TEKS POLOS dari bqOpnameFormulaText (yang di halaman aslinya memakai HTML <span>) - dipakai
        // khusus untuk PDF karena AutoTable/jsPDF butuh teks polos, bukan markup HTML.
        function bqOpnameFormulaTextPlain(row) {
            const cfg = BQ_OPNAME_METODE[row.metode];
            if (!cfg) return '';
            const lhs = typeof cfg.formula === 'function' ? cfg.formula(row) : cfg.fields.map(f => `${formatAngka(row[f])}`).join(' × ');
            return `${lhs} = ${formatAngka(row.volume)}`;
        }

        // Export PDF khusus Opname: BUKAN tabel datar biasa, tapi disusun PER ITEM PEKERJAAN RAB - tiap item
        // punya judul sendiri (No/Div, Divisi, Sub Pekerjaan, Volume Kontrak), diikuti tabel rincian SETIAP
        // baris hitungan (minggu, segmen, metode, rumus lengkap sampai hasil akhirnya, tipe, volume, catatan),
        // ditutup ringkasan progres item itu (Volume Komulatif vs Volume Kontrak vs Bobot %). Susunan ini
        // dipilih supaya auditor/pemeriksa bisa menelusuri SETIAP angka dari mana asalnya (rumus & inputnya
        // terlihat jelas), bukan cuma melihat angka akhir tanpa tahu cara hitungnya.
        function exportBqOpnamePdf() {
            const proj = projects.find(p => p.id === activeProjectId) || { nama: 'Proyek' };
            const meta = getExportProjectMeta();
            const doc = new jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            let y = drawPdfKop(doc, meta, 'Backup Quantity - Rincian Perhitungan Opname (Untuk Keperluan Audit)', {});

            const allRows = bqOpnameData.filter(o => { const r = rabData.find(x => x.id == o.pekerjaanId); return r && r.projId === activeProjectId; });
            const itemIdsWithData = new Set(allRows.map(o => o.pekerjaanId));
            const orderedItems = rabData
                .filter(r => r.projId === activeProjectId && itemIdsWithData.has(r.id))
                .sort((a, b) => compareDivisionKey(a.noDiv, b.noDiv));

            if (orderedItems.length === 0) {
                doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100, 116, 139);
                doc.text('Belum ada data opname untuk proyek ini.', pageWidth / 2, y + 10, { align: 'center' });
            }

            orderedItems.forEach((rab, idx) => {
                const rows = allRows
                    .filter(o => o.pekerjaanId == rab.id)
                    .sort((a, b) => (parseInt((a.mingguKe || '').replace(/\D/g, ''), 10) || 0) - (parseInt((b.mingguKe || '').replace(/\D/g, ''), 10) || 0) || ((a.order || 0) - (b.order || 0)));

                // Kalau ruang tersisa di halaman terlalu sempit untuk judul item + minimal 1 baris, mulai halaman baru
                if (y > pageHeight - 45) { doc.addPage(); y = 15; }

                // Judul/header item pekerjaan - identitas lengkap supaya jelas ini rincian utk item yang mana
                doc.setFillColor(226, 232, 240);
                doc.rect(10, y, pageWidth - 20, 7, 'F');
                doc.setTextColor(11, 19, 43); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
                const judul = `${idx + 1}. [${rab.noDiv || '-'}] ${rab.div || ''} \u00bb ${rab.sub}${rab.rincian ? ' - ' + rab.rincian : ''}  (Satuan: ${rab.satuan}, Volume Kontrak: ${formatAngka(rab.volume)} ${rab.satuan})`;
                doc.text(judul, 12, y + 5, { maxWidth: pageWidth - 24 });
                y += 9;

                const body = rows.map(r => [
                    r.mingguKe || '-',
                    r.segmen || '-',
                    (BQ_OPNAME_METODE[r.metode] ? BQ_OPNAME_METODE[r.metode].label : r.metode) || '-',
                    bqOpnameFormulaTextPlain(r),
                    r.tipe === 'kurang' ? 'Kurang' : 'Tambah',
                    `${r.tipe === 'kurang' ? '-' : '+'}${formatAngka(r.volume)} ${rab.satuan}`,
                    r.catatan || '-'
                ]);

                doc.autoTable({
                    head: [['Minggu', 'Segmen / Ruangan / Posisi', 'Metode', 'Rumus Perhitungan (terurai s/d hasil)', 'Tipe', 'Volume', 'Catatan']],
                    body,
                    startY: y,
                    margin: { left: 10, right: 10, bottom: 12 },
                    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.4, overflow: 'linebreak', valign: 'middle', lineColor: [203, 213, 225], lineWidth: 0.1 },
                    headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold', halign: 'center' },
                    alternateRowStyles: { fillColor: [248, 250, 252] },
                    columnStyles: {
                        0: { cellWidth: 18, halign: 'center' }, 1: { cellWidth: 45 }, 2: { cellWidth: 40 },
                        4: { cellWidth: 16, halign: 'center' }, 5: { cellWidth: 26, halign: 'right' }
                    }
                });
                y = doc.lastAutoTable.finalY + 3;

                // Ringkasan progres item ini: volume komulatif SELURUH minggu s/d saat ini, dibandingkan
                // Volume Kontrak RAB-nya - supaya auditor langsung tahu status akhirnya tanpa menjumlah manual.
                const volKum = bqOpnameNetVolumeCumulative(rab.id, undefined);
                const bobotKum = rab.volume > 0 ? (volKum / rab.volume) * 100 : 0;
                const melebihi = rab.volume > 0 && volKum > rab.volume + 0.0001;
                doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
                doc.setTextColor(melebihi ? 185 : 15, melebihi ? 28 : 23, melebihi ? 28 : 42);
                const ringkasan = `Volume Komulatif Akhir: ${formatAngka(volKum)} ${rab.satuan}   |   Volume Kontrak: ${formatAngka(rab.volume)} ${rab.satuan}   |   Progres: ${bobotKum.toFixed(2)}%` + (melebihi ? '   \u26a0 MELEBIHI VOLUME KONTRAK' : '');
                doc.text(ringkasan, 12, y + 4);
                y += 11;

                if (y > pageHeight - 30 && idx < orderedItems.length - 1) { doc.addPage(); y = 15; }
            });

            doc.save(`Rincian_Perhitungan_Opname_(Audit)_${proj.nama}.pdf`);
        }

        // ===================================================================
        // BACKUP QUANTITY - INPUT MANUAL SESUAI KATEGORI PEKERJAAN
        // Setiap kategori punya field input & metode/rumus perhitungan sendiri.
        // Hasil kalkulasi akan otomatis memunculkan seluruh material yang
        // dibutuhkan untuk kategori pekerjaan tersebut beserta kebutuhannya.
        // ===================================================================
        function bqR2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

        const BQ_HARGA = {
            semen: 68000, pasirBeton: 250000, split: 300000, besi: 16500, kawat: 28000,
            paku: 25000, minyakBekisting: 38000,
            bataMerah: 900, bataRingan: 700000, batako: 4200,
            pasirPasang: 230000, semenMortar: 65000,
            nat: 35000, hollow: 45000, compound: 120000,
            kusenAlumunium: 165000, kacaPolos: 185000, engsel: 35000, kunciPintu: 150000,
            catKayuBesi: 145000, plamir: 32000,
            pipaPVC: 65000, kranAir: 75000, kloset: 1200000, wastafel: 650000, floorDrain: 35000,
            kabelNYM: 8500, saklar: 28000, stopKontak: 30000, lampu: 85000, panelListrik: 850000,
            agregatA: 230000, agregatB: 210000, sirtu: 190000,
            aspalHotmix: 1550000, aspalPrimeCoat: 28000, aspalTackCoat: 25000, wiremesh: 165000,
            rambuJalan: 850000, thermoplastic: 75000,
            batuKali: 290000, boxCulvert: 3500000, buisBeton: 650000,
            bronjong: 480000, geotextile: 32000, turapBeton: 1250000,
            pavingBlock: 95000, kanstin: 45000, tanahSubur: 180000, rumputGajah: 35000, pagarBrc: 420000,
            kabelTanam: 45000, lampuTaman: 750000
        };

        // Rincian material beton bertulang standar (semen, pasir, split, besi, bekisting)
        // dipakai berulang oleh beberapa kategori pekerjaan struktur.
        function bqBetonBreakdown(volume, besiRatioKgM3, bekistingM2) {
            volume = Math.max(volume || 0, 0);
            const items = [
                { nama: 'Semen PC 50kg (Campuran Beton)', satuan: 'Sak', volume: Math.ceil(volume * 371 / 50), harga: BQ_HARGA.semen },
                { nama: 'Pasir Beton', satuan: 'm3', volume: bqR2(volume * 0.52), harga: BQ_HARGA.pasirBeton },
                { nama: 'Split / Kerikil', satuan: 'm3', volume: bqR2(volume * 0.78), harga: BQ_HARGA.split }
            ];
            if (besiRatioKgM3 > 0) {
                const besiKg = volume * besiRatioKgM3;
                items.push({ nama: 'Besi Beton Ulir/Polos', satuan: 'Kg', volume: bqR2(besiKg), harga: BQ_HARGA.besi });
                items.push({ nama: 'Kawat Bendrat', satuan: 'Kg', volume: bqR2(besiKg * 0.015), harga: BQ_HARGA.kawat });
            }
            if (bekistingM2 > 0) {
                items.push({ nama: 'Bekisting Multiplek 18mm + Kayu', satuan: 'm2', volume: bqR2(bekistingM2), harga: 165000 });
                items.push({ nama: 'Paku Bekisting', satuan: 'Kg', volume: bqR2(bekistingM2 * 0.4), harga: BQ_HARGA.paku });
                items.push({ nama: 'Minyak Bekisting', satuan: 'Liter', volume: bqR2(bekistingM2 * 0.2), harga: BQ_HARGA.minyakBekisting });
            }
            return items;
        }

        const bqCategoryConfig = {
            'Pekerjaan Persiapan & Tanah': {
                metode: 'Volume Galian = Panjang x Lebar x Kedalaman. Urugan kembali & buangan tanah dihitung dari persentase volume galian.',
                fields: [
                    { id: 'panjang', label: 'Panjang Galian (m)', default: 10 },
                    { id: 'lebar', label: 'Lebar Galian (m)', default: 1 },
                    { id: 'kedalaman', label: 'Kedalaman Galian (m)', default: 1 },
                    { id: 'jenisTanah', label: 'Jenis Tanah', type: 'select', full: true, options: [{ value: 'Tanah Biasa', label: 'Tanah Biasa' }, { value: 'Tanah Keras', label: 'Tanah Keras' }, { value: 'Tanah Berbatu', label: 'Tanah Berbatu' }] }
                ],
                calculate(v) {
                    const volume = v.panjang * v.lebar * v.kedalaman;
                    const hargaGalian = { 'Tanah Biasa': 65000, 'Tanah Keras': 95000, 'Tanah Berbatu': 145000 }[v.jenisTanah] || 65000;
                    return [
                        { nama: `Galian Tanah (${v.jenisTanah})`, satuan: 'm3', volume: bqR2(volume), harga: hargaGalian },
                        { nama: 'Urugan Tanah Kembali', satuan: 'm3', volume: bqR2(volume * 0.3), harga: 55000 },
                        { nama: 'Buangan Tanah Sisa Galian (Dump Truck)', satuan: 'm3', volume: bqR2(volume * 0.7), harga: 75000 },
                        { nama: 'Urugan Pasir Bawah Pondasi', satuan: 'm3', volume: bqR2(volume * 0.1), harga: BQ_HARGA.pasirBeton }
                    ];
                }
            },
            'Struktur Pondasi': {
                metode: 'Volume Beton Footplat (Jumlah x P x L x T) ditambah Volume Sloof (Panjang x Lebar x Tinggi). Besi & bekisting mengikuti rasio tulangan.',
                fields: [
                    { id: 'jumlahTitik', label: 'Jumlah Titik Footplat', default: 8 },
                    { id: 'panjang', label: 'Panjang Footplat (m)', default: 0.8 },
                    { id: 'lebar', label: 'Lebar Footplat (m)', default: 0.8 },
                    { id: 'tebal', label: 'Tebal Footplat (m)', default: 0.3 },
                    { id: 'panjangSloof', label: 'Total Panjang Sloof (m)', default: 40 },
                    { id: 'lebarSloof', label: 'Lebar Sloof (m)', default: 0.2 },
                    { id: 'tinggiSloof', label: 'Tinggi Sloof (m)', default: 0.25 },
                    { id: 'rasioBesi', label: 'Rasio Besi (Kg/m3)', default: 140 }
                ],
                calculate(v) {
                    const volFootplat = v.jumlahTitik * v.panjang * v.lebar * v.tebal;
                    const volSloof = v.panjangSloof * v.lebarSloof * v.tinggiSloof;
                    const volTotal = volFootplat + volSloof;
                    const bekisting = v.jumlahTitik * 2 * (v.panjang + v.lebar) * v.tebal + v.panjangSloof * 2 * v.tinggiSloof;
                    return bqBetonBreakdown(volTotal, v.rasioBesi, bekisting);
                }
            },
            'Struktur Beton & Besi': {
                metode: 'Volume Beton = Panjang x Lebar x Tinggi/Tebal x Jumlah. Kebutuhan besi dihitung dari rasio tulangan (Kg/m3) sesuai jenis elemen.',
                fields: [
                    { id: 'jenisElemen', label: 'Jenis Elemen', type: 'select', full: true, options: [{ value: 'Kolom', label: 'Kolom' }, { value: 'Balok', label: 'Balok' }, { value: 'Plat Lantai', label: 'Plat Lantai' }] },
                    { id: 'panjang', label: 'Panjang (m)', default: 4 },
                    { id: 'lebar', label: 'Lebar (m)', default: 0.3 },
                    { id: 'tinggiTebal', label: 'Tinggi/Tebal (m)', default: 0.3 },
                    { id: 'jumlah', label: 'Jumlah Elemen', default: 12 },
                    { id: 'rasioBesi', label: 'Rasio Besi (Kg/m3)', default: 150 }
                ],
                calculate(v) {
                    const volume = v.panjang * v.lebar * v.tinggiTebal * v.jumlah;
                    const bekisting = v.jenisElemen === 'Plat Lantai' ? v.panjang * v.lebar * v.jumlah : v.jumlah * 2 * (v.panjang + v.lebar) * v.tinggiTebal;
                    return bqBetonBreakdown(volume, v.rasioBesi, bekisting);
                }
            },
            'Pekerjaan Dinding & Plesteran': {
                metode: 'Luas Dinding = (Panjang x Tinggi) - Luas Bukaan. Kebutuhan bata & plesteran dihitung per m2 sesuai koefisien standar.',
                fields: [
                    { id: 'panjangDinding', label: 'Panjang Dinding (m)', default: 20 },
                    { id: 'tinggiDinding', label: 'Tinggi Dinding (m)', default: 3 },
                    { id: 'luasBukaan', label: 'Luas Bukaan Pintu/Jendela (m2)', default: 5 },
                    { id: 'jenisBata', label: 'Jenis Bata', type: 'select', options: [{ value: 'Bata Merah', label: 'Bata Merah' }, { value: 'Bata Ringan (Hebel)', label: 'Bata Ringan (Hebel)' }, { value: 'Batako', label: 'Batako' }] },
                    { id: 'sisiPlester', label: 'Diplester', type: 'select', options: [{ value: 'Dua Sisi', label: 'Dua Sisi' }, { value: 'Satu Sisi', label: 'Satu Sisi' }] }
                ],
                calculate(v) {
                    const luas = Math.max(v.panjangDinding * v.tinggiDinding - v.luasBukaan, 0);
                    const sisi = v.sisiPlester === 'Dua Sisi' ? 2 : 1;
                    const luasPlester = luas * sisi;
                    const items = [];
                    if (v.jenisBata === 'Bata Merah') {
                        items.push({ nama: 'Bata Merah', satuan: 'Buah', volume: Math.ceil(luas * 70), harga: BQ_HARGA.bataMerah });
                        items.push({ nama: 'Semen Pasang Bata', satuan: 'Sak', volume: bqR2(luas * 0.163), harga: BQ_HARGA.semenMortar });
                        items.push({ nama: 'Pasir Pasang Bata', satuan: 'm3', volume: bqR2(luas * 0.045), harga: BQ_HARGA.pasirPasang });
                    } else if (v.jenisBata === 'Batako') {
                        items.push({ nama: 'Batako', satuan: 'Buah', volume: Math.ceil(luas * 12.5), harga: BQ_HARGA.batako });
                        items.push({ nama: 'Semen Pasang Batako', satuan: 'Sak', volume: bqR2(luas * 0.08), harga: BQ_HARGA.semenMortar });
                        items.push({ nama: 'Pasir Pasang Batako', satuan: 'm3', volume: bqR2(luas * 0.025), harga: BQ_HARGA.pasirPasang });
                    } else {
                        items.push({ nama: 'Bata Ringan (Hebel) 10cm', satuan: 'm3', volume: bqR2(luas * 0.1), harga: BQ_HARGA.bataRingan });
                        items.push({ nama: 'Semen Instan (Thin Bed Mortar)', satuan: 'Sak', volume: bqR2(luas * 0.11), harga: BQ_HARGA.semenMortar });
                    }
                    items.push({ nama: 'Semen Plesteran & Acian', satuan: 'Sak', volume: bqR2(luasPlester * 0.2), harga: BQ_HARGA.semenMortar });
                    items.push({ nama: 'Pasir Plesteran', satuan: 'm3', volume: bqR2(luasPlester * 0.02), harga: BQ_HARGA.pasirPasang });
                    return items;
                }
            },
            'Pekerjaan Keramik & Lantai': {
                metode: 'Luas Lantai = Panjang x Lebar. Kebutuhan keramik ditambah waste 5%. Semen & pasir dihitung sesuai luas.',
                fields: [
                    { id: 'panjangRuang', label: 'Panjang Ruangan (m)', default: 5 },
                    { id: 'lebarRuang', label: 'Lebar Ruangan (m)', default: 4 },
                    { id: 'jenisKeramik', label: 'Jenis Keramik', type: 'select', options: [{ value: 'Keramik 40x40', label: 'Keramik 40x40' }, { value: 'Keramik 60x60', label: 'Keramik 60x60' }, { value: 'Granit 60x60', label: 'Granit 60x60' }] },
                    { id: 'termasukPlint', label: 'Pakai Plint', type: 'select', options: [{ value: 'Ya', label: 'Ya' }, { value: 'Tidak', label: 'Tidak' }] }
                ],
                calculate(v) {
                    const luas = v.panjangRuang * v.lebarRuang;
                    const hargaKeramik = { 'Keramik 40x40': 85000, 'Keramik 60x60': 120000, 'Granit 60x60': 185000 }[v.jenisKeramik] || 85000;
                    const items = [
                        { nama: v.jenisKeramik, satuan: 'm2', volume: bqR2(luas * 1.05), harga: hargaKeramik },
                        { nama: 'Semen Pasang Keramik (Mortar)', satuan: 'Sak', volume: bqR2(luas * 0.2), harga: 75000 },
                        { nama: 'Pasir Urug Bawah Lantai', satuan: 'm3', volume: bqR2(luas * 0.05), harga: BQ_HARGA.pasirPasang },
                        { nama: 'Nat Keramik', satuan: 'Kg', volume: bqR2(luas * 0.5), harga: BQ_HARGA.nat }
                    ];
                    if (v.termasukPlint === 'Ya') {
                        const keliling = 2 * (v.panjangRuang + v.lebarRuang);
                        items.push({ nama: 'Plint Keramik', satuan: 'm', volume: bqR2(keliling), harga: 35000 });
                    }
                    return items;
                }
            },
            'Pekerjaan Atap & Rangka': {
                metode: 'Kebutuhan rangka & penutup atap dihitung per m2 luas atap (termasuk kemiringan).',
                fields: [
                    { id: 'luasAtap', label: 'Luas Atap (m2)', default: 100 },
                    { id: 'jenisRangka', label: 'Jenis Rangka', type: 'select', options: [{ value: 'Baja Ringan', label: 'Baja Ringan' }, { value: 'Kayu', label: 'Kayu' }] },
                    { id: 'jenisPenutup', label: 'Penutup Atap', type: 'select', options: [{ value: 'Genteng Metal', label: 'Genteng Metal' }, { value: 'Genteng Keramik', label: 'Genteng Keramik' }, { value: 'Spandek', label: 'Spandek' }] }
                ],
                calculate(v) {
                    const items = [];
                    if (v.jenisRangka === 'Baja Ringan') {
                        items.push({ nama: 'Kanal C Baja Ringan 75/0.75', satuan: 'Batang', volume: Math.ceil(v.luasAtap * 0.35), harga: 48000 });
                        items.push({ nama: 'Reng Baja Ringan', satuan: 'Batang', volume: Math.ceil(v.luasAtap * 0.5), harga: 22000 });
                        items.push({ nama: 'Sekrup / Baut Baja Ringan', satuan: 'Kg', volume: bqR2(v.luasAtap * 0.15), harga: 35000 });
                    } else {
                        items.push({ nama: 'Kaso/Usuk Kayu 5/7', satuan: 'm3', volume: bqR2(v.luasAtap * 0.02), harga: 4200000 });
                        items.push({ nama: 'Reng Kayu 2/3', satuan: 'm3', volume: bqR2(v.luasAtap * 0.008), harga: 4500000 });
                    }
                    const hargaPenutup = { 'Genteng Metal': 32000, 'Genteng Keramik': 5500, 'Spandek': 115000 }[v.jenisPenutup];
                    const satuanPenutup = v.jenisPenutup === 'Spandek' ? 'm2' : 'Buah';
                    const qtyPenutup = v.jenisPenutup === 'Genteng Keramik' ? Math.ceil(v.luasAtap * 25) : (v.jenisPenutup === 'Genteng Metal' ? Math.ceil(v.luasAtap * 1.1) : bqR2(v.luasAtap * 1.1));
                    items.push({ nama: v.jenisPenutup, satuan: satuanPenutup, volume: qtyPenutup, harga: hargaPenutup });
                    items.push({ nama: 'Nok / Wuwung Atap', satuan: 'm', volume: bqR2(Math.sqrt(v.luasAtap) * 1.2), harga: 65000 });
                    return items;
                }
            },
            'Pekerjaan Plafond': {
                metode: 'Luas Plafond = Panjang x Lebar. Rangka hollow dihitung per m2, panel plafond ditambah waste 5%.',
                fields: [
                    { id: 'panjangRuang', label: 'Panjang Ruangan (m)', default: 5 },
                    { id: 'lebarRuang', label: 'Lebar Ruangan (m)', default: 4 },
                    { id: 'jenisPlafond', label: 'Jenis Plafond', type: 'select', full: true, options: [{ value: 'Gypsum', label: 'Gypsum' }, { value: 'GRC', label: 'GRC' }, { value: 'PVC', label: 'PVC' }] }
                ],
                calculate(v) {
                    const luas = v.panjangRuang * v.lebarRuang;
                    const hargaPanel = { 'Gypsum': 68000, 'GRC': 95000, 'PVC': 110000 }[v.jenisPlafond];
                    return [
                        { nama: `Panel Plafond ${v.jenisPlafond}`, satuan: 'Lembar', volume: Math.ceil(luas * 1.05 / 2.88), harga: hargaPanel },
                        { nama: 'Rangka Hollow 4x4', satuan: 'Batang', volume: Math.ceil(luas * 0.45), harga: BQ_HARGA.hollow },
                        { nama: 'Paku Rivet/Sekrup Plafond', satuan: 'Kg', volume: bqR2(luas * 0.05), harga: 30000 },
                        { nama: 'Compound & Paper Tape (Gypsum)', satuan: 'Set', volume: Math.ceil(luas / 20), harga: BQ_HARGA.compound }
                    ];
                }
            },
            'Pekerjaan Pintu & Jendela': {
                metode: 'Kebutuhan kusen dihitung dari keliling bukaan pintu/jendela; kaca dihitung dari luas bukaan jendela.',
                fields: [
                    { id: 'jumlahPintu', label: 'Jumlah Pintu', default: 4 },
                    { id: 'lebarPintu', label: 'Lebar Pintu (m)', default: 0.9 },
                    { id: 'tinggiPintu', label: 'Tinggi Pintu (m)', default: 2.1 },
                    { id: 'jumlahJendela', label: 'Jumlah Jendela', default: 6 },
                    { id: 'lebarJendela', label: 'Lebar Jendela (m)', default: 1.2 },
                    { id: 'tinggiJendela', label: 'Tinggi Jendela (m)', default: 1 },
                    { id: 'jenisKusen', label: 'Jenis Kusen', type: 'select', full: true, options: [{ value: 'Alumunium', label: 'Alumunium' }, { value: 'Kayu', label: 'Kayu' }] }
                ],
                calculate(v) {
                    const kelilingPintu = v.jumlahPintu * 2 * (v.lebarPintu + v.tinggiPintu);
                    const kelilingJendela = v.jumlahJendela * 2 * (v.lebarJendela + v.tinggiJendela);
                    const luasKaca = v.jumlahJendela * v.lebarJendela * v.tinggiJendela;
                    const hargaKusen = v.jenisKusen === 'Alumunium' ? BQ_HARGA.kusenAlumunium : 210000;
                    return [
                        { nama: `Kusen ${v.jenisKusen} Pintu`, satuan: 'm', volume: bqR2(kelilingPintu), harga: hargaKusen },
                        { nama: `Kusen ${v.jenisKusen} Jendela`, satuan: 'm', volume: bqR2(kelilingJendela), harga: hargaKusen },
                        { nama: 'Daun Pintu Panel', satuan: 'Unit', volume: v.jumlahPintu, harga: 850000 },
                        { nama: 'Kaca Bening 5mm', satuan: 'm2', volume: bqR2(luasKaca * 1.05), harga: BQ_HARGA.kacaPolos },
                        { nama: 'Engsel & Aksesoris', satuan: 'Set', volume: v.jumlahPintu + v.jumlahJendela, harga: BQ_HARGA.engsel },
                        { nama: 'Kunci Pintu', satuan: 'Unit', volume: v.jumlahPintu, harga: BQ_HARGA.kunciPintu }
                    ];
                }
            },
            'Pekerjaan Pengecatan': {
                metode: 'Kebutuhan cat dihitung dari luas permukaan x jumlah lapis / daya sebar cat (±10 m2/liter atau kg).',
                fields: [
                    { id: 'luasPengecatan', label: 'Luas Permukaan (m2)', default: 150 },
                    { id: 'jumlahLapis', label: 'Jumlah Lapis Cat', default: 3 },
                    { id: 'jenisCat', label: 'Jenis Cat', type: 'select', full: true, options: [{ value: 'Cat Tembok Interior', label: 'Cat Tembok Interior' }, { value: 'Cat Tembok Eksterior', label: 'Cat Tembok Eksterior' }, { value: 'Cat Besi/Kayu', label: 'Cat Besi/Kayu' }] }
                ],
                calculate(v) {
                    const hargaCat = { 'Cat Tembok Interior': 135000, 'Cat Tembok Eksterior': 165000, 'Cat Besi/Kayu': 145000 }[v.jenisCat];
                    return [
                        { nama: v.jenisCat, satuan: 'Kg', volume: bqR2(v.luasPengecatan * v.jumlahLapis / 10), harga: hargaCat },
                        { nama: 'Plamir / Dempul Tembok', satuan: 'Kg', volume: bqR2(v.luasPengecatan * 0.15), harga: BQ_HARGA.plamir },
                        { nama: 'Amplas', satuan: 'Lembar', volume: Math.ceil(v.luasPengecatan * 0.2), harga: 5000 },
                        { nama: 'Cat Dasar (Alkali Resisting Primer)', satuan: 'Kg', volume: bqR2(v.luasPengecatan / 12), harga: 95000 }
                    ];
                }
            },
            'Pekerjaan Sanitasi & Plumbing': {
                metode: 'Kebutuhan pipa dihitung dari panjang jalur air bersih & air kotor; sanitair dihitung per titik kamar mandi.',
                fields: [
                    { id: 'jumlahTitikAirBersih', label: 'Titik Air Bersih', default: 6 },
                    { id: 'jumlahTitikAirKotor', label: 'Titik Air Kotor', default: 4 },
                    { id: 'panjangPipaAB', label: 'Panjang Pipa Air Bersih (m)', default: 30 },
                    { id: 'panjangPipaAK', label: 'Panjang Pipa Air Kotor (m)', default: 25 },
                    { id: 'jumlahKM', label: 'Jumlah Kamar Mandi', default: 2 }
                ],
                calculate(v) {
                    return [
                        { nama: 'Pipa PVC AW 1/2" (Air Bersih)', satuan: 'Batang', volume: Math.ceil(v.panjangPipaAB / 4), harga: 35000 },
                        { nama: 'Pipa PVC AW 3" (Air Kotor)', satuan: 'Batang', volume: Math.ceil(v.panjangPipaAK / 4), harga: BQ_HARGA.pipaPVC },
                        { nama: 'Fitting & Lem Pipa (Set)', satuan: 'Set', volume: v.jumlahTitikAirBersih + v.jumlahTitikAirKotor, harga: 15000 },
                        { nama: 'Kloset Duduk/Jongkok', satuan: 'Unit', volume: v.jumlahKM, harga: BQ_HARGA.kloset },
                        { nama: 'Wastafel', satuan: 'Unit', volume: v.jumlahKM, harga: BQ_HARGA.wastafel },
                        { nama: 'Kran Air', satuan: 'Unit', volume: v.jumlahTitikAirBersih, harga: BQ_HARGA.kranAir },
                        { nama: 'Floor Drain', satuan: 'Unit', volume: v.jumlahKM, harga: BQ_HARGA.floorDrain }
                    ];
                }
            },
            'Pekerjaan Elektrikal': {
                metode: 'Kebutuhan kabel dihitung dari total panjang jalur instalasi; komponen dihitung per titik.',
                fields: [
                    { id: 'jumlahTitikLampu', label: 'Titik Lampu', default: 15 },
                    { id: 'jumlahTitikStopKontak', label: 'Titik Stop Kontak', default: 10 },
                    { id: 'panjangKabel', label: 'Total Panjang Kabel (m)', default: 120 }
                ],
                calculate(v) {
                    return [
                        { nama: 'Kabel NYM 2x1.5mm', satuan: 'Meter', volume: bqR2(v.panjangKabel * 1.1), harga: BQ_HARGA.kabelNYM },
                        { nama: 'Titik Lampu (Fitting+Lampu LED)', satuan: 'Titik', volume: v.jumlahTitikLampu, harga: BQ_HARGA.lampu },
                        { nama: 'Saklar', satuan: 'Unit', volume: Math.ceil(v.jumlahTitikLampu / 2), harga: BQ_HARGA.saklar },
                        { nama: 'Stop Kontak', satuan: 'Unit', volume: v.jumlahTitikStopKontak, harga: BQ_HARGA.stopKontak },
                        { nama: 'MCB & Box Panel', satuan: 'Unit', volume: 1, harga: BQ_HARGA.panelListrik },
                        { nama: 'Pipa Conduit PVC 5/8', satuan: 'Batang', volume: Math.ceil(v.panjangKabel / 4), harga: 18000 }
                    ];
                }
            },
            'Struktur Bawah Jembatan': {
                metode: 'Volume Beton Abutment/Pilar = Jumlah x P x L x T. Rasio tulangan struktur bawah jembatan umumnya lebih tinggi dari bangunan gedung.',
                fields: [
                    { id: 'jumlahAbutment', label: 'Jumlah Abutment/Pilar', default: 2 },
                    { id: 'panjang', label: 'Panjang (m)', default: 6 },
                    { id: 'lebar', label: 'Lebar (m)', default: 2 },
                    { id: 'tinggi', label: 'Tinggi (m)', default: 5 },
                    { id: 'rasioBesi', label: 'Rasio Besi (Kg/m3)', default: 180 }
                ],
                calculate(v) {
                    const volume = v.jumlahAbutment * v.panjang * v.lebar * v.tinggi;
                    const bekisting = v.jumlahAbutment * 2 * (v.panjang + v.lebar) * v.tinggi;
                    return bqBetonBreakdown(volume, v.rasioBesi, bekisting);
                }
            },
            'Struktur Atas Jembatan': {
                metode: 'Volume Beton Girder & Plat Lantai = Jumlah x P x L x T. Kebutuhan besi mengikuti rasio tulangan girder.',
                fields: [
                    { id: 'jumlahGirder', label: 'Jumlah Girder', default: 4 },
                    { id: 'panjangGirder', label: 'Panjang Girder (m)', default: 20 },
                    { id: 'lebarGirder', label: 'Lebar Girder (m)', default: 0.6 },
                    { id: 'tinggiGirder', label: 'Tinggi Girder (m)', default: 1.2 },
                    { id: 'rasioBesi', label: 'Rasio Besi (Kg/m3)', default: 200 }
                ],
                calculate(v) {
                    const volume = v.jumlahGirder * v.panjangGirder * v.lebarGirder * v.tinggiGirder;
                    const bekisting = v.jumlahGirder * 2 * v.panjangGirder * (v.lebarGirder + v.tinggiGirder);
                    return bqBetonBreakdown(volume, v.rasioBesi, bekisting);
                }
            },
            'Pekerjaan Bekisting & Perancah Jembatan': {
                metode: 'Kebutuhan material dihitung dari luas total bidang bekisting dan tinggi perancah (scaffolding).',
                fields: [
                    { id: 'luasBekisting', label: 'Luas Bekisting (m2)', default: 80 },
                    { id: 'tinggiPerancah', label: 'Tinggi Perancah (m)', default: 5 }
                ],
                calculate(v) {
                    return [
                        { nama: 'Bekisting Multiplek 18mm + Kayu', satuan: 'm2', volume: bqR2(v.luasBekisting), harga: 185000 },
                        { nama: 'Scaffolding / Perancah', satuan: 'Set', volume: Math.ceil(v.luasBekisting / 2 / (v.tinggiPerancah || 1)), harga: 450000 },
                        { nama: 'Paku & Kawat Bendrat', satuan: 'Kg', volume: bqR2(v.luasBekisting * 0.5), harga: BQ_HARGA.paku },
                        { nama: 'Minyak Bekisting', satuan: 'Liter', volume: bqR2(v.luasBekisting * 0.2), harga: BQ_HARGA.minyakBekisting }
                    ];
                }
            },
            'Pekerjaan Sandaran & Expansion Joint': {
                metode: 'Kebutuhan railing sandaran dihitung per meter panjang; expansion joint dihitung per unit titik dilatasi.',
                fields: [
                    { id: 'panjangSandaran', label: 'Panjang Sandaran (m)', default: 40 },
                    { id: 'jumlahExpansionJoint', label: 'Jumlah Titik Expansion Joint', default: 2 }
                ],
                calculate(v) {
                    return [
                        { nama: 'Railing Sandaran Besi/Beton', satuan: 'm', volume: bqR2(v.panjangSandaran), harga: 650000 },
                        { nama: 'Cat Anti Karat Railing', satuan: 'Kg', volume: bqR2(v.panjangSandaran * 0.3), harga: BQ_HARGA.catKayuBesi },
                        { nama: 'Expansion Joint (Asphaltic Plug/Rubber)', satuan: 'Unit', volume: v.jumlahExpansionJoint, harga: 8500000 },
                        { nama: 'Sealant Joint', satuan: 'Tube', volume: v.jumlahExpansionJoint * 4, harga: 65000 }
                    ];
                }
            },
            'Pekerjaan Tanah Jalan': {
                metode: 'Volume Galian/Timbunan = Panjang x Lebar x Tebal. Pemadatan dihitung per m2 luas jalan.',
                fields: [
                    { id: 'panjangJalan', label: 'Panjang Jalan (m)', default: 200 },
                    { id: 'lebarJalan', label: 'Lebar Jalan (m)', default: 6 },
                    { id: 'tebalGalianTimbunan', label: 'Tebal Galian/Timbunan (m)', default: 0.3 }
                ],
                calculate(v) {
                    const volume = v.panjangJalan * v.lebarJalan * v.tebalGalianTimbunan;
                    const luas = v.panjangJalan * v.lebarJalan;
                    return [
                        { nama: 'Galian Tanah Biasa (Alat Berat)', satuan: 'm3', volume: bqR2(volume * 0.5), harga: 55000 },
                        { nama: 'Timbunan Tanah Pilihan', satuan: 'm3', volume: bqR2(volume * 0.5), harga: 145000 },
                        { nama: 'Pemadatan Tanah (Compaction)', satuan: 'm2', volume: bqR2(luas), harga: 12000 }
                    ];
                }
            },
            'Lapis Pondasi Jalan': {
                metode: 'Volume Agregat = Panjang x Lebar x Tebal Lapisan Pondasi.',
                fields: [
                    { id: 'panjangJalan', label: 'Panjang Jalan (m)', default: 200 },
                    { id: 'lebarJalan', label: 'Lebar Jalan (m)', default: 6 },
                    { id: 'tebalLapisan', label: 'Tebal Lapisan (m)', default: 0.15 },
                    { id: 'jenisAgregat', label: 'Jenis Agregat', type: 'select', full: true, options: [{ value: 'Agregat Kelas A', label: 'Agregat Kelas A' }, { value: 'Agregat Kelas B', label: 'Agregat Kelas B' }, { value: 'Sirtu', label: 'Sirtu' }] }
                ],
                calculate(v) {
                    const volume = v.panjangJalan * v.lebarJalan * v.tebalLapisan;
                    const hargaAgregat = { 'Agregat Kelas A': BQ_HARGA.agregatA, 'Agregat Kelas B': BQ_HARGA.agregatB, 'Sirtu': BQ_HARGA.sirtu }[v.jenisAgregat];
                    return [
                        { nama: v.jenisAgregat, satuan: 'm3', volume: bqR2(volume * 1.15), harga: hargaAgregat },
                        { nama: 'Sewa Alat Pemadat (Vibro Roller)', satuan: 'Hari', volume: Math.ceil(volume / 150), harga: 2200000 }
                    ];
                }
            },
            'Perkerasan Aspal': {
                metode: 'Volume Aspal = Panjang x Lebar x Tebal, dikonversi ke Ton dengan berat jenis ±2.3 ton/m3.',
                fields: [
                    { id: 'panjangJalan', label: 'Panjang Jalan (m)', default: 200 },
                    { id: 'lebarJalan', label: 'Lebar Jalan (m)', default: 6 },
                    { id: 'tebalAspal', label: 'Tebal Aspal (m)', default: 0.05 },
                    { id: 'jenisAspal', label: 'Jenis Aspal', type: 'select', full: true, options: [{ value: 'AC-WC', label: 'AC-WC' }, { value: 'AC-BC', label: 'AC-BC' }, { value: 'AC-Base', label: 'AC-Base' }] }
                ],
                calculate(v) {
                    const volume = v.panjangJalan * v.lebarJalan * v.tebalAspal;
                    const luas = v.panjangJalan * v.lebarJalan;
                    return [
                        { nama: `Aspal Hotmix ${v.jenisAspal}`, satuan: 'Ton', volume: bqR2(volume * 2.3), harga: BQ_HARGA.aspalHotmix },
                        { nama: 'Prime Coat', satuan: 'Liter', volume: bqR2(luas * 0.6), harga: BQ_HARGA.aspalPrimeCoat },
                        { nama: 'Tack Coat', satuan: 'Liter', volume: bqR2(luas * 0.4), harga: BQ_HARGA.aspalTackCoat }
                    ];
                }
            },
            'Perkerasan Beton Jalan': {
                metode: 'Volume Beton Rigid Pavement = Panjang x Lebar x Tebal. Wiremesh dihitung per m2 permukaan bila digunakan.',
                fields: [
                    { id: 'panjangJalan', label: 'Panjang Jalan (m)', default: 200 },
                    { id: 'lebarJalan', label: 'Lebar Jalan (m)', default: 6 },
                    { id: 'tebalBeton', label: 'Tebal Beton (m)', default: 0.2 },
                    { id: 'pakaiWiremesh', label: 'Pakai Wiremesh', type: 'select', full: true, options: [{ value: 'Ya', label: 'Ya' }, { value: 'Tidak', label: 'Tidak' }] }
                ],
                calculate(v) {
                    const volume = v.panjangJalan * v.lebarJalan * v.tebalBeton;
                    const luas = v.panjangJalan * v.lebarJalan;
                    const items = bqBetonBreakdown(volume, 0, 0);
                    if (v.pakaiWiremesh === 'Ya') {
                        items.push({ nama: 'Wiremesh M8', satuan: 'Lembar', volume: Math.ceil(luas / 5.4), harga: BQ_HARGA.wiremesh });
                    }
                    items.push({ nama: 'Dowel & Tie Bar', satuan: 'Kg', volume: bqR2(luas * 1.2), harga: BQ_HARGA.besi });
                    items.push({ nama: 'Sealant Expansion Joint', satuan: 'm', volume: bqR2(v.panjangJalan), harga: 45000 });
                    return items;
                }
            },
            'Marka & Perlengkapan Jalan': {
                metode: 'Volume cat marka dihitung dari luas garis marka (panjang x lebar). Rambu dihitung per unit.',
                fields: [
                    { id: 'panjangMarka', label: 'Panjang Marka (m)', default: 500 },
                    { id: 'lebarMarka', label: 'Lebar Marka (m)', default: 0.12 },
                    { id: 'jumlahRambu', label: 'Jumlah Rambu', default: 6 }
                ],
                calculate(v) {
                    const luasMarka = v.panjangMarka * v.lebarMarka;
                    return [
                        { nama: 'Cat Marka Jalan Thermoplastic', satuan: 'Kg', volume: bqR2(luasMarka * 3.5), harga: BQ_HARGA.thermoplastic },
                        { nama: 'Glass Bead (Reflektif)', satuan: 'Kg', volume: bqR2(luasMarka * 0.4), harga: 65000 },
                        { nama: 'Rambu Lalu Lintas', satuan: 'Unit', volume: v.jumlahRambu, harga: BQ_HARGA.rambuJalan }
                    ];
                }
            },
            'Saluran Drainase Terbuka': {
                metode: 'Volume Pasangan Batu Kali dihitung dari keliling penampang basah x tebal pasangan x panjang saluran.',
                fields: [
                    { id: 'panjangSaluran', label: 'Panjang Saluran (m)', default: 50 },
                    { id: 'lebarDalam', label: 'Lebar Dalam Saluran (m)', default: 0.4 },
                    { id: 'tinggiDalam', label: 'Tinggi Dalam Saluran (m)', default: 0.5 },
                    { id: 'tebalPasangan', label: 'Tebal Pasangan (m)', default: 0.15 }
                ],
                calculate(v) {
                    const keliling = 2 * v.tinggiDalam + v.lebarDalam;
                    const volumePasangan = keliling * v.tebalPasangan * v.panjangSaluran;
                    return [
                        { nama: 'Batu Kali/Belah', satuan: 'm3', volume: bqR2(volumePasangan * 1.2), harga: BQ_HARGA.batuKali },
                        { nama: 'Semen Pasang Batu Kali', satuan: 'Sak', volume: bqR2(volumePasangan * 3.26), harga: BQ_HARGA.semenMortar },
                        { nama: 'Pasir Pasang', satuan: 'm3', volume: bqR2(volumePasangan * 0.52), harga: BQ_HARGA.pasirPasang },
                        { nama: 'Semen Plesteran & Acian Saluran', satuan: 'Sak', volume: bqR2(v.panjangSaluran * (v.lebarDalam + 2 * v.tinggiDalam) * 0.2), harga: BQ_HARGA.semenMortar }
                    ];
                }
            },
            'Saluran Drainase Tertutup': {
                metode: 'Jumlah unit Box Culvert/Buis Beton dihitung dari panjang saluran dibagi panjang per unit (umumnya 1m/unit).',
                fields: [
                    { id: 'panjangSaluran', label: 'Panjang Saluran (m)', default: 30 },
                    { id: 'jenisSaluran', label: 'Jenis Saluran', type: 'select', full: true, options: [{ value: 'Box Culvert', label: 'Box Culvert' }, { value: 'Gorong-gorong (Buis Beton)', label: 'Gorong-gorong (Buis Beton)' }] },
                    { id: 'diameterUkuran', label: 'Ukuran/Diameter (mis. 80cm)', type: 'text', default: '80cm' }
                ],
                calculate(v) {
                    const jumlahUnit = Math.ceil(v.panjangSaluran / 1);
                    const items = [];
                    if (v.jenisSaluran === 'Box Culvert') {
                        items.push({ nama: `Box Culvert Precast ${v.diameterUkuran}`, satuan: 'Unit', volume: jumlahUnit, harga: BQ_HARGA.boxCulvert });
                    } else {
                        items.push({ nama: `Buis Beton / Gorong-gorong Ø${v.diameterUkuran}`, satuan: 'Unit', volume: jumlahUnit, harga: BQ_HARGA.buisBeton });
                    }
                    items.push({ nama: 'Beton Cor Sambungan & Alas', satuan: 'm3', volume: bqR2(v.panjangSaluran * 0.15), harga: 950000 });
                    items.push({ nama: 'Pasir Urug Alas Saluran', satuan: 'm3', volume: bqR2(v.panjangSaluran * 0.2), harga: BQ_HARGA.pasirPasang });
                    return items;
                }
            },
            'Pekerjaan Talud & Perkuatan Tebing': {
                metode: 'Volume/jumlah material perkuatan dihitung dari luas bidang talud (Panjang x Tinggi).',
                fields: [
                    { id: 'panjangTalud', label: 'Panjang Talud (m)', default: 40 },
                    { id: 'tinggiTalud', label: 'Tinggi Talud (m)', default: 3 },
                    { id: 'jenisPerkuatan', label: 'Jenis Perkuatan', type: 'select', full: true, options: [{ value: 'Bronjong Kawat', label: 'Bronjong Kawat' }, { value: 'Pasangan Batu', label: 'Pasangan Batu' }, { value: 'Turap Beton', label: 'Turap Beton' }] }
                ],
                calculate(v) {
                    const luas = v.panjangTalud * v.tinggiTalud;
                    const items = [];
                    if (v.jenisPerkuatan === 'Bronjong Kawat') {
                        items.push({ nama: 'Bronjong Kawat 2x1x0.5m', satuan: 'Unit', volume: Math.ceil(luas / 2), harga: BQ_HARGA.bronjong });
                        items.push({ nama: 'Batu Isian Bronjong', satuan: 'm3', volume: bqR2(luas * 0.5), harga: BQ_HARGA.batuKali });
                        items.push({ nama: 'Geotextile Non Woven', satuan: 'm2', volume: bqR2(luas * 1.1), harga: BQ_HARGA.geotextile });
                    } else if (v.jenisPerkuatan === 'Pasangan Batu') {
                        items.push({ nama: 'Batu Kali/Belah', satuan: 'm3', volume: bqR2(luas * 0.6), harga: BQ_HARGA.batuKali });
                        items.push({ nama: 'Semen Pasang Batu', satuan: 'Sak', volume: bqR2(luas * 0.6 * 3.26), harga: BQ_HARGA.semenMortar });
                        items.push({ nama: 'Pasir Pasang', satuan: 'm3', volume: bqR2(luas * 0.6 * 0.52), harga: BQ_HARGA.pasirPasang });
                    } else {
                        items.push({ nama: 'Turap Beton Precast', satuan: 'm2', volume: bqR2(luas), harga: BQ_HARGA.turapBeton });
                        items.push({ nama: 'Balok Capping Beam', satuan: 'm3', volume: bqR2(v.panjangTalud * 0.3 * 0.4), harga: 950000 });
                    }
                    return items;
                }
            },
            'Pekerjaan Irigasi': {
                metode: 'Volume pasangan saluran dihitung sama seperti drainase terbuka; pintu air dihitung per unit.',
                fields: [
                    { id: 'panjangSaluranIrigasi', label: 'Panjang Saluran (m)', default: 60 },
                    { id: 'lebarSaluran', label: 'Lebar Dalam Saluran (m)', default: 0.5 },
                    { id: 'tinggiSaluran', label: 'Tinggi Dalam Saluran (m)', default: 0.6 },
                    { id: 'jumlahPintuAir', label: 'Jumlah Pintu Air', default: 2 }
                ],
                calculate(v) {
                    const keliling = 2 * v.tinggiSaluran + v.lebarSaluran;
                    const volumePasangan = keliling * 0.15 * v.panjangSaluranIrigasi;
                    return [
                        { nama: 'Batu Kali/Belah', satuan: 'm3', volume: bqR2(volumePasangan * 1.2), harga: BQ_HARGA.batuKali },
                        { nama: 'Semen Pasang Batu Kali', satuan: 'Sak', volume: bqR2(volumePasangan * 3.26), harga: BQ_HARGA.semenMortar },
                        { nama: 'Pasir Pasang', satuan: 'm3', volume: bqR2(volumePasangan * 0.52), harga: BQ_HARGA.pasirPasang },
                        { nama: 'Pintu Air Sorong Besi', satuan: 'Unit', volume: v.jumlahPintuAir, harga: 3500000 }
                    ];
                }
            },
            'Pekerjaan Landscape & Site': {
                metode: 'Kebutuhan material dihitung terpisah untuk area paving, taman, dan pagar sesuai luas/panjang masing-masing.',
                fields: [
                    { id: 'luasPaving', label: 'Luas Paving (m2)', default: 80 },
                    { id: 'luasTaman', label: 'Luas Taman (m2)', default: 60 },
                    { id: 'panjangPagar', label: 'Panjang Pagar (m)', default: 30 }
                ],
                calculate(v) {
                    return [
                        { nama: 'Paving Block K300', satuan: 'm2', volume: bqR2(v.luasPaving * 1.05), harga: BQ_HARGA.pavingBlock },
                        { nama: 'Pasir Alas Paving', satuan: 'm3', volume: bqR2(v.luasPaving * 0.05), harga: BQ_HARGA.pasirPasang },
                        { nama: 'Kanstin Beton', satuan: 'm', volume: bqR2(Math.sqrt(v.luasPaving) * 4), harga: BQ_HARGA.kanstin },
                        { nama: 'Tanah Subur / Humus', satuan: 'm3', volume: bqR2(v.luasTaman * 0.2), harga: BQ_HARGA.tanahSubur },
                        { nama: 'Rumput Gajah Mini', satuan: 'm2', volume: bqR2(v.luasTaman * 1.05), harga: BQ_HARGA.rumputGajah },
                        { nama: 'Pagar Panel BRC', satuan: 'm', volume: bqR2(v.panjangPagar), harga: BQ_HARGA.pagarBrc }
                    ];
                }
            },
            'Pekerjaan Mekanikal & Elektrikal Kawasan': {
                metode: 'Kebutuhan kabel bawah tanah dihitung dari panjang jalur; lampu jalan & panel dihitung per unit.',
                fields: [
                    { id: 'panjangKabelTegangan', label: 'Panjang Kabel Tegangan (m)', default: 200 },
                    { id: 'jumlahTitikLampuJalan', label: 'Titik Lampu Jalan (PJU)', default: 10 },
                    { id: 'jumlahPanel', label: 'Jumlah Panel Distribusi', default: 1 }
                ],
                calculate(v) {
                    return [
                        { nama: 'Kabel NYFGbY Bawah Tanah', satuan: 'Meter', volume: bqR2(v.panjangKabelTegangan * 1.1), harga: BQ_HARGA.kabelTanam },
                        { nama: 'Lampu PJU (Penerangan Jalan Umum)', satuan: 'Unit', volume: v.jumlahTitikLampuJalan, harga: BQ_HARGA.lampuTaman },
                        { nama: 'Tiang Lampu PJU', satuan: 'Unit', volume: v.jumlahTitikLampuJalan, harga: 2500000 },
                        { nama: 'Panel Distribusi Kawasan', satuan: 'Unit', volume: v.jumlahPanel, harga: 4500000 }
                    ];
                }
            }
        };

        // Render form input manual sesuai kategori perhitungan yang dipilih
        function renderBqManualFields() {
            const kategoriEl = document.getElementById('bqKategori');
            const container = document.getElementById('bqManualFieldsContainer');
            const metodeEl = document.getElementById('bqManualMetode');
            if (!kategoriEl || !container || !metodeEl) return;
            const kategori = kategoriEl.value;
            const cfg = bqCategoryConfig[kategori];
            if (!cfg) {
                container.innerHTML = '';
                metodeEl.innerHTML = `Kategori "<span class="text-slate-300 font-semibold">${kategori}</span>" belum memiliki metode input manual otomatis. Gunakan mode upload gambar AI di atas.`;
                return;
            }
            metodeEl.innerHTML = `<span class="text-slate-300 font-semibold">Metode:</span> ${cfg.metode}`;
            container.innerHTML = cfg.fields.map(f => {
                const colClass = f.full ? 'col-span-2' : '';
                if (f.type === 'select') {
                    const opts = f.options.map((o, i) => `<option value="${o.value}" ${i === 0 ? 'selected' : ''}>${o.label}</option>`).join('');
                    return `<div class="${colClass}">
                        <label class="block text-slate-500 text-[10px] mb-0.5">${f.label}</label>
                        <select id="bqf_${f.id}" class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-2 py-1.5 text-white text-[11px]">${opts}</select>
                    </div>`;
                }
                if (f.type === 'text') {
                    return `<div class="${colClass}">
                        <label class="block text-slate-500 text-[10px] mb-0.5">${f.label}</label>
                        <input type="text" id="bqf_${f.id}" value="${f.default !== undefined ? f.default : ''}" class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-2 py-1.5 text-white text-[11px]">
                    </div>`;
                }
                return `<div class="${colClass}">
                    <label class="block text-slate-500 text-[10px] mb-0.5">${f.label}</label>
                    <input type="number" id="bqf_${f.id}" step="any" value="${f.default !== undefined ? f.default : ''}" placeholder="0" class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-2 py-1.5 text-white text-[11px]">
                </div>`;
            }).join('');
        }

        // Hitung kebutuhan material dari input manual sesuai kategori pekerjaan yang dipilih
        function calculateBqManual() {
            if (!canUserEdit()) { alert('Akses ditolak. Admin telah menonaktifkan izin edit akun Anda untuk proyek ini.'); return; }
            const kategori = document.getElementById('bqKategori').value;
            const cfg = bqCategoryConfig[kategori];
            if (!cfg) {
                alert(`Kategori "${kategori}" belum mendukung input manual. Silakan gunakan mode upload gambar AI di atas.`);
                return;
            }
            const values = {};
            let hasEmpty = false;
            cfg.fields.forEach(f => {
                const el = document.getElementById('bqf_' + f.id);
                if (!el) return;
                if (f.type === 'select' || f.type === 'text') {
                    values[f.id] = el.value;
                    if (f.type === 'text' && el.value.trim() === '') hasEmpty = true;
                } else {
                    const val = parseFloat(el.value);
                    values[f.id] = isNaN(val) ? 0 : val;
                    if (el.value === '' || isNaN(val)) hasEmpty = true;
                }
            });
            if (hasEmpty) {
                alert('Mohon lengkapi seluruh input pada form input manual sebelum menghitung.');
                return;
            }
            const materials = cfg.calculate(values);
            if (!materials || materials.length === 0) {
                alert('Perhitungan tidak menghasilkan data material. Periksa kembali input Anda.');
                return;
            }
            bqResultsData = materials.map((m, idx) => ({ id: Date.now() + idx, nama: m.nama, satuan: m.satuan, volume: m.volume, harga: m.harga }));
            localStorage.setItem('erp_bq_results', JSON.stringify(bqResultsData));
            renderBqResultsTable();
            alert(`Perhitungan manual untuk kategori "${kategori}" berhasil! ${materials.length} jenis material beserta kebutuhannya berhasil ditampilkan.`);
        }

        function importBqToKebutuhanMaterial() {
            if (!canUserEdit()) { alert('Akses ditolak. Admin telah menonaktifkan izin edit akun Anda untuk proyek ini.'); return; }
            if (bqResultsData.length === 0) {
                alert('Belum ada hasil kalkulasi Backup Quantity!');
                return;
            }
            bqResultsData.forEach(item => {
                kebutuhanMatData.push({
                    id: Date.now() + Math.random(),
                    projId: activeProjectId,
                    nama: item.nama,
                    satuan: item.satuan,
                    volume: item.volume,
                    harga: item.harga,
                    supplier: 'Hasil Backup Quantity AI'
                });
            });
            localStorage.setItem('erp_kebutuhan_mat', JSON.stringify(kebutuhanMatData));
            alert('Semua hasil Backup Quantity berhasil dimasukkan ke halaman Kebutuhan Material!');
            switchTab('mat-kebutuhan');
        }

        // ===================================================================
        // 5. ABSENSI & KARYAWAN
