#!/usr/bin/env tsx
// Setup completo: crea proyecto Supabase, ejecuta migraciones, sembrado inicial.
// Requiere: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL en .env

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = join(fileURLToPath(import.meta.url), '..');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const sb = createClient(url, key);

async function run() {
  console.log('🚀 Iniciando setup de Spotify Compartido...');

  // 1. Ejecutar migraciones en orden
  const migrationsDir = join(__dirname, '..', 'supabase', 'migrations');
  const files = ['0001_init.sql', '0002_receipts_and_views.sql'];

  for (const file of files) {
    console.log(`\n📦 Ejecutando ${file}...`);
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    const { error } = await sb.rpc('exec_sql', { sql });
    if (error) {
      // fallback: split by statements and execute
      const statements = sql.split(';').map(s => s.trim()).filter(s => s);
      for (const stmt of statements) {
        if (!stmt) continue;
        const { error: e } = await sb.rpc('exec_sql', { sql: stmt });
        if (e && !e.message.includes('already exists') && !e.message.includes('duplicate')) {
          console.error(`   ⚠️  ${e.message}`);
        }
      }
    }
    console.log(`   ✅ ${file} aplicada`);
  }

  // 2. Verificar miembros sembrados
  console.log('\n👥 Verificando integrantes...');
  const { data: members, error: memErr } = await sb.from('members').select('id, name, role, start_month').order('name');
  if (memErr) console.error('   ⚠️', memErr.message);
  else {
    console.log(`   Encontrados ${members?.length} integrantes:`);
    members?.forEach(m => console.log(`   - ${m.name} (${m.role})${m.start_month ? ` · desde ${m.start_month}` : ' · SIN FECHA INICIAL'}`));
  }

  // 3. Verificar settings
  console.log('\n⚙️  Verificando configuración...');
  const { data: settings, error: setErr } = await sb.from('settings').select('*').eq('id', true).single();
  if (setErr) console.error('   ⚠️', setErr.message);
  else console.log(`   Precio mensual: ${settings?.monthly_price_cop ? '$' + settings.monthly_price_cop.toLocaleString() : 'NO DEFINIDO'}`);

  // 4. Bucket receipts
  console.log('\n🪣 Verificando bucket receipts...');
  const { data: buckets } = await sb.storage.listBuckets();
  const receipts = buckets?.find(b => b.id === 'receipts');
  if (receipts) console.log('   ✅ Bucket "receipts" existe');
  else console.log('   ⚠️  Bucket "receipts" no encontrado (se crea en migración)');

  console.log('\n✅ Setup completado.');
  console.log('\n📋 Próximos pasos:');
  console.log('   1. Configura el precio mensual en /admin');
  console.log('   2. Define la fecha inicial de cobertura para cada miembro (botón "Definir fecha")');
  console.log('   3. Vincula la cuenta de David: actualiza auth_user_id en la tabla members');
  console.log('   4. Los miembros inician sesión en /auth/login');
  console.log('   5. Ejecuta: npm run dev');
}

run().catch(e => { console.error('❌ Error fatal:', e); process.exit(1); });