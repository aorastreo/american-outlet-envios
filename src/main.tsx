import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App'
import { TRPCProvider } from "@/providers/trpc";
import { WarehouseProvider } from "@/contexts/WarehouseContext";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <TRPCProvider>
        <WarehouseProvider>
          <App />
        </WarehouseProvider>
      </TRPCProvider>
    </BrowserRouter>
  </StrictMode>,
)
