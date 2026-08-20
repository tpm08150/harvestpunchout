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
| 1 | Call Time | James Wooten | Telegraphs for 0.7s. One thing at a time. The tutorial. |
| 2 | Double Booked | Pete McKiernan | Throws in twos. Dodge the first and the second is already coming. |
| 3 | The Long Haul | Casey Faircloth | Body shots you cannot block. First fighter who punishes a lazy guard. |
| 4 | The Warehouse | Weston Smith | Slow, and it does not matter — the uppercut is 22 and unblockable. |
| 5 | The Firewall | Tyler Nissen | Guards 45% of the time and feints. Go to the body. |
| 6 | The Freight Train | Tyler Morton | Threes, and he gets *faster* below 40% health, not slower. |
| 7 | The Headliner | Josh Koan | Everything above, quicker, plus an uppercut. |

Each one is a `look` (the caricature) and a `fight` (the behaviour), kept apart
on purpose: changing somebody's hair should never change how hard they hit.

**They are drawn, not photographed.** A photo of a colleague being punched is a
different thing entirely, and the drawn version is both kinder and about 60KB
lighter. Everything that makes a person recognisable is a flag on `look` — the
undercut, the glasses, the beard length, the earrings — so a new fighter is one
array entry and no new drawing code.

## The card

The roster screen. Seven names in a list told you nothing about who you were
about to fight, so it now shows each one's face, what he does, and how you have
done against him.

- **Left**: his portrait, framed in his corner colour. It cycles from idle into
  his **wind-up** every few seconds — standing still tells you nothing about
  the one thing you actually have to read. Under it, nickname, name, title, and
  whether you have beaten him plus the board's best time against him.
- **Right**: a tale of the tape — SPEED, POWER, CHIN, GUARD out of five — then
  what he does in words, then his line.
- **Bottom**: all seven, numbered, with a green dot on the ones you have beaten.
  `◀ ▶` walks the card, or tap a face.

⚠️ **Everything on the right is derived from the fighter's own `fight` block**,
never typed in beside it. SPEED is read off his *shortest* tell, POWER off his
hardest move, CHIN off his health, GUARD off his guard chance; the "what he
does" lines come from which moves he actually has. A second, hand-written
description of a fighter is a second thing to keep in step, and it would start
lying the first time a tell was retuned. Add a move and the card describes it
with no other edit.

**You can look at all seven, including the ones you have not unlocked** — the
challenge here is execution, not information, and hiding the CEO's tape makes
the screen worse. A locked fighter shows everything and simply cannot be
selected: the bar says which fighter to beat first, and Enter, tap and the
punch buttons all refuse.

## The faces

Every face is drawn from one routine driven entirely by a `look` object. Seven
near-identical draw functions would drift the moment one of them got a fix, so
there is one, and everything that makes a person recognisable is a parameter:
face width, jaw, chin, cheek, double chin, hair style and volume, receding
temples, beard type/length/flare, glasses shape/size/frame, ear studs or hoops,
a nostril ring. Casey is not "the one with glasses" — he is a 1.10-wide thin
metal rectangle and a 19-long beard.

`look` (the likeness) and `fight` (the behaviour) stay separate on purpose:
changing somebody's hair must never change how hard they hit.

**Expressions** run off `mood`, and the wind-up is deliberately the loudest:
brows drop and pull in, the jaw opens into a shout, the nose wrinkles. Getting
hit screws the eyes shut, stun draws spirals, and a fighter on the canvas gets
flat crosses — alert eyes on a man lying down read as a man having a lie-down.
They blink on their own clocks so seven of them on one screen never blink in
unison, and they breathe faster the more damage they have taken.

**Damage shows on the face**, which is how Punch-Out told you a fight was going
and it is far more readable than watching a bar: swelling under the eyes first,
then colour in the cheeks, then a cut over the brow that runs, plus sweat. It is
cumulative across the fight rather than a read of the current health bar —
health resets on every knockdown, and a man who has been down twice should not
look fresh again.

### The hairline

⚠️ **The hair is drawn as a cap over the whole skull, so something has to put a
forehead back.** Without it the hairline lands at about y=-2.6 — *below* the
eyebrows at -6 — and every one of the seven comes out with no forehead at all.
`forehead()` paints skin back from the hairline down, narrower than the head so
hair still shows at the temples, and it is called after each style's mass but
before its fringe, so a fringe still falls over the forehead instead of being
erased by it. `crop.hairline` raises it for a receding one or lowers it for a
lot of hair worn low.

⚠️ And it is a **balance**, not a single number: cutting the forehead in without
also raising the hair mass leaves a thin band on top and everybody looks like
they are going bald. The cap heights and the forehead height were tuned
together against the contact sheet.

### ?faces

`?faces` renders a contact sheet of all seven against every expression plus a
damaged pass. `?faces&s=1.7` renders it at the size the ring actually draws a
head, which is the only scale that matters — detail that reads only at 3x is
decoration. Tuning a face by playing seven fights to reach it is how faces end
up untuned. Not linked from anywhere.

Three things found by rendering that sheet rather than by reading the code: the
beards started at the cheekbone and flared wider than the skull, turning all
four bearded fighters into one brown bib; the glasses were sized and tinted such
that they read as opaque ski goggles; and the receding-temple notches were drawn
mid-hair rather than at the hairline, so they floated as two skin-coloured dots.

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
