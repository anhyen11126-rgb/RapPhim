import React from 'react';

const SeatItem = ({ seatNumber, type = 'standard', status = 'available', isSelected = false, onSelect }) => {
  // status: available, booked, vip
  const getSeatColor = () => {
    if (status === 'booked') return 'bg-slate-700 text-slate-500 cursor-not-allowed';
    if (isSelected) return 'bg-emerald-500 text-white font-bold ring-2 ring-emerald-300';
    if (type === 'vip') return 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer';
    return 'bg-slate-600 hover:bg-slate-500 text-slate-200 cursor-pointer';
  };

  return (
    <button
      type="button"
      disabled={status === 'booked'}
      onClick={() => onSelect && onSelect(seatNumber)}
      className={`w-8 h-8 md:w-9 md:h-9 m-1 text-xs rounded-t-md transition-colors flex items-center justify-center ${getSeatColor()}`}
      title={`${seatNumber} (${type})`}
    >
      {seatNumber}
    </button>
  );
};

export default SeatItem;

