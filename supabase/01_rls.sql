
-- 1. HABILITAR RLS EM TODAS AS TABELAS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol_events ENABLE ROW LEVEL SECURITY;

-- 2. FUNÇÕES DE AUXÍLIO (HELPERS)
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN');
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_supervisor() RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPERVISOR'));
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION can_manage_tasks() RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPERVISOR'));
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. POLÍTICAS POR PAPEL

-- TAREFAS
DROP POLICY IF EXISTS "Visualização de tarefas" ON public.tasks;
CREATE POLICY "Visualização de tarefas" ON public.tasks FOR SELECT 
USING (is_supervisor() OR assigned_to = auth.uid());

DROP POLICY IF EXISTS "Gestão de tarefas" ON public.tasks;
CREATE POLICY "Gestão de tarefas" ON public.tasks FOR ALL 
USING (can_manage_tasks());

-- CLIENTES
DROP POLICY IF EXISTS "Clientes visíveis por todos autenticados" ON public.clients;
CREATE POLICY "Clientes visíveis por todos autenticados" ON public.clients FOR SELECT 
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Edição de clientes restrita" ON public.clients;
CREATE POLICY "Edição de clientes restrita" ON public.clients FOR UPDATE 
USING (is_supervisor() OR is_admin());

-- CHAMADAS (Logs)
DROP POLICY IF EXISTS "Visualização de chamadas" ON public.call_logs;
CREATE POLICY "Visualização de chamadas" ON public.call_logs FOR SELECT 
USING (is_supervisor() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ANALISTA_MARKETING'));

-- PROFILES
-- Permitir leitura para verificação de login (necessário para signIn)
DROP POLICY IF EXISTS "Perfis legíveis para login" ON public.profiles;
CREATE POLICY "Perfis legíveis para login" ON public.profiles FOR SELECT 
USING (true);

-- Permitir inserção inicial ou por Admin (necessário para createUser)
DROP POLICY IF EXISTS "Permitir criação de perfil" ON public.profiles;
CREATE POLICY "Permitir criação de perfil" ON public.profiles FOR INSERT 
WITH CHECK (true);

-- Apenas Admin atualiza ou deleta perfis
DROP POLICY IF EXISTS "Admins gerenciam perfis" ON public.profiles;
CREATE POLICY "Admins gerenciam perfis" ON public.profiles FOR UPDATE 
USING (is_admin());

DROP POLICY IF EXISTS "Admins deletam perfis" ON public.profiles;
CREATE POLICY "Admins deletam perfis" ON public.profiles FOR DELETE 
USING (is_admin());
