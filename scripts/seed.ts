#!/usr/bin/env tsx
// Sembrado de datos de prueba para desarrollo local.
// Requiere: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL en .env

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('❌ Faltan variables de entorno');
  process.exit(1);
}

const sb = createClient(url, key);
const PRICE = 20900; // Precio real aprox. Spotify Family COP

async function run() {
  console.log('🌱 Sembrando datos de prueba...');

  // 1. Settings
  const { error: setErr } = await sb.from('settings').upsert({ id: true, monthly_price_cop: PRICE });
  if (setErr) console.error('Settings:', setErr.message);
  else console.log(`✅ Precio mensual: ${PRICE.toLocaleString()} COP`);

  // 2. Members (ya existen por migración, actualizamos start_month)
  const startMonths: Record<string, string> = {
    David: '2025-01', Catalina: '2025-01', Camila: '2025-02',
    Estevan: '2025-03', Angélica: '2025-01', Mariana: '2025-04',
  };
  for (const [name, month] of Object.entries(startMonths)) {
    const { error } = await sb.from('members').update({ start_month: month }).eq('name', name);
    if (error) console.error(`   ${name}:`, error.message);
    else console.log(`✅ ${name}: inicio ${month}`);
  }

  // 3. Pagos de prueba (simulando un año de pagos)
  const { data: membersData } = await sb.from('members').select('id, name');
  const byName = Object.fromEntries(membersData?.map(m => [m.name, m.id]) || []);

  const testPayments = [
    { payer: 'David', amount: PRICE * 6, paidOn: '2025-01-05', reference: 'ENE-2025', status: 'APROBADO',
      allocations: ['David', 'Catalina', 'Camila', 'Estevan', 'Angélica', 'Mariana'].map(n => ({ beneficiary: n, months: 1 })) },
    { payer: 'David', amount: PRICE * 6, paidOn: '2025-02-03', reference: 'FEB-2025', status: 'APROBADO',
      allocations: ['David', 'Catalina', 'Camila', 'Estevan', 'Angélica', 'Mariana'].map(n => ({ beneficiary: n, months: 1 })) },
    { payer: 'David', amount: PRICE * 6, paidOn: '2025-03-02', reference: 'MAR-2025', status: 'APROBADO',
      allocations: ['David', 'Catalina', 'Camila', 'Estevan', 'Angélica', 'Mariana'].map(n => ({ beneficiary: n, months: 1 })) },
    { payer: 'David', amount: PRICE * 6, paidOn: '2025-04-01', reference: 'ABR-2025', status: 'APROBADO',
      allocations: ['David', 'Catalina', 'Camila', 'Estevan', 'Angélica', 'Mariana'].map(n => ({ beneficiary: n, months: 1 })) },
    { payer: 'David', amount: PRICE * 6, paidOn: '2025-05-05', reference: 'MAY-2025', status: 'APROBADO',
      allocations: ['David', 'Catalina', 'Camila', 'Estevan', 'Angélica', 'Mariana'].map(n => ({ beneficiary: n, months: 1 })) },
    { payer: 'David', amount: PRICE * 6, paidOn: '2025-06-02', reference: 'JUN-2025', status: 'APROBADO',
      allocations: ['David', 'Catalina', 'Camila', 'Estevan', 'Angélica', 'Mariana'].map(n => ({ beneficiary: n, months: 1 })) },
    // Pagos parciales / variados
    { payer: 'Catalina', amount: PRICE, paidOn: '2025-07-10', reference: 'CAT-JUL', status: 'APROBADO',
      allocations: [{ beneficiary: 'Catalina', months: 1 }] },
    { payer: 'Camila', amount: PRICE * 2, paidOn: '2025-08-15', reference: 'CAM-AGO', status: 'APROBADO',
      allocations: [{ beneficiary: 'Camila', months: 2 }] },
    { payer: 'Estevan', amount: PRICE * 3, paidOn: '2025-09-01', reference: 'EST-SEP', status: 'APROBADO',
      allocations: [{ beneficiary: 'Estevan', months: 1 }, { beneficiary: 'Angélica', months: 2 }] },
  ];

  for (const tp of testPayments) {
    const payerId = byName[tp.payer];
    if (!payerId) continue;

    const { data: pay, error: payErr } = await sb.from('payments').insert({
      payer_id: payerId, amount_cop: tp.amount, paid_on: tp.paidOn,
      reference: tp.reference, status: tp.status,
      reviewed_by: byName.David, reviewed_at: new Date().toISOString(),
    }).select('id').single();
    if (payErr) { console.error(`   ${tp.reference}:`, payErr.message); continue; }

    await sb.from('payment_allocations').insert(
      tp.allocations.map(a => ({ payment_id: pay.id, beneficiary_id: byName[a.beneficiary], months: a.months }))
    );

    // Simular approve_payment para generar coberturas
    await sb.rpc('approve_payment', { p_payment_id: pay.id });
    console.log(`✅ ${tp.reference} (${tp.payer}) · ${tp.allocations.length} asignaciones`);
  }

  // Un pago pendiente (sin aprobar)
  await sb.from('payments').insert({
    payer_id: byName.Mariana, amount_cop: PRICE, paid_on: '2025-10-01',
    reference: 'MAR-OCT-PEND', status: 'PENDIENTE',
  });
  await sb.from('payment_allocations').insert({ payment_id: (await sb.from('payments').select('id').eq('reference', 'MAR-OCT-PEND').single()).data?.id, beneficiary_id: byName.Mariana, months: 1 });

  console.log('\n✅ Seed completado. Datos de prueba listos.');
}

run().catch(e => { console.error('❌ Error:', e); process.exit(1); });