
-- MIGRATION: 03_PROSPECTS
-- OBJETIVO: Separar clientes de prospectos, preparar geolocalização e novos tipos de chamada.

-- 1. Criação de Categorias de Prospectos (Coluna 'Tip' do CSV original)
CREATE TABLE IF NOT EXISTS public.prospect_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Criação da Tabela de Prospectos
CREATE TABLE IF NOT EXISTS public.prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    category_id UUID REFERENCES public.prospect_categories(id),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    status TEXT DEFAULT 'novo' CHECK (status IN ('novo', 'qualificado', 'descartado', 'convertido')),
    score INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Contatos Detalhados de Prospectos
CREATE TABLE IF NOT EXISTS public.prospect_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
    whatsapp TEXT,
    email TEXT,
    phone_alt TEXT,
    contact_name TEXT,
    contact_role TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Vínculo Prospecto -> Cliente (Conversão)
CREATE TABLE IF NOT EXISTS public.prospect_client_links (
    prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    PRIMARY KEY (prospect_id, client_id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Atualização de Tabelas Existentes (Idempotente)
DO $$ 
BEGIN 
    -- Adicionar Geolocalização em Clientes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clients' AND column_name='latitude') THEN
        ALTER TABLE public.clients ADD COLUMN latitude DOUBLE PRECISION;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clients' AND column_name='longitude') THEN
        ALTER TABLE public.clients ADD COLUMN longitude DOUBLE PRECISION;
    END IF;

    -- Tornar client_id opcional em tasks e adicionar prospect_id
    ALTER TABLE public.tasks ALTER COLUMN client_id DROP NOT NULL;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name='prospect_id') THEN
        ALTER TABLE public.tasks ADD COLUMN prospect_id UUID REFERENCES public.prospects(id);
    END IF;

    -- Tornar client_id opcional em call_logs e adicionar prospect_id
    ALTER TABLE public.call_logs ALTER COLUMN client_id DROP NOT NULL;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='call_logs' AND column_name='prospect_id') THEN
        ALTER TABLE public.call_logs ADD COLUMN prospect_id UUID REFERENCES public.prospects(id);
    END IF;

END $$;

-- 6. Configuração de RLS para novas tabelas
ALTER TABLE public.prospect_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_client_links ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    -- Categorias
    DROP POLICY IF EXISTS "Categorias visíveis por todos autenticados" ON public.prospect_categories;
    CREATE POLICY "Categorias visíveis por todos autenticados" ON public.prospect_categories FOR SELECT USING (auth.role() = 'authenticated');
    
    -- Prospectos
    DROP POLICY IF EXISTS "Prospectos visíveis por todos autenticados" ON public.prospects;
    CREATE POLICY "Prospectos visíveis por todos autenticados" ON public.prospects FOR SELECT USING (auth.role() = 'authenticated');
    
    DROP POLICY IF EXISTS "Supervisores gerenciam prospectos" ON public.prospects;
    CREATE POLICY "Supervisores gerenciam prospectos" ON public.prospects 
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPERVISOR')));

    -- Contatos
    DROP POLICY IF EXISTS "Contatos de prospectos visíveis" ON public.prospect_contacts;
    CREATE POLICY "Contatos de prospectos visíveis" ON public.prospect_contacts FOR SELECT USING (auth.role() = 'authenticated');

    -- Links de Conversão
    DROP POLICY IF EXISTS "Links de conversão visíveis" ON public.prospect_client_links;
    CREATE POLICY "Links de conversão visíveis" ON public.prospect_client_links FOR SELECT USING (auth.role() = 'authenticated');
END $$;
