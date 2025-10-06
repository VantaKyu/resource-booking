// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import './index.css';
import App from './App';
import AdminGate from './Pages/admin/AdminGate';
import AdminResources from './Pages/admin/AdminResources';
import { Toaster } from 'sonner';

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/admin', element: <AdminGate /> },
  { path: '/admin/resources', element: <AdminResources /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <Toaster richColors position="bottom-right" />
  </StrictMode>
);
