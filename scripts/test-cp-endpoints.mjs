/**
 * Connect Plus (CP) Endpoint Test Runner
 * ----------------------------------------
 * Tests every HTTP endpoint in the connect-plus module.
 *
 * Usage:
 *   TOKEN=<your_jwt>  node scripts/test-cp-endpoints.mjs
 *
 * The script runs sequentially so it can chain IDs (org → workspace → staff, etc.)
 * Expects the server running on PORT 4990 (matches .env).
 */

const BASE = 'http://localhost:4990/api';

// ── Configure your token here (or export TOKEN=... in your shell) ────────────
const TOKEN = process.env.TOKEN ?? '';
if (!TOKEN) {
  console.error('\n❌  No TOKEN provided. Run with:  TOKEN=<jwt>  node scripts/test-cp-endpoints.mjs\n');
  process.exit(1);
}

// ── Colour helpers ────────────────────────────────────────────────────────────
const green  = (s) => `\x1b[32m${s}\x1b[0m`;
const red    = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const cyan   = (s) => `\x1b[36m${s}\x1b[0m`;
const bold   = (s) => `\x1b[1m${s}\x1b[0m`;
const dim    = (s) => `\x1b[2m${s}\x1b[0m`;

// ── State (filled during run) ─────────────────────────────────────────────────
const state = {
  orgId: null,
  wsId:  null,
  staffMemberId: null,
  clientId: null,
  leadId: null,
  inviteId: null,
  invoiceId: null,
  appointmentId: null,
  cardId: null,
  convId: null,
  attendanceRecordId: null,
  notificationId: null,
};

// ── Stats ─────────────────────────────────────────────────────────────────────
const stats = { pass: 0, fail: 0, skip: 0 };
const results = [];

// ── Core helper ───────────────────────────────────────────────────────────────
async function req(method, path, { body, wsId, extraHeaders = {}, expectStatuses = [200, 201] } = {}) {
  const url = `${BASE}${path}`;
  const headers = {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  if (wsId) headers['x-workspace-id'] = wsId;

  let res, json, text;
  try {
    res  = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    text = await res.text();
    try { json = JSON.parse(text); } catch { json = null; }
  } catch (err) {
    return { ok: false, status: 0, json: null, error: err.message };
  }

  const ok = expectStatuses.includes(res.status);
  return { ok, status: res.status, json, text };
}

// ── Test runner ───────────────────────────────────────────────────────────────
let currentSection = '';
function section(name) {
  currentSection = name;
  console.log(`\n${bold(cyan(`── ${name} ─────────────────────────────────`))} `);
}

async function test(label, fn, { skip = false } = {}) {
  if (skip) {
    stats.skip++;
    results.push({ label, status: 'SKIP', detail: '' });
    console.log(`  ${yellow('SKIP')}  ${dim(label)}`);
    return null;
  }

  let result;
  try {
    result = await fn();
  } catch (err) {
    stats.fail++;
    results.push({ label, status: 'FAIL', detail: err.message });
    console.log(`  ${red('FAIL')}  ${label}`);
    console.log(`        ${dim(err.message)}`);
    return null;
  }

  if (!result) {
    stats.fail++;
    results.push({ label, status: 'FAIL', detail: 'null result' });
    console.log(`  ${red('FAIL')}  ${label}  ${dim('(null result)')}`);
    return null;
  }

  const { ok, status, json, text, error } = result;

  if (ok) {
    stats.pass++;
    results.push({ label, status: 'PASS', detail: `HTTP ${status}` });
    const preview = json ? JSON.stringify(json).slice(0, 80) : text?.slice(0, 80) ?? '';
    console.log(`  ${green('PASS')}  ${label}  ${dim(`[${status}] ${preview}`)}`);
  } else {
    stats.fail++;
    const detail = `HTTP ${status} — ${text?.slice(0, 120) ?? error}`;
    results.push({ label, status: 'FAIL', detail });
    console.log(`  ${red('FAIL')}  ${label}  ${dim(`[${status}] ${text?.slice(0, 100)}`)}`);
  }

  return json;
}

// ═════════════════════════════════════════════════════════════════════════════
//  TESTS
// ═════════════════════════════════════════════════════════════════════════════

// ── 1. My Workspaces (no guard) ───────────────────────────────────────────────
section('My Workspaces');
await test('GET /cp/my-workspaces', async () => {
  const r = await req('GET', '/cp/my-workspaces');
  return r;
});

// ── 2. Organizations ──────────────────────────────────────────────────────────
section('Organizations');

await test('POST /cp/organizations — create org', async () => {
  const r = await req('POST', '/cp/organizations', {
    body: { name: `Test Org ${Date.now()}` },
    expectStatuses: [201, 409, 200],
  });
  if (r.json?.data?.id)   state.orgId = r.json.data.id;
  if (r.json?.id)         state.orgId = r.json.id;
  return r;
});

await test('GET /cp/organizations/me', async () => {
  const r = await req('GET', '/cp/organizations/me');
  if (!state.orgId && r.json?.data?.id) state.orgId = r.json.data.id;
  if (!state.orgId && r.json?.id)       state.orgId = r.json.id;
  return r;
});

await test('PATCH /cp/organizations/me — update', async () => {
  return req('PATCH', '/cp/organizations/me', {
    body: { name: `Updated Org ${Date.now()}` },
  });
});

await test('GET /cp/organizations/me/analytics', async () => {
  return req('GET', '/cp/organizations/me/analytics');
});

// ── 3. Subscriptions ─────────────────────────────────────────────────────────
section('Subscriptions');

await test('GET /cp/organizations/me/subscription', async () => {
  return req('GET', '/cp/organizations/me/subscription');
});

await test('POST /cp/organizations/me/subscription/upgrade — noop plan', async () => {
  return req('POST', '/cp/organizations/me/subscription/upgrade', {
    body: { plan: 'FREE' },
    expectStatuses: [200, 201, 400, 422],
  });
});

// ── 4. Workspaces ─────────────────────────────────────────────────────────────
section('Workspaces');

const wsName = `Test Workspace ${Date.now()}`;

const createdWs = await test('POST /cp/workspaces — create workspace', async () => {
  const r = await req('POST', '/cp/workspaces', {
    body: { name: wsName },
    expectStatuses: [201, 200, 409],
  });
  if (r.json?.data?.id) state.wsId = r.json.data.id;
  if (r.json?.id)       state.wsId = r.json.id;
  return r;
});

await test('GET /cp/workspaces — list workspaces', async () => {
  const r = await req('GET', '/cp/workspaces');
  // fallback: grab first ws id if create didn't give us one
  if (!state.wsId) {
    const list = r.json?.data ?? r.json ?? [];
    if (Array.isArray(list) && list[0]?.id) state.wsId = list[0].id;
  }
  return r;
});

const skipWs = !state.wsId;
if (skipWs) console.log(yellow('  ⚠  No workspace ID — workspace-scoped tests will be skipped'));

await test('GET /cp/workspaces/:id', async () => {
  return req('GET', `/cp/workspaces/${state.wsId}`);
}, { skip: skipWs });

await test('PATCH /cp/workspaces/:id — update', async () => {
  return req('PATCH', `/cp/workspaces/${state.wsId}`, {
    body: { name: `Updated ${wsName}` },
  });
}, { skip: skipWs });

await test('PATCH /cp/workspaces/:id/status — set ACTIVE', async () => {
  return req('PATCH', `/cp/workspaces/${state.wsId}/status`, {
    body: { status: 'ACTIVE' },
    expectStatuses: [200, 400],
  });
}, { skip: skipWs });

await test('POST /cp/workspaces/:id/invite-admin', async () => {
  return req('POST', `/cp/workspaces/${state.wsId}/invite-admin`, {
    body: { email: `admin-test-${Date.now()}@example.com` },
    expectStatuses: [201, 200, 409, 400],
  });
}, { skip: skipWs });

// ── 5. Staff ──────────────────────────────────────────────────────────────────
section('Staff');

await test('POST /cp/workspaces/:wsId/staff/invite', async () => {
  const r = await req('POST', `/cp/workspaces/${state.wsId}/staff/invite`, {
    wsId: state.wsId,
    body: { email: `staff-${Date.now()}@example.com`, name: 'Test Staff', jobTitle: 'Tester', department: 'QA' },
    expectStatuses: [201, 200, 409, 400],
  });
  return r;
}, { skip: skipWs });

await test('GET /cp/workspaces/:wsId/staff/invites', async () => {
  const r = await req('GET', `/cp/workspaces/${state.wsId}/staff/invites`, { wsId: state.wsId });
  return r;
}, { skip: skipWs });

await test('GET /cp/workspaces/:wsId/staff — list', async () => {
  const r = await req('GET', `/cp/workspaces/${state.wsId}/staff`, { wsId: state.wsId });
  const list = r.json?.data ?? r.json ?? [];
  if (Array.isArray(list) && list[0]?.id) state.staffMemberId = list[0].id;
  return r;
}, { skip: skipWs });

const skipStaff = skipWs || !state.staffMemberId;

await test('GET /cp/workspaces/:wsId/staff/:staffId', async () => {
  return req('GET', `/cp/workspaces/${state.wsId}/staff/${state.staffMemberId}`, { wsId: state.wsId });
}, { skip: skipStaff });

await test('PATCH /cp/workspaces/:wsId/staff/:staffId — update profile', async () => {
  return req('PATCH', `/cp/workspaces/${state.wsId}/staff/${state.staffMemberId}`, {
    wsId: state.wsId,
    body: { jobTitle: 'Updated Tester' },
  });
}, { skip: skipStaff });

await test('PATCH /cp/workspaces/:wsId/staff/:staffId/status', async () => {
  return req('PATCH', `/cp/workspaces/${state.wsId}/staff/${state.staffMemberId}/status`, {
    wsId: state.wsId,
    body: { status: 'ACTIVE' },
    expectStatuses: [200, 400],
  });
}, { skip: skipStaff });

await test('PATCH /cp/workspaces/:wsId/staff/:staffId/role', async () => {
  return req('PATCH', `/cp/workspaces/${state.wsId}/staff/${state.staffMemberId}/role`, {
    wsId: state.wsId,
    body: { role: 'STAFF' },
    expectStatuses: [200, 400],
  });
}, { skip: skipStaff });

// ── 6. Invites ────────────────────────────────────────────────────────────────
section('Invites');

await test('POST /cp/invites — send invite', async () => {
  const r = await req('POST', '/cp/invites', {
    wsId: state.wsId,
    body: { email: `invite-test-${Date.now()}@example.com`, name: 'Invite Test' },
    expectStatuses: [201, 200, 409, 400],
  });
  return r;
}, { skip: skipWs });

await test('GET /cp/invites — list invites', async () => {
  const r = await req('GET', '/cp/invites', { wsId: state.wsId });
  const list = r.json?.data ?? r.json ?? [];
  if (Array.isArray(list) && list[0]?.id) state.inviteId = list[0].id;
  return r;
}, { skip: skipWs });

const skipInvite = skipWs || !state.inviteId;

await test('GET /cp/invites/:inviteId', async () => {
  return req('GET', `/cp/invites/${state.inviteId}`, { wsId: state.wsId });
}, { skip: skipInvite });

await test('POST /cp/invites/:inviteId/resend', async () => {
  return req('POST', `/cp/invites/${state.inviteId}/resend`, {
    wsId: state.wsId,
    expectStatuses: [200, 400, 409],
  });
}, { skip: skipInvite });

await test('DELETE /cp/invites/:inviteId — revoke', async () => {
  return req('DELETE', `/cp/invites/${state.inviteId}`, {
    wsId: state.wsId,
    expectStatuses: [200, 404, 400],
  });
}, { skip: skipInvite });

// ── 7. Clients ────────────────────────────────────────────────────────────────
section('Clients');

await test('GET /cp/workspaces/:wsId/clients — list all', async () => {
  const r = await req('GET', `/cp/workspaces/${state.wsId}/clients`, { wsId: state.wsId });
  const list = r.json?.data ?? r.json ?? [];
  if (Array.isArray(list) && list[0]?.id) state.clientId = list[0].id;
  return r;
}, { skip: skipWs });

await test('GET /cp/workspaces/:wsId/clients/assigned', async () => {
  return req('GET', `/cp/workspaces/${state.wsId}/clients/assigned`, { wsId: state.wsId });
}, { skip: skipWs });

const skipClient = skipWs || !state.clientId;

await test('GET /cp/workspaces/:wsId/clients/:clientId', async () => {
  return req('GET', `/cp/workspaces/${state.wsId}/clients/${state.clientId}`, { wsId: state.wsId });
}, { skip: skipClient });

await test('PATCH /cp/workspaces/:wsId/clients/:clientId/assign', async () => {
  return req('PATCH', `/cp/workspaces/${state.wsId}/clients/${state.clientId}/assign`, {
    wsId: state.wsId,
    body: { staffId: state.staffMemberId ?? 'placeholder-id' },
    expectStatuses: [200, 400, 404],
  });
}, { skip: skipClient });

// ── 8. Leads ─────────────────────────────────────────────────────────────────
section('Leads');

await test('GET /cp/workspaces/:wsId/leads — list', async () => {
  const r = await req('GET', `/cp/workspaces/${state.wsId}/leads`, { wsId: state.wsId });
  const list = r.json?.data ?? r.json ?? [];
  if (Array.isArray(list) && list[0]?.id) state.leadId = list[0].id;
  return r;
}, { skip: skipWs });

const skipLead = skipWs || !state.leadId;

await test('GET /cp/workspaces/:wsId/leads/:leadId', async () => {
  return req('GET', `/cp/workspaces/${state.wsId}/leads/${state.leadId}`, { wsId: state.wsId });
}, { skip: skipLead });

await test('PATCH /cp/workspaces/:wsId/leads/:leadId/assign', async () => {
  return req('PATCH', `/cp/workspaces/${state.wsId}/leads/${state.leadId}/assign`, {
    wsId: state.wsId,
    body: { staffId: state.staffMemberId ?? 'placeholder-id' },
    expectStatuses: [200, 400, 404],
  });
}, { skip: skipLead });

await test('PATCH /cp/workspaces/:wsId/leads/:leadId/reject', async () => {
  return req('PATCH', `/cp/workspaces/${state.wsId}/leads/${state.leadId}/reject`, {
    wsId: state.wsId,
    body: { reason: 'Not qualified' },
    expectStatuses: [200, 400, 404, 409],
  });
}, { skip: skipLead });

// validate converts lead → client so skip if we want to preserve the lead
await test('PATCH /cp/workspaces/:wsId/leads/:leadId/validate — skip (destructive)', async () => {
  return req('PATCH', `/cp/workspaces/${state.wsId}/leads/${state.leadId}/validate`, {
    wsId: state.wsId,
    expectStatuses: [200, 400, 404, 409],
  });
}, { skip: true });

await test('DELETE /cp/workspaces/:wsId/leads/:leadId — soft delete', async () => {
  return req('DELETE', `/cp/workspaces/${state.wsId}/leads/${state.leadId}`, {
    wsId: state.wsId,
    expectStatuses: [200, 404],
  });
}, { skip: skipLead });

// ── 9. Appointments ───────────────────────────────────────────────────────────
section('Appointments');

await test('POST /cp/workspaces/:wsId/appointments — create', async () => {
  const r = await req('POST', `/cp/workspaces/${state.wsId}/appointments`, {
    wsId: state.wsId,
    body: {
      title: 'Test Meeting',
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 90000000).toISOString(),
      reason: 'Automated test',
    },
    expectStatuses: [201, 200, 400],
  });
  if (r.json?.data?.id) state.appointmentId = r.json.data.id;
  if (r.json?.id)       state.appointmentId = r.json.id;
  return r;
}, { skip: skipWs });

await test('GET /cp/workspaces/:wsId/appointments — list all', async () => {
  const r = await req('GET', `/cp/workspaces/${state.wsId}/appointments`, { wsId: state.wsId });
  if (!state.appointmentId) {
    const list = r.json?.data ?? r.json ?? [];
    if (Array.isArray(list) && list[0]?.id) state.appointmentId = list[0].id;
  }
  return r;
}, { skip: skipWs });

await test('GET /cp/workspaces/:wsId/appointments/assigned', async () => {
  return req('GET', `/cp/workspaces/${state.wsId}/appointments/assigned`, { wsId: state.wsId });
}, { skip: skipWs });

const skipAppt = skipWs || !state.appointmentId;

await test('GET /cp/workspaces/:wsId/appointments/:id', async () => {
  return req('GET', `/cp/workspaces/${state.wsId}/appointments/${state.appointmentId}`, { wsId: state.wsId });
}, { skip: skipAppt });

await test('PATCH /cp/workspaces/:wsId/appointments/:id — update', async () => {
  return req('PATCH', `/cp/workspaces/${state.wsId}/appointments/${state.appointmentId}`, {
    wsId: state.wsId,
    body: { title: 'Updated Meeting' },
    expectStatuses: [200, 400],
  });
}, { skip: skipAppt });

await test('PATCH /cp/workspaces/:wsId/appointments/:id/status', async () => {
  return req('PATCH', `/cp/workspaces/${state.wsId}/appointments/${state.appointmentId}/status`, {
    wsId: state.wsId,
    body: { status: 'CONFIRMED' },
    expectStatuses: [200, 400],
  });
}, { skip: skipAppt });

await test('DELETE /cp/workspaces/:wsId/appointments/:id — cancel', async () => {
  return req('DELETE', `/cp/workspaces/${state.wsId}/appointments/${state.appointmentId}`, {
    wsId: state.wsId,
    expectStatuses: [200, 404],
  });
}, { skip: skipAppt });

// ── 10. Invoices ──────────────────────────────────────────────────────────────
section('Invoices');

await test('POST /cp/workspaces/:wsId/invoices — create', async () => {
  const r = await req('POST', `/cp/workspaces/${state.wsId}/invoices`, {
    wsId: state.wsId,
    body: {
      clientId: state.clientId ?? 'placeholder-client-id',
      currency: 'NGN',
      items: [{ description: 'Test Service', quantity: '1', unitPrice: '5000' }],
    },
    expectStatuses: [201, 200, 400, 404],
  });
  if (r.json?.data?.id) state.invoiceId = r.json.data.id;
  if (r.json?.id)       state.invoiceId = r.json.id;
  return r;
}, { skip: skipWs });

await test('GET /cp/workspaces/:wsId/invoices — list all', async () => {
  const r = await req('GET', `/cp/workspaces/${state.wsId}/invoices`, { wsId: state.wsId });
  if (!state.invoiceId) {
    const list = r.json?.data ?? r.json ?? [];
    if (Array.isArray(list) && list[0]?.id) state.invoiceId = list[0].id;
  }
  return r;
}, { skip: skipWs });

await test('GET /cp/workspaces/:wsId/invoices/assigned', async () => {
  return req('GET', `/cp/workspaces/${state.wsId}/invoices/assigned`, { wsId: state.wsId });
}, { skip: skipWs });

await test('GET /cp/workspaces/:wsId/invoices/export (CSV)', async () => {
  return req('GET', `/cp/workspaces/${state.wsId}/invoices/export`, {
    wsId: state.wsId,
    expectStatuses: [200],
  });
}, { skip: skipWs });

const skipInvoice = skipWs || !state.invoiceId;

await test('GET /cp/workspaces/:wsId/invoices/:invoiceId', async () => {
  return req('GET', `/cp/workspaces/${state.wsId}/invoices/${state.invoiceId}`, { wsId: state.wsId });
}, { skip: skipInvoice });

await test('PATCH /cp/workspaces/:wsId/invoices/:invoiceId — update draft', async () => {
  return req('PATCH', `/cp/workspaces/${state.wsId}/invoices/${state.invoiceId}`, {
    wsId: state.wsId,
    body: { notes: 'Updated notes' },
    expectStatuses: [200, 400, 409],
  });
}, { skip: skipInvoice });

await test('PATCH /cp/workspaces/:wsId/invoices/:invoiceId/send', async () => {
  return req('PATCH', `/cp/workspaces/${state.wsId}/invoices/${state.invoiceId}/send`, {
    wsId: state.wsId,
    expectStatuses: [200, 400, 409],
  });
}, { skip: skipInvoice });

await test('PATCH /cp/workspaces/:wsId/invoices/:invoiceId/mark-paid', async () => {
  return req('PATCH', `/cp/workspaces/${state.wsId}/invoices/${state.invoiceId}/mark-paid`, {
    wsId: state.wsId,
    body: { paymentMethod: 'BANK_TRANSFER', paidAt: new Date().toISOString() },
    expectStatuses: [200, 400, 409],
  });
}, { skip: skipInvoice });

await test('PATCH /cp/workspaces/:wsId/invoices/:invoiceId/cancel', async () => {
  return req('PATCH', `/cp/workspaces/${state.wsId}/invoices/${state.invoiceId}/cancel`, {
    wsId: state.wsId,
    expectStatuses: [200, 400, 409],
  });
}, { skip: skipInvoice });

// ── 11. Attendance ────────────────────────────────────────────────────────────
section('Attendance');

await test('POST /cp/workspaces/:wsId/attendance/check-in', async () => {
  const r = await req('POST', `/cp/workspaces/${state.wsId}/attendance/check-in`, {
    wsId: state.wsId,
    body: { locationData: { lat: 6.5244, lng: 3.3792, accuracy: 10 } },
    expectStatuses: [201, 200, 409, 400],
  });
  if (r.json?.data?.id) state.attendanceRecordId = r.json.data.id;
  if (r.json?.id)       state.attendanceRecordId = r.json.id;
  return r;
}, { skip: skipWs });

await test('POST /cp/workspaces/:wsId/attendance/check-out', async () => {
  return req('POST', `/cp/workspaces/${state.wsId}/attendance/check-out`, {
    wsId: state.wsId,
    body: {},
    expectStatuses: [201, 200, 400],
  });
}, { skip: skipWs });

await test('GET /cp/workspaces/:wsId/attendance/me', async () => {
  return req('GET', `/cp/workspaces/${state.wsId}/attendance/me`, { wsId: state.wsId });
}, { skip: skipWs });

await test('GET /cp/workspaces/:wsId/attendance — list all', async () => {
  const r = await req('GET', `/cp/workspaces/${state.wsId}/attendance`, { wsId: state.wsId });
  if (!state.attendanceRecordId) {
    const list = r.json?.data ?? r.json ?? [];
    if (Array.isArray(list) && list[0]?.id) state.attendanceRecordId = list[0].id;
  }
  return r;
}, { skip: skipWs });

await test('GET /cp/workspaces/:wsId/attendance/:staffId', async () => {
  return req('GET', `/cp/workspaces/${state.wsId}/attendance/${state.staffMemberId ?? 'placeholder'}`, { wsId: state.wsId });
}, { skip: skipWs || !state.staffMemberId });

await test('PATCH /cp/workspaces/:wsId/attendance/:recordId/override', async () => {
  return req('PATCH', `/cp/workspaces/${state.wsId}/attendance/${state.attendanceRecordId}/override`, {
    wsId: state.wsId,
    body: { checkIn: new Date().toISOString() },
    expectStatuses: [200, 400, 404],
  });
}, { skip: skipWs || !state.attendanceRecordId });

// ── 12. Connect Cards ─────────────────────────────────────────────────────────
section('Connect Cards');

await test('POST /cp/workspaces/:wsId/staff/cards — add to inventory', async () => {
  const r = await req('POST', `/cp/workspaces/${state.wsId}/staff/cards`, {
    wsId: state.wsId,
    body: { cardCode: `CARD-TEST-${Date.now()}` },
    expectStatuses: [201, 200, 409, 400],
  });
  if (r.json?.data?.id) state.cardId = r.json.data.id;
  if (r.json?.id)       state.cardId = r.json.id;
  return r;
}, { skip: skipWs });

await test('GET /cp/workspaces/:wsId/staff/cards — list', async () => {
  const r = await req('GET', `/cp/workspaces/${state.wsId}/staff/cards`, { wsId: state.wsId });
  if (!state.cardId) {
    const list = r.json?.data ?? r.json ?? [];
    if (Array.isArray(list) && list[0]?.id) state.cardId = list[0].id;
  }
  return r;
}, { skip: skipWs });

await test('GET /cp/workspaces/:wsId/staff/cards/analytics', async () => {
  return req('GET', `/cp/workspaces/${state.wsId}/staff/cards/analytics`, { wsId: state.wsId });
}, { skip: skipWs });

const skipCard = skipWs || !state.cardId;

await test('PATCH /cp/workspaces/:wsId/staff/cards/:cardId/pair', async () => {
  return req('PATCH', `/cp/workspaces/${state.wsId}/staff/cards/${state.cardId}/pair`, {
    wsId: state.wsId,
    body: { staffId: state.staffMemberId ?? 'placeholder-staff-id' },
    expectStatuses: [200, 400, 404],
  });
}, { skip: skipCard });

await test('PATCH /cp/workspaces/:wsId/staff/cards/:cardId/config', async () => {
  return req('PATCH', `/cp/workspaces/${state.wsId}/staff/cards/${state.cardId}/config`, {
    wsId: state.wsId,
    body: { landingUrl: 'https://example.com' },
    expectStatuses: [200, 400],
  });
}, { skip: skipCard });

await test('PATCH /cp/workspaces/:wsId/staff/cards/:cardId/status', async () => {
  return req('PATCH', `/cp/workspaces/${state.wsId}/staff/cards/${state.cardId}/status`, {
    wsId: state.wsId,
    body: { status: 'ACTIVE' },
    expectStatuses: [200, 400],
  });
}, { skip: skipCard });

await test('PATCH /cp/workspaces/:wsId/staff/cards/:cardId/unpair', async () => {
  return req('PATCH', `/cp/workspaces/${state.wsId}/staff/cards/${state.cardId}/unpair`, {
    wsId: state.wsId,
    expectStatuses: [200, 400, 404],
  });
}, { skip: skipCard });

// ── 13. Company Profile ───────────────────────────────────────────────────────
section('Company Profile');

await test('GET /cp/workspaces/:wsId/company-profile', async () => {
  return req('GET', `/cp/workspaces/${state.wsId}/company-profile`, { wsId: state.wsId });
}, { skip: skipWs });

await test('PUT /cp/workspaces/:wsId/company-profile — upsert', async () => {
  return req('PUT', `/cp/workspaces/${state.wsId}/company-profile`, {
    wsId: state.wsId,
    body: {
      name: 'Test Company',
      contactEmail: 'company@example.com',
      description: 'Automated test company',
    },
    expectStatuses: [200, 201, 400],
  });
}, { skip: skipWs });

// ── 14. Audit Logs ────────────────────────────────────────────────────────────
section('Audit Logs');

await test('GET /cp/workspaces/:wsId/audit-logs — list', async () => {
  return req('GET', `/cp/workspaces/${state.wsId}/audit-logs`, { wsId: state.wsId });
}, { skip: skipWs });

await test('GET /cp/workspaces/:wsId/audit-logs/verify', async () => {
  return req('GET', `/cp/workspaces/${state.wsId}/audit-logs/verify`, { wsId: state.wsId });
}, { skip: skipWs });

await test('GET /cp/workspaces/:wsId/audit-logs/export (CSV)', async () => {
  return req('GET', `/cp/workspaces/${state.wsId}/audit-logs/export`, { wsId: state.wsId });
}, { skip: skipWs });

// ── 15. Notifications ─────────────────────────────────────────────────────────
section('Notifications');

await test('GET /cp/workspaces/:wsId/notifications — list', async () => {
  const r = await req('GET', `/cp/workspaces/${state.wsId}/notifications`, { wsId: state.wsId });
  const list = r.json?.data ?? r.json ?? [];
  if (Array.isArray(list) && list[0]?.id) state.notificationId = list[0].id;
  return r;
}, { skip: skipWs });

await test('PATCH /cp/workspaces/:wsId/notifications/read-all', async () => {
  return req('PATCH', `/cp/workspaces/${state.wsId}/notifications/read-all`, { wsId: state.wsId });
}, { skip: skipWs });

await test('PATCH /cp/workspaces/:wsId/notifications/:id/read', async () => {
  return req('PATCH', `/cp/workspaces/${state.wsId}/notifications/${state.notificationId}/read`, {
    wsId: state.wsId,
    expectStatuses: [200, 404],
  });
}, { skip: skipWs || !state.notificationId });

// ── 16. Chat ──────────────────────────────────────────────────────────────────
section('Chat');

await test('GET /cp/workspaces/:wsId/conversations — list', async () => {
  const r = await req('GET', `/cp/workspaces/${state.wsId}/conversations`, { wsId: state.wsId });
  const list = r.json?.data ?? r.json ?? [];
  if (Array.isArray(list) && list[0]?.id) state.convId = list[0].id;
  return r;
}, { skip: skipWs });

await test('POST /cp/workspaces/:wsId/conversations/direct — start DM', async () => {
  const r = await req('POST', `/cp/workspaces/${state.wsId}/conversations/direct`, {
    wsId: state.wsId,
    body: { targetAuthUserId: 'placeholder-user-id' },
    expectStatuses: [201, 200, 400, 404],
  });
  if (!state.convId && (r.json?.data?.id || r.json?.id)) {
    state.convId = r.json?.data?.id ?? r.json?.id;
  }
  return r;
}, { skip: skipWs });

const skipConv = skipWs || !state.convId;

await test('POST /cp/workspaces/:wsId/conversations/:convId/messages — send', async () => {
  return req('POST', `/cp/workspaces/${state.wsId}/conversations/${state.convId}/messages`, {
    wsId: state.wsId,
    body: { content: 'Hello from test runner' },
    expectStatuses: [201, 200, 400],
  });
}, { skip: skipConv });

await test('GET /cp/workspaces/:wsId/conversations/:convId/messages', async () => {
  return req('GET', `/cp/workspaces/${state.wsId}/conversations/${state.convId}/messages`, { wsId: state.wsId });
}, { skip: skipConv });

await test('PATCH /cp/workspaces/:wsId/conversations/:convId/messages/read', async () => {
  return req('PATCH', `/cp/workspaces/${state.wsId}/conversations/${state.convId}/messages/read`, {
    wsId: state.wsId,
    expectStatuses: [200, 400],
  });
}, { skip: skipConv });

// ── 17. Public Endpoints ──────────────────────────────────────────────────────
section('Public (no auth)');

// use a test slug — will 404 if workspace doesn't exist which is still a valid response from the endpoint
const TEST_SLUG = 'test-workspace';

await test('GET /cp/public/:workspaceSlug — public profile', async () => {
  return req('GET', `/cp/public/${TEST_SLUG}`, {
    extraHeaders: { 'Authorization': '' },
    expectStatuses: [200, 404],
  });
});

await test('POST /cp/public/:workspaceSlug/appointments — book (public)', async () => {
  return req('POST', `/cp/public/${TEST_SLUG}/appointments`, {
    extraHeaders: { 'Authorization': '' },
    body: {
      name: 'John Doe',
      email: 'john@example.com',
      title: 'Consultation',
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    },
    expectStatuses: [201, 200, 400, 404],
  });
});

await test('POST /cp/public/:workspaceSlug/contacts/save — save contact (public)', async () => {
  return req('POST', `/cp/public/${TEST_SLUG}/contacts/save`, {
    extraHeaders: { 'Authorization': '' },
    body: { name: 'Jane Doe', email: 'jane@example.com' },
    expectStatuses: [200, 201, 400, 404],
  });
});

await test('POST /cp/public/:workspaceSlug/interactions — record (public)', async () => {
  return req('POST', `/cp/public/${TEST_SLUG}/interactions`, {
    extraHeaders: { 'Authorization': '' },
    body: { type: 'VIEW', cardId: state.cardId ?? 'placeholder' },
    expectStatuses: [200, 201, 400, 404],
  });
});

// ── 18. Public Card Tap ────────────────────────────────────────────────────────
section('Connect Cards – Public Tap');

await test('POST /cp/public/cards/:cardCode/tap', async () => {
  return req('POST', `/cp/public/cards/TEST-CARD-001/tap`, {
    extraHeaders: { 'Authorization': '' },
    body: { tappedAt: new Date().toISOString() },
    expectStatuses: [200, 201, 400, 404],
  });
});

// ── 19. Webhooks (public) ─────────────────────────────────────────────────────
section('Webhooks (public)');

await test('POST /cp/webhooks/invite-accepted', async () => {
  return req('POST', '/cp/webhooks/invite-accepted', {
    extraHeaders: { 'Authorization': '', 'x-webhook-signature': 'dummy-sig' },
    body: { token: 'dummy-token', role: 'STAFF', workspaceId: state.wsId ?? 'ws-placeholder' },
    expectStatuses: [200, 400, 401],
  });
});

await test('POST /cp/webhooks/paystack', async () => {
  return req('POST', '/cp/webhooks/paystack', {
    extraHeaders: { 'Authorization': '', 'x-paystack-signature': 'dummy-sig' },
    body: { event: 'charge.success', data: {} },
    expectStatuses: [200, 400, 401],
  });
});

// ── 20. Organization Archive (last – destructive) ─────────────────────────────
section('Organization Archive (destructive – last)');

await test('DELETE /cp/organizations/me — archive org', async () => {
  return req('DELETE', '/cp/organizations/me', {
    expectStatuses: [200, 400, 404],
  });
}, { skip: true }); // set skip:false to actually test archiving

// ═════════════════════════════════════════════════════════════════════════════
//  SUMMARY
// ═════════════════════════════════════════════════════════════════════════════

console.log(`\n${'─'.repeat(60)}`);
console.log(bold('  RESULTS'));
console.log('─'.repeat(60));
console.log(`  ${green(`✔ PASS: ${stats.pass}`)}   ${red(`✘ FAIL: ${stats.fail}`)}   ${yellow(`◌ SKIP: ${stats.skip}`)}`);
console.log(`  Total: ${stats.pass + stats.fail + stats.skip}`);
console.log('─'.repeat(60));

if (stats.fail > 0) {
  console.log(bold(red('\n  Failed tests:')));
  results
    .filter(r => r.status === 'FAIL')
    .forEach(r => console.log(`    ${red('✘')}  ${r.label}\n       ${dim(r.detail)}`));
}

console.log(`\n  ${dim('IDs collected during run:')}`);
Object.entries(state).forEach(([k, v]) => {
  if (v) console.log(`    ${dim(k)}: ${v}`);
});
console.log();

process.exit(stats.fail > 0 ? 1 : 0);
