# Uso da plataforma — acesso gerencial

Área `/uso`, liberada somente para `DMB\fabio.andrade`. A API valida a identidade em cada leitura; esconder o menu é apenas conveniência. Login escrito em cabeçalhos ou no corpo não concede acesso.

## Ativação no IIS (uma vez)

O servidor usa `pulso-user.ashx` para `/api/me`, conforme implantação validada. O antigo encaminhamento de `LOGON_USER` não funciona nesse ambiente e **não é usado para autorizar o histórico**.

No servidor, extraia o novo kit e execute **como administrador** `./Ativar-Uso.ps1`. Esse script:

- Descobre o pool do site `C:\Pulso\Site` e a conta da tarefa `Pulso - API`. Exige identidade ApplicationPoolIdentity e instalação App/Site sob a mesma pasta. Em configuração diferente, interrompe para revisão.
- Gera uma chave aleatória de 32 bytes em `C:\Pulso\Config\Usage\identity.key`, fora da raiz web, sem imprimi-la nem incluí-la em pacotes. Preserva a chave se já existe.
- Restringe a chave a SYSTEM/Administradores e leitura pelo pool e conta da API.
- Prepara `C:\Pulso\App\outputs\usage` com permissão de escrita para a API e acesso administrativo.
- Salva backup e atualiza apenas o handler `pulso-user.ashx`. Não altera autenticação, autorização, regras de URL Rewrite, credenciais ou banco ERP.

Depois publique o pacote normal. Se usar `Atualizar-Producao.bat`, ele atualiza a aplicação mas a ativação acima ainda é necessária uma vez no servidor. Requer HTTPS e .NET Framework 4.7.2+ (SameSite), além do ASP.NET já instalado. A chave deve permanecer fora da raiz web. Não habilite acesso público às portas internas.

O handler lê a identidade Windows autenticada e emite cookie HMAC-SHA256 de cinco minutos, HttpOnly/Secure/SameSite=Strict. O backend confere assinatura, prazo, origem loopback e login exato, sem confiar no cabeçalho antigo. O navegador renova a credencial a cada dois minutos. Sem chave, HTTPS ou identidade válida, a área permanece bloqueada. O IIS continua exigindo autenticação Windows a cada requisição. Chaves e cookies não são registrados em logs.

Valide via HTTPS: Fabio deve receber `canManageUsage: true` em `/api/me` e conseguir abrir `/uso`; outra conta autorizada ao site deve receber `false` e HTTP 403 no endpoint `/api/admin/usage`. Tentativas sem cookie, com cookie adulterado/expirado ou com apenas `X-Pulso-User` não autorizam. O ambiente local sem IIS mostra acesso negado por projeto. Não existe usuário gerencial de demonstração nem bypass local.

## O que é registrado

- Acesso/retorno de uma aba, mudança de tela, consulta concluída e erro de consulta.
- Login Windows, horário, categoria da tela e código do resultado; nunca texto de consulta, cliente, valores, senha ou teclas.
- Consulta significa uma chamada de relatório, inclusive carregamento/atualização automática. Autocomplete bem-sucedido não é contado.
- Acessos são sessões da aplicação, não logins do Windows. Várias abas de uma pessoa aparecem como um usuário com várias sessões.

Heartbeat a cada 30 segundos. Ativo: interação informada recentemente (janela aproximada de até 120 segundos, incluindo envio). Sem interação recente: sinal chega, mas não há interação recente. Desconectado: mais de 120 segundos sem sinal. Fechar a aba ou suspender o computador leva até o próximo vencimento para aparecer. Navegadores podem suspender abas em segundo plano. Presença não mede produtividade ou tempo de trabalho.

Histórico retido por 90 dias, limpeza diária ao acessar o armazenamento. Datas/filtros no fuso Brasília. Presença é atual e independente do período histórico; filtro de usuário afeta ambos. Resultados históricos paginados em 100 eventos. Não reconstrói uso anterior à implantação.

Arquivo persistente: `outputs/usage/usage.sqlite3` na aplicação. Incluí-lo no backup seguro; não distribuí-lo nos pacotes. Variáveis opcionais da API: `PULSO_USAGE_DB` e `PULSO_USAGE_KEY` (a chave precisa coincidir com a do handler). Não configure a chave dentro de pasta publicada. Falha de armazenamento não interrompe consultas comerciais; o painel informa indisponibilidade e o servidor registra a falha técnica sem dados de pesquisa.

A Carteira inteligente continua excluída do pacote. Esta área gerencial não altera suas métricas nem depende dela.
