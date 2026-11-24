"""Tes buat rata_rata (contoh tugas Trio AI Hub)."""

from mean_utils import rata_rata


def test_biasa():
    assert rata_rata([1, 2, 3, 4]) == 2.5


def test_lewati_none():
    assert rata_rata([1, None, 3]) == 2.0


def test_kosong():
    assert rata_rata([]) is None


def test_semua_none():
    assert rata_rata([None, None]) is None
