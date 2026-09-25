#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────
# Rusty — OWASP ZAP Security Scan Runner
# Scans frontend (5173) + backend (8000) together
# ─────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
REPORTS_DIR="$SCRIPT_DIR/reports"
ZAP_IMAGE="ghcr.io/zaproxy/zaproxy:stable"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[ZAP]${NC} $1"; }
warn() { echo -e "${YELLOW}[ZAP]${NC} $1"; }
error() { echo -e "${RED}[ZAP]${NC} $1"; }
ok() { echo -e "${GREEN}[ZAP]${NC} $1"; }

# ── Pre-flight checks ───────────────────────────────

log "Running pre-flight checks..."

# Check Docker
if ! docker info &>/dev/null; then
    error "Docker is not running. Start Docker Desktop first."
    exit 1
fi
ok "Docker is running"

# Check if ZAP image exists, pull if not
if ! docker image inspect "$ZAP_IMAGE" &>/dev/null; then
    log "Pulling ZAP Docker image (first time only)..."
    docker pull "$ZAP_IMAGE"
fi
ok "ZAP image ready"

# Check backend is running
if ! curl -sf http://localhost:8000/health &>/dev/null; then
    error "Backend not running on port 8000."
    echo "  Start it with: cd backend && source venv/bin/activate && uvicorn app.main:app --port 8000"
    exit 1
fi
ok "Backend is running on :8000"

# Check frontend is running
if ! curl -sf http://localhost:5173 &>/dev/null; then
    error "Frontend not running on port 5173."
    echo "  Start it with: cd frontend && npm run dev"
    exit 1
fi
ok "Frontend is running on :5173"

# Check OpenAPI spec is available (needed for API scan)
if curl -sf http://localhost:8000/openapi.json &>/dev/null; then
    ok "OpenAPI spec available (API scan will use it)"
else
    warn "OpenAPI spec not available — API scan will rely on spidering only"
fi

# ── Prepare output ───────────────────────────────────

mkdir -p "$REPORTS_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

log "Reports will be saved to: $REPORTS_DIR/"
echo ""

# ── Choose scan type ─────────────────────────────────

SCAN_TYPE="${1:-full}"

case "$SCAN_TYPE" in
    quick|baseline)
        log "Running QUICK baseline scan (passive only, ~3 min)..."
        docker run --rm \
            --network host \
            -v "$SCRIPT_DIR:/zap/wrk:rw" \
            -t "$ZAP_IMAGE" \
            zap-baseline.py \
                -t http://localhost:5173 \
                -r "reports/baseline_frontend_${TIMESTAMP}.html" \
                -J "reports/baseline_frontend_${TIMESTAMP}.json" \
                -I \
            || true

        docker run --rm \
            --network host \
            -v "$SCRIPT_DIR:/zap/wrk:rw" \
            -t "$ZAP_IMAGE" \
            zap-api-scan.py \
                -t http://localhost:8000/openapi.json \
                -f openapi \
                -r "reports/baseline_api_${TIMESTAMP}.html" \
                -J "reports/baseline_api_${TIMESTAMP}.json" \
                -I \
            || true
        ;;

    api)
        log "Running API-only scan against backend (port 8000)..."
        docker run --rm \
            --network host \
            -v "$SCRIPT_DIR:/zap/wrk:rw" \
            -t "$ZAP_IMAGE" \
            zap-api-scan.py \
                -t http://localhost:8000/openapi.json \
                -f openapi \
                -r "reports/api_scan_${TIMESTAMP}.html" \
                -J "reports/api_scan_${TIMESTAMP}.json" \
                -I \
            || true
        ;;

    full)
        log "Running FULL automation scan (frontend + backend, ~20-30 min)..."
        docker run --rm \
            --network host \
            -v "$SCRIPT_DIR:/zap/wrk:rw" \
            -t "$ZAP_IMAGE" \
            zap.sh -cmd -autorun /zap/wrk/zap-config.yaml \
            || true
        ;;

    frontend)
        log "Running frontend-only scan (port 5173)..."
        docker run --rm \
            --network host \
            -v "$SCRIPT_DIR:/zap/wrk:rw" \
            -t "$ZAP_IMAGE" \
            zap-full-scan.py \
                -t http://localhost:5173 \
                -r "reports/frontend_scan_${TIMESTAMP}.html" \
                -J "reports/frontend_scan_${TIMESTAMP}.json" \
                -I \
            || true
        ;;

    *)
        echo "Usage: $0 [quick|api|frontend|full]"
        echo ""
        echo "  quick     - Baseline passive scan (~3 min). Good for CI."
        echo "  api       - API scan using OpenAPI spec (~10 min)."
        echo "  frontend  - Full scan of frontend including AJAX spider (~15 min)."
        echo "  full      - Complete scan: frontend + API + active attacks (~30 min)."
        exit 1
        ;;
esac

# ── Summary ──────────────────────────────────────────

echo ""
ok "Scan complete!"
log "Reports saved to:"
ls -la "$REPORTS_DIR/" 2>/dev/null | grep "$TIMESTAMP" | while read -r line; do
    echo "  $line"
done

echo ""
log "To view HTML reports, open them in your browser:"
for f in "$REPORTS_DIR"/*"$TIMESTAMP"*.html; do
    [ -f "$f" ] && echo "  open $f"
done
