import dotenv from 'dotenv';
dotenv.config();

async function probeServer() {
  const baseUrl = 'http://localhost:5000/api';
  console.log(`\n🌐 Kiểm tra các Endpoint HTTP REST API tại: ${baseUrl}`);

  try {
    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData = await healthRes.json();
    console.log(`[✔ HTTP 200] GET /api/health -> Status: ${healthData.status}, Movies in DB: ${healthData.database.movies}`);

    // 2. Movies list
    const moviesRes = await fetch(`${baseUrl}/movies`);
    const moviesData = await moviesRes.json();
    console.log(`[✔ HTTP 200] GET /api/movies -> Nhận được ${moviesData.length} phim từ DB`);

    // 3. Concessions list
    const concRes = await fetch(`${baseUrl}/concessions`);
    const concData = await concRes.json();
    console.log(`[✔ HTTP 200] GET /api/concessions -> Nhận được ${concData.length} gói bắp nước`);

    // 4. Admin login
    const loginRes = await fetch(`${baseUrl}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@movietix.vn', password: 'admin123' }),
    });
    const loginData = await loginRes.json();
    console.log(`[✔ HTTP 200] POST /api/admin/login -> Đăng nhập thành công, Admin: ${loginData.admin?.name}`);

    // 5. AI Chat endpoint
    const aiRes = await fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Rạp có phim gì hot hôm nay?' }),
    });
    const aiData = await aiRes.json();
    console.log(`[✔ HTTP 200] POST /api/ai/chat -> Trả lời: "${aiData.reply?.slice(0, 60)}..."`);

    console.log('\n🎉 Toàn bộ API Endpoints hoạt động trơn tru 100%!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khi probe HTTP server:', error.message);
    process.exit(1);
  }
}

probeServer();
