-- Criação da tabela de Usuários
create table public.users (
  uid uuid not null primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'customer'
);

-- Habilitando permissões Row Level Security (RLS) para 'users'
alter table public.users enable row level security;
create policy "Usuários podem ver o próprio perfil" on public.users for select using (auth.uid() = uid);
create policy "Admins podem ver todos" on public.users for select using (
  exists (select 1 from public.users where uid = auth.uid() and role = 'admin')
);
create policy "Usuários podem inserir o próprio perfil" on public.users for insert with check (auth.uid() = uid);

-- Criação da tabela de Bots
create table public.bots (
  id uuid not null default extensions.uuid_generate_v4() primary key,
  name text not null,
  description text not null,
  price numeric not null,
  features text[] default '{}',
  "imageUrl" text
);

-- Habilitando RLS para 'bots'
alter table public.bots enable row level security;
create policy "Qualquer um pode ver bots" on public.bots for select using (true);
create policy "Somente admins podem inserir" on public.bots for insert with check (
  exists (select 1 from public.users where uid = auth.uid() and role = 'admin')
);
create policy "Somente admins podem deletar" on public.bots for delete using (
  exists (select 1 from public.users where uid = auth.uid() and role = 'admin')
);

-- Criação da tabela de Licenças
create table public.licenses (
  id uuid not null default extensions.uuid_generate_v4() primary key,
  "userId" uuid not null references public.users(uid) on delete cascade,
  "botId" uuid not null references public.bots(id) on delete cascade,
  "botName" text not null,
  "licenseKey" text not null,
  "expiresAt" timestamp with time zone not null,
  status text not null default 'active'
);

-- Habilitando RLS para 'licenses'
alter table public.licenses enable row level security;
create policy "Usuários podem ver as próprias licenças" on public.licenses for select using (auth.uid() = "userId");
create policy "Admins podem ver todas as licenças" on public.licenses for select using (
  exists (select 1 from public.users where uid = auth.uid() and role = 'admin')
);
create policy "Usuários autenticados podem inserir licenças (compras)" on public.licenses for insert with check (auth.uid() = "userId");
create policy "Usuários autenticados podem atualizar a própria licença (renovação)" on public.licenses for update using (auth.uid() = "userId");

-- Função Trigger para sincronizar novos usuários logados com a tabela users automaticamente (Opcional, mas útil)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (uid, email, role)
  values (new.id, new.email, case when new.email = 'punisherjogador@gmail.com' then 'admin' else 'customer' end)
  on conflict (uid) do nothing;
  return new;
end;
$$;

-- Disparador no Auth
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
