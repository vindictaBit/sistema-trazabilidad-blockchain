import { useState, useEffect, useRef } from 'react';
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Html5Qrcode } from 'html5-qrcode';
import Head from 'next/head';
import jsQR from 'jsqr';

// ABI del contrato (solo la función que necesitamos)
const TRAZABILIDAD_ABI = [
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "_hash",
        "type": "string"
      }
    ],
    "name": "sellarHash",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "emisor",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "hash",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "HashSellado",
    "type": "event"
  }
] as const;

// Dirección del contrato (se tomará del .env)
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

// Estados posibles de la aplicación
type AppStatus = 
  | 'idle' 
  | 'scanning' 
  | 'qr-detected' 
  | 'certifying-db' 
  | 'waiting-signature' 
  | 'sealing-blockchain' 
  | 'success' 
  | 'error';

export default function Home() {
  // Estado para controlar si estamos en el cliente (evita errores de hidratación)
  const [mounted, setMounted] = useState(false);
  
  // Estados de Wagmi
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: hash, writeContract, isPending, isError: isWriteError, error: writeError } = useWriteContract();
  
  // TypeScript: Fix connector type
  type Connector = typeof connectors[number];
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Estados de la aplicación
  const [status, setStatus] = useState<AppStatus>('idle');
  const [qrData, setQrData] = useState<string>('');
  const [calculatedHash, setCalculatedHash] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [html5QrCode, setHtml5QrCode] = useState<Html5Qrcode | null>(null);
  const [scannerStarted, setScannerStarted] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  const [loteId, setLoteId] = useState<number | null>(null);

  // Detectar cuando el componente está montado en el cliente
  useEffect(() => {
    setMounted(true);
  }, []);  // Limpiar scanner al desmontar
  useEffect(() => {
    return () => {
      if (html5QrCode && scannerStarted) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [html5QrCode, scannerStarted]);

  // Iniciar el scanner QR
  const startScanner = async () => {
    try {
      setStatus('scanning');
      setErrorMessage('');
      
      const qrCode = new Html5Qrcode("qr-reader");
      setHtml5QrCode(qrCode);

      await qrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // QR detectado exitosamente
          setQrData(decodedText);
          setStatus('qr-detected');
          
          // Detener el scanner
          qrCode.stop().catch(console.error);
          setScannerStarted(false);
        },
        (errorMessage) => {
          // Ignorar errores de no detección
          console.debug(errorMessage);
        }
      );
      
      setScannerStarted(true);
    } catch (err) {
      console.error("Error al iniciar scanner:", err);
      setErrorMessage("Error al acceder a la cámara. Asegúrate de dar permisos.");
      setStatus('error');
    }
  };

  // Detener el scanner
  const stopScanner = () => {
    if (html5QrCode && scannerStarted) {
      html5QrCode.stop().then(() => {
        setScannerStarted(false);
        setStatus('idle');
      }).catch(console.error);
    }
  };

  // Leer QR desde imagen subida
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Verificar que sea una imagen
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor selecciona un archivo de imagen (JPG, PNG, etc.)');
      setStatus('error');
      return;
    }

    setStatus('scanning');
    setErrorMessage('');

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Crear canvas para procesar la imagen
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (!context) {
          setErrorMessage('Error al procesar la imagen');
          setStatus('error');
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0);

        // Obtener datos de la imagen
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        
        // Decodificar QR
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code && code.data) {
          // QR detectado exitosamente
          setQrData(code.data);
          setStatus('qr-detected');
        } else {
          setErrorMessage('No se detectó ningún código QR en la imagen. Intenta con otra imagen más clara.');
          setStatus('error');
        }
      };
      
      img.onerror = () => {
        setErrorMessage('Error al cargar la imagen');
        setStatus('error');
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      setErrorMessage('Error al leer el archivo');
      setStatus('error');
    };

    reader.readAsDataURL(file);
  };

  // Certificar el lote (llamar al backend)
  const certificarLote = async () => {
    if (!qrData) {
      setErrorMessage('No hay datos del QR para certificar');
      return;
    }

    try {
      setStatus('certifying-db');
      setErrorMessage('');

      // Llamar a la API
      const response = await fetch('/api/certificar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ datosQR: qrData }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al certificar');
      }

      // Hash y loteId recibidos del backend
      setCalculatedHash(data.hash);
      setLoteId(data.loteId || null);
      
      // Ahora sellar en blockchain
      await sellarEnBlockchain(data.hash);

    } catch (err) {
      console.error('Error al certificar:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Error desconocido');
      setStatus('error');
    }
  };

  // Sellar el hash en la blockchain
  const sellarEnBlockchain = async (hashToSeal: string) => {
    if (!isConnected) {
      setErrorMessage('Debes conectar tu billetera primero');
      setStatus('error');
      return;
    }

    if (!CONTRACT_ADDRESS) {
      setErrorMessage('Dirección del contrato no configurada');
      setStatus('error');
      return;
    }

    try {
      setStatus('waiting-signature');
      
      // Llamar al smart contract
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: TRAZABILIDAD_ABI,
        functionName: 'sellarHash',
        args: [hashToSeal],
      });

      setStatus('sealing-blockchain');
    } catch (err) {
      console.error('Error al sellar en blockchain:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Error al sellar');
      setStatus('error');
    }
  };

  // Monitorear el estado de la transacción
  useEffect(() => {
    if (isConfirming && status !== 'sealing-blockchain') {
      setStatus('sealing-blockchain');
    }
    
    if (isConfirmed && hash) {
      setTxHash(hash);
      setStatus('success');
      
      // Confirmar en Supabase que la transacción fue exitosa
      if (loteId) {
        fetch('/api/confirmar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loteId, txHash: hash })
        })
        .then(res => res.json())
        .then(data => {
          console.log('Certificación confirmada en BD:', data);
        })
        .catch(err => {
          console.error('Error al confirmar en BD:', err);
          // No bloquear el flujo si falla la confirmación
        });
      }
    }

    if (isWriteError && writeError) {
      setErrorMessage(writeError.message);
      setStatus('error');
    }
  }, [isConfirming, isConfirmed, hash, isWriteError, writeError, status, loteId]);

  // Reiniciar el proceso
  const reiniciar = () => {
    // Detener el scanner si está activo
    if (html5QrCode && scannerStarted) {
      html5QrCode.stop().then(() => {
        setScannerStarted(false);
      }).catch(console.error);
    }
    
    // Resetear todos los estados a valores iniciales
    setStatus('idle');
    setQrData('');
    setCalculatedHash('');
    setErrorMessage('');
    setTxHash('');
    setLoteId(null);
    
    // Limpiar el input de archivo si existe
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  // Renderizar estado visual
  const renderStatus = () => {
    const statusConfig = {
      'idle': { color: 'bg-gray-500', text: 'Sistema listo', icon: '●' },
      'scanning': { color: 'bg-blue-500 animate-pulse', text: 'Escaneando código QR', icon: '◐' },
      'qr-detected': { color: 'bg-green-500', text: 'Código QR detectado', icon: '✓' },
      'certifying-db': { color: 'bg-yellow-500 animate-pulse', text: 'Validando datos y registrando', icon: '⟳' },
      'waiting-signature': { color: 'bg-orange-500 animate-pulse', text: 'Esperando confirmación de wallet', icon: '⌛' },
      'sealing-blockchain': { color: 'bg-purple-500 animate-pulse', text: 'Procesando transacción blockchain', icon: '⧗' },
      'success': { color: 'bg-green-600', text: 'Certificación completada exitosamente', icon: '✓' },
      'error': { color: 'bg-red-500', text: 'Error en el proceso', icon: '✕' },
    };

    const config = statusConfig[status];
    return (
      <div className={`status-badge ${config.color} text-white`}>
        <span className="text-xl mr-2">{config.icon}</span>
        {config.text}
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>Sistema de Trazabilidad Farmacéutica</title>
        <meta name="description" content="Plataforma blockchain para certificación de medicamentos" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="min-h-screen py-12 px-4">
        <div className="container-main">
          {/* Header con diseño mejorado */}
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="page-title">Sistema de Trazabilidad Farmacéutica</h1>
            <p className="page-subtitle">Plataforma de Certificación Blockchain para Medicamentos</p>
            <div className="mt-4 inline-flex items-center gap-2 text-sm text-gray-500">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span>Red: Scroll Sepolia Testnet</span>
            </div>
          </div>

          {/* Estado Global del Sistema */}
          <div className="card-compact mb-8 text-center animate-fade-in">
            {renderStatus()}
          </div>

          {/* Conexión de Wallet - SOLUCIONADO: UN SOLO BOTÓN */}
          <div className="card mb-8">
            <h2 className="section-title">
              <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Conexión de Wallet
            </h2>
            
            {!mounted ? (
              <div className="text-center py-8">
                <div className="inline-block spinner"></div>
                <p className="text-gray-500 mt-3">Inicializando conexión Web3...</p>
              </div>
            ) : !isConnected ? (
              <div className="space-y-4">
                <div className="alert-info">
                  <p className="font-medium">Conecta tu wallet para acceder al sistema de certificación</p>
                </div>
                {connectors.length > 0 && (
                  <button
                    onClick={() => connect({ connector: connectors[0] })}
                    className="btn-primary w-full text-lg"
                  >
                    <svg className="w-6 h-6 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Conectar Wallet
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="alert-success">
                  <p className="font-bold">Wallet Conectado Exitosamente</p>
                </div>
                
                <div>
                  <p className="info-label">Dirección de Wallet</p>
                  <div className="info-value flex items-center justify-between">
                    <span className="truncate">{address}</span>
                    <svg className="w-5 h-5 text-green-600 flex-shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                
                <div>
                  <p className="info-label">Red Activa</p>
                  <div className={`network-badge ${chain?.id === 534351 ? 'correct' : 'incorrect'}`}>
                    {chain?.id === 534351 ? (
                      <>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>{chain?.name}</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span>{chain?.name || 'Red Desconocida'} - Cambie a Scroll Sepolia</span>
                      </>
                    )}
                  </div>
                </div>

                <button onClick={() => disconnect()} className="btn-secondary w-full">
                  <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Desconectar Wallet
                </button>
              </div>
            )}
          </div>

          {/* Scanner QR con nuevo diseño */}
          <div className="card mb-8">
            <h2 className="section-title">
              <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Captura de Código QR
            </h2>
            
            <div id="qr-reader" className="scanner-container mb-6"></div>
            
            <div className="grid-2 mb-6">
              {!scannerStarted && status !== 'qr-detected' && (
                <>
                  <button onClick={startScanner} className="btn-primary">
                    <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Activar Cámara
                  </button>
                  <label className="btn-outline cursor-pointer text-center inline-flex items-center justify-center">
                    <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Cargar Imagen
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </>
              )}
              
              {scannerStarted && (
                <button onClick={stopScanner} className="btn-danger md:col-span-2">
                  <svg className="w-5 h-5 inline-block mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                  </svg>
                  Detener Captura
                </button>
              )}
            </div>

            <div className="alert-info text-sm">
              Puede escanear mediante cámara o cargar una imagen del código QR (JPG, PNG)
            </div>

            {qrData && (
              <div className="mt-6">
                <p className="info-label">Información Capturada</p>
                <div className="qr-display">
                  <pre>{qrData}</pre>
                </div>
              </div>
            )}
          </div>

          {/* Certificar Lote */}
          {qrData && status === 'qr-detected' && (
            <div className="card mb-8">
              <h2 className="section-title">
                <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Proceso de Certificación
              </h2>
              <button 
                onClick={certificarLote} 
                className="btn-success w-full text-lg"
                disabled={!isConnected || chain?.id !== 534351}
              >
                <svg className="w-6 h-6 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Iniciar Certificación Blockchain
              </button>
              {!isConnected && (
                <div className="alert-error mt-4">Debe conectar su wallet para continuar</div>
              )}
              {isConnected && chain?.id !== 534351 && (
                <div className="alert-error mt-4">Red incorrecta. Configure Scroll Sepolia en su wallet</div>
              )}
            </div>
          )}

          {/* Resultado del Hash */}
          {calculatedHash && (
            <div className="card mb-8">
              <h2 className="section-title">
                <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                Hash Criptográfico Generado
              </h2>
              <div className="info-value-lg">
                {calculatedHash}
              </div>
            </div>
          )}

          {/* Resultado Exitoso */}
          {status === 'success' && txHash && (
            <div className="card mb-8 border-4 border-green-500 bg-green-50 dark:bg-green-900/20">
              <div className="text-center mb-6">
                <svg className="w-20 h-20 mx-auto text-green-600 mb-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <h2 className="text-3xl font-bold text-green-600 mb-2">Certificación Blockchain Completada</h2>
                <p className="text-gray-700 dark:text-gray-300">El lote ha sido registrado exitosamente en la blockchain</p>
              </div>
              
              <div className="mb-6">
                <p className="info-label">ID de Transacción</p>
                <div className="info-value-lg">
                  {txHash}
                </div>
              </div>

              <div className="grid-2">
                <a
                  href={`https://sepolia.scrollscan.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary text-center"
                >
                  <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Ver en Explorer
                </a>

                <button onClick={reiniciar} className="btn-secondary">
                  <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Nueva Certificación
                </button>
              </div>
            </div>
          )}

          {/* Errores */}
          {status === 'error' && errorMessage && (
            <div className="card mb-8 border-4 border-red-500">
              <div className="text-center mb-6">
                <svg className="w-16 h-16 mx-auto text-red-600 mb-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <h2 className="text-2xl font-bold text-red-600 mb-2">Error en el Proceso</h2>
              </div>
              
              <div className="alert-error mb-6">
                <p className="font-bold">Descripción del Error:</p>
                <p>{errorMessage}</p>
              </div>
              
              <button onClick={reiniciar} className="btn-secondary w-full">
                <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reintentar Operación
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="divider"></div>
          <div className="footer-text space-y-2">
            <p className="font-semibold">Tecnología: Next.js • Wagmi • Scroll Sepolia • Supabase</p>
            <p>Sistema de Trazabilidad Blockchain - Hackathon 2025</p>
          </div>
        </div>
      </main>
    </>
  );
}
