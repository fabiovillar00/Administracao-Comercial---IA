# Próxima atualização de produção

## Preparada — V.01.010 (08/10/2026)

Publicação autorizada pelo usuário após teste local. Incluídos Classificar por e Ordem na Carteira: grupo, quantidade/valor das propostas, último pedido, último faturamento e atenção exclusiva. Classificação aplicada antes da paginação, preservada na impressão e no Excel; datas ausentes ficam no final. Publicação pendente de execução e autenticação no publicador.

## Publicado — V.01.009 (08/10/2026)

Publicação autorizada pelo usuário após validação local. Datas do último pedido clicáveis no grupo e na filial, com painel do pedido e produtos respeitando a categoria. Exportar Excel ao lado da impressão: arquivo .xlsx com Grupos, Unidades e Critérios, incluindo todas as páginas da busca e todas as filiais. Datas e valores tipados; códigos e documentos preservados como texto. Teste de geração/leitura do Excel incluído na preparação da versão.

Publicada às 09:06:56 (Brasília), pacote `20261008T120339260252Z`, SHA256 `0b29522b85c69e4f62c02faf8def448e8f4bf4d5e0a58546f520d0cd860f94a1`. Backup `C:\Pulso\Atualizacoes\20261008-090521-970472ae\backup`; log `outputs/publicacao-20261008-090231-41a16705.log`. Aprovados 55 testes da API, 4 do gráfico, teste Excel, TypeScript e build IIS. Verificações remotas concluídas: Carteira com 509 grupos e Visão do grupo BP com 12 unidades. Sucesso confirmado pelo log e captura do usuário. Tentativas anteriores pararam antes da aplicação; corrigido o carregamento explícito do módulo de credenciais do Windows PowerShell. Este registro substitui o estado anterior de publicação pendente.

## Publicado — V.01.008 (07/10/2026)

Corrigida a navegação das abas da Carteira: links HTML diretos substituem o Link do roteador para abrir a Visão do grupo. Publicado às 07:10:12, pacote `20261007T100655758136Z`, backup `C:\Pulso\Atualizacoes\20261007-070839-4aee24a0\backup`. Testes da API (53), gráfico (4), TypeScript e compilação aprovados. Conferência no servidor: Carteira 509 grupos; Visão do grupo BP 12 unidades. Navegador automatizado sem autenticação Windows disponível; abertura direta e consulta confirmadas pelo processo remoto.

## Publicado — V.01.007 (06/10/2026)

Publicados Visão do grupo com filtros Geral/Peças/Implementos e impressão/PDF, impressão da Carteira/painel de propostas e lâmpada de atenção para pedidos no ano-base. Pacote final `20261006T192447292535Z`, aplicado às 16:26:39; backup `C:\Pulso\Atualizacoes\20261006-162518-5f9bc2da\backup`; log `outputs/publicacao-v01007-correcao.log`. A primeira aplicação encontrou falta de permissão em FN_PARCELAS: removida a consulta financeira do indicador que já havia sido retirado da tela, sem ampliar permissões. Reaplicado e confirmado: duas telas HTTP 200, consultas de Peças/Implementos, BP com 12 unidades, alertas BP falso/CMAA verdadeiro. Endereço público correto: HTTPS (HTTP porta 80 pertence ao site padrão do IIS). Este registro substitui os estados pendentes abaixo referentes a estes recursos.

## Pendente — Visão do grupo

Novo painel `/carteira/grupo` na Carteira inteligente, com grupo empresarial estrito, unidades do cliente, vendedor, período e janela de produtos. Cards executivos, atividade, frequência, gráfico mensal, produtos, descontos K_NEGOCIACAO e prazo de liquidação pelo vínculo financeiro DOCUMENTOORIGEM. Critérios detalhados em `docs/carteira-inteligente.md`. API `group_dashboard.py` incluída no preparo e validação de pacotes. Validado localmente com 53 testes, TypeScript, compilação e dados reais. Não publicado.

## Pendente — impressão da Carteira e do painel de propostas

Incluído Imprimir / Salvar PDF também na tela principal da Carteira: todos os grupos da busca, totais, períodos e unidades dos grupos expandidos, sem limitar à página atual. Incluído Imprimir / Salvar PDF na lista e no detalhe do painel. Lista imprime todas as propostas da busca e todos os produtos, independentemente da paginação; detalhe imprime apenas a proposta aberta. A4 retrato, logo DMB, data/hora de Brasília e usuário. Documento isolado da pesquisa, com carregamento completo antes de imprimir e erro explícito em falha. Validado TypeScript e geração com 60 produtos e caracteres especiais. Alteração local, ainda não publicada.

## Publicado — V.01.006: Carteira inteligente e propostas

Em 06/10/2026, usuário autorizou publicar os ajustes de pedidos/propostas e a nova Carteira inteligente, incluindo análise por grupo, filtro de status em elaboração, painel lateral e produtos abaixo das propostas. Removida a exclusão da Carteira no build/pacote; atualizador inclui portfolio.py e portfolio_analysis.py com backup/restauração. Publicada com sucesso em 06/10/2026 às 14:34:29. Pacote `20261006T173110367884Z`; log `outputs/publicacao-20261006-143002-4e7b61e4.log`; backup `C:\Pulso\Atualizacoes\20261006-143251-65c480f8\backup`. Interface e API verificadas; tela `/carteira` e consulta real confirmadas no servidor (510 grupos, histórico de 5 anos, ano-base 2026, implementos). Este registro substitui os apontamentos pendentes abaixo referentes às funcionalidades incluídas nesta versão.

## Em validação local — painel lateral de propostas

Adicionado painel lateral na análise de clientes por grupo. A lista também exibe automaticamente código, descrição e quantidade dos produtos abaixo de cada proposta, reaproveitando o cache do detalhamento. Acesso pela quantidade de propostas do grupo ou da filial; lista com número, unidade, data, situação e valor, produtos e navegação Anterior/Próxima. A pesquisa permanece montada ao consultar e fechar o painel. Detalhes reutilizados durante a análise, com limpeza ao analisar novamente. Validado no navegador com grupo BP e filial Tropical. Ainda não publicado.

## Em validação local — nova análise de clientes por grupo

Em 06/10/2026, reformulada a tela Carteira inteligente para histórico configurável em anos, ano-base editável, ausência de faturamento no ano-base (ou nele e no anterior) e categoria Geral/Peças/Implementos. Consolida grupos completos e permite expandir unidades, propostas em elaboração e produtos. Quantidade e valor líquido das propostas e último pedido aparecem no resumo; tabelas paginadas e detalhes sob demanda. Monitor e interface de alertas anteriores desativados, com módulos e registros preservados. Validada com 45 testes, TypeScript e dados reais, inclusive conciliação grupo/unidade/proposta/produtos. Permanece fora do pacote de produção até validação e autorização de publicação.

## Pendente — propostas somente em elaboração

Em 06/10/2026, a pedido do usuário, o filtro de propostas passa de `STATUSPROPOSTA NOT IN (3, 4)` para `STATUSPROPOSTA = 1` (Em elaboração). A consulta compartilhada aplica a regra aos totais, categorias e itens de propostas, preservando os demais critérios. Alteração local, ainda não publicada.

## Pendente — expansão de clientes nos produtos de pedidos e propostas

Correção de desempenho: tabelas de pedidos/propostas paginadas em 50 itens, evitando renderizar simultaneamente os cerca de 191 mil itens da consulta geral de propostas. Totais e filtros continuam considerando todos os itens; expansão de clientes permanece ativa ao navegar entre páginas.

Em 06/10/2026, incluído “Expandir clientes de todos” / “Recolher clientes de todos” nas duas telas de produtos. Cada item de documento exibe seu cliente com código, nome, CNPJ e quantidade. A expansão acompanha os filtros de categoria, família e busca. Identificação obtida na própria consulta dos itens, pelo cliente do pedido ou da proposta, sem consultas individuais. Alteração local, ainda não publicada.

## Publicado — V.01.005: famílias, quantidades e comparação anual

Usuário validou e autorizou publicar os ajustes de quantidades e seleção de família e o comparativo com ano anterior completo. Publicação concluída em 01/10/2026 às 16:35:07, com interface e API verificadas pelo atualizador. Pacote `20261001T193205879424Z`; log `outputs/publicacao-20261001-163108-4b1677f7.log`; backup `C:\Pulso\Atualizacoes\20261001-163340-3c6515b6\backup`.

## Incluído na V.01.005 — quantidades e seleção de família nos produtos

Gráfico exibe percentual de faturamento e quantidade vendida junto às barras. Os cartões de quantidade e valor e o resumo da listagem seguem a família e a busca selecionadas. O resumo utiliza soma das quantidades, também na impressão. Percentuais do gráfico continuam relativos à categoria para manter a comparação entre famílias.

## Incluído na V.01.005 — comparação com ano anterior completo

Em 01/10/2026, a pedido do usuário, o comparativo passa a consultar sempre 01/01 a 31/12 do ano anterior, inclusive quando o período atual é parcial. Cartões e textos explicitam “ano completo” e “período selecionado”. Validado com testes da API e TypeScript.

## Publicado — V.01.004: cartão de quantidade vendida

Em 01/10/2026, alterado o cartão da análise de produtos para somar `quantidade` dos produtos da categoria selecionada, em vez de contar códigos distintos. Título: “Quantidade vendida”. Validado localmente: setembro/2026, Implementos, 31 unidades em vez de 15 códigos distintos. Publicação autorizada pelo usuário e concluída às 15:49:13, com interface e API verificadas pelo atualizador. Pacote `20261001T184614803091Z`; log `outputs/publicacao-20261001-154518-7c58600e.log`; backup `C:\Pulso\Atualizacoes\20261001-154744-5712d4d4\backup`.

## Publicado — V.01.003: impressão e clientes por produto

Publicação confirmada pelo log `outputs/publicacao-20261001-101430-c03f7bb3.log`, com sucesso em 01/10/2026 às 10:18. Pacote `20261001T131519286800Z`; backup remoto `C:\Pulso\Atualizacoes\20261001-101700-ae8e93f6\backup`. Interface e API verificadas pelo atualizador. Este registro substitui os apontamentos pendentes abaixo sobre impressão e detalhamento de clientes.

## Pendente — clientes por produto

Incluído controle opcional “Expandir clientes de todos” / “Recolher clientes de todos” na listagem de produtos. Exibe abaixo de cada produto código do cliente, nome, CNPJ e quantidade, com o mesmo período, clientes e categoria do faturamento. O detalhamento é consultado em lote para os produtos retornados, sem consultas individuais por produto. A impressão acompanha a expansão atual. Alteração ainda não publicada.

## Pendente — impressão dos produtos do faturamento

Em 01/10/2026, usuário confirmou funcionamento da publicação anterior e solicitou impressão na tela de produtos. Incluído botão Imprimir / Salvar PDF, com cabeçalho DMB, data/hora, usuário e A4 retrato. Respeita a expansão da listagem: aberta inclui todos os produtos do filtro atual; fechada imprime o resumo. Tabela permite múltiplas páginas com cabeçalho repetido. Alteração ainda não publicada.

## Versão da próxima publicação — V.01.003

Preparada em 01/10/2026 para a impressão dos produtos do faturamento e expansão dos clientes por produto, ambas validadas localmente pelo usuário. Usuário autorizou a publicação após confirmar o detalhamento funcionando. Publicação pendente. Rebuilds e novas tentativas mantêm esta versão.

## Publicado — V.01.002: impressão da Análise de Faturamento

Usuário confirmou em 01/10/2026 que a atualização funcionou em produção. Inclui Imprimir / Salvar PDF, A4 retrato, logo DMB, data/hora e login do IIS no cabeçalho, além da ocultação de Clientes e Relatórios. Carteira inteligente permanece excluída do pacote.

## Publicado — Uso da plataforma, exclusivo de DMB\fabio.andrade

Implementado em 29/09/2026: presença estimada, histórico de acessos, navegação, consultas e erros, filtros por usuário/período e retenção de 90 dias. Autorização na API por cookie assinado emitido pelo handler IIS; não aceita identidade digitada nem o cabeçalho legado. Sem armazenar conteúdo das pesquisas.

Ativação e publicação concluídas pelo usuário em 29/09/2026, com sucesso às 09:30:07, pacote `20260929T120008000299Z`. Captura de produção confirma presença e histórico de Fabio às 09:39. Validação com outra conta ainda não confirmada. O script de ativação foi corrigido para aceitar a identidade do pool por nome ou valor numérico. Procedimento em `uso-plataforma.md`.

A Carteira inteligente permanece experimental e excluída do pacote por decisão do usuário.

## Publicação a partir da máquina local

Criados `Atualizar-Producao.bat` e `Verificar-Acesso-Producao.bat` em 23/09/2026. Fluxo completo implementado com autenticação Kerberos e credencial solicitada, sem salvar senha. Cinco cenários simulados passaram. A conta inicial não tinha acesso. Em 23/09/2026, o usuário confirmou o acesso com uma conta autorizada e depois confirmou o sucesso da publicação completa por Atualizar-Producao.bat. Fluxo remoto validado pelo usuário. Ver `atualizacao-automatica.md`.

## Publicada — versão V.01.001 visível no cabeçalho

Solicitada em 23/09/2026: exibir discretamente `V.01.001` no alto da tela, ao lado do nome da seção. Valor centralizado em `lib/app-version.ts`. Publicada pelo fluxo remoto Atualizar-Producao.bat; sucesso confirmado pelo usuário em 23/09/2026. Não consta no kit anterior `20260922T191412465916Z`.

## Processo de atualização assistida

Implementado em 22/09/2026. `scripts/prepare-release.ps1` testa, compila e gera um kit. No servidor, `Publicar-Pulso.ps1` valida sem publicar; com `-Aplicar`, executa backup, troca, verificação e tentativa de restauração em falha. Manual: `atualizacao-automatica.md`. Doze cenários de instalação simulada passaram no Windows PowerShell 5.1 após o ajuste para o diretório de trabalho vazio da Interface. Primeira publicação real concluída com SUCESSO em 23/09/2026 às 07:15:20, conforme captura enviada pelo usuário. Versão: `20260922T191412465916Z`. As verificações automáticas de interface e API passaram; consultas confirmadas pelo usuário no site de produção em 23/09/2026.

## Publicada e validada — pesquisa geral sem cliente

Validada pelo usuário em homologação local em 22/09/2026. Publicada pelo atualizador em 23/09/2026. Usuário confirmou o funcionamento no site de produção em 23/09/2026.

- O mesmo campo aceita consultas sem cliente: `faturamento hoje`, `venda hoje`, `vendas hoje` e `acumulado hoje`.
- Aceita também apenas o período: `hoje`, `hj`, `este mês`, `este ano`, `ano passado`, `março 2026`, `03/2026` e `2018 a 2026`.
- Sem cliente, exibe `Faturamento geral · Todos os clientes`. Com cliente, preserva o filtro, por exemplo `BP hoje`.
- Cliente inexistente continua retornando erro; não muda silenciosamente para consulta geral.
- Nos filtros, cliente e grupo vazios permitem consultar todos os clientes no período selecionado.
- Itens de pedidos e propostas da consulta geral são carregados ao abrir suas respectivas telas, evitando carregá-los na pesquisa inicial de faturamento.
- Placeholder atualizado para `Ex.: hoje, este mês ou BP este ano`.

Validação: 13 testes Python passaram; TypeScript validado após a implementação geral; consulta real `hoje` retornou todos os clientes apenas no dia atual. Usuário confirmou o funcionamento. Homologação é a aplicação local em http://127.0.0.1:3000, com consultas de leitura ao ERP_PROD.

Publicação realizada pelo kit da versão `20260922T191412465916Z`, com o atualizador corrigido em 23/09. Para novas alterações, gerar outro kit com `scripts/prepare-release.ps1`. O ZIP `Pulso-Atualizacao-Anos-Hoje-20260922.zip` é anterior a esta melhoria e não a contém. Seguir o procedimento de backup e tarefas em `implantacao-iis.md`.

## Já publicado e confirmado pelo usuário

- Gráfico anual para consultas abrangendo vários anos, preservando meses para um único ano.
- Reconhecimento de `hoje` junto ao nome de um cliente, por exemplo `Santa Isabel hoje`.
- Produção: 192.168.0.15, aplicação em `C:\Pulso\App`, tarefas `Pulso - Interface` e `Pulso - API`. A atualização anterior foi copiada pelo usuário via Área de Trabalho Remota e validada por ele.

## Pendente - novo rodape
Solicitado em 23/09/2026: substituir a linha sobre dados em tempo real por 'Desenvolvido por : Departamento de Tecnologia e Informação - DMB - data: DD/MM/AAAA'. Data calculada no navegador no fuso America/Sao_Paulo, atualizada a cada minuto e ao voltar o foco para a janela. Alteracao local em app/page.tsx, ainda nao publicada.

## Pendente - consulta por ontem
Implementado em 23/09/2026: ontem, faturamento ontem, vendas ontem, acumulado ontem e BP ontem. Intervalo inclui apenas o dia anterior; ano acompanha a data na virada do ano. Quatorze testes Python passaram, incluindo virada de ano e ano bissexto. Alteracao local, ainda nao publicada.

## Pendente - periodos relativos padronizados
Em 23/09/2026, incluidos mes passado e mes anterior (mes calendario completo), e ano anterior como sinonimo de ano passado. Hoje, ontem, este mes e este ano preservados. Aceita periodo sozinho, com faturamento/venda/acumulado ou cliente. Quinze testes passaram, com matriz de 180 combinacoes de periodos e prefixos, incluindo janeiro e fevereiro bissexto. Ano de referencia acompanha o inicio do mes anterior na virada de ano. Atualizacao local; publicacao pendente.


Ajuste de 06/10/2026: a Visão do grupo reutiliza `portfolio.group_clients`, exatamente como Clientes que deixaram de comprar, substituindo o agrupamento estrito descrito anteriormente. Busca, unidades e indicadores usam os vínculos existentes de grupo empresarial, K_NOMEGRUPO e raiz de CNPJ.
`nVisão do grupo simplificada a pedido do usuário: removidos filtro de vendedor, janela editável de produtos, ticket médio, prazo de recebimento, maior desconto do período, intervalos médio/máximo e destaque de maior desconto histórico. Produtos novos/sem recompra preservam a janela padrão de três meses indicada na tela; consulta considera todos os vendedores. TypeScript validado.
Visão do grupo: filtro Geral/Peças/Implementos aplicado aos indicadores, atividade, produtos e descontos. Categorias reutilizam as famílias existentes; pedidos e propostas filtrados somam somente o líquido dos itens correspondentes. Validado TypeScript, 52 testes e consultas reais BP para ambas as categorias.
Carteira: lâmpada amarela de Atenção exclusiva no final da linha quando qualquer unidade possui pedido não cancelado no ano-base selecionado, respeitando a categoria. Flag calculada independentemente da data do último pedido; incluída na impressão/PDF. Validado com 53 testes e TypeScript. Ainda local.
Visão do grupo: incluído Imprimir / Salvar PDF com relatório A4 paisagem independente da tela, filtros da consulta, indicadores atuais, atividade, comportamento, série mensal tabulada, todos os produtos e ambas as listas de acompanhamento. Não limita à página nem à busca textual da tabela. Logo DMB, usuário e data/hora de Brasília. Indicadores removidos pelo usuário não reaparecem no relatório.

## V.01.012 — Expansão dos grupos e localização no Excel (09/10/2026)

- Expandir todos / Recolher todos aplica-se a todos os grupos da busca, incluindo outras páginas.
- Classificação por UF e Município em ordem alfabética crescente ou decrescente.
- Excel inclui UF e Município nas abas Grupos e Unidades, preservando a exportação de todas as filiais mesmo recolhidas.
- Teste de exportação atualizado para conferir as novas colunas e preservar datas, valores e identificadores.
- Publicada em 09/10/2026 às 11:06:53, pacote `20261009T140359652042Z`; backup `C:\Pulso\Atualizacoes\20261009-110528-443cfd66\backup`.
- Validação aprovada: 56 testes da API, 4 testes do gráfico, exportação Excel, TypeScript e build IIS. Após a instalação, telas verificadas e consultas confirmadas no servidor: carteira com 508 grupos; Visão do grupo BP com 12 unidades.

## V.01.011 — UF e município na carteira (09/10/2026)

- Colunas UF e Município após o nome do grupo e de cada unidade/filial.
- Localidades consolidadas sem repetições nos grupos; busca inclui UF e município.
- Consulta de leitura usa o estado e o município do cadastro de pessoas.
- Servidor local ignora pastas de pacotes na monitoração de arquivos, evitando a queda por arquivos bloqueados.
- Validação: 56 testes da API, 4 testes do gráfico, exportação Excel, TypeScript e build IIS aprovados.
- Publicada em 09/10/2026 às 10:34:07, pacote `20261009T133109907500Z`; backup `C:\Pulso\Atualizacoes\20261009-103241-9a2a3019\backup`.
- A validação funcional inicial encontrou falta de SELECT em `dbo.MUNICIPIOS`. Concedida somente essa leitura a `DMB\svc_pulso`, com consulta sob a identidade do usuário validada. Script reproduzível: `deploy/iis/Permissao-Municipios.sql`.
