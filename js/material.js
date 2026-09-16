        // ===================================================================
        function renderMaterialSection() {
            const titleMap = {
                'mat-kebutuhan': 'Rencana Kebutuhan Material',
                'mat-order': 'Pemesanan Material (Material Order)',
                'mat-masuk': 'Penerimaan Material Masuk (Scan Nota Lengkap)',
                'mat-keluar': 'Pengeluaran Material Lapangan',
                'mat-sisa': 'Stok Sisa Material (Warehouse Inventory)'
            };

            document.getElementById('materialTitle').innerHTML = `<i class="fa-solid fa-boxes-stacked text-purple-400"></i><span>${titleMap[activeMaterialSub]}</span>`;
            
            const formBox = document.getElementById('materialFormBox');
            const scanNotaBtn = document.getElementById('btnScanNota');

            if (activeMaterialSub === 'mat-masuk') {
                scanNotaBtn.classList.remove('hidden');
            } else {
                scanNotaBtn.classList.add('hidden');
            }

            if (activeMaterialSub === 'mat-sisa') {
                formBox.classList.add('hidden');
            } else {
                formBox.classList.remove('hidden');
                renderMaterialFormFields();
            }

            renderMaterialTable();
        }

        function renderMaterialFormFields() {
            const container = document.getElementById('matFormFieldContainer');
            container.innerHTML = '';
            const submitBtn = document.getElementById('matSubmitBtn');
            const cancelBtn = document.getElementById('matCancelEditBtn');
            const isEdit = materialEditContext && materialEditContext.type === activeMaterialSub.replace('mat-', '');

            if (activeMaterialSub === 'mat-kebutuhan') {
                const editItem = isEdit ? kebutuhanMatData.find(x => x.id == materialEditContext.id) : null;
                document.getElementById('matFormTitle').innerText = editItem ? 'Edit Kebutuhan Material' : 'Input Kebutuhan Material Baru';
                container.innerHTML = `
                    <div><label class="block text-slate-400 mb-1">Kode Material</label><input type="text" id="matKode" placeholder="MTR-001" value="${editItem ? editItem.kode || '' : ''}" class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-white"></div>
                    <div><label class="block text-slate-400 mb-1">Nama Material <span class="text-red-400">*</span></label><input type="text" id="matNama" required placeholder="Semen / Besi" value="${editItem ? editItem.nama : ''}" class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-white"></div>
                    <div><label class="block text-slate-400 mb-1">Dimensi</label><input type="text" id="matDimensi" placeholder="12 mm / 40x40 cm" value="${editItem ? editItem.dimensi || '' : ''}" class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-white"></div>
                    <div><label class="block text-slate-400 mb-1">Spesifikasi</label><input type="text" id="matSpesifikasi" placeholder="SNI / K-225" value="${editItem ? editItem.spesifikasi || '' : ''}" class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-white"></div>
                    <div><label class="block text-slate-400 mb-1">Satuan <span class="text-red-400">*</span></label><input type="text" id="matSatuan" required placeholder="Sak / Batang" value="${editItem ? editItem.satuan : ''}" class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-white"></div>
                    <div><label class="block text-slate-400 mb-1">Volume Kebutuhan <span class="text-red-400">*</span></label><input type="number" step="any" id="matVolume" required placeholder="100" value="${editItem ? editItem.volume : ''}" class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"></div>
                    <div><label class="block text-slate-400 mb-1">Harga Satuan (Rp) <span class="text-red-400">*</span></label><input type="number" step="any" id="matHarga" required placeholder="65000" value="${editItem ? editItem.harga : ''}" class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"></div>
                    <div><label class="block text-slate-400 mb-1">Nama Toko</label><input type="text" id="matSupplier" placeholder="TB Sinar Jaya" value="${editItem ? editItem.supplier || '' : ''}" class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-white"></div>
                    <div><label class="block text-slate-400 mb-1">Kontak Toko</label><input type="text" id="matKontak" placeholder="0812xxxxxxx" value="${editItem ? editItem.kontak || '' : ''}" class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-white"></div>
                    <div class="md:col-span-4"><label class="block text-slate-400 mb-1">Nama PIC (Penanggung Jawab Material) <span class="text-slate-500">- opsional</span></label><input type="text" id="matPic" placeholder="Contoh: Budi (Logistik)" value="${editItem ? editItem.pic || '' : ''}" class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-white"></div>
                `;
            } else if (activeMaterialSub === 'mat-order') {
                const editItem = isEdit ? materialOrderData.find(x => x.id == materialEditContext.id) : null;
                document.getElementById('matFormTitle').innerText = editItem ? 'Edit Pemesanan Material' : 'Form Pemesanan Material (Ambil dari Kebutuhan Material)';
                const selectedKebId = editItem ? editItem.kebutuhanId : '';
                // Sembunyikan item Kebutuhan Material yang sisa bisa dipesannya sudah 0 (sudah diorder 100%)
                // dari dropdown "Pilih Material", kecuali item tsb sedang dipilih pada PO yang sedang diedit.
                const projKebutuhan = kebutuhanMatData.filter(d => d.projId === activeProjectId).filter(k => {
                    if (k.id == selectedKebId) return true;
                    const excludeId = editItem ? editItem.id : null;
                    const sudahDipesan = getKebutuhanOrderedTotal(k.id, excludeId);
                    const sisaBisaDipesan = Math.max(0, k.volume - sudahDipesan);
                    return sisaBisaDipesan > 0;
                });
                const options = projKebutuhan.map(k => `<option value="${k.id}" data-search="${(k.kode || '') + ' ' + k.nama + ' ' + (k.dimensi || '') + ' ' + (k.spesifikasi || '')}" ${k.id == selectedKebId ? 'selected' : ''}>${k.kode ? '[' + k.kode + '] ' : ''}${k.nama}${k.dimensi ? ' (' + k.dimensi + ')' : ''}${k.spesifikasi ? ' - ' + k.spesifikasi : ''} (Total Kebutuhan: ${formatAngka(k.volume)} ${k.satuan})</option>`).join('');
                container.innerHTML = `
                    <div><label class="block text-slate-400 mb-1">Tanggal PO</label><input type="date" id="poTanggal" required value="${editItem ? editItem.tanggal : ''}" class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-white"></div>
                    <div class="md:col-span-3">
                        <label class="block text-slate-400 mb-1">Pilih Material (dari Kebutuhan Material) <span class="text-red-400">*</span></label>
                        <input type="text" id="poSearchMaterial" oninput="filterPoMaterialOptions()" placeholder="Ketik nama / kode material untuk mencari..." class="w-full bg-[#0b132b] border border-slate-700 rounded-t-lg px-3 py-2 text-white text-xs">
                        <select id="poKebutuhanId" required onchange="fillPoFromKebutuhan()" class="w-full bg-[#0f172a] border border-t-0 border-slate-700 rounded-b-lg px-3 py-2 text-white">
                            <option value="">-- Pilih Material --</option>${options}
                        </select>
                    </div>
                    <div id="poPreviewBox" class="md:col-span-4 text-[11px] bg-[#0b132b] border border-slate-700 rounded-lg p-3 text-slate-300">Pilih material untuk melihat detail (dimensi, spesifikasi, toko, kontak, satuan, harga).</div>
                    <div>
                        <label class="block text-slate-400 mb-1">Volume Order <span class="text-red-400">*</span></label>
                        <input type="number" step="any" id="poVolume" required oninput="validatePoVolume()" placeholder="0" value="${editItem ? editItem.volume : ''}" class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono">
                    </div>
                    <div class="md:col-span-3 flex items-end">
                        <div id="poVolumeInfo" class="text-[11px] text-slate-400 leading-relaxed"></div>
                    </div>
                    <div id="poVolumeWarning" class="md:col-span-4 hidden bg-red-500/10 border border-red-500/40 text-red-400 rounded-lg px-3 py-2 text-[11px] flex items-start space-x-2">
                        <i class="fa-solid fa-triangle-exclamation mt-0.5"></i>
                        <span id="poVolumeWarningText"></span>
                    </div>
                    <div><label class="block text-slate-400 mb-1">Estimasi Tiba <span class="text-red-400">*</span></label><input type="date" id="poEstimasiTiba" required value="${editItem ? editItem.estimasiTiba || '' : ''}" class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-white"></div>
                    <div class="md:col-span-3">
                        <label class="block text-slate-400 mb-1">Keterangan PO <span class="text-slate-500">(mis. "Tahap 1", "Pengiriman ke-2")</span></label>
                        <input type="text" id="poKet" oninput="updatePoTahapInfo()" placeholder="Tahap 1" value="${editItem ? editItem.ket || '' : ''}" class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-white">
                    </div>
                    <div id="poTahapInfo" class="md:col-span-4 text-[11px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 rounded-lg p-3"></div>
                `;
                if (editItem) fillPoFromKebutuhan(); else { document.getElementById('poVolumeInfo').innerText = ''; updatePoTahapInfo(); }
            } else if (activeMaterialSub === 'mat-masuk') {
                const editItem = isEdit ? materialMasukData.find(x => x.id == materialEditContext.id) : null;
                document.getElementById('matFormTitle').innerText = editItem ? 'Edit Material Masuk' : 'Form Penerimaan Material Masuk (Dari Nota)';

                // Opsi Pilih Material diambil dari data Order Material (bukan input manual)
                // Saat edit, cari order yang cocok (nama + dimensi + spesifikasi + supplier) agar bisa ter-preselect
                const selectedOrderId = editItem
                    ? (editItem.orderId || (materialOrderData.filter(d => d.projId === activeProjectId).find(o => o.nama === editItem.nama && (o.dimensi || '') === (editItem.dimensi || '') && (o.spesifikasi || '') === (editItem.spesifikasi || '') && o.supplier === editItem.supplier) || {}).id || '')
                    : '';
                // Item Order yang sudah masuk 100% tidak dimunculkan lagi di daftar pilihan
                // (kecuali order yang sedang dipilih saat mode edit, agar tidak hilang dari form)
                const projOrders = materialOrderData.filter(d => {
                    if (d.projId !== activeProjectId) return false;
                    if (d.id == selectedOrderId) return true;
                    return getOrderMasukStatus(d).sisa > 0;
                });
                const mmOptions = projOrders.map(o => {
                    const searchTxt = (o.kode || '') + ' ' + o.nama + ' ' + (o.dimensi || '') + ' ' + (o.spesifikasi || '') + ' ' + o.supplier;
                    const label = `${o.nama}${o.dimensi ? ' (' + o.dimensi + ')' : ''}${o.spesifikasi ? ' - ' + o.spesifikasi : ''} | ${o.supplier} | PO ${o.tanggal} (${formatAngka(o.volume)} ${o.satuan})`;
                    return `<option value="${o.id}" data-search="${searchTxt}" ${o.id == selectedOrderId ? 'selected' : ''}>${label}</option>`;
                }).join('');

                container.innerHTML = `
                    <div><label class="block text-slate-400 mb-1">Tanggal Terima</label><input type="date" id="mmTanggal" required value="${editItem ? editItem.tanggal : ''}" class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-white"></div>
                    <div class="md:col-span-3">
                        <label class="block text-slate-400 mb-1">Pilih Material (dari Data Order Material) <span class="text-red-400">*</span></label>
                        <input type="text" id="mmSearchMaterial" oninput="filterMmMaterialOptions()" placeholder="Ketik nama / kode material / supplier untuk mencari..." class="w-full bg-[#0b132b] border border-slate-700 rounded-t-lg px-3 py-2 text-white text-xs">
                        <select id="mmOrderId" required onchange="fillMmFromOrder()" class="w-full bg-[#0f172a] border border-t-0 border-slate-700 rounded-b-lg px-3 py-2 text-white">
                            <option value="">-- Pilih Material --</option>${mmOptions}
                        </select>
                    </div>
                    <div id="mmPreviewBox" class="md:col-span-4 text-[11px] bg-[#0b132b] border border-slate-700 rounded-lg p-3 text-slate-300">Pilih material untuk melihat detail (dimensi, spesifikasi, supplier, sisa belum masuk).</div>
                    <div>
                        <label class="block text-slate-400 mb-1">Volume Masuk <span class="text-red-400">*</span></label>
                        <input type="number" step="any" id="mmVolume" required oninput="validateMmVolume()" placeholder="0" value="${editItem ? editItem.volume : ''}" class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono">
                    </div>
                    <div class="md:col-span-3 flex items-end">
                        <div id="mmVolumeInfo" class="text-[11px] text-slate-400 leading-relaxed"></div>
                    </div>
                    <div id="mmVolumeWarning" class="md:col-span-4 hidden bg-red-500/10 border border-red-500/40 text-red-400 rounded-lg px-3 py-2 text-[11px] flex items-start space-x-2">
                        <i class="fa-solid fa-triangle-exclamation mt-0.5"></i>
                        <span id="mmVolumeWarningText"></span>
                    </div>
                    <div class="md:col-span-4"><label class="block text-slate-400 mb-1">No. Surat Jalan / Nota <span class="text-slate-500">(opsional)</span></label><input type="text" id="mmNota" placeholder="SJ-2026-089" value="${editItem ? editItem.nota || '' : ''}" class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-white"></div>
                `;
                if (selectedOrderId) fillMmFromOrder(); else { const infoBox = document.getElementById('mmVolumeInfo'); if (infoBox) infoBox.innerText = ''; }
            } else if (activeMaterialSub === 'mat-keluar') {
                const editItem = isEdit ? materialKeluarData.find(x => x.id == materialEditContext.id) : null;
                document.getElementById('matFormTitle').innerText = editItem ? 'Edit Pengeluaran Material' : 'Form Pengeluaran Material ke Lapangan (Dari Stok Sisa)';
                // Saat edit, volume item ini dikembalikan dulu ke perhitungan sisa agar tidak menghalangi edit
                const sisaList = getMaterialSisaList(editItem ? editItem.id : null);
                const editKey = editItem ? materialCompositeKey(editItem.nama, editItem.dimensi, editItem.spesifikasi) : null;
                let namesToShow = sisaList.filter(s => s.sisa > 0);
                if (editItem && !namesToShow.some(s => s.key === editKey)) {
                    namesToShow.push({ key: editKey, nama: editItem.nama, dimensi: editItem.dimensi, spesifikasi: editItem.spesifikasi, satuan: editItem.satuan, sisa: editItem.volume });
                }
                const options = namesToShow.map(s => {
                    const detail = [s.dimensi, s.spesifikasi].filter(Boolean).join(' - ');
                    const label = `${s.nama}${detail ? ' (' + detail + ')' : ''} | Sisa Tersedia: ${formatAngka(s.sisa)} ${s.satuan}`;
                    return `<option value="${s.key}" data-search="${(s.nama + ' ' + (s.dimensi||'') + ' ' + (s.spesifikasi||'')).toLowerCase()}" ${editKey === s.key ? 'selected' : ''}>${label}</option>`;
                }).join('');
                container.innerHTML = `
                    <div><label class="block text-slate-400 mb-1">Tanggal Keluar</label><input type="date" id="mkTanggal" required value="${editItem ? editItem.tanggal : ''}" class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-white"></div>
                    <div class="md:col-span-3">
                        <label class="block text-slate-400 mb-1">Pilih Material (dari Stok Sisa) <span class="text-red-400">*</span></label>
                        <input type="text" id="mkSearchMaterial" oninput="filterMkMaterialOptions()" placeholder="Ketik nama material untuk mencari..." class="w-full bg-[#0b132b] border border-slate-700 rounded-t-lg px-3 py-2 text-white text-xs">
                        <select id="mkNamaSelect" required onchange="fillMkFromSisa()" class="w-full bg-[#0f172a] border border-t-0 border-slate-700 rounded-b-lg px-3 py-2 text-white">
                            <option value="">-- Pilih Material --</option>${options}
                        </select>
                    </div>
                    <div><label class="block text-slate-400 mb-1">Satuan</label><input type="text" id="mkSatuan" readonly value="${editItem ? editItem.satuan : ''}" class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-slate-400"></div>
                    <div><label class="block text-slate-400 mb-1">Sisa Stok Saat Ini</label><input type="text" id="mkSisaInfo" readonly class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-amber-400 font-mono"></div>
                    <div><label class="block text-slate-400 mb-1">Volume yang Akan Keluar <span class="text-red-400">*</span></label><input type="number" step="any" id="mkVolume" required placeholder="25" value="${editItem ? editItem.volume : ''}" class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"></div>
                    <div class="md:col-span-2"><label class="block text-slate-400 mb-1">Penerima / Mandor <span class="text-slate-500">(opsional)</span></label><input type="text" id="mkPenerima" placeholder="Mandor Budi" value="${editItem ? editItem.penerima || '' : ''}" class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-white"></div>
                    <div class="md:col-span-4">
                        <label class="block text-slate-400 mb-1">Untuk Pekerjaan (Terdaftar di RAB) <span class="text-red-400">*</span></label>
                        <input type="text" id="mkSearchPekerjaan" oninput="filterMkPekerjaanOptions()" placeholder="Ketik nama pekerjaan RAB untuk mencari..." class="w-full bg-[#0b132b] border border-slate-700 rounded-t-lg px-3 py-2 text-white text-xs">
                        <select id="mkPekerjaanSelect" required class="w-full bg-[#0f172a] border border-t-0 border-slate-700 rounded-b-lg px-3 py-2 text-white text-xs"></select>
                    </div>
                `;
                filterMkPekerjaanOptions(editItem ? editItem.pekerjaanId : '');
                if (editItem) fillMkFromSisa();
            }

            if (submitBtn) submitBtn.innerHTML = isEdit ? '<i class="fa-solid fa-floppy-disk mr-1"></i> Update Data' : '<i class="fa-solid fa-plus mr-1"></i> Simpan Data';
            if (cancelBtn) cancelBtn.classList.toggle('hidden', !isEdit);
        }

        function editMaterialItem(type, id) {
            materialEditContext = { type, id };
            renderMaterialFormFields();
            document.getElementById('matFormFieldContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function cancelMaterialEdit() {
            materialEditContext = null;
            document.getElementById('formMaterial').reset();
            renderMaterialFormFields();
        }

        // Isi otomatis form Material Order dari item Kebutuhan Material yang dipilih
        // Filter opsi material pada form Material Order berdasarkan pencarian
        function filterPoMaterialOptions() {
            const query = document.getElementById('poSearchMaterial').value.toLowerCase();
            const select = document.getElementById('poKebutuhanId');
            if (!select) return;
            Array.from(select.options).forEach(opt => {
                if (!opt.value) { opt.style.display = ''; return; }
                const hay = (opt.getAttribute('data-search') || opt.textContent).toLowerCase();
                opt.style.display = hay.includes(query) ? '' : 'none';
            });
        }

        function fillPoFromKebutuhan() {
            const id = document.getElementById('poKebutuhanId').value;
            const box = document.getElementById('poPreviewBox');
            const infoBox = document.getElementById('poVolumeInfo');
            if (!id) {
                box.innerHTML = 'Pilih material untuk melihat detail (dimensi, spesifikasi, toko, kontak, satuan, harga).';
                if (infoBox) infoBox.innerText = '';
                return;
            }
            const k = kebutuhanMatData.find(x => x.id == id);
            if (!k) return;
            box.innerHTML = `
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div><strong class="text-slate-400">Kode:</strong> ${k.kode || '-'}</div>
                    <div><strong class="text-slate-400">Dimensi:</strong> ${k.dimensi || '-'}</div>
                    <div><strong class="text-slate-400">Spesifikasi:</strong> ${k.spesifikasi || '-'}</div>
                    <div><strong class="text-slate-400">Satuan:</strong> ${k.satuan}</div>
                    <div><strong class="text-slate-400">Total Kebutuhan:</strong> ${formatAngka(k.volume)} ${k.satuan}</div>
                    <div><strong class="text-slate-400">Harga Satuan:</strong> ${formatRupiah(k.harga)}</div>
                    <div><strong class="text-slate-400">Toko:</strong> ${k.supplier || '-'}</div>
                    <div><strong class="text-slate-400">Kontak Toko:</strong> ${k.kontak || '-'}</div>
                </div>
            `;
            validatePoVolume();
            updatePoTahapInfo();
        }

        // Menampilkan info "PO ini akan menjadi tahap ke berapa" & auto-isi saran Keterangan PO
        function updatePoTahapInfo() {
            const kebId = document.getElementById('poKebutuhanId') ? document.getElementById('poKebutuhanId').value : '';
            const tahapBox = document.getElementById('poTahapInfo');
            const ketInput = document.getElementById('poKet');
            if (!tahapBox) return;
            if (!kebId) { tahapBox.innerHTML = ''; return; }

            const excludeId = (materialEditContext && materialEditContext.type === 'order') ? materialEditContext.id : null;
            const existing = materialOrderData
                .filter(o => o.projId === activeProjectId && o.kebutuhanId == kebId && o.id != excludeId)
                .sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || '') || a.id - b.id);
            const nextTahap = existing.length + 1;

            tahapBox.innerHTML = `<i class="fa-solid fa-layer-group mr-1"></i> Material ini sudah dipesan sebanyak <strong class="text-white">${existing.length}x</strong> sebelumnya. PO ini akan menjadi <strong class="text-amber-400">Tahap ke-${nextTahap}</strong>. Isi kolom Keterangan PO agar tahap pemesanan ini mudah dikenali (contoh: "Tahap ${nextTahap}").`;

            if (ketInput && !ketInput.value && !(materialEditContext && materialEditContext.type === 'order')) {
                ketInput.value = `Tahap ${nextTahap}`;
            }
        }

        // Hitung total volume yang sudah dipesan (di seluruh Material Order) untuk 1 item Kebutuhan Material
        function getKebutuhanOrderedTotal(kebutuhanId, excludeOrderId) {
            return materialOrderData
                .filter(o => o.kebutuhanId == kebutuhanId && o.id != excludeOrderId)
                .reduce((a, c) => a + (c.volume || 0), 0);
        }

        // Validasi real-time: volume order tidak boleh melebihi sisa kebutuhan material yang belum dipesan
        function validatePoVolume() {
            const kebId = document.getElementById('poKebutuhanId').value;
            const infoBox = document.getElementById('poVolumeInfo');
            const warnBox = document.getElementById('poVolumeWarning');
            const warnText = document.getElementById('poVolumeWarningText');
            if (!kebId || !infoBox) return true;

            const k = kebutuhanMatData.find(x => x.id == kebId);
            if (!k) return true;

            const excludeId = (materialEditContext && materialEditContext.type === 'order') ? materialEditContext.id : null;
            const sudahDipesan = getKebutuhanOrderedTotal(k.id, excludeId);
            const sisaBisaDipesan = Math.max(0, k.volume - sudahDipesan);
            const volInput = parseFloat(document.getElementById('poVolume').value) || 0;

            infoBox.innerHTML = `Total Kebutuhan: <strong class="text-white">${formatAngka(k.volume)} ${k.satuan}</strong> &nbsp;|&nbsp; Sudah Dipesan (orderan lain): <strong class="text-sky-300">${formatAngka(sudahDipesan)} ${k.satuan}</strong> &nbsp;|&nbsp; Sisa Bisa Dipesan: <strong class="text-emerald-400">${formatAngka(sisaBisaDipesan)} ${k.satuan}</strong>`;

            if (volInput > sisaBisaDipesan) {
                warnText.innerText = `Volume order (${formatAngka(volInput)} ${k.satuan}) melebihi sisa kebutuhan yang bisa dipesan (${formatAngka(sisaBisaDipesan)} ${k.satuan}).`;
                warnBox.classList.remove('hidden');
                return false;
            } else {
                warnBox.classList.add('hidden');
                return true;
            }
        }

        // Filter opsi material pada form Material Masuk (Pilih Material dari Data Order) berdasarkan pencarian
        function filterMmMaterialOptions() {
            const query = document.getElementById('mmSearchMaterial').value.toLowerCase();
            const select = document.getElementById('mmOrderId');
            if (!select) return;
            Array.from(select.options).forEach(opt => {
                if (!opt.value) { opt.style.display = ''; return; }
                const hay = (opt.getAttribute('data-search') || opt.textContent).toLowerCase();
                opt.style.display = hay.includes(query) ? '' : 'none';
            });
        }

        // Isi otomatis form Material Masuk dari item Order Material yang dipilih (nama, dimensi, spesifikasi, satuan, supplier)
        function fillMmFromOrder() {
            const id = document.getElementById('mmOrderId').value;
            const box = document.getElementById('mmPreviewBox');
            const infoBox = document.getElementById('mmVolumeInfo');
            if (!id) {
                if (box) box.innerHTML = 'Pilih material untuk melihat detail (dimensi, spesifikasi, supplier, sisa belum masuk).';
                if (infoBox) infoBox.innerText = '';
                return;
            }
            const o = materialOrderData.find(x => x.id == id);
            if (!o) return;
            if (box) box.innerHTML = `
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div><strong class="text-slate-400">Nama:</strong> ${o.nama}</div>
                    <div><strong class="text-slate-400">Dimensi:</strong> ${o.dimensi || '-'}</div>
                    <div><strong class="text-slate-400">Spesifikasi:</strong> ${o.spesifikasi || '-'}</div>
                    <div><strong class="text-slate-400">Satuan:</strong> ${o.satuan}</div>
                    <div><strong class="text-slate-400">Volume Order:</strong> ${formatAngka(o.volume)} ${o.satuan}</div>
                    <div><strong class="text-slate-400">Supplier:</strong> ${o.supplier || '-'}</div>
                    <div><strong class="text-slate-400">Tanggal PO:</strong> ${o.tanggal || '-'}</div>
                    <div><strong class="text-slate-400">No. Nota / SJ:</strong> <span class="text-slate-500">Isi di bawah</span></div>
                </div>
            `;
            validateMmVolume();
        }

        // Validasi real-time: volume masuk tidak boleh melebihi sisa order yang belum diterima
        function validateMmVolume() {
            const orderId = document.getElementById('mmOrderId') ? document.getElementById('mmOrderId').value : '';
            const infoBox = document.getElementById('mmVolumeInfo');
            const warnBox = document.getElementById('mmVolumeWarning');
            const warnText = document.getElementById('mmVolumeWarningText');
            if (!orderId || !infoBox) return true;

            const o = materialOrderData.find(x => x.id == orderId);
            if (!o) return true;

            const excludeId = (materialEditContext && materialEditContext.type === 'masuk') ? materialEditContext.id : null;
            const st = getOrderMasukStatus(o, excludeId);
            const volInput = parseFloat(document.getElementById('mmVolume').value) || 0;

            infoBox.innerHTML = `Volume Order: <strong class="text-white">${formatAngka(o.volume)} ${o.satuan}</strong> &nbsp;|&nbsp; Sudah Masuk (nota lain): <strong class="text-sky-300">${formatAngka(st.totalMasuk)} ${o.satuan}</strong> &nbsp;|&nbsp; Sisa Belum Masuk: <strong class="text-emerald-400">${formatAngka(st.sisa)} ${o.satuan}</strong>`;

            if (warnBox && warnText) {
                if (volInput > st.sisa) {
                    warnText.innerText = `Volume masuk (${formatAngka(volInput)} ${o.satuan}) melebihi sisa yang belum diterima (${formatAngka(st.sisa)} ${o.satuan}).`;
                    warnBox.classList.remove('hidden');
                    return false;
                } else {
                    warnBox.classList.add('hidden');
                    return true;
                }
            }
            return true;
        }

        // Filter opsi material pada form Material Keluar (Pilih Material dari Stok Sisa) berdasarkan pencarian
        function filterMkMaterialOptions() {
            const searchEl = document.getElementById('mkSearchMaterial');
            const select = document.getElementById('mkNamaSelect');
            if (!searchEl || !select) return;
            const query = searchEl.value.toLowerCase();
            Array.from(select.options).forEach(opt => {
                if (!opt.value) { opt.style.display = ''; return; }
                const hay = (opt.getAttribute('data-search') || opt.textContent).toLowerCase();
                opt.style.display = hay.includes(query) ? '' : 'none';
            });
        }

        // Isi otomatis form Material Keluar dari Stok Sisa yang dipilih
        function fillMkFromSisa() {
            const key = document.getElementById('mkNamaSelect').value;
            const excludeId = (materialEditContext && materialEditContext.type === 'keluar') ? materialEditContext.id : null;
            const sisaList = getMaterialSisaList(excludeId);
            let s = sisaList.find(x => x.key === key);
            if (!s && materialEditContext && materialEditContext.type === 'keluar') {
                const editItem = materialKeluarData.find(x => x.id == materialEditContext.id);
                if (editItem && materialCompositeKey(editItem.nama, editItem.dimensi, editItem.spesifikasi) === key) {
                    s = { key, nama: editItem.nama, dimensi: editItem.dimensi, spesifikasi: editItem.spesifikasi, satuan: editItem.satuan, sisa: editItem.volume };
                }
            }
            document.getElementById('mkSatuan').value = s ? s.satuan : '';
            document.getElementById('mkSisaInfo').value = s ? `${formatAngka(s.sisa)} ${s.satuan}` : '';
        }

        // Helper: hitung daftar stok sisa material (masuk - keluar) untuk proyek aktif
        // excludeKeluarId: opsional, dipakai saat mode edit agar volume item yang sedang diedit tidak ikut mengurangi sisa
        function getMaterialSisaList(excludeKeluarId) {
            // Digabung berdasarkan kombinasi Nama + Dimensi + Spesifikasi (BUKAN nama saja),
            // agar material dengan nama sama tapi dimensi/spesifikasi berbeda tetap dihitung terpisah
            const projMasuk = materialMasukData.filter(m => m.projId === activeProjectId);
            const projKeluar = materialKeluarData.filter(m => m.projId === activeProjectId);
            const keys = [...new Set([
                ...projMasuk.map(m => materialCompositeKey(m.nama, m.dimensi, m.spesifikasi)),
                ...projKeluar.map(m => materialCompositeKey(m.nama, m.dimensi, m.spesifikasi))
            ])];
            return keys.map(key => {
                const masukItems = projMasuk.filter(m => materialCompositeKey(m.nama, m.dimensi, m.spesifikasi) === key);
                const keluarItems = projKeluar.filter(m => materialCompositeKey(m.nama, m.dimensi, m.spesifikasi) === key && m.id != excludeKeluarId);
                const masuk = masukItems.reduce((a, c) => a + c.volume, 0);
                const keluar = keluarItems.reduce((a, c) => a + c.volume, 0);
                const ref = masukItems[0] || keluarItems[0] || {};
                const sat = ref.satuan || 'Unit';
                // Tanggal transaksi paling awal (masuk/keluar) untuk material ini, dipakai untuk pengurutan daftar
                const semuaTanggal = [...masukItems, ...keluarItems].map(t => t.tanggal).filter(Boolean).sort();
                const tanggalAwal = semuaTanggal[0] || '';
                return { key, nama: ref.nama || '', dimensi: ref.dimensi || '', spesifikasi: ref.spesifikasi || '', satuan: sat, masuk, keluar, sisa: masuk - keluar, tanggalAwal };
            });
        }

        // Helper: kunci gabungan material (Nama + Dimensi + Spesifikasi) agar item dengan nama sama
        // tapi dimensi/spesifikasi berbeda TIDAK pernah digabung/disamakan datanya
        function materialCompositeKey(nama, dimensi, spesifikasi) {
            return [nama, dimensi, spesifikasi].map(x => (x || '').toString().trim().toLowerCase()).join('||');
        }

        // Cascade sync: ketika 1 item Kebutuhan Material diedit (nama/dimensi/spesifikasi/satuan/harga/
        // supplier/kontak/kode berubah), seluruh data turunan di halaman Material lain (Order, Masuk, Keluar)
        // yang merujuk ke item ini ikut diperbarui otomatis. Dengan begitu list & inputan (dropdown) pada
        // SEMUA halaman Material selalu konsisten dan sinkron mengikuti data master Kebutuhan Material.
        function syncKebutuhanCascade(kebId, oldSnapshot, newItem) {
            const oldKey = materialCompositeKey(oldSnapshot.nama, oldSnapshot.dimensi, oldSnapshot.spesifikasi);

            // 1) Material Order terhubung langsung lewat kebutuhanId
            const affectedOrderIds = [];
            let orderChanged = false;
            materialOrderData.forEach(o => {
                if (o.kebutuhanId == kebId) {
                    o.kode = newItem.kode; o.nama = newItem.nama; o.dimensi = newItem.dimensi;
                    o.spesifikasi = newItem.spesifikasi; o.satuan = newItem.satuan; o.harga = newItem.harga;
                    o.supplier = newItem.supplier; o.kontak = newItem.kontak; o.pic = newItem.pic;
                    affectedOrderIds.push(o.id);
                    orderChanged = true;
                }
            });
            if (orderChanged) localStorage.setItem('erp_mat_order', JSON.stringify(materialOrderData));

            // 2) Material Masuk terhubung lewat orderId ke Order yang baru saja disinkronkan
            let masukChanged = false;
            materialMasukData.forEach(m => {
                if (affectedOrderIds.some(id => id == m.orderId)) {
                    m.nama = newItem.nama; m.dimensi = newItem.dimensi; m.spesifikasi = newItem.spesifikasi;
                    m.satuan = newItem.satuan; m.supplier = newItem.supplier;
                    masukChanged = true;
                }
            });
            if (masukChanged) localStorage.setItem('erp_mat_masuk', JSON.stringify(materialMasukData));

            // 3) Material Keluar dicocokkan lewat kombinasi Nama+Dimensi+Spesifikasi LAMA
            //    (Material Keluar tidak menyimpan id relasi, jadi dicocokkan lewat composite key)
            let keluarChanged = false;
            materialKeluarData.forEach(k => {
                if (materialCompositeKey(k.nama, k.dimensi, k.spesifikasi) === oldKey) {
                    k.nama = newItem.nama; k.dimensi = newItem.dimensi; k.spesifikasi = newItem.spesifikasi;
                    k.satuan = newItem.satuan;
                    keluarChanged = true;
                }
            });
            if (keluarChanged) localStorage.setItem('erp_mat_keluar', JSON.stringify(materialKeluarData));
        }

        // Helper: hitung status masuk (%) & sisa belum masuk untuk 1 item Material Order
        // excludeMasukId: opsional, dipakai saat mode edit Material Masuk agar volume item yang sedang diedit tidak ikut dihitung
        // PENTING: dicocokkan berdasarkan orderId PERSIS (data yg benar2 dipilih di dropdown "Pilih Material" pada form Material Masuk),
        // BUKAN berdasarkan nama/dimensi/spesifikasi/supplier — supaya jika ada 2 PO berbeda dgn nama item yang sama persis
        // (mis. Tahap 1 & Tahap 2 dari toko yang sama), data Material Masuk tidak pernah salah nyasar/tertukar ke PO yang lain.
        function getOrderMasukStatus(order, excludeMasukId) {
            const matched = materialMasukData.filter(m =>
                m.projId === order.projId &&
                m.orderId == order.id &&
                m.id != excludeMasukId
            );
            const totalMasuk = matched.reduce((a, c) => a + (c.volume || 0), 0);
            const persen = order.volume > 0 ? Math.min(100, (totalMasuk / order.volume) * 100) : 0;
            const sisa = Math.max(0, order.volume - totalMasuk);
            return { totalMasuk, persen, sisa };
        }

        // Helper: hitung PO ini adalah tahap (pemesanan) ke berapa untuk material (kebutuhan) yang sama
        function getOrderTahapKe(order) {
            const group = materialOrderData
                .filter(o => o.projId === order.projId && o.kebutuhanId === order.kebutuhanId)
                .sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || '') || a.id - b.id);
            const idx = group.findIndex(o => o.id === order.id);
            return { ke: idx === -1 ? group.length + 1 : idx + 1, total: Math.max(group.length, idx + 1) };
        }

        function handleMaterialSubmit(e) {
            e.preventDefault();
            if (!canUserEdit()) { alert('Akses ditolak. Admin telah menonaktifkan izin edit akun Anda untuk proyek ini.'); return; }
            const isEditKebutuhan = materialEditContext && materialEditContext.type === 'kebutuhan';
            const isEditOrder = materialEditContext && materialEditContext.type === 'order';
            const isEditMasuk = materialEditContext && materialEditContext.type === 'masuk';
            const isEditKeluar = materialEditContext && materialEditContext.type === 'keluar';

            if (activeMaterialSub === 'mat-kebutuhan') {
                const payload = {
                    kode: document.getElementById('matKode').value.trim(),
                    nama: document.getElementById('matNama').value.trim(),
                    dimensi: document.getElementById('matDimensi').value.trim(),
                    spesifikasi: document.getElementById('matSpesifikasi').value.trim(),
                    satuan: document.getElementById('matSatuan').value.trim(),
                    volume: parseFloat(document.getElementById('matVolume').value) || 0,
                    harga: parseFloat(document.getElementById('matHarga').value) || 0,
                    supplier: document.getElementById('matSupplier').value.trim(),
                    kontak: document.getElementById('matKontak').value.trim(),
                    pic: document.getElementById('matPic').value.trim()
                };
                if (isEditKebutuhan) {
                    const idx = kebutuhanMatData.findIndex(x => x.id == materialEditContext.id);
                    if (idx !== -1) {
                        const oldSnapshot = { ...kebutuhanMatData[idx] };
                        kebutuhanMatData[idx] = { ...kebutuhanMatData[idx], ...payload };
                        localStorage.setItem('erp_kebutuhan_mat', JSON.stringify(kebutuhanMatData));
                        // Sinkronkan otomatis ke Order/Masuk/Keluar yang sudah terlanjur dibuat sebelumnya
                        syncKebutuhanCascade(kebutuhanMatData[idx].id, oldSnapshot, kebutuhanMatData[idx]);
                    }
                } else {
                    kebutuhanMatData.push({ id: Date.now(), projId: activeProjectId, ...payload });
                    localStorage.setItem('erp_kebutuhan_mat', JSON.stringify(kebutuhanMatData));
                }
            } else if (activeMaterialSub === 'mat-order') {
                const kebId = document.getElementById('poKebutuhanId').value;
                const k = kebutuhanMatData.find(x => x.id == kebId);
                if (!k) { alert('Pilih material dari daftar Kebutuhan Material terlebih dahulu.'); return; }
                if (!validatePoVolume()) { return; } // Blokir jika volume order melebihi sisa kebutuhan
                const volOrder = parseFloat(document.getElementById('poVolume').value) || 0;
                const payload = {
                    kebutuhanId: k.id,
                    tanggal: document.getElementById('poTanggal').value,
                    kode: k.kode, nama: k.nama, dimensi: k.dimensi, spesifikasi: k.spesifikasi,
                    volume: volOrder, satuan: k.satuan, harga: k.harga,
                    supplier: k.supplier, kontak: k.kontak, pic: k.pic,
                    estimasiTiba: document.getElementById('poEstimasiTiba').value,
                    ket: document.getElementById('poKet').value.trim()
                };
                if (isEditOrder) {
                    const idx = materialOrderData.findIndex(x => x.id == materialEditContext.id);
                    if (idx !== -1) materialOrderData[idx] = { ...materialOrderData[idx], ...payload };
                } else {
                    materialOrderData.push({ id: Date.now(), projId: activeProjectId, ...payload });
                }
                localStorage.setItem('erp_mat_order', JSON.stringify(materialOrderData));
            } else if (activeMaterialSub === 'mat-masuk') {
                const orderId = document.getElementById('mmOrderId').value;
                const o = materialOrderData.find(x => x.id == orderId);
                if (!o) { alert('Pilih material dari daftar Data Order Material terlebih dahulu.'); return; }
                if (!validateMmVolume()) { return; } // Blokir jika volume masuk melebihi sisa order yang belum diterima
                const payload = {
                    orderId: o.id,
                    tanggal: document.getElementById('mmTanggal').value,
                    nama: o.nama,
                    dimensi: o.dimensi,
                    spesifikasi: o.spesifikasi,
                    volume: parseFloat(document.getElementById('mmVolume').value) || 0,
                    satuan: o.satuan,
                    nota: document.getElementById('mmNota').value.trim() || '-',
                    supplier: o.supplier
                };
                if (isEditMasuk) {
                    const idx = materialMasukData.findIndex(x => x.id == materialEditContext.id);
                    if (idx !== -1) materialMasukData[idx] = { ...materialMasukData[idx], ...payload };
                } else {
                    materialMasukData.push({ id: Date.now(), projId: activeProjectId, ...payload });
                }
                localStorage.setItem('erp_mat_masuk', JSON.stringify(materialMasukData));
            } else if (activeMaterialSub === 'mat-keluar') {
                const keyTerpilih = document.getElementById('mkNamaSelect').value;
                if (!keyTerpilih) { alert('Pilih material dari daftar Stok Sisa terlebih dahulu.'); return; }
                const excludeId = isEditKeluar ? materialEditContext.id : null;
                const sisaList = getMaterialSisaList(excludeId);
                let s = sisaList.find(x => x.key === keyTerpilih);
                if (!s && isEditKeluar) {
                    const editItem = materialKeluarData.find(x => x.id == materialEditContext.id);
                    if (editItem && materialCompositeKey(editItem.nama, editItem.dimensi, editItem.spesifikasi) === keyTerpilih) {
                        s = { key: keyTerpilih, nama: editItem.nama, dimensi: editItem.dimensi, spesifikasi: editItem.spesifikasi, satuan: editItem.satuan, sisa: editItem.volume };
                    }
                }
                if (!s) { alert('Material yang dipilih tidak ditemukan pada Stok Sisa.'); return; }
                const volKeluar = parseFloat(document.getElementById('mkVolume').value) || 0;
                if (s && volKeluar > s.sisa) { alert(`Volume keluar (${volKeluar}) melebihi sisa stok (${formatAngka(s.sisa)} ${s.satuan}).`); return; }
                const pekerjaanId = document.getElementById('mkPekerjaanSelect').value;
                if (!pekerjaanId) { alert('Pilih pekerjaan (dari daftar RAB) terlebih dahulu.'); return; }
                const rabPekerjaan = rabData.find(r => r.id == pekerjaanId);
                const payload = {
                    tanggal: document.getElementById('mkTanggal').value,
                    nama: s.nama,
                    dimensi: s.dimensi || '',
                    spesifikasi: s.spesifikasi || '',
                    volume: volKeluar,
                    satuan: document.getElementById('mkSatuan').value.trim(),
                    penerima: document.getElementById('mkPenerima').value.trim(),
                    pekerjaanId: pekerjaanId,
                    pekerjaan: rabPekerjaan ? `[${rabPekerjaan.div}] ${rabPekerjaan.sub} - ${rabPekerjaan.rincian}` : ''
                };
                if (isEditKeluar) {
                    const idx = materialKeluarData.findIndex(x => x.id == materialEditContext.id);
                    if (idx !== -1) materialKeluarData[idx] = { ...materialKeluarData[idx], ...payload };
                } else {
                    materialKeluarData.push({ id: Date.now(), projId: activeProjectId, ...payload });
                }
                localStorage.setItem('erp_mat_keluar', JSON.stringify(materialKeluarData));
            }

            materialEditContext = null;
            document.getElementById('formMaterial').reset();
            renderMaterialSection();
        }

        // Cari harga satuan material berdasarkan Nama + Dimensi + Spesifikasi (BUKAN nama saja),
        // mengacu ke data Kebutuhan Material (master harga) pada proyek aktif.
        // Ini mencegah harga tertukar antar item yang namanya sama tapi dimensi/spesifikasinya berbeda.
        function getHargaSatuan(nama, dimensi, spesifikasi) {
            if (!nama) return 0;
            const targetKey = materialCompositeKey(nama, dimensi, spesifikasi);
            let k = kebutuhanMatData.find(x => x.projId === activeProjectId && materialCompositeKey(x.nama, x.dimensi, x.spesifikasi) === targetKey);
            // Fallback: jika tidak ada kebutuhan dgn dimensi/spesifikasi persis sama, coba cocokkan nama saja
            // (lebih baik menampilkan estimasi harga daripada tidak sama sekali, tapi kombinasi lengkap tetap diutamakan)
            if (!k) {
                const target = nama.toString().trim().toLowerCase();
                k = kebutuhanMatData.find(x => x.projId === activeProjectId && (x.nama || '').toString().trim().toLowerCase() === target && !(x.dimensi || '').trim() && !(x.spesifikasi || '').trim());
            }
            return k ? (k.harga || 0) : 0;
        }
        // Alias lama dipertahankan agar kompatibel bila dipanggil dari tempat lain, tapi kini turut memakai dimensi & spesifikasi
        function getHargaSatuanByNama(nama, dimensi, spesifikasi) {
            return getHargaSatuan(nama, dimensi, spesifikasi);
        }

        // Helper: ambil Dimensi & Spesifikasi suatu material berdasarkan nama (dicari dari data Masuk, lalu Order, lalu Kebutuhan)
        function getMaterialInfoByNama(nama) {
            if (!nama) return { dimensi: '', spesifikasi: '' };
            const target = nama.toString().trim().toLowerCase();
            const cari = (arr) => arr.find(x => x.projId === activeProjectId && (x.nama || '').toString().trim().toLowerCase() === target);
            const m = cari(materialMasukData) || cari(materialOrderData) || cari(kebutuhanMatData);
            return { dimensi: (m && m.dimensi) || '', spesifikasi: (m && m.spesifikasi) || '' };
        }

        function renderMaterialTable() {
            const head = document.getElementById('materialTableHead');
            const tbody = document.getElementById('materialTableBody');
            head.innerHTML = '';
            tbody.innerHTML = '';

            const search = (document.getElementById('matSearchInput').value || '').toLowerCase();

            if (activeMaterialSub === 'mat-kebutuhan') {
                head.innerHTML = `<tr><th class="p-3">Kode</th><th class="p-3">Nama Material</th><th class="p-3">Dimensi</th><th class="p-3">Spesifikasi</th><th class="p-3">Satuan</th><th class="p-3">Volume</th><th class="p-3">Harga Satuan</th><th class="p-3">Total Harga</th><th class="p-3">Nama Toko</th><th class="p-3">Kontak Toko</th><th class="p-3">PIC</th><th class="p-3">Status Order</th><th class="p-3">% Sudah Diorder</th><th class="p-3 text-center col-aksi">Aksi</th></tr>`;
                const data = kebutuhanMatData.filter(d => d.projId === activeProjectId && (d.nama.toLowerCase().includes(search) || (d.supplier || '').toLowerCase().includes(search)));
                if (data.length === 0) { tbody.innerHTML = `<tr><td colspan="14" class="p-6 text-center text-slate-500">Belum ada data kebutuhan material.</td></tr>`; return; }
                // Hitung status order tiap item dulu, lalu urutkan berkelompok: BELUM ORDER paling atas (paling
                // butuh perhatian/tindak lanjut), ORDER SEBAGIAN di tengah, SUDAH ORDER (100%) paling bawah -
                // supaya langsung ketahuan material mana saja yang belum dipesan tanpa perlu mencari manual.
                // Di dalam tiap kelompok, urutan mengikuti waktu input (id = timestamp saat data dibuat).
                const withStatus = data.map(item => {
                    const sudahDipesan = getKebutuhanOrderedTotal(item.id, null);
                    const persenDipesan = item.volume > 0 ? Math.min(100, (sudahDipesan / item.volume) * 100) : 0;
                    const statusGroup = persenDipesan <= 0 ? 0 : (persenDipesan >= 100 ? 2 : 1);
                    return { item, persenDipesan, statusGroup };
                });
                const sortedData = withStatus.sort((a, b) => a.statusGroup - b.statusGroup || a.item.id - b.item.id);
                const groupLabel = { 0: 'BELUM DI-ORDER', 1: 'SEDANG ORDER SEBAGIAN', 2: 'SUDAH DI-ORDER (100%)' };
                const groupColor = { 0: 'bg-red-900/40 text-red-300', 1: 'bg-amber-900/40 text-amber-300', 2: 'bg-emerald-900/40 text-emerald-300' };
                let totalNilaiKebutuhan = 0;
                let currentGroup = null;
                sortedData.forEach(({ item, persenDipesan, statusGroup }) => {
                    if (statusGroup !== currentGroup) {
                        const count = sortedData.filter(x => x.statusGroup === statusGroup).length;
                        tbody.innerHTML += `<tr class="${groupColor[statusGroup]}"><td colspan="14" class="px-3 py-1.5 font-bold text-[10px] uppercase tracking-wider">${groupLabel[statusGroup]} (${count} item)</td></tr>`;
                        currentGroup = statusGroup;
                    }
                    const total = item.volume * item.harga;
                    totalNilaiKebutuhan += total;
                    let statusBadge;
                    if (persenDipesan <= 0) {
                        statusBadge = `<span class="bg-slate-600/30 text-slate-300 px-2.5 py-1 rounded-full text-[10px] font-bold">Belum Order</span>`;
                    } else if (persenDipesan >= 100) {
                        statusBadge = `<span class="bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-bold">Sudah Order (100%)</span>`;
                    } else {
                        statusBadge = `<span class="bg-amber-500/20 text-amber-400 px-2.5 py-1 rounded-full text-[10px] font-bold">Order Sebagian</span>`;
                    }
                    tbody.innerHTML += `
                        <tr class="hover:bg-slate-800/50 transition">
                            <td class="p-3 font-mono text-sky-300">${item.kode || '-'}</td>
                            <td class="p-3 font-bold text-white">${item.nama}</td>
                            <td class="p-3 text-slate-300">${item.dimensi || '-'}</td>
                            <td class="p-3 text-slate-300">${item.spesifikasi || '-'}</td>
                            <td class="p-3 font-mono">${item.satuan}</td>
                            <td class="p-3 font-mono">${formatAngka(item.volume)}</td>
                            <td class="p-3 font-mono">${formatRupiah(item.harga)}</td>
                            <td class="p-3 font-mono font-bold text-emerald-400">${formatRupiah(total)}</td>
                            <td class="p-3 text-slate-300">${item.supplier || '-'}</td>
                            <td class="p-3 text-slate-300">${item.kontak || '-'}</td>
                            <td class="p-3 text-slate-300">${item.pic || '-'}</td>
                            <td class="p-3">${statusBadge}</td>
                            <td class="p-3 font-mono">${formatAngka(persenDipesan)}%</td>
                            <td class="p-3 text-center">
                                <button onclick="editMaterialItem('kebutuhan', ${item.id})" class="bg-sky-600/20 hover:bg-sky-600 text-sky-400 hover:text-white p-1 rounded mr-1"><i class="fa-solid fa-pen text-xs"></i></button>
                                <button onclick="deleteMaterialItem('kebutuhan', ${item.id})" class="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white p-1 rounded"><i class="fa-solid fa-trash-can text-xs"></i></button>
                            </td>
                        </tr>
                    `;
                });
                tbody.innerHTML += `
                    <tr class="bg-[#0b132b] border-t-2 border-slate-700">
                        <td colspan="7" class="p-3 text-right font-bold text-white uppercase text-[11px]">Total Nilai Kebutuhan Material</td>
                        <td class="p-3 font-mono font-bold text-emerald-300">${formatRupiah(totalNilaiKebutuhan)}</td>
                        <td colspan="6"></td>
                    </tr>
                `;
            } else if (activeMaterialSub === 'mat-order') {
                head.innerHTML = `<tr><th class="p-3">Tanggal PO</th><th class="p-3">Nama Material</th><th class="p-3">Dimensi</th><th class="p-3">Spesifikasi</th><th class="p-3">Keterangan PO (Tahap)</th><th class="p-3">Volume Order</th><th class="p-3">Total Nilai</th><th class="p-3">Estimasi Tiba</th><th class="p-3">Supplier</th><th class="p-3">Kontak Toko</th><th class="p-3">PIC</th><th class="p-3">Sudah Masuk</th><th class="p-3">Sisa Belum Masuk</th><th class="p-3">% Sudah Masuk</th><th class="p-3">Status</th><th class="p-3 text-center col-aksi">Aksi</th></tr>`;
                const data = materialOrderData.filter(d => d.projId === activeProjectId && (d.nama.toLowerCase().includes(search) || (d.supplier || '').toLowerCase().includes(search)));
                if (data.length === 0) { tbody.innerHTML = `<tr><td colspan="16" class="p-6 text-center text-slate-500">Belum ada data Material Order.</td></tr>`; return; }

                // Urutkan berdasarkan tanggal PO agar bisa dikelompokkan per hari
                const sortedData = [...data].sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || '') || a.id - b.id);

                let totalNilaiOrder = 0;
                let dailyVolumeMap = {};
                let dailyNilai = 0;
                let currentTanggal = null;
                let currentMonthKeyOrder = null;

                const flushDailySubtotal = (tgl) => {
                    if (tgl === null) return;
                    const volText = Object.entries(dailyVolumeMap).map(([sat, vol]) => `${vol} ${sat}`).join(', ') || '-';
                    tbody.innerHTML += `
                        <tr class="bg-[#111c33] border-t border-b border-slate-700">
                            <td colspan="5" class="p-3 text-right font-bold text-slate-300 uppercase text-[10px]">Total Diorder Tanggal ${tgl || '-'}</td>
                            <td class="p-3 font-mono font-bold text-sky-300">${volText}</td>
                            <td class="p-3 font-mono font-bold text-emerald-300">${formatRupiah(dailyNilai)}</td>
                            <td colspan="9"></td>
                        </tr>
                    `;
                    dailyVolumeMap = {};
                    dailyNilai = 0;
                };

                sortedData.forEach(item => {
                    if (currentTanggal !== null && item.tanggal !== currentTanggal) {
                        flushDailySubtotal(currentTanggal);
                    }
                    // Sisipkan baris pemisah setiap kali data berpindah bulan (dicek sebelum baris tanggal baru dimulai)
                    const monthKey = (item.tanggal || '').slice(0, 7);
                    if (monthKey && monthKey !== currentMonthKeyOrder) {
                        tbody.innerHTML += buildMonthSeparatorRow(item.tanggal, 16);
                        currentMonthKeyOrder = monthKey;
                    }
                    currentTanggal = item.tanggal;

                    const st = getOrderMasukStatus(item);
                    const tahap = getOrderTahapKe(item);
                    const totalItem = (item.volume || 0) * (item.harga || 0);
                    totalNilaiOrder += totalItem;
                    dailyNilai += totalItem;
                    dailyVolumeMap[item.satuan] = (dailyVolumeMap[item.satuan] || 0) + (item.volume || 0);

                    let statusBadge;
                    if (st.persen >= 100) statusBadge = `<span class="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">Sudah Masuk</span>`;
                    else if (st.persen > 0) statusBadge = `<span class="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">Belum 100%</span>`;
                    else statusBadge = `<span class="bg-slate-500/20 text-slate-300 px-2 py-0.5 rounded text-[10px] font-bold">Belum Masuk</span>`;
                    tbody.innerHTML += `
                        <tr class="hover:bg-slate-800/50 transition">
                            <td class="p-3 font-mono text-amber-400">${item.tanggal}</td>
                            <td class="p-3 font-bold text-white">${item.nama}</td>
                            <td class="p-3 text-slate-300">${item.dimensi || '-'}</td>
                            <td class="p-3 text-slate-300">${item.spesifikasi || '-'}</td>
                            <td class="p-3 text-slate-300">
                                <span class="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded text-[10px] font-bold mr-1 whitespace-nowrap">Tahap ${tahap.ke} dari ${tahap.total}</span>
                                <div class="text-[10px] text-slate-400 mt-0.5">${item.ket || '-'}</div>
                            </td>
                            <td class="p-3 font-mono">${formatAngka(item.volume)} ${item.satuan}</td>
                            <td class="p-3 font-mono font-bold text-emerald-400">${formatRupiah(totalItem)}</td>
                            <td class="p-3 font-mono text-sky-300">${item.estimasiTiba || '-'}</td>
                            <td class="p-3 text-slate-300">${item.supplier}</td>
                            <td class="p-3 text-slate-300 font-mono">${item.kontak || '-'}</td>
                            <td class="p-3 text-slate-300">${item.pic || '-'}</td>
                            <td class="p-3 font-mono font-bold text-sky-300">${formatAngka(st.totalMasuk)} ${item.satuan}</td>
                            <td class="p-3 font-mono text-rose-400">${formatAngka(st.sisa)} ${item.satuan}</td>
                            <td class="p-3 font-mono font-bold text-emerald-400">${st.persen.toFixed(1)}%</td>
                            <td class="p-3">${statusBadge}</td>
                            <td class="p-3 text-center">
                                <button onclick="editMaterialItem('order', ${item.id})" class="bg-sky-600/20 hover:bg-sky-600 text-sky-400 hover:text-white p-1 rounded mr-1"><i class="fa-solid fa-pen text-xs"></i></button>
                                <button onclick="deleteMaterialItem('order', ${item.id})" class="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white p-1 rounded"><i class="fa-solid fa-trash-can text-xs"></i></button>
                            </td>
                        </tr>
                    `;
                });
                flushDailySubtotal(currentTanggal);

                const activeProj = projects.find(p => p.id === activeProjectId);
                const rentangProyek = activeProj && activeProj.tglMulai && activeProj.tglSelesai
                    ? `${activeProj.tglMulai} s/d ${activeProj.tglSelesai}`
                    : `${sortedData[0].tanggal || '-'} s/d ${sortedData[sortedData.length - 1].tanggal || '-'}`;
                tbody.innerHTML += `
                    <tr class="bg-[#0b132b] border-t-2 border-slate-700">
                        <td colspan="6" class="p-3 text-right font-bold text-white uppercase text-[11px]">Total Keseluruhan Order Material (Hari Pertama - Hari Akhir Proyek: ${rentangProyek})</td>
                        <td class="p-3 font-mono font-bold text-emerald-300">${formatRupiah(totalNilaiOrder)}</td>
                        <td colspan="9"></td>
                    </tr>
                `;
            } else if (activeMaterialSub === 'mat-masuk') {
                head.innerHTML = `<tr><th class="p-3">Tanggal</th><th class="p-3">No. Nota / SJ</th><th class="p-3">Nama Material</th><th class="p-3">Dimensi</th><th class="p-3">Spesifikasi</th><th class="p-3">Volume Masuk</th><th class="p-3">Total Nilai</th><th class="p-3">Supplier</th><th class="p-3">Kontak Toko</th><th class="p-3">PIC</th><th class="p-3 text-center col-aksi">Aksi</th></tr>`;
                const data = materialMasukData.filter(d => d.projId === activeProjectId && (d.nama.toLowerCase().includes(search) || d.supplier.toLowerCase().includes(search) || (d.nota || '').toLowerCase().includes(search)));
                if (data.length === 0) { tbody.innerHTML = `<tr><td colspan="11" class="p-6 text-center text-slate-500">Belum ada data Material Masuk.</td></tr>`; return; }
                // Urutkan berdasarkan Tanggal Terima
                const sortedData = [...data].sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || '') || a.id - b.id);
                let totalNilaiMasuk = 0;
                let currentMonthKeyMasuk = null;
                sortedData.forEach(item => {
                    const monthKey = (item.tanggal || '').slice(0, 7);
                    if (monthKey && monthKey !== currentMonthKeyMasuk) {
                        tbody.innerHTML += buildMonthSeparatorRow(item.tanggal, 11);
                        currentMonthKeyMasuk = monthKey;
                    }
                    const hargaSatuan = getHargaSatuan(item.nama, item.dimensi, item.spesifikasi);
                    const totalItem = (item.volume || 0) * hargaSatuan;
                    totalNilaiMasuk += totalItem;
                    // Kontak toko & PIC di-JOIN LANGSUNG dari Order terkait (bukan disalin/disimpan sendiri di
                    // baris Masuk) - supaya selalu ikut sinkron otomatis kalau data Order/Kebutuhan Material
                    // diedit, tanpa perlu proses sinkronisasi tambahan.
                    const relatedOrder = materialOrderData.find(o => o.id == item.orderId);
                    tbody.innerHTML += `
                        <tr class="hover:bg-slate-800/50 transition">
                            <td class="p-3 font-mono text-amber-400">${item.tanggal}</td>
                            <td class="p-3 font-mono text-sky-300 font-bold">${item.nota}</td>
                            <td class="p-3 font-bold text-white">${item.nama}</td>
                            <td class="p-3 text-slate-300">${item.dimensi || '-'}</td>
                            <td class="p-3 text-slate-300">${item.spesifikasi || '-'}</td>
                            <td class="p-3 font-mono font-bold text-emerald-400">${formatAngka(item.volume)} ${item.satuan}</td>
                            <td class="p-3 font-mono font-bold text-emerald-400">${hargaSatuan ? formatRupiah(totalItem) : '-'}</td>
                            <td class="p-3 text-slate-300">${item.supplier}</td>
                            <td class="p-3 text-slate-300 font-mono">${(relatedOrder && relatedOrder.kontak) || '-'}</td>
                            <td class="p-3 text-slate-300">${(relatedOrder && relatedOrder.pic) || '-'}</td>
                            <td class="p-3 text-center">
                                <button onclick="editMaterialItem('masuk', ${item.id})" class="bg-sky-600/20 hover:bg-sky-600 text-sky-400 hover:text-white p-1 rounded mr-1"><i class="fa-solid fa-pen text-xs"></i></button>
                                <button onclick="deleteMaterialItem('masuk', ${item.id})" class="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white p-1 rounded"><i class="fa-solid fa-trash-can text-xs"></i></button>
                            </td>
                        </tr>
                    `;
                });
                tbody.innerHTML += `
                    <tr class="bg-[#0b132b] border-t-2 border-slate-700">
                        <td colspan="6" class="p-3 text-right font-bold text-white uppercase text-[11px]">Total Nilai Material Masuk</td>
                        <td class="p-3 font-mono font-bold text-emerald-300">${formatRupiah(totalNilaiMasuk)}</td>
                        <td colspan="4"></td>
                    </tr>
                `;
            } else if (activeMaterialSub === 'mat-keluar') {
                head.innerHTML = `<tr><th class="p-3">Tanggal</th><th class="p-3">Nama Material</th><th class="p-3">Dimensi</th><th class="p-3">Spesifikasi</th><th class="p-3">Volume Keluar</th><th class="p-3">Total Nilai</th><th class="p-3">Penerima</th><th class="p-3">Untuk Pekerjaan</th><th class="p-3 text-center col-aksi">Aksi</th></tr>`;
                const data = materialKeluarData.filter(d => d.projId === activeProjectId && (d.nama.toLowerCase().includes(search) || (d.penerima || '').toLowerCase().includes(search)));
                if (data.length === 0) { tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-slate-500">Belum ada data Material Keluar.</td></tr>`; return; }
                // Urutkan berdasarkan Tanggal Keluar
                const sortedData = [...data].sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || '') || a.id - b.id);
                let totalNilaiKeluar = 0;
                let currentMonthKeyKeluar = null;
                sortedData.forEach(item => {
                    const monthKey = (item.tanggal || '').slice(0, 7);
                    if (monthKey && monthKey !== currentMonthKeyKeluar) {
                        tbody.innerHTML += buildMonthSeparatorRow(item.tanggal, 9);
                        currentMonthKeyKeluar = monthKey;
                    }
                    const hargaSatuan = getHargaSatuan(item.nama, item.dimensi, item.spesifikasi);
                    const totalItem = (item.volume || 0) * hargaSatuan;
                    totalNilaiKeluar += totalItem;
                    tbody.innerHTML += `
                        <tr class="hover:bg-slate-800/50 transition">
                            <td class="p-3 font-mono text-amber-400">${item.tanggal}</td>
                            <td class="p-3 font-bold text-white">${item.nama}</td>
                            <td class="p-3 text-slate-300">${item.dimensi || '-'}</td>
                            <td class="p-3 text-slate-300">${item.spesifikasi || '-'}</td>
                            <td class="p-3 font-mono font-bold text-rose-400">${formatAngka(item.volume)} ${item.satuan}</td>
                            <td class="p-3 font-mono font-bold text-rose-400">${hargaSatuan ? formatRupiah(totalItem) : '-'}</td>
                            <td class="p-3 text-slate-300">${item.penerima || '-'}</td>
                            <td class="p-3 text-slate-400">${item.pekerjaan}</td>
                            <td class="p-3 text-center">
                                <button onclick="editMaterialItem('keluar', ${item.id})" class="bg-sky-600/20 hover:bg-sky-600 text-sky-400 hover:text-white p-1 rounded mr-1"><i class="fa-solid fa-pen text-xs"></i></button>
                                <button onclick="deleteMaterialItem('keluar', ${item.id})" class="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white p-1 rounded"><i class="fa-solid fa-trash-can text-xs"></i></button>
                            </td>
                        </tr>
                    `;
                });
                tbody.innerHTML += `
                    <tr class="bg-[#0b132b] border-t-2 border-slate-700">
                        <td colspan="5" class="p-3 text-right font-bold text-white uppercase text-[11px]">Total Nilai Material Keluar</td>
                        <td class="p-3 font-mono font-bold text-rose-300">${formatRupiah(totalNilaiKeluar)}</td>
                        <td colspan="3"></td>
                    </tr>
                `;
            } else if (activeMaterialSub === 'mat-sisa') {
                head.innerHTML = `<tr><th class="p-3">Nama Material</th><th class="p-3">Dimensi</th><th class="p-3">Spesifikasi</th><th class="p-3">Satuan</th><th class="p-3">Total Masuk</th><th class="p-3">Total Keluar</th><th class="p-3">Stok Sisa</th><th class="p-3">Nilai Stok Sisa</th><th class="p-3">Status Stok</th></tr>`;
                // Gunakan helper yang sama dengan yang dipakai form Material Keluar & Export, agar list & export SELALU sinkron
                const sisaList = getMaterialSisaList().filter(s => (s.nama || '').toLowerCase().includes(search));
                if (sisaList.length === 0) { tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-slate-500">Belum ada transaksi material masuk/keluar untuk proyek ini.</td></tr>`; return; }
                // Urutkan berdasarkan tanggal transaksi (masuk/keluar) paling awal per material
                sisaList.sort((a, b) => (a.tanggalAwal || '').localeCompare(b.tanggalAwal || '') || a.nama.localeCompare(b.nama));
                let totalNilaiSisa = 0;
                sisaList.forEach(s => {
                    const hargaSatuan = getHargaSatuan(s.nama, s.dimensi, s.spesifikasi);
                    const nilaiSisa = (s.sisa > 0 ? s.sisa : 0) * hargaSatuan;
                    totalNilaiSisa += nilaiSisa;
                    const statusBadge = s.sisa <= 0
                        ? `<span class="bg-red-500/20 text-red-300 px-2 py-0.5 rounded text-[10px] font-bold">Habis</span>`
                        : `<span class="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">Aman / Tersedia</span>`;
                    tbody.innerHTML += `
                        <tr class="hover:bg-slate-800/50 transition">
                            <td class="p-3 font-bold text-white">${s.nama}</td>
                            <td class="p-3 text-slate-300">${s.dimensi || '-'}</td>
                            <td class="p-3 text-slate-300">${s.spesifikasi || '-'}</td>
                            <td class="p-3 font-mono">${s.satuan}</td>
                            <td class="p-3 font-mono text-emerald-400">${s.masuk}</td>
                            <td class="p-3 font-mono text-rose-400">${s.keluar}</td>
                            <td class="p-3 font-mono font-bold text-amber-400">${formatAngka(s.sisa)} ${s.satuan}</td>
                            <td class="p-3 font-mono font-bold text-sky-300">${hargaSatuan ? formatRupiah(nilaiSisa) : '-'}</td>
                            <td class="p-3">${statusBadge}</td>
                        </tr>
                    `;
                });
                tbody.innerHTML += `
                    <tr class="bg-[#0b132b] border-t-2 border-slate-700">
                        <td colspan="6" class="p-3 text-right font-bold text-white uppercase text-[11px]">Total Nilai Stok Sisa</td>
                        <td colspan="2" class="p-3 font-mono font-bold text-sky-300">${formatRupiah(totalNilaiSisa)}</td>
                        <td></td>
                    </tr>
                `;
            }
        }

        function deleteMaterialItem(type, id) {
            if (!canUserEdit()) { alert('Akses ditolak. Admin telah menonaktifkan izin edit akun Anda untuk proyek ini.'); return; }
            if (confirm('Hapus item material ini?')) {
                if (type === 'kebutuhan') kebutuhanMatData = kebutuhanMatData.filter(x => x.id != id), localStorage.setItem('erp_kebutuhan_mat', JSON.stringify(kebutuhanMatData));
                else if (type === 'order') materialOrderData = materialOrderData.filter(x => x.id != id), localStorage.setItem('erp_mat_order', JSON.stringify(materialOrderData));
                else if (type === 'masuk') materialMasukData = materialMasukData.filter(x => x.id != id), localStorage.setItem('erp_mat_masuk', JSON.stringify(materialMasukData));
                else if (type === 'keluar') materialKeluarData = materialKeluarData.filter(x => x.id != id), localStorage.setItem('erp_mat_keluar', JSON.stringify(materialKeluarData));
                if (materialEditContext && materialEditContext.type === type && materialEditContext.id == id) {
                    materialEditContext = null;
                }
                renderMaterialSection();
            }
        }

        // Scan Nota Modal Functions (Full Extraction)
        function openScanNotaModal() {
            document.getElementById('scanNotaModal').classList.remove('hidden');
            document.getElementById('notaExtractedTextResult').value = '';
        }

        function closeScanNotaModal() {
            document.getElementById('scanNotaModal').classList.add('hidden');
        }

        function handleNotaImageSelected(e) {
            const file = e.target.files[0];
            if (!file) return;
            // Simulated AI OCR extracting ALL items without exception from receipt image
            setTimeout(() => {
                const simulatedExtractedText = 
`NOTA SUPPLIER: TB SINAR JAYA ABADI
TANGGAL: 2026-03-24 | NO NOTA: SJ-99821
---------------------------------------------
1. Semen Gresik 50kg - 100 Sak @Rp68000
2. Besi Beton Ø12mm - 50 Batang @Rp95000
3. Pasir Pasang - 15 m3 @Rp250000
4. Koral Beton - 10 m3 @Rp280000
5. Paku Kayu 5cm - 5 Kg @Rp20000
---------------------------------------------
SEMUA ITEM BERHASIL DIEKSTRAK TANPA TERKECUALI!`;
                document.getElementById('notaExtractedTextResult').value = simulatedExtractedText;
            }, 500);
        }

        function applyScannedNotaItems() {
            // Automatically push all extracted items to Material Masuk
            const today = new Date().toISOString().split('T')[0];
            const scannedItems = [
                { nama: 'Semen Gresik 50kg', spesifikasi: '', volume: 100, satuan: 'Sak', nota: 'SJ-99821', supplier: 'TB Sinar Jaya Abadi' },
                { nama: 'Besi Beton Ø12mm', spesifikasi: '', volume: 50, satuan: 'Batang', nota: 'SJ-99821', supplier: 'TB Sinar Jaya Abadi' },
                { nama: 'Pasir Pasang', spesifikasi: '', volume: 15, satuan: 'm3', nota: 'SJ-99821', supplier: 'TB Sinar Jaya Abadi' },
                { nama: 'Koral Beton', spesifikasi: '', volume: 10, satuan: 'm3', nota: 'SJ-99821', supplier: 'TB Sinar Jaya Abadi' },
                { nama: 'Paku Kayu 5cm', spesifikasi: '', volume: 5, satuan: 'Kg', nota: 'SJ-99821', supplier: 'TB Sinar Jaya Abadi' }
            ];

            scannedItems.forEach(item => {
                materialMasukData.push({
                    id: Date.now() + Math.random(),
                    projId: activeProjectId,
                    tanggal: today,
                    ...item
                });
            });

            localStorage.setItem('erp_mat_masuk', JSON.stringify(materialMasukData));
            closeScanNotaModal();
            renderMaterialSection();
            alert('Semua item nota berhasil dimasukkan ke Material Masuk!');
        }

        // Backup Quantity AI Takeoff
        function handleBqImageUpload(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
                document.getElementById('bqImagePreviewBox').innerHTML = `<img src="${evt.target.result}" class="w-full h-36 object-cover rounded-lg">`;
            };
            reader.readAsDataURL(file);
        }

        function processBqImageAnalysis() {
            const kategori = document.getElementById('bqKategori').value;
            // Simulated AI calculation
            bqResultsData = [
                { id: 1, nama: 'Semen Gresik 50kg', satuan: 'Sak', volume: 240, harga: 68000 },
                { id: 2, nama: 'Pasir Pasang', satuan: 'm3', volume: 35, harga: 250000 },
                { id: 3, nama: 'Besi Beton Ø16mm', satuan: 'Batang', volume: 85, harga: 145000 },
                { id: 4, nama: 'Bata Merah', satuan: 'Buah', volume: 4500, harga: 900 }
            ];
            localStorage.setItem('erp_bq_results', JSON.stringify(bqResultsData));
            renderBqResultsTable();
            alert(`Analisis gambar kategori "${kategori}" berhasil! Perhitungan material selesai secara detail.`);
        }

        // Render the Backup Quantity results table (used by both AI image analysis and manual input)
        function renderBqResultsTable() {
            const tbody = document.getElementById('bqResultTableBody');
            if (!tbody) return;
            if (!bqResultsData || bqResultsData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-slate-500">Belum ada gambar yang dianalisis atau perhitungan manual. Silakan upload gambar atau isi input manual di sebelah kiri.</td></tr>';
                return;
            }
            tbody.innerHTML = '';
            bqResultsData.forEach((item, idx) => {
                const total = item.volume * item.harga;
                tbody.innerHTML += `
                    <tr class="hover:bg-slate-800/50 transition">
                        <td class="p-3 font-mono">${idx + 1}</td>
                        <td class="p-3 font-bold text-white">${item.nama}</td>
                        <td class="p-3 font-mono">${item.satuan}</td>
                        <td class="p-3 font-mono text-amber-400 font-bold">${formatAngka(item.volume)}</td>
                        <td class="p-3 font-mono">${formatRupiah(item.harga)}</td>
                        <td class="p-3 font-mono font-bold text-emerald-400">${formatRupiah(total)}</td>
                        <td class="p-3 text-center">
                            <button onclick="deleteBqEstimasiRow(${idx})" class="text-red-400 hover:text-red-300 transition" title="Hapus baris ini"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>
                `;
            });
        }

        // Hapus 1 baris hasil estimasi yang sudah tidak diperlukan (mis. salah analisis / item tidak relevan),
        // tanpa perlu mengosongkan seluruh daftar.
        function deleteBqEstimasiRow(idx) {
            if (!confirm('Hapus baris hasil estimasi ini?')) return;
            bqResultsData.splice(idx, 1);
            localStorage.setItem('erp_bq_results', JSON.stringify(bqResultsData));
            renderBqResultsTable();
        }

        // Kosongkan SELURUH daftar hasil estimasi/material takeoff yang sudah tidak digunakan lagi
        // (mis. mau mulai analisis gambar baru dari nol, atau daftar lama sudah tidak relevan).
        function clearBqEstimasiData() {
            if (!bqResultsData || bqResultsData.length === 0) { alert('Data estimasi memang sudah kosong.'); return; }
            if (!confirm('Kosongkan SELURUH daftar hasil estimasi/material takeoff ini? Tindakan ini tidak bisa dibatalkan.')) return;
            bqResultsData = [];
            localStorage.setItem('erp_bq_results', JSON.stringify(bqResultsData));
            renderBqResultsTable();
            document.getElementById('bqImagePreviewBox').innerHTML = `
                <i class="fa-solid fa-cloud-arrow-up text-3xl text-amber-400"></i>
                <p class="text-slate-300 font-medium">Klik untuk upload gambar denah / potongan / barbending</p>
                <p class="text-[10px] text-slate-500">Format: PNG, JPG, WEBP (Screenshot didukung)</p>`;
        }

        function renderBackupQuantity() {
            renderBqResultsTable();
            renderBqManualFields();
        }

        // ===================================================================
        // BACKUP QUANTITY - OPNAME LAPANGAN
