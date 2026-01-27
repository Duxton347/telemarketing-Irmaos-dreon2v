
-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABELA DE PERFIS
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username_display text NOT NULL,
  username_slug text UNIQUE NOT NULL,
  role text CHECK (role IN ('ADMIN', 'SUPERVISOR', 'OPERATOR')) DEFAULT 'OPERATOR',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. TABELA DE CLIENTES
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  phone text UNIQUE NOT NULL,
  address text,
  acceptance text CHECK (acceptance IN ('low', 'medium', 'high')) DEFAULT 'medium',
  satisfaction text CHECK (satisfaction IN ('low', 'medium', 'high')) DEFAULT 'medium',
  items text[] DEFAULT '{}',
  invalid boolean DEFAULT false,
  last_interaction timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. TABELA DE TAREFAS
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  type text NOT NULL,
  deadline timestamptz,
  assigned_to uuid REFERENCES public.profiles(id),
  status text CHECK (status IN ('pending', 'completed', 'skipped')) DEFAULT 'pending',
  skip_reason text,
  created_at timestamptz DEFAULT now()
);

-- 5. TABELA DE CHAMADAS (LOGS CRÍTICOS)
CREATE TABLE IF NOT EXISTS public.call_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id uuid REFERENCES public.tasks(id),
  operator_id uuid REFERENCES public.profiles(id),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  call_type text NOT NULL,
  start_time timestamptz DEFAULT now(),
  end_time timestamptz,
  duration int, 
  report_time int, 
  responses jsonb DEFAULT '{}', 
  protocol_id text,
  created_at timestamptz DEFAULT now()
);

-- 6. TABELA DE PROTOCOLOS
CREATE TABLE IF NOT EXISTS public.protocols (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  protocol_number text UNIQUE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  opened_by_id uuid REFERENCES public.profiles(id),
  owner_id uuid REFERENCES public.profiles(id),
  origin text,
  department_id text,
  category_id text,
  title text NOT NULL,
  description text,
  priority text CHECK (priority IN ('Baixa', 'Média', 'Alta')) DEFAULT 'Média',
  status text NOT NULL,
  opened_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  closed_at timestamptz,
  sla_due_at timestamptz,
  resolution_summary text,
  created_at timestamptz DEFAULT now()
);

-- 7. EVENTOS DE PROTOCOLO
CREATE TABLE IF NOT EXISTS public.protocol_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  protocol_id uuid REFERENCES public.protocols(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id),
  event_type text NOT NULL,
  old_value text,
  new_value text,
  note text,
  created_at timestamptz DEFAULT now()
);

-- 8. TRIGGER DE GERAÇÃO DE PROTOCOLO (CORRIGIDO)
CREATE OR REPLACE FUNCTION generate_protocol_number() 
RETURNS TRIGGER AS $$
DECLARE
  seq_val text;
BEGIN
  seq_val := to_char(now(), 'YYYYMMDD') || '-' || upper(substring(replace(uuid_generate_v4()::text, '-', ''), 1, 4));
  NEW.protocol_number := 'PRT-' || seq_val;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- CORREÇÃO: Remove o trigger se ele já existir antes de criar
DROP TRIGGER IF EXISTS tr_generate_protocol_number ON public.protocols;

CREATE TRIGGER tr_generate_protocol_number
BEFORE INSERT ON public.protocols
FOR EACH ROW
WHEN (NEW.protocol_number IS NULL)
EXECUTE FUNCTION generate_protocol_number();
