import AppRoutes from './routes/AppRoutes';
import { ConfirmProvider } from './components/ConfirmProvider';

function App() {
  return <ConfirmProvider><AppRoutes /></ConfirmProvider>;
}

export default App;
