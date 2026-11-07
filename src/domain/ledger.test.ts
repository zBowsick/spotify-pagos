import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, submitPayment, approvePayment, rejectPayment, reversePayment,
  memberStatus, currentMonthBogota, LedgerError, type State,
} from './ledger';

// El precio 10000 es un valor de prueba, NO el precio real de Spotify.
const PRICE = 10000;
function fixture(start = '2026-01'): State {
  const s = createState();
  s.config.monthlyPrice = PRICE;
  s.members.forEach(m => { m.startMonth = start; });
  return s;
}
const active = (s: State, id: string) => s.coverage.filter(c => c.memberId === id && !c.revokedAt).map(c => c.period).sort();

test('1. Seis integrantes y David es el único admin', () => {
  const s = createState();
  assert.deepEqual(s.members.map(m => m.name), ['David', 'Catalina', 'Camila', 'Estevan', 'Angélica', 'Mariana']);
  assert.deepEqual(s.members.filter(m => m.role === 'admin').map(m => m.name), ['David']);
  assert.equal(new Set(s.members.map(m => m.id)).size, 6);
});

test('2. Pendientes y rechazados no generan cobertura', () => {
  const s = fixture();
  const { payment } = submitPayment(s, { payerId: 'camila', amount: PRICE, paidOn: '2026-01-05', allocations: [{ beneficiaryId: 'camila', months: 1 }] });
  assert.equal(payment.status, 'PENDIENTE');
  assert.equal(s.coverage.length, 0);
  assert.throws(() => rejectPayment(s, 'david', payment.id, '  '), LedgerError);
  rejectPayment(s, 'david', payment.id, 'Comprobante ilegible');
  assert.equal(s.coverage.length, 0);
  assert.throws(() => approvePayment(s, 'david', payment.id), LedgerError);
});

test('3. Aprobar actualiza los meses cubiertos', () => {
  const s = fixture();
  const { payment } = submitPayment(s, { payerId: 'david', amount: PRICE, paidOn: '2026-01-02', allocations: [{ beneficiaryId: 'david', months: 1 }] });
  approvePayment(s, 'david', payment.id);
  assert.deepEqual(active(s, 'david'), ['2026-01']);
  assert.equal(memberStatus(s, 'david', '2026-01').status, 'AL_DIA');
  assert.equal(s.payments[0].reviewedBy, 'david');
});

test('4. Un pago cubre varias personas y varios meses (1 transacción, 6 aplicaciones)', () => {
  const s = fixture();
  const { payment } = submitPayment(s, {
    payerId: 'david', amount: 6 * PRICE, paidOn: '2026-01-03',
    allocations: ['david', 'catalina', 'camila'].map(b => ({ beneficiaryId: b, months: 2 })),
  });
  approvePayment(s, 'david', payment.id);
  assert.equal(s.payments.length, 1);
  assert.equal(s.coverage.length, 6);
  assert.deepEqual(active(s, 'catalina'), ['2026-01', '2026-02']);
});

test('5. Beneficiarios con coberturas distintas en el mismo pago', () => {
  const s = fixture();
  const { payment } = submitPayment(s, {
    payerId: 'estevan', amount: 4 * PRICE, paidOn: '2026-01-10',
    allocations: [{ beneficiaryId: 'estevan', months: 1 }, { beneficiaryId: 'angelica', months: 3 }],
  });
  approvePayment(s, 'david', payment.id);
  assert.equal(active(s, 'estevan').length, 1);
  assert.equal(active(s, 'angelica').length, 3);
});

test('6. Pagos parciales y excedentes', () => {
  const s = fixture();
  // Pide más de lo pagado: se rechaza el envío
  assert.throws(() => submitPayment(s, { payerId: 'mariana', amount: PRICE + 5000, paidOn: '2026-01-04', allocations: [{ beneficiaryId: 'mariana', months: 2 }] }), LedgerError);
  // Pago parcial sin asignaciones: queda sin asignar, sin cobertura
  const a = submitPayment(s, { payerId: 'mariana', amount: 5000, paidOn: '2026-01-04', allocations: [] }).payment;
  approvePayment(s, 'david', a.id);
  assert.equal(a.unassigned, 5000);
  assert.equal(s.coverage.length, 0);
  // Excedente: 2 meses + 5000 sobrantes
  const b = submitPayment(s, { payerId: 'mariana', amount: 2 * PRICE + 5000, paidOn: '2026-01-06', reference: 'X1', allocations: [{ beneficiaryId: 'mariana', months: 2 }] }).payment;
  approvePayment(s, 'david', b.id);
  assert.equal(b.unassigned, 5000);
  assert.equal(active(s, 'mariana').length, 2);
});

test('7. Sin duplicados ante aprobaciones repetidas; duplicados detectados', () => {
  const s = fixture();
  const first = submitPayment(s, { payerId: 'catalina', amount: PRICE, paidOn: '2026-01-05', reference: 'REF-9', allocations: [{ beneficiaryId: 'catalina', months: 1 }] });
  assert.equal(first.possibleDuplicates.length, 0);
  const dup = submitPayment(s, { payerId: 'catalina', amount: PRICE, paidOn: '2026-01-05', reference: 'ref-9', allocations: [{ beneficiaryId: 'catalina', months: 1 }] });
  assert.equal(dup.possibleDuplicates.length, 1);
  const r1 = approvePayment(s, 'david', first.payment.id);
  const r2 = approvePayment(s, 'david', first.payment.id);
  assert.equal(r1.alreadyApproved, false);
  assert.equal(r2.alreadyApproved, true);
  assert.equal(s.coverage.length, 1);
  // Un segundo pago aprobado avanza al mes siguiente, nunca repite periodo
  approvePayment(s, 'david', dup.payment.id);
  assert.deepEqual(active(s, 'catalina'), ['2026-01', '2026-02']);
});

test('8. Un integrante no puede aprobar, rechazar ni revertir', () => {
  const s = fixture();
  const { payment } = submitPayment(s, { payerId: 'camila', amount: PRICE, paidOn: '2026-01-05', allocations: [{ beneficiaryId: 'camila', months: 1 }] });
  assert.throws(() => approvePayment(s, 'camila', payment.id), /administrador/);
  assert.throws(() => rejectPayment(s, 'camila', payment.id, 'x'), /administrador/);
  approvePayment(s, 'david', payment.id);
  assert.throws(() => reversePayment(s, 'camila', payment.id, 'x'), /administrador/);
});

test('9. Las reversiones conservan el historial', () => {
  const s = fixture();
  const { payment } = submitPayment(s, { payerId: 'david', amount: 2 * PRICE, paidOn: '2026-01-05', allocations: [{ beneficiaryId: 'david', months: 2 }] });
  approvePayment(s, 'david', payment.id);
  assert.throws(() => reversePayment(s, 'david', payment.id, ''), LedgerError);
  reversePayment(s, 'david', payment.id, 'Pago duplicado en el banco');
  assert.equal(s.coverage.length, 2);                       // filas conservadas
  assert.ok(s.coverage.every(c => c.revokedAt));            // pero revocadas
  assert.deepEqual(active(s, 'david'), []);
  assert.equal(s.payments[0].status, 'REVERTIDO');
  assert.deepEqual(s.audit.map(a => a.action), ['ENVIADO', 'APROBADO', 'REVERTIDO']);
});

test('10. Vencimientos al cambiar de año', () => {
  const s = fixture('2026-11');
  const { payment } = submitPayment(s, { payerId: 'mariana', amount: 3 * PRICE, paidOn: '2026-11-02', allocations: [{ beneficiaryId: 'mariana', months: 3 }] });
  approvePayment(s, 'david', payment.id);
  assert.deepEqual(active(s, 'mariana'), ['2026-11', '2026-12', '2027-01']);
  const st = memberStatus(s, 'mariana', '2027-01');
  assert.equal(st.nextDue, '2027-02');
  assert.equal(st.status, 'AL_DIA');
  const late = memberStatus(s, 'mariana', '2027-03');
  assert.equal(late.status, 'ATRASADO');
  assert.equal(late.monthsOverdue, 1);
  // 1 de enero 00:30 en Bogotá = 05:30 UTC; 31-dic 22:00 Bogotá = 03:00 UTC del 1-ene
  assert.equal(currentMonthBogota(new Date('2027-01-01T03:00:00Z')), '2026-12');
  assert.equal(currentMonthBogota(new Date('2027-01-01T05:30:00Z')), '2027-01');
});
