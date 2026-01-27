
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

-- 3. LIMPEZA E CRIAÇÃO DE POLÍTICAS
DO $$ 
BEGIN
    -- TAREFAS (ATUALIZADO COM DELETE)
    DROP POLICY IF EXISTS "Visualização de tarefas" ON public.tasks;
    DROP POLICY IF EXISTS "Admins criam tarefas" ON public.tasks;
    DROP POLICY IF EXISTS "Operadores atualizam status de suas tarefas" ON public.tasks;
    DROP POLICY IF EXISTS "Admins deletam tarefas da fila" ON public.tasks;
    
    CREATE POLICY "Visualização de tarefas" ON public.tasks FOR SELECT USING (is_supervisor() OR assigned_to = auth.uid());
    CREATE POLICY "Admins criam tarefas" ON public.tasks FOR INSERT WITH CHECK (is_supervisor());
    CREATE POLICY "Operadores atualizam status de suas tarefas" ON public.tasks FOR UPDATE 
    USING (assigned_to = auth.uid() OR is_supervisor())
    WITH CHECK (assigned_to = auth.uid() OR is_supervisor());
    
    -- ESTA É A REGRA QUE ESTAVA FALTANDO:
    CREATE POLICY "Admins deletam tarefas da fila" ON public.tasks FOR DELETE USING (is_supervisor());

    -- PROFILES
    DROP POLICY IF EXISTS "Profiles são visíveis por todos autenticados" ON public.profiles;
    DROP POLICY IF EXISTS "Usuários criam seu próprio perfil" ON public.profiles;
    DROP POLICY IF EXISTS "Somente Admins atualizam perfis" ON public.profiles;
    CREATE POLICY "Profiles são visíveis por todos autenticados" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
    CREATE POLICY "Usuários criam seu próprio perfil" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
    CREATE POLICY "Somente Admins atualizam perfis" ON public.profiles FOR UPDATE USING (is_admin());

    -- CLIENTES
    DROP POLICY IF EXISTS "Clientes visíveis por todos" ON public.clients;
    DROP POLICY IF EXISTS "Qualquer operador insere cliente" ON public.clients;
    DROP POLICY IF EXISTS "Operadores e Admins atualizam clientes" ON public.clients;
    CREATE POLICY "Clientes visíveis por todos" ON public.clients FOR SELECT USING (true);
    CREATE POLICY "Qualquer operador insere cliente" ON public.clients FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    CREATE POLICY "Operadores e Admins atualizam clientes" ON public.clients FOR UPDATE USING (auth.role() = 'authenticated');

    -- CHAMADAS
    DROP POLICY IF EXISTS "Visualização de chamadas (Admin tudo, Operator próprio)" ON public.call_logs;
    DROP POLICY IF EXISTS "Operador insere própria chamada" ON public.call_logs;
    CREATE POLICY "Visualização de chamadas (Admin tudo, Operator próprio)" ON public.call_logs FOR SELECT USING (is_supervisor() OR operator_id = auth.uid());
    CREATE POLICY "Operador insere própria chamada" ON public.call_logs FOR INSERT WITH CHECK (operator_id = auth.uid());

    -- PROTOCOLOS
    DROP POLICY IF EXISTS "Visualização de protocolos" ON public.protocols;
    DROP POLICY IF EXISTS "Operador cria protocolo" ON public.protocols;
    DROP POLICY IF EXISTS "Update de protocolo" ON public.protocols;
    CREATE POLICY "Visualização de protocolos" ON public.protocols FOR SELECT USING (is_supervisor() OR opened_by_id = auth.uid() OR owner_id = auth.uid());
    CREATE POLICY "Operador cria protocolo" ON public.protocols FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    CREATE POLICY "Update de protocolo" ON public.protocols FOR UPDATE USING (is_supervisor() OR owner_id = auth.uid());
END $$;
