// Motor contable puro: reglas de pagos, coberturas y estados.
// Dinero en pesos COP enteros. Periodos como "YYYY-MM" (mes calendario).
// La misma lógica está replicada en SQL (supabase/migrations/0001_init.sql)
// dentro de transacciones; este módulo es la especificación ejecutable y probada.

export type Role = 'admin' | 'member';
export type PaymentStatus = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'REVERTIDO';
export type MemberStatus = 'AL_DIA' | 'PENDIENTE' | 'ATRASADO';

export interface Member { id: string; name: string; role: Role; startMonth: string | null }
export interface Allocation { beneficiaryId: string; months: number }
export interface Payment {
  id: string; payerId: string; amount: number; paidOn: string; reference: string | null;
  allocations: Allocation[]; status: PaymentStatus; submittedAt: string;
  reviewedBy?: string; reviewedAt?: string; rejectionReason?: string; unassigned: number;
}
export interface Coverage { paymentId: string; memberId: string; period: string; revokedAt: string | null }
export interface AuditEntry { at: string; actorId: string; action: string; paymentId?: string; detail?: string }
export interface State {
  config: { monthlyPrice: number | null; currency: 'COP'; timezone: 'America/Bogota' };
  members: Member[]; payments: Payment[]; coverage: Coverage[]; audit: AuditEntry[];
}
export interface SubmitInput {
  payerId: string; amount: number; paidOn: string; reference?: string | null;
  allocations: Allocation[]; id?: string;
}

export class LedgerError extends Error {}

// ---------- Meses ----------
const idx = (p: string) => { const [y, m] = p.split('-').map(Number); return y * 12 + (m - 1); };
const fmt = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
export const addMonths = (p: string, n: number) => fmt(idx(p) + n);

/** Mes actual en America/Bogota (UTC-5, sin horario de verano). */
export function currentMonthBogota(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit' })
    .formatToParts(now);
  const get = (t: string) => parts.find(x => x.type === t)!.value;
  return `${get('year')}-${get('month')}`;
}

// ---------- Estado inicial ----------
export function seedMembers(): Member[] {
  return [
    { id: 'david', name: 'David', role: 'admin', startMonth: null },
    { id: 'catalina', name: 'Catalina', role: 'member', startMonth: null },
    { id: 'camila', name: 'Camila', role: 'member', startMonth: null },
    { id: 'estevan', name: 'Estevan', role: 'member', startMonth: null },
    { id: 'angelica', name: 'Angélica', role: 'member', startMonth: null },
    { id: 'mariana', name: 'Mariana', role: 'member', startMonth: null },
  ];
}
export function createState(): State {
  return {
    config: { monthlyPrice: null, currency: 'COP', timezone: 'America/Bogota' },
    members: seedMembers(), payments: [], coverage: [], audit: [],
  };
}

// ---------- Utilidades ----------
const member = (s: State, id: string) => {
  const m = s.members.find(x => x.id === id);
  if (!m) throw new LedgerError(`Integrante desconocido: ${id}`);
  return m;
};
function requireAdmin(s: State, actorId: string) {
  if (member(s, actorId).role !== 'admin') throw new LedgerError('Solo el administrador puede hacer esto.');
}
const requirePrice = (s: State) => {
  if (!s.config.monthlyPrice) throw new LedgerError('Falta configurar el precio mensual.');
  return s.config.monthlyPrice;
};
const activeCoverage = (s: State, memberId: string) =>
  new Set(s.coverage.filter(c => c.memberId === memberId && !c.revokedAt).map(c => c.period));

/** Primer mes sin cobertura activa: así los pagos saldan siempre la deuda más antigua. */
export function nextUncovered(s: State, memberId: string): string {
  const m = member(s, memberId);
  if (!m.startMonth) throw new LedgerError(`${m.name} no tiene fecha inicial de cobertura configurada.`);
  const covered = activeCoverage(s, memberId);
  let p = m.startMonth;
  while (covered.has(p)) p = addMonths(p, 1);
  return p;
}

// ---------- Duplicados ----------
export function findDuplicates(s: State, input: SubmitInput): Payment[] {
  const ref = input.reference?.trim().toLowerCase();
  return s.payments.filter(p => p.status !== 'RECHAZADO' && (
    (ref && p.reference?.trim().toLowerCase() === ref) ||
    (p.payerId === input.payerId && p.amount === input.amount && p.paidOn === input.paidOn)));
}

// ---------- Flujo de pagos ----------
export function submitPayment(s: State, input: SubmitInput, now = new Date()) {
  const price = requirePrice(s);
  member(s, input.payerId);
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new LedgerError('Importe inválido.');
  const seen = new Set<string>();
  let assigned = 0;
  for (const a of input.allocations) {
    member(s, a.beneficiaryId);
    if (!Number.isInteger(a.months) || a.months < 1) throw new LedgerError('Los meses deben ser enteros positivos.');
    if (seen.has(a.beneficiaryId)) throw new LedgerError('Beneficiario repetido en el mismo pago.');
    seen.add(a.beneficiaryId);
    assigned += a.months * price;
  }
  if (assigned > input.amount)
    throw new LedgerError('El importe no alcanza para los meses solicitados: no se genera cobertura excesiva.');
  const duplicates = findDuplicates(s, input);
  const payment: Payment = {
    id: input.id ?? `pay-${s.payments.length + 1}`, payerId: input.payerId, amount: input.amount,
    paidOn: input.paidOn, reference: input.reference ?? null, allocations: input.allocations,
    status: 'PENDIENTE', submittedAt: now.toISOString(), unassigned: input.amount - assigned,
  };
  s.payments.push(payment);
  s.audit.push({ at: payment.submittedAt, actorId: input.payerId, action: 'ENVIADO', paymentId: payment.id });
  return { payment, possibleDuplicates: duplicates };
}

const getPayment = (s: State, id: string) => {
  const p = s.payments.find(x => x.id === id);
  if (!p) throw new LedgerError('Pago no encontrado.');
  return p;
};

/** Idempotente: aprobar dos veces no duplica coberturas. */
export function approvePayment(s: State, actorId: string, paymentId: string, now = new Date()) {
  requireAdmin(s, actorId);
  const p = getPayment(s, paymentId);
  if (p.status === 'APROBADO') return { alreadyApproved: true };
  if (p.status !== 'PENDIENTE') throw new LedgerError(`Un pago ${p.status} no puede aprobarse.`);
  const price = requirePrice(s);
  const assigned = p.allocations.reduce((t, a) => t + a.months * price, 0);
  if (assigned > p.amount) throw new LedgerError('Las asignaciones superan el importe.');
  // Validar todo antes de escribir nada (atomicidad)
  p.allocations.forEach(a => nextUncovered(s, a.beneficiaryId));
  for (const a of p.allocations) {
    for (let i = 0; i < a.months; i++)
      s.coverage.push({ paymentId: p.id, memberId: a.beneficiaryId, period: nextUncovered(s, a.beneficiaryId), revokedAt: null });
  }
  p.status = 'APROBADO'; p.reviewedBy = actorId; p.reviewedAt = now.toISOString();
  p.unassigned = p.amount - assigned;
  s.audit.push({ at: p.reviewedAt, actorId, action: 'APROBADO', paymentId: p.id });
  return { alreadyApproved: false };
}

export function rejectPayment(s: State, actorId: string, paymentId: string, reason: string, now = new Date()) {
  requireAdmin(s, actorId);
  if (!reason?.trim()) throw new LedgerError('Debes indicar el motivo del rechazo.');
  const p = getPayment(s, paymentId);
  if (p.status !== 'PENDIENTE') throw new LedgerError(`Solo se rechazan pagos pendientes (estado: ${p.status}).`);
  p.status = 'RECHAZADO'; p.rejectionReason = reason.trim(); p.reviewedBy = actorId; p.reviewedAt = now.toISOString();
  s.audit.push({ at: p.reviewedAt, actorId, action: 'RECHAZADO', paymentId: p.id, detail: p.rejectionReason });
}

/** Reversión auditada: la cobertura se marca revocada, nunca se borra. */
export function reversePayment(s: State, actorId: string, paymentId: string, reason: string, now = new Date()) {
  requireAdmin(s, actorId);
  if (!reason?.trim()) throw new LedgerError('Debes indicar el motivo de la reversión.');
  const p = getPayment(s, paymentId);
  if (p.status !== 'APROBADO') throw new LedgerError('Solo se revierten pagos aprobados.');
  const at = now.toISOString();
  s.coverage.filter(c => c.paymentId === p.id && !c.revokedAt).forEach(c => { c.revokedAt = at; });
  p.status = 'REVERTIDO';
  s.audit.push({ at, actorId, action: 'REVERTIDO', paymentId: p.id, detail: reason.trim() });
}

// ---------- Estado de cada integrante ----------
export function memberStatus(s: State, memberId: string, today: string) {
  const nextDue = nextUncovered(s, memberId);
  const start = member(s, memberId).startMonth!;
  const covered = activeCoverage(s, memberId);
  let monthsOverdue = 0;
  for (let p = start; idx(p) < idx(today); p = addMonths(p, 1)) if (!covered.has(p)) monthsOverdue++;
  const status: MemberStatus =
    idx(nextDue) > idx(today) ? 'AL_DIA' : idx(nextDue) === idx(today) && monthsOverdue === 0 ? 'PENDIENTE' : 'ATRASADO';
  const last = [...covered].sort().pop() ?? null;
  return { status, nextDue, monthsOverdue, coveredThrough: last };
}
