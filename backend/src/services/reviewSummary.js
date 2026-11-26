const STAR_KEYS = ['oneStar', 'twoStar', 'threeStar', 'fourStar', 'fiveStar'];

const toIdString = (val) => (val ? String(val) : null);

const normalizeLikes = (item, currentUserIdStr) => {
  const rawLikes = Array.isArray(item?.likes) ? item.likes.map((id) => String(id)) : [];
  const baseCount = Number.isFinite(Number(item?.likesCount)) ? Number(item.likesCount) : 0;
  const likesCount = item?.isDemo || !item?.userId
    ? baseCount + rawLikes.length
    : rawLikes.length;
  const likedByCurrentUser = Boolean(currentUserIdStr && rawLikes.includes(currentUserIdStr));
  return { likesCount, likedByCurrentUser };
};

const formatReply = (reply, currentUserIdStr) => {
  const { likesCount, likedByCurrentUser } = normalizeLikes(reply, currentUserIdStr);
  const isDemo = Boolean(reply?.isDemo || (!reply?.userId && !reply?.verifiedAttendance));
  return {
    _id: reply._id,
    userId: reply.userId || null,
    userName: reply.userName || 'Khán giả',
    comment: reply.comment || '',
    verifiedAttendance: Boolean(reply.verifiedAttendance && !isDemo),
    hasBookedTicket: Boolean((reply.hasBookedTicket || reply.verifiedAttendance) && !isDemo),
    isDemo,
    likesCount,
    likedByCurrentUser,
    createdAt: reply.createdAt || null,
    updatedAt: reply.updatedAt || null,
  };
};

const formatReviewItem = (item, source, currentUserIdStr) => {
  const { likesCount, likedByCurrentUser } = normalizeLikes(item, currentUserIdStr);
  const validRating = Number.isInteger(item?.rating) && item.rating >= 1 && item.rating <= 5
    ? item.rating
    : (source === 'DEMO' && Number.isFinite(Number(item?.rating)) && Number(item.rating) >= 1 && Number(item.rating) <= 5
        ? Number(item.rating)
        : null);
  const replies = Array.isArray(item?.replies)
    ? item.replies.map((r) => formatReply(r, currentUserIdStr))
    : [];
  const isDemo = source === 'DEMO';

  return {
    _id: item._id,
    userId: item.userId || null,
    userName: item.userName || 'Khán giả',
    rating: validRating,
    comment: item.comment || '',
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
    source,
    isDemo,
    verifiedAttendance: Boolean(item.verifiedAttendance && !isDemo),
    hasBookedTicket: Boolean((item.hasBookedTicket || item.verifiedAttendance) && !isDemo),
    likesCount,
    likedByCurrentUser,
    replies,
    repliesCount: replies.length,
  };
};

export function summarizeReviews(reviews = [], currentUserId = null) {
  const currentUserIdStr = toIdString(currentUserId);
  const ratingBreakdown = Object.fromEntries(STAR_KEYS.map((key) => [key, 0]));

  // Chỉ tính điểm trung bình và biểu đồ sao từ đánh giá có sao (1-5) của khách hàng thật (đã xác minh hoặc đánh giá khách hàng thật có userId, loại trừ hoàn toàn demo/chưa có userId)
  const verifiedRatings = reviews.filter(
    (review) =>
      !review?.isDemo &&
      (Boolean(review?.verifiedAttendance) || Boolean(review?.userId)) &&
      Number.isInteger(review?.rating) &&
      Boolean(STAR_KEYS[review.rating - 1])
  );

  for (const review of verifiedRatings) {
    ratingBreakdown[STAR_KEYS[review.rating - 1]]++;
  }
  const total = verifiedRatings.reduce((sum, review) => sum + review.rating, 0);

  // Danh sách bình luận/đánh giá thật của khách hàng (có userId, không phải demo)
  const customerItems = reviews.filter((review) => !review?.isDemo && Boolean(review?.userId));

  // Bảo toàn các đánh giá / bình luận cũ hoặc mẫu (DEMO) tách biệt hoàn toàn khỏi điểm xác minh
  const demoItems = reviews.filter((review) => Boolean(review?.isDemo) || (!review?.verifiedAttendance && !review?.userId));
  const demoRated = demoItems.filter(
    (review) => Number.isFinite(Number(review?.rating)) && Number(review.rating) >= 1 && Number(review.rating) <= 5
  );
  const demoTotal = demoRated.reduce((sum, review) => sum + Number(review.rating), 0);

  const formattedCustomer = customerItems.map((item) => formatReviewItem(item, 'CUSTOMER', currentUserIdStr));
  const formattedDemo = demoItems.map((item) => formatReviewItem(item, 'DEMO', currentUserIdStr));

  return {
    rating: verifiedRatings.length ? Number((total / verifiedRatings.length).toFixed(1)) : null,
    ratingCount: `${verifiedRatings.length} lượt đánh giá`,
    verifiedRatingCount: verifiedRatings.length,
    commentCount: formattedCustomer.length + formattedDemo.length,
    ratingBreakdown,
    reviews: formattedCustomer,
    demoRating: demoRated.length ? Number((demoTotal / demoRated.length).toFixed(1)) : null,
    demoReviewsCount: formattedDemo.length,
    demoReviews: formattedDemo,
  };
}
