// utils/util.js —— 通用工具函数

// 相对时间
function fromNow(date) {
  if (!date) return '';
  const t = new Date(date).getTime();
  const diff = Date.now() - t;
  const min = 60 * 1000, hour = 60 * min, day = 24 * hour;
  if (diff < min) return '刚刚';
  if (diff < hour) return Math.floor(diff / min) + '分钟前';
  if (diff < day) return Math.floor(diff / hour) + '小时前';
  if (diff < 30 * day) return Math.floor(diff / day) + '天前';
  const d = new Date(t);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

// 金额格式化（分->元 或 直接元）
function money(n) {
  if (n == null || isNaN(n)) return '0';
  return Number(n).toFixed(Number.isInteger(Number(n)) ? 0 : 2);
}

// 简易 toast
function toast(title, icon = 'none') {
  wx.showToast({ title, icon, duration: 1800 });
}

// 邮箱格式校验（要求 edu.cn 后缀，作为校园邮箱门槛）
function isCampusEmail(email) {
  return /^[\w.\-]+@([\w\-]+\.)*edu\.cn$/i.test(email);
}

// 生成 6 位验证码
function genCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += Math.floor(Math.random() * 10);
  return s;
}

module.exports = { fromNow, money, toast, isCampusEmail, genCode };
