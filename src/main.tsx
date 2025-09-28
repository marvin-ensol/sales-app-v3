
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

console.log('=== MAIN.TSX STARTING ===');
console.log('Domain:', window.location.hostname);
console.log('Full URL:', window.location.href);
console.log('DOM element found:', !!document.getElementById("root"));

const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error('Root element not found!');
  throw new Error('Root element not found');
}

console.log('Creating React root...');
const root = createRoot(rootElement);

console.log('Rendering App component...');
try {
  root.render(<App />);
  console.log('=== APP RENDERED SUCCESSFULLY ===');
} catch (error) {
  console.error('=== APP RENDER FAILED ===', error);
  throw error;
}

console.log('=== MAIN.TSX COMPLETE ===');
