-- Migración para agregar campo blockchain_timestamp
-- Ejecutar en Supabase SQL Editor si aún no existe

ALTER TABLE public.lotes 
ADD COLUMN IF NOT EXISTS tx_hash TEXT,
ADD COLUMN IF NOT EXISTS blockchain_timestamp TIMESTAMPTZ;

-- Índice para el nuevo campo
CREATE INDEX IF NOT EXISTS idx_lotes_tx_hash ON public.lotes(tx_hash);

-- Comentario
COMMENT ON COLUMN public.lotes.tx_hash IS 'Hash de transacción en Scroll Sepolia';
COMMENT ON COLUMN public.lotes.blockchain_timestamp IS 'Timestamp cuando se confirmó en blockchain';

-- Actualizar registros existentes que tengan blockchain_tx_hash pero no tx_hash
UPDATE public.lotes 
SET tx_hash = blockchain_tx_hash 
WHERE blockchain_tx_hash IS NOT NULL AND tx_hash IS NULL;
