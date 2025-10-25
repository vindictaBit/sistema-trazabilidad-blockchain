import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import CryptoJS from 'crypto-js';

// Tipos para la respuesta
type ResponseData = {
  hash: string;
  loteId?: number | null;
  message?: string;
};

type ErrorResponse = {
  error: string;
  details?: string;
};

// Inicializar cliente de Supabase
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Faltan variables de entorno de Supabase');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * API Route para certificar lotes de medicamentos
 * 
 * Flujo:
 * 1. Recibe los datos del QR
 * 2. Aplica reglas de IA simple
 * 3. Guarda en Supabase (off-chain)
 * 4. Calcula y devuelve hash SHA-256
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData | ErrorResponse>
) {
  // Solo aceptar método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Use POST.' });
  }

  try {
    // Extraer datos del body
    const { datosQR } = req.body;

    // Validar que vengan los datos
    if (!datosQR) {
      return res.status(400).json({ 
        error: 'Datos del QR requeridos',
        details: 'El campo datosQR es obligatorio'
      });
    }

    // Convertir datosQR a string si es un objeto
    const datosQRString = typeof datosQR === 'string' 
      ? datosQR 
      : JSON.stringify(datosQR);

    // ============================================
    // VALIDACIÓN: Reglas de Negocio
    // ============================================
    
    // Regla 1: Detectar productos falsos
    if (datosQRString.toUpperCase().includes('PRODUCTO_FALSO')) {
      return res.status(400).json({
        error: 'ALERTA: Producto Falso Detectado',
        details: 'El sistema detectó indicadores de falsificación en los datos del QR'
      });
    }

    // Regla 2: Detectar lotes vencidos o expirados
    if (datosQRString.toUpperCase().includes('VENCIDO') || 
        datosQRString.toUpperCase().includes('EXPIRADO')) {
      return res.status(400).json({
        error: 'ALERTA: Producto Vencido',
        details: 'El lote está marcado como vencido o expirado'
      });
    }

    // Regla 3: Validar que contenga información mínima
    let datosQRObj;
    try {
      datosQRObj = typeof datosQR === 'string' ? JSON.parse(datosQR) : datosQR;
    } catch (e) {
      return res.status(400).json({
        error: 'Formato de QR inválido',
        details: 'Los datos del QR deben ser un JSON válido'
      });
    }

    // Validar campos mínimos (ejemplo)
    if (!datosQRObj.lote && !datosQRObj.producto && !datosQRObj.id) {
      return res.status(400).json({
        error: 'VALIDACIÓN: Datos Incompletos',
        details: 'El QR debe contener al menos: lote, producto o id'
      });
    }

    // Regla 4: Detectar patrones sospechosos (ejemplo simple)
    if (datosQRString.includes('SOSPECHOSO') || 
        datosQRString.includes('NO_AUTORIZADO')) {
      return res.status(400).json({
        error: 'SEGURIDAD: Patrón Sospechoso Detectado',
        details: 'Los datos contienen indicadores de actividad no autorizada'
      });
    }

    // ============================================
    // CALCULAR HASH SHA-256 (sin guardar todavía)
    // ============================================
    
    const hash = CryptoJS.SHA256(datosQRString).toString(CryptoJS.enc.Hex);

    // ============================================
    // GUARDAR EN SUPABASE (temporal - sin blockchain)
    // NOTA: Esto se guarda ANTES de blockchain por ahora
    // TODO: Mover a endpoint separado /api/confirmar
    // ============================================
    
    const { data: insertData, error: insertError } = await supabase
      .from('lotes')
      .insert([
        {
          datos_qr: datosQRObj,
          datos_qr_string: datosQRString,
          timestamp: new Date().toISOString(),
          estado: 'pendiente', // Cambiar a 'certificado' cuando blockchain confirme
          hash_calculado: hash,
        }
      ])
      .select();

    if (insertError) {
      console.error('Error al insertar en Supabase:', insertError);
      return res.status(500).json({
        error: 'Error al guardar en la base de datos',
        details: insertError.message
      });
    }

    // ============================================
    // RESPUESTA EXITOSA
    // ============================================
    
    return res.status(200).json({
      hash: hash,
      loteId: insertData && insertData[0] ? insertData[0].id : null,
      message: 'Validación exitosa. Hash calculado. Proceder a sellar en blockchain.'
    });

  } catch (error) {
    console.error('Error en API certificar:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
