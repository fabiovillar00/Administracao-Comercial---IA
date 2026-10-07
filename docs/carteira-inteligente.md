# Análise de clientes por grupo — Carteira inteligente

A tela `/carteira` foi reformulada em 06/10/2026. Substitui na interface o experimento de alertas, pontuação e acompanhamentos por uma análise de grupos que compraram e deixaram de comprar. O monitor antigo não inicia mais com a API. Seus módulos e registros anteriores são preservados; não há escrita no ERP.

## Filtros e períodos

- Período de análise: 1 a 50 anos; padrão 10.
- Ano-base: editável, padrão ano vigente; não aceita anos futuros.
- Sem faturamento no ano-base (padrão): para 10 anos / 2026, exige faturamento entre 01/01/2016 e 31/12/2025 e nenhum faturamento entre 01/01/2026 e hoje.
- Sem faturamento no ano-base e no ano anterior: no mesmo exemplo, histórico comprador entre 01/01/2016 e 31/12/2024; ausência entre 01/01/2025 e hoje. Requer ao menos 2 anos de período.
- Para ano-base passado, a ausência cobre até 31/12 daquele ano.
- Geral, peças e implementos. A categoria afeta faturamento, propostas e último pedido. Um grupo pode estar inativo em implementos e ativo em peças.

## Consolidação e valores

Usa vínculos transitivos atuais por raiz de CNPJ, grupo empresarial e nome de grupo; CPF não é unido por raiz. Compra em qualquer integrante exclui todo o grupo da lista de inativos. Grupos com histórico e nenhuma proposta também aparecem, com quantidade e valor zero.

Faturamento reutiliza o escopo fiscal de `DETAILS`. Ausência significa nenhuma ocorrência de faturamento elegível; devoluções não anulam a existência de compra.

Propostas seguem `OPEN_PROPOSALS`: status 1 (Em elaboração), sem pedido vinculado, original nulo e demais condições comerciais existentes. Contagem distinta por proposta; valor é a soma líquida dos itens da categoria, compatível com o detalhamento. Não representa o total de cabeçalho com impostos.

Último pedido: maior data de inclusão de pedido não cancelado na categoria, mantendo os demais critérios de `OPEN_ORDERS`. Propostas e último pedido mostram a posição atual, inclusive se o ano-base é passado. Faturamento é histórico.

## Fluxo e desempenho

Consulta manual em Analisar clientes; nenhuma carga pesada automática na abertura. Resumo agregado por pessoa no SQL e consolidado por grupo em Python. Filiais vêm no resumo; propostas e produtos carregam sob demanda. Paginação nos quatro níveis. Ao alterar filtros, clique em Analisar clientes; resultados e detalhamentos sempre usam os filtros da última análise concluída, indicados acima da tabela.

API: `GET /api/portfolio?years=10&baseYear=2026&category=implementos&mode=base`. Detalhes usam `action=proposals&personId=...` ou `action=products&personId=...&proposalId=...`, preservando filtros. Validação de parâmetros e IDs vinculados, SQL parametrizado. Erros de detalhes permitem nova tentativa.

## Validação e publicação

Testes em `backend/test_portfolio_analysis.py`: limites anuais, ano passado, parâmetros inválidos, compra em filial vinculada, soma de grupos e unidades sem histórico, filtros de status/categoria e IDs parametrizados. TypeScript e suíte de backend também verificados.

Publicação da Carteira autorizada em 06/10/2026 para V.01.006. O pacote passa a incluir a tela e os módulos portfolio.py (funções de agrupamento) e portfolio_analysis.py; o monitor legado permanece inativo.

## Consulta lateral de propostas

Clique na quantidade de propostas do grupo ou da unidade para abrir o painel lateral. A lista exibe número, unidade, data, situação e valor; o número abre os produtos. Anterior/Próxima percorrem a lista filtrada; Voltar às propostas preserva a busca, a página e a lista montada. Fechar ou Escape retorna à pesquisa principal, que permanece montada com seus filtros, página, grupos expandidos e rolagem.

Detalhes são reaproveitados em memória durante a análise. Uma nova análise limpa esse cache. A consulta de um grupo reúne suas unidades em lotes de até quatro chamadas simultâneas. Falhas permitem tentar novamente.

Publicação V.01.006 concluída em 06/10/2026 às 14:34:29, com tela e consulta da Carteira verificadas no servidor. Log: `outputs/publicacao-20261006-143002-4e7b61e4.log`.

## Visão do grupo — painel executivo local (06/10/2026)

Nova rota `/carteira/grupo`, acessível pelas abas da Carteira inteligente. Grupo estritamente por `GN_PESSOAS.GRUPOEMPRESARIAL` -> `GN_GRUPOSEMPRESARIAIS.HANDLE`; sem grupo válido usa pessoa individual. Unidade/filial refere-se ao cliente. Vendedor usa `AGENTEVENDAS` em cada documento. Seleção por nome, apelido de grupo, código ou CNPJ.

Períodos móveis 3/6/12/24/36/60 meses e intervalo personalizado. Receita, ticket por nota, produtos, mês de pico e descontos seguem o período. Pedidos/propostas abertos representam a posição atual. Últimos eventos e intervalos entre dias distintos de faturamento positivo usam todo o histórico disponível até hoje. Propostas abertas: somente status 1, originais, sem pedido vinculado, critérios compartilhados da aplicação. Última proposta cadastrada considera qualquer situação, explicitado na tela.

Desconto comercial: percentual `CM_ORDEMVENDAITENS.K_NEGOCIACAO`, média por produto ponderada por quantidade; maior desconto do período e maior histórico separados. Valores fora de 0–100 e quantidade não positiva não compõem esse cálculo.

Recebimento: parcelas diretamente ligadas à nota ou ao título `DOCUMENTOORIGEM`, sem duplicar parcela entre notas; emissão fiscal até liquidação integral, ponderada pelo valor da parcela. Exclui canceladas; inclui compensações. Se várias notas compartilham parcela, usa a menor emissão das notas selecionadas. Não mede recebimentos parciais nem prazo contratual. Conferido com BP: 347 parcelas, 52,4 dias na consulta de 12 meses em 06/10/2026.

Produtos novos: primeira compra no histórico disponível dentro da janela configurável de 1–24 meses terminando na data final. Sem recompra: compras em pelo menos três meses distintos dos 12 meses anteriores à janela, sem compra na janela. Preços usam líquido por quantidade; faturamento inclui adicionais, antes das devoluções, no mesmo escopo fiscal vigente (filial fiscal 1). Recorrência usa pedidos vinculados às notas; notas sem vínculo aparecem na receita e são informadas na tela.

Validação: 53 testes Python, TypeScript, build IIS, 12 cenários simulados de atualização/rollback, API real e navegador. Somente ambiente local; ainda não publicado.


Ajuste de 06/10/2026: a Visão do grupo reutiliza `portfolio.group_clients`, exatamente como Clientes que deixaram de comprar, substituindo o agrupamento estrito descrito anteriormente. Busca, unidades e indicadores usam os vínculos existentes de grupo empresarial, K_NOMEGRUPO e raiz de CNPJ.
