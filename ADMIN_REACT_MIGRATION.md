# Admin React — migração inicial

A pasta `admin` HTML/JS foi migrada para rotas React dentro do mesmo frontend.

## Rotas

- `/admin` — dashboard
- `/admin/produtos` — produtos comerciais
- `/admin/hardwares` — catálogo técnico do montador
- `/admin/ofertas` — ofertas afiliadas
- `/admin/parceiros` — parceiros/lojas
- `/admin/modelos-3d` — metadados e transformação 3D
- `/admin/notebooks` — notebooks
- `/admin/montados` — PCs montados comerciais
- `/admin/usuarios` — usuários (ADMIN)
- `/admin/auditoria` — auditoria (ADMIN)
- `/admin/entrar` — login administrativo

O menu do perfil do site público aponta para `/admin` para ADMIN, EDITOR e REVISOR.

## Integração

A área usa a mesma sessão HttpOnly do frontend público e consome as rotas reais do backend em `/api`.
Não existe mais sessão demo/localStorage do Admin HTML antigo.

## Permissões

O frontend esconde itens de navegação conforme o papel, mas o backend continua sendo a fonte de verdade para autorização.

## Observações

- O painel de IA administrativa foi preservado e usa `POST /api/admin/ia/chat`.
- Modelos 3D cadastram URL e transformação pelo backend atual; upload binário dedicado continua dependendo de endpoint próprio.
- Alguns formulários técnicos complexos usam JSON enquanto os DTOs específicos de cada categoria continuam sendo expandidos no React.
- Não foram incluídos GLB/GLTF nem `node_modules` no ZIP de entrega.
