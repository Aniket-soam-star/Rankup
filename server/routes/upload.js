import express from 'express'
import multer from 'multer'
import { v2 as cloudinary } from 'cloudinary'
import { Readable } from 'stream'
import pool from '../db/index.js'
import { logAction } from '../lib/audit.js'

const router = express.Router()

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' })
  next()
}

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'application/pdf']
const MAX_SIZE_MB = 50

const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Invalid file type'))
  }
})

function uploadToCloudinary(buffer, mimetype, originalname) {
  return new Promise((resolve, reject) => {
    const resourceType = mimetype.startsWith('video') ? 'video' : mimetype === 'application/pdf' ? 'raw' : 'image'
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: resourceType, folder: 'rankup' },
      (err, result) => { if (err) reject(err); else resolve(result) }
    )
    Readable.from(buffer).pipe(stream)
  })
}

router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' })
  try {
    const result = await uploadToCloudinary(req.file.buffer, req.file.mimetype, req.file.originalname)

    const typeCategory = req.file.mimetype.startsWith('image') ? 'image'
      : req.file.mimetype.startsWith('video') ? 'video' : 'document'

    const userRes = await pool.query('SELECT username FROM users WHERE id=$1', [req.session.userId])

    await logAction(pool, {
      userId: req.session.userId,
      username: userRes.rows[0]?.username,
      action: 'file.uploaded',
      targetType: 'upload',
      details: { url: result.secure_url, type: typeCategory, size: req.file.size, filename: req.file.originalname },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    })

    res.json({
      url: result.secure_url,
      type: typeCategory,
      size: req.file.size,
      filename: req.file.originalname
    })
  } catch (err) {
    console.error('Upload error:', err.message)
    res.status(500).json({ error: 'Upload failed' })
  }
})

// Handle multer errors
router.use((err, req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: `File too large. Max ${MAX_SIZE_MB}MB allowed` })
  if (err?.message === 'Invalid file type') return res.status(400).json({ error: err.message })
  next(err)
})

export default router
