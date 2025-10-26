-- Tabla para almacenar los lotes de medicamentos certificados
CREATE TABLE IF NOT EXISTS public.lotes (
    id BIGSERIAL PRIMARY KEY,
    datos_qr JSONB NOT NULL,
    datos_qr_string TEXT NOT NULL,
    hash_calculado TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    estado TEXT DEFAULT 'certificado',
    tx_hash TEXT,
    blockchain_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_lotes_hash ON public.lotes(hash_calculado);
CREATE INDEX IF NOT EXISTS idx_lotes_timestamp ON public.lotes(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_lotes_estado ON public.lotes(estado);
CREATE INDEX IF NOT EXISTS idx_lotes_tx_hash ON public.lotes(tx_hash);

-- Índice GIN para búsquedas en el JSONB
CREATE INDEX IF NOT EXISTS idx_lotes_datos_qr_gin ON public.lotes USING GIN (datos_qr);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_lotes_updated_at 
    BEFORE UPDATE ON public.lotes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Comentarios para documentación
COMMENT ON TABLE public.lotes IS 'Almacena los registros de lotes de medicamentos certificados';
COMMENT ON COLUMN public.lotes.datos_qr IS 'Datos completos del QR en formato JSON';
COMMENT ON COLUMN public.lotes.datos_qr_string IS 'Datos del QR como string (para calcular hash)';
COMMENT ON COLUMN public.lotes.hash_calculado IS 'Hash SHA-256 calculado de los datos del QR';
COMMENT ON COLUMN public.lotes.timestamp IS 'Momento en que se certificó el lote';
COMMENT ON COLUMN public.lotes.estado IS 'Estado del lote: pendiente, certificado, rechazado';
COMMENT ON COLUMN public.lotes.tx_hash IS 'Hash de transacción en Scroll Sepolia';
COMMENT ON COLUMN public.lotes.blockchain_timestamp IS 'Timestamp cuando se confirmó en blockchain';

-- Vista para consultas comunes
CREATE OR REPLACE VIEW public.lotes_recientes AS
SELECT 
    id,
    datos_qr->>'lote' as numero_lote,
    datos_qr->>'producto' as producto,
    datos_qr->>'fabricante' as fabricante,
    hash_calculado,
    estado,
    timestamp,
    tx_hash,
    blockchain_timestamp
FROM public.lotes
ORDER BY timestamp DESC
LIMIT 100;

COMMENT ON VIEW public.lotes_recientes IS 'Vista de los 100 lotes más recientes con campos principales';