const fs = require('fs');
const path = require('path');

// 排除的目录
const EXCLUDED_DIRS = ['.git'];

// 格式化文件大小
function formatSize(bytes) {
  if (bytes >= 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  } else if (bytes >= 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  } else if (bytes >= 1024) {
    return (bytes / 1024).toFixed(2) + ' KB';
  }
  return bytes + ' B';
}

// 获取目录大小
function getDirSize(dirPath) {
  let totalSize = 0;
  try {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          totalSize += getDirSize(fullPath);
        } else {
          totalSize += stat.size;
        }
      } catch (e) {
        // 忽略无法访问的文件
      }
    }
  } catch (e) {
    // 忽略无法访问的目录
  }
  return totalSize;
}

// 收集所有文件和文件夹
function collectItems(dirPath, files = [], folders = [], relativeTo = dirPath) {
  try {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      // 跳过排除的目录
      if (EXCLUDED_DIRS.includes(item)) continue;
      
      const fullPath = path.join(dirPath, item);
      const relativePath = path.relative(relativeTo, fullPath);
      
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          const size = getDirSize(fullPath);
          folders.push({ path: relativePath, size });
          // 递归收集子目录
          collectItems(fullPath, files, [], relativeTo);
        } else {
          files.push({ path: relativePath, size: stat.size });
        }
      } catch (e) {
        // 忽略无法访问的文件
      }
    }
  } catch (e) {
    // 忽略无法访问的目录
  }
  return { files, folders };
}

// 主函数
function main() {
  const targetDir = process.cwd();
  console.log('📂 扫描目录:', targetDir);
  console.log('⏳ 正在扫描，请稍候...\n');
  
  const startTime = Date.now();
  const { files, folders } = collectItems(targetDir);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  // 排序
  files.sort((a, b) => b.size - a.size);
  folders.sort((a, b) => b.size - a.size);
  
  // 输出结果
  console.log('='.repeat(60));
  console.log('📊 扫描完成！耗时:', duration, '秒');
  console.log('📦 项目总大小:', formatSize(getDirSize(targetDir)));
  console.log('='.repeat(60));
  
  console.log('\n🗂️  占用空间最大的 10 个文件夹:\n');
  console.log('    排名    大小          路径');
  console.log('    ' + '-'.repeat(50));
  folders.slice(0, 10).forEach((folder, index) => {
    const rank = String(index + 1).padStart(2, ' ');
    const size = formatSize(folder.size).padStart(10, ' ');
    console.log(`    ${rank}.   ${size}    ${folder.path}`);
  });
  
  console.log('\n📄 占用空间最大的 10 个文件:\n');
  console.log('    排名    大小          路径');
  console.log('    ' + '-'.repeat(50));
  files.slice(0, 10).forEach((file, index) => {
    const rank = String(index + 1).padStart(2, ' ');
    const size = formatSize(file.size).padStart(10, ' ');
    console.log(`    ${rank}.   ${size}    ${file.path}`);
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('💡 提示: node_modules 通常是最大的目录，可以通过 npm prune 清理');
  console.log('💡 提示: dist 目录可以安全删除后重新构建');
  console.log('='.repeat(60));
}

main();
