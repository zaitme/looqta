module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './pages/**/*.{js,jsx}',
  ],
  theme: { 
    extend: {
      animationDelay: {
        '1000': '1000ms',
        '2000': '2000ms',
      }
    } 
  },
  plugins: [],
};
