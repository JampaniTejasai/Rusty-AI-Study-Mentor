import pytest
from pydantic import ValidationError
from app.schemas.auth import LoginRequest, PinResetRequest


def test_login_valid():
    r = LoginRequest(student_id="KHEL-2026-001", pin="1234")
    assert r.student_id == "KHEL-2026-001"


def test_login_invalid_id_format():
    with pytest.raises(ValidationError):
        LoginRequest(student_id="BADFORMAT", pin="1234")


def test_login_pin_non_numeric():
    with pytest.raises(ValidationError):
        LoginRequest(student_id="KHEL-2026-001", pin="abcd")


def test_login_pin_too_short():
    with pytest.raises(ValidationError):
        LoginRequest(student_id="KHEL-2026-001", pin="12")


def test_login_pin_too_long():
    with pytest.raises(ValidationError):
        LoginRequest(student_id="KHEL-2026-001", pin="1234567")


def test_pin_reset_valid():
    r = PinResetRequest(student_id="KHEL-2026-001", new_pin="5678")
    assert r.new_pin == "5678"


@pytest.mark.parametrize("pin", ["", "ab12", "123456789"])
def test_pin_reset_invalid_pins(pin):
    with pytest.raises(ValidationError):
        PinResetRequest(student_id="KHEL-2026-001", new_pin=pin)
