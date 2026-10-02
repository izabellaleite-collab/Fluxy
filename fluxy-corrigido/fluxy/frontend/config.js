// Configuracao do Fluxy publicado (GitHub Pages).
//
// apiUrl: endereco HTTPS da API Node.js hospedada (ex.: Render), SEM barra no
// final. Exemplo: 'https://fluxy-api.onrender.com'
//
// - Rodando localmente (npm start -> http://localhost:8080) este valor e
//   ignorado: o site usa a API da mesma origem.
// - Se ficar vazio no GitHub Pages, o Fluxy funciona em modo local (dados
//   salvos apenas no navegador, sem banco de dados).
window.FLUXY_CONFIG = {
  apiUrl: ''
};
