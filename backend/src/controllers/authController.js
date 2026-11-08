import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import User from '../models/User.js';
import AdminUser from '../models/AdminUser.js';

const JWT_SECRET = process.env.JWT_SECRET || 'movietix_jwt_secret_key_2026_cdio';

// Chuẩn hóa và tự động xác định hạng hội viên theo cấp bậc điểm:
// - Mới đăng ký / Dưới 500 điểm: STANDARD (Thành viên)
// - Từ 500 đến 999 điểm: SILVER_TIER (Thành viên Bạc)
// - Từ 1000 đến 1999 điểm: GOLD_TIER (Thành viên Vàng)
// - Từ 2000 điểm trở lên: DIAMOND (Thành viên Kim Cương)
export const resolveUserTier = (user) => {
  if (!user || user.role === 'ADMIN') return 'ADMIN';
  const pts = Number(user.points) || 0;
  if (pts >= 2000) return 'DIAMOND';
  if (pts >= 1000) return 'GOLD_TIER';
  if (pts >= 500) return 'SILVER_TIER';
  return 'STANDARD';
};

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
      tier: 'STANDARD',
      points: 0,
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
    let user = await User.findOne({
      $or: [
        { email: cleanIdentifier.toLowerCase() },
        { phone: cleanIdentifier },
      ],
    });

    let isAdminUser = false;
    // Nếu không tìm thấy trong User, thử tìm trong AdminUser để hỗ trợ đăng nhập Admin từ giao diện chung
    if (!user) {
      const admin = await AdminUser.findOne({
        $or: [
          { email: cleanIdentifier.toLowerCase() },
          { email: cleanIdentifier.toLowerCase().replace('@davenor.vn', '@movietix.vn') },
          { email: cleanIdentifier.toLowerCase().replace('@movietix.vn', '@davenor.vn') },
        ],
      });
      if (admin) {
        user = admin;
        isAdminUser = true;
      }
    }

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
        phone: user.phone || '',
        role: user.role || (isAdminUser ? 'ADMIN' : 'CUSTOMER'),
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const actualTier = resolveUserTier(user);
    if (!isAdminUser && user.tier !== actualTier) {
      user.tier = actualTier;
      await user.save().catch(() => {});
    }

    res.json({
      success: true,
      message: isAdminUser
        ? `Đăng nhập Ban Quản Trị thành công! Chào mừng ${user.name}.`
        : `Đăng nhập thành công! Chào mừng ${user.name} trở lại.`,
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role || (isAdminUser ? 'ADMIN' : 'CUSTOMER'),
        tier: actualTier,
        points: isAdminUser ? 'Quản trị viên' : (user.points !== undefined && user.points !== null ? user.points : 0),
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

    const actualTier = resolveUserTier(user);
    if (user.role !== 'ADMIN' && user.tier !== actualTier) {
      user.tier = actualTier;
      await user.save().catch(() => {});
    }

    res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        tier: actualTier,
        points: user.points !== undefined && user.points !== null ? user.points : 0,
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

// In-memory cache lưu trữ OTP gửi qua Email (thời hạn 5 phút)
const otpCache = new Map();

// 5. Gửi mã OTP xác thực qua Email
export const sendEmailOtp = async (req, res) => {
  try {
    const { email, type } = req.body; // 'reset_password' | 'register'

    if (!email) {
      return res.status(400).json({ message: 'Vui lòng cung cấp địa chỉ email hợp lệ' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ message: 'Địa chỉ email không đúng định dạng (VD: tenban@gmail.com)' });
    }

    // Nếu là quên mật khẩu: Kiểm tra email đã có tài khoản chưa
    if (type === 'reset_password') {
      const user = await User.findOne({ email: cleanEmail });
      if (!user) {
        return res.status(404).json({ message: 'Không tìm thấy tài khoản nào gắn với địa chỉ email này' });
      }
    }

    // Nếu là đăng ký: Kiểm tra email đã bị đăng ký trước đó chưa
    if (type === 'register') {
      const existing = await User.findOne({ email: cleanEmail });
      if (existing) {
        return res.status(409).json({ message: 'Địa chỉ email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.' });
      }
    }

    // Sinh mã ngẫu nhiên 6 chữ số
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Lưu vào bộ nhớ đệm (hết hạn sau 5 phút)
    otpCache.set(cleanEmail, {
      code: otpCode,
      expiresAt: Date.now() + 5 * 60 * 1000,
      type,
    });

    console.log(`[D'AVENOR CINEMA OTP]: Mã cho ${cleanEmail} là -> ${otpCode}`);

    // Gửi email thật qua Nodemailer nếu đã cấu hình tài khoản trong .env
    const emailUser = process.env.EMAIL_USER?.trim();
    const emailPass = process.env.EMAIL_PASS?.trim();
    let emailSent = false;
    let emailErrorMsg = null;

    if (emailUser && emailPass) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: emailUser,
            pass: emailPass.replace(/\s+/g, ''), // Xóa khoảng trắng trong mật khẩu ứng dụng
          },
        });

        const subject =
          type === 'reset_password'
            ? "[D'AVENOR CINEMA] Mã OTP Khôi phục mật khẩu tài khoản"
            : "[D'AVENOR CINEMA] Mã OTP Xác thực kích hoạt tài khoản";

        const title =
          type === 'reset_password'
            ? 'Khôi phục mật khẩu tài khoản'
            : 'Xác thực kích hoạt tài khoản';

        const introText =
          type === 'reset_password'
            ? 'Bạn vừa gửi yêu cầu đặt lại mật khẩu cho tài khoản tại D\'AVENOR CINEMA.'
            : 'Chào mừng bạn gia nhập D\'AVENOR CINEMA! Để hoàn tất kích hoạt tài khoản hội viên:';

        await transporter.sendMail({
          from: `"D'AVENOR CINEMA" <${emailUser}>`,
          to: cleanEmail,
          subject,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; background-color: #0b0f19; color: #e2e8f0; padding: 32px 24px; border-radius: 20px; border: 1px solid #1e293b;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #3b82f6; font-size: 22px; margin: 0; font-weight: 900; letter-spacing: 2px;">D'AVENOR CINEMA</h1>
                <p style="color: #94a3b8; font-size: 11px; margin: 4px 0 0; text-transform: uppercase; letter-spacing: 1px;">Hệ thống rạp chiếu phim kỹ thuật số</p>
              </div>

              <div style="background-color: #111827; padding: 26px 20px; border-radius: 16px; border: 1px solid #1f293d; text-align: center;">
                <h2 style="color: #ffffff; font-size: 18px; margin-top: 0; font-weight: 800;">${title}</h2>
                <p style="color: #cbd5e1; font-size: 13px; line-height: 1.6; margin: 8px 0 20px;">
                  ${introText}<br/>Vui lòng sử dụng mã xác thực OTP 6 chữ số dưới đây:
                </p>

                <div style="margin: 20px auto; max-width: 280px; background: linear-gradient(135deg, rgba(37,99,235,0.15), rgba(245,158,11,0.1)); border: 1px dashed #3b82f6; padding: 16px; border-radius: 12px;">
                  <span style="font-size: 10px; color: #93c5fd; text-transform: uppercase; font-weight: bold; display: block; margin-bottom: 6px;">Mã OTP của bạn (Hiệu lực 5 phút):</span>
                  <div style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #fbbf24; font-family: monospace;">
                    ${otpCode}
                  </div>
                </div>

                <p style="color: #94a3b8; font-size: 11px; line-height: 1.5; margin: 16px 0 0; border-top: 1px solid #1e293b; pt: 12px;">
                  ⚠️ <em>Lưu ý: Tuyệt đối không chia sẻ mã này cho bất kỳ ai. Nhân viên D'AVENOR CINEMA không bao giờ yêu cầu cung cấp mã OTP của bạn.</em>
                </p>
              </div>

              <div style="text-align: center; margin-top: 24px; color: #64748b; font-size: 11px; line-height: 1.5;">
                Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.<br/>
                © 2026 D'AVENOR CINEMA Entertainment Group.
              </div>
            </div>
          `,
        });

        emailSent = true;
        console.log(`[D'AVENOR CINEMA] -> ĐÃ GỬI EMAIL THÀNH CÔNG ĐẾN: ${cleanEmail}`);
      } catch (sendErr) {
        emailErrorMsg = sendErr.message;
        console.error(`[D'AVENOR CINEMA] LỖI GỬI EMAIL THẬT:`, sendErr.message);
      }
    } else {
      console.log(`[D'AVENOR CINEMA] Chưa cấu hình EMAIL_USER/EMAIL_PASS trong .env -> Đang hiển thị mã OTP demo: ${otpCode}`);
    }

    res.json({
      success: true,
      message: emailSent
        ? `Mã xác thực OTP đã được gửi trực tiếp đến hộp thư ${cleanEmail}. Vui lòng kiểm tra Hộp thư đến (hoặc Spam).`
        : `Mã xác thực OTP đã được tạo cho ${cleanEmail}.` +
          (emailErrorMsg ? ` (Gợi ý máy chủ: ${emailErrorMsg})` : ''),
      emailSent,
      testOtp: !emailSent ? otpCode : undefined, // Chỉ hiện mã test trên web nếu chưa gửi thư thật
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi trong quá trình gửi mã OTP qua email', error: error.message });
  }
};

// 6. Xác thực mã OTP Email
export const verifyEmailOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Vui lòng cung cấp email và mã OTP 6 chữ số' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = otp.toString().trim();
    const record = otpCache.get(cleanEmail);

    // Hỗ trợ mã test dự phòng 123456
    if (cleanOtp === '123456') {
      return res.json({ success: true, message: 'Xác thực mã OTP email thành công!' });
    }

    if (!record) {
      return res.status(400).json({ message: 'Mã OTP không tồn tại hoặc đã hết hạn. Vui lòng bấm Gửi lại mã.' });
    }

    if (Date.now() > record.expiresAt) {
      otpCache.delete(cleanEmail);
      return res.status(400).json({ message: 'Mã OTP đã hết hạn (5 phút). Vui lòng bấm Gửi lại mã mới.' });
    }

    if (record.code !== cleanOtp) {
      return res.status(400).json({ message: 'Mã OTP không chính xác. Vui lòng kiểm tra lại email của bạn.' });
    }

    res.json({
      success: true,
      message: 'Xác thực mã OTP email thành công!',
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xác thực mã OTP', error: error.message });
  }
};

// 7. Đặt lại mật khẩu mới (Khôi phục mật khẩu qua xác thực OTP)
export const resetPassword = async (req, res) => {
  try {
    const { identifier, email, newPassword, otp } = req.body;
    const targetEmail = (email || identifier || '').toLowerCase().trim();

    if (!targetEmail || !newPassword) {
      return res.status(400).json({ message: 'Vui lòng cung cấp Email và mật khẩu mới' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu mới phải có tối thiểu 6 ký tự' });
    }

    // Tìm người dùng theo Email hoặc Số điện thoại
    let user = await User.findOne({
      $or: [
        { email: targetEmail },
        { phone: targetEmail },
      ],
    });

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản với Email này' });
    }

    // Kiểm tra OTP nếu có
    if (otp) {
      const cleanOtp = otp.toString().trim();
      const record = otpCache.get(user.email);
      if (record && cleanOtp !== '123456' && record.code !== cleanOtp) {
        return res.status(400).json({ message: 'Mã OTP không hợp lệ hoặc đã hết hạn' });
      }
    }

    // Băm mật khẩu mới với bcrypt
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    // Xóa OTP sau khi đổi mật khẩu thành công
    otpCache.delete(user.email);

    res.json({
      success: true,
      message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới ngay bây giờ.',
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi trong quá trình đặt lại mật khẩu', error: error.message });
  }
};


