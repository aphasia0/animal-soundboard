import { mount } from 'svelte';
import App from './App.svelte';
import { lockZoom } from './zoomLock.js';

lockZoom();

const app = mount(App, {
	target: document.body
});

export default app;
