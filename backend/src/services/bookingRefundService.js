// Cancellation records an entitlement against the stored checkout total, including discounts.
export function getCancellationRefundUpdate(booking) {
  if (booking.refundStatus && booking.refundStatus !== 'NONE') {
    return {};
  }

  const statusByPayment = { VERIFIED: 'PENDING', SIMULATED: 'SIMULATED' };
  const refundStatus = booking.status === 'PAID' && statusByPayment[booking.paymentStatus];
  if (!refundStatus) return { refundStatus: 'NONE', refundAmount: 0 };

  const paidAmount = booking.totalAmount;
  return {
    refundStatus,
    refundAmount: Number.isFinite(paidAmount) && paidAmount >= 0 ? paidAmount : null,
  };
}
