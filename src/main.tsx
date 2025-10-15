import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import './index.css';
import App from './App';
import AdminGate from './Pages/admin/AdminGate';
import AdminResources from './Pages/admin/AdminResources';
import { Toaster } from 'sonner';
import { AuthProvider } from './lib/AuthContext';

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/admin', element: <AdminGate /> },
  { path: '/admin/resources', element: <AdminResources /> },
]);

const splash = document.getElementById('splash');
const rootEl = document.getElementById('root');

// Mount React immediately (it renders behind the splash)
createRoot(rootEl!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
      <Toaster richColors position="bottom-right" />
    </AuthProvider>
  </StrictMode>
);

// Animate splash → reveal app with fade-in
if (splash && rootEl) {
  const SHOW_DURATION_MS = 700; // splash visible time after fade-in
  const FADE_OUT_MS = 600; // matches CSS transition

  setTimeout(() => {
    splash.classList.add('fade-out');

    // After fade-out completes, reveal the app smoothly
    const onDone = () => {
      rootEl.classList.add('visible'); // fade-in via CSS
      splash.remove();
    };

    splash.addEventListener('transitionend', onDone, { once: true });
    setTimeout(onDone, FADE_OUT_MS + 50); // fallback
  }, SHOW_DURATION_MS);
}
