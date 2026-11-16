# Encaixe

Monte o elenco do seu clube: decida quem fica, sai ou é emprestado, contrate por filtros (posição, idade, altura, pé, valor de mercado, contrato, liga) e escale o time num campinho com 7 formações, onde os jogadores podem ser arrastados livremente. Dá para baixar a imagem da escalação. O app guarda só dados básicos (posição, idade, altura, pé, valor, contrato, empréstimo) e um link/widget do Sofascore, para não precisar atualizar estatísticas toda semana.

Qualquer pessoa consulta. **Só donos e editores autorizados** cadastram clubes e jogadores ou alteram dados.

## Rodar localmente
```
npm install
npm run dev        # http://localhost:5173
npm test           # testes de filtros, nomes, campinho e Sofascore
npm run build
```
Sem as variáveis do Firebase o app abre em **modo demonstração**: dados só no navegador e sem controle de acesso. Serve para testar, não para publicar.

## 1. Firebase (grátis)
1. Em console.firebase.google.com crie um projeto.
2. **Build > Firestore Database** > criar banco (modo produção).
3. **Build > Authentication > Método de login** > ative **Google**.
4. **Configurações do projeto > Seus aplicativos > Web (`</>`)**: registre o app e copie os valores de `firebaseConfig`.
5. **Firestore > Regras**: cole o conteúdo de `firestore.rules` e publique (publique de novo sempre que o arquivo mudar).
6. **Firestore > Dados**: crie a coleção `config`, documento `access`, com dois campos do tipo *array*:
   - `owners`: `["seuemail@gmail.com"]`
   - `editors`: `[]`
   (e-mails em minúsculas, os mesmos das contas Google usadas no login).

## 2. Render
1. Suba o código para o GitHub.
2. No Render: **New > Blueprint** (usa `render.yaml`) ou **New > Static Site** com build `npm install && npm run build` e publish `dist`.
3. Em **Environment**, cadastre as variáveis de `.env.example` (`VITE_FIREBASE_*`) com os valores do passo 4 acima e faça um novo deploy.
4. No Firebase, **Authentication > Configurações > Domínios autorizados**: adicione `seu-app.onrender.com`.

## Como funciona o acesso
- **Visitante**: vê tudo, não edita.
- **Editor** (e-mail em `editors`): cadastra/edita/exclui clubes e jogadores.
- **Dono** (e-mail em `owners`): tudo isso + aba **Acesso** para adicionar ou remover editores. Donos só mudam no console do Firebase.
A regra é aplicada pelo Firestore (`firestore.rules`), não só pela tela: mesmo alguém que mexa no código do navegador não consegue gravar.

## Cadastrar e atualizar jogadores
Tudo é feito dentro do site, sem planilha para importar. Só editores e donos veem estas telas.
- **Editar em tabela:** escolha a posição e altere as células direto (clube, idade, altura, valor de mercado, fim de contrato, minutos e as estatísticas da posição). Use **Adicionar jogador** para linhas novas e **Salvar alterações** no fim. Células alteradas ficam destacadas, Enter desce para a linha de baixo e **Descartar** volta ao que estava salvo.
- **Avisos:** ao digitar um nome parecido com um jogador que já existe ("G. Scarpa" e "Gustavo Scarpa"), a tabela avisa para você editar o que já está na base em vez de duplicar. Quem está sem alteração há mais de 90 dias aparece como "desatualizado" e dá para filtrar só esses.
- **Ficha do jogador** (aba Jogadores): formulário completo de um jogador, com opção de excluir.
- **Exportar planilha:** gera um CSV com toda a base, para backup ou para usar no Excel.
As estatísticas devem estar por 90 minutos ou em %, como nas planilhas do curso.

## Clubes e ligas
Ao salvar um jogador com um clube que ainda não existe, o app cria o clube sozinho (sem o sufixo de país, como "-BRA") e guarda a liga dele. Para jogadores que já estavam salvos, a aba **Clubes** mostra um aviso com o botão **Criar clubes que faltam**. As ligas aparecem como filtro na busca de jogadores, em Jogadores, em Clubes e na tabela de edição. Ao digitar clube ou liga, o app sugere os que já existem, para não criar duplicados por diferença de escrita.

## Empréstimo
Quando a situação é "Empréstimo", a ficha pede **Emprestado por** (clube dono do contrato) e o **fim do empréstimo**. O campo **Clube atual** é sempre onde o jogador joga hoje.

## Métricas (removidas da tela)
As métricas e pesos deixaram de aparecer no app. O que já está gravado no Firebase (`players.metrics`, `config/metrics`) **não é apagado**; apenas não é mais exibido. Uma cópia da versão anterior, com métricas, ficou no arquivo `encaixe-com-metricas.zip`.

## Seus dados não se perdem ao atualizar o código
Os jogadores, clubes e métricas ficam no Firebase, não no código. Subir uma versão nova no GitHub e fazer o deploy no Render não apaga nada. Só os botões **Carregar base do curso** (sobrescreve os 15 meias do curso) e as exclusões feitas por você alteram dados.

## Limites conhecidos
- "Velocidade" usa velocidade máxima (km/h) quando houver para todos; senão usa dribles e faltas sofridas como aproximação, com aviso na tela.
- Valor de mercado não é preço nem salário; o app não estima orçamento.
- Alguns dados da base do curso estão marcados "Dado a conferir" (xA de Garro e Mateus Vital, toques de Evander).
- Coleta automática de Sofascore/FotMob não foi implementada (termos de uso).

## Estatísticas iguais às do Sofascore


Os jogadores que já estavam salvos com valores por 90 aparecem com o total estimado (por 90 × minutos ÷ 90). Nada é alterado na sua base sem você salvar.

Para ver por 90 minutos, abra a ficha do jogador e use o botão "Ver estatísticas: Por 90 minutos". É só uma forma de visualizar; não muda nada do que está salvo.

## Colar do Sofascore (atualização mais rápida)


## Clubes só meus (pesquisa individual)

Qualquer pessoa que entrar com a conta Google, mesmo sem permissão de edição, pode criar clubes na aba Clubes. Esses clubes aparecem com a marca "Só meu", ficam guardados em `users/{id da conta}/clubs` e só a própria conta lê e grava. Ela usa a base completa de jogadores na busca e pode salvar perfis nesses clubes. Editores e donos também podem marcar "Clube só meu" ao criar. Clubes e jogadores da base continuam editáveis só por editores.

**Importante:** depois de atualizar, publique de novo o conteúdo de `firestore.rules` no Firebase (Firestore > Regras > Publicar). Sem isso, o login de quem não é editor não consegue gravar clubes pessoais.

## Montar elenco

Na aba "Montar elenco" você escolhe um clube, marca para cada jogador do elenco atual se quer manter, vender ou emprestar, contrata pelos filtros e escala o time no campinho (formações 3-4-3, 3-5-2, 4-4-2, 4-3-3, 4-2-3-1, 5-3-2 e 5-2-3; o campo começa vazio; arraste ou toque num reserva para colocá-lo). Tudo é salvo só na conta de quem montou (`users/{id da conta}/squads`); sem login, vale até fechar a página. O botão "Cadastrar elenco do Fluminense" (só editores) cadastra os 32 nomes da lista enviada, sem alterar quem já existe. Os atacantes da lista entram como extremo (exceto Cano e John Kennedy, centroavantes): confira em "Editar em tabela".

## Sofascore dentro da página
Na ficha do jogador (editores) dá para guardar o link do Sofascore e, opcionalmente, o código de incorporação (iframe) copiado do próprio Sofascore. O app extrai só o endereço, aceita apenas `https://widgets.sofascore.com` e mostra o widget num quadro isolado (sandbox), com o link "Abrir no Sofascore" como alternativa. Se o Sofascore bloquear a exibição, o quadro fica em branco e vale o link.

## Visual "Gramado"

O app usa um visual de campo: fundo verde listrado como gramado, linhas de giz ao fundo, cartões escuros, destaque em amarelo, títulos em fonte condensada (Barlow Condensed) e números de placar. As cores ficam em `src/index.css` (variáveis `--c-*`), então dá para ajustar o tom do verde ou o amarelo em um só lugar. As fontes vêm do Google Fonts; sem internet o navegador usa uma fonte parecida. Na impressão (PDF) as cores voltam para branco e preto para economizar tinta.

## Medição de acessos (Google Analytics)

Opcional. Sem a variável `VITE_FIREBASE_MEASUREMENT_ID`, o site não mede nada e não mostra aviso.

1. No console do Firebase, abra Configurações do projeto > Integrações > Google Analytics e ative. Depois, em Configurações do projeto > Seus aplicativos, copie o `measurementId` (começa com `G-`).
2. No Render, em Environment, crie `VITE_FIREBASE_MEASUREMENT_ID` com esse valor e faça um novo deploy.
3. Quem entrar vê um aviso para aceitar ou recusar. Sem aceitar, nada é enviado. Depois dá para mudar a escolha no link no rodapé.

O app registra: visitas por página (`page_view`), clube escolhido na busca (`selecionar_clube`), posição procurada (`buscar_posicao`), ficha de jogador aberta (`ver_jogador`) e contratação no montador (`contratar`). Nunca envia e-mail nem nome da pessoa.

Onde ver: Firebase > Analytics (visão geral) ou analytics.google.com. Os eventos aparecem em "Eventos" em até um dia. Para ver o ranking de clubes, posições e jogadores, cadastre os parâmetros `clube`, `posicao` e `jogador` em analytics.google.com > Administrador > Definições personalizadas > Dimensões personalizadas (escopo "Evento"). Sem isso, o Google mostra só a contagem de cada evento.
