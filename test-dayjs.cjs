const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

// 模拟从后端返回的 ISO 时间字符串
const isoString = '2026-02-02T12:00:46.304Z';

console.log('=== dayjs 解析测试 ===');
console.log('输入:', isoString);
console.log('');

const d = dayjs(isoString);
console.log('dayjs(isoString).format():', d.format('YYYY-MM-DD HH:mm:ss'));
console.log('dayjs(isoString).utc().format():', d.utc().format('YYYY-MM-DD HH:mm:ss'));
console.log('dayjs(isoString).local().format():', d.local().format('YYYY-MM-DD HH:mm:ss'));
console.log('dayjs(isoString).tz("Asia/Shanghai").format():', d.tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss'));

console.log('');
console.log('=== 系统时区 ===');
console.log('系统时区偏移 (分钟):', new Date().getTimezoneOffset());
console.log('预期本地时间 (UTC+8):', '2026-02-02 20:00:46');
