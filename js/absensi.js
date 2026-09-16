        // ===================================================================
        function renderAbsenSection() {
            const isMasuk = activeAbsenType === 'absen-masuk';
            document.getElementById('absenTitle').innerHTML = isMasuk ? `<i class="fa-solid fa-right-to-bracket text-emerald-400"></i><span>Absen Masuk (Kamera & GPS)</span>` : `<i class="fa-solid fa-right-from-bracket text-rose-400"></i><span>Absen Keluar (Kamera & GPS)</span>`;
            document.getElementById('absenListTitle').innerText = isMasuk ? 'Riwayat Presensi Masuk' : 'Riwayat Presensi Keluar';

            const tbody = document.getElementById('absenTableBody');
            tbody.innerHTML = '';
            const data = (isMasuk ? absenMasukData : absenKeluarData).filter(d => d.projId === activeProjectId);

            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-500">Belum ada riwayat absensi.</td></tr>`;
                return;
            }

            // Urutkan berdasarkan waktu absen, terbaru di atas (paling mudah dicari), dan tidak lagi mengandalkan
            // urutan input data mentah (yang bisa acak-acakan setelah sinkronisasi cloud/edit foto)
            const sortedData = data.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
            let currentMonthKey = null;
            let rowsHtml = '';
            sortedData.forEach(item => {
                // Sisipkan baris pemisah setiap kali data berpindah bulan
                const monthKey = (item.tanggal || '').slice(0, 7); // "YYYY-MM"
                if (monthKey && monthKey !== currentMonthKey) {
                    rowsHtml += buildMonthSeparatorRow(item.tanggal, 5);
                    currentMonthKey = monthKey;
                }

                const mapsLink = (item.lat != null && item.lng != null) ? `https://www.google.com/maps?q=${item.lat},${item.lng}` : null;
                const alamatText = item.alamat || item.lokasi || '-';
                rowsHtml += `
                    <tr class="hover:bg-slate-800/50 transition align-middle">
                        <td class="p-3"><div class="w-14 h-14 rounded-lg overflow-hidden bg-slate-800 cursor-pointer" onclick="openAbsenPhotoModal(${item.id}, ${isMasuk})"><img src="${item.photo}" class="w-full h-full object-cover"></div></td>
                        <td class="p-3 font-bold text-white">${item.nama}${item.jamKerja ? `<div class="text-[10px] font-normal text-emerald-400 mt-0.5"><i class="fa-solid fa-business-time mr-1"></i>${item.jamKerja}</div>` : ''}</td>
                        <td class="p-3 font-mono text-amber-400">${item.waktu}</td>
                        <td class="p-3 text-[11px] text-slate-300 max-w-[220px]">
                            <div class="break-words leading-snug"><i class="fa-solid fa-location-dot text-rose-400 mr-1"></i>${alamatText}</div>
                            ${mapsLink ? `<a href="${mapsLink}" target="_blank" rel="noopener" class="text-sky-400 hover:underline text-[10px] inline-flex items-center mt-0.5"><i class="fa-solid fa-map-location-dot mr-1"></i>Buka di Google Maps</a>` : ''}
                        </td>
                        <td class="p-3 text-center space-y-1">
                            <button onclick="openAbsenPhotoModal(${item.id}, ${isMasuk})" class="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded-lg text-xs font-bold w-full"><i class="fa-solid fa-eye mr-1"></i> Lihat/Edit/Hapus</button>
                            <button onclick="shareAbsenWaById(${item.id}, ${isMasuk})" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg text-xs font-bold w-full"><i class="fa-brands fa-whatsapp mr-1"></i> Share WA</button>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = rowsHtml;
        }

        // ===================================================================
        // KAMERA ABSENSI: mendukung kamera depan (user) & belakang (environment) di Android/HP
        // ===================================================================
        function stopWebcamStream() {
            if (webcamStream) {
                webcamStream.getTracks().forEach(track => track.stop());
                webcamStream = null;
            }
        }

        function startWebcam(preferredFacingMode) {
            const video = document.getElementById('webcamVideo');
            const errorOverlay = document.getElementById('webcamErrorOverlay');
            if (!video) return;
            if (errorOverlay) errorOverlay.classList.add('hidden');

            if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
                console.warn('Kamera tidak didukung di browser/perangkat ini.');
                if (errorOverlay) errorOverlay.classList.remove('hidden');
                return;
            }

            const facingMode = preferredFacingMode || currentFacingMode || 'user';
            stopWebcamStream();

            // Coba minta kamera sesuai arah (depan/belakang) yang diinginkan - "ideal" agar tetap dapat
            // fallback ke kamera manapun jika perangkat Android hanya memiliki 1 kamera fisik.
            navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facingMode } }, audio: false })
                .then(stream => {
                    webcamStream = stream;
                    video.srcObject = stream;
                    currentFacingMode = facingMode;
                    refreshSwitchCameraButton();
                })
                .catch(err => {
                    console.warn('Kamera dengan facingMode "' + facingMode + '" gagal dibuka, mencoba kamera default:', err);
                    // Fallback ke kamera apapun yang tersedia (beberapa browser Android tidak mendukung facingMode)
                    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
                        .then(stream => {
                            webcamStream = stream;
                            video.srcObject = stream;
                            refreshSwitchCameraButton();
                        })
                        .catch(err2 => {
                            console.warn('Kamera tidak tersedia:', err2);
                            if (errorOverlay) errorOverlay.classList.remove('hidden');
                        });
                });
        }

        // Tampilkan tombol ganti kamera hanya jika perangkat terdeteksi memiliki lebih dari 1 kamera
        function refreshSwitchCameraButton() {
            const btn = document.getElementById('switchCameraBtn');
            if (!btn) return;
            if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
                navigator.mediaDevices.enumerateDevices().then(devices => {
                    const cams = devices.filter(d => d.kind === 'videoinput');
                    btn.classList.toggle('hidden', cams.length < 2);
                }).catch(() => { btn.classList.remove('hidden'); }); // Jika gagal deteksi, tetap tampilkan tombol agar user tetap bisa coba ganti kamera
            } else {
                btn.classList.remove('hidden');
            }
        }

        // Tombol ganti kamera depan <-> belakang, dipakai di halaman Absen Masuk & Absen Keluar (video sama)
        function switchCamera() {
            const nextFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
            startWebcam(nextFacingMode);
        }

        // Jaga-jaga tambahan agar kamera TIDAK terus aktif meskipun user masih berada di halaman Absen Masuk/Keluar:
        // - Saat aplikasi di-minimize / tab browser disembunyikan (document.hidden true) -> kamera langsung dimatikan.
        // - Saat aplikasi kembali dibuka/terlihat lagi DAN user masih di halaman Absen Masuk/Keluar -> kamera dinyalakan ulang.
        // - Saat halaman benar-benar ditinggalkan/ditutup -> kamera dipastikan mati.
        document.addEventListener('visibilitychange', () => {
            const isAbsenCameraTab = (currentTab === 'absen-masuk' || currentTab === 'absen-keluar');
            if (document.hidden) {
                stopWebcamStream();
            } else if (isAbsenCameraTab) {
                startWebcam(currentFacingMode);
            }
        });
        window.addEventListener('pagehide', stopWebcamStream);

        function initGpsLocation() {
            refreshGpsAndAddress();
        }

        // Ambil ulang koordinat GPS (akurasi tinggi) + alamat terkini. Dipanggil saat membuka halaman
        // Absen Masuk/Keluar & sesaat sebelum foto diambil, supaya data pada watermark foto akurat.
        function refreshGpsAndAddress(callback) {
            if (!navigator.geolocation) {
                if (typeof callback === 'function') callback();
                return;
            }
            navigator.geolocation.getCurrentPosition(pos => {
                currentGpsLat = pos.coords.latitude;
                currentGpsLng = pos.coords.longitude;
                currentGpsAccuracy = pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null;
                gpsCoordinates = `${currentGpsLat.toFixed(6)}, ${currentGpsLng.toFixed(6)}` + (currentGpsAccuracy ? ` (±${currentGpsAccuracy}m)` : ' (Akurat)');
                const gpsTextEl = document.getElementById('currentGpsText');
                if (gpsTextEl) gpsTextEl.innerText = gpsCoordinates;
                fetchAddressFromCoords(currentGpsLat, currentGpsLng, callback);
            }, () => {
                const gpsTextEl = document.getElementById('currentGpsText');
                if (gpsTextEl) gpsTextEl.innerText = gpsCoordinates + ' (perkiraan)';
                if (typeof callback === 'function') callback();
            }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 });
        }

        // Reverse-geocoding koordinat -> alamat lengkap, memakai OpenStreetMap Nominatim (gratis, tanpa API key).
        function fetchAddressFromCoords(lat, lng, callback) {
            currentAddressText = 'Mencari alamat...';
            const addrEl = document.getElementById('currentAddressText');
            if (addrEl) addrEl.innerText = currentAddressText;
            if (!window.fetch) {
                currentAddressText = 'Alamat tidak tersedia';
                if (addrEl) addrEl.innerText = currentAddressText;
                if (typeof callback === 'function') callback();
                return;
            }
            const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
            const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, controller ? { signal: controller.signal } : {})
                .then(res => res.json())
                .then(data => {
                    if (timeoutId) clearTimeout(timeoutId);
                    currentAddressText = (data && data.display_name) ? data.display_name : 'Alamat tidak ditemukan';
                    if (addrEl) addrEl.innerText = currentAddressText;
                    if (typeof callback === 'function') callback();
                })
                .catch(() => {
                    if (timeoutId) clearTimeout(timeoutId);
                    currentAddressText = 'Alamat tidak tersedia (periksa koneksi internet)';
                    if (addrEl) addrEl.innerText = currentAddressText;
                    if (typeof callback === 'function') callback();
                });
        }

        // Menggambar frame video ke canvas TANPA efek cermin (mirror), meski beberapa perangkat Android
        // mengirimkan stream kamera depan yang sudah ter-mirror secara bawaan dari getUserMedia. Ini
        // memastikan foto absensi yang tersimpan selalu sesuai orientasi asli (teks/tulisan di latar
        // belakang foto tidak terbalik), khususnya penting untuk keperluan verifikasi kehadiran.
        function drawVideoFrameToCanvas(ctx, video, canvasW, canvasH) {
            ctx.save();
            if (currentFacingMode === 'user') {
                ctx.translate(canvasW, 0);
                ctx.scale(-1, 1);
            }
            ctx.drawImage(video, 0, 0, canvasW, canvasH);
            ctx.restore();
        }

        // Konteks mode EDIT foto absensi (retake foto pada record yang sudah ada, tanpa mengubah data
        // nama/waktu/lokasi aslinya). null jika sedang tidak dalam mode edit.
        let editingAbsenContext = null;

        function editAbsenRecordPhoto(id, isMasuk) {
            closeAbsenPhotoModal();
            editingAbsenContext = { id, isMasuk };
            switchTab(isMasuk ? 'absen-masuk' : 'absen-keluar');
            const snapBtn = document.getElementById('btnTakeSnapshot');
            if (snapBtn) snapBtn.innerHTML = '<i class="fa-solid fa-camera-rotate"></i><span>Ambil Ulang Foto (Edit)</span>';
            const noticeEl = document.getElementById('absenEditNotice');
            if (noticeEl) noticeEl.classList.remove('hidden');
        }

        function cancelEditAbsenPhoto() {
            editingAbsenContext = null;
            const snapBtn = document.getElementById('btnTakeSnapshot');
            if (snapBtn) snapBtn.innerHTML = '<i class="fa-solid fa-camera"></i><span>Ambil Foto & Simpan Absen</span>';
            const noticeEl = document.getElementById('absenEditNotice');
            if (noticeEl) noticeEl.classList.add('hidden');
        }

        // Hapus 1 record absensi (foto + metadata) - lokal & cloud
        function deleteAbsenRecord(id, isMasuk) {
            if (!confirm('Hapus foto & data absensi ini secara permanen?')) return;
            const localKey = isMasuk ? 'erp_absen_masuk' : 'erp_absen_keluar';
            const arr = isMasuk ? absenMasukData : absenKeluarData;
            const idx = arr.findIndex(r => r.id == id);
            if (idx > -1) arr.splice(idx, 1);
            localStorage.setItem(localKey, JSON.stringify(arr));
            if (cloudDb && cloudReady && cloudWorkspaceId) {
                const conf = CLOUD_WORKSPACE_SUBCOLLECTION[localKey];
                if (conf) {
                    cloudDb.collection('workspaces').doc(cloudWorkspaceId).collection(conf.sub).doc(String(id)).delete()
                        .catch(err => showCloudSyncError('Hapus data absensi di cloud', err));
                }
            }
            closeAbsenPhotoModal();
            renderAbsenSection();
        }

        async function takeAttendanceSnapshot() {
            // Absen Masuk/Keluar SENGAJA tidak dikunci oleh izin edit (canUserEdit) - akun User harus tetap
            // bisa melakukan absensi kapan pun, meskipun Admin menonaktifkan izin edit data proyek lainnya.
            const video = document.getElementById('webcamVideo');
            const canvas = document.getElementById('snapshotCanvas');

            const snapBtn = document.getElementById('btnTakeSnapshot');

            // ================= MODE EDIT: ganti foto pada record absensi yang sudah ada =================
            if (editingAbsenContext) {
                const { id, isMasuk } = editingAbsenContext;
                const localKey = isMasuk ? 'erp_absen_masuk' : 'erp_absen_keluar';
                const arr = isMasuk ? absenMasukData : absenKeluarData;
                const existing = arr.find(r => r.id == id);
                if (!existing) { alert('Data absen tidak ditemukan (mungkin sudah dihapus).'); cancelEditAbsenPhoto(); return; }

                if (snapBtn) { snapBtn.disabled = true; snapBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Memproses Foto...</span>'; }
                try {
                    canvas.width = video.videoWidth || 320;
                    canvas.height = video.videoHeight || 240;
                    const ctx = canvas.getContext('2d');
                    drawVideoFrameToCanvas(ctx, video, canvas.width, canvas.height);

                    const proj = projects.find(p => p.id === activeProjectId) || {};
                    let logoImg = null;
                    if (proj.logo) {
                        try { logoImg = await loadImage(proj.logo); } catch (e) { logoImg = null; }
                    }

                    await drawAbsenWatermark(ctx, canvas.width, canvas.height, {
                        isMasuk,
                        namaKaryawan: existing.nama,
                        waktuFoto: new Date(existing.ts || Date.now()),
                        alamat: existing.alamat || existing.lokasi,
                        lat: existing.lat, lng: existing.lng, accuracy: existing.accuracy,
                        namaProyek: proj.nama || 'ProConstruct ERP',
                        logoImg,
                        jamKerjaText: existing.jamKerja
                    });

                    existing.photo = compressCanvasToDataUrl(canvas, 900, 0.72);
                    localStorage.setItem(localKey, JSON.stringify(arr));
                    pushAbsenRecordToCloud(localKey, existing);

                    cancelEditAbsenPhoto();
                    renderAbsenSection();
                    alert('Foto absensi berhasil diperbarui!');
                } finally {
                    if (snapBtn) { snapBtn.disabled = false; snapBtn.innerHTML = editingAbsenContext ? '<i class="fa-solid fa-camera-rotate"></i><span>Ambil Ulang Foto (Edit)</span>' : '<i class="fa-solid fa-camera"></i><span>Ambil Foto & Simpan Absen</span>'; }
                }
                return;
            }

            // ================= MODE NORMAL: rekam absensi baru =================
            const nama = document.getElementById('absenNamaSelect').value;
            if (!nama) { alert('Pilih nama karyawan terlebih dahulu.'); return; }

            if (snapBtn) { snapBtn.disabled = true; snapBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Memproses Foto...</span>'; }

            try {
                canvas.width = video.videoWidth || 320;
                canvas.height = video.videoHeight || 240;
                const ctx = canvas.getContext('2d');
                drawVideoFrameToCanvas(ctx, video, canvas.width, canvas.height);

                const now = new Date();
                const waktu = now.toLocaleString('id-ID');
                const isMasuk = activeAbsenType === 'absen-masuk';

                // Refresh GPS & alamat sesaat sebelum foto diambil, supaya data pada watermark akurat & terkini
                await new Promise(resolve => refreshGpsAndAddress(resolve));

                // Hitung Jam Kerja (khusus Absen Keluar/Pulang): dicari dari record Absen Masuk hari ini milik karyawan yang sama
                let jamKerjaText = null;
                if (!isMasuk) {
                    const todayStr = now.toISOString().split('T')[0];
                    const masukRecords = absenMasukData
                        .filter(a => a.projId === activeProjectId && a.nama === nama && a.tanggal === todayStr)
                        .sort((a, b) => a.ts - b.ts);
                    const masukRecord = masukRecords[0];
                    if (masukRecord) {
                        const diffMs = now.getTime() - masukRecord.ts;
                        const totalMenit = Math.max(0, Math.floor(diffMs / 60000));
                        const jam = Math.floor(totalMenit / 60);
                        const menit = totalMenit % 60;
                        const jamMasukText = new Date(masukRecord.ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                        const jamPulangText = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                        jamKerjaText = `Masuk ${jamMasukText} - Pulang ${jamPulangText} (Total: ${jam} jam ${menit} menit)`;
                    } else {
                        jamKerjaText = 'Data Absen Masuk hari ini tidak ditemukan';
                    }
                }

                const proj = projects.find(p => p.id === activeProjectId) || {};
                let logoImg = null;
                if (proj.logo) {
                    try { logoImg = await loadImage(proj.logo); } catch (e) { logoImg = null; }
                }

                await drawAbsenWatermark(ctx, canvas.width, canvas.height, {
                    isMasuk,
                    namaKaryawan: nama,
                    waktuFoto: now,
                    alamat: currentAddressText,
                    lat: currentGpsLat,
                    lng: currentGpsLng,
                    accuracy: currentGpsAccuracy,
                    namaProyek: proj.nama || 'ProConstruct ERP',
                    logoImg,
                    jamKerjaText
                });

                const photoUrl = compressCanvasToDataUrl(canvas, 900, 0.72);
                // 'ts' & 'tanggal' ditambahkan agar rekap Daftar Hadir bulanan bisa dihitung akurat
                const newRecord = {
                    id: Date.now(), projId: activeProjectId, nama, waktu, ts: now.getTime(),
                    tanggal: now.toISOString().split('T')[0], lokasi: gpsCoordinates,
                    lat: currentGpsLat, lng: currentGpsLng, accuracy: currentGpsAccuracy,
                    alamat: currentAddressText, jamKerja: jamKerjaText, photo: photoUrl
                };

                if (isMasuk) {
                    absenMasukData.push(newRecord);
                    localStorage.setItem('erp_absen_masuk', JSON.stringify(absenMasukData));
                    pushAbsenRecordToCloud('erp_absen_masuk', newRecord);
                } else {
                    absenKeluarData.push(newRecord);
                    localStorage.setItem('erp_absen_keluar', JSON.stringify(absenKeluarData));
                    pushAbsenRecordToCloud('erp_absen_keluar', newRecord);
                }

                renderAbsenSection();
                alert('Absensi berhasil direkam dengan foto, alamat, & koordinat GPS akurat!');
            } finally {
                if (snapBtn) { snapBtn.disabled = false; snapBtn.innerHTML = '<i class="fa-solid fa-camera"></i><span>Ambil Foto & Simpan Absen</span>'; }
            }
        }

        // Muat gambar (dipakai untuk logo perusahaan/proyek pada watermark foto absensi) sebagai Promise
        function loadImage(src) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = src;
            });
        }

        // Perkecil ukuran foto (resize dimensi + kompres JPEG) sebelum disimpan/dikirim ke cloud.
        // Foto kamera asli (apalagi ber-watermark PNG) bisa 1-3 MB per foto - jauh melebihi batas dokumen
        // Firestore (1 MiB), dan juga memberatkan localStorage & kuota data HP. Dengan resize ke maksimal
        // `maxDim` piksel pada sisi terpanjang + kompres JPEG, ukuran foto turun drastis (umumnya jadi
        // puluhan-ratusan KB saja) tanpa terlihat jelas bedanya secara visual.
        function compressCanvasToDataUrl(sourceCanvas, maxDim, quality) {
            let targetW = sourceCanvas.width;
            let targetH = sourceCanvas.height;
            const longestSide = Math.max(targetW, targetH);
            if (longestSide > maxDim) {
                const ratio = maxDim / longestSide;
                targetW = Math.round(targetW * ratio);
                targetH = Math.round(targetH * ratio);
            }
            const outCanvas = document.createElement('canvas');
            outCanvas.width = targetW;
            outCanvas.height = targetH;
            const outCtx = outCanvas.getContext('2d');
            outCtx.drawImage(sourceCanvas, 0, 0, targetW, targetH);
            return outCanvas.toDataURL('image/jpeg', quality || 0.72);
        }

        // Bungkus teks panjang (mis. alamat) menjadi beberapa baris agar muat dalam lebar tertentu pada canvas
        function wrapCanvasText(ctx, text, maxWidth, maxLines) {
            maxLines = maxLines || 2;
            const words = String(text).split(' ');
            const lines = [];
            let current = '';
            for (let i = 0; i < words.length; i++) {
                const test = current ? current + ' ' + words[i] : words[i];
                if (ctx.measureText(test).width <= maxWidth) {
                    current = test;
                } else {
                    if (current) lines.push(current);
                    current = words[i];
                    if (lines.length >= maxLines) break;
                }
            }
            if (current && lines.length < maxLines) lines.push(current);
            const totalWordsUsed = lines.join(' ').split(' ').length;
            if (lines.length === maxLines && totalWordsUsed < words.length) {
                let lastLine = lines[maxLines - 1];
                while (ctx.measureText(lastLine + '...').width > maxWidth && lastLine.length > 1) {
                    lastLine = lastLine.slice(0, -1);
                }
                lines[maxLines - 1] = lastLine.trimEnd() + '...';
            }
            return lines;
        }

        // Path rounded-rectangle generik dipakai oleh badge label & mini peta skematik
        function roundRectPath(ctx, x, y, w, h, r) {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
        }

        // Mini peta skematik (grid + pin lokasi) digambar langsung di canvas - tidak memuat tile peta dari
        // server eksternal, supaya foto absensi tetap bisa disimpan (toDataURL) tanpa risiko error CORS/tainted canvas.
        function drawSchematicMap(ctx, x, y, w, h, pinColor) {
            ctx.save();
            roundRectPath(ctx, x, y, w, h, 6);
            ctx.clip();
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = 'rgba(148,163,184,0.35)';
            ctx.lineWidth = 1;
            const gridStep = w / 4;
            for (let i = 1; i < 4; i++) {
                ctx.beginPath(); ctx.moveTo(x + i * gridStep, y); ctx.lineTo(x + i * gridStep, y + h); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(x, y + i * gridStep); ctx.lineTo(x + w, y + i * gridStep); ctx.stroke();
            }
            ctx.strokeStyle = 'rgba(56,189,248,0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, y + h * 0.65);
            ctx.bezierCurveTo(x + w * 0.3, y + h * 0.5, x + w * 0.6, y + h * 0.85, x + w, y + h * 0.55);
            ctx.stroke();
            ctx.restore();

            const cx = x + w / 2, cy = y + h / 2 - h * 0.06;
            ctx.fillStyle = pinColor;
            ctx.beginPath();
            ctx.arc(cx, cy, w * 0.11, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx - w * 0.09, cy + w * 0.06);
            ctx.lineTo(cx + w * 0.09, cy + w * 0.06);
            ctx.lineTo(cx, cy + w * 0.28);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(cx, cy, w * 0.045, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 1;
            roundRectPath(ctx, x, y, w, h, 6);
            ctx.stroke();

            ctx.fillStyle = 'rgba(15,23,42,0.85)';
            ctx.fillRect(x, y + h - 12, w, 12);
            ctx.fillStyle = '#e2e8f0';
            ctx.font = `bold ${Math.max(7, w * 0.13)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText('PETA', x + w / 2, y + h - 3);
            ctx.textAlign = 'left';
        }

        // Menempelkan watermark lengkap ke foto absensi: logo perusahaan/proyek, label Foto Absen Masuk/Pulang,
        // nama karyawan, tanggal & waktu foto, alamat lengkap, koordinat GPS akurat, mini peta, dan (khusus
        // Absen Pulang) total jam kerja sejak Absen Masuk.
        function drawAbsenWatermark(ctx, w, h, opts) {
            return new Promise(resolve => {
                const scale = Math.max(0.55, Math.min(2.2, w / 640));
                const pad = 10 * scale;
                const fontSizeSmall = 11 * scale;
                const fontSizeBase = 12.5 * scale;
                const fontSizeTitle = 15 * scale;
                const lineHeight = fontSizeBase * 1.5;

                const hariList = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                const bulanList = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
                const d = opts.waktuFoto;
                const tglText = `${hariList[d.getDay()]}, ${d.getDate()} ${bulanList[d.getMonth()]} ${d.getFullYear()} - ${d.toLocaleTimeString('id-ID')}`;
                const koordText = (opts.lat != null && opts.lng != null)
                    ? `${opts.lat.toFixed(6)}, ${opts.lng.toFixed(6)}` + (opts.accuracy ? ` (Akurasi ±${opts.accuracy}m)` : '')
                    : 'Koordinat tidak tersedia';

                const logoSize = 40 * scale;
                const mapBoxSize = 66 * scale;
                const textX = pad + logoSize + pad;
                const maxTextWidth = w - textX - pad - mapBoxSize - pad;

                ctx.font = `${fontSizeSmall}px Arial`;
                const addressLines = wrapCanvasText(ctx, 'Alamat: ' + (opts.alamat || '-'), Math.max(40, maxTextWidth), 2);

                const lines = [
                    { text: opts.namaKaryawan, bold: true, size: fontSizeTitle, color: '#ffffff' },
                    { text: tglText, size: fontSizeBase, color: '#facc15' },
                    ...addressLines.map(t => ({ text: t, size: fontSizeSmall, color: '#e2e8f0' })),
                    { text: koordText, size: fontSizeSmall, color: '#38bdf8' }
                ];
                if (opts.jamKerjaText) {
                    lines.push({ text: 'Jam Kerja: ' + opts.jamKerjaText, size: fontSizeSmall, bold: true, color: '#34d399' });
                }

                const panelHeight = Math.max(pad * 2 + logoSize + 6 * scale, pad * 2 + fontSizeSmall + (10 * scale) + (lines.length * lineHeight));
                const panelY = h - panelHeight;

                // Latar gradien gelap transparan
                const grad = ctx.createLinearGradient(0, panelY, 0, h);
                grad.addColorStop(0, 'rgba(3,7,18,0.10)');
                grad.addColorStop(0.25, 'rgba(3,7,18,0.80)');
                grad.addColorStop(1, 'rgba(3,7,18,0.94)');
                ctx.fillStyle = grad;
                ctx.fillRect(0, panelY, w, panelHeight);

                // Garis aksen atas: hijau (Absen Masuk) / merah muda (Absen Pulang)
                ctx.fillStyle = opts.isMasuk ? '#10b981' : '#f43f5e';
                ctx.fillRect(0, panelY, w, 3 * scale);

                // Logo perusahaan/proyek (bulat) - fallback ke inisial jika belum ada logo
                const logoY = panelY + pad;
                if (opts.logoImg) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(pad + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
                    ctx.closePath();
                    ctx.clip();
                    ctx.drawImage(opts.logoImg, pad, logoY, logoSize, logoSize);
                    ctx.restore();
                } else {
                    ctx.fillStyle = '#f59e0b';
                    ctx.beginPath();
                    ctx.arc(pad + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#0f172a';
                    ctx.font = `bold ${16 * scale}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const initials = String(opts.namaProyek || 'PC').trim().split(/\s+/).map(word => word[0]).slice(0, 2).join('').toUpperCase();
                    ctx.fillText(initials, pad + logoSize / 2, logoY + logoSize / 2 + 1);
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'alphabetic';
                }
                ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(pad + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
                ctx.stroke();

                // Badge label "FOTO ABSEN MASUK/PULANG" di pojok kanan atas
                const badgeText = opts.isMasuk ? 'FOTO ABSEN MASUK' : 'FOTO ABSEN PULANG';
                ctx.font = `bold ${fontSizeSmall}px Arial`;
                const badgePaddingX = 8 * scale;
                const badgeTextWidth = ctx.measureText(badgeText).width;
                const badgeW = badgeTextWidth + badgePaddingX * 2;
                const badgeH = fontSizeSmall + 8 * scale;
                const badgeX = w - pad - badgeW;
                const badgeY = panelY + pad * 0.6;
                ctx.fillStyle = opts.isMasuk ? 'rgba(16,185,129,0.92)' : 'rgba(244,63,94,0.92)';
                roundRectPath(ctx, badgeX, badgeY, badgeW, badgeH, 4 * scale);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.textBaseline = 'middle';
                ctx.fillText(badgeText, badgeX + badgePaddingX, badgeY + badgeH / 2 + 0.5);
                ctx.textBaseline = 'alphabetic';

                // Nama proyek (kecil, di samping logo)
                ctx.font = `${fontSizeSmall}px Arial`;
                ctx.fillStyle = '#94a3b8';
                ctx.fillText(opts.namaProyek || '', textX, panelY + pad + fontSizeSmall * 0.9);

                // Baris-baris info utama
                let ly = panelY + pad + fontSizeSmall + (10 * scale);
                lines.forEach(line => {
                    ctx.font = `${line.bold ? 'bold ' : ''}${line.size}px Arial`;
                    ctx.fillStyle = line.color || '#e2e8f0';
                    ctx.fillText(line.text, textX, ly + line.size);
                    ly += lineHeight;
                });

                // Mini peta skematik di kanan bawah panel
                const mapX = w - pad - mapBoxSize;
                const mapY = panelY + panelHeight - pad - mapBoxSize;
                drawSchematicMap(ctx, mapX, mapY, mapBoxSize, mapBoxSize, opts.isMasuk ? '#10b981' : '#f43f5e');

                resolve();
            });
        }

        // Konteks foto yang sedang dibuka di modal viewer: { id, isMasuk }
        let absenPhotoModalContext = null;

        function openAbsenPhotoModal(id, isMasuk) {
            const data = isMasuk ? absenMasukData : absenKeluarData;
            const item = data.find(d => d.id == id);
            if (!item) return;
            absenPhotoModalContext = { id, isMasuk };

            document.getElementById('absenPhotoModalTitle').innerHTML = `<i class="fa-solid fa-image text-amber-400"></i><span>${isMasuk ? 'Foto Absen Masuk' : 'Foto Absen Pulang'} - ${item.nama}</span>`;
            document.getElementById('absenPhotoModalImg').src = item.photo;

            let infoHtml = `
                <div><i class="fa-regular fa-clock text-amber-400 mr-1.5 w-3.5 text-center"></i>${item.waktu}</div>
                <div class="break-words leading-snug"><i class="fa-solid fa-location-dot text-rose-400 mr-1.5 w-3.5 text-center"></i>${item.alamat || item.lokasi}</div>
            `;
            if (item.jamKerja) {
                infoHtml += `<div><i class="fa-solid fa-business-time text-emerald-400 mr-1.5 w-3.5 text-center"></i>${item.jamKerja}</div>`;
            }
            document.getElementById('absenPhotoModalInfo').innerHTML = infoHtml;

            document.getElementById('absenPhotoModal').classList.remove('hidden');
        }

        function closeAbsenPhotoModal() {
            document.getElementById('absenPhotoModal').classList.add('hidden');
            absenPhotoModalContext = null;
        }

        // Simpan foto absensi yang sedang dibuka ke penyimpanan HP (folder Download bawaan browser)
        function downloadAbsenPhoto() {
            if (!absenPhotoModalContext) return;
            const data = absenPhotoModalContext.isMasuk ? absenMasukData : absenKeluarData;
            const item = data.find(d => d.id == absenPhotoModalContext.id);
            if (!item) return;
            const a = document.createElement('a');
            a.href = item.photo;
            const jenis = absenPhotoModalContext.isMasuk ? 'Absen-Masuk' : 'Absen-Pulang';
            const namaFile = `${jenis}-${(item.nama || 'Karyawan').replace(/\s+/g, '-')}-${item.tanggal || ''}.jpg`;
            a.download = namaFile;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        // Share foto absensi yang sedang dibuka langsung ke WhatsApp (atau share sheet lain di HP) menggunakan
        // Web Share API (bisa mengirim FILE gambar, bukan cuma teks/link). Jika perangkat/browser tidak
        // mendukung share file, otomatis fallback: unduh dulu fotonya lalu kirim teks info via WhatsApp Web.
        async function shareAbsenPhotoToWhatsapp() {
            if (!absenPhotoModalContext) return;
            const isMasuk = absenPhotoModalContext.isMasuk;
            const data = isMasuk ? absenMasukData : absenKeluarData;
            const item = data.find(d => d.id == absenPhotoModalContext.id);
            if (!item) return;

            const jenis = isMasuk ? 'Absen Masuk' : 'Absen Pulang';
            let caption = `LAPORAN KEHADIRAN KARYAWAN\nJenis: ${jenis}\nNama: ${item.nama}\nWaktu: ${item.waktu}\nAlamat: ${item.alamat || item.lokasi}`;
            if (item.jamKerja) caption += `\nJam Kerja: ${item.jamKerja}`;
            caption += `\n\n_Dibuat otomatis oleh ProConstruct ERP v3.0_`;

            try {
                const res = await fetch(item.photo);
                const blob = await res.blob();
                const namaFile = `${isMasuk ? 'Absen-Masuk' : 'Absen-Pulang'}-${(item.nama || 'Karyawan').replace(/\s+/g, '-')}.jpg`;
                const file = new File([blob], namaFile, { type: 'image/jpeg' });

                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file], text: caption, title: jenis });
                    return;
                }
            } catch (err) {
                console.warn('Web Share API (file) gagal/tidak didukung, memakai fallback:', err);
            }

            // Fallback untuk browser yang tidak mendukung share file: unduh dulu fotonya, lalu buka WA dengan teks info
            downloadAbsenPhoto();
            alert('Perangkat/browser ini belum mendukung kirim foto langsung ke WhatsApp. Foto sudah otomatis diunduh ke HP - silakan lampirkan manual di WhatsApp. Jendela WhatsApp dengan teks info akan dibuka sekarang.');
            window.open(`https://wa.me/?text=${encodeURIComponent(caption)}`, '_blank');
        }

        function shareAbsenWaById(id, isMasuk) {
            const data = isMasuk ? absenMasukData : absenKeluarData;
            const item = data.find(d => d.id == id);
            if (!item) return;
            const jenis = isMasuk ? 'Absen Masuk' : 'Absen Pulang';
            let text = `LAPORAN KEHADIRAN KARYAWAN\nJenis: ${jenis}\nNama: ${item.nama}\nWaktu: ${item.waktu}\nAlamat: ${item.alamat || item.lokasi}\nKoordinat GPS: ${item.lokasi}`;
            if (item.lat != null && item.lng != null) {
                text += `\nPeta: https://www.google.com/maps?q=${item.lat},${item.lng}`;
            }
            if (item.jamKerja) {
                text += `\nJam Kerja: ${item.jamKerja}`;
            }
            text += `\nStatus: Hadir di Proyek\n\n_Dibuat otomatis oleh ProConstruct ERP v3.0_\n_by rchmd20_`;
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        }

        // ===================================================================
        // 5.1 DAFTAR HADIR - REKAP BULANAN
