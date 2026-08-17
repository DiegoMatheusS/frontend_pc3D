
## Ajuste v8.1 — Builds sem login durante a migração

Enquanto as builds pessoais ainda usam armazenamento local, as rotas `/minhas-builds` e `/minhas-builds/:id` ficam acessíveis sem autenticação para permitir testes. Quando não há sessão, os dados usam uma área local do navegador. A rota `/conta` continua protegida e exige sessão válida do backend.

# CriaByte — Frontend React

Migração gradual do frontend HTML/JS atual para React + Vite.

## Desenvolvimento

```bash
npm install
npm run dev
```

## Rotas atuais

- `/` — Home React já estruturada para a nova organização do projeto
- `/comunidade` — Builds da Comunidade
- `/comunidade/:slug` — detalhe e discussão da build

## Home React

A Home já segue as decisões mais recentes do projeto:

- o montador/3D continua sendo o principal diferencial;
- PCs Montados aparecem em destaque no lugar de Builds da Comunidade;
- os cards de Montados estão preparados para avaliação, quantidade de ofertas e preço inicial;
- Ofertas aparecem agrupadas por categoria, inicialmente Hardwares, Periféricos e Monitores;
- a Comunidade aparece como chamada social, não como vitrine comercial principal.

Nesta fase os dados de Montados e Ofertas são mocks em `src/data/homeMock.js`.
A camada `src/services/homeService.js` permite substituir esses dados pelos endpoints NestJS posteriormente.

## Integração temporária com o frontend antigo

Os links para o montador, Montados, Peças, Ofertas, Notebooks e login ainda apontam para o frontend antigo.
Crie um arquivo `.env.local` usando `.env.example`:

```env
VITE_LEGACY_BASE_URL=http://127.0.0.1:5500/
```

Quando essas páginas forem migradas para React, os links deixam de usar `legacyRoutes.js`.

## Comunidade

A primeira versão usa dados mockados em `src/data/buildsMock.js`.
A camada `src/services/communityService.js` foi criada para facilitar a troca pelos endpoints NestJS posteriormente.

## Validação

```bash
npm run lint
npm run build
```

O projeto não deve versionar ou compartilhar `node_modules`.

## Migração v3 — Ofertas

Nova rota React:

```text
/ofertas
```

A página já possui:
- grupos Hardwares, Periféricos, Monitores, Notebooks e Setup;
- busca por produto, marca e categoria;
- filtro de faixa de preço;
- ordenação por relevância, preço, desconto e quantidade de ofertas;
- cards reutilizáveis;
- estrutura mockada separada em `src/data/offersMock.js`;
- serviço em `src/services/offersService.js`, pronto para ser substituído pela API NestJS.

Os preços desta fase são demonstrativos.

## Migração v4 — Montados

Rotas React adicionadas:

- `/montados` — catálogo de PCs montados com busca, filtros, ordenação e comparador de até 2 PCs.
- `/montados/:id` — ficha detalhada do PC com configuração, compatibilidade demonstrativa, consumo, ofertas e avaliação.

O comparador preserva a regra do frontend antigo: destaque em verde apenas para vantagem objetiva. Menor TDP/TGP/consumo/preço; maior RAM/armazenamento. Potência da fonte não recebe destaque por ser capacidade, não consumo.

Os dados ainda são mocks em `src/data/mountedPcsMock.js`. A troca futura pelo NestJS fica concentrada em `src/services/mountedPcsService.js`.

## Migração v5 — Loja e Peças

Novas rotas React:

- `/loja` — catálogo geral.
- `/pecas` — mesma base do catálogo, filtrada para Hardwares.
- `/produto/:id` — ficha detalhada reutilizável.

O comparador aceita até dois produtos da mesma categoria. O botão 3D ainda abre o montador legado até a migração do `pcbuild`.


## Notebooks em React

Rotas novas desta etapa:

- `/notebooks` — catálogo dedicado, filtros e comparação de até dois notebooks.
- `/notebooks/:id` — ficha técnica completa, upgrades, avaliação e ofertas demonstrativas.

Os dados estão temporariamente em `src/data/notebooksMock.js` e o acesso foi isolado em `src/services/notebooksService.js` para facilitar a troca pela API NestJS.

## Autenticação React

Rotas novas:

- `/entrar`
- `/cadastro`
- `/conta` (protegida)

A sessão é validada pelo backend em `GET /api/auth/perfil` e usa cookie enviado com `credentials: include`.

Durante `npm run dev`, o Vite encaminha `/api` para `http://localhost:3000` por padrão. Se o NestJS estiver em outro endereço, crie `.env.local`:

```env
VITE_DEV_API_TARGET=http://localhost:3000
```

Se frontend e backend estiverem em origens diferentes em produção, configure `VITE_API_BASE_URL` e habilite CORS com credenciais no backend.

A página `/conta` já usa Builds Salvas em React. Apenas o Montador 3D continua no frontend legado nesta etapa.

## Migração v8 — Builds Salvas

Rotas novas:

- `/minhas-builds` — lista, busca, ordenação, métricas, importação, renomeação, compartilhamento e exclusão.
- `/minhas-builds/:id` — detalhes da build salva e exportação JSON.

A implementação preserva o formato usado pelo frontend antigo (`pcBuilderBuildsSalvas:<email>`), facilitando a transição quando ambos estiverem na mesma origem.

Durante o desenvolvimento, Vite (`:5173`) e Live Server (`:5500`) são origens diferentes e não compartilham `localStorage` ou `sessionStorage`. Por isso, builds já salvas no site antigo não aparecem automaticamente no React. Use o botão **Compartilhar** no frontend antigo e depois **Importar build** no React.

A abertura no Montador 3D usa o parâmetro `?build=` em Base64URL, já suportado pelo montador legado, e portanto funciona entre as duas portas.

A persistência local desta etapa é transitória. A fonte definitiva deverá ser o backend de builds pessoais/comunidade quando os endpoints estiverem disponíveis.

## Montador 3D em migração (`/montar`)

A rota React `/montar` já renderiza a interface do montador e inicializa o motor Three.js legado depois que o React monta o DOM. Nesta fase, os arquivos GLB continuam sendo servidos pelo projeto antigo via `VITE_LEGACY_BASE_URL` (padrão `http://127.0.0.1:5500/`). Isso evita duplicar os modelos na nova aplicação.

Para testar o 3D durante a transição:
1. deixe o projeto antigo aberto no Live Server;
2. deixe o React/Vite aberto em `http://localhost:5173`;
3. abra `http://localhost:5173/montar`.

Se o Live Server usar outra porta, defina `VITE_LEGACY_BASE_URL` no `.env.local`.


## Correção v9.1

O motor legado em `public/legacy-builder` é carregado como `<script type="module">`, e não via `import()` do Vite. Isso mantém os módulos legados estáticos e evita o erro `Cannot import non-asset file ... inside /public`.

## Correção v11.1

A tentativa da v11 de renderizar a lista completa de peças em React foi revertida por estabilidade. A rota `/montar`, o estado sincronizado com React e a ponte com o motor Three.js permanecem como na v10, enquanto abas, pesquisa, filtro e lista de componentes voltam temporariamente a ser controlados pelo script legado. A próxima migração dessa área deve ser feita em partes menores.


## Migração v11.3 — Pesquisa do montador no React

A pesquisa da rota `/montar` passou a ser controlada pelo React: abertura/fechamento, texto digitado e limpeza. O script legado continua responsável por filtrar e renderizar a lista nesta etapa, acionado pela ponte `PCBuilderLegacyBridge.pesquisarHardware`. O filtro `Sem conflito` e os cards permanecem legados para manter a migração incremental e estável.


## Migração v11.4 — Filtro Sem conflito no React

O checkbox `Sem conflito` da rota `/montar` passou a ser controlado pelo React. O componente controla `checked`, estado desabilitado e interação, enquanto o legado recebe somente o valor pela ponte `PCBuilderLegacyBridge.filtrarCompatibilidade` e continua filtrando/renderizando os cards. Nesta etapa, os cards e a lista de componentes permanecem legados.

## Migração v12 — consolidação para teste completo

Esta versão consolida a migração do frontend React para um teste geral do site.

Principais mudanças:

- a lista de componentes do `/montar` agora é renderizada pelo React com dados estruturados fornecidos pela ponte legada;
- slots de RAM, armazenamento e ventoinhas são controlados pelo React;
- seleção, remoção, fluxo de ventoinhas, pesquisa, categorias e filtro `Sem conflito` usam a ponte `PCBuilderLegacyBridge`;
- `Finalizar PC` abre um resumo React, mantendo o motor técnico/Three.js preservado;
- `Salvar build` grava diretamente no armazenamento usado por `/minhas-builds` no frontend React;
- links compartilhados agora apontam para `/montar?build=...` no próprio React;
- os links internos de Montados, Ofertas, Comunidade, Produtos e Builds Salvas deixaram de retornar ao `pcbuild.html` antigo;
- foi adicionada uma Error Boundary para evitar tela branca total em caso de erro de renderização;
- foi adicionada rota React de 404;
- `public/_redirects` foi incluído para fallback SPA em hospedagens compatíveis como Cloudflare Pages.

O motor Three.js, carregamento de GLB, compatibilidade e parte dos controles técnicos continuam no módulo legado temporário. O projeto antigo ainda precisa estar no Live Server para servir os modelos 3D durante esta fase.

### Checklist recomendado para o teste completo

```text
/
/montar
/loja
/pecas
/ofertas
/notebooks
/montados
/comunidade
/entrar
/cadastro
/conta
/minhas-builds
```

No montador, testar especialmente:

- categorias;
- pesquisa;
- filtro Sem conflito;
- seleção e remoção de peças;
- RAM/SSD/ventoinhas por slot;
- fluxo de ventoinhas;
- diagnóstico;
- preço/consumo/fonte recomendada;
- controles 3D;
- finalizar;
- salvar build;
- compartilhar build;
- abrir build salva novamente no 3D.

## Migração v13 — API-first com fallback seguro + integração Loja → Montador

A camada de dados das páginas React agora trabalha em modo `api-first`.

Por padrão (`VITE_DATA_MODE=auto`), o frontend tenta os endpoints públicos do NestJS e, se um módulo ainda não estiver implementado, mantém a página funcional usando os mocks locais. Isso permite atualizar o backend módulo por módulo sem bloquear os testes do frontend.

Endpoints preparados:

```text
GET /api/hardwares
GET /api/hardwares/:id
GET /api/notebooks
GET /api/notebooks/:id
GET /api/montados
GET /api/montados/:id
GET /api/montados/destaques
GET /api/ofertas
GET /api/ofertas/destaques
GET /api/comunidade/builds
GET /api/comunidade/builds/slug/:slug
```

O componente global `DataStatus` informa discretamente quando alguma tela precisou usar dados locais. Quando a API responde normalmente, nenhum indicador técnico é exibido ao visitante.

A normalização das respostas do backend foi centralizada em `src/services/normalizers.js`, evitando espalhar diferenças entre nomes do Prisma/API e nomes usados pelos componentes React.

A ficha de um produto compatível com o montador agora abre `/montar?peca=...&categoria=...`. Se o item também existir no catálogo 3D legado, o React solicita a seleção automática depois que o motor e o catálogo terminam de carregar. Se ainda não existir no catálogo 3D local, o montador permanece aberto e informa isso sem quebrar a página.

Também foram adicionados efeitos globais de rota para:

- atualizar o título da aba por página;
- voltar ao topo ao navegar entre rotas;
- centralizar o indicador de fonte de dados.

## Atualização v14 — navegação estável + build completa no 3D

Esta versão concentra correções de integração e layout antes do próximo ciclo visual.

### Montados → 3D

- Cards de PCs Montados agora possuem ação **Abrir no 3D**.
- A ficha de Montados usa **Abrir build completa no 3D**.
- O botão envia uma configuração completa no parâmetro `?build=` em vez de apenas abrir `/montar` vazio.
- O frontend aceita `configuracao3D` pronta do backend ou monta a configuração a partir de `componentes`/`hardwareId`.
- Enquanto os dados ainda forem mocks, existe uma configuração 3D de fallback para que todas as categorias da build sejam enviadas ao montador.

### Comunidade → 3D

- Builds da Comunidade também usam a configuração inteira no 3D.
- **Usar esta build** abre a configuração como base no montador.

### Montador responsivo

- o painel de escolha de hardware foi limitado à largura real da viewport;
- cabeçalho do painel e ações podem quebrar linha sem empurrar a página;
- cards, pesquisa, categorias e resumo possuem `min-width: 0`/`max-width: 100%`;
- há regras específicas para 821–1100 px, onde o painel lateral ficava mais propenso a estourar para a direita.

### Cabeçalho

- o Header passou a usar exatamente o mesmo `.page-container` das páginas;
- `scrollbar-gutter: stable` evita que o cabeçalho mude alguns pixels para esquerda/direita entre páginas com e sem scrollbar;
- o dropdown **Loja** possui uma ponte de hover entre o botão e o menu, além de clique e foco por teclado;
- Loja fica visualmente ativa também em `/pecas`, `/notebooks`, `/ofertas` e fichas de produto.

O arquivo `BACKEND_INTEGRATION.md` descreve o formato recomendado para que PCs Montados e Builds da Comunidade carreguem IDs reais no montador 3D.


## v15 — Comunidade e avaliações

- publicação de uma Build Salva diretamente na Comunidade;
- avaliações reutilizáveis para hardware, notebook, PC montado e build;
- comentários e respostas autenticados em Builds da Comunidade;
- API-first com fallback local temporário apenas quando os endpoints ainda não existem;
- links de compra reais são abertos quando a API fornece `urlAfiliado`/URL da oferta.

## Atualização 0.16.0

- rodapé completo migrado para React;
- Conta permite alterar nome/e-mail e senha usando as rotas reais do backend;
- menu de catálogo passa a mostrar a seção atual (Peças, Notebooks, Ofertas, Periféricos, Monitores ou Setup) em vez de exibir sempre “Loja”;
- título da página de catálogo acompanha o grupo selecionado;
- correção estrutural de largura do `/montar` para impedir o painel lateral de sair da viewport;
- CSS global legado do montador foi isolado pela classe `builder-route-active`.

## Atualização v0.17.0

- páginas institucionais migradas para React: `/sobre`, `/contato`, `/privacidade`, `/termos`, `/cookies`;
- edição de cadastro movida para `/conta/editar`;
- botão/painel flutuante de IA disponível nas páginas React (o montador mantém seu botão de IA próprio);
- contador de comentários/respostas da Comunidade sincronizado com comentários locais e atualizado imediatamente na ficha;
- identidade visual aproximada do frontend clássico (cores, sombras, hero e microinterações);
- montador ajustado para a altura útil real da viewport e painel lateral reduzido em desktop.


## Atualização v0.18.0

- `/montar` volta a seguir as proporções do frontend HTML original.
- Painel lateral desktop restaurado para `430–480px` e `420px` na faixa intermediária.
- Breakpoint principal restaurado para `820px`, como no CSS original.
- O shell React do montador usa a altura real disponível abaixo do cabeçalho, evitando o resumo inferior cortado.
- Somente a lista de peças rola no desktop; cabeçalho e resumo permanecem visíveis.
- O botão flutuante legado de IA fica oculto no `/montar`, pois o painel já possui `Montar com IA`.


### Cadastro com Google (frontend preparado)

A tela de cadastro exibe **Cadastrar com Google**. Para ativar o redirecionamento OAuth, configure `VITE_GOOGLE_AUTH_URL` com a rota pública de início do OAuth no backend. Enquanto essa variável não existir, o frontend informa que o recurso ainda precisa ser habilitado no backend.

## Segurança do frontend

- Não coloque segredos em variáveis `VITE_*`: elas ficam públicas no bundle do navegador.
- Arquivos `.env` locais são ignorados; use apenas `.env.example` sem valores secretos no repositório.
- URLs de ofertas normalizadas aceitam apenas HTTP/HTTPS antes de virar links clicáveis.
- `public/_headers` adiciona headers de hardening em provedores compatíveis.
- A autenticação continua baseada em cookie de sessão HttpOnly emitido pelo backend; não armazenar tokens de sessão em `localStorage`.

