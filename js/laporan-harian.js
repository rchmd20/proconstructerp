        // ===================================================================
        // --- Manajemen baris Item Pekerjaan pada form Laporan Harian ---
        // Bisa lebih dari 1 baris pekerjaan per tanggal, karena 1 tukang/tim tidak selalu hanya mengerjakan 1 pekerjaan per hari.
        let lhRowCounter = 0;

        function generateLhRowHtml(rowId) {
            return `
                <div class="p-3 bg-[#0b132b] rounded-xl border border-slate-700 space-y-3 lh-pekerjaan-row" data-row-id="${rowId}">
                    <div class="flex items-center justify-between">
                        <span class="text-[11px] font-bold text-sky-300 uppercase tracking-wider">Item Pekerjaan #<span class="lh-row-number">1</span></span>
                        <button type="button" onclick="removeLhPekerjaanRow(${rowId})" class="lh-row-remove-btn hidden text-red-400 hover:text-red-300 text-[11px] flex items-center space-x-1" title="Hapus Item Pekerjaan Ini">
                            <i class="fa-solid fa-trash-can"></i><span>Hapus</span>
                        </button>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div class="md:col-span-2">
                            <label class="block text-slate-400 mb-1">Cari & Pilih Pekerjaan RAB <span class="text-red-400">*</span></label>
                            <div class="relative">
                                <input type="text" oninput="filterLhPekerjaanOptions(${rowId})" placeholder="Ketik nama pekerjaan RAB..." class="lh-search-pekerjaan w-full bg-[#0b132b] border border-slate-700 rounded-t-lg px-3 py-2 text-white text-xs">
                                <select required onchange="updateLhPekerjaanInfo(${rowId})" class="lh-pekerjaan-select w-full bg-[#0f172a] border border-t-0 border-slate-700 rounded-b-lg px-3 py-2 text-white text-xs max-h-32">
                                    <!-- JS Populated -->
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="block text-slate-400 mb-1">Volume Progress Hari Ini <span class="text-red-400">*</span></label>
                            <input type="number" step="any" required placeholder="12.5" oninput="updateLhPekerjaanInfo(${rowId})" class="lh-volume w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono">
                        </div>
                    </div>
                    <div class="lh-pekerjaan-info text-[11px] text-slate-400 -mt-1"></div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label class="block text-slate-400 mb-1">Jumlah Tenaga Kerja (Orang)</label>
                            <input type="text" placeholder="2 Tukang, 5 Pekerja, 1 Mandor" class="lh-tenaga w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-white">
                        </div>
                        <div>
                            <label class="block text-slate-400 mb-1">Jam Aktif</label>
                            <input type="number" step="any" value="8" class="lh-jam-aktif w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-white">
                        </div>
                        <div>
                            <label class="block text-slate-400 mb-1">Jam Lembur</label>
                            <input type="number" step="any" value="0" class="lh-jam-lembur w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-white">
                        </div>
                    </div>
                </div>`;
        }

        function addLhPekerjaanRow(scrollIntoView) {
            lhRowCounter++;
            const rowId = lhRowCounter;
            const container = document.getElementById('lhPekerjaanRowsContainer');
            const wrapper = document.createElement('div');
            wrapper.innerHTML = generateLhRowHtml(rowId).trim();
            const rowEl = wrapper.firstElementChild;
            container.appendChild(rowEl);
            filterLhPekerjaanOptions(rowId);
            renumberLhRows();
            updateLhRemoveButtonsState();
            if (scrollIntoView) rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return rowId;
        }

        function removeLhPekerjaanRow(rowId) {
            const container = document.getElementById('lhPekerjaanRowsContainer');
            if (container.querySelectorAll('.lh-pekerjaan-row').length <= 1) {
                alert('Minimal harus ada 1 item pekerjaan pada laporan harian ini.');
                return;
            }
            const row = container.querySelector(`.lh-pekerjaan-row[data-row-id="${rowId}"]`);
            if (row) row.remove();
            renumberLhRows();
            updateLhRemoveButtonsState();
        }

        function renumberLhRows() {
            document.querySelectorAll('#lhPekerjaanRowsContainer .lh-pekerjaan-row').forEach((row, idx) => {
                const numEl = row.querySelector('.lh-row-number');
                if (numEl) numEl.innerText = idx + 1;
            });
        }

        function updateLhRemoveButtonsState() {
            const rows = document.querySelectorAll('#lhPekerjaanRowsContainer .lh-pekerjaan-row');
            rows.forEach(row => {
                const btn = row.querySelector('.lh-row-remove-btn');
                if (btn) btn.classList.toggle('hidden', rows.length <= 1);
            });
        }

        // Reset form ke mode "tambah baru": 1 baris pekerjaan kosong, tombol tambah pekerjaan aktif kembali
        function resetLhPekerjaanRows() {
            const container = document.getElementById('lhPekerjaanRowsContainer');
            if (container) container.innerHTML = '';
            lhRowCounter = 0;
            addLhPekerjaanRow();
            const btnTambah = document.getElementById('btnTambahLhPekerjaan');
            if (btnTambah) btnTambah.classList.remove('hidden');
        }

        function filterLhPekerjaanOptions(rowId) {
            const row = document.querySelector(`.lh-pekerjaan-row[data-row-id="${rowId}"]`);
            if (!row) return;
            const searchInput = row.querySelector('.lh-search-pekerjaan');
            const select = row.querySelector('.lh-pekerjaan-select');
            const query = searchInput ? searchInput.value.toLowerCase() : '';
            const projRAB = rabData.filter(r => r.projId === activeProjectId);
            const currentVal = select.value;

            select.innerHTML = '';
            const filtered = projRAB.filter(r => r.sub.toLowerCase().includes(query) || r.div.toLowerCase().includes(query) || r.rincian.toLowerCase().includes(query));

            filtered.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = `[${r.div}] ${r.sub} - ${r.rincian} (${r.satuan})`;
                if (currentVal && String(r.id) === String(currentVal)) opt.selected = true;
                select.appendChild(opt);
            });
            updateLhPekerjaanInfo(rowId);
        }

        // Menampilkan volume total pekerjaan (RAB), volume yang sudah dikerjakan (dari Laporan Harian lain), dan sisa volume yang belum dikerjakan
        function updateLhPekerjaanInfo(rowId) {
            const row = document.querySelector(`.lh-pekerjaan-row[data-row-id="${rowId}"]`);
            if (!row) return;
            const select = row.querySelector('.lh-pekerjaan-select');
            const infoEl = row.querySelector('.lh-pekerjaan-info');
            const pekerjaanId = select ? select.value : '';
            if (!infoEl) return;
            if (!pekerjaanId) { infoEl.innerHTML = ''; return; }
            const rab = rabData.find(r => r.id == pekerjaanId);
            if (!rab) { infoEl.innerHTML = ''; return; }

            const editId = document.getElementById('lhEditId').value;
            const sudah = lapHarianData
                .filter(l => l.pekerjaanId == pekerjaanId && String(l.id) !== String(editId))
                .reduce((acc, cur) => acc + (parseFloat(cur.volume) || 0), 0);
            const sisa = rab.volume - sudah;
            const sisaColor = sisa <= 0 ? 'text-red-400' : 'text-emerald-400';
            infoEl.innerHTML = `Volume Total Pekerjaan (RAB): <span class="font-bold text-white">${formatAngka(rab.volume)} ${rab.satuan}</span> &middot; Sudah Dikerjakan: <span class="font-bold text-amber-300">${formatAngka(sudah)} ${rab.satuan}</span> &middot; Sisa Belum Dikerjakan: <span class="font-bold ${sisaColor}">${formatAngka(sisa)} ${rab.satuan}</span>${sisa < 0 ? ' <span class="text-red-400">(Melebihi volume RAB!)</span>' : ''}`;
        }

        // Filter opsi pekerjaan (dari RAB) pada form Material Keluar berdasarkan pencarian
        function filterMkPekerjaanOptions(selectedId) {
            const searchInput = document.getElementById('mkSearchPekerjaan');
            const select = document.getElementById('mkPekerjaanSelect');
            if (!select) return;
            const query = searchInput ? searchInput.value.toLowerCase() : '';
            const projRAB = rabData.filter(r => r.projId === activeProjectId);
            const currentVal = selectedId !== undefined ? selectedId : select.value;

            select.innerHTML = '<option value="">-- Pilih Pekerjaan --</option>';
            const filtered = projRAB.filter(r => r.sub.toLowerCase().includes(query) || r.div.toLowerCase().includes(query) || r.rincian.toLowerCase().includes(query));
            filtered.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = `[${r.div}] ${r.sub} - ${r.rincian}`;
                if (currentVal && r.id == currentVal) opt.selected = true;
                select.appendChild(opt);
            });
        }

        // ===================================================================
        // 1.1 RAB CCO MODULE (Contract Change Order / Adendum)
