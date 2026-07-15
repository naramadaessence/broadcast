import { render } from 'preact';
import App from './App';
import './styles/main.css';

// SPEED: Preact is 3KB vs React's 45KB - same API, faster load
render(<App />, document.getElementById('app'));
