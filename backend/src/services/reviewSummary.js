export function summarizeReviews(reviews = []) {
  const keys = ['oneStar', 'twoStar', 'threeStar', 'fourStar', 'fiveStar'];
  const ratingBreakdown = Object.fromEntries(keys.map(key => [key, 0]));
  const published = reviews.filter(review => review.verifiedAttendance && Number.isInteger(review.rating) && keys[review.rating - 1]);
  for (const review of published) ratingBreakdown[keys[review.rating - 1]]++;
  const total = published.reduce((sum, review) => sum + review.rating, 0);
  return {
    rating: published.length ? Number((total / published.length).toFixed(1)) : null,
    ratingCount: published.length + ' lượt đánh giá',
    ratingBreakdown,
    reviews: published.map(({ _id, userId, userName, rating, comment, createdAt }) => ({ _id, userId, userName, rating, comment, createdAt })),
  };
}
