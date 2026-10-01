# Próxima atualização de produção

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
