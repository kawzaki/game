import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import Admin from './Admin.tsx'
import './index.css'
import './i18n' // Import i18n configuration

const MainRouter = () => {
  const path = window.location.pathname;
  if (path === '/admin') {
    return <Admin />;
  }
  return <App />;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MainRouter />
  </React.StrictMode>,
)
