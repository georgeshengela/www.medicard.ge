/**
 * Admin #/trainers „ანალიზი“ (MEDICOACH) — who applies as a trainer, who gets verified, who finds clients,
 * holds sessions and sends meal plans; how many people are linked to a trainer and what they share.
 *
 * Everything comes from the MEDICOACH tables themselves (TrainerProfile, TrainerLink, TrainerSession,
 * TrainerMealPlan, ProgressPhoto, WorkoutLog, Gym, the lazily created CoachReport / CoachBlock) plus the
 * admin audit log (TRAINER_APPROVE …) for „was ever verified“ and the time to an answer. The app sends no
 * coach screen views, so „did something“ means a saved row. Some tables have no `userId`: trainer rows are
 * `trainerId`, client rows `clientId`. Team accounts (exact `@medicard.ge` — the App Review demo trainer lives
 * there) are left out unless `includeTeam`; a link, session, plan or report is left out when either side is team.
 *
 * Privacy: trainer cards carry the trainer's public name, status, specialties, gyms and counts, and the
 * account's name and contact (as on the user page). Never client names on a trainer card, never what a
 * client shares (weight, food, workouts, photos), meal-plan targets or meals, session notes, exercises,
 * goal values, report text or certificate files — the loader reduces those to counts / booleans / dates.
 */
import { prisma } from './prisma.js';
import { addDaysYmd, rateSafe, tbilisiMidnight, tbilisiYmd } from './adminAnalyticsRange.js';
import {
  activityTracker, bump, daySeries, flagState, iso, loadPeople, loadTeamUserIds, median, missingTable, ms, personSummary,
  usageWindow, USAGE_PERIODS, zeroes,
} from './adminUsageKit.js';
import { listFeatureFlags } from './featureFlags.js';
import { SCOPES, SESSION_KINDS, SPECIALTIES } from './trainer.js';
import { REPORT_REASONS } from './coachSafety.js';

/** The page lists at most this many trainers (newest activity first); every count still covers all of them. */
export const COACH_USAGE_LIST_MAX = 400;
/** Trainers are promised an answer in 1–2 working days; older pending applications are flagged. */
export const COACH_REVIEW_SLA_HOURS = 48;

const STATUSES = ['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'];
const LINK_STATUSES = ['REQUESTED', 'ACTIVE', 'ENDED', 'DECLINED'];
const SIDES = ['CLIENT', 'TRAINER', 'ADMIN'];
const KIND_KEYS = Object.keys(SESSION_KINDS);
const SPECIALTY_KEYS = Object.keys(SPECIALTIES);
const REASON_KEYS = Object.keys(REPORT_REASONS);
const REVIEW_ACTIONS = ['TRAINER_APPROVE', 'TRAINER_REJECT', 'TRAINER_SUSPEND', 'TRAINER_RESTORE'];
const PROFILE_PARTS = ['photo', 'bio', 'specialties', 'experience', 'certificate', 'gym'];
const MINUTE = 60_000;
const HOUR = 3_600_000;

const asArray = (v) => (Array.isArray(v) ? v : []);

/** „Aspria · ვაკე“ — the gym directory is public; brand in Georgian when there is one. */
function gymLabel(g) {
  const brand = g.brandKa || g.brand;
  const place = g.district || g.nameKa || (g.name && g.name !== g.brand ? g.name : '') || '';
  return { label: place ? `${brand} · ${place}` : brand, city: g.city || '' };
}

function experienceBucket(years) {
  if (years == null || !Number.isFinite(Number(years))) return 'unknown';
  const y = Number(years);
  if (y <= 2) return 'upTo2';
  if (y <= 5) return 'upTo5';
  if (y <= 10) return 'upTo10';
  return 'more';
}

/**
 * Pure: raw rows (all accounts) → the page payload. `raw` comes from loadCoachUsageRaw (or a test fixture).
 * @param {object} raw
 * @param {{ days?: number, includeTeam?: boolean, now?: Date }} opts
 */
export function buildCoachUsage(raw, { days = 30, includeTeam = false, now = new Date() } = {}) {
  const win = usageWindow(days, now);
  const nowMs = now.getTime();
  const teamIds = new Set(raw.teamUserIds || []);
  const isTeam = (id) => Boolean(id) && teamIds.has(id);
  const keepUser = (id) => includeTeam || !isTeam(id);
  const keepPair = (a, b) => includeTeam || (!isTeam(a) && !isTeam(b));

  const allProfiles = raw.profiles || [];
  const allLinks = raw.links || [];
  const allSessions = raw.sessions || [];
  const profiles = allProfiles.filter((p) => keepUser(p.userId));
  const links = allLinks.filter((l) => keepPair(l.trainerId, l.clientId));
  const sessions = allSessions.filter((s) => keepPair(s.trainerId, s.clientId));
  const plans = (raw.plans || []).filter((p) => keepPair(p.trainerId, p.clientId));
  const photos = (raw.photos || []).filter((r) => keepUser(r.userId));
  const workouts = (raw.workouts || []).filter((r) => keepUser(r.userId));
  const qr = (raw.qr || []).filter((r) => keepUser(r.userId));
  const reviews = (raw.reviews || []).filter((a) => keepUser(a.targetId));
  const reports = Array.isArray(raw.reports) ? raw.reports.filter((r) => keepPair(r.reporterId, r.subjectId)) : null;
  const blocks = Array.isArray(raw.blocks) ? raw.blocks.filter((b) => keepPair(b.clientId, b.trainerId)) : null;
  const people = new Map((raw.people || []).map((u) => [u.id, u]));
  const avatars = new Set(raw.avatarUserIds || []);
  const gyms = new Map((raw.gyms || []).map((g) => [g.id, g]));

  // ── admin decisions (audit log): first answer, ever verified ──────────────
  const firstAnswerAt = new Map();
  const approvedAt = new Map();
  const rejectedEver = new Set();
  for (const a of [...reviews].sort((x, y) => ms(x.createdAt) - ms(y.createdAt))) {
    if ((a.action === 'TRAINER_APPROVE' || a.action === 'TRAINER_REJECT') && !firstAnswerAt.has(a.targetId)) firstAnswerAt.set(a.targetId, a.createdAt);
    if ((a.action === 'TRAINER_APPROVE' || a.action === 'TRAINER_RESTORE') && !approvedAt.has(a.targetId)) approvedAt.set(a.targetId, a.createdAt);
    if (a.action === 'TRAINER_REJECT') rejectedEver.add(a.targetId);
  }
  const everVerified = (p) => p.status === 'VERIFIED' || approvedAt.has(p.userId);
  const verifiedAt = (p) => approvedAt.get(p.userId) || (p.status === 'VERIFIED' ? p.reviewedAt : null);

  // ── per trainer ───────────────────────────────────────────────────────────
  const trainerAct = activityTracker(); // things a trainer did as a trainer
  const clientAct = activityTracker(); // things a person did as a client (link, accept, confirm, cancel, end, report)
  const anyAct = activityTracker(); // either side — „active people“
  const T = new Map(profiles.map((p) => [p.userId, {
    clientsEver: new Set(), active: 0, requests: 0, invites: 0, ended: 0, goals: 0,
    sessions: 0, noShow: 0, cancelled: 0, upcoming: 0, unmarked: 0, openSlots: 0, expiredSlots: 0,
    plans: 0, plansActive: 0, reports: 0, reportsOpen: 0, blocks: 0,
    lastAt: Math.max(ms(p.createdAt), ms(p.submittedAt)),
  }]));
  const touch = (trainerId, at) => {
    const row = T.get(trainerId);
    if (row && at) row.lastAt = Math.max(row.lastAt, ms(at));
  };
  const tAct = (trainerId, at) => {
    if (!trainerId || !at) return;
    trainerAct.act(trainerId, at);
    anyAct.act(trainerId, at);
    touch(trainerId, at);
  };
  const cAct = (clientId, trainerId, at) => {
    if (!clientId || !at) return;
    clientAct.act(clientId, at);
    anyAct.act(clientId, at);
    touch(trainerId, at);
  };

  for (const p of profiles) {
    tAct(p.userId, p.createdAt);
    // A re-submitted application (after a rejection) is a return; certificates are added one by one.
    if (ms(p.submittedAt) - ms(p.createdAt) > MINUTE) tAct(p.userId, p.submittedAt);
    for (const at of p.certificateDates || []) tAct(p.userId, at);
  }

  const linkStatus = zeroes(LINK_STATUSES);
  const endedBy = zeroes(SIDES);
  const via = { client: 0, trainer: 0 };
  const scopes = zeroes(SCOPES);
  let sharesNothing = 0;
  let goalsPending = 0;
  const clientsEver = new Set();
  const activeClients = new Set();
  for (const l of links) {
    const t = T.get(l.trainerId);
    const accepted = Boolean(l.acceptedAt);
    bump(linkStatus, LINK_STATUSES.includes(l.status) ? l.status : 'ENDED');
    if (accepted) {
      clientsEver.add(l.clientId);
      bump(via, l.initiator === 'TRAINER' ? 'trainer' : 'client');
    }
    if (l.status === 'ACTIVE') {
      activeClients.add(l.clientId);
      const on = SCOPES.filter((k) => l.scopes?.[k] === true);
      for (const k of on) bump(scopes, k);
      if (!on.length) sharesNothing += 1;
      if (l.goalProposedAt) goalsPending += 1;
    }
    if (l.endedAt && (l.status === 'ENDED' || l.status === 'DECLINED')) bump(endedBy, SIDES.includes(l.endedBy) ? l.endedBy : 'ADMIN');
    if (t) {
      if (accepted) t.clientsEver.add(l.clientId);
      if (l.status === 'ACTIVE') t.active += 1;
      if (l.status === 'REQUESTED') {
        if (l.initiator === 'TRAINER') t.invites += 1;
        else t.requests += 1;
      }
      if (l.status === 'ENDED') t.ended += 1;
      if (l.goalProposedAt) t.goals += 1;
    }
    if (l.initiator === 'TRAINER') {
      tAct(l.trainerId, l.createdAt); // QR invitation
      if (accepted) cAct(l.clientId, l.trainerId, l.acceptedAt);
    } else {
      cAct(l.clientId, l.trainerId, l.createdAt); // code or search
      // A code links at once (acceptedAt ≈ createdAt); a later acceptedAt is the trainer answering a request.
      if (accepted && ms(l.acceptedAt) - ms(l.createdAt) > MINUTE) tAct(l.trainerId, l.acceptedAt);
    }
    if (l.endedAt) {
      if (l.endedBy === 'TRAINER') tAct(l.trainerId, l.endedAt);
      else if (l.endedBy === 'CLIENT') cAct(l.clientId, l.trainerId, l.endedAt);
    }
    if (l.goalProposedAt) tAct(l.trainerId, l.goalProposedAt);
  }

  const sessionStatus = { upcoming: 0, unmarked: 0, DONE: 0, NO_SHOW: 0, CANCELLED: 0 };
  const cancelledBy = zeroes(SIDES);
  const kinds = zeroes(KIND_KEYS);
  const slots = { future: 0, expired: 0, booked: 0 };
  let lateCancel = 0;
  let repeated = 0;
  let confirmed = 0;
  let confirmable = 0;
  let withExercises = 0;
  const ratings = [];
  const durations = [];
  const booked = []; // sessions with a client (everything but open slots)
  for (const s of sessions) {
    const t = T.get(s.trainerId);
    const start = ms(s.startsAt);
    const end = start + (Number(s.durationMin) || 60) * MINUTE;
    tAct(s.trainerId, s.createdAt);
    if (s.status === 'OPEN') {
      if (start > nowMs) {
        slots.future += 1;
        if (t) t.openSlots += 1;
      } else {
        slots.expired += 1;
        if (t) t.expiredSlots += 1;
      }
      continue;
    }
    booked.push(s);
    bump(kinds, KIND_KEYS.includes(s.kind) ? s.kind : 'STRENGTH');
    durations.push(Number(s.durationMin) || 60);
    if (s.series === 'slot') slots.booked += 1;
    else if (s.series === 'repeat') repeated += 1;
    if (s.status === 'DONE' || s.status === 'NO_SHOW') {
      bump(sessionStatus, s.status);
      if (t) {
        if (s.status === 'DONE') t.sessions += 1;
        else t.noShow += 1;
      }
      // Marking done / no-show is the trainer's; a client rating later moves updatedAt, so then it is not used.
      if (s.clientRating == null) tAct(s.trainerId, s.updatedAt);
      if (s.status === 'DONE' && s.exerciseCount > 0) withExercises += 1;
      if (s.clientRating != null && Number.isFinite(Number(s.clientRating))) ratings.push(Number(s.clientRating));
    } else if (s.status === 'CANCELLED') {
      sessionStatus.CANCELLED += 1;
      if (t) t.cancelled += 1;
      bump(cancelledBy, SIDES.includes(s.cancelledBy) ? s.cancelledBy : 'TRAINER');
      if (s.lateCancel) lateCancel += 1;
      if (s.cancelledBy === 'TRAINER') tAct(s.trainerId, s.updatedAt);
      else if (s.cancelledBy === 'CLIENT') cAct(s.clientId, s.trainerId, s.updatedAt);
    } else if (end < nowMs) {
      sessionStatus.unmarked += 1; // its time passed and the trainer never marked it
      if (t) t.unmarked += 1;
    } else {
      sessionStatus.upcoming += 1;
      if (t) t.upcoming += 1;
    }
    if (s.status !== 'CANCELLED') {
      confirmable += 1;
      if (s.clientConfirmedAt) confirmed += 1;
    }
    if (s.clientConfirmedAt) cAct(s.clientId, s.trainerId, s.clientConfirmedAt);
  }

  for (const p of plans) {
    const t = T.get(p.trainerId);
    if (t) {
      t.plans += 1;
      if (p.active) t.plansActive += 1;
    }
    tAct(p.trainerId, p.createdAt);
  }

  // Progress photos work without a trainer too: they count as MEDICOACH use, not as „client“ activity.
  for (const p of photos) anyAct.act(p.userId, p.createdAt);

  const reportStatus = { open: 0, resolved: 0 };
  const reportRoles = { CLIENT: 0, TRAINER: 0 };
  const reasons = zeroes(REASON_KEYS);
  let reportsWithBlock = 0;
  for (const r of reports || []) {
    bump(reportStatus, r.status === 'open' ? 'open' : 'resolved');
    bump(reportRoles, r.reporterRole === 'TRAINER' ? 'TRAINER' : 'CLIENT');
    bump(reasons, REASON_KEYS.includes(r.reason) ? r.reason : 'other');
    if (r.blocked) reportsWithBlock += 1;
    const t = T.get(r.subjectId);
    if (t) {
      t.reports += 1;
      if (r.status === 'open') t.reportsOpen += 1;
    }
    if (r.reporterRole === 'TRAINER') tAct(r.reporterId, r.createdAt);
    else cAct(r.reporterId, r.subjectId, r.createdAt);
  }
  for (const b of blocks || []) {
    const t = T.get(b.trainerId);
    if (t) t.blocks += 1;
  }

  // ── ladder (trainers) ─────────────────────────────────────────────────────
  const applied = profiles.length;
  const statusCounts = zeroes(STATUSES);
  for (const p of profiles) bump(statusCounts, STATUSES.includes(p.status) ? p.status : 'PENDING');
  const tc = (fn) => profiles.filter((p) => fn(p, T.get(p.userId))).length;
  const ladder = [
    { key: 'applied', count: applied },
    { key: 'verified', count: tc((p) => everVerified(p)) },
    { key: 'client', count: tc((_, t) => t.clientsEver.size > 0) },
    { key: 'session', count: tc((_, t) => t.sessions > 0) },
    { key: 'deep', count: tc((_, t) => t.sessions >= 3 || t.plans > 0) },
    { key: 'returned', count: tc((p) => trainerAct.days(p.userId) >= 2) },
  ].map((step) => ({ ...step, rate: rateSafe(step.count, applied) }));

  // ── review queue ──────────────────────────────────────────────────────────
  const pendingRows = profiles.filter((p) => p.status === 'PENDING');
  const waitHours = (p) => Math.max(0, (nowMs - ms(p.submittedAt || p.createdAt)) / HOUR);
  const oldestPending = pendingRows.reduce((max, p) => Math.max(max, waitHours(p)), 0);
  const answerHours = profiles
    .map((p) => {
      const at = firstAnswerAt.get(p.userId) || (p.status !== 'PENDING' ? p.reviewedAt : null);
      return at ? Math.max(0, (ms(at) - ms(p.createdAt)) / HOUR) : null;
    })
    .filter((h) => h != null);
  const specialties = zeroes(SPECIALTY_KEYS);
  const experience = { unknown: 0, upTo2: 0, upTo5: 0, upTo10: 0, more: 0 };
  const profileParts = { ...zeroes(PROFILE_PARTS), instagram: 0 };
  let certTrainers = 0;
  let certTotal = 0;
  const shaped = new Map();
  for (const p of profiles) {
    const keys = asArray(p.specialties).filter((k) => SPECIALTY_KEYS.includes(k));
    for (const k of keys) bump(specialties, k);
    bump(experience, experienceBucket(p.experienceYears));
    const checks = {
      photo: avatars.has(p.userId),
      bio: Boolean(p.hasBio),
      specialties: keys.length > 0,
      experience: p.experienceYears != null,
      certificate: (p.certificates || 0) > 0,
      gym: asArray(p.gymIds).length > 0,
    };
    for (const [k, v] of Object.entries(checks)) if (v) profileParts[k] += 1;
    if (p.hasInstagram) profileParts.instagram += 1;
    if (p.certificates > 0) certTrainers += 1;
    certTotal += p.certificates || 0;
    shaped.set(p.userId, { keys, checks });
  }

  // ── gyms ──────────────────────────────────────────────────────────────────
  const directory = { ACTIVE: 0, HIDDEN: 0, PROPOSED: 0 };
  const cities = new Set();
  let proposedByTrainers = 0;
  for (const g of gyms.values()) {
    bump(directory, directory[g.status] == null ? 'ACTIVE' : g.status);
    if (g.status === 'ACTIVE' && g.city) cities.add(g.city);
    if (g.proposedBy && keepUser(g.proposedBy)) proposedByTrainers += 1;
  }
  const gymTrainers = new Map();
  for (const p of profiles) {
    if (p.status === 'REJECTED') continue;
    for (const id of new Set(asArray(p.gymIds))) if (gyms.has(id)) gymTrainers.set(id, (gymTrainers.get(id) || 0) + 1);
  }
  const topGyms = [...gymTrainers]
    .map(([id, n]) => ({ ...gymLabel(gyms.get(id)), trainers: n }))
    .sort((a, b) => b.trainers - a.trainers || a.label.localeCompare(b.label))
    .slice(0, 8);

  // ── trainer list ──────────────────────────────────────────────────────────
  const items = profiles
    .map((p) => {
      const t = T.get(p.userId);
      const { keys, checks } = shaped.get(p.userId);
      const person = personSummary(people.get(p.userId) || { id: p.userId }, { teamIds });
      return {
        id: p.userId,
        name: p.displayName,
        status: STATUSES.includes(p.status) ? p.status : 'PENDING',
        everVerified: everVerified(p),
        team: isTeam(p.userId),
        createdAt: iso(p.createdAt),
        submittedAt: iso(p.submittedAt || p.createdAt),
        verifiedAt: iso(verifiedAt(p)),
        waitHours: p.status === 'PENDING' ? Math.round(waitHours(p) * 10) / 10 : null,
        profile: checks,
        specialties: keys,
        experienceYears: p.experienceYears ?? null,
        certificates: p.certificates || 0,
        gyms: asArray(p.gymIds).map((id) => gyms.get(id)).filter(Boolean).map(gymLabel),
        usage: {
          clients: t.active,
          clientsEver: t.clientsEver.size,
          requests: t.requests,
          invites: t.invites,
          ended: t.ended,
          goals: t.goals,
          sessions: t.sessions,
          noShow: t.noShow,
          cancelled: t.cancelled,
          upcoming: t.upcoming,
          unmarked: t.unmarked,
          openSlots: t.openSlots,
          expiredSlots: t.expiredSlots,
          plans: t.plans,
          plansActive: t.plansActive,
          reports: t.reports,
          reportsOpen: t.reportsOpen,
          blocks: t.blocks,
        },
        days: trainerAct.days(p.userId),
        lastAt: t.lastAt ? new Date(t.lastAt).toISOString() : iso(p.createdAt),
        person: { ...person, id: p.userId },
      };
    })
    .sort((a, b) => ms(b.lastAt) - ms(a.lastAt));

  // ── period ────────────────────────────────────────────────────────────────
  const { inPeriod, dayKeys } = win;
  const done = booked.filter((s) => s.status === 'DONE');
  const signups = (raw.signups || []).filter((u) => keepUser(u.id) && inPeriod(u.createdAt));
  const joined = new Set([...clientsEver, ...profiles.map((p) => p.userId)]);
  const signupsJoined = signups.filter((u) => joined.has(u.id));

  const accounts = Math.max(0, (raw.accountsTotal || 0) - (includeTeam ? 0 : teamIds.size));
  const photoPeople = new Set(photos.map((p) => p.userId));
  const workoutPeople = new Set(workouts.map((w) => w.userId));
  const planClients = new Set(plans.map((p) => p.clientId));
  const planTrainers = new Set(plans.map((p) => p.trainerId));

  return {
    installed: true,
    generatedAt: now.toISOString(),
    includeTeam,
    team: {
      accounts: teamIds.size,
      trainers: allProfiles.filter((p) => isTeam(p.userId)).length,
      links: allLinks.filter((l) => isTeam(l.trainerId) || isTeam(l.clientId)).length,
      sessions: allSessions.filter((s) => isTeam(s.trainerId) || isTeam(s.clientId)).length,
    },
    flags: { coach: { ...flagState(raw.flags, 'coach'), since: iso((raw.flags || []).find((f) => f.key === 'coach')?.updatedAt) } },
    totals: {
      accounts,
      trainers: applied,
      pending: statusCounts.PENDING,
      verified: statusCounts.VERIFIED,
      rejected: statusCounts.REJECTED,
      suspended: statusCounts.SUSPENDED,
      verifiedNoClients: tc((p, t) => p.status === 'VERIFIED' && t.clientsEver.size === 0),
      clientsEver: clientsEver.size,
      clientsActive: activeClients.size,
      clientRate: rateSafe(clientsEver.size, accounts),
      sessionsHeld: sessionStatus.DONE,
      sessionsUpcoming: sessionStatus.upcoming,
      noShow: sessionStatus.NO_SHOW,
      plans: plans.length,
      plansActive: plans.filter((p) => p.active).length,
      planClients: planClients.size,
      reportsOpen: reportStatus.open,
    },
    ladder,
    review: {
      pending: statusCounts.PENDING,
      pendingOverdue: pendingRows.filter((p) => waitHours(p) > COACH_REVIEW_SLA_HOURS).length,
      oldestPendingHours: pendingRows.length ? Math.round(oldestPending * 10) / 10 : null,
      answered: answerHours.length,
      medianAnswerHours: median(answerHours),
      everVerified: ladder[1].count,
      rejectedEver: profiles.filter((p) => rejectedEver.has(p.userId) || p.status === 'REJECTED').length,
      status: statusCounts,
      certificates: { trainers: certTrainers, total: certTotal },
      specialties: SPECIALTY_KEYS.map((key) => ({ key, count: specialties[key] })).filter((s) => s.count > 0).sort((a, b) => b.count - a.count),
      experience,
      profile: profileParts,
    },
    clients: {
      ever: clientsEver.size,
      active: activeClients.size,
      requested: links.filter((l) => l.status === 'REQUESTED' && l.initiator !== 'TRAINER').length,
      invited: links.filter((l) => l.status === 'REQUESTED' && l.initiator === 'TRAINER').length,
      ended: linkStatus.ENDED,
      declined: linkStatus.DECLINED,
      endedBy,
      via,
      scopes,
      sharesNothing,
      goalsPending,
      returned: [...clientsEver].filter((id) => clientAct.days(id) >= 2).length,
      perTrainer: median(items.filter((i) => i.usage.clientsEver > 0).map((i) => i.usage.clientsEver)),
      photos: { people: photoPeople.size, total: photos.length, linked: [...photoPeople].filter((id) => clientsEver.has(id)).length },
      workouts: { people: workoutPeople.size, total: workouts.reduce((sum, w) => sum + (w.count || 0), 0) },
      qr: { people: new Set(qr.map((r) => r.userId)).size },
    },
    sessions: {
      booked: booked.length,
      status: sessionStatus,
      noShowRate: rateSafe(sessionStatus.NO_SHOW, sessionStatus.DONE + sessionStatus.NO_SHOW),
      cancelledBy,
      lateCancel,
      kinds,
      slots,
      repeated,
      confirmed,
      confirmRate: rateSafe(confirmed, confirmable),
      withExercises,
      ratings: { count: ratings.length, avg: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null },
      medianMinutes: median(durations),
      trainers: new Set(booked.map((s) => s.trainerId)).size,
      clients: new Set(booked.map((s) => s.clientId).filter(Boolean)).size,
    },
    plans: { total: plans.length, active: plans.filter((p) => p.active).length, trainers: planTrainers.size, clients: planClients.size },
    gyms: {
      directory,
      cities: cities.size,
      proposedByTrainers,
      waiting: directory.PROPOSED,
      withTrainers: gymTrainers.size,
      top: topGyms,
    },
    safety: {
      installed: reports !== null,
      reports: { total: (reports || []).length, ...reportStatus, roles: reportRoles, reasons, withBlock: reportsWithBlock },
      blocks: (blocks || []).length,
    },
    period: {
      days: win.days,
      from: win.from,
      to: win.to,
      applications: profiles.filter((p) => inPeriod(p.createdAt)).length,
      verified: profiles.filter((p) => inPeriod(verifiedAt(p))).length,
      newLinks: links.filter((l) => inPeriod(l.acceptedAt)).length,
      requests: links.filter((l) => inPeriod(l.createdAt)).length,
      scheduled: booked.filter((s) => inPeriod(s.createdAt)).length,
      slots: sessions.filter((s) => s.status === 'OPEN' && inPeriod(s.createdAt)).length,
      held: done.filter((s) => inPeriod(s.startsAt)).length,
      noShow: booked.filter((s) => s.status === 'NO_SHOW' && inPeriod(s.startsAt)).length,
      cancelled: booked.filter((s) => s.status === 'CANCELLED' && inPeriod(s.startsAt)).length,
      plans: plans.filter((p) => inPeriod(p.createdAt)).length,
      activeTrainers: trainerAct.activeIn(win.from, win.to),
      activeClients: clientAct.activeIn(win.from, win.to),
      activePeople: anyAct.activeIn(win.from, win.to),
      signups: signups.length,
      signupsJoined: signupsJoined.length,
      signupRate: rateSafe(signupsJoined.length, signups.length),
      trend: {
        scheduled: daySeries(dayKeys, sessions, (s) => s.createdAt),
        held: daySeries(dayKeys, done, (s) => s.startsAt),
        active: anyAct.activeByDay(dayKeys),
      },
    },
    items: items.slice(0, COACH_USAGE_LIST_MAX),
    itemsTotal: items.length,
  };
}

/** Lazily created tables (coachSafety.js) may not exist yet: read them only when they are there. */
async function safetyTables(db) {
  try {
    const [row] = await db.$queryRaw`SELECT to_regclass('"CoachReport"') IS NOT NULL AS reports, to_regclass('"CoachBlock"') IS NOT NULL AS blocks`;
    return { reports: Boolean(row?.reports), blocks: Boolean(row?.blocks) };
  } catch {
    return { reports: false, blocks: false };
  }
}

/** A table created lazily on first use may be missing: read as empty instead of failing the page. */
const orEmpty = (promise) => promise.catch((e) => (missingTable(e) ? [] : Promise.reject(e)));
const arr = (col) => `CASE WHEN jsonb_typeof(${col}) = 'array' THEN ${col} ELSE '[]'::jsonb END`;

/**
 * Every row the page needs, for all accounts (the builder drops team accounts). Read-only raw SQL — the coach
 * tables are raw-SQL tables (trainerStore.js), and sensitive columns are reduced in the query itself: bio,
 * Instagram and certificate files to booleans / counts, the proposed goal to its date, exercises to a count,
 * meal-plan targets and meals, notes and report text are never selected.
 */
export async function loadCoachUsageRaw(db = prisma, { now = new Date() } = {}) {
  const since = tbilisiMidnight(addDaysYmd(tbilisiYmd(now), -(Math.max(...USAGE_PERIODS) - 1)));
  const [teamUserIds, accountsTotal, profiles, links, sessions, plans, photos, workouts, qr, gyms, reviews, signups, flags, tables] = await Promise.all([
    loadTeamUserIds(db),
    db.user.count(),
    db.$queryRawUnsafe(`SELECT "userId", "displayName", specialties, "experienceYears", "gymIds", status, "reviewedAt", "submittedAt", "createdAt",
        (coalesce(btrim(bio), '') <> '') AS "hasBio", (coalesce(btrim(instagram), '') <> '') AS "hasInstagram",
        jsonb_array_length(${arr('certificates')})::int AS certificates,
        coalesce((SELECT array_agg(c->>'addedAt') FROM jsonb_array_elements(${arr('certificates')}) c WHERE c ? 'addedAt'), '{}') AS "certificateDates"
      FROM "TrainerProfile"`),
    db.$queryRaw`SELECT "trainerId", "clientId", status, initiator, scopes, "endedBy", "createdAt", "acceptedAt", "endedAt",
        CASE WHEN "proposedGoal" IS NULL OR jsonb_typeof("proposedGoal") <> 'object' THEN NULL
          ELSE coalesce("proposedGoal"->>'proposedAt', to_char("updatedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')) END AS "goalProposedAt"
      FROM "TrainerLink"`,
    db.$queryRawUnsafe(`SELECT "trainerId", "clientId", "startsAt", "durationMin", kind, status, "clientConfirmedAt", "cancelledBy", "lateCancel",
        "clientRating", "createdAt", "updatedAt", jsonb_array_length(${arr('exercises')})::int AS "exerciseCount",
        CASE WHEN "seriesId" = 'slot' THEN 'slot' WHEN "seriesId" IS NOT NULL THEN 'repeat' END AS series
      FROM "TrainerSession"`),
    db.$queryRaw`SELECT "trainerId", "clientId", active, "createdAt" FROM "TrainerMealPlan"`,
    db.$queryRaw`SELECT "userId", "createdAt" FROM "ProgressPhoto"`,
    db.$queryRaw`SELECT "userId", count(*)::int AS count FROM "WorkoutLog" GROUP BY 1`,
    orEmpty(db.$queryRaw`SELECT "userId", "createdAt" FROM "UserQr"`),
    db.$queryRaw`SELECT id, brand, "brandKa", name, "nameKa", city, district, status, "proposedBy" FROM "Gym"`,
    db.adminAuditLog.findMany({ where: { action: { in: REVIEW_ACTIONS } }, select: { action: true, targetId: true, createdAt: true } }),
    db.user.findMany({ where: { createdAt: { gte: since } }, select: { id: true, createdAt: true } }),
    listFeatureFlags(db).catch(() => []),
    safetyTables(db),
  ]);
  const trainerIds = profiles.map((p) => p.userId);
  const [{ people }, avatars, reports, blocks] = await Promise.all([
    loadPeople(trainerIds, db),
    trainerIds.length ? orEmpty(db.$queryRaw`SELECT "userId" FROM "UserAvatar" WHERE "userId" = ANY(${trainerIds})`) : [],
    tables.reports ? db.$queryRaw`SELECT "reporterId", "reporterRole", "subjectId", reason, blocked, status, "createdAt" FROM "CoachReport"` : null,
    tables.blocks ? db.$queryRaw`SELECT "clientId", "trainerId", "createdAt" FROM "CoachBlock"` : null,
  ]);
  return {
    teamUserIds,
    accountsTotal,
    profiles: profiles.map((p) => ({
      ...p,
      specialties: asArray(p.specialties),
      gymIds: asArray(p.gymIds),
      certificateDates: asArray(p.certificateDates).filter(Boolean),
    })),
    links: links.map(({ scopes, ...l }) => ({ ...l, scopes: Object.fromEntries(SCOPES.map((k) => [k, scopes?.[k] === true])) })),
    sessions,
    plans,
    photos,
    workouts,
    qr,
    gyms,
    reviews,
    signups,
    flags,
    people,
    avatarUserIds: avatars.map((a) => a.userId),
    reports: reports ? reports.map((r) => ({ ...r, blocked: Boolean(r.blocked) })) : null,
    blocks,
  };
}

export async function loadCoachUsage({ days = 30, includeTeam = false, db = prisma, now = new Date() } = {}) {
  try {
    const raw = await loadCoachUsageRaw(db, { now });
    return buildCoachUsage(raw, { days, includeTeam, now });
  } catch (error) {
    if (missingTable(error)) return { installed: false, generatedAt: now.toISOString() };
    throw error;
  }
}
