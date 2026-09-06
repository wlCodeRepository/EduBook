# Hourly fifty-minute lessons

User approved fixed 50-minute lessons, hourly starts and 10-minute inter-lesson breaks, then requested implementation and deployment.

1. Add versioned migration: preserve old booking snapshots with break_minutes=0; new reservations use 50 teaching minutes and 10 inter-lesson minutes, total span n*60-10 (1..8). Teacher timezone is the canonical hour boundary; viewer display remains converted. Preserve service-role RPC permissions and exclusion constraint. Reserve the entire interval including breaks.
2. Normalize teacher default duration to 50 for new/existing profiles using a DB trigger. Remove duration editing in teacher settings/admin UI; fixed display remains. Do not modify historical appointments.
3. Update candidate filtering, interval generation, bilingual explanations and snapshot presentation. Validate every lesson start across DST, including non-hour DST transitions. Tests cover 1/2/8 lessons, hour boundary, conflicts, midnight, legacy duration and fixed settings.
4. Typecheck, tests, build. Apply migration transactionally with rollback SQL smoke tests; deploy frontend through PR/CI/main Pages-only. Booking Edge Function delegates validation to RPC and needs no redeploy. Redeploy only admin-operations to include lesson and break snapshots in its global-data response.
5. Recovery: do not revert booked times. Preserve gap snapshot constraint; restore prior create_booking function if needed and remove fixed-profile trigger, then redeploy prior frontend. Newly created bookings retain correct snapshots. No destructive data rollback.
