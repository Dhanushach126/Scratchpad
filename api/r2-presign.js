import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
    R2_PUBLIC_DOMAIN,
  } = process.env;

  // Check if R2 credentials are set in environment
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    return res.status(503).json({
      configured: false,
      error: 'Cloudflare R2 storage credentials are not configured in environment variables.',
    });
  }

  try {
    const { filename, contentType, padId, fileSize } = req.body || {};

    if (!filename || !padId) {
      return res.status(400).json({ error: 'Missing required parameters: filename and padId.' });
    }

    // Limit check (500MB = 524288000 bytes)
    const MAX_SIZE = 500 * 1024 * 1024;
    if (fileSize && fileSize > MAX_SIZE) {
      return res.status(400).json({ error: 'File size exceeds 500MB limit.' });
    }

    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    // Generate safe storage key
    const sanitizedFilename = String(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeKey = `pads/${padId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${sanitizedFilename}`;

    // Presigned PUT URL for direct client upload
    const putCommand = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: safeKey,
      ContentType: contentType || 'application/octet-stream',
    });

    const uploadUrl = await getSignedUrl(s3, putCommand, { expiresIn: 3600 });

    // Download URL (public domain if configured, or presigned GET)
    let publicUrl = null;
    if (R2_PUBLIC_DOMAIN) {
      const cleanDomain = R2_PUBLIC_DOMAIN.replace(/\/+$/, '');
      publicUrl = `${cleanDomain}/${safeKey}`;
    }

    // Also generate a presigned GET URL (expires in 24 hours / 86400s)
    const getCommand = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: safeKey,
    });
    const downloadUrl = await getSignedUrl(s3, getCommand, { expiresIn: 86400 });

    return res.status(200).json({
      success: true,
      uploadUrl,
      key: safeKey,
      publicUrl: publicUrl || downloadUrl,
      downloadUrl,
    });
  } catch (err) {
    console.error('Error generating R2 presigned URL:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
