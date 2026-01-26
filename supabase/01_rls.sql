
-- HABILITAR RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol_events ENABLE ROW LEVEL SECURITY;

-- HELPERS
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN');
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_supervisor() RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPERVISOR'));
$$ LANGUAGE sql SECURITY DEFINER;

-- POLÍTICAS: PROFILES
CREATE POLICY "Profiles são visíveis por todos autenticados" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
-- Permite inserção de perfil para o próprio usuário (necessário no signUp)
CREATE POLICY "Usuários criam seu próprio perfil" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Somente Admins atualizam perfis" ON public.profiles FOR UPDATE USING (is_admin());

-- POLÍTICAS: CLIENTES
CREATE POLICY "Clientes visíveis por todos" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Qualquer operador insere cliente" ON public.clients FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Operadores e Admins atualizam clientes" ON public.clients FOR UPDATE USING (auth.role() = 'authenticated');

-- POLÍTICAS: CHAMADAS
CREATE POLICY "Visualização de chamadas (Admin tudo, Operator próprio)" ON public.call_logs FOR SELECT USING (is_supervisor() OR operator_id = auth.uid());
CREATE POLICY "Operador insere própria chamada" ON public.call_logs FOR INSERT WITH CHECK (operator_id = auth.uid());

-- POLÍTICAS: PROTOCOLOS
CREATE POLICY "Visualização de protocolos" ON public.protocols FOR SELECT USING (is_supervisor() OR opened_by_id = auth.uid() OR owner_id = auth.uid());
CREATE POLICY "Operador cria protocolo" ON public.protocols FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Update de protocolo" ON public.protocols FOR UPDATE USING (is_supervisor() OR owner_id = auth.uid());
