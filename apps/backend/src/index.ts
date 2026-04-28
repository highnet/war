import { buildServer } from './server.js';
import { aiService } from './services/AIService.js';

const PORT = Number(process.env.PORT) || 3001;

const app = buildServer();

app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`Backend running on http://localhost:${PORT}`);
  aiService.start();
});
