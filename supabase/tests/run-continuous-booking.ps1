$ErrorActionPreference = 'Stop'
# Disposable isolated PostgreSQL only. No host ports or persistent volumes.
$containerName = 'edubook-regression-' + [Guid]::NewGuid().ToString('N').Substring(0, 12)
$testRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$created = $false
function Check-Docker {
  if ($LASTEXITCODE -ne 0) { throw "Docker regression command failed ($LASTEXITCODE)" }
}
try {
  docker run -d --name $containerName --network none --label edubook.disposable-test=true -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine | Out-Null
  Check-Docker
  $created = $true
  $ready = $false
  for ($i = 0; $i -lt 30; $i++) {
    docker exec $containerName pg_isready -U postgres 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw 'Disposable PostgreSQL did not become ready' }
  docker cp $testRoot "${containerName}:/suite"
  Check-Docker
  $bootstrap = 'create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as ''select null::uuid'';'
  docker exec $containerName psql -X -U postgres -v ON_ERROR_STOP=1 -c $bootstrap
  Check-Docker
  $target = '202609050001_continuous_booking.sql'
  foreach ($migration in (Get-ChildItem (Join-Path $testRoot 'migrations') -Filter '*.sql' | Sort-Object Name)) {
    if ($migration.Name -ge $target) { continue }
    docker exec $containerName psql -X -U postgres -v ON_ERROR_STOP=1 --single-transaction -f "/suite/migrations/$($migration.Name)"
    Check-Docker
  }
  docker exec $containerName psql -X -U postgres -v ON_ERROR_STOP=1 -f /suite/tests/continuous_booking_backfill.sql
  Check-Docker
  docker exec $containerName psql -X -U postgres -v ON_ERROR_STOP=1 --single-transaction -f "/suite/migrations/$target"
  Check-Docker
  foreach ($test in @('continuous_booking.sql', 'continuous_booking_concurrency.sql')) {
    docker exec $containerName psql -X -U postgres -v ON_ERROR_STOP=1 -f "/suite/tests/$test"
    Check-Docker
  }
  'PASS: historical backfill, continuous intervals, permissions and two-session concurrency'
} finally {
  if ($created) {
    # Remove only the container created successfully by this invocation.
    docker rm -f -v $containerName | Out-Null
    Check-Docker
  }
}
