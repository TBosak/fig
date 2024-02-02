import { platformBrowser } from '@angular/platform-browser';
import { AppModule } from './app/app.module';

platformBrowser().bootstrapModule(AppModule);
const websocket = new WebSocket('ws://localhost:8080');
export { websocket };
