import pytest
from rag.retrieval.pre_filter import build_filter


def test_valid_filter():
    f = build_filter(8, "science", "photosynthesis")
    assert f["class_num"] == 8
    assert f["subject"] == "science"
    assert f["chapter"] == "photosynthesis"


def test_chapter_optional():
    f = build_filter(5, "mathematics", None)
    assert f["chapter"] is None


def test_invalid_class():
    with pytest.raises(ValueError):
        build_filter(0, "science", None)

    with pytest.raises(ValueError):
        build_filter(11, "science", None)


def test_invalid_subject():
    with pytest.raises(ValueError):
        build_filter(8, "geography", None)


def test_subject_normalised_lowercase():
    f = build_filter(7, "Mathematics", None)
    assert f["subject"] == "mathematics"
