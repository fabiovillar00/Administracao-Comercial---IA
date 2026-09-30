# Próxima atualização de produção

## Versão da próxima publicação — V.01.002

Preparada em `lib/app-version.ts`. Inclui a ocultação de Clientes e Relatórios. A publicação de 29/09/2026 manteve V.01.001; não alterar retroativamente seus pacotes. A cada nova atualização publicada, incrementar a versão visual: V.01.002, V.01.003, V.01.004 e assim por diante. Recompilar ou tentar publicar novamente a mesma atualização não incrementa a versão. Registrar a publicação confirmada e preparar a próxima versão antes do próximo build. A versão visual também fica registrada no manifesto do pacote e no resultado do empacotamento.

## Pendente — ocultar Clientes e Relatórios do menu

Solicitado em 29/09/2026: remover temporariamente os dois itens do menu lateral enquanto seu escopo não está definido. Implementado em `app/page.tsx`. Incluir no próximo pacote; ainda não publicado. A Carteira inteligente continua excluída da atualização.

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
