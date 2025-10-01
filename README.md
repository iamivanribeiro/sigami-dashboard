# Dashboard SIGAMI - Visualizador de Solicitações

 <!-- Substitua pela URL de uma captura de tela do seu dashboard -->

Um dashboard interativo e totalmente client-side para visualizar e analisar dados de solicitações de um sistema de gestão ambiental (SIGAMI). A aplicação permite que os usuários façam o upload de uma planilha Excel e gerem instantaneamente métricas, gráficos e tabelas, sem que nenhum dado seja enviado para um servidor.

## ✨ Sobre o Projeto

Este projeto foi criado para oferecer uma maneira rápida e segura de analisar dados de solicitações ambientais. Gestores e analistas podem obter insights sobre a carga de trabalho, status dos processos, distribuição geográfica e outros indicadores-chave simplesmente arrastando e soltando um arquivo Excel.

Como a aplicação funciona inteiramente no navegador do usuário, a privacidade e a segurança dos dados são garantidas.

### Principais Funcionalidades

*   **Processamento 100% Client-Side**: Nenhum dado é enviado para a internet. Tudo acontece no seu navegador.
*   **Upload de Arquivo Excel**: Suporta arquivos `.xlsx` e `.xls`.
*   **Mapeamento Inteligente de Colunas**: O sistema detecta automaticamente variações nos nomes das colunas (ex: `protocolo`, `nprotocolo`, `numero`).
*   **Dashboard Interativo**:
    *   **Métricas Gerais**: Total de solicitações, concluídas, em andamento, etc.
    *   **Gráficos Dinâmicos**: Distribuição por status, subsecretaria, top 5 assuntos e localização (cidade/bairro).
    *   **Tabelas Detalhadas**: Lista de analistas e solicitações detalhadas com ordenação.
*   **Filtros Avançados**: Filtre os dados por período, status, subsecretaria ou busca por texto livre (protocolo, assunto).
*   **Exportação para CSV**: Exporte a visualização de dados filtrada para um arquivo `.csv`.
*   **Dados de Exemplo**: Inclui um botão "Carregar Exemplo" para demonstrar a funcionalidade sem a necessidade de um arquivo.
*   **Design Responsivo e Moderno**: Interface adaptável para desktops e dispositivos móveis, com suporte a tema claro e escuro (baseado na preferência do sistema).

### 🛠️ Tecnologias Utilizadas

*   **HTML5**
*   **CSS3**: Estruturado com Variáveis CSS (Custom Properties) para um sistema de design flexível.
*   **JavaScript (ES6+)**: Lógica da aplicação em Vanilla JS, sem frameworks.
*   **Chart.js**: Para a criação dos gráficos interativos.
*   **SheetJS (xlsx.js)**: Para a leitura e parsing dos arquivos Excel no navegador.
*   **Font Awesome**: Para os ícones.

## 🚀 Como Usar

Como esta é uma aplicação puramente front-end, não há necessidade de instalação.

1.  Clone este repositório:
    ```bash
    git clone https://github.com/iamivanribeiro/sigami-dashboard.git
    ```
2.  Abra o arquivo `index.html` em seu navegador de preferência (Chrome, Firefox, Edge, etc.).

### Utilizando o Dashboard

1.  **Carregar Dados**:
    *   Clique em **"Upload Excel"** e selecione seu arquivo `.xlsx` ou `.xls`.
    *   Ou, para testar, clique em **"Carregar Exemplo"** para popular o dashboard com dados de demonstração.
2.  **Analisar**:
    *   Use os filtros de data, status, subsecretaria ou a barra de busca para refinar os dados.
    *   Clique nos cards de métricas (Total, Concluídas, etc.) para aplicar filtros rápidos.
    *   Interaja com os gráficos para visualizar as distribuições.
    *   Ordene a tabela de "Solicitações Detalhadas" clicando nos cabeçalhos das colunas.
3.  **Exportar**:
    *   Clique no botão **"Exportar"** para baixar os dados atualmente filtrados como um arquivo CSV.

### Formato do Arquivo Excel

Para que o dashboard funcione corretamente, seu arquivo Excel deve conter colunas com os seguintes dados. O sistema é flexível com os nomes exatos dos cabeçalhos.

*   `protocolo`: Número do protocolo
*   `assunto`: Assunto da solicitação
*   `subsecretaria`: Subsecretaria responsável
*   `status`: Status atual da solicitação
*   `abertura`: Data de abertura (ex: `DD/MM/AAAA`)
*   `prazo`: Data prazo (ex: `DD/MM/AAAA`)
*   `analista`: Analista responsável
*   `cidade`: Cidade
*   `bairro`: Bairro
*   `uf`: Estado (UF)

## 🤝 Contribuições

Contribuições são o que tornam a comunidade de código aberto um lugar incrível para aprender, inspirar e criar. Qualquer contribuição que você fizer será **muito apreciada**.

1.  Faça um Fork do projeto
2.  Crie sua Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Faça o Commit de suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4.  Faça o Push para a Branch (`git push origin feature/AmazingFeature`)
5.  Abra um Pull Request

## 📄 Licença

Distribuído sob a licença MIT. Veja `LICENSE` para mais informações.
