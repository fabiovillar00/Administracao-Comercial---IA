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

Regras de entrada, nesta ordem, com anexação de query string e interrupção das regras seguintes:

1. API: padrão `^api(/.*)?$`, destino `http://127.0.0.1:8000/{R:0}`.
2. Interface: padrão `^(?!api(?:/|$)|teste\.html$).*`, destino `http://127.0.0.1:3000/{R:0}`.

Manter autenticação anônima desabilitada e autenticação Windows habilitada. As portas internas não precisam ser expostas na rede.

## Tarefas do Windows

`Pulso - Interface` e `Pulso - API`: conta de serviço, executar com ou sem usuário conectado, credencial armazenada pelo Windows para permitir acesso de rede, sem privilégios elevados. A conta precisa de `Log on as a batch job`.

Disparador na inicialização, atraso de 30 segundos; reinício em falha a cada minuto até 999 tentativas; sem limite de duração; não iniciar nova instância; sem condições de ociosidade/alimentação. Diretório de trabalho: `C:\Pulso\App`.

Quando a senha da conta mudar, atualizar a credencial das duas tarefas. Não armazenar senhas no repositório.

## Atualizações e limites

Commit/push não publica automaticamente no servidor. Antes de uma atualização, guardar a versão anterior e as configurações do IIS/tarefas, parar somente as tarefas do Pulso, copiar o pacote validado e iniciar novamente. Conferir `/api/health` e uma consulta completa. Em falha, restaurar o pacote anterior.

O Git guarda o código e esta documentação, não as configurações efetivas do Windows, certificados, chaves privadas, credenciais ou banco. Fazer backup desses elementos pelos procedimentos internos de TI. O certificado piloto expira em 21/03/2027 e sua renovação ainda não está automatizada.

A API atual usa `ThreadingHTTPServer` atrás do IIS; logs persistentes, supervisão de travamentos e endurecimento do servidor HTTP continuam como melhorias pendentes. Reinício automático do servidor ainda deve ser validado em uma janela de manutenção; não foi necessário reiniciar para o teste de saída da sessão.
