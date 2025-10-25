import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// Tipos para la respuesta
type ResponseData = {
  success: boolean;
  message: string;
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
 * API Route para confirmar certificación blockchain exitosa
 * 
 * Se llama DESPUÉS de que la transacción blockchain fue exitosa
 * Actualiza el estado en Supabase a 'certificado'
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
    const { loteId, txHash } = req.body;

    // Validar que vengan los datos
    if (!loteId || !txHash) {
      return res.status(400).json({ 
        error: 'Datos faltantes',
        details: 'Se requiere loteId y txHash'
      });
    }

    // Actualizar el lote en Supabase
    const { data, error } = await supabase
      .from('lotes')
      .update({ 
        estado: 'certificado',
        tx_hash: txHash,
        blockchain_timestamp: new Date().toISOString()
      })
      .eq('id', loteId)
      .select();

    if (error) {
      console.error('Error al actualizar Supabase:', error);
      return res.status(500).json({
        error: 'Error al confirmar certificación',
        details: error.message
      });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        error: 'Lote no encontrado',
        details: `No se encontró lote con ID ${loteId}`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Certificación confirmada en blockchain y base de datos'
    });

  } catch (error) {
    console.error('Error en API confirmar:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
