"""
Circuit breaker for LLM calls — prevents cascade failures.
States: CLOSED (normal) → OPEN (failing, reject fast) → HALF_OPEN (probe).
Thread-safe via asyncio lock.
"""
import asyncio
import time
from enum import Enum

import structlog

log = structlog.get_logger(__name__)

_FAILURE_THRESHOLD = 5
_RECOVERY_TIMEOUT_S = 30
_HALF_OPEN_MAX_CALLS = 2


class State(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitOpenError(Exception):
    pass


class CircuitBreaker:
    def __init__(
        self,
        name: str = "llm",
        failure_threshold: int = _FAILURE_THRESHOLD,
        recovery_timeout_s: float = _RECOVERY_TIMEOUT_S,
    ):
        self.name = name
        self._failure_threshold = failure_threshold
        self._recovery_timeout_s = recovery_timeout_s
        self._state = State.CLOSED
        self._failure_count = 0
        self._last_failure_time = 0.0
        self._half_open_calls = 0
        self._lock = asyncio.Lock()

    @property
    def state(self) -> State:
        if self._state == State.OPEN:
            if time.monotonic() - self._last_failure_time >= self._recovery_timeout_s:
                return State.HALF_OPEN
        return self._state

    async def __aenter__(self):
        async with self._lock:
            current = self.state
            if current == State.OPEN:
                log.warning("circuit_breaker_open", name=self.name, failures=self._failure_count)
                raise CircuitOpenError(
                    "Rusty is taking a short break. Please try again in a moment."
                )
            if current == State.HALF_OPEN:
                self._half_open_calls += 1
                if self._half_open_calls > _HALF_OPEN_MAX_CALLS:
                    raise CircuitOpenError(
                        "Rusty is still recovering. Please try again shortly."
                    )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        async with self._lock:
            if exc_type is None:
                if self._state in (State.HALF_OPEN, State.OPEN):
                    log.info("circuit_breaker_recovered", name=self.name)
                self._state = State.CLOSED
                self._failure_count = 0
                self._half_open_calls = 0
            else:
                self._failure_count += 1
                self._last_failure_time = time.monotonic()
                if self._failure_count >= self._failure_threshold:
                    self._state = State.OPEN
                    log.error(
                        "circuit_breaker_tripped",
                        name=self.name,
                        failures=self._failure_count,
                        recovery_s=self._recovery_timeout_s,
                    )
                elif self.state == State.HALF_OPEN:
                    self._state = State.OPEN
        return False


llm_breaker = CircuitBreaker(name="llm")
