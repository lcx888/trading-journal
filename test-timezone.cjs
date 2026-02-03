// 测试时区转换逻辑

// 模拟 getTimezoneOffset 函数
function getTimezoneOffset(timezone) {
  const offsets = {
    'Asia/Shanghai': 480,      // UTC+8
    'Europe/London': 0,        // UTC+0
    'America/Chicago': -360,   // UTC-6
    'America/New_York': -300,  // UTC-5
  };
  return offsets[timezone] || 0;
}

// 模拟 convertTimezone 函数（修复后的版本）
function convertTimezone(date, fromTimezone) {
  if (!date) return date;
  const fromOffset = getTimezoneOffset(fromTimezone);
  const realUTCTime = date.getTime() - fromOffset * 60 * 1000;
  return new Date(realUTCTime);
}

console.log('=== 测试场景 1: Excel 显示 20:01:29，数据源时区 = UTC+0 (伦敦) ===');
// XLSX 把 Excel 中的 20:01:29 解析为 UTC 20:01:29
const xlsxDate1 = new Date(Date.UTC(2026, 1, 2, 20, 1, 29));
console.log('XLSX 解析结果 (UTC):', xlsxDate1.toISOString());
console.log('XLSX getUTCHours:', xlsxDate1.getUTCHours());

const converted1 = convertTimezone(xlsxDate1, 'Europe/London');
console.log('转换后 (UTC):', converted1.toISOString());
console.log('转换后 getUTCHours:', converted1.getUTCHours());
console.log('在 UTC+8 显示:', converted1.getUTCHours() + 8, ':', converted1.getUTCMinutes(), ':', converted1.getUTCSeconds());
console.log('预期: UTC 20:01:29, 在 UTC+8 显示 04:01:29 (次日)');
console.log('');

console.log('=== 测试场景 2: Excel 显示 12:00:00，数据源时区 = UTC-6 (芝加哥) ===');
// XLSX 把 Excel 中的 12:00:00 解析为 UTC 12:00:00
const xlsxDate2 = new Date(Date.UTC(2026, 1, 2, 12, 0, 0));
console.log('XLSX 解析结果 (UTC):', xlsxDate2.toISOString());

const converted2 = convertTimezone(xlsxDate2, 'America/Chicago');
console.log('转换后 (UTC):', converted2.toISOString());
console.log('转换后 getUTCHours:', converted2.getUTCHours());
console.log('在 UTC+8 显示:', (converted2.getUTCHours() + 8) % 24, ':', converted2.getUTCMinutes());
console.log('预期: UTC 18:00:00, 在 UTC+8 显示 02:00:00 (次日)');
console.log('');

console.log('=== 您的实际情况 ===');
console.log('Excel 原始时间: 20:01:29');
console.log('如果 dataSourceTimezone = Europe/London (UTC+0):');
const yourCase = new Date(Date.UTC(2026, 1, 2, 20, 1, 29));
const yourConverted = convertTimezone(yourCase, 'Europe/London');
console.log('  存储的 UTC 时间:', yourConverted.toISOString());
console.log('  在 UTC+8 环境显示:', yourConverted.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
