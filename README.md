# Sistema de Trazabilidad Farmacéutica - DApp Blockchain

Plataforma descentralizada de certificación y trazabilidad de medicamentos desarrollada.

Despliegue: https://sistema-trazabilidad-blockchain.vercel.app/

## Stack Tecnológico

- **Frontend:** Next.js 16, React 18, TypeScript, TailwindCSS
- **Web3:** Wagmi 2.x, Viem, Ethers.js 6
- **Blockchain:** Scroll Sepolia Testnet
- **Smart Contract:** Solidity 0.8.20
- **Backend:** Next.js API Routes
- **Database:** Supabase PostgreSQL
- **QR Processing:** html5-qrcode, jsQR
- **Deployment:** Vercel Ready

## Prerequisitos

- Node.js 18+ y npm/yarn/pnpm
- Wallet Web3 (MetaMask recomendado)
- Cuenta de Supabase (https://supabase.com)
- Fondos testnet en Scroll Sepolia (https://sepolia.scroll.io/faucet)

## Instalación y Configuración

### 1. Instalación de dependencias

```bash
cd hackathon
npm install
# o
yarn install
# o
pnpm install
```

### 2. Configurar variables de entorno

Copia el archivo de ejemplo y completa las variables:

```bash
cp .env.local.example .env.local
```

Edita `.env.local`:

```env
# Dirección del Smart Contract desplegado en Scroll Sepolia
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...

# Configuración de Supabase
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# (Opcional) RPC de Scroll Sepolia
NEXT_PUBLIC_SCROLL_SEPOLIA_RPC=https://sepolia-rpc.scroll.io
```

### 3. Configurar Supabase

Crea una tabla `lotes` en tu proyecto de Supabase con el siguiente schema:

```sql
CREATE TABLE lotes (
  id BIGSERIAL PRIMARY KEY,
  datos_qr JSONB NOT NULL,
  datos_qr_string TEXT NOT NULL,
  hash_calculado TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  estado TEXT DEFAULT 'certificado'
);

-- Índice para búsquedas por hash
CREATE INDEX idx_lotes_hash ON lotes(hash_calculado);
```

### 4. Deployment del Smart Contract

#### Remix IDE

1. Ve a [Remix IDE](https://remix.ethereum.org/)
2. Crea un nuevo archivo `Trazabilidad.sol`
3. Copia el contenido de `contracts/Trazabilidad.sol`
4. Compila con Solidity ^0.8.20
5. En el tab "Deploy & Run Transactions":
   - Selecciona "Injected Provider - Metamask"
   - Asegúrate de estar en Scroll Sepolia
   - Deploy el contrato
6. Copia la dirección del contrato y pégala en `.env.local`

## Ejecución del Proyecto

### Modo Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador.

### Modo Producción

```bash
npm run build
npm start
```

## Uso de la Aplicación

### Flujo de Certificación

1. **Conexión de Wallet**
   - Seleccionar "Conectar Wallet"
   - Autorizar conexión desde wallet
   - Verificar red Scroll Sepolia activa

2. **Captura de Código QR**
   - Opción A: Activar cámara para escaneo en vivo
   - Opción B: Cargar imagen existente del código QR
   - Sistema detecta y extrae información automáticamente

3. **Proceso de Certificación**
   - Iniciar certificación blockchain
   - Sistema ejecuta:
     - Validación de datos mediante reglas de negocio
     - Registro en base de datos Supabase
     - Cálculo de hash criptográfico SHA-256
     - Invocación de smart contract
   - Confirmar transacción en wallet

4. **Verificación de Resultado**
   - Visualizar hash de transacción generado
   - Acceder a explorador blockchain para validación
   - Consultar registro inmutable en Scroll Sepolia

### Estructura de Datos QR (JSON)

```json
{
  "lote": "LOT-2025-001",
  "producto": "Paracetamol 500mg",
  "fabricante": "Farmacia XYZ",
  "fecha_fabricacion": "2025-01-15",
  "fecha_vencimiento": "2027-01-15",
  "cantidad": 1000,
  "ubicacion": "Almacén Central"
}
```

Generador de QR recomendado: qr-code-generator.com

### Reglas de Validación Automatizadas

El sistema backend implementa las siguientes validaciones:

- **PRODUCTO_FALSO** → Certificación denegada
- **VENCIDO** o **EXPIRADO** → Certificación denegada
- **SOSPECHOSO** o **NO_AUTORIZADO** → Certificación denegada
- Campos requeridos faltantes (lote, producto, id) → Certificación denegada

## Deployment en Vercel

### 1. Preparación del Repositorio

```bash
git init
git add .
git commit -m "Sistema de trazabilidad blockchain - v1.0"
git branch -M main
git remote add origin https://github.com/usuario/repositorio.git
git push -u origin main
```

### 2. Configuración en Vercel

1. Acceder a vercel.com
2. Importar repositorio desde GitHub
3. Configurar variables de entorno:
   - `NEXT_PUBLIC_CONTRACT_ADDRESS`
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
4. Ejecutar deployment

## Arquitectura del Proyecto

```
hackathon/
├── contracts/
│   └── Trazabilidad.sol          # Smart contract Solidity
├── pages/
│   ├── _app.tsx                  # Configuración Wagmi y providers
│   ├── index.tsx                 # Interfaz principal y lógica QR
│   └── api/
│       └── certificar.ts         # Endpoint de validación y registro
├── styles/
│   └── globals.css               # Estilos globales Tailwind
├── public/                       # Recursos estáticos
├── .env.local.example            # Template de variables de entorno
├── package.json                  # Gestión de dependencias
├── tailwind.config.js            # Configuración Tailwind CSS
├── tsconfig.json                 # Configuración TypeScript
└── README.md                     # Documentación técnica
```

## Componentes Técnicos Clave

### Smart Contract

- **Función Principal:** `sellarHash(string memory _hash)`
- **Evento:** `HashSellado(address indexed emisor, string hash, uint256 timestamp)`
- **Storage:** `hashRegistrados(string => bool)`

### API Backend

- Procesamiento de datos QR
- Validación mediante reglas de negocio
- Persistencia en Supabase
- Generación de hash SHA-256
- Respuesta al frontend

### Frontend

- Procesamiento de QR (cámara e imagen)
- Integración Web3 via Wagmi
- Comunicación con smart contract
- Interfaz de usuario TailwindCSS

## Resolución de Problemas

### Error: "Cannot find module 'X'"

```bash
npm install
```

### Error: "Please connect to Scroll Sepolia"

1. Abrir wallet (MetaMask)
2. Cambiar red a "Scroll Sepolia Testnet"
3. Configuración manual si es necesario:
   - Network Name: Scroll Sepolia Testnet
   - RPC URL: https://sepolia-rpc.scroll.io
   - Chain ID: 534351
   - Currency Symbol: ETH
   - Block Explorer: https://sepolia.scrollscan.com

### Error: "Insufficient funds"

Solicitar ETH testnet:
- https://sepolia.scroll.io/faucet
- https://faucet.quicknode.com/scroll/sepolia

### Error de acceso a cámara

- Verificar permisos del navegador
- Utilizar HTTPS o localhost
- Probar navegador alternativo
- Utilizar opción de carga de imagen

## Referencias Técnicas

- [Documentación Wagmi](https://wagmi.sh/)
- [Scroll Sepolia Documentation](https://docs.scroll.io/)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)

### Características Implementadas

1. **Integración Blockchain:** Smart contract desplegado en Scroll Sepolia
2. **Interfaz Web3:** Conexión simplificada mediante Wagmi
3. **Validación Automatizada:** Reglas de negocio para detección de anomalías
4. **Arquitectura Híbrida:** Datos en Supabase + hash inmutable en blockchain
5. **Procesamiento IoT:** Captura de códigos QR simulando sensores
6. **Solución End-to-End:** Flujo completo de certificación funcional

## Licencia

MIT License

## Desarrollo

Sistema de Trazabilidad Blockchain - Hackathon 2025

---
