import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const trade = await prisma.trade.findFirst({
    where: { instrumentCode: { contains: 'MNQ' } },
    orderBy: { createdAt: 'desc' }
  });
  
  if (trade) {
    console.log('=== 数据库中的时间 ===');
    console.log('openTime (raw):', trade.openTime);
    console.log('openTime type:', typeof trade.openTime);
    console.log('openTime instanceof Date:', trade.openTime instanceof Date);
    if (trade.openTime) {
      console.log('toISOString:', trade.openTime.toISOString());
      console.log('getUTCHours:', trade.openTime.getUTCHours());
      console.log('getHours (local):', trade.openTime.getHours());
    }
    
    const data = JSON.parse(trade.data);
    console.log('\n=== data JSON 中的时间 ===');
    console.log('data.openTime:', data.openTime);
    console.log('data.closeTime:', data.closeTime);
    console.log('data.sourceTimezone:', data.sourceTimezone);
    console.log('data.displayTimezone:', data.displayTimezone);
    console.log('data.importedAt:', data.importedAt);
    
    console.log('\n=== 分析 ===');
    // Excel 原始时间是 20:01:29
    // 数据库存储的是 12:00:46 UTC
    // 差了 8 小时，说明导入时把 20:01:29 当作 UTC+8 处理了
    // 然后减去了 8 小时变成 12:01:29 UTC
    console.log('Excel 原始时间: 20:01:29');
    console.log('数据库 UTC 时间:', trade.openTime?.getUTCHours() + ':' + trade.openTime?.getUTCMinutes() + ':' + trade.openTime?.getUTCSeconds());
    console.log('差距: 8 小时 (说明导入时 dataSourceTimezone 设置为 Asia/Shanghai)');
  } else {
    console.log('没有找到 MNQ 交易');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
