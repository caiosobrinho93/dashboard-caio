# Design Vault

Dashboard para salvar componentes de desenvolvimento (botoes, backgrounds animados, textos animados, fontes, paletas de cores, etc.) e gerar um `design.md` com as especificacoes escolhidas, para que uma IA crie um app seguindo esse design system.

## Como rodar

```bash
cd C:\Users\caiosobrinho\Documents\dashboard
npm install   # ja instalado
npm start
```

## Onde os arquivos sao salvos

- Codigos dos componentes: `C:\Users\caiosobrinho\Documents\components\<categoria>\<nome>-<id>.txt`
  - Exemplo: `../components/buttons/btn-ex.txt`
- design.md gerados: `C:\Users\caiosobrinho\Documents\designs\<projeto>-design.md`
- Indice de metadados: `components/index.json`

Os arquivos `.txt` ficam salvos no disco (nao apenas no navegador), entao persistem para sempre.

## Uso

1. Navegue pelas categorias na barra lateral.
2. Clique em **+ Novo componente** para adicionar (nome, categoria, linguagem, tags, codigo).
3. Marque (checkbox) os componentes desejados.
4. Clique em **Gerar design.md**, informe nome do projeto e descricao.
5. O arquivo e salvo em disco e pode ser baixado.

## Categorias

Botoes, Backgrounds animados, Textos animados, Fontes, Paletas de cores, Cards, Inputs/Forms, Loaders, Navbars, Modals, Outros.
```