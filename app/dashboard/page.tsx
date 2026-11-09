'use client';

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import {
  Button, Input, Select, Textarea, Badge, Card, CardHeader, CardTitle, CardContent,
  Modal, Table, Thead, Tbody, Tr, Th, Td, Alert, Avatar, Loading, EmptyState, Toast
} from '@/components/ui';
import { formatCOP, formatDate, formatMonth, monthLabel, downloadCsv } from '@/lib/format';

// Type definitions for API responses
interface Allocation { beneficiaryId: string; months: number; }
interface PaymentSent {
  id: string; payer_id: string; amount_cop: number; paid_on: string; reference: string | null;
  status: string; submitted_at: string; reviewed_by: string | null; reviewed_at: string | null;
  rejection_reason: string | null; unassigned_cop: number; receipt_path: string | null;
  allocations: Allocation[]; payer_name: string;
}
interface Coverage { member_id: string; period: string; payment_id: string; revoked_at: string | null; }
interface AllocationReceived {
  id: string; payer_id: string; payer_name: string; amount_cop: number; paid_on: string; reference: string | null;
  status: string; submitted_at: string; reviewed_by: string | null; reviewed_at: string | null;
  rejection_reason: string | null; unassigned_cop: number; receipt_path: string | null;
  allocations: Allocation[];
}
interface MemberInfo { id: string; name: string; role: 'admin' | 'member'; start_month: string | null; }
interface MemberDashboardData {
  member: MemberInfo;
  payments_sent: PaymentSent[];
  coverage: Coverage[];
  allocations_received: AllocationReceived[];
  all_members: { id: string; name: string }[];
}

export default function MemberDashboard() {
  const [data, setData] = useState<MemberDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  const [submitModal, setSubmitModal] = useState(false);
  const [submitForm, setSubmitForm] = useState({
    amount: '', paidOn: new Date().toISOString().split('T')[0], reference: '',
    allocations: [] as { beneficiaryId: string; months: number }[],
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [receiptModal, setReceiptModal] = useState<{ paymentId: string; paymentName: string } | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  async function fetchData() {
    try {
      const res = await fetch('/api/member/dashboard', { cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = '/auth/login';
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al cargar'); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchData(); }, []);

  function showToast(message: string, variant: 'success' | 'error' = 'success') {
    setToast({ message, variant });
    setTimeout(() => setToast(null), 5000);
  }

  async function handleSubmitPayment(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitLoading(true);
    const fd = new FormData();
    fd.append('amount', submitForm.amount);
    fd.append('paidOn', submitForm.paidOn);
    fd.append('reference', submitForm.reference);
    fd.append('allocations', JSON.stringify(submitForm.allocations));
    try {
      const res = await fetch('/api/payments/submit', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(await res.text());
      setSubmitModal(false);
      setSubmitForm({ amount: '', paidOn: new Date().toISOString().split('T')[0], reference: '', allocations: [] });
      showToast('Comprobante enviado, pendiente de revisión');
      fetchData();
    } catch (e) { setSubmitError(e instanceof Error ? e.message : 'Error'); }
    finally { setSubmitLoading(false); }
  }

  async function handleUploadReceipt(e: FormEvent) {
    e.preventDefault();
    if (!receiptFile || !receiptModal) return;
    setReceiptLoading(true);
    const fd = new FormData();
    fd.append('paymentId', receiptModal.paymentId);
    fd.append('file', receiptFile);
    try {
      const res = await fetch('/api/receipts/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(await res.text());
      setReceiptModal(null);
      setReceiptFile(null);
      showToast('Comprobante subido');
      fetchData();
    } catch (e) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setReceiptLoading(false); }
  }

  if (loading) return <Loading text="Cargando panel..." />;
  if (error) return <Alert variant="error">{error}</Alert>;
  if (!data) return null;

  const member = data?.member;
  const payments_sent = data?.payments_sent || [];
  const coverage = data?.coverage || [];
  const allocations_received = data?.allocations_received || [];

  if (!member) return <Alert variant="error">No se encontró información del integrante</Alert>;

  // Determine status
  const today = new Date();
  const periodKey = (d: Date) => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit' }).formatToParts(d);
    const get = (t: string) => parts.find(x => x.type === t)!.value;
    return `${get('year')}-${get('month')}`;
  };
  const currentPeriod = periodKey(today);
  const coveredPeriods = new Set((coverage || []).filter((c: Coverage) => !c?.revoked_at).map((c: Coverage) => c.period));
  const startMonth = member.start_month;
  let status: 'AL_DIA' | 'PENDIENTE' | 'ATRASADO' = 'AL_DIA';
  let nextDue = currentPeriod;
  if (startMonth) {
    let p = startMonth;
    while (coveredPeriods.has(p)) p = addMonth(p, 1);
    nextDue = p;
    if (p < currentPeriod) status = 'ATRASADO';
    else if (p === currentPeriod) status = 'PENDIENTE';
  }

  const statusBadge = status === 'AL_DIA' ? 'success' : status === 'PENDIENTE' ? 'warning' : 'danger';
  const statusLabel = status === 'AL_DIA' ? 'Al día' : status === 'PENDIENTE' ? 'Pendiente' : 'Atrasado';

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={member.name} className="w-14 h-14 text-xl" />
          <div>
            <h1 className="text-2xl font-bold">{member.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={statusBadge}>{statusLabel}</Badge>
              {startMonth && <span className="text-sm text-muted">Desde {formatMonth(startMonth)}</span>}
            </div>
          </div>
        </div>
        <Button onClick={() => setSubmitModal(true)}>Enviar comprobante</Button>
      </div>

      {/* Próximo vencimiento */}
      {startMonth && (
        <Card>
          <CardContent className="pt-0">
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted">Próximo vencimiento</p>
                <p className="text-2xl font-semibold">{formatMonth(nextDue)}</p>
              </div>
              <div>
                <p className="text-sm text-muted">Meses cubiertos</p>
                <p className="text-2xl font-semibold">{coveredPeriods.size}</p>
              </div>
              <div>
                <p className="text-sm text-muted">Último mes pagado</p>
                <p className="text-2xl font-semibold">
                  {coverage.length ? formatMonth([...coveredPeriods].sort().pop()!) : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagos enviados */}
      <Card>
        <CardHeader>
          <CardTitle>Pagos enviados ({payments_sent.length})</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {payments_sent.length === 0 ? (
            <EmptyState title="Sin pagos enviados" description="Usa el botón para enviar tu primer comprobante." />
          ) : (
            <Table>
              <Thead><Tr><Th>Fecha</Th><Th>Importe</Th><Th>Referencia</Th><Th>Estado</Th><Th>Asignaciones</Th><Th>Comprobante</Th><Th>Acciones</Th></Tr></Thead>
              <Tbody>
                {payments_sent.map((p: PaymentSent) => (
                  <Tr key={p.id}>
                    <Td>{formatDate(p.paid_on)}</Td>
                    <Td>{formatCOP(p.amount_cop)}</Td>
                    <Td>{p.reference || '—'}</Td>
                    <Td><Badge variant={p.status === 'APROBADO' ? 'success' : p.status === 'RECHAZADO' ? 'danger' : p.status === 'REVERTIDO' ? 'neutral' : 'warning'}>{p.status}</Badge></Td>
                    <Td>
                      {(p.allocations || []).map((a: Allocation) => (
                        <Badge key={`${a.beneficiaryId}-${a.months}`} variant="neutral" className="mr-1 mb-1">{a.beneficiaryId === member.id ? 'Yo' : a.beneficiaryId}: {a.months}m</Badge>
                      ))}
                    </Td>
                    <Td>{p.receipt_path ? (
                      <Button variant="ghost" size="sm" onClick={() => window.open(`/api/receipts/${encodeURIComponent(p.receipt_path!)}`, '_blank')}>Ver</Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setReceiptModal({ paymentId: p.id, paymentName: `${formatCOP(p.amount_cop)} - ${formatDate(p.paid_on)}` })}>Subir</Button>
                    )}</Td>
                    <Td>
                      {p.status === 'PENDIENTE' && !p.receipt_path && (
                        <Button variant="ghost" size="sm" onClick={() => setReceiptModal({ paymentId: p.id, paymentName: `${formatCOP(p.amount_cop)} - ${formatDate(p.paid_on)}` })}>Adjuntar</Button>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Cobertura personal */}
      <Card>
        <CardHeader><CardTitle>Mi cobertura ({(coverage || []).filter((c: Coverage) => !c?.revoked_at).length} meses activos)</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {coverage.length === 0 ? (
            <EmptyState title="Sin cobertura" description="Cuando se apruebe un pago que te cubra, aparecerá aquí." />
          ) : (
            <Table>
              <Thead><Tr><Th>Mes</Th><Th>Pago origen</Th><Th>Estado</Th></Tr></Thead>
              <Tbody>
                {coverage.sort((a: Coverage, b: Coverage) => b.period.localeCompare(a.period)).map((c: Coverage) => (
                  <Tr key={`${c.member_id}-${c.period}`}>
                    <Td>{formatMonth(c.period)}</Td>
                    <Td>{c.payment_id.slice(0, 8)}…</Td>
                    <Td><Badge variant={c.revoked_at ? 'neutral' : 'success'}>{c.revoked_at ? 'Revocado' : 'Activo'}</Badge></Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Asignaciones recibidas */}
      <Card>
        <CardHeader><CardTitle>Pagos que me cubren ({allocations_received.length})</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {allocations_received.length === 0 ? (
            <EmptyState title="Sin asignaciones" />
          ) : (
            <Table>
              <Thead><Tr><Th>Fecha</Th><Th>Pagado por</Th><Th>Importe</Th><Th>Meses para mí</Th><Th>Estado</Th></Tr></Thead>
              <Tbody>
                {allocations_received.map((p: AllocationReceived) => {
                  const myAlloc = (p.allocations || []).find((a: Allocation) => a.beneficiaryId === member.id);
                  return (
                    <Tr key={p.id}>
                      <Td>{formatDate(p.paid_on)}</Td>
                      <Td>{p.payer_name}</Td>
                      <Td>{formatCOP(p.amount_cop)}</Td>
                      <Td>{myAlloc ? `${myAlloc.months} mes${myAlloc.months > 1 ? 'es' : ''}` : '—'}</Td>
                      <Td><Badge variant={p.status === 'APROBADO' ? 'success' : p.status === 'RECHAZADO' ? 'danger' : 'warning'}>{p.status}</Badge></Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <Modal open={submitModal} onClose={() => setSubmitModal(false)} title="Enviar comprobante de pago">
        <form onSubmit={handleSubmitPayment} className="space-y-4">
          {submitError && <Alert variant="error" className="mb-4">{submitError}</Alert>}
          <Input label="Importe (COP)" type="number" min="1" step="1" value={submitForm.amount} onChange={(e: ChangeEvent<HTMLInputElement>) => setSubmitForm({...submitForm, amount: e.target.value})} required />
          <Input label="Fecha de pago" type="date" value={submitForm.paidOn} onChange={(e: ChangeEvent<HTMLInputElement>) => setSubmitForm({...submitForm, paidOn: e.target.value})} required />
          <Input label="Referencia (opcional)" value={submitForm.reference} onChange={(e: ChangeEvent<HTMLInputElement>) => setSubmitForm({...submitForm, reference: e.target.value})} />
          <div>
            <label className="block text-sm font-medium mb-2">Para quién y cuántos meses</label>
            <AllocationEditor
              allocations={submitForm.allocations}
              members={data?.all_members || []}
              onChange={allocs => setSubmitForm({...submitForm, allocations: allocs})}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setSubmitModal(false)}>Cancelar</Button>
            <Button type="submit" loading={submitLoading}>Enviar</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!receiptModal} onClose={() => { setReceiptModal(null); setReceiptFile(null); }} title={`Comprobante: ${receiptModal?.paymentName}`}>
        <form onSubmit={handleUploadReceipt} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Archivo (JPG, PNG, WebP, PDF · máx 5 MB)</label>
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e: ChangeEvent<HTMLInputElement>) => setReceiptFile(e.target.files?.[0] || null)} className="input" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setReceiptModal(null); setReceiptFile(null); }}>Cancelar</Button>
            <Button type="submit" loading={receiptLoading} disabled={!receiptFile}>Subir</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function AllocationEditor({ allocations, onChange, members }: { allocations: { beneficiaryId: string; months: number }[]; onChange: (a: { beneficiaryId: string; months: number }[]) => void; members: { id: string; name: string }[] }) {
  const [rows, setRows] = useState(allocations.length ? allocations : [{ beneficiaryId: '', months: 1 }]);

  function updateRow(i: number, field: 'beneficiaryId' | 'months', value: string | number) {
    const next = [...rows];
    next[i] = { ...next[i], [field]: field === 'months' ? Number(value) : value };
    setRows(next);
    onChange(next.filter(r => r.beneficiaryId));
  }

  function addRow() { const next = [...rows, { beneficiaryId: '', months: 1 }]; setRows(next); onChange(next.filter(r => r.beneficiaryId)); }
  function removeRow(i: number) { const next = rows.filter((_, j) => j !== i); setRows(next); onChange(next.filter(r => r.beneficiaryId)); }

  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2 items-end">
          <Select
            value={r.beneficiaryId}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => updateRow(i, 'beneficiaryId', e.target.value)}
            className="flex-1"
          >
            <option value="">Selecciona integrante</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
          <Input type="number" min="1" value={r.months} onChange={(e: ChangeEvent<HTMLInputElement>) => updateRow(i, 'months', e.target.value)} className="w-24" />
          {rows.length > 1 && <Button variant="ghost" size="sm" onClick={() => removeRow(i)}>✕</Button>}
        </div>
      ))}
      {rows.length < 6 && <Button variant="secondary" size="sm" onClick={addRow}>+ Añadir otro beneficiario</Button>}
    </div>
  );
}

function addMonth(p: string, n: number) {
  const [y, m] = p.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}