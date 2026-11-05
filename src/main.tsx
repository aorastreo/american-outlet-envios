import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App'
import { Toaster } from "react-hot-toast";
import { TRPCProvider } from "@/providers/trpc";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <TRPCProvider>
        <App />
        <Toaster position="top-center" />
      </TRPCProvider>
    </BrowserRouter>
  </StrictMode>,
)
