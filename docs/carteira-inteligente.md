# Carteira inteligente — primeira versão local

**Fora do pacote de atualização por decisão do usuário.** A experiência e as métricas continuam em avaliação local. Não reincluir sem nova autorização.

`scripts/build-iis.mjs` prepara uma cópia isolada em `outputs/release-source-*`, sem a rota `/carteira`, seus links, imports, endpoints e monitor da API. O desenvolvimento local permanece intacto. O resultado aprovado é apontado por `outputs/release-build.json`; `package-release.py` exige esse resultado e verifica a ausência da funcionalidade antes de gerar o ZIP. Não usa o build experimental anterior em `dist/standalone` da raiz. Os módulos e o banco de acompanhamentos não entram no pacote.

Acesse `/carteira` ou o menu **Carteira inteligente**. A análise cobre todos os grupos, sem recorte automático por vendedor. O responsável informado no acompanhamento não representa atribuição oficial de carteira nem autenticação.

## Fonte e agrupamento

O ERP é consultado somente para leitura, pela mesma conexão da API. A análise diária por pessoa/categoria reaproveita o escopo fiscal de `DETAILS`. Valores representam faturamento antes das devoluções. Considera 24 meses completos mais o mês corrente; o gráfico exibe 12 meses completos.

Empresas são consolidadas transitivamente por raiz de CNPJ de 14 dígitos, `GRUPOEMPRESARIAL` positivo e `K_NOMEGRUPO` não vazio, sem distinção de acentos/maiúsculas. CPF e campos vazios não criam vínculos por raiz. O cadastro atual é aplicado retroativamente; mudanças de grupo exigem revisar a continuidade dos acompanhamentos, cuja chave é o menor HANDLE do grupo.

## Regras iniciais para calibração

- Propostas: pelo menos uma proposta aberta criada nos últimos 365 dias, nenhum novo pedido válido/faturamento nos últimos 90 dias e nenhum pedido aberto. As regras de proposta aberta são as mesmas do relatório. Valores exibidos incluem o histórico de propostas abertas e não equivalem a venda provável.
- Recompra: pelo menos cinco dias distintos de faturamento positivo no último ano. Limite de atraso = maior entre 14 dias, 1,5 × intervalo mediano e mediana + 3 × desvio absoluto mediano. Não sinaliza quando há pedido em aberto ou pedido recente dentro desse limite. Intervalos muito irregulares não geram o sinal.
- Queda: três meses completos contra os três anteriores, redução mínima de R$ 1.000 e base de pelo menos R$ 1.000. Exige três meses com faturamento positivo no histórico de referência. Limite relativo entre 30% e 60%, calculado pelo desvio absoluto mediano dividido pela mediana dos nove meses anteriores ao trimestre recente. Com base sazonal positiva, exige também queda de 20% contra os mesmos três meses do ano anterior. Sem essa base, reduz a prioridade e explicita a incerteza.
- Categorias: pelo menos R$ 1.000 e três meses de compras positivas no histórico anterior aos últimos 90 dias, nenhuma compra da categoria nos últimos 90 dias, com outra categoria ainda ativa. Considera peças, implementos, serviços e outros; não equivale ainda a análise por família ou produto. Pedidos em aberto são apresentados para verificação humana.

- Inatividade prolongada: pelo menos 180 dias desde o último faturamento positivo, R$ 1.000 de faturamento no histórico disponível, sem pedido válido nos últimos 90 dias ou em aberto. Não exige recorrência; o vendedor deve confirmar compras pontuais e sazonalidade. Continua detectando o grupo quando ambos os trimestres estão zerados ou a compra saiu da janela de 12 meses, até o limite de 24 meses completos mais o mês corrente da fonte.

Prioridade é uma heurística explicável, não probabilidade de perda: propostas 65 pontos; recompra 50 + razão entre atraso e limite × 10, até 85; queda 75 com base sazonal ou 55 sem ela; categorias 55; inatividade 75. Usa o maior sinal e soma 5 por motivo adicional. Inatividade e recompra são um único motivo, para não contar o mesmo problema duas vezes. Acrescenta 10 pontos quando o faturamento no histórico disponível é de pelo menos R$ 100 mil, ou 15 a partir de R$ 500 mil. Não acrescenta pontos financeiros sem sinais e não usa valores de propostas para esse adicional. Limite de 100; Alta a partir de 75. Faixas iniciais para calibração comercial.

A tela resume o motivo principal e a próxima ação sugerida; evidências e critérios ficam recolhidos. Ordenação padrão: prazo vencido, pontuação e valor de referência (maior valor entre os sinais, sem somá-los). O valor de referência serve para ordenar; não é previsão de receita perdida. Os valores antigos de propostas ainda entram nesse último desempate, sem representar probabilidade de conversão.

## Monitoramento e acompanhamento

A API inicia um monitor em segundo plano, que recalcula a carteira a cada 15 minutos após a conclusão da leitura anterior. Reutiliza a análise entre abas e usuários; há timeout de 90 segundos por consulta SQL. A página consulta o resultado a cada 15 segundos enquanto visível. Falhas mantêm a última análise com aviso de desatualização. O botão Consultar relê o resultado disponível, sem disparar outra consulta pesada ao ERP.

As notificações são internas à tela: novo sinal/prioridade, prazo atingido e vencimento. Não há envio por e-mail/WhatsApp, divisão automática por vendedor, modelo preditivo treinado ou execução enquanto a API estiver desligada.

Registros ficam em `outputs/portfolio-actions.sqlite3`, fora do ERP. Configure `PULSO_PORTFOLIO_DB` para escolher outro caminho persistente e inclua-o no backup. Não copie essa base para pacotes de aplicação. A API precisa de permissão de escrita nesse caminho. Cada registro é acrescentado ao histórico; a tela mostra o mais recente por grupo. Nesta versão, o acompanhamento é renovado com uma próxima data; não há fluxo de encerramento definitivo.

Um acompanhamento futuro suspende a fila até o dia marcado. Novo tipo de sinal ou aumento de pelo menos 15 pontos reabre a atenção. O vencimento é calculado pela data atual mesmo antes do próximo recálculo. Sem sinais, o grupo acompanhado fica em “Sem sinais atuais”; ao chegar a data, volta para revisão, sem afirmar recuperação automaticamente.

## Validação

`python -m unittest discover -s backend -p 'test_*.py'`

`node node_modules/typescript/bin/tsc --noEmit`

`node scripts/build-iis.mjs`

Os testes cobrem vínculos transitivos, isolamento de CPF, transferência entre filiais, sazonalidade, mês incompleto, histórico insuficiente, proteção por pedidos, propostas antigas e persistência/reabertura de acompanhamentos. A nova consulta também foi comparada ao relatório existente para um grupo real com duas empresas, com valores iguais no trimestre.
