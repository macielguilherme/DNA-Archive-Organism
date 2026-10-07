# DNA — Arquivo Vivo

Arquivo pessoal digital com mapa de relações, organização documental, metadados arquivísticos, registro de atividades, verificação de integridade e leitura assistida por Google Gemini.

## Publicar em hospedagem Node.js

Use uma hospedagem que execute aplicações Node.js (Node 20 ou superior), aceite variáveis de ambiente secretas e forneça HTTPS. Envie o projeto sem o arquivo `.env`, configure o comando de inicialização como `npm start` e adicione estes segredos no painel privado da hospedagem:

| Variável | Valor |
| --- | --- |
| `GEMINI_API_KEY` | Uma chave nova da Gemini API, gerada no Google AI Studio |
| `NODE_ENV` | `production` |

O servidor usa a variável `PORT` fornecida pela hospedagem. O arquivo `.env` ignorado pelo Git é para desenvolvimento: substitua os marcadores nele se quiser executar localmente. **Não envie `.env` ao repositório nem à hospedagem**; em produção, configure os valores no painel privado da plataforma. `.env.example` contém apenas marcadores. Em produção, o servidor se recusa a iniciar sem a chave da Gemini API.


Depois de publicar, abra o endereço HTTPS, selecione um documento e clique em **Realizar guarda documental via IA**. O Gemini 3.5 Flash-Lite preencherá os metadados arquivísticos automaticamente; a chave permanece exclusivamente no servidor.

## GitHub e publicação por PowerShell

O GitHub guarda o código. Para publicar a aplicação completa com a análise Gemini, use uma hospedagem que execute Node.js conectada ao repositório, como o serviço web do Render. O arquivo `render.yaml` descreve essa aplicação e pede os segredos no painel de implantação.

O **GitHub Pages sozinho não serve para esta versão**: ele publica arquivos estáticos e não executa o servidor Node que protege a chave Gemini. [A documentação do GitHub descreve Pages como publicação de arquivos estáticos](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site); o servidor Node precisa de uma hospedagem de aplicações. O Render documenta a conexão de repositório GitHub e inicialização com `npm start` [na documentação de Web Services](https://render.com/docs/web-services).

Crie no site do GitHub um repositório **privado** chamado `DNA-Archive-Organism`, vazio (sem README, licença ou `.gitignore`). O GitHub CLI não está instalado neste computador, então faça o envio pelo Git já preparado. No PowerShell:

```powershell
Set-Location 'C:\Users\Guilherme\Downloads\DNA-Archive-Organism'
git status --short --branch
git check-ignore .env
git remote add origin https://github.com/SEU_USUARIO/DNA-Archive-Organism.git
git push -u origin main
```


O site mantém os documentos no navegador de cada usuário. Colocar o código no GitHub ou servir pelo Render não envia os documentos ao repositório nem sincroniza o acervo.
## Chave que apareceu em uma conversa

Se uma chave real foi colada em chat, commit ou outro local visível, revogue-a no Google AI Studio e gere outra. Configure a nova chave apenas nos segredos da hospedagem. Nunca coloque chaves no HTML, JavaScript, CSS, screenshots ou repositório, mesmo em site de uso pessoal: o código do navegador fica visível para visitantes.

## Privacidade e armazenamento

O arquivo original e seus metadados ficam no armazenamento do navegador de cada pessoa, não no servidor. Isso significa que o acervo não é sincronizado entre dispositivos e pode ser removido se os dados do navegador forem limpos. Use **Exportar pacote** para guardar uma cópia segura. Não é um serviço de armazenamento em nuvem ou backup.

Quando a pessoa confirma uma análise, o documento ou seu texto é enviado do navegador ao servidor protegido e encaminhado à API do Google Gemini. A chave não acompanha essa solicitação. O servidor não grava os documentos nem registra o conteúdo das análises. Configure e revise as políticas de privacidade e retenção do fornecedor Gemini antes de processar documentos pessoais ou sensíveis.

O site exige senha compartilhada para proteger o endpoint e a cota. Como essa senha é compartilhada, passe-a apenas a pessoas autorizadas e altere-a se for divulgada. Isso não substitui contas individuais, controle de permissões por pessoa nem proteção de arquivos na nuvem.

## Recursos

- Acervo pessoal no navegador com pesquisa, coleções e metadados descritivos.
- Atlas documental: cada fólio representa um documento, as estantes curvas agrupam a coleção e fitas arqueadas mostram relações registradas; os fólios ficam estáveis ao mover o cursor.
- Importação e exportação de pacotes de documentos e metadados.
- Cálculo de SHA-256 quando suportado pelo navegador e eventos locais de atividade.
- Sugestões de classificação e leitura documental assistida por IA, sujeitas a revisão humana.
- Ficha detalhada com assunto, tipo, pessoas, instituições, datas, identificadores, valores, contatos, referências, obrigações, prazos e incertezas.

Os campos inspirados no e-ARQ Brasil ajudam na descrição e organização pessoal; não significam conformidade, certificação ou substituição de um SIGAD. Classificação, acesso, retenção e destinação devem ser avaliados por quem administra o acervo.

## Desenvolvimento

Requer Node.js 20+. Para executar em ambiente de desenvolvimento, substitua os marcadores do arquivo `.env` por uma chave válida, uma senha forte e um segredo aleatório com pelo menos 32 caracteres; execute `npm start` e abra `http://localhost:3000`. Não abra `index.html` com duplo clique: navegadores bloqueiam carregamento de configuração, chamadas da API e armazenamento de documentos em URLs `file://`. No site publicado, acesse o endereço HTTPS da hospedagem. Não use dados pessoais reais num serviço de demonstração sem revisar sua configuração de segurança e privacidade.

Projeto experimental de Guilherme Ribeiro.
