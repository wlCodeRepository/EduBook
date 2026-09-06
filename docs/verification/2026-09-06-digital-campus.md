# Digital Campus — implementation and verification

## Scope

The local `codex/digital-campus` iteration replaces the authenticated layout for all three roles, not only login. Shared tokens and a bounded viewport stage replace the sidebar. Desktop uses a location strip, task surface and bottom account dock. Mobile uses focused booking steps, selected-day teaching schedules, paginated records and list/detail replacement.

- Student: teacher selection, compact CSS 3D classroom, seven-day date navigation, 15-minute starts, 1–8 consecutive lessons, one interval ticket and receipt, course history.
- Teacher: viewer-local weekly distribution, next lesson, request inbox, duration/blocked-time task switch, calendar-prefilled blackout form.
- Administrator: seven-day loaded-booking distribution, roster search/filter, separate create/edit/reset/delete drawers. Self and administrator accounts are excluded from the roster; existing role/username remain immutable.
- Account: avatar menu opens the existing personal-information/password dialog. No extra account navigation destination.
- Course lists: four desktop/two mobile rows per page. People: six desktop/four mobile. Blocked periods: three per page. Internal scrolling remains available for unusually short viewports, long data, zoom and keyboard use; this is not a guarantee of zero scroll at every device size.

The frontend-design review changed the structure to task-oriented views and a restrained classroom motif, rather than adding a second UI library or cosmetic gradients. No database migration, authentication bypass, new mail delivery or third-party token was introduced.

## Verification

- `npm run typecheck`: passed.
- `npm test -- --maxWorkers=1`: 23 test files / 73 tests passed on September 6 after integration and the calendar-to-blocked-form fix.
- `npm run build`: passed, 104 modules. Output is generated locally, not evidence of deployment.
- `git diff --check`: passed; Windows LF/CRLF conversion warnings only.
- Final rerun after preview account wiring: 23 files / 73 tests, typecheck and build passed. A subsequent height-specific CSS adjustment was browser-verified and rebuilt.

Browser fixture: `http://127.0.0.1:13756/tests/visual/campus.html`. It imports production view components, uses explicitly fictional accounts/bookings and does not replace production login. Personal-account form submissions are intercepted in the fixture. Other mutation drawer placeholders only test presentation dispatch, not real writes.

Browser inspected at desktop 1440×900 (also initial 1276×985) and mobile 390×844:

Additional 1366×768 notebook check: reduced nonessential spacing in the reservation stage. Document dimensions were 1366×768; schedule clientHeight and scrollHeight were both 497, so the sampled 24-start time group required no internal scrolling.

| Flow | Observation |
| --- | --- |
| Teacher week | Seven columns on desktop; selected day on mobile; next lesson remains readable after removing a legacy flex collision. |
| Mobile request inbox | Two records and approval actions plus pagination fit the task surface. |
| Student reservation | Teacher → time → review works. Four 30-minute lessons produce one 120-minute ticket with viewer and teacher timezones. Receipt replaces an empty ticket instead of prompting repeat submission. |
| Desktop reservation | Receipt stays in the ticket column so it does not displace the time grid. |
| Admin roster | Six desktop/four mobile entries; mobile selection replaces the list with account details and separate actions. Student detail has no lesson-duration field. |
| Global courses | Status filters, search and pagination render using supplied bookings. |
| Teacher settings | Duration and blackout tasks switch; blackout start/end/note/submit visible on 390×844. |
| Personal information/password | Real AccountCenter and PasswordSettings components opened from avatar menu; each form fits 390×844. No live password/profile mutation performed. |

Document dimensions matched viewport dimensions in the sampled 390×844 request inbox and 1440×900 booking stage. This does not imply every internal region has no scroll. No full device/zoom matrix or live authenticated Supabase write E2E was performed in this UI iteration.

## Release boundary and recovery

## Production release — September 6

User authorized publication. PR https://github.com/wlCodeRepository/EduBook/pull/30 merged as `131a85201907cf3019b71b6860178c463cce00ab`. PR CI `34010752152` passed. Pages workflow https://github.com/wlCodeRepository/EduBook/actions/runs/34020380168 completed successfully; backend deployment was skipped.

Live URL: https://wlcoderepository.github.io/EduBook/ returned HTTP 200 and referenced `index-v2-CeeB4nhs.js` and `index-BDgy6kx-.css`. Both assets returned HTTP 200; the script contains the all-role campus shell, people directory and booking-step implementation. This confirms frontend release, not live authenticated write E2E. The earlier main backup was preserved. The local-only statement below describes the pre-release checkpoint and is superseded by this publication record.

This iteration is local and has not changed deployed main or production data. Keep the existing main backup intact. Publish only through the project's main-branch deployment workflow after reviewing the branch. Recovery for this UI-only iteration is redeploying the previous frontend commit; no SQL rollback is required.
