'use client';

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import {
  Button, Input, Select, Textarea, Badge, Card, CardHeader, CardTitle, CardContent,
  Modal, Table, Thead, Tbody, Tr, Th, Td, Alert, Avatar, Loading, EmptyState
} from '@/components/ui';
import { formatCOP, formatDate, formatMonth, downloadCsv, buildCsv } from '@/lib/format';

type MemberData = {
  id: string; name: string; role: 'admin' | 'member'; start_month: string | null;
  allocated_months: number; payments_received: number; received_cop: number;
  approved_cop: number; pending_payments: number; rejected_payments: number; reversed_payments: number;
};

type PaymentData = {
  id: string; payer_id: string; payer_name: string; amount_cop: number; paid_on: string;
  reference: string | null; status: string; submitted_at: string; reviewed_by: string | null;
  reviewer_name: string | null; reviewed_at: string | null; rejection_reason: string | null;
  unassigned_cop: number; receipt_path: string | null;
  allocations: { beneficiaryId: string; months: number }[];
};

type CoverageData = { member_id: string; period: string; payment_id: string };

type AdminDashboardData = {
  settings: { monthly_price_cop: number | null; currency: string; timezone: string; period_mode: string; period_anchor_date: string | null };
  members: MemberData[];
  payments: PaymentData[];
  pending_receipts: number;
  coverage: CoverageData[];
};

export default function AdminDashboard() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  const [settingsModal, setSettingsModal] = useState(false);
  const [settingsPrice, setSettingsPrice] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(false);

  const [memberModal, setMemberModal] = useState<{ member: MemberData } | null>(null);
  const [memberStartMonth, setMemberStartMonth] = useState('');
  const [memberLoading, setMemberLoading] = useState(false);

  const [approveModal, setApproveModal] = useState<{ payment: PaymentData } | null>(null);
  const [rejectModal, setRejectModal] = useState<{ payment: PaymentData } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  const [reverseModal, setReverseModal] = useState<{ payment: PaymentData } | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [reverseLoading, setReverseLoading] = useState(false);

  const [filters, setFilters] = useState({
    status: '', payer: '', from: '', to: '', search: '',
  });
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'submitted_at', dir: 'desc' });

  async function fetchData() {
    try {
      const res = await fetch('/api/admin/dashboard', { cache: 'no-store' });
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

  async function handleSettingsSubmit(e: FormEvent) {
    e.preventDefault();
    setSettingsLoading(true);
    const fd = new FormData();
    fd.append('monthlyPrice', settingsPrice);
    try {
      const res = await fetch('/api/admin/settings', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(await res.text());
      setSettingsModal(false);
      showToast('Precio actualizado');
      fetchData();
    } catch (e) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setSettingsLoading(false); }
  }

  async function handleMemberStartMonth(e: FormEvent) {
    e.preventDefault();
    if (!memberModal) return;
    setMemberLoading(true);
    const fd = new FormData();
    fd.append('memberId', memberModal.member.id);
    fd.append('startMonth', memberStartMonth);
    try {
      const res = await fetch('/api/admin/member-start-month', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(await res.text());
      setMemberModal(null);
      showToast('Fecha inicial actualizada');
      fetchData();
    } catch (e) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setMemberLoading(false); }
  }

  async function handleApprove() {
    if (!approveModal) return;
    setApproveModal({ ...approveModal, payment: { ...approveModal.payment, status: 'APROBADO' } });
    try {
      const res = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: approveModal.payment.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      showToast('Pago aprobado');
      fetchData();
    } catch (e) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setApproveModal(null); }
  }

  async function handleReject(e: FormEvent) {
    e.preventDefault();
    if (!rejectModal) return;
    setRejectLoading(true);
    const fd = new FormData();
    fd.append('paymentId', rejectModal.payment.id);
    fd.append('reason', rejectReason);
    try {
      const res = await fetch('/api/admin/reject', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(await res.text());
      setRejectModal(null);
      setRejectReason('');
      showToast('Pago rechazado');
      fetchData();
    } catch (e) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setRejectLoading(false); }
  }

  async function handleReverse(e: FormEvent) {
    e.preventDefault();
    if (!reverseModal) return;
    setReverseLoading(true);
    const fd = new FormData();
    fd.append('paymentId', reverseModal.payment.id);
    fd.append('reason', reverseReason);
    try {
      const res = await fetch('/api/admin/reverse', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(await res.text());
      setReverseModal(null);
      setReverseReason('');
      showToast('Pago revertido');
      fetchData();
    } catch (e) { alert(e instanceof Error ? e.message : 'Error'); }
    finally { setReverseLoading(false); }
  }

  function exportCsv() {
    if (!data) return;
    const rows = data.payments.map(p => ({
      'ID': p.id.slice(0, 8),
      'Fecha envío': formatDate(p.submitted_at.split('T')[0]),
      'Pagador': p.payer_name,
      'Fecha pago': formatDate(p.paid_on),
      'Importe': formatCOP(p.amount_cop),
      'Referencia': p.reference || '',
      'Estado': p.status,
      'Revisado por': p.reviewer_name || '',
      'Fecha revisión': p.reviewed_at ? formatDate(p.reviewed_at.split('T')[0]) : '',
      'Motivo rechazo': p.rejection_reason || '',
      'Sin asignar': formatCOP(p.unassigned_cop),
      'Asignaciones': p.allocations.map(a => `${a.beneficiaryId}:${a.months}m`).join('; '),
    }));
    downloadCsv('pagos-spotify.csv', rows, Object.keys(rows[0] || {}));
  }

  if (loading) return <Loading text="Cargando panel de administración..." />;
  if (error) return <Alert variant="error">{error}</Alert>;
  if (!data) return null;

  const settings = data.settings || {};
  const members = data.members || [];
  const payments = data.payments || [];
  const pending_receipts = data.pending_receipts || 0;
  const coverage = data.coverage || [];

  // Member status calculation
  const coveredByMember = new Map<string, Set<string>>();
  for (const c of coverage) {
    if (!coveredByMember.has(c.member_id)) coveredByMember.set(c.member_id, new Set());
    coveredByMember.get(c.member_id)!.add(c.period);
  }

  const today = new Date();
  const currentPeriod = (() => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit' }).formatToParts(today);
    const get = (t: string) => parts.find(x => x.type === t)!.value;
    return `${get('year')}-${get('month')}`;
  })();

  function getMemberStatus(m: MemberData) {
    if (!m.start_month) return { status: 'SIN_FECHA' as const, label: 'Sin fecha inicial', nextDue: currentPeriod };
    const covered = coveredByMember.get(m.id) || new Set();
    let p = m.start_month;
    while (covered.has(p)) p = addMonth(p, 1);
    if (p < currentPeriod) return { status: 'ATRASADO' as const, label: 'Atrasado', nextDue: p };
    if (p === currentPeriod) return { status: 'PENDIENTE' as const, label: 'Pendiente', nextDue: p };
    return { status: 'AL_DIA' as const, label: 'Al día', nextDue: p };
  }

  const statusVariant = (s: string) => s === 'AL_DIA' ? 'success' : s === 'PENDIENTE' ? 'warning' : s === 'ATRASADO' ? 'danger' : 'neutral';
  const paymentStatusVariant = (s: string) => s === 'APROBADO' ? 'success' : s === 'RECHAZADO' ? 'danger' : s === 'REVERTIDO' ? 'neutral' : 'warning';

  // Filter & sort payments
  let filtered = [...payments];
  if (filters.status) filtered = filtered.filter(p => p.status === filters.status);
  if (filters.payer) filtered = filtered.filter(p => p.payer_id === filters.payer);
  if (filters.from) filtered = filtered.filter(p => p.paid_on >= filters.from);
  if (filters.to) filtered = filtered.filter(p => p.paid_on <= filters.to);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(p =>
      p.payer_name.toLowerCase().includes(q) ||
      p.reference?.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    );
  }
  filtered.sort((a, b) => {
    const av = (a as any)[sort.key], bv = (b as any)[sort.key];
    return sort.dir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });

  return (
    <div className="space-y-6">
      {toast && <div className="toast toast-success" role="alert"><div className="flex items-center gap-3"><span className="flex-1">{toast.message}</span><button className="btn btn-ghost p-1" onClick={() => setToast(null)}>✕</button></div></div>}

      {/* Header & Summary */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white/95 tracking-tight">Panel de David</h1>
          <p className="text-white/50 font-light tracking-wide mt-1">Control total de pagos y coberturas</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => { setSettingsPrice(String(settings.monthly_price_cop || '')); setSettingsModal(true); }}>
            Configurar precio: {settings.monthly_price_cop ? formatCOP(settings.monthly_price_cop) : 'No definido'}
          </Button>
          <Button variant="secondary" onClick={exportCsv}>Exportar CSV</Button>
        </div>
      </div>

      {/* Resumen general */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card><CardContent className="pt-2 pb-4 px-6"><p className="text-sm text-white/50 font-light tracking-wide">Total recaudado (aprobado)</p><p className="text-3xl font-bold text-white/95">{formatCOP(members.reduce((s, m) => s + m.approved_cop, 0))}</p></CardContent></Card>
        <Card><CardContent className="pt-2 pb-4 px-6"><p className="text-sm text-white/50 font-light tracking-wide">Comprobantes pendientes</p><p className="text-3xl font-bold text-warning">{pending_receipts}</p></CardContent></Card>
        <Card><CardContent className="pt-2 pb-4 px-6"><p className="text-sm text-white/50 font-light tracking-wide">Integrantes</p><p className="text-3xl font-bold text-white/95">{members.length}</p></CardContent></Card>
        <Card><CardContent className="pt-2 pb-4 px-6"><p className="text-sm text-white/50 font-light tracking-wide">Pagos este mes</p><p className="text-3xl font-bold text-white/95">{payments.filter(p => p.paid_on.startsWith(currentPeriod)).length}</p></CardContent></Card>
        <Card><CardContent className="pt-2 pb-4 px-6"><p className="text-sm text-white/50 font-light tracking-wide">Coberturas activas</p><p className="text-3xl font-bold text-white/95">{coverage.length}</p></CardContent></Card>
      </div>

      {/* Estado de integrantes */}
      <Card>
        <CardHeader><CardTitle className="text-white/95">Estado de los 6 integrantes</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <Table>
            <Thead><Tr><Th>Integrante</Th><Th>Rol</Th><Th>Desde</Th><Th>Meses asignados</Th><Th>Pagos recibidos</Th><Th>Recaudado</Th><Th>Aprobado</Th><Th>Estado</Th><Th>Próx. vencimiento</Th><Th>Acciones</Th></Tr></Thead>
            <Tbody>
              {members.map(m => {
                const st = getMemberStatus(m);
                return (
                  <Tr key={m.id}>
                    <Td className="flex items-center gap-2"><Avatar name={m.name} className="w-8 h-8" />{m.name}</Td>
                    <Td><Badge variant={m.role === 'admin' ? 'success' : 'neutral'}>{m.role === 'admin' ? 'Admin' : 'Miembro'}</Badge></Td>
                    <Td>{m.start_month ? formatMonth(m.start_month) : <span className="text-danger">Sin fecha</span>}</Td>
                    <Td>{m.allocated_months}</Td>
                    <Td>{m.payments_received}</Td>
                    <Td>{formatCOP(m.received_cop)}</Td>
                    <Td>{formatCOP(m.approved_cop)}</Td>
                    <Td><Badge variant={statusVariant(st.status)}>{st.label}</Badge></Td>
                    <Td>{formatMonth(st.nextDue)}</Td>
                    <Td>
                      {!m.start_month && (
                        <Button size="sm" variant="secondary" onClick={() => { setMemberModal({ member: m }); setMemberStartMonth(''); }}>Definir fecha</Button>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-0">
          <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <Select label="Estado" value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="min-w-[160px]">
              <option value="">Todos</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="APROBADO">Aprobado</option>
              <option value="RECHAZADO">Rechazado</option>
              <option value="REVERTIDO">Revertido</option>
            </Select>
            <Select label="Pagador" value={filters.payer} onChange={e => setFilters({...filters, payer: e.target.value})} className="min-w-[160px]">
              <option value="">Todos</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
            <Input label="Desde" type="date" value={filters.from} onChange={e => setFilters({...filters, from: e.target.value})} />
            <Input label="Hasta" type="date" value={filters.to} onChange={e => setFilters({...filters, to: e.target.value})} />
            <Input label="Buscar" type="search" placeholder="Referencia, ID, nombre..." value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} />
            <div className="flex items-end"><Button variant="secondary" onClick={() => setFilters({ status: '', payer: '', from: '', to: '', search: '' })}>Limpiar</Button></div>
          </div>
        </CardContent>
      </Card>

      {/* Pagos */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-white/95">Pagos ({filtered.length} de {payments.length})</CardTitle>
          <div className="flex gap-2">
            <Select value={sort.key} onChange={e => setSort({...sort, key: e.target.value})} className="w-auto">
              <option value="submitted_at">Enviado</option>
              <option value="paid_on">Fecha pago</option>
              <option value="amount_cop">Importe</option>
              <option value="status">Estado</option>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => setSort({...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc'})}>
              {sort.dir === 'asc' ? '↑' : '↓'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {filtered.length === 0 ? (
            <EmptyState title="Sin pagos" description="Ajusta los filtros o no hay pagos registrados." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th onClick={() => setSort({key: 'submitted_at', dir: sort.key==='submitted_at' && sort.dir==='asc'?'desc':'asc'})} style={{cursor:'pointer'}} className="text-white/50 font-medium">Enviado {sort.key==='submitted_at' && (sort.dir==='asc'?'↑':'↓')}</Th>
                  <Th className="text-white/50 font-medium">Pagador</Th>
                  <Th onClick={() => setSort({key: 'paid_on', dir: sort.key==='paid_on' && sort.dir==='asc'?'desc':'asc'})} style={{cursor:'pointer'}} className="text-white/50 font-medium">Fecha pago {sort.key==='paid_on' && (sort.dir==='asc'?'↑':'↓')}</Th>
                  <Th onClick={() => setSort({key: 'amount_cop', dir: sort.key==='amount_cop' && sort.dir==='asc'?'desc':'asc'})} style={{cursor:'pointer'}} className="text-white/50 font-medium">Importe {sort.key==='amount_cop' && (sort.dir==='asc'?'↑':'↓')}</Th>
                  <Th className="text-white/50 font-medium">Referencia</Th>
                  <Th onClick={() => setSort({key: 'status', dir: sort.key==='status' && sort.dir==='asc'?'desc':'asc'})} style={{cursor:'pointer'}} className="text-white/50 font-medium">Estado {sort.key==='status' && (sort.dir==='asc'?'↑':'↓')}</Th>
                  <Th className="text-white/50 font-medium">Revisado por</Th>
                  <Th className="text-white/50 font-medium">Sin asignar</Th>
                  <Th className="text-white/50 font-medium">Asignaciones</Th>
                  <Th className="text-white/50 font-medium">Comprobante</Th>
                  <Th className="text-white/50 font-medium">Acciones</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filtered.map(p => (
                  <Tr key={p.id}>
                    <Td className="text-white/85 font-light">{formatDate(p.submitted_at.split('T')[0])} {formatDate(p.submitted_at.split('T')[1]?.split('.')[0] || '')}</Td>
                    <Td className="text-white/85 font-light">{p.payer_name}</Td>
                    <Td className="text-white/85 font-light">{formatDate(p.paid_on)}</Td>
                    <Td className="text-white/85 font-light">{formatCOP(p.amount_cop)}</Td>
                    <Td className="text-white/70 font-light">{p.reference || '—'}</Td>
                    <Td><Badge variant={paymentStatusVariant(p.status)}>{p.status}</Badge></Td>
                    <Td className="text-white/70 font-light">{p.reviewer_name || '—'}</Td>
                    <Td className="text-white/70 font-light">{p.unassigned_cop > 0 ? formatCOP(p.unassigned_cop) : '—'}</Td>
                    <Td>
                      {(p.allocations || []).map((a, idx) => (
                        <Badge key={`${a.beneficiaryId}-${a.months}-${idx}`} variant="neutral" className="mr-1 mb-1">{a.beneficiaryId}: {a.months}m</Badge>
                      ))}
                    </Td>
                    <Td>
                      {p.receipt_path ? (
                        <Button variant="ghost" size="sm" onClick={() => window.open(`/api/receipts/${p.receipt_path}`, '_blank')}>Ver</Button>
                      ) : (
                        <span className="text-white/40 text-sm font-light">Sin adjuntar</span>
                      )}
                    </Td>
                    <Td className="flex gap-1">
                      {p.status === 'PENDIENTE' && (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => setApproveModal({ payment: p })}>Aprobar</Button>
                          <Button size="sm" variant="danger" onClick={() => { setRejectModal({ payment: p }); setRejectReason(''); }}>Rechazar</Button>
                        </>
                      )}
                      {p.status === 'APROBADO' && (
                        <Button size="sm" variant="danger" onClick={() => { setReverseModal({ payment: p }); setReverseReason(''); }}>Revertir</Button>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Cobertura completa */}
      <Card>
        <CardHeader><CardTitle className="text-white/95">Cobertura completa ({coverage.length} periodos activos)</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {coverage.length === 0 ? (
            <EmptyState title="Sin coberturas activas" />
          ) : (
            <Table>
              <Thead><Tr><Th>Integrante</Th><Th>Mes</Th><Th>Pago origen</Th></Tr></Thead>
              <Tbody>
                {coverage.sort((a, b) => a.member_id.localeCompare(b.member_id) || a.period.localeCompare(b.period)).map(c => {
                  const mem = members.find(m => m.id === c.member_id);
                  return (
                    <Tr key={`${c.member_id}-${c.period}`}>
                      <Td>{mem?.name || c.member_id}</Td>
                      <Td>{formatMonth(c.period)}</Td>
                      <Td>{c.payment_id.slice(0, 8)}…</Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <Modal open={settingsModal} onClose={() => setSettingsModal(false)} title="Configurar precio mensual">
        <form onSubmit={handleSettingsSubmit} className="space-y-4">
          <Input label="Precio mensual (COP)" type="number" min="1" step="1" value={settingsPrice} onChange={e => setSettingsPrice(e.target.value)} required />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setSettingsModal(false)}>Cancelar</Button>
            <Button type="submit" loading={settingsLoading}>Guardar</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!memberModal} onClose={() => setMemberModal(null)} title={`Fecha inicial: ${memberModal?.member.name}`}>
        <form onSubmit={handleMemberStartMonth} className="space-y-4">
          <Input label="Mes inicial (YYYY-MM)" type="month" value={memberStartMonth} onChange={e => setMemberStartMonth(e.target.value)} required />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setMemberModal(null)}>Cancelar</Button>
            <Button type="submit" loading={memberLoading}>Guardar</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!approveModal} onClose={() => setApproveModal(null)} title="Confirmar aprobación">
        <p>¿Aprobar el pago de <strong>{approveModal?.payment.payer_name}</strong> por <strong>{formatCOP(approveModal?.payment.amount_cop)}</strong>?</p>
        <p className="text-sm text-muted mt-2">Esto generará coberturas para los beneficiarios según las asignaciones.</p>
        <div className="modal-footer">
          <Button variant="secondary" onClick={() => setApproveModal(null)}>Cancelar</Button>
          <Button variant="primary" onClick={handleApprove}>Sí, aprobar</Button>
        </div>
      </Modal>

      <Modal open={!!rejectModal} onClose={() => { setRejectModal(null); setRejectReason(''); }} title="Rechazar pago">
        <form onSubmit={handleReject} className="space-y-4">
          <Textarea label="Motivo del rechazo" value={rejectReason} onChange={e => setRejectReason(e.target.value)} required rows={3} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setRejectModal(null); setRejectReason(''); }}>Cancelar</Button>
            <Button type="submit" variant="danger" loading={rejectLoading}>Rechazar</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!reverseModal} onClose={() => { setReverseModal(null); setReverseReason(''); }} title="Revertir pago aprobado">
        <form onSubmit={handleReverse} className="space-y-4">
          <Alert variant="warning" className="mb-2">Esta acción revocará las coberturas generadas por este pago y marcará el pago como REVERTIDO. El historial se conserva.</Alert>
          <Textarea label="Motivo de la reversión" value={reverseReason} onChange={e => setReverseReason(e.target.value)} required rows={3} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setReverseModal(null); setReverseReason(''); }}>Cancelar</Button>
            <Button type="submit" variant="danger" loading={reverseLoading}>Revertir</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function addMonth(p: string, n: number) {
  const [y, m] = p.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}