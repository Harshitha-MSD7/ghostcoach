import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';
class StartupBoundary extends React.Component<React.PropsWithChildren, { message: string | null }> {
  state: { message: string | null } = { message: null };
  static getDerivedStateFromError(error: Error) { return { message: error.message }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('GhostCoach rendering error:', error, info); }
  render() {
    if (this.state.message) return <div className="startup"><h1>Let's reopen the studio.</h1><p role="alert">{this.state.message}</p><button onClick={() => window.location.reload()}>Reload studio</button></div>;
    return this.props.children;
  }
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><StartupBoundary><App /></StartupBoundary></React.StrictMode>);
