"""Tests for the circuit breaker module."""
import asyncio
import pytest
from app.services.circuit_breaker import CircuitBreaker, CircuitOpenError, State


@pytest.fixture
def breaker():
    return CircuitBreaker(name="test", failure_threshold=3, recovery_timeout_s=0.2)


@pytest.mark.asyncio
async def test_starts_closed(breaker):
    assert breaker.state == State.CLOSED


@pytest.mark.asyncio
async def test_stays_closed_on_success(breaker):
    async with breaker:
        pass
    assert breaker.state == State.CLOSED


@pytest.mark.asyncio
async def test_opens_after_threshold_failures(breaker):
    for _ in range(3):
        try:
            async with breaker:
                raise RuntimeError("boom")
        except RuntimeError:
            pass
    assert breaker.state == State.OPEN


@pytest.mark.asyncio
async def test_open_rejects_calls(breaker):
    for _ in range(3):
        try:
            async with breaker:
                raise RuntimeError("boom")
        except RuntimeError:
            pass

    with pytest.raises(CircuitOpenError):
        async with breaker:
            pass


@pytest.mark.asyncio
async def test_half_open_after_recovery_timeout(breaker):
    for _ in range(3):
        try:
            async with breaker:
                raise RuntimeError("boom")
        except RuntimeError:
            pass

    assert breaker.state == State.OPEN
    await asyncio.sleep(0.25)
    assert breaker.state == State.HALF_OPEN


@pytest.mark.asyncio
async def test_recovers_on_success_after_half_open(breaker):
    for _ in range(3):
        try:
            async with breaker:
                raise RuntimeError("boom")
        except RuntimeError:
            pass

    await asyncio.sleep(0.25)
    async with breaker:
        pass
    assert breaker.state == State.CLOSED


@pytest.mark.asyncio
async def test_below_threshold_stays_closed(breaker):
    for _ in range(2):
        try:
            async with breaker:
                raise RuntimeError("boom")
        except RuntimeError:
            pass
    assert breaker.state == State.CLOSED


@pytest.mark.asyncio
async def test_resets_after_recovery(breaker):
    for _ in range(3):
        try:
            async with breaker:
                raise RuntimeError("boom")
        except RuntimeError:
            pass

    await asyncio.sleep(0.25)
    async with breaker:
        pass

    assert breaker._failure_count == 0
