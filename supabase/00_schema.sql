
-- Limpeza de perguntas existentes para evitar duplicidade durante o desenvolvimento
DELETE FROM public.questions;

-- 1. PERGUNTAS DE PÓS-VENDA (Focadas no IDE - Índice de Desempenho Operacional)
INSERT INTO public.questions (text, options, type, order_index, stage_id) 
VALUES 
('Atendimento durante a compra', ARRAY['Ótimo', 'Ok', 'Precisa melhorar'], 'PÓS-VENDA', 1, 'atendimento'),
('Segurança no dimensionamento/indicação', ARRAY['Sim', 'Parcial', 'Não'], 'PÓS-VENDA', 2, 'tecnico'),
('Entrega/execução conforme combinado', ARRAY['No prazo', 'Pequeno atraso', 'Com problema'], 'PÓS-VENDA', 3, 'logistica'),
('Equipamento atendeu expectativas', ARRAY['Atendeu', 'Parcial', 'Não atendeu'], 'PÓS-VENDA', 4, 'produto'),
('Dificuldade de uso/manutenção', ARRAY['Não', 'Leve', 'Sim, teve dificuldades'], 'PÓS-VENDA', 5, 'suporte'),
('Recomendaria a empresa', ARRAY['Sim', 'Talvez', 'Não'], 'PÓS-VENDA', 6, 'marca'),
('Principal ponto de insatisfação do cliente', ARRAY['Negociação', 'Garantia', 'Atraso na execução', 'Atraso na entrega', 'Defeito no equipamento', 'Defeito na instalação', 'Venda incompleta', 'Atendimento'], 'PÓS-VENDA', 7, NULL),
('O cliente pode ser explorado para comprar algo?', ARRAY['NÃO, CLIENTE PERDIDO', 'QUIMICOS', 'FOTOVOLTAICO', 'LINHA BANHO', 'LINHA PISCINA', 'AQUECEDORES', 'OUTROS'], 'PÓS-VENDA', 8, NULL);

-- 2. PERGUNTAS DE PROSPECÇÃO (Focadas em Conversão e Qualificação de Leads)
INSERT INTO public.questions (text, options, type, order_index, stage_id) 
VALUES 
('Receptividade na abordagem', ARRAY['Boa', 'Neutra', 'Ruim'], 'PROSPECÇÃO', 1, NULL),
('Interesse no produto/serviço', ARRAY['Alto', 'Médio', 'Baixo'], 'PROSPECÇÃO', 2, NULL),
('Momento de compra', ARRAY['Agora', 'Em breve', 'Sem previsão'], 'PROSPECÇÃO', 3, NULL);

-- 3. PERGUNTAS DE VENDA (Focadas em Fechamento e Objeções)
INSERT INTO public.questions (text, options, type, order_index, stage_id) 
VALUES 
('Interesse inicial do prospect', ARRAY['Alto', 'Médio', 'Baixo'], 'VENDA', 1, NULL),
('Objeção principal identificada', ARRAY['Preço', 'Prazo', 'Confiança', 'Não precisa agora', 'Outro'], 'VENDA', 2, NULL);

-- 4. PERGUNTAS DE CONFIRMAÇÃO DE PROTOCOLO (Pós-resolução de problemas)
INSERT INTO public.questions (text, options, type, order_index, stage_id) 
VALUES 
('O problema foi resolvido de fato?', ARRAY['Sim', 'Parcial', 'Não'], 'CONFIRMAÇÃO PROTOCOLO', 1, NULL),
('Avaliação da solução apresentada', ARRAY['Ótimo', 'Ok', 'Precisa melhorar'], 'CONFIRMAÇÃO PROTOCOLO', 2, NULL),
('O prazo para resolver foi adequado?', ARRAY['No prazo', 'Pequeno atraso', 'Com problema'], 'CONFIRMAÇÃO PROTOCOLO', 3, NULL);
