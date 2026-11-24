"""Util rata-rata sederhana (contoh tugas Trio AI Hub)."""


def rata_rata(angka):
    """Hitung rata-rata dari list angka, lewati nilai None.

    Mengembalikan None kalau tidak ada angka yang valid.
    """
    valid = [x for x in angka if x is not None]
    if not valid:
        return None
    return sum(valid) / len(valid)
