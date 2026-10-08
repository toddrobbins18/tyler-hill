-- Use project global file size limit for message-media (no per-bucket cap).
UPDATE storage.buckets
SET file_size_limit = NULL
WHERE id = 'message-media';
