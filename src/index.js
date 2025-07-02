import './global.css';
import Index from './index.svelte';
const app = new Index({
  target: document.getElementById('app')
});
export default app;
