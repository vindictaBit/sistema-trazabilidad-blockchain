import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { scrollSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { injected } from 'wagmi/connectors';
import { useState } from 'react';

// Configurar Wagmi para Scroll Sepolia
const config = createConfig({
  chains: [scrollSepolia],
  connectors: [
    injected(), // Metamask, Coinbase Wallet, etc.
  ],
  transports: {
    [scrollSepolia.id]: http(
      process.env.NEXT_PUBLIC_SCROLL_SEPOLIA_RPC || 'https://sepolia-rpc.scroll.io'
    ),
  },
  ssr: true, // Habilitar soporte SSR
});

export default function App({ Component, pageProps }: AppProps) {
  // Crear QueryClient en el estado para evitar problemas de hidratación
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 60 * 1000, // 1 minuto
          },
        },
      })
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <Component {...pageProps} />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
