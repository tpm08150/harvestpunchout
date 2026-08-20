// Harvest Punch-Out — shared best times
//
// GET  /api/scores  -> every kept time as JSON
// POST /api/scores  -> body {name, time, who} ; returns the updated board
//
// Storage is Netlify Blobs, built into Netlify — no database, no API keys.
// The whole board lives in one JSON blob.
//
// Modelled on the Out Run lap-time board, and it keeps that board's two
// decisions, for the same reasons:
//
//   - **Lower is better.** How long you took to put them down. Sorting is
//     ascending and a "best" is a minimum.
//   - **Ten kept per opponent, not ten overall.** James Wooten telegraphs
//     everything and Josh Koan does not, so one combined board would be a
//     Wooten board and nobody would ever fight anyone else. A board each is
//     what makes the CEO worth attempting.
//
// `circuit` is an eighth board: the total time to put all seven away in one
// unbroken run, which is the only number that says you actually beat the game.
//
// Everything is validated here. The time is a number in a POST body, so anyone
// can curl a fake one; the bounds below stop a bad request corrupting the
// board or injecting anything, but they are not anti-cheat.

import { getStore } from '@netlify/blobs';

// Bumped to v2 to drop the probe row left behind while proving the store
// actually persists. Bumping this is also how you wipe the board.
const KEY = 'scores-v2';
const PER_BOARD = 10;

// One entry per fighter, in circuit order, plus the full run. Keep this list in
// step with ROSTER in index.html — an id that isn't here is filed under the
// first fighter rather than being dropped, so a typo shows up as a wrong board
// rather than as a score that silently vanished.
const FIGHTERS = ['wooten', 'mckiernan', 'faircloth', 'smith', 'nissen', 'morton', 'koan'];
const BOARDS = [...FIGHTERS, 'circuit'];

// A single fight can't legitimately be won inside six seconds, and anything
// past ten minutes is somebody who wandered off mid-round. The circuit is the
// sum of seven of them, so it gets its own far wider window.
const BOUNDS = { fight: [6, 600], circuit: [60, 7200] };
const boundsFor = (who) => (who === 'circuit' ? BOUNDS.circuit : BOUNDS.fight);

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/** Validate, then keep the fastest PER_BOARD for each board. */
const clean = (arr) => {
  const rows = (Array.isArray(arr) ? arr : [])
    .filter((e) => e && typeof e.time === 'number' && isFinite(e.time))
    .map((e) => {
      const who = BOARDS.includes(e.who) ? e.who : FIGHTERS[0];
      const [lo, hi] = boundsFor(who);
      return {
        // Three initials, cabinet style — the same as Soundcheck and Out Run.
        // Enforced here as well as in the page, because the page is not the
        // only thing that can POST.
        name: String(e.name ?? 'AAA').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'AAA',
        time: Math.round(Math.max(lo, Math.min(hi, e.time)) * 1000) / 1000,
        who,
        when: Number(e.when) || Date.now(),
      };
    })
    .sort((a, b) => a.time - b.time || a.when - b.when);

  const kept = [];
  for (const who of BOARDS) kept.push(...rows.filter((r) => r.who === who).slice(0, PER_BOARD));
  return kept;
};

export default async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: JSON_HEADERS });
  }

  let store;
  try {
    // ⚠️ `consistency: 'strong'`. The default is eventual, served from cache —
    // a score written and read a second later can come back missing, which is
    // exactly what happened on this board's first deploy and looked for all the
    // world like Blobs being broken. A leaderboard is read straight after it is
    // written, every single time, so eventual consistency is the wrong trade.
    store = getStore({ name: 'punchout', consistency: 'strong' });
  } catch (err) {
    // ⚠️ Answering [] here is what made a broken board indistinguishable from an
    // empty one: the page saw 200 with a valid array, called itself LIVE, and
    // threw every score away. A store we cannot reach is a 503, and the page
    // falls back to its browser-only board and says so.
    return new Response(JSON.stringify({ error: 'no blob store', detail: String(err && err.message || err) }),
      { status: 503, headers: JSON_HEADERS });
  }

  if (request.method === 'GET') {
    try {
      const raw = await store.get(KEY, { type: 'json' });
      return new Response(JSON.stringify(clean(raw)), { status: 200, headers: JSON_HEADERS });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'read failed', detail: String(err && err.message || err) }),
        { status: 503, headers: JSON_HEADERS });
    }
  }

  if (request.method === 'POST') {
    let entry;
    try {
      entry = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ error: 'bad json' }), { status: 400, headers: JSON_HEADERS });
    }

    const who = BOARDS.includes(entry?.who) ? entry.who : null;
    if (!who) {
      return new Response(JSON.stringify({ error: 'bad opponent' }), { status: 400, headers: JSON_HEADERS });
    }

    const time = Number(entry?.time);
    const [lo, hi] = boundsFor(who);
    if (!isFinite(time) || time < lo || time > hi) {
      return new Response(JSON.stringify({ error: 'bad time' }), { status: 400, headers: JSON_HEADERS });
    }

    const row = clean([{ name: entry?.name, time, who, when: Date.now() }])[0];

    // Read-modify-write, same caveat as the other two boards: two people
    // finishing in the same second could have one write clobber the other.
    // Fine at this scale, and Blobs exposes no compare-and-set to do better.
    let current = [];
    try {
      current = (await store.get(KEY, { type: 'json' })) || [];
    } catch (err) {
      current = [];
    }

    const next = clean([...(Array.isArray(current) ? current : []), row]);

    try {
      await store.setJSON(KEY, next);
    } catch (err) {
      return new Response(JSON.stringify({ error: 'write failed', detail: String(err && err.message || err) }),
        { status: 500, headers: JSON_HEADERS });
    }

    // Hand back the board we just computed rather than re-reading it. It is
    // identical to what was stored, it costs no second round trip, and it is
    // what the player needs to see their placing immediately.
    return new Response(JSON.stringify(next), { status: 200, headers: JSON_HEADERS });
  }

  return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405, headers: JSON_HEADERS });
};

export const config = { path: '/api/scores' };
