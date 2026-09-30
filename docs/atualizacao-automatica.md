# Atualizacao assistida do Pulso no servidor

## Publicar diretamente deste computador (23/09/2026)

Na raiz do projeto, `Atualizar-Producao.bat` conecta a `DMBAPP03.DMB.LOCAL` usando Kerberos, solicita credenciais via janela do Windows, executa a preparacao local, copia o pacote exato produzido nesta execucao e o atualizador via PowerShell Remoting, valida e aplica. Nao e necessario abrir RDP nem copiar arquivos manualmente. Executar o BAT significa autorizar a publicacao das alteracoes que estiverem salvas no projeto; testar e aprovar essas alteracoes antes. O script nao incrementa a versao visual automaticamente.

Primeiro executar `Verificar-Acesso-Producao.bat`: testa somente autenticacao, acesso administrativo, pasta e existencia das tarefas. O teste com a conta atual retornou Acesso negado; ainda falta validar com uma conta autorizada. Nao fornecer senha no chat nem em arquivos: usar a janela de credenciais. A conta precisa de acesso PowerShell Remoting e administracao do servidor. Em bloqueio por politica/permissoes, pedir a TI para avaliar esse acesso. O script nao altera TrustedHosts, firewall, politicas de execucao ou certificados.

Depois de confirmar o acesso, dar dois cliques em `Atualizar-Producao.bat`, informar a conta autorizada e manter a janela e a rede ativas ate o resultado. O BAT pausa para permitir a leitura do resultado. Logs locais: `outputs/publicacao-*.log`; logs e backups remotos: `C:\Pulso\Atualizacoes`. Nenhuma senha e salva. Se a conexao cair durante a aplicacao, o resultado pode ser indeterminado: conferir o log/estado do servidor antes de repetir. Falhas de copia ou inicializacao detectadas pelo atualizador acionam a tentativa de restauracao existente. Nao se garante restauracao automatica apos encerramento abrupto do processo ou queda do servidor.

Validacao local: cinco cenarios simulados de sucesso, acesso negado, preparacao falha, validacao remota falha e aplicacao falha. Transporte e build foram simulados nesses testes. Ainda nao houve publicacao real pelo BAT; a publicacao anterior foi executada dentro do servidor.

O processo exige apenas copiar o pacote para o servidor e executar um comando. Ele faz backup, para as duas tarefas, substitui a aplicacao, inicia as tarefas e verifica interface/API. A transferencia e o acionamento remoto ainda sao manuais: a conta local nao tem acesso administrativo ao servidor 192.168.0.15.

## Preparar uma versao neste computador

Antes de preparar cada nova atualização para publicação, incrementar `APP_VERSION` em `lib/app-version.ts` e registrar a versão e as mudanças em `docs/proxima-atualizacao.md`. Próxima publicação: **V.01.002**; seguintes: **V.01.003**, **V.01.004**, etc. Rebuilds e novas tentativas da mesma atualização mantêm a versão. O incremento é uma etapa obrigatória da preparação, não é automático. O empacotamento registra `appVersion` no manifesto e exige que a versão do código corresponda à usada no build.

Na raiz do projeto, executar no PowerShell:

```powershell
.\scripts\prepare-release.ps1
```

O script executa testes Python, testes do grafico, TypeScript e build. So entao gera `outputs\Pulso-Release-<versao>.zip` e seu arquivo `.zip.sha256`. O ZIP contem a interface compilada, `backend/server.py`, `backend/queries.py`, `scripts/start-iis.mjs` e um manifesto com hashes. Nenhuma configuracao local ou credencial e empacotada.

Os antigos ZIPs sem `release.json` nao sao aceitos pelo atualizador.

Tambem e gerado `Pulso-Kit-Atualizacao-<versao>.zip`, contendo o pacote, atualizador, manual e `Publicar-Pulso.ps1` com nome e hash ja preenchidos. Para o fluxo mais simples, copiar e extrair o kit em uma pasta propria no servidor, abrir PowerShell como administrador nessa pasta e executar `.\Publicar-Pulso.ps1` para validar. Depois executar `.\Publicar-Pulso.ps1 -Aplicar` para publicar. O ZIP interno permanece compactado. Este fluxo dispensa instalar o atualizador separadamente; os passos abaixo documentam tambem o uso direto.

## Instalar o atualizador uma vez

No servidor, criar `C:\Pulso\Ferramentas` e colocar ali o arquivo `Atualizar-Pulso.ps1`. Abrir PowerShell como administrador, com uma conta autorizada a administrar as tarefas e arquivos do Pulso. A conta das tarefas e suas credenciais nao sao alteradas.

Se a politica da empresa bloquear scripts, solicitar a TI a assinatura/aprovacao do script. Nao e necessario alterar permanentemente a politica de execucao.

## Publicar uma versao

1. Copiar o ZIP para `C:\Pulso\Pacotes` no servidor. Nao extrair sobre a aplicacao.
2. Informar o nome exato do pacote e o SHA256 exibido na preparacao. Na primeira utilizacao, executar com `-ValidateOnly`:

```powershell
C:\Pulso\Ferramentas\Atualizar-Pulso.ps1 -Package 'C:\Pulso\Pacotes\Pulso-Release-VERSAO.zip' -Sha256 'HASH_DE_64_CARACTERES' -ValidateOnly
```

3. Se a validacao terminar sem erros, repetir o comando sem `-ValidateOnly` para aplicar a versao:

```powershell
C:\Pulso\Ferramentas\Atualizar-Pulso.ps1 -Package 'C:\Pulso\Pacotes\Pulso-Release-VERSAO.zip' -Sha256 'HASH_DE_64_CARACTERES'
```

O modo de validacao extrai e verifica o pacote em uma pasta de trabalho e grava logs. Nao para tarefas nem substitui arquivos da aplicacao.

As tarefas `Pulso - API` e `Pulso - Interface` devem estar habilitadas e executando, com diretorio de trabalho `C:\Pulso\App`, antes do inicio. O processo verifica suas acoes e exige uma instalacao saudavel. Durante a troca, as tarefas ficam temporariamente desabilitadas para evitar reinicio no meio da copia. Sao habilitadas e iniciadas novamente ao final.

Somente estes itens sao substituidos: `dist\standalone`, `backend\server.py`, `backend\queries.py`, `scripts\start-iis.mjs`. Preserva `.venv`, variaveis de ambiente, IIS, handler de identidade, certificados, banco e credenciais.

## Verificacao e restauracao

O script verifica `/api/health` na porta 8000, incluindo a conexao com o banco, e a pagina Pulso na porta 3000. Em falha de copia ou inicializacao, tenta restaurar os itens trocados e iniciar a versao anterior. Pacotes corrompidos ou com caminhos inesperados sao rejeitados antes de parar tarefas.

Backup, copia do XML das tarefas, pacote extraido e log ficam em `C:\Pulso\Atualizacoes\<execucao>`. Em sucesso, `resultado.json` registra versao e hash. Arquivos de uma versao que falhou ficam em `falha`. Backups nao sao apagados automaticamente.

Os testes internos nao validam o HTTPS/autenticacao do IIS nem a exatidao de todas as consultas. Depois de publicar, conferir no endereco de producao: `BP 2026`, `BP 2018 a 2026`, `Santa Isabel hoje` e, se incluida nesta versao, `hoje`.

Se o processo for interrompido por queda de energia, fechamento do PowerShell ou se a restauracao falhar, usar o log e o backup para recuperacao manual. Desabilitar e parar as duas tarefas, conferir se as portas 3000/8000 foram liberadas e restaurar apenas os itens existentes na pasta `backup` da execucao. Para `dist\standalone`, guardar a pasta atual separadamente antes de restaurar a anterior, sem mesclar arquivos de versoes diferentes. Depois habilitar/iniciar as tarefas e conferir a aplicacao. O XML exportado nao contem senha e nao e uma exportacao das credenciais da conta de servico.

## Validacao do mecanismo

`scripts\test-deployment.ps1` cria instalacoes temporarias e simula as tarefas e o HTTP; nao acessa producao. Cobre validacao sem publicar, hash do ZIP incorreto, caminho malicioso no ZIP, hash de arquivo incorreto, sucesso, falha de saude da nova versao, falha no meio da troca e falha ao parar tarefas. Confere preservacao das configuracoes e restauracao de arquivos/tarefas.

A primeira execucao real no servidor ainda deve ser acompanhada. O mecanismo nao e uma publicacao automatica por horario nem por commit.

## Ajuste de compatibilidade em 23/09/2026
A tarefa real da Interface usa Iniciar em vazio e argumento absoluto C:\Pulso\App\scripts\start-iis.mjs. O atualizador aceita essa configuracao somente quando o argumento inteiro corresponde ao iniciador esperado dentro de AppRoot. A API continua exigindo seu diretorio de trabalho. Doze cenarios simulados passaram no Windows PowerShell 5.1, incluindo rejeicao de iniciador de outra instalacao. Para o kit de 22/09 ja extraido, substituir somente Atualizar-Pulso.ps1 pela versao corrigida antes de repetir a validacao. A publicacao real permanece pendente.


## Publicação confirmada em 23/09/2026

A captura enviada pelo usuário confirma SUCESSO às 07:15:20 da versão `20260922T191412465916Z` via `Publicar-Pulso.ps1 -Aplicar`, após validação e uso do atualizador corrigido para a Interface com WorkingDirectory vazio. Backup: `C:\Pulso\Atualizacoes\20260923-071412-b4970c44\backup`. Interface e API passaram pelas verificações automáticas. Conferência funcional das consultas pelo site de produção ainda pendente. Este registro substitui as observações anteriores de primeira execução/publicação pendente; a restauração foi testada somente em simulação.


## Fluxo remoto validado em 23/09/2026

O usuário confirmou o acesso pelo Verificar-Acesso-Producao.bat com uma conta autorizada (ambas as tarefas Running), executou Atualizar-Producao.bat e confirmou sucesso. Publicação completa a partir da máquina local validada pelo usuário, incluindo V.01.001 no cabeçalho. Este registro substitui os apontamentos anteriores de acesso/publicação remota pendentes. A senha continua sendo solicitada em cada execução, sem armazenamento.
