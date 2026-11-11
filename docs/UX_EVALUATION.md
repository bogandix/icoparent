# UX evaluation: V1 MVP

Evaluated on 11 November 2026 against the local Docker stack, signed in as the seeded parents and child, at 400 px width and on desktop, in English and Romanian. Each flow is scored 1 (blocks the user) to 5 (smooth), before and after this pass.

## Summary

The data model and access rules were solid, but the screens did not tell people what happened. Most forms saved silently and stayed on the page, lists did not refresh after a change, and several database errors appeared as raw keys. This pass fixes feedback, navigation after saving, and the most-used flows. It changes no database rules.

## Flow by flow

| Area | Action | Before | After | What was wrong → what changed |
|---|---|---|---|---|
| Sign in | Google / local sign-in | 3 | 4 | Raw `AuthApiError` text was shown. Now a translated message; details go to the console. |
| Today | See who has the children | 2 | 5 | The banner compared dates in UTC and often did not show. Now uses the family timezone and is the first card. |
| Today | Next handover and check-in | 2 | 4 | All three buttons showed to both parents, with no confirmation. Now each parent sees only their own action (drop-off, or pick-up and confirm) and gets "Check-in saved at HH:MM". |
| Today | Reach common actions | 1 | 5 | No shortcuts. Added quick actions: add expense, add event, new agreement, new memory (one tap). |
| Today | Upcoming events | 2 | 4 | Titles without times. Now date and time, tappable. |
| Calendar | Add event | 3 | 4 | Form had no heading or confirmation. Now a titled section, end-after-start check, "Saved to the calendar". "Add event" on Today jumps straight to it. |
| Calendar | Custody pattern | 1 | 3 | The page existed but nothing linked to it. Now linked from Calendar for parents. Still no preview (see backlog). |
| Agreements | List | 3 | 4 | Titles only. Now kind, status pill, and a count of items waiting for me. Empty history is hidden. |
| Agreements | Create | 2 | 4 | Saved silently and stayed on the form. Kind is now a two-by-two choice with a plain explanation, decisions accept an amount, event changes pick an event instead of typing its ID, and saving returns to the list with "Sent". |
| Agreements | Accept, decline, counter, withdraw | 2 | 4 | The list did not update and there was no confirmation. Now shows status and deadline, requires a note before countering, and returns to the list with "Answer sent". |
| Money | Add expense | 1 | 5 | No date, payer, children or note; "0" or text were accepted; saved silently. All fields added, amount validated (accepts "12,50"), returns to the list with "Expense saved". |
| Money | List and totals | 3 | 4 | Rows showed title and amount only, and acknowledge/void controls sat on every row. Rows show date, category and payer; totals are a card; controls moved to the expense page. |
| Money | Expense detail and receipt | 2 | 4 | No feedback while uploading. Shows payer, note, upload progress and "Receipt added". The camera opens directly on phones. |
| Feed | Post | 2 | 4 | No feedback, empty posts allowed, photo field unlabelled. Now labelled, disabled when empty, "Posted" confirmation. |
| Feed | Voice note | 2 | 3 | No sign that it was recording, and a blocked microphone failed silently. Now shows "Recording…" and explains a blocked microphone. |
| Feed | React | 2 | 3 | No feedback. The chosen reaction now stays highlighted. Counts are not shown yet. |
| Inbox | Read notifications | 2 | 4 | The unread count needed a refresh, and "Open" and "Mark read" were separate. Header badge updates live; tapping an item marks it read and opens it. |
| More | Children | 2 | 5 | Needed a refresh, allowed duplicates, could not remove. Live update, duplicate check, remove with confirmation (the child is marked as left, not deleted). |
| More | Invite | 3 | 4 | The link was hidden behind "Copy". The link is now visible, uses the phone's share sheet, and explains that it is single-use and expires in 7 days. |
| More | Language and theme | 3 | 4 | Crowded the header as bare "RO" and "Dark". Moved to Preferences with clear labels. |
| Shell | Navigation | 3 | 4 | Six text-only tabs at 11 px. Tabs now have icons. The header shows the family name and the inbox. |
| Errors | Any failure | 1 | 4 | 15 database error codes had no translation and showed as raw keys. All have English and Romanian text. |

## Also added

- Build label at the bottom of Today: build date and commit (`CF_PAGES_COMMIT_SHA` on Cloudflare Pages, `git` locally).

## Backlog (not done in this pass)

1. **Custody pattern** needs a preview of the next 8 weeks and to show the current pattern (F-112).
2. **Event change** can only change the title; time and location changes need their own fields (F-124).
3. **Edit an expense** has no screen yet; only void is available (F-141, `edit_expense`).
4. **Reactions** should show counts and allow undo.
5. **Bundle size** is 350 KB gzipped against a 300 KB budget. The calendar library should load only on the Calendar route (F-199).
6. **Family switcher** was removed from the header because each person has one family in V1. Bring it back with multi-family support (F-503).
7. **Push notifications** are still logged by the Worker, not sent (F-182).
