# Pulso: implantação interna no IIS

## Estado validado em 21/09/2026

- Interface e API publicadas no Windows Server 2022, atrás de IIS com HTTPS.
- Autenticação Windows e autorização pelo grupo AD `PulsoComercial_Usuarios`.
- Conta `DMB\svc_pulso` com SELECT nas 13 tabelas usadas pelo backend.
- Interface e API executadas por tarefas agendadas independentes. Acesso validado após sair da sessão remota.
- Consulta BP 2026 e endpoint `/api/health` validados no servidor.
- Voz funcionou no Safari do Mac; o problema de reconhecimento no Chrome do Mac ainda não foi diagnosticado.

## Pastas e processos

- `C:\Pulso\Site`: raiz do IIS, com regras de autorização e encaminhamento. Preservar o `web.config` nas atualizações.
- `C:\Pulso\App`: aplicação, ambiente Python `.venv`, `backend`, `scripts` e `dist/standalone`.
- Interface: Node 22, `node scripts/start-iis.mjs`, escutando somente em `127.0.0.1:3000`.
- API: Python 3.13, `.venv\Scripts\python.exe -u backend\server.py`, somente em `127.0.0.1:8000`.
- Dependência Python validada: `pyodbc==5.3.0`; driver ODBC 17 para SQL Server de 64 bits.
- Banco: autenticação integrada da conta que executa a API. Configuração por `PULSO_SQL_SERVER` e `PULSO_SQL_DATABASE` (padrões no backend).

## Compilação e desenvolvimento

Instalar dependências com o gerenciador compatível com `pnpm-lock.yaml` e executar `npm run build:iis`. O resultado Node autônomo fica em `dist/standalone`. Distribuir essa pasta com `scripts/start-iis.mjs`; não é necessário copiar todo o projeto ou instalar dependências Node no servidor.

A API precisa de `backend/server.py` e `backend/queries.py`. Preservar o ambiente `.venv` nas atualizações.

Em desenvolvimento, iniciar o backend e `npm run dev`. O Vite encaminha `/api` para a API local. A interface usa URLs relativas, permitindo o mesmo código atrás do IIS.

## Regras do IIS

ARR com proxy habilitado, duração do cache em memória em zero e cache em disco desmarcado.

Regras de entrada, nesta ordem, todas com interrupção das regras seguintes:

1. Usuário: padrão `^(api/me/?|pulso-user\.ashx)$`, destino local `pulso-user.ashx`, sem anexar query string.
2. API: padrão `^api(/.*)?$`, destino `http://127.0.0.1:8000/{R:0}`, anexando query string.
3. Interface: padrão `^(?!api(?:/|$)|teste\.html$).*`, destino `http://127.0.0.1:3000/{R:0}`, anexando query string.

Manter autenticação anônima desabilitada e autenticação Windows habilitada. As portas internas não precisam ser expostas na rede.

## Identificação do usuário (atualização posterior ao piloto)

O avatar e a saudação consultam `/api/me`, sem cache. O nome mostrado é o login do usuário, sem o domínio; não é uma consulta ao nome completo no AD. Localmente ou sem identidade encaminhada, a interface exibe `Olá!` e um ícone neutro.

### Correção: endpoint nativo do IIS

O teste no servidor confirmou que a API aceita o cabeçalho localmente, mas LOGON_USER não chega preenchido pelo URL Rewrite, apesar da autenticação Windows estar habilitada. O encaminhamento descrito abaixo foi uma tentativa inicial; não o usar como solução definitiva.

A solução substituta é `deploy/iis/pulso-user.ashx`, que lê `Request.LogonUserIdentity` no processamento autenticado do IIS. Requer `Web-Asp-Net45`, pool CLR v4.0 em modo Integrated. Copiar o arquivo para a raiz do site. Criar uma regra ANTES das regras de API/interface: padrão `^(api/me/?|pulso-user\.ashx)$`, reescrita local para `pulso-user.ashx`, stopProcessing=true e sem anexar query string. Isso mantém `/api/me` no IIS, sem encaminhá-lo ao Python. Não mudar autenticação ou autorização do site.

O handler responde sem cache e nunca lê identidade de cabeçalhos fornecidos pelo cliente. Em 21/09/2026, `/api/me` retornou a conta real autenticada e a interface mostrou seu login e iniciais corretamente no servidor. A validação com outro usuário está pendente; repetir também o teste de uma conta sem autorização. Após validar, remover o serverVariable HTTP_X_PULSO_USER da regra API e retirar `--trust-iis-identity` da tarefa Python; reiniciar somente a tarefa API. Essa limpeza ainda não foi confirmada.

### Histórico da tentativa com cabeçalho

Configuração inicial:

1. No IIS, em `PulsoComercial > URL Rewrite > View Server Variables`, permitir `HTTP_X_PULSO_USER` (requer administrador).
2. Editar SOMENTE a regra `Pulso - API`, abrir `Server Variables` e adicionar `HTTP_X_PULSO_USER` com valor `{LOGON_USER}`. Manter `Replace existing value` habilitado: nunca preservar um cabeçalho enviado pelo navegador.
3. Na tarefa `Pulso - API`, argumentos: `-u "C:\Pulso\App\backend\server.py" --trust-iis-identity`.
4. Publicar backend e interface compilada, com backup e parada das tarefas durante a troca. Preservar `.venv`, credenciais e configurações existentes do IIS.
5. Reiniciar as tarefas e validar `/api/me` com duas contas do domínio, em sessões de navegador separadas. Esperado: login de cada usuário, nunca a conta de serviço. Confirmar que um cabeçalho X-Pulso-User fornecido pelo cliente é sobrescrito pelo IIS.

O backend aceita essa informação somente com a opção explícita e origem loopback. A autorização continua no IIS. Não expor a API diretamente. Essa tentativa foi substituída pelo handler nativo acima; o código permanece para compatibilidade com a tarefa já instalada.

## Tarefas do Windows

`Pulso - Interface` e `Pulso - API`: conta de serviço, executar com ou sem usuário conectado, credencial armazenada pelo Windows para permitir acesso de rede, sem privilégios elevados. A conta precisa de `Log on as a batch job`.

Disparador na inicialização, atraso de 30 segundos; reinício em falha a cada minuto até 999 tentativas; sem limite de duração; não iniciar nova instância; sem condições de ociosidade/alimentação. Diretório de trabalho: `C:\Pulso\App`.

Quando a senha da conta mudar, atualizar a credencial das duas tarefas. Não armazenar senhas no repositório.

## Atualizações e limites

Commit/push não publica automaticamente no servidor. Antes de uma atualização, guardar a versão anterior e as configurações do IIS/tarefas, parar somente as tarefas do Pulso, copiar o pacote validado e iniciar novamente. Conferir `/api/health` e uma consulta completa. Em falha, restaurar o pacote anterior.

O Git guarda o código e esta documentação, não as configurações efetivas do Windows, certificados, chaves privadas, credenciais ou banco. Fazer backup desses elementos pelos procedimentos internos de TI. O certificado piloto expira em 21/03/2027 e sua renovação ainda não está automatizada.

A API atual usa `ThreadingHTTPServer` atrás do IIS; logs persistentes, supervisão de travamentos e endurecimento do servidor HTTP continuam como melhorias pendentes. Reinício automático do servidor ainda deve ser validado em uma janela de manutenção; não foi necessário reiniciar para o teste de saída da sessão.
