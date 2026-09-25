#!/bin/bash
# Quick API test using dev tokens
BASE=http://localhost:8000

echo "=== Study Query ==="
curl -s -X POST "$BASE/study/query" \
  -H "Authorization: Bearer dev-student-token" \
  -H "Content-Type: application/json" \
  -d '{"query":"What are rational numbers?","subject":"mathematics","chapter":null,"history":[]}' | python3 -m json.tool

echo ""
echo "=== Quiz Generate ==="
curl -s -X POST "$BASE/quiz/generate" \
  -H "Authorization: Bearer dev-teacher-token" \
  -H "Content-Type: application/json" \
  -d '{"class_num":8,"subject":"mathematics","chapter":null}' | python3 -m json.tool
