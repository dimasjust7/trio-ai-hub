# BRIEF — T-000: fungsi rata-rata dengan handling nilai kosong

**Status:** DONE
**Ditugaskan ke:** Antigravity
**Ditulis oleh:** Muse
**Tanggal:** 2026-11-24

## Tujuan

Buat fungsi Python `rata_rata` yang menghitung rata-rata dari sebuah list angka, dengan handling nilai kosong (`None`) yang dilewati.

## Ruang lingkup

Termasuk: fungsi `rata_rata` di `mean_utils.py` dan tes di `test_mean_utils.py`.
Tidak termasuk: fungsi statistik lain, CLI, atau file di luar folder tugas ini.

## File yang relevan

- `handoffs/T-000-CONTOH/mean_utils.py` (dibuat baru)
- `handoffs/T-000-CONTOH/test_mean_utils.py` (dibuat baru)

## Kriteria selesai (acceptance criteria)

1. `rata_rata([1, 2, 3, 4])` mengembalikan `2.5`.
2. `rata_rata([1, None, 3])` mengembalikan `2.0` (nilai `None` dilewati).
3. `rata_rata([])` dan `rata_rata([None, None])` mengembalikan `None`.
4. Tes `pytest test_mean_utils.py` lolos semua.

## Batasan

- Jangan pakai library eksternal, hanya Python standar.
- Jangan ubah file di luar folder tugas ini.

## Output yang diharapkan

- File `mean_utils.py` dan `test_mean_utils.py` di folder tugas ini.
- Isi `RESULT.md` setelah selesai.
- Commit dengan pesan `T-000: fungsi rata-rata dengan handling nilai kosong`.
