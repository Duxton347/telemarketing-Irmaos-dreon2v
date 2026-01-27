
-- Criação da tabela de logs de produtividade
CREATE TABLE IF NOT EXISTS public.operator_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id UUID NOT NULL REFERENCES public.profiles(id),
    task_id UUID REFERENCES public.tasks(id),
    event_type TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT now(),
    note TEXT
);

-- Habilitar RLS
ALTER TABLE public.operator_events ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Operadores inserem próprios eventos" ON public.operator_events;
    DROP POLICY IF EXISTS "Visualização de eventos (Supervisores)" ON public.operator_events;
    
    CREATE POLICY "Operadores inserem próprios eventos" ON public.operator_events 
    FOR INSERT WITH CHECK (auth.uid() = operator_id);

    CREATE POLICY "Visualização de eventos (Supervisores)" ON public.operator_events 
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPERVISOR'))
        OR operator_id = auth.uid()
    );
END $$;
