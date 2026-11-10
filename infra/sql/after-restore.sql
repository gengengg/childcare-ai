-- 데이터 이전 직후 실행: public 스키마 덤프에 포함되지 않는 것들을 다시 만든다.
-- (auth.users 위 트리거, Storage 버킷과 정책은 auth/storage 스키마에 있어서 따로 챙겨야 함)
-- 여러 번 실행해도 안전하다.

-- 1) 새 회원 → profiles 자동 생성 트리거
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) 활동지 파일 버킷 (private, signed URL 로만 다운로드)
insert into storage.buckets (id, name, public)
values ('worksheets', 'worksheets', false)
on conflict (id) do nothing;

-- 3) Storage 정책: 로그인 유저는 조회, 쓰기는 관리자만 (supabase/migrations/010_worksheets.sql 과 동일)
drop policy if exists "worksheets bucket read" on storage.objects;
create policy "worksheets bucket read" on storage.objects
  for select
  to authenticated
  using (bucket_id = 'worksheets');

drop policy if exists "worksheets bucket admin insert" on storage.objects;
create policy "worksheets bucket admin insert" on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'worksheets' and public.is_admin());

drop policy if exists "worksheets bucket admin update" on storage.objects;
create policy "worksheets bucket admin update" on storage.objects
  for update
  to authenticated
  using (bucket_id = 'worksheets' and public.is_admin())
  with check (bucket_id = 'worksheets' and public.is_admin());

drop policy if exists "worksheets bucket admin delete" on storage.objects;
create policy "worksheets bucket admin delete" on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'worksheets' and public.is_admin());
