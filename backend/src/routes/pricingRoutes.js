import express from 'express';
import { ensurePricingConfig } from '../services/pricingConfigService.js';

const router = express.Router();

// Lấy cấu hình bảng giá vé công khai từ MongoDB (dùng cho Client & Trang rạp chiếu)
router.get('/', async (req, res) => {
  try {
    const config = await ensurePricingConfig();
    res.json({
      success: true,
      config,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy cấu hình bảng giá vé', error: error.message });
  }
});

export default router;

