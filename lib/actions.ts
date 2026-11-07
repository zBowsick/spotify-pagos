'use server';

import { getSupabaseServer } from './supabase-server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';

// ---------- Schemas ----------
const SubmitPaymentSchema = z.object({
  amount: z.coerce.number().int().positive(),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: z.string().max(64).optional().nullable(),
  allocations: z.array(z.object({
    beneficiaryId: z.string().uuid(),
    months: z.coerce.number().int().positive(),
  })).min(1),
});

const RejectSchema = z.object({
  paymentId: z.string().uuid(),
  reason: z.string().min(1).max(255),
});

const ReverseSchema = z.object({
  paymentId: z.string().uuid(),
  reason: z.string().min(1).max(255),
});

const UploadReceiptSchema = z.object({
  paymentId: z.string().uuid(),
});

const MemberStartMonthSchema = z.object({
  memberId: z.string().uuid(),
  startMonth: z.string().regex(/^\d{4}-\d{2}$/),
});

const SettingsSchema = z.object({
  monthlyPrice: z.coerce.number().int().positive(),
});

// ---------- Helpers ----------
async function getUserId() {
  const sb = await getSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('No autenticado');
  return user.id;
}

async function requireAdmin() {
  const sb = await getSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { data, error } = await sb.rpc('is_admin');
  if (error || !data) throw new Error('Solo el administrador puede hacer esto');
}

// ---------- Pagos ----------
export async function submitPayment(formData: FormData) {
  const sb = await getSupabaseServer();
  const userId = await getUserId();
  const { data: member } = await sb.from('members').select('id').eq('auth_user_id', userId).single();
  if (!member) throw new Error('No eres integrante');

  const parsed = SubmitPaymentSchema.safeParse({
    amount: formData.get('amount'),
    paidOn: formData.get('paidOn'),
    reference: formData.get('reference') || null,
    allocations: JSON.parse(formData.get('allocations') as string || '[]'),
  });
  if (!parsed.success) throw new Error(parsed.error.errors.map(e => e.message).join(', '));

  const { amount, paidOn, reference, allocations } = parsed.data;

  const { error } = await sb.from('payments').insert({
    payer_id: member.id,
    amount_cop: amount,
    paid_on: paidOn,
    reference: reference,
    allocations: allocations, // se guarda en payment_allocations por trigger? no, es separado
    status: 'PENDIENTE',
  });
  if (error) throw new Error(error.message);

  // Insert allocations
  const { data: payment } = await sb.from('payments')
    .select('id').eq('payer_id', member.id).order('submitted_at', { ascending: false }).limit(1).single();
  if (payment) {
    await sb.from('payment_allocations').insert(
      allocations.map(a => ({ payment_id: payment.id, beneficiary_id: a.beneficiaryId, months: a.months }))
    );
  }

  revalidatePath('/dashboard');
  revalidatePath('/admin');
  return { ok: true };
}

export async function approvePayment(paymentId: string) {
  await requireAdmin();
  const sb = await getSupabaseServer();
  const { error } = await sb.rpc('approve_payment', { p_payment_id: paymentId });
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard');
  revalidatePath('/admin');
  return { ok: true };
}

export async function rejectPayment(formData: FormData) {
  await requireAdmin();
  const parsed = RejectSchema.safeParse({
    paymentId: formData.get('paymentId'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) throw new Error(parsed.error.errors.map(e => e.message).join(', '));

  const sb = await getSupabaseServer();
  const { error } = await sb.rpc('reject_payment', { p_payment_id: parsed.data.paymentId, p_reason: parsed.data.reason });
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard');
  revalidatePath('/admin');
  return { ok: true };
}

export async function reversePayment(formData: FormData) {
  await requireAdmin();
  const parsed = ReverseSchema.safeParse({
    paymentId: formData.get('paymentId'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) throw new Error(parsed.error.errors.map(e => e.message).join(', '));

  const sb = await getSupabaseServer();
  const { error } = await sb.rpc('reverse_payment', { p_payment_id: parsed.data.paymentId, p_reason: parsed.data.reason });
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard');
  revalidatePath('/admin');
  return { ok: true };
}

// ---------- Comprobantes ----------
export async function uploadReceipt(formData: FormData) {
  const sb = await getSupabaseServer();
  const userId = await getUserId();
  const { data: member } = await sb.from('members').select('id').eq('auth_user_id', userId).single();
  if (!member) throw new Error('No eres integrante');

  const parsed = UploadReceiptSchema.safeParse({
    paymentId: formData.get('paymentId'),
  });
  if (!parsed.success) throw new Error(parsed.error.errors.map(e => e.message).join(', '));

  const file = formData.get('file') as File;
  if (!file) throw new Error('Archivo requerido');
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowed.includes(file.type)) throw new Error('Solo JPG, PNG, WebP o PDF (max 5MB)');
  if (file.size > 5 * 1024 * 1024) throw new Error('Archivo mayor a 5MB');

  const path = `${member.id}/${Date.now()}-${file.name}`;
  const { error: upErr } = await sb.storage.from('receipts').upload(path, file);
  if (upErr) throw new Error(upErr.message);

  const { error } = await sb.from('receipts').insert({
    payment_id: parsed.data.paymentId,
    member_id: member.id,
    storage_path: path,
    mime_type: file.type,
    size_bytes: file.size,
    original_name: file.name,
  });
  if (error) throw new Error(error.message);

  // Actualizar payment.receipt_path
  await sb.from('payments').update({ receipt_path: path }).eq('id', parsed.data.paymentId);

  revalidatePath('/dashboard');
  revalidatePath('/admin');
  return { ok: true, path };
}

export async function getReceiptUrl(storagePath: string) {
  const sb = await getSupabaseServer();
  const { data } = await sb.storage.from('receipts').createSignedUrl(storagePath, 60 * 60); // 1 hora
  return data?.signedUrl ?? null;
}

// ---------- Admin: miembros ----------
export async function setMemberStartMonth(formData: FormData) {
  await requireAdmin();
  const parsed = MemberStartMonthSchema.safeParse({
    memberId: formData.get('memberId'),
    startMonth: formData.get('startMonth'),
  });
  if (!parsed.success) throw new Error(parsed.error.errors.map(e => e.message).join(', '));

  const sb = await getSupabaseServer();
  const { error } = await sb.from('members').update({ start_month: parsed.data.startMonth })
    .eq('id', parsed.data.memberId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  return { ok: true };
}

export async function linkMemberAuth(memberId: string, authUserId: string) {
  await requireAdmin();
  const sb = await getSupabaseServer();
  const { error } = await sb.from('members').update({ auth_user_id: authUserId }).eq('id', memberId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  return { ok: true };
}

// ---------- Admin: settings ----------
export async function updateSettings(formData: FormData) {
  await requireAdmin();
  const parsed = SettingsSchema.safeParse({
    monthlyPrice: formData.get('monthlyPrice'),
  });
  if (!parsed.success) throw new Error(parsed.error.errors.map(e => e.message).join(', '));

  const sb = await getSupabaseServer();
  const { error } = await sb.from('settings').update({ monthly_price_cop: parsed.data.monthlyPrice }).eq('id', true);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
  return { ok: true };
}

// ---------- Consultas ----------
export async function getAdminDashboard() {
  await requireAdmin();
  const sb = await getSupabaseServer();
  const { data, error } = await sb.rpc('admin_dashboard');
  if (error) throw new Error(error.message);
  return data;
}

export async function getMemberDashboard() {
  const sb = await getSupabaseServer();
  const userId = await getUserId();
  const { data: member } = await sb.from('members').select('id').eq('auth_user_id', userId).single();
  if (!member) throw new Error('No eres integrante');
  const { data, error } = await sb.rpc('member_dashboard', { p_member_id: member.id });
  if (error) throw new Error(error.message);
  return data;
}

export async function getSettings() {
  const sb = await getSupabaseServer();
  const { data, error } = await sb.from('settings').select('*').eq('id', true).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getMembers() {
  const sb = await getSupabaseServer();
  const { data, error } = await sb.from('members').select('id, name, role, start_month, auth_user_id').order('name');
  if (error) throw new Error(error.message);
  return data;
}

export async function getCurrentMember() {
  const sb = await getSupabaseServer();
  const userId = await getUserId();
  const { data, error } = await sb.from('members').select('id, name, role, start_month').eq('auth_user_id', userId).single();
  if (error) return null;
  return data;
}