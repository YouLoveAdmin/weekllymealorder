import './global.css';
import Admin from './admin.svelte';
const app = new Admin({
  target: document.getElementById('app')
});
export default app;
