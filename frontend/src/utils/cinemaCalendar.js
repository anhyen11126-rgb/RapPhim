const vietnamDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' });

export function cinemaDate(value = Date.now()) {
  if (value == null || value === '') return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? vietnamDate.format(date) : '';
}

export function releaseMonth(movie) {
  return cinemaDate(movie?.releaseDate).slice(0, 7);
}

export function monthLabel(month) {
  return month ? 'Tháng ' + month.slice(5, 7) + '/' + month.slice(0, 4) : '';
}

