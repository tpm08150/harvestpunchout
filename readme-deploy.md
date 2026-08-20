# Harvest Punch-Out — deploy

A Punch-Out-shaped fighter. Seven opponents in org-chart order — three
production managers, the warehouse, then CTO, COO, CEO. You cannot out-mash
anybody; you learn the wind-up and punish it.

Repo: **`tpm08150/harvestpunchout`** (https://github.com/tpm08150/harvestpunchout).
Set it up the same way as Soundcheck and Out Run: Netlify building from that repo. **Git, not drag-and-drop** — the function imports
`@netlify/blobs`, and a drag-and-drop deploy runs no `npm install`, so the
import crashes and the board silently falls back to browser-only. That has
already happened to Soundcheck once.

```
index.html          <- the whole game, one file, nothing to fetch
netlify.toml        <- publish dir, functions dir, API cache header
package.json        <- declares @netlify/blobs for the build
netlify/
  functions/
    scores.mjs      <- the board, routed to /api/scores
```

The `netlify/functions/` nesting is the one thing that must not be flattened;
that path is how Netlify finds the function.

The Netlify site is **harvest-punchout**, so the game is at
`https://harvest-punchout.netlify.app`, and that is what the Hub's Arcade tab
points at. Repo `harvestpunchout`, site `harvest-punchout` — unlike Out Run,
whose repo and site names differ (`harvestoutrun` / `harvest-outrun`). If it gets a different name,
change the `url` in the `GAMES` array in `src/components/Game.jsx`.

## After deploying

Open `/api/scores`. `[]` means it works and nobody has fought yet. A 404 means
the function didn't deploy — check the folder nesting. A **503** means the
function is running but cannot reach Netlify Blobs, and the page will correctly
fall back to a browser-only board rather than pretending.

⚠️ **The store is opened with `consistency: 'strong'`.** Netlify Blobs defaults
to eventual consistency, served from cache — a score written and read back a
second later can come back missing. That happened on the first deploy of this
board and looked exactly like Blobs being broken, when the write had in fact
landed. A leaderboard is read immediately after it is written every single time,
so the default is the wrong trade here. Don't remove it.

In-game the board header tells you which backend you got:

| Header | Meaning |
| --- | --- |
| `BEST TIMES — LIVE` | The real shared board. What you want. |
| `BEST TIMES — THIS BROWSER ONLY` | No function reachable; times are local to that browser. |

## The seven

Order is the ladder, and it is `ROSTER` in `index.html` — reordering that array
reorders the card, and nothing else knows the sequence.

| # | Nickname | Who | What they do |
| --- | --- | --- | --- |
| 1 | First Call | James Wooten | Telegraphs for 0.7s. One thing at a time. The tutorial. |
| 2 | Double Booked | Pete McKiernan | Throws in twos. Dodge the first and the second is already coming. |
| 3 | The Long Haul | Casey Faircloth | Body shots you cannot block. First fighter who punishes a lazy guard. |
| 4 | The Warehouse | Weston Smith | Slow, and it does not matter — the uppercut is 22 and unblockable. |
| 5 | The Firewall | Tyler Nissen | Guards 45% of the time and feints. Go to the body. |
| 6 | Overtime | Tyler Morton | Threes, and he gets *faster* below 40% health, not slower. |
| 7 | The Headliner | Josh Koan | Everything above, quicker, plus an uppercut. |

Each one is a `look` (the caricature) and a `fight` (the behaviour), kept apart
on purpose: changing somebody's hair should never change how hard they hit.

**They are drawn, not photographed.** A photo of a colleague being punched is a
different thing entirely, and the drawn version is both kinder and about 60KB
lighter. Everything that makes a person recognisable is a flag on `look` — the
undercut, the glasses, the beard length, the earrings — so a new fighter is one
array entry and no new drawing code.

## How a fight works

Three rounds of 60 seconds. **There is no decision** — if the bell goes at the
end of round three you have lost. You need the knockout.

- **Yellow flash** — blockable. **Red flash** — you have to move; blocking does
  nothing. Punch-Out made you learn that from the animation alone; this gets
  three minutes of somebody's attention on a break, so it says so as well.
- **Counter** — punch during their wind-up (the last 45% of it) for triple
  damage and a ★. That is the *only* way to earn a star; they cannot be ground
  out by throwing more punches.
- **Dodge, then hit.** A dodged punch leaves them wide open for 0.7s at double
  damage. That is where the damage actually comes from, not from trading.
- **Guard.** When their guard is up the face is unavailable and throwing at it
  costs three hearts. The body still gets through at half.
- **Hearts** are stamina, and they are what stops mashing. Throwing into a
  guard costs three times what landing one does, so the punishment for not
  waiting is being out of punches exactly when the opening arrives. At zero you
  cannot punch at all for 2.4 seconds.
- **Three knockdowns is a TKO**, both ways. When you go down, mash Body/Face to
  get up — the bar drains, so it is a real ask rather than a wait.

## Pausing

It pauses itself when you switch away from the tab, and **any input brings it
back** — a click, a tap, a pad button or any key.

⚠️ That last part was a real bug, and it is worth not reintroducing. `G.paused`
could originally only be cleared by the `P` key, while `visibilitychange` set it
every time the tab was hidden mid-fight. So the sequence was: play a round,
switch tab, come back, click the game — and nothing happened, because the canvas
handler only advances menus (`G.screen !== 'fight'`) and the pad buttons feed an
update loop that pausing had gated off. It reads as a dead page rather than a
paused one, and it only bites on desktop because that is where the Hub embeds
the game in an iframe rather than opening a tab.

## The boards

Ten per opponent, plus a **circuit** board for the total time to put all seven
away in one run. One combined board would only ever be a Wooten board, the same
reasoning as Out Run's per-rig times.

A circuit run only starts if you start at fight 1. Picking up mid-card is fine
and still sets per-opponent times, but it cannot produce a circuit time — and
the card screen says which of the two you are on. Time spent *losing* still
counts toward a circuit run, which is the honest way to price a retry.

Progress (who you have beaten) is kept in `localStorage`, so the ladder survives
a reload. The circuit run itself is not — quitting halfway voids that run.

## Sound

Generated from oscillators, nothing to fetch. **M** toggles the walk-out loop;
effects stay on either way. Notes are queued onto the audio clock ~120ms early
by a lookahead scheduler, the same shape both other games use, because
`setInterval` is nowhere near accurate enough to place a note on a beat.

⚠️ The audio clock does not advance while suspended, so the scheduler is rebased
on resume. Without that it dumps every sixteenth it missed at once.

⚠️ **The crowd is a looping buffer with no natural end**, so it runs from the
first click to the end of the page's life unless something stops it. Ducking
gains is not enough — the whole `AudioContext` is **suspended** when the page is
hidden, on `pagehide`, and on pause, and the crowd is silenced on every screen
that is not a fight. This game sits in an iframe inside the Hub, so a tab left
open in the background humming crowd noise is a real thing that happened.
Verified: hidden → `suspended`, visible → `running`, `pagehide` → `suspended`.

## Names

Three initials, cabinet style, the same as the other two. Enforced in the page
and again in the function, since the page is not the only thing that can POST.

⚠️ It is a real focused `<input>`, never keys typed onto the canvas — on a phone
nothing else brings the keyboard up, so a top-ten score would have no way to be
signed. And every keystroke aimed at an input is ignored by the game, as a
*target* check rather than a game-state one, so the next shortcut added cannot
start eating characters out of names. Both other games shipped with that bug.

## Cheating

The time is a number in a POST body, so anyone with devtools can send whatever
they like. The function clamps times (6–600s a fight, 60–7200s a circuit) and
strips HTML from names, so a bad request cannot corrupt the board or inject
anything — but it cannot tell a real 41 seconds from an invented one. For
coworkers that is fine. To wipe the board, bump `KEY` in `scores.mjs` — it is
on `scores-v3` now, having been bumped twice already to drop probe rows left
over from proving the store persists.

## Testing note

The in-app browser pane reports `document.hidden` as true permanently, which
throttles `requestAnimationFrame` to nothing and also trips the game's own
pause-when-hidden handler — so the game looks frozen there while being
perfectly fine. To drive it, swap `window.requestAnimationFrame` for a
`setTimeout` shim and send a `KeyP` to unpause. In a real browser tab none of
this applies.
