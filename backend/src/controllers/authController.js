import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'movietix_jwt_secret_key_2026_cdio';

// 1. Đăng ký tài khoản khách hàng mới
export const register = async (req, res) => {
  try {
    const { name, email, phone, password, confirmPassword } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ tất cả các trường (*)' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ message: 'Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ message: 'Địa chỉ Email không đúng định dạng hợp lệ' });
    }

    const cleanPhone = phone.toString().replace(/[\s.-]/g, '');

    // Kiểm tra định dạng số điện thoại Việt Nam (10 số, bắt đầu 03, 05, 07, 08, 09 hoặc +84)
    const phoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({
        message: 'Số điện thoại không đúng định dạng Việt Nam (phải gồm 10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09 hoặc +84)',
      });
    }

    // Kiểm tra xem Email hoặc SĐT đã tồn tại chưa
    const existingUser = await User.findOne({
      $or: [{ email: cleanEmail }, { phone: cleanPhone }],
    });

    if (existingUser) {
      if (existingUser.email === cleanEmail) {
        return res.status(409).json({ message: 'Email này đã được đăng ký tài khoản. Vui lòng chuyển sang Đăng nhập.' });
      }
      return res.status(409).json({ message: 'Số điện thoại này đã được sử dụng. Vui lòng kiểm tra lại.' });
    }

    // Băm mật khẩu an toàn với bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      password: hashedPassword,
      role: 'CUSTOMER',
      tier: 'GOLD_TIER',
      points: 100,
    });

    // Tạo JWT token
    const token = jwt.sign(
      {
        id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      message: "Đăng ký tài khoản thành công! Chào mừng bạn đến với D'AVENOR CINEMA.",
      token,
      user: {
        id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        tier: newUser.tier,
        points: newUser.points,
        avatar: newUser.avatar || '',
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi trong quá trình đăng ký tài khoản', error: error.message });
  }
};

// 2. Đăng nhập tài khoản (Email hoặc Số điện thoại)
export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập Email/Số điện thoại và mật khẩu' });
    }

    const cleanIdentifier = identifier.trim();

    // Tìm kiếm người dùng theo Email HOẶC Số điện thoại
    const user = await User.findOne({
      $or: [
        { email: cleanIdentifier.toLowerCase() },
        { phone: cleanIdentifier },
      ],
    });

    if (!user) {
      return res.status(401).json({ message: 'Tài khoản không tồn tại. Vui lòng kiểm tra lại hoặc chuyển sang Đăng ký.' });
    }

    // Kiểm tra mật khẩu
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({ message: 'Mật khẩu không chính xác. Vui lòng thử lại.' });
    }

    // Sinh JWT Token
    const token = jwt.sign(
      {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      message: `Đăng nhập thành công! Chào mừng ${user.name} trở lại.`,
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        tier: user.tier,
        points: user.points,
        avatar: user.avatar || '',
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi trong quá trình đăng nhập', error: error.message });
  }
};

// 3. Lấy thông tin cá nhân hiện tại
export const getMe = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Chưa đăng nhập hoặc token không hợp lệ' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        tier: user.tier,
        points: user.points,
        avatar: user.avatar || '',
      },
    });
  } catch (error) {
    res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn', error: error.message });
  }
};

// 4. Cập nhật ảnh đại diện (Avatar) cho người dùng
export const updateAvatar = async (req, res) => {
  try {
    const { avatar, email, userId } = req.body;

    if (avatar === undefined || avatar === null) {
      return res.status(400).json({ message: 'Vui lòng cung cấp thông tin ảnh đại diện' });
    }

    let targetUserId = userId;

    // Lấy ID từ Token nếu có
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        targetUserId = decoded.id;
      } catch {
        // Tiếp tục thử fallback theo email/userId
      }
    }

    let user = null;
    const cleanAvatar = typeof avatar === 'string' ? avatar.trim() : '';
    if (targetUserId && mongoose.Types.ObjectId.isValid(targetUserId)) {
      user = await User.findByIdAndUpdate(targetUserId, { avatar: cleanAvatar }, { new: true });
    } else if (email) {
      user = await User.findOneAndUpdate({ email: email.toLowerCase().trim() }, { avatar: cleanAvatar }, { new: true });
    }

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản người dùng để đổi avatar' });
    }

    res.json({
      success: true,
      message: cleanAvatar ? 'Cập nhật ảnh đại diện thành công!' : 'Đã đưa ảnh đại diện về mặc định!',
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        tier: user.tier,
        points: user.points,
        avatar: user.avatar || '',
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật ảnh đại diện', error: error.message });
  }
};

