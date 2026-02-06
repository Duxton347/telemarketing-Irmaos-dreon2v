
-- MIGRATION: 04_NATURAL_LANGUAGE_QUESTIONS
-- OBJETIVO: Implementar perguntas detalhadas para Prospecção e Assistência com suporte a campos de texto.

-- 1. Adicionar coluna input_type se não existir
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='questions' AND column_name='input_type') THEN
        ALTER TABLE public.questions ADD COLUMN input_type TEXT DEFAULT 'select' CHECK (input_type IN ('select', 'multiselect', 'text'));
    END IF;
END $$;

-- 2. Limpeza para reinserir base atualizada
DELETE FROM public.questions;

-- PROSPECÇÃO (Linguagem Natural + Coleta de Dados)
INSERT INTO public.questions (text, options, type, input_type, order_index) VALUES 
('Falei com quem decide?', ARRAY['Sim', 'Não', 'Em partes'], 'PROSPECÇÃO', 'select', 1),
('Qual o nome do contato principal?', ARRAY[]::TEXT[], 'PROSPECÇÃO', 'text', 2),
('WhatsApp direto do contato?', ARRAY[]::TEXT[], 'PROSPECÇÃO', 'text', 3),
('E-mail do contato?', ARRAY[]::TEXT[], 'PROSPECÇÃO', 'text', 4),
('Que tipo de solução procura?', ARRAY[]::TEXT[], 'PROSPECÇÃO', 'text', 5),
('Como resolve o problema hoje?', ARRAY[]::TEXT[], 'PROSPECÇÃO', 'text', 6),
('Quando pretende realizar o investimento?', ARRAY['Imediato', 'Próximos 30 dias', 'Sem previsão'], 'PROSPECÇÃO', 'select', 7);

-- ASSISTÊNCIA (Foco Técnico e Urgência)
INSERT INTO public.questions (text, options, type, input_type, order_index) VALUES 
('Qual equipamento apresentou falha?', ARRAY[]::TEXT[], 'ASSISTÊNCIA', 'text', 1),
('Qual o nível de urgência do reparo?', ARRAY['ALTA (Parado)', 'MÉDIA (Falha parcial)', 'BAIXA (Dúvida/Estético)'], 'ASSISTÊNCIA', 'select', 2),
('A visita técnica foi agendada?', ARRAY['Sim', 'Não', 'Aguardando confirmação do técnico'], 'ASSISTÊNCIA', 'select', 3),
('Resumo técnico do defeito relatado', ARRAY[]::TEXT[], 'ASSISTÊNCIA', 'text', 4);

-- PÓS-VENDA (Consistência com IDE)
INSERT INTO public.questions (text, options, type, input_type, order_index, stage_id) VALUES 
('Atendimento durante a compra', ARRAY['Ótimo', 'Ok', 'Precisa melhorar'], 'PÓS-VENDA', 'select', 1, 'atendimento'),
('Segurança no dimensionamento/indicação', ARRAY['Sim', 'Parcial', 'Não'], 'PÓS-VENDA', 'select', 2, 'tecnico'),
('Entrega/execução conforme combinado', ARRAY['No prazo', 'Pequeno atraso', 'Com problema'], 'PÓS-VENDA', 'select', 3, 'logistica'),
('Equipamento atendeu expectativas', ARRAY['Atendeu', 'Parcial', 'Não atendeu'], 'PÓS-VENDA', 'select', 4, 'produto'),
('Dificuldade de uso/manutenção', ARRAY['Não', 'Leve', 'Sim, teve dificuldades'], 'PÓS-VENDA', 'select', 5, 'suporte'),
('Recomendaria a empresa', ARRAY['Sim', 'Talvez', 'Não'], 'PÓS-VENDA', 'select', 6, 'marca'),
('Principal ponto de insatisfação', ARRAY['Negociação', 'Garantia', 'Atraso na execução', 'Atraso na entrega', 'Defeito no equipamento', 'Defeito na instalação', 'Venda incompleta', 'Atendimento'], 'PÓS-VENDA', 'select', 7, NULL),
('O cliente pode ser explorado para compra?', ARRAY['NÃO', 'QUÍMICOS', 'FOTOVOLTAICO', 'LINHA BANHO', 'LINHA PISCINA', 'AQUECEDORES'], 'PÓS-VENDA', 'select', 8, NULL);

-- VENDA
INSERT INTO public.questions (text, options, type, input_type, order_index) VALUES 
('Interesse inicial do prospect', ARRAY['Alto', 'Médio', 'Baixo'], 'VENDA', 'select', 1),
('Objeção principal identificada', ARRAY['Preço', 'Prazo', 'Confiança', 'Não precisa agora', 'Outro'], 'VENDA', 'select', 2);

-- CONFIRMAÇÃO PROTOCOLO
INSERT INTO public.questions (text, options, type, input_type, order_index) VALUES 
('O problema foi resolvido de fato?', ARRAY['Sim', 'Parcial', 'Não'], 'CONFIRMAÇÃO PROTOCOLO', 'select', 1),
('Avaliação da solução apresentada', ARRAY['Ótimo', 'Ok', 'Precisa melhorar'], 'CONFIRMAÇÃO PROTOCOLO', 'select', 2),
('O prazo para resolver foi adequado?', ARRAY['No prazo', 'Pequeno atraso', 'Com problema'], 'CONFIRMAÇÃO PROTOCOLO', 'select', 3);
