-- V.01.011: executar com uma conta autorizada a conceder permissoes no ERP.
-- A API usa esta tabela para exibir o municipio dos clientes.
USE [ERP_PROD];
GRANT SELECT ON OBJECT::dbo.MUNICIPIOS TO [DMB\svc_pulso];
