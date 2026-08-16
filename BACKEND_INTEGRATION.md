# Integração do Frontend React com o Backend

A v13 usa `VITE_DATA_MODE=auto` por padrão: tenta a API e usa os dados locais somente quando o endpoint ainda não existe ou falha.

## Endpoints públicos preparados

| Área | Endpoint |
| --- | --- |
| Hardware / Loja | `GET /api/hardwares` |
| Hardware por ID | `GET /api/hardwares/:id` |
| Notebooks | `GET /api/notebooks` |
| Notebook por ID | `GET /api/notebooks/:id` |
| PCs Montados | `GET /api/montados` |
| PC Montado por ID | `GET /api/montados/:id` |
| Destaques do Index | `GET /api/montados/destaques` |
| Ofertas | `GET /api/ofertas` |
| Ofertas agrupadas | `GET /api/ofertas/destaques` |
| Comunidade | `GET /api/comunidade/builds` |
| Build pública por slug | `GET /api/comunidade/builds/slug/:slug` |

## Formatos aceitos

As listagens podem retornar diretamente um array ou objetos com chaves como `items`, `dados`, `data`, `hardwares`, `notebooks`, `montados`, `ofertas` ou `builds`.

A camada `src/services/normalizers.js` traduz os nomes mais comuns do NestJS/Prisma para os objetos usados pela interface React.

## Ofertas

Para produtos com múltiplas ofertas, o frontend aceita uma relação `ofertas` contendo, por exemplo:

```json
{
  "id": 10,
  "precoAtual": 2499.9,
  "precoAnterior": 2799.9,
  "urlAfiliado": "https://...",
  "ativo": true,
  "vendedorNome": "Loja ABC",
  "parceiro": {
    "nome": "Shopee"
  }
}
```

A menor oferta ativa é utilizada como preço inicial.

## Destaques de PCs Montados

`GET /api/montados/destaques` aceita tanto uma lista simples quanto o formato planejado:

```json
{
  "melhoresAvaliados": [],
  "maisOfertas": [],
  "melhoresPrecos": []
}
```

O frontend remove duplicados e limita os cards da Home.

## Ofertas da Home

`GET /api/ofertas/destaques` pode retornar:

```json
{
  "hardwares": [],
  "perifericos": [],
  "monitores": [],
  "notebooks": [],
  "setup": []
}
```

Também é aceito um array único se cada item informar seu grupo/categoria.

## Montador 3D

O catálogo 3D ainda permanece local temporariamente porque os registros precisam dos IDs e transformações dos modelos GLB existentes. A ficha de produto já envia `peca` e `categoria` para `/montar`; quando o ID também existe no catálogo 3D, a peça é aplicada automaticamente.

A migração definitiva do catálogo 3D para a API deve preservar pelo menos:

```text
hardwareId
categoria
modelo3D / URL do modelo
posição XYZ
rotação XYZ
escala XYZ
modo de posição
```

até o renderer deixar de depender do catálogo legado.

## Configuração 3D de PCs Montados e Builds da Comunidade

Para que **Abrir no 3D** carregue a configuração inteira, o frontend aceita duas formas de resposta.

### Forma preferida: componentes com IDs reais

Cada item em `componentes` deve informar a categoria e um identificador que o catálogo 3D consiga resolver:

```json
{
  "componentes": [
    { "categoria": "PROCESSADOR", "hardwareId": 3 },
    { "categoria": "PLACA_MAE", "hardwareId": 4 },
    { "categoria": "MEMORIA_RAM", "hardwareId": 5, "quantidade": 2 },
    { "categoria": "PLACA_VIDEO", "hardwareId": 8 },
    { "categoria": "ARMAZENAMENTO", "hardwareId": 10 },
    { "categoria": "FONTE", "hardwareId": 11 },
    { "categoria": "GABINETE", "hardwareId": 12 },
    { "categoria": "COOLER", "hardwareId": 13 },
    { "categoria": "VENTOINHA", "hardwareId": 14, "quantidade": 4 }
  ]
}
```

O catálogo do montador pode usar o mesmo `hardwareId` para localizar o modelo 3D correspondente.

### Forma alternativa: `configuracao3D`

O backend também pode devolver a configuração já pronta:

```json
{
  "configuracao3D": {
    "gabinete": { "id": "gabinete-corsair-4000d" },
    "processador": { "id": "processador-ryzen-7-5700x3d" },
    "placamae": { "id": "placa-mae-asus-b550m" },
    "cooler": { "id": "cooler-deepcool-ak400" },
    "memoria": [
      { "id": "memoria-kingston-fury-16gb" },
      { "id": "memoria-kingston-fury-16gb" }
    ],
    "placavideo": { "id": "gpu-rx-7700-xt" },
    "armazenamento": [{ "id": "ssd-kingston-nv2" }],
    "fonte": { "id": "fonte-corsair-rm850x" },
    "ventoinhas": [
      { "id": "fan-arctic-p12", "fluxo": "out" },
      { "id": "fan-arctic-p12", "fluxo": "in" }
    ]
  }
}
```

O frontend prioriza `configuracao3D` quando presente. Se ela não vier, monta a configuração usando `componentes`.

## Atualização v15 — avaliações, comentários e publicação da Comunidade

O frontend v15 já tenta os endpoints abaixo. Em `VITE_DATA_MODE=auto`, somente ausência técnica do endpoint (sem conexão, 404, 405 ou 501) cai no armazenamento local temporário. Erros de autenticação/validação continuam sendo exibidos ao usuário e não são mascarados.

### Avaliações

- `GET /api/hardwares/:id/avaliacoes`
- `POST /api/hardwares/:id/avaliacoes`
- `GET /api/notebooks/:id/avaliacoes`
- `POST /api/notebooks/:id/avaliacoes`
- `GET /api/montados/:id/avaliacoes`
- `POST /api/montados/:id/avaliacoes`
- `GET /api/comunidade/builds/:id/avaliacoes`
- `POST /api/comunidade/builds/:id/avaliacao`

Body de escrita esperado:

```json
{
  "nota": 5,
  "comentario": "Ótima configuração."
}
```

A listagem pode retornar array puro ou `{ "avaliacoes": [] }`. Se disponíveis, o frontend também lê `mediaAvaliacoes` e `quantidadeAvaliacoes`.

### Publicar Build da Comunidade

`POST /api/comunidade/builds`

Body preparado pelo React:

```json
{
  "titulo": "Meu PC gamer",
  "descricao": "Build montada em casa...",
  "finalidade": "GAMER",
  "resolucao": "1080P",
  "visibilidade": "PUBLICA",
  "tags": ["AMD", "1080p"],
  "componentes": [
    {
      "hardwareId": 3,
      "categoria": "processador",
      "quantidade": 1
    }
  ],
  "configuracao3D": {}
}
```

O backend deve ignorar qualquer `usuarioId` enviado pelo cliente e obter autoria exclusivamente da sessão.

### Comentários e respostas

`POST /api/comunidade/builds/:id/comentarios`

Comentário raiz:

```json
{
  "texto": "Essa fonte aguenta?",
  "comentarioPaiId": null
}
```

Resposta:

```json
{
  "texto": "Sim, o consumo estimado está abaixo disso.",
  "comentarioPaiId": 42
}
```

Na primeira versão, recomenda-se limitar respostas a dois níveis: comentário + respostas.

## Conta do usuário no React

A página `/conta` usa as rotas já existentes do próprio usuário autenticado:

```text
PATCH /api/usuarios/me
PATCH /api/usuarios/me/senha
```

Atualização de perfil enviada pelo frontend:

```json
{
  "nome": "Nome do usuário",
  "email": "usuario@exemplo.com"
}
```

Alteração de senha enviada pelo frontend:

```json
{
  "senhaAtual": "senha atual",
  "novaSenha": "NovaSenha@123"
}
```

Depois de alterar a senha, o frontend encerra o estado local da sessão e redireciona para `/entrar`, pois o backend revoga as sessões do usuário nessa operação.

## v0.17 — observações de integração

### Contagem da Comunidade
As respostas de Build da Comunidade devem preferencialmente retornar `quantidadeComentarios`, contando a discussão conforme a regra definida pelo backend. O frontend aceita também `commentsCount` e, na ausência desses campos, calcula comentários/respostas presentes no payload.

### Assistente de IA
O botão global de IA já existe no frontend. A interface ainda usa resposta local informativa até o backend definir o endpoint oficial. Quando implementado, o endpoint deve usar catálogo/ofertas reais e retornar resposta estruturada sem inventar produto, preço ou link afiliado.

### Conta
A página `/conta/editar` usa os contratos já previstos:
- `PATCH /api/usuarios/me`
- `PATCH /api/usuarios/me/senha`

## v0.39 — contrato do backend final

A integração foi revisada contra o backend final recebido em agosto de 2026.

### Erros padronizados

O cliente aceita o formato:

```json
{
  "statusCode": 400,
  "codigo": "REQUISICAO_INVALIDA",
  "mensagem": "Mensagem pública",
  "detalhes": null
}
```

`codigo` e `detalhes` ficam disponíveis em `ApiError` para decisões de interface, sem exibir detalhes internos automaticamente.

### Validação estrita

O backend usa whitelist e rejeita campos não previstos nos DTOs. O frontend não deve reenviar objetos Prisma completos recebidos em GETs.

Em especial:

- especificação de Notebook é enviada somente com campos do DTO público;
- componente de PC Montado é enviado somente com `hardwareId`, `categoria`, `quantidade`, `posicao` e `ordem`;
- snapshots da Comunidade seguem o DTO próprio e podem omitir `hardwareId`.

### Comentários da Comunidade

Para comentário raiz, o frontend envia somente:

```json
{ "texto": "Comentário" }
```

`comentarioPaiId` só é incluído quando existe uma resposta real.

### CORS em produção

Se frontend e backend estiverem em origens diferentes, `VITE_API_BASE_URL` deve apontar para a origem pública da API e o backend deve incluir a origem exata do frontend em `CORS_ORIGINS`. Cookies de sessão continuam sendo enviados com `credentials: include`.

### Permissões finais de Hardware

A rota de criação `POST /api/hardwares` está protegida por `AdminGuard`, portanto o frontend só oferece **Cadastrar hardware** para ADMIN. A edição de Hardware existente continua disponível para ADMIN/EDITOR em `PATCH /api/admin/hardwares/:id`.

O dashboard também evita consultar a lista de usuários para papéis que não sejam ADMIN.
