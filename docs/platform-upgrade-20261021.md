# Cadastro, conta e agente

O cadastro de um PC descoberto consulta Produtos antes de abrir o formulário. O catálogo de Hardware só é obrigatório para uma peça individual. A prévia mantém descrição completa, preço, vendedor, link afiliado e pesquisas já concluídas. Um PC e suas ofertas são criados na mesma transação; anúncios comerciais não precisam de todos os componentes identificados no catálogo. O modelo da CPU não identifica sozinho o computador.

Builds de uma conta são sincronizadas com `/api/builds-pessoais`; o navegador mantém cache e uma fila de alterações. Falha de rede não apaga a fila. A revisão do servidor impede sobrescrever uma alteração feita em outro aparelho. O cabeçalho `X-CriaByte-Account` impede misturar contas quando o cookie muda em outra aba. Sem login, as builds continuam locais.

Em caso de conflito, **Minhas builds** permite guardar a cópia local como outra build ou recuperar a versão da conta. Uma exclusão antiga também aguarda a resolução, evitando apagar uma edição recente de outro aparelho.

`/conta/seguranca` permite configurar TOTP e guardar códigos de recuperação. O login por senha e por Google respeita o segundo fator. Recuperação e redefinição de senha usam `/recuperar-senha` e `/redefinir-senha`; o token do e-mail fica no fragmento do link e é retirado do histórico após a leitura.

O painel inicial do Admin mostra operações, uso de IA e qualidade dos campos. Em **Chaves da extensão**, um administrador gera uma chave por dispositivo e pode revogá-la. A chave aparece apenas na criação. A primeira chave própria encerra o uso da chave interna antiga pela extensão.

## Fonte única

Edite somente `src/`. Os módulos em `src/src/` encaminham importações à implementação principal e são gerados por `scripts/sync-compatibility.mjs`. O build iniciado na raiz ou em `src/` usa a mesma configuração, páginas e diretório público. A cópia antiga de `src/public` foi removida.

O pós-build gera HTML de produtos públicos com descrição, ficha, canonical e dados estruturados, permitindo leitura antes de executar JavaScript. `PRERENDER_REQUIRED=true` faz a publicação falhar se o catálogo não puder ser consultado; sem essa opção, o build mantém a SPA e informa a falha no log.

Com a API fora do ar, o sitemap existente é preservado. `PUBLIC_CATALOG_API_URL` permite escolher a origem da coleta durante o build sem mudar a URL da API usada pela aplicação. O CI usa uma origem local indisponível para verificar esse comportamento e executar os testes sem depender do Railway. A validação em produção fica pendente enquanto o serviço estiver indisponível.

## Implantação e validação

Publicar ProjetoIA, backend_pc3D e este frontend, nessa ordem. O backend deve ter a migração de builds pessoais e segurança aplicada. SMTP, `AUTH_PUBLIC_URL` e `AUTH_ENCRYPTION_KEY` são configurados no backend; o ProjetoIA precisa de armazenamento persistente para operações e chaves. Consulte os documentos correspondentes nesses repositórios antes do merge.

`npm test` cobre contratos e regressões. Após `npm run build`, `npm run test:ui` verifica a interface de produção em desktop e tela móvel, falha/reenvio do cadastro de PC, segundo fator, redefinição de senha e inicialização do 3D. O teste de navegador usa APIs simuladas e renderização por software; não mede a GPU de um celular físico.

O 3D pausa fora da página e reduz a frequência em qualidade baixa. `PCBuilderLegacyBridge.obterDesempenho3D()` permite inspecionar quadros, tempo médio de renderização, geometrias, texturas e triângulos durante o teste em aparelho real.

O lint completo ainda aponta efeitos síncronos já existentes em componentes antigos; a integração valida contratos, builds e fluxos reais de interface. Os arquivos gerados de compatibilidade ficam fora do lint.
