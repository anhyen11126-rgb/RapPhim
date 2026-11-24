const vietnamDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
});
const dayMs = 86400000;
export const businessDate = date => vietnamDate.format(date);

export function opensMoreThanSevenDaysAhead(start, now = new Date()) {
  return Date.parse(businessDate(start)) - Date.parse(businessDate(now)) > 7 * dayMs;
}
