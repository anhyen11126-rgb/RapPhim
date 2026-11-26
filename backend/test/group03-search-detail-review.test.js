import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { after, before, test } from 'node:test';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import movieRoutes from '../src/routes/movieRoutes.js';
import Booking from '../src/models/Booking.js';
import Cinema from '../src/models/Cinema.js';
import Movie from '../src/models/Movie.js';
import Room from '../src/models/Room.js';
import Showtime from '../src/models/Showtime.js';
import User from '../src/models/User.js';
import { seedDemoReviews } from '../scripts/seedDemoReviews.js';

let server;
let mongo;
let url;
let userCheckedIn;
let userUnchecked;
let userNoTicket;
let userOtherMovie;
let cinema;
let room;
let movieMai;
let movieBoGia;
let movieLatMat;
let movieAvatar;

const modulePath = process.env.DAVENOR_TEST_MONGO_MODULE || 'mongodb-memory-server';

function makeToken(user) {
  return jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

before(async () => {
  process.env.JWT_SECRET = 'group03-test-secret';
  const { MongoMemoryReplSet } = createRequire(import.meta.url)(modulePath);
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri('davenor_group03'));
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));

  const password = await bcrypt.hash('Group03Pass!', 4);
  [userCheckedIn, userUnchecked, userNoTicket, userOtherMovie] = await User.create([
    { name: 'Khách Đã Soát Vé', email: 'g3_checked@test.com', phone: '0907770001', password },
    { name: 'Khách Chưa Soát Vé', email: 'g3_unchecked@test.com', phone: '0907770002', password },
    { name: 'Khách Chưa Mua Vé', email: 'g3_noticket@test.com', phone: '0907770003', password },
    { name: 'Khách Phim Khác', email: 'g3_other@test.com', phone: '0907770004', password },
  ]);

  cinema = await Cinema.create({
    name: "D'AVENOR Thanh Khê Plaza",
    slug: 'g3-thanhkhe',
    city: 'Đà Nẵng',
    district: 'Thanh Khê',
    address: '295 Điện Biên Phủ, Đà Nẵng',
    isFlagship: true,
  });
  room = await Room.create({
    cinemaId: cinema._id,
    name: 'Phòng 01 - IMAX Laser',
    shortName: 'P01',
    roomType: 'IMAX Laser',
    totalSeats: 88,
  });

  [movieMai, movieBoGia, movieLatMat, movieAvatar] = await Movie.create([
    {
      title: 'Mai',
      slug: 'mai',
      genre: 'Tâm Lý, Tình Cảm',
      posterUrl: '/mai.jpg',
      duration: 131,
      status: 'NOW_SHOWING',
      rating: 4.8,
      reviews: [{ userName: 'Đánh giá cũ 1', rating: 5, comment: 'Phim rất cảm động', verifiedAttendance: false }],
    },
    {
      title: 'Bố Già',
      slug: 'bo-gia',
      genre: 'Gia Đình, Hài',
      posterUrl: '/bogia.jpg',
      duration: 128,
      status: 'NOW_SHOWING',
      rating: 4.7,
    },
    {
      title: 'Lật Mặt 7: Một Điều Ước',
      slug: 'lat-mat-7',
      genre: 'Gia Đình, Tâm Lý',
      posterUrl: '/latmat7.jpg',
      duration: 138,
      status: 'NOW_SHOWING',
      rating: 4.6,
    },
    {
      title: 'Avatar: Fire and Ash',
      slug: 'avatar-3',
      genre: 'Khoa Học Viễn Tưởng, Hành Động',
      posterUrl: '/avatar.jpg',
      duration: 180,
      status: 'COMING_SOON',
      rating: 4.9,
    },
  ]);

  // Future showtime for Mai (proving REVIEW-03: checked-in customer can review even before startTime!)
  const futureStart = new Date(Date.now() + 2 * 3600 * 1000);
  const [stMai, stBoGia] = await Showtime.create([
    { movieId: movieMai._id, cinemaId: cinema._id, roomId: room._id, roomName: room.name, startTime: futureStart, endTime: new Date(futureStart.getTime() + 131 * 60000), price: 120000 },
    { movieId: movieBoGia._id, cinemaId: cinema._id, roomId: room._id, roomName: room.name, startTime: futureStart, endTime: new Date(futureStart.getTime() + 128 * 60000), price: 120000 },
  ]);

  await Booking.create([
    { bookingCode: 'G3-CHK-1', userId: userCheckedIn._id, movieId: movieMai._id, roomId: room._id, showtimeId: stMai._id, customerName: userCheckedIn.name, customerPhone: userCheckedIn.phone, seats: 'A1', totalAmount: 120000, status: 'PAID', paymentStatus: 'SIMULATED', isCheckedIn: true, checkedInAt: new Date() },
    { bookingCode: 'G3-UNCHK-1', userId: userUnchecked._id, movieId: movieMai._id, roomId: room._id, showtimeId: stMai._id, customerName: userUnchecked.name, customerPhone: userUnchecked.phone, seats: 'A2', totalAmount: 120000, status: 'PAID', paymentStatus: 'SIMULATED', isCheckedIn: false },
    { bookingCode: 'G3-CANCEL-1', userId: userNoTicket._id, movieId: movieMai._id, roomId: room._id, showtimeId: stMai._id, customerName: userNoTicket.name, customerPhone: userNoTicket.phone, seats: 'A3', totalAmount: 120000, status: 'CANCELLED', paymentStatus: 'SIMULATED', isCheckedIn: true },
    { bookingCode: 'G3-OTHER-1', userId: userOtherMovie._id, movieId: movieBoGia._id, roomId: room._id, showtimeId: stBoGia._id, customerName: userOtherMovie.name, customerPhone: userOtherMovie.phone, seats: 'A4', totalAmount: 120000, status: 'PAID', paymentStatus: 'SIMULATED', isCheckedIn: true, checkedInAt: new Date() },
  ]);

  const app = express();
  app.use(express.json());
  app.use('/api/movies', movieRoutes);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  url = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState) await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

test('SEARCH-04: Vietnamese accent-insensitive & natural phrase search with exact-title ranking', async () => {
  const cases = [
    ['Mai', 'Mai'],
    ['mai', 'Mai'],
    ['MAI', 'Mai'],
    ['phim mai', 'Mai'],
    ['   phim   mai   ', 'Mai'],
    ['Bố Già', 'Bố Già'],
    ['bo gia', 'Bố Già'],
    ['phim bo gia', 'Bố Già'],
    ['Lật Mặt', 'Lật Mặt 7: Một Điều Ước'],
    ['lat mat', 'Lật Mặt 7: Một Điều Ước'],
    ['Avatar', 'Avatar: Fire and Ash'],
    ['phim avatar', 'Avatar: Fire and Ash'],
  ];

  for (const [q, expectedTitle] of cases) {
    const res = await fetch(`${url}/api/movies?search=${encodeURIComponent(q)}`);
    assert.equal(res.status, 200);
    const list = await res.json();
    assert.ok(list.length >= 1, `Expected results for query "${q}"`);
    assert.equal(list[0].title, expectedTitle, `Query "${q}" should rank "${expectedTitle}" first, got "${list[0].title}"`);
  }

  // Non-existent keyword returns empty array
  const noneRes = await fetch(`${url}/api/movies?search=${encodeURIComponent('khong ton tai xyz 999')}`);
  assert.deepEqual(await noneRes.json(), []);
});

test('SEARCH-07: Genre filter works standalone and combined with search keyword', async () => {
  const resGenre = await fetch(`${url}/api/movies?genre=${encodeURIComponent('Gia Đình')}`);
  const byGenre = await resGenre.json();
  assert.equal(byGenre.length, 2);

  const resCombined = await fetch(`${url}/api/movies?genre=${encodeURIComponent('Gia Đình')}&search=${encodeURIComponent('bo gia')}`);
  const combined = await resCombined.json();
  assert.equal(combined.length, 1);
  assert.equal(combined[0].title, 'Bố Già');
});

test('DETAIL-08, DETAIL-11 & REVIEW-01: Preserves externalRating & demoReviews, handles 404 cleanly, seedDemoReviews is idempotent', async () => {
  const res = await fetch(`${url}/api/movies/${movieMai._id}`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.externalRating, 4.8);
  assert.equal(data.rating, null, 'Verified customer rating starts null until verified review posted');
  assert.equal(data.demoReviews.length, 1, 'Existing legacy review preserved in demoReviews');

  // Non-existent movie ID -> 404 (not 500)
  const notFound = await fetch(`${url}/api/movies/600000000000000000000000`);
  assert.equal(notFound.status, 404);
  const badSlug = await fetch(`${url}/api/movies/invalid-movie-slug-404`);
  assert.equal(badSlug.status, 404);

  // Idempotent seedDemoReviews
  const run1 = await seedDemoReviews();
  const run2 = await seedDemoReviews();
  assert.ok(run1.reviewsAdded > 0);
  assert.equal(run2.reviewsAdded, 0, 'Running seedDemoReviews twice must not create duplicates');
});

test('REVIEW-03..08: Checked-in customer (including SIMULATED & pre-startTime) can review & update; unauthorized/unchecked/other-movie/cancelled blocked; XSS sanitized', async () => {
  const postReview = async (user, body) => {
    const headers = { 'Content-Type': 'application/json' };
    if (user) headers.Authorization = `Bearer ${makeToken(user)}`;
    const res = await fetch(`${url}/api/movies/${movieMai._id}/reviews`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  // Unauthenticated -> 401
  assert.equal((await postReview(null, { rating: 5, comment: 'Test' })).status, 401);
  // Paid but NOT checked in -> 403
  assert.equal((await postReview(userUnchecked, { rating: 5, comment: 'Test' })).status, 403);
  // Cancelled booking -> 403
  assert.equal((await postReview(userNoTicket, { rating: 5, comment: 'Test' })).status, 403);
  // Checked in for DIFFERENT movie -> 403
  assert.equal((await postReview(userOtherMovie, { rating: 5, comment: 'Test' })).status, 403);
  // Invalid rating / empty comment -> 400
  assert.equal((await postReview(userCheckedIn, { rating: 6, comment: 'Test' })).status, 400);
  assert.equal((await postReview(userCheckedIn, { rating: 5, comment: '   ' })).status, 400);

  // Valid checked-in customer (SIMULATED payment, future startTime) + XSS sanitization -> 201
  const created = await postReview(userCheckedIn, { rating: 5, comment: '<script>alert(1)</script>Phim rất hay!' });
  assert.equal(created.status, 201);
  assert.equal(created.body.rating, 5);
  assert.equal(created.body.reviews.length, 1);
  assert.equal(created.body.review.comment.includes('<script>'), false, 'HTML tags must be stripped');

  // Re-submitting updates existing review without duplicating -> 200
  const updated = await postReview(userCheckedIn, { rating: 4, comment: 'Cập nhật lại: 4 sao rất ổn' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.updated, true);
  assert.equal(updated.body.rating, 4);
  assert.equal(updated.body.reviews.length, 1, 'Must not duplicate review on update');
});

test('DISCUSSION UPGRADE: Comment vs Star Rating permissions, likes, replies, edit/delete/report, and strict rating aggregation', async () => {
  const apiCall = async (path, { method = 'GET', user = null, body = undefined } = {}) => {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (user) headers.Authorization = `Bearer ${makeToken(user)}`;
    const res = await fetch(`${url}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  // 1. Check viewerEligibility across all 4 roles on movieBoGia (clean slate)
  const guestDetail = await apiCall(`/api/movies/${movieBoGia._id}`);
  assert.equal(guestDetail.body.viewerEligibility.isLoggedIn, false);
  assert.equal(guestDetail.body.viewerEligibility.canComment, false);
  assert.equal(guestDetail.body.viewerEligibility.canRate, false);

  const noTicketDetail = await apiCall(`/api/movies/${movieBoGia._id}`, { user: userNoTicket });
  assert.equal(noTicketDetail.body.viewerEligibility.canComment, true);
  assert.equal(noTicketDetail.body.viewerEligibility.hasBookedTicket, false);
  assert.equal(noTicketDetail.body.viewerEligibility.canRate, false);

  const bookedUncheckedDetail = await apiCall(`/api/movies/${movieMai._id}`, { user: userUnchecked });
  assert.equal(bookedUncheckedDetail.body.viewerEligibility.hasBookedTicket, true);
  assert.equal(bookedUncheckedDetail.body.viewerEligibility.hasWatchedMovie, false);
  assert.equal(bookedUncheckedDetail.body.viewerEligibility.canRate, false);

  const watchedDetail = await apiCall(`/api/movies/${movieBoGia._id}`, { user: userOtherMovie });
  assert.equal(watchedDetail.body.viewerEligibility.hasWatchedMovie, true);
  assert.equal(watchedDetail.body.viewerEligibility.canRate, true);

  // 2. Logged-in WITHOUT ticket can post multiple plain comments (rating: null) but CANNOT rate stars (403)
  const blockedRate = await apiCall(`/api/movies/${movieBoGia._id}/reviews`, {
    method: 'POST',
    user: userNoTicket,
    body: { rating: 5, comment: 'Thử chấm sao khi chưa xem' },
  });
  assert.equal(blockedRate.status, 403);

  const plain1 = await apiCall(`/api/movies/${movieBoGia._id}/reviews`, {
    method: 'POST',
    user: userNoTicket,
    body: { rating: null, comment: 'Phim này có buồn không mọi người?' },
  });
  assert.equal(plain1.status, 201);
  assert.equal(plain1.body.review.rating, null);
  assert.equal(plain1.body.rating, null, 'Plain comment must NOT create a star average');
  assert.equal(plain1.body.verifiedRatingCount, 0);

  const plain2 = await apiCall(`/api/movies/${movieBoGia._id}/reviews`, {
    method: 'POST',
    user: userNoTicket,
    body: { comment: 'Mình hỏi thêm lịch cuối tuần có suất tối không?' },
  });
  assert.equal(plain2.status, 201);
  assert.equal(plain2.body.reviews.length, 2, 'Users can post multiple regular comments');

  // 3. Booked-not-checked-in user gets hasBookedTicket: true on plain comment
  const bookedComment = await apiCall(`/api/movies/${movieMai._id}/reviews`, {
    method: 'POST',
    user: userUnchecked,
    body: { comment: 'Mình đã đặt vé tối nay, hóng quá!' },
  });
  assert.equal(bookedComment.status, 201);
  assert.equal(bookedComment.body.review.hasBookedTicket, true);
  assert.equal(bookedComment.body.review.verifiedAttendance, false);
  assert.equal(bookedComment.body.review.rating, null);

  // 4. Like & unlike comment (1 like per account)
  const commentId = plain1.body.review._id;
  assert.equal((await apiCall(`/api/movies/${movieBoGia._id}/reviews/${commentId}/like`, { method: 'POST' })).status, 401);

  const liked = await apiCall(`/api/movies/${movieBoGia._id}/reviews/${commentId}/like`, {
    method: 'POST',
    user: userOtherMovie,
  });
  assert.equal(liked.status, 200);
  assert.equal(liked.body.liked, true);
  const likedReview = liked.body.reviews.find((r) => String(r._id) === String(commentId));
  assert.equal(likedReview.likesCount, 1);
  assert.equal(likedReview.likedByCurrentUser, true);

  const unliked = await apiCall(`/api/movies/${movieBoGia._id}/reviews/${commentId}/like`, {
    method: 'POST',
    user: userOtherMovie,
  });
  assert.equal(unliked.status, 200);
  assert.equal(unliked.body.liked, false);
  assert.equal(unliked.body.reviews.find((r) => String(r._id) === String(commentId)).likesCount, 0);

  // 5. Reply to comment (verified viewer reply gets verifiedAttendance: true) + like reply
  const replyRes = await apiCall(`/api/movies/${movieBoGia._id}/reviews/${commentId}/replies`, {
    method: 'POST',
    user: userOtherMovie,
    body: { comment: 'Mình xem rồi, phim vừa hài vừa cảm động lắm!' },
  });
  assert.equal(replyRes.status, 201);
  assert.equal(replyRes.body.reply.verifiedAttendance, true);
  const replyId = replyRes.body.reply._id;

  const replyLike = await apiCall(`/api/movies/${movieBoGia._id}/reviews/${commentId}/replies/${replyId}/like`, {
    method: 'POST',
    user: userNoTicket,
  });
  assert.equal(replyLike.status, 200);
  assert.equal(replyLike.body.liked, true);
  const parentAfterReplyLike = replyLike.body.reviews.find((r) => String(r._id) === String(commentId));
  assert.equal(parentAfterReplyLike.replies[0].likesCount, 1);

  // 6. Ownership checks on Edit (PATCH) and Report
  const forbiddenEdit = await apiCall(`/api/movies/${movieBoGia._id}/reviews/${commentId}`, {
    method: 'PATCH',
    user: userOtherMovie,
    body: { comment: 'Sửa trộm bình luận người khác' },
  });
  assert.equal(forbiddenEdit.status, 403);

  const ownEdit = await apiCall(`/api/movies/${movieBoGia._id}/reviews/${commentId}`, {
    method: 'PATCH',
    user: userNoTicket,
    body: { comment: 'Phim này có buồn không mọi người? (đã cập nhật câu hỏi)' },
  });
  assert.equal(ownEdit.status, 200);
  assert.ok(ownEdit.body.reviews.find((r) => String(r._id) === String(commentId)).updatedAt);

  const selfReport = await apiCall(`/api/movies/${movieBoGia._id}/reviews/${commentId}/report`, {
    method: 'POST',
    user: userNoTicket,
    body: { reason: 'Test' },
  });
  assert.equal(selfReport.status, 400);

  const validReport = await apiCall(`/api/movies/${movieBoGia._id}/reviews/${commentId}/report`, {
    method: 'POST',
    user: userOtherMovie,
    body: { reason: 'Spam' },
  });
  assert.equal(validReport.status, 200);

  // 7. Verified viewer posts a 5-star review; average is 5.0 and breakdown counts ONLY this 1 rating (not plain comments/replies/demo)
  const verifiedRate = await apiCall(`/api/movies/${movieBoGia._id}/reviews`, {
    method: 'POST',
    user: userOtherMovie,
    body: { rating: 5, comment: 'Rất đáng xem cùng gia đình!' },
  });
  assert.equal(verifiedRate.status, 201);
  assert.equal(verifiedRate.body.rating, 5);
  assert.equal(verifiedRate.body.verifiedRatingCount, 1);
  assert.equal(verifiedRate.body.ratingBreakdown.fiveStar, 1);
  assert.equal(verifiedRate.body.ratingBreakdown.oneStar, 0);

  // 8. Deleting verified star rating resets movie average back to null
  const deletedRate = await apiCall(`/api/movies/${movieBoGia._id}/reviews/${verifiedRate.body.review._id}`, {
    method: 'DELETE',
    user: userOtherMovie,
  });
  assert.equal(deletedRate.status, 200);
  assert.equal(deletedRate.body.rating, null);
  assert.equal(deletedRate.body.verifiedRatingCount, 0);
  assert.equal(deletedRate.body.ratingBreakdown.fiveStar, 0);
});
