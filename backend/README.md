# API local do Pulso Comercial

Camada somente leitura entre a interface e o SQL Server. Usa autenticação integrada do Windows e as mesmas regras de faturamento/devolução extraídas do PBIX.

```powershell
python backend/server.py
```

Variáveis opcionais: `PULSO_SQL_SERVER` e `PULSO_SQL_DATABASE`.
