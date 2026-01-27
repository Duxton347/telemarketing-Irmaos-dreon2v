
-- ... (restante do arquivo omitido para brevidade, atualizando apenas a parte de perguntas)

-- Inserir dados iniciais (Seed) - Removendo e reinserindo para garantir ordem
DELETE FROM public.questions WHERE type = 'PÓS-VENDA';

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
