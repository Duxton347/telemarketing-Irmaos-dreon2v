
-- MIGRATION: 05_PROTOCOLS_LEADS
-- OBJETIVO: Permitir abertura de protocolos para prospectos e categorizar assistência técnica.

DO $$ 
BEGIN 
    -- 1. Tornar client_id opcional em protocols
    ALTER TABLE public.protocols ALTER COLUMN client_id DROP NOT NULL;

    -- 2. Adicionar prospect_id em protocols
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='protocols' AND column_name='prospect_id') THEN
        ALTER TABLE public.protocols ADD COLUMN prospect_id UUID REFERENCES public.prospects(id);
    END IF;

    -- 3. Adicionar call_type em protocols para rastrear origem
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='protocols' AND column_name='origin_call_type') THEN
        ALTER TABLE public.protocols ADD COLUMN origin_call_type TEXT;
    END IF;

    -- 4. Garantir que pelo menos um dos dois (cliente ou prospecto) esteja preenchido
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'protocols_entity_check') THEN
        ALTER TABLE public.protocols ADD CONSTRAINT protocols_entity_check CHECK (client_id IS NOT NULL OR prospect_id IS NOT NULL);
    END IF;
END $$;
