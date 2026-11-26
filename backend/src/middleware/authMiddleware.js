import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import AdminUser from '../models/AdminUser.js';
import User from '../models/User.js';

function authenticate(models, allowedRoles, property) {
  return async (req, res, next) => {
    const token = req.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
    if (!token) return res.status(401).json({ message: 'Vui lòng đăng nhập.' });
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(503).json({ message: 'Dịch vụ xác thực chưa được cấu hình.' });

    let identity;
    try {
      identity = jwt.verify(token, secret, { algorithms: ['HS256'] });
    } catch {
      return res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
    }
    if (!mongoose.isObjectIdOrHexString(identity?.id)) {
      return res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ.' });
    }

    try {
      for (const model of models) {
        const account = await model.findById(identity.id).select('name email phone role').lean();
        if (account && allowedRoles.includes(account.role)) {
          req[property] = { ...account, id: String(account._id) };
          return next();
        }
      }
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện thao tác này.' });
    } catch (error) {
      return next(error);
    }
  };
}

export const authenticateAdmin = authenticate([AdminUser, User], ['ADMIN'], 'admin');
export const authenticateCustomer = authenticate([User], ['CUSTOMER', 'VIP'], 'user');

export const optionalAuthenticateCustomer = async (req, res, next) => {
  const token = req.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return next();
  try {
    const identity = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (!mongoose.isObjectIdOrHexString(identity?.id)) return next();
    const account = await User.findById(identity.id).select('name email phone role').lean();
    if (account && ['CUSTOMER', 'VIP'].includes(account.role)) {
      req.user = { ...account, id: String(account._id) };
    }
  } catch {
    // Token không hợp lệ hoặc hết hạn vẫn cho xem nội dung công khai như khách
  }
  return next();
};
