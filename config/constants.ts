/**
 * Configuración de Wagmi para la DApp
 * Scroll Sepolia Testnet
 */

export const SCROLL_SEPOLIA_CONFIG = {
  id: 534351,
  name: 'Scroll Sepolia Testnet',
  network: 'scroll-sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://sepolia-rpc.scroll.io'],
      webSocket: ['wss://sepolia-rpc.scroll.io/ws'],
    },
    public: {
      http: ['https://sepolia-rpc.scroll.io'],
      webSocket: ['wss://sepolia-rpc.scroll.io/ws'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Scrollscan',
      url: 'https://sepolia.scrollscan.com',
    },
  },
  testnet: true,
};

/**
 * Faucets para obtener ETH de prueba
 */
export const FAUCETS = [
  'https://sepolia.scroll.io/faucet',
  'https://faucet.quicknode.com/scroll/sepolia',
];

/**
 * Enlaces útiles
 */
export const USEFUL_LINKS = {
  docs: 'https://docs.scroll.io/',
  bridge: 'https://sepolia.scroll.io/bridge',
  explorer: 'https://sepolia.scrollscan.com',
  faucet: 'https://sepolia.scroll.io/faucet',
};

/**
 * Configuración del contrato
 */
export const CONTRACT_CONFIG = {
  address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
  chainId: 534351,
  network: 'scroll-sepolia',
};

/**
 * Configuración de Supabase
 */
export const SUPABASE_CONFIG = {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_KEY,
};

/**
 * Mensajes de estado de la aplicación
 */
export const STATUS_MESSAGES = {
  idle: 'Esperando acción',
  scanning: '📷 Escaneando QR...',
  'qr-detected': '✓ QR Detectado',
  'certifying-db': '💾 Certificando en Base de Datos...',
  'waiting-signature': '✍️ Esperando firma en Metamask...',
  'sealing-blockchain': '⛓️ Sellando en Blockchain...',
  success: '✅ ¡Lote Certificado Exitosamente!',
  error: '❌ Error',
};

/**
 * Reglas de validación de IA
 */
export const AI_VALIDATION_RULES = {
  PRODUCTO_FALSO: 'ALERTA: Producto Falso Detectado',
  VENCIDO: 'ALERTA: Producto Vencido',
  EXPIRADO: 'ALERTA: Producto Expirado',
  SOSPECHOSO: 'ALERTA: Patrón Sospechoso Detectado',
  NO_AUTORIZADO: 'ALERTA: Actividad No Autorizada',
};
