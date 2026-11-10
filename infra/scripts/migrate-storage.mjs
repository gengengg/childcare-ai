// 기존 Supabase Storage → 새 서버 Storage 파일 복사 (활동지 PDF 등)
//
// 기존 서버에서는 읽기만 한다. 같은 경로의 파일이 새 서버에 있으면 덮어쓴다(여러 번 실행해도 안전).
// migrate-storage.sh 가 Docker(node)로 실행한다. 직접 실행할 일은 없다.
//
// 필요한 환경변수:
//   OLD_URL, OLD_SECRET  기존 Supabase 주소 + secret(또는 service_role) 키
//   NEW_URL, NEW_SECRET  새 서버 주소 + SUPABASE_SECRET_KEY(또는 SERVICE_ROLE_KEY)

import { createRequire } from 'node:module';

// @supabase/supabase-js 는 web/node_modules 에 이미 설치돼 있다
const require = createRequire('/app/web/package.json');
const { createClient } = require('@supabase/supabase-js');

const need = (k) => {
  const v = process.env[k];
  if (!v) {
    console.error(`환경변수 ${k} 가 필요해요`);
    process.exit(1);
  }
  return v;
};

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const oldSb = createClient(need('OLD_URL'), need('OLD_SECRET'), opts);
const newSb = createClient(need('NEW_URL'), need('NEW_SECRET'), opts);

async function listAll(bucket, prefix = '') {
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await oldSb.storage.from(bucket).list(prefix, { limit: 100, offset });
    if (error) throw error;
    for (const e of data) {
      const path = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.id === null) out.push(...(await listAll(bucket, path))); // 폴더
      else out.push({ path, mimetype: e.metadata?.mimetype, size: e.metadata?.size });
    }
    if (data.length < 100) return out;
  }
}

const { data: buckets, error: bErr } = await oldSb.storage.listBuckets();
if (bErr) throw bErr;

let copied = 0;
let failed = 0;
for (const b of buckets) {
  const { error: cErr } = await newSb.storage.createBucket(b.id, {
    public: b.public,
    fileSizeLimit: b.file_size_limit ?? undefined,
    allowedMimeTypes: b.allowed_mime_types ?? undefined,
  });
  if (cErr && !/already exists|Duplicate/i.test(cErr.message)) throw cErr;

  const files = await listAll(b.id);
  console.log(`버킷 ${b.id}: 파일 ${files.length}개`);
  for (const f of files) {
    const { data: blob, error: dErr } = await oldSb.storage.from(b.id).download(f.path);
    if (dErr) {
      console.error(`  ✗ ${f.path}: 내려받기 실패 (${dErr.message})`);
      failed++;
      continue;
    }
    const { error: uErr } = await newSb.storage
      .from(b.id)
      .upload(f.path, blob, { upsert: true, contentType: f.mimetype || blob.type || undefined });
    if (uErr) {
      console.error(`  ✗ ${f.path}: 올리기 실패 (${uErr.message})`);
      failed++;
    } else {
      console.log(`  ✓ ${f.path} (${Math.round((f.size ?? blob.size) / 1024)}KB)`);
      copied++;
    }
  }
}
console.log(`\n완료: ${copied}개 복사, ${failed}개 실패`);
process.exit(failed ? 1 : 0);
